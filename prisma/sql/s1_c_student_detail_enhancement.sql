-- S1-C Student Detail Enhancement and Portal Preparation
-- Corrected for the existing S1-A/S1-B student schema.

ALTER TABLE students
ADD COLUMN IF NOT EXISTS blood_group TEXT,
ADD COLUMN IF NOT EXISTS religion TEXT,
ADD COLUMN IF NOT EXISTS nationality TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
ADD COLUMN IF NOT EXISTS portal_user_id INTEGER NULL;

ALTER TABLE student_program_enrollments
ADD COLUMN IF NOT EXISTS effective_from TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS effective_to TIMESTAMP NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'users'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND constraint_name = 'students_portal_user_id_fkey'
    ) THEN
      ALTER TABLE students
      ADD CONSTRAINT students_portal_user_id_fkey
      FOREIGN KEY (portal_user_id) REFERENCES users(id)
      ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_students_id ON students(id);
CREATE INDEX IF NOT EXISTS idx_students_student_id_s1c ON students(student_id);
CREATE INDEX IF NOT EXISTS idx_students_full_name_s1c ON students(full_name);
CREATE INDEX IF NOT EXISTS idx_students_current_status_s1c ON students(current_status);

CREATE INDEX IF NOT EXISTS idx_student_program_enrollments_student_id_ref_s1c
ON student_program_enrollments(student_id_ref);

CREATE INDEX IF NOT EXISTS idx_student_program_enrollments_program_id_s1c
ON student_program_enrollments(program_id);

CREATE INDEX IF NOT EXISTS idx_student_program_enrollments_batch_id_s1c
ON student_program_enrollments(batch_id);

CREATE INDEX IF NOT EXISTS idx_student_contacts_student_id_ref_s1c
ON student_contacts(student_id_ref);

CREATE INDEX IF NOT EXISTS idx_student_status_history_student_id_ref_s1c
ON student_status_history(student_id_ref);

CREATE INDEX IF NOT EXISTS idx_student_advisor_assignments_student_id_ref_s1c
ON student_advisor_assignments(student_id_ref);

CREATE INDEX IF NOT EXISTS idx_student_advisor_assignments_teacher_id_s1c
ON student_advisor_assignments(teacher_id);

CREATE INDEX IF NOT EXISTS idx_student_advisor_assignments_is_active_s1c
ON student_advisor_assignments(is_active);