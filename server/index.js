// server/index.js
import express from "express";
import cors from "cors";
import "dotenv/config";

import { apiLimiter } from "./middleware/rateLimit.js";
import authRoutes    from "./routes/auth.js";
import bibleRoutes   from "./routes/bible.js";
import chapterRoutes from "./routes/chapters.js";
import postRoutes    from "./routes/posts.js";
import groupRoutes   from "./routes/groups.js";
import adminRoutes   from "./routes/admin.js";

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
}));
app.use(express.json());
app.use("/api", apiLimiter);

// Health check
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Routes
app.use("/api", authRoutes);           // signup, login, logout, refresh, verify, forgot/reset-password, me, profile, users/:id
app.use("/api/bible", bibleRoutes);    // /api/bible/:book/:chapter
app.use("/api", chapterRoutes);        // /api/highlights, /api/comments, /api/chapters/:book/:chapter/notes|export
app.use("/api/posts", postRoutes);     // /api/posts, /api/posts/:id, /api/posts/:id/comments, /api/posts/:id/react
app.use("/api/post-comments", postRoutes); // /api/post-comments/:id/react  (reuse posts router)
app.use("/api/groups", groupRoutes);   // /api/groups, /api/groups/:id/join|leave|members
app.use("/api/admin", adminRoutes);    // /api/admin/flags|posts|comments|users|screen

// Content screening endpoint (used by frontend before submit)
import { moderateContent } from "./lib/moderation.js";
import { authRequired, checkBlocklist } from "./middleware/auth.js";
app.post("/api/screen", authRequired, checkBlocklist, async (req, res) => {
  const { text, context } = req.body;
  if (!text) return res.status(400).json({ error: "text is required" });
  const result = await moderateContent(text, context || "post");
  res.json(result);
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
