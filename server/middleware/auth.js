// server/middleware/auth.js
import jwt from "jsonwebtoken";
import { pool } from "../lib/db.js";
import "dotenv/config";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    req.rawToken = token;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function checkBlocklist(req, res, next) {
  if (!req.user?.jti) return next();
  try {
    const r = await pool.query(
      "SELECT id FROM token_blocklist WHERE token_jti=$1 AND expires_at > now()",
      [req.user.jti]
    );
    if (r.rows.length) return res.status(401).json({ error: "Token has been revoked. Please log in again." });
    next();
  } catch {
    next();
  }
}

export function adminRequired(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: "Admin access required" });
  next();
}
