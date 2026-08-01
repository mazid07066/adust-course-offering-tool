-- =============================================================================
-- UniFlow S2-A1
-- Academic Term Current-Context Foundation
--
-- Purpose:
--   1. Preserve every existing academic term and all dependent records.
--   2. Add an explicit is_current lifecycle field.
--   3. Create FALL 2026 when it does not already exist.
--   4. Make FALL 2026 the single current academic term.
--   5. Prevent more than one current term at database level.
--
-- Safety:
--   - No academic term is deleted.
--   - No foreign-key value is changed.
--   - No Summer 2026 offering or faculty selection is changed.
--   - The script is transactional and rerunnable.
-- =============================================================================

BEGIN;

-- Prevent simultaneous executions of this specific lifecycle patch.
SELECT pg_advisory_xact_lock(
    hashtext('uniflow_s2_a1_academic_term_current_context')
);

-- Confirm that the required table exists before changing anything.
DO $$
BEGIN
    IF to_regclass('public.academic_terms') IS NULL THEN
        RAISE EXCEPTION
            'S2-A1 aborted: public.academic_terms does not exist.';
    END IF;
END;
$$;

-- Add the current-term marker.
--
-- Existing rows receive FALSE. Future rows also default to FALSE.
ALTER TABLE public.academic_terms
ADD COLUMN IF NOT EXISTS is_current boolean NOT NULL DEFAULT false;

-- Keep this migration rerunnable even if an earlier manual database change
-- created the column without the required default or NOT NULL constraint.
UPDATE public.academic_terms
SET is_current = false
WHERE is_current IS NULL;

ALTER TABLE public.academic_terms
ALTER COLUMN is_current SET DEFAULT false;

ALTER TABLE public.academic_terms
ALTER COLUMN is_current SET NOT NULL;

-- Validate that no conflicting normalized FALL 2026 identity exists.
DO $$
DECLARE
    matching_row_count integer;
    conflicting_row_count integer;
BEGIN
    SELECT COUNT(*)
    INTO matching_row_count
    FROM public.academic_terms
    WHERE lower(btrim(name)) = 'fall 2026'
       OR (
            year = 2026
            AND lower(btrim(term_type)) = 'fall'
       );

    SELECT COUNT(*)
    INTO conflicting_row_count
    FROM public.academic_terms
    WHERE (
            lower(btrim(name)) = 'fall 2026'
            AND NOT (
                year = 2026
                AND lower(btrim(term_type)) = 'fall'
            )
          )
       OR (
            year = 2026
            AND lower(btrim(term_type)) = 'fall'
            AND lower(btrim(name)) <> 'fall 2026'
          );

    IF conflicting_row_count > 0 THEN
        RAISE EXCEPTION
            'S2-A1 aborted: a conflicting FALL 2026 academic-term identity exists.';
    END IF;

    IF matching_row_count > 1 THEN
        RAISE EXCEPTION
            'S2-A1 aborted: multiple FALL 2026 candidate rows exist.';
    END IF;
END;
$$;

-- Create FALL 2026 only when the matching term does not already exist.
INSERT INTO public.academic_terms (
    name,
    year,
    term_type,
    is_active,
    is_current
)
SELECT
    'FALL 2026',
    2026,
    'FALL',
    TRUE,
    FALSE
WHERE NOT EXISTS (
    SELECT 1
    FROM public.academic_terms
    WHERE lower(btrim(name)) = 'fall 2026'
      AND year = 2026
      AND lower(btrim(term_type)) = 'fall'
);

-- Normalize the lifecycle attributes of the confirmed FALL 2026 row.
--
-- This does not modify IDs or foreign-key relationships.
UPDATE public.academic_terms
SET
    name = 'FALL 2026',
    year = 2026,
    term_type = 'FALL',
    is_active = TRUE
WHERE lower(btrim(name)) = 'fall 2026'
  AND year = 2026
  AND lower(btrim(term_type)) = 'fall';

-- Select FALL 2026 as the only current academic term.
UPDATE public.academic_terms
SET is_current = (
    lower(btrim(name)) = 'fall 2026'
    AND year = 2026
    AND lower(btrim(term_type)) = 'fall'
);

-- Enforce the invariant that at most one row can be current.
CREATE UNIQUE INDEX IF NOT EXISTS
    academic_terms_single_current_idx
ON public.academic_terms ((is_current))
WHERE is_current IS TRUE;

-- Final transactional validations.
DO $$
DECLARE
    fall_2026_count integer;
    current_term_count integer;
    current_fall_2026_count integer;
BEGIN
    SELECT COUNT(*)
    INTO fall_2026_count
    FROM public.academic_terms
    WHERE lower(btrim(name)) = 'fall 2026'
      AND year = 2026
      AND lower(btrim(term_type)) = 'fall';

    IF fall_2026_count <> 1 THEN
        RAISE EXCEPTION
            'S2-A1 validation failed: expected exactly one FALL 2026 row, found %.',
            fall_2026_count;
    END IF;

    SELECT COUNT(*)
    INTO current_term_count
    FROM public.academic_terms
    WHERE is_current IS TRUE;

    IF current_term_count <> 1 THEN
        RAISE EXCEPTION
            'S2-A1 validation failed: expected exactly one current term, found %.',
            current_term_count;
    END IF;

    SELECT COUNT(*)
    INTO current_fall_2026_count
    FROM public.academic_terms
    WHERE is_current IS TRUE
      AND lower(btrim(name)) = 'fall 2026'
      AND year = 2026
      AND lower(btrim(term_type)) = 'fall';

    IF current_fall_2026_count <> 1 THEN
        RAISE EXCEPTION
            'S2-A1 validation failed: FALL 2026 is not the current term.';
    END IF;
END;
$$;

COMMIT;

-- Verification result returned after successful execution.
SELECT
    id,
    name,
    year,
    term_type,
    is_active,
    is_current
FROM public.academic_terms
ORDER BY year, id;