import { useEffect, useState } from "react";
import { checkPassword, checkPasswordAndUserId, clearPassword, getStoredPassword, pullFromCloud, storePassword } from "../db/cloudSync";
// v0.35.44 Refactor Priority 11: localStorage 跨文件 key SSOT
import { STORAGE_KEYS } from "../config/storage";
import {
  setUserId as cacheUserId,
  setDisplayName as cacheDisplayName,
  setStoredBirthday,
  setStoredGrade,
  setStoredSchool,
  getRegisteredAt,
} from "../lib/displayName";

/**
 * 登录成功后拉一次 /api/profile, 把 displayName + birthday 写进 cache + 同步
 * db.students[0].name (修 "你好 Selena" 在 bruce 页面也显示).
 *
 * v0.34.70 iter 4: 也 stamp registeredAt (新用户保护期门槛), 写本地一次性.
 * v0.34.82 iter 16: 加 db.students.name 同步 — seed.ts 永远 hardcode "Selena",
 * 不刷新的话 bruce 看到自己页面"你好 Selena" 很尴尬.
 */
async function syncDbStudentName(displayName: string): Promise<void> {
  try {
    const { db } = await import("../db/dexie");
    const students = await db.students.toArray();
    if (students.length === 0) return;
    const s = students[0]!;
    if (s.name === displayName) return; // 没变
    await db.students.put({ ...s, name: displayName, updatedAt: Date.now() });
    console.log(`[AuthGate] db.students.name "${s.name}" → "${displayName}"`);
  } catch (e) {
    console.warn("[AuthGate] syncDbStudentName failed:", (e as Error).message);
  }
}

async function bootstrapDisplayNameFromProfile(pwd: string): Promise<void> {
  // 第一次访问 → stamp registeredAt (用于 trophy 新用户保护期)
  getRegisteredAt();
  try {
    const r = await fetch("/api/profile", {
      headers: { Authorization: `Bearer ${pwd}` },
    });
    if (!r.ok) return;
    const j = (await r.json()) as {
      ok?: boolean;
      profile?: {
        displayName?: string | null;
        birthday?: string | null;
        grade?: string | null;
        school?: string | null;
        forceTrophyResyncRequestedAt?: number | null;
      } | null;
    };
    if (j?.ok && j.profile?.displayName) {
      cacheDisplayName(j.profile.displayName);
      void syncDbStudentName(j.profile.displayName); // 修 "你好 Selena" 显示问题
    }
    if (j?.ok && j.profile?.birthday) {
      setStoredBirthday(j.profile.birthday);
    }
    if (j?.ok && j.profile?.grade) {
      setStoredGrade(j.profile.grade);
    }
    if (j?.ok && j.profile?.school) {
      setStoredSchool(j.profile.school);
    }
    // v0.34.92 iter 26: admin 远程触发 trophy-images 重拉 (修学生 broken IDB
    // cache 无需学生操作). 比 lastSeen 新就 forceTrophyResync(), 后台 silent.
    if (j?.ok && typeof j.profile?.forceTrophyResyncRequestedAt === "number") {
      const remoteTs = j.profile.forceTrophyResyncRequestedAt;
      const localSeen = Number(localStorage.getItem(STORAGE_KEYS.lastForceTrophyResyncSeen) ?? "0");
      if (remoteTs > localSeen) {
        console.log(`[AuthGate] admin requested force trophy resync (remote=${remoteTs} > local=${localSeen}), triggering...`);
        void import("../db/cloudSync").then(async ({ forceTrophyResync }) => {
          const r = await forceTrophyResync();
          if (r.ok) {
            localStorage.setItem(STORAGE_KEYS.lastForceTrophyResyncSeen, String(remoteTs));
            console.log(`[AuthGate] force trophy resync done: pulled ${r.pulled}`);
          }
        }).catch(() => { /* */ });
      }
    }
  } catch { /* 静默 */ }
}

/**
 * Ep 爸爸-2026-05-17: 检测当前子域名跟认证 userId 是否匹配.
 * 比如 Selena 的密码走到 alice.xiaojin.app → 用户不是 alice, 不该看 alice 的系统.
 * Return null = OK (匹配 / apex / reserved / dev); 返字符串 = 警告内容
 */
function detectSubdomainMismatch(authUserId: string): { sub: string; intendedFor: string } | null {
  const host = (typeof location !== "undefined" ? location.host : "").toLowerCase().split(":")[0]!;
  if (host === "localhost" || host === "127.0.0.1") return null;
  if (host === "xiaojin.app") return null; // apex
  const m = host.match(/^([a-z0-9_-]+)\.xiaojin\.app$/);
  if (!m) return null;
  const sub = m[1]!;
  // 保留子域 (admin/www) 不算 mismatch
  if (sub === "admin" || sub === "www") return null;
  if (sub === authUserId) return null; // 匹配
  return { sub, intendedFor: sub };
}

/**
 * 密码门：第一次打开 / 没存密码 / 服务端 401 时显示输入框。
 * 通过后存 localStorage，自动从云端拉一次最新进度（如果是新设备）。
 *
 * 如果环境没设密码（开发期 / Cloudflare 没配 APP_PASSWORD）→ check 接口直接 ok，相当于直通。
 * 如果云端 API 不存在（本地 dev 没起 functions）→ 也直通，避免本地开发被卡住。
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  // v0.31.86: state union 里的 "error" 永远不会被设置（cleanup 残留）
  const [state, setState] = useState<"checking" | "needpwd" | "ok">("checking");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  // Ep 爸爸-2026-05-17: 跨子域名访问检测
  const [subMismatch, setSubMismatch] = useState<{ sub: string; authedAs: string } | null>(null);

  // v0.31.3：toast 化 hint —— 4 秒后自动消失，不再常驻右上角占视觉位置
  useEffect(() => {
    if (!hint) return;
    const t = window.setTimeout(() => setHint(null), 4000);
    return () => window.clearTimeout(t);
  }, [hint]);

  useEffect(() => {
    (async () => {
      const stored = getStoredPassword();
      if (!stored) {
        // 看看 server 是否需要密码
        try {
          const r = await fetch("/api/auth/check", { method: "POST" });
          if (r.status === 404) {
            // 后端不存在（本地 dev、或没部署 functions）→ 直通
            setState("ok");
            return;
          }
          if (r.ok) {
            // 后端没设密码也允许通过
            setState("ok");
            return;
          }
        } catch {
          // 网络挂了，就直通本地
          setState("ok");
          return;
        }
        setState("needpwd");
        return;
      }
      // 有存的密码 → 验证
      const result = await checkPasswordAndUserId(stored);
      if (result.ok) {
        setState("ok");
        // 双保险: server 已 enforce wrong-sub denial, 这里再 client 检测一遍
        if (result.userId) {
          cacheUserId(result.userId); // displayName 兜底 (alice → Alice)
          void bootstrapDisplayNameFromProfile(stored); // 拉真实 displayName
          const mm = detectSubdomainMismatch(result.userId);
          if (mm) setSubMismatch({ sub: mm.sub, authedAs: result.userId });
        }
        // 后台尝试拉一次最新（不阻塞 UI）
        pullFromCloud().then((r) => {
          if (r.changed) setHint("已从云端同步最新进度。");
        });
      } else if (result.wrongSubdomain) {
        // server 告诉我们密码对但子域错 - 不该提示"密码不对"
        setState("needpwd");
        setSubMismatch({ sub: result.wrongSubdomain.currentSubdomain, authedAs: result.wrongSubdomain.intendedFor });
      } else {
        clearPassword();
        setState("needpwd");
        setErrMsg("密码失效，请重新输入");
      }
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrMsg(null);
    const result = await checkPasswordAndUserId(pwd);
    if (result.ok) {
      storePassword(pwd);
      setState("ok");
      if (result.userId) {
        cacheUserId(result.userId);
        void bootstrapDisplayNameFromProfile(pwd);
        const mm = detectSubdomainMismatch(result.userId);
        if (mm) setSubMismatch({ sub: mm.sub, authedAs: result.userId });
      }
      // 新设备：拉云端进度
      pullFromCloud({ force: true }).then((r) => {
        if (r.changed) setHint("已从云端同步进度，可以接着上次的继续练。");
      });
    } else if (result.wrongSubdomain) {
      // 密码对但子域错 — 显示 mismatch modal 而非 "密码不对"
      setSubMismatch({ sub: result.wrongSubdomain.currentSubdomain, authedAs: result.wrongSubdomain.intendedFor });
    } else {
      setErrMsg("密码不对，再试一次");
    }
    setBusy(false);
  };

  // Ep 爸爸-2026-05-17: cross-subdomain mismatch 优先于 needpwd / checking 渲染
  if (subMismatch) {
    const correctUrl = `https://${subMismatch.authedAs}.xiaojin.app/`;
    return (
      <div className="min-h-screen app-bg flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-slate-900/95 border border-amber-400/40 rounded-2xl p-6 text-center">
          <div className="text-5xl mb-3">🚧</div>
          <div className="font-display font-bold text-xl text-amber-200 mb-2">
            这不是你的子域名
          </div>
          <div className="text-sm text-slate-300 leading-relaxed mb-4">
            你登录的账号是 <span className="font-mono text-emerald-300">{subMismatch.authedAs}</span>，
            但当前打开的是 <span className="font-mono text-rose-300">{subMismatch.sub}.xiaojin.app</span>。
            <br/>每个同学只能在自己的子域名上练习。
          </div>
          <div className="flex flex-col gap-2">
            <a
              href={correctUrl}
              className="block w-full py-2.5 rounded-xl bg-violet-500 hover:bg-violet-400 text-white font-bold text-sm transition-colors"
            >
              → 去 {subMismatch.authedAs}.xiaojin.app
            </a>
            <button
              type="button"
              onClick={() => {
                clearPassword();
                setSubMismatch(null);
                setState("needpwd");
                setErrMsg(null);
              }}
              className="text-xs text-slate-400 hover:text-slate-200 py-1.5"
            >
              换个密码登录这个子域
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === "checking") {
    return (
      <div className="min-h-screen app-bg flex items-center justify-center">
        <div className="text-slate-400 text-sm">检查中…</div>
      </div>
    );
  }

  if (state === "needpwd") {
    return (
      <div className="min-h-screen app-bg flex items-center justify-center px-4">
        <form
          onSubmit={submit}
          className="card-glow max-w-sm w-full text-center"
        >
          <div className="text-5xl mb-2">🔒</div>
          {/* 登录页用通用品牌名 — 登录前不知道用户是谁 */}
          <div className="font-display font-bold text-2xl text-brand mb-1">小进 Elevate</div>
          <div className="text-sm text-slate-400 mb-4">输入密码继续</div>
          <input
            type="password"
            autoFocus
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            className="field text-center text-lg tracking-widest"
            placeholder="••••••"
          />
          {errMsg && (
            <div className="mt-2 text-sm text-rose-300">{errMsg}</div>
          )}
          <button type="submit" disabled={busy || !pwd} className="btn-primary w-full mt-4">
            {busy ? "验证中…" : "进入"}
          </button>
          <div className="text-xs text-slate-500 mt-3">
            爸爸/妈妈知道密码。
          </div>
        </form>
      </div>
    );
  }

  return (
    <>
      {hint && (
        <div className="fixed top-4 right-4 z-50 chip bg-emerald-500/20 text-emerald-100 border border-emerald-400/40 px-3 py-1.5 shadow-glow-emerald animate-slide-up">
          {hint}
        </div>
      )}
      {children}
    </>
  );
}
