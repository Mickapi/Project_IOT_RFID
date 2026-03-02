import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { onValue, off, ref } from "firebase/database";
import { auth, db } from "./firebase";

export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [temp, setTemp] = useState(null);
  const [status, setStatus] = useState("ยังไม่ได้เข้าสู่ระบบ");
  const [updated, setUpdated] = useState("-");

  const path = useMemo(() => {
    if (!user) return null;
    return `/users/${user.uid}/sensors/esp32_01/tempC`;
  }, [user]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setTemp(null);
      setUpdated("-");
      setStatus(u ? "เข้าสู่ระบบแล้ว" : "ยังไม่ได้เข้าสู่ระบบ");
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!path) return;

    setStatus("กำลังอ่านค่า...");
    const r = ref(db, path);

    const unsubscribeDB = onValue(
      r,
      (snap) => {
        const v = snap.val();
        if (v === null || v === undefined) {
          setTemp(null);
          setStatus("ยังไม่มีข้อมูลใน path นี้");
          return;
        }
        setTemp(Number(v));
        setUpdated(new Date().toLocaleString("th-TH"));
        setStatus("อัปเดตเรียลไทม์ OK");
      },
      (err) => setStatus("DB read error: " + err.message)
    );

    // firebase v9: onValue คืนฟังก์ชัน unsubscribe ได้
    return () => {
      try {
        unsubscribeDB();
      } catch {
        // fallback เผื่อบาง build
        off(r);
      }
    };
  }, [path]);

  async function handleLogin() {
    try {
      setStatus("กำลังล็อกอิน...");
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch (e) {
      setStatus("Login error: " + e.message);
    }
  }

  async function handleLogout() {
    try {
      await signOut(auth);
    } catch (e) {
      setStatus("Logout error: " + e.message);
    }
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 24, maxWidth: 560 }}>
      <h1>Smart Farm Dashboard</h1>

      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
        <h2>เข้าสู่ระบบ</h2>

        {!user ? (
          <>
            <input
              style={{ padding: 10, width: "100%", margin: "6px 0" }}
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              style={{ padding: 10, width: "100%", margin: "6px 0" }}
              placeholder="Password"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
            <button onClick={handleLogin} style={{ padding: "10px 14px" }}>
              Login
            </button>
          </>
        ) : (
          <>
            <div>Logged in as: <b>{user.email}</b></div>
            <button onClick={handleLogout} style={{ padding: "10px 14px", marginTop: 10 }}>
              Logout
            </button>
          </>
        )}

        <hr style={{ margin: "16px 0" }} />

        <h2>อุณหภูมิ (DS18B20)</h2>
        <div style={{ color: "#666" }}>Path: <code>{path || "-"}</code></div>

        <div style={{ fontSize: 48, margin: "12px 0" }}>
          {temp === null ? "--" : temp.toFixed(2)} °C
        </div>

        <div style={{ color: "#666" }}>อัปเดตล่าสุด: {updated}</div>
        <div style={{ color: "#666", marginTop: 8 }}>{status}</div>
      </div>
    </div>
  );
}