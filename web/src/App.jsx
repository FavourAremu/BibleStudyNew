import React, { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000/api";
const BIBLE_API = "https://bible-api.com";
const APP_NAME = "Christian Community Centre";

const VERSIONS = [
  { code:"kjv",   name:"King James Version" },
  { code:"asv",   name:"American Standard" },
  { code:"web",   name:"World English Bible" },
  { code:"ylt",   name:"Young's Literal" },
  { code:"darby", name:"Darby" },
  { code:"webbe", name:"WEB British Edition" },
];

const BOOKS = [
  {name:"Genesis",chapters:50},{name:"Exodus",chapters:40},{name:"Leviticus",chapters:27},
  {name:"Numbers",chapters:36},{name:"Deuteronomy",chapters:34},{name:"Joshua",chapters:24},
  {name:"Judges",chapters:21},{name:"Ruth",chapters:4},{name:"1 Samuel",chapters:31},
  {name:"2 Samuel",chapters:24},{name:"1 Kings",chapters:22},{name:"2 Kings",chapters:25},
  {name:"1 Chronicles",chapters:29},{name:"2 Chronicles",chapters:36},{name:"Ezra",chapters:10},
  {name:"Nehemiah",chapters:13},{name:"Esther",chapters:10},{name:"Job",chapters:42},
  {name:"Psalms",chapters:150},{name:"Proverbs",chapters:31},{name:"Ecclesiastes",chapters:12},
  {name:"Song of Solomon",chapters:8},{name:"Isaiah",chapters:66},{name:"Jeremiah",chapters:52},
  {name:"Lamentations",chapters:5},{name:"Ezekiel",chapters:48},{name:"Daniel",chapters:12},
  {name:"Hosea",chapters:14},{name:"Joel",chapters:3},{name:"Amos",chapters:9},
  {name:"Obadiah",chapters:1},{name:"Jonah",chapters:4},{name:"Micah",chapters:7},
  {name:"Nahum",chapters:3},{name:"Habakkuk",chapters:3},{name:"Zephaniah",chapters:3},
  {name:"Haggai",chapters:2},{name:"Zechariah",chapters:14},{name:"Malachi",chapters:4},
  {name:"Matthew",chapters:28},{name:"Mark",chapters:16},{name:"Luke",chapters:24},
  {name:"John",chapters:21},{name:"Acts",chapters:28},{name:"Romans",chapters:16},
  {name:"1 Corinthians",chapters:16},{name:"2 Corinthians",chapters:13},{name:"Galatians",chapters:6},
  {name:"Ephesians",chapters:6},{name:"Philippians",chapters:4},{name:"Colossians",chapters:4},
  {name:"1 Thessalonians",chapters:5},{name:"2 Thessalonians",chapters:3},{name:"1 Timothy",chapters:6},
  {name:"2 Timothy",chapters:4},{name:"Titus",chapters:3},{name:"Philemon",chapters:1},
  {name:"Hebrews",chapters:13},{name:"James",chapters:5},{name:"1 Peter",chapters:5},
  {name:"2 Peter",chapters:3},{name:"1 John",chapters:5},{name:"2 John",chapters:1},
  {name:"3 John",chapters:1},{name:"Jude",chapters:1},{name:"Revelation",chapters:22},
];

const RXNS=[{type:"amen",emoji:"🙏",label:"Amen"},{type:"pray",emoji:"✝️",label:"Pray"},{type:"heart",emoji:"❤️",label:"Heart"}];

async function fetchChapter(book,chapter,version) {
  const ref=encodeURIComponent(`${book} ${chapter}`);
  const res=await fetch(`${BIBLE_API}/${ref}?translation=${version}`);
  if(!res.ok) throw new Error(`${version.toUpperCase()} unavailable`);
  const data=await res.json();
  return (data.verses||[]).map(v=>({verse:v.verse,text:v.text.trim()}));
}

function Avatar({name,url,size=36}) {
  if(url) return <img src={url} alt={name} style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",flexShrink:0}}/>;
  return(
    <div style={{width:size,height:size,borderRadius:"50%",background:"#a9762f",color:"#fff",
      display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.4,fontWeight:600,flexShrink:0}}>
      {name?.[0]?.toUpperCase()||"?"}
    </div>
  );
}

function timeAgo(ts) {
  const s=Math.floor((Date.now()-new Date(ts))/1000);
  if(s<60)return"just now";if(s<3600)return`${Math.floor(s/60)}m ago`;
  if(s<86400)return`${Math.floor(s/3600)}h ago`;return`${Math.floor(s/86400)}d ago`;
}

export default function App() {
  const [screen,setScreen]=useState("auth");
  const [tab,setTab]=useState("reader");
  const [authMode,setAuthMode]=useState("login");
  const [form,setForm]=useState({name:"",email:"",password:""});
  const [authError,setAuthError]=useState("");
  const [authLoading,setAuthLoading]=useState(false);
  const [token,setToken]=useState(()=>{ try{return localStorage.getItem("ccc_token")||null;}catch{return null;} });
  const [user,setUser]=useState(()=>{ try{const u=localStorage.getItem("ccc_user");return u?JSON.parse(u):null;}catch{return null;} });
  const [menuOpen,setMenuOpen]=useState(false);

  // Persist session
  useEffect(()=>{
    try{
      if(token&&user){localStorage.setItem("ccc_token",token);localStorage.setItem("ccc_user",JSON.stringify(user));}
      else{localStorage.removeItem("ccc_token");localStorage.removeItem("ccc_user");}
    }catch{}
  },[token,user]);

  // Restore session on mount
  useEffect(()=>{
    try{if(localStorage.getItem("ccc_token"))setScreen("app");}catch{}
  },[]);

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
    e.preventDefault();setAuthError("");setAuthLoading(true);
    try{
      const path=authMode==="login"?"/login":"/signup";
      const body=authMode==="login"?{email:form.email,password:form.password}:{name:form.name,email:form.email,password:form.password};
      const data=await api(path,{method:"POST",body:JSON.stringify(body)});
      setToken(data.token);setUser(data.user);setScreen("app");
    }catch(err){setAuthError(err.message);}
    finally{setAuthLoading(false);}
  }

  function logout(){try{localStorage.removeItem("ccc_token");localStorage.removeItem("ccc_user");}catch{} setToken(null);setUser(null);setScreen("auth");setMenuOpen(false);}

  /* ── AUTH ── */
  if(screen==="auth") return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      background:"linear-gradient(180deg,#2b2419,#1b1712)",fontFamily:"Georgia,serif",padding:"24px 16px"}}>
      <div style={{textAlign:"center",marginBottom:24,color:"#f3ecd9"}}>
        <div style={{fontSize:11,letterSpacing:"0.25em",color:"#c9a35c",marginBottom:6}}>BIBLE STUDY JOURNAL</div>
        <div style={{fontSize:20,fontWeight:600,lineHeight:1.2}}>{APP_NAME}</div>
      </div>
      <form onSubmit={handleAuth} style={{width:"100%",maxWidth:400,background:"#f3ecd9",color:"#2b2419",
        borderRadius:6,padding:"36px 24px",boxShadow:"0 20px 60px rgba(0,0,0,0.45)",position:"relative"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:5,background:"#a9762f",borderRadius:"6px 6px 0 0"}}/>
        <h2 style={{fontSize:22,margin:"0 0 20px",fontWeight:400,textAlign:"center"}}>
          {authMode==="login"?"Welcome back":"Begin your study"}
        </h2>
        {authMode==="signup"&&(
          <label style={S.label}>Name
            <input style={S.input} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your name" required/>
          </label>
        )}
        <label style={S.label}>Email
          <input style={S.input} type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com" required/>
        </label>
        <label style={S.label}>Password
          <input style={S.input} type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="••••••••" required minLength={6}/>
        </label>
        {authError&&<div style={{color:"#b3422f",fontSize:13,marginBottom:10,padding:"8px 10px",background:"#fdecea",borderRadius:3}}>{authError}</div>}
        <button type="submit" style={S.primaryBtn} disabled={authLoading}>
          {authLoading?"Please wait…":authMode==="login"?"Log in":"Create account"}
        </button>
        <div style={{textAlign:"center",marginTop:16,fontSize:13}}>
          {authMode==="login"
            ?<>New here? <a style={S.link} onClick={()=>{setAuthMode("signup");setAuthError("");}}>Create an account</a></>
            :<>Have an account? <a style={S.link} onClick={()=>{setAuthMode("login");setAuthError("");}}>Log in</a></>}
        </div>
      </form>
    </div>
  );

  /* ── APP SHELL ── */
  const TABS=[
    {id:"reader",icon:"📖",label:"Reader"},
    {id:"feed",  icon:"🌐",label:"Community"},
    {id:"groups",icon:"👥",label:"Groups"},
    {id:"profile",icon:"👤",label:"Profile"},
  ];

  return(
    <div style={{minHeight:"100vh",background:"#f7f3e8",fontFamily:"Georgia,serif",color:"#2b2419",
      display:"flex",flexDirection:"column"}}>

      {/* Top bar */}
      <div style={{background:"#2b2419",color:"#f3ecd9",padding:"12px 16px",
        display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0,
        position:"sticky",top:0,zIndex:100}}>
        <div>
          <div style={{fontSize:10,letterSpacing:"0.25em",color:"#c9a35c"}}>BIBLE STUDY JOURNAL</div>
          <div style={{fontSize:15,fontWeight:600,lineHeight:1.2}}>{APP_NAME}</div>
        </div>
        {/* Desktop tabs */}
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          <div style={{display:"flex",gap:4}} className="desktop-tabs">
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)}
                style={{...S.tabBtn,background:tab===t.id?"#a9762f":"transparent",color:tab===t.id?"#fff":"#d8cdb4",
                  display:"none"}}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <button onClick={()=>setMenuOpen(!menuOpen)}
            style={{background:"transparent",border:"1px solid #56493a",borderRadius:4,
              padding:"6px 10px",color:"#f3ecd9",fontSize:18,cursor:"pointer",lineHeight:1}}>
            ☰
          </button>
        </div>
      </div>

      {/* Slide-down menu */}
      {menuOpen&&(
        <div style={{background:"#1b1712",padding:"8px 0",position:"sticky",top:56,zIndex:99,borderBottom:"1px solid #3a3028"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>{setTab(t.id);setMenuOpen(false);}}
              style={{display:"block",width:"100%",textAlign:"left",padding:"12px 20px",
                background:tab===t.id?"#2b2419":"transparent",color:tab===t.id?"#c9a35c":"#d8cdb4",
                border:"none",fontSize:15,fontFamily:"Georgia,serif",cursor:"pointer"}}>
              {t.icon} {t.label}
            </button>
          ))}
          <div style={{borderTop:"1px solid #3a3028",margin:"4px 0"}}/>
          <button onClick={logout}
            style={{display:"block",width:"100%",textAlign:"left",padding:"12px 20px",
              background:"transparent",color:"#9a8c6f",border:"none",fontSize:15,fontFamily:"Georgia,serif",cursor:"pointer"}}>
            ← Log out
          </button>
        </div>
      )}

      {/* Content */}
      <div style={{flex:1,overflowX:"hidden"}}>
        {tab==="reader" &&<ReaderTab  api={api} user={user} token={token}/>}
        {tab==="feed"   &&<FeedTab    api={api} user={user}/>}
        {tab==="groups" &&<GroupsTab  api={api} user={user}/>}
        {tab==="profile"&&<ProfileTab api={api} user={user} setUser={setUser}/>}
      </div>

      {/* Bottom nav (mobile) */}
      <div style={{background:"#2b2419",display:"flex",borderTop:"1px solid #3a3028",
        position:"sticky",bottom:0,zIndex:100,flexShrink:0}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>{setTab(t.id);setMenuOpen(false);}}
            style={{flex:1,padding:"10px 4px 8px",background:"transparent",border:"none",cursor:"pointer",
              color:tab===t.id?"#c9a35c":"#6b5d45",fontFamily:"Georgia,serif"}}>
            <div style={{fontSize:20,lineHeight:1}}>{t.icon}</div>
            <div style={{fontSize:10,marginTop:2,letterSpacing:"0.05em"}}>{t.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── VERSE CAROUSEL ─────────────────────────────────────────────── */
function VerseCarousel({versions,verseData,verseHasNotes,onSelect}) {
  const [active,setActive]=useState(0);
  const startX=React.useRef(null);
  const containerRef=React.useRef(null);

  function onTouchStart(e){startX.current=e.touches[0].clientX;}
  function onTouchEnd(e){
    if(startX.current===null)return;
    const diff=startX.current-e.changedTouches[0].clientX;
    if(Math.abs(diff)>50){
      if(diff>0) setActive(a=>Math.min(a+1,versions.length-1));
      else        setActive(a=>Math.max(a-1,0));
    }
    startX.current=null;
  }

  const v=versions[active];
  const vd=verseData[v.code]||{loading:true,error:null,verses:[]};

  return(
    <div style={{padding:"12px 12px 0"}}>
      {/* Version selector pills */}
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:10,WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
        {versions.map((ver,i)=>(
          <button key={ver.code} onClick={()=>setActive(i)}
            style={{flexShrink:0,padding:"5px 14px",borderRadius:20,border:"1px solid",cursor:"pointer",
              fontFamily:"Georgia,serif",fontSize:12,whiteSpace:"nowrap",transition:"all 0.15s",
              background:i===active?"#a9762f":"#fffdf6",
              color:i===active?"#fff":"#6b5d45",
              borderColor:i===active?"#a9762f":"#e3d8bf",
              fontWeight:i===active?700:400}}>
            {ver.code.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Card */}
      <div ref={containerRef}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        style={{background:"#fffdf6",border:"1px solid #e3d8bf",borderRadius:10,
          padding:"18px 16px",boxShadow:"0 2px 12px rgba(0,0,0,0.07)",
          minHeight:200,touchAction:"pan-y",userSelect:"text",WebkitUserSelect:"text"}}>

        {/* Card header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          marginBottom:14,paddingBottom:10,borderBottom:"1px solid #ecdfc4"}}>
          <div>
            <span style={{fontSize:16,fontWeight:700,color:"#a9762f",letterSpacing:"0.1em"}}>{v.code.toUpperCase()}</span>
            <span style={{fontSize:12,color:"#bdb097",fontStyle:"italic",marginLeft:8}}>{v.name}</span>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>setActive(a=>Math.max(a-1,0))} disabled={active===0}
              style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:active===0?"#d8cdb4":"#a9762f",padding:"0 4px"}}>
              ‹
            </button>
            <span style={{fontSize:12,color:"#9a8c6f"}}>{active+1}/{versions.length}</span>
            <button onClick={()=>setActive(a=>Math.min(a+1,versions.length-1))} disabled={active===versions.length-1}
              style={{background:"none",border:"none",fontSize:18,cursor:"pointer",color:active===versions.length-1?"#d8cdb4":"#a9762f",padding:"0 4px"}}>
              ›
            </button>
          </div>
        </div>

        {/* Verses */}
        {vd.loading&&(
          <div style={{color:"#bdb097",fontSize:14,padding:"32px 0",textAlign:"center"}}>Loading…</div>
        )}
        {vd.error&&(
          <div style={{color:"#b3422f",fontSize:13,padding:"12px 0"}}>{vd.error}</div>
        )}
        {!vd.loading&&!vd.error&&vd.verses.map(({verse,text})=>(
          <p key={verse} onMouseUp={()=>onSelect(v.code,verse)}
            style={{margin:"0 0 12px 0",fontSize:17,lineHeight:1.75,cursor:"text",
              background:verseHasNotes(verse)?"#fbeec1":"transparent",
              padding:verseHasNotes(verse)?"4px 8px":0,borderRadius:4}}>
            <sup style={{color:"#a9762f",fontSize:12,marginRight:5,fontWeight:700}}>{verse}</sup>
            {text}
          </p>
        ))}
      </div>

      {/* Dot indicators */}
      <div style={{display:"flex",justifyContent:"center",gap:6,padding:"12px 0 4px"}}>
        {versions.map((_,i)=>(
          <div key={i} onClick={()=>setActive(i)}
            style={{width:i===active?20:7,height:7,borderRadius:4,cursor:"pointer",transition:"all 0.2s",
              background:i===active?"#a9762f":"#d8cdb4"}}/>
        ))}
      </div>

      {/* Swipe hint — only shown until first swipe */}
      <div style={{textAlign:"center",fontSize:11,color:"#bdb097",paddingBottom:8}}>
        ← swipe or tap pills to change version →
      </div>
    </div>
  );
}

/* ── READER TAB ─────────────────────────────────────────────────── */
function ReaderTab({api,user,token}) {
  const [book,setBook]=useState("John");
  const [chapter,setChapter]=useState(3);
  const [showNav,setShowNav]=useState(false);
  const [bookSearch,setBookSearch]=useState("");
  const [verseData,setVerseData]=useState({});
  const [notes,setNotes]=useState([]);
  const [notesLoading,setNotesLoading]=useState(false);
  const [notesError,setNotesError]=useState("");
  const [activeSelection,setActiveSelection]=useState(null);
  const [draft,setDraft]=useState("");
  const [saving,setSaving]=useState(false);
  const [showExport,setShowExport]=useState(false);
  const [showNotes,setShowNotes]=useState(false);
  const [replyState,setReplyState]=useState({});

  const currentBook=BOOKS.find(b=>b.name===book)||BOOKS[43];

  useEffect(()=>{
    setVerseData({});setNotes([]);setActiveSelection(null);setReplyState({});
    VERSIONS.forEach(v=>{
      setVerseData(prev=>({...prev,[v.code]:{loading:true,error:null,verses:[]}}));
      fetchChapter(book,chapter,v.code)
        .then(verses=>setVerseData(prev=>({...prev,[v.code]:{loading:false,error:null,verses}})))
        .catch(err=>setVerseData(prev=>({...prev,[v.code]:{loading:false,error:err.message,verses:[]}})));
    });
    setNotesLoading(true);
    api(`/chapters/${encodeURIComponent(book)}/${chapter}/notes`)
      .then(d=>setNotes(d.notes||[]))
      .catch(e=>setNotesError(e.message))
      .finally(()=>setNotesLoading(false));
  },[book,chapter]);

  function navigate(nb,nc){setBook(nb);setChapter(nc);setShowNav(false);setBookSearch("");}
  function prevChapter(){
    if(chapter>1)setChapter(c=>c-1);
    else{const i=BOOKS.findIndex(b=>b.name===book);if(i>0){setBook(BOOKS[i-1].name);setChapter(BOOKS[i-1].chapters);}}
  }
  function nextChapter(){
    if(chapter<currentBook.chapters)setChapter(c=>c+1);
    else{const i=BOOKS.findIndex(b=>b.name===book);if(i<BOOKS.length-1){setBook(BOOKS[i+1].name);setChapter(1);}}
  }

  const handleSelect=(version,verseNum)=>{
    const sel=window.getSelection?.().toString().trim();
    if(!sel)return;
    setActiveSelection({version,verseNum,quote:sel});setDraft("");setShowNotes(true);
  };

  async function saveNote(){
    if(!activeSelection||!draft.trim())return;
    setSaving(true);
    try{
      // Screen note before saving
      const screen=await api("/screen",{method:"POST",body:JSON.stringify({text:draft.trim(),context:"margin note"})});
      if(!screen.allowed){setNotesError(`Note blocked by community safety filter: ${screen.reason}`);setSaving(false);return;}
      const {highlight}=await api("/highlights",{method:"POST",body:JSON.stringify({book,chapter,verse:activeSelection.verseNum,version:activeSelection.version,quote:activeSelection.quote})});
      const {comment}=await api("/comments",{method:"POST",body:JSON.stringify({book,chapter,verse:activeSelection.verseNum,highlightId:highlight.id,body:draft.trim()})});
      setNotes(prev=>[...prev,{id:comment.id,comment_id:comment.id,verse_number:activeSelection.verseNum,comment:comment.body,
        author:user?.name,author_id:user?.id,version:highlight.version,quote:highlight.quote,
        reactions:{amen:{count:0,mine:false},pray:{count:0,mine:false},heart:{count:0,mine:false}}}]);
      setActiveSelection(null);setDraft("");
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
    const note=notes.find(n=>n.id===commentId);if(!note)return;
    setReplyState(prev=>({...prev,[commentId]:{...prev[commentId],loading:true}}));
    try{
      const {comment}=await api("/comments",{method:"POST",body:JSON.stringify({book,chapter,verse:note.verse_number,parentId:commentId,body:text})});
      setReplyState(prev=>({...prev,[commentId]:{...prev[commentId],text:"",loading:false,
        replies:[...(prev[commentId]?.replies||[]),{...comment,reactions:{amen:{count:0,mine:false},pray:{count:0,mine:false},heart:{count:0,mine:false}}}]}}));
    }catch(e){setNotesError(e.message);setReplyState(prev=>({...prev,[commentId]:{...prev[commentId],loading:false}}));}
  }

  async function downloadExport(format){
    try{
      const res=await fetch(`${API_BASE}/chapters/${encodeURIComponent(book)}/${chapter}/export?format=${format}`,{headers:{Authorization:`Bearer ${token}`}});
      if(!res.ok)throw new Error("Export failed");
      const blob=await res.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url;a.download=`${book}-${chapter}-notes.${format}`;a.click();URL.revokeObjectURL(url);
    }catch(e){setNotesError(e.message);}
  }

  const verseHasNotes=vn=>notes.some(n=>n.verse_number===vn);
  const filteredBooks=BOOKS.filter(b=>b.name.toLowerCase().includes(bookSearch.toLowerCase()));

  return(
    <div>
      {/* Chapter nav bar */}
      <div style={{background:"#3a2f1e",padding:"10px 12px",display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",position:"sticky",top:0,zIndex:50}}>
        <button style={S.navBtn} onClick={prevChapter}>←</button>
        <button style={{...S.navBtn,flex:1,maxWidth:220,textAlign:"center",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}
          onClick={()=>setShowNav(!showNav)}>
          📖 {book} {chapter} ▾
        </button>
        <button style={S.navBtn} onClick={nextChapter}>→</button>
        <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
          <button style={{...S.navBtn,position:"relative"}} onClick={()=>setShowNotes(!showNotes)}>
            📝{notes.length>0&&<span style={{position:"absolute",top:-4,right:-4,background:"#a9762f",color:"#fff",borderRadius:"50%",fontSize:9,width:14,height:14,display:"flex",alignItems:"center",justifyContent:"center"}}>{notes.length}</span>}
          </button>
          <button style={S.navBtn} onClick={()=>setShowExport(true)}>⬇</button>
        </div>
      </div>

      {/* Book/chapter picker */}
      {showNav&&(
        <div style={{background:"#fffdf6",border:"1px solid #e3d8bf",padding:12,maxHeight:"60vh",overflowY:"auto",position:"sticky",top:50,zIndex:49}}>
          <input value={bookSearch} onChange={e=>setBookSearch(e.target.value)} placeholder="Search book…" autoFocus
            style={{...S.input,marginBottom:10,padding:"8px 12px",fontSize:14}}/>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <div style={{flex:"0 0 160px",maxHeight:200,overflowY:"auto",borderRight:"1px solid #e3d8bf",paddingRight:10}}>
              {filteredBooks.map(b=>(
                <div key={b.name} onClick={()=>{setBook(b.name);setChapter(1);}}
                  style={{padding:"6px 8px",cursor:"pointer",borderRadius:3,fontSize:13,
                    background:b.name===book?"#fbeec1":"transparent",fontWeight:b.name===book?600:400}}>
                  {b.name}
                </div>
              ))}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,letterSpacing:"0.15em",color:"#a9762f",marginBottom:8}}>CHAPTER</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {Array.from({length:currentBook.chapters},(_,i)=>i+1).map(c=>(
                  <button key={c} onClick={()=>navigate(book,c)}
                    style={{width:34,height:34,borderRadius:3,border:"1px solid #e3d8bf",cursor:"pointer",fontSize:13,
                      background:c===chapter?"#a9762f":"#f7f3e8",color:c===chapter?"#fff":"#2b2419",fontWeight:c===chapter?600:400}}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {notesError&&<div style={{background:"#f6dede",color:"#8a3b2a",padding:"8px 16px",fontSize:13}}>{notesError}</div>}

      {/* Swipeable version carousel */}
      <VerseCarousel
        versions={VERSIONS}
        verseData={verseData}
        verseHasNotes={verseHasNotes}
        onSelect={handleSelect}
      />

      {/* Notes panel — slides up as bottom sheet on mobile */}
      {showNotes&&(
        <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}
          onClick={e=>{if(e.target===e.currentTarget){setShowNotes(false);setActiveSelection(null);setDraft("");}}}>
          <div style={{background:"#fbf6ea",borderTop:"2px solid #c9a35c",borderRadius:"16px 16px 0 0",
            maxHeight:"75vh",overflowY:"auto",padding:"16px 16px 24px",boxShadow:"0 -8px 32px rgba(0,0,0,0.18)"}}>
            {/* Handle */}
            <div style={{width:40,height:4,background:"#d8cdb4",borderRadius:2,margin:"0 auto 16px"}}/>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontSize:11,letterSpacing:"0.2em",color:"#a9762f"}}>MARGIN NOTES — {notesLoading?"…":notes.length}</div>
              <button style={S.ghostBtnSm} onClick={()=>{setShowNotes(false);setActiveSelection(null);setDraft("");}}>✕</button>
            </div>

            {/* New note composer */}
            {activeSelection&&(
              <div style={{background:"#fffdf6",border:"1px solid #c9a35c",borderRadius:6,padding:12,marginBottom:16}}>
                <div style={{fontSize:12,color:"#6b5d45",marginBottom:4}}>v.{activeSelection.verseNum} · {activeSelection.version.toUpperCase()}</div>
                <div style={{fontSize:13,fontStyle:"italic",color:"#5a4a2f",marginBottom:8,lineHeight:1.5}}>"{activeSelection.quote}"</div>
                <textarea autoFocus value={draft} onChange={e=>setDraft(e.target.value)}
                  placeholder="Write your note or question…"
                  style={{width:"100%",minHeight:80,fontFamily:"inherit",fontSize:14,padding:10,
                    border:"1px solid #e3d8bf",borderRadius:4,resize:"vertical",boxSizing:"border-box",lineHeight:1.5}}/>
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <button style={{...S.primaryBtnSm,flex:1}} onClick={saveNote} disabled={saving}>{saving?"Saving…":"Add note"}</button>
                  <button style={S.ghostBtnSm} onClick={()=>{setActiveSelection(null);setDraft("");}}>Cancel</button>
                </div>
              </div>
            )}

            {!notesLoading&&notes.length===0&&!activeSelection&&(
              <div style={{fontSize:14,color:"#9a8c6f",lineHeight:1.7,textAlign:"center",padding:"20px 0"}}>
                Tap and hold any phrase in a verse to write a note here.
              </div>
            )}

            {notes.slice().sort((a,b)=>a.verse_number-b.verse_number).map(n=>{
              const rs=replyState[n.id]||{};
              return(
                <div key={n.id} style={{marginBottom:16,paddingBottom:16,borderBottom:"1px solid #ecdfc4"}}>
                  <div style={{borderLeft:"3px solid #c9a35c",paddingLeft:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                      <Avatar name={n.author} url={n.avatar_url} size={22}/>
                      <span style={{fontSize:11,color:"#a9762f"}}>v.{n.verse_number} · {n.version?.toUpperCase()} · {n.author}</span>
                    </div>
                    {n.quote&&<div style={{fontSize:12.5,fontStyle:"italic",color:"#6b5d45",margin:"2px 0"}}>"{n.quote}"</div>}
                    <div style={{fontSize:14,lineHeight:1.6}}>{n.comment}</div>
                    <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"}}>
                      {RXNS.map(({type,emoji,label})=>{
                        const r=n.reactions?.[type]||{count:0,mine:false};
                        return(<button key={type} onClick={()=>handleReact(n.id,type)}
                          style={{background:r.mine?"#fbeec1":"#f0ebe0",border:r.mine?"1px solid #c9a35c":"1px solid #e3d8bf",
                            borderRadius:20,padding:"4px 10px",fontSize:12,cursor:"pointer",color:"#5a4a2f"}}>
                          {emoji} {label}{r.count>0&&<b> {r.count}</b>}
                        </button>);
                      })}
                      <button onClick={()=>toggleReply(n.id)}
                        style={{background:"transparent",border:"1px solid #e3d8bf",borderRadius:20,
                          padding:"4px 10px",fontSize:12,cursor:"pointer",color:"#a9762f"}}>
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
                          style={{flex:1,padding:"8px 12px",fontSize:14,fontFamily:"inherit",border:"1px solid #e3d8bf",borderRadius:4,background:"#fffdf6"}}/>
                        <button style={S.primaryBtnSm} onClick={()=>submitReply(n.id)} disabled={rs.loading}>{rs.loading?"…":"Send"}</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Export modal */}
      {showExport&&(
        <div style={{position:"fixed",inset:0,background:"rgba(43,36,25,0.6)",display:"flex",alignItems:"flex-end",zIndex:200}}
          onClick={e=>{if(e.target===e.currentTarget)setShowExport(false);}}>
          <div style={{background:"#fffdf6",borderRadius:"16px 16px 0 0",width:"100%",padding:"24px 20px 32px",boxShadow:"0 -8px 32px rgba(0,0,0,0.2)"}}>
            <div style={{width:40,height:4,background:"#d8cdb4",borderRadius:2,margin:"0 auto 16px"}}/>
            <h3 style={{margin:"0 0 8px",fontWeight:600}}>Export {book} {chapter} notes</h3>
            <p style={{fontSize:13.5,color:"#6b5d45",lineHeight:1.6,margin:"0 0 16px"}}>Download all margin notes for this chapter.</p>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <button style={{...S.primaryBtn,marginTop:0}} onClick={()=>downloadExport("md")}>Download as Markdown</button>
              <button style={{...S.primaryBtn,marginTop:0,background:"#5a4a2f"}} onClick={()=>downloadExport("txt")}>Download as Plain Text</button>
              <button style={{...S.ghostBtnSm,width:"100%",padding:"12px"}} onClick={()=>setShowExport(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── FEED TAB ───────────────────────────────────────────────────── */
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
    setLoading(true);setError("");
    try{const d=await api("/posts");setPosts(d.posts||[]);}
    catch(e){setError(e.message);}finally{setLoading(false);}
  }

  async function openPost(post){
    setActivePost(post);setPostComments([]);setCommentText("");
    try{const d=await api(`/posts/${post.id}`);setActivePost(d.post);setPostComments(d.comments||[]);}
    catch(e){setError(e.message);}
  }

  async function submitPost(e){
    e.preventDefault();if(!newPost.title.trim()||!newPost.body.trim())return;
    setPosting(true);
    try{
      // Screen content before posting
      const screen=await api("/screen",{method:"POST",body:JSON.stringify({text:`${newPost.title} ${newPost.body}`,context:"community post"})});
      if(!screen.allowed){setError(`Post blocked by community safety filter: ${screen.reason}`);setPosting(false);return;}
      const d=await api("/posts",{method:"POST",body:JSON.stringify({title:newPost.title.trim(),body:newPost.body.trim()})});
      setPosts(prev=>[d.post,...prev]);setNewPost({title:"",body:""});setShowCompose(false);
    }catch(e){setError(e.message);}finally{setPosting(false);}
  }

  async function submitComment(){
    if(!commentText.trim()||!activePost)return;
    setPostingComment(true);
    try{
      // Screen content before posting
      const screen=await api("/screen",{method:"POST",body:JSON.stringify({text:commentText.trim(),context:"comment"})});
      if(!screen.allowed){setError(`Comment blocked by community safety filter: ${screen.reason}`);setPostingComment(false);return;}
      const d=await api(`/posts/${activePost.id}/comments`,{method:"POST",body:JSON.stringify({body:commentText.trim()})});
      setPostComments(prev=>[...prev,d.comment]);setCommentText("");
      setActivePost(prev=>({...prev,comment_count:parseInt(prev.comment_count||0)+1}));
    }catch(e){setError(e.message);}finally{setPostingComment(false);}
  }

  async function reactToPost(postId,type){
    try{
      const d=await api(`/posts/${postId}/react`,{method:"POST",body:JSON.stringify({type})});
      const upd=p=>p.id!==postId?p:{...p,reactions:{...p.reactions,[type]:{count:p.reactions[type].count+(d.toggled==="on"?1:-1),mine:d.toggled==="on"}}};
      setPosts(prev=>prev.map(upd));if(activePost?.id===postId)setActivePost(prev=>upd(prev));
    }catch(e){setError(e.message);}
  }

  async function reactToComment(commentId,type){
    try{
      const d=await api(`/post-comments/${commentId}/react`,{method:"POST",body:JSON.stringify({type})});
      setPostComments(prev=>prev.map(c=>c.id!==commentId?c:{...c,reactions:{...c.reactions,[type]:{count:c.reactions[type].count+(d.toggled==="on"?1:-1),mine:d.toggled==="on"}}}));
    }catch(e){setError(e.message);}
  }

  if(activePost) return(
    <div style={{maxWidth:680,margin:"0 auto",padding:"16px 12px"}}>
      <button style={{...S.ghostBtnSm,marginBottom:14}} onClick={()=>setActivePost(null)}>← Back</button>
      <div style={{background:"#fffdf6",border:"1px solid #e3d8bf",borderRadius:8,padding:18,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
          <Avatar name={activePost.author} url={activePost.avatar_url} size={40}/>
          <div><div style={{fontWeight:600,fontSize:15}}>{activePost.author}</div><div style={{fontSize:11,color:"#9a8c6f"}}>{timeAgo(activePost.created_at)}</div></div>
        </div>
        <h2 style={{margin:"0 0 10px",fontWeight:600,fontSize:20,lineHeight:1.3}}>{activePost.title}</h2>
        <p style={{margin:"0 0 16px",lineHeight:1.75,fontSize:15}}>{activePost.body}</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {RXNS.map(({type,emoji,label})=>{
            const r=activePost.reactions?.[type]||{count:0,mine:false};
            return(<button key={type} onClick={()=>reactToPost(activePost.id,type)}
              style={{background:r.mine?"#fbeec1":"#f0ebe0",border:r.mine?"1px solid #c9a35c":"1px solid #e3d8bf",
                borderRadius:20,padding:"6px 14px",fontSize:13,cursor:"pointer",color:"#5a4a2f"}}>
              {emoji} {label}{r.count>0&&<b> {r.count}</b>}
            </button>);
          })}
        </div>
      </div>
      <div style={{fontSize:11,letterSpacing:"0.2em",color:"#a9762f",marginBottom:10}}>COMMENTS — {postComments.length}</div>
      {postComments.map(c=>(
        <div key={c.id} style={{borderLeft:"3px solid #e3d8bf",paddingLeft:12,marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
            <Avatar name={c.author} url={c.avatar_url} size={26}/>
            <span style={{fontSize:12,color:"#9a8c6f"}}>{c.author} · {timeAgo(c.created_at)}</span>
          </div>
          <div style={{fontSize:14,lineHeight:1.65,margin:"4px 0"}}>{c.body}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {RXNS.map(({type,emoji})=>{
              const r=c.reactions?.[type]||{count:0,mine:false};
              return(<button key={type} onClick={()=>reactToComment(c.id,type)}
                style={{background:r.mine?"#fbeec1":"transparent",border:r.mine?"1px solid #c9a35c":"1px solid #e3d8bf",
                  borderRadius:20,padding:"3px 10px",fontSize:12,cursor:"pointer"}}>
                {emoji}{r.count>0&&` ${r.count}`}
              </button>);
            })}
          </div>
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:16,position:"sticky",bottom:60,background:"#f7f3e8",padding:"8px 0"}}>
        <input value={commentText} onChange={e=>setCommentText(e.target.value)} placeholder="Add a comment…"
          onKeyDown={e=>e.key==="Enter"&&submitComment()}
          style={{flex:1,padding:"12px 14px",fontSize:14,fontFamily:"inherit",border:"1px solid #e3d8bf",borderRadius:6,background:"#fffdf6"}}/>
        <button style={{...S.primaryBtnSm,padding:"12px 16px"}} onClick={submitComment} disabled={postingComment}>{postingComment?"…":"Post"}</button>
      </div>
    </div>
  );

  return(
    <div style={{maxWidth:680,margin:"0 auto",padding:"16px 12px"}}>
      {error&&<div style={{background:"#f6dede",color:"#8a3b2a",padding:"10px 14px",borderRadius:6,marginBottom:14,fontSize:13}}>{error}</div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:11,letterSpacing:"0.2em",color:"#a9762f"}}>COMMUNITY FEED</div>
        <button style={S.primaryBtnSm} onClick={()=>setShowCompose(!showCompose)}>{showCompose?"Cancel":"+ New Post"}</button>
      </div>
      {showCompose&&(
        <form onSubmit={submitPost} style={{background:"#fffdf6",border:"1px solid #c9a35c",borderRadius:8,padding:18,marginBottom:20}}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:12}}>Share a question or thought</div>
          <input value={newPost.title} onChange={e=>setNewPost({...newPost,title:e.target.value})} placeholder="Title / question" required
            style={{...S.input,marginBottom:10,fontSize:15}}/>
          <textarea value={newPost.body} onChange={e=>setNewPost({...newPost,body:e.target.value})} placeholder="Write your post…" required rows={4}
            style={{...S.input,resize:"vertical",marginBottom:10,fontSize:15}}/>
          <button type="submit" style={{...S.primaryBtn,marginTop:0}} disabled={posting}>{posting?"Posting…":"Post to community"}</button>
        </form>
      )}
      {loading&&<div style={{color:"#9a8c6f",fontSize:14,textAlign:"center",padding:24}}>Loading…</div>}
      {posts.map(p=>(
        <div key={p.id} style={{background:"#fffdf6",border:"1px solid #e3d8bf",borderRadius:8,padding:18,marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <Avatar name={p.author} url={p.avatar_url} size={36}/>
            <div>
              <div style={{fontWeight:600,fontSize:14}}>{p.author}</div>
              <div style={{fontSize:11,color:"#9a8c6f"}}>{timeAgo(p.created_at)}{p.group_name&&<span style={{marginLeft:8,background:"#f0ebe0",padding:"2px 8px",borderRadius:10,fontSize:10}}>📖 {p.group_name}</span>}</div>
            </div>
          </div>
          <div style={{fontSize:17,fontWeight:600,marginBottom:6,lineHeight:1.3}}>{p.title}</div>
          <div style={{fontSize:14,lineHeight:1.7,color:"#3a2f1e",marginBottom:14,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical"}}>{p.body}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            {RXNS.map(({type,emoji,label})=>{
              const r=p.reactions?.[type]||{count:0,mine:false};
              return(<button key={type} onClick={e=>{e.stopPropagation();reactToPost(p.id,type);}}
                style={{background:r.mine?"#fbeec1":"#f0ebe0",border:r.mine?"1px solid #c9a35c":"1px solid #e3d8bf",
                  borderRadius:20,padding:"5px 12px",fontSize:13,cursor:"pointer",color:"#5a4a2f"}}>
                {emoji} {label}{r.count>0&&<b> {r.count}</b>}
              </button>);
            })}
            <button onClick={()=>openPost(p)}
              style={{background:"transparent",border:"1px solid #e3d8bf",borderRadius:20,
                padding:"5px 14px",fontSize:13,cursor:"pointer",color:"#a9762f",marginLeft:"auto"}}>
              💬 {p.comment_count} →
            </button>
          </div>
        </div>
      ))}
      {!loading&&posts.length===0&&<div style={{textAlign:"center",color:"#9a8c6f",fontSize:14,padding:40}}>No posts yet — be the first to share.</div>}
    </div>
  );
}

/* ── GROUPS TAB ─────────────────────────────────────────────────── */
function GroupsTab({api}) {
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
    catch(e){setError(e.message);}finally{setLoading(false);}
  }

  async function createGroup(e){
    e.preventDefault();if(!newGroup.name.trim())return;setCreating(true);
    try{
      const d=await api("/groups",{method:"POST",body:JSON.stringify({name:newGroup.name.trim(),description:newGroup.description.trim()})});
      setGroups(prev=>[d.group,...prev]);setNewGroup({name:"",description:""});setShowCreate(false);
    }catch(e){setError(e.message);}finally{setCreating(false);}
  }

  async function joinLeave(group){
    try{
      if(group.my_role){await api(`/groups/${group.id}/leave`,{method:"POST"});setGroups(prev=>prev.map(g=>g.id!==group.id?g:{...g,my_role:null,member_count:parseInt(g.member_count)-1}));}
      else{await api(`/groups/${group.id}/join`,{method:"POST"});setGroups(prev=>prev.map(g=>g.id!==group.id?g:{...g,my_role:"member",member_count:parseInt(g.member_count)+1}));}
    }catch(e){setError(e.message);}
  }

  async function openGroup(group){
    setActiveGroup(group);setMembers([]);
    try{const d=await api(`/groups/${group.id}/members`);setMembers(d.members||[]);}
    catch(e){setError(e.message);}
  }

  if(activeGroup) return(
    <div style={{maxWidth:680,margin:"0 auto",padding:"16px 12px"}}>
      <button style={{...S.ghostBtnSm,marginBottom:14}} onClick={()=>setActiveGroup(null)}>← Back</button>
      <div style={{background:"#fffdf6",border:"1px solid #e3d8bf",borderRadius:8,padding:18,marginBottom:16}}>
        <h2 style={{margin:"0 0 6px",fontWeight:600}}>{activeGroup.name}</h2>
        {activeGroup.description&&<p style={{margin:"0 0 8px",color:"#6b5d45",fontSize:14}}>{activeGroup.description}</p>}
        <div style={{fontSize:12,color:"#9a8c6f"}}>by {activeGroup.created_by_name} · {activeGroup.member_count} members</div>
      </div>
      <div style={{fontSize:11,letterSpacing:"0.2em",color:"#a9762f",marginBottom:12}}>MEMBERS</div>
      {members.map(m=>(
        <div key={m.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:"1px solid #f0ebe0"}}>
          <Avatar name={m.name} url={m.avatar_url} size={40}/>
          <div><div style={{fontWeight:600,fontSize:15}}>{m.name}</div><div style={{fontSize:12,color:"#9a8c6f"}}>{m.role==="admin"?"Admin":"Member"}</div></div>
        </div>
      ))}
    </div>
  );

  return(
    <div style={{maxWidth:680,margin:"0 auto",padding:"16px 12px"}}>
      {error&&<div style={{background:"#f6dede",color:"#8a3b2a",padding:"10px 14px",borderRadius:6,marginBottom:14,fontSize:13}}>{error}</div>}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontSize:11,letterSpacing:"0.2em",color:"#a9762f"}}>READING GROUPS</div>
        <button style={S.primaryBtnSm} onClick={()=>setShowCreate(!showCreate)}>{showCreate?"Cancel":"+ Create Group"}</button>
      </div>
      {showCreate&&(
        <form onSubmit={createGroup} style={{background:"#fffdf6",border:"1px solid #c9a35c",borderRadius:8,padding:18,marginBottom:20}}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:12}}>Create a reading group</div>
          <input value={newGroup.name} onChange={e=>setNewGroup({...newGroup,name:e.target.value})} placeholder="Group name" required style={{...S.input,marginBottom:10}}/>
          <input value={newGroup.description} onChange={e=>setNewGroup({...newGroup,description:e.target.value})} placeholder="Description (optional)" style={{...S.input,marginBottom:10}}/>
          <button type="submit" style={{...S.primaryBtn,marginTop:0}} disabled={creating}>{creating?"Creating…":"Create group"}</button>
        </form>
      )}
      {loading&&<div style={{color:"#9a8c6f",fontSize:14,textAlign:"center",padding:24}}>Loading…</div>}
      {groups.map(g=>(
        <div key={g.id} style={{background:"#fffdf6",border:"1px solid #e3d8bf",borderRadius:8,padding:18,marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
            <div style={{flex:1,cursor:"pointer"}} onClick={()=>openGroup(g)}>
              <div style={{fontSize:17,fontWeight:600,marginBottom:4,lineHeight:1.3}}>
                {g.name}{g.my_role&&<span style={{marginLeft:8,fontSize:11,background:"#fbeec1",padding:"2px 8px",borderRadius:10,color:"#a9762f"}}>{g.my_role==="admin"?"Admin":"Member"}</span>}
              </div>
              {g.description&&<div style={{fontSize:13,color:"#6b5d45",marginBottom:6}}>{g.description}</div>}
              <div style={{fontSize:12,color:"#9a8c6f"}}>👥 {g.member_count} members</div>
            </div>
            <button onClick={()=>joinLeave(g)} style={{...(g.my_role?S.ghostBtnSm:S.primaryBtnSm),flexShrink:0}}>
              {g.my_role?"Leave":"Join"}
            </button>
          </div>
        </div>
      ))}
      {!loading&&groups.length===0&&<div style={{textAlign:"center",color:"#9a8c6f",fontSize:14,padding:40}}>No groups yet — create one to study together.</div>}
    </div>
  );
}

/* ── PROFILE TAB ────────────────────────────────────────────────── */
function ProfileTab({api,user,setUser}) {
  const [profile,setProfile]=useState(null);
  const [editing,setEditing]=useState(false);
  const [form,setForm]=useState({name:"",bio:"",avatar_url:""});
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    api("/me").then(d=>{setProfile(d.user);setForm({name:d.user.name,bio:d.user.bio||"",avatar_url:d.user.avatar_url||""});}).catch(e=>setError(e.message));
  },[]);

  async function saveProfile(e){
    e.preventDefault();setSaving(true);
    try{
      const d=await api("/profile",{method:"PATCH",body:JSON.stringify({name:form.name,bio:form.bio,avatar_url:form.avatar_url})});
      setProfile(d.user);setUser(prev=>({...prev,...d.user}));setEditing(false);
    }catch(e){setError(e.message);}finally{setSaving(false);}
  }

  if(!profile) return <div style={{padding:48,textAlign:"center",color:"#9a8c6f"}}>Loading…</div>;
  const memberSince=new Date(profile.created_at).toLocaleDateString("en-US",{month:"long",year:"numeric"});

  return(
    <div style={{maxWidth:520,margin:"0 auto",padding:"16px 12px"}}>
      {error&&<div style={{background:"#f6dede",color:"#8a3b2a",padding:"10px 14px",borderRadius:6,marginBottom:14,fontSize:13}}>{error}</div>}
      <div style={{background:"#fffdf6",border:"1px solid #e3d8bf",borderRadius:8,padding:24,marginBottom:16,textAlign:"center"}}>
        <Avatar name={profile.name} url={profile.avatar_url} size={80}/>
        <h2 style={{margin:"14px 0 4px",fontWeight:600,fontSize:22}}>{profile.name}</h2>
        {profile.bio&&<p style={{margin:"0 0 10px",color:"#6b5d45",fontSize:14,lineHeight:1.65}}>{profile.bio}</p>}
        <div style={{fontSize:12,color:"#9a8c6f",marginBottom:20}}>Member since {memberSince}</div>
        <div style={{display:"flex",justifyContent:"center",gap:20,marginBottom:20}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:28,fontWeight:700,color:"#a9762f"}}>{profile.streak||0}</div>
            <div style={{fontSize:11,color:"#9a8c6f"}}>day streak 🔥</div>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:28,fontWeight:700,color:"#a9762f"}}>{profile.note_count||0}</div>
            <div style={{fontSize:11,color:"#9a8c6f"}}>notes</div>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:28,fontWeight:700,color:"#a9762f"}}>{profile.post_count||0}</div>
            <div style={{fontSize:11,color:"#9a8c6f"}}>posts</div>
          </div>
        </div>
        <button style={S.primaryBtnSm} onClick={()=>setEditing(!editing)}>{editing?"Cancel":"Edit profile"}</button>
      </div>
      {editing&&(
        <form onSubmit={saveProfile} style={{background:"#fffdf6",border:"1px solid #c9a35c",borderRadius:8,padding:20}}>
          <div style={{fontSize:14,fontWeight:600,marginBottom:14}}>Edit your profile</div>
          <label style={S.label}>Name<input style={S.input} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label>
          <label style={S.label}>Bio
            <textarea value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})} rows={3} placeholder="A little about you…"
              style={{...S.input,resize:"vertical"}}/>
          </label>
          <label style={S.label}>Avatar URL
            <input style={S.input} value={form.avatar_url} onChange={e=>setForm({...form,avatar_url:e.target.value})} placeholder="https://…" type="url"/>
          </label>
          {form.avatar_url&&<div style={{marginBottom:14,textAlign:"center"}}><Avatar name={form.name} url={form.avatar_url} size={64}/></div>}
          <button type="submit" style={{...S.primaryBtn,marginTop:0}} disabled={saving}>{saving?"Saving…":"Save changes"}</button>
        </form>
      )}
    </div>
  );
}

/* ── Shared styles ───────────────────────────────────────────────── */
const S={
  label:{display:"block",fontSize:13,letterSpacing:"0.08em",color:"#6b5d45",marginBottom:14},
  input:{display:"block",width:"100%",marginTop:6,padding:"12px 14px",fontSize:15,fontFamily:"Georgia,serif",
    border:"1px solid #d8cdb4",borderRadius:4,boxSizing:"border-box",background:"#fffdf6"},
  primaryBtn:{width:"100%",padding:"14px 16px",background:"#a9762f",color:"#fffdf6",border:"none",
    borderRadius:6,fontSize:15,letterSpacing:"0.04em",cursor:"pointer",marginTop:8,fontFamily:"Georgia,serif"},
  primaryBtnSm:{padding:"9px 16px",background:"#a9762f",color:"#fffdf6",border:"none",
    borderRadius:4,fontSize:13,cursor:"pointer",fontFamily:"Georgia,serif"},
  ghostBtn:{background:"transparent",color:"#f3ecd9",border:"1px solid #56493a",borderRadius:4,padding:"7px 12px",fontSize:13,cursor:"pointer"},
  ghostBtnSm:{background:"transparent",color:"#6b5d45",border:"1px solid #d8cdb4",borderRadius:4,padding:"8px 14px",fontSize:13,cursor:"pointer"},
  navBtn:{background:"rgba(255,255,255,0.08)",color:"#f3ecd9",border:"1px solid #56493a",borderRadius:4,
    padding:"7px 12px",fontSize:14,cursor:"pointer",whiteSpace:"nowrap"},
  link:{color:"#a9762f",cursor:"pointer",textDecoration:"underline"},
  tabBtn:{border:"none",borderRadius:4,padding:"7px 14px",fontSize:13,cursor:"pointer",fontFamily:"Georgia,serif"},
};
