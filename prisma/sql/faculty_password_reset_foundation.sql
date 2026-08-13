-- ============================================================
-- UniFlow Faculty Password Management
-- Secure Password Reset Token Foundation
-- ============================================================

CREATE TABLE IF NOT EXISTS faculty_password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    token_hash VARCHAR(128) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_faculty_password_reset_tokens_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
        ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_faculty_password_reset_tokens_token_hash
    ON faculty_password_reset_tokens(token_hash);

CREATE INDEX IF NOT EXISTS ix_faculty_password_reset_tokens_user_id
    ON faculty_password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS ix_faculty_password_reset_tokens_expires_at
    ON faculty_password_reset_tokens(expires_at);

CREATE INDEX IF NOT EXISTS ix_faculty_password_reset_tokens_user_created
    ON faculty_password_reset_tokens(user_id, created_at);

CREATE INDEX IF NOT EXISTS ix_faculty_password_reset_tokens_unused
    ON faculty_password_reset_tokens(user_id, used_at, expires_at);
