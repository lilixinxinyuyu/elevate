/**
 * Display name + userId cache (v0.34.67 onboarding-fix iter 1)
 *
 * 背景: 历史上整个 app hardcoded "Selena" / "Selena's Elevate"。新同学加入后看到一堆
 * 别人的名字，体验"被借住"。本模块把 displayName 抽出来：
 *   1. AuthGate 登录成功后 setUserId() 把 userId 落 localStorage
 *   2. AuthGate 后台拉 /api/profile 拿到 displayName → setDisplayName()
 *   3. ProfileGate 用户改 displayName → setDisplayName() 立即生效
 *   4. UI 各处用 useDisplayName() / getDisplayName() 读，subscribe storage event
 *      跨 tab + 同 tab 都立即反应
 *
 * 兜底: displayName 没设 → userId 首字母大写 ("alice" → "Alice"). userId 也没设
 * (理论上 AuthGate 没跑过) → "同学".
 *
 * 这层 cache 跟 ProfileGate 内部 state 独立, ProfileGate 用 fetch 写, 这里读 LS.
 * 不引入 Context 是为了避免 invasive 改动 (10+ 文件都要 wrap provider).
 */

import { useEffect, useState } from "react";

const KEY_DISPLAY = "xiaojinapp.displayName";
const KEY_USER_ID = "xiaojinapp.userId";
const KEY_BIRTHDAY = "xiaojinapp.birthday"; // ISO YYYY-MM-DD; 给 birthday trophy check 用
const KEY_REGISTERED_AT = "xiaojinapp.registeredAt"; // epoch ms; 防新用户被一堆历史勋章弹
const KEY_GRADE = "xiaojinapp.grade"; // "1".."6"; iter 6 内容年级 mismatch 提示用
const KEY_SCHOOL = "xiaojinapp.school"; // 学校名; v0.34.81 iter 15 — DailySummaryCard footer 替代 hardcoded "和平街"
const EVENT_NAME = "xiaojinapp:displayname-change";

function lsGet(k: string): string | null {
  try {
    const v = localStorage.getItem(k);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}
function lsSet(k: string, v: string | null) {
  try {
    if (v == null || !v.trim()) localStorage.removeItem(k);
    else localStorage.setItem(k, v.trim());
  } catch { /* */ }
  // 同 tab 通知 (storage 事件只跨 tab 触发)
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch { /* */ }
}

/** Capitalize first letter of an ASCII userId; 中文 userId 原样返. */
function capitalizeUserId(uid: string): string {
  const t = uid.trim();
  if (!t) return "";
  // ASCII 才大写, 中文 / 拼音原样
  if (/^[a-zA-Z]/.test(t)) return t[0]!.toUpperCase() + t.slice(1);
  return t;
}

export function getUserId(): string | null {
  return lsGet(KEY_USER_ID);
}

export function setUserId(uid: string | null): void {
  lsSet(KEY_USER_ID, uid);
}

export function getStoredDisplayName(): string | null {
  return lsGet(KEY_DISPLAY);
}

export function setDisplayName(name: string | null): void {
  lsSet(KEY_DISPLAY, name);
}

/**
 * 同学生日 (ISO YYYY-MM-DD). 来自 /api/profile birthday 字段, AuthGate
 * bootstrap 时落本地; ProfileGate 改后立即同步. 给 birthday_2026 trophy
 * check 用 (替代 hardcoded "2026-03-13" Selena 生日).
 */
export function getStoredBirthday(): string | null {
  return lsGet(KEY_BIRTHDAY);
}
export function setStoredBirthday(d: string | null): void {
  lsSet(KEY_BIRTHDAY, d);
}

/**
 * 同学第一次登录这个设备的时间 (epoch ms). 给"新用户保护期"用 —
 * 注册 < 7 天不跑某些 commemorative trophy check 避免一堆历史勋章一起弹.
 * 第一次 getRegisteredAt 没值 → 自动 stamp 当前时间.
 */
export function getRegisteredAt(): number {
  const v = lsGet(KEY_REGISTERED_AT);
  const n = v ? Number(v) : NaN;
  if (Number.isFinite(n) && n > 0) return n;
  const now = Date.now();
  lsSet(KEY_REGISTERED_AT, String(now));
  return now;
}
/** 距注册天数 (整数). 新设备/新用户 0 天. */
export function daysSinceRegistered(): number {
  const reg = getRegisteredAt();
  return Math.floor((Date.now() - reg) / 86_400_000);
}

/**
 * 学生年级 ("1"..."6"). 来自 /api/profile.grade. iter 6 内容覆盖年级 mismatch
 * 提示用 (当前题库 grade: literal 4, 非 4 年级 user 应看到"课本上传中"banner).
 */
export function getStoredGrade(): string | null {
  return lsGet(KEY_GRADE);
}
export function setStoredGrade(g: string | null): void {
  lsSet(KEY_GRADE, g);
}

/** v0.34.81 iter 15: 学校名 cache (用于 DailySummaryCard footer 等). */
export function getStoredSchool(): string | null {
  return lsGet(KEY_SCHOOL);
}
export function setStoredSchool(s: string | null): void {
  lsSet(KEY_SCHOOL, s);
}
export function useStoredSchool(): string | null {
  const [v, setV] = useState(() => getStoredSchool());
  useEffect(() => {
    const refresh = () => setV(getStoredSchool());
    const onStorage = (e: StorageEvent) => { if (e.key === KEY_SCHOOL) refresh(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT_NAME, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT_NAME, refresh);
    };
  }, []);
  return v;
}
export function useStoredGrade(): string | null {
  const [g, setG] = useState(() => getStoredGrade());
  useEffect(() => {
    const refresh = () => setG(getStoredGrade());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY_GRADE) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT_NAME, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT_NAME, refresh);
    };
  }, []);
  return g;
}

/**
 * 主入口: 返回最佳可用的"同学称呼"。永远返回非空字符串。
 *
 *   1. 用户在 ProfileGate 填的 displayName (可能是中文 "布鲁斯" 也可能英文 "Bruce")
 *   2. userId 首字母大写 (alice → Alice; bruce → Bruce; selena → Selena)
 *   3. "同学" 兜底
 *
 * 用于 UI 文字 (中英文混排都 OK)
 */
export function getDisplayName(): string {
  const dn = getStoredDisplayName();
  if (dn) return dn;
  const uid = getUserId();
  if (uid) return capitalizeUserId(uid);
  return "同学";
}

/**
 * v0.34.81 iter 15 (爸爸反馈修正): app title 英文化 "Bruce's Elevate" 而不是
 * "布鲁斯 的小进". 用 userId (永远 ASCII slug, addNewStudent 强制 [a-zA-Z0-9_-])
 * 首字母大写 — 自动等同于"拼音名" (bruce → Bruce, david → David).
 *
 * 不再用 displayName (中文) 拼 title, 那个留给 in-app 欢迎语 / 称呼用.
 */
export function getAppTitle(): string {
  const uid = getUserId();
  const name = uid ? capitalizeUserId(uid) : "Cadet";
  return `${name}'s Elevate`;
}

/** React hook — 自动 re-render 当 displayName 或 userId 变化 */
export function useDisplayName(): string {
  const [name, setName] = useState(() => getDisplayName());
  useEffect(() => {
    const refresh = () => setName(getDisplayName());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY_DISPLAY || e.key === KEY_USER_ID) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT_NAME, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT_NAME, refresh);
    };
  }, []);
  return name;
}

/**
 * useAppTitle — subscribe userId 变化 (登录后), 返 "Bruce's Elevate" 风格.
 * (爸爸反馈: 不是 "<displayName> 的小进" 全中文, 应该英文/拼音)
 */
export function useAppTitle(): string {
  const [t, setT] = useState(() => getAppTitle());
  useEffect(() => {
    const refresh = () => setT(getAppTitle());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY_USER_ID || e.key === KEY_DISPLAY) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT_NAME, refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT_NAME, refresh);
    };
  }, []);
  return t;
}
