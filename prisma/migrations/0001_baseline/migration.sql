-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "academic_terms" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "year" INTEGER NOT NULL,
    "term_type" VARCHAR(30) NOT NULL,
    "is_active" BOOLEAN,

    CONSTRAINT "academic_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_completed_courses" (
    "id" SERIAL NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "academic_term_id" INTEGER,
    "course_code" VARCHAR(100) NOT NULL,
    "course_title" VARCHAR(300) NOT NULL,
    "normalized_title" VARCHAR(300) NOT NULL,
    "credit" DOUBLE PRECISION NOT NULL,
    "grade" VARCHAR(20),
    "source_student_id" VARCHAR(100),
    "source_file_name" VARCHAR(300),

    CONSTRAINT "batch_completed_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_current_registrations" (
    "id" SERIAL NOT NULL,
    "batch_id" INTEGER NOT NULL,
    "academic_term_id" INTEGER NOT NULL,
    "course_code" VARCHAR(100) NOT NULL,
    "course_title" VARCHAR(300) NOT NULL,
    "normalized_title" VARCHAR(300) NOT NULL,
    "credit" DOUBLE PRECISION NOT NULL,
    "source_student_id" VARCHAR(100),
    "source_file_name" VARCHAR(300),

    CONSTRAINT "batch_current_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" SERIAL NOT NULL,
    "program_id" INTEGER NOT NULL,
    "batch_code" VARCHAR(100) NOT NULL,
    "admission_term" VARCHAR(100),
    "is_active" BOOLEAN,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "short_name" VARCHAR(50) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_courses" (
    "id" SERIAL NOT NULL,
    "program_id" INTEGER NOT NULL,
    "course_code" TEXT NOT NULL,
    "course_title" TEXT NOT NULL,
    "normalized_title" TEXT NOT NULL,
    "credit" DOUBLE PRECISION NOT NULL,
    "course_type" TEXT NOT NULL,
    "level_term" TEXT,
    "group_name" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "curriculum_key" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offered_course_batches" (
    "id" SERIAL NOT NULL,
    "offered_course_id" INTEGER NOT NULL,
    "batch_id" INTEGER NOT NULL,

    CONSTRAINT "offered_course_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offered_course_slots" (
    "id" SERIAL NOT NULL,
    "offered_course_id" INTEGER NOT NULL,
    "day_of_week" VARCHAR(20) NOT NULL,
    "start_time" VARCHAR(10) NOT NULL,
    "end_time" VARCHAR(10) NOT NULL,
    "room_id" INTEGER NOT NULL,
    "slot_type" VARCHAR(20) NOT NULL,

    CONSTRAINT "offered_course_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offered_course_teachers" (
    "id" SERIAL NOT NULL,
    "offered_course_id" INTEGER NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "assigned_credit" DOUBLE PRECISION NOT NULL,
    "load_type" VARCHAR(20) NOT NULL,

    CONSTRAINT "offered_course_teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offered_courses" (
    "id" SERIAL NOT NULL,
    "offering_id" INTEGER NOT NULL,
    "master_course_id" INTEGER NOT NULL,
    "section" VARCHAR(20) NOT NULL,
    "is_cooffered" BOOLEAN,
    "notes" TEXT,

    CONSTRAINT "offered_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offerings" (
    "id" SERIAL NOT NULL,
    "academic_term_id" INTEGER NOT NULL,
    "program_id" INTEGER NOT NULL,
    "prepared_by_user_id" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faculty_course_selections" (
    "id" SERIAL NOT NULL,
    "offered_course_id" INTEGER NOT NULL,
    "teacher_id" INTEGER NOT NULL,
    "academic_term_id" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "selected_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ(6),

    CONSTRAINT "faculty_course_selections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programs" (
    "id" SERIAL NOT NULL,
    "department_id" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "short_name" VARCHAR(50) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" SERIAL NOT NULL,
    "room_code" VARCHAR(100) NOT NULL,
    "room_type" VARCHAR(50) NOT NULL,
    "capacity" INTEGER,
    "is_active" BOOLEAN,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_report_logs" (
    "id" SERIAL NOT NULL,
    "student_id" VARCHAR(100) NOT NULL,
    "student_name" VARCHAR(200),
    "uploaded_by_user_id" INTEGER NOT NULL,
    "transcript_filename" VARCHAR(300),
    "registration_filename" VARCHAR(300),
    "latest_completed_semester" VARCHAR(100),
    "registration_semester" VARCHAR(100),
    "total_earned_credits" DOUBLE PRECISION,
    "gpa" DOUBLE PRECISION,
    "generated_excel_path" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_report_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teachers" (
    "id" SERIAL NOT NULL,
    "department_id" INTEGER NOT NULL,
    "teacher_code" VARCHAR(100) NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "designation" VARCHAR(150),
    "email" VARCHAR(200),
    "is_active" BOOLEAN,

    CONSTRAINT "teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN,
    "teacher_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_catalog_entries" (
    "id" SERIAL NOT NULL,
    "department_code" TEXT NOT NULL,
    "department_name" TEXT NOT NULL,
    "program_code" TEXT NOT NULL,
    "program_title" TEXT NOT NULL,
    "program_type" TEXT NOT NULL,
    "study_shift" TEXT NOT NULL,
    "curriculum_version" TEXT NOT NULL,
    "student_id_suffix" TEXT,
    "display_label" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "curriculum_key" TEXT,

    CONSTRAINT "academic_catalog_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "academic_terms_name_key" ON "academic_terms"("name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_program_batch" ON "batches"("program_id", "batch_code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_short_name_key" ON "departments"("short_name");

-- CreateIndex
CREATE INDEX "master_courses_curriculum_key_idx" ON "master_courses"("curriculum_key");

-- CreateIndex
CREATE UNIQUE INDEX "master_courses_program_id_course_code_key" ON "master_courses"("program_id", "course_code");

-- CreateIndex
CREATE UNIQUE INDEX "master_courses_curriculum_key_course_code_key" ON "master_courses"("curriculum_key", "course_code");

-- CreateIndex
CREATE INDEX "ix_faculty_course_selections_teacher_id" ON "faculty_course_selections"("teacher_id");

-- CreateIndex
CREATE INDEX "ix_faculty_course_selections_term_id" ON "faculty_course_selections"("academic_term_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_faculty_course_selection" ON "faculty_course_selections"("offered_course_id", "teacher_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_program_department_name" ON "programs"("department_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_room_code_key" ON "rooms"("room_code");

-- CreateIndex
CREATE INDEX "ix_student_report_logs_id" ON "student_report_logs"("id");

-- CreateIndex
CREATE INDEX "ix_student_report_logs_student_id" ON "student_report_logs"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "teachers_teacher_code_key" ON "teachers"("teacher_code");

-- CreateIndex
CREATE UNIQUE INDEX "ix_users_username" ON "users"("username");

-- CreateIndex
CREATE INDEX "ix_users_id" ON "users"("id");

-- CreateIndex
CREATE UNIQUE INDEX "academic_catalog_entries_program_code_key" ON "academic_catalog_entries"("program_code");

-- CreateIndex
CREATE UNIQUE INDEX "academic_catalog_entries_student_id_suffix_key" ON "academic_catalog_entries"("student_id_suffix");

-- CreateIndex
CREATE INDEX "academic_catalog_entries_department_code_idx" ON "academic_catalog_entries"("department_code");

-- CreateIndex
CREATE INDEX "academic_catalog_entries_program_type_idx" ON "academic_catalog_entries"("program_type");

-- CreateIndex
CREATE INDEX "academic_catalog_entries_study_shift_idx" ON "academic_catalog_entries"("study_shift");

-- CreateIndex
CREATE INDEX "academic_catalog_entries_curriculum_version_idx" ON "academic_catalog_entries"("curriculum_version");

-- CreateIndex
CREATE INDEX "academic_catalog_entries_curriculum_key_idx" ON "academic_catalog_entries"("curriculum_key");

-- AddForeignKey
ALTER TABLE "batch_completed_courses" ADD CONSTRAINT "batch_completed_courses_academic_term_id_fkey" FOREIGN KEY ("academic_term_id") REFERENCES "academic_terms"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "batch_completed_courses" ADD CONSTRAINT "batch_completed_courses_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "batch_current_registrations" ADD CONSTRAINT "batch_current_registrations_academic_term_id_fkey" FOREIGN KEY ("academic_term_id") REFERENCES "academic_terms"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "batch_current_registrations" ADD CONSTRAINT "batch_current_registrations_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "master_courses" ADD CONSTRAINT "master_courses_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offered_course_batches" ADD CONSTRAINT "offered_course_batches_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "offered_course_batches" ADD CONSTRAINT "offered_course_batches_offered_course_id_fkey" FOREIGN KEY ("offered_course_id") REFERENCES "offered_courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "offered_course_slots" ADD CONSTRAINT "offered_course_slots_offered_course_id_fkey" FOREIGN KEY ("offered_course_id") REFERENCES "offered_courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "offered_course_slots" ADD CONSTRAINT "offered_course_slots_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "offered_course_teachers" ADD CONSTRAINT "offered_course_teachers_offered_course_id_fkey" FOREIGN KEY ("offered_course_id") REFERENCES "offered_courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "offered_course_teachers" ADD CONSTRAINT "offered_course_teachers_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "offered_courses" ADD CONSTRAINT "offered_courses_master_course_id_fkey" FOREIGN KEY ("master_course_id") REFERENCES "master_courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "offered_courses" ADD CONSTRAINT "offered_courses_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "offerings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_academic_term_id_fkey" FOREIGN KEY ("academic_term_id") REFERENCES "academic_terms"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_prepared_by_user_id_fkey" FOREIGN KEY ("prepared_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "offerings" ADD CONSTRAINT "offerings_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "faculty_course_selections" ADD CONSTRAINT "faculty_course_selections_academic_term_id_fkey" FOREIGN KEY ("academic_term_id") REFERENCES "academic_terms"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "faculty_course_selections" ADD CONSTRAINT "faculty_course_selections_offered_course_id_fkey" FOREIGN KEY ("offered_course_id") REFERENCES "offered_courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "faculty_course_selections" ADD CONSTRAINT "faculty_course_selections_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "programs" ADD CONSTRAINT "programs_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "student_report_logs" ADD CONSTRAINT "student_report_logs_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

