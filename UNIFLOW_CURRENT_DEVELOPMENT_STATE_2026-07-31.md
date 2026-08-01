# UniFlow / ADUST Course Offering Tool

## Complete Current Development State and Next-Stage Handoff

**Checkpoint date:** 31 July 2026  
**Project:** UniFlow / ADUST Course Offering Tool  
**Repository:** `mazid07066/adust-course-offering-tool`  
**Primary integration branch:** `main`  
**Active development branch:** `baete-accreditation-workspace`  
**Latest verified `main` commit:** `9d317518f66e337ee801c66b67eef5cca91b98a7`  
**Latest preserved BAETE branch commit:** `894a307e5df93df06aafdb5740276c1c0395b1de`  
**Current implementation checkpoint:** BAETE Phase 2-F-A completed in source; Phase 2-F-B is the next intended stage  
**Document purpose:** Preserve the verified implementation state, branch topology, architecture, completed work, known gaps, verification evidence, and safe continuation point.

---

## 1. Executive Summary

UniFlow is a Next.js and PostgreSQL university ERP application that began as an academic course-offering, faculty-assignment, scheduling, and reporting system. It has since expanded into student records, student authentication and portal access, exam scheduling, and a BAETE accreditation workspace.

The supplied review package preserves two materially different states:

1. The tracked-source ZIP contains `main` at commit `9d317518`, dated 5 June 2026.
2. The Git history bundle also contains the newer remote branch `baete-accreditation-workspace` at commit `894a307`, dated 26 June 2026.

The BAETE branch is seven commits ahead of `main` and contains the actual latest accreditation work. It adds approximately 9,664 lines across 44 changed files, including:

- BAETE database tables and seed/configuration SQL;
- accreditation dashboard and navigation;
- dynamic task groups and tasks;
- task assignment and progress history;
- evidence upload, download, and review;
- dynamic roadmap/Gantt functionality;
- committee, criterion, and task configuration;
- dashboard alerts and role-specific work queues;
- initial role-aware backend permission rules and access-audit logging.

The latest BAETE commit represents the implemented Phase 2-F-A backend role-access foundation. The next intended checkpoint is Phase 2-F-B. However, the architectural audit found an important security boundary that must be handled first within 2-F-B: several BAETE API routes still lack route-level authentication/authorization, and the current middleware does not cover `/api/admin/*`.

The project is therefore feature-rich and development-ready, but the BAETE branch should not be merged into `main` or treated as production-ready until the remaining API authorization coverage, role-aware frontend behavior, automated tests, lint failure, dependency vulnerabilities, and branch integration have been resolved.

---

## 2. Evidence Reviewed

This checkpoint was prepared from the following supplied artifacts:

| Artifact | Purpose | Result |
|---|---|---|
| `READ-ME-FIRST(1).txt` | Package identity and repository checkpoint | Confirmed package created from `main` at `9d317518` |
| `UniFlow-Tracked-Source(1).zip` | Tracked files at packaged `HEAD` | 432 source files extracted; represents `main`, not the newer BAETE branch |
| `UniFlow-All-Git-History(1).bundle` | Complete Git objects and preserved refs | Bundle valid; complete history; BAETE and S1-F branch tips preserved |
| `review-reports.rar` | Git, environment, validation, lint, and audit evidence | Reports extracted and reviewed |

### 2.1 Package integrity and secret-file checks

- Git bundle verification: passed.
- Git object integrity report: no errors recorded.
- Packaged `main` working tree: clean after restoration of generated `next-env.d.ts`.
- Tracked environment warning report: empty.
- Possible secret-file warning report: empty.
- Local `.env` files, `node_modules`, build output, and ignored files were not included.

These checks reduce the risk of obvious tracked secrets, but they are filename-pattern checks rather than a complete secret scan. A dedicated secret scanner should still be added before production release.

---

## 3. Repository and Branch Topology

### 3.1 Preserved branch tips

| Branch/ref | Commit | Date | Meaning |
|---|---|---:|---|
| `main` | `9d317518` | 5 Jun 2026 | Stable packaged baseline; exam schedule export and room-capacity work |
| `exam-scheduler-resume-after-offering-recovery` | `9d317518` | 5 Jun 2026 | Points to the same commit as `main` |
| `s1-f-student-registration-foundation` | `e8878b01` | 6 Jun 2026 | Separate student-registration development line |
| `baete-accreditation-workspace` | `894a307e` | 26 Jun 2026 | Latest BAETE development line and current continuation target |

### 3.2 Critical branch-state conclusion

The uploaded tracked-source ZIP must not be used alone to continue BAETE development because it does not contain the newer accreditation implementation. The correct continuation source is:

```text
origin/baete-accreditation-workspace
```

at:

```text
894a307e5df93df06aafdb5740276c1c0395b1de
```

### 3.3 BAETE commits after `main`

The BAETE branch is seven commits ahead of `main`:

| Commit | Date | Development result |
|---|---:|---|
| `631714f` | 25 Jun 2026 | BAETE accreditation workspace visual shell |
| `82b461e` | 25 Jun 2026 | Dynamic editable task foundation |
| `3e5d272` | 26 Jun 2026 | Evidence upload/review and dynamic Gantt workflow |
| `3ab5fa5` | 26 Jun 2026 | Admin configuration management |
| `f707e3d` | 26 Jun 2026 | Task editing, user assignment, and history |
| `a65d0fa` | 26 Jun 2026 | Dashboard alerts and work queues |
| `894a307` | 26 Jun 2026 | Role-specific backend access rules |

### 3.4 Branch integration warning

The S1-F student-registration branch and BAETE branch diverge from `main`. Neither includes the other branch’s later work. Before merging to `main`, integration must be deliberate:

1. preserve both remote branches;
2. create a new integration branch from the intended production baseline;
3. merge or cherry-pick one development line at a time;
4. resolve Prisma schema and shared component conflicts carefully;
5. run database, authentication, TypeScript, lint, build, and role-access regression tests;
6. only then merge into `main`.

Do not force-push or delete either branch before integration is complete.

---

## 4. Technology Stack

| Layer | Current implementation |
|---|---|
| Application framework | Next.js 16 App Router |
| UI | React 19, TypeScript, Tailwind CSS 4, Lucide React |
| Database access | Prisma ORM 6.19.2 |
| Database | PostgreSQL |
| Authentication | Custom session-token flow plus NextAuth dependency |
| Validation | Zod 4 |
| Forms | React Hook Form |
| Spreadsheet processing | ExcelJS and SheetJS/xlsx |
| Document/PDF processing | Mammoth, pdf-parse, pdf2json, pdfjs-dist, pdfreader |
| Deployment target | Vercel-oriented Next.js deployment |

### 4.1 Verified local toolchain

The supplied verification report records:

```text
Node.js:     v24.12.0
npm:         11.6.2
Prisma CLI:  6.19.2
Prisma Client: 6.19.2
TypeScript:  5.9.3
Platform:    Windows x64
```

### 4.2 NPM scripts

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

No dedicated automated test script is presently defined in `package.json`.

---

## 5. Application Scale at the BAETE Branch Tip

At `894a307e`:

| Metric | Count |
|---|---:|
| Tracked files | 474 |
| App Router pages (`page.tsx`) | 70 |
| API route files (`route.ts`) | 199 |
| BAETE commits ahead of `main` | 7 |
| Files changed from `main` to BAETE tip | 44 |
| Approximate BAETE additions | 9,664 lines |

The route counts include the pre-existing course-offering, faculty, student, schedule, report, import, and administration modules as well as the new BAETE routes.

---

## 6. Functional State Before the BAETE Expansion

The `main` history and checkpoint documents preserve the following previously completed or operational areas.

### 6.1 Academic foundation

- departments;
- programs;
- batches;
- academic terms;
- master courses;
- academic catalog entries;
- batch-curriculum assignment;
- course and room management;
- room capacity support.

### 6.2 Offering lifecycle

- course-offering creation and workspace;
- offering-template import, preview, validation, and commit;
- manual and special offerings;
- multi-batch offering attachment;
- co-offering link, unlink, setup, and decision center;
- draft offering workspace;
- offering status transitions;
- offering validation and conflict review;
- confirmed-offering locks and lifecycle safeguards.

### 6.3 Faculty workflow

- faculty management;
- faculty login sessions;
- faculty seniority/turn workflow;
- faculty course-choice control;
- course-choice submission and approval;
- assignment board;
- coordinator override;
- load summaries;
- notifications;
- faculty dashboard and approved-assignment views.

### 6.4 Scheduling

- schedule workspace;
- batch routines;
- faculty routines;
- room schedules;
- public schedules;
- confirmed schedules;
- exam scheduler;
- exam schedule export;
- room-capacity support.

### 6.5 Reporting and exports

- centralized offering reports;
- offering summary;
- confirmed offering/schedule reports;
- batch-, faculty-, room-, and program-wise routines;
- faculty load and combined load reports;
- Excel-oriented exports;
- report cache invalidation.

### 6.6 Student module checkpoints

The repository history includes:

- **S1-A:** Student core foundation;
- **S1-B:** Student bulk import, enrollment matching, rollback, and correction;
- **S1-C:** Student detail enhancement and portal preparation;
- **S1-D:** Student authentication and portal access control;
- **S1-E:** Student profile detail and account UX finalization.

The separate S1-F branch contains later student-registration foundation work and must be integrated separately.

---

## 7. Current Database Architecture

### 7.1 Core Prisma models on the packaged baseline

The baseline schema contains the following major model groups.

**Academic structure**

- `academic_terms`
- `departments`
- `programs`
- `batches`
- `master_courses`
- `academic_catalog_entries`
- `batch_completed_courses`
- `batch_current_registrations`

**Offering and scheduling**

- `offerings`
- `offered_courses`
- `offered_course_batches`
- `offered_course_slots`
- `offered_course_teachers`
- `offered_course_manual_cooffers`
- `rooms`

**Faculty and users**

- `teachers`
- `users`
- `FacultyLoginSession`
- `faculty_login_sessions`
- `faculty_course_selections`
- `notifications`
- `SystemSetting`

**Student records**

- `students`
- `student_program_enrollments`
- `student_contacts`
- `student_status_history`
- `student_advisor_assignments`
- `student_report_logs`
- `student_import_logs`
- `student_import_error_rows`
- `student_import_change_rows`

The coexistence of `FacultyLoginSession` and `faculty_login_sessions` should be reviewed. It may be intentional compatibility support, but duplicate-purpose session models increase maintenance and security risk.

### 7.2 BAETE models added on the active branch

The BAETE branch adds:

- `baete_roadmap_items`
- `baete_criteria`
- `baete_deficiency_rules`
- `baete_graduate_attributes`
- `baete_cqi_templates`
- `baete_audit_sessions`
- `baete_committees`
- `baete_workspace_modules`
- `baete_task_groups`
- `baete_tasks`
- `baete_task_updates`
- `baete_task_evidence`

The Phase 2-F SQL patch additionally creates:

- `baete_access_audit_logs`

and extends:

- `baete_committees` with head, reviewer, and supervisor user IDs;
- `baete_task_updates` with the updating user ID;
- `baete_task_evidence` with uploader, reviewer, and review timestamp data.

### 7.3 Database implementation approach

The BAETE work uses both:

1. Prisma model declarations; and
2. manually executed PostgreSQL patch files under `prisma/sql/`.

Preserved SQL patches:

```text
prisma/sql/baete_phase_2_a_editable_foundation_patch.sql
prisma/sql/baete_phase_2_b2_task_evidence_patch.sql
prisma/sql/baete_phase_2_f_role_access_patch.sql
```

This mixed approach is workable, but schema drift must be controlled. Every manual patch needs:

- an execution record;
- idempotency confirmation;
- a matching Prisma schema update where applicable;
- generated-client refresh;
- validation against a clean database;
- production rollout and rollback instructions.

### 7.4 Known Phase 2-F SQL execution history

The Phase 2-F patch initially produced a PostgreSQL syntax error near `ALTER`. The issue was later reported as solved, and development continued from Step 2 of 2-F. The corrected patch in the preserved branch contains separate `ALTER TABLE` statements and idempotent `IF NOT EXISTS`/constraint replacement operations.

Because the supplied reports do not contain a database introspection after patch execution, the following must still be independently verified in the target database:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name IN (
  'baete_committees',
  'baete_task_updates',
  'baete_task_evidence'
)
ORDER BY table_name, ordinal_position;
```

and:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'baete_access_audit_logs';
```

---

## 8. BAETE Accreditation Workspace: Implemented State

### 8.1 Visual and navigation shell

Implemented pages include:

- accreditation dashboard;
- analytics;
- committee board;
- roadmap;
- Gantt roadmap;
- my tasks;
- overdue tasks;
- review queue;
- settings;
- mock-audit entry;
- mock-audit scoring;
- deficiencies;
- CQI planning;
- report view.

The admin layout has been extended with BAETE accreditation navigation.

### 8.2 Dynamic task foundation

Implemented capabilities include:

- workspace modules;
- task groups;
- individual tasks;
- task codes and descriptions;
- deliverables and evidence requirements;
- priority;
- status;
- critical-task marker;
- completion state and note;
- committee assignment;
- user assignment;
- start/end month and week;
- due date;
- display order and active state.

### 8.3 Evidence workflow

Implemented source includes:

- evidence upload;
- evidence listing by task;
- evidence download;
- review status;
- reviewer feedback;
- reviewer identity;
- review timestamp;
- task evidence access checks on the guarded routes.

Before production, the upload subsystem must be tested for:

- permitted MIME types;
- file-extension validation;
- maximum file size;
- filename/path traversal;
- duplicate names;
- storage persistence on the deployment platform;
- authorization on download;
- malware scanning strategy;
- deletion and retention rules.

### 8.4 History and traceability

Task updates preserve:

- old and new status;
- old and new completion state;
- note;
- updating user ID;
- creation time.

Access denials can be written to `baete_access_audit_logs` with:

- user ID;
- action key;
- resource type and ID;
- allowed/denied value;
- reason;
- timestamp.

### 8.5 Gantt and work queues

Implemented source includes:

- dynamic Gantt chart;
- roadmap timing fields;
- dashboard alerts;
- personal/role-oriented work queue;
- overdue and review-oriented views.

### 8.6 Configuration management

The settings/configuration UI and APIs support management of:

- committees;
- criteria;
- task groups;
- tasks;
- related ordering and active-state fields.

This configuration surface is powerful and therefore must be protected by manager-only authorization on every mutation route.

---

## 9. Phase 2-F-A Role-Access Foundation

The latest BAETE commit adds `src/lib/baete-permissions.ts`, which establishes:

### 9.1 Recognized role categories

```text
SUPER_ADMIN
COORDINATOR
FACULTY
```

Role names are normalized to uppercase before comparison.

### 9.2 Access context

The access context includes:

- authenticated user;
- super-admin flag;
- coordinator flag;
- faculty flag;
- managed committee IDs;
- workspace-view permission;
- workspace-management permission;
- task-assignment permission;
- global evidence-review permission.

### 9.3 Committee authority

A user is considered a committee authority when assigned as:

- committee head;
- reviewer; or
- supervisor.

### 9.4 Task permissions

The preserved logic intends:

| Action | Super Admin | Coordinator | Assigned user | Committee authority | Unassigned faculty |
|---|---:|---:|---:|---:|---:|
| View BAETE workspace | Yes | Yes | Yes | Yes | Yes if role is `FACULTY` |
| Create task | Yes | Yes | No | No | No |
| Structurally manage/delete task | Yes | Yes | No | No | No |
| Update assigned task | Yes | Yes | Yes | Yes | No |
| Upload evidence | Yes | Yes | Yes | Yes | No |
| Review evidence | Yes | Yes | No | Yes | No |

### 9.5 Guarded BAETE API operations

The permission helper is currently used by:

- task collection GET and POST;
- task detail update and delete;
- task evidence GET and POST;
- evidence review;
- current-user permission endpoint.

This is a strong start but not complete route coverage.

---

## 10. Critical Access-Control Gap

### 10.1 Middleware scope

The current middleware matcher is:

```text
/admin/:path*
```

It checks for a `sessionToken` cookie before allowing admin pages.

It does **not** match:

```text
/api/admin/:path*
```

Therefore, API routes cannot rely on the middleware for protection.

### 10.2 BAETE routes without the new permission helper

At the BAETE branch tip, the following route groups do not reference `getSessionUser` or a `requireBaete...` helper:

- `/api/admin/accreditation/assignees`
- `/api/admin/accreditation/committees`
- `/api/admin/accreditation/committees/[id]`
- `/api/admin/accreditation/criteria`
- `/api/admin/accreditation/criteria/[id]`
- `/api/admin/accreditation/dashboard`
- `/api/admin/accreditation/evidence/[id]/download`
- `/api/admin/accreditation/task-groups`
- `/api/admin/accreditation/task-groups/[id]`
- `/api/admin/accreditation/tasks/[id]/history`
- `/api/admin/accreditation/work-queue`

This means sensitive reads and some configuration mutations may be reachable without the intended role check if the application is deployed in this exact state.

### 10.3 Required decision

Phase 2-F-A must be recorded as:

```text
Backend permission foundation implemented, but API coverage incomplete.
```

It must not be recorded as:

```text
All BAETE APIs fully secured.
```

### 10.4 Mandatory repair principle

Every BAETE route handler must explicitly call the appropriate guard:

- workspace read guard;
- manager/configuration guard;
- task-specific update guard;
- evidence view/upload/review guard;
- committee-scoped guard where appropriate.

UI hiding is not authorization. Backend enforcement is required even if a button is not visible.

---

## 11. Authentication Architecture Findings

The custom session flow reads a `sessionToken` cookie, retrieves a `faculty_login_sessions` record, rejects revoked or expired sessions, and loads an active `users` record.

Positive properties:

- revoked sessions are rejected;
- expired sessions are rejected;
- inactive users are rejected;
- role and linked teacher data are resolved server-side.

Items requiring hardening or confirmation:

- cookie flags: `HttpOnly`, `Secure`, and appropriate `SameSite`;
- token entropy and hashing at rest;
- CSRF protection for state-changing routes;
- session rotation at login or privilege change;
- logout invalidation;
- rate limits and lockout for authentication attempts;
- consistent use of the same session model;
- role constants or database constraints to avoid spelling drift;
- full `/api/admin/*` authorization coverage.

---

## 12. Verification Status

### 12.1 Verified from supplied reports

| Check | Result | Notes |
|---|---|---|
| Git working tree | Passed at package time | `main` clean after generated file restoration |
| Git bundle integrity | Passed | Complete history recorded |
| Prisma schema validation | Passed | Packaged `main` schema valid |
| TypeScript | Passed silently | No TypeScript output in verification report |
| Tracked environment warning | Passed | Empty warning report |
| Possible secret filename warning | Passed | Empty warning report |
| ESLint | Failed | Circular config serialization error |
| `npm audit` | Failed/risk reported | 19 vulnerabilities |

### 12.2 Build evidence limitation

A production build was reported as successful in the development conversation, with 213 routes/pages generated. The supplied verification file does not include the build output, and the supplied tracked-source ZIP is `main`, not the BAETE branch.

Therefore:

- the prior `main` build may be treated as reported successful;
- a fresh BAETE-branch production build remains mandatory;
- no claim should be made that commit `894a307` is build-verified from the supplied reports alone.

### 12.3 ESLint failure

The recorded failure is:

```text
TypeError: Converting circular structure to JSON
```

It arises while `FlatCompat` loads:

```text
next/core-web-vitals
next/typescript
```

under ESLint 9.39.4 and Next.js 16-era configuration.

This is a configuration compatibility failure, not a list of source-code lint violations. The lint configuration must be migrated to the native flat-config approach recommended for the installed Next.js version. After configuration repair, actual lint findings must be reviewed separately.

### 12.4 Dependency audit

The report records:

```text
19 vulnerabilities:
2 low
2 moderate
14 high
1 critical
```

Affected dependency areas include:

- Next.js;
- next-auth;
- xlsx;
- XML/PDF parsing transitive packages;
- Prisma configuration dependencies;
- PostCSS;
- Sharp;
- UUID/ExcelJS transitive dependencies;
- other build-time packages.

Do not run `npm audit fix --force` blindly. Some proposed fixes are breaking downgrades or major dependency changes. The correct approach is:

1. save the current lockfile;
2. classify production versus development exposure;
3. update direct dependencies intentionally;
4. replace packages with no safe release where necessary;
5. rerun TypeScript, lint, build, imports, exports, authentication, and file-processing tests;
6. compare the new lockfile and audit report before commit.

The `xlsx` package deserves special attention because the report states that no fix is available for the listed issues.

---

## 13. Documentation and Maintenance Findings

### 13.1 README is stale

The root `README.md` remains the default create-next-app document. It does not describe:

- UniFlow;
- environment configuration;
- database setup;
- authentication;
- Prisma/SQL patch execution;
- branch strategy;
- test procedure;
- deployment;
- BAETE development.

It must be replaced with a real project README before wider team development.

### 13.2 Project tracker is stale

`docs/PROJECT_TRACKER.md` still states:

```text
Current Phase: Phase A
Current Step: Step 1
Status: NOT STARTED
```

This conflicts with the extensive completed history. The tracker should be updated or retired in favor of checkpoint documents.

### 13.3 Repository contains many historical dump files

The tracked source includes numerous large diagnostic and code-dump text files, backup Prisma schemas, and historical artifacts. These helped recovery but increase:

- repository size;
- search noise;
- accidental reliance on stale code;
- risk of editing the wrong schema or dump.

They should be classified into:

- authoritative documentation;
- historical archive;
- removable local-only diagnostics;
- prohibited backup/secret artifacts.

No cleanup should occur until files are catalogued and the current branches are safely backed up.

### 13.4 Prisma backup schemas

Files such as:

```text
prisma/schema.prisma.bak
prisma/schema.current.before_fix.prisma
prisma/schema.3da.pending.prisma
prisma/schema.3da.pending.prisma.bak
```

must never be mistaken for the authoritative schema. Only:

```text
prisma/schema.prisma
```

should be used by normal Prisma commands.

---

## 14. Current Development Status by Checkpoint

| Checkpoint | Status | Verified interpretation |
|---|---|---|
| S0 ERP expansion architecture lock | Completed/documented | Preserved on `main` |
| S1-A student core foundation | Completed/documented | Preserved on `main` |
| S1-B bulk import and matching | Completed/documented | Preserved on `main` |
| S1-C detail and portal preparation | Completed/documented | Preserved on `main` |
| S1-D authentication and access | Completed/documented | Preserved on `main` |
| S1-E profile/account UX | Completed/documented | Preserved on `main` |
| S1-F registration foundation | Separate branch | Not integrated with BAETE branch or `main` |
| BAETE Phase 2-A | Implemented | Editable database foundation |
| BAETE Phase 2-B / 2-B2 | Implemented | Task/evidence foundation |
| BAETE Phase 2-C | Implemented by branch history | Evidence/Gantt workflow progression |
| BAETE Phase 2-D | Implemented by branch history | Admin configuration management |
| BAETE Phase 2-E | Implemented by branch history | Task assignment/history and dashboard queues |
| BAETE Phase 2-F-A | Implemented but incomplete security coverage | Role permission helper and selected route guards |
| BAETE Phase 2-F-B | **Next stage** | Complete security coverage and role-aware UX/tests |

---

## 15. Exact Next Development Stage: Phase 2-F-B

### 15.1 Objective

Complete the role-based access-control implementation across the entire BAETE workspace and prove it with role-matrix testing.

### 15.2 Required work order

#### Step 2-F-B.1 — Preserve and verify branch state

- fetch all branches and tags;
- confirm `baete-accreditation-workspace` points to `894a307` or a known descendant;
- confirm a clean working tree;
- create a checkpoint branch before changes;
- do not begin from the tracked-source ZIP’s `main`.

#### Step 2-F-B.2 — Complete backend authorization coverage

Add explicit access guards to every currently unguarded BAETE route:

- assignees;
- committee collection/detail;
- criterion collection/detail;
- dashboard;
- evidence download;
- task-group collection/detail;
- task history;
- work queue.

Use manager-only guards for configuration mutations. Use task/committee-specific guards for evidence, history, and scoped data.

#### Step 2-F-B.3 — Correct data filtering

Ensure non-manager users receive only records they are allowed to view:

- assigned tasks;
- committee-authorized tasks;
- authorized evidence;
- relevant work queues;
- no unrestricted assignee or configuration data unless required.

Authorization must restrict query results, not merely block mutations.

#### Step 2-F-B.4 — Build role-aware frontend behavior

The UI should request `/api/admin/accreditation/me/permissions` and respond to server-provided permissions.

Expected behavior:

- Super Admin and Coordinator see configuration, assignment, structural edit, and review controls.
- Assigned faculty see their permitted task update and evidence upload controls.
- Committee authority sees permitted committee/task review controls.
- Unauthorized controls are hidden or disabled with a clear explanation.
- A backend 401/403 is handled visibly and safely.

#### Step 2-F-B.5 — Strengthen route and page protection

- decide whether middleware should also match `/api/admin/:path*`;
- retain route-level guards even if middleware coverage is expanded;
- redirect unauthenticated page access;
- return JSON 401/403 for API access;
- do not redirect API clients to HTML login pages.

#### Step 2-F-B.6 — Verify database patch state

Confirm:

- committee role columns exist;
- evidence uploader/reviewer columns exist;
- task-update actor column exists;
- access-audit table exists;
- foreign keys and indexes exist;
- Prisma schema and database agree.

#### Step 2-F-B.7 — Add automated permission tests

At minimum, test:

1. anonymous user;
2. inactive user;
3. expired session;
4. revoked session;
5. Super Admin;
6. Coordinator;
7. assigned faculty;
8. unassigned faculty;
9. committee head;
10. committee reviewer;
11. committee supervisor;
12. user attempting cross-task evidence access;
13. unauthorized configuration mutation;
14. allowed and denied access-audit entries.

#### Step 2-F-B.8 — Run complete technical verification

Required commands after dependencies and environment are correctly configured:

```powershell
npx prisma validate
npx prisma generate
npx tsc --noEmit
npm run lint
npm run build
```

Also run all new authorization integration tests and manual browser tests for every role.

#### Step 2-F-B.9 — Commit and document

Create a dedicated completion checkpoint containing:

- changed files;
- final permission matrix;
- protected-route inventory;
- database verification output;
- test cases and results;
- TypeScript/lint/build results;
- screenshots if applicable;
- rollback instructions;
- next phase recommendation.

---

## 16. Mandatory Test Matrix for 2-F-B

| Scenario | Expected result |
|---|---|
| No session opens BAETE admin page | Redirect to login |
| No session calls BAETE API | JSON 401 |
| Faculty calls committee-create API | JSON 403 |
| Coordinator creates committee | Success |
| Unassigned faculty reads another task | Denied or omitted from result |
| Assigned faculty reads own task | Success |
| Assigned faculty updates progress | Success |
| Assigned faculty structurally deletes task | JSON 403 |
| Committee authority reads committee task | Success |
| Committee authority reviews relevant evidence | Success |
| Committee authority reviews unrelated evidence | JSON 403 |
| Coordinator reviews any evidence | Success |
| Unauthorized evidence download | JSON 403 |
| Authorized evidence download | Correct file and headers |
| Denied action | Audit row recorded |
| Allowed sensitive action, if required by policy | Audit behavior verified |
| Expired/revoked session | JSON 401 |
| Inactive user | JSON 401 |
| Hidden UI control called directly by HTTP client | Backend still denies |

---

## 17. Release Blockers

The following items block production release of the BAETE branch:

1. incomplete BAETE API authorization coverage;
2. no attached evidence of a successful build for the BAETE branch tip;
3. ESLint configuration failure;
4. 19 dependency vulnerabilities, including one critical;
5. no standard automated test script;
6. no comprehensive role-access integration suite;
7. database patch state not introspected in the supplied reports;
8. file-upload security and persistent-storage behavior not fully verified;
9. stale README and project tracker;
10. BAETE and S1-F branch integration not completed;
11. `main` does not yet contain the BAETE work.

---

## 18. Recommended Development Roadmap After 2-F-B

### Priority 1 — Security and correctness

- complete authorization coverage;
- add CSRF strategy;
- harden upload/download;
- repair lint configuration;
- remediate dependency risks;
- add automated regression tests.

### Priority 2 — Branch integration

- integrate BAETE and S1-F through a controlled integration branch;
- reconcile Prisma schema changes;
- verify all student, faculty, offering, schedule, and BAETE workflows;
- merge into `main` only after full validation.

### Priority 3 — BAETE operational completion

- finalize mock-audit persistence;
- scoring and criterion linkage;
- deficiency generation;
- CQI action tracking;
- audit reports and exports;
- notifications and deadline escalation;
- evidence versioning and retention.

### Priority 4 — Engineering maturity

- replace default README;
- update project tracker;
- add CI for Prisma validation, TypeScript, lint, tests, and build;
- add migration/deployment runbook;
- archive stale dump and backup files;
- add structured logging and monitoring;
- establish production backup and recovery testing.

---

## 19. Safe Continuation Procedure on the User’s Windows Repository

Run read-only checks first:

```powershell
Set-Location D:\adust-course-offering-tool

git status
git fetch --all --prune --tags
git branch -vv --all
git log origin/baete-accreditation-workspace -1 --date=iso --pretty=fuller
```

Expected BAETE tip from this checkpoint:

```text
894a307e5df93df06aafdb5740276c1c0395b1de
```

If the remote branch has a newer descendant, preserve and inspect it before continuing. If it still points to the checkpoint commit and the working tree is clean, create a dedicated continuation branch:

```powershell
git switch --create feature/baete-phase-2-f-b origin/baete-accreditation-workspace
```

Confirm:

```powershell
git status
git branch --show-current
git log -1 --oneline
```

Do not merge to `main`, run database mutations, or edit files until the exact branch and database target are confirmed.

---

## 20. Environment Variables to Preserve

The package intentionally excludes environment files. The project’s actual variable names must be confirmed from the source and deployment configuration before setup.

At minimum, the system requires database and authentication configuration appropriate to:

- Prisma `DATABASE_URL`;
- Prisma `DIRECT_URL` where the schema declares it;
- authentication/session secrets;
- deployment-specific application URL or host settings where used.

Rules:

- never commit `.env` or production secrets;
- keep `.env.example` with placeholders only;
- use separate development, staging, and production credentials;
- do not execute `prisma db push`, migrations, or SQL patches with placeholder URLs;
- back up production data before schema changes.

---

## 21. Source-of-Truth Rules for Future Work

Use this hierarchy:

1. current checked-out Git branch and commit;
2. `prisma/schema.prisma`;
3. applied database schema verified by introspection;
4. active source under `src/`;
5. current checkpoint Markdown;
6. historical dumps and `.bak` files only for recovery reference.

Never copy implementation back from a dump or backup file without comparing it to Git history and active source.

---

## 22. Final Handoff Statement

The current latest preserved development line is:

```text
Branch: baete-accreditation-workspace
Commit: 894a307e5df93df06aafdb5740276c1c0395b1de
Checkpoint: BAETE Phase 2-F-A backend permission foundation
Next stage: BAETE Phase 2-F-B
```

Phase 2-F-B should begin by completing route-level backend authorization for every BAETE API, then implementing role-aware frontend controls and a full role-matrix test suite.

The most important preservation fact is that the packaged `main` source at `9d317518` is older than the BAETE branch. Future development must not restart from that ZIP or merge blindly into `main`.

The most important engineering fact is that role-based security is only partially applied at the current branch tip. The unguarded BAETE APIs must be treated as a release blocker.

---

## 23. Checkpoint Acceptance Criteria

This document can be considered a complete current-state preservation checkpoint because it records:

- package and evidence sources;
- exact commit hashes;
- branch divergence;
- technology stack;
- core functional modules;
- student checkpoint history;
- BAETE implementation history;
- database models and SQL patches;
- role permission design;
- incomplete API authorization coverage;
- validation, lint, build-evidence, and audit status;
- release blockers;
- exact next stage;
- safe Windows continuation procedure;
- future development priorities.

**End of checkpoint.**
