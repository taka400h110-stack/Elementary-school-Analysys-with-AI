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


// 12. 単元一覧取得
api.get('/units', async (c) => {
  const unitsRes = await c.env.DB.prepare(`
    SELECT u.id, u.subject, u.unit_name, c.grade, c.class_no
    FROM units u
    LEFT JOIN classes c ON u.class_id = c.id
    ORDER BY u.subject ASC, u.id ASC
  `).all();
  
  // デモデータ注入 (DBが空の場合)
  if (unitsRes.results.length === 0) {
    return c.json({ units: [
      { id: 1, subject: "算数", unit_name: "割合", grade: 5, class_no: "01" },
      { id: 2, subject: "算数", unit_name: "小数", grade: 5, class_no: "01" },
      { id: 3, subject: "国語", unit_name: "ごんぎつね", grade: 5, class_no: "01" }
    ]});
  }
  
  return c.json({ units: unitsRes.results });
})

// 13. 単元追加
api.post('/units', async (c) => {
  const { subject, unit_name, class_id } = await c.req.json();
  const cid = class_id || 1; // MVP default
  
  const res = await c.env.DB.prepare(`
    INSERT INTO units (class_id, subject, unit_name) VALUES (?, ?, ?) RETURNING id
  `).bind(cid, subject, unit_name).first();
  
  return c.json({ success: true, unit_id: res?.id });
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
  
  // --- DEMO DATA INJECTION ---
  // もしDBにデータがない場合、デモ用に固定のログデータを返す
  if (studentsRes.results.length === 0) {
    const demoStudents = [
      { seat_no: "01", student_uuid: "demo-uuid-01" },
      { seat_no: "02", student_uuid: "demo-uuid-02" },
      { seat_no: "03", student_uuid: "demo-uuid-03" }
    ];
    
    const demoDrafts = [
      { student_uuid: "demo-uuid-01", content: "割合とは、比べる量がもとにする量の何倍かを考えればいいと思う。", created_at: "2026-03-15T09:10:00" },
      { student_uuid: "demo-uuid-02", content: "もとにする量がわからないから、割り算で求める。", created_at: "2026-03-15T09:12:00" },
      { student_uuid: "demo-uuid-03", content: "うーん、図に書いてみる。", created_at: "2026-03-15T09:15:00" }
    ];
    
    const demoChats = [
      { student_uuid: "demo-uuid-01", turn_number: 1, prompt: "割合の式はどう書けばいい？", output: "「比べる量 ÷ もとにする量 = 割合」という式で表せるよ。では、この問題の場合、比べる量はどれかな？", created_at: "2026-03-15T09:11:00" },
      { student_uuid: "demo-uuid-01", turn_number: 2, prompt: "300円の方？", output: "その通り！では、もとにする量は？", created_at: "2026-03-15T09:12:30" },
      { student_uuid: "demo-uuid-02", turn_number: 1, prompt: "答えは0.5？", output: "計算は合っているね！どうしてその式になったのか、言葉で説明できるかな？", created_at: "2026-03-15T09:14:00" },
      { student_uuid: "demo-uuid-03", turn_number: 1, prompt: "わからない", output: "大丈夫、一緒に考えよう。まずは問題に出てくる数字を、数直線に書いてみるとわかりやすいよ。試してみてくれる？", created_at: "2026-03-15T09:16:00" }
    ];
    
    const demoSubmissions = [
      { student_uuid: "demo-uuid-01", final_content: "比べる量が300円で、もとにする量が500円なので、300 ÷ 500 = 0.6 になります。だから割合は0.6です。", created_at: "2026-03-15T09:20:00" },
      { student_uuid: "demo-uuid-02", final_content: "答えは0.5。もとにする量を基準にして考えたから。", created_at: "2026-03-15T09:22:00" },
      { student_uuid: "demo-uuid-03", final_content: "数直線を書いたら、もとにする量が1のときに、比べる量がどれくらいか分かった。割り算で計算できる。", created_at: "2026-03-15T09:25:00" }
    ];
    
    return c.json({
      students: demoStudents,
      drafts: demoDrafts,
      chats: demoChats,
      submissions: demoSubmissions
    });
  }
  // --- END DEMO DATA INJECTION ---

  return c.json({
    students: studentsRes.results,
    drafts: draftsRes.results,
    chats: chatsRes.results,
    submissions: submissionsRes.results
  })
})

// 11. 分析データ取得 (t係数とSP表のMVPモック)
api.get('/sessions/:session_id/analysis', async (c) => {
  const mockT = 0.45;
  const mockInterpretation = "よく理解している";
  
  // SP表モック（問題ごとの紐づく要素名も追加）
  const mockSP = {
    problems: [
      {
            "id": "Q1",
            "element": "E1: 割合の定義"
      },
      {
            "id": "Q2",
            "element": "E2: 用語同定（くらべる量）"
      },
      {
            "id": "Q3",
            "element": "E3: 用語同定（もとにする量）"
      },
      {
            "id": "Q4",
            "element": "E4: 割合の式（基本）"
      },
      {
            "id": "Q5",
            "element": "E5: 割合の式（応用）"
      },
      {
            "id": "Q6",
            "element": "E6: 図の読み取り"
      },
      {
            "id": "Q7",
            "element": "E7: くらべ方の選択"
      },
      {
            "id": "Q8",
            "element": "E8: 基準の変換"
      },
      {
            "id": "Q9",
            "element": "E9: 複数条件の比較"
      },
      {
            "id": "Q10",
            "element": "E10: 日常事象への適用"
      }
],
    students: [
      {
            "seat": "01",
            "scores": [
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  0
            ]
      },
      {
            "seat": "02",
            "scores": [
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  0,
                  0
            ]
      },
      {
            "seat": "03",
            "scores": [
                  0,
                  0,
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  1
            ]
      },
      {
            "seat": "04",
            "scores": [
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  0,
                  0,
                  0,
                  0
            ]
      },
      {
            "seat": "05",
            "scores": [
                  1,
                  1,
                  1,
                  1,
                  1,
                  0,
                  1,
                  0,
                  0,
                  0
            ]
      },
      {
            "seat": "06",
            "scores": [
                  1,
                  1,
                  1,
                  1,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0
            ]
      },
      {
            "seat": "07",
            "scores": [
                  1,
                  0,
                  1,
                  0,
                  1,
                  0,
                  1,
                  0,
                  1,
                  0
            ]
      },
      {
            "seat": "08",
            "scores": [
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  0,
                  0,
                  0
            ]
      },
      {
            "seat": "09",
            "scores": [
                  1,
                  1,
                  1,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0
            ]
      },
      {
            "seat": "10",
            "scores": [
                  1,
                  1,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0
            ]
      },
      {
            "seat": "11",
            "scores": [
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  1
            ]
      },
      {
            "seat": "12",
            "scores": [
                  1,
                  1,
                  1,
                  1,
                  0,
                  1,
                  0,
                  0,
                  0,
                  0
            ]
      },
      {
            "seat": "13",
            "scores": [
                  1,
                  1,
                  1,
                  1,
                  1,
                  0,
                  0,
                  0,
                  0,
                  0
            ]
      },
      {
            "seat": "14",
            "scores": [
                  0,
                  0,
                  0,
                  0,
                  0,
                  1,
                  1,
                  1,
                  0,
                  0
            ]
      },
      {
            "seat": "15",
            "scores": [
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  0,
                  1,
                  0,
                  0
            ]
      },
      {
            "seat": "16",
            "scores": [
                  1,
                  1,
                  1,
                  0,
                  1,
                  0,
                  0,
                  0,
                  0,
                  0
            ]
      },
      {
            "seat": "17",
            "scores": [
                  1,
                  1,
                  0,
                  1,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0
            ]
      },
      {
            "seat": "18",
            "scores": [
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  1,
                  0,
                  0,
                  0
            ]
      },
      {
            "seat": "19",
            "scores": [
                  1,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0
            ]
      },
      {
            "seat": "20",
            "scores": [
                  1,
                  1,
                  1,
                  1,
                  1,
                  0,
                  0,
                  0,
                  0,
                  0
            ]
      }
]
  };

  
  // 問題ごとの正答数を計算（P曲線のベース）
  const studentCount = mockSP.students.length;
  const problemCount = mockSP.problems.length;
  
  const problemStats = mockSP.problems.map((p, index) => {
    const correctCount = mockSP.students.filter(s => s.scores[index] === 1).length;
    return {
      ...p,
      correctCount,
      correctRate: Math.round((correctCount / studentCount) * 100)
    };
  });

  // 生徒の合計点
  mockSP.students.forEach(s => {
    s.total = s.scores.reduce((a, b) => a + b, 0);
  });
  
  // -- 注意係数の計算 --
  
  // 生徒の注意係数 (CS)
  // 各問題の正答数 (p_j) の配列を準備 (降順ソートしておく)
  const p_j_array = problemStats.map(p => p.correctCount).sort((a, b) => b - a);
  
  mockSP.students.forEach(s => {
    const r = s.total;
    if (r === 0 || r === problemCount) {
      s.cautionIndex = 0.00;
      return;
    }
    // 理想パターンのp_j和 (正答率が高いr問)
    let idealSum = 0;
    for (let i = 0; i < r; i++) idealSum += p_j_array[i];
    
    // 最悪パターンのp_j和 (正答率が低いr問)
    let worstSum = 0;
    for (let i = 0; i < r; i++) worstSum += p_j_array[problemCount - 1 - i];
    
    // 実際のp_j和
    let actualSum = 0;
    s.scores.forEach((score, index) => {
      if (score === 1) actualSum += problemStats[index].correctCount;
    });
    
    const denominator = idealSum - worstSum;
    s.cautionIndex = denominator === 0 ? 0 : Number(((idealSum - actualSum) / denominator).toFixed(2));
  });

  // 問題の注意係数 (CP)
  // 各生徒の合計点 (t_i) の配列を準備 (降順ソートしておく)
  const t_i_array = mockSP.students.map(s => s.total).sort((a, b) => b - a);
  
  problemStats.forEach((p, index) => {
    const c = p.correctCount;
    if (c === 0 || c === studentCount) {
      p.cautionIndex = 0.00;
      return;
    }
    // 理想パターンのt_i和 (合計点が高いc人)
    let idealSum = 0;
    for (let i = 0; i < c; i++) idealSum += t_i_array[i];
    
    // 最悪パターンのt_i和 (合計点が低いc人)
    let worstSum = 0;
    for (let i = 0; i < c; i++) worstSum += t_i_array[studentCount - 1 - i];
    
    // 実際のt_i和
    let actualSum = 0;
    mockSP.students.forEach(s => {
      if (s.scores[index] === 1) actualSum += s.total;
    });
    
    const denominator = idealSum - worstSum;
    p.cautionIndex = denominator === 0 ? 0 : Number(((idealSum - actualSum) / denominator).toFixed(2));
  });

  // 表示用に並び替え（生徒は点数降順・注意係数降順、問題は正答率降順）
  mockSP.students.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return b.cautionIndex - a.cautionIndex;
  });

  return c.json({
    t_coefficient: mockT,
    interpretation: mockInterpretation,
    sp_table: {
      problems: problemStats,
      students: mockSP.students
    }
  })
})
