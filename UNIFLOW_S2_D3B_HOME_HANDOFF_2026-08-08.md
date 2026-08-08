# UniFlow S2-D3B Home Handoff

Date: 2026-08-08

Project:
D:\adust-course-offering-tool

Branch:
feature/s2-a3c-semester-archive-foundation

Immediate priority:
Continue FALL 2026 offering preparation.
Do not continue student login or student registration work now.

Current FALL 2026 database state:

Academic term:
ID 4 = FALL 2026
Current = true

Draft offerings:

Offering 22
Program 1
CANON-EEE-EVE-BSCEEE
Status DRAFT
Offered courses 0

Offering 23
Program 2
CANON-EEE-REG-BSCEEE
Status DRAFT
Offered courses 0

Offering 24
Program 3
CANON-RAE-REG-BSCRAE
Status DRAFT
Offered courses 0

Faculty selections:
0

EEE Evening batch 232:
Batch ID 12
NO_OFFERING_PASSING_OUT for FALL 2026

Critical curriculum mapping discovered:

EEE Evening:
Offering program = 1
Batch program = 1
Master-course program = 6
Program 6 contains 97 active master courses

EEE Regular:
Offering program = 2
Batch program = 2
Master-course program = 7
Program 7 contains 102 active master courses

RAE Regular:
Offering program = 3
Batch program = 3
Master-course program = 3
Program 3 contains 68 active master courses

Do NOT combine RAE program 3 and program 4 master courses because program 4 contains a mirrored duplicate 68-course curriculum.

Next checkpoint:
S2-D3C

Goal of S2-D3C:
Build a read-only family-aware candidate resolver using:

EEE Evening:
canonicalProgramId 1
curriculumProgramId 6
offeringId 22

EEE Regular:
canonicalProgramId 2
curriculumProgramId 7
offeringId 23

RAE:
canonicalProgramId 3
curriculumProgramId 3
offeringId 24

Rules:
- load batches from canonical program
- load master courses from curriculum program
- classify COMPLETED / ONGOING / REMAINING
- exact normalized course code OR exact normalized title
- no fuzzy matching
- respect FALL 2026 batch-term exclusions
- do not automatically offer all REMAINING courses
- do not write offered courses until candidate resolution is verified

Development rules:
- never switch to main
- never merge
- never rewrite history
- never use prisma db push
- stop on errors
- preserve unrelated functionality
- provide full copy-paste-ready files whenever a file is changed