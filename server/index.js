// server/index.js
// -------------------------------------------------------------
// Bible Study Journal — API server
// Run with: npm install && npm start
// Requires a .env file with DATABASE_URL (your Neon connection
// string) and JWT_SECRET. See .env.example.
// -------------------------------------------------------------

import express from "express";
import cors from "cors";
import pg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import "dotenv/config";

const { Pool } = pg;
const app = express();
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
  })
);
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // required for Neon
});

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_EXPIRY = "30d";

// ---------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------
function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET); // { id, name, email }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ---------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------

// POST /api/signup  { name, email, password }
app.post("/api/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email and password are required" });
  }
  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length) {
      return res.status(409).json({ error: "An account with that email already exists" });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name, email, hash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, {
      expiresIn: TOKEN_EXPIRY,
    });
    res.json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create account" });
  }
});

// POST /api/login  { email, password }
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  try {
    const result = await pool.query(
      "SELECT id, name, email, password_hash FROM users WHERE email = $1",
      [email]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, {
      expiresIn: TOKEN_EXPIRY,
    });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not log in" });
  }
});

// GET /api/me — verify token / fetch current user
app.get("/api/me", authRequired, (req, res) => {
  res.json({ user: req.user });
});

// ---------------------------------------------------------------
// Verse helper: find-or-create a verse row, returns its id
// ---------------------------------------------------------------
async function getOrCreateVerse(book, chapter, verse) {
  const existing = await pool.query(
    "SELECT id FROM verses WHERE book = $1 AND chapter = $2 AND verse = $3",
    [book, chapter, verse]
  );
  if (existing.rows.length) return existing.rows[0].id;

  const inserted = await pool.query(
    `INSERT INTO verses (book, chapter, verse) VALUES ($1, $2, $3)
     ON CONFLICT (book, chapter, verse) DO UPDATE SET book = EXCLUDED.book
     RETURNING id`,
    [book, chapter, verse]
  );
  return inserted.rows[0].id;
}

// ---------------------------------------------------------------
// Highlights
// ---------------------------------------------------------------

// POST /api/highlights  { book, chapter, verse, version, quote, color? }
app.post("/api/highlights", authRequired, async (req, res) => {
  const { book, chapter, verse, version, quote, color } = req.body;
  if (!book || !chapter || !verse || !version || !quote) {
    return res.status(400).json({ error: "book, chapter, verse, version and quote are required" });
  }
  try {
    const verseId = await getOrCreateVerse(book, chapter, verse);
    const result = await pool.query(
      `INSERT INTO highlights (user_id, verse_id, version, quote, color)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, verse_id, version, quote, color, created_at`,
      [req.user.id, verseId, version, quote, color || "#fbeec1"]
    );
    res.json({ highlight: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save highlight" });
  }
});

// ---------------------------------------------------------------
// Comments
// ---------------------------------------------------------------

// POST /api/comments  { book, chapter, verse, highlightId?, body, parentId? }
app.post("/api/comments", authRequired, async (req, res) => {
  const { book, chapter, verse, highlightId, body, parentId } = req.body;
  if (!book || !chapter || !verse || !body) {
    return res.status(400).json({ error: "book, chapter, verse and body are required" });
  }
  try {
    const verseId = await getOrCreateVerse(book, chapter, verse);
    const result = await pool.query(
      `INSERT INTO comments (user_id, verse_id, highlight_id, body, parent_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, verse_id, highlight_id, body, parent_id, created_at`,
      [req.user.id, verseId, highlightId || null, body, parentId || null]
    );
    res.json({ comment: { ...result.rows[0], author: req.user.name } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not save comment" });
  }
});

// ---------------------------------------------------------------
// Chapter notes — all highlights + comments for a chapter, joined
// GET /api/chapters/:book/:chapter/notes
// ---------------------------------------------------------------
app.get("/api/chapters/:book/:chapter/notes", authRequired, async (req, res) => {
  const { book, chapter } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         v.verse        AS verse_number,
         c.id            AS comment_id,
         c.body          AS comment,
         c.parent_id     AS parent_id,
         c.created_at    AS created_at,
         u.name          AS author,
         h.version       AS version,
         h.quote         AS quote
       FROM comments c
       JOIN verses v ON v.id = c.verse_id
       JOIN users u ON u.id = c.user_id
       LEFT JOIN highlights h ON h.id = c.highlight_id
       WHERE v.book = $1 AND v.chapter = $2
       ORDER BY v.verse ASC, c.created_at ASC`,
      [book, parseInt(chapter, 10)]
    );
    res.json({ notes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load chapter notes" });
  }
});

// ---------------------------------------------------------------
// Export — chapter notes as plain text / markdown
// GET /api/chapters/:book/:chapter/export?format=md|txt
// ---------------------------------------------------------------
app.get("/api/chapters/:book/:chapter/export", authRequired, async (req, res) => {
  const { book, chapter } = req.params;
  const format = req.query.format === "txt" ? "txt" : "md";
  try {
    const result = await pool.query(
      `SELECT
         v.verse AS verse_number,
         c.body AS comment,
         c.created_at,
         u.name AS author,
         h.version, h.quote
       FROM comments c
       JOIN verses v ON v.id = c.verse_id
       JOIN users u ON u.id = c.user_id
       LEFT JOIN highlights h ON h.id = c.highlight_id
       WHERE v.book = $1 AND v.chapter = $2
       ORDER BY v.verse ASC, c.created_at ASC`,
      [book, parseInt(chapter, 10)]
    );

    let out = `${book} ${chapter} — Study Notes\n`;
    out += "=".repeat(40) + "\n\n";
    let lastVerse = null;
    for (const row of result.rows) {
      if (row.verse_number !== lastVerse) {
        out += `\nVerse ${row.verse_number}\n`;
        lastVerse = row.verse_number;
      }
      if (row.quote) out += `  [${row.version}] "${row.quote}"\n`;
      out += `  - ${row.author}: ${row.comment}\n`;
    }
    if (!result.rows.length) out += "(No notes yet for this chapter.)\n";

    const ext = format === "txt" ? "txt" : "md";
    res.setHeader("Content-Type", format === "txt" ? "text/plain" : "text/markdown");
    res.setHeader("Content-Disposition", `attachment; filename="${book}-${chapter}-notes.${ext}"`);
    res.send(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not export chapter notes" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
