// server/routes/posts.js
import { Router } from "express";
import { pool } from "../lib/db.js";
import { authRequired, checkBlocklist } from "../middleware/auth.js";
import { moderationLimiter } from "../middleware/rateLimit.js";
import { moderateContent } from "../lib/moderation.js";
import { sendReplyNotification } from "../lib/email.js";
import { validate, postSchema, commentSchema } from "../lib/schemas.js";

const router = Router();

async function attachPostReactions(posts, userId) {
  if (!posts.length) return posts;
  const ids = posts.map(p => p.id);
  const counts = await pool.query("SELECT post_id,type,COUNT(*) AS count FROM post_reactions WHERE post_id=ANY($1) GROUP BY post_id,type", [ids]);
  const mine   = await pool.query("SELECT post_id,type FROM post_reactions WHERE post_id=ANY($1) AND user_id=$2", [ids, userId]);
  const topR   = await pool.query(
    `SELECT rx.post_id,rx.type,u.id,u.name,u.avatar_url,
            ROW_NUMBER() OVER (PARTITION BY rx.post_id,rx.type ORDER BY rx.created_at ASC) AS rn
     FROM post_reactions rx JOIN users u ON u.id=rx.user_id WHERE rx.post_id=ANY($1)`, [ids]
  );
  const cm = {}; for (const r of counts.rows) { if (!cm[r.post_id]) cm[r.post_id] = {}; cm[r.post_id][r.type] = parseInt(r.count); }
  const ms = new Set(mine.rows.map(r => `${r.post_id}:${r.type}`));
  const rm = {}; for (const r of topR.rows) { if (r.rn > 3) continue; if (!rm[r.post_id]) rm[r.post_id] = {}; if (!rm[r.post_id][r.type]) rm[r.post_id][r.type] = []; rm[r.post_id][r.type].push({ id: r.id, name: r.name, avatar_url: r.avatar_url }); }
  return posts.map(p => ({ ...p, reactions: {
    amen:  { count: cm[p.id]?.amen  || 0, mine: ms.has(`${p.id}:amen`),  reactors: rm[p.id]?.amen  || [] },
    pray:  { count: cm[p.id]?.pray  || 0, mine: ms.has(`${p.id}:pray`),  reactors: rm[p.id]?.pray  || [] },
    heart: { count: cm[p.id]?.heart || 0, mine: ms.has(`${p.id}:heart`), reactors: rm[p.id]?.heart || [] },
  }}));
}

async function attachCommentReactions(comments, userId) {
  if (!comments.length) return comments;
  const ids = comments.map(c => c.id);
  const counts = await pool.query("SELECT comment_id,type,COUNT(*) AS count FROM post_comment_reactions WHERE comment_id=ANY($1) GROUP BY comment_id,type", [ids]);
  const mine   = await pool.query("SELECT comment_id,type FROM post_comment_reactions WHERE comment_id=ANY($1) AND user_id=$2", [ids, userId]);
  const cm = {}; for (const r of counts.rows) { if (!cm[r.comment_id]) cm[r.comment_id] = {}; cm[r.comment_id][r.type] = parseInt(r.count); }
  const ms = new Set(mine.rows.map(r => `${r.comment_id}:${r.type}`));
  return comments.map(c => ({ ...c, reactions: {
    amen:  { count: cm[c.id]?.amen  || 0, mine: ms.has(`${c.id}:amen`),  reactors: [] },
    pray:  { count: cm[c.id]?.pray  || 0, mine: ms.has(`${c.id}:pray`),  reactors: [] },
    heart: { count: cm[c.id]?.heart || 0, mine: ms.has(`${c.id}:heart`), reactors: [] },
  }}));
}

// GET /api/posts
router.get("/", authRequired, checkBlocklist, async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page  || "1", 10));
  const limit  = Math.min(50, parseInt(req.query.limit || "20", 10));
  const offset = (page - 1) * limit;
  const { groupId } = req.query;
  try {
    const r = await pool.query(
      `SELECT p.id,p.title,p.body,p.created_at,p.group_id,
              u.name AS author,u.id AS author_id,u.avatar_url,
              v.book,v.chapter,v.verse,g.name AS group_name,
              (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id=p.id) AS comment_count
       FROM posts p JOIN users u ON u.id=p.user_id
       LEFT JOIN verses v ON v.id=p.verse_id
       LEFT JOIN groups g ON g.id=p.group_id
       WHERE ($3::uuid IS NULL OR p.group_id=$3)
       ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset, groupId || null]
    );
    const posts = await attachPostReactions(r.rows, req.user.id);
    const total = await pool.query("SELECT COUNT(*) FROM posts WHERE ($1::uuid IS NULL OR group_id=$1)", [groupId || null]);
    res.json({ posts, total: parseInt(total.rows[0].count), page, limit });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not load posts" }); }
});

// POST /api/posts
router.post("/", authRequired, checkBlocklist, moderationLimiter, validate(postSchema), async (req, res) => {
  const { title, body, book, chapter, verse, groupId } = req.body;
  try {
    // Moderation check with timeout indicator
    const screen = await moderateContent(`${title} ${body}`, "community post");
    if (!screen.allowed) {
      await pool.query(
        "INSERT INTO moderation_flags (content_type,content_id,user_id,reason,action) VALUES ($1,$2,$3,$4,$5)",
        ["attempted_post", "00000000-0000-0000-0000-000000000000", req.user.id, screen.reason, "blocked"]
      );
      return res.status(422).json({ error: `Post blocked: ${screen.reason}` });
    }
    let verseId = null;
    if (book && chapter && verse) {
      const vr = await pool.query("SELECT id FROM verses WHERE book=$1 AND chapter=$2 AND verse=$3", [book, chapter, verse]);
      verseId = vr.rows[0]?.id;
    }
    const r = await pool.query(
      "INSERT INTO posts (user_id,verse_id,title,body,group_id) VALUES ($1,$2,$3,$4,$5) RETURNING id,title,body,created_at,group_id",
      [req.user.id, verseId, title, body, groupId || null]
    );
    res.json({ post: { ...r.rows[0], author: req.user.name, author_id: req.user.id, comment_count: 0,
      reactions: { amen:{count:0,mine:false,reactors:[]}, pray:{count:0,mine:false,reactors:[]}, heart:{count:0,mine:false,reactors:[]} } } });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not create post" }); }
});

// GET /api/posts/:id
router.get("/:id", authRequired, checkBlocklist, async (req, res) => {
  try {
    const pr = await pool.query(
      `SELECT p.id,p.title,p.body,p.created_at,p.group_id,u.name AS author,u.id AS author_id,u.avatar_url,v.book,v.chapter,v.verse,g.name AS group_name
       FROM posts p JOIN users u ON u.id=p.user_id LEFT JOIN verses v ON v.id=p.verse_id LEFT JOIN groups g ON g.id=p.group_id
       WHERE p.id=$1`,
      [req.params.id]
    );
    if (!pr.rows.length) return res.status(404).json({ error: "Post not found" });
    const [post] = await attachPostReactions(pr.rows, req.user.id);
    const cr = await pool.query(
      `SELECT pc.id,pc.body,pc.parent_id,pc.created_at,u.name AS author,u.id AS author_id,u.avatar_url
       FROM post_comments pc JOIN users u ON u.id=pc.user_id WHERE pc.post_id=$1 ORDER BY pc.created_at ASC`,
      [req.params.id]
    );
    const comments = await attachCommentReactions(cr.rows, req.user.id);
    res.json({ post, comments });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not load post" }); }
});

// POST /api/posts/:id/comments
router.post("/:id/comments", authRequired, checkBlocklist, moderationLimiter, validate(commentSchema), async (req, res) => {
  const { body, parentId } = req.body;
  try {
    const screen = await moderateContent(body, "comment");
    if (!screen.allowed) return res.status(422).json({ error: `Comment blocked: ${screen.reason}` });

    const r = await pool.query(
      "INSERT INTO post_comments (post_id,user_id,body,parent_id) VALUES ($1,$2,$3,$4) RETURNING id,body,parent_id,created_at",
      [req.params.id, req.user.id, body, parentId || null]
    );

    // Notify post author if it's a reply to them
    if (parentId) {
      const parentQ = await pool.query(
        `SELECT u.email,u.name FROM post_comments pc JOIN users u ON u.id=pc.user_id WHERE pc.id=$1 AND pc.user_id!=$2`,
        [parentId, req.user.id]
      );
      if (parentQ.rows.length) {
        sendReplyNotification(parentQ.rows[0].email, parentQ.rows[0].name, req.user.name, body.slice(0, 200)).catch(console.error);
      }
    }

    res.json({ comment: { ...r.rows[0], author: req.user.name, author_id: req.user.id,
      reactions: { amen:{count:0,mine:false,reactors:[]}, pray:{count:0,mine:false,reactors:[]}, heart:{count:0,mine:false,reactors:[]} } } });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not add comment" }); }
});

// POST /api/posts/:id/react
router.post("/:id/react", authRequired, checkBlocklist, async (req, res) => {
  const { type } = req.body;
  if (!["amen","pray","heart"].includes(type)) return res.status(400).json({ error: "Invalid type" });
  try {
    const ex = await pool.query("SELECT id FROM post_reactions WHERE user_id=$1 AND post_id=$2 AND type=$3", [req.user.id, req.params.id, type]);
    if (ex.rows.length) { await pool.query("DELETE FROM post_reactions WHERE id=$1", [ex.rows[0].id]); res.json({ toggled:"off",type }); }
    else { await pool.query("INSERT INTO post_reactions (user_id,post_id,type) VALUES ($1,$2,$3)", [req.user.id, req.params.id, type]); res.json({ toggled:"on",type }); }
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not react" }); }
});

// POST /api/post-comments/:id/react
router.post("/comments/:id/react", authRequired, checkBlocklist, async (req, res) => {
  const { type } = req.body;
  if (!["amen","pray","heart"].includes(type)) return res.status(400).json({ error: "Invalid type" });
  try {
    const ex = await pool.query("SELECT id FROM post_comment_reactions WHERE user_id=$1 AND comment_id=$2 AND type=$3", [req.user.id, req.params.id, type]);
    if (ex.rows.length) { await pool.query("DELETE FROM post_comment_reactions WHERE id=$1", [ex.rows[0].id]); res.json({ toggled:"off",type }); }
    else { await pool.query("INSERT INTO post_comment_reactions (user_id,comment_id,type) VALUES ($1,$2,$3)", [req.user.id, req.params.id, type]); res.json({ toggled:"on",type }); }
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not react" }); }
});

// GET /api/posts/:id/reactors
router.get("/:id/reactors", authRequired, checkBlocklist, async (req, res) => {
  const { type } = req.query;
  try {
    const r = await pool.query(
      `SELECT u.id,u.name,u.avatar_url FROM post_reactions rx JOIN users u ON u.id=rx.user_id
       WHERE rx.post_id=$1 ${type ? "AND rx.type=$2" : ""} ORDER BY rx.created_at ASC LIMIT 20`,
      type ? [req.params.id, type] : [req.params.id]
    );
    res.json({ reactors: r.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not load reactors" }); }
});

export default router;
