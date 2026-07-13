-- Bible Study Journal — Neon Postgres schema (prototype)

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Reference: books/chapters/verses (verse text comes from the Bible API,
-- this table just gives you stable IDs to attach notes/highlights to)
CREATE TABLE verses (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book      TEXT NOT NULL,        -- e.g. 'John'
  chapter   INT  NOT NULL,        -- e.g. 3
  verse     INT  NOT NULL,        -- e.g. 16
  UNIQUE (book, chapter, verse)
);

-- A highlight = a selected span of text on a specific verse + version
CREATE TABLE highlights (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verse_id    UUID NOT NULL REFERENCES verses(id) ON DELETE CASCADE,
  version     TEXT NOT NULL,      -- e.g. 'KJV', 'WEB'
  quote       TEXT NOT NULL,      -- the highlighted text
  color       TEXT DEFAULT '#fbeec1',
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Comments/questions attached to a highlight (or directly to a verse)
CREATE TABLE comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verse_id     UUID NOT NULL REFERENCES verses(id) ON DELETE CASCADE,
  highlight_id UUID REFERENCES highlights(id) ON DELETE CASCADE,
  body         TEXT NOT NULL,
  parent_id    UUID REFERENCES comments(id) ON DELETE CASCADE, -- for threaded replies
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Likes/reactions (Facebook-style)
CREATE TABLE reactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_id  UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'amen', -- 'amen', 'pray', 'heart', etc.
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, comment_id, type)
);

-- Reading groups / communities (optional, for shared chapter discussions)
CREATE TABLE groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE group_members (
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT DEFAULT 'member',
  PRIMARY KEY (group_id, user_id)
);

-- Helpful indexes
CREATE INDEX idx_highlights_user ON highlights(user_id);
CREATE INDEX idx_comments_verse ON comments(verse_id);
CREATE INDEX idx_comments_highlight ON comments(highlight_id);
