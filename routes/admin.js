// server/routes/admin.js
import { Router } from "express";
import { pool } from "../lib/db.js";
import { authRequired, checkBlocklist, adminRequired } from "../middleware/auth.js";
import { moderateContent } from "../lib/moderation.js";

const router = Router();

router.get("/flags", authRequired, checkBlocklist, adminRequired, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT f.id,f.content_type,f.content_id,f.reason,f.action,f.created_at,
              u.name AS user_name,u.email AS user_email
       FROM moderation_flags f JOIN users u ON u.id=f.user_id
       ORDER BY f.created_at DESC LIMIT 100`
    );
    res.json({ flags: r.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not load flags" }); }
});

router.get("/posts", authRequired, checkBlocklist, adminRequired, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT p.id,p.title,p.body,p.created_at,u.name AS author,u.email AS author_email,u.id AS author_id
       FROM posts p JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 100`
    );
    res.json({ posts: r.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not load posts" }); }
});

router.delete("/posts/:id", authRequired, checkBlocklist, adminRequired, async (req, res) => {
  try {
    await pool.query("DELETE FROM posts WHERE id=$1", [req.params.id]);
    await pool.query(
      "INSERT INTO moderation_flags (content_type,content_id,user_id,reason,action) VALUES ($1,$2,$3,$4,$5)",
      ["post", req.params.id, req.user.id, "Manually removed by admin", "deleted"]
    );
    res.json({ deleted: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not delete post" }); }
});

router.get("/comments", authRequired, checkBlocklist, adminRequired, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT pc.id,pc.body,pc.created_at,u.name AS author,u.email AS author_email,p.title AS post_title,p.id AS post_id
       FROM post_comments pc JOIN users u ON u.id=pc.user_id JOIN posts p ON p.id=pc.post_id
       ORDER BY pc.created_at DESC LIMIT 100`
    );
    res.json({ comments: r.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not load comments" }); }
});

router.delete("/comments/:id", authRequired, checkBlocklist, adminRequired, async (req, res) => {
  try {
    await pool.query("DELETE FROM post_comments WHERE id=$1", [req.params.id]);
    await pool.query(
      "INSERT INTO moderation_flags (content_type,content_id,user_id,reason,action) VALUES ($1,$2,$3,$4,$5)",
      ["post_comment", req.params.id, req.user.id, "Manually removed by admin", "deleted"]
    );
    res.json({ deleted: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not delete comment" }); }
});

router.get("/users", authRequired, checkBlocklist, adminRequired, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id,name,email,is_admin,email_verified,created_at FROM users ORDER BY created_at ASC"
    );
    res.json({ users: r.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not load users" }); }
});

router.patch("/users/:id", authRequired, checkBlocklist, adminRequired, async (req, res) => {
  const { is_admin } = req.body;
  try {
    const r = await pool.query(
      "UPDATE users SET is_admin=$1 WHERE id=$2 RETURNING id,name,email,is_admin",
      [!!is_admin, req.params.id]
    );
    res.json({ user: r.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not update user" }); }
});

router.post("/screen", authRequired, checkBlocklist, adminRequired, async (req, res) => {
  const { text, context } = req.body;
  if (!text) return res.status(400).json({ error: "text is required" });
  const result = await moderateContent(text, context || "content");
  res.json(result);
});

export default router;
