// server/routes/bible.js
import { Router } from "express";
import { bibleCache } from "../lib/db.js";
import { authRequired, checkBlocklist } from "../middleware/auth.js";

const router = Router();
const BIBLE_API = "https://bible-api.com";
const VERSIONS = ["kjv","asv","web","ylt","darby","webbe"];

// GET /api/bible/:book/:chapter — fetch all 6 versions, cached server-side
router.get("/:book/:chapter", authRequired, checkBlocklist, async (req, res) => {
  const { book, chapter } = req.params;
  const { version } = req.query;
  const versionsToFetch = version ? [version] : VERSIONS;
  const results = {};

  await Promise.all(versionsToFetch.map(async (v) => {
    const cacheKey = `bible:${book}:${chapter}:${v}`;
    const cached = bibleCache.get(cacheKey);
    if (cached) { results[v] = cached; return; }

    try {
      const ref = encodeURIComponent(`${book} ${chapter}`);
      const r = await fetch(`${BIBLE_API}/${ref}?translation=${v}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      const verses = (data.verses || []).map(v => ({ verse: v.verse, text: v.text.trim() }));
      bibleCache.set(cacheKey, verses);
      results[v] = verses;
    } catch (err) {
      results[v] = { error: err.message };
    }
  }));

  res.json({ results });
});

export default router;
