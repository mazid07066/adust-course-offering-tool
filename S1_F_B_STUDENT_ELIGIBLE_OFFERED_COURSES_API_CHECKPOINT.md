# S1-F-B Checkpoint Completion — Student Registration Foundation: Eligible Offered Courses API

## Project

**Project Name:** UniFlow Academic Planner / ADUST Course Offering Tool  
**Project Path:** `D:\adust-course-offering-tool`  
**Feature Branch:** `s1-f-student-registration-foundation`  
**Checkpoint:** `S1-F-B — Student Eligible Offered Courses API`  
**Status:** Completed and tested successfully  

---

## 1. Checkpoint Context

S1-F is the **Student Registration Foundation** phase of UniFlow ERP expansion. The purpose of this phase is to introduce official student semester registration gradually and safely, without disturbing the existing offering, co-offering, faculty assignment, reporting, public routine, and exam scheduler systems.

S1-F must follow this core rule:

```text
Student registration must consume existing offering data.
It must not create, edit, delete, or mutate offering/co-offering/schedule/faculty-assignment records.
```

The system must continue to protect all stable pre-existing modules:

```text
1. Academic setup
2. Master course import
3. Student bulk import and student profile
4. Student portal login/profile/dashboard
5. Offering drafts
6. Co-offering setup and co-offering decision center
7. Faculty choice / assignment flow
8. Confirmed schedule and reports
9. Public schedule
10. Exam scheduler and exam schedule export
11. Room capacity setup
```

---

## 2. Completed Before This Checkpoint

### S1-F-A — Database and Backend Foundation

S1-F-A established the additive backend foundation for student registration.

It added:

```text
student_semester_registrations
student_registered_courses
student_registration_actions
```

These tables support:

```text
1. One registration record per student per academic term
2. Course-section rows selected by the student/admin
3. Audit trail for created, add, drop, submit, approve, lock, and cancel events
```

The status flow established for student registration is:

```text
DRAFT
SUBMITTED
ADVISOR_APPROVED
COORDINATOR_APPROVED
LOCKED
CANCELLED
```

S1-F-A was intentionally additive and did not change the existing offering system.

---

## 3. S1-F-B Scope

S1-F-B added a new student-facing API endpoint:

```text
/api/student/registration/eligible-courses
```

The purpose of this endpoint is to allow a logged-in student to view eligible offered courses for a selected academic term based on:

```text
1. The student's active enrollment
2. The student's program
3. The student's batch
4. Existing offered course batch mapping
5. Faculty-choice-stage or confirmed offering status
```

The endpoint reads from existing offering data only. It does not mutate any existing offering-related tables.

---

## 4. New File Added in S1-F-B

```text
src/app/api/student/registration/eligible-courses/route.ts
```

---

## 5. Important Fix Applied During S1-F-B

The first version of the endpoint imported a non-existing helper:

```ts
import { requireStudentSessionApi } from "@/lib/student-session";
```

The current `src/lib/student-session.ts` does not export `requireStudentSessionApi`. It exports existing student session helpers such as:

```text
getStudentSession()
requireStudentSession()
isStudentPortalEnabled()
```

The S1-F-B route was corrected to use:

```ts
import { getStudentSession, isStudentPortalEnabled } from "@/lib/student-session";
```

The route now uses the existing session shape:

```text
session.studentDbId
session.studentId
session.fullName
```

instead of the invalid earlier assumption:

```text
session.student.id
```

This fixed the build error while keeping the existing student portal/session system unchanged.

---

## 6. Endpoint Behavior

### Endpoint

```text
GET /api/student/registration/eligible-courses?academicTermId=<id>
```

### Authentication

The endpoint requires an active student session.

If the student is not logged in, the response is:

```json
{
  "ok": false,
  "error": "Unauthorized student session."
}
```

with HTTP status:

```text
401
```

### Portal Control

The endpoint respects global student portal enable/disable settings.

If the student portal is disabled, the response is:

```json
{
  "ok": false,
  "error": "<portal message>"
}
```

with HTTP status:

```text
403
```

### Required Query Parameter

```text
academicTermId
```

If missing, the response is:

```json
{
  "ok": false,
  "error": "academicTermId is required."
}
```

with HTTP status:

```text
400
```

---

## 7. Offering Statuses Used for Eligible Courses

The eligible offered courses API only reads from offerings with one of these statuses:

```text
FACULTY_CHOICE_BUFFER
FACULTY_CHOICE_FINALIZED
CONFIRMED
```

This means students can see registration-eligible courses only after offerings have reached a faculty-choice-visible or confirmed stage.

---

## 8. Data Sources Used by the API

The S1-F-B endpoint reads from:

```text
student_program_enrollments
academic_terms
student_semester_registrations
student_registered_courses
offerings
offered_courses
offered_course_batches
offered_course_slots
offered_course_teachers
master_courses
programs
batches
rooms
teachers
```

The endpoint does not write to any offering-related table.

---

## 9. Co-offering Handling

The endpoint respects the primary/secondary co-offering model.

For secondary co-offered rows:

```text
1. The secondary course remains visible as its own eligible course row.
2. Schedule, room, and teacher information are inherited from the primary offered course.
3. The response includes a primary reference such as: EEE1237 Sec-11
```

This follows the existing UniFlow rule:

```text
Primary section owns operational teaching details.
Secondary co-offered sections inherit the operational schedule and faculty.
```

---

## 10. Response Shape

A successful response returns:

```json
{
  "ok": true,
  "student": {
    "id": 1,
    "studentId": "252-0000-000",
    "fullName": "Student Name"
  },
  "enrollment": {
    "id": 1,
    "programId": 1,
    "batchId": 1
  },
  "academicTerm": {
    "id": 1,
    "name": "SUMMER 2026"
  },
  "registration": null,
  "eligibleStatuses": [
    "FACULTY_CHOICE_BUFFER",
    "FACULTY_CHOICE_FINALIZED",
    "CONFIRMED"
  ],
  "courses": []
}
```

If eligible courses exist, each course row includes:

```text
offeredCourseId
offeringId
offeringStatus
academicTermId
academicTermName
programId
programCode
programName
courseCode
courseTitle
credit
section
batchId
batchCode
role
primaryOfferedCourseId
primaryReference
facultyText
scheduleText
roomText
selectedCount
```

---

## 11. Tests Completed

The user confirmed that after the route fix:

```text
No error appeared.
Everything worked fine.
```

The expected successful tests were:

```text
1. npm run build passes.
2. Unauthenticated API request returns 401.
3. Logged-in student request returns 200.
4. If no eligible courses exist, the API returns ok: true and courses: [].
5. If eligible offerings exist, the API returns course rows with course, section, faculty, schedule, room, and selected count.
```

---

## 12. Git Status for This Checkpoint

This checkpoint should now be committed to the feature branch:

```text
s1-f-student-registration-foundation
```

Recommended commit message:

```text
Add S1-F eligible offered courses API
```

---

## 13. Git Commands to Save This Checkpoint

Run from the project root:

```powershell
cd D:\adust-course-offering-tool

git status
git add src/app/api/student/registration/eligible-courses/route.ts
git commit -m "Add S1-F eligible offered courses API"
git push origin s1-f-student-registration-foundation
```

If the commit already exists or there is nothing to commit, just confirm:

```powershell
git status
git log --oneline --max-count=8
```

Expected final clean state:

```text
On branch s1-f-student-registration-foundation
nothing to commit, working tree clean
```

---

## 14. Safety Confirmation

This checkpoint is safe because:

```text
1. It adds only one student registration API route.
2. It does not change offering creation.
3. It does not change co-offering logic.
4. It does not change faculty assignment.
5. It does not change schedule/report exports.
6. It does not change exam scheduler.
7. It uses the existing student session system correctly.
8. It only reads eligible offered courses for the logged-in student's active enrollment.
```

---

## 15. Next Recommended Checkpoint

The next checkpoint should be:

```text
S1-F-C — Student Registration Portal Page and Draft Add/Drop Workflow
```

### Recommended S1-F-C Scope

S1-F-C should add:

```text
1. /student/registration page
2. Academic term selector
3. Eligible course list display
4. Selected registration draft area
5. Add course to draft
6. Drop course from draft
7. Total selected credits display
8. Routine clash warning foundation
9. Submit draft registration as SUBMITTED
10. Keep billing, attendance, grades, admit card, and results inactive
```

### Important S1-F-C Rule

```text
S1-F-C should write only to:
student_semester_registrations
student_registered_courses
student_registration_actions
```

It must not write to:

```text
offerings
offered_courses
offered_course_batches
offered_course_slots
offered_course_teachers
co-offering links
confirmed reports
exam scheduler tables
```

---

## 16. Suggested Start-of-S1-F-C Safety Check

Before starting S1-F-C, run:

```powershell
cd D:\adust-course-offering-tool

git status
git branch --show-current
npm run build
```

Expected:

```text
Branch: s1-f-student-registration-foundation
Git: clean
Build: passed
```

Then continue to the next implementation package.

---

## 17. Continuation Prompt for Next Chat

```text
I am continuing UniFlow Academic Planner development.

Current branch:
s1-f-student-registration-foundation

Current completed checkpoint:
S1-F-B — Student Eligible Offered Courses API

S1-F-A completed:
- student_semester_registrations
- student_registered_courses
- student_registration_actions
- admin registration foundation APIs

S1-F-B completed:
- /api/student/registration/eligible-courses
- uses getStudentSession and isStudentPortalEnabled
- reads eligible offered courses for the logged-in student's active program/batch/academic term
- supports co-offering inheritance from primary offered course
- build and tests passed

Important safety rule:
Do not modify offering/co-offering/faculty assignment/report/exam scheduler systems.
Student registration must consume offering data only.

Now start:
S1-F-C — Student Registration Portal Page and Draft Add/Drop Workflow

Need full copy-paste-ready codes, exact file paths, tests, and git commands.
```

---

## 18. Checkpoint Summary

S1-F-B successfully connects the student portal to existing offering data in a controlled, read-only way. This is the first direct bridge between the student portal and the offering engine. The project can now safely proceed to student-side registration draft add/drop behavior.
