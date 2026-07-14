BEGIN;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR(80) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(160) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('administrador', 'contador')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_key VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    event_type VARCHAR(120) NOT NULL,
    event_date DATE NOT NULL,
    location VARCHAR(200) NOT NULL DEFAULT '',
    regional_leader VARCHAR(160) NOT NULL DEFAULT '',
    elder VARCHAR(160) NOT NULL DEFAULT '',
    region VARCHAR(120) NOT NULL DEFAULT '',
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS device_counts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    device_id VARCHAR(100) NOT NULL,
    device_name VARCHAR(160) NOT NULL DEFAULT '',
    counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    recorded_by BIGINT REFERENCES users(id),
    client_updated_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_id, device_id)
);

CREATE INDEX IF NOT EXISTS device_counts_event_id_idx ON device_counts (event_id);
CREATE INDEX IF NOT EXISTS events_event_date_idx ON events (event_date);

CREATE TABLE IF NOT EXISTS access_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    username VARCHAR(80) NOT NULL DEFAULT '',
    action VARCHAR(80) NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    device_name VARCHAR(160) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS access_logs_created_at_idx ON access_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS group_assignments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_key VARCHAR(64) NOT NULL,
    group_id VARCHAR(40) NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(100) NOT NULL,
    device_name VARCHAR(160) NOT NULL DEFAULT '',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (event_key, group_id)
);

CREATE INDEX IF NOT EXISTS group_assignments_expires_at_idx ON group_assignments (expires_at);

COMMIT;
