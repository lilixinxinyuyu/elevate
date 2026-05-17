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

import { useEffect, useMemo, useState } from "react";
import { getStoredPassword } from "../db/cloudSync";
import { setDisplayName as cacheDisplayName, setStoredBirthday, setStoredGrade, useDisplayName } from "../lib/displayName";

/**
 * v0.34.68 iter 2 — onboarding 7 必填字段拆 3 个阶段:
 *   step 1: 同学基础 (displayName, birthday)
 *   step 2: 学校信息 (school, city, grade, class)
 *   step 3: 监护人 (guardianRole, guardianPhone)
 *
 * 每个 step 自带 chip 显示 N/M 进度, 顶部总进度条显示已填 / 7。
 * 7 项全填齐时弹"档案完成 🎉"动画 + 1.5s 后自动关闭 + 暴露 onboarding_completed 事件
 * 给后续 trophy 系统接入。
 */
const STEP_GROUPS: { id: string; label: string; emoji: string; fields: (keyof Profile)[] }[] = [
  { id: "basics", label: "同学基础", emoji: "🧒", fields: ["displayName", "birthday"] },
  { id: "school", label: "学校信息", emoji: "🏫", fields: ["school", "city", "grade", "class"] },
  { id: "guardian", label: "监护人", emoji: "👨‍👩‍👧", fields: ["guardianRole", "guardianPhone"] },
];
// 必填集 (跟 server REQUIRED_FIELDS 一致, profile.ts:50)
const REQUIRED_KEYS: (keyof Profile)[] = [
  "displayName", "school", "grade", "class", "birthday", "guardianRole", "guardianPhone",
];

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
  const [savedFlash, setSavedFlash] = useState<string | null>(null); // 保存成功 toast
  const [celebrate, setCelebrate] = useState(false); // 完成 🎉 overlay
  const displayName = useDisplayName();

  // 实时算"已填多少必填项" — form state 为准, 即使没 submit 也能反映进度
  const filledKeys = useMemo(() => {
    return REQUIRED_KEYS.filter((k) => {
      const v = form[k];
      return typeof v === "string" && v.trim().length > 0;
    });
  }, [form]);
  const filledCount = filledKeys.length;
  const totalCount = REQUIRED_KEYS.length;
  const filledPct = Math.round((filledCount / totalCount) * 100);

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
    // 立即把新 displayName 写进 cache, 全 app 同步 "Selena's Elevate" → 用户名
    if (patch.displayName) cacheDisplayName(patch.displayName);
    if (patch.birthday) setStoredBirthday(patch.birthday);
    if (patch.grade) setStoredGrade(patch.grade);
    setMissing(r.missing ?? []);
    // toast 保存了多少字段
    const savedCount = Object.keys(patch).length;
    setSavedFlash(`已保存 ${savedCount} 项 ✓`);
    window.setTimeout(() => setSavedFlash(null), 2200);
    if (!r.needsOnboarding) {
      // 全齐 → 弹庆祝 → 1.6s 后关闭, 派发 onboarding_completed 事件给后续 trophy 接入
      setCelebrate(true);
      window.setTimeout(() => {
        setOpen(false);
        setCelebrate(false);
        try {
          window.dispatchEvent(new CustomEvent("xiaojinapp:onboarding-completed", {
            detail: { userId: form.userId, displayName: form.displayName },
          }));
        } catch { /* */ }
      }, 1600);
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
      <div className="card-glow max-w-md w-full bg-slate-900/95 border-violet-400/40 p-5 my-8 relative">
        {/* 完成庆祝 overlay — 全 7 项填齐后短暂显示再自动关闭 */}
        {celebrate && (
          <div
            className="absolute inset-0 z-10 rounded-2xl bg-gradient-to-br from-emerald-500/30 via-violet-500/30 to-amber-500/30 backdrop-blur-sm flex flex-col items-center justify-center animate-slide-up"
            role="status"
            aria-live="polite"
          >
            <div className="text-6xl mb-2 animate-bounce">🎉</div>
            <div className="font-display font-bold text-2xl text-amber-100 mb-1">
              档案完成！
            </div>
            <div className="text-sm text-amber-200/90">
              欢迎你，{form.displayName || displayName}！
            </div>
          </div>
        )}

        <div className="font-display font-bold text-violet-200 text-lg mb-1">
          🎓 完善 {displayName !== "同学" ? displayName : ""} 同学档案
        </div>
        <div className="text-xs text-slate-300 mb-3">
          标 * 是必填。这些信息只会保存在 OSS 你自己的账号下，用来生成
          专属勋章、给监护人发学习汇报等。
        </div>

        {/* 进度条 — 顶部, 始终可见 (跟形如 "已填 3 / 7") */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <div className="text-slate-300">
              进度：<span className="font-bold text-emerald-300">{filledCount}</span> / {totalCount} 项必填
            </div>
            <div className="text-slate-400">{filledPct}%</div>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 via-violet-400 to-amber-400 transition-all duration-500"
              style={{ width: `${filledPct}%` }}
            />
          </div>
          {/* 3 个 step chip — 每个显示该 step 完成进度 */}
          <div className="flex gap-1.5 mt-2">
            {STEP_GROUPS.map((step) => {
              const stepFields = step.fields.filter((f) => REQUIRED_KEYS.includes(f));
              const stepFilled = stepFields.filter((k) => {
                const v = form[k];
                return typeof v === "string" && v.trim().length > 0;
              }).length;
              const done = stepFilled === stepFields.length;
              return (
                <div
                  key={step.id}
                  className={`flex-1 text-[10px] px-2 py-1 rounded text-center border transition-colors ${
                    done
                      ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-200"
                      : stepFilled > 0
                        ? "bg-violet-500/15 border-violet-400/40 text-violet-200"
                        : "bg-slate-800/60 border-slate-700 text-slate-400"
                  }`}
                  title={`${step.label}: ${stepFilled}/${stepFields.length}`}
                >
                  {step.emoji} {step.label} {done ? "✓" : `${stepFilled}/${stepFields.length}`}
                </div>
              );
            })}
          </div>
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
          {savedFlash && !err && (
            <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 rounded px-2 py-1.5 animate-slide-up">
              {savedFlash}
            </div>
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
              className="text-sm px-4 py-2 rounded bg-violet-500 hover:bg-violet-400 text-white font-bold disabled:opacity-40 inline-flex items-center gap-2"
            >
              {busy ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>保存中…</span>
                </>
              ) : (
                <span>{filledCount === totalCount ? "完成档案 →" : "保存这些信息"}</span>
              )}
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
