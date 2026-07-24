// server/routes/groups.js
import { Router } from "express";
import { pool } from "../lib/db.js";
import { authRequired, checkBlocklist } from "../middleware/auth.js";

const router = Router();

// GET /api/groups
router.get("/", authRequired, checkBlocklist, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT g.id,g.name,g.description,g.created_at,u.name AS created_by_name,
              (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id=g.id) AS member_count,
              (SELECT role FROM group_members gm WHERE gm.group_id=g.id AND gm.user_id=$1) AS my_role
       FROM groups g JOIN users u ON u.id=g.created_by ORDER BY g.created_at DESC`,
      [req.user.id]
    );
    res.json({ groups: r.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not load groups" }); }
});

// POST /api/groups
router.post("/", authRequired, checkBlocklist, async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  try {
    const r = await pool.query(
      "INSERT INTO groups (name,description,created_by) VALUES ($1,$2,$3) RETURNING id,name,description,created_at",
      [name, description || "", req.user.id]
    );
    const group = r.rows[0];
    await pool.query("INSERT INTO group_members (group_id,user_id,role) VALUES ($1,$2,'admin')", [group.id, req.user.id]);
    res.json({ group: { ...group, created_by_name: req.user.name, member_count: 1, my_role: "admin" } });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not create group" }); }
});

// POST /api/groups/:id/join
router.post("/:id/join", authRequired, checkBlocklist, async (req, res) => {
  try {
    const ex = await pool.query("SELECT * FROM group_members WHERE group_id=$1 AND user_id=$2", [req.params.id, req.user.id]);
    if (ex.rows.length) return res.status(409).json({ error: "Already a member" });
    await pool.query("INSERT INTO group_members (group_id,user_id,role) VALUES ($1,$2,'member')", [req.params.id, req.user.id]);
    res.json({ joined: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not join group" }); }
});

// POST /api/groups/:id/leave
router.post("/:id/leave", authRequired, checkBlocklist, async (req, res) => {
  try {
    await pool.query("DELETE FROM group_members WHERE group_id=$1 AND user_id=$2", [req.params.id, req.user.id]);
    res.json({ left: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not leave group" }); }
});

// GET /api/groups/:id/members
router.get("/:id/members", authRequired, checkBlocklist, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT u.id,u.name,u.avatar_url,gm.role,gm.joined_at
       FROM group_members gm JOIN users u ON u.id=gm.user_id
       WHERE gm.group_id=$1 ORDER BY gm.joined_at ASC`,
      [req.params.id]
    );
    res.json({ members: r.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not load members" }); }
});

export default router;
