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
</head>
<body class="bg-gray-100 text-gray-800">
    <nav class="bg-indigo-600 text-white p-4 shadow-md">
        <div class="max-w-6xl mx-auto flex justify-between items-center">
            <a href="/" class="text-xl font-bold"><i class="fas fa-chart-line mr-2"></i>学習分析 MVP</a>
            <div class="space-x-4">
                <a href="/teacher" class="hover:text-indigo-200"><i class="fas fa-chalkboard-teacher"></i> 教師用</a>
                <a href="/student/login" class="hover:text-indigo-200"><i class="fas fa-user-graduate"></i> 児童用</a>
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