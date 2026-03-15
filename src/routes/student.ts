import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const studentApp = new Hono<{ Bindings: Bindings }>()

// 授業中ログイン (2桁)
studentApp.post('/login/session', async (c) => {
  const body = await c.req.json()
  const { class_id, seat_no } = body
  try {
    // アクティブなセッションを取得 (モックとして最新のactiveセッションを取得)
    const session = await c.env.DB.prepare(
      "SELECT s.id as session_id FROM sessions s JOIN lessons l ON s.lesson_id = l.id JOIN units u ON l.unit_id = u.id WHERE u.class_id = ? AND s.status = 'active' ORDER BY s.id DESC LIMIT 1"
    ).bind(class_id).first()

    if (!session) return c.json({ success: false, error: '有効な授業セッションがありません' }, 404)

    // 児童UUIDを取得
    const enrollment = await c.env.DB.prepare(
      "SELECT student_uuid FROM enrollments WHERE class_id = ? AND seat_no = ? AND status = 'active'"
    ).bind(class_id, seat_no).first()

    if (!enrollment) return c.json({ success: false, error: '該当する出席番号がありません' }, 404)

    // ログイン記録
    await c.env.DB.prepare(
      'INSERT INTO session_logins (session_id, student_uuid) VALUES (?, ?)'
    ).bind(session.session_id, enrollment.student_uuid).run()

    return c.json({ success: true, student_uuid: enrollment.student_uuid, session_id: session.session_id })
  } catch(e: any) {
    return c.json({ success: false, error: e.message }, 400)
  }
})

// 下書き保存
studentApp.post('/drafts', async (c) => {
  const body = await c.req.json()
  try {
    await c.env.DB.prepare(
      'INSERT INTO drafts (session_id, student_uuid, content) VALUES (?, ?, ?)'
    ).bind(body.session_id, body.student_uuid, body.content).run()
    return c.json({ success: true })
  } catch(e: any) {
    return c.json({ success: false, error: e.message }, 400)
  }
})

// AI対話 (モック)
studentApp.post('/chat', async (c) => {
  const body = await c.req.json()
  try {
    const aiOutput = `AIからの応答モックです。あなたのプロンプト「${body.prompt}」について考えましょう。割合の式は「比べる量 ÷ もとにする量」ですね。`
    
    await c.env.DB.prepare(
      'INSERT INTO chat_turns (session_id, student_uuid, turn_number, tool_name, prompt, output) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(body.session_id, body.student_uuid, 1, 'MockAI', body.prompt, aiOutput).run()
    
    return c.json({ success: true, output: aiOutput })
  } catch(e: any) {
    return c.json({ success: false, error: e.message }, 400)
  }
})

// 最終提出
studentApp.post('/submissions', async (c) => {
  const body = await c.req.json()
  try {
    await c.env.DB.prepare(
      'INSERT INTO submissions (session_id, student_uuid, final_content) VALUES (?, ?, ?)'
    ).bind(body.session_id, body.student_uuid, body.final_content).run()
    return c.json({ success: true })
  } catch(e: any) {
    return c.json({ success: false, error: e.message }, 400)
  }
})

export default studentApp