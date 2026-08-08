BEGIN;

CREATE TABLE IF NOT EXISTS public.batch_term_offering_statuses (
    id                  SERIAL PRIMARY KEY,
    batch_id            INTEGER NOT NULL,
    academic_term_id    INTEGER NOT NULL,
    status              VARCHAR(60) NOT NULL,
    reason              TEXT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_batch_term_offering_status_batch
        FOREIGN KEY (batch_id)
        REFERENCES public.batches(id)
        ON DELETE RESTRICT
        ON UPDATE NO ACTION,

    CONSTRAINT fk_batch_term_offering_status_term
        FOREIGN KEY (academic_term_id)
        REFERENCES public.academic_terms(id)
        ON DELETE RESTRICT
        ON UPDATE NO ACTION,

    CONSTRAINT uq_batch_term_offering_status
        UNIQUE (batch_id, academic_term_id),

    CONSTRAINT ck_batch_term_offering_status_value
        CHECK (
            status IN (
                'ACTIVE_FOR_OFFERING',
                'NO_OFFERING_PASSING_OUT',
                'NO_OFFERING_NO_STUDENTS',
                'NO_OFFERING_PROGRAM_DECISION',
                'NO_OFFERING_OTHER'
            )
        )
);

CREATE INDEX IF NOT EXISTS
    ix_batch_term_offering_statuses_term
ON public.batch_term_offering_statuses (
    academic_term_id
);

CREATE INDEX IF NOT EXISTS
    ix_batch_term_offering_statuses_batch
ON public.batch_term_offering_statuses (
    batch_id
);

CREATE INDEX IF NOT EXISTS
    ix_batch_term_offering_statuses_status
ON public.batch_term_offering_statuses (
    status
);

COMMIT;