-- =============================================================================
-- UniFlow S2-A3C-1B
-- Semester Archive Database Behavioral Tests
--
-- IMPORTANT:
--   All test data is created inside one transaction.
--   The script finishes with ROLLBACK.
--   No test archive/reflection remains in the database.
-- =============================================================================

BEGIN;

DO $$
DECLARE
    v_term_id INTEGER;
    v_program_id INTEGER;
    v_user_id INTEGER;
    v_archive_id INTEGER;
    v_reflection_id INTEGER;
    v_second_archive_id INTEGER;

    v_test_passed BOOLEAN;
BEGIN
    ---------------------------------------------------------------------------
    -- Resolve existing parent rows
    ---------------------------------------------------------------------------

    SELECT id
    INTO v_term_id
    FROM public.academic_terms
    ORDER BY is_current DESC, id ASC
    LIMIT 1;

    IF v_term_id IS NULL THEN
        RAISE EXCEPTION
            'TEST SETUP FAILED: no academic_terms row exists.';
    END IF;

    SELECT id
    INTO v_program_id
    FROM public.programs
    ORDER BY id ASC
    LIMIT 1;

    IF v_program_id IS NULL THEN
        RAISE EXCEPTION
            'TEST SETUP FAILED: no programs row exists.';
    END IF;

    SELECT id
    INTO v_user_id
    FROM public.users
    ORDER BY id ASC
    LIMIT 1;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION
            'TEST SETUP FAILED: no users row exists.';
    END IF;

    RAISE NOTICE 'TEST SETUP PASSED';
    RAISE NOTICE 'Term ID: %, Program ID: %, User ID: %',
        v_term_id,
        v_program_id,
        v_user_id;

    ---------------------------------------------------------------------------
    -- TEST 1
    -- Create DRAFT archive
    ---------------------------------------------------------------------------

    INSERT INTO public.semester_archives (
        academic_term_id,
        program_id,
        version,
        status,
        snapshot_json,
        snapshot_schema,
        archive_note,
        created_by_user_id
    )
    VALUES (
        v_term_id,
        v_program_id,
        900001,
        'DRAFT',
        '{"test":"s2-a3c-1b"}'::jsonb,
        'semester-archive-v1',
        'S2-A3C-1B temporary behavioral test',
        v_user_id
    )
    RETURNING id
    INTO v_archive_id;

    IF v_archive_id IS NULL THEN
        RAISE EXCEPTION
            'TEST 1 FAILED: DRAFT archive was not created.';
    END IF;

    RAISE NOTICE 'TEST 1 PASSED: DRAFT archive created';

    ---------------------------------------------------------------------------
    -- TEST 2
    -- DRAFT archive is mutable
    ---------------------------------------------------------------------------

    UPDATE public.semester_archives
    SET archive_note = 'Draft archive successfully edited'
    WHERE id = v_archive_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'TEST 2 FAILED: DRAFT archive could not be updated.';
    END IF;

    RAISE NOTICE 'TEST 2 PASSED: DRAFT archive is mutable';

    ---------------------------------------------------------------------------
    -- TEST 3
    -- Reflection can be created while parent archive is DRAFT
    ---------------------------------------------------------------------------

    INSERT INTO public.semester_archive_reflections (
        semester_archive_id,
        category,
        title,
        narrative,
        evidence_json,
        sort_order,
        created_by_user_id
    )
    VALUES (
        v_archive_id,
        'CQI',
        'Temporary S2-A3C test reflection',
        'Temporary behavioral test.',
        '{"test":true}'::jsonb,
        0,
        v_user_id
    )
    RETURNING id
    INTO v_reflection_id;

    IF v_reflection_id IS NULL THEN
        RAISE EXCEPTION
            'TEST 3 FAILED: DRAFT reflection was not created.';
    END IF;

    RAISE NOTICE 'TEST 3 PASSED: reflection creation allowed for DRAFT archive';

    ---------------------------------------------------------------------------
    -- TEST 4
    -- Reflection is mutable while parent archive is DRAFT
    ---------------------------------------------------------------------------

    UPDATE public.semester_archive_reflections
    SET narrative = 'Edited while archive remained DRAFT'
    WHERE id = v_reflection_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'TEST 4 FAILED: reflection could not be updated while DRAFT.';
    END IF;

    RAISE NOTICE 'TEST 4 PASSED: DRAFT reflection is mutable';

    ---------------------------------------------------------------------------
    -- TEST 5
    -- Invalid version <= 0 must fail
    ---------------------------------------------------------------------------

    v_test_passed := FALSE;

    BEGIN
        INSERT INTO public.semester_archives (
            academic_term_id,
            program_id,
            version,
            status,
            snapshot_json,
            created_by_user_id
        )
        VALUES (
            v_term_id,
            v_program_id,
            0,
            'DRAFT',
            '{}'::jsonb,
            v_user_id
        );

    EXCEPTION
        WHEN check_violation THEN
            v_test_passed := TRUE;
    END;

    IF NOT v_test_passed THEN
        RAISE EXCEPTION
            'TEST 5 FAILED: version 0 was accepted.';
    END IF;

    RAISE NOTICE 'TEST 5 PASSED: non-positive version rejected';

    ---------------------------------------------------------------------------
    -- TEST 6
    -- Invalid archive status must fail
    ---------------------------------------------------------------------------

    v_test_passed := FALSE;

    BEGIN
        INSERT INTO public.semester_archives (
            academic_term_id,
            program_id,
            version,
            status,
            snapshot_json,
            created_by_user_id
        )
        VALUES (
            v_term_id,
            v_program_id,
            900002,
            'INVALID_STATUS',
            '{}'::jsonb,
            v_user_id
        );

    EXCEPTION
        WHEN check_violation THEN
            v_test_passed := TRUE;
    END;

    IF NOT v_test_passed THEN
        RAISE EXCEPTION
            'TEST 6 FAILED: invalid archive status was accepted.';
    END IF;

    RAISE NOTICE 'TEST 6 PASSED: invalid status rejected';

    ---------------------------------------------------------------------------
    -- TEST 7
    -- Duplicate term/program/version must fail
    ---------------------------------------------------------------------------

    v_test_passed := FALSE;

    BEGIN
        INSERT INTO public.semester_archives (
            academic_term_id,
            program_id,
            version,
            status,
            snapshot_json,
            created_by_user_id
        )
        VALUES (
            v_term_id,
            v_program_id,
            900001,
            'DRAFT',
            '{}'::jsonb,
            v_user_id
        );

    EXCEPTION
        WHEN unique_violation THEN
            v_test_passed := TRUE;
    END;

    IF NOT v_test_passed THEN
        RAISE EXCEPTION
            'TEST 7 FAILED: duplicate archive version was accepted.';
    END IF;

    RAISE NOTICE 'TEST 7 PASSED: duplicate archive version rejected';

    ---------------------------------------------------------------------------
    -- TEST 8
    -- FINALIZED without finalization metadata must fail
    ---------------------------------------------------------------------------

    v_test_passed := FALSE;

    BEGIN
        INSERT INTO public.semester_archives (
            academic_term_id,
            program_id,
            version,
            status,
            snapshot_json,
            created_by_user_id
        )
        VALUES (
            v_term_id,
            v_program_id,
            900003,
            'FINALIZED',
            '{}'::jsonb,
            v_user_id
        );

    EXCEPTION
        WHEN check_violation THEN
            v_test_passed := TRUE;
    END;

    IF NOT v_test_passed THEN
        RAISE EXCEPTION
            'TEST 8 FAILED: FINALIZED archive without metadata was accepted.';
    END IF;

    RAISE NOTICE 'TEST 8 PASSED: finalization metadata required';

    ---------------------------------------------------------------------------
    -- TEST 9
    -- DRAFT -> FINALIZED transition must succeed
    ---------------------------------------------------------------------------

    UPDATE public.semester_archives
    SET
        status = 'FINALIZED',
        finalized_by_user_id = v_user_id,
        finalized_at = CURRENT_TIMESTAMP
    WHERE id = v_archive_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'TEST 9 FAILED: DRAFT archive could not be finalized.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.semester_archives
        WHERE id = v_archive_id
          AND status = 'FINALIZED'
          AND finalized_by_user_id IS NOT NULL
          AND finalized_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'TEST 9 FAILED: finalized archive state is inconsistent.';
    END IF;

    RAISE NOTICE 'TEST 9 PASSED: DRAFT -> FINALIZED succeeded';

    ---------------------------------------------------------------------------
    -- TEST 10
    -- Finalized archive UPDATE must fail
    ---------------------------------------------------------------------------

    v_test_passed := FALSE;

    BEGIN
        UPDATE public.semester_archives
        SET archive_note = 'THIS MUST NOT SUCCEED'
        WHERE id = v_archive_id;

    EXCEPTION
        WHEN raise_exception THEN
            v_test_passed := TRUE;
    END;

    IF NOT v_test_passed THEN
        RAISE EXCEPTION
            'TEST 10 FAILED: FINALIZED archive was updated.';
    END IF;

    RAISE NOTICE 'TEST 10 PASSED: finalized archive UPDATE blocked';

    ---------------------------------------------------------------------------
    -- TEST 11
    -- Finalized archive DELETE must fail
    ---------------------------------------------------------------------------

    v_test_passed := FALSE;

    BEGIN
        DELETE FROM public.semester_archives
        WHERE id = v_archive_id;

    EXCEPTION
        WHEN raise_exception THEN
            v_test_passed := TRUE;
    END;

    IF NOT v_test_passed THEN
        RAISE EXCEPTION
            'TEST 11 FAILED: FINALIZED archive was deleted.';
    END IF;

    RAISE NOTICE 'TEST 11 PASSED: finalized archive DELETE blocked';

    ---------------------------------------------------------------------------
    -- TEST 12
    -- Reflection INSERT into finalized archive must fail
    ---------------------------------------------------------------------------

    v_test_passed := FALSE;

    BEGIN
        INSERT INTO public.semester_archive_reflections (
            semester_archive_id,
            category,
            title,
            narrative,
            created_by_user_id
        )
        VALUES (
            v_archive_id,
            'TEST',
            'Must fail',
            'Must fail',
            v_user_id
        );

    EXCEPTION
        WHEN raise_exception THEN
            v_test_passed := TRUE;
    END;

    IF NOT v_test_passed THEN
        RAISE EXCEPTION
            'TEST 12 FAILED: reflection was inserted into FINALIZED archive.';
    END IF;

    RAISE NOTICE 'TEST 12 PASSED: finalized reflection INSERT blocked';

    ---------------------------------------------------------------------------
    -- TEST 13
    -- Existing reflection UPDATE must fail after finalization
    ---------------------------------------------------------------------------

    v_test_passed := FALSE;

    BEGIN
        UPDATE public.semester_archive_reflections
        SET narrative = 'THIS MUST NOT SUCCEED'
        WHERE id = v_reflection_id;

    EXCEPTION
        WHEN raise_exception THEN
            v_test_passed := TRUE;
    END;

    IF NOT v_test_passed THEN
        RAISE EXCEPTION
            'TEST 13 FAILED: reflection UPDATE succeeded after finalization.';
    END IF;

    RAISE NOTICE 'TEST 13 PASSED: finalized reflection UPDATE blocked';

    ---------------------------------------------------------------------------
    -- TEST 14
    -- Existing reflection DELETE must fail after finalization
    ---------------------------------------------------------------------------

    v_test_passed := FALSE;

    BEGIN
        DELETE FROM public.semester_archive_reflections
        WHERE id = v_reflection_id;

    EXCEPTION
        WHEN raise_exception THEN
            v_test_passed := TRUE;
    END;

    IF NOT v_test_passed THEN
        RAISE EXCEPTION
            'TEST 14 FAILED: reflection DELETE succeeded after finalization.';
    END IF;

    RAISE NOTICE 'TEST 14 PASSED: finalized reflection DELETE blocked';

    ---------------------------------------------------------------------------
    -- TEST 15
    -- New archive version remains possible
    ---------------------------------------------------------------------------

    INSERT INTO public.semester_archives (
        academic_term_id,
        program_id,
        version,
        status,
        snapshot_json,
        created_by_user_id
    )
    VALUES (
        v_term_id,
        v_program_id,
        900004,
        'DRAFT',
        '{"newVersion":true}'::jsonb,
        v_user_id
    )
    RETURNING id
    INTO v_second_archive_id;

    IF v_second_archive_id IS NULL THEN
        RAISE EXCEPTION
            'TEST 15 FAILED: new archive version could not be created.';
    END IF;

    RAISE NOTICE 'TEST 15 PASSED: new archive version can be created';

    ---------------------------------------------------------------------------
    -- TEST 16
    -- Foreign key protection
    ---------------------------------------------------------------------------

    v_test_passed := FALSE;

    BEGIN
        INSERT INTO public.semester_archives (
            academic_term_id,
            program_id,
            version,
            status,
            snapshot_json,
            created_by_user_id
        )
        VALUES (
            -999999,
            v_program_id,
            900005,
            'DRAFT',
            '{}'::jsonb,
            v_user_id
        );

    EXCEPTION
        WHEN foreign_key_violation THEN
            v_test_passed := TRUE;
    END;

    IF NOT v_test_passed THEN
        RAISE EXCEPTION
            'TEST 16 FAILED: invalid academic-term FK was accepted.';
    END IF;

    RAISE NOTICE 'TEST 16 PASSED: foreign-key protection active';

    ---------------------------------------------------------------------------
    -- Final result
    ---------------------------------------------------------------------------

    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'S2-A3C-1B ALL 16 BEHAVIORAL TESTS PASSED';
    RAISE NOTICE '=======================================================';
END;
$$;

-- Test data must never persist.
ROLLBACK;