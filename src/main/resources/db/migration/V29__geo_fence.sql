-- Geographical access-control fence per institution.
-- Enabled flag + polygon (GeoJSON-like array of {lat,lng} objects) +
-- calibration offsets that the super-admin drags on the map.
CREATE TABLE geo_fence (
  id               BIGSERIAL PRIMARY KEY,
  institution_id   BIGINT NOT NULL UNIQUE,
  enabled          BOOLEAN NOT NULL DEFAULT false,
  polygon          JSONB   NOT NULL DEFAULT '[]',
  cal_lat_offset   DOUBLE PRECISION NOT NULL DEFAULT 0,
  cal_lng_offset   DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users that are subject to geo-fence enforcement.
-- Admin-role users are exempt even if listed here (checked at runtime).
CREATE TABLE geo_fenced_users (
  institution_id BIGINT NOT NULL,
  user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_by       BIGINT REFERENCES users(id),
  added_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (institution_id, user_id)
);

-- Pending / historical geo access requests.
-- Created when a geo-fenced user tries to login from outside the polygon.
-- watch_token is a one-time random string the user's browser uses to open the SSE watch stream.
CREATE TABLE geo_access_requests (
  id             BIGSERIAL PRIMARY KEY,
  institution_id BIGINT NOT NULL,
  user_id        BIGINT NOT NULL REFERENCES users(id),
  session_id     BIGINT NOT NULL,
  raw_lat        DOUBLE PRECISION,
  raw_lng        DOUBLE PRECISION,
  ip             TEXT,
  user_agent     TEXT,
  device_id      TEXT,
  watch_token    TEXT NOT NULL UNIQUE,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','rejected')),
  reviewed_by    BIGINT REFERENCES users(id),
  reviewed_at    TIMESTAMPTZ,
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT now() + interval '10 minutes',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX geo_access_requests_institution_pending
  ON geo_access_requests (institution_id, status, created_at DESC);
