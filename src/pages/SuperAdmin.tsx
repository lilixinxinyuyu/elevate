/**
 * /super-admin — 项目超级管理员视角
 *
 * v0.34.15 (Ep145) 爸爸 2026-05-17 加单。
 * 看所有同学的账户 + profile + 最近活跃。
 *
 * 鉴权：前端拉 /api/super-admin/me 检 isSuperAdmin，否则跳 home。
 * 数据：/api/super-admin/users 返 {count, users:[{userId, profile, snapshot, ...}]}
 *
 * 后续 ep 加：编辑 profile / 重置密码 / 看 24h agent summary。
 */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getStoredPassword } from "../db/cloudSync";

interface UserProfile {
  schemaVersion?: number;
  userId?: string;
  displayName?: string | null;
  school?: string | null;
  city?: string | null;
  grade?: string | null;
  class?: string | null;
  birthday?: string | null;
  guardianRole?: string | null;
  guardianPhone?: string | null;
  createdAt?: number;
  updatedAt?: number;
}

interface UserRow {
  userId: string;
  isSuperAdmin: boolean;
  profile: UserProfile | null;
  snapshot: {
    present: boolean;
    lastModifiedMs: number | null;
    etag: string | null;
    bytes?: number | null;
  };
  statsKpi?: {
    todayAttempts?: number;
    last7Attempts?: number;
    correctRate?: number;
  } | null;
  latestSummary?: {
    generatedAt?: number;
    preview?: string;
  } | null;
}

interface UsersResp {
  ok: boolean;
  count?: number;
  superAdminCount?: number;
  asOf?: number;
  users?: UserRow[];
  error?: string;
}

interface MeResp {
  ok: boolean;
  userId?: string;
  isSuperAdmin?: boolean;
  superAdmins?: string[];
  error?: string;
}

function fmtRel(ms?: number | null): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "刚刚";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}分钟前`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}小时前`;
  return `${Math.floor(diff / 86400_000)}天前`;
}

function fmtDate(ms?: number | null): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("zh-CN", { hour12: false });
}

const GUARDIAN_ROLES = [
  "妈妈", "爸爸", "外婆", "外公", "奶奶", "爷爷",
  "姑姑", "姨妈", "舅舅", "舅妈", "叔叔", "其他",
];

const EDITABLE_FIELDS: Array<{ key: keyof UserProfile; label: string; type?: string; options?: string[] }> = [
  { key: "displayName", label: "称呼" },
  { key: "school", label: "学校" },
  { key: "city", label: "城市" },
  { key: "grade", label: "年级", options: ["", "1", "2", "3", "4", "5", "6"] },
  { key: "class", label: "班级" },
  { key: "birthday", label: "生日", type: "date" },
  { key: "guardianRole", label: "监护人", options: ["", ...GUARDIAN_ROLES] },
  { key: "guardianPhone", label: "手机号", type: "tel" },
];

export function SuperAdminPage() {
  const nav = useNavigate();
  const [me, setMe] = useState<MeResp | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UserProfile>({});
  const [editBusy, setEditBusy] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  // Ep11: 新密码 / 新建同学结果 modal
  const [credResult, setCredResult] = useState<{
    title: string;
    userId: string;
    password: string;
    loginUrl: string;
    fallbackUrl: string;
  } | null>(null);
  const [credCopied, setCredCopied] = useState(false);

  // Ep11: 新同学 modal
  const [newOpen, setNewOpen] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newBusy, setNewBusy] = useState(false);
  const [newErr, setNewErr] = useState<string | null>(null);

  // Ep16: 批量刷新摘要（client-side 一个一个调，避开 ESA 11s 单 routine 限制）
  const [bulkRefreshState, setBulkRefreshState] = useState<{
    running: boolean;
    done: number;
    total: number;
    currentUser: string | null;
    failed: string[];
  } | null>(null);

  // Ep14: 🤖 agent summary modal
  interface AgentSummary {
    targetUserId?: string;
    displayName?: string;
    guardianRole?: string;
    summary?: string;
    messageToStudent?: string;
    messageToGuardian?: string;
    generatedAt?: number;
    model?: string;
    generatedBy?: string;
    raw?: string;
    parseError?: boolean;
    hasLatest?: boolean;
    error?: string;
  }
  const [agentOf, setAgentOf] = useState<string | null>(null);
  const [agentData, setAgentData] = useState<AgentSummary | null>(null);
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentCopied, setAgentCopied] = useState<string | null>(null);

  // Ep13: 📊 stats modal
  interface StatsBlob {
    userId?: string;
    counts?: {
      attempts?: number;
      mistakes?: number;
      trophies?: number;
      sessions?: number;
      mastery?: number;
      fluencyAttempts?: number;
      tutorSessions?: number;
    };
    today?: { attempts?: number; sessions?: number };
    last7Days?: { attempts?: number };
    bySubject?: Record<string, number>;
    topMistakeSkills?: Array<{ skillId: string; count: number }>;
    correctRateRecent100?: number;
    lastActivityMs?: number | null;
    snapshotBytes?: number;
    fetchedAt?: number;
    empty?: boolean;
    note?: string;
  }
  const [statsOf, setStatsOf] = useState<string | null>(null);
  const [statsData, setStatsData] = useState<StatsBlob | null>(null);
  const [statsBusy, setStatsBusy] = useState(false);

  useEffect(() => {
    // Ep158: super-admin 只能从 admin.xiaojin.app 访问
    const host = window.location.host;
    if (
      host !== "admin.xiaojin.app" &&
      !host.startsWith("localhost") &&
      !host.startsWith("127.0.0.1")
    ) {
      setErr(
        `super-admin 只能从 https://admin.xiaojin.app 访问 (当前: ${host})`,
      );
      setLoading(false);
      // 不自动跳转，留时间看错误
      return;
    }
    (async () => {
      const pwd = getStoredPassword();
      if (!pwd) {
        setErr("未登录");
        setLoading(false);
        return;
      }
      try {
        const meR = await fetch("/api/super-admin/me", {
          headers: { Authorization: `Bearer ${pwd}` },
        });
        const meJ = (await meR.json()) as MeResp;
        setMe(meJ);
        if (!meJ.ok || !meJ.isSuperAdmin) {
          setErr("你不是超级管理员");
          setLoading(false);
          setTimeout(() => nav("/", { replace: true }), 2000);
          return;
        }
        const uR = await fetch("/api/super-admin/users", {
          headers: { Authorization: `Bearer ${pwd}` },
        });
        const uJ = (await uR.json()) as UsersResp;
        if (!uJ.ok) {
          setErr(uJ.error ?? "load_users_failed");
          setLoading(false);
          return;
        }
        setUsers(uJ.users ?? []);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [nav]);

  async function refreshUsers() {
    const pwd = getStoredPassword();
    if (!pwd) return;
    const uR = await fetch("/api/super-admin/users", {
      headers: { Authorization: `Bearer ${pwd}` },
    });
    const uJ = (await uR.json()) as UsersResp;
    if (uJ.ok) setUsers(uJ.users ?? []);
  }

  function openEdit(u: UserRow) {
    setEditing(u.userId);
    setEditForm({
      displayName: u.profile?.displayName ?? u.userId,
      school: u.profile?.school ?? "",
      city: u.profile?.city ?? "",
      grade: u.profile?.grade ?? "",
      class: u.profile?.class ?? "",
      birthday: u.profile?.birthday ?? "",
      guardianRole: u.profile?.guardianRole ?? "",
      guardianPhone: u.profile?.guardianPhone ?? "",
    });
    setEditErr(null);
  }

  async function bulkRefreshSummaries() {
    const pwd = getStoredPassword();
    if (!pwd) return;
    if (users.length === 0) return;
    const ok = window.confirm(
      `给 ${users.length} 个同学逐个刷新 AI 摘要？\n\n每个约 5-10s，串行执行（避开 ESA 11s 单次限制）。\n总耗时约 ${users.length * 8} 秒。`,
    );
    if (!ok) return;
    setBulkRefreshState({
      running: true,
      done: 0,
      total: users.length,
      currentUser: null,
      failed: [],
    });
    const failed: string[] = [];
    for (let i = 0; i < users.length; i++) {
      const uid = users[i]!.userId;
      setBulkRefreshState((s) => s && { ...s, currentUser: uid });
      try {
        const r = await fetch(`/api/super-admin/users/${encodeURIComponent(uid)}/agent-summary`, {
          method: "POST",
          headers: { Authorization: `Bearer ${pwd}` },
        });
        if (!r.ok) failed.push(uid);
      } catch {
        failed.push(uid);
      }
      setBulkRefreshState((s) => s && { ...s, done: i + 1, failed });
    }
    // Refresh list to pull new previews
    await refreshUsers();
    setBulkRefreshState((s) => s && { ...s, running: false, currentUser: null });
    setTimeout(() => setBulkRefreshState(null), 4000);
  }

  async function openAgent(userId: string) {
    setAgentOf(userId);
    setAgentData(null);
    setAgentBusy(true);
    setAgentCopied(null);
    const pwd = getStoredPassword();
    if (!pwd) {
      setAgentBusy(false);
      return;
    }
    try {
      // First fetch latest cached if any
      const cached = await fetch(`/api/super-admin/users/${encodeURIComponent(userId)}/agent-summary`, {
        headers: { Authorization: `Bearer ${pwd}` },
      });
      const cj = (await cached.json()) as AgentSummary;
      if (cj.hasLatest) setAgentData(cj);
    } catch {
      /* */
    } finally {
      setAgentBusy(false);
    }
  }

  async function regenAgent(userId: string) {
    setAgentBusy(true);
    setAgentCopied(null);
    const pwd = getStoredPassword();
    if (!pwd) return;
    try {
      const r = await fetch(`/api/super-admin/users/${encodeURIComponent(userId)}/agent-summary`, {
        method: "POST",
        headers: { Authorization: `Bearer ${pwd}` },
      });
      const j = (await r.json()) as AgentSummary & { ok?: boolean };
      setAgentData(j);
    } catch (e) {
      setAgentData({ error: (e as Error).message });
    } finally {
      setAgentBusy(false);
    }
  }

  async function openStats(userId: string) {
    setStatsOf(userId);
    setStatsData(null);
    setStatsBusy(true);
    const pwd = getStoredPassword();
    if (!pwd) {
      setStatsBusy(false);
      return;
    }
    try {
      const r = await fetch(`/api/super-admin/users/${encodeURIComponent(userId)}/stats`, {
        headers: { Authorization: `Bearer ${pwd}` },
      });
      const j = (await r.json()) as StatsBlob & { ok?: boolean };
      setStatsData(j);
    } catch (e) {
      setStatsData({ note: `加载失败: ${(e as Error).message}` });
    } finally {
      setStatsBusy(false);
    }
  }

  async function resetPassword(userId: string) {
    const ok = window.confirm(
      `确认重置 ${userId} 的密码？\n\n` +
        `所有该 userId 的旧密码会失效。新密码只在保存后这次显示一次。`,
    );
    if (!ok) return;
    const pwd = getStoredPassword();
    if (!pwd) return;
    try {
      const r = await fetch(`/api/super-admin/users/${encodeURIComponent(userId)}/password`, {
        method: "POST",
        headers: { Authorization: `Bearer ${pwd}` },
      });
      const j = (await r.json()) as {
        ok?: boolean;
        error?: string;
        newPassword?: string;
        loginUrl?: string;
        fallbackUrl?: string;
      };
      if (!j.ok || !j.newPassword) {
        alert(`重置失败：${j.error ?? "未知"}`);
        return;
      }
      setCredResult({
        title: `🔑 ${userId} 新密码`,
        userId,
        password: j.newPassword,
        loginUrl: j.loginUrl ?? `https://${userId}.xiaojin.app`,
        fallbackUrl: j.fallbackUrl ?? "https://xiaojin.app",
      });
      setCredCopied(false);
      await refreshUsers();
    } catch (e) {
      alert(`重置失败：${(e as Error).message}`);
    }
  }

  async function submitNewStudent() {
    if (!newUserId.trim()) {
      setNewErr("userId 不能空");
      return;
    }
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(newUserId.trim())) {
      setNewErr("userId 只能 a-z A-Z 0-9 _ - 长度 1-64");
      return;
    }
    const pwd = getStoredPassword();
    if (!pwd) return;
    setNewBusy(true);
    setNewErr(null);
    try {
      const r = await fetch("/api/super-admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${pwd}` },
        body: JSON.stringify({
          userId: newUserId.trim(),
          displayName: newDisplayName.trim() || undefined,
        }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        error?: string;
        userId?: string;
        newPassword?: string;
        loginUrl?: string;
        fallbackUrl?: string;
      };
      if (!j.ok || !j.newPassword || !j.userId) {
        setNewErr(j.error ?? "创建失败");
        setNewBusy(false);
        return;
      }
      setNewOpen(false);
      setNewUserId("");
      setNewDisplayName("");
      setCredResult({
        title: `🎉 新同学 ${j.userId} 已创建`,
        userId: j.userId,
        password: j.newPassword,
        loginUrl: j.loginUrl ?? `https://${j.userId}.xiaojin.app`,
        fallbackUrl: j.fallbackUrl ?? "https://xiaojin.app",
      });
      setCredCopied(false);
      await refreshUsers();
    } catch (e) {
      setNewErr((e as Error).message);
    } finally {
      setNewBusy(false);
    }
  }

  async function submitEdit() {
    if (!editing) return;
    const pwd = getStoredPassword();
    if (!pwd) return;
    setEditBusy(true);
    setEditErr(null);
    const patch: Record<string, unknown> = {};
    for (const { key } of EDITABLE_FIELDS) {
      const v = editForm[key];
      if (typeof v === "string") {
        const t = v.trim();
        patch[key as string] = t === "" ? null : t;
      }
    }
    try {
      const r = await fetch(`/api/super-admin/users/${encodeURIComponent(editing)}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${pwd}` },
        body: JSON.stringify(patch),
      });
      const j = (await r.json()) as { ok?: boolean; error?: string; updated?: number };
      if (!j.ok) {
        setEditErr(j.error ?? "save_failed");
        setEditBusy(false);
        return;
      }
      setEditing(null);
      await refreshUsers();
    } catch (e) {
      setEditErr((e as Error).message);
    } finally {
      setEditBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-slate-400 text-sm">⏳ 拉同学数据中…</div>
    );
  }

  if (err) {
    return (
      <div className="p-6 max-w-md">
        <div className="text-rose-300 font-bold mb-2">⚠️ {err}</div>
        <Link to="/" className="text-violet-300 underline text-sm">返回首页</Link>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <h1 className="font-display font-bold text-violet-200 text-xl">
          🛠 项目超级管理员
        </h1>
        <span className="text-xs text-slate-400">
          ({me?.userId} · 共 {users.length} 同学)
        </span>
        <button
          type="button"
          onClick={() => { setNewOpen(true); setNewErr(null); }}
          className="text-xs px-3 py-1.5 rounded bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-100 font-bold"
        >
          ➕ 加新同学
        </button>
        <button
          type="button"
          onClick={bulkRefreshSummaries}
          disabled={bulkRefreshState?.running}
          className="text-xs px-3 py-1.5 rounded bg-sky-500/30 hover:bg-sky-500/50 text-sky-100 font-bold disabled:opacity-40"
        >
          {bulkRefreshState?.running
            ? `🔄 ${bulkRefreshState.done}/${bulkRefreshState.total}${bulkRefreshState.currentUser ? " · " + bulkRefreshState.currentUser : ""}`
            : "🔄 刷新所有摘要"}
        </button>
        <Link to="/" className="ml-auto text-xs text-violet-300 underline">
          返回首页
        </Link>
      </div>

      <div className="text-xs text-slate-300 mb-4">
        所有同学的账户 + profile + 上次活跃。点 ✏️ 编辑 / 🔑 重置密码 /
        📊 学情 / 🤖 AI 摘要 操作。"🔄 刷新所有摘要" 给所有同学跑一遍最新 AI 摘要。
      </div>

      {/* 批量刷新结果 toast */}
      {bulkRefreshState && !bulkRefreshState.running && (
        <div
          className={`rounded p-3 mb-3 text-xs ${
            bulkRefreshState.failed.length === 0
              ? "bg-emerald-500/10 border border-emerald-400/40 text-emerald-200"
              : "bg-amber-500/10 border border-amber-400/40 text-amber-200"
          }`}
        >
          {bulkRefreshState.failed.length === 0
            ? `✅ ${bulkRefreshState.done} 个摘要全部刷新成功`
            : `⚠️ ${bulkRefreshState.done - bulkRefreshState.failed.length}/${bulkRefreshState.done} 成功；失败：${bulkRefreshState.failed.join(", ")}`}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-slate-400 border-b border-white/10">
              <th className="p-2">同学</th>
              <th className="p-2">学校 · 年级</th>
              <th className="p-2">监护人</th>
              <th className="p-2">上次活跃</th>
              <th className="p-2">详情</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const p = u.profile;
              return (
                <tr
                  key={u.userId}
                  className="border-b border-white/5 hover:bg-white/5"
                >
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {u.isSuperAdmin && (
                        <span title="super-admin" className="text-amber-300">🛠</span>
                      )}
                      <div>
                        <div className="font-bold text-slate-100">
                          {p?.displayName ?? u.userId}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {u.userId}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-2 text-slate-300">
                    {p?.school ? (
                      <>
                        <div>{p.school}</div>
                        <div className="text-[10px] text-slate-500">
                          {p.city ?? "—"} · {p.grade ? `${p.grade}年级` : ""}
                          {p.class ? `${p.class}班` : ""}
                        </div>
                      </>
                    ) : (
                      <span className="text-amber-400/70 text-xs">待补</span>
                    )}
                  </td>
                  <td className="p-2 text-slate-300">
                    {p?.guardianRole ? (
                      <>
                        <div>{p.guardianRole}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {p.guardianPhone ?? "—"}
                        </div>
                      </>
                    ) : (
                      <span className="text-amber-400/70 text-xs">待补</span>
                    )}
                  </td>
                  <td className="p-2">
                    {u.snapshot.present ? (
                      <>
                        <div className="text-slate-300">
                          {fmtRel(u.snapshot.lastModifiedMs)}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {fmtDate(u.snapshot.lastModifiedMs)}
                        </div>
                        {u.statsKpi && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            今 <span className="text-emerald-300">{u.statsKpi.todayAttempts ?? 0}</span> ·
                            7天 <span className="text-violet-300">{u.statsKpi.last7Attempts ?? 0}</span> ·
                            正确 <span className="text-amber-300">{u.statsKpi.correctRate ?? 0}%</span>
                          </div>
                        )}
                        {u.latestSummary?.preview && (
                          <div
                            className="text-[10px] text-sky-300/80 mt-1 max-w-[180px] truncate"
                            title={`AI 摘要 (${fmtRel(u.latestSummary.generatedAt ?? null)}): ${u.latestSummary.preview}...`}
                          >
                            🤖 {u.latestSummary.preview}…
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-500 text-xs">从未同步</span>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => openStats(u.userId)}
                        className="text-xs px-2 py-1 rounded bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-100"
                      >
                        📊 学情
                      </button>
                      <button
                        type="button"
                        onClick={() => openAgent(u.userId)}
                        className="text-xs px-2 py-1 rounded bg-sky-500/30 hover:bg-sky-500/50 text-sky-100"
                      >
                        🤖 AI 摘要
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="text-xs px-2 py-1 rounded bg-violet-500/30 hover:bg-violet-500/50 text-violet-100"
                      >
                        ✏️ 编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => resetPassword(u.userId)}
                        className="text-xs px-2 py-1 rounded bg-amber-500/30 hover:bg-amber-500/50 text-amber-100"
                      >
                        🔑 重置密码
                      </button>
                      <details className="text-xs">
                        <summary className="cursor-pointer text-slate-400 hover:text-slate-300">
                          JSON
                        </summary>
                        <pre className="mt-2 text-[10px] text-slate-400 max-w-xs overflow-x-auto bg-slate-900/50 p-2 rounded">
                          {JSON.stringify(p ?? {}, null, 1)}
                        </pre>
                      </details>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[1000] bg-black/70 flex items-center justify-center p-4 overflow-y-auto"
          style={{ backdropFilter: "blur(4px)" }}
        >
          <div className="card-glow max-w-md w-full bg-slate-900/95 border-violet-400/40 p-5 my-8">
            <div className="font-display font-bold text-violet-200 text-lg mb-1">
              ✏️ 编辑 {editing} 的档案
            </div>
            <div className="text-xs text-slate-400 mb-4">
              空字段会被清空 (null)。改完会立刻同步到 OSS profile.json。
            </div>
            <div className="space-y-3">
              {EDITABLE_FIELDS.map(({ key, label, type, options }) => (
                <div key={key as string}>
                  <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                  {options ? (
                    <select
                      value={(editForm[key] as string) ?? ""}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, [key]: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm"
                    >
                      {options.map((opt) => (
                        <option key={opt} value={opt}>{opt === "" ? "—" : opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={type ?? "text"}
                      value={(editForm[key] as string) ?? ""}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, [key]: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm"
                      maxLength={100}
                    />
                  )}
                </div>
              ))}
            </div>
            {editErr && (
              <div className="text-xs text-rose-300 mt-3">{editErr}</div>
            )}
            <div className="flex gap-2 justify-end mt-4">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={editBusy}
                className="text-xs px-3 py-2 rounded bg-slate-700/60 hover:bg-slate-600/60 text-slate-300 disabled:opacity-40"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submitEdit}
                disabled={editBusy}
                className="text-sm px-4 py-2 rounded bg-violet-500 hover:bg-violet-400 text-white font-bold disabled:opacity-40"
              >
                {editBusy ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="text-[10px] text-slate-500 mt-4">
        加同学也可以 CLI（不需要点 UI）:{" "}
        <code className="text-slate-300">node aliyun-deploy/scripts/add-student.mjs ...</code>
      </div>

      {/* 新建同学 modal */}
      {newOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[1000] bg-black/70 flex items-center justify-center p-4"
          style={{ backdropFilter: "blur(4px)" }}
        >
          <div className="card-glow max-w-md w-full bg-slate-900/95 border-emerald-400/40 p-5">
            <div className="font-display font-bold text-emerald-200 text-lg mb-3">
              ➕ 加新同学
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  userId * (登录子域用，比如 <code className="text-slate-300">alice</code> → alice.xiaojin.app)
                </label>
                <input
                  type="text"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value.toLowerCase())}
                  placeholder="alice"
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm font-mono"
                  maxLength={64}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">
                  显示名 (可选；首登 ProfileGate 也可补)
                </label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="爱丽丝"
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-100 text-sm"
                  maxLength={20}
                />
              </div>
            </div>
            {newErr && (
              <div className="text-xs text-rose-300 mt-3">⚠️ {newErr}</div>
            )}
            <div className="text-[10px] text-slate-500 mt-3">
              系统自动生成 20 字符随机密码，下个 modal 会显示一次。其余档案
              字段（学校/年级/监护人...）由家长首登 ProfileGate 自己补，或
              在此 super-admin 页 ✏️ 编辑 代填。
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button
                type="button"
                onClick={() => setNewOpen(false)}
                disabled={newBusy}
                className="text-xs px-3 py-2 rounded bg-slate-700/60 hover:bg-slate-600/60 text-slate-300"
              >
                取消
              </button>
              <button
                type="button"
                onClick={submitNewStudent}
                disabled={newBusy}
                className="text-sm px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-400 text-white font-bold disabled:opacity-40"
              >
                {newBusy ? "创建中…" : "创建账号"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🤖 AI 摘要 modal */}
      {agentOf && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[1000] bg-black/70 flex items-center justify-center p-4 overflow-y-auto"
          style={{ backdropFilter: "blur(4px)" }}
        >
          <div className="card-glow max-w-xl w-full bg-slate-900/95 border-sky-400/40 p-5 my-8">
            <div className="flex items-baseline gap-2 mb-2 flex-wrap">
              <div className="font-display font-bold text-sky-200 text-lg">
                🤖 {agentOf} AI 学习摘要
              </div>
              {agentData?.generatedAt && (
                <span className="text-[10px] text-slate-500">
                  ({fmtRel(agentData.generatedAt)} · {agentData.model})
                </span>
              )}
              <button
                type="button"
                onClick={() => regenAgent(agentOf)}
                disabled={agentBusy}
                className="ml-auto text-xs px-3 py-1.5 rounded bg-sky-500/30 hover:bg-sky-500/50 text-sky-100 disabled:opacity-40"
              >
                {agentBusy ? "生成中…" : agentData?.hasLatest || agentData?.summary ? "↻ 重新生成" : "✨ 生成"}
              </button>
              <button
                type="button"
                onClick={() => setAgentOf(null)}
                disabled={agentBusy}
                className="text-xs px-3 py-1.5 rounded bg-slate-700/60 hover:bg-slate-600/60 text-slate-300"
              >
                关闭
              </button>
            </div>

            {agentBusy && !agentData && (
              <div className="text-xs text-slate-400 mt-3">⏳ 拉缓存 / 调 LLM…</div>
            )}

            {agentData?.error && (
              <div className="text-xs text-rose-300 bg-rose-900/20 rounded p-3 mt-3">
                ⚠️ {agentData.error}
              </div>
            )}

            {agentData?.parseError && agentData.raw && (
              <div className="text-xs text-amber-300 bg-amber-900/20 rounded p-3 mt-3 whitespace-pre-wrap">
                <div className="font-bold mb-1">⚠️ LLM 没返回 JSON，给原文：</div>
                {agentData.raw}
              </div>
            )}

            {agentData && !agentData.error && !agentData.parseError && (agentData.summary || agentData.messageToStudent || agentData.messageToGuardian) && (
              <div className="space-y-3 mt-3">
                {agentData.summary && (
                  <div className="rounded bg-slate-800/60 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-xs font-bold text-slate-300">📝 内部学习状态摘要</div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(agentData.summary ?? "");
                          setAgentCopied("summary");
                        }}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300"
                      >
                        {agentCopied === "summary" ? "✓ 已复制" : "复制"}
                      </button>
                    </div>
                    <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{agentData.summary}</div>
                  </div>
                )}

                {agentData.messageToStudent && (
                  <div className="rounded bg-emerald-500/10 border border-emerald-400/30 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-xs font-bold text-emerald-300">💌 发给同学的鼓励</div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(agentData.messageToStudent ?? "");
                          setAgentCopied("student");
                        }}
                        className="text-[10px] px-2 py-0.5 rounded bg-emerald-700/50 hover:bg-emerald-600/50 text-emerald-100"
                      >
                        {agentCopied === "student" ? "✓ 已复制" : "复制"}
                      </button>
                    </div>
                    <div className="text-sm text-emerald-100 whitespace-pre-wrap leading-relaxed">{agentData.messageToStudent}</div>
                  </div>
                )}

                {agentData.messageToGuardian && (
                  <div className="rounded bg-violet-500/10 border border-violet-400/30 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-xs font-bold text-violet-300">
                        📨 发给 {agentData.guardianRole ?? "监护人"} 的反馈
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(agentData.messageToGuardian ?? "");
                          setAgentCopied("guardian");
                        }}
                        className="text-[10px] px-2 py-0.5 rounded bg-violet-700/50 hover:bg-violet-600/50 text-violet-100"
                      >
                        {agentCopied === "guardian" ? "✓ 已复制" : "复制"}
                      </button>
                    </div>
                    <div className="text-sm text-violet-100 whitespace-pre-wrap leading-relaxed">{agentData.messageToGuardian}</div>
                  </div>
                )}
              </div>
            )}

            {agentData && !agentBusy && !agentData.error && !agentData.summary && !agentData.parseError && (
              <div className="text-xs text-slate-400 mt-3">
                没有缓存。点 ✨ 生成 拿首次摘要（约 5-10 秒）。
              </div>
            )}

            <div className="text-[10px] text-slate-500 mt-3">
              基于 profile + stats.json + qwen3.6-flash。后续 Phase 1 会改成 cron 自动跑。
            </div>
          </div>
        </div>
      )}

      {/* 📊 学情 stats modal */}
      {statsOf && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[1000] bg-black/70 flex items-center justify-center p-4 overflow-y-auto"
          style={{ backdropFilter: "blur(4px)" }}
        >
          <div className="card-glow max-w-lg w-full bg-slate-900/95 border-emerald-400/40 p-5 my-8">
            <div className="flex items-baseline gap-2 mb-2">
              <div className="font-display font-bold text-emerald-200 text-lg">
                📊 {statsOf} 学情
              </div>
              {statsData?.fetchedAt && (
                <span className="text-[10px] text-slate-500">
                  ({fmtRel(statsData.fetchedAt)} 缓存)
                </span>
              )}
              <button
                type="button"
                onClick={() => setStatsOf(null)}
                className="ml-auto text-xs px-2 py-1 rounded bg-slate-700/60 hover:bg-slate-600/60 text-slate-300"
              >
                关闭
              </button>
            </div>

            {statsBusy && (
              <div className="text-xs text-slate-400">⏳ 加载中…</div>
            )}

            {!statsBusy && statsData?.empty && (
              <div className="text-xs text-amber-300 bg-amber-900/20 rounded p-3 mt-2">
                ⚠️ 暂无 stats。<br/>
                {statsData.note ?? "等同学下次开 app 自动 push 后再看。"}
              </div>
            )}

            {!statsBusy && statsData && !statsData.empty && (
              <div className="space-y-4 mt-3 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded bg-emerald-500/10 border border-emerald-400/30 p-3 text-center">
                    <div className="text-xl font-bold text-emerald-200">
                      {statsData.today?.attempts ?? 0}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">今天答题</div>
                  </div>
                  <div className="rounded bg-violet-500/10 border border-violet-400/30 p-3 text-center">
                    <div className="text-xl font-bold text-violet-200">
                      {statsData.last7Days?.attempts ?? 0}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">7 天答题</div>
                  </div>
                  <div className="rounded bg-amber-500/10 border border-amber-400/30 p-3 text-center">
                    <div className="text-xl font-bold text-amber-200">
                      {statsData.correctRateRecent100 ?? 0}%
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">近 100 正确率</div>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-400 mb-1.5">累计</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-xs">
                    {Object.entries(statsData.counts ?? {}).map(([k, v]) => (
                      <div key={k} className="rounded bg-slate-800/60 p-2">
                        <div className="text-slate-500 text-[10px]">{k}</div>
                        <div className="font-bold text-slate-200">{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {statsData.bySubject && Object.keys(statsData.bySubject).length > 0 && (
                  <div>
                    <div className="text-xs text-slate-400 mb-1.5">学科分布（attempts）</div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {Object.entries(statsData.bySubject).map(([subj, n]) => (
                        <div key={subj} className="rounded bg-slate-800/60 px-3 py-1.5">
                          <span className="text-slate-500">{subj}: </span>
                          <span className="font-bold text-slate-200">{n}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {statsData.topMistakeSkills && statsData.topMistakeSkills.length > 0 && (
                  <div>
                    <div className="text-xs text-slate-400 mb-1.5">Top 错题集中点</div>
                    <div className="space-y-1 text-xs">
                      {statsData.topMistakeSkills.map((m, idx) => (
                        <div key={m.skillId} className="flex justify-between bg-slate-800/60 rounded px-2 py-1">
                          <span className="text-slate-300">
                            <span className="text-slate-500">#{idx + 1}</span>{" "}
                            <code className="text-rose-300">{m.skillId}</code>
                          </span>
                          <span className="font-bold text-rose-200">{m.count} 题</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-[10px] text-slate-500 pt-1">
                  上次活跃 {fmtRel(statsData.lastActivityMs)}
                  {statsData.snapshotBytes && (
                    <> · snapshot {(statsData.snapshotBytes / 1024).toFixed(0)}KB</>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 新密码 / 新账号成功 modal */}
      {credResult && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[1001] bg-black/80 flex items-center justify-center p-4"
          style={{ backdropFilter: "blur(4px)" }}
        >
          <div className="card-glow max-w-md w-full bg-slate-900/95 border-amber-400/60 p-5">
            <div className="font-display font-bold text-amber-200 text-lg mb-2">
              {credResult.title}
            </div>
            <div className="text-xs text-amber-300/80 mb-3">
              ⚠️ 这串密码只显示这一次。立刻复制发给监护人，关掉 modal 后再也
              拉不到。
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <div className="text-xs text-slate-400">登录 URL</div>
                <div className="font-mono text-slate-200 break-all">
                  {credResult.loginUrl}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  备用：{credResult.fallbackUrl}（apex，密码也认）
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">密码</div>
                <div className="font-mono text-amber-200 break-all bg-slate-900/50 p-2 rounded">
                  {credResult.password}
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `登录: ${credResult.loginUrl}\n密码: ${credResult.password}`,
                  );
                  setCredCopied(true);
                }}
                className="text-sm px-3 py-2 rounded bg-violet-500/30 hover:bg-violet-500/50 text-violet-100 font-bold"
              >
                {credCopied ? "✓ 已复制" : "复制 登录+密码"}
              </button>
              <button
                type="button"
                onClick={() => setCredResult(null)}
                className="text-sm px-4 py-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold"
              >
                我已抄走，关掉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
