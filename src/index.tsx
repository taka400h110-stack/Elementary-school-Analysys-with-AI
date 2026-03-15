import { Hono } from 'hono'
import { cors } from 'hono/cors'

// APIとUIのルーターをインポート
import { api } from './routes/api.js'
import { ui } from './routes/ui.js'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

// APIルートのマウント
app.route('/api', api)

// UIルートのマウント
app.route('/', ui)

// デバッグ用APIステータス
app.get('/api/status', async (c) => {
  let dbOk = false
  try {
    const res = await c.env.DB.prepare('SELECT 1 as val').first()
    if (res && res.val === 1) dbOk = true
  } catch (e) {
    console.error('DB Error', e)
  }
  return c.json({ status: 'ok', message: 'API is running', db_ok: dbOk })
})

export default app