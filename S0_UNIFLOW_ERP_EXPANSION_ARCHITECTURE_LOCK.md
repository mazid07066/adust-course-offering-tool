# S0 — UniFlow ERP Expansion Architecture Lock

**Project:** UniFlow Academic Planner  
**Expansion Target:** University Academic ERP Platform  
**Checkpoint:** S0 — Architecture Lock Before S1 Student Core Foundation  
**Prepared For:** Continuation of UniFlow development in the next project chat thread  
**Primary Goal:** Freeze the modular architecture, data boundaries, permissions, lifecycles, migration strategy, and phased roadmap before adding student-facing ERP modules.

---

## 1. Executive Decision

UniFlow Academic Planner should now expand from a university **course offering, faculty assignment, co-offering, scheduling, and reporting system** into a broader **academic operations ERP**.

The current UniFlow core must remain the **academic offering engine**. It should not be rewritten or merged into student registration, billing, attendance, grade submission, or result-processing modules.

The expansion should be built as new modules that consume the already finalized offering data.

### Locked Source-of-Truth Rule

```text
Confirmed offering + offered_course_teachers + offered_course_slots + offered_course_batches
= source of truth for what can be registered, attended, graded, billed, and printed.
```

This means:

- Student registration must consume confirmed offered sections.
- Attendance rosters must come from registered students under offered sections.
- Grade sheets must come from registered students under offered sections.
- Admit cards must depend on confirmed registration, payment, and eligibility.
- Student routines must consume registered courses and finalized slots.
- Reports must keep using official assignment rows from `offered_course_teachers`.

---

## 2. Current UniFlow Core Status

The existing UniFlow system already has strong operational foundations:

- Academic setup
- Master course import
- Batch setup and curriculum assignment
- Transcript parsing
- Registration parsing
- Batch status generation
- Offering context engine
- Offering template import
- Draft offering workspace
- Co-offering setup
- Faculty management
- User management
- Faculty login/session system
- Faculty course choice system
- Seniority-based active faculty turn system
- Admin approval of final faculty choices
- Faculty assignment board
- Manual course addition
- Conflict detection engine
- Confirmed schedule reporting
- Batch routine reporting
- Room schedule reporting
- Faculty load reporting
- Excel/CSV export foundations
- Public routine publishing

### Current Core Lifecycle

```text
DRAFT
→ BUFFER_READY
→ FACULTY_CHOICE_BUFFER
→ FACULTY_CHOICE_FINALIZED
→ CONFIRMED
```

### Current Core Rules to Preserve

```text
1. offered_course_teachers is the final assignment source.
2. Primary co-offered sections own slots and faculty.
3. Secondary co-offered sections inherit schedule/faculty visibility.
4. Secondary co-offered rows must not generate duplicate conflicts.
5. Project/thesis/internship/FYDP-style courses may be slot-optional.
6. After CONFIRMED, structural edits must be blocked unless an explicit reset/reopen workflow is used.
7. Conflict checking must consider all active/pre-final/final offering statuses.
```

---

## 3. Why S0 Is Necessary

The new screenshots represent much more than small UI pages. They introduce several new university operation lifecycles:

- Student information lifecycle
- Semester declaration lifecycle
- Course registration/add-drop lifecycle
- Billing/payment lifecycle
- Admit-card and exam eligibility lifecycle
- Attendance lifecycle
- Grade submission lifecycle
- Result publication lifecycle
- Advisor approval lifecycle
- Audit, OTP, and notification lifecycle

Without an architecture lock, the project could become a single overloaded route and schema collection. S0 prevents that by defining the module boundaries before code implementation begins.

---

## 4. Legacy Feature Mapping From Screenshots

| Legacy Screenshot Area | Required UniFlow ERP Module | Current UniFlow Support | New Required Work |
|---|---|---|---|
| Student Dashboard | Student Portal | Not built | Add student core, profile, academic info, student dashboard |
| Student Academic Info | Student Core | Batch-level data exists | Add student master and enrollment records |
| Syllabus | Curriculum Portal | Master courses exist | Add student-facing curriculum/syllabus page |
| Bill and Payment | Billing | Not built | Add fee setup, bills, payments, defaulter status |
| Process | Workflow Dashboard | Not built | Add status/process dashboard |
| Print Result | Result Processing | Not built | Add result records and publication |
| Print Class Routine | Student Routine | Admin/public routine exists | Add student-specific routine from registration |
| Create Pay Slip | Billing | Not built | Add bill generation and pay slip export |
| Print Semester Fees | Billing | Not built | Add semester fee structures and printable bills |
| Admit Card | Exam Control | Not built | Add eligibility and admit-card generation |
| Semester Declaration | Registration | Not built | Add semester declaration before registration |
| Course Registration | Registration/Add-Drop | Offerings exist | Add student course registration consuming confirmed offerings |
| Seat / Enrolled Count | Registration Seats | Room capacity exists | Add seat capacity and enrolled count per offered section |
| Remaining Failed Courses | Retake Logic | Batch-level remaining exists | Add student-wise failed/retake/improvement logic |
| Attendance PDF/Excel | Attendance | Faculty assignment exists | Add attendance sessions, records, exports |
| Exam Sheet PDF/Excel | Exam / Attendance | Not built | Add exam-sheet generation from registered roster |
| Grade Sheet PDF | Grade Submission | Not built | Add grade sheet and PDF/Excel export |
| Grade Submission | Grade Module | Not built | Add marks, buffer, OTP/final lock, audit |
| Advisor | Advisor Workflow | Not built | Add advisor assignment and approval dashboard |
| Book Search | Library Integration | Not built | Later library/catalog integration |
| Std-AtoZ | Student Search | Not built | Add full student A-to-Z record view |

---

## 5. Locked Module Boundary Design

The project must expand as modules around the UniFlow core.

```text
src/modules/academic
src/modules/offering
src/modules/registration
src/modules/billing
src/modules/attendance
src/modules/exam
src/modules/grade
src/modules/result
src/modules/advisor
src/modules/student
src/modules/reporting
src/modules/notification
src/modules/audit
src/modules/shared
```

### 5.1 Academic Module

Owns:

- departments
- programs
- academic catalog
- curriculum keys
- academic terms
- master courses
- batches
- batch curriculum assignment

Must not own:

- student registered course rows
- grades
- bills
- payments

### 5.2 Offering Module

Owns:

- offerings
- offered courses
- offered course batches
- offered course slots
- offered course teachers
- co-offering links
- faculty assignment
- schedule conflict checking
- final offering confirmation

Must not own:

- student add/drop choices
- attendance records
- marks
- payment records

### 5.3 Student Module

Owns:

- student master profile
- student enrollment identity
- guardians/contacts
- status history
- student dashboard
- student A-to-Z search

Consumes:

- academic catalog
- programs
- batches
- terms

### 5.4 Registration Module

Owns:

- semester declaration
- student semester registration
- student registered courses
- add/drop request records
- registration locks
- seat count snapshots

Consumes:

- confirmed offered courses
- offered course slots
- offered course teachers
- student enrollment
- billing/payment status
- advisor approval rules

### 5.5 Billing Module

Owns:

- fee heads
- semester fee structures
- bill records
- bill items
- payments
- reconciliations
- defaulter flags
- pay slips

Consumes:

- registered courses
- student profile
- academic terms

### 5.6 Attendance Module

Owns:

- attendance sessions
- attendance records
- attendance locks
- attendance exports

Consumes:

- student registered courses
- offered sections
- assigned teachers

### 5.7 Exam Module

Owns:

- exam terms
- exam types
- exam schedules
- student exam eligibility
- admit cards
- admit card print logs

Consumes:

- registration status
- payment status
- attendance percentage
- student profile

### 5.8 Grade Module

Owns:

- assessment schemes
- assessment components
- grade submission sheets
- grade marks
- grade locks
- grade OTPs
- grade change requests

Consumes:

- registered course roster
- attendance records
- offered courses
- assigned faculty

### 5.9 Result Module

Owns:

- final results
- semester GPA/CGPA records
- result publication controls
- result print logs
- transcript preparation foundations

Consumes:

- locked grade submissions
- student enrollments
- master courses

### 5.10 Advisor Module

Owns:

- advisor assignments
- advising notes
- advisor approvals
- semester declaration approvals
- registration review queue

Consumes:

- students
- registrations
- defaulter flags
- academic progress

### 5.11 Notification Module

Owns:

- notification records
- read/unread state
- event types
- recipient routing

Used by:

- registration approval
- billing alerts
- admit-card status
- faculty choice windows
- grade OTP and lock alerts
- advisor queue updates

### 5.12 Audit Module

Owns:

- audit logs for sensitive changes
- old/new payload snapshots
- actor metadata
- request context

Mandatory for:

- registration approval/reopen
- billing/payment edits
- grade edits/final confirmation
- admit-card generation
- lock/unlock operations
- destructive admin operations

---

## 6. API Boundary Lock

Keep operational APIs separate from reporting/export APIs.

```text
/api/academic/*
/api/offering/*
/api/registration/*
/api/billing/*
/api/attendance/*
/api/exam/*
/api/grades/*
/api/results/*
/api/advisor/*
/api/students/*
/api/notifications/*
/api/audit/*
/api/reports/*
/api/exports/*
```

### API Rules

```text
1. Operational APIs must be optimized for transactional correctness.
2. Reporting APIs must be optimized separately and may use aggregation/caching.
3. Export APIs must never mutate data.
4. Grade, billing, and registration APIs must write audit logs.
5. Student registration APIs must not create offered courses.
6. Attendance and grade APIs must derive rosters from registered courses.
```

---

## 7. Expanded Database ERD Plan

This is a logical ERD lock. Actual Prisma models should be implemented phase-by-phase.

### 7.1 Existing Core Tables to Keep

```text
academic_terms
departments
programs
academic_catalog_entries
master_courses
batches
batch_completed_courses
batch_current_registrations
offerings
offered_courses
offered_course_batches
offered_course_slots
offered_course_teachers
offered_course_manual_cooffers
rooms
teachers
users
faculty_course_selections
faculty_login_sessions
notifications
SystemSetting
student_report_logs
```

### 7.2 Student Core Tables

```text
students
student_program_enrollments
student_guardians
student_contacts
student_advisor_assignments
student_status_history
```

#### students

Purpose: store permanent student identity.

Suggested fields:

```text
id
student_id unique
full_name
gender nullable
date_of_birth nullable
phone nullable
email nullable
photo_url nullable
national_id nullable
passport_no nullable
created_at
updated_at
```

#### student_program_enrollments

Purpose: link a student to academic identity, program, batch, curriculum, shift, and active status.

Suggested fields:

```text
id
student_id_fk
program_id
batch_id
academic_catalog_entry_id nullable
admission_term_id nullable
student_id_suffix nullable
academic_year nullable
major nullable
enrollment_status ACTIVE/DROPPED/GRADUATED/TRANSFERRED/SUSPENDED
is_current boolean
created_at
updated_at
```

#### student_guardians

```text
id
student_id_fk
guardian_name
relationship
phone
email nullable
address nullable
is_primary boolean
```

#### student_contacts

```text
id
student_id_fk
address_type PRESENT/PERMANENT/EMERGENCY
address_text
phone nullable
email nullable
```

#### student_advisor_assignments

```text
id
student_id_fk
teacher_id
program_id nullable
batch_id nullable
assigned_from_term_id nullable
assigned_to_term_id nullable
is_active
created_by_user_id
created_at
```

#### student_status_history

```text
id
student_id_fk
old_status nullable
new_status
reason nullable
term_id nullable
changed_by_user_id
created_at
```

### 7.3 Registration Tables

```text
student_semester_declarations
student_semester_registrations
student_registered_courses
student_add_drop_requests
student_registration_locks
course_seat_snapshots
```

#### student_semester_declarations

```text
id
student_id_fk
academic_term_id
status DRAFT/SUBMITTED/APPROVED/REJECTED/CANCELLED
submitted_at nullable
approved_by_user_id nullable
approved_at nullable
notes nullable
created_at
updated_at
```

#### student_semester_registrations

```text
id
student_id_fk
academic_term_id
program_id
batch_id
status DRAFT/SUBMITTED/ADVISOR_APPROVED/ACCOUNTS_CLEARED/REGISTERED/LOCKED/CANCELLED
registered_credit_total
added_credit_total
dropped_credit_total
advisor_approved_by_user_id nullable
accounts_cleared_by_user_id nullable
finalized_by_user_id nullable
submitted_at nullable
finalized_at nullable
created_at
updated_at
```

#### student_registered_courses

```text
id
student_semester_registration_id
offered_course_id
registration_action ADD/DROP/REGULAR/RETAKE/IMPROVEMENT/BACKLOG
status BUFFER/SUBMITTED/APPROVED/REGISTERED/DROPPED/CANCELLED
credit
is_retake boolean
is_improvement boolean
is_backlog boolean
created_at
updated_at
```

#### student_add_drop_requests

```text
id
student_semester_registration_id
requested_by_user_id
request_type ADD/DROP/SWAP
from_offered_course_id nullable
to_offered_course_id nullable
status PENDING/ADVISOR_APPROVED/COORDINATOR_APPROVED/REJECTED/APPLIED/CANCELLED
reason nullable
reviewed_by_user_id nullable
reviewed_at nullable
created_at
updated_at
```

#### student_registration_locks

```text
id
student_id_fk
academic_term_id
lock_type PAYMENT/ADVISOR/REGISTRAR/DISCIPLINARY/EXAM
reason
is_active
created_by_user_id
released_by_user_id nullable
released_at nullable
created_at
```

#### course_seat_snapshots

```text
id
offered_course_id
academic_term_id
seat_capacity
enrolled_count
reserved_count
available_count
snapshot_at
```

### 7.4 Billing Tables

```text
fee_heads
semester_fee_structures
student_bills
student_bill_items
student_payments
student_payment_reconciliations
student_defaulter_flags
pay_slip_print_logs
```

#### fee_heads

```text
id
code unique
name
fee_type TUITION/LAB/REGISTRATION/EXAM/LIBRARY/OTHER
is_active
created_at
updated_at
```

#### semester_fee_structures

```text
id
academic_term_id
program_id nullable
fee_head_id
amount
calculation_type FIXED/PER_CREDIT/PER_COURSE/PER_LAB
is_active
created_at
updated_at
```

#### student_bills

```text
id
student_id_fk
academic_term_id
student_semester_registration_id nullable
bill_no unique
status GENERATED/PARTIAL_PAID/PAID/RECONCILED/CANCELLED/BLOCKED
total_amount
paid_amount
due_amount
generated_by_user_id
generated_at
updated_at
```

#### student_bill_items

```text
id
student_bill_id
fee_head_id
description
quantity
unit_amount
total_amount
```

#### student_payments

```text
id
student_bill_id
payment_ref nullable
payment_method CASH/BANK/MOBILE/ONLINE/ADJUSTMENT
amount
paid_at
received_by_user_id nullable
notes nullable
created_at
```

#### student_payment_reconciliations

```text
id
student_payment_id
status PENDING/RECONCILED/REJECTED
reconciled_by_user_id nullable
reconciled_at nullable
notes nullable
```

#### student_defaulter_flags

```text
id
student_id_fk
academic_term_id
student_bill_id nullable
is_defaulter
reason nullable
created_by_user_id nullable
cleared_by_user_id nullable
cleared_at nullable
created_at
```

#### pay_slip_print_logs

```text
id
student_bill_id
printed_by_user_id nullable
printed_at
print_context STUDENT/ADMIN/ACCOUNTS
```

### 7.5 Attendance Tables

```text
attendance_sessions
attendance_records
attendance_locks
attendance_exports
```

#### attendance_sessions

```text
id
offered_course_id
academic_term_id
class_date
slot_id nullable
session_no nullable
topic nullable
status OPEN/SUBMITTED/LOCKED/REOPENED
created_by_teacher_id nullable
created_by_user_id
created_at
updated_at
```

#### attendance_records

```text
id
attendance_session_id
student_registered_course_id
student_id_fk
status PRESENT/ABSENT/LATE/EXCUSED
marked_by_user_id
marked_at
remarks nullable
```

#### attendance_locks

```text
id
offered_course_id
academic_term_id
locked_by_user_id
locked_at
reason nullable
is_active
```

#### attendance_exports

```text
id
offered_course_id
academic_term_id
export_type CLASS_ATTENDANCE_PDF/EXAM_SHEET_PDF/EXAM_SHEET_EXCEL/GRADE_SHEET_PDF
exported_by_user_id
exported_at
file_path nullable
```

### 7.6 Exam and Admit Card Tables

```text
exam_terms
exam_types
exam_schedules
student_exam_eligibility
student_admit_cards
admit_card_print_logs
```

#### exam_terms

```text
id
academic_term_id
name
status DRAFT/OPEN/CLOSED/PUBLISHED
created_at
updated_at
```

#### exam_types

```text
id
code MIDTERM/FINAL/QUIZ/LAB_FINAL/OTHER
name
is_active
```

#### exam_schedules

```text
id
exam_term_id
exam_type_id
offered_course_id
exam_date
start_time
end_time
room_id nullable
created_by_user_id
created_at
updated_at
```

#### student_exam_eligibility

```text
id
student_id_fk
student_registered_course_id
exam_type_id
is_eligible
eligibility_status ELIGIBLE/BLOCKED_PAYMENT/BLOCKED_ATTENDANCE/BLOCKED_REGISTRATION/BLOCKED_OTHER
reason nullable
computed_at
computed_by_user_id nullable
```

#### student_admit_cards

```text
id
student_id_fk
academic_term_id
exam_type_id
admit_card_no unique
status GENERATED/PRINTED/CANCELLED/BLOCKED
generated_by_user_id
generated_at
cancelled_by_user_id nullable
cancelled_at nullable
```

#### admit_card_print_logs

```text
id
student_admit_card_id
printed_by_user_id nullable
printed_at
print_context STUDENT/ADMIN/EXAM_CONTROLLER
```

### 7.7 Grade Tables

```text
assessment_schemes
assessment_components
grade_submission_sheets
grade_marks
grade_submission_locks
grade_submission_otps
grade_change_requests
```

#### assessment_schemes

```text
id
program_id nullable
course_type nullable
academic_term_id nullable
name
is_default
created_at
updated_at
```

#### assessment_components

```text
id
assessment_scheme_id
component_code ATT/ASSI/CT/PRES/ORAL/MID1/MID2/FINAL
component_name
max_marks
sort_order
is_required
allows_absent_marker
```

#### grade_submission_sheets

```text
id
offered_course_id
academic_term_id
teacher_id nullable
status DRAFT/BUFFER_SAVED/OTP_SENT/CONFIRMED/LOCKED/PUBLISHED/REOPENED
buffer_saved_at nullable
otp_sent_at nullable
confirmed_at nullable
locked_at nullable
submitted_by_user_id nullable
confirmed_by_user_id nullable
created_at
updated_at
```

#### grade_marks

```text
id
grade_submission_sheet_id
student_registered_course_id
student_id_fk
assessment_component_id
mark_value nullable
absent_marker boolean
generated_total nullable
generated_grade nullable
updated_by_user_id
updated_at
```

#### grade_submission_locks

```text
id
grade_submission_sheet_id
lock_reason
locked_by_user_id
locked_at
unlocked_by_user_id nullable
unlocked_at nullable
is_active
```

#### grade_submission_otps

```text
id
grade_submission_sheet_id
otp_hash
sent_to
channel SMS/EMAIL
expires_at
used_at nullable
created_at
```

#### grade_change_requests

```text
id
grade_submission_sheet_id
student_id_fk
requested_by_user_id
reason
status PENDING/APPROVED/REJECTED/APPLIED
old_payload_json
new_payload_json
reviewed_by_user_id nullable
reviewed_at nullable
created_at
updated_at
```

### 7.8 Result Tables

```text
final_results
semester_result_summaries
result_publication_logs
transcript_generation_logs
```

#### final_results

```text
id
student_id_fk
student_registered_course_id
academic_term_id
course_code
course_title
credit
final_mark nullable
letter_grade
grade_point
status PASSED/FAILED/WITHHELD/INCOMPLETE
published_at nullable
created_at
updated_at
```

#### semester_result_summaries

```text
id
student_id_fk
academic_term_id
semester_credit_attempted
semester_credit_earned
semester_gpa
cumulative_credit_attempted
cumulative_credit_earned
cgpa
status DRAFT/PUBLISHED/WITHHELD
computed_at
published_at nullable
```

#### result_publication_logs

```text
id
academic_term_id
published_by_user_id
published_at
scope PROGRAM/BATCH/STUDENT/ALL
scope_value nullable
notes nullable
```

#### transcript_generation_logs

```text
id
student_id_fk
generated_by_user_id nullable
generated_at
context STUDENT/ADMIN/REGISTRAR
file_path nullable
```

### 7.9 Notification, OTP, and Audit Tables

Existing `notifications` may be reused and extended.

#### audit_logs

```text
id
actor_user_id nullable
actor_role
module_name
action_type
target_table nullable
target_id nullable
old_payload_json nullable
new_payload_json nullable
ip_address nullable
user_agent nullable
created_at
```

#### otp_requests

```text
id
recipient_user_id nullable
recipient_student_id nullable
recipient_phone nullable
recipient_email nullable
purpose GRADE_CONFIRMATION/REGISTRATION_CONFIRMATION/PAYMENT_VERIFICATION/LOGIN
otp_hash
channel SMS/EMAIL
expires_at
used_at nullable
created_at
```

#### document_generation_logs

```text
id
module_name
document_type
reference_id
file_path nullable
generated_by_user_id nullable
generated_at
```

---

## 8. Relationship Map

```text
students
  └── student_program_enrollments
        ├── programs
        ├── batches
        └── academic_catalog_entries

students
  └── student_semester_registrations
        ├── academic_terms
        ├── student_registered_courses
        │     └── offered_courses
        │           ├── offered_course_slots
        │           ├── offered_course_teachers
        │           └── offered_course_batches
        └── student_bills

student_registered_courses
  ├── attendance_records
  ├── grade_marks
  ├── final_results
  └── student_exam_eligibility

student_bills
  ├── student_bill_items
  ├── student_payments
  └── student_defaulter_flags

grade_submission_sheets
  ├── grade_marks
  ├── grade_submission_otps
  ├── grade_submission_locks
  └── grade_change_requests

student_admit_cards
  └── admit_card_print_logs
```

---

## 9. Lifecycle Matrix

### 9.1 Offering Lifecycle

```text
DRAFT
→ BUFFER_READY
→ FACULTY_CHOICE_BUFFER
→ FACULTY_CHOICE_FINALIZED
→ CONFIRMED
```

| State | Meaning | Edit Allowed | Used By New ERP Modules |
|---|---|---:|---|
| DRAFT | Coordinator preparation | Yes | No |
| BUFFER_READY | Structurally ready | Limited | No |
| FACULTY_CHOICE_BUFFER | Faculty choices open | Limited | No |
| FACULTY_CHOICE_FINALIZED | Faculty choice closed | Limited/Admin only | Possible read-only |
| CONFIRMED | Final official offering | No | Yes |

### 9.2 Semester Declaration Lifecycle

```text
DRAFT → SUBMITTED → APPROVED → REJECTED/CANCELLED
```

| State | Meaning |
|---|---|
| DRAFT | Student prepared declaration but did not submit |
| SUBMITTED | Student declared semester intention |
| APPROVED | Advisor/coordinator accepted declaration |
| REJECTED | Declaration rejected |
| CANCELLED | Declaration withdrawn |

### 9.3 Registration Lifecycle

```text
DRAFT
→ SUBMITTED
→ ADVISOR_APPROVED
→ ACCOUNTS_CLEARED
→ REGISTERED
→ LOCKED
```

| State | Meaning | Actor |
|---|---|---|
| DRAFT | Student/admin selected courses into buffer | Student/Admin |
| SUBMITTED | Student submitted registration | Student |
| ADVISOR_APPROVED | Advisor approved academic validity | Advisor |
| ACCOUNTS_CLEARED | Accounts verified payment/dues | Accounts |
| REGISTERED | Courses officially registered | Registrar/Admin |
| LOCKED | No further edit without reopen | Registrar/Admin |

### 9.4 Billing Lifecycle

```text
GENERATED → PARTIAL_PAID → PAID → RECONCILED → BLOCKED/CANCELLED
```

| State | Meaning |
|---|---|
| GENERATED | Bill created |
| PARTIAL_PAID | Some payment received |
| PAID | Bill fully paid |
| RECONCILED | Accounts verified payment |
| BLOCKED | Payment issue or hold |
| CANCELLED | Bill voided |

### 9.5 Attendance Lifecycle

```text
OPEN → SUBMITTED → LOCKED → REOPENED
```

| State | Meaning |
|---|---|
| OPEN | Faculty can mark attendance |
| SUBMITTED | Faculty submitted attendance |
| LOCKED | Attendance no longer editable |
| REOPENED | Admin reopened for correction |

### 9.6 Grade Lifecycle

```text
DRAFT → BUFFER_SAVED → OTP_SENT → CONFIRMED → LOCKED → PUBLISHED
```

| State | Meaning |
|---|---|
| DRAFT | Sheet created, marks may be empty |
| BUFFER_SAVED | Marks saved but not final |
| OTP_SENT | OTP issued for final confirmation |
| CONFIRMED | Faculty confirmed marks |
| LOCKED | Controller/admin locked sheet |
| PUBLISHED | Result visible to student |

### 9.7 Result Lifecycle

```text
DRAFT → PUBLISHED → WITHHELD/REVISED
```

| State | Meaning |
|---|---|
| DRAFT | Result calculated but not public |
| PUBLISHED | Student can view/print |
| WITHHELD | Result blocked due to issue |
| REVISED | Result updated after correction |

### 9.8 Admit Card Lifecycle

```text
GENERATED → PRINTED → BLOCKED/CANCELLED
```

| State | Meaning |
|---|---|
| GENERATED | Admit card available |
| PRINTED | Printed by student/admin |
| BLOCKED | Ineligible due to payment/attendance/registration issue |
| CANCELLED | Voided by exam authority |

---

## 10. Permission Matrix

| Module / Action | SUPER_ADMIN | COORDINATOR | FACULTY | ADVISOR | STUDENT | ACCOUNTS | EXAM_CONTROLLER | REGISTRAR | PUBLIC |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Academic setup | Full | Limited/View | No | No | No | No | No | Limited/View | No |
| Master course import | Full | Full | No | No | No | No | No | View | No |
| Batch setup | Full | Full | No | View | No | No | No | Full | No |
| Offering preparation | Full | Full | View | View | No | No | No | View | No |
| Co-offering setup | Full | Full | No | No | No | No | No | View | No |
| Faculty choice | Override | Monitor/Approve | Own actions | No | No | No | No | View | No |
| Faculty assignment | Full | Full | View own | View | No | No | No | View | No |
| Student profile | Full | View/Edit limited | View enrolled only | View assigned | Own profile | View billing fields | View exam fields | Full | No |
| Student search | Full | Full | Limited | Assigned only | No | Limited | Limited | Full | No |
| Semester declaration | Full | Approve/Monitor | No | Approve assigned | Submit own | View payment-related | No | Monitor | No |
| Course registration | Full | Full | View class roster | Approve assigned | Submit own | Hold/release payment block | No | Lock/finalize | No |
| Add/drop | Full | Full | View roster | Approve assigned | Request own | Payment check | No | Finalize | No |
| Billing setup | Full | No | No | No | No | Full | No | View | No |
| Bill generation | Full | Limited/View | No | No | Own bill view | Full | No | View | No |
| Payment entry | Full | No | No | No | No | Full | No | View | No |
| Defaulter flag | Full | View | No | View assigned | Own status | Full | View | View | No |
| Attendance marking | Full | Monitor/Reopen | Own assigned courses | View assigned | Own view | No | View | View | No |
| Attendance lock | Full | Reopen request | Submit | View | No | No | Full/Lock | View | No |
| Exam schedule | Full | View | View own | View | Own view | No | Full | View | Public limited |
| Admit card generation | Full | View | No | View assigned | Own eligible | Payment block info | Full | Full | No |
| Grade entry | Full/Reopen | Monitor | Own assigned courses | No | No | No | Lock/Publish | View | No |
| Grade confirmation OTP | Full reset | Monitor | Own confirmation | No | No | No | Full | View | No |
| Result publication | Full | View | View own courses | View assigned | Own result | Payment hold info | Full | Full | No |
| Reports | Full | Full | Own scope | Assigned scope | Own scope | Billing reports | Exam/grade reports | Full | Public routine only |
| Audit logs | Full | Limited | No | No | No | Limited billing | Limited exam/grade | Limited | No |
| System reset | Full | No | No | No | No | No | No | No | No |

---

## 11. Migration Safety Plan

### 11.1 Non-Negotiable Migration Rules

```text
1. Do not rename existing production tables unless absolutely necessary.
2. Do not remove existing fields in the first ERP expansion phase.
3. Add new nullable fields first, then backfill, then enforce constraints later.
4. Use additive migrations for S1–S3.
5. Do not overload batch_current_registrations for official student course registration.
6. Do not overload faculty_course_selections for student registration or grade submission.
7. Do not mutate confirmed offering data during student registration.
8. Add indexes before high-volume usage.
9. Keep rollback notes for every schema change.
```

### 11.2 Migration Order

```text
S1-A: Add student core tables only.
S1-B: Add student import/search/dashboard APIs.
S1-C: Backfill student profiles from existing transcript/registration logs where possible.
S2-A: Add semester declaration and registration tables.
S2-B: Add registered course tables and seat snapshots.
S3-A: Add billing base tables.
S4-A: Add attendance tables.
S5-A: Add grade tables.
S6-A: Add exam/admit card tables.
S7-A: Add result tables.
```

### 11.3 Environment Commands Pattern

For local development:

```powershell
cd D:\adust-course-offering-tool
npx prisma format
npx prisma generate
npx prisma db push
npm run build
npm run dev
```

For production:

```powershell
cd D:\adust-course-offering-tool
git status
git add .
git commit -m "Add S1 student core foundation"
git push origin main
```

Use `prisma db push` only when the user has confirmed the schema change for the checkpoint. Use migrations later when production schema discipline is finalized.

---

## 12. Validation and Guardrail Rules

### 12.1 Registration Validation

```text
- Student must have an active enrollment.
- Offering must be CONFIRMED before official registration.
- Student cannot register the same offered course twice.
- Student cannot exceed maximum credit limit.
- Student routine must not clash unless override is granted.
- Seat capacity must be respected unless override is granted.
- Payment/defaulter lock may block final registration.
- Advisor approval may be required before finalization.
```

### 12.2 Billing Validation

```text
- Bill must be generated from the registration snapshot.
- Manual billing edits require audit logs.
- Payment reconciliation must be separate from payment entry.
- Defaulter flag should affect registration/admit-card eligibility.
```

### 12.3 Attendance Validation

```text
- Attendance roster must come from REGISTERED student courses.
- Faculty can mark only assigned offered courses.
- Locked attendance requires admin/exam-controller reopen.
- Attendance exports must write document_generation_logs.
```

### 12.4 Grade Validation

```text
- Grade roster must come from REGISTERED student courses.
- Faculty can enter marks only for assigned sections.
- Marks must obey assessment component limits.
- Absent marker A must be supported where allowed.
- Buffer save must not publish result.
- OTP confirmation must lock final submission stage.
- Every grade change after confirmation must use grade_change_requests.
```

### 12.5 Result Validation

```text
- Result must come only from locked/confirmed grade sheets.
- Result publication must be term/program/batch/student scoped.
- Withheld result must be supported.
- Transcript generation must be logged.
```

---

## 13. Reporting Strategy

Separate operational pages from reporting/export pages.

### 13.1 Operational Reports

```text
- Student academic dashboard
- Student registration summary
- Advisor approval queue
- Accounts due list
- Attendance status by course
- Grade submission pending list
- Admit-card eligibility list
```

### 13.2 Export Reports

```text
- Student profile summary
- Class routine by student
- Course registration slip
- Pay slip
- Semester fee statement
- Attendance sheet PDF
- Exam sheet Excel/PDF
- Grade sheet PDF/Excel
- Admit card PDF
- Result sheet
- Transcript-style academic record
```

### 13.3 Performance Rules

```text
- Use pagination for student lists.
- Use term/program/batch filters before loading rows.
- Never load all students globally by default.
- Use select instead of deep include for list pages.
- Cache read-only catalog/options data.
- Heavy exports should be route-isolated.
```

---

## 14. S1 — Student Core Foundation Specification

S1 is the next checkpoint after S0.

### 14.1 S1 Goal

Create the student foundation required for all ERP modules.

S1 must not implement registration, billing, attendance, grade submission, or result publication yet. It only creates the student identity layer and basic dashboard/search foundation.

### 14.2 S1 Deliverables

```text
1. Add Prisma models:
   - students
   - student_program_enrollments
   - student_guardians
   - student_contacts
   - student_advisor_assignments
   - student_status_history

2. Add backend helpers:
   - student ID normalization
   - student enrollment resolver
   - student search filters
   - student academic profile formatter

3. Add APIs:
   - GET /api/students/search
   - GET /api/students/[studentId]
   - POST /api/students/upsert
   - POST /api/students/[studentId]/enrollment
   - POST /api/students/[studentId]/advisor

4. Add admin pages:
   - /admin/students
   - /admin/students/[studentId]

5. Add student dashboard placeholder:
   - /student/dashboard

6. Add role foundation:
   - STUDENT
   - ADVISOR
   - ACCOUNTS
   - EXAM_CONTROLLER
   - REGISTRAR

7. Add seed/backfill plan:
   - create student records from parsed/imported transcript and registration logs where available
```

### 14.3 S1 Must Preserve

```text
- Existing offering workflow
- Existing faculty workflow
- Existing reporting pages
- Existing public routine
- Existing academic setup
- Existing batch status import/save
```

### 14.4 S1 Must Avoid

```text
- No billing implementation yet
- No grade implementation yet
- No attendance implementation yet
- No official registration implementation yet
- No destructive schema changes
```

---

## 15. S1 Implementation Order

### S1-A — Schema Addition

Add only student core models and role support.

### S1-B — Student Search and Profile API

Create search and profile endpoints.

### S1-C — Admin Student List and Detail Pages

Create admin interface to view/search/upsert students.

### S1-D — Enrollment and Advisor Assignment

Allow linking student to program, batch, curriculum, and advisor.

### S1-E — Student Dashboard Placeholder

Show profile, program, batch, advisor, and current academic status.

### S1-F — Backfill/Import Helper

Create optional script/API to derive students from existing parsed student IDs.

### S1-G — Git Checkpoint and Regression Test

Run:

```powershell
cd D:\adust-course-offering-tool
npm run build
git status
git add .
git commit -m "Add S1 student core foundation"
git push origin main
```

---

## 16. S1 Acceptance Checklist

```text
[ ] Existing admin login still works.
[ ] Existing faculty login still works.
[ ] Existing offering pages still load.
[ ] Existing reports still load.
[ ] Prisma generate succeeds.
[ ] Build succeeds.
[ ] /admin/students loads.
[ ] Admin can search by student ID.
[ ] Admin can create/update a student profile.
[ ] Admin can link student to program and batch.
[ ] Admin can assign advisor.
[ ] /student/dashboard loads for a student-linked user.
[ ] No existing tables are renamed or removed.
[ ] No official course registration logic is mixed into S1.
```

---

## 17. Continuation Prompt for Next Chat Thread

Copy and paste the following into the next project chat to begin S1.

```text
I am continuing development of my Next.js + Prisma + PostgreSQL university academic system named UniFlow Academic Planner.

Project path:
D:\adust-course-offering-tool

Tech stack:
Next.js 16 App Router, React, TypeScript, Tailwind CSS, Prisma ORM, PostgreSQL/Supabase, Vercel deployment, Windows PowerShell.

Current core system:
- Academic setup
- Master course import
- Batch setup and curriculum assignment
- Transcript and registration parsing
- Batch status
- Offering context
- Offering template import
- Draft offerings
- Co-offering setup
- Faculty management
- User management
- Faculty login/session system
- Faculty choice and approval workflow
- Seniority-based active faculty turn system
- Faculty assignment board
- Manual course addition
- Conflict detection
- Schedule/report/export system
- Public routine publishing

Critical existing rules:
1. offered_course_teachers is the final faculty assignment source.
2. Confirmed offering + offered_course_teachers + offered_course_slots + offered_course_batches are the source of truth for registration, attendance, grading, billing, and printing.
3. Offering lifecycle is DRAFT → BUFFER_READY → FACULTY_CHOICE_BUFFER → FACULTY_CHOICE_FINALIZED → CONFIRMED.
4. Do not rewrite existing UniFlow offering core.
5. Add ERP modules around the current offering core.
6. Do not overload batch_current_registrations or faculty_course_selections for new student registration or grade modules.
7. Preserve all working modules and avoid destructive schema changes.

S0 architecture lock has been completed. The next checkpoint is:

S1 — Student Core Foundation

S1 goal:
Create the student identity and enrollment foundation required for later registration, billing, attendance, grade, result, advisor, and admit-card modules.

S1 deliverables:
1. Add Prisma models:
   - students
   - student_program_enrollments
   - student_guardians
   - student_contacts
   - student_advisor_assignments
   - student_status_history
2. Add student helper functions:
   - student ID normalization
   - enrollment resolver
   - student search filters
   - academic profile formatter
3. Add APIs:
   - GET /api/students/search
   - GET /api/students/[studentId]
   - POST /api/students/upsert
   - POST /api/students/[studentId]/enrollment
   - POST /api/students/[studentId]/advisor
4. Add admin pages:
   - /admin/students
   - /admin/students/[studentId]
5. Add student dashboard placeholder:
   - /student/dashboard
6. Add role foundation for:
   - STUDENT
   - ADVISOR
   - ACCOUNTS
   - EXAM_CONTROLLER
   - REGISTRAR
7. Add optional backfill helper to derive student records from existing imported transcript/registration data.

S1 must NOT implement billing, official course registration, attendance, grade submission, admit cards, or result publication yet.

Instruction:
Provide full copy-paste-ready code, exact file paths, schema changes, commands, and tests. Proceed as S1-A, S1-B, S1-C, etc. After each package, wait for confirmation before continuing.

Start with S1-A — Schema Addition and Student Core Model Foundation.
```

---

## 18. S0 Final Decision Summary

S0 is now locked with the following decisions:

```text
1. UniFlow will expand into an academic ERP.
2. Existing offering core remains unchanged and authoritative.
3. New ERP modules are added around the offering core.
4. Student core must come before registration, billing, attendance, grade, exam, and result modules.
5. New modules must use strict lifecycles.
6. Sensitive modules require audit logs.
7. Roles must expand beyond admin/coordinator/faculty.
8. S1 begins with student identity and enrollment foundation only.
```

---

## 19. Recommended File Name

Save this file as:

```text
S0_UNIFLOW_ERP_EXPANSION_ARCHITECTURE_LOCK.md
```

Place it in the project root or docs folder:

```text
D:\adust-course-offering-tool\S0_UNIFLOW_ERP_EXPANSION_ARCHITECTURE_LOCK.md
```

or

```text
D:\adust-course-offering-tool\docs\S0_UNIFLOW_ERP_EXPANSION_ARCHITECTURE_LOCK.md
```

---

## 20. Recommended Git Checkpoint

After placing the file in the project:

```powershell
cd D:\adust-course-offering-tool
git status
git add S0_UNIFLOW_ERP_EXPANSION_ARCHITECTURE_LOCK.md
git commit -m "Add S0 ERP expansion architecture lock"
git push origin main
```
