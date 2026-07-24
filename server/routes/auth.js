// server/routes/auth.js
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { pool } from "../lib/db.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../lib/email.js";
import { authRequired, checkBlocklist } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { validate, signupSchema, loginSchema, passwordResetSchema } from "../lib/schemas.js";
import "dotenv/config";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const ACCESS_EXPIRY = "15m";
const REFRESH_EXPIRY_DAYS = 30;

function generateTokens(user) {
  const jti = crypto.randomUUID();
  const accessToken = jwt.sign(
    { id: user.id, name: user.name, email: user.email, is_admin: user.is_admin, jti },
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRY }
  );
  const refreshToken = crypto.randomBytes(48).toString("hex");
  return { accessToken, refreshToken, jti };
}

// POST /api/signup
router.post("/signup", authLimiter, validate(signupSchema), async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existing = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (existing.rows.length) return res.status(409).json({ error: "An account with that email already exists" });

    const hash = await bcrypt.hash(password, 12);
    const adminCount = await pool.query("SELECT COUNT(*) FROM users WHERE is_admin=true");
    const isAdmin = parseInt(adminCount.rows[0].count) < 5;
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const r = await pool.query(
      `INSERT INTO users (name,email,password_hash,is_admin,verification_token,verification_expires)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,name,email,bio,avatar_url,is_admin,email_verified,created_at`,
      [name, email, hash, isAdmin, verificationToken, verificationExpires]
    );
    const user = r.rows[0];

    // Send verification email (non-blocking)
    sendVerificationEmail(email, name, verificationToken).catch(console.error);

    const { accessToken, refreshToken } = generateTokens(user);
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_DAYS * 86400 * 1000);
    await pool.query(
      "INSERT INTO refresh_tokens (user_id,token,expires_at) VALUES ($1,$2,$3)",
      [user.id, refreshToken, expiresAt]
    );

    res.json({ token: accessToken, refreshToken, user });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not create account" }); }
});

// POST /api/login
router.post("/login", authLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  try {
    const r = await pool.query(
      "SELECT id,name,email,password_hash,bio,avatar_url,is_admin,email_verified,created_at FROM users WHERE email=$1",
      [email]
    );
    const user = r.rows[0];
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    const { accessToken, refreshToken } = generateTokens(user);
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_DAYS * 86400 * 1000);
    await pool.query(
      "INSERT INTO refresh_tokens (user_id,token,expires_at) VALUES ($1,$2,$3)",
      [user.id, refreshToken, expiresAt]
    );

    const { password_hash, ...safe } = user;
    res.json({ token: accessToken, refreshToken, user: safe });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not log in" }); }
});

// POST /api/refresh — exchange refresh token for new access token
router.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: "refreshToken is required" });
  try {
    const r = await pool.query(
      `SELECT rt.*, u.id AS uid, u.name, u.email, u.is_admin
       FROM refresh_tokens rt JOIN users u ON u.id=rt.user_id
       WHERE rt.token=$1 AND rt.revoked=false AND rt.expires_at > now()`,
      [refreshToken]
    );
    if (!r.rows.length) return res.status(401).json({ error: "Invalid or expired refresh token" });
    const row = r.rows[0];
    const user = { id: row.uid, name: row.name, email: row.email, is_admin: row.is_admin };
    const { accessToken, refreshToken: newRefresh } = generateTokens(user);

    // Rotate: revoke old, issue new
    await pool.query("UPDATE refresh_tokens SET revoked=true WHERE id=$1", [row.id]);
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRY_DAYS * 86400 * 1000);
    await pool.query(
      "INSERT INTO refresh_tokens (user_id,token,expires_at) VALUES ($1,$2,$3)",
      [user.id, newRefresh, expiresAt]
    );

    res.json({ token: accessToken, refreshToken: newRefresh });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not refresh token" }); }
});

// POST /api/logout — blocklist the current access token
router.post("/logout", authRequired, async (req, res) => {
  const { refreshToken } = req.body;
  try {
    // Blocklist the access token by its jti
    if (req.user?.jti) {
      const decoded = jwt.decode(req.rawToken);
      const expiresAt = new Date((decoded?.exp || 0) * 1000);
      await pool.query(
        "INSERT INTO token_blocklist (token_jti,expires_at) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [req.user.jti, expiresAt]
      );
    }
    // Revoke refresh token if provided
    if (refreshToken) {
      await pool.query("UPDATE refresh_tokens SET revoked=true WHERE token=$1", [refreshToken]);
    }
    res.json({ loggedOut: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not log out" }); }
});

// GET /api/verify?token=...
router.get("/verify", async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "Token is required" });
  try {
    const r = await pool.query(
      "UPDATE users SET email_verified=true, verification_token=null, verification_expires=null WHERE verification_token=$1 AND verification_expires > now() RETURNING id,name,email",
      [token]
    );
    if (!r.rows.length) return res.status(400).json({ error: "Invalid or expired verification link" });
    res.json({ verified: true, user: r.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not verify email" }); }
});

// POST /api/forgot-password
router.post("/forgot-password", authLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "email is required" });
  try {
    const r = await pool.query("SELECT id,name,email FROM users WHERE email=$1", [email.toLowerCase()]);
    // Always respond OK to prevent email enumeration
    if (!r.rows.length) return res.json({ sent: true });
    const user = r.rows[0];
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await pool.query(
      "UPDATE users SET reset_token=$1, reset_expires=$2 WHERE id=$3",
      [token, expires, user.id]
    );
    sendPasswordResetEmail(user.email, user.name, token).catch(console.error);
    res.json({ sent: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not process request" }); }
});

// POST /api/reset-password
router.post("/reset-password", authLimiter, validate(passwordResetSchema), async (req, res) => {
  const { token, password } = req.body;
  try {
    const r = await pool.query(
      "SELECT id FROM users WHERE reset_token=$1 AND reset_expires > now()",
      [token]
    );
    if (!r.rows.length) return res.status(400).json({ error: "Invalid or expired reset link" });
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      "UPDATE users SET password_hash=$1, reset_token=null, reset_expires=null WHERE id=$2",
      [hash, r.rows[0].id]
    );
    // Revoke all refresh tokens for this user
    await pool.query("UPDATE refresh_tokens SET revoked=true WHERE user_id=$1", [r.rows[0].id]);
    res.json({ reset: true });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not reset password" }); }
});

// GET /api/me
router.get("/me", authRequired, checkBlocklist, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id,name,email,bio,avatar_url,is_admin,email_verified,created_at FROM users WHERE id=$1",
      [req.user.id]
    );
    if (!r.rows.length) return res.status(404).json({ error: "User not found" });
    res.json({ user: r.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not load profile" }); }
});

// PATCH /api/profile
router.patch("/profile", authRequired, checkBlocklist, async (req, res) => {
  const { name, bio, avatar_url } = req.body;
  try {
    const r = await pool.query(
      "UPDATE users SET name=COALESCE($1,name),bio=COALESCE($2,bio),avatar_url=COALESCE($3,avatar_url) WHERE id=$4 RETURNING id,name,email,bio,avatar_url,is_admin,email_verified,created_at",
      [name||null, bio??null, avatar_url??null, req.user.id]
    );
    res.json({ user: r.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not update profile" }); }
});

// GET /api/users/:userId
router.get("/users/:userId", authRequired, checkBlocklist, async (req, res) => {
  try {
    const ur = await pool.query("SELECT id,name,bio,avatar_url,created_at FROM users WHERE id=$1", [req.params.userId]);
    if (!ur.rows.length) return res.status(404).json({ error: "User not found" });
    const user = ur.rows[0];
    const streakR = await pool.query(
      "SELECT DISTINCT DATE(created_at) AS day FROM comments WHERE user_id=$1 ORDER BY day DESC",
      [req.params.userId]
    );
    let streak = 0;
    const today = new Date(); today.setHours(0,0,0,0);
    for (let i = 0; i < streakR.rows.length; i++) {
      const day = new Date(streakR.rows[i].day);
      const expected = new Date(today); expected.setDate(today.getDate() - i);
      if (day.toDateString() === expected.toDateString()) streak++;
      else break;
    }
    const pc = await pool.query("SELECT COUNT(*) FROM posts WHERE user_id=$1", [req.params.userId]);
    const nc = await pool.query("SELECT COUNT(*) FROM comments WHERE user_id=$1 AND parent_id IS NULL", [req.params.userId]);
    res.json({ user: { ...user, streak, post_count: parseInt(pc.rows[0].count), note_count: parseInt(nc.rows[0].count) } });
  } catch (err) { console.error(err); res.status(500).json({ error: "Could not load user" }); }
});

export default router;
