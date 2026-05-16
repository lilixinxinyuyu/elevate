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
  };
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

  useEffect(() => {
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
      <div className="flex items-baseline gap-3 mb-4">
        <h1 className="font-display font-bold text-violet-200 text-xl">
          🛠 项目超级管理员
        </h1>
        <span className="text-xs text-slate-400">
          ({me?.userId} · 共 {users.length} 同学)
        </span>
        <Link to="/" className="ml-auto text-xs text-violet-300 underline">
          返回首页
        </Link>
      </div>

      <div className="text-xs text-slate-300 mb-4">
        所有同学的账户 + profile + 上次活跃。后续会加：编辑账户 / 重置密码 /
        24h AI agent 学习摘要。
      </div>

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
                      </>
                    ) : (
                      <span className="text-slate-500 text-xs">从未同步</span>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="text-xs px-2 py-1 rounded bg-violet-500/30 hover:bg-violet-500/50 text-violet-100"
                      >
                        ✏️ 编辑
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
        加同学走 CLI: <code className="text-slate-300">node aliyun-deploy/scripts/add-student.mjs --userId xxx --displayName 名字 ...</code>
      </div>
    </div>
  );
}
