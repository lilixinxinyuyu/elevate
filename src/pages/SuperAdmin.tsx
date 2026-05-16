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

export function SuperAdminPage() {
  const nav = useNavigate();
  const [me, setMe] = useState<MeResp | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

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
                    <details className="text-xs">
                      <summary className="cursor-pointer text-violet-300 hover:text-violet-200">
                        展开
                      </summary>
                      <pre className="mt-2 text-[10px] text-slate-400 max-w-xs overflow-x-auto bg-slate-900/50 p-2 rounded">
                        {JSON.stringify(p ?? {}, null, 1)}
                      </pre>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-slate-500 mt-4">
        加同学走 CLI: <code className="text-slate-300">node aliyun-deploy/scripts/add-student.mjs --userId xxx --displayName 名字 ...</code>
      </div>
    </div>
  );
}
