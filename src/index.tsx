import { Hono } from 'hono'
import { cors } from 'hono/cors'

// Cloudflare bindings type
type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

// Basic index route
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>学習分析システム ISM・SP表対応</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100 p-8">
        <div class="max-w-4xl mx-auto">
            <h1 class="text-3xl font-bold text-gray-800 mb-6">
                <i class="fas fa-chart-line mr-2"></i>
                学習分析システム MVP
            </h1>
            
            <div class="bg-white rounded-lg shadow p-6 mb-6">
                <h2 class="text-xl font-semibold mb-4">機能メニュー</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <a href="#" class="p-4 border rounded hover:bg-blue-50 text-blue-600 block">
                        <i class="fas fa-users mr-2"></i> 学年・学級管理
                    </a>
                    <a href="#" class="p-4 border rounded hover:bg-green-50 text-green-600 block">
                        <i class="fas fa-book mr-2"></i> 単元管理・ISM編集
                    </a>
                    <a href="#" class="p-4 border rounded hover:bg-yellow-50 text-yellow-600 block">
                        <i class="fas fa-chalkboard-teacher mr-2"></i> 授業回管理
                    </a>
                    <a href="#" class="p-4 border rounded hover:bg-purple-50 text-purple-600 block">
                        <i class="fas fa-chart-bar mr-2"></i> 単元末分析 (t計算・SP表)
                    </a>
                    <a href="#" class="p-4 border rounded hover:bg-indigo-50 text-indigo-600 block">
                        <i class="fas fa-user-graduate mr-2"></i> 児童UI (ログイン・学習)
                    </a>
                </div>
            </div>

            <div id="api-test" class="bg-white rounded-lg shadow p-6">
                <h2 class="text-xl font-semibold mb-4">APIステータス</h2>
                <p id="status-text" class="text-gray-600">ローディング中...</p>
            </div>
        </div>
        
        <script>
            fetch('/api/status')
                .then(res => res.json())
                .then(data => {
                    document.getElementById('status-text').innerHTML = 
                        '<span class="text-green-600 font-bold">稼働中</span>: ' + data.message + 
                        '<br>DB接続: ' + (data.db_ok ? 'OK' : 'NG');
                })
                .catch(err => {
                    document.getElementById('status-text').innerHTML = 
                        '<span class="text-red-600 font-bold">エラー</span>: ' + err.message;
                });
        </script>
    </body>
    </html>
  `)
})

// API routes
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

// API for classes
app.get('/api/classes', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM classes').all()
  return c.json({ classes: results })
})

app.post('/api/classes', async (c) => {
  const body = await c.req.json()
  try {
    // Requires school_year_id, grade, class_no
    const result = await c.env.DB.prepare(
      'INSERT INTO classes (school_year_id, grade, class_no, metadata) VALUES (?, ?, ?, ?)'
    ).bind(body.school_year_id || 1, body.grade, body.class_no, JSON.stringify(body.metadata || {})).run()
    
    return c.json({ success: true, id: result.meta.last_row_id })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 400)
  }
})

export default app
