CREATE TABLE IF NOT EXISTS exam_schedules (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  academic_term_id INTEGER NOT NULL REFERENCES academic_terms(id) ON DELETE CASCADE,
  exam_type TEXT NOT NULL DEFAULT 'FINAL',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  max_exams_per_batch_per_day INTEGER NOT NULL DEFAULT 1,
  program_ids_json TEXT NOT NULL DEFAULT '[]',
  exam_dates_json TEXT NOT NULL DEFAULT '[]',
  exam_slots_json TEXT NOT NULL DEFAULT '[]',
  room_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exam_schedule_items (
  id SERIAL PRIMARY KEY,
  exam_schedule_id INTEGER NOT NULL REFERENCES exam_schedules(id) ON DELETE CASCADE,
  offered_course_id INTEGER NULL REFERENCES offered_courses(id) ON DELETE SET NULL,
  program_id INTEGER NULL REFERENCES programs(id) ON DELETE SET NULL,
  course_code TEXT NOT NULL,
  course_title TEXT NOT NULL,
  section TEXT NOT NULL,
  batch_codes TEXT NOT NULL DEFAULT '',
  student_count INTEGER NOT NULL DEFAULT 0,
  exam_date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  room_id INTEGER NULL REFERENCES rooms(id) ON DELETE SET NULL,
  room_code TEXT NOT NULL DEFAULT '',
  room_capacity INTEGER NOT NULL DEFAULT 0,
  seat_plan_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_schedules_term
ON exam_schedules(academic_term_id);

CREATE INDEX IF NOT EXISTS idx_exam_schedule_items_schedule
ON exam_schedule_items(exam_schedule_id);

CREATE INDEX IF NOT EXISTS idx_exam_schedule_items_date_slot
ON exam_schedule_items(exam_date, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_exam_schedule_items_room
ON exam_schedule_items(room_id);