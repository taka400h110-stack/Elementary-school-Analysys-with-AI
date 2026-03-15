import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const teacherApp = new Hono<{ Bindings: Bindings }>()

// ----------------------
// 学級・名簿管理
// ----------------------
teacherApp.get('/classes', async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT c.*, s.year 
    FROM classes c 
    JOIN school_years s ON c.school_year_id = s.id
  `).all()
  return c.json({ classes: results })
})

teacherApp.get('/classes/:id/students', async (c) => {
  const classId = c.req.param('id')
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT e.seat_no, s.student_uuid
      FROM enrollments e
      JOIN students s ON e.student_uuid = s.student_uuid
      WHERE e.class_id = ?
      ORDER BY e.seat_no ASC
    `).bind(classId).all()
    return c.json({ success: true, students: results })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 400)
  }
})

teacherApp.post('/classes', async (c) => {
  const body = await c.req.json()
  try {
    const result = await c.env.DB.prepare(
      'INSERT INTO classes (school_year_id, grade, class_no, metadata) VALUES (?, ?, ?, ?)'
    ).bind(body.school_year_id || 1, body.grade, body.class_no, JSON.stringify(body.metadata || {})).run()
    return c.json({ success: true, id: result.meta.last_row_id })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 400)
  }
})

teacherApp.post('/enrollments/generate', async (c) => {
  const body = await c.req.json()
  const { class_id, start_no, end_no } = body
  try {
    const st = parseInt(start_no); const ed = parseInt(end_no);
    let count = 0;
    for(let i = st; i <= ed; i++) {
      const seatNo = i.toString().padStart(2, '0')
      const uuid = crypto.randomUUID()
      await c.env.DB.prepare('INSERT INTO students (student_uuid) VALUES (?)').bind(uuid).run()
      await c.env.DB.prepare(
        'INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES (?, ?, ?)'
      ).bind(uuid, class_id, seatNo).run()
      count++
    }
    return c.json({ success: true, count })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 400)
  }
})

// ----------------------
// 単元管理
// ----------------------
teacherApp.get('/units', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM units ORDER BY id ASC').all()
  return c.json({ units: results })
})

teacherApp.post('/units', async (c) => {
  const body = await c.req.json()
  try {
    const result = await c.env.DB.prepare(
      'INSERT INTO units (class_id, subject, unit_name, unit_plan, evaluation_criteria, version) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      body.class_id || 1, 
      body.subject, 
      body.unit_name, 
      body.unit_plan || '', 
      '{"knowledge": true, "thinking": true}', 
      1
    ).run()
    return c.json({ success: true, id: result.meta.last_row_id })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 400)
  }
})

teacherApp.delete('/units/:id', async (c) => {
  const id = c.req.param('id')
  try {
    // 関連データを削除 (外部キー制約があるため順序に注意、またはCASCADEに依存)
    await c.env.DB.prepare('DELETE FROM edges_T WHERE unit_id = ?').bind(id).run()
    await c.env.DB.prepare('DELETE FROM nodes WHERE unit_id = ?').bind(id).run()
    await c.env.DB.prepare('DELETE FROM lessons WHERE unit_id = ?').bind(id).run()
    await c.env.DB.prepare('DELETE FROM units WHERE id = ?').bind(id).run()
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 400)
  }
})

// AI提案モック
teacherApp.post('/units/ai-propose', async (c) => {
  return c.json({
    success: true,
    nodes: [
      { code: 'E1', name: '用語同定', type: 'K', rubric: '割合の言葉の意味を正しく捉えている' },
      { code: 'E2', name: '比べ方選択', type: 'T', rubric: '適切な比べ方を選択できる' },
      { code: 'E3', name: '割合の式', type: 'T', rubric: '割合を求める式を正しく立てられる' }
    ],
    edges: [
      { from: 'E1', to: 'E3', type: 'prerequisite', confidence: 0.9 },
      { from: 'E2', to: 'E3', type: 'prerequisite', confidence: 0.85 }
    ]
  })
})

// ----------------------
// 授業・出席管理
// ----------------------
teacherApp.get('/sessions/active', async (c) => {
  const session = await c.env.DB.prepare("SELECT * FROM sessions WHERE status = 'active' ORDER BY id DESC LIMIT 1").first()
  if(!session) return c.json({ active: false })
  
  const logins = await c.env.DB.prepare(`
    SELECT sl.login_at, e.seat_no 
    FROM session_logins sl 
    JOIN enrollments e ON sl.student_uuid = e.student_uuid 
    WHERE sl.session_id = ?
  `).bind(session.id).all()
  
  return c.json({ active: true, session, logins: logins.results })
})

teacherApp.post('/sessions/start', async (c) => {
  const body = await c.req.json()
  try {
    const endTime = new Date(Date.now() + 45 * 60000).toISOString() // 45分授業
    const result = await c.env.DB.prepare(
      "INSERT INTO sessions (lesson_id, start_time, end_time, status) VALUES (?, datetime('now'), ?, 'active')"
    ).bind(body.lesson_id, endTime).run()
    return c.json({ success: true, session_id: result.meta.last_row_id })
  } catch(e: any) {
    return c.json({ success: false, error: e.message }, 400)
  }
})

teacherApp.post('/sessions/end', async (c) => {
  const body = await c.req.json()
  try {
    await c.env.DB.prepare(
      "UPDATE sessions SET status = 'closed', end_time = datetime('now') WHERE id = ?"
    ).bind(body.session_id).run()
    return c.json({ success: true })
  } catch(e: any) {
    return c.json({ success: false, error: e.message }, 400)
  }
})

// ----------------------
// ログ・評価
// ----------------------
teacherApp.get('/logs', async (c) => {
  // モックデータとして生徒のログ一覧を返す (35人分の一部)
  return c.json({
    success: true,
    logs: [
      { seat_no: '01', status: '提出済', draft: '比べ方がわからない', chats: 3, final: 'もとにする量を決めてわり算をすればいいと分かった。' },
      { seat_no: '02', status: 'AI対話中', draft: '100%が基準', chats: 5, final: null },
      { seat_no: '03', status: '提出済', draft: '図をかいてみる', chats: 1, final: '図と式が結びついた。' },
      { seat_no: '04', status: '提出済', draft: '式はできた', chats: 2, final: '割合=比べられる量÷もとにする量' },
      { seat_no: '05', status: '提出済', draft: 'うーん', chats: 4, final: 'テープ図を書くと分かりやすい。' },
      { seat_no: '06', status: 'AI対話中', draft: '掛け算？割り算？', chats: 6, final: null },
      { seat_no: '07', status: '提出済', draft: '20÷50', chats: 0, final: '0.4になる。' }
    ]
  })
})


// ----------------------
// デバッグ/初期化用
// ----------------------
teacherApp.get('/seed', async (c) => {
  try {
    const stmts = [
      "DELETE FROM units",
      "DELETE FROM enrollments",
      "DELETE FROM students",
      "DELETE FROM classes",
      "DELETE FROM school_years",
      "INSERT INTO school_years (id, year) VALUES (1, 2026)",
      "INSERT INTO classes (id, school_year_id, grade, class_no, metadata) VALUES (1, 1, 5, '01', '{\"teacher\": \"山田先生\", \"environment\": \"1人1台\"}')",
      "INSERT INTO units (id, class_id, subject, unit_name, unit_plan, evaluation_criteria, version) VALUES (1, 1, '算数', '割合', '小5算数「割合」', '{}', 1)",
      "INSERT INTO units (id, class_id, subject, unit_name, unit_plan, evaluation_criteria, version) VALUES (2, 1, '国語', '大造じいさんとガン', '小5国語', '{}', 1)",
      "INSERT INTO units (id, class_id, subject, unit_name, unit_plan, evaluation_criteria, version) VALUES (3, 1, '理科', 'ふりこのきまり', '小5理科', '{}', 1)",
      "INSERT INTO units (id, class_id, subject, unit_name, unit_plan, evaluation_criteria, version) VALUES (4, 1, '社会', '自動車工業のさかんな地域', '小5社会', '{}', 1)"
    ];
    
    // UUID付きで35人作成
    for(let i = 1; i <= 35; i++) {
      const seat = i.toString().padStart(2, '0');
      const uuid = 'user-uuid-' + seat;
      stmts.push(`INSERT INTO students (student_uuid) VALUES ('${uuid}')`);
      stmts.push(`INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('${uuid}', 1, '${seat}')`);
    }
    
    // execute in batch
    await c.env.DB.batch(stmts.map(s => c.env.DB.prepare(s)));
    
    return c.json({ success: true, message: "Seeded successfully!" });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 400);
  }
})

export default teacherApp
