-- 0002_seed_data.sql (can be applied manually or local)

INSERT OR IGNORE INTO school_years (year) VALUES (2026);

INSERT OR IGNORE INTO classes (school_year_id, grade, class_no, metadata) VALUES 
  (1, 5, '01', '{"teacher": "山田先生", "environment": "1人1台"}'),
  (1, 5, '02', '{"teacher": "佐藤先生", "environment": "1人1台"}');

-- 単元のサンプル
INSERT OR IGNORE INTO units (class_id, subject, unit_name, unit_plan, evaluation_criteria, version) VALUES
  (1, '算数', '割合', '小5算数「割合」の単元計画', '{"knowledge": true, "thinking": true, "attitude": true}', 1);

-- ノードのサンプル
INSERT OR IGNORE INTO nodes (unit_id, node_code, node_name, type, level) VALUES
  (1, 'E1', '用語同定', 'K', 1),
  (1, 'E2', '比べ方選択', 'T', 1),
  (1, 'E3', '基準設定', 'T', 2),
  (1, 'E4', '割合の式', 'T', 3),
  (1, 'E5', '図↔式', 'T', 3);

-- エッジのサンプル (map(T))
INSERT OR IGNORE INTO edges_T (unit_id, from_node_id, to_node_id, relation_type, confidence) VALUES
  (1, 1, 4, 'prerequisite', 0.9),
  (1, 2, 4, 'prerequisite', 0.8),
  (1, 3, 4, 'prerequisite', 0.8),
  (1, 4, 5, 'prerequisite', 0.7);

