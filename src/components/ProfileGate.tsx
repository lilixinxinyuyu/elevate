/**
 * ProfileGate —— 检测 /api/profile needsOnboarding=true 时弹补全卡
 *
 * v0.34.14 (Ep144) 爸爸 2026-05-17 加单：新同学加入后首登必须填
 * 学校 / 城市 / 年级 / 班级 / 生日 / 监护人角色 / 监护人手机号
 *
 * 行为：
 * - 启动后 200ms 拉一次 /api/profile（不阻塞 app 渲染）
 * - 如果 needsOnboarding=true 且未关闭过 → 弹 modal
 * - 用户可以填部分字段 → 提交 → 仍缺继续提示，或"稍后"按钮跳过
 * - 关闭后写 localStorage `xiaojinapp.onboarding.skipped` = ts，24h 内不再弹
 *
 * 关键设计：
 * - 不阻塞应用渲染（app 已能用，只是提示补全）
 * - "稍后" 24h 静默期；之后再弹
 * - 全字段补齐自动关闭
 */

import { useEffect, useState } from "react";
import { getStoredPassword } from "../db/cloudSync";

interface Profile {
  schemaVersion?: number;
  userId?: string;
  displayName?: string | null;
  gradeBand?: string | null;
  school?: string | null;
  city?: string | null;
  grade?: string | null;
  class?: string | null;
  birthday?: string | null;
  guardianRole?: string | null;
  guardianPhone?: string | null;
}

interface ProfileResp {
  ok: boolean;
  userId?: string;
  profile?: Profile | null;
  missing?: string[];
  needsOnboarding?: boolean;
}

const GUARDIAN_ROLES = [
  "妈妈", "爸爸", "外婆", "外公", "奶奶", "爷爷",
  "姑姑", "姨妈", "舅舅", "舅妈", "叔叔", "其他",
];

const SKIP_KEY = "xiaojinapp.onboarding.skipped";
const SKIP_TTL_MS = 24 * 3600 * 1000;

function skipRecent(): boolean {
  const v = localStorage.getItem(SKIP_KEY);
  if (!v) return false;
  const ts = Number(v);
  if (!ts) return false;
  return Date.now() - ts < SKIP_TTL_MS;
}

async function fetchProfile(): Promise<ProfileResp | null> {
  const pwd = getStoredPassword();
  if (!pwd) return null;
  try {
    const r = await fetch("/api/profile", {
      headers: { Authorization: `Bearer ${pwd}` },
    });
    if (!r.ok) return null;
    return (await r.json()) as ProfileResp;
  } catch {
    return null;
  }
}

async function patchProfile(patch: Partial<Profile>): Promise<ProfileResp | null> {
  const pwd = getStoredPassword();
  if (!pwd) return null;
  try {
    const r = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${pwd}` },
      body: JSON.stringify(patch),
    });
    if (!r.ok) return null;
    return (await r.json()) as ProfileResp;
  } catch {
    return null;
  }
}

export function ProfileGate() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<Profile>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [customRole, setCustomRole] = useState("");

  useEffect(() => {
    const t = setTimeout(async () => {
      if (skipRecent()) return;
      const r = await fetchProfile();
      if (!r?.ok || !r.needsOnboarding) return;
      setMissing(r.missing ?? []);
      setForm({
        userId: r.userId,
        displayName: r.profile?.displayName ?? r.userId ?? "",
        school: r.profile?.school ?? "",
        city: r.profile?.city ?? "",
        grade: r.profile?.grade ?? "",
        class: r.profile?.class ?? "",
        birthday: r.profile?.birthday ?? "",
        guardianRole: r.profile?.guardianRole ?? "",
        guardianPhone: r.profile?.guardianPhone ?? "",
      });
      setOpen(true);
    }, 800);
    return () => clearTimeout(t);
  }, []);

  if (!open) return null;

  const update = (k: keyof Profile, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    // 监护人角色合并 custom
    const role = form.guardianRole === "其他" ? customRole.trim() : (form.guardianRole ?? "");
    const patch: Partial<Profile> = {
      displayName: (form.displayName ?? "").trim() || undefined,
      school: (form.school ?? "").trim() || undefined,
      city: (form.city ?? "").trim() || undefined,
      grade: (form.grade ?? "").trim() || undefined,
      class: (form.class ?? "").trim() || undefined,
      birthday: (form.birthday ?? "").trim() || undefined,
      guardianRole: role || undefined,
      guardianPhone: (form.guardianPhone ?? "").trim() || undefined,
    };
    // 删空字段
    for (const k of Object.keys(patch) as (keyof Profile)[]) {
      if (!patch[k]) delete patch[k];
    }
    if (Object.keys(patch).length === 0) {
      setErr("至少填一项再提交");
      setBusy(false);
      return;
    }
    const r = await patchProfile(patch);
    if (!r?.ok) {
      setErr("保存失败，稍后重试");
      setBusy(false);
      return;
    }
    setMissing(r.missing ?? []);
    if (!r.needsOnboarding) {
      // 全齐 → 关
      setOpen(false);
    }
    setBusy(false);
  };

  const onSkip = () => {
    localStorage.setItem(SKIP_KEY, String(Date.now()));
    setOpen(false);
  };

  const isMissing = (k: string) => missing.includes(k);
  const labelOf = (k: string, label: string) =>
    `${label}${isMissing(k) ? " *" : ""}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[1000] bg-black/70 flex items-center justify-center p-4 overflow-y-auto"
      style={{ backdropFilter: "blur(4px)" }}
    >
      <div className="card-glow max-w-md w-full bg-slate-900/95 border-violet-400/40 p-5 my-8">
        <div className="font-display font-bold text-violet-200 text-lg mb-1">
          🎓 完善同学档案
        </div>
        <div className="text-xs text-slate-300 mb-4">
          标 * 是必填。这些信息只会保存在 OSS 你自己的账号下，用来生成
          专属勋章、给监护人发学习汇报等。
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              {labelOf("displayName", "同学称呼")}
            </label>
            <input
              type="text"
              value={form.displayName ?? ""}
              onChange={(e) => update("displayName", e.target.value)}
              placeholder="比如 Selena / 小芳"
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm"
              maxLength={20}
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              {labelOf("school", "学校")}
            </label>
            <input
              type="text"
              value={form.school ?? ""}
              onChange={(e) => update("school", e.target.value)}
              placeholder="比如 成都锦江和平街小学"
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm"
              maxLength={50}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">城市</label>
              <input
                type="text"
                value={form.city ?? ""}
                onChange={(e) => update("city", e.target.value)}
                placeholder="成都"
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm"
                maxLength={20}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                {labelOf("birthday", "生日")}
              </label>
              <input
                type="date"
                value={form.birthday ?? ""}
                onChange={(e) => update("birthday", e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                {labelOf("grade", "年级")}
              </label>
              <select
                value={form.grade ?? ""}
                onChange={(e) => update("grade", e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm"
              >
                <option value="">—</option>
                {["1","2","3","4","5","6"].map((g) => (
                  <option key={g} value={g}>{g} 年级</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                {labelOf("class", "班级")}
              </label>
              <input
                type="text"
                value={form.class ?? ""}
                onChange={(e) => update("class", e.target.value)}
                placeholder="3"
                inputMode="numeric"
                className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm"
                maxLength={6}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              {labelOf("guardianRole", "监护人")}
            </label>
            <select
              value={form.guardianRole ?? ""}
              onChange={(e) => update("guardianRole", e.target.value)}
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm"
            >
              <option value="">—</option>
              {GUARDIAN_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {form.guardianRole === "其他" && (
              <input
                type="text"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                placeholder="比如 哥哥 / 嫂子 / 监护人..."
                className="w-full mt-2 px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm"
                maxLength={10}
              />
            )}
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              {labelOf("guardianPhone", "监护人手机号")}
            </label>
            <input
              type="tel"
              value={form.guardianPhone ?? ""}
              onChange={(e) => update("guardianPhone", e.target.value)}
              placeholder="13800138000"
              inputMode="tel"
              className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm"
              maxLength={20}
            />
          </div>

          {err && (
            <div className="text-xs text-rose-300">{err}</div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onSkip}
              disabled={busy}
              className="text-xs px-3 py-2 rounded bg-slate-700/60 hover:bg-slate-600/60 text-slate-300 disabled:opacity-40"
            >
              稍后再填
            </button>
            <button
              type="submit"
              disabled={busy}
              className="text-sm px-4 py-2 rounded bg-violet-500 hover:bg-violet-400 text-white font-bold disabled:opacity-40"
            >
              {busy ? "保存中…" : "保存"}
            </button>
          </div>
        </form>

        {missing.length > 0 && (
          <div className="text-[10px] text-slate-500 mt-3">
            还缺 {missing.length} 项：{missing.join(" / ")}
          </div>
        )}
      </div>
    </div>
  );
}
