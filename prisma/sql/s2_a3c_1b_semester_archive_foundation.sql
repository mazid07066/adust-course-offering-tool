-- =============================================================================
-- UniFlow S2-A3C-1B
-- Semester Archive PostgreSQL Foundation
--
-- Purpose:
--   1. Create semester_archives.
--   2. Create semester_archive_reflections.
--   3. Enforce archive version uniqueness.
--   4. Enforce archive lifecycle consistency.
--   5. Prevent mutation or deletion of finalized archives.
--   6. Prevent mutation of reflections belonging to finalized archives.
--   7. Preserve existing UniFlow data.
--
-- Safety:
--   - Existing academic terms are not modified.
--   - Existing programs are not modified.
--   - Existing users are not modified.
--   - Existing offerings are not modified.
--   - Existing BAETE data is not modified.
--   - Script is transactional.
--   - Script is rerunnable.
--   - Advisory locking prevents simultaneous execution.
-- =============================================================================

BEGIN;

-- Prevent simultaneous executions of this specific UniFlow migration.
SELECT pg_advisory_xact_lock(
    hashtext('uniflow_s2_a3c_1b_semester_archive_foundation')
);

-- =============================================================================
-- PRECONDITION CHECKS
-- =============================================================================

DO $$
BEGIN
    IF to_regclass('public.academic_terms') IS NULL THEN
        RAISE EXCEPTION
            'S2-A3C-1B aborted: public.academic_terms does not exist.';
    END IF;

    IF to_regclass('public.programs') IS NULL THEN
        RAISE EXCEPTION
            'S2-A3C-1B aborted: public.programs does not exist.';
    END IF;

    IF to_regclass('public.users') IS NULL THEN
        RAISE EXCEPTION
            'S2-A3C-1B aborted: public.users does not exist.';
    END IF;
END;
$$;

-- =============================================================================
-- TABLE: semester_archives
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.semester_archives (
    id                    SERIAL NOT NULL,
    academic_term_id      INTEGER NOT NULL,
    program_id            INTEGER NOT NULL,
    version               INTEGER NOT NULL DEFAULT 1,
    status                VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    snapshot_json         JSONB NOT NULL,
    snapshot_schema       VARCHAR(100) NOT NULL DEFAULT 'semester-archive-v1',
    archive_note          TEXT,
    created_by_user_id    INTEGER NOT NULL,
    created_at            TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finalized_by_user_id  INTEGER,
    finalized_at          TIMESTAMPTZ(6),

    CONSTRAINT semester_archives_pkey
        PRIMARY KEY (id),

    CONSTRAINT uq_semester_archive_version
        UNIQUE (academic_term_id, program_id, version),

    CONSTRAINT semester_archives_version_positive_ck
        CHECK (version > 0),

    CONSTRAINT semester_archives_status_ck
        CHECK (status IN ('DRAFT', 'FINALIZED')),

    CONSTRAINT semester_archives_snapshot_schema_ck
        CHECK (length(btrim(snapshot_schema)) > 0),

    CONSTRAINT semester_archives_finalization_ck
        CHECK (
            (
                status = 'DRAFT'
                AND finalized_by_user_id IS NULL
                AND finalized_at IS NULL
            )
            OR
            (
                status = 'FINALIZED'
                AND finalized_by_user_id IS NOT NULL
                AND finalized_at IS NOT NULL
            )
        ),

    CONSTRAINT semester_archives_academic_term_fk
        FOREIGN KEY (academic_term_id)
        REFERENCES public.academic_terms(id)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,

    CONSTRAINT semester_archives_program_fk
        FOREIGN KEY (program_id)
        REFERENCES public.programs(id)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,

    CONSTRAINT semester_archives_created_by_fk
        FOREIGN KEY (created_by_user_id)
        REFERENCES public.users(id)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,

    CONSTRAINT semester_archives_finalized_by_fk
        FOREIGN KEY (finalized_by_user_id)
        REFERENCES public.users(id)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION
);

-- =============================================================================
-- TABLE: semester_archive_reflections
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.semester_archive_reflections (
    id                    SERIAL NOT NULL,
    semester_archive_id   INTEGER NOT NULL,
    category              VARCHAR(50) NOT NULL,
    title                 VARCHAR(250) NOT NULL,
    narrative             TEXT NOT NULL,
    evidence_json         JSONB,
    sort_order            INTEGER NOT NULL DEFAULT 0,
    created_by_user_id    INTEGER NOT NULL,
    updated_by_user_id    INTEGER,
    created_at            TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT semester_archive_reflections_pkey
        PRIMARY KEY (id),

    CONSTRAINT semester_archive_reflections_archive_fk
        FOREIGN KEY (semester_archive_id)
        REFERENCES public.semester_archives(id)
        ON DELETE CASCADE
        ON UPDATE NO ACTION,

    CONSTRAINT semester_archive_reflections_created_by_fk
        FOREIGN KEY (created_by_user_id)
        REFERENCES public.users(id)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,

    CONSTRAINT semester_archive_reflections_updated_by_fk
        FOREIGN KEY (updated_by_user_id)
        REFERENCES public.users(id)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS ix_semester_archives_academic_term
ON public.semester_archives (academic_term_id);

CREATE INDEX IF NOT EXISTS ix_semester_archives_program
ON public.semester_archives (program_id);

CREATE INDEX IF NOT EXISTS ix_semester_archives_status
ON public.semester_archives (status);

CREATE INDEX IF NOT EXISTS ix_semester_archives_created_by
ON public.semester_archives (created_by_user_id);

CREATE INDEX IF NOT EXISTS ix_semester_archives_finalized_by
ON public.semester_archives (finalized_by_user_id);

CREATE INDEX IF NOT EXISTS ix_archive_reflections_archive
ON public.semester_archive_reflections (semester_archive_id);

CREATE INDEX IF NOT EXISTS ix_archive_reflections_category
ON public.semester_archive_reflections (category);

CREATE INDEX IF NOT EXISTS ix_archive_reflections_created_by
ON public.semester_archive_reflections (created_by_user_id);

CREATE INDEX IF NOT EXISTS ix_archive_reflections_updated_by
ON public.semester_archive_reflections (updated_by_user_id);

-- =============================================================================
-- FINALIZED ARCHIVE IMMUTABILITY
-- =============================================================================

CREATE OR REPLACE FUNCTION public.uniflow_prevent_finalized_archive_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status = 'FINALIZED' THEN
        RAISE EXCEPTION
            'Semester archive % is FINALIZED and cannot be modified or deleted.',
            OLD.id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_semester_archives_finalized_immutable
ON public.semester_archives;

CREATE TRIGGER trg_semester_archives_finalized_immutable
BEFORE UPDATE OR DELETE
ON public.semester_archives
FOR EACH ROW
EXECUTE FUNCTION public.uniflow_prevent_finalized_archive_mutation();

-- =============================================================================
-- FINALIZED ARCHIVE REFLECTION IMMUTABILITY
-- =============================================================================

CREATE OR REPLACE FUNCTION public.uniflow_prevent_finalized_archive_reflection_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    parent_archive_id INTEGER;
    parent_status VARCHAR(30);
    new_parent_status VARCHAR(30);
BEGIN
    IF TG_OP = 'INSERT' THEN
        parent_archive_id := NEW.semester_archive_id;

        SELECT status
        INTO parent_status
        FROM public.semester_archives
        WHERE id = parent_archive_id;

        IF parent_status = 'FINALIZED' THEN
            RAISE EXCEPTION
                'Semester archive % is FINALIZED. Reflections cannot be added.',
                parent_archive_id;
        END IF;

        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        parent_archive_id := OLD.semester_archive_id;

        SELECT status
        INTO parent_status
        FROM public.semester_archives
        WHERE id = parent_archive_id;

        IF parent_status = 'FINALIZED' THEN
            RAISE EXCEPTION
                'Semester archive % is FINALIZED. Reflections cannot be deleted.',
                parent_archive_id;
        END IF;

        RETURN OLD;
    END IF;

    parent_archive_id := OLD.semester_archive_id;

    SELECT status
    INTO parent_status
    FROM public.semester_archives
    WHERE id = parent_archive_id;

    IF parent_status = 'FINALIZED' THEN
        RAISE EXCEPTION
            'Semester archive % is FINALIZED. Reflections cannot be modified.',
            parent_archive_id;
    END IF;

    IF NEW.semester_archive_id <> OLD.semester_archive_id THEN
        SELECT status
        INTO new_parent_status
        FROM public.semester_archives
        WHERE id = NEW.semester_archive_id;

        IF new_parent_status = 'FINALIZED' THEN
            RAISE EXCEPTION
                'Semester archive % is FINALIZED. Reflections cannot be moved into it.',
                NEW.semester_archive_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_semester_archive_reflections_immutable
ON public.semester_archive_reflections;

CREATE TRIGGER trg_semester_archive_reflections_immutable
BEFORE INSERT OR UPDATE OR DELETE
ON public.semester_archive_reflections
FOR EACH ROW
EXECUTE FUNCTION public.uniflow_prevent_finalized_archive_reflection_mutation();

-- =============================================================================
-- FINAL STRUCTURAL VALIDATION
-- =============================================================================

DO $$
DECLARE
    archive_table_count INTEGER;
    reflection_table_count INTEGER;
    archive_trigger_count INTEGER;
    reflection_trigger_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO archive_table_count
    FROM pg_class
    WHERE oid = to_regclass('public.semester_archives');

    IF archive_table_count <> 1 THEN
        RAISE EXCEPTION
            'S2-A3C-1B validation failed: semester_archives table missing.';
    END IF;

    SELECT COUNT(*)
    INTO reflection_table_count
    FROM pg_class
    WHERE oid = to_regclass('public.semester_archive_reflections');

    IF reflection_table_count <> 1 THEN
        RAISE EXCEPTION
            'S2-A3C-1B validation failed: semester_archive_reflections table missing.';
    END IF;

    SELECT COUNT(*)
    INTO archive_trigger_count
    FROM pg_trigger
    WHERE tgrelid = 'public.semester_archives'::regclass
      AND tgname = 'trg_semester_archives_finalized_immutable'
      AND NOT tgisinternal;

    IF archive_trigger_count <> 1 THEN
        RAISE EXCEPTION
            'S2-A3C-1B validation failed: archive immutability trigger missing.';
    END IF;

    SELECT COUNT(*)
    INTO reflection_trigger_count
    FROM pg_trigger
    WHERE tgrelid = 'public.semester_archive_reflections'::regclass
      AND tgname = 'trg_semester_archive_reflections_immutable'
      AND NOT tgisinternal;

    IF reflection_trigger_count <> 1 THEN
        RAISE EXCEPTION
            'S2-A3C-1B validation failed: reflection immutability trigger missing.';
    END IF;
END;
$$;

COMMIT;

-- =============================================================================
-- POST-MIGRATION VERIFICATION OUTPUT
-- =============================================================================

SELECT
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
      'semester_archives',
      'semester_archive_reflections'
  )
ORDER BY table_name;

SELECT
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
      'semester_archives',
      'semester_archive_reflections'
  )
ORDER BY tablename, indexname;

SELECT
    event_object_table,
    trigger_name,
    event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN (
      'semester_archives',
      'semester_archive_reflections'
  )
ORDER BY event_object_table, trigger_name, event_manipulation;
