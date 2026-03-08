import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { onValue, off, ref } from "firebase/database";
import { auth, db } from "./firebase";

// ─── Palette & tokens ────────────────────────────────────────────────
// Deep earthy green + warm amber + cream — agricultural/natural vibe
const THEME = {
  bg: "#0d1a0f",
  surface: "#132016",
  surfaceHover: "#1a2c1e",
  border: "#1f3324",
  accent: "#5dba6a",
  accentGlow: "rgba(93,186,106,0.18)",
  accentDim: "#2e6b38",
  warm: "#e8a838",
  warmDim: "#7a5618",
  red: "#e85050",
  redDim: "#7a2020",
  text: "#e8f0e9",
  textMuted: "#6b8f70",
  textFaint: "#3a5c3e",
};

// ─── Mock cow data (replace with real Firebase refs) ─────────────────
const COW_IDS = ["cow_01", "cow_02", "cow_03", "cow_04", "cow_05", "cow_06"];
const COW_NAMES = {
  cow_01: "Bessie", cow_02: "Daisy", cow_03: "Rosie",
  cow_04: "Clover", cow_05: "Buttercup", cow_06: "Maggie",
};
const COW_TAGS = {
  cow_01: "TAG-001", cow_02: "TAG-002", cow_03: "TAG-003",
  cow_04: "TAG-004", cow_05: "TAG-005", cow_06: "TAG-006",
};

// ─── Global styles ────────────────────────────────────────────────────
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&family=Outfit:wght@300;400;500&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body, #root {
      background: ${THEME.bg};
      color: ${THEME.text};
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
    }

    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: ${THEME.bg}; }
    ::-webkit-scrollbar-thumb { background: ${THEME.accentDim}; border-radius: 3px; }

    @keyframes pulse-ring {
      0% { transform: scale(0.8); opacity: 1; }
      100% { transform: scale(2.2); opacity: 0; }
    }
    @keyframes fade-up {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    @keyframes shimmer {
      0% { background-position: -200% center; }
      100% { background-position: 200% center; }
    }

    .card-enter {
      animation: fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .temp-display {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 500;
    }

    .syne { font-family: 'Syne', sans-serif; }
    .mono { font-family: 'JetBrains Mono', monospace; }

    input:-webkit-autofill,
    input:-webkit-autofill:hover,
    input:-webkit-autofill:focus {
      -webkit-box-shadow: 0 0 0 1000px ${THEME.surface} inset !important;
      -webkit-text-fill-color: ${THEME.text} !important;
    }
  `}</style>
);

// ─── Spinner ──────────────────────────────────────────────────────────
function Spinner({ size = 20, color = THEME.accent }) {
  return (
    <div style={{
      width: size, height: size,
      border: `2px solid ${THEME.border}`,
      borderTop: `2px solid ${color}`,
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
      display: "inline-block",
    }} />
  );
}

// ─── Live dot indicator ───────────────────────────────────────────────
function LiveDot({ active = true }) {
  const c = active ? THEME.accent : THEME.red;
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 14, height: 14 }}>
      {active && (
        <span style={{
          position: "absolute", width: 14, height: 14, borderRadius: "50%",
          background: c, opacity: 0.3,
          animation: "pulse-ring 1.4s ease-out infinite",
        }} />
      )}
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "block" }} />
    </span>
  );
}

// ─── Fence status badge ───────────────────────────────────────────────
function FenceBadge({ inside }) {
  if (inside === null) return (
    <span style={{ fontSize: 12, color: THEME.textMuted, fontFamily: "'JetBrains Mono'" }}>—</span>
  );
  const on = inside === true || inside === "on" || inside === 1;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "4px 10px", borderRadius: 20,
      background: on ? "rgba(93,186,106,0.12)" : "rgba(232,80,80,0.12)",
      border: `1px solid ${on ? THEME.accentDim : THEME.redDim}`,
      color: on ? THEME.accent : THEME.red,
      fontSize: 12, fontWeight: 600, letterSpacing: "0.05em",
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <LiveDot active={on} />
      {on ? "IN FENCE" : "OUT OF FENCE"}
    </span>
  );
}

// ─── Temperature gauge arc ────────────────────────────────────────────
function TempGauge({ value }) {
  const min = 35, max = 42;
  const pct = value === null ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
  const angle = -135 + pct * 270;
  const color = value === null ? THEME.textFaint
    : value > 40 ? THEME.red
    : value > 39 ? THEME.warm
    : THEME.accent;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width="140" height="90" viewBox="0 0 140 90">
        {/* Track arc */}
        <path d="M 14 85 A 56 56 0 1 1 126 85" fill="none" stroke={THEME.border} strokeWidth="8" strokeLinecap="round" />
        {/* Value arc */}
        {value !== null && (
          <path d="M 14 85 A 56 56 0 1 1 126 85" fill="none"
            stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray="263"
            strokeDashoffset={263 - pct * 263}
            style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1), stroke 0.4s" }}
          />
        )}
        {/* Needle */}
        <g transform={`rotate(${angle}, 70, 85)`}>
          <line x1="70" y1="85" x2="70" y2="36" stroke={color} strokeWidth="2" strokeLinecap="round"
            style={{ transition: "transform 0.6s cubic-bezier(0.22,1,0.36,1)" }} />
          <circle cx="70" cy="85" r="5" fill={color} />
        </g>
        {/* Labels */}
        <text x="14" y="98" fill={THEME.textFaint} fontSize="9" fontFamily="JetBrains Mono">{min}°</text>
        <text x="114" y="98" fill={THEME.textFaint} fontSize="9" fontFamily="JetBrains Mono">{max}°</text>
      </svg>
      <div className="temp-display" style={{ fontSize: 36, color, lineHeight: 1 }}>
        {value === null ? "--.-" : value.toFixed(1)}
        <span style={{ fontSize: 18, color: THEME.textMuted }}> °C</span>
      </div>
      <div style={{ fontSize: 12, color: THEME.textMuted, letterSpacing: "0.1em" }}>
        {value === null ? "NO DATA"
          : value > 40 ? "⚠ HIGH TEMP"
          : value > 39 ? "SLIGHTLY WARM"
          : "NORMAL"}
      </div>
    </div>
  );
}

// ─── Single cow realtime hook ─────────────────────────────────────────
function useCowData(user, cowId) {
  const [temp, setTemp] = useState(null);
  const [fence, setFence] = useState(null);
  const [tempUpdated, setTempUpdated] = useState(null);
  const [fenceUpdated, setFenceUpdated] = useState(null);

  useEffect(() => {
    if (!user || !cowId) return;
    const uid = user.uid;

    const tempRef = ref(db, `/users/${uid}/sensors/${cowId}/tempC`);
    const fenceRef = ref(db, `/users/${uid}/sensors/${cowId}/rfid`);

    const unsubTemp = onValue(tempRef, (snap) => {
      const v = snap.val();
      setTemp(v !== null && v !== undefined ? Number(v) : null);
      setTempUpdated(new Date());
    }, () => {});

    const unsubFence = onValue(fenceRef, (snap) => {
      const v = snap.val();
      setFence(v !== null && v !== undefined ? v : null);
      setFenceUpdated(new Date());
    }, () => {});

    return () => {
      try { unsubTemp(); } catch { off(tempRef); }
      try { unsubFence(); } catch { off(fenceRef); }
    };
  }, [user, cowId]);

  return { temp, fence, tempUpdated, fenceUpdated };
}

// ─── Cow card (dashboard grid) ────────────────────────────────────────
function CowCard({ user, cowId, index, onClick }) {
  const { temp, fence } = useCowData(user, cowId);
  const inside = fence === "on" || fence === 1 || fence === true;
  const alert = temp !== null && temp > 40;

  return (
    <div
      className="card-enter"
      onClick={() => onClick(cowId)}
      style={{
        animationDelay: `${index * 60}ms`,
        background: THEME.surface,
        border: `1px solid ${alert ? THEME.redDim : THEME.border}`,
        borderRadius: 16,
        padding: "20px 22px",
        cursor: "pointer",
        transition: "border-color 0.2s, background 0.2s, transform 0.15s",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = THEME.surfaceHover;
        e.currentTarget.style.borderColor = alert ? THEME.red : THEME.accentDim;
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = THEME.surface;
        e.currentTarget.style.borderColor = alert ? THEME.redDim : THEME.border;
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Alert banner */}
      {alert && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 3,
          background: `linear-gradient(90deg, ${THEME.red}, ${THEME.warm})`,
          animation: "blink 1s ease-in-out infinite",
        }} />
      )}

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div className="syne" style={{ fontSize: 18, fontWeight: 700, color: THEME.text }}>
            {COW_NAMES[cowId]}
          </div>
          <div className="mono" style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2 }}>
            {COW_TAGS[cowId]} · {cowId}
          </div>
        </div>
        <div style={{ fontSize: 28 }}>🐄</div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{
          flex: 1, background: THEME.bg, borderRadius: 10, padding: "10px 14px",
        }}>
          <div style={{ fontSize: 10, color: THEME.textMuted, letterSpacing: "0.12em", marginBottom: 4 }}>TEMPERATURE</div>
          <div className="temp-display" style={{
            fontSize: 22,
            color: temp === null ? THEME.textFaint : temp > 40 ? THEME.red : temp > 39 ? THEME.warm : THEME.accent,
          }}>
            {temp === null ? "--.-" : temp.toFixed(1)}°C
          </div>
        </div>
        <div style={{ flex: 1, background: THEME.bg, borderRadius: 10, padding: "10px 14px" }}>
          <div style={{ fontSize: 10, color: THEME.textMuted, letterSpacing: "0.12em", marginBottom: 6 }}>FENCE STATUS</div>
          <FenceBadge inside={fence} />
        </div>
      </div>

      <div style={{
        marginTop: 14, fontSize: 11, color: THEME.textFaint,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <LiveDot active={temp !== null || fence !== null} />
        <span>Click to view details</span>
      </div>
    </div>
  );
}

// ─── Cow detail page ──────────────────────────────────────────────────
function CowDetail({ user, cowId, onBack }) {
  const { temp, fence, tempUpdated, fenceUpdated } = useCowData(user, cowId);

  const fmt = (d) => d ? d.toLocaleString("th-TH") : "—";

  return (
    <div className="card-enter" style={{ maxWidth: 700, margin: "0 auto" }}>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          background: "none", border: `1px solid ${THEME.border}`,
          color: THEME.textMuted, borderRadius: 8, padding: "8px 16px",
          cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6,
          marginBottom: 28, transition: "color 0.2s, border-color 0.2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.color = THEME.text; e.currentTarget.style.borderColor = THEME.accentDim; }}
        onMouseLeave={e => { e.currentTarget.style.color = THEME.textMuted; e.currentTarget.style.borderColor = THEME.border; }}
      >
        ← Back to Dashboard
      </button>

      {/* Hero header */}
      <div style={{
        background: THEME.surface,
        border: `1px solid ${THEME.border}`,
        borderRadius: 20, padding: "28px 32px",
        marginBottom: 20,
        display: "flex", alignItems: "center", gap: 20,
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: 16,
          background: THEME.accentGlow, border: `1px solid ${THEME.accentDim}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36,
        }}>🐄</div>
        <div>
          <div className="syne" style={{ fontSize: 28, fontWeight: 800, color: THEME.text }}>
            {COW_NAMES[cowId]}
          </div>
          <div className="mono" style={{ fontSize: 12, color: THEME.textMuted, marginTop: 4 }}>
            {COW_TAGS[cowId]} · {cowId} · ESP32-01
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <LiveDot active={true} />
          <span style={{ fontSize: 12, color: THEME.accent, letterSpacing: "0.1em" }}>LIVE</span>
        </div>
      </div>

      {/* Two sensor panels */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Temperature panel */}
        <div style={{
          background: THEME.surface, border: `1px solid ${THEME.border}`,
          borderRadius: 20, padding: "28px 24px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        }}>
          <div style={{
            width: "100%", display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
          }}>
            <span style={{ fontSize: 18 }}>🌡️</span>
            <span className="syne" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.08em", color: THEME.textMuted }}>
              DS18B20 TEMPERATURE
            </span>
          </div>

          <TempGauge value={temp} />

          <div style={{ marginTop: 12, width: "100%" }}>
            <div style={{
              background: THEME.bg, borderRadius: 10, padding: "10px 14px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 11, color: THEME.textMuted }}>Last updated</span>
              <span className="mono" style={{ fontSize: 11, color: THEME.textFaint }}>{fmt(tempUpdated)}</span>
            </div>
            {/* Mini range bars */}
            <div style={{ marginTop: 10, display: "flex", gap: 4 }}>
              {[
                { label: "Normal", range: "35–39°C", color: THEME.accent },
                { label: "Warm", range: "39–40°C", color: THEME.warm },
                { label: "High", range: ">40°C", color: THEME.red },
              ].map(({ label, range, color }) => (
                <div key={label} style={{ flex: 1, background: THEME.bg, borderRadius: 8, padding: "7px 8px" }}>
                  <div style={{ width: 8, height: 3, borderRadius: 2, background: color, marginBottom: 4 }} />
                  <div style={{ fontSize: 9, color: THEME.textMuted }}>{label}</div>
                  <div className="mono" style={{ fontSize: 9, color: THEME.textFaint }}>{range}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RFID / Fence panel */}
        <div style={{
          background: THEME.surface, border: `1px solid ${THEME.border}`,
          borderRadius: 20, padding: "28px 24px",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 18 }}>📡</span>
            <span className="syne" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.08em", color: THEME.textMuted }}>
              RFID FENCE STATUS
            </span>
          </div>

          {/* Big status display */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "16px 0" }}>
            <div style={{
              width: 100, height: 100, borderRadius: "50%",
              background: fence === null ? THEME.bg :
                (fence === "on" || fence === 1 || fence === true)
                  ? "rgba(93,186,106,0.1)" : "rgba(232,80,80,0.1)",
              border: `2px solid ${fence === null ? THEME.border :
                (fence === "on" || fence === 1 || fence === true) ? THEME.accentDim : THEME.redDim}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 40,
              position: "relative",
            }}>
              {fence === null ? "—" :
                (fence === "on" || fence === 1 || fence === true) ? "🐄" : "🚨"}
              {/* Pulse for out-of-fence alert */}
              {fence !== null && !(fence === "on" || fence === 1 || fence === true) && (
                <span style={{
                  position: "absolute", inset: -4, borderRadius: "50%",
                  border: `2px solid ${THEME.red}`,
                  animation: "pulse-ring 1.2s ease-out infinite",
                }} />
              )}
            </div>

            <FenceBadge inside={fence} />

            <div className="mono" style={{ fontSize: 12, color: THEME.textMuted, textAlign: "center", lineHeight: 1.6 }}>
              {fence === null ? "Awaiting RFID signal..." :
                (fence === "on" || fence === 1 || fence === true)
                  ? "Cow is safely\ninside the fence"
                  : "⚠ Cow has left\nthe fence area!"}
            </div>
          </div>

          <div style={{
            background: THEME.bg, borderRadius: 10, padding: "10px 14px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 11, color: THEME.textMuted }}>Last signal</span>
            <span className="mono" style={{ fontSize: 11, color: THEME.textFaint }}>{fmt(fenceUpdated)}</span>
          </div>

          {/* RFID raw value */}
          <div style={{
            background: THEME.bg, borderRadius: 10, padding: "10px 14px",
            display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4,
          }}>
            <span style={{ fontSize: 11, color: THEME.textMuted }}>Raw value</span>
            <span className="mono" style={{ fontSize: 11, color: THEME.accent }}>
              {fence === null ? "null" : String(fence)}
            </span>
          </div>
        </div>
      </div>

      {/* Firebase path info */}
      <div style={{
        marginTop: 16, background: THEME.surface, border: `1px solid ${THEME.border}`,
        borderRadius: 12, padding: "12px 18px",
        display: "flex", gap: 20, flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontSize: 10, color: THEME.textFaint, letterSpacing: "0.1em", marginBottom: 2 }}>TEMP PATH</div>
          <code style={{ fontSize: 11, color: THEME.textMuted }}>/users/{user.uid}/sensors/{cowId}/tempC</code>
        </div>
        <div>
          <div style={{ fontSize: 10, color: THEME.textFaint, letterSpacing: "0.1em", marginBottom: 2 }}>RFID PATH</div>
          <code style={{ fontSize: 11, color: THEME.textMuted }}>/users/{user.uid}/sensors/{cowId}/rfid</code>
        </div>
      </div>
    </div>
  );
}

// ─── Login page ───────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    if (!email || !pass) return;
    setLoading(true); setError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
      onLogin();
    } catch (e) {
      setError(e.message.replace("Firebase: ", ""));
    }
    setLoading(false);
  }

  async function handleGoogle() {
    setLoading(true); setError("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onLogin();
    } catch (e) {
      setError(e.message.replace("Firebase: ", ""));
    }
    setLoading(false);
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: THEME.bg, position: "relative", overflow: "hidden",
    }}>
      {/* Background pattern */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.03,
        backgroundImage: "radial-gradient(circle, #5dba6a 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }} />
      <div style={{
        position: "absolute", top: "20%", left: "10%", width: 400, height: 400,
        borderRadius: "50%", background: "radial-gradient(circle, rgba(93,186,106,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div className="card-enter" style={{
        background: THEME.surface, border: `1px solid ${THEME.border}`,
        borderRadius: 24, padding: "44px 40px", width: "100%", maxWidth: 420,
        position: "relative", zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🐄</div>
          <div className="syne" style={{ fontSize: 26, fontWeight: 800, color: THEME.text, letterSpacing: "-0.02em" }}>
            SmartFarm
          </div>
          <div style={{ fontSize: 13, color: THEME.textMuted, marginTop: 4 }}>
            IoT Cow Tracking System
          </div>
        </div>

        {/* Email/pass */}
        {[
          { val: email, set: setEmail, placeholder: "Email address", type: "email" },
          { val: pass, set: setPass, placeholder: "Password", type: "password" },
        ].map(({ val, set, placeholder, type }) => (
          <input
            key={placeholder}
            type={type}
            placeholder={placeholder}
            value={val}
            onChange={e => set(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            style={{
              display: "block", width: "100%",
              background: THEME.bg, border: `1px solid ${THEME.border}`,
              borderRadius: 10, padding: "13px 16px",
              color: THEME.text, fontSize: 14, outline: "none",
              marginBottom: 10,
              transition: "border-color 0.2s",
              fontFamily: "'Outfit', sans-serif",
            }}
            onFocus={e => e.target.style.borderColor = THEME.accentDim}
            onBlur={e => e.target.style.borderColor = THEME.border}
          />
        ))}

        {error && (
          <div style={{
            background: "rgba(232,80,80,0.08)", border: `1px solid ${THEME.redDim}`,
            borderRadius: 8, padding: "10px 14px", color: THEME.red,
            fontSize: 12, marginBottom: 14,
          }}>{error}</div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: "100%", padding: "13px", borderRadius: 10, border: "none",
            background: loading ? THEME.accentDim : THEME.accent,
            color: "#0d1a0f", fontWeight: 700, fontSize: 14, cursor: loading ? "default" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "background 0.2s, transform 0.1s",
            fontFamily: "'Syne', sans-serif", letterSpacing: "0.04em",
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
        >
          {loading ? <Spinner size={18} color="#0d1a0f" /> : "Sign In"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
          <div style={{ flex: 1, height: 1, background: THEME.border }} />
          <span style={{ fontSize: 11, color: THEME.textFaint }}>OR</span>
          <div style={{ flex: 1, height: 1, background: THEME.border }} />
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading}
          style={{
            width: "100%", padding: "12px", borderRadius: 10,
            background: "none", border: `1px solid ${THEME.border}`,
            color: THEME.text, fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            transition: "border-color 0.2s, background 0.2s",
            fontFamily: "'Outfit', sans-serif",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = THEME.accentDim; e.currentTarget.style.background = THEME.surfaceHover; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = THEME.border; e.currentTarget.style.background = "none"; }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-7.9 19.7-20 0-1.3-.1-2.7-.1-4z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.5 35.6 26.9 36 24 36c-5.2 0-9.6-3-11.3-7.3l-6.6 5.1C9.7 39.7 16.3 44 24 44z"/>
            <path fill="#1565C0" d="M43.6 20H24v8h11.3c-.9 2.3-2.5 4.3-4.5 5.8l6.2 5.2C41.1 35.6 44 30.1 44 24c0-1.3-.1-2.7-.4-4z"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}

// ─── Dashboard header ─────────────────────────────────────────────────
function Header({ user, onLogout }) {
  return (
    <div style={{
      background: THEME.surface, borderBottom: `1px solid ${THEME.border}`,
      padding: "16px 32px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      position: "sticky", top: 0, zIndex: 100,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 22 }}>🐄</span>
        <div>
          <div className="syne" style={{ fontSize: 17, fontWeight: 800, color: THEME.text, letterSpacing: "-0.01em" }}>
            SmartFarm <span style={{ color: THEME.accent }}>IoT</span>
          </div>
          <div style={{ fontSize: 10, color: THEME.textMuted, letterSpacing: "0.12em" }}>COW TRACKING SYSTEM</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <LiveDot active={true} />
          <span style={{ fontSize: 12, color: THEME.textMuted }}>{user.email}</span>
        </div>
        <button
          onClick={onLogout}
          style={{
            background: "none", border: `1px solid ${THEME.border}`,
            color: THEME.textMuted, borderRadius: 8, padding: "7px 14px",
            cursor: "pointer", fontSize: 12,
            transition: "color 0.2s, border-color 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = THEME.red; e.currentTarget.style.borderColor = THEME.redDim; }}
          onMouseLeave={e => { e.currentTarget.style.color = THEME.textMuted; e.currentTarget.style.borderColor = THEME.border; }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [selectedCow, setSelectedCow] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  async function handleLogout() {
    try { await signOut(auth); setSelectedCow(null); } catch {}
  }

  // Loading state
  if (user === undefined) {
    return (
      <>
        <GlobalStyle />
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Spinner size={36} />
        </div>
      </>
    );
  }

  // Not logged in
  if (!user) return (
    <>
      <GlobalStyle />
      <LoginPage onLogin={() => {}} />
    </>
  );

  // Logged in
  return (
    <>
      <GlobalStyle />
      <Header user={user} onLogout={handleLogout} />

      <div style={{ padding: "32px 32px", maxWidth: 1100, margin: "0 auto", width: "100%" }}>
        {selectedCow ? (
          <CowDetail user={user} cowId={selectedCow} onBack={() => setSelectedCow(null)} />
        ) : (
          <>
            {/* Dashboard title */}
            <div style={{ marginBottom: 28 }}>
              <h1 className="syne" style={{ fontSize: 28, fontWeight: 800, color: THEME.text, letterSpacing: "-0.02em" }}>
                Herd Overview
              </h1>
              <p style={{ fontSize: 14, color: THEME.textMuted, marginTop: 6 }}>
                {COW_IDS.length} cows · Real-time sensor monitoring
              </p>
            </div>

            {/* Summary stats bar */}
            <div style={{
              display: "flex", gap: 12, marginBottom: 28, flexWrap: "wrap",
            }}>
              {[
                { label: "Total Cows", value: COW_IDS.length, icon: "🐄" },
                { label: "Active Devices", value: COW_IDS.length, icon: "📡", color: THEME.accent },
                { label: "ESP32 Nodes", value: 1, icon: "🔌", color: THEME.warm },
              ].map(({ label, value, icon, color }) => (
                <div key={label} style={{
                  background: THEME.surface, border: `1px solid ${THEME.border}`,
                  borderRadius: 12, padding: "14px 20px",
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <span style={{ fontSize: 20 }}>{icon}</span>
                  <div>
                    <div className="syne" style={{ fontSize: 20, fontWeight: 700, color: color || THEME.text }}>{value}</div>
                    <div style={{ fontSize: 11, color: THEME.textMuted }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Cow grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 16,
            }}>
              {COW_IDS.map((id, i) => (
                <CowCard key={id} user={user} cowId={id} index={i} onClick={setSelectedCow} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}