// server/index.js
import express from "express";
import cors from "cors";
import pg from "pg";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import "dotenv/config";

const { Pool } = pg;
const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*" }));
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_EXPIRY = "30d";

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: "Invalid or expired token" }); }
}

// AUTH
app.post("/api/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name||!email||!password) return res.status(400).json({ error: "name, email and password are required" });
  try {
    const existing = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
    if (existing.rows.length) return res.status(409).json({ error: "An account with that email already exists" });
    const hash = await bcrypt.hash(password, 10);
    const r = await pool.query(
      "INSERT INTO users (name,email,password_hash) VALUES ($1,$2,$3) RETURNING id,name,email,bio,avatar_url,created_at",
      [name,email,hash]
    );
    const user = r.rows[0];
    const token = jwt.sign({ id:user.id,name:user.name,email:user.email }, JWT_SECRET, { expiresIn:TOKEN_EXPIRY });
    res.json({ token, user });
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not create account" }); }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email||!password) return res.status(400).json({ error:"email and password are required" });
  try {
    const r = await pool.query("SELECT id,name,email,password_hash,bio,avatar_url,created_at FROM users WHERE email=$1",[email]);
    const user = r.rows[0];
    if (!user) return res.status(401).json({ error:"Invalid email or password" });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error:"Invalid email or password" });
    const token = jwt.sign({ id:user.id,name:user.name,email:user.email }, JWT_SECRET, { expiresIn:TOKEN_EXPIRY });
    const { password_hash, ...safe } = user;
    res.json({ token, user:safe });
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not log in" }); }
});

app.get("/api/me", authRequired, async (req, res) => {
  try {
    const r = await pool.query("SELECT id,name,email,bio,avatar_url,created_at FROM users WHERE id=$1",[req.user.id]);
    if (!r.rows.length) return res.status(404).json({ error:"User not found" });
    res.json({ user:r.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not load profile" }); }
});

// PROFILE
app.patch("/api/profile", authRequired, async (req, res) => {
  const { name, bio, avatar_url } = req.body;
  try {
    const r = await pool.query(
      "UPDATE users SET name=COALESCE($1,name),bio=COALESCE($2,bio),avatar_url=COALESCE($3,avatar_url) WHERE id=$4 RETURNING id,name,email,bio,avatar_url,created_at",
      [name||null, bio??null, avatar_url??null, req.user.id]
    );
    res.json({ user:r.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not update profile" }); }
});

app.get("/api/users/:userId", authRequired, async (req, res) => {
  try {
    const ur = await pool.query("SELECT id,name,bio,avatar_url,created_at FROM users WHERE id=$1",[req.params.userId]);
    if (!ur.rows.length) return res.status(404).json({ error:"User not found" });
    const user = ur.rows[0];
    const streakR = await pool.query(
      "SELECT DISTINCT DATE(created_at) AS day FROM comments WHERE user_id=$1 ORDER BY day DESC",[req.params.userId]
    );
    let streak=0;
    const today=new Date(); today.setHours(0,0,0,0);
    for (let i=0;i<streakR.rows.length;i++) {
      const day=new Date(streakR.rows[i].day);
      const expected=new Date(today); expected.setDate(today.getDate()-i);
      if (day.toDateString()===expected.toDateString()) streak++;
      else break;
    }
    const pc = await pool.query("SELECT COUNT(*) FROM posts WHERE user_id=$1",[req.params.userId]);
    const nc = await pool.query("SELECT COUNT(*) FROM comments WHERE user_id=$1 AND parent_id IS NULL",[req.params.userId]);
    res.json({ user:{ ...user, streak, post_count:parseInt(pc.rows[0].count), note_count:parseInt(nc.rows[0].count) } });
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not load user" }); }
});

// VERSE HELPER
async function getOrCreateVerse(book,chapter,verse) {
  const ex=await pool.query("SELECT id FROM verses WHERE book=$1 AND chapter=$2 AND verse=$3",[book,chapter,verse]);
  if (ex.rows.length) return ex.rows[0].id;
  const ins=await pool.query(
    "INSERT INTO verses (book,chapter,verse) VALUES ($1,$2,$3) ON CONFLICT (book,chapter,verse) DO UPDATE SET book=EXCLUDED.book RETURNING id",
    [book,chapter,verse]
  );
  return ins.rows[0].id;
}

// HIGHLIGHTS
app.post("/api/highlights", authRequired, async (req, res) => {
  const { book,chapter,verse,version,quote,color } = req.body;
  if (!book||!chapter||!verse||!version||!quote) return res.status(400).json({ error:"book,chapter,verse,version,quote required" });
  try {
    const verseId=await getOrCreateVerse(book,chapter,verse);
    const r=await pool.query(
      "INSERT INTO highlights (user_id,verse_id,version,quote,color) VALUES ($1,$2,$3,$4,$5) RETURNING id,verse_id,version,quote,color,created_at",
      [req.user.id,verseId,version,quote,color||"#fbeec1"]
    );
    res.json({ highlight:r.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not save highlight" }); }
});

// MARGIN COMMENTS
app.post("/api/comments", authRequired, async (req, res) => {
  const { book,chapter,verse,highlightId,body,parentId,groupId } = req.body;
  if (!book||!chapter||!verse||!body) return res.status(400).json({ error:"book,chapter,verse,body required" });
  try {
    const verseId=await getOrCreateVerse(book,chapter,verse);
    const r=await pool.query(
      "INSERT INTO comments (user_id,verse_id,highlight_id,body,parent_id,group_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,verse_id,highlight_id,body,parent_id,group_id,created_at",
      [req.user.id,verseId,highlightId||null,body,parentId||null,groupId||null]
    );
    res.json({ comment:{ ...r.rows[0],author:req.user.name,author_id:req.user.id } });
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not save comment" }); }
});

app.get("/api/comments/:id/replies", authRequired, async (req, res) => {
  try {
    const r=await pool.query(
      "SELECT c.id,c.body,c.parent_id,c.created_at,u.name AS author,u.id AS author_id,u.avatar_url FROM comments c JOIN users u ON u.id=c.user_id WHERE c.parent_id=$1 ORDER BY c.created_at ASC",
      [req.params.id]
    );
    res.json({ replies:await attachReactions(r.rows,req.user.id) });
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not load replies" }); }
});

app.post("/api/comments/:id/react", authRequired, async (req, res) => {
  const { type }=req.body;
  if (!["amen","pray","heart"].includes(type)) return res.status(400).json({ error:"Invalid type" });
  try {
    const ex=await pool.query("SELECT id FROM reactions WHERE user_id=$1 AND comment_id=$2 AND type=$3",[req.user.id,req.params.id,type]);
    if (ex.rows.length) { await pool.query("DELETE FROM reactions WHERE id=$1",[ex.rows[0].id]); res.json({ toggled:"off",type }); }
    else { await pool.query("INSERT INTO reactions (user_id,comment_id,type) VALUES ($1,$2,$3)",[req.user.id,req.params.id,type]); res.json({ toggled:"on",type }); }
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not react" }); }
});

async function attachReactions(rows,userId) {
  if (!rows.length) return rows;
  const ids=rows.map(r=>r.id);
  const counts=await pool.query("SELECT comment_id,type,COUNT(*) AS count FROM reactions WHERE comment_id=ANY($1) GROUP BY comment_id,type",[ids]);
  const mine  =await pool.query("SELECT comment_id,type FROM reactions WHERE comment_id=ANY($1) AND user_id=$2",[ids,userId]);
  const cm={}; for(const r of counts.rows){if(!cm[r.comment_id])cm[r.comment_id]={};cm[r.comment_id][r.type]=parseInt(r.count);}
  const ms=new Set(mine.rows.map(r=>`${r.comment_id}:${r.type}`));
  return rows.map(c=>({...c,reactions:{
    amen: {count:cm[c.id]?.amen ||0,mine:ms.has(`${c.id}:amen`) },
    pray: {count:cm[c.id]?.pray ||0,mine:ms.has(`${c.id}:pray`) },
    heart:{count:cm[c.id]?.heart||0,mine:ms.has(`${c.id}:heart`)},
  }}));
}

// CHAPTER NOTES
app.get("/api/chapters/:book/:chapter/notes", authRequired, async (req, res) => {
  const { book,chapter }=req.params; const { groupId }=req.query;
  try {
    const r=await pool.query(
      "SELECT v.verse AS verse_number,c.id,c.id AS comment_id,c.body AS comment,c.parent_id,c.created_at,u.name AS author,u.id AS author_id,u.avatar_url,h.version,h.quote FROM comments c JOIN verses v ON v.id=c.verse_id JOIN users u ON u.id=c.user_id LEFT JOIN highlights h ON h.id=c.highlight_id WHERE v.book=$1 AND v.chapter=$2 AND c.parent_id IS NULL AND ($3::uuid IS NULL OR c.group_id=$3) ORDER BY v.verse ASC,c.created_at ASC",
      [book,parseInt(chapter,10),groupId||null]
    );
    res.json({ notes:await attachReactions(r.rows,req.user.id) });
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not load chapter notes" }); }
});

// EXPORT
app.get("/api/chapters/:book/:chapter/export", authRequired, async (req, res) => {
  const { book,chapter }=req.params; const format=req.query.format==="txt"?"txt":"md";
  try {
    const r=await pool.query(
      "SELECT v.verse AS verse_number,c.body AS comment,c.created_at,u.name AS author,h.version,h.quote FROM comments c JOIN verses v ON v.id=c.verse_id JOIN users u ON u.id=c.user_id LEFT JOIN highlights h ON h.id=c.highlight_id WHERE v.book=$1 AND v.chapter=$2 ORDER BY v.verse ASC,c.created_at ASC",
      [book,parseInt(chapter,10)]
    );
    let out=`${book} ${chapter} — Study Notes\n${"=".repeat(40)}\n\n`,lv=null;
    for(const row of r.rows){
      if(row.verse_number!==lv){out+=`\nVerse ${row.verse_number}\n`;lv=row.verse_number;}
      if(row.quote)out+=`  [${row.version}] "${row.quote}"\n`;
      out+=`  - ${row.author}: ${row.comment}\n`;
    }
    if(!r.rows.length)out+="(No notes yet for this chapter.)\n";
    res.setHeader("Content-Type",format==="txt"?"text/plain":"text/markdown");
    res.setHeader("Content-Disposition",`attachment; filename="${book}-${chapter}-notes.${format}"`);
    res.send(out);
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not export" }); }
});

// GROUPS
app.get("/api/groups", authRequired, async (req, res) => {
  try {
    const r=await pool.query(
      "SELECT g.id,g.name,g.description,g.created_at,u.name AS created_by_name,(SELECT COUNT(*) FROM group_members gm WHERE gm.group_id=g.id) AS member_count,(SELECT role FROM group_members gm WHERE gm.group_id=g.id AND gm.user_id=$1) AS my_role FROM groups g JOIN users u ON u.id=g.created_by ORDER BY g.created_at DESC",
      [req.user.id]
    );
    res.json({ groups:r.rows });
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not load groups" }); }
});

app.post("/api/groups", authRequired, async (req, res) => {
  const { name,description }=req.body;
  if (!name) return res.status(400).json({ error:"name is required" });
  try {
    const r=await pool.query("INSERT INTO groups (name,description,created_by) VALUES ($1,$2,$3) RETURNING id,name,description,created_at",[name,description||"",req.user.id]);
    const group=r.rows[0];
    await pool.query("INSERT INTO group_members (group_id,user_id,role) VALUES ($1,$2,'admin')",[group.id,req.user.id]);
    res.json({ group:{ ...group,created_by_name:req.user.name,member_count:1,my_role:"admin" } });
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not create group" }); }
});

app.post("/api/groups/:groupId/join", authRequired, async (req, res) => {
  try {
    const ex=await pool.query("SELECT * FROM group_members WHERE group_id=$1 AND user_id=$2",[req.params.groupId,req.user.id]);
    if (ex.rows.length) return res.status(409).json({ error:"Already a member" });
    await pool.query("INSERT INTO group_members (group_id,user_id,role) VALUES ($1,$2,'member')",[req.params.groupId,req.user.id]);
    res.json({ joined:true });
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not join group" }); }
});

app.post("/api/groups/:groupId/leave", authRequired, async (req, res) => {
  try {
    await pool.query("DELETE FROM group_members WHERE group_id=$1 AND user_id=$2",[req.params.groupId,req.user.id]);
    res.json({ left:true });
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not leave group" }); }
});

app.get("/api/groups/:groupId/members", authRequired, async (req, res) => {
  try {
    const r=await pool.query(
      "SELECT u.id,u.name,u.avatar_url,gm.role,gm.joined_at FROM group_members gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=$1 ORDER BY gm.joined_at ASC",
      [req.params.groupId]
    );
    res.json({ members:r.rows });
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not load members" }); }
});

// FEED
app.get("/api/posts", authRequired, async (req, res) => {
  const page=Math.max(1,parseInt(req.query.page||"1",10));
  const limit=Math.min(50,parseInt(req.query.limit||"20",10));
  const offset=(page-1)*limit; const { groupId }=req.query;
  try {
    const r=await pool.query(
      "SELECT p.id,p.title,p.body,p.created_at,p.group_id,u.name AS author,u.id AS author_id,u.avatar_url,v.book,v.chapter,v.verse,g.name AS group_name,(SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id=p.id) AS comment_count FROM posts p JOIN users u ON u.id=p.user_id LEFT JOIN verses v ON v.id=p.verse_id LEFT JOIN groups g ON g.id=p.group_id WHERE ($3::uuid IS NULL OR p.group_id=$3) ORDER BY p.created_at DESC LIMIT $1 OFFSET $2",
      [limit,offset,groupId||null]
    );
    const posts=await attachPostReactions(r.rows,req.user.id);
    const total=await pool.query("SELECT COUNT(*) FROM posts WHERE ($1::uuid IS NULL OR group_id=$1)",[groupId||null]);
    res.json({ posts,total:parseInt(total.rows[0].count),page,limit });
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not load posts" }); }
});

app.post("/api/posts", authRequired, async (req, res) => {
  const { title,body,book,chapter,verse,groupId }=req.body;
  if (!title||!body) return res.status(400).json({ error:"title and body are required" });
  try {
    let verseId=null;
    if(book&&chapter&&verse) verseId=await getOrCreateVerse(book,chapter,verse);
    const r=await pool.query(
      "INSERT INTO posts (user_id,verse_id,title,body,group_id) VALUES ($1,$2,$3,$4,$5) RETURNING id,title,body,created_at,group_id",
      [req.user.id,verseId,title,body,groupId||null]
    );
    res.json({ post:{ ...r.rows[0],author:req.user.name,author_id:req.user.id,comment_count:0,
      reactions:{ amen:{count:0,mine:false},pray:{count:0,mine:false},heart:{count:0,mine:false} } } });
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not create post" }); }
});

app.get("/api/posts/:id", authRequired, async (req, res) => {
  try {
    const pr=await pool.query(
      "SELECT p.id,p.title,p.body,p.created_at,p.group_id,u.name AS author,u.id AS author_id,u.avatar_url,v.book,v.chapter,v.verse,g.name AS group_name FROM posts p JOIN users u ON u.id=p.user_id LEFT JOIN verses v ON v.id=p.verse_id LEFT JOIN groups g ON g.id=p.group_id WHERE p.id=$1",
      [req.params.id]
    );
    if (!pr.rows.length) return res.status(404).json({ error:"Post not found" });
    const [post]=await attachPostReactions(pr.rows,req.user.id);
    const cr=await pool.query(
      "SELECT pc.id,pc.body,pc.parent_id,pc.created_at,u.name AS author,u.id AS author_id,u.avatar_url FROM post_comments pc JOIN users u ON u.id=pc.user_id WHERE pc.post_id=$1 ORDER BY pc.created_at ASC",
      [req.params.id]
    );
    res.json({ post,comments:await attachPostCommentReactions(cr.rows,req.user.id) });
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not load post" }); }
});

app.post("/api/posts/:id/comments", authRequired, async (req, res) => {
  const { body,parentId }=req.body;
  if (!body) return res.status(400).json({ error:"body is required" });
  try {
    const r=await pool.query(
      "INSERT INTO post_comments (post_id,user_id,body,parent_id) VALUES ($1,$2,$3,$4) RETURNING id,body,parent_id,created_at",
      [req.params.id,req.user.id,body,parentId||null]
    );
    res.json({ comment:{ ...r.rows[0],author:req.user.name,author_id:req.user.id,
      reactions:{ amen:{count:0,mine:false},pray:{count:0,mine:false},heart:{count:0,mine:false} } } });
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not add comment" }); }
});

app.post("/api/posts/:id/react", authRequired, async (req, res) => {
  const { type }=req.body;
  if (!["amen","pray","heart"].includes(type)) return res.status(400).json({ error:"Invalid type" });
  try {
    const ex=await pool.query("SELECT id FROM post_reactions WHERE user_id=$1 AND post_id=$2 AND type=$3",[req.user.id,req.params.id,type]);
    if (ex.rows.length) { await pool.query("DELETE FROM post_reactions WHERE id=$1",[ex.rows[0].id]); res.json({ toggled:"off",type }); }
    else { await pool.query("INSERT INTO post_reactions (user_id,post_id,type) VALUES ($1,$2,$3)",[req.user.id,req.params.id,type]); res.json({ toggled:"on",type }); }
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not react" }); }
});

app.post("/api/post-comments/:id/react", authRequired, async (req, res) => {
  const { type }=req.body;
  if (!["amen","pray","heart"].includes(type)) return res.status(400).json({ error:"Invalid type" });
  try {
    const ex=await pool.query("SELECT id FROM post_comment_reactions WHERE user_id=$1 AND comment_id=$2 AND type=$3",[req.user.id,req.params.id,type]);
    if (ex.rows.length) { await pool.query("DELETE FROM post_comment_reactions WHERE id=$1",[ex.rows[0].id]); res.json({ toggled:"off",type }); }
    else { await pool.query("INSERT INTO post_comment_reactions (user_id,comment_id,type) VALUES ($1,$2,$3)",[req.user.id,req.params.id,type]); res.json({ toggled:"on",type }); }
  } catch(err) { console.error(err); res.status(500).json({ error:"Could not react" }); }
});

async function attachPostReactions(posts,userId) {
  if (!posts.length) return posts;
  const ids=posts.map(p=>p.id);
  const counts=await pool.query("SELECT post_id,type,COUNT(*) AS count FROM post_reactions WHERE post_id=ANY($1) GROUP BY post_id,type",[ids]);
  const mine  =await pool.query("SELECT post_id,type FROM post_reactions WHERE post_id=ANY($1) AND user_id=$2",[ids,userId]);
  const cm={}; for(const r of counts.rows){if(!cm[r.post_id])cm[r.post_id]={};cm[r.post_id][r.type]=parseInt(r.count);}
  const ms=new Set(mine.rows.map(r=>`${r.post_id}:${r.type}`));
  return posts.map(p=>({...p,reactions:{
    amen: {count:cm[p.id]?.amen ||0,mine:ms.has(`${p.id}:amen`) },
    pray: {count:cm[p.id]?.pray ||0,mine:ms.has(`${p.id}:pray`) },
    heart:{count:cm[p.id]?.heart||0,mine:ms.has(`${p.id}:heart`)},
  }}));
}

async function attachPostCommentReactions(comments,userId) {
  if (!comments.length) return comments;
  const ids=comments.map(c=>c.id);
  const counts=await pool.query("SELECT comment_id,type,COUNT(*) AS count FROM post_comment_reactions WHERE comment_id=ANY($1) GROUP BY comment_id,type",[ids]);
  const mine  =await pool.query("SELECT comment_id,type FROM post_comment_reactions WHERE comment_id=ANY($1) AND user_id=$2",[ids,userId]);
  const cm={}; for(const r of counts.rows){if(!cm[r.comment_id])cm[r.comment_id]={};cm[r.comment_id][r.type]=parseInt(r.count);}
  const ms=new Set(mine.rows.map(r=>`${r.comment_id}:${r.type}`));
  return comments.map(c=>({...c,reactions:{
    amen: {count:cm[c.id]?.amen ||0,mine:ms.has(`${c.id}:amen`) },
    pray: {count:cm[c.id]?.pray ||0,mine:ms.has(`${c.id}:pray`) },
    heart:{count:cm[c.id]?.heart||0,mine:ms.has(`${c.id}:heart`)},
  }}));
}

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API listening on port ${PORT}`));
