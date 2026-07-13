// server/migrate.js — runs schema.sql against your Neon database
import pg from "pg";
import fs from "fs";
import "dotenv/config";

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = fs.readFileSync(new URL("../schema.sql", import.meta.url), "utf8");

pool
  .query(sql)
  .then(() => {
    console.log("Schema applied successfully.");
    return pool.end();
  })
  .catch((err) => {
    console.error("Migration failed:", err.message);
    process.exit(1);
  });
