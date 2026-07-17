import React, { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000/api";

const VERSIONS = [
  { code:"KJV", name:"King James Version" },
  { code:"ASV", name:"American Standard Version" },
  { code:"WEB", name:"World English Bible" },
  { code:"YLT", name:"Young's Literal Translation" },
  { code:"DBY", name:"Darby Translation" },
  { code:"WBS", name:"Webster's Bible" },
];

const MOCK_VERSES = {
  KJV:["For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.","For God sent not his Son into the world to condemn the world; but that the world through him might be saved.","He that believeth on him is not condemned: but he that believeth not is condemned already, because he hath not believed in the name of the only begotten Son of God."],
  ASV:["For God so loved the world, that he gave his only begotten Son, that whosoever believeth on him should not perish, but have eternal life.","For God sent not the Son into the world to judge the world; but that the world should be saved through him.","He that believeth on him is not judged: he that believeth not hath been judged already, because he hath not believed on the name of the only begotten Son of God."],
  WEB:["For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.","For God didn't send his Son into the world to judge the world, but that the world should be saved through him.","He who believes in him is not judged. He who doesn't believe has been judged already, because he has not believed in the name of the only born Son of God."],
  YLT:["for God did so love the world, that His Son the only begotten He gave, that every one who is believing in him may not perish, but may have life age-during.","for God did not send His Son to the world that he may judge the world, but that the world may be saved through him.","He who is believing in him is not judged, but he who is not believing hath been judged already, because he hath not believed in the name of the only begotten Son of God."],
  DBY:["For God so loved the world, that he has given the only-begotten Son, that whosoever believes on him may not perish, but have life eternal.","For God has not sent his Son into the world that he may judge the world, but that the world might be saved through him.","He that believes on him is not judged: but he that believes not has been already judged, because he has not believed on the name of the only-begotten Son of God."],
  WBS:["For God so loved the world, that he gave his only begotten Son, that whoever believeth in him should not perish, but have everlasting life.","For God sent not his Son into the world to condemn the world; but that the world through him may be saved.","He that believeth in him is not condemned: but he that believeth not is condemned already, because he hath not believed in the name of the only begotten Son of God."],
};

const BOOK="John", CHAPTER=3, CHAPTER_REF="John 3:16–18";
const RXNS=[{type:"amen",emoji:"🙏",label:"Amen"},{type:"pray",emoji:"✝️",label:"Pray"},{type:"heart",emoji:"❤️",label:"Heart"}];

function Avatar({ name, url, size=36 }) {
  if (url) return <img src={url} alt={name} style={{ width:size,height:size,borderRadius:"50%",objectFit:"cover" }}/>;
  return (
    <div style={{ width:size,height:size,borderRadius:"50%",background:"#a9762f",color:"#fff",
      display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.4,fontWeight:600,flexShrink:0 }}>
      {name?.[0]?.toUpperCase()||"?"}
    </div>
  );
}

function timeAgo(ts) {
  const s=Math.floor((Date.now()-new Date(ts))/1000);
  if(s<60)return"just now"; if(s<3600)return`${Math.floor(s/60)}m ago`;
  if(s<86400)return`${Math.floor(s/3600)}h ago`; return`${Math.floor(s/86400)}d ago`;
}

export default function App() {
  const [screen,setScreen]=useState("auth");
  const [tab,setTab]=useState("reader");
  const [authMode,setAuthMode]=useState("login");
  const [form,setForm]=useState({name:"",email:"",password:""});
  const [authError,setAuthError]=useState("");
  const [authLoading,setAuthLoading]=useState(false);
  const [token,setToken]=useState(null);
  const [user,setUser]=useState(null);

  async function api(path,opts={}) {
    const res=await fetch(`${API_BASE}${path}`,{
      ...opts,
      headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{}),...(opts.headers||{})},
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||"Request failed");
    return data;
  }

  async function handleAuth(e) {
    e.preventDefault(); setAuthError(""); setAuthLoading(true);
    try {
      const path=authMode==="login"?"/login":"/signup";
      const body=authMode==="login"?{email:form.email,password:form.password}:{name:form.name,email:form.email,password:form.password};
      const data=await api(path,{method:"POST",body:JSON.stringify(body)});
      setToken(data.token); setUser(data.user); setScreen("app");
    } catch(err){setAuthError(err.message);}
    finally{setAuthLoading(false);}
  }

  function logout(){setToken(null);setUser(null);setScreen("auth");}

  if(screen==="auth") return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"linear-gradient(180deg,#2b2419,#1b1712)",fontFamily:"Georgia,serif",padding:24}}>
      <form onSubmit={handleAuth} style={{width:"100%",maxWidth:380,background:"#f3ecd9",color:"#2b2419",borderRadius:4,padding:"40px 32px",boxShadow:"0 20px 60px rgba(0,0,0,0.45)",position:"relative"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:6,background:"#a9762f"}}/>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:13,letterSpacing:"0.3em",color:"#a9762f",marginBottom:6}}>MARGINALIA</div>
          <h1 style={{fontSize:28,margin:0,fontWeight:400}}>{authMode==="login"?"Welcome back":"Begin your study"}</h1>
          <p style={{fontSize:13,color:"#6b5d45",marginTop:8}}>Read scripture side-by-side, write in the margins, share what you find.</p>
        </div>
        {authMode==="signup"&&<label style={S.label}>Name<input style={S.input} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your name" required/></label>}
        <label style={S.label}>Email<input style={S.input} type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com" required/></label>
        <label style={S.label}>Password<input style={S.input} type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="••••••••" required minLength={6}/></label>
        {authError&&<div style={{color:"#b3422f",fontSize:12.5,marginBottom:10}}>{authError}</div>}
        <button type="submit" style={S.primaryBtn} disabled={authLoading}>{authLoading?"Please wait…":authMode==="login"?"Log in":"Create account"}</button>
        <div style={{textAlign:"center",marginTop:18,fontSize:13}}>
          {authMode==="login"?<>New here? <a style={S.link} onClick={()=>{setAuthMode("signup");setAuthError("");}}>Create an account</a></>
          :<>Already have an account? <a style={S.link} onClick={()=>{setAuthMode("login");setAuthError("");}}>Log in</a></>}
        </div>
      </form>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:"#f7f3e8",fontFamily:"Georgia,serif",color:"#2b2419"}}>
      <div style={{background:"#2b2419",color:"#f3ecd9",padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div style={{fontSize:13,letterSpacing:"0.3em",color:"#c9a35c",fontWeight:600}}>MARGINALIA</div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          {["reader","feed","groups","profile"].map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{...S.tabBtn,background:tab===t?"#a9762f":"transparent",color:tab===t?"#fff":"#d8cdb4"}}>
              {t==="reader"?"📖 Reader":t==="feed"?"🌐 Community":t==="groups"?"👥 Groups":"👤 Profile"}
            </button>
          ))}
          <button style={S.ghostBtn} onClick={logout}>Log out</button>
        </div>
      </div>
      {tab==="reader"&&<ReaderTab api={api} user={user} token={token}/>}
      {tab==="feed"&&<FeedTab api={api} user={user}/>}
      {tab==="groups"&&<GroupsTab api={api} user={user}/>}
      {tab==="profile"&&<ProfileTab api={api} user={user} setUser={setUser}/>}
    </div>
  );
}

// ── READER TAB ────────────────────────────────────────────────────
function ReaderTab({api,user,token}) {
  const [notes,setNotes]=useState([]);
  const [notesLoading,setNotesLoading]=useState(false);
  const [notesError,setNotesError]=useState("");
  const [activeSelection,setActiveSelection]=useState(null);
  const [draft,setDraft]=useState("");
  const [saving,setSaving]=useState(false);
  const [showExport,setShowExport]=useState(false);
  const [replyState,setReplyState]=useState({});

  useEffect(()=>{
    setNotesLoading(true);
    api(`/chapters/${BOOK}/${CHAPTER}/notes`).then(d=>setNotes(d.notes||[])).catch(e=>setNotesError(e.message)).finally(()=>setNotesLoading(false));
  },[]);

  const handleSelect=(version,vi)=>{
    const sel=window.getSelection?.().toString().trim();
    if(!sel)return;
    setActiveSelection({version,verseIndex:vi,quote:sel}); setDraft("");
  };

  async function saveNote(){
    if(!activeSelection||!draft.trim())return;
    setSaving(true);
    try{
      const vn=16+activeSelection.verseIndex;
      const {highlight}=await api("/highlights",{method:"POST",body:JSON.stringify({book:BOOK,chapter:CHAPTER,verse:vn,version:activeSelection.version,quote:activeSelection.quote})});
      const {comment}=await api("/comments",{method:"POST",body:JSON.stringify({book:BOOK,chapter:CHAPTER,verse:vn,highlightId:highlight.id,body:draft.trim()})});
      setNotes(prev=>[...prev,{id:comment.id,comment_id:comment.id,verse_number:vn,comment:comment.body,author:user?.name,author_id:user?.id,version:highlight.version,quote:highlight.quote,reactions:{amen:{count:0,mine:false},pray:{count:0,mine:false},heart:{count:0,mine:false}}}]);
      setActiveSelection(null); setDraft("");
    }catch(e){setNotesError(e.message);}
    finally{setSaving(false);}
  }

  async function handleReact(commentId,type){
    try{
      const data=await api(`/comments/${commentId}/react`,{method:"POST",body:JSON.stringify({type})});
      setNotes(prev=>prev.map(n=>n.id!==commentId?n:{...n,reactions:{...n.reactions,[type]:{count:n.reactions[type].count+(data.toggled==="on"?1:-1),mine:data.toggled==="on"}}}));
    }catch(e){setNotesError(e.message);}
  }

  function toggleReply(id){
    setReplyState(prev=>({...prev,[id]:{open:!prev[id]?.open,text:prev[id]?.text||"",replies:prev[id]?.replies}}));
    if(!replyState[id]?.open&&!replyState[id]?.replies)
      api(`/comments/${id}/replies`).then(d=>setReplyState(prev=>({...prev,[id]:{...prev[id],replies:d.replies||[]}}))).catch(()=>{});
  }

  async function submitReply(commentId){
    const text=replyState[commentId]?.text?.trim();
    if(!text)return;
    const note=notes.find(n=>n.id===commentId); if(!note)return;
    setReplyState(prev=>({...prev,[commentId]:{...prev[commentId],loading:true}}));
    try{
      const {comment}=await api("/comments",{method:"POST",body:JSON.stringify({book:BOOK,chapter:CHAPTER,verse:note.verse_number,parentId:commentId,body:text})});
      setReplyState(prev=>({...prev,[commentId]:{...prev[commentId],text:"",loading:false,replies:[...(prev[commentId]?.replies||[]),{...comment,reactions:{amen:{count:0,mine:false},pray:{count:0,mine:false},heart:{count:0,mine:false}}}]}}));
    }catch(e){setNotesError(e.message);setReplyState(prev=>({...prev,[commentId]:{...prev[commentId],loading:false}}));}
  }

  async function downloadExport(format){
    try{
      const res=await fetch(`${API_BASE}/chapters/${BOOK}/${CHAPTER}/export?format=${format}`,{headers:{Authorization:`Bearer ${token}`}});
      if(!res.ok)throw new Error("Export failed");
      const blob=await res.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url; a.download=`${BOOK}-${CHAPTER}-notes.${format}`; a.click(); URL.revokeObjectURL(url);
    }catch(e){setNotesError(e.message);}
  }

  const verseHasNotes=vi=>notes.some(n=>n.verse_number===16+vi);

  return(
    <div>
      <div style={{background:"#2b2419",color:"#f3ecd9",padding:"10px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{fontSize:18}}>{CHAPTER_REF}</div>
        <button style={S.ghostBtn} onClick={()=>setShowExport(true)}>Export chapter notes</button>
      </div>
      {notesError&&<div style={{background:"#f6dede",color:"#8a3b2a",padding:"8px 24px",fontSize:13}}>{notesError}</div>}
      <div style={{display:"flex"}}>
        <div style={{flex:"1 1 0",minWidth:0,padding:24,display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}>
          {VERSIONS.map(v=>(
            <div key={v.code} style={{background:"#fffdf6",border:"1px solid #e3d8bf",borderRadius:4,padding:"16px 18px",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
              <div style={{fontSize:11,letterSpacing:"0.2em",color:"#a9762f",marginBottom:10,borderBottom:"1px solid #ecdfc4",paddingBottom:6,display:"flex",justifyContent:"space-between"}}>
                <span>{v.code}</span><span style={{color:"#bdb097",fontStyle:"italic",letterSpacing:"normal"}}>{v.name}</span>
              </div>
              {MOCK_VERSES[v.code].map((text,vi)=>(
                <p key={vi} onMouseUp={()=>handleSelect(v.code,vi)}
                  style={{margin:"0 0 10px 0",fontSize:15.5,lineHeight:1.6,cursor:"text",background:verseHasNotes(vi)?"#fbeec1":"transparent",padding:verseHasNotes(vi)?"2px 4px":0,borderRadius:2}}>
                  <sup style={{color:"#a9762f",fontSize:11,marginRight:4}}>{16+vi}</sup>{text}
                </p>
              ))}
            </div>
          ))}
        </div>
        <div style={{width:340,flexShrink:0,borderLeft:"1px solid #e3d8bf",minHeight:"calc(100vh - 100px)",padding:"24px 18px",background:"#fbf6ea"}}>
          <div style={{fontSize:11,letterSpacing:"0.2em",color:"#a9762f",marginBottom:14}}>MARGIN NOTES — {notesLoading?"…":notes.length}</div>
          {activeSelection&&(
            <div style={{background:"#fffdf6",border:"1px solid #c9a35c",borderRadius:4,padding:12,marginBottom:16}}>
              <div style={{fontSize:12,color:"#6b5d45",marginBottom:6}}>Selected ({activeSelection.version}, v.{16+activeSelection.verseIndex}):</div>
              <div style={{fontSize:13,fontStyle:"italic",marginBottom:8}}>"{activeSelection.quote}"</div>
              <textarea autoFocus value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Write your note or question…"
                style={{width:"100%",minHeight:70,fontFamily:"inherit",fontSize:13,padding:8,border:"1px solid #e3d8bf",borderRadius:3,resize:"vertical",boxSizing:"border-box"}}/>
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <button style={S.primaryBtnSm} onClick={saveNote} disabled={saving}>{saving?"Saving…":"Add note"}</button>
                <button style={S.ghostBtnSm} onClick={()=>{setActiveSelection(null);setDraft("");}}>Cancel</button>
              </div>
            </div>
          )}
          {!notesLoading&&notes.length===0&&!activeSelection&&(
            <div style={{fontSize:13,color:"#9a8c6f",lineHeight:1.6}}>Highlight any phrase in a verse to write a note here.</div>
          )}
          {notes.slice().sort((a,b)=>a.verse_number-b.verse_number).map(n=>{
            const rs=replyState[n.id]||{};
            return(
              <div key={n.id} style={{marginBottom:18}}>
                <div style={{borderLeft:"3px solid #c9a35c",paddingLeft:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                    <Avatar name={n.author} url={n.avatar_url} size={22}/>
                    <span style={{fontSize:11,color:"#a9762f"}}>v.{n.verse_number} · {n.version} · {n.author}</span>
                  </div>
                  {n.quote&&<div style={{fontSize:12.5,fontStyle:"italic",color:"#6b5d45",margin:"2px 0"}}>"{n.quote}"</div>}
                  <div style={{fontSize:13.5,lineHeight:1.5}}>{n.comment}</div>
                  <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"}}>
                    {RXNS.map(({type,emoji,label})=>{
                      const r=n.reactions?.[type]||{count:0,mine:false};
                      return(<button key={type} onClick={()=>handleReact(n.id,type)}
                        style={{background:r.mine?"#fbeec1":"#f0ebe0",border:r.mine?"1px solid #c9a35c":"1px solid #e3d8bf",borderRadius:20,padding:"3px 10px",fontSize:12,cursor:"pointer",color:"#5a4a2f"}}>
                        {emoji} {label}{r.count>0&&<b> {r.count}</b>}
                      </button>);
                    })}
                    <button onClick={()=>toggleReply(n.id)}
                      style={{background:"transparent",border:"1px solid #e3d8bf",borderRadius:20,padding:"3px 10px",fontSize:12,cursor:"pointer",color:"#a9762f"}}>
                      💬{rs.replies?.length>0?` ${rs.replies.length}`:""} Reply
                    </button>
                  </div>
                </div>
                {rs.open&&(
                  <div style={{marginLeft:16,marginTop:8}}>
                    {(rs.replies||[]).map(r=>(
                      <div key={r.id} style={{borderLeft:"2px solid #e3d8bf",paddingLeft:8,marginBottom:8}}>
                        <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:2}}>
                          <Avatar name={r.author} url={r.avatar_url} size={18}/>
                          <span style={{fontSize:11,color:"#9a8c6f"}}>{r.author}</span>
                        </div>
                        <div style={{fontSize:13,lineHeight:1.5}}>{r.body}</div>
                      </div>
                    ))}
                    <div style={{display:"flex",gap:6,marginTop:6}}>
                      <input value={rs.text||""} onChange={e=>setReplyState(prev=>({...prev,[n.id]:{...prev[n.id],text:e.target.value}}))}
                        placeholder="Write a reply…" onKeyDown={e=>e.key==="Enter"&&submitReply(n.id)}
                        style={{flex:1,padding:"6px 10px",fontSize:13,fontFamily:"inherit",border:"1px solid #e3d8bf",borderRadius:3,background:"#fffdf6"}}/>
                      <button style={S.primaryBtnSm} onClick={()=>submitReply(n.id)} disabled={rs.loading}>{rs.loading?"…":"Send"}</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      {showExport&&(
        <div style={{position:"fixed",inset:0,background:"rgba(43,36,25,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,zIndex:50}}>
          <div style={{background:"#fffdf6",borderRadius:4,maxWidth:440,width:"100%",padding:28,boxShadow:"0 20px 60px rgba(0,0,0,0.4)"}}>
            <h2 style={{marginTop:0,fontWeight:400}}>Export {CHAPTER_REF} notes</h2>
            <p style={{fontSize:13.5,color:"#6b5d45",lineHeight:1.6}}>Downloads every margin note for this chapter, grouped by verse.</p>
            <div style={{display:"flex",gap:8,marginTop:14,flexWrap:"wrap"}}>
              <button style={S.primaryBtnSm} onClick={()=>downloadExport("md")}>Download .md</button>
              <button style={S.primaryBtnSm} onClick={()=>downloadExport("txt")}>Download .txt</button>
              <button style={S.ghostBtnSm} onClick={()=>setShowExport(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── FEED TAB ──────────────────────────────────────────────────────
function FeedTab({api,user}) {
  const [posts,setPosts]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [activePost,setActivePost]=useState(null);
  const [postComments,setPostComments]=useState([]);
  const [commentText,setCommentText]=useState("");
  const [postingComment,setPostingComment]=useState(false);
  const [showCompose,setShowCompose]=useState(false);
  const [newPost,setNewPost]=useState({title:"",body:""});
  const [posting,setPosting]=useState(false);

  useEffect(()=>{loadPosts();},[]);

  async function loadPosts(){
    setLoading(true); setError("");
    try{const d=await api("/posts");setPosts(d.posts||[]);}
    catch(e){setError(e.message);}
    finally{setLoading(false);}
  }

  async function openPost(post){
    setActivePost(post); setPostComments([]); setCommentText("");
    try{const d=await api(`/posts/${post.id}`);setActivePost(d.post);setPostComments(d.comments||[]);}
    catch(e){setError(e.message);}
  }

  async function submitPost(e){
    e.preventDefault();
    if(!newPost.title.trim()||!newPost.body.trim())return;
    setPosting(true);
    try{
      const d=await api("/posts",{method:"POST",body:JSON.stringify({title:newPost.title.trim(),body:newPost.body.trim()})});
      setPosts(prev=>[d.post,...prev]); setNewPost({title:"",body:""}); setShowCompose(false);
    }catch(e){setError(e.message);}
    finally{setPosting(false);}
  }

  async function submitComment(){
    if(!commentText.trim()||!activePost)return;
    setPostingComment(true);
    try{
      const d=await api(`/posts/${activePost.id}/comments`,{method:"POST",body:JSON.stringify({body:commentText.trim()})});
      setPostComments(prev=>[...prev,d.comment]); setCommentText("");
      setActivePost(prev=>({...prev,comment_count:parseInt(prev.comment_count||0)+1}));
    }catch(e){setError(e.message);}
    finally{setPostingComment(false);}
  }

  async function reactToPost(postId,type){
    try{
      const d=await api(`/posts/${postId}/react`,{method:"POST",body:JSON.stringify({type})});
      const upd=p=>p.id!==postId?p:{...p,reactions:{...p.reactions,[type]:{count:p.reactions[type].count+(d.toggled==="on"?1:-1),mine:d.toggled==="on"}}};
      setPosts(prev=>prev.map(upd));
      if(activePost?.id===postId)setActivePost(prev=>upd(prev));
    }catch(e){setError(e.message);}
  }

  async function reactToComment(commentId,type){
    try{
      const d=await api(`/post-comments/${commentId}/react`,{method:"POST",body:JSON.stringify({type})});
      setPostComments(prev=>prev.map(c=>c.id!==commentId?c:{...c,reactions:{...c.reactions,[type]:{count:c.reactions[type].count+(d.toggled==="on"?1:-1),mine:d.toggled==="on"}}}));
    }catch(e){setError(e.message);}
  }

  if(activePost) return(
    <div style={{maxWidth:720,margin:"0 auto",padding:24}}>
      <button style={{...S.ghostBtnSm,marginBottom:16}} onClick={()=>setActivePost(null)}>← Back to feed</button>
      <div style={{background:"#fffdf6",border:"1px solid #e3d8bf",borderRadius:4,padding:24,marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <Avatar name={activePost.author} url={activePost.avatar_url} size={36}/>
          <div><div style={{fontWeight:600,fontSize:14}}>{activePost.author}</div><div style={{fontSize:11,color:"#9a8c6f"}}>{timeAgo(activePost.created_at)}</div></div>
        </div>
        <h2 style={{margin:"0 0 10px",fontWeight:600,fontSize:20}}>{activePost.title}</h2>
        <p style={{margin:"0 0 16px",lineHeight:1.7,fontSize:15}}>{activePost.body}</p>
        <div style={{display:"flex",gap:6}}>
          {RXNS.map(({type,emoji,label})=>{
            const r=activePost.reactions?.[type]||{count:0,mine:false};
            return(<button key={type} onClick={()=>reactToPost(activePost.id,type)}
              style={{background:r.mine?"#fbeec1":"#f0ebe0",border:r.mine?"1px solid #c9a35c":"1px solid #e3d8bf",borderRadius:20,padding:"4px 12px",fontSize:13,cursor:"pointer",color:"#5a4a2f"}}>
              {emoji} {label}{r.count>0&&<b> {r.count}</b>}
            </button>);
          })}
        </div>
      </div>
      <div style={{fontSize:11,letterSpacing:"0.2em",color:"#a9762f",marginBottom:12}}>COMMENTS — {postComments.length}</div>
      {postComments.map(c=>(
        <div key={c.id} style={{borderLeft:"3px solid #e3d8bf",paddingLeft:12,marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
            <Avatar name={c.author} url={c.avatar_url} size={24}/>
            <span style={{fontSize:11,color:"#9a8c6f"}}>{c.author} · {timeAgo(c.created_at)}</span>
          </div>
          <div style={{fontSize:14,lineHeight:1.6,margin:"4px 0"}}>{c.body}</div>
          <div style={{display:"flex",gap:5}}>
            {RXNS.map(({type,emoji})=>{
              const r=c.reactions?.[type]||{count:0,mine:false};
              return(<button key={type} onClick={()=>reactToComment(c.id,type)}
                style={{background:r.mine?"#fbeec1":"transparent",border:r.mine?"1px solid #c9a35c":"1px solid #e3d8bf",borderRadius:20,padding:"2px 8px",fontSize:12,cursor:"pointer"}}>
                {emoji}{r.count>0&&` ${r.count}`}
              </button>);
            })}
          </div>
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:16}}>
        <input value={commentText} onChange={e=>setCommentText(e.target.value)} placeholder="Add a comment…"
          onKeyDown={e=>e.key==="Enter"&&submitComment()}
          style={{flex:1,padding:"10px 14px",fontSize:14,fontFamily:"inherit",border:"1px solid #e3d8bf",borderRadius:3,background:"#fffdf6"}}/>
        <button style={S.primaryBtnSm} onClick={submitComment} disabled={postingComment}>{postingComment?"…":"Post"}</button>
      </div>
    </div>
  );

  return(
    <div style={{maxWidth:720,margin:"0 auto",padding:24}}>
      {error&&<div style={{background:"#f6dede",color:"#8a3b2a",padding:"8px 16px",borderRadius:3,marginBottom:16,fontSize:13}}>{error}</div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:11,letterSpacing:"0.2em",color:"#a9762f"}}>COMMUNITY FEED</div>
        <button style={S.primaryBtnSm} onClick={()=>setShowCompose(!showCompose)}>{showCompose?"Cancel":"+ New Post"}</button>
      </div>
      {showCompose&&(
        <form onSubmit={submitPost} style={{background:"#fffdf6",border:"1px solid #c9a35c",borderRadius:4,padding:20,marginBottom:24}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>Share a question or thought</div>
          <input value={newPost.title} onChange={e=>setNewPost({...newPost,title:e.target.value})} placeholder="Title / question" required style={{...S.input,marginBottom:10}}/>
          <textarea value={newPost.body} onChange={e=>setNewPost({...newPost,body:e.target.value})} placeholder="Write your post…" required rows={4} style={{...S.input,resize:"vertical",marginBottom:10}}/>
          <button type="submit" style={S.primaryBtnSm} disabled={posting}>{posting?"Posting…":"Post to community"}</button>
        </form>
      )}
      {loading&&<div style={{color:"#9a8c6f",fontSize:13}}>Loading…</div>}
      {posts.map(p=>(
        <div key={p.id} style={{background:"#fffdf6",border:"1px solid #e3d8bf",borderRadius:4,padding:20,marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <Avatar name={p.author} url={p.avatar_url} size={32}/>
            <div><div style={{fontWeight:600,fontSize:13}}>{p.author}</div><div style={{fontSize:11,color:"#9a8c6f"}}>{timeAgo(p.created_at)}{p.group_name&&<span style={{marginLeft:8,background:"#f0ebe0",padding:"1px 6px",borderRadius:10,fontSize:10}}>📖 {p.group_name}</span>}</div></div>
          </div>
          <div style={{fontSize:17,fontWeight:600,marginBottom:6}}>{p.title}</div>
          <div style={{fontSize:14,lineHeight:1.6,color:"#3a2f1e",marginBottom:12,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical"}}>{p.body}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            {RXNS.map(({type,emoji,label})=>{
              const r=p.reactions?.[type]||{count:0,mine:false};
              return(<button key={type} onClick={e=>{e.stopPropagation();reactToPost(p.id,type);}}
                style={{background:r.mine?"#fbeec1":"#f0ebe0",border:r.mine?"1px solid #c9a35c":"1px solid #e3d8bf",borderRadius:20,padding:"3px 10px",fontSize:12,cursor:"pointer",color:"#5a4a2f"}}>
                {emoji} {label}{r.count>0&&<b> {r.count}</b>}
              </button>);
            })}
            <button onClick={()=>openPost(p)}
              style={{background:"transparent",border:"1px solid #e3d8bf",borderRadius:20,padding:"3px 12px",fontSize:12,cursor:"pointer",color:"#a9762f",marginLeft:"auto"}}>
              💬 {p.comment_count} {parseInt(p.comment_count)===1?"comment":"comments"} →
            </button>
          </div>
        </div>
      ))}
      {!loading&&posts.length===0&&<div style={{textAlign:"center",color:"#9a8c6f",fontSize:14,padding:40}}>No posts yet — be the first to share a question or thought.</div>}
    </div>
  );
}

// ── GROUPS TAB ────────────────────────────────────────────────────
function GroupsTab({api,user}) {
  const [groups,setGroups]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [showCreate,setShowCreate]=useState(false);
  const [newGroup,setNewGroup]=useState({name:"",description:""});
  const [creating,setCreating]=useState(false);
  const [activeGroup,setActiveGroup]=useState(null);
  const [members,setMembers]=useState([]);

  useEffect(()=>{loadGroups();},[]);

  async function loadGroups(){
    setLoading(true);
    try{const d=await api("/groups");setGroups(d.groups||[]);}
    catch(e){setError(e.message);}
    finally{setLoading(false);}
  }

  async function createGroup(e){
    e.preventDefault();
    if(!newGroup.name.trim())return;
    setCreating(true);
    try{
      const d=await api("/groups",{method:"POST",body:JSON.stringify({name:newGroup.name.trim(),description:newGroup.description.trim()})});
      setGroups(prev=>[d.group,...prev]); setNewGroup({name:"",description:""}); setShowCreate(false);
    }catch(e){setError(e.message);}
    finally{setCreating(false);}
  }

  async function joinLeave(group){
    try{
      if(group.my_role){
        await api(`/groups/${group.id}/leave`,{method:"POST"});
        setGroups(prev=>prev.map(g=>g.id!==group.id?g:{...g,my_role:null,member_count:parseInt(g.member_count)-1}));
      } else {
        await api(`/groups/${group.id}/join`,{method:"POST"});
        setGroups(prev=>prev.map(g=>g.id!==group.id?g:{...g,my_role:"member",member_count:parseInt(g.member_count)+1}));
      }
    }catch(e){setError(e.message);}
  }

  async function openGroup(group){
    setActiveGroup(group); setMembers([]);
    try{const d=await api(`/groups/${group.id}/members`);setMembers(d.members||[]);}
    catch(e){setError(e.message);}
  }

  if(activeGroup) return(
    <div style={{maxWidth:720,margin:"0 auto",padding:24}}>
      <button style={{...S.ghostBtnSm,marginBottom:16}} onClick={()=>setActiveGroup(null)}>← Back to groups</button>
      <div style={{background:"#fffdf6",border:"1px solid #e3d8bf",borderRadius:4,padding:24,marginBottom:20}}>
        <h2 style={{margin:"0 0 6px",fontWeight:600}}>{activeGroup.name}</h2>
        {activeGroup.description&&<p style={{margin:"0 0 10px",color:"#6b5d45",fontSize:14}}>{activeGroup.description}</p>}
        <div style={{fontSize:12,color:"#9a8c6f"}}>Created by {activeGroup.created_by_name} · {activeGroup.member_count} members</div>
      </div>
      <div style={{fontSize:11,letterSpacing:"0.2em",color:"#a9762f",marginBottom:12}}>MEMBERS</div>
      {members.map(m=>(
        <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid #f0ebe0"}}>
          <Avatar name={m.name} url={m.avatar_url} size={36}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,fontSize:14}}>{m.name}</div>
            <div style={{fontSize:11,color:"#9a8c6f"}}>{m.role==="admin"?"Admin":"Member"} · joined {timeAgo(m.joined_at)}</div>
          </div>
        </div>
      ))}
    </div>
  );

  return(
    <div style={{maxWidth:720,margin:"0 auto",padding:24}}>
      {error&&<div style={{background:"#f6dede",color:"#8a3b2a",padding:"8px 16px",borderRadius:3,marginBottom:16,fontSize:13}}>{error}</div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:11,letterSpacing:"0.2em",color:"#a9762f"}}>READING GROUPS</div>
        <button style={S.primaryBtnSm} onClick={()=>setShowCreate(!showCreate)}>{showCreate?"Cancel":"+ Create Group"}</button>
      </div>
      {showCreate&&(
        <form onSubmit={createGroup} style={{background:"#fffdf6",border:"1px solid #c9a35c",borderRadius:4,padding:20,marginBottom:24}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>Create a reading group</div>
          <input value={newGroup.name} onChange={e=>setNewGroup({...newGroup,name:e.target.value})} placeholder="Group name" required style={{...S.input,marginBottom:10}}/>
          <input value={newGroup.description} onChange={e=>setNewGroup({...newGroup,description:e.target.value})} placeholder="Description (optional)" style={{...S.input,marginBottom:10}}/>
          <button type="submit" style={S.primaryBtnSm} disabled={creating}>{creating?"Creating…":"Create group"}</button>
        </form>
      )}
      {loading&&<div style={{color:"#9a8c6f",fontSize:13}}>Loading…</div>}
      {groups.map(g=>(
        <div key={g.id} style={{background:"#fffdf6",border:"1px solid #e3d8bf",borderRadius:4,padding:20,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1,cursor:"pointer"}} onClick={()=>openGroup(g)}>
              <div style={{fontSize:17,fontWeight:600,marginBottom:4}}>{g.name}{g.my_role&&<span style={{marginLeft:8,fontSize:11,background:"#fbeec1",padding:"2px 8px",borderRadius:10,color:"#a9762f"}}>{g.my_role==="admin"?"Admin":"Member"}</span>}</div>
              {g.description&&<div style={{fontSize:13,color:"#6b5d45",marginBottom:6}}>{g.description}</div>}
              <div style={{fontSize:11,color:"#9a8c6f"}}>👥 {g.member_count} members · by {g.created_by_name}</div>
            </div>
            <button onClick={()=>joinLeave(g)}
              style={{...g.my_role?S.ghostBtnSm:S.primaryBtnSm,marginLeft:12,flexShrink:0}}>
              {g.my_role?"Leave":"Join"}
            </button>
          </div>
        </div>
      ))}
      {!loading&&groups.length===0&&<div style={{textAlign:"center",color:"#9a8c6f",fontSize:14,padding:40}}>No groups yet — create one to study with your community.</div>}
    </div>
  );
}

// ── PROFILE TAB ───────────────────────────────────────────────────
function ProfileTab({api,user,setUser}) {
  const [profile,setProfile]=useState(null);
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState({name:"",bio:"",avatar_url:""});
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    api("/me").then(d=>{setProfile(d.user);setForm({name:d.user.name,bio:d.user.bio||"",avatar_url:d.user.avatar_url||""}); }).catch(e=>setError(e.message));
  },[]);

  async function saveProfile(e){
    e.preventDefault(); setSaving(true);
    try{
      const d=await api("/profile",{method:"PATCH",body:JSON.stringify({name:form.name,bio:form.bio,avatar_url:form.avatar_url})});
      setProfile(d.user); setUser(prev=>({...prev,...d.user})); setEditing(false);
    }catch(e){setError(e.message);}
    finally{setSaving(false);}
  }

  if(!profile) return <div style={{padding:40,textAlign:"center",color:"#9a8c6f"}}>Loading…</div>;

  const memberSince=new Date(profile.created_at).toLocaleDateString("en-US",{month:"long",year:"numeric"});

  return(
    <div style={{maxWidth:560,margin:"0 auto",padding:24}}>
      {error&&<div style={{background:"#f6dede",color:"#8a3b2a",padding:"8px 16px",borderRadius:3,marginBottom:16,fontSize:13}}>{error}</div>}
      <div style={{background:"#fffdf6",border:"1px solid #e3d8bf",borderRadius:4,padding:28,marginBottom:20,textAlign:"center"}}>
        <Avatar name={profile.name} url={profile.avatar_url} size={80}/>
        <h2 style={{margin:"12px 0 4px",fontWeight:600,fontSize:22}}>{profile.name}</h2>
        {profile.bio&&<p style={{margin:"0 0 12px",color:"#6b5d45",fontSize:14,lineHeight:1.6}}>{profile.bio}</p>}
        <div style={{fontSize:12,color:"#9a8c6f",marginBottom:16}}>Member since {memberSince}</div>
        <div style={{display:"flex",justifyContent:"center",gap:24,marginBottom:16}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:24,fontWeight:700,color:"#a9762f"}}>{profile.streak||0}</div>
            <div style={{fontSize:11,color:"#9a8c6f"}}>day streak 🔥</div>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:24,fontWeight:700,color:"#a9762f"}}>{profile.note_count||0}</div>
            <div style={{fontSize:11,color:"#9a8c6f"}}>margin notes</div>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:24,fontWeight:700,color:"#a9762f"}}>{profile.post_count||0}</div>
            <div style={{fontSize:11,color:"#9a8c6f"}}>posts</div>
          </div>
        </div>
        <button style={S.primaryBtnSm} onClick={()=>setEditing(!editing)}>{editing?"Cancel":"Edit profile"}</button>
      </div>

      {editing&&(
        <form onSubmit={saveProfile} style={{background:"#fffdf6",border:"1px solid #c9a35c",borderRadius:4,padding:24}}>
          <div style={{fontSize:13,fontWeight:600,marginBottom:16}}>Edit your profile</div>
          <label style={S.label}>Name<input style={S.input} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label>
          <label style={S.label}>Bio<textarea value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})} rows={3} placeholder="A little about you…"
            style={{...S.input,resize:"vertical"}}/></label>
          <label style={S.label}>Avatar URL<input style={S.input} value={form.avatar_url} onChange={e=>setForm({...form,avatar_url:e.target.value})} placeholder="https://…" type="url"/></label>
          {form.avatar_url&&<div style={{marginBottom:12,textAlign:"center"}}><Avatar name={form.name} url={form.avatar_url} size={60}/></div>}
          <button type="submit" style={S.primaryBtnSm} disabled={saving}>{saving?"Saving…":"Save changes"}</button>
        </form>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const S={
  label:{display:"block",fontSize:12,letterSpacing:"0.1em",color:"#6b5d45",marginBottom:14},
  input:{display:"block",width:"100%",marginTop:6,padding:"10px 12px",fontSize:14,fontFamily:"Georgia,serif",border:"1px solid #d8cdb4",borderRadius:3,boxSizing:"border-box",background:"#fffdf6"},
  primaryBtn:{width:"100%",padding:"12px 16px",background:"#a9762f",color:"#fffdf6",border:"none",borderRadius:3,fontSize:14,letterSpacing:"0.05em",cursor:"pointer",marginTop:6},
  primaryBtnSm:{padding:"7px 14px",background:"#a9762f",color:"#fffdf6",border:"none",borderRadius:3,fontSize:12.5,cursor:"pointer"},
  ghostBtn:{background:"transparent",color:"#f3ecd9",border:"1px solid #56493a",borderRadius:3,padding:"6px 12px",fontSize:12.5,cursor:"pointer"},
  ghostBtnSm:{background:"transparent",color:"#6b5d45",border:"1px solid #d8cdb4",borderRadius:3,padding:"7px 14px",fontSize:12.5,cursor:"pointer"},
  link:{color:"#a9762f",cursor:"pointer",textDecoration:"underline"},
  tabBtn:{border:"none",borderRadius:3,padding:"6px 14px",fontSize:13,cursor:"pointer",fontFamily:"Georgia,serif"},
};
