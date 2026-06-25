ALTER TABLE baete_committees
ADD COLUMN IF NOT EXISTS head_user_id INTEGER NULL;

ALTER TABLE baete_committees
ADD COLUMN IF NOT EXISTS reviewer_user_id INTEGER NULL;

ALTER TABLE baete_committees
ADD COLUMN IF NOT EXISTS supervisor_user_id INTEGER NULL;

ALTER TABLE baete_task_updates
ADD COLUMN IF NOT EXISTS updated_by_user_id INTEGER NULL;

ALTER TABLE baete_task_evidence
ADD COLUMN IF NOT EXISTS uploaded_by_user_id INTEGER NULL;

ALTER TABLE baete_task_evidence
ADD COLUMN IF NOT EXISTS reviewed_by_user_id INTEGER NULL;

ALTER TABLE baete_task_evidence
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ NULL;

ALTER TABLE baete_committees
DROP CONSTRAINT IF EXISTS fk_baete_committees_head_user;

ALTER TABLE baete_committees
ADD CONSTRAINT fk_baete_committees_head_user
FOREIGN KEY (head_user_id)
REFERENCES users(id)
ON DELETE SET NULL;

ALTER TABLE baete_committees
DROP CONSTRAINT IF EXISTS fk_baete_committees_reviewer_user;

ALTER TABLE baete_committees
ADD CONSTRAINT fk_baete_committees_reviewer_user
FOREIGN KEY (reviewer_user_id)
REFERENCES users(id)
ON DELETE SET NULL;

ALTER TABLE baete_committees
DROP CONSTRAINT IF EXISTS fk_baete_committees_supervisor_user;

ALTER TABLE baete_committees
ADD CONSTRAINT fk_baete_committees_supervisor_user
FOREIGN KEY (supervisor_user_id)
REFERENCES users(id)
ON DELETE SET NULL;

ALTER TABLE baete_task_updates
DROP CONSTRAINT IF EXISTS fk_baete_task_updates_updated_by_user;

ALTER TABLE baete_task_updates
ADD CONSTRAINT fk_baete_task_updates_updated_by_user
FOREIGN KEY (updated_by_user_id)
REFERENCES users(id)
ON DELETE SET NULL;

ALTER TABLE baete_task_evidence
DROP CONSTRAINT IF EXISTS fk_baete_task_evidence_uploaded_by_user;

ALTER TABLE baete_task_evidence
ADD CONSTRAINT fk_baete_task_evidence_uploaded_by_user
FOREIGN KEY (uploaded_by_user_id)
REFERENCES users(id)
ON DELETE SET NULL;

ALTER TABLE baete_task_evidence
DROP CONSTRAINT IF EXISTS fk_baete_task_evidence_reviewed_by_user;

ALTER TABLE baete_task_evidence
ADD CONSTRAINT fk_baete_task_evidence_reviewed_by_user
FOREIGN KEY (reviewed_by_user_id)
REFERENCES users(id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_baete_committees_head_user_id
  ON baete_committees(head_user_id);

CREATE INDEX IF NOT EXISTS ix_baete_committees_reviewer_user_id
  ON baete_committees(reviewer_user_id);

CREATE INDEX IF NOT EXISTS ix_baete_committees_supervisor_user_id
  ON baete_committees(supervisor_user_id);

CREATE INDEX IF NOT EXISTS ix_baete_task_updates_updated_by_user_id
  ON baete_task_updates(updated_by_user_id);

CREATE INDEX IF NOT EXISTS ix_baete_task_evidence_uploaded_by_user_id
  ON baete_task_evidence(uploaded_by_user_id);

CREATE INDEX IF NOT EXISTS ix_baete_task_evidence_reviewed_by_user_id
  ON baete_task_evidence(reviewed_by_user_id);

CREATE TABLE IF NOT EXISTS baete_access_audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NULL,
  action_key VARCHAR(120) NOT NULL,
  resource_type VARCHAR(80) NULL,
  resource_id INTEGER NULL,
  allowed BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_baete_access_audit_logs_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS ix_baete_access_audit_logs_user_id
  ON baete_access_audit_logs(user_id);

CREATE INDEX IF NOT EXISTS ix_baete_access_audit_logs_action_key
  ON baete_access_audit_logs(action_key);

CREATE INDEX IF NOT EXISTS ix_baete_access_audit_logs_resource
  ON baete_access_audit_logs(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS ix_baete_access_audit_logs_created_at
  ON baete_access_audit_logs(created_at);