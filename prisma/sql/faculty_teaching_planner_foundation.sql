CREATE TABLE IF NOT EXISTS faculty_teaching_notes (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL,
  academic_term_id INTEGER NOT NULL,
  offered_course_id INTEGER NULL,
  note_date DATE NOT NULL,
  note_type VARCHAR(30) NOT NULL DEFAULT 'CLASS_NOTE',
  title VARCHAR(200) NULL,
  note_text TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_faculty_teaching_notes_teacher
    FOREIGN KEY (teacher_id)
    REFERENCES teachers(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_faculty_teaching_notes_term
    FOREIGN KEY (academic_term_id)
    REFERENCES academic_terms(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_faculty_teaching_notes_offered_course
    FOREIGN KEY (offered_course_id)
    REFERENCES offered_courses(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_faculty_teaching_notes_teacher_id
  ON faculty_teaching_notes(teacher_id);

CREATE INDEX IF NOT EXISTS ix_faculty_teaching_notes_term_id
  ON faculty_teaching_notes(academic_term_id);

CREATE INDEX IF NOT EXISTS ix_faculty_teaching_notes_offered_course_id
  ON faculty_teaching_notes(offered_course_id);

CREATE INDEX IF NOT EXISTS ix_faculty_teaching_notes_note_date
  ON faculty_teaching_notes(note_date);

CREATE INDEX IF NOT EXISTS ix_faculty_teaching_notes_teacher_term_date
  ON faculty_teaching_notes(teacher_id, academic_term_id, note_date);
