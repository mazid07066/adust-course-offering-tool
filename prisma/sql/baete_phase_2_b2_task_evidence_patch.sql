CREATE TABLE IF NOT EXISTS baete_task_evidence (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL,
  original_file_name VARCHAR(300) NOT NULL,
  stored_file_name VARCHAR(300) NOT NULL,
  file_path TEXT NOT NULL,
  file_mime_type VARCHAR(150) NULL,
  file_size_bytes INTEGER NOT NULL DEFAULT 0,
  evidence_note TEXT NULL,
  uploaded_by_user_id INTEGER NULL,
  review_status VARCHAR(60) NOT NULL DEFAULT 'PENDING_REVIEW',
  reviewer_feedback TEXT NULL,
  reviewed_by_user_id INTEGER NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_baete_task_evidence_task
    FOREIGN KEY (task_id)
    REFERENCES baete_tasks(id)
    ON DELETE CASCADE,

  CONSTRAINT fk_baete_task_evidence_uploaded_by
    FOREIGN KEY (uploaded_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL,

  CONSTRAINT fk_baete_task_evidence_reviewed_by
    FOREIGN KEY (reviewed_by_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_baete_task_evidence_task_id
  ON baete_task_evidence(task_id);

CREATE INDEX IF NOT EXISTS ix_baete_task_evidence_review_status
  ON baete_task_evidence(review_status);

CREATE INDEX IF NOT EXISTS ix_baete_task_evidence_created_at
  ON baete_task_evidence(created_at);