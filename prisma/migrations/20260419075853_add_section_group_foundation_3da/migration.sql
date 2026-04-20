-- AlterTable
ALTER TABLE "offered_courses" ADD COLUMN     "primary_offered_course_id" INTEGER,
ALTER COLUMN "is_cooffered" SET DEFAULT false;

-- CreateIndex
CREATE INDEX "ix_offered_courses_primary_offered_course_id" ON "offered_courses"("primary_offered_course_id");

-- CreateIndex
CREATE INDEX "ix_offered_courses_offering_section" ON "offered_courses"("offering_id", "section");

-- AddForeignKey
ALTER TABLE "offered_courses" ADD CONSTRAINT "offered_courses_primary_offered_course_id_fkey" FOREIGN KEY ("primary_offered_course_id") REFERENCES "offered_courses"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
