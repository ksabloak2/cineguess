CREATE TABLE IF NOT EXISTS vip_crew (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);
CREATE INDEX IF NOT EXISTS vip_crew_user_idx ON vip_crew(user_id);
