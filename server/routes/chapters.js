// server/routes/chapters.js
import { Router } from "express";
import { pool } from "../lib/db.js";
import { authRequired, checkBlocklist } from "../middleware/auth.js";
import { moderationLimiter } from "../middleware/rateLimit.js";
import { moderateContent } from "../lib/moderation.js";
import { sendReplyNotification } from "../lib/email.js";
import { validate, marginNoteSchema } from "../lib/schemas.js";

const router = Router();

async function getOrCreateVerse(book, chapter, verse) {
  const ex = await pool.query("SELECT id FROM verses WHERE book=$1 AND chapter=$2 AND verse=$3", [book, chapter, verse]);
  if (ex.rows.length) return ex.rows[0].id;
  const ins = await pool.query(
    "INSERT INTO verses (book,chapter,verse) VALUES ($1,$2,$3) ON CONFLICT (book,chapter,verse) DO UPDATE SET book=EXCLUDED.book RETURNING id",
    [book, chapter, verse]
  );
  return ins.rows[0].id;
}

async function attachReactions(rows, userId) {
  if (!rows.length) return rows;
  const ids = rows.map(r => r.id);
  const counts  = await pool.query("SELECT comment_id,type,COUNT(*) AS count FROM reactions WHERE comment_id=ANY($1) GROUP BY comment_id,type", [ids]);
  const mine    = await pool.query("SELECT comment_id,type FROM reactions WHERE comment_id=ANY($1) AND user_id=$2", [ids, userId]);
  const topR    = await pool.query(
    `SELECT rx.comment_id,rx.type,u.id,u.name,u.avatar_url,
            ROW_NUMBER() OVER (PARTITION BY rx.comment_id,rx.type ORDER BY rx.created_at ASC) AS rn
     FROM reactions rx JOIN users u ON u.id=rx.user_id WHERE rx.comment_id=ANY($1)`, [ids]
  );
  const cm = {}; for (const r of counts.rows) { if (!cm[r.comment_id]) cm[r.comment_id] = {}; cm[r.comment_id][r.type] = parseInt(r.count); }
  const ms = new Set(mine.rows.map(r => `${r.comment_id}:${r.type}`));
  const rm = {}; for (const r of topR.rows) { if (r.rn > 3) continue; if (!rm[r.comment_id]) rm[r.comment_id] = {}; if (!rm[r.comment_id][r.type]) rm[r.comment_id][r.type] = []; rm[r.comment_id][r.type].push({ id: r.id, name: r.name, avatar_url: r.avatar_url }); }
  return rows.map(c => ({ ...c, reactions: {
    amen:  { count: cm[c.id]?.amen  || 0, mine: ms.has(`${c.id}:amen`),  reactors: rm[c.id]?.amen  || [] },
    pray:  { count: cm[c.id]?.pray  || 0, mine: ms.has(`${c.id}:pray`),  reactors: rm[c.id]?.pray  || [] },
    heart: { count: cm[c.id]?.heart || 0, mine: ms.has(`${c.id}:heart`), reactors: rm[c.id]?.heart || [] },
  }}));
}

// POST /api/highlights
router.post("/highlights", authRequired, checkBlocklist, async (req, res) => {
  const { book, chapter, verse, version, quote, color } = req.body;
  if (!book||!chapter||!verse||!version||!quote) return res.status(400).json({ error: "book,chapter,verse,version,quote required" });
  try {
    const verseId = await getOrCreateVerse(book, chapter, verse);
    const r = await pool.query(
      "INSERT INTO highlights (user_id,verse_id,version,quote,color) VALUES ($1,$2,$3,$4,$5) RETURNING id,verse_id,version,quote,color,created_at",
      [req.user.id, verseId, version, quote, color || "#fbeec1"]
    );
    res.json({ highlight: r.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not save highlight" }); }
});

// POST /api/comments
router.post("/comments", authRequired, checkBlocklist, moderationLimiter, validate(marginNoteSchema), async (req, res) => {
  const { book, chapter, verse, highlightId, body, parentId, groupId } = req.body;
  try {
    const screen = await moderateContent(body, "margin note");
    if (!screen.allowed) return res.status(422).json({ error: `Note blocked: ${screen.reason}` });

    const verseId = await getOrCreateVerse(book, chapter, verse);
    const r = await pool.query(
      "INSERT INTO comments (user_id,verse_id,highlight_id,body,parent_id,group_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,verse_id,highlight_id,body,parent_id,group_id,created_at",
      [req.user.id, verseId, highlightId || null, body, parentId || null, groupId || null]
    );

    // Notify parent comment author of reply
    if (parentId) {
      const parentQ = await pool.query(
        "SELECT u.email,u.name FROM comments c JOIN users u ON u.id=c.user_id WHERE c.id=$1 AND c.user_id!=$2",
        [parentId, req.user.id]
      );
      if (parentQ.rows.length) {
        sendReplyNotification(parentQ.rows[0].email, parentQ.rows[0].name, req.user.name, body.slice(0, 200)).catch(console.error);
      }
    }

    res.json({ comment: { ...r.rows[0], author: req.user.name, author_id: req.user.id } });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not save comment" }); }
});

// GET /api/comments/:id/replies
router.get("/comments/:id/replies", authRequired, checkBlocklist, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT c.id,c.body,c.parent_id,c.created_at,u.name AS author,u.id AS author_id,u.avatar_url FROM comments c JOIN users u ON u.id=c.user_id WHERE c.parent_id=$1 ORDER BY c.created_at ASC",
      [req.params.id]
    );
    res.json({ replies: await attachReactions(r.rows, req.user.id) });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not load replies" }); }
});

// POST /api/comments/:id/react
router.post("/comments/:id/react", authRequired, checkBlocklist, async (req, res) => {
  const { type } = req.body;
  if (!["amen","pray","heart"].includes(type)) return res.status(400).json({ error: "Invalid type" });
  try {
    const ex = await pool.query("SELECT id FROM reactions WHERE user_id=$1 AND comment_id=$2 AND type=$3", [req.user.id, req.params.id, type]);
    if (ex.rows.length) { await pool.query("DELETE FROM reactions WHERE id=$1", [ex.rows[0].id]); res.json({ toggled:"off",type }); }
    else { await pool.query("INSERT INTO reactions (user_id,comment_id,type) VALUES ($1,$2,$3)", [req.user.id, req.params.id, type]); res.json({ toggled:"on",type }); }
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not react" }); }
});

// GET /api/comments/:id/reactors
router.get("/comments/:id/reactors", authRequired, checkBlocklist, async (req, res) => {
  const { type } = req.query;
  try {
    const r = await pool.query(
      `SELECT u.id,u.name,u.avatar_url FROM reactions rx JOIN users u ON u.id=rx.user_id
       WHERE rx.comment_id=$1 ${type ? "AND rx.type=$2" : ""} ORDER BY rx.created_at ASC LIMIT 20`,
      type ? [req.params.id, type] : [req.params.id]
    );
    res.json({ reactors: r.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not load reactors" }); }
});

// GET /api/chapters/:book/:chapter/notes
router.get("/:book/:chapter/notes", authRequired, checkBlocklist, async (req, res) => {
  const { book, chapter } = req.params;
  const { groupId } = req.query;
  try {
    const r = await pool.query(
      `SELECT v.verse AS verse_number,c.id,c.id AS comment_id,c.body AS comment,
              c.parent_id,c.created_at,u.name AS author,u.id AS author_id,u.avatar_url,h.version,h.quote
       FROM comments c JOIN verses v ON v.id=c.verse_id JOIN users u ON u.id=c.user_id
       LEFT JOIN highlights h ON h.id=c.highlight_id
       WHERE v.book=$1 AND v.chapter=$2 AND c.parent_id IS NULL AND ($3::uuid IS NULL OR c.group_id=$3)
       ORDER BY v.verse ASC,c.created_at ASC`,
      [book, parseInt(chapter, 10), groupId || null]
    );
    res.json({ notes: await attachReactions(r.rows, req.user.id) });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not load chapter notes" }); }
});

// GET /api/chapters/:book/:chapter/export
router.get("/:book/:chapter/export", authRequired, checkBlocklist, async (req, res) => {
  const { book, chapter } = req.params;
  const format = req.query.format === "txt" ? "txt" : "md";
  try {
    const r = await pool.query(
      `SELECT v.verse AS verse_number,c.body AS comment,c.created_at,u.name AS author,h.version,h.quote
       FROM comments c JOIN verses v ON v.id=c.verse_id JOIN users u ON u.id=c.user_id
       LEFT JOIN highlights h ON h.id=c.highlight_id
       WHERE v.book=$1 AND v.chapter=$2 ORDER BY v.verse ASC,c.created_at ASC`,
      [book, parseInt(chapter, 10)]
    );
    let out = `${book} ${chapter} — Study Notes\n${"=".repeat(40)}\n\n`, lv = null;
    for (const row of r.rows) {
      if (row.verse_number !== lv) { out += `\nVerse ${row.verse_number}\n`; lv = row.verse_number; }
      if (row.quote) out += `  [${row.version}] "${row.quote}"\n`;
      out += `  - ${row.author}: ${row.comment}\n`;
    }
    if (!r.rows.length) out += "(No notes yet for this chapter.)\n";
    res.setHeader("Content-Type", format === "txt" ? "text/plain" : "text/markdown");
    res.setHeader("Content-Disposition", `attachment; filename="${book}-${chapter}-notes.${format}"`);
    res.send(out);
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not export" }); }
});

export default router;
