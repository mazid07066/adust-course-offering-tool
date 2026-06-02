-- S1-D Student Authentication and Portal Access Control
-- Safe additive patch. Does not alter existing student/import/offering logic.

CREATE TABLE IF NOT EXISTS student_portal_accounts (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP NULL,

    CONSTRAINT student_portal_accounts_student_id_fkey
        FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS student_login_sessions (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL,
    session_token_hash TEXT NOT NULL UNIQUE,
    user_agent TEXT NULL,
    ip_address TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL,

    CONSTRAINT student_login_sessions_account_id_fkey
        FOREIGN KEY (account_id)
        REFERENCES student_portal_accounts(id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_student_login_sessions_account_id
ON student_login_sessions(account_id);

CREATE INDEX IF NOT EXISTS idx_student_login_sessions_expires_at
ON student_login_sessions(expires_at);

CREATE TABLE IF NOT EXISTS student_portal_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    portal_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    login_message TEXT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT student_portal_settings_singleton
        CHECK (id = 1)
);

INSERT INTO student_portal_settings (id, portal_enabled, login_message, updated_at)
VALUES (1, FALSE, 'Student portal is not open yet. Please contact the department office.', NOW())
ON CONFLICT (id) DO NOTHING;