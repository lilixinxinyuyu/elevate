import { useEffect, useState } from "react";
import { checkPassword, clearPassword, getStoredPassword, pullFromCloud, storePassword } from "../db/cloudSync";

/**
 * 密码门：第一次打开 / 没存密码 / 服务端 401 时显示输入框。
 * 通过后存 localStorage，自动从云端拉一次最新进度（如果是新设备）。
 *
 * 如果环境没设密码（开发期 / Cloudflare 没配 APP_PASSWORD）→ check 接口直接 ok，相当于直通。
 * 如果云端 API 不存在（本地 dev 没起 functions）→ 也直通，避免本地开发被卡住。
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"checking" | "needpwd" | "ok" | "error">("checking");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

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
      const valid = await checkPassword(stored);
      if (valid) {
        setState("ok");
        // 后台尝试拉一次最新（不阻塞 UI）
        pullFromCloud().then((r) => {
          if (r.changed) setHint("已从云端同步最新进度。");
        });
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
    const ok = await checkPassword(pwd);
    if (ok) {
      storePassword(pwd);
      setState("ok");
      // 新设备：拉云端进度
      pullFromCloud({ force: true }).then((r) => {
        if (r.changed) setHint("已从云端同步进度，可以接着上次的继续练。");
      });
    } else {
      setErrMsg("密码不对，再试一次");
    }
    setBusy(false);
  };

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
          <div className="font-display font-bold text-2xl text-brand mb-1">Selena's Elevate</div>
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
