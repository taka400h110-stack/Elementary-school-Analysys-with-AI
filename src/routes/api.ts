import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const api = new Hono<{ Bindings: Bindings }>()

// 1. 学年・学級一覧取得
api.get('/classes', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT c.id, s.year, c.grade, c.class_no, c.metadata 
    FROM classes c 
    JOIN school_years s ON c.school_year_id = s.id
    ORDER BY s.year DESC, c.grade ASC, c.class_no ASC
  `).all()
  return c.json({ classes: results })
})

// 2. 名簿（児童）一覧取得
api.get('/classes/:class_id/students', async (c) => {
  const classId = c.req.param('class_id')
  const { results } = await c.env.DB.prepare(`
    SELECT seat_no, student_uuid, status 
    FROM enrollments 
    WHERE class_id = ? 
    ORDER BY seat_no ASC
  `).bind(classId).all()
  return c.json({ students: results })
})

// 3. 名簿自動生成
api.post('/classes/:class_id/generate_roster', async (c) => {
  const classId = c.req.param('class_id')
  const { start_no, end_no } = await c.req.json()
  
  // start_no から end_no までの出席番号を生成
  const start = parseInt(start_no, 10)
  const end = parseInt(end_no, 10)
  
  for (let i = start; i <= end; i++) {
    const seatNo = i.toString().padStart(2, '0')
    const uuid = crypto.randomUUID()
    
    // students テーブルに匿名UUIDを登録
    await c.env.DB.prepare('INSERT INTO students (student_uuid) VALUES (?)').bind(uuid).run()
    
    // enrollments に登録
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO enrollments (student_uuid, class_id, seat_no) 
      VALUES (?, ?, ?)
    `).bind(uuid, classId, seatNo).run()
  }
  
  return c.json({ success: true, message: `${end - start + 1}名分の名簿を作成しました` })
})

// 4. 授業セッションの開始
api.post('/sessions/start', async (c) => {
  const { class_id, unit_id, lesson_number } = await c.req.json()
  
  // 簡易的に lessons レコードを作成
  const lessonRes = await c.env.DB.prepare(`
    INSERT INTO lessons (unit_id, lesson_number) VALUES (?, ?) RETURNING id
  `).bind(unit_id, lesson_number).first()
  
  const lessonId = lessonRes?.id

  // セッションを開始
  const sessionRes = await c.env.DB.prepare(`
    INSERT INTO sessions (lesson_id, start_time, end_time, status) 
    VALUES (?, datetime('now'), datetime('now', '+45 minutes'), 'active') 
    RETURNING id
  `).bind(lessonId).first()
  
  return c.json({ success: true, session_id: sessionRes?.id })
})

// 5. 児童ログイン（授業中2桁ログイン）
api.post('/student/login', async (c) => {
  const { class_id, seat_no } = await c.req.json()
  
  // 名簿から児童のUUIDを取得
  const student = await c.env.DB.prepare(`
    SELECT student_uuid FROM enrollments 
    WHERE class_id = ? AND seat_no = ? AND status = 'active'
  `).bind(class_id, seat_no).first()
  
  if (!student) {
    return c.json({ success: false, message: '出席番号が見つかりません' }, 404)
  }

  // 進行中のセッションを取得（MVPなので最新のactiveセッションを取得）
  const session = await c.env.DB.prepare(`
    SELECT s.id FROM sessions s
    JOIN lessons l ON s.lesson_id = l.id
    JOIN units u ON l.unit_id = u.id
    WHERE u.class_id = ? AND s.status = 'active'
    ORDER BY s.created_at DESC LIMIT 1
  `).bind(class_id).first()

  if (!session) {
    return c.json({ success: false, message: '現在開始されている授業がありません' }, 403)
  }

  // ログイン記録
  await c.env.DB.prepare(`
    INSERT INTO session_logins (session_id, student_uuid) VALUES (?, ?)
  `).bind(session.id, student.student_uuid).run()

  return c.json({ 
    success: true, 
    student_uuid: student.student_uuid, 
    session_id: session.id 
  })
})

// 6. 下書きの保存
api.post('/student/draft', async (c) => {
  const { session_id, student_uuid, content } = await c.req.json()
  
  await c.env.DB.prepare(`
    INSERT INTO drafts (session_id, student_uuid, content) VALUES (?, ?, ?)
  `).bind(session_id, student_uuid, content).run()
  
  return c.json({ success: true, message: '下書きを保存しました' })
})

export { api }
// 7. AIとの対話（チャットターン）
api.post('/student/chat', async (c) => {
  const { session_id, student_uuid, prompt, turn_number } = await c.req.json()
  
  // ※ ここではMVPとして、システム内部のモックAI応答を生成します
  // 本格運用の際はここにOpenAIなどのAPI呼び出しを追加します
  const aiResponses = [
    "なるほど、そう考えたんだね！図に描いてみるとどうなるかな？",
    "いい着眼点だね。他に比べられる方法はあるかな？",
    "式に表すとどういう意味になるか、言葉で説明できる？",
    "その考え方を別の言葉で言い換えてみてくれる？"
  ]
  const output = aiResponses[turn_number % aiResponses.length]
  
  // DBにチャットログを保存
  await c.env.DB.prepare(`
    INSERT INTO chat_turns (session_id, student_uuid, turn_number, tool_name, prompt, output) 
    VALUES (?, ?, ?, 'System-AI-Mock', ?, ?)
  `).bind(session_id, student_uuid, turn_number, prompt, output).run()
  
  return c.json({ success: true, output })
})

// 8. 最終提出
api.post('/student/submit', async (c) => {
  const { session_id, student_uuid, final_content } = await c.req.json()
  
  // 下書きとの差分（diff）計算などは今後の拡張とし、今回はそのまま保存
  await c.env.DB.prepare(`
    INSERT INTO submissions (session_id, student_uuid, final_content) 
    VALUES (?, ?, ?)
  `).bind(session_id, student_uuid, final_content).run()
  
  return c.json({ success: true, message: '提出が完了しました' })
})

// 9. ISM構造データの取得 (map(T))
api.get('/units/:unit_id/ism', async (c) => {
  const unitId = c.req.param('unit_id')
  
  const nodesRes = await c.env.DB.prepare(`
    SELECT * FROM nodes WHERE unit_id = ? ORDER BY level ASC, node_code ASC
  `).bind(unitId).all()
  
  const edgesRes = await c.env.DB.prepare(`
    SELECT e.*, 
           n1.node_code as from_code, n1.node_name as from_name,
           n2.node_code as to_code, n2.node_name as to_name
    FROM edges_T e
    JOIN nodes n1 ON e.from_node_id = n1.id
    JOIN nodes n2 ON e.to_node_id = n2.id
    WHERE e.unit_id = ?
  `).bind(unitId).all()
  
  return c.json({ nodes: nodesRes.results, edges: edgesRes.results })
})

// 10. セッションの学習ログ一覧取得
api.get('/sessions/:session_id/logs', async (c) => {
  const sessionId = c.req.param('session_id')
  
  // 参加した児童の一覧
  const studentsRes = await c.env.DB.prepare(`
    SELECT DISTINCT e.seat_no, sl.student_uuid
    FROM session_logins sl
    JOIN enrollments e ON sl.student_uuid = e.student_uuid
    WHERE sl.session_id = ?
    ORDER BY e.seat_no ASC
  `).bind(sessionId).all()
  
  const draftsRes = await c.env.DB.prepare(`SELECT * FROM drafts WHERE session_id = ?`).bind(sessionId).all()
  const chatsRes = await c.env.DB.prepare(`SELECT * FROM chat_turns WHERE session_id = ? ORDER BY turn_number ASC`).bind(sessionId).all()
  const submissionsRes = await c.env.DB.prepare(`SELECT * FROM submissions WHERE session_id = ?`).bind(sessionId).all()
  
  return c.json({
    students: studentsRes.results,
    drafts: draftsRes.results,
    chats: chatsRes.results,
    submissions: submissionsRes.results
  })
})

// 11. 分析データ取得 (t係数とSP表のMVPモック)
api.get('/sessions/:session_id/analysis', async (c) => {
  // 本来は map(T) と map(S) の矢線一致度からエントロピーHと相互情報量Iを計算し t = I/H を求めます。
  // MVP用として、ダミー計算結果を返します。
  const mockT = 0.45;
  const mockInterpretation = "よく理解している";
  
  // SP表モック
  const mockSP = {
    problems: ["Q1(E1)", "Q2(E2)", "Q3(E3)", "Q4(E4)", "Q5(E5)"],
    students: [
      { seat: "01", scores: [1, 1, 1, 1, 0], total: 4 },
      { seat: "02", scores: [1, 1, 1, 0, 0], total: 3 },
      { seat: "03", scores: [1, 1, 0, 1, 0], total: 3 },
      { seat: "04", scores: [1, 0, 0, 0, 0], total: 1 }
    ]
  };
  
  return c.json({
    t_coefficient: mockT,
    interpretation: mockInterpretation,
    sp_table: mockSP
  })
})
