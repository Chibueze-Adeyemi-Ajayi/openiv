-- V34: WebSocket session liveness tracking.
--
-- socket_active: TRUE while the browser's WebSocket is connected, FALSE when
--   it disconnects (or was never opened). Defaults to FALSE so that all
--   pre-migration rows are treated as dead sessions on the next conflict check.
-- socket_id: opaque server-assigned identifier for the current socket
--   (UUID generated at connect time). Allows the backend to distinguish a
--   reconnect (same session, new socket) from a new session entirely.
-- socket_connected_at: timestamp the socket was last established; useful for
--   auditing and for diagnosing reconnect loops.

ALTER TABLE sessions
    ADD COLUMN IF NOT EXISTS socket_active       BOOLEAN    NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS socket_id           TEXT,
    ADD COLUMN IF NOT EXISTS socket_connected_at TIMESTAMPTZ;

-- Partial index: fast lookup of the live socket for a given session row
-- (used by the WebSocket handler to update state on disconnect).
CREATE INDEX IF NOT EXISTS ix_sessions_socket_id
    ON sessions(socket_id)
    WHERE socket_id IS NOT NULL AND revoked_at IS NULL;
