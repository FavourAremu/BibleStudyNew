import React, { useState, useEffect } from "react";

/**
 * Bible Study Journal — Prototype (wired to API)
 * -------------------------------------------------
 * Talks to the Express API in /server (auth, highlights, comments,
 * export). Set API_BASE to wherever that server is deployed.
 *
 * Verse text itself is still mocked (public-domain John 3:16-18 in
 * 6 versions) — swap MOCK_VERSES for a Bible text API when ready.
 */

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000/api";

const VERSIONS = [
  { code: "KJV", name: "King James Version" },
  { code: "ASV", name: "American Standard Version" },
  { code: "WEB", name: "World English Bible" },
  { code: "YLT", name: "Young's Literal Translation" },
  { code: "DBY", name: "Darby Translation" },
  { code: "WBS", name: "Webster's Bible" },
];

const MOCK_VERSES = {
  KJV: [
    "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
    "For God sent not his Son into the world to condemn the world; but that the world through him might be saved.",
    "He that believeth on him is not condemned: but he that believeth not is condemned already, because he hath not believed in the name of the only begotten Son of God.",
  ],
  ASV: [
    "For God so loved the world, that he gave his only begotten Son, that whosoever believeth on him should not perish, but have eternal life.",
    "For God sent not the Son into the world to judge the world; but that the world should be saved through him.",
    "He that believeth on him is not judged: he that believeth not hath been judged already, because he hath not believed on the name of the only begotten Son of God.",
  ],
  WEB: [
    "For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.",
    "For God didn't send his Son into the world to judge the world, but that the world should be saved through him.",
    "He who believes in him is not judged. He who doesn't believe has been judged already, because he has not believed in the name of the only born Son of God.",
  ],
  YLT: [
    "for God did so love the world, that His Son the only begotten He gave, that every one who is believing in him may not perish, but may have life age-during.",
    "for God did not send His Son to the world that he may judge the world, but that the world may be saved through him.",
    "He who is believing in him is not judged, but he who is not believing hath been judged already, because he hath not believed in the name of the only begotten Son of God.",
  ],
  DBY: [
    "For God so loved the world, that he has given the only-begotten Son, that whosoever believes on him may not perish, but have life eternal.",
    "For God has not sent his Son into the world that he may judge the world, but that the world might be saved through him.",
    "He that believes on him is not judged: but he that believes not has been already judged, because he has not believed on the name of the only-begotten Son of God.",
  ],
  WBS: [
    "For God so loved the world, that he gave his only begotten Son, that whoever believeth in him should not perish, but have everlasting life.",
    "For God sent not his Son into the world to condemn the world; but that the world through him may be saved.",
    "He that believeth in him is not condemned: but he that believeth not is condemned already, because he hath not believed in the name of the only begotten Son of God.",
  ],
};

const BOOK = "John";
const CHAPTER = 3;
const CHAPTER_REF = "John 3:16–18";

export default function BibleStudyJournal() {
  const [screen, setScreen] = useState("auth");
  const [authMode, setAuthMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState("");

  const [activeSelection, setActiveSelection] = useState(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [showExport, setShowExport] = useState(false);

  async function api(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const path = authMode === "login" ? "/login" : "/signup";
      const body =
        authMode === "login"
          ? { email: form.email, password: form.password }
          : { name: form.name, email: form.email, password: form.password };
      const data = await api(path, { method: "POST", body: JSON.stringify(body) });
      setToken(data.token);
      setUser(data.user);
      setScreen("reader");
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    setToken(null);
    setUser(null);
    setNotes([]);
    setScreen("auth");
  }

  useEffect(() => {
    if (!token) return;
    setNotesLoading(true);
    setNotesError("");
    api(`/chapters/${BOOK}/${CHAPTER}/notes`)
      .then((data) => setNotes(data.notes || []))
      .catch((err) => setNotesError(err.message))
      .finally(() => setNotesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSelect = (versionCode, verseIndex) => {
    const sel = window.getSelection ? window.getSelection().toString().trim() : "";
    if (!sel) return;
    setActiveSelection({ version: versionCode, verseIndex, quote: sel });
    setDraft("");
  };

  async function saveNote() {
    if (!activeSelection || !draft.trim()) return;
    setSaving(true);
    try {
      const verseNumber = 16 + activeSelection.verseIndex;
      const { highlight } = await api("/highlights", {
        method: "POST",
        body: JSON.stringify({
          book: BOOK,
          chapter: CHAPTER,
          verse: verseNumber,
          version: activeSelection.version,
          quote: activeSelection.quote,
        }),
      });
      const { comment } = await api("/comments", {
        method: "POST",
        body: JSON.stringify({
          book: BOOK,
          chapter: CHAPTER,
          verse: verseNumber,
          highlightId: highlight.id,
          body: draft.trim(),
        }),
      });

      setNotes((prev) => [
        ...prev,
        {
          comment_id: comment.id,
          verse_number: verseNumber,
          comment: comment.body,
          author: user?.name,
          version: highlight.version,
          quote: highlight.quote,
          created_at: comment.created_at,
        },
      ]);
      setActiveSelection(null);
      setDraft("");
    } catch (err) {
      setNotesError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const verseHasNotes = (verseIndex) =>
    notes.some((n) => n.verse_number === 16 + verseIndex);

  async function downloadExport(format) {
    try {
      const res = await fetch(`${API_BASE}/chapters/${BOOK}/${CHAPTER}/export?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${BOOK}-${CHAPTER}-notes.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setNotesError(err.message);
    }
  }

  if (screen === "auth") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(180deg, #2b2419 0%, #1b1712 100%)",
          fontFamily: "Georgia, 'Times New Roman', serif",
          color: "#f3ecd9",
          padding: "24px",
        }}
      >
        <form
          onSubmit={handleAuthSubmit}
          style={{
            width: "100%",
            maxWidth: 380,
            background: "#f3ecd9",
            color: "#2b2419",
            borderRadius: 4,
            padding: "40px 32px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 6,
              background: "#a9762f",
            }}
          />
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontSize: 13, letterSpacing: "0.3em", color: "#a9762f", marginBottom: 6 }}>
              MARGINALIA
            </div>
            <h1 style={{ fontSize: 28, margin: 0, fontWeight: 400, letterSpacing: "0.02em" }}>
              {authMode === "login" ? "Welcome back" : "Begin your study"}
            </h1>
            <p style={{ fontSize: 13, color: "#6b5d45", marginTop: 8 }}>
              Read scripture side-by-side, write in the margins, share what you find.
            </p>
          </div>

          {authMode === "signup" && (
            <label style={labelStyle}>
              Name
              <input
                style={inputStyle}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Your name"
                required
              />
            </label>
          )}
          <label style={labelStyle}>
            Email
            <input
              style={inputStyle}
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              required
            />
          </label>
          <label style={labelStyle}>
            Password
            <input
              style={inputStyle}
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </label>

          {authError && (
            <div style={{ color: "#b3422f", fontSize: 12.5, marginBottom: 10 }}>{authError}</div>
          )}

          <button type="submit" style={primaryButton} disabled={authLoading}>
            {authLoading ? "Please wait…" : authMode === "login" ? "Log in" : "Create account"}
          </button>

          <div style={{ textAlign: "center", marginTop: 18, fontSize: 13 }}>
            {authMode === "login" ? (
              <>
                New here?{" "}
                <a style={linkStyle} onClick={() => { setAuthMode("signup"); setAuthError(""); }}>
                  Create an account
                </a>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <a style={linkStyle} onClick={() => { setAuthMode("login"); setAuthError(""); }}>
                  Log in
                </a>
              </>
            )}
          </div>

          <div style={{ marginTop: 16, fontSize: 11, color: "#9a8c6f", textAlign: "center" }}>
            Connects to {API_BASE}
          </div>
        </form>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f7f3e8",
        fontFamily: "Georgia, 'Times New Roman', serif",
        color: "#2b2419",
      }}
    >
      <div
        style={{
          background: "#2b2419",
          color: "#f3ecd9",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.3em", color: "#c9a35c" }}>MARGINALIA</div>
          <div style={{ fontSize: 20 }}>{CHAPTER_REF}</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#d8cdb4" }}>{user?.name}</span>
          <button style={ghostButton} onClick={() => setShowExport(true)}>
            Export chapter notes
          </button>
          <button style={ghostButton} onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>

      {notesError && (
        <div style={{ background: "#f6dede", color: "#8a3b2a", padding: "8px 24px", fontSize: 13 }}>
          {notesError}
        </div>
      )}

      <div style={{ display: "flex", gap: 0, alignItems: "flex-start" }}>
        <div
          style={{
            flex: "1 1 0",
            minWidth: 0,
            padding: "24px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {VERSIONS.map((v) => (
            <div
              key={v.code}
              style={{
                background: "#fffdf6",
                border: "1px solid #e3d8bf",
                borderRadius: 4,
                padding: "16px 18px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.2em",
                  color: "#a9762f",
                  marginBottom: 10,
                  borderBottom: "1px solid #ecdfc4",
                  paddingBottom: 6,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{v.code}</span>
                <span style={{ color: "#bdb097", fontStyle: "italic", letterSpacing: "normal" }}>
                  {v.name}
                </span>
              </div>
              {MOCK_VERSES[v.code].map((text, vi) => (
                <p
                  key={vi}
                  onMouseUp={() => handleSelect(v.code, vi)}
                  style={{
                    margin: "0 0 10px 0",
                    fontSize: 15.5,
                    lineHeight: 1.6,
                    cursor: "text",
                    background: verseHasNotes(vi) ? "#fbeec1" : "transparent",
                    padding: verseHasNotes(vi) ? "2px 4px" : 0,
                    borderRadius: 2,
                  }}
                >
                  <sup style={{ color: "#a9762f", fontSize: 11, marginRight: 4 }}>{16 + vi}</sup>
                  {text}
                </p>
              ))}
            </div>
          ))}
        </div>

        <div
          style={{
            width: 320,
            flexShrink: 0,
            borderLeft: "1px solid #e3d8bf",
            minHeight: "calc(100vh - 60px)",
            padding: "24px 18px",
            background: "#fbf6ea",
          }}
        >
          <div style={{ fontSize: 11, letterSpacing: "0.2em", color: "#a9762f", marginBottom: 14 }}>
            MARGIN NOTES — {notesLoading ? "…" : notes.length}
          </div>

          {activeSelection && (
            <div
              style={{
                background: "#fffdf6",
                border: "1px solid #c9a35c",
                borderRadius: 4,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 12, color: "#6b5d45", marginBottom: 6 }}>
                Selected ({activeSelection.version}, v.{16 + activeSelection.verseIndex}):
              </div>
              <div style={{ fontSize: 13, fontStyle: "italic", marginBottom: 8 }}>
                “{activeSelection.quote}”
              </div>
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write your note or question…"
                style={{
                  width: "100%",
                  minHeight: 70,
                  fontFamily: "inherit",
                  fontSize: 13,
                  padding: 8,
                  border: "1px solid #e3d8bf",
                  borderRadius: 3,
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button style={primaryButtonSmall} onClick={saveNote} disabled={saving}>
                  {saving ? "Saving…" : "Add note"}
                </button>
                <button
                  style={ghostButtonSmall}
                  onClick={() => {
                    setActiveSelection(null);
                    setDraft("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!notesLoading && notes.length === 0 && !activeSelection && (
            <div style={{ fontSize: 13, color: "#9a8c6f", lineHeight: 1.6 }}>
              Highlight any phrase in a verse to write a note here. Notes from every translation
              collect together for this chapter.
            </div>
          )}

          {notes
            .slice()
            .sort((a, b) => a.verse_number - b.verse_number)
            .map((n) => (
              <div
                key={n.comment_id}
                style={{
                  borderLeft: "3px solid #c9a35c",
                  paddingLeft: 10,
                  marginBottom: 14,
                }}
              >
                <div style={{ fontSize: 11, color: "#a9762f" }}>
                  v.{n.verse_number} · {n.version}
                </div>
                {n.quote && (
                  <div style={{ fontSize: 12.5, fontStyle: "italic", color: "#6b5d45", margin: "2px 0" }}>
                    “{n.quote}”
                  </div>
                )}
                <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{n.comment}</div>
                <div style={{ fontSize: 11, color: "#bdb097", marginTop: 2 }}>— {n.author}</div>
              </div>
            ))}
        </div>
      </div>

      {showExport && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(43,36,25,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: "#fffdf6",
              borderRadius: 4,
              maxWidth: 440,
              width: "100%",
              padding: 28,
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          >
            <h2 style={{ marginTop: 0, fontWeight: 400 }}>Export {CHAPTER_REF} notes</h2>
            <p style={{ fontSize: 13.5, color: "#6b5d45", lineHeight: 1.6 }}>
              Downloads every margin note for this chapter from the server, grouped by verse.
              This prototype exports markdown/text — the production build can add matching .docx
              and .pdf renderers using the same query.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button style={primaryButtonSmall} onClick={() => downloadExport("md")}>
                Download .md
              </button>
              <button style={primaryButtonSmall} onClick={() => downloadExport("txt")}>
                Download .txt
              </button>
              <button style={ghostButtonSmall} onClick={() => setShowExport(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = {
  display: "block",
  fontSize: 12,
  letterSpacing: "0.1em",
  color: "#6b5d45",
  marginBottom: 14,
};

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: 6,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "Georgia, serif",
  border: "1px solid #d8cdb4",
  borderRadius: 3,
  boxSizing: "border-box",
  background: "#fffdf6",
};

const primaryButton = {
  width: "100%",
  padding: "12px 16px",
  background: "#a9762f",
  color: "#fffdf6",
  border: "none",
  borderRadius: 3,
  fontSize: 14,
  letterSpacing: "0.05em",
  cursor: "pointer",
  marginTop: 6,
};

const primaryButtonSmall = {
  ...primaryButton,
  width: "auto",
  padding: "8px 14px",
  fontSize: 12.5,
};

const ghostButton = {
  background: "transparent",
  color: "#f3ecd9",
  border: "1px solid #56493a",
  borderRadius: 3,
  padding: "6px 12px",
  fontSize: 12.5,
  cursor: "pointer",
};

const ghostButtonSmall = {
  background: "transparent",
  color: "#6b5d45",
  border: "1px solid #d8cdb4",
  borderRadius: 3,
  padding: "8px 14px",
  fontSize: 12.5,
  cursor: "pointer",
};

const linkStyle = {
  color: "#a9762f",
  cursor: "pointer",
  textDecoration: "underline",
};
