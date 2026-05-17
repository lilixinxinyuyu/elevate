/**
 * ChangePasswordModal — v0.34.69 iter 3
 *
 * 同学/家长在 SubjectPicker 页通过 "🔑 改密码" 按钮触发。调
 * POST /api/auth/change-password, 成功后用 storePassword() 把新密码写回
 * localStorage 替换旧密码（旧的 server 端已经失效, 这里同步保持登录态）。
 *
 * 设计:
 * - 不要求输入旧密码 (已在 session 里, server-side resolveUserId 已校验)
 * - 至少 6 个字符 (genFriendlyPassword 8 位数字给最低安全保障; 自定义可 6-64)
 * - 二次确认 (避免手抖输错锁自己)
 * - 成功后 toast + 自动关
 */

import { useState } from "react";
import { storePassword } from "../db/cloudSync";
import { getStoredPassword } from "../db/cloudSync";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ERROR_LABELS: Record<string, string> = {
  password_length_6_to_64: "密码长度要 6-64 位",
  password_must_be_ascii_printable: "密码只能用英文字符 / 数字 / 符号 (不要中文/空格)",
  password_taken_by_other_user: "这个密码已经被其他同学用了，换一个",
  password_conflict_with_legacy_fallback: "这个密码跟系统默认密码冲突，换一个",
  missing_newPassword: "请输入新密码",
  unauthorized: "登录会话过期了，请重新登录",
};

export function ChangePasswordModal({ open, onClose }: Props) {
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const pwd = newPwd.trim();
    if (pwd.length < 6) return setErr("密码至少 6 位");
    if (pwd !== confirm.trim()) return setErr("两次输入不一致");
    const current = getStoredPassword();
    if (!current) return setErr("还没登录，无法改密码");
    setBusy(true);
    try {
      const r = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${current}` },
        body: JSON.stringify({ newPassword: pwd }),
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; rotated?: number };
      if (!r.ok || !j.ok) {
        const code = j.error ?? "unknown";
        setErr(ERROR_LABELS[code] ?? `修改失败：${code}`);
        return;
      }
      // 成功 → 替换 localStorage 里的密码, 不需要重 login
      storePassword(pwd);
      setOk(true);
      window.setTimeout(() => {
        setOk(false);
        setNewPwd("");
        setConfirm("");
        onClose();
      }, 1500);
    } catch (e) {
      setErr(`网络出错: ${(e as Error).message.slice(0, 60)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[1000] bg-black/70 flex items-center justify-center p-4"
      style={{ backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="card-glow max-w-sm w-full bg-slate-900/95 border-violet-400/40 p-5 relative">
        {ok && (
          <div className="absolute inset-0 z-10 rounded-2xl bg-emerald-500/25 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="text-5xl mb-2">✓</div>
            <div className="font-display font-bold text-xl text-emerald-100">密码已更新</div>
            <div className="text-xs text-emerald-200 mt-1">用新密码继续登录</div>
          </div>
        )}
        <div className="flex items-center justify-between mb-3">
          <div className="font-display font-bold text-violet-200 text-lg">🔑 修改密码</div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-slate-400 hover:text-slate-200 text-xs"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
        <div className="text-xs text-slate-300 mb-3">
          老师 / 家长发的初始密码不好记？换一个自己想要的（6-64 位英数字符）。
          改完立即生效，所有设备旧密码失效。
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">新密码</label>
            <input
              type="text"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="至少 6 位，比如 xiaoke2026"
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm font-mono"
              minLength={6}
              maxLength={64}
              autoFocus
              disabled={busy}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">再输一次确认</label>
            <input
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="跟上面一样"
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm font-mono"
              minLength={6}
              maxLength={64}
              disabled={busy}
              autoComplete="new-password"
            />
          </div>
          {err && (
            <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded px-2 py-1.5">
              {err}
            </div>
          )}
          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="text-xs px-3 py-2 rounded bg-slate-700/60 hover:bg-slate-600/60 text-slate-300 disabled:opacity-40"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={busy || newPwd.length < 6 || confirm.length < 6}
              className="text-sm px-4 py-2 rounded bg-violet-500 hover:bg-violet-400 text-white font-bold disabled:opacity-40 inline-flex items-center gap-2"
            >
              {busy ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>保存中…</span>
                </>
              ) : (
                <span>修改密码</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
