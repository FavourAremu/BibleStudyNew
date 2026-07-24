// server/lib/db.js
import pg from "pg";
import NodeCache from "node-cache";
import "dotenv/config";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => console.error("DB pool error:", err));

// In-memory cache for Bible text (24h TTL)
export const bibleCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });
