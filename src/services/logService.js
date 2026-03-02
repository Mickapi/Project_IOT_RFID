import { ref, push, set, update, query, orderByChild, startAt, endAt, get, limitToLast } from "firebase/database";
import { db } from "../firebase";

export async function writeCurrentAndLog(deviceId, type, payload) {
  const ts = Date.now();

  // current
  await update(ref(db, `devices/${deviceId}/current`), { ts, type, payload });

  // logs (append)
  const logRef = push(ref(db, `devices/${deviceId}/logs`));
  await set(logRef, { ts, type, payload });
}

export async function getLastLogs(deviceId, n = 200) {
  const q = query(ref(db, `devices/${deviceId}/logs`), limitToLast(n));
  const snap = await get(q);
  const val = snap.val() || {};
  return Object.entries(val).map(([id, data]) => ({ id, ...data }));
}

export async function getLogsByTime(deviceId, fromMs, toMs) {
  const q = query(
    ref(db, `devices/${deviceId}/logs`),
    orderByChild("ts"),
    startAt(fromMs),
    endAt(toMs)
  );
  const snap = await get(q);
  const val = snap.val() || {};
  return Object.entries(val).map(([id, data]) => ({ id, ...data }));
}