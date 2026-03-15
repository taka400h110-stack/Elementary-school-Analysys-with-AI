import { Hono } from 'hono'

type Bindings = { DB: D1Database }
const analysisApp = new Hono<{ Bindings: Bindings }>()

// 伝達係数tのモック計算
analysisApp.get('/t-coef/:unit_id', async (c) => {
  const unitId = c.req.param('unit_id')
  try {
    return c.json({
      success: true,
      unit_id: unitId,
      metrics: {
        t_coefficient: 0.35,
        interpretation: "かなり理解している",
        f_matrix: { f11: 15, f12: 5, f21: 2, f22: 3 }
      }
    })
  } catch(e: any) {
    return c.json({ success: false, error: e.message }, 400)
  }
})

// SP表データのモック取得
analysisApp.get('/sp-table/:unit_id', async (c) => {
  const unitId = c.req.param('unit_id')
  
  // 35人分のS-P表モックデータを生成
  const students = [];
  for(let i=1; i<=35; i++) {
    const idStr = i.toString().padStart(2, '0');
    // シードベースの適当なスコア
    const baseScore = 40 + ((i * 13) % 61); // 40~100
    const scoreArr = [];
    let correctCount = 0;
    
    for(let q=1; q<=10; q++) {
      const qDiff = q * 10;
      const prob = (baseScore + (100 - qDiff)) / 2;
      const rand = ((i * 17) + (q * 23)) % 100;
      const isCorrect = rand < prob ? 1 : 0;
      scoreArr.push(isCorrect);
      if(isCorrect) correctCount++;
    }
    
    const finalScore = correctCount * 10;
    const cp = ((i * 7) % 100) / 100;
    
    let type = "安定型";
    if (cp >= 0.5) type = "要注意型";
    else if (finalScore < 60) type = "努力型";
    
    students.push({
      id: idStr,
      score: finalScore,
      cp: cp,
      type: type,
      scores: scoreArr
    });
  }
  
  // スコア順にソート (行のソート)
  students.sort((a, b) => b.score - a.score);

  // 問題ごとの正答人数を集計
  const raw_item_correct_counts = new Array(10).fill(0);
  students.forEach(student => {
    student.scores.forEach((s, idx) => {
      raw_item_correct_counts[idx] += s;
    });
  });
  
  // 問題インデックスを正答人数で降順にソート (列のソート)
  const question_indices = Array.from({length: 10}, (_, i) => i);
  question_indices.sort((a, b) => raw_item_correct_counts[b] - raw_item_correct_counts[a]);
  
  // ソートされた列データを構築
  const sorted_items = question_indices.map(idx => "Q" + (idx + 1));
  const sorted_item_counts = question_indices.map(idx => raw_item_correct_counts[idx]);
  const sorted_item_rates = sorted_item_counts.map(c => Math.round((c / 35) * 100));
  
  // 生徒のスコア配列もソート順に合わせる
  students.forEach(student => {
    const new_scores = question_indices.map(idx => student.scores[idx]);
    student.scores = new_scores;
  });

  try {
    return c.json({
      success: true,
      unit_id: unitId,
      sp_table: {
        items: sorted_items,
        item_correct_counts: sorted_item_counts,
        item_correct_rates: sorted_item_rates,
        students: students
      }
    })
  } catch(e: any) {
    return c.json({ success: false, error: e.message }, 400)
  }
})

// 匿名集計データ一括ダウンロード
analysisApp.get('/download/csv', async (c) => {
  const csvContent = `unit_id,class_id,t_coefficient,interpretation,avg_score\n1,1,0.35,かなり理解している,75\n1,2,0.42,よく理解している,82\n2,1,0.28,やや理解している,65\n`;
  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="aggregated_data.csv"'
    }
  });
})

// 研究者用ダッシュボード向けの統計データ
analysisApp.get('/stats', async (c) => {
  return c.json({
    success: true,
    stats: {
      overview: { total_students: 140, avg_score: 68.5, sd_score: 14.2, overall_t_coef: 0.35 },
      distribution: {
        labels: ['0-10', '11-20', '21-30', '31-40', '41-50', '51-60', '61-70', '71-80', '81-90', '91-100'],
        data: [0, 2, 5, 10, 15, 25, 35, 28, 15, 5]
      },
      items: [
        { id: 'Q1', diff: 0.9, disc: 0.15 },
        { id: 'Q2', diff: 0.85, disc: 0.25 },
        { id: 'Q3', diff: 0.75, disc: 0.40 },
        { id: 'Q4', diff: 0.70, disc: 0.50 },
        { id: 'Q5', diff: 0.65, disc: 0.45 },
        { id: 'Q6', diff: 0.50, disc: 0.60 },
        { id: 'Q7', diff: 0.45, disc: 0.55 },
        { id: 'Q8', diff: 0.40, disc: 0.65 },
        { id: 'Q9', diff: 0.30, disc: 0.30 },
        { id: 'Q10', diff: 0.20, disc: 0.10 }
      ],
      caution_indices: {
        labels: ['安定型 (CS<0.5)', '要注意型 (CS>=0.5)', '努力型 (低得点)', '不安定型'],
        data: [70, 45, 15, 10]
      },
      t_coef_trend: {
        labels: ['単元1(割合)', '単元2(国語)', '単元3(理科)', '単元4(社会)'],
        data: [0.28, 0.33, 0.35, 0.42]
      }
    }
  })
})

export default analysisApp

