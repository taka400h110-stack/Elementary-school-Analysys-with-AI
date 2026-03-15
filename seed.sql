DELETE FROM sessions;
DELETE FROM nodes;
DELETE FROM edges_T;
DELETE FROM lessons;
DELETE FROM units;
DELETE FROM enrollments;
DELETE FROM students;
DELETE FROM classes;
DELETE FROM school_years;

INSERT INTO school_years (id, year) VALUES (1, 2026);

INSERT INTO classes (id, school_year_id, grade, class_no, metadata) VALUES 
  (1, 1, 5, '01', '{"teacher": "山田先生", "environment": "1人1台"}');

-- 単元のサンプル (4教科)
INSERT INTO units (id, class_id, subject, unit_name, unit_plan, evaluation_criteria, version) VALUES
  (1, 1, '算数', '割合', '小5算数「割合」の単元計画', '{"knowledge": true, "thinking": true}', 1),
  (2, 1, '国語', '大造じいさんとガン', '小5国語「大造じいさんとガン」の単元計画', '{"knowledge": true, "thinking": true}', 1),
  (3, 1, '理科', 'ふりこのきまり', '小5理科「ふりこのきまり」の単元計画', '{"knowledge": true, "thinking": true}', 1),
  (4, 1, '社会', '日本の工業生産', '小5社会「日本の工業生産」の単元計画', '{"knowledge": true, "thinking": true}', 1);

-- 児童データ (35人) - UUIDを使わずに簡単なIDを使用する (SQLiteのテスト用)
-- または UUIDを生成して確実に紐付ける
INSERT INTO students (student_uuid) VALUES ('user-uuid-01');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-01', 1, '01');
INSERT INTO students (student_uuid) VALUES ('user-uuid-02');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-02', 1, '02');
INSERT INTO students (student_uuid) VALUES ('user-uuid-03');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-03', 1, '03');
INSERT INTO students (student_uuid) VALUES ('user-uuid-04');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-04', 1, '04');
INSERT INTO students (student_uuid) VALUES ('user-uuid-05');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-05', 1, '05');
INSERT INTO students (student_uuid) VALUES ('user-uuid-06');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-06', 1, '06');
INSERT INTO students (student_uuid) VALUES ('user-uuid-07');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-07', 1, '07');
INSERT INTO students (student_uuid) VALUES ('user-uuid-08');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-08', 1, '08');
INSERT INTO students (student_uuid) VALUES ('user-uuid-09');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-09', 1, '09');
INSERT INTO students (student_uuid) VALUES ('user-uuid-10');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-10', 1, '10');
INSERT INTO students (student_uuid) VALUES ('user-uuid-11');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-11', 1, '11');
INSERT INTO students (student_uuid) VALUES ('user-uuid-12');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-12', 1, '12');
INSERT INTO students (student_uuid) VALUES ('user-uuid-13');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-13', 1, '13');
INSERT INTO students (student_uuid) VALUES ('user-uuid-14');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-14', 1, '14');
INSERT INTO students (student_uuid) VALUES ('user-uuid-15');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-15', 1, '15');
INSERT INTO students (student_uuid) VALUES ('user-uuid-16');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-16', 1, '16');
INSERT INTO students (student_uuid) VALUES ('user-uuid-17');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-17', 1, '17');
INSERT INTO students (student_uuid) VALUES ('user-uuid-18');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-18', 1, '18');
INSERT INTO students (student_uuid) VALUES ('user-uuid-19');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-19', 1, '19');
INSERT INTO students (student_uuid) VALUES ('user-uuid-20');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-20', 1, '20');
INSERT INTO students (student_uuid) VALUES ('user-uuid-21');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-21', 1, '21');
INSERT INTO students (student_uuid) VALUES ('user-uuid-22');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-22', 1, '22');
INSERT INTO students (student_uuid) VALUES ('user-uuid-23');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-23', 1, '23');
INSERT INTO students (student_uuid) VALUES ('user-uuid-24');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-24', 1, '24');
INSERT INTO students (student_uuid) VALUES ('user-uuid-25');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-25', 1, '25');
INSERT INTO students (student_uuid) VALUES ('user-uuid-26');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-26', 1, '26');
INSERT INTO students (student_uuid) VALUES ('user-uuid-27');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-27', 1, '27');
INSERT INTO students (student_uuid) VALUES ('user-uuid-28');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-28', 1, '28');
INSERT INTO students (student_uuid) VALUES ('user-uuid-29');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-29', 1, '29');
INSERT INTO students (student_uuid) VALUES ('user-uuid-30');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-30', 1, '30');
INSERT INTO students (student_uuid) VALUES ('user-uuid-31');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-31', 1, '31');
INSERT INTO students (student_uuid) VALUES ('user-uuid-32');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-32', 1, '32');
INSERT INTO students (student_uuid) VALUES ('user-uuid-33');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-33', 1, '33');
INSERT INTO students (student_uuid) VALUES ('user-uuid-34');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-34', 1, '34');
INSERT INTO students (student_uuid) VALUES ('user-uuid-35');
INSERT INTO enrollments (student_uuid, class_id, seat_no) VALUES ('user-uuid-35', 1, '35');
