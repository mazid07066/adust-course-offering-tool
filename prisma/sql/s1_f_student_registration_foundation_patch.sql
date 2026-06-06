CREATE TABLE IF NOT EXISTS student_semester_registrations (
  id SERIAL PRIMARY KEY,
  student_id_ref INTEGER NOT NULL,
  enrollment_id INTEGER NULL,
  academic_term_id INTEGER NOT NULL,
  program_id INTEGER NOT NULL,
  batch_id INTEGER NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
  total_credits DOUBLE PRECISION NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NULL,
  advisor_approved_at TIMESTAMPTZ NULL,
  coordinator_approved_at TIMESTAMPTZ NULL,
  locked_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  remarks TEXT NULL,
  created_by_student BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_student_semester_registrations_student
    FOREIGN KEY (student_id_ref)
    REFERENCES students(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_student_semester_registrations_enrollment
    FOREIGN KEY (enrollment_id)
    REFERENCES student_program_enrollments(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_student_semester_registrations_academic_term
    FOREIGN KEY (academic_term_id)
    REFERENCES academic_terms(id)
    ON DELETE NO ACTION,

  CONSTRAINT fk_student_semester_registrations_program
    FOREIGN KEY (program_id)
    REFERENCES programs(id)
    ON DELETE NO ACTION,

  CONSTRAINT fk_student_semester_registrations_batch
    FOREIGN KEY (batch_id)
    REFERENCES batches(id)
    ON DELETE SET NULL,

  CONSTRAINT uq_student_semester_registration_student_term_program
    UNIQUE (student_id_ref, academic_term_id, program_id)
);

CREATE TABLE IF NOT EXISTS student_registered_courses (
  id SERIAL PRIMARY KEY,
  registration_id INTEGER NOT NULL,
  offered_course_id INTEGER NOT NULL,
  course_status VARCHAR(40) NOT NULL DEFAULT 'ADDED',
  action_type VARCHAR(30) NOT NULL DEFAULT 'ADD',
  credit DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_retake BOOLEAN NOT NULL DEFAULT FALSE,
  is_improvement BOOLEAN NOT NULL DEFAULT FALSE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dropped_at TIMESTAMPTZ NULL,
  remarks TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_student_registered_courses_registration
    FOREIGN KEY (registration_id)
    REFERENCES student_semester_registrations(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_student_registered_courses_offered_course
    FOREIGN KEY (offered_course_id)
    REFERENCES offered_courses(id)
    ON DELETE NO ACTION,

  CONSTRAINT uq_student_registered_course_registration_course
    UNIQUE (registration_id, offered_course_id)
);

CREATE TABLE IF NOT EXISTS student_registration_actions (
  id SERIAL PRIMARY KEY,
  registration_id INTEGER NOT NULL,
  student_id_ref INTEGER NULL,
  offered_course_id INTEGER NULL,
  action_type VARCHAR(50) NOT NULL,
  old_status VARCHAR(40) NULL,
  new_status VARCHAR(40) NULL,
  performed_by_user_id INTEGER NULL,
  performed_by_student BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_student_registration_actions_registration
    FOREIGN KEY (registration_id)
    REFERENCES student_semester_registrations(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_student_registration_actions_student
    FOREIGN KEY (student_id_ref)
    REFERENCES students(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_student_registration_actions_offered_course
    FOREIGN KEY (offered_course_id)
    REFERENCES offered_courses(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_student_registration_actions_user
    FOREIGN KEY (performed_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_student_semester_registrations_student_id_ref
  ON student_semester_registrations(student_id_ref);

CREATE INDEX IF NOT EXISTS ix_student_semester_registrations_enrollment_id
  ON student_semester_registrations(enrollment_id);

CREATE INDEX IF NOT EXISTS ix_student_semester_registrations_academic_term_id
  ON student_semester_registrations(academic_term_id);

CREATE INDEX IF NOT EXISTS ix_student_semester_registrations_program_id
  ON student_semester_registrations(program_id);

CREATE INDEX IF NOT EXISTS ix_student_semester_registrations_batch_id
  ON student_semester_registrations(batch_id);

CREATE INDEX IF NOT EXISTS ix_student_semester_registrations_status
  ON student_semester_registrations(status);

CREATE INDEX IF NOT EXISTS ix_student_semester_registrations_term_status
  ON student_semester_registrations(academic_term_id, status);

CREATE INDEX IF NOT EXISTS ix_student_registered_courses_registration_id
  ON student_registered_courses(registration_id);

CREATE INDEX IF NOT EXISTS ix_student_registered_courses_offered_course_id
  ON student_registered_courses(offered_course_id);

CREATE INDEX IF NOT EXISTS ix_student_registered_courses_course_status
  ON student_registered_courses(course_status);

CREATE INDEX IF NOT EXISTS ix_student_registration_actions_registration_id
  ON student_registration_actions(registration_id);

CREATE INDEX IF NOT EXISTS ix_student_registration_actions_student_id_ref
  ON student_registration_actions(student_id_ref);

CREATE INDEX IF NOT EXISTS ix_student_registration_actions_action_type
  ON student_registration_actions(action_type);

CREATE INDEX IF NOT EXISTS ix_student_registration_actions_created_at
  ON student_registration_actions(created_at);