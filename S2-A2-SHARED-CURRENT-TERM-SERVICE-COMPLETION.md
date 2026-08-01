# UniFlow S2-A2 Completion Record

## Checkpoint

**S2-A2 — Shared Current Academic-Term Service**

## Status

**COMPLETED AND VERIFIED**

## Completion Date

1 August 2026

## Objective

S2-A2 required UniFlow to use one shared service for resolving the current
academic term instead of duplicating current-term selection logic across
different API routes.

The checkpoint also required explicit detection of invalid academic-term
states and confirmation that the database prevents more than one academic
term from being marked as current.

## Verified Shared Service

The shared service is located at:

    src/lib/academic-term-context.ts

The following service functions were verified:

    resolveAcademicTermContext
    getCurrentAcademicTermContext

Service provenance:

    Commit:
    d1107008e929676aa0b0a9fbf3400d6e9782bc1d

    Commit message:
    feat: add current academic term context

## Verified Service Consumers

The shared service is consumed by:

    src/app/api/academic-terms/options/route.ts
    src/app/api/offerings/drafts/context/route.ts
    src/app/api/offerings/drafts/create/route.ts

These consumers cover:

- academic-term option retrieval;
- offering-draft context resolution;
- offering-draft creation.

## Verified Validation Behaviour

The shared service was confirmed to detect and report:

1. no current academic term configured;
2. more than one current academic term;
3. an invalid explicitly requested academic term.

Verified error identifiers include:

    CURRENT_ACADEMIC_TERM_NOT_CONFIGURED
    MULTIPLE_CURRENT_ACADEMIC_TERMS
    ACADEMIC_TERM_NOT_FOUND

## Database Safeguard

Database safeguard source:

    prisma/sql/s2_a1_academic_term_current_context.sql

Verified partial unique index:

    CREATE UNIQUE INDEX IF NOT EXISTS
        academic_terms_single_current_idx
    ON public.academic_terms ((is_current))
    WHERE is_current IS TRUE;

This index prevents more than one row in `public.academic_terms` from having
`is_current = true`.

The initially assumed index name
`academic_terms_one_current_term_uidx` was not the repository's actual index
name.

The actual verified index is:

    academic_terms_single_current_idx

No corrective migration was required.

## Final Verification Baseline

Final verification was performed against:

    Branch:
    feature/s2-a2-shared-current-term-service

    Verified baseline commit:
    d7b7ab5dcaa0fe85fa35dfa78522a9200e4defc5

## Verification Results

| Verification | Result |
|---|---|
| Shared current-term service | Passed |
| Service provenance | Passed |
| Academic-term option consumer | Passed |
| Draft-context consumer | Passed |
| Draft-creation consumer | Passed |
| No-current-term detection | Passed |
| Multiple-current-term detection | Passed |
| Invalid explicit-term detection | Passed |
| Database uniqueness safeguard | Passed |
| Prisma schema validation | Passed |
| TypeScript checking | Passed |
| ESLint | Passed with warnings only |
| Production build | Passed |
| Repository cleanliness | Passed |

## ESLint Observation

ESLint completed with:

    Errors: 0
    Warnings: 35

The warnings were non-blocking and were not introduced or modified as part of
S2-A2.

They remain separate technical-debt items and should not be mixed into this
checkpoint.

## Production Build

The Next.js production build completed successfully.

The build generated the application routes and returned exit code `0`.

## Repository and Database Safety

During final technical verification:

    Source changes: NONE
    Database changes: NONE
    Migration performed: NONE
    Commit performed: NONE
    Push performed: NONE
    Repository status: CLEAN

The completion-document commit is therefore a documentation-only closure
commit created after successful technical verification.

## Final Outcome

S2-A2 is complete.

UniFlow now has a verified shared current-academic-term resolution layer used
by the required offering-workflow consumers.

The service detects invalid academic-term configurations and is backed by a
database-level uniqueness safeguard.

The project may proceed to S2-A3 after this completion record is safely
committed, pushed, and integrated into the main branch.
