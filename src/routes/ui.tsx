import { Hono } from 'hono'

const ui = new Hono()

const Layout = (props: { title: string; children: any }) => `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${props.title} | 学習分析システム</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <!-- Alpine.js for lightweight reactivity -->
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.13.3/dist/cdn.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"></script>
</head>
<body class="bg-gray-100 text-gray-800">
    <nav class="bg-indigo-600 text-white p-4 shadow-md">
        <div class="max-w-6xl mx-auto flex justify-between items-center">
            <a href="/" class="text-xl font-bold"><i class="fas fa-chart-line mr-2"></i>学習分析 MVP</a>
            <div class="space-x-4">
                <a href="/teacher" class="hover:text-indigo-200"><i class="fas fa-chalkboard-teacher"></i> クラス管理</a>
                <a href="/teacher/ism" class="hover:text-indigo-200"><i class="fas fa-project-diagram"></i> ISM編集</a>
                <a href="/teacher/logs" class="hover:text-indigo-200"><i class="fas fa-chart-bar"></i> ログ・分析</a>
                <a href="/student/login" class="bg-indigo-800 px-3 py-1 rounded hover:bg-indigo-700 ml-4"><i class="fas fa-user-graduate"></i> 児童ログイン</a>
            </div>
        </div>
    </nav>
    <main class="max-w-6xl mx-auto p-6 mt-6">
        ${props.children}
    </main>
</body>
</html>
`

ui.get('/', (c) => {
  return c.html(Layout({
    title: 'ホーム',
    children: `
      <div class="text-center py-10">
        <h1 class="text-4xl font-bold text-gray-800 mb-6">学習分析システムへようこそ</h1>
        <p class="text-lg text-gray-600 mb-10">AIを活用した学習過程の記録・分析プラットフォーム</p>
        <div class="flex justify-center gap-6">
            <a href="/teacher" class="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg shadow-lg font-bold text-xl transition">
                <i class="fas fa-chalkboard-teacher mr-2"></i> 先生はこちら
            </a>
            <a href="/student/login" class="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-lg shadow-lg font-bold text-xl transition">
                <i class="fas fa-user-graduate mr-2"></i> 児童はこちら
            </a>
        </div>
      </div>
    `
  }))
})

// === 教師用画面 ===
ui.get('/teacher', (c) => {
  return c.html(Layout({
    title: '教師ダッシュボード',
    children: `
      <div x-data="teacherDashboard()" x-init="fetchClasses()">
        <h2 class="text-2xl font-bold mb-6 border-b pb-2">クラス・名簿管理</h2>
        
        <div class="bg-white p-6 rounded-lg shadow mb-8">
            <h3 class="text-lg font-semibold mb-4">登録済みクラス一覧</h3>
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-gray-100 border-b">
                        <th class="p-3">年度</th>
                        <th class="p-3">学年・組</th>
                        <th class="p-3">操作</th>
                    </tr>
                </thead>
                <tbody>
                    <template x-for="cls in classes" :key="cls.id">
                        <tr class="border-b hover:bg-gray-50">
                            <td class="p-3" x-text="cls.year + '年度'"></td>
                            <td class="p-3" x-text="cls.grade + '年 ' + cls.class_no + '組'"></td>
                            <td class="p-3">
                                <button @click="generateRoster(cls.id)" class="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded mr-2 hover:bg-blue-200">名簿作成 (1-40)</button>
                                <button @click="startSession(cls.id)" class="text-sm bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200">授業開始</button>
                            </td>
                        </tr>
                    </template>
                </tbody>
            </table>
            <div x-show="classes.length === 0" class="text-gray-500 p-4 text-center">クラスがありません</div>
        </div>

        <div x-show="message" class="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6" x-text="message"></div>
      </div>

      <script>
      function teacherDashboard() {
          return {
              classes: [],
              message: '',
              async fetchClasses() {
                  const res = await fetch('/api/classes');
                  const data = await res.json();
                  this.classes = data.classes;
              },
              async generateRoster(classId) {
                  if(!confirm('出席番号1〜40までの名簿を自動生成します。よろしいですか？')) return;
                  const res = await fetch('/api/classes/' + classId + '/generate_roster', {
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({ start_no: 1, end_no: 40 })
                  });
                  const data = await res.json();
                  if(data.success) {
                      this.message = data.message;
                      setTimeout(() => this.message = '', 3000);
                  }
              },
              async startSession(classId) {
                  // Unit 1 (Sample unit from seed)
                  const res = await fetch('/api/sessions/start', {
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({ class_id: classId, unit_id: 1, lesson_number: 1 })
                  });
                  const data = await res.json();
                  if(data.success) {
                      this.message = '授業セッションを開始しました。児童がログイン可能です！';
                      setTimeout(() => this.message = '', 4000);
                  }
              }
          }
      }
      </script>
    `
  }))
})

// === 児童用画面 ===
ui.get('/student/login', (c) => {
  return c.html(Layout({
    title: '児童ログイン',
    children: `
      <div class="max-w-md mx-auto bg-white p-8 rounded-lg shadow-md mt-10" x-data="studentLogin()" x-init="fetchClasses()">
        <h2 class="text-2xl font-bold mb-6 text-center text-gray-800"><i class="fas fa-sign-in-alt mr-2"></i> じゅぎょうにはいる</h2>
        
        <div class="mb-4">
            <label class="block text-gray-700 font-bold mb-2">クラスをえらぶ</label>
            <select x-model="classId" class="w-full border rounded p-3 text-lg">
                <option value="">-- えらんでください --</option>
                <template x-for="cls in classes" :key="cls.id">
                    <option :value="cls.id" x-text="cls.grade + 'ねん ' + cls.class_no + 'くみ'"></option>
                </template>
            </select>
        </div>

        <div class="mb-6">
            <label class="block text-gray-700 font-bold mb-2">しゅっせきばんごう (2けた)</label>
            <input type="number" x-model="seatNo" placeholder="れい: 05" class="w-full border rounded p-3 text-2xl text-center" />
        </div>

        <div x-show="error" class="text-red-500 mb-4 text-center font-bold" x-text="error"></div>

        <button @click="login()" class="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 px-4 rounded text-xl shadow">
            ログインする
        </button>
      </div>

      <script>
      function studentLogin() {
          return {
              classes: [],
              classId: '',
              seatNo: '',
              error: '',
              async fetchClasses() {
                  const res = await fetch('/api/classes');
                  const data = await res.json();
                  this.classes = data.classes;
              },
              async login() {
                  this.error = '';
                  if(!this.classId || !this.seatNo) {
                      this.error = 'クラスとばんごうをいれてください';
                      return;
                  }
                  
                  // 番号を2桁にゼロ埋め
                  const formattedSeat = this.seatNo.toString().padStart(2, '0');
                  
                  const res = await fetch('/api/student/login', {
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({ class_id: this.classId, seat_no: formattedSeat })
                  });
                  
                  const data = await res.json();
                  if(data.success) {
                      // Save info to localStorage for MVP persistence
                      localStorage.setItem('student_uuid', data.student_uuid);
                      localStorage.setItem('session_id', data.session_id);
                      window.location.href = '/student/draft';
                  } else {
                      this.error = data.message;
                  }
              }
          }
      }
      </script>
    `
  }))
})

ui.get('/student/draft', (c) => {
  return c.html(Layout({
    title: '下書き（自分の考え）',
    children: `
      <div class="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-md" x-data="studentDraft()" x-init="checkLogin()">
        <h2 class="text-2xl font-bold mb-6 text-gray-800"><i class="fas fa-pencil-alt mr-2"></i> じぶんの考えをかこう</h2>
        
        <p class="mb-4 text-gray-600">まずは、AIをつかわずに、じぶんの力だけで考えをかいてみましょう。</p>
        
        <textarea x-model="content" rows="8" class="w-full border rounded-lg p-4 mb-4 text-lg" placeholder="ここに考えやしき、こたえをかいてね..."></textarea>
        
        <div x-show="message" class="bg-blue-100 text-blue-700 p-3 mb-4 rounded font-bold" x-text="message"></div>

        <div class="flex justify-between mt-6">
            <button @click="saveDraft()" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-8 rounded-lg shadow text-lg">
                <i class="fas fa-save mr-2"></i> ほぞんする
            </button>
            
            <button @click="nextStep()" class="bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-8 rounded-lg shadow text-lg" :disabled="!saved" :class="{'opacity-50 cursor-not-allowed': !saved}">
                つぎへ（AIとそうだん） <i class="fas fa-arrow-right ml-2"></i>
            </button>
        </div>
      </div>

      <script>
      function studentDraft() {
          return {
              content: '',
              message: '',
              saved: false,
              student_uuid: '',
              session_id: '',
              
              checkLogin() {
                  this.student_uuid = localStorage.getItem('student_uuid');
                  this.session_id = localStorage.getItem('session_id');
                  if(!this.student_uuid || !this.session_id) {
                      window.location.href = '/student/login';
                  }
              },
              
              async saveDraft() {
                  if(!this.content.trim()) {
                      alert('なにか書いてからほぞんしてね');
                      return;
                  }
                  
                  const res = await fetch('/api/student/draft', {
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({
                          student_uuid: this.student_uuid,
                          session_id: this.session_id,
                          content: this.content
                      })
                  });
                  
                  const data = await res.json();
                  if(data.success) {
                      this.message = '✅ 下書きをほぞんしました！';
                      this.saved = true;
                  }
              },
              
              nextStep() {
                  window.location.href = '/student/chat';
              }
          }
      }
      </script>
    `
  }))
})

// === AIチャット画面 ===
ui.get('/student/chat', (c) => {
  return c.html(Layout({
    title: 'AIとそうだん',
    children: `
      <div class="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md flex flex-col h-[80vh]" x-data="studentChat()" x-init="checkLogin()">
        <div class="flex justify-between items-center mb-4 border-b pb-2">
            <h2 class="text-2xl font-bold text-gray-800"><i class="fas fa-robot text-indigo-500 mr-2"></i> AI先生とそうだんしよう</h2>
            <button @click="finishChat()" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded shadow">
                そうだんをおわる <i class="fas fa-flag-checkered ml-1"></i>
            </button>
        </div>
        
        <!-- チャット履歴エリア -->
        <div class="flex-1 overflow-y-auto p-4 bg-gray-50 rounded mb-4 space-y-4" id="chat-box">
            <template x-for="(msg, index) in messages" :key="index">
                <div :class="msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'">
                    <div :class="msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white border text-gray-800'" class="max-w-[70%] p-3 rounded-lg shadow">
                        <div x-text="msg.text" class="text-lg"></div>
                    </div>
                </div>
            </template>
            <div x-show="loading" class="flex justify-start">
                <div class="bg-gray-200 text-gray-600 p-3 rounded-lg animate-pulse">AIがかんがえ中...</div>
            </div>
        </div>

        <!-- 入力エリア -->
        <div class="flex gap-2">
            <input type="text" x-model="inputText" @keydown.enter="sendMessage()" class="flex-1 border rounded-lg p-3 text-lg" placeholder="AIにきいてみたいことをかいてね..." :disabled="loading">
            <button @click="sendMessage()" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow" :disabled="loading">
                <i class="fas fa-paper-plane"></i>
            </button>
        </div>
      </div>

      <script>
      function studentChat() {
          return {
              student_uuid: '',
              session_id: '',
              inputText: '',
              loading: false,
              turnCount: 0,
              messages: [
                  { role: 'ai', text: 'こんにちは！下書きで書いたことについて、なにか質問や気になることはあるかな？' }
              ],
              
              checkLogin() {
                  this.student_uuid = localStorage.getItem('student_uuid');
                  this.session_id = localStorage.getItem('session_id');
                  if(!this.student_uuid || !this.session_id) {
                      window.location.href = '/student/login';
                  }
              },
              
              async sendMessage() {
                  if(!this.inputText.trim() || this.loading) return;
                  
                  const prompt = this.inputText;
                  this.messages.push({ role: 'user', text: prompt });
                  this.inputText = '';
                  this.loading = true;
                  this.turnCount++;
                  
                  // スクロールを一番下へ
                  this.scrollToBottom();

                  try {
                      const res = await fetch('/api/student/chat', {
                          method: 'POST',
                          headers: {'Content-Type': 'application/json'},
                          body: JSON.stringify({
                              student_uuid: this.student_uuid,
                              session_id: this.session_id,
                              prompt: prompt,
                              turn_number: this.turnCount
                          })
                      });
                      
                      const data = await res.json();
                      if(data.success) {
                          this.messages.push({ role: 'ai', text: data.output });
                      }
                  } catch (e) {
                      this.messages.push({ role: 'ai', text: 'ごめんね、通信エラーがおきたみたい。もういちど試してみてね。' });
                  }
                  
                  this.loading = false;
                  this.scrollToBottom();
              },
              
              scrollToBottom() {
                  setTimeout(() => {
                      const box = document.getElementById('chat-box');
                      if(box) box.scrollTop = box.scrollHeight;
                  }, 50);
              },

              finishChat() {
                  window.location.href = '/student/submit';
              }
          }
      }
      </script>
    `
  }))
})

// === 最終提出画面 ===
ui.get('/student/submit', (c) => {
  return c.html(Layout({
    title: 'さいしゅうていしゅつ',
    children: `
      <div class="max-w-3xl mx-auto bg-white p-8 rounded-lg shadow-md" x-data="studentSubmit()" x-init="checkLogin()">
        <h2 class="text-2xl font-bold mb-6 text-gray-800"><i class="fas fa-check-circle text-green-500 mr-2"></i> さいごのまとめ</h2>
        
        <p class="mb-4 text-gray-600">AIとのそうだんをふまえて、じぶんの「さいしゅうてきな考え」をまとめて、ていしゅつしよう！</p>
        
        <textarea x-model="finalContent" rows="10" class="w-full border rounded-lg p-4 mb-4 text-lg" placeholder="最終的な式や答え、考えの理由などをかいてね..."></textarea>
        
        <div x-show="message" class="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4" x-text="message"></div>

        <button @click="submitWork()" class="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-lg shadow text-xl" :disabled="submitted" :class="{'opacity-50': submitted}">
            <i class="fas fa-paper-plane mr-2"></i> 先生にていしゅつする
        </button>
      </div>

      <script>
      function studentSubmit() {
          return {
              student_uuid: '',
              session_id: '',
              finalContent: '',
              message: '',
              submitted: false,
              
              checkLogin() {
                  this.student_uuid = localStorage.getItem('student_uuid');
                  this.session_id = localStorage.getItem('session_id');
                  if(!this.student_uuid || !this.session_id) {
                      window.location.href = '/student/login';
                  }
              },
              
              async submitWork() {
                  if(!this.finalContent.trim()) {
                      alert('なにか書いてからていしゅつしてね');
                      return;
                  }
                  
                  const res = await fetch('/api/student/submit', {
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({
                          student_uuid: this.student_uuid,
                          session_id: this.session_id,
                          final_content: this.finalContent
                      })
                  });
                  
                  const data = await res.json();
                  if(data.success) {
                      this.message = '✨ ていしゅつがかんりょうしました！よくがんばったね！';
                      this.submitted = true;
                      
                      // セッション情報をクリアしてトップへ戻すことも可能
                      setTimeout(() => {
                          localStorage.clear();
                          window.location.href = '/';
                      }, 4000);
                  }
              }
          }
      }
      </script>
    `
  }))
})

export { ui }
// === 教師用 ISM編集画面 ===
ui.get('/teacher/ism', (c) => {
  return c.html(Layout({
    title: '単元管理・ISM編集',
    children: `
      <div x-data="ismEditor()" x-init="fetchISM()">
        <h2 class="text-2xl font-bold mb-6 border-b pb-2"><i class="fas fa-project-diagram text-indigo-600 mr-2"></i> 単元: 割合 (小5算数) - ISM編集 map(T)</h2>
        
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- サイドバー：要素一覧 -->
            <div class="col-span-1 bg-white p-4 rounded-lg shadow h-96 overflow-y-auto">
                <h3 class="font-bold border-b pb-2 mb-4">学習要素 (ノード)</h3>
                <ul class="space-y-2">
                    <template x-for="node in nodes" :key="node.id">
                        <li class="p-2 border rounded bg-gray-50 flex justify-between items-center">
                            <span x-text="node.node_code + ': ' + node.node_name" class="font-medium text-sm"></span>
                            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded" x-text="node.type"></span>
                        </li>
                    </template>
                </ul>
                <button class="mt-4 w-full bg-indigo-50 text-indigo-600 border border-indigo-200 py-2 rounded hover:bg-indigo-100">+ ノード追加 (未実装)</button>
            </div>

            <!-- メインエリア：Mermaidグラフ表示 -->
            <div class="col-span-2 bg-white p-6 rounded-lg shadow">
                <div class="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 class="font-bold">構造チャート map(T)</h3>
                    <button @click="renderGraph()" class="text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded">グラフ更新</button>
                </div>
                
                <div class="bg-gray-50 border p-4 rounded min-h-[300px] flex justify-center items-center overflow-auto" id="graph-container">
                    <div class="mermaid" id="mermaid-view">
                        <!-- Graph goes here -->
                    </div>
                </div>
            </div>
        </div>
      </div>

      <script>
      function ismEditor() {
          return {
              nodes: [],
              edges: [],
              
              async fetchISM() {
                  // MVPでは Unit ID = 1 に固定
                  const res = await fetch('/api/units/1/ism');
                  const data = await res.json();
                  this.nodes = data.nodes;
                  this.edges = data.edges;
                  
                  // mermaid初期化
                  mermaid.initialize({ startOnLoad: false, theme: 'default' });
                  setTimeout(() => this.renderGraph(), 100);
              },
              
              async renderGraph() {
                  let graphDef = 'graph TD\\n';
                  
                  // ノードの定義
                  this.nodes.forEach(n => {
                      graphDef += \`  \${n.node_code}["\${n.node_code}: \${n.node_name}"]\\n\`;
                  });
                  
                  // エッジの定義
                  this.edges.forEach(e => {
                      graphDef += \`  \${e.from_code} --> \${e.to_code}\\n\`;
                  });

                  const container = document.getElementById('graph-container');
                  container.innerHTML = '<div class="mermaid" id="mermaid-view"></div>';
                  const view = document.getElementById('mermaid-view');
                  view.textContent = graphDef;
                  
                  try {
                      await mermaid.run({ nodes: [view] });
                  } catch (e) {
                      console.error("Mermaid rendering failed", e);
                  }
              }
          }
      }
      </script>
    `
  }))
})

// === 教師用 ログ・分析画面 ===
ui.get('/teacher/logs', (c) => {
  return c.html(Layout({
    title: '学習ログ・単元末分析',
    children: `
      <div x-data="teacherLogs()" x-init="initData()">
        <h2 class="text-2xl font-bold mb-6 border-b pb-2"><i class="fas fa-chart-bar text-indigo-600 mr-2"></i> 学習ログ・分析 (セッション)</h2>
        
        <!-- タブ切り替え -->
        <div class="flex border-b mb-6">
            <button @click="tab = 'logs'" :class="tab === 'logs' ? 'border-b-2 border-indigo-600 text-indigo-600 font-bold' : 'text-gray-500'" class="px-6 py-3">児童ログ一覧</button>
            <button @click="tab = 'analysis'" :class="tab === 'analysis' ? 'border-b-2 border-indigo-600 text-indigo-600 font-bold' : 'text-gray-500'" class="px-6 py-3">単元末分析 (t計算・SP表)</button>
        </div>

        <!-- 児童ログ一覧タブ -->
        <div x-show="tab === 'logs'" class="space-y-6">
            <div class="bg-white p-4 rounded shadow mb-4">
                <label class="mr-2 font-bold text-gray-700">セッションID:</label>
                <input type="number" x-model="sessionId" class="border p-2 rounded w-24" placeholder="例: 1">
                <button @click="fetchLogs()" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 ml-2">取得</button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <template x-for="s in students" :key="s.student_uuid">
                    <div class="bg-white p-5 rounded-lg shadow border-l-4 border-indigo-500">
                        <h3 class="font-bold text-lg mb-3">出席番号: <span x-text="s.seat_no" class="text-indigo-600"></span></h3>
                        
                        <div class="text-sm space-y-2">
                            <div class="bg-gray-50 p-2 rounded border">
                                <span class="font-semibold text-gray-600 block mb-1">下書き:</span>
                                <span x-text="getDraft(s.student_uuid) || '未提出'"></span>
                            </div>
                            
                            <div class="bg-blue-50 p-2 rounded border">
                                <span class="font-semibold text-blue-600 block mb-1">AI対話回数:</span>
                                <span x-text="getChatCount(s.student_uuid) + ' 回'"></span>
                            </div>

                            <div class="bg-green-50 p-2 rounded border">
                                <span class="font-semibold text-green-600 block mb-1">最終提出:</span>
                                <span x-text="getSubmission(s.student_uuid) || '未提出'"></span>
                            </div>
                        </div>
                    </div>
                </template>
                <div x-show="students.length === 0" class="text-gray-500 col-span-2 text-center py-10">データがありません。セッションIDを指定して取得してください。</div>
            </div>
        </div>

        <!-- 分析タブ -->
        <div x-show="tab === 'analysis'" class="space-y-6">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- t係数ダッシュボード -->
                <div class="col-span-1 bg-white p-6 rounded-lg shadow text-center">
                    <h3 class="font-bold text-gray-600 mb-2">伝達係数 t (map(T) vs map(S))</h3>
                    <div class="text-5xl font-extrabold text-indigo-600 my-4" x-text="analysis?.t_coefficient || '-'"></div>
                    <div class="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full font-bold text-sm" x-text="analysis?.interpretation || '-'"></div>
                    <p class="text-xs text-gray-400 mt-4">※t=0.41以上で「よく理解」と判定</p>
                </div>

                <!-- SP表ダッシュボード -->
                <div class="col-span-2 bg-white p-6 rounded-lg shadow overflow-x-auto">
                    <h3 class="font-bold text-gray-600 mb-4">S-P表 (生徒×問題マトリクス)</h3>
                    <table class="w-full text-center border-collapse text-sm">
                        <thead>
                            <tr class="bg-gray-100 border">
                                <th class="border p-2">生徒 / 問題</th>
                                <template x-for="p in analysis?.sp_table?.problems" :key="p.id">
                                    <th class="border p-2 cursor-help" :title="p.element">
                                        <div x-text="p.id"></div>
                                        <div class="text-xs text-gray-500 font-normal" x-text="p.correctRate + '%'"></div>
                                    </th>
                                </template>
                                <th class="border p-2 bg-gray-200">合計点</th>
                                <th class="border p-2 bg-indigo-50">個票</th>
                            </tr>
                        </thead>
                        <tbody>
                            <template x-for="row in analysis?.sp_table?.students" :key="row.seat">
                                <tr class="border hover:bg-gray-50">
                                    <td class="border p-2 font-bold" x-text="'No.' + row.seat"></td>
                                    <template x-for="(score, index) in row.scores" :key="index">
                                        <td class="border p-2" :class="score === 1 ? 'text-blue-600 font-bold bg-blue-50' : 'text-red-500 bg-red-50'" x-text="score === 1 ? '○' : '×'"></td>
                                    </template>
                                    <td class="border p-2 font-bold bg-gray-50" x-text="row.total"></td>
                                    <td class="border p-2">
                                        <button @click="openReport(row)" class="bg-indigo-500 hover:bg-indigo-600 text-white text-xs px-3 py-1 rounded shadow">
                                            <i class="fas fa-file-alt"></i> 出力
                                        </button>
                                    </td>
                                </tr>
                            </template>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        
        <!-- 個票モーダル (印刷用領域) -->
        <div x-show="showReportModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" style="display: none;">
            <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <!-- モーダルヘッダー (印刷時は非表示) -->
                <div class="flex justify-between items-center p-4 border-b print:hidden">
                    <h3 class="text-xl font-bold text-gray-800"><i class="fas fa-clipboard-check mr-2"></i> 学習個票</h3>
                    <div>
                        <button @click="printReport()" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded mr-2">
                            <i class="fas fa-print mr-1"></i> 印刷する
                        </button>
                        <button @click="showReportModal = false" class="text-gray-500 hover:bg-gray-200 px-3 py-2 rounded">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                
                <!-- 個票コンテンツ (印刷対象) -->
                <div id="print-area" class="p-8 overflow-y-auto print:p-0">
                    <div class="text-center mb-6">
                        <h2 class="text-2xl font-bold border-b-2 border-gray-800 pb-2 inline-block">算数「割合」 学習ふりかえりシート</h2>
                    </div>
                    
                    <div class="flex justify-between items-end mb-6">
                        <div class="text-xl">5年 組 <span class="font-bold border-b border-gray-400 px-4" x-text="selectedStudent?.seat"></span> 番</div>
                        <div class="text-lg bg-gray-100 px-4 py-2 rounded-lg border">
                            あなたの得点: <span class="text-3xl font-bold text-indigo-600" x-text="selectedStudent?.total"></span> <span class="text-gray-600 text-sm">/ 5点</span>
                        </div>
                    </div>

                    <h4 class="font-bold text-lg mb-2 bg-indigo-100 p-2 rounded">📊 問題ごとの結果と要素</h4>
                    <table class="w-full text-left border-collapse mb-6">
                        <thead>
                            <tr class="bg-gray-50 border-y-2 border-gray-300">
                                <th class="p-3">問題</th>
                                <th class="p-3">学習要素</th>
                                <th class="p-3 text-center">結果</th>
                                <th class="p-3 text-center">クラス正答率</th>
                            </tr>
                        </thead>
                        <tbody>
                            <template x-for="(score, index) in selectedStudent?.scores" :key="index">
                                <tr class="border-b">
                                    <td class="p-3" x-text="analysis?.sp_table?.problems[index].id"></td>
                                    <td class="p-3" x-text="analysis?.sp_table?.problems[index].element"></td>
                                    <td class="p-3 text-center text-xl font-bold" :class="score === 1 ? 'text-blue-600' : 'text-red-500'" x-text="score === 1 ? '○' : '×'"></td>
                                    <td class="p-3 text-center" x-text="analysis?.sp_table?.problems[index].correctRate + '%'"></td>
                                </tr>
                            </template>
                        </tbody>
                    </table>

                    <h4 class="font-bold text-lg mb-2 bg-yellow-100 p-2 rounded">💡 先生からのアドバイス (AI分析)</h4>
                    <div class="bg-white border-2 border-yellow-200 p-4 rounded-lg text-gray-800 leading-relaxed min-h-[100px]" x-html="generateAdvice()">
                    </div>
                </div>
            </div>
        </div>

      </div>

      <style>
        @media print {
            body * {
                visibility: hidden;
            }
            #print-area, #print-area * {
                visibility: visible;
            }
            #print-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                padding: 20mm;
            }
            @page {
                size: A4 portrait;
                margin: 0;
            }
        }
      </style>

      <script>
      function teacherLogs() {
          return {
              tab: 'logs', // 'logs' or 'analysis'
              sessionId: 1, // Default session
              students: [],
              drafts: [],
              chats: [],
              submissions: [],
              analysis: null,
              
              showReportModal: false,
              selectedStudent: null,
              
              initData() {
                  this.fetchLogs();
                  this.fetchAnalysis();
              },
              
              async fetchLogs() {
                  if(!this.sessionId) return;
                  const res = await fetch('/api/sessions/' + this.sessionId + '/logs');
                  const data = await res.json();
                  this.students = data.students || [];
                  this.drafts = data.drafts || [];
                  this.chats = data.chats || [];
                  this.submissions = data.submissions || [];
              },
              
              async fetchAnalysis() {
                  const res = await fetch('/api/sessions/1/analysis');
                  const data = await res.json();
                  this.analysis = data;
              },
              
              getDraft(uuid) {
                  const d = this.drafts.find(d => d.student_uuid === uuid);
                  return d ? d.content : null;
              },
              getChatCount(uuid) {
                  return this.chats.filter(c => c.student_uuid === uuid).length;
              },
              getSubmission(uuid) {
                  const s = this.submissions.find(s => s.student_uuid === uuid);
                  return s ? s.final_content : null;
              },
              
              openReport(studentData) {
                  this.selectedStudent = studentData;
                  this.showReportModal = true;
              },
              
              printReport() {
                  window.print();
              },
              
              generateAdvice() {
                  if(!this.selectedStudent || !this.analysis) return '';
                  
                  const scores = this.selectedStudent.scores;
                  const probs = this.analysis.sp_table.problems;
                  
                  let weakPoints = [];
                  let strongPoints = [];
                  
                  scores.forEach((s, idx) => {
                      const p = probs[idx];
                      if(s === 0) {
                          // 全体正答率が50%以上なのに間違えた問題は要注意(S-P表の考え方)
                          if(p.correctRate >= 50) {
                              weakPoints.push('「' + p.element + '」');
                          }
                      } else {
                          strongPoints.push('「' + p.element + '」');
                      }
                  });
                  
                  let advice = '';
                  
                  if(this.selectedStudent.total === 5) {
                      advice = '<p class="font-bold text-green-600 mb-2">すばらしい！全問正解です！👏</p>';
                      advice += '<p>割合の考え方をしっかりと構造的に理解できています。この調子で次の単元もがんばりましょう。</p>';
                  } else if(weakPoints.length > 0) {
                      advice = '<p class="font-bold text-red-500 mb-2">💡 ここをふりかえろう！</p>';
                      advice += '<p>クラスのみんながよくできている問題の中で、あなたがまちがえてしまったところがあります。</p>';
                      advice += '<p class="mt-2 text-indigo-700 font-bold">⇒ 復習おすすめ要素: ' + weakPoints.join('、') + '</p>';
                      advice += '<p class="mt-2">この要素が、次の問題を解くための大切な「土台（前提）」になっているかもしれません。ノートをもう一度見直してみよう！</p>';
                  } else {
                      advice = '<p class="font-bold text-blue-600 mb-2">よくがんばりました！</p>';
                      advice += '<p>基礎的な部分は理解できています。まちがえた問題は少し難しい応用問題なので、先生の解説をよく聞いてみましょう。</p>';
                  }
                  
                  return advice;
              }
          }
      }
      </script>
    `
  }))
})

