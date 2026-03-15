import { Hono } from 'hono'
import { cors } from 'hono/cors'
import teacherApp from './routes/teacher'
import studentApp from './routes/student'
import analysisApp from './routes/analysis'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

app.route('/api/teacher', teacherApp)
app.route('/api/student', studentApp)
app.route('/api/analysis', analysisApp)

// Basic status route
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

// フロントエンドSPAの配信
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>学習分析システム ISM・SP表対応</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        <!-- Alpine.js -->
        <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
        <!-- Mermaid -->
        <script src="https://cdn.jsdelivr.net/npm/mermaid@10.6.1/dist/mermaid.min.js"></script>
    </head>
    <body class="bg-gray-100 min-h-screen" x-data="appData()">
        <!-- ヘッダー -->
        <header class="bg-blue-600 text-white shadow-md">
            <div class="container mx-auto px-4 py-3 flex justify-between items-center">
                <h1 class="text-xl font-bold"><i class="fas fa-chart-line mr-2"></i>学習分析システム (ISM・SP表対応MVP)</h1>
                <div class="flex space-x-4">
                    <button @click="currentRole = 'teacher'; if(!selectedClassId) currentView = 'system_manage'" :class="{'font-bold underline': currentRole === 'teacher'}" class="hover:text-blue-200">先生用</button>
                    <button @click="currentRole = 'student'; currentView = 'student_login'; selectedClassId = ''" :class="{'font-bold underline': currentRole === 'student'}" class="hover:text-blue-200">児童用</button>
                    <button @click="currentRole = 'researcher'; currentView = 'researcher_dashboard'; selectedClassId = ''" :class="{'font-bold underline': currentRole === 'researcher'}" class="hover:text-blue-200">研究者用</button>
                </div>
            </div>
        </header>

        <div class="container mx-auto px-4 py-6 flex flex-col md:flex-row gap-6">
            <!-- 先生用サイドバー -->
            <div x-show="currentRole === 'teacher'" class="w-full md:w-64 bg-white rounded-lg shadow-md p-4 h-fit">
                
                <!-- 学級選択コンテキスト -->
                <div class="mb-4 pb-4 border-b border-gray-200">
                    <label class="block text-sm font-bold text-gray-700 mb-1">対象学級</label>
                    <select x-model="selectedClassId" @change="onClassChange()" class="w-full border border-gray-300 rounded p-2 bg-blue-50 focus:ring-blue-500 focus:border-blue-500">
                        <option value="">-- 学級を選択 --</option>
                        <template x-for="cls in classes" :key="cls.id">
                            <option :value="cls.id" x-text="cls.grade + '年' + cls.class_no + '組'"></option>
                        </template>
                    </select>
                </div>

                <div x-show="!selectedClassId" class="text-sm text-gray-500 mb-4 p-2 bg-yellow-50 rounded border border-yellow-200">
                    まずは上部から学級を選択してください。
                </div>

                <ul class="space-y-2" x-show="selectedClassId">
                    <li><button @click="currentView = 'dashboard'" class="w-full text-left p-2 rounded hover:bg-blue-50" :class="{'bg-blue-100 font-bold': currentView === 'dashboard'}"><i class="fas fa-home mr-2"></i>ダッシュボード</button></li>
                    
                                <!-- 児童管理 (名簿・学習ログ) -->
                                <li>
                                    <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mt-4 mb-1 pl-2">児童管理</div>
                                    <button @click="currentView = 'student_manage'" class="w-full text-left p-2 rounded hover:bg-blue-50" :class="{'bg-blue-100 font-bold': currentView === 'student_manage'}"><i class="fas fa-users mr-2"></i>名簿</button>
                                </li>
                    
                    <!-- 授業作成（教科→単元） -->
                    <li>
                        <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mt-4 mb-1 pl-2">授業作成</div>
                        <template x-for="(units, subject) in groupedUnits" :key="subject">
                            <div class="mb-1">
                                <button @click="toggleSubject(subject)" class="w-full text-left p-2 rounded hover:bg-blue-50 flex justify-between items-center text-sm">
                                    <span><i class="fas fa-book mr-2"></i><span x-text="subject"></span></span>
                                    <i class="fas fa-chevron-down text-xs transition-transform" :class="expandedSubjects[subject] ? 'rotate-180' : ''"></i>
                                </button>
                                <div x-show="expandedSubjects[subject]" class="pl-6 pr-2 py-1 space-y-1">
                                    <template x-for="unit in units" :key="unit.id">
                                        <button @click="selectUnitForLesson(unit)" class="w-full text-left p-1.5 rounded hover:bg-blue-50 text-sm truncate" :class="{'bg-blue-100 font-bold text-blue-700': currentView === 'lesson_create' && selectedUnit?.id === unit.id}">
                                            <i class="fas fa-chalkboard-teacher mr-1 text-gray-400"></i><span x-text="unit.unit_name"></span>
                                        </button>
                                    </template>
                                </div>
                            </div>
                        </template>
                    </li>
                    
                    <!-- テスト管理（教科→単元） -->
                    <li>
                        <div class="text-xs font-bold text-gray-400 uppercase tracking-wider mt-4 mb-1 pl-2">テスト管理</div>
                        <template x-for="(units, subject) in groupedUnits" :key="'test_'+subject">
                            <div class="mb-1">
                                <button @click="toggleTestSubject(subject)" class="w-full text-left p-2 rounded hover:bg-blue-50 flex justify-between items-center text-sm">
                                    <span><i class="fas fa-file-alt mr-2"></i><span x-text="subject"></span></span>
                                    <i class="fas fa-chevron-down text-xs transition-transform" :class="expandedTestSubjects[subject] ? 'rotate-180' : ''"></i>
                                </button>
                                <div x-show="expandedTestSubjects[subject]" class="pl-6 pr-2 py-1 space-y-1">
                                    <template x-for="unit in units" :key="'test_'+unit.id">
                                        <button @click="selectUnitForTest(unit)" class="w-full text-left p-1.5 rounded hover:bg-blue-50 text-sm truncate" :class="{'bg-blue-100 font-bold text-blue-700': currentView === 'test_manage' && selectedUnit?.id === unit.id}">
                                            <i class="fas fa-chart-bar mr-1 text-gray-400"></i><span x-text="unit.unit_name"></span>
                                        </button>
                                    </template>
                                </div>
                            </div>
                        </template>
                    </li>
                </ul>
                
                <!-- システム管理 (学級作成など) -->
                <div class="mt-8 border-t pt-4">
                    <button @click="currentView = 'system_manage'; selectedClassId = ''" class="w-full text-left p-2 rounded hover:bg-gray-100 text-gray-600 text-sm" :class="{'bg-gray-200 font-bold': currentView === 'system_manage'}"><i class="fas fa-cog mr-2"></i>システム管理</button>
                </div>
            </div>

            <!-- メインコンテンツ -->
            <div class="flex-1 bg-white rounded-lg shadow-md p-6 min-h-[500px]">
                
                <!-- ====== 先生用ビュー ====== -->
                <div x-show="currentRole === 'teacher'">
                    <!-- ダッシュボード -->
                    <div x-show="currentView === 'dashboard' && selectedClassId">
                        <div class="flex justify-between items-center mb-4 border-b pb-2">
                            <h2 class="text-2xl font-semibold">先生用ダッシュボード</h2>
                            <span class="text-lg text-gray-500 font-bold ml-2 bg-gray-100 px-3 py-1 rounded" x-text="getSelectedClassName()"></span>
                        </div>
                        <p class="text-gray-600 mb-4">左のメニューから機能を選択してください。</p>
                        <div class="p-4 bg-green-50 text-green-800 rounded border border-green-200">
                            システムステータス: <span x-text="systemStatus"></span>
                        </div>
                    </div>

                    <!-- システム管理 (学級管理・単元管理) -->
                    <div x-show="currentView === 'system_manage'">
                        <h2 class="text-2xl font-semibold mb-4 border-b pb-2">システム・学級・単元管理</h2>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <!-- 学級作成 -->
                            <div class="bg-gray-50 p-4 rounded border">
                                <h3 class="font-bold mb-2">新規学級作成</h3>
                                <div class="flex gap-2 mb-2">
                                    <input x-model="newClass.grade" type="number" placeholder="学年(1-6)" class="border p-2 rounded w-1/3">
                                    <input x-model="newClass.class_no" type="text" placeholder="組(01-15)" class="border p-2 rounded w-1/3">
                                    <button @click="createClass()" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex-1">作成</button>
                                </div>
                            </div>

                            <!-- 単元作成 -->
                            <div class="bg-gray-50 p-4 rounded border">
                                <h3 class="font-bold mb-2">新規単元作成</h3>
                                <div class="flex gap-2 mb-2">
                                    <input x-model="newUnit.subject" type="text" list="subject-list" placeholder="教科名 (例: 算数)" class="border p-2 rounded w-1/3 bg-white">
                                    <datalist id="subject-list">
                                        <option value="国語"></option>
                                        <option value="算数"></option>
                                        <option value="理科"></option>
                                        <option value="社会"></option>
                                    </datalist>
                                    <input x-model="newUnit.unit_name" type="text" placeholder="単元名" class="border p-2 rounded flex-1">
                                    <button @click="createUnit()" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">作成</button>
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <!-- 学級一覧 -->
                            <div>
                                <h3 class="font-bold mb-2">登録済み学級一覧</h3>
                                <table class="w-full border-collapse text-sm">
                                    <thead>
                                        <tr class="bg-gray-100">
                                            <th class="border p-2">ID</th>
                                            <th class="border p-2">学年</th>
                                            <th class="border p-2">組</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <template x-for="cls in classes" :key="cls.id">
                                            <tr class="hover:bg-gray-50">
                                                <td class="border p-2 text-center" x-text="cls.id"></td>
                                                <td class="border p-2 text-center" x-text="cls.grade"></td>
                                                <td class="border p-2 text-center" x-text="cls.class_no"></td>
                                            </tr>
                                        </template>
                                    </tbody>
                                </table>
                            </div>

                            <!-- 単元一覧 -->
                            <div>
                                <h3 class="font-bold mb-2">登録済み単元一覧</h3>
                                <table class="w-full border-collapse text-sm">
                                    <thead>
                                        <tr class="bg-gray-100">
                                            <th class="border p-2">教科</th>
                                            <th class="border p-2">単元名</th>
                                            <th class="border p-2 w-16">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <template x-for="unit in units" :key="unit.id">
                                            <tr class="hover:bg-gray-50">
                                                <td class="border p-2 text-center" x-text="unit.subject"></td>
                                                <td class="border p-2" x-text="unit.unit_name"></td>
                                                <td class="border p-2 text-center">
                                                    <button @click="deleteUnit(unit.id)" class="text-red-500 hover:text-red-700" title="削除">
                                                        <i class="fas fa-trash"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        </template>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- 児童管理 (名簿・学習ログ) -->
                    <div x-show="currentView === 'student_manage'">
                        <div class="flex justify-between items-center mb-4 border-b pb-2">
                            <h2 class="text-2xl font-semibold">児童管理 (名簿・個票) <span class="text-lg text-gray-500 ml-2" x-text="getSelectedClassName()"></span></h2>
                        </div>
                        
                        <div class="flex gap-6 h-[600px]">
                            <!-- 左側: 児童一覧 -->
                            <div class="w-1/4 border rounded bg-white flex flex-col shadow-sm">
                                <div class="bg-gray-100 p-3 border-b font-bold text-gray-700">児童一覧</div>
                                <div class="overflow-y-auto flex-1 p-2 space-y-1">
                                    <template x-for="student in students" :key="student.seat_no">
                                        <button @click="selectStudentForReport(student.seat_no)" class="w-full text-left p-3 rounded border border-transparent hover:bg-blue-50 transition flex justify-between items-center" :class="{'bg-blue-100 border-blue-300 font-bold text-blue-800': selectedStudentReport === student.seat_no}">
                                            <span>出席番号 <span x-text="student.seat_no"></span></span>
                                            <i class="fas fa-chevron-right text-gray-400" x-show="selectedStudentReport === student.seat_no"></i>
                                        </button>
                                    </template>
                                </div>
                            </div>
                            
                            <!-- 右側: 個票 -->
                            <div class="w-3/4 border rounded bg-white flex flex-col shadow-sm p-6 overflow-y-auto">
                                <template x-if="!selectedStudentReport">
                                    <div class="flex flex-col items-center justify-center h-full text-gray-400">
                                        <i class="fas fa-user-graduate text-6xl mb-4"></i>
                                        <p>左側のリストから児童を選択してください</p>
                                    </div>
                                </template>
                                <template x-if="selectedStudentReport">
                                    <div>
                                        <h3 class="text-xl font-bold border-b-2 border-blue-500 pb-2 mb-6">出席番号 <span x-text="selectedStudentReport"></span> の学習個票</h3>
                                        
                                        <template x-for="(units, subject) in groupedUnits" :key="'rep_'+subject">
                                            <div class="mb-8">
                                                <h4 class="font-bold text-lg text-gray-800 bg-gray-100 p-2 rounded mb-3"><i class="fas fa-book mr-2"></i><span x-text="subject"></span></h4>
                                                
                                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <template x-for="unit in units" :key="'rep_'+unit.id">
                                                        <div class="border border-gray-200 rounded p-4 bg-white shadow-sm">
                                                            <h5 class="font-bold text-md mb-2 text-blue-800 border-b pb-1" x-text="unit.unit_name"></h5>
                                                            <div class="grid grid-cols-2 gap-2 mb-3">
                                                                <div class="bg-blue-50 p-2 rounded text-center">
                                                                    <p class="text-xs text-blue-600 font-bold">テスト得点</p>
                                                                    <p class="text-xl font-bold"><span x-text="getMockScoreForUnit(selectedStudentReport, unit.id)"></span><span class="text-sm font-normal">点</span></p>
                                                                </div>
                                                                <div class="bg-indigo-50 p-2 rounded text-center">
                                                                    <p class="text-xs text-indigo-600 font-bold">伝達係数 t</p>
                                                                    <p class="text-xl font-bold" x-text="(0.15 + (getMockScoreForUnit(selectedStudentReport, unit.id) / 100) * 0.35).toFixed(2)"></p>
                                                                </div>
                                                            </div>
                                                            <div class="text-sm text-gray-700 bg-gray-50 p-2 rounded h-24 overflow-y-auto">
                                                                <span class="font-bold text-xs text-gray-500 block mb-1">AI評価コメント:</span>
                                                                <span x-text="getMockAnalysisCommentForUnit(selectedStudentReport, unit.subject, getMockScoreForUnit(selectedStudentReport, unit.id))"></span>
                                                            </div>

                                                            <div class="mt-3 border-t pt-2">
                                                                <button @click="toggleStudentReportDetail(unit.id, unit.subject, selectedStudentReport)" class="text-sm text-blue-600 hover:text-blue-800 font-bold flex items-center">
                                                                    <i class="fas fa-chart-network mr-1"></i> 対話ログ・構造図（ISM）を見る
                                                                </button>
                                                                <div x-show="expandedStudentReport[unit.id]" class="mt-3 space-y-3">
                                                                    <!-- 構造図(ISM) -->
                                                                    <div>
                                                                        <h6 class="text-xs font-bold text-gray-600 mb-1">生徒用構造図 map(S)</h6>
                                                                        <div class="bg-white border rounded p-2 flex justify-center text-xs">
                                                                            <div class="mermaid" :id="'mermaid_report_'+unit.id"></div>
                                                                        </div>
                                                                    </div>
                                                                    <!-- 対話ログ -->
                                                                    <div>
                                                                        <h6 class="text-xs font-bold text-gray-600 mb-1">AI対話ログ</h6>
                                                                        <div class="bg-gray-50 border rounded p-2 h-32 overflow-y-auto text-xs space-y-2">
                                                                            <div class="text-right">
                                                                                <div class="bg-blue-100 text-blue-900 inline-block p-1.5 rounded-lg max-w-[90%] text-left" x-text="getMockChatLogForSubject(unit.subject, getMockScoreForUnit(selectedStudentReport, unit.id)).user1"></div>
                                                                            </div>
                                                                            <div class="text-left flex items-start">
                                                                                <div class="bg-purple-100 text-purple-800 rounded-full w-5 h-5 flex items-center justify-center mr-1 flex-shrink-0 mt-0.5"><i class="fas fa-robot text-[10px]"></i></div>
                                                                                <div class="bg-white border border-gray-200 text-gray-800 inline-block p-1.5 rounded-lg max-w-[90%]" x-text="getMockChatLogForSubject(unit.subject, getMockScoreForUnit(selectedStudentReport, unit.id)).ai1"></div>
                                                                            </div>
                                                                            <div class="text-right">
                                                                                <div class="bg-blue-100 text-blue-900 inline-block p-1.5 rounded-lg max-w-[90%] text-left" x-text="getMockChatLogForSubject(unit.subject, getMockScoreForUnit(selectedStudentReport, unit.id)).user2"></div>
                                                                            </div>
                                                                            <div class="text-left flex items-start">
                                                                                <div class="bg-purple-100 text-purple-800 rounded-full w-5 h-5 flex items-center justify-center mr-1 flex-shrink-0 mt-0.5"><i class="fas fa-robot text-[10px]"></i></div>
                                                                                <div class="bg-white border border-gray-200 text-gray-800 inline-block p-1.5 rounded-lg max-w-[90%]" x-text="getMockChatLogForSubject(unit.subject, getMockScoreForUnit(selectedStudentReport, unit.id)).ai2"></div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </template>
                                                </div>
                                            </div>
                                        </template>
                                    </div>
                                </template>
                            </div>
                        </div>
                    </div>

                    <!-- 授業作成・単元・ISM管理 -->
                    <div x-show="currentView === 'lesson_create'">
                        <div class="flex justify-between items-center mb-4 border-b pb-2">
                            <h2 class="text-2xl font-semibold">授業作成</h2>
                            <span class="text-lg text-gray-600 font-bold bg-gray-100 px-3 py-1 rounded" x-text="selectedUnit ? (selectedUnit.subject + ' - ' + selectedUnit.unit_name) : ''"></span>
                        </div>
                        
                        <div x-show="!selectedUnit" class="p-4 bg-yellow-50 text-yellow-800 rounded border border-yellow-200">
                            左のメニューから教科・単元を選択してください。
                        </div>

                        <div x-show="selectedUnit" class="space-y-6">
                            <!-- 1. AI設定 -->
                            <div class="bg-gray-50 p-5 rounded border border-gray-300">
                                <div class="flex justify-between items-center mb-2">
                                    <h3 class="font-bold text-gray-800 text-lg"><i class="fas fa-robot mr-2"></i>1. AIアシスタント設定</h3>
                                </div>
                                <p class="text-sm text-gray-600 mb-4">この単元で児童が対話するAIモデルを設定します。クラス全体で同じモデルを使用します。</p>
                                <div class="bg-white border rounded p-3 flex items-center justify-between">
                                    <div class="flex items-center">
                                        <div class="bg-blue-100 p-2 rounded-lg text-blue-600 mr-3">
                                            <i class="fas fa-brain text-xl"></i>
                                        </div>
                                        <div>
                                            <p class="font-bold">Google Gemini (単元固定)</p>
                                            <p class="text-xs text-gray-500">児童の思考を促し、答えを直接教えないプロンプトが適用されます。</p>
                                        </div>
                                    </div>
                                    <span class="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">設定済み</span>
                                </div>
                            </div>

                            <!-- 2. ISM構造図 -->
                            <div class="bg-blue-50 p-5 rounded border border-blue-200">
                                <div class="flex justify-between items-center mb-2">
                                    <h3 class="font-bold text-blue-800 text-lg"><i class="fas fa-project-diagram mr-2"></i>2. ISM構造図の設定 (map(T))</h3>
                                    <button @click="openIsmModal(selectedUnit.id)" class="bg-white text-blue-600 border-2 border-blue-500 font-bold px-4 py-2 rounded hover:bg-blue-50 shadow-sm flex items-center">
                                        <i class="fas fa-edit mr-2"></i>構造図を編集する
                                    </button>
                                </div>
                                <p class="text-sm text-blue-600 mb-4">この単元で教える学習要素とその順序（つながり）を定義します。</p>
                                
                                <!-- プレビュー表示 -->
                                <div x-show="ismNodes.length > 0" class="bg-white border rounded p-4 flex justify-center mt-4">
                                    <div class="mermaid" x-ref="mainMermaid"></div>
                                </div>
                            </div>

                            <!-- 3. 授業とルーブリック設定 -->
                            <div class="bg-purple-50 p-5 rounded border border-purple-200">
                                <div class="flex justify-between items-center mb-2">
                                    <h3 class="font-bold text-purple-800 text-lg"><i class="fas fa-tasks mr-2"></i>3. 授業計画とルーブリック（評価基準）</h3>
                                    <button @click="proposeLessonsAndRubrics()" class="bg-white text-purple-600 border-2 border-purple-500 font-bold px-4 py-2 rounded hover:bg-purple-50 shadow-sm flex items-center">
                                        <i class="fas fa-robot mr-2"></i>AIに授業計画と基準を提案させる
                                    </button>
                                </div>
                                <p class="text-sm text-purple-600 mb-4">学習要素ごとに授業（第〇時）を追加し、それぞれにA・B・Cの評価基準を設定します。</p>
                                
                                <div class="space-y-4">
                                    <template x-for="(lesson, index) in lessons" :key="'lesson_'+index">
                                        <div class="bg-white p-4 rounded border shadow-sm relative">
                                            <button @click="removeLesson(index)" class="absolute top-2 right-2 text-red-400 hover:text-red-600"><i class="fas fa-times"></i></button>
                                            
                                            <div class="flex items-center gap-3 mb-3 border-b pb-2">
                                                <input x-model="lesson.name" class="font-bold text-gray-800 border-b focus:border-purple-500 outline-none w-24" placeholder="授業名 (例: 第1時)">
                                                <span class="text-sm text-gray-500">対象要素:</span>
                                                <select x-model="lesson.elementId" class="border rounded p-1 text-sm bg-gray-50">
                                                    <option value="">-- 要素を選択 --</option>
                                                    <template x-for="node in ismNodes" :key="'opt_n_'+node.id+index">
                                                        <option :value="node.id" x-text="node.id + ': ' + node.name"></option>
                                                    </template>
                                                </select>
                                            </div>
                                            
                                            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <div>
                                                    <label class="block text-xs font-bold text-green-700 mb-1">A (十分満足)</label>
                                                    <textarea x-model="lesson.rubricA" rows="2" class="w-full border border-green-200 bg-green-50 rounded p-2 text-xs focus:ring-green-500 focus:border-green-500" placeholder="A評価の基準..."></textarea>
                                                </div>
                                                <div>
                                                    <label class="block text-xs font-bold text-blue-700 mb-1">B (おおむね満足)</label>
                                                    <textarea x-model="lesson.rubricB" rows="2" class="w-full border border-blue-200 bg-blue-50 rounded p-2 text-xs focus:ring-blue-500 focus:border-blue-500" placeholder="B評価の基準..."></textarea>
                                                </div>
                                                <div>
                                                    <label class="block text-xs font-bold text-red-700 mb-1">C (努力を要する)</label>
                                                    <textarea x-model="lesson.rubricC" rows="2" class="w-full border border-red-200 bg-red-50 rounded p-2 text-xs focus:ring-red-500 focus:border-red-500" placeholder="C評価の基準..."></textarea>
                                                </div>
                                            </div>
                                        </div>
                                    </template>
                                    
                                    <button @click="addLesson()" class="w-full border-2 border-dashed border-purple-300 text-purple-600 p-3 rounded hover:bg-purple-100 transition font-bold flex justify-center items-center">
                                        <i class="fas fa-plus mr-2"></i> 授業（第〇時）を追加する
                                    </button>
                                </div>
                            </div>

                            <!-- 4. 授業セッション -->
                            <div class="p-5 border rounded" :class="activeSession ? 'bg-green-50 border-green-300 shadow-md' : 'bg-gray-50'">
                                <h3 class="font-bold mb-2 text-lg"><i class="fas fa-chalkboard-teacher mr-2"></i>4. 授業の実施</h3>
                                <template x-if="!activeSession">
                                    <div>
                                        <p class="mb-4 text-gray-600 text-sm">準備が完了したら、授業を開始して児童のログインを受け付けます。</p>
                                        <button @click="startSession()" class="bg-blue-600 text-white font-bold px-6 py-3 rounded hover:bg-blue-700 shadow flex items-center">
                                            <i class="fas fa-play-circle mr-2 text-xl"></i> 授業を開始する
                                        </button>
                                    </div>
                                </template>
                                <template x-if="activeSession">
                                    <div>
                                        <div class="flex items-center text-green-800 font-bold mb-3 bg-green-100 p-3 rounded border border-green-200">
                                            <i class="fas fa-broadcast-tower animate-pulse mr-2 text-xl"></i>
                                            <span>授業実施中！ (児童のログインを受け付けています)</span>
                                        </div>
                                        <div class="mb-4 bg-white p-3 rounded border text-sm flex gap-4">
                                            <p>セッションID: <span class="font-mono font-bold bg-gray-100 px-2 py-1 rounded" x-text="activeSession"></span></p>
                                            <p>対象クラス: <span class="font-bold" x-text="getSelectedClassName()"></span></p>
                                        </div>
                                        <button @click="endSession()" class="bg-red-500 text-white font-bold px-6 py-3 rounded hover:bg-red-600 shadow flex items-center">
                                            <i class="fas fa-stop-circle mr-2 text-xl"></i> 授業を終了する
                                        </button>
                                    </div>
                                </template>
                            </div>
                        </div>

                        <!-- 初心者向け ISMエディタ Modal -->
                        <div x-show="showIsmModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div class="bg-white p-6 rounded-lg w-11/12 max-w-6xl max-h-[90vh] overflow-y-auto flex flex-col">
                                <div class="flex justify-between items-center mb-4 border-b pb-2">
                                    <h3 class="text-xl font-bold text-blue-800"><i class="fas fa-sitemap mr-2"></i>学習要素のつながり設定 (ISM)</h3>
                                    <button @click="closeIsmModal()" class="text-gray-500 hover:text-gray-800"><i class="fas fa-times text-2xl"></i></button>
                                </div>
                                
                                <div class="flex gap-6 flex-1 min-h-[500px]">
                                    <!-- 左側：リスト形式のエディタ -->
                                    <div class="w-1/2 flex flex-col">
                                        <div class="flex justify-between items-center mb-2">
                                            <p class="font-bold text-gray-700">学習要素リスト</p>
                                            <button @click="proposeIsm()" class="bg-indigo-100 text-indigo-800 border border-indigo-300 px-3 py-1 rounded hover:bg-indigo-200 text-sm font-bold flex items-center shadow-sm">
                                                <i class="fas fa-robot mr-1"></i> AIに要素と順序を提案させる
                                            </button>
                                        </div>
                                        
                                        <div class="bg-gray-50 border rounded p-4 flex-1 overflow-y-auto mb-4 space-y-3">
                                            <template x-for="(node, index) in ismNodes" :key="node.id">
                                                <div class="bg-white p-3 rounded border shadow-sm flex flex-col gap-2">
                                                    <div class="flex items-center gap-2">
                                                        <span class="bg-blue-100 text-blue-800 font-bold px-2 py-1 rounded text-xs" x-text="node.id"></span>
                                                        <input x-model="node.name" @input="updateMermaidPreview()" class="border-b focus:border-blue-500 outline-none flex-1 px-1 font-bold" placeholder="学習要素名">
                                                        <select x-model="node.type" @change="updateMermaidPreview()" class="text-xs border rounded p-1 text-gray-600 bg-gray-50">
                                                            <option value="knowledge">知識・技能</option>
                                                            <option value="thinking">思考・判断・表現</option>
                                                        </select>
                                                        <button @click="removeIsmNode(index)" class="text-red-400 hover:text-red-600 ml-1"><i class="fas fa-trash"></i></button>
                                                    </div>
                                                    <div class="flex items-center gap-2 text-sm pl-8">
                                                        <span class="text-gray-500">前提となる要素:</span>
                                                        <div class="flex flex-wrap gap-1 flex-1">
                                                            <template x-for="pId in node.parents" :key="pId">
                                                                <span class="bg-gray-200 px-2 py-0.5 rounded flex items-center gap-1">
                                                                    <span x-text="getIsmNodeName(pId)"></span>
                                                                    <i @click="removeIsmParent(index, pId)" class="fas fa-times cursor-pointer text-gray-500 hover:text-red-500"></i>
                                                                </span>
                                                            </template>
                                                            <select @change="addIsmParent(index, $event.target.value); $event.target.value=''" class="border rounded px-1 py-0.5 text-xs bg-white">
                                                                <option value="">+ 追加</option>
                                                                <template x-for="optNode in ismNodes" :key="'opt'+optNode.id">
                                                                    <option x-show="optNode.id !== node.id && !node.parents.includes(optNode.id)" :value="optNode.id" x-text="optNode.id + ': ' + optNode.name"></option>
                                                                </template>
                                                            </select>
                                                        </div>
                                                    </div>
                                                </div>
                                            </template>
                                            
                                            <button @click="addIsmNode()" class="w-full border-2 border-dashed border-gray-300 text-gray-500 p-2 rounded hover:bg-gray-100 hover:text-blue-500 transition font-bold">
                                                <i class="fas fa-plus mr-1"></i> 新しい要素を追加
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <!-- 右側：プレビュー -->
                                    <div class="w-1/2 flex flex-col">
                                        <div class="flex justify-between items-center mb-2">
                                            <p class="font-bold text-gray-700">構造図プレビュー</p>
                                            <div class="flex gap-3 text-xs">
                                                <span class="flex items-center"><span class="w-3 h-3 bg-blue-100 border border-blue-500 mr-1 inline-block"></span>知識・技能</span>
                                                <span class="flex items-center"><span class="w-3 h-3 bg-pink-100 border border-pink-500 mr-1 inline-block rounded-full"></span>思考・判断・表現</span>
                                            </div>
                                        </div>
                                        <div class="border rounded bg-white p-4 flex-1 flex items-center justify-center overflow-auto shadow-inner relative">
                                            <div x-show="ismNodes.length === 0" class="text-gray-400 text-center">
                                                <i class="fas fa-sitemap text-4xl mb-2"></i>
                                                <p>左側のリストに要素を追加するか、<br>AI提案ボタンを押してください。</p>
                                            </div>
                                            <div class="mermaid" x-ref="modalMermaid" x-show="ismNodes.length > 0"></div>
                                        </div>
                                        <div class="mt-4 flex justify-end">
                                            <button @click="closeIsmModal()" class="bg-blue-600 text-white font-bold px-8 py-3 rounded hover:bg-blue-700 shadow-md">
                                                この構造で決定する
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- テスト管理・単元末分析 -->
                    <div x-show="currentView === 'test_manage'">
                        <div class="flex justify-between items-center mb-4 border-b pb-2">
                            <h2 class="text-2xl font-semibold">テスト管理・分析</h2>
                            <span class="text-lg text-gray-600 font-bold bg-gray-100 px-3 py-1 rounded" x-text="selectedUnit ? (selectedUnit.subject + ' - ' + selectedUnit.unit_name) : ''"></span>
                        </div>

                        <div x-show="!selectedUnit" class="p-4 bg-yellow-50 text-yellow-800 rounded border border-yellow-200">
                            左のメニューから教科・単元を選択してください。
                        </div>

                        <div x-show="selectedUnit">
                            <!-- タブ切り替え -->
                            <div class="flex space-x-2 mb-6 border-b">
                                <button @click="testTab = 'overall'" :class="{'border-b-4 border-blue-600 text-blue-800 font-bold bg-blue-50': testTab === 'overall', 'text-gray-500 hover:bg-gray-50': testTab !== 'overall'}" class="px-6 py-3 rounded-t-lg transition">全体分析</button>
                                <button @click="testTab = 'individual'" :class="{'border-b-4 border-blue-600 text-blue-800 font-bold bg-blue-50': testTab === 'individual', 'text-gray-500 hover:bg-gray-50': testTab !== 'individual'}" class="px-6 py-3 rounded-t-lg transition">一人ひとりの分析</button>
                            </div>

                            <!-- 全体分析タブ -->
                            <div x-show="testTab === 'overall'" class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <!-- 伝達係数 -->
                                <div class="border border-indigo-200 p-5 rounded-lg shadow-sm bg-white">
                                    <div class="flex items-center mb-3">
                                        <div class="bg-indigo-100 p-2 rounded-full mr-3 text-indigo-600">
                                            <i class="fas fa-project-diagram text-xl"></i>
                                        </div>
                                        <h3 class="font-bold text-lg">伝達係数 <span class="italic font-serif">t</span> の計算</h3>
                                    </div>
                                    <p class="text-sm text-gray-600 mb-4 h-10">map(T)とmap(S)の矢線一致度から構造理解を定量評価します。</p>
                                    <div x-show="tCoefResult" class="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded text-sm relative overflow-hidden">
                                        <div class="absolute right-0 top-0 opacity-10"><i class="fas fa-chart-line text-6xl"></i></div>
                                        <p class="mb-1 text-indigo-900">伝達係数: <span class="font-bold text-3xl ml-2" x-text="tCoefResult?.t_coefficient"></span></p>
                                        <p class="text-indigo-800">解釈: <span class="bg-indigo-200 px-2 py-1 rounded font-bold ml-2" x-text="tCoefResult?.interpretation"></span></p>
                                    </div>
                                    
                                    <div x-show="!tCoefResult" class="mt-4 p-8 text-center text-gray-400 border border-dashed rounded bg-gray-50 flex items-center justify-center">
                                        <i class="fas fa-spinner fa-spin mr-2"></i>計算中...
                                    </div>
                                </div>

                                <!-- SP表 -->
                                <div class="border border-green-200 p-5 rounded-lg shadow-sm bg-white lg:col-span-2">
                                    <div class="flex items-center justify-between mb-3">
                                        <div class="flex items-center">
                                            <div class="bg-green-100 p-2 rounded-full mr-3 text-green-600">
                                                <i class="fas fa-table text-xl"></i>
                                            </div>
                                            <h3 class="font-bold text-lg">クラス全体 S-P表</h3>
                                        </div>
                                    </div>
                                    <p class="text-sm text-gray-600 mb-4">業者テストなどの結果に基づく、クラス全体のS-P表（Student-Problem Table）です。</p>
                                    
                                    <div x-show="spTableResult" class="mt-4 overflow-x-auto">
                                        <table class="w-full text-sm text-center border-collapse border border-gray-300">
                                            <thead>
                                                <tr class="bg-gray-100">
                                                    <th class="border border-gray-300 p-2 w-16">No.</th>
                                                    <th class="border border-gray-300 p-2">得点</th>
                                                    <template x-for="(item, idx) in spTableResult?.items" :key="'h'+idx">
                                                        <th class="border border-gray-300 p-2 w-10 font-normal" x-text="item"></th>
                                                    </template>
                                                    <th class="border border-gray-300 p-2 w-16 bg-red-50 text-red-800 text-xs">注意喚起<br>指数(CP)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <template x-for="(student, sIdx) in spTableResult?.students" :key="'s'+sIdx">
                                                    <tr class="hover:bg-gray-50">
                                                        <td class="border border-gray-300 p-2 font-bold text-gray-600" x-text="student.id"></td>
                                                        <td class="border border-gray-300 p-2 font-bold" x-text="student.score"></td>
                                                        <template x-for="(score, iIdx) in student.scores" :key="'c'+sIdx+'-'+iIdx">
                                                            <td class="border border-gray-300 p-2" 
                                                                :style="getSpTableStyles(student, sIdx, iIdx, spTableResult)"
                                                                :class="{'text-green-600 font-bold': score === 1, 'text-red-400': score === 0}">
                                                                <span x-text="score === 1 ? '1' : '0'"></span>
                                                            </td>
                                                        </template>
                                                        <td class="border border-gray-300 p-2" :class="{'bg-red-100 text-red-800 font-bold': student.cp >= 0.5}" x-text="student.cp.toFixed(2)"></td>
                                                    </tr>
                                                </template>
                                            </tbody>
                                            <tfoot>
                                                <tr class="bg-gray-50 font-bold">
                                                    <td class="border border-gray-300 p-2" colspan="2">正答率(%)</td>
                                                    <template x-for="(rate, rIdx) in spTableResult?.item_correct_rates" :key="'r'+rIdx">
                                                        <td class="border border-gray-300 p-2 text-xs" x-text="rate"></td>
                                                    </template>
                                                    <td class="border border-gray-300 p-2"></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                        <div class="mt-2 text-xs text-gray-500 flex justify-end space-x-4">
                                            <span class="flex items-center"><div class="w-4 h-1 bg-red-500 mr-1"></div> S曲線 (生徒の正答数)</span>
                                            <span class="flex items-center"><div class="w-4 h-1 bg-blue-500 mr-1"></div> P曲線 (問題の正答数)</span>
                                            <span><i class="fas fa-square text-red-100 border border-red-300"></i> CP 0.5以上 (要注意)</span>
                                        </div>
                                    </div>
                                    
                                    <div x-show="!spTableResult" class="p-8 text-center text-gray-400 border border-dashed rounded bg-gray-50 flex items-center justify-center">
                                        <i class="fas fa-spinner fa-spin mr-2"></i>表を生成中...
                                    </div>
                                </div>
                            </div>

                            <!-- 個人分析タブ -->
                            <div x-show="testTab === 'individual'" class="flex flex-col md:flex-row gap-6">
                                <!-- 児童リスト -->
                                <div class="w-full md:w-1/3 bg-white border rounded-lg shadow-sm overflow-hidden h-[500px] flex flex-col">
                                    <div class="bg-gray-100 p-3 border-b font-bold text-gray-700 flex justify-between">
                                        <span>児童一覧</span>
                                        <span class="text-sm font-normal text-gray-500">出席番号順</span>
                                    </div>
                                    <div class="overflow-y-auto flex-1 p-2 space-y-1">
                                        <template x-for="i in 35" :key="i">
                                            <button @click="selectStudentAnalysis(i)" class="w-full text-left p-3 rounded border border-transparent hover:bg-blue-50 transition flex justify-between items-center" :class="{'bg-blue-100 border-blue-300 font-bold text-blue-800': selectedStudentForAnalysis === i}">
                                                <span>出席番号 <span x-text="i.toString().padStart(2, '0')"></span></span>
                                                <i class="fas fa-chevron-right text-gray-400 text-xs" x-show="selectedStudentForAnalysis !== i"></i>
                                            </button>
                                        </template>
                                    </div>
                                </div>

                                <!-- 詳細情報 -->
                                <div class="w-full md:w-2/3">
                                    <div x-show="!selectedStudentForAnalysis" class="h-full flex items-center justify-center p-10 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500">
                                        左のリストから児童を選択してください
                                    </div>
                                    
                                    <div x-show="selectedStudentForAnalysis" class="bg-white rounded-lg border shadow-sm p-5 flex flex-col h-[700px] overflow-y-auto">
                                        <div class="border-b pb-3 mb-4">
                                            <h3 class="text-xl font-bold text-gray-800 flex items-center">
                                                <div class="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm" x-text="selectedStudentForAnalysis?.toString().padStart(2, '0')"></div>
                                                出席番号 <span x-text="selectedStudentForAnalysis?.toString().padStart(2, '0')"></span> の分析詳細
                                            </h3>
                                        </div>
                                        
                                        <div class="space-y-6">
                                            <!-- スコア・理解度・伝達係数 -->
                                            <div class="grid grid-cols-3 gap-4">
                                                <div class="bg-orange-50 border border-orange-200 p-4 rounded-lg text-center">
                                                    <p class="text-xs text-orange-800 font-bold mb-1">テスト得点</p>
                                                    <p class="text-3xl font-bold text-orange-600"><span x-text="getMockScore(selectedStudentForAnalysis)"></span><span class="text-lg font-normal ml-1">点</span></p>
                                                </div>
                                                <div class="bg-indigo-50 border border-indigo-200 p-4 rounded-lg text-center">
                                                    <p class="text-xs text-indigo-800 font-bold mb-1">S-P表 類型</p>
                                                    <p class="text-xl font-bold text-indigo-600 mt-2" x-text="getMockSpType(selectedStudentForAnalysis)"></p>
                                                </div>
                                                <div class="bg-blue-50 border border-blue-200 p-4 rounded-lg text-center">
                                                    <p class="text-xs text-blue-800 font-bold mb-1">個人伝達係数 <span class="italic font-serif">t</span></p>
                                                    <p class="text-2xl font-bold text-blue-600 mt-1" x-text="(0.15 + (getMockScore(selectedStudentForAnalysis) / 100) * 0.35).toFixed(2)"></p>
                                                </div>
                                            </div>

                                            <!-- S-P表 個票 (New) -->
                                            <div>
                                                <h4 class="font-bold text-gray-700 mb-2 border-l-4 border-green-500 pl-2">S-P表 個票（解答状況）</h4>
                                                <div class="bg-white border rounded p-3 overflow-x-auto">
                                                    <table class="w-full text-sm text-center border-collapse">
                                                        <thead>
                                                            <tr class="bg-gray-100 text-xs">
                                                                <th class="border p-1 w-16">問題</th>
                                                                <th class="border p-1">Q1</th><th class="border p-1">Q2</th><th class="border p-1">Q3</th><th class="border p-1">Q4</th><th class="border p-1">Q5</th>
                                                                <th class="border p-1">Q6</th><th class="border p-1">Q7</th><th class="border p-1">Q8</th><th class="border p-1">Q9</th><th class="border p-1">Q10</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            <tr>
                                                                <td class="border p-1 bg-gray-50 font-bold text-xs">正誤</td>
                                                                <template x-for="n in 10" :key="'q'+n">
                                                                    <td class="border p-1 font-bold" :class="getMockAnswer(selectedStudentForAnalysis, n) === 1 ? 'text-green-600' : 'text-red-500 bg-red-50'">
                                                                        <span x-text="getMockAnswer(selectedStudentForAnalysis, n) === 1 ? '○' : '×'"></span>
                                                                    </td>
                                                                </template>
                                                            </tr>
                                                            <tr>
                                                                <td class="border p-1 bg-gray-50 text-[10px] text-gray-500">全体正答率</td>
                                                                <td class="border p-1 text-[10px] text-gray-500">90%</td><td class="border p-1 text-[10px] text-gray-500">85%</td><td class="border p-1 text-[10px] text-gray-500">80%</td><td class="border p-1 text-[10px] text-gray-500">75%</td><td class="border p-1 text-[10px] text-gray-500">70%</td>
                                                                <td class="border p-1 text-[10px] text-gray-500">60%</td><td class="border p-1 text-[10px] text-gray-500">50%</td><td class="border p-1 text-[10px] text-gray-500">40%</td><td class="border p-1 text-[10px] text-gray-500">30%</td><td class="border p-1 text-[10px] text-gray-500">20%</td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                    <p class="text-xs text-gray-500 mt-2">※右に行くほど難易度の高い問題です。左側の「×」はケアレスミスや基礎の抜け（注意喚起）の可能性があります。</p>
                                                </div>
                                            </div>

                                            <!-- AI分析コメントと要素定着度 -->
                                            <div class="grid grid-cols-2 gap-4">
                                                <div>
                                                    <h4 class="font-bold text-gray-700 mb-2 border-l-4 border-blue-500 pl-2">AI分析コメント</h4>
                                                    <div class="bg-gray-50 p-4 rounded text-sm text-gray-700 leading-relaxed border h-[120px] overflow-y-auto" x-text="getMockAnalysisComment(selectedStudentForAnalysis)">
                                                    </div>
                                                </div>
                                                <div>
                                                    <h4 class="font-bold text-gray-700 mb-2 border-l-4 border-green-500 pl-2">要素ごとの定着状況</h4>
                                                    <div class="space-y-2 bg-white p-3 border rounded h-[120px] overflow-y-auto">
                                                        <div class="flex items-center text-sm">
                                                            <div class="w-1/3 text-right pr-3 text-gray-600 font-bold">用語同定</div>
                                                            <div class="w-2/3 bg-gray-200 rounded-full h-2"><div class="bg-green-500 h-2 rounded-full" style="width: 100%"></div></div>
                                                        </div>
                                                        <div class="flex items-center text-sm">
                                                            <div class="w-1/3 text-right pr-3 text-gray-600 font-bold">割合の式</div>
                                                            <div class="w-2/3 bg-gray-200 rounded-full h-2"><div class="bg-green-500 h-2 rounded-full" :style="'width: ' + (getMockScore(selectedStudentForAnalysis) > 60 ? '100%' : '40%')"></div></div>
                                                        </div>
                                                        <div class="flex items-center text-sm">
                                                            <div class="w-1/3 text-right pr-3 text-gray-600 font-bold">図↔式 変換</div>
                                                            <div class="w-2/3 bg-gray-200 rounded-full h-2"><div class="bg-orange-500 h-2 rounded-full" :style="'width: ' + (getMockScore(selectedStudentForAnalysis) > 80 ? '80%' : '20%')"></div></div>
                                                        </div>
                                                        <div class="flex items-center text-sm">
                                                            <div class="w-1/3 text-right pr-3 text-gray-600 font-bold">解釈・活用</div>
                                                            <div class="w-2/3 bg-gray-200 rounded-full h-2"><div class="bg-red-400 h-2 rounded-full" :style="'width: ' + (getMockScore(selectedStudentForAnalysis) > 90 ? '60%' : '10%')"></div></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <!-- AI(Gemini)との対話ログ -->
                                            <div>
                                                <h4 class="font-bold text-gray-700 mb-2 border-l-4 border-purple-500 pl-2">AI (Gemini) との対話ログ</h4>
                                                <div class="bg-gray-50 border rounded p-4 h-48 overflow-y-auto space-y-3 text-sm">
                                                    <div class="text-right">
                                                        <div class="bg-blue-100 text-blue-900 inline-block p-2 rounded-lg max-w-[80%] text-left" x-text="getMockChatLog(selectedStudentForAnalysis).user1">
                                                        </div>
                                                    </div>
                                                    <div class="text-left flex items-start">
                                                        <div class="bg-purple-100 text-purple-800 rounded-full w-6 h-6 flex items-center justify-center mr-2 flex-shrink-0 mt-1"><i class="fas fa-robot text-xs"></i></div>
                                                        <div class="bg-white border border-gray-200 text-gray-800 inline-block p-2 rounded-lg max-w-[80%]" x-text="getMockChatLog(selectedStudentForAnalysis).ai1">
                                                        </div>
                                                    </div>
                                                    <div class="text-right">
                                                        <div class="bg-blue-100 text-blue-900 inline-block p-2 rounded-lg max-w-[80%] text-left" x-text="getMockChatLog(selectedStudentForAnalysis).user2">
                                                        </div>
                                                    </div>
                                                    <div class="text-left flex items-start">
                                                        <div class="bg-purple-100 text-purple-800 rounded-full w-6 h-6 flex items-center justify-center mr-2 flex-shrink-0 mt-1"><i class="fas fa-robot text-xs"></i></div>
                                                        <div class="bg-white border border-gray-200 text-gray-800 inline-block p-2 rounded-lg max-w-[80%]" x-text="getMockChatLog(selectedStudentForAnalysis).ai2">
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <!-- 最終提出 -->
                                            <div>
                                                <h4 class="font-bold text-gray-700 mb-2 border-l-4 border-yellow-500 pl-2">最終提出内容</h4>
                                                <div class="bg-yellow-50 p-4 rounded text-sm text-gray-800 border" x-text="getMockFinalSubmission(selectedStudentForAnalysis)">
                                                </div>
                                            </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                </div>

                <!-- ====== 児童用ビュー ====== -->
                <div x-show="currentRole === 'student'">
                    <div x-show="currentView === 'student_login'" class="max-w-md mx-auto mt-10">
                        <div class="mb-4 flex space-x-2">
                            <button @click="studentLoginMode = 'in_class'" :class="{'bg-blue-600 text-white': studentLoginMode === 'in_class', 'bg-gray-200': studentLoginMode !== 'in_class'}" class="flex-1 py-2 rounded-t-lg font-bold">授業中ログイン</button>
                            <button @click="studentLoginMode = 'out_class'" :class="{'bg-blue-600 text-white': studentLoginMode === 'out_class', 'bg-gray-200': studentLoginMode !== 'out_class'}" class="flex-1 py-2 rounded-t-lg font-bold">校外ログイン</button>
                        </div>
                        
                        <!-- 授業中ログイン -->
                        <div x-show="studentLoginMode === 'in_class'" class="bg-white p-8 rounded-b-lg rounded-tr-lg shadow border">
                            <h2 class="text-2xl font-bold mb-6 text-center text-blue-600">授業ログイン</h2>
                            <p class="mb-4 text-gray-600 text-center">先生が授業を開始したら、出席番号を入力して参加してね。</p>
                            <input x-model="studentLogin.seat_no" type="number" placeholder="出席番号(例: 01)" class="w-full border-2 border-blue-300 p-4 rounded text-xl text-center mb-4">
                            <button @click="studentDoLogin()" class="w-full bg-blue-500 text-white p-4 rounded text-xl font-bold hover:bg-blue-600 shadow">参加する</button>
                            <p class="text-red-500 text-sm mt-2 text-center" x-text="studentLoginError"></p>
                        </div>

                        <!-- 校外ログイン -->
                        <div x-show="studentLoginMode === 'out_class'" class="bg-white p-8 rounded-b-lg rounded-tl-lg shadow border">
                            <h2 class="text-2xl font-bold mb-6 text-center text-blue-600">校外ログイン</h2>
                            <p class="mb-4 text-gray-600 text-center">先生から教わった5桁のコードを入力してね。</p>
                            <input x-model="studentLogin.passcode" type="text" placeholder="5桁のコード" maxlength="5" class="w-full border-2 border-blue-300 p-4 rounded text-xl text-center mb-4 tracking-widest">
                            <button @click="studentDoOutClassLogin()" class="w-full bg-blue-500 text-white p-4 rounded text-xl font-bold hover:bg-blue-600 shadow">ログイン</button>
                            <p class="text-red-500 text-sm mt-2 text-center" x-text="studentLoginError"></p>
                        </div>
                    </div>

                    <div x-show="currentView === 'student_learning'" class="max-w-3xl mx-auto">
                        <div class="flex justify-between items-center mb-4 pb-2 border-b">
                            <h2 class="text-xl font-bold">学習画面</h2>
                            <span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-bold">ログイン中</span>
                        </div>

                        <!-- タブ -->
                        <div class="flex space-x-2 mb-4 border-b">
                            <button @click="studentTab = 'draft'" :class="{'border-b-2 border-blue-500 font-bold text-blue-600': studentTab === 'draft'}" class="px-4 py-2">自力下書き</button>
                            <button @click="studentTab = 'ai_chat'" :class="{'border-b-2 border-blue-500 font-bold text-blue-600': studentTab === 'ai_chat'}" class="px-4 py-2">AI対話</button>
                            <button @click="studentTab = 'submit'" :class="{'border-b-2 border-blue-500 font-bold text-blue-600': studentTab === 'submit'}" class="px-4 py-2">最終提出</button>
                        </div>

                        <!-- 下書き -->
                        <div x-show="studentTab === 'draft'">
                            <p class="mb-2 font-semibold">まず自分で考えたことを書いてみよう</p>
                            <textarea x-model="studentData.draft" rows="5" class="w-full border p-3 rounded mb-2" placeholder="図・式・言葉を自由記述..."></textarea>
                            <button @click="saveDraft()" class="bg-gray-800 text-white px-4 py-2 rounded w-full">下書き保存</button>
                        </div>

                        <!-- AIチャット -->
                        <div x-show="studentTab === 'ai_chat'">
                            <div class="bg-gray-100 p-4 rounded h-64 overflow-y-auto mb-2 border border-gray-300">
                                <template x-for="msg in studentData.chatHistory">
                                    <div :class="msg.role === 'user' ? 'text-right' : 'text-left'" class="mb-2">
                                        <div :class="msg.role === 'user' ? 'bg-blue-100 text-blue-900 inline-block p-2 rounded-lg' : 'bg-white text-gray-800 border inline-block p-2 rounded-lg'" class="max-w-[80%] text-sm">
                                            <span x-text="msg.text"></span>
                                        </div>
                                    </div>
                                </template>
                            </div>
                            <div class="flex gap-2">
                                <input x-model="studentData.chatInput" type="text" class="flex-1 border p-2 rounded" placeholder="AIに質問する...">
                                <button @click="sendChat()" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"><i class="fas fa-paper-plane"></i></button>
                            </div>
                        </div>

                        <!-- 最終提出 -->
                        <div x-show="studentTab === 'submit'">
                            <p class="mb-2 font-semibold">下書きとAI対話をもとに、最終的な考えをまとめよう</p>
                            <textarea x-model="studentData.finalContent" rows="6" class="w-full border-2 border-green-300 p-3 rounded mb-4 focus:ring focus:ring-green-200" placeholder="最終的なあなたの考え..."></textarea>
                            <button @click="submitFinal()" class="bg-green-600 text-white px-4 py-3 rounded w-full font-bold text-lg hover:bg-green-700 shadow">提出する</button>
                        </div>
                    </div>
                </div>

                <!-- ====== 研究者用ビュー ====== -->
                <div x-show="currentRole === 'researcher'">
                    <h2 class="text-2xl font-semibold mb-4 border-b pb-2">研究者ダッシュボード</h2>
                    <div class="bg-blue-50 p-6 rounded border border-blue-200 text-center">
                        <i class="fas fa-lock text-4xl text-blue-300 mb-2"></i>
                        <h3 class="text-lg font-bold text-blue-800 mb-2">匿名集計データアクセス</h3>
                        <p class="text-sm text-blue-600 mb-4">全学級・全単元の伝達係数t、SP表、ルーブリックを匿名で集計・ダウンロードします。</p>
                        <a href="/api/analysis/download/csv" download class="inline-block bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"><i class="fas fa-download mr-2"></i>全データCSV一括ダウンロード</a>
                    </div>
                </div>

            </div>
        </div>

        <script>
            function appData() {
                return {
                    currentRole: 'teacher',
                    currentView: 'system_manage',
                    systemStatus: '確認中...',
                    
                    // 先生用データ
                    classes: [],
                    selectedClassId: '',
                    units: [],
                    groupedUnits: {},
                    expandedSubjects: {},
                    expandedTestSubjects: {},
                    selectedUnit: null,
                    studentLogs: [],
                    newClass: { grade: 5, class_no: '' },
                    newUnit: { subject: '', unit_name: '' },
                    activeSession: null,
                    tCoefResult: null,
                    spTableResult: null,
                    showIsmModal: false,
                    currentIsmCode: '',
                    
                    // 新規追加: ISMエディタ・ルーブリック用データ
                    ismNodes: [],
                    lessons: [],
                    nextNodeId: 'A',
                    
                    // 新規追加: テスト管理用
                    testTab: 'overall', // overall, individual
                    selectedStudentForAnalysis: null,

                    students: [],
                    selectedStudentReport: null,
                    expandedStudentReport: {},

                    // 児童用データ
                    studentView: 'login', // login, learning
                    studentLoginMode: 'in_class',
                    studentTab: 'draft',
                    studentLogin: { seat_no: '', passcode: '' },
                    studentLoginError: '',
                    studentData: {
                        uuid: null,
                        sessionId: null,
                        draft: '',
                        chatInput: '',
                        chatHistory: [],
                        finalContent: ''
                    },

                    init() {
                        this.checkStatus();
                        this.loadClasses();
                        this.loadUnits();
                        
                        // Alpine初期化時に特定のタブを指定してリロードした場合などの初期化処理
                        if(this.currentRole === 'teacher' && !this.selectedClassId) {
                            this.currentView = 'system_manage';
                        }
                    },

                    toggleStudentReportDetail(unitId, subject, seatNo) {
                        this.expandedStudentReport[unitId] = !this.expandedStudentReport[unitId];
                        if (this.expandedStudentReport[unitId]) {
                            const score = this.getMockScoreForUnit(seatNo, unitId);
                            const code = this.getStudentIsmCode(subject, score);
                            setTimeout(() => {
                                const el = document.getElementById('mermaid_report_' + unitId);
                                if(el) {
                                    el.removeAttribute('data-processed');
                                    el.innerHTML = code;
                                    if(window.mermaid) mermaid.init(undefined, el);
                                }
                            }, 50);
                        }
                    },

                    getStudentIsmCode(subject, score) {
                        let nodes = [];
                        let code = 'graph TD\\n';
                        code += 'classDef success fill:#d1fae5,stroke:#10b981,stroke-width:2px;\\n';
                        code += 'classDef warning fill:#fef3c7,stroke:#f59e0b,stroke-width:2px;\\n';
                        code += 'classDef danger fill:#fee2e2,stroke:#ef4444,stroke-width:2px;\\n';

                        if(subject === '国語') {
                            nodes = [
                                { id: 'A', name: '場面の把握', type: 'knowledge', parents: [], threshold: 30 },
                                { id: 'B', name: '登場人物の確認', type: 'knowledge', parents: ['A'], threshold: 40 },
                                { id: 'C', name: '行動の読み取り', type: 'thinking', parents: ['B'], threshold: 50 },
                                { id: 'D', name: '心情の推測', type: 'thinking', parents: ['C'], threshold: 60 },
                                { id: 'E', name: '情景描写の効果', type: 'thinking', parents: ['C'], threshold: 70 },
                                { id: 'F', name: '心情の変化', type: 'thinking', parents: ['D', 'E'], threshold: 80 },
                                { id: 'G', name: '主題の考察', type: 'thinking', parents: ['F'], threshold: 90 },
                                { id: 'H', name: '自分の考え', parents: ['G'], threshold: 95 }
                            ];
                        } else if(subject === '理科') {
                            nodes = [
                                { id: 'A', name: '事象の提示', type: 'knowledge', parents: [], threshold: 30 },
                                { id: 'B', name: '問題の見いだし', type: 'thinking', parents: ['A'], threshold: 40 },
                                { id: 'C', name: '予想・仮説の設定', type: 'thinking', parents: ['B'], threshold: 50 },
                                { id: 'D', name: '解決方法の立案', type: 'thinking', parents: ['C'], threshold: 60 },
                                { id: 'E', name: '観察・実験の実施', type: 'knowledge', parents: ['D'], threshold: 70 },
                                { id: 'F', name: '結果の整理', type: 'knowledge', parents: ['E'], threshold: 80 },
                                { id: 'G', name: '考察', type: 'thinking', parents: ['F'], threshold: 90 },
                                { id: 'H', name: '結論の導出', type: 'thinking', parents: ['G'], threshold: 95 }
                            ];
                        } else if(subject === '社会') {
                            nodes = [
                                { id: 'A', name: '事象の把握', type: 'knowledge', parents: [], threshold: 30 },
                                { id: 'B', name: '問いの生成', type: 'thinking', parents: ['A'], threshold: 40 },
                                { id: 'C', name: '情報の収集', type: 'knowledge', parents: ['B'], threshold: 50 },
                                { id: 'D', name: '情報の読み取り', type: 'knowledge', parents: ['C'], threshold: 60 },
                                { id: 'E', name: '関連付け・意味づけ', type: 'thinking', parents: ['D'], threshold: 70 },
                                { id: 'F', name: '概念の形成', type: 'thinking', parents: ['E'], threshold: 80 },
                                { id: 'G', name: 'まとめ・表現', type: 'thinking', parents: ['F'], threshold: 90 }
                            ];
                        } else {
                            nodes = [
                                { id: 'A', name: '用語同定', type: 'knowledge', parents: [], threshold: 30 },
                                { id: 'B', name: '比べ方選択', type: 'thinking', parents: ['A'], threshold: 40 },
                                { id: 'C', name: '基準設定', type: 'thinking', parents: ['B'], threshold: 50 },
                                { id: 'D', name: '割合の式', type: 'knowledge', parents: ['C'], threshold: 60 },
                                { id: 'E', name: '図↔式', type: 'thinking', parents: ['D'], threshold: 70 },
                                { id: 'F', name: '解釈', type: 'thinking', parents: ['D'], threshold: 80 },
                                { id: 'G', name: '正当化', type: 'thinking', parents: ['E'], threshold: 85 },
                                { id: 'H', name: '活用', type: 'thinking', parents: ['F'], threshold: 90 },
                                { id: 'I', name: '説明', type: 'thinking', parents: ['G'], threshold: 95 }
                            ];
                        }

                        nodes.forEach(node => {
                            code += node.id + '[' + node.name + ']\\n';
                            let nodeClass = 'danger';
                            if (score >= node.threshold) nodeClass = 'success';
                            else if (score >= node.threshold - 15) nodeClass = 'warning';
                            code += 'class ' + node.id + ' ' + nodeClass + ';\\n';
                            
                            node.parents.forEach(pId => {
                                // 親が理解できていて子が理解できていない場合は赤い破線など、細かく制御も可能
                                code += pId + ' --> ' + node.id + '\\n';
                            });
                        });
                        return code;
                    },

                    // ユーティリティ
                    getSelectedClassName() {
                        if(!this.selectedClassId) return '';
                        const cls = this.classes.find(c => c.id == this.selectedClassId);
                        return cls ? (cls.grade + '年' + cls.class_no + '組') : '';
                    },

                    onClassChange() {
                        if(this.selectedClassId) {
                            this.currentView = 'dashboard';
                            this.loadStudents();
                        } else {
                            this.currentView = 'system_manage';
                        }
                    },

                    toggleSubject(subject) {
                        this.expandedSubjects[subject] = !this.expandedSubjects[subject];
                    },

                    toggleTestSubject(subject) {
                        this.expandedTestSubjects[subject] = !this.expandedTestSubjects[subject];
                    },

                    selectUnitForLesson(unit) {
                        this.selectedUnit = unit;
                        this.currentView = 'lesson_create';
                        // 教科ごとのモックデータ初期化
                        if(unit.subject === '算数') {
                            this.ismNodes = [
                                { id: 'A', name: '用語同定', type: 'knowledge', type: 'knowledge', parents: [] },
                                { id: 'B', name: '比べ方選択', type: 'thinking', parents: ['A'] },
                                { id: 'C', name: '基準設定', type: 'thinking', parents: ['B'] }
                            ];
                            this.nextNodeId = 'D';
                            this.lessons = [
                                { name: '第1時', elementId: 'A', rubricA: '用語の意味を正しく理解し、他者に論理的に説明できる。', rubricB: '図や式を用いて正しく理解し、問題を解くことができる。', rubricC: '教師の支援があれば理解し、基本的な問題に取り組むことができる。' },
                                { name: '第2時', elementId: 'B', rubricA: '適切な比べ方を選択し、なぜその方法が良いか説明できる。', rubricB: '適切な比べ方を選択できる。', rubricC: '支援を受けながら比べ方を選択できる。' },
                            ];
                        } else if(unit.subject === '国語') {
                            this.ismNodes = [
                                { id: 'A', name: '場面の把握', type: 'knowledge', type: 'knowledge', parents: [] },
                                { id: 'B', name: '登場人物の心情', parents: ['A'] },
                                { id: 'C', name: '主題の読み取り', parents: ['B'] }
                            ];
                            this.nextNodeId = 'D';
                            this.lessons = [
                                { name: '第1時', elementId: 'A', rubricA: '本文の叙述を根拠に深く読み取り、自分の言葉で表現できる。', rubricB: '本文の叙述をもとに正しく読み取ることができる。', rubricC: '支援を受けながら本文の叙述を見つけることができる。' },
                            ];
                        } else if(unit.subject === '理科') {
                            this.ismNodes = [
                                { id: 'A', name: '問題の見いだし', type: 'knowledge', parents: [] },
                                { id: 'B', name: '予想・仮説', parents: ['A'] },
                                { id: 'C', name: '実験の計画・実施', parents: ['B'] }
                            ];
                            this.nextNodeId = 'D';
                            this.lessons = [
                                { name: '第1時', elementId: 'A', rubricA: '事象を多面的に捉え、他者にわかりやすく説明できる。', rubricB: '必要な情報を収集・整理し、正しく理解できる。', rubricC: '支援を受けながら基本的な事象を捉えることができる。' }
                            ];
                        } else {
                            this.ismNodes = [
                                { id: 'A', name: '事象の把握', type: 'knowledge', type: 'knowledge', parents: [] },
                                { id: 'B', name: '要因の分析', parents: ['A'] }
                            ];
                            this.nextNodeId = 'C';
                            this.lessons = [];
                        }
                        this.updateMermaidPreview('mainMermaid');
                    },

                    selectUnitForTest(unit) {
                        this.selectedUnit = unit;
                        this.currentView = 'test_manage';
                        this.testTab = 'overall';
                        this.selectedStudentForAnalysis = null;
                        this.tCoefResult = null;
                        this.spTableResult = null;
                        
                        // 自動的に計算・取得を実行
                        this.$nextTick(() => {
                            this.calcTCoef();
                            this.loadSpTable();
                        });
                    },

                    async checkStatus() {
                        try {
                            const res = await fetch('/api/status');
                            const data = await res.json();
                            this.systemStatus = data.db_ok ? '正常稼働中 (DB接続OK)' : 'DBエラー';
                        } catch(e) {
                            this.systemStatus = '通信エラー';
                        }
                    },

                    async loadClasses() {
                        try {
                            const res = await fetch('/api/teacher/classes');
                            const data = await res.json();
                            if(data.classes) {
                                this.classes = data.classes;
                                // 初期値として最初のクラスを選択し、名簿をロードする
                                if (this.classes.length > 0 && !this.selectedClassId) {
                                    this.selectedClassId = this.classes[0].id;
                                    this.onClassChange();
                                }
                            }
                        } catch(e) {
                            console.error(e);
                        }
                    },

                    async loadStudents() {
                        if(!this.selectedClassId) return;
                        try {
                            const res = await fetch('/api/teacher/classes/' + this.selectedClassId + '/students');
                            const data = await res.json();
                            if(data.success) {
                                this.students = data.students || [];
                            }
                        } catch(e) {
                            console.error(e);
                        }
                    },

                    async createClass() {
                        if(!this.newClass.grade || !this.newClass.class_no) return alert('入力してください');
                        try {
                            const res = await fetch('/api/teacher/classes', {
                                method: 'POST',
                                body: JSON.stringify({ ...this.newClass, school_year_id: 1 })
                            });
                            const data = await res.json();
                            if(data.success) {
                                this.newClass.class_no = '';
                                this.loadClasses();
                            } else {
                                alert('エラー: ' + data.error);
                            }
                        } catch(e) {
                            alert('通信エラー');
                        }
                    },

                    async generateRoster(classId) {
                        if(!classId) return alert('学級を選択してください');
                        if(!confirm('出席番号01〜35で名簿を自動生成しますか？')) return;
                        try {
                            const res = await fetch('/api/teacher/enrollments/generate', {
                                method: 'POST',
                                body: JSON.stringify({ class_id: classId, start_no: 1, end_no: 35 })
                            });
                            const data = await res.json();
                            if(data.success) {
                                alert(data.count + '人の名簿を生成しました');
                                this.loadStudents();
                            }
                            else alert('エラー: ' + data.error);
                        } catch(e) {
                            alert('通信エラー');
                        }
                    },

                    async loadUnits() {
                        try {
                            const res = await fetch('/api/teacher/units');
                            const data = await res.json();
                            if(data.units) {
                                this.units = data.units;
                                
                                // 教科ごとにグループ化
                                this.groupedUnits = {};
                                this.units.forEach(u => {
                                    if(!this.groupedUnits[u.subject]) {
                                        this.groupedUnits[u.subject] = [];
                                        this.expandedSubjects[u.subject] = false;
                                        this.expandedTestSubjects[u.subject] = false;
                                    }
                                    this.groupedUnits[u.subject].push(u);
                                });
                            }
                        } catch(e) {
                            console.error(e);
                        }
                    },

                    async createUnit() {
                        if(!this.newUnit.subject || !this.newUnit.unit_name) return alert('教科と単元名を入力してください');
                        try {
                            const res = await fetch('/api/teacher/units', {
                                method: 'POST',
                                body: JSON.stringify({ ...this.newUnit, class_id: this.selectedClassId || 1 })
                            });
                            const data = await res.json();
                            if(data.success) {
                                this.newUnit.unit_name = '';
                                this.loadUnits();
                                alert('単元を作成しました');
                            } else {
                                alert('エラー: ' + data.error);
                            }
                        } catch(e) {
                            alert('通信エラー');
                        }
                    },

                    async deleteUnit(unitId) {
                        if(!confirm('この単元と、関連するISM、授業、ログ、テスト結果などを全て削除します。本当によろしいですか？')) return;
                        try {
                            const res = await fetch('/api/teacher/units/' + unitId, {
                                method: 'DELETE'
                            });
                            const data = await res.json();
                            if(data.success) {
                                if(this.selectedUnit && this.selectedUnit.id === unitId) {
                                    this.selectedUnit = null;
                                    this.currentView = 'dashboard';
                                }
                                this.loadUnits();
                            } else {
                                alert('エラー: ' + data.error);
                            }
                        } catch(e) {
                            alert('通信エラー');
                        }
                    },

                    // --- 新規追加: ISMエディタ関連 ---
                    openIsmModal() {
                        this.showIsmModal = true;
                        this.updateMermaidPreview('modalMermaid');
                    },

                    closeIsmModal() {
                        this.showIsmModal = false;
                        this.updateMermaidPreview('mainMermaid');
                    },

                    addIsmNode() {
                        this.ismNodes.push({ id: this.nextNodeId, name: '新しい要素', type: 'knowledge', parents: [] });
                        // IDをインクリメント (A -> B -> C ...)
                        this.nextNodeId = String.fromCharCode(this.nextNodeId.charCodeAt(0) + 1);
                        this.updateMermaidPreview();
                    },

                    removeIsmNode(index) {
                        const removedId = this.ismNodes[index].id;
                        this.ismNodes.splice(index, 1);
                        // 他のノードのparentsから削除
                        this.ismNodes.forEach(node => {
                            node.parents = node.parents.filter(p => p !== removedId);
                        });
                        this.updateMermaidPreview();
                    },

                    addIsmParent(nodeIndex, parentId) {
                        if(!parentId) return;
                        if(!this.ismNodes[nodeIndex].parents.includes(parentId)) {
                            this.ismNodes[nodeIndex].parents.push(parentId);
                            this.updateMermaidPreview();
                        }
                    },

                    removeIsmParent(nodeIndex, parentId) {
                        this.ismNodes[nodeIndex].parents = this.ismNodes[nodeIndex].parents.filter(p => p !== parentId);
                        this.updateMermaidPreview();
                    },

                    getIsmNodeName(id) {
                        const node = this.ismNodes.find(n => n.id === id);
                        return node ? node.id : id;
                    },

                    updateMermaidPreview(targetRef = 'modalMermaid') {
                        if(this.ismNodes.length === 0) return;
                        
                        let code = 'graph TD\\n';
                        code += 'classDef knowledge fill:#e0f2fe,stroke:#2563eb,stroke-width:2px;\\n';
                        code += 'classDef thinking fill:#fce7f3,stroke:#db2777,stroke-width:2px;\\n';
                        
                        this.ismNodes.forEach(node => {
                            const shapeStart = node.type === 'thinking' ? '([' : '[';
                            const shapeEnd = node.type === 'thinking' ? '])' : ']';
                            code += node.id + shapeStart + node.name + shapeEnd + '\\n';
                            
                            const cls = node.type === 'thinking' ? 'thinking' : 'knowledge';
                            code += 'class ' + node.id + ' ' + cls + ';\\n';
                            
                            node.parents.forEach(pId => {
                                code += pId + ' --> ' + node.id + '\\n';
                            });
                        });
                        
                        setTimeout(() => {
                            const el = this.$refs[targetRef];
                            if(el) {
                                el.removeAttribute('data-processed');
                                el.innerHTML = code;
                                if(window.mermaid) mermaid.init(undefined, el);
                            }
                        }, 50);
                    },

                    proposeIsm() {
                        if(this.selectedUnit?.subject === '国語') {
                            this.ismNodes = [
                                { id: 'A', name: '場面の把握', type: 'knowledge', type: 'knowledge', parents: [] },
                                { id: 'B', name: '登場人物の確認', type: 'knowledge', parents: ['A'] },
                                { id: 'C', name: '行動の読み取り', type: 'thinking', parents: ['B'] },
                                { id: 'D', name: '心情の推測', type: 'thinking', parents: ['C'] },
                                { id: 'E', name: '情景描写の効果', type: 'thinking', parents: ['C'] },
                                { id: 'F', name: '心情の変化', type: 'thinking', parents: ['D', 'E'] },
                                { id: 'G', name: '主題の考察', type: 'thinking', parents: ['F'] },
                                { id: 'H', name: '自分の考えの形成', type: 'thinking', parents: ['G'] }
                            ];
                            this.nextNodeId = 'I';
                        } else if(this.selectedUnit?.subject === '理科') {
                            this.ismNodes = [
                                { id: 'A', name: '事象の提示', type: 'knowledge', type: 'knowledge', parents: [] },
                                { id: 'B', name: '問題の見いだし', type: 'thinking', parents: ['A'] },
                                { id: 'C', name: '予想・仮説の設定', type: 'thinking', parents: ['B'] },
                                { id: 'D', name: '解決方法の立案', type: 'thinking', parents: ['C'] },
                                { id: 'E', name: '観察・実験の実施', type: 'knowledge', parents: ['D'] },
                                { id: 'F', name: '結果の整理', type: 'knowledge', parents: ['E'] },
                                { id: 'G', name: '考察', type: 'thinking', parents: ['F'] },
                                { id: 'H', name: '結論の導出', type: 'thinking', parents: ['G'] }
                            ];
                            this.nextNodeId = 'I';
                        } else if(this.selectedUnit?.subject === '社会') {
                            this.ismNodes = [
                                { id: 'A', name: '事象の把握', type: 'knowledge', type: 'knowledge', parents: [] },
                                { id: 'B', name: '問いの生成', type: 'thinking', parents: ['A'] },
                                { id: 'C', name: '情報の収集', type: 'knowledge', parents: ['B'] },
                                { id: 'D', name: '情報の読み取り', type: 'knowledge', parents: ['C'] },
                                { id: 'E', name: '関連付け・意味づけ', type: 'thinking', parents: ['D'] },
                                { id: 'F', name: '概念の形成', type: 'thinking', parents: ['E'] },
                                { id: 'G', name: 'まとめ・表現', type: 'thinking', parents: ['F'] }
                            ];
                            this.nextNodeId = 'H';
                        } else {
                            // 算数デフォルト
                            this.ismNodes = [
                                { id: 'A', name: '用語同定', type: 'knowledge', type: 'knowledge', parents: [] },
                                { id: 'B', name: '比べ方選択', type: 'thinking', parents: ['A'] },
                                { id: 'C', name: '基準設定', type: 'thinking', parents: ['B'] },
                                { id: 'D', name: '割合の式', type: 'knowledge', parents: ['C'] },
                                { id: 'E', name: '図↔式', type: 'thinking', parents: ['D'] },
                                { id: 'F', name: '解釈', type: 'thinking', parents: ['D'] },
                                { id: 'G', name: '正当化', type: 'thinking', parents: ['E'] },
                                { id: 'H', name: '活用', type: 'thinking', parents: ['F'] },
                                { id: 'I', name: '説明', type: 'thinking', parents: ['G'] }
                            ];
                            this.nextNodeId = 'J';
                        }
                        this.updateMermaidPreview();
                    },
                    
                    addLesson() {
                        const newLessonNum = this.lessons.length + 1;
                        this.lessons.push({
                            name: '第' + newLessonNum + '時',
                            elementId: this.ismNodes.length > 0 ? this.ismNodes[0].id : '',
                            rubricA: '', rubricB: '', rubricC: ''
                        });
                    },

                    removeLesson(index) {
                        this.lessons.splice(index, 1);
                    },

                    proposeLessonsAndRubrics() {
                        if (this.ismNodes.length === 0) {
                            alert('先にISM構造図で学習要素を作成してください');
                            return;
                        }
                        this.lessons = [];
                        this.ismNodes.forEach((node, index) => {
                            let rA = '', rB = '', rC = '';
                            if(this.selectedUnit?.subject === '算数') {
                                rA = node.name + 'について、複数の見方を関連付けて他者に論理的に説明できる。';
                                rB = node.name + 'について、図や式を用いて正しく理解し、問題を解くことができる。';
                                rC = node.name + 'について、教師の支援があれば理解し、基本的な問題に取り組むことができる。';
                            } else if(this.selectedUnit?.subject === '国語') {
                                rA = node.name + 'について、本文の叙述を根拠に深く読み取り、自分の言葉で表現できる。';
                                rB = node.name + 'について、本文の叙述をもとに正しく読み取ることができる。';
                                rC = node.name + 'について、支援を受けながら本文の叙述を見つけることができる。';
                            } else {
                                rA = node.name + 'について、事象を多面的に捉え、他者にわかりやすく説明できる。';
                                rB = node.name + 'について、必要な情報を収集・整理し、正しく理解できる。';
                                rC = node.name + 'について、支援を受けながら基本的な事象を捉えることができる。';
                            }
                            this.lessons.push({
                                name: '第' + (index+1) + '時',
                                elementId: node.id,
                                rubricA: rA, rubricB: rB, rubricC: rC
                            });
                        });
                    },

                    // --- 新規追加: 個別分析関連 ---
                    selectStudentAnalysis(seatNo) {
                        this.selectedStudentForAnalysis = seatNo;
                    },
                    
                    selectStudentForReport(seatNo) {
                        this.selectedStudentReport = seatNo;
                    },

                    getMockScore(seatNo) {
                        if(!seatNo) return 0;
                        // 出席番号をシードにして適当なスコアを生成
                        return 40 + ((seatNo * 13) % 61);
                    },

                    getMockScoreForUnit(seatNo, unitId) {
                        if(!seatNo) return 0;
                        // 出席番号と単元IDをシードにして適当なスコアを生成
                        return 40 + (((seatNo * 13) + (unitId * 17)) % 61);
                    },

                    getMockAnalysisCommentForUnit(seatNo, subject, score) {
                        if(subject === '算数') {
                            if(score >= 85) return '構造理解は非常に良好です。「正当化」「説明」の要素まで到達しており、他者に教える活動などを通じてさらに理解を深めることが期待できます。';
                            if(score >= 70) return '基本的な「割合の式」「図↔式の変換」は定着していますが、応用問題での「解釈」に課題が見られます。図を書いて考える習慣をつけるよう指導してください。';
                            if(score >= 50) return '「用語同定」はできていますが、「基準設定（どれがもとにする量か）」でつまずく傾向があります。数直線を書いて基準量を意識させる指導が効果的です。';
                            return '全体的に基礎からの復習が必要です。特に「比べ方選択」の段階での誤りが多いため、具体的な具体物を用いた学習から再スタートすることをおすすめします。';
                        } else if (subject === '国語') {
                            if(score >= 85) return '「心情の変化」や「主題の考察」まで深く読み取れています。根拠となる叙述を的確に見つけており、自分の考えを豊かに表現できています。';
                            if(score >= 60) return '「行動の読み取り」はできていますが、「心情の推測」において、表面的な理解にとどまる傾向があります。登場人物の立場になって考える発問が有効です。';
                            return '「場面の把握」でつまずいている可能性があります。まずは音読を繰り返し、いつ・どこで・だれが何をしたのかを整理する支援が必要です。';
                        } else {
                            if(score >= 85) return '事象を多角的に捉え、関連付けて深く理解できています。';
                            if(score >= 60) return '基礎的な知識は定着していますが、事象の関連付けに課題があります。';
                            return '基礎的な事象の把握から丁寧な支援が必要です。';
                        }
                    },

                    getMockSpType(seatNo) {
                        const score = this.getMockScore(seatNo);
                        if(score >= 80) return '安定型';
                        if(score >= 60) return '努力型';
                        if(score >= 40) return '不安定型';
                        return '要注意型';
                    },

                    getMockAnalysisComment(seatNo) {
                        const score = this.getMockScore(seatNo);
                        const subj = this.selectedUnit?.subject || '算数';
                        
                        if(subj === '算数') {
                            if(score >= 85) return '構造理解は非常に良好です。「正当化」「説明」の要素まで到達しており、他者に教える活動などを通じてさらに理解を深めることが期待できます。';
                            if(score >= 70) return '基本的な「割合の式」「図↔式の変換」は定着していますが、応用問題での「解釈」に課題が見られます。図を書いて考える習慣をつけるよう指導してください。';
                            if(score >= 50) return '「用語同定」はできていますが、「基準設定（どれがもとにする量か）」でつまずく傾向があります。数直線を書いて基準量を意識させる指導が効果的です。';
                            return '全体的に基礎からの復習が必要です。特に「比べ方選択」の段階での誤りが多いため、具体的な具体物を用いた学習から再スタートすることをおすすめします。';
                        } else if (subj === '国語') {
                            if(score >= 85) return '「心情の変化」や「主題の考察」まで深く読み取れています。根拠となる叙述を的確に見つけており、自分の考えを豊かに表現できています。';
                            if(score >= 60) return '「行動の読み取り」はできていますが、「心情の推測」において、表面的な理解にとどまる傾向があります。登場人物の立場になって考える発問が有効です。';
                            return '「場面の把握」でつまずいている可能性があります。まずは音読を繰り返し、いつ・どこで・だれが何をしたのかを整理する支援が必要です。';
                        } else {
                            if(score >= 85) return '事象を多角的に捉え、関連付けて深く理解できています。';
                            if(score >= 60) return '基礎的な知識は定着していますが、事象の関連付けに課題があります。';
                            return '基礎的な事象の把握から丁寧な支援が必要です。';
                        }
                    },

                    getMockChatLog(seatNo) {
                        const score = this.getMockScore(seatNo);
                        const subj = this.selectedUnit?.subject || '算数';
                        return this.getMockChatLogForSubject(subj, score);
                    },

                    getMockChatLogForSubject(subj, score) {
                        if(subj === '算数') {
                            if(score >= 80) {
                                return {
                                    user1: '割合の式は「比べられる量÷もとにする量」だけど、どうしてこの問題は割り算じゃなくて掛け算になるの？',
                                    ai1: '良い着眼点ですね！割合の基本の式から、別の量を求める式に変形してみましょう。「比べられる量」を求めるにはどうすればいいでしょうか？',
                                    user2: 'ああ、「もとにする量 × 割合」になるから掛け算なんだ。',
                                    ai2: 'その通りです！図に描いてみると、もとにする量が1のとき、求めたい量がどれくらいになるかが視覚的にもわかりやすくなりますよ。'
                                };
                            } else if(score >= 50) {
                                return {
                                    user1: '割合の式がわからない。どうやって考えればいいの？',
                                    ai1: 'いきなり式を覚えるのではなく、図に描いてみましょう。もとにする量を1としたとき、比べたい量はどれくらいになりそうかな？',
                                    user2: 'テープ図で書いてみた。もとにする量が50人で、比べたい量が20人だから、半分より少し少ないくらい？',
                                    ai2: 'その通り！素晴らしい気づきですね。「もとにする量（50人）」を基準にしていることがよく分かります。では、それを計算で求めるにはどんな式になるでしょうか？'
                                };
                            } else {
                                return {
                                    user1: '全然わからない。答え教えて。',
                                    ai1: '答えをそのまま教えることはできませんが、一緒に考えていきましょう。まずは問題文の中から、一番基本となる「もとにする量」を探してみましょう。どれかな？',
                                    user2: '20人？',
                                    ai2: '惜しいですね。「全体の〜」や「〜の〇倍」という言葉の前に注目してみてください。「全体の50人」とありますよね。これが「もとにする量」になります。'
                                };
                            }
                        } else if(subj === '国語') {
                            if(score >= 70) {
                                return {
                                    user1: '大造じいさんはなぜガンを撃たなかったの？',
                                    ai1: 'いい質問ですね。撃つ直前の大造じいさんの様子を表す言葉を探してみましょう。「強く心を打たれて」とありますが、何に心を打たれたのでしょうか？',
                                    user2: '残雪が仲間を守ろうとする姿かな。',
                                    ai2: '素晴らしい読み取りですね！単なる獲物としてではなく、同じ生き物として残雪の気高さを認めたからこそ、撃つことができなかったのですね。'
                                };
                            } else {
                                return {
                                    user1: '残雪ってどんな鳥？',
                                    ai1: '物語の最初のほうで、残雪について説明している部分を探してみましょう。「スマートな」という言葉の近くにどんな特徴が書かれていますか？',
                                    user2: '頭がよくてリーダー？',
                                    ai2: 'その通りです！ガンの群れを率いる、とても賢くて立派なリーダーとして描かれていますね。'
                                };
                            }
                        } else {
                            return {
                                user1: 'AIに質問してみよう',
                                ai1: '何について一緒に考えましょうか？',
                                user2: 'この単元のまとめ方を教えて。',
                                ai2: 'まずは、教科書やノートで学んだキーワードをいくつか挙げてみてください。それらをつなげて文章にしてみましょう。'
                            };
                        }
                    },

                    getMockFinalSubmission(seatNo) {
                        const score = this.getMockScore(seatNo);
                        const subj = this.selectedUnit?.subject || '算数';
                        
                        if(subj === '算数') {
                            if(score >= 80) return '割合は「比べられる量÷もとにする量」で求められる。式の変形を使えば、もとにする量や比べられる量も簡単に求められることが分かった。図を描くことで、式が正しいか確かめることもできる。';
                            if(score >= 50) return '割合は「比べられる量÷もとにする量」で求められる。テープ図を描くと、どれをもとにする量（1）とみるかが分かりやすい。式にすると 20 ÷ 50 = 0.4 になるので、答えは0.4です。';
                            return 'もとにする量がどれかを見つけるのが難しかった。割合の式は「比べられる量÷もとにする量」になる。';
                        } else if (subj === '国語') {
                            if(score >= 70) return '大造じいさんは、残雪の仲間を思う強い心と気高い姿に感動し、ただの鳥から「尊敬するライバル」へと見方が変わったのだと思う。';
                            return '大造じいさんと残雪の戦いが面白かった。最後にガンを撃たなかったのはかわいそうに思ったからだと思う。';
                        } else {
                            return 'この単元を通して、多くの新しいことを学ぶことができた。生活の中で活かしていきたい。';
                        }
                    },

                    getMockAnswer(seatNo, questionNo) {
                        // 出席番号と問題番号をシードにしてそれらしい正誤（1 or 0）を返す
                        const score = this.getMockScore(seatNo); // 40~100
                        const qDifficulty = questionNo * 10; // Q1:10 ~ Q10:100
                        const probability = (score + (100 - qDifficulty)) / 2; // 0~100
                        const rand = ((seatNo * 17) + (questionNo * 23)) % 100;
                        return rand < probability ? 1 : 0;
                    },
                    getSpTableStyles(student, sIdx, iIdx, spTableResult) {
                        if (!spTableResult || !spTableResult.item_correct_counts) return '';
                        const currentScore = Math.round(student.score / 10);
                        const nextScore = sIdx + 1 < spTableResult.students.length ? Math.round(spTableResult.students[sIdx + 1].score / 10) : currentScore;
                        
                        const currentPCount = spTableResult.item_correct_counts[iIdx];
                        const nextPCount = iIdx + 1 < spTableResult.items.length ? spTableResult.item_correct_counts[iIdx + 1] : currentPCount;
                        
                        let shadow = [];
                        let hasRedRight = false;
                        let hasRedBottom = false;
                        
                        // S曲線 (赤)
                        if (iIdx === currentScore - 1) {
                            shadow.push('inset -2px 0 0 0 #ef4444');
                            hasRedRight = true;
                        }
                        if (iIdx >= nextScore && iIdx < currentScore) {
                            shadow.push('inset 0 -2px 0 0 #ef4444');
                            hasRedBottom = true;
                        }
                        
                        // P曲線 (青)
                        if (sIdx === currentPCount - 1) {
                            shadow.push(hasRedBottom ? 'inset 0 -4px 0 0 #3b82f6' : 'inset 0 -2px 0 0 #3b82f6');
                        }
                        if (sIdx >= nextPCount && sIdx < currentPCount) {
                            shadow.push(hasRedRight ? 'inset -4px 0 0 0 #3b82f6' : 'inset -2px 0 0 0 #3b82f6');
                        }
                        
                        return shadow.length > 0 ? 'box-shadow: ' + shadow.join(', ') + ' !important;' : '';
                    },

                    // --------------------------

                    async startSession() {
                        if(!this.selectedUnit) return alert('単元を選択してください');
                        // モック的にlesson_id=1とする
                        try {
                            const res = await fetch('/api/teacher/sessions/start', {
                                method: 'POST', body: JSON.stringify({ lesson_id: 1 })
                            });
                            const data = await res.json();
                            if(data.success) {
                                this.activeSession = data.session_id;
                            } else {
                                alert('エラー: ' + data.error);
                            }
                        } catch(e) {
                            alert('通信エラー');
                        }
                    },

                    async endSession() {
                        if(!this.activeSession) return;
                        try {
                            await fetch('/api/teacher/sessions/end', {
                                method: 'POST', body: JSON.stringify({ session_id: this.activeSession })
                            });
                            this.activeSession = null;
                            alert('授業を終了し、全員ログアウトしました。');
                        } catch(e) {
                            alert('通信エラー');
                        }
                    },

                    async loadLogs() {
                        try {
                            const res = await fetch('/api/teacher/logs');
                            const data = await res.json();
                            if(data.logs) {
                                // 選択されたクラスに応じたダミー生成などを本来は行うが、MVPとしては固定モック
                                this.studentLogs = data.logs;
                            }
                        } catch(e) {
                            console.error(e);
                            alert('ログの取得に失敗しました');
                        }
                    },

                    async calcTCoef() {
                        if(!this.selectedUnit) return;
                        try {
                            const res = await fetch('/api/analysis/t-coef/' + this.selectedUnit.id);
                            const data = await res.json();
                            if(data.success) this.tCoefResult = data.metrics;
                        } catch(e) {
                            alert('通信エラー');
                        }
                    },

                    async loadSpTable() {
                        if(!this.selectedUnit) return;
                        try {
                            const res = await fetch('/api/analysis/sp-table/' + this.selectedUnit.id);
                            const data = await res.json();
                            if(data.success) this.spTableResult = data.sp_table;
                        } catch(e) {
                            alert('通信エラー');
                        }
                    },

                    // ======== 児童用関数 ========
                    async studentDoLogin() {
                        this.studentLoginError = '';
                        if(!this.studentLogin.seat_no) return this.studentLoginError = '入力してください';
                        
                        const no = this.studentLogin.seat_no.toString().padStart(2, '0');
                        
                        // DBに存在しない可能性があるためエラー対応
                        try {
                            const res = await fetch('/api/student/login/session', {
                                method: 'POST', body: JSON.stringify({ class_id: 1, seat_no: no })
                            });
                            const data = await res.json();
                            
                            if(data.success) {
                                this.studentData.uuid = data.student_uuid;
                                this.studentData.sessionId = data.session_id;
                                this.currentView = 'student_learning';
                            } else {
                                this.studentLoginError = data.error || 'ログインに失敗しました。先生が授業を開始しているか確認してください。';
                            }
                        } catch(e) {
                            this.studentLoginError = '通信エラーが発生しました。';
                        }
                    },

                    async studentDoOutClassLogin() {
                        this.studentLoginError = '';
                        if(!this.studentLogin.passcode) return this.studentLoginError = 'コードを入力してください';
                        if(this.studentLogin.passcode.length !== 5) return this.studentLoginError = '5桁のコードを入力してください';
                        
                        // モック実装: パスコードによるログイン
                        this.studentData.uuid = "mock-uuid-out-class";
                        this.studentData.sessionId = 999;
                        this.currentView = 'student_learning';
                    },

                    async saveDraft() {
                        if(!this.studentData.draft) return alert('入力してください');
                        try {
                            await fetch('/api/student/drafts', {
                                method: 'POST', 
                                body: JSON.stringify({
                                    session_id: this.studentData.sessionId,
                                    student_uuid: this.studentData.uuid,
                                    content: this.studentData.draft
                                })
                            });
                            alert('下書きを保存しました');
                        } catch(e) {
                            alert('通信エラー');
                        }
                    },

                    async sendChat() {
                        if(!this.studentData.chatInput) return;
                        const prompt = this.studentData.chatInput;
                        this.studentData.chatHistory.push({ role: 'user', text: prompt });
                        this.studentData.chatInput = '';
                        
                        try {
                            const res = await fetch('/api/student/chat', {
                                method: 'POST', 
                                body: JSON.stringify({
                                    session_id: this.studentData.sessionId,
                                    student_uuid: this.studentData.uuid,
                                    prompt: prompt
                                })
                            });
                            const data = await res.json();
                            if(data.success) {
                                this.studentData.chatHistory.push({ role: 'ai', text: data.output });
                            }
                        } catch(e) {
                            alert('通信エラー');
                        }
                    },

                    async submitFinal() {
                        if(!this.studentData.finalContent) return alert('入力してください');
                        if(!confirm('一度提出すると修正できません。提出しますか？')) return;
                        
                        try {
                            await fetch('/api/student/submissions', {
                                method: 'POST', 
                                body: JSON.stringify({
                                    session_id: this.studentData.sessionId,
                                    student_uuid: this.studentData.uuid,
                                    final_content: this.studentData.finalContent
                                })
                            });
                            alert('提出が完了しました！よくがんばりました。');
                        } catch(e) {
                            alert('通信エラー');
                        }
                    }
                }
            }
        </script>
    </body>
    </html>
  `)
})

export default app