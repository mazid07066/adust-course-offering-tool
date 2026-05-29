# PROJECT_DOCUMENTATION.md

# UniFlow Academic Planner  
## Enterprise University Course Offering, Co-offering, Scheduling, Faculty Choice, Assignment, Reporting, and Public Routine System

**Project repository:** `adust-course-offering-tool`  
**Local project path:** `D:\adust-course-offering-tool`  
**Current branch:** `main`  
**Documentation generated:** 2026-05-29 21:10:59  
**Prepared for:** Mazid Ishtique Ahmed, Assistant Professor, EEE and Chairman, Department of Robotics and Automation Engineering, ADUST

---

## 1. Executive Summary

**UniFlow Academic Planner** is a production-oriented university academic operations system built to automate and professionalize the full course offering lifecycle. It replaces spreadsheet-heavy manual academic planning with a structured, role-based, conflict-aware, and report-ready web application.

The system supports:

- academic identity setup for departments, programs, study shifts, and curriculum versions;
- master curriculum import from structured files;
- transcript and registration parsing for batch-wise academic intelligence;
- completed, ongoing, and remaining course calculation;
- offering context generation;
- offering template import;
- draft offering creation and editing;
- multi-batch course attachment;
- primary-secondary co-offering;
- faculty management and user account management;
- faculty course choice with buffer/final/approval workflow;
- seniority-aware faculty turn and timed session control;
- manual and bulk faculty assignment;
- slot, room, batch, faculty, and co-offering conflict control;
- final schedule confirmation and lock;
- professional Excel reporting;
- public routine and faculty schedule pages.

The current codebase contains **37 admin page modules**, **150 API route files**, **34 library/helper modules**, and **23 Prisma schema models**.

---

## 2. Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js App Router, React, TypeScript |
| Styling | Tailwind CSS |
| Backend | Next.js API Route Handlers |
| ORM | Prisma |
| Database | PostgreSQL / Supabase |
| Authentication | Custom session helpers with NextAuth dependency present |
| File parsing | `xlsx`, `exceljs`, `mammoth`, `pdf-parse`, `pdf2json`, `pdfjs-dist`, `pdfreader` |
| Reporting | ExcelJS, CSV/Excel export routes |
| Deployment target | Vercel |
| Development OS | Windows + PowerShell |

### 2.1 Package Scripts

```json
{
  "dev": "next dev",
  "build": "prisma generate && next build",
  "start": "next start",
  "lint": "eslint",
  "seed": "tsx prisma/seed.ts",
  "postinstall": "prisma generate"
}
```

### 2.2 Important Dependencies

```json
{
  "@hookform/resolvers": "^5.2.2",
  "@prisma/client": "^6.0.0",
  "bcryptjs": "^3.0.2",
  "clsx": "^2.1.1",
  "exceljs": "^4.4.0",
  "lucide-react": "^0.552.0",
  "mammoth": "^1.12.0",
  "next": "^16.0.1",
  "next-auth": "^4.24.13",
  "pdf-parse": "^1.1.4",
  "pdf2json": "^4.0.2",
  "pdfjs-dist": "^5.6.205",
  "pdfreader": "^3.0.8",
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "react-hook-form": "^7.62.0",
  "xlsx": "^0.18.5",
  "zod": "^4.1.11"
}
```

---

## 3. Environment Variables

The uploaded safe environment dump confirms that the application expects these environment keys:

| Key | Purpose |
| --- | --- |
| DATABASE_URL | Primary Prisma/Supabase PostgreSQL connection string. |
| DIRECT_URL | Direct PostgreSQL URL for Prisma migrations or direct database operations. |
| NEXTAUTH_SECRET | Secret used by authentication/session infrastructure. |
| NEXTAUTH_URL | Base URL for NextAuth/auth callbacks. |
| NODE_ENV | Runtime environment such as development or production. |

**Security rule:** never commit `.env` with real values. Only share safe structures like `env_structure_safe_dump.txt`.

---

## 4. High-Level Architecture

The project is a monolithic full-stack Next.js application.

```text
Browser / User
   ↓
Next.js App Router pages
   ↓
Client components and forms
   ↓
Next.js API route handlers
   ↓
Prisma ORM
   ↓
PostgreSQL / Supabase
```

The frontend pages live under:

```text
src/app/admin
src/app/faculty
src/app/schedule
src/app/faculty-schedule
```

API endpoints live under:

```text
src/app/api
```

Reusable domain logic lives under:

```text
src/lib
src/hooks
src/components
```

Database modeling is maintained through:

```text
prisma/schema.prisma
```

---

## 5. Core Business Concepts

## 5.1 Academic Identity

Academic identity is managed through the `academic_catalog_entries` model and supporting academic setup pages. Each entry represents a controlled academic identity with:

- department code and name;
- program code and title;
- program type;
- study shift;
- curriculum version;
- curriculum key;
- student ID suffix;
- display label;
- active status.

This avoids manual inconsistent program naming and makes dropdown-based workflows possible.

## 5.2 Curriculum Key

The curriculum key separates a program identity from the actual curriculum course list. This supports both:

- unique curriculum identities, such as separate EEE REG NEW and EEE EVE NEW;
- shared curriculum identities, such as RAE REG OLD and RAE REG NEW where appropriate.

## 5.3 Batch Academic Intelligence

The system calculates batch academic status using:

- `batch_completed_courses` from transcript parsing;
- `batch_current_registrations` from registration parsing;
- `master_courses` as the curriculum source.

The batch-status result becomes:

```text
Completed + Ongoing + Remaining = Curriculum-aware batch status
```

## 5.4 Offering Lifecycle

The current lifecycle is:

```text
DRAFT
 → BUFFER_READY
 → FACULTY_CHOICE_BUFFER
 → FACULTY_CHOICE_FINALIZED
 → CONFIRMED
```

Operational meaning:

| Status | Meaning |
| --- | --- |
| `DRAFT` | Fully editable structural preparation stage. |
| `BUFFER_READY` | Pre-faculty structural buffer stage. |
| `FACULTY_CHOICE_BUFFER` | Faculty-visible stage where course choices may be saved/finalized. |
| `FACULTY_CHOICE_FINALIZED` | Faculty choice stage closed/finalized; reports can be checked. |
| `CONFIRMED` | Final locked schedule/offering. No further editing should be allowed. |

## 5.5 Final Assignment Source

The official faculty assignment source is:

```text
offered_course_teachers
```

This table drives:

- faculty load reports;
- public schedule;
- batch routine;
- room schedule;
- faculty-wise routine;
- final confirmed schedule.

## 5.6 Co-offering Model

The co-offering model uses a primary-secondary relationship between offered course sections.

Core rules:

- one primary section owns slots and faculty;
- secondary sections inherit the operational teaching event;
- secondary rows remain visible for academic/reporting identity;
- conflict detection should avoid false duplicate conflicts from secondary rows;
- batch attachment remains explicit through `offered_course_batches`.

---

## 6. Database Schema Overview

The current Prisma schema includes these models:

| Model | Description |
| --- | --- |
| academic_terms | Academic term master table used by imports, offerings, faculty selections, and reporting. |
| batch_completed_courses | Transcript-derived passed/completed course records for a batch. |
| batch_current_registrations | Registration-derived ongoing course records for a batch and term. |
| batches | Batch records under exact program identity; supports active/inactive and admission term. |
| departments | Department master table for programs and teachers. |
| master_courses | Master curriculum courses with course code, title, credit, type, level term, group, and curriculum key. |
| offered_course_batches | Many-to-many bridge between offered sections and one or more batches. |
| offered_course_slots | Day/time/room slots attached to offered sections. |
| offered_course_teachers | Official faculty assignment source for reports, load, and final schedule. |
| offered_courses | Offered section rows linked to master courses and offering headers; supports primary/secondary co-offering links. |
| offerings | Offering header table for program and academic term with lifecycle status. |
| faculty_course_selections | Faculty buffer/final/approved course-choice records with priority order. |
| programs | Canonical program records linked to departments, batches, courses, and offerings. |
| rooms | Room master table used for slot assignment and room conflict detection. |
| student_report_logs | Upload/report log for student transcript/registration processing. |
| teachers | Faculty master records with department, initial/code, designation, contact, seniority level, and active status. |
| users | Authentication/user account records with role and optional teacher linkage. |
| academic_catalog_entries | Controlled academic identity catalog for department/program/shift/curriculum labels. |
| SystemSetting | Key-value operational settings for faculty session, warning, active turn, and credit policy. |
| FacultyLoginSession | CamelCase faculty session model linked to users. |
| offered_course_manual_cooffers | Manual co-offering notes/links for courses not directly represented as a secondary offered section. |
| faculty_login_sessions | Snake-case faculty timed session table with warning and revocation tracking. |
| notifications | Faculty/admin notification records for turn status, warnings, and workflow messages. |

## 6.1 Important Database Design Rules

### Academic data

- `departments` → `programs` → `batches` and `master_courses`.
- `academic_catalog_entries` provides controlled academic identity metadata.
- `master_courses` includes `curriculum_key` and unique constraints for course-code ownership.

### Batch status data

- `batch_completed_courses` stores transcript-derived completed courses.
- `batch_current_registrations` stores registration-derived ongoing courses.
- Remaining courses are computed against the master curriculum.

### Offering data

- `offerings` is the header by program and academic term.
- `offered_courses` is the section-level course row.
- `offered_course_batches` attaches one section to one or more batches.
- `offered_course_slots` stores room/day/time.
- `offered_course_teachers` stores official faculty assignment.

### Faculty workflow

- `teachers` stores faculty profiles.
- `users.teacher_id` links faculty login accounts to faculty profiles.
- `faculty_course_selections` stores buffer/final/approved choice records.
- `faculty_login_sessions` and `FacultyLoginSession` represent session tracking. The presence of both naming styles should be reviewed before future schema cleanup.
- `SystemSetting` stores operational policy values.
- `notifications` stores dashboard/user notifications.

---

## 7. Role-Based Access Model

## 7.1 Roles

| Role | Intended scope |
| --- | --- |
| `SUPER_ADMIN` | Full access, reset, configuration, governance, and emergency control. |
| `COORDINATOR` | Academic setup, imports, offering preparation, co-offering, faculty approval, assignment, reporting. |
| `FACULTY` | Faculty dashboard, course choice, own load/routine visibility. |
| Public user | Public student routine and faculty schedule pages only. |

## 7.2 Guard Helpers

The `src/lib/auth-guard.ts` helper defines:

- `requireCoordinatorOrAdminApi()`
- `requireSuperAdminApi()`
- `requireFacultyApi()`
- `requireCoordinatorOrAdmin()`
- `requireSuperAdmin()`
- `requireFaculty()`

---

## 8. Folder Structure

Top-level project folders include:

```text
docs/
prisma/
public/
scripts/
src/
src/app/
src/app/admin/
src/app/api/
src/app/auth/
src/app/faculty/
src/app/faculty-schedule/
src/app/schedule/
src/components/
src/hooks/
src/lib/
src/types/
```

Important generated/local files in the project root include multiple development dumps, diagnostics, and workflow artifacts. These should generally stay out of Git unless intentionally documenting a checkpoint.

---

## 9. Admin Modules

| Route | Purpose |
| --- | --- |
| /admin/academic-setup | Define academic identities, program codes, curriculum version and keys. |
| /admin/master-course-import | Import Excel/DOCX curriculum course lists into master_courses. |
| /admin/imports | Upload transcript/registration PDFs and save batch academic status. |
| /admin/batch-status | Review completed, ongoing, remaining, and full course status by batch. |
| /admin/offering-template-import | Import prepared Excel offering templates into draft/offering workflow. |
| /admin/offering-drafts | Prepare draft sections, batches, slots, and offering lifecycle transitions. |
| /admin/co-offering-setup | Link existing draft/active sections as primary-secondary co-offered sections. |
| /admin/co-offering-decision-center | Advanced co-offering review, reset, manual link/unlink, and batch control. |
| /admin/faculty-choice-control | Control faculty choice window, session minutes, warning minutes, and credit policies. |
| /admin/faculty-course-choices | Review, approve, reopen, reset, and remove approved choice assignments. |
| /admin/faculty-assignment | Manual and bulk assignment board using offered_course_teachers. |
| /admin/schedule-control | Final schedule validation, editing, and confirmation control. |
| /admin/reports | Professional reporting dashboard and Excel exports. |
| /admin/system-reset | Operational/system reset utilities for controlled testing and maintenance. |

## 9.1 Full Admin Route Inventory

```text
/admin
/admin/academic-setup
/admin/academic-terms
/admin/batch-curriculum-assignment
/admin/batch-routine
/admin/batch-status
/admin/batch-status-cleanup
/admin/batches
/admin/co-offering-decision-center
/admin/co-offering-setup
/admin/confirmed-schedule
/admin/courses
/admin/faculties
/admin/faculty-assignment
/admin/faculty-choice-control
/admin/faculty-course-choices
/admin/faculty-dashboard
/admin/faculty-load
/admin/imports
/admin/manual-offering
/admin/manual-special-offering
/admin/master-course-import
/admin/offering-context
/admin/offering-drafts
/admin/offering-reports
/admin/offering-summary
/admin/offering-template-import
/admin/offering-validation
/admin/offerings
/admin/reports
/admin/room-schedule
/admin/rooms
/admin/schedule
/admin/schedule-control
/admin/semesters
/admin/system-reset
/admin/users
```

---

## 10. Faculty and Public Modules

## 10.1 Faculty Pages

```text
/faculty
/faculty/course-choice
/faculty/dashboard
```

Primary faculty workflow pages:

- `/faculty/dashboard`
- `/faculty/course-choice`

## 10.2 Public Pages

Public-facing routing includes:

- `/schedule`
- `/faculty-schedule`

The public routine should show student-facing schedule data after offerings become report-visible/finalized.

---

## 11. API Route Overview

## 11.1 API Route Categories


### Academic setup and catalog

```text
/api/academic-catalog/options
/api/academic-setup/manage
/api/academic-terms/delete
/api/academic-terms/list
/api/academic-terms/options
/api/batches/manage
/api/batches/manage/[id]
/api/departments/options
/api/program-batches
/api/program-batches/by-program-code
/api/program-batches/options
/api/programs/options
```

### Imports and batch status

```text
/api/batch-status
/api/batch-status/cleanup
/api/imports
/api/master-course-import
/api/master-course-import/repair-level-terms
/api/master-courses/delete
/api/offering-template-import/commit
/api/offering-template-import/preview
/api/offering-template-import/validate
/api/student-status-import
/api/student-status-save
```

### Offering drafts and context

```text
/api/offering-context
/api/offering-template-import/commit
/api/offering-template-import/preview
/api/offering-template-import/validate
/api/offering-workspace
/api/offerings
/api/offerings/[id]
/api/offerings/confirmed
/api/offerings/confirmed/[id]
/api/offerings/conflict-review
/api/offerings/drafts
/api/offerings/drafts/[id]
/api/offerings/drafts/[id]/publish
/api/offerings/drafts/add-course
/api/offerings/drafts/attach-batches
/api/offerings/drafts/batch-options
/api/offerings/drafts/context
/api/offerings/drafts/courses/[offeredCourseId]
/api/offerings/drafts/create
/api/offerings/drafts/link-course
/api/offerings/drafts/link-options
/api/offerings/drafts/manual-special
/api/offerings/drafts/slots/[slotId]
/api/offerings/drafts/slots/add
/api/offerings/save
/api/offerings/status-transition
```

### Co-offering

```text
/api/admin/co-offering-decision/candidates
/api/admin/co-offering-decision/course-batches/options
/api/admin/co-offering-decision/course-batches/update
/api/admin/co-offering-decision/link
/api/admin/co-offering-decision/manual-link
/api/admin/co-offering-decision/reset-confirmed
/api/admin/co-offering-decision/unlink
/api/co-offering/link
/api/co-offering/manual/add
/api/co-offering/manual/delete
/api/co-offering/options
/api/co-offering/unlink
```

### Faculty flow

```text
/api/admin/faculty-assignment/assign
/api/admin/faculty-assignment/bulk-assign
/api/admin/faculty-assignment/options
/api/admin/faculty-assignment/unassign
/api/admin/faculty-choice/close
/api/admin/faculty-choice/open
/api/admin/faculty-course-choices
/api/admin/faculty-course-choices/approve
/api/admin/faculty-course-choices/clear
/api/admin/faculty-course-choices/remove-approved-assignment
/api/admin/faculty-course-choices/reopen
/api/admin/faculty-course-choices/reset
/api/admin/faculty-turn-status
/api/faculty-dashboard
/api/faculty-load
/api/faculty/course-choices/finalize
/api/faculty/course-choices/options
/api/faculty/course-choices/save-buffer
/api/faculty/dashboard
/api/faculty/my-approved-assignment
/api/faculty/my-load-sheet
/api/faculty/notifications
/api/faculty/notifications/[id]/read
/api/faculty/notifications/clear
/api/faculty/session/create
/api/faculty/session/validate
/api/faculty/test-action
/api/public/faculty-schedule
```

### Reports and exports

```text
/api/admin/reports/batch-routine
/api/admin/reports/class-lab-schedule
/api/admin/reports/confirmed-offerings
/api/admin/reports/confirmed-schedule
/api/admin/reports/day-wise-routine
/api/admin/reports/faculty-load
/api/admin/reports/faculty-wise-routine
/api/admin/reports/offering-summary
/api/admin/reports/room-schedule
/api/export/batch-routine
/api/export/batch-wise-routine
/api/export/combined-routine
/api/export/confirmed-offering
/api/export/confirmed-schedule
/api/export/faculty-load
/api/export/faculty-load-combined
/api/export/faculty-load-taken
/api/export/faculty-routine
/api/export/faculty-wise-routine
/api/export/offered-courses
/api/export/offering-report
/api/export/offering-summary
/api/export/program-wise-routine
/api/export/room-schedule
/api/export/room-wise-schedule
/api/export/schedule
/api/faculty/my-approved-assignment/export
/api/faculty/my-load-sheet/export
/api/public/faculty-schedule
/api/public/schedule
/api/schedule-report
```

### System and auth

```text
/api/admin/co-offering-decision/reset-confirmed
/api/admin/faculty-course-choices/reset
/api/admin/reset-operational-data
/api/admin/reset-system
/api/admin/schedule-control/reset-confirmed
/api/auth/[...nextauth]
/api/auth/login
/api/auth/logout
/api/rooms
/api/rooms/[roomId]
/api/rooms/manage
/api/rooms/manage/[id]
/api/rooms/options
/api/system-settings
/api/system-settings/update
/api/users/manage
/api/users/manage/[id]
```


## 12. Important Library Modules

```text
src/lib/academic-catalog.ts
src/lib/auth-guard.ts
src/lib/auth-session.ts
src/lib/canonical-program.ts
src/lib/cooffering-display.ts
src/lib/course-list-import.ts
src/lib/course-schedule-policy.ts
src/lib/excel-export.ts
src/lib/faculty-access.ts
src/lib/faculty-action-guard.ts
src/lib/faculty-assignment-policy.ts
src/lib/faculty-notifications.ts
src/lib/faculty-session.ts
src/lib/faculty-turn.ts
src/lib/offering-conflicts.ts
src/lib/offering-context.ts
src/lib/offering-section-group.ts
src/lib/offering-status.ts
src/lib/offering-template-cooffer.ts
src/lib/offering-template-normalize.ts
src/lib/offering-template-parser.ts
src/lib/offering-template-program-resolver.ts
src/lib/prisma.ts
src/lib/report-visible-statuses.backup.ts
src/lib/report-visible-statuses.ts
src/lib/reporting-cache.ts
src/lib/reporting-data.ts
src/lib/reporting-excel.ts
src/lib/reporting/reporting-engine.ts
src/lib/schedule-conflict-scanner.ts
src/lib/semester-utils.ts
src/lib/student-id-profile.ts
src/lib/student-status-parser.ts
src/lib/system-settings.ts
```

Key helper responsibilities:

| Helper | Purpose |
| --- | --- |
| `src/lib/academic-catalog.ts` | Academic catalog identity utilities. |
| `src/lib/canonical-program.ts` | Canonical program resolution. |
| `src/lib/course-list-import.ts` | Master course list import support. |
| `src/lib/student-status-parser.ts` | Transcript/registration parsing support. |
| `src/lib/offering-context.ts` | Offering context and next-term intelligence. |
| `src/lib/offering-status.ts` | Lifecycle status constants and transition rules. |
| `src/lib/course-schedule-policy.ts` | Slot-optional courses and conflict-visible statuses. |
| `src/lib/offering-conflicts.ts` | Offering conflict logic. |
| `src/lib/schedule-conflict-scanner.ts` | Schedule conflict scanner. |
| `src/lib/offering-section-group.ts` | Co-offering / section-group helper logic. |
| `src/lib/faculty-session.ts` | Faculty timed session creation, warning, expiry, and revocation. |
| `src/lib/faculty-turn.ts` | Active faculty turn resolution. |
| `src/lib/faculty-access.ts` | Faculty edit/view permission logic. |
| `src/lib/faculty-notifications.ts` | Faculty notification creation and access. |
| `src/lib/faculty-assignment-policy.ts` | Assignment policy and load rules. |
| `src/lib/reporting-data.ts` | Shared reporting data preparation. |
| `src/lib/reporting-excel.ts` | Excel export preparation. |
| `src/lib/reporting-cache.ts` | Reporting cache support and invalidation. |
| `src/lib/reporting/reporting-engine.ts` | Professional report engine. |

---

## 13. End-to-End Admin / Coordinator Workflow

## Phase 0 — One-time System Setup

1. Log in as Super Admin or Coordinator.
2. Open `/admin/academic-setup`.
3. Create academic identities for departments/programs/curriculum versions.
4. Open `/admin/batches`.
5. Create or verify batch records.
6. Open `/admin/rooms`.
7. Create rooms and room types.
8. Open `/admin/faculties`.
9. Create faculty records, contact details, active status, and seniority level.
10. Open `/admin/users`.
11. Create faculty/coordinator accounts and link faculty users to teacher records.
12. Open `/admin/academic-terms`.
13. Create the operating academic term, such as `SUMMER 2026`.

## Phase 1 — Academic Data Import

1. Open `/admin/master-course-import`.
2. Import curriculum/master course list.
3. Open `/admin/imports`.
4. Upload transcript PDFs and registration PDFs.
5. Save parsed batch status.
6. Open `/admin/batch-status`.
7. Verify completed, ongoing, remaining, and full curriculum status.

## Phase 2 — Offering Preparation

1. Open `/admin/offering-context`.
2. Select program and batch.
3. Review suggested/remaining courses.
4. Open `/admin/offering-template-import` if using a prepared Excel offering sheet.
5. Preview and commit the template.
6. Open `/admin/offering-drafts`.
7. Review draft sections, batch links, slots, and preassigned faculty.
8. Use `/admin/manual-offering` for emergency/backlog/special course additions.

## Phase 3 — Co-offering

1. Ensure both primary and secondary offered sections already exist.
2. Open `/admin/co-offering-setup` or `/admin/co-offering-decision-center`.
3. Select the primary section.
4. Select the secondary section.
5. Link the secondary under the primary.
6. Verify that the primary owns slots/faculty and the secondary inherits the operational schedule.
7. Use batch control if secondary course requires explicit batch attachments.

## Phase 4 — Faculty Choice

1. Open `/admin/faculty-choice-control`.
2. Configure session minutes, warning minutes, choice window status, and credit policies.
3. Open the faculty choice window.
4. Move offerings to `FACULTY_CHOICE_BUFFER` as required.
5. Faculty users log in and submit buffer/final choices.
6. Admin reviews `/admin/faculty-course-choices`.
7. Approve final choices where needed.
8. Imported/preassigned faculty assignment rows do not need choice approval if already present in `offered_course_teachers`.

## Phase 5 — Assignment and Schedule Control

1. Open `/admin/faculty-assignment`.
2. Review assignment options and faculty load.
3. Apply manual or bulk assignments.
4. Open `/admin/schedule-control`.
5. Run final conflict validation.
6. Edit slots/faculty if still allowed by lifecycle.
7. Confirm final schedule only when all critical conflicts are resolved.
8. After `CONFIRMED`, no editing should be allowed.

## Phase 6 — Reporting and Publishing

1. Open `/admin/reports`.
2. Generate:
   - combined routine;
   - program-wise routine;
   - batch-wise routine;
   - class schedule;
   - lab schedule;
   - day-wise routine;
   - faculty-wise routine;
   - room-wise schedule;
   - faculty load report;
   - offering summary report.
3. Export Excel reports.
4. Verify public `/schedule` and `/faculty-schedule`.

---

## 14. End-to-End Faculty Workflow

1. Faculty logs in.
2. Faculty opens `/faculty/dashboard`.
3. Faculty reviews:
   - session status;
   - active turn;
   - notifications;
   - current load;
   - preassigned courses.
4. Faculty opens `/faculty/course-choice`.
5. Faculty can view the open offering pool once faculty choice is open.
6. Only the active faculty turn/session holder can save or finalize choices.
7. Faculty saves buffer choices if needed.
8. Faculty submits final choices.
9. If the faculty already has enough imported/preassigned load, they may submit final with zero extra choices.
10. Admin approves final choices when needed.
11. Final assignment appears through `offered_course_teachers`.
12. Faculty checks final routine/load after assignment/finalization.

---

## 15. Faculty Seniority and Session Rules

Current policy direction:

- Seniority level supports `1` to `20`.
- Level `1` is highest seniority.
- Level `20` is lowest seniority.
- All faculty may log in and view the open pool.
- Only the current active faculty session/turn can edit/save/finalize.
- If multiple faculty are logged in, the active turn is selected by:
  1. lowest seniority level number;
  2. earliest active session start;
  3. lowest teacher ID as stable fallback.
- Warning notification is sent before expiry using `FACULTY_WARNING_MINUTES`.
- Expired sessions are revoked.
- Next eligible faculty can become active after expiry, if auto-advance is enabled.

Important settings keys:

```text
FACULTY_SESSION_MINUTES
FACULTY_WARNING_MINUTES
FACULTY_CHOICE_WINDOW_STATUS
FACULTY_ACTIVE_SENIORITY_LEVEL
FACULTY_ACTIVE_TEACHER_ID
FACULTY_AUTO_ADVANCE_ON_EXPIRY
FACULTY_LEVEL_<N>_MIN_CREDITS
FACULTY_LEVEL_<N>_MAX_CREDITS
```

---

## 16. Conflict Detection Rules

Conflict detection must consider the following statuses:

```text
DRAFT
BUFFER_READY
FACULTY_CHOICE_BUFFER
FACULTY_CHOICE_FINALIZED
CONFIRMED
```

Conflict types:

| Conflict Type | Description |
| --- | --- |
| Room conflict | Same room used by overlapping section slots. |
| Batch conflict | Same batch attached to overlapping courses. |
| Faculty conflict | Same teacher assigned to overlapping slots. |
| Co-offering conflict | Primary/secondary linked sections must be evaluated as one operational teaching event. |
| Duplicate assignment | Same offered course/teacher assignment should not be duplicated. |

Slot-optional courses include:

- Project;
- Thesis;
- Internship;
- FYDP;
- Viva;
- explicitly configured codes such as `EEE4139`, `EEE4239`, `EEE4339`.

These do not require scheduled class/lab slots before finalization.

---

## 17. Reporting System

The reporting layer uses report-visible statuses:

```text
FACULTY_CHOICE_BUFFER
FACULTY_CHOICE_FINALIZED
CONFIRMED
```

Final report statuses are:

```text
FACULTY_CHOICE_FINALIZED
CONFIRMED
```

Reporting targets:

| Report | Purpose |
| --- | --- |
| Combined complete routine | All programs/batches in a term. |
| Program-wise routine | Filtered routine for one program. |
| Batch-wise routine | Student-facing batch routine. |
| Class schedule | Theory/class schedule. |
| Lab schedule | Lab/session schedule. |
| Day-wise routine | Organized by day and time. |
| Faculty-wise routine | Teacher schedule and workload view. |
| Room-wise schedule | Room utilization and conflict review. |
| Faculty load report | Combined load from official assignments. |
| Faculty load taken report | Load taken through faculty choice/approval. |
| Offering summary | Program/course/section/assignment overview. |

## 17.1 Official Assignment Source for Reports

Always use:

```text
offered_course_teachers
```

Include assignment/load types such as:

```text
IMPORTED
PREASSIGNED
APPROVED_CHOICE
MANUAL
OVERRIDE
ASSIGNED
```

---

## 18. Deployment Guide

## 18.1 Local Development

```powershell
cd D:\adust-course-offering-tool
npm install
npx prisma generate
npm run dev
```

## 18.2 Build

```powershell
cd D:\adust-course-offering-tool
npm run build
```

The build script runs:

```text
prisma generate && next build
```

## 18.3 Production Start

```powershell
npm run start
```

## 18.4 Seed / Bootstrap

Seed default admin:

```powershell
npm run seed
```

Additional bootstrap scripts exist:

```text
scripts/bootstrap-admin-user.js
scripts/force-reset-admin-user.js
```

Use these carefully and only when admin access needs repair.

---

## 19. Git Workflow

Current Git status from the uploaded dump:

```text
Branch: main
Remote: origin -> https://github.com/mazid07066/adust-course-offering-tool.git
Status: branch up to date with origin/main
```

Recent commits:

```text
98006f2 solved the save issue for multiple batch course attachment
32b7a04 Ignore local dump files
0187c99 remove local dump file from commit
89f653f Add co-offering batch control and public faculty schedule
a6eac58 added program identification message cards for faculty-schedule public page
52b2c14 new public profile for faculty members with updated footer with updated page content having the student schedule button
3afc229 new public profile for faculty members with updated footer
a960efd new public profile for faculty members
c1469c5 Co-offering reset from confirmed state is done with linking to RAE from EEE done
0a050f5 co-offering finalization, link and unlink solved, schedule finalization done
0b3ce61 Fix public schedule routine using offering program mapping
33a66f1 R6 production readiness and confirmed lock fixes
4602595 Harden schedule finalization and confirmed offering locks
30654cb Restore offering template import sidebar route
3dae34a Add reporting cache invalidation for offering mutations
e0ee3d2 Add professional reports dashboard UI
5f31dc1 Add centralized reporting APIs and print-ready Excel exports
f8650ab before package r1 reporting engine speed upgrade
5363fb7 before professional reporting and manual offering upgrade
028070a Allow schedule finalization during faculty choice stage
91f9465 Fix faculty load report to show all assigned faculty rows
ba5db56 Implement unified reporting system with program/batch filters and export support for confirmed schedule
feab567 Show finalized faculty schedules in reports before confirmed status
eb4c6ca Fix faculty choice reopen and approved choice removal
f82a3e2 Fix faculty turn save finalize and auto advance
3d9cd95 Finalize Summer 2026 faculty choice draft workflow
ebbe235 Finalize Summer 2026 faculty choice draft workflow
ffebfe2 Optimize offering template draft import for production timeout
bcd2464 Fix offering template import batch matching across canonical programs
ee898ca Refresh production environment
```

Recommended commit style:

```powershell
git status
git add .
git commit -m "Describe the stable checkpoint clearly"
git push origin main
```

Avoid committing dump files unless they are intentionally needed as documentation artifacts.

---

## 20. Testing Checklist

## 20.1 Setup Tests

- [ ] Admin login works.
- [ ] Academic setup saves academic identities.
- [ ] Departments/programs resolve correctly.
- [ ] Batches can be created and filtered.
- [ ] Faculty records can be created/edited.
- [ ] Faculty users are linked to teacher records.
- [ ] Rooms and academic terms exist.

## 20.2 Import Tests

- [ ] Master course import works for EEE/RAE.
- [ ] Duplicate-safe reimport works.
- [ ] Transcript import extracts completed courses.
- [ ] Registration import extracts ongoing courses.
- [ ] Batch status shows correct completed/ongoing/remaining.

## 20.3 Offering Tests

- [ ] Offering context loads remaining/suggested courses.
- [ ] Offering template preview works.
- [ ] Offering template commit creates draft/offering rows.
- [ ] Drafts show sections, batches, slots, and faculty.
- [ ] Manual course addition works.
- [ ] Project/FYDP courses can remain slotless.

## 20.4 Co-offering Tests

- [ ] Existing primary and secondary sections can be linked.
- [ ] Secondary inherits primary schedule/faculty behavior.
- [ ] Unlink works before final lock.
- [ ] Reset confirmed offering to editable works only when intended.
- [ ] Co-offering does not generate false duplicate conflicts.

## 20.5 Faculty Choice Tests

- [ ] Faculty choice window can open/close.
- [ ] Faculty session duration is enforced.
- [ ] Warning threshold works.
- [ ] Active faculty turn resolves by seniority/session.
- [ ] Non-active faculty can view but cannot edit.
- [ ] Buffer save works.
- [ ] Final submit works.
- [ ] Admin approval creates/keeps correct assignment rows.
- [ ] Reopen/reset/remove-approved-assignment tools behave correctly.

## 20.6 Finalization and Report Tests

- [ ] Schedule control detects conflicts.
- [ ] Room/batch/faculty conflicts are correctly reported.
- [ ] Final confirmation locks edits.
- [ ] Faculty load report uses `offered_course_teachers`.
- [ ] Batch routine is correct.
- [ ] Room schedule is correct.
- [ ] Faculty-wise routine is correct.
- [ ] Excel exports are printable and accurate.
- [ ] Public schedule page displays finalized/report-visible data.

---

## 21. Known Technical Notes and Risks

1. The Prisma schema includes both `FacultyLoginSession` and `faculty_login_sessions`. This may be intentional legacy compatibility, but it should be reviewed before future schema cleanup.
2. `src/lib/auth.ts` was listed as not present in the focused dump; actual auth logic appears to use `src/lib/auth-session.ts` and `src/lib/auth-guard.ts`.
3. Several root-level dump/debug files exist. They should remain ignored unless explicitly used for documentation.
4. Performance has been identified as a future phase. Heavy reporting joins should be monitored.
5. After `CONFIRMED`, all edit routes must consistently block structural edits, slot edits, assignment changes, and manual add/delete operations.
6. Co-offering logic should always evaluate primary operational sections rather than duplicating secondary conflict events.

---

## 22. Future Development Roadmap

## R8 — Performance Optimization

Goals:

- reduce slow API/page responses from 30–40 seconds to under 2–5 seconds;
- optimize Prisma queries;
- reduce N+1 patterns;
- add pagination/lazy loading;
- improve report caching;
- add database indexes where needed;
- keep Vercel serverless constraints in mind.

Priority APIs:

```text
/api/offering-context
/api/offerings/drafts/context
/api/admin/reports/*
/api/faculty/course-choices/options
```

## R9 — Advanced Scheduling Intelligence

Potential extensions:

- automatic room assignment;
- automatic day/time suggestion;
- faculty preference-based schedule optimization;
- class/lab separation intelligence;
- no-conflict schedule solver.

## R10 — Co-offering Decision Automation

Potential extensions:

- improved candidate scoring;
- similarity detection across program curricula;
- manual override audit trail;
- co-offering recommendation dashboard.

## R11 — Production Observability

Potential extensions:

- API timing logs;
- slow query logs;
- report generation timing;
- admin-visible diagnostics;
- error event dashboard.

## R12 — Institutional Expansion

Potential extensions:

- multi-department expansion;
- student login;
- course registration planning;
- mobile-friendly routine interface;
- PDF report exports;
- role-specific dashboards.

---

## 23. Developer Operating Rules

- Do not break existing working modules.
- Keep all file changes copy-paste ready.
- Prefer small checkpoints.
- Commit after each stable step.
- Always verify status lifecycle before allowing edits.
- Use `offered_course_teachers` as final assignment source.
- Treat project/FYDP/thesis/internship/viva as slot-optional.
- Use primary co-offered section as operational schedule owner.
- Keep reports based on report-visible statuses before final confirmation.
- Keep final confirmation locked.

---

## 24. Useful PowerShell Commands

## 24.1 Run development server

```powershell
cd D:\adust-course-offering-tool
npm run dev
```

## 24.2 Build check

```powershell
cd D:\adust-course-offering-tool
npm run build
```

## 24.3 Prisma generate

```powershell
cd D:\adust-course-offering-tool
npx prisma generate
```

## 24.4 Prisma Studio

```powershell
cd D:\adust-course-offering-tool
npx prisma studio
```

## 24.5 Git save checkpoint

```powershell
cd D:\adust-course-offering-tool
git status
git add .
git commit -m "Stable checkpoint message"
git push origin main
```

---

## 25. Continuation Prompt for Future Development

```text
I am continuing development of my production-deployed UniFlow Academic Planner system.

Project path:
D:\adust-course-offering-tool

Tech stack:
Next.js 16 App Router, React, TypeScript, Tailwind CSS, Prisma ORM, PostgreSQL/Supabase, Vercel, Windows PowerShell.

Current stable modules:
- Academic setup
- Master course import
- Batch setup and curriculum assignment
- Transcript and registration parsing
- Batch status
- Offering context
- Offering template import
- Draft offering workspace
- Co-offering setup and co-offering decision center
- Faculty management
- User management
- Faculty login/session system
- Faculty course choice system
- Seniority-based faculty turn control
- Faculty assignment board
- Manual course addition
- Conflict detection
- Schedule control and finalization
- Reporting dashboard and Excel exports
- Public routine and faculty schedule pages

Critical rules:
1. Final assignment source is offered_course_teachers.
2. Lifecycle is DRAFT -> BUFFER_READY -> FACULTY_CHOICE_BUFFER -> FACULTY_CHOICE_FINALIZED -> CONFIRMED.
3. After CONFIRMED, no edits are allowed.
4. Project/Thesis/Internship/FYDP/Viva courses are slot-optional.
5. Conflict checks must consider DRAFT, BUFFER_READY, FACULTY_CHOICE_BUFFER, FACULTY_CHOICE_FINALIZED, and CONFIRMED.
6. Co-offered secondary sections inherit primary section slots/faculty for operational schedule purposes.
7. Reports must use report-visible statuses and official assignment rows.

Next phase:
R8 performance optimization.
Start by analyzing and optimizing /api/admin/reports/*, /api/offering-context, /api/offerings/drafts/context, and /api/faculty/course-choices/options without breaking existing logic.
Always provide full copy-paste-ready files and exact paths.
```

---

## 26. Source Files Used for This Documentation

This documentation was prepared from the uploaded project dumps:

```text
project_full_dump_for_complete_md.txt
focused_architecture_workflow_dump_for_complete_md.txt
project_tree_dump.txt
env_structure_safe_dump.txt
git_project_history_dump.txt
```

