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