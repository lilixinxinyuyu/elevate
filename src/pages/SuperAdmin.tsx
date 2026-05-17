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

  // Ep16: 批量刷新摘要
  const [bulkRefreshState, setBulkRefreshState] = useState<{
    running: boolean;
    done: number;
    total: number;
    currentUser: string | null;
    failed: string[];
  } | null>(null);

  // Ep24: 一键修所有同学的 pending reports
  const [bulkFixState, setBulkFixState] = useState<{
    running: boolean;
    scanned: number;
    fixed: number;
    failed: number;
    skipped: number;
    log: string[];
  } | null>(null);

  // Ep29: 全局 mapping backup snapshot 状态
  const [backupState, setBackupState] = useState<{
    running: boolean;
    last?: {
      backupId: string;
      copied: number;
      errors: number;
      at: number;
    };
  } | null>(null);

  // Ep30: backup list + restore 状态
  const [backupList, setBackupList] = useState<Array<{ backupId: string }> | null>(null);
  const [backupListBusy, setBackupListBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState<string | null>(null);
  const [restoreToast, setRestoreToast] = useState<{
    fromBackupId: string;
    preBackupId: string;
    restored: number;
    errors: number;
    at: number;
  } | null>(null);

  // Ep31: backup file preview (per-row expand)
  type PreviewState =
    | { status: "loading" }
    | { status: "ready"; auth: string | null; index: string | null; truncated: boolean }
    | { status: "error"; message: string };
  const [previewExpanded, setPreviewExpanded] = useState<string | null>(null);
  const [previewCache, setPreviewCache] = useState<Record<string, PreviewState>>({});

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

  async function bulkFixPendingReports() {
    const pwd = getStoredPassword();
    if (!pwd) return;
    if (users.length === 0) return;
    const ok = window.confirm(
      `扫所有 ${users.length} 同学的报告，AI 修所有 pending 的？\n\n每条 ~5s。串行执行。`,
    );
    if (!ok) return;
    setBulkFixState({ running: true, scanned: 0, fixed: 0, failed: 0, skipped: 0, log: [] });
    const log: string[] = [];
    let scanned = 0, fixed = 0, failed = 0, skipped = 0;

    for (const u of users) {
      try {
        const lr = await fetch(`/api/super-admin/users/${encodeURIComponent(u.userId)}/reports`, {
          headers: { Authorization: `Bearer ${pwd}` },
        });
        const lj = (await lr.json()) as {
          ok?: boolean;
          reports?: Array<{ id: string; fixStatus: string | null; questionId: string }>;
        };
        if (!lj.ok || !lj.reports) {
          log.push(`${u.userId}: list_failed`);
          continue;
        }
        const pending = lj.reports.filter((r) => r.fixStatus === "pending");
        if (pending.length === 0) {
          log.push(`${u.userId}: no pending`);
          continue;
        }
        for (const r of pending) {
          scanned++;
          setBulkFixState((s) => s && { ...s, scanned, log: [...log] });
          try {
            const fr = await fetch(
              `/api/super-admin/users/${encodeURIComponent(u.userId)}/reports/${encodeURIComponent(r.id)}/fix`,
              { method: "POST", headers: { Authorization: `Bearer ${pwd}` } },
            );
            const fj = (await fr.json()) as { ok?: boolean; alreadyFixed?: boolean; changesSummary?: string };
            if (fj.alreadyFixed) {
              skipped++;
              log.push(`${u.userId}/${r.questionId}: 已修过`);
            } else if (fj.ok) {
              fixed++;
              log.push(`${u.userId}/${r.questionId}: ✓ ${fj.changesSummary?.slice(0, 50) ?? ""}`);
            } else {
              failed++;
              log.push(`${u.userId}/${r.questionId}: ✗`);
            }
            setBulkFixState((s) => s && { ...s, scanned, fixed, failed, skipped, log: [...log] });
          } catch (e) {
            failed++;
            log.push(`${u.userId}/${r.questionId}: err ${(e as Error).message.slice(0, 50)}`);
          }
        }
      } catch (e) {
        log.push(`${u.userId}: err ${(e as Error).message.slice(0, 50)}`);
      }
    }

    setBulkFixState((s) => s && { ...s, running: false, scanned, fixed, failed, skipped, log: [...log] });
    await refreshUsers();
  }

  /**
   * Ep29: 给 _auth/users.json + _index/users.json 打一个点位命名快照。
   * 落到 OSS `_backups/{ISO-ts}/` 前缀，server 端 ossCopy 内部完成（零数据出口）。
   * 用途：密码 reset / onboarding 误删 index 时一键挑某次"昨天午饭前那版"恢复。
   * Per-user snapshot 本身已有 OSS bucket versioning，不在这里重复备份。
   */
  async function runBackupSnapshot() {
    const pwd = getStoredPassword();
    if (!pwd) return;
    const note = window.prompt(
      "备份说明（可选，记下为啥触发；不填留空）：",
      "manual backup",
    );
    if (note === null) return; // 用户 cancel
    setBackupState({ running: true });
    try {
      const r = await fetch("/api/super-admin/backup-snapshot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${pwd}`,
        },
        body: JSON.stringify({ note }),
      });
      const j = (await r.json().catch(() => null)) as
        | { ok: boolean; backupId?: string; copied?: unknown[]; errors?: unknown[]; manifestKey?: string }
        | null;
      if (!r.ok || !j?.ok) {
        setBackupState({ running: false });
        alert(`备份失败：${j?.errors?.length ?? "?"} 错误。check ESA logs。`);
        return;
      }
      setBackupState({
        running: false,
        last: {
          backupId: j.backupId ?? "?",
          copied: j.copied?.length ?? 0,
          errors: j.errors?.length ?? 0,
          at: Date.now(),
        },
      });
      // Ep30: refresh list to include the new snapshot
      void loadBackupList();
    } catch (e) {
      setBackupState({ running: false });
      alert(`备份网络错：${(e as Error).message}`);
    }
  }

  /** Ep30: 拉最近 20 个 backup snapshot 列表 */
  async function loadBackupList() {
    const pwd = getStoredPassword();
    if (!pwd) return;
    setBackupListBusy(true);
    try {
      const r = await fetch("/api/super-admin/backup-snapshot", {
        headers: { Authorization: `Bearer ${pwd}` },
      });
      const j = (await r.json().catch(() => null)) as
        | { ok: boolean; backups?: Array<{ backupId: string }> }
        | null;
      setBackupList(j?.backups ?? []);
    } catch {
      setBackupList([]);
    } finally {
      setBackupListBusy(false);
    }
  }

  /**
   * Ep30: rollback 某个 backup 到主路径。
   * 服务端会先做一次「pre-restore-of-{id}」snapshot 保当前状态，
   * 然后 ossCopy 把 backup 覆盖到 _auth/_index 主路径。
   */
  async function runRestoreSnapshot(backupId: string) {
    const pwd = getStoredPassword();
    if (!pwd) return;
    const ok = window.confirm(
      `回滚到 backup ${backupId}？\n\n` +
        `会先给当前 _auth + _index 状态再打一个 "pre-restore-of-${backupId}" 命名快照，\n` +
        `然后把 backup 内容覆盖到主路径。\n\n` +
        `操作后所有同学的密码 / 用户索引会变为 ${backupId} 那一刻的状态。`,
    );
    if (!ok) return;
    setRestoreBusy(backupId);
    try {
      const r = await fetch(
        `/api/super-admin/backup-snapshot/${encodeURIComponent(backupId)}/restore`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${pwd}`,
          },
          body: "{}",
        },
      );
      const j = (await r.json().catch(() => null)) as
        | { ok: boolean; preRestoreBackupId?: string; restored?: unknown[]; restoreErrors?: unknown[] }
        | null;
      if (!r.ok || !j?.ok) {
        alert(`回滚失败：${j?.restoreErrors?.length ?? "?"} 错误`);
        setRestoreBusy(null);
        return;
      }
      setRestoreToast({
        fromBackupId: backupId,
        preBackupId: j.preRestoreBackupId ?? "?",
        restored: j.restored?.length ?? 0,
        errors: j.restoreErrors?.length ?? 0,
        at: Date.now(),
      });
      // 刷新列表（pre-restore-of-* 会以新 id 出现）
      await loadBackupList();
    } catch (e) {
      alert(`回滚网络错：${(e as Error).message}`);
    } finally {
      setRestoreBusy(null);
    }
  }

  /**
   * Ep31: toggle row expand → load backup 里 _auth + _index 内容
   * 用于 restore 前肉眼审查。
   */
  async function togglePreview(backupId: string) {
    if (previewExpanded === backupId) {
      setPreviewExpanded(null);
      return;
    }
    setPreviewExpanded(backupId);
    if (previewCache[backupId]?.status === "ready") return; // 已缓存

    setPreviewCache((c) => ({ ...c, [backupId]: { status: "loading" } }));
    const pwd = getStoredPassword();
    if (!pwd) {
      setPreviewCache((c) => ({ ...c, [backupId]: { status: "error", message: "no auth" } }));
      return;
    }
    try {
      // 拉两个文件并行
      const [authR, indexR] = await Promise.all([
        fetch(
          `/api/super-admin/backup-snapshot/${encodeURIComponent(backupId)}/file?path=${encodeURIComponent("_auth/users.json")}`,
          { headers: { Authorization: `Bearer ${pwd}` } },
        ).then((r) => r.json()).catch(() => null),
        fetch(
          `/api/super-admin/backup-snapshot/${encodeURIComponent(backupId)}/file?path=${encodeURIComponent("_index/users.json")}`,
          { headers: { Authorization: `Bearer ${pwd}` } },
        ).then((r) => r.json()).catch(() => null),
      ]);
      const authContent = authR?.ok ? authR.content : null;
      const indexContent = indexR?.ok ? indexR.content : null;
      const truncated = Boolean(authR?.truncated || indexR?.truncated);
      setPreviewCache((c) => ({
        ...c,
        [backupId]: { status: "ready", auth: authContent, index: indexContent, truncated },
      }));
    } catch (e) {
      setPreviewCache((c) => ({
        ...c,
        [backupId]: { status: "error", message: (e as Error).message },
      }));
    }
  }

  /** Pretty-format JSON without throwing on parse failures. */
  function safePretty(text: string | null): string {
    if (!text) return "(empty)";
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
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

  // Ep164: x.ai engineered-cosmic redesign
  //   canvas #0a0a0a / card #1a1c20 / hairline #212327
  //   sunset CTA #ff7a17 / white-pill secondary
  //   mono UPPERCASE caption for ID/etag/phone
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-6 text-[#7d8187] text-xs font-mono uppercase tracking-wider">
        Loading fleet…
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-6">
        <div className="max-w-md mx-auto pt-20">
          <div className="text-[10px] font-mono uppercase tracking-wider text-rose-400 mb-2">
            ⚠ Access denied
          </div>
          <div className="text-white text-base mb-4">{err}</div>
          <Link
            to="/"
            className="inline-block rounded-full border border-white/30 hover:border-white text-white text-xs px-4 py-2 font-medium"
          >
            ← Return home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        {/* Header — engineered-cosmic command bar */}
        <div className="mb-6">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="font-display text-3xl md:text-4xl font-medium tracking-tight">
              Command Console
            </h1>
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#7d8187]">
              {me?.userId} · {users.length} cadets
            </span>
            <Link
              to="/"
              className="ml-auto text-[10px] font-mono uppercase tracking-wider text-[#7d8187] hover:text-white"
            >
              ← Home
            </Link>
          </div>
          <div className="mt-2 text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187]">
            xiaojin · super-admin · classified
          </div>
          <div className="mt-3 h-px bg-gradient-to-r from-[#ff7a17]/40 via-[#7c3aed]/30 to-transparent" />
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            type="button"
            onClick={() => { setNewOpen(true); setNewErr(null); }}
            className="text-xs rounded-full bg-[#ff7a17] hover:bg-[#ffc285] text-[#0a0a0a] px-4 py-2 font-medium transition-colors"
          >
            + Enlist new cadet
          </button>
          <button
            type="button"
            onClick={bulkRefreshSummaries}
            disabled={bulkRefreshState?.running || bulkFixState?.running}
            className="text-xs rounded-full border border-white/30 hover:border-white text-white px-4 py-2 font-medium disabled:opacity-30 disabled:hover:border-white/30 transition-colors"
          >
            {bulkRefreshState?.running
              ? `Briefing ${bulkRefreshState.done}/${bulkRefreshState.total}${bulkRefreshState.currentUser ? " · " + bulkRefreshState.currentUser : ""}`
              : "Refresh AI briefings"}
          </button>
          <button
            type="button"
            onClick={bulkFixPendingReports}
            disabled={bulkRefreshState?.running || bulkFixState?.running}
            className="text-xs rounded-full border border-white/30 hover:border-white text-white px-4 py-2 font-medium disabled:opacity-30 disabled:hover:border-white/30 transition-colors"
          >
            {bulkFixState?.running
              ? `Repairing (scan ${bulkFixState.scanned} · fix ${bulkFixState.fixed})`
              : "Repair pending reports"}
          </button>
          <button
            type="button"
            onClick={runBackupSnapshot}
            disabled={backupState?.running || bulkRefreshState?.running || bulkFixState?.running}
            title="给 _auth/users.json + _index/users.json 打一个时间命名快照到 _backups/{ISO-ts}/"
            className="text-xs rounded-full border border-[#ff7a17]/40 hover:border-[#ff7a17] text-[#ffc285] px-4 py-2 font-medium disabled:opacity-30 transition-colors"
          >
            {backupState?.running
              ? "⟁ snapshotting…"
              : backupState?.last
                ? `⟁ snapshot · ${backupState.last.backupId.slice(0, 16)} (${backupState.last.copied} files${backupState.last.errors > 0 ? ", " + backupState.last.errors + " err" : ""})`
                : "⟁ Snapshot global mappings"}
          </button>
        </div>

        <div className="text-[11px] text-[#7d8187] mb-3 leading-relaxed max-w-3xl">
          Fleet overview. Edit profiles · reset passwords · view stats · pull AI briefings.
          Bulk actions run sequentially to respect upstream rate limits.
        </div>

        {/* Ep30: Recent backup snapshots panel (collapsible, hairline) */}
        <details
          className="mb-4 rounded-lg bg-[#1a1c20] border border-[#212327]"
          onToggle={(e) => {
            if ((e.target as HTMLDetailsElement).open && !backupList && !backupListBusy) {
              void loadBackupList();
            }
          }}
        >
          <summary className="cursor-pointer px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] hover:text-white select-none flex items-center gap-2">
            <span>⟁ recent snapshots</span>
            <span className="text-[#363a3f]">·</span>
            <span className="text-[#7d8187]">
              {backupListBusy ? "loading…" : backupList ? `${backupList.length}` : "click to load"}
            </span>
          </summary>
          <div className="px-4 pb-3 pt-1">
            {backupList && backupList.length === 0 && (
              <div className="text-[11px] text-[#7d8187] py-2">
                no snapshots yet · click "⟁ Snapshot global mappings" above to create one
              </div>
            )}
            {backupList && backupList.length > 0 && (
              <div className="space-y-1 max-h-[520px] overflow-y-auto">
                {backupList.map((b) => {
                  const isPre = b.backupId.includes("pre-restore-of-");
                  const expanded = previewExpanded === b.backupId;
                  const preview = previewCache[b.backupId];
                  return (
                    <div
                      key={b.backupId}
                      className="rounded-md bg-[#0a0a0a] border border-[#212327] overflow-hidden"
                    >
                      <div className="flex items-center justify-between gap-2 py-1.5 px-2">
                        <button
                          type="button"
                          onClick={() => togglePreview(b.backupId)}
                          className="flex items-center gap-2 min-w-0 text-left flex-1 hover:bg-[#1a1c20] rounded px-1 py-0.5 -my-0.5 transition-colors"
                          title="点开预览 _auth + _index 文件内容"
                        >
                          <span className="text-[#7d8187] text-[10px] font-mono flex-shrink-0">
                            {expanded ? "▾" : "▸"}
                          </span>
                          <span className="font-mono text-[10px] uppercase tracking-wider text-white truncate">
                            {b.backupId}
                          </span>
                          {isPre && (
                            <span className="text-[9px] font-mono uppercase tracking-wider text-[#c4b5fd] flex-shrink-0">
                              ⟁ pre-restore
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => runRestoreSnapshot(b.backupId)}
                          disabled={restoreBusy !== null}
                          className="flex-shrink-0 text-[10px] font-mono uppercase tracking-wider rounded-full border border-[#ff7a17]/40 hover:border-[#ff7a17] text-[#ffc285] px-3 py-1 disabled:opacity-30"
                        >
                          {restoreBusy === b.backupId ? "restoring…" : "restore"}
                        </button>
                      </div>
                      {expanded && (
                        <div className="border-t border-[#212327] px-3 py-2 bg-[#0a0a0a]">
                          {!preview && (
                            <div className="text-[10px] font-mono uppercase tracking-wider text-[#7d8187]">
                              · click row to load ·
                            </div>
                          )}
                          {preview?.status === "loading" && (
                            <div className="text-[10px] font-mono uppercase tracking-wider text-[#7d8187]">
                              ⏳ fetching files…
                            </div>
                          )}
                          {preview?.status === "error" && (
                            <div className="text-[10px] font-mono uppercase tracking-wider text-rose-400">
                              ⚠ {preview.message}
                            </div>
                          )}
                          {preview?.status === "ready" && (
                            <div className="space-y-2">
                              {preview.truncated && (
                                <div className="text-[9px] font-mono uppercase tracking-wider text-amber-400">
                                  ⚠ content truncated · download raw to inspect rest
                                </div>
                              )}
                              <div>
                                <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-[#7d8187] mb-1">
                                  _auth/users.json
                                </div>
                                <pre className="text-[10px] font-mono text-[#dadbdf] bg-[#1a1c20] border border-[#212327] rounded p-2 max-h-[160px] overflow-auto whitespace-pre-wrap break-all">
{safePretty(preview.auth)}
                                </pre>
                              </div>
                              <div>
                                <div className="text-[9px] font-mono uppercase tracking-[0.15em] text-[#7d8187] mb-1">
                                  _index/users.json
                                </div>
                                <pre className="text-[10px] font-mono text-[#dadbdf] bg-[#1a1c20] border border-[#212327] rounded p-2 max-h-[200px] overflow-auto whitespace-pre-wrap break-all">
{safePretty(preview.index)}
                                </pre>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </details>

        {/* Ep30: restore result toast */}
        {restoreToast && (
          <div className="rounded-lg bg-[#1a1c20] border border-[#ff7a17]/40 p-3 mb-3 text-xs text-[#dadbdf]">
            <div className="font-mono uppercase tracking-wider text-[10px] mb-1 text-[#ffc285]">
              ⟁ restored · {restoreToast.fromBackupId}
            </div>
            <div className="text-[11px] text-[#7d8187]">
              {restoreToast.restored} files copied{restoreToast.errors > 0 && `, ${restoreToast.errors} errors`}
              {" · pre-restore safety snapshot: "}
              <span className="font-mono text-white">{restoreToast.preBackupId}</span>
            </div>
          </div>
        )}

        {/* 批量修题结果 toast */}
        {bulkFixState && !bulkFixState.running && (
          <div className="rounded-lg bg-[#1a1c20] border border-[#212327] p-3 mb-3 text-xs text-[#dadbdf]">
            <div className="font-mono uppercase tracking-wider text-[10px] mb-1">
              <span className={bulkFixState.failed === 0 ? "text-emerald-400" : "text-amber-400"}>
                {bulkFixState.failed === 0 ? "● repair complete" : "● repair partial"}
              </span>
              <span className="text-[#7d8187] ml-2">
                scan {bulkFixState.scanned} · fixed {bulkFixState.fixed} · failed {bulkFixState.failed} · skipped {bulkFixState.skipped}
              </span>
            </div>
            {bulkFixState.log.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[10px] font-mono uppercase tracking-wider text-[#7d8187] hover:text-white">
                  expand log ({bulkFixState.log.length})
                </summary>
                <pre className="mt-2 text-[10px] text-[#7d8187] max-h-64 overflow-y-auto font-mono">{bulkFixState.log.join("\n")}</pre>
              </details>
            )}
          </div>
        )}

        {/* 批量刷新结果 toast */}
        {bulkRefreshState && !bulkRefreshState.running && (
          <div className="rounded-lg bg-[#1a1c20] border border-[#212327] p-3 mb-3 text-xs text-[#dadbdf]">
            <span className="font-mono uppercase tracking-wider text-[10px]">
              <span className={bulkRefreshState.failed.length === 0 ? "text-emerald-400" : "text-amber-400"}>
                {bulkRefreshState.failed.length === 0 ? "● briefings refreshed" : "● refresh partial"}
              </span>
              <span className="text-[#7d8187] ml-2">
                {bulkRefreshState.failed.length === 0
                  ? `${bulkRefreshState.done} briefings updated`
                  : `${bulkRefreshState.done - bulkRefreshState.failed.length}/${bulkRefreshState.done} ok · failed: ${bulkRefreshState.failed.join(", ")}`}
              </span>
            </span>
          </div>
        )}

        <div className="rounded-lg bg-[#1a1c20] border border-[#212327] overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-[#212327]">
              <th className="p-3 text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] font-normal">Cadet</th>
              <th className="p-3 text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] font-normal">School · Grade</th>
              <th className="p-3 text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] font-normal">Guardian</th>
              <th className="p-3 text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] font-normal">Last sync</th>
              <th className="p-3 text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] font-normal">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const p = u.profile;
              return (
                <tr
                  key={u.userId}
                  className="border-b border-[#212327] hover:bg-[#191919]/60 transition-colors"
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {u.isSuperAdmin && (
                        <span title="super-admin" className="text-[#ff7a17] text-[10px] font-mono uppercase tracking-wider">★</span>
                      )}
                      <div>
                        <div className="font-medium text-white">
                          {p?.displayName ?? u.userId}
                        </div>
                        <div className="text-[10px] text-[#7d8187] font-mono uppercase tracking-wider">
                          {u.userId}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-[#dadbdf]">
                    {p?.school ? (
                      <>
                        <div className="text-sm">{p.school}</div>
                        <div className="text-[10px] text-[#7d8187] font-mono uppercase tracking-wider mt-0.5">
                          {p.city ?? "—"} · G{p.grade ?? "?"} · CLASS {p.class ?? "?"}
                        </div>
                      </>
                    ) : (
                      <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400/70">missing</span>
                    )}
                  </td>
                  <td className="p-3 text-[#dadbdf]">
                    {p?.guardianRole ? (
                      <>
                        <div className="text-sm">{p.guardianRole}</div>
                        <div className="text-[10px] text-[#7d8187] font-mono">
                          {p.guardianPhone ?? "—"}
                        </div>
                      </>
                    ) : (
                      <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400/70">missing</span>
                    )}
                  </td>
                  <td className="p-3">
                    {u.snapshot.present ? (
                      <>
                        <div className="text-[#dadbdf] text-sm">
                          {fmtRel(u.snapshot.lastModifiedMs)}
                        </div>
                        <div className="text-[10px] text-[#7d8187] font-mono">
                          {fmtDate(u.snapshot.lastModifiedMs)}
                        </div>
                        {u.statsKpi && (
                          <div className="text-[10px] font-mono uppercase tracking-wider text-[#7d8187] mt-1.5 flex gap-2">
                            <span><span className="text-white">{u.statsKpi.todayAttempts ?? 0}</span> today</span>
                            <span><span className="text-white">{u.statsKpi.last7Attempts ?? 0}</span> 7d</span>
                            <span><span className="text-[#ff7a17]">{u.statsKpi.correctRate ?? 0}%</span> acc</span>
                          </div>
                        )}
                        {u.latestSummary?.preview && (
                          <div
                            className="text-[10px] text-[#a0c3ec]/80 mt-1.5 max-w-[200px] truncate italic"
                            title={`AI briefing (${fmtRel(u.latestSummary.generatedAt ?? null)}): ${u.latestSummary.preview}...`}
                          >
                            ⟁ {u.latestSummary.preview}…
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#7d8187]">never synced</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={() => openStats(u.userId)}
                        className="text-[10px] font-mono uppercase tracking-wider rounded-full border border-white/20 hover:border-white text-[#dadbdf] hover:text-white px-3 py-1 transition-colors"
                      >
                        Stats
                      </button>
                      <button
                        type="button"
                        onClick={() => openAgent(u.userId)}
                        className="text-[10px] font-mono uppercase tracking-wider rounded-full border border-white/20 hover:border-white text-[#dadbdf] hover:text-white px-3 py-1 transition-colors"
                      >
                        AI brief
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="text-[10px] font-mono uppercase tracking-wider rounded-full border border-white/20 hover:border-white text-[#dadbdf] hover:text-white px-3 py-1 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => resetPassword(u.userId)}
                        className="text-[10px] font-mono uppercase tracking-wider rounded-full border border-[#ff7a17]/40 hover:border-[#ff7a17] text-[#ff7a17] hover:text-[#ffc285] px-3 py-1 transition-colors"
                      >
                        Reset PW
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
        </div>

      {editing && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[1000] bg-black/80 flex items-center justify-center p-4 overflow-y-auto"
          style={{ backdropFilter: "blur(6px)" }}
        >
          <div className="max-w-md w-full bg-[#1a1c20] border border-[#212327] rounded-xl p-6 my-8">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] mb-1">
              edit cadet record
            </div>
            <div className="font-display text-xl font-medium tracking-tight text-white mb-1">
              <span className="font-mono uppercase tracking-wider text-base">{editing}</span>
            </div>
            <div className="text-[11px] text-[#7d8187] mb-5 leading-relaxed">
              Empty fields will be cleared (null). Saves sync to OSS profile.json immediately.
            </div>
            <div className="space-y-3">
              {EDITABLE_FIELDS.map(({ key, label, type, options }) => (
                <div key={key as string}>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-[#7d8187] mb-1 block">{label}</label>
                  {options ? (
                    <select
                      value={(editForm[key] as string) ?? ""}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, [key]: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-md bg-[#0a0a0a] border border-[#212327] hover:border-[#363a3f] focus:border-[#ff7a17] focus:outline-none text-white text-sm transition-colors"
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
                      className="w-full px-3 py-2 rounded-md bg-[#0a0a0a] border border-[#212327] hover:border-[#363a3f] focus:border-[#ff7a17] focus:outline-none text-white text-sm transition-colors"
                      maxLength={100}
                    />
                  )}
                </div>
              ))}
            </div>
            {editErr && (
              <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400 mt-3">⚠ {editErr}</div>
            )}
            <div className="flex gap-2 justify-end mt-5">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={editBusy}
                className="text-xs rounded-full border border-white/30 hover:border-white text-white px-4 py-2 font-medium disabled:opacity-30"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitEdit}
                disabled={editBusy}
                className="text-xs rounded-full bg-[#ff7a17] hover:bg-[#ffc285] text-[#0a0a0a] px-4 py-2 font-medium disabled:opacity-30"
              >
                {editBusy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

        <div className="text-[10px] font-mono uppercase tracking-wider text-[#7d8187] mt-6 pb-8">
          CLI alternative:{" "}
          <code className="text-[#dadbdf] normal-case tracking-normal">node aliyun-deploy/scripts/add-student.mjs …</code>
        </div>
      </div>  {/* /max-w container */}

      {/* Enlist new cadet modal */}
      {newOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[1000] bg-black/80 flex items-center justify-center p-4"
          style={{ backdropFilter: "blur(6px)" }}
        >
          <div className="max-w-md w-full bg-[#1a1c20] border border-[#212327] rounded-xl p-6">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] mb-1">
              new cadet enlistment
            </div>
            <div className="font-display text-xl font-medium tracking-tight text-white mb-4">
              Enlist new cadet
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#7d8187] mb-1 block">
                  user id <span className="text-[#ff7a17]">*</span>
                </label>
                <input
                  type="text"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value.toLowerCase())}
                  placeholder="alice"
                  className="w-full px-3 py-2 rounded-md bg-[#0a0a0a] border border-[#212327] hover:border-[#363a3f] focus:border-[#ff7a17] focus:outline-none text-white text-sm font-mono uppercase tracking-wider"
                  maxLength={64}
                />
                <div className="text-[10px] text-[#7d8187] mt-1">
                  Becomes <code className="text-[#dadbdf]">{newUserId || "alice"}.xiaojin.app</code> subdomain
                </div>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#7d8187] mb-1 block">
                  display name <span className="text-[#7d8187]">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="爱丽丝"
                  className="w-full px-3 py-2 rounded-md bg-[#0a0a0a] border border-[#212327] hover:border-[#363a3f] focus:border-[#ff7a17] focus:outline-none text-white text-sm"
                  maxLength={20}
                />
              </div>
            </div>
            {newErr && (
              <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400 mt-3">⚠ {newErr}</div>
            )}
            <div className="text-[10px] text-[#7d8187] mt-3 leading-relaxed">
              System generates a 20-char random password (shown next, once only).
              Profile fields (school / grade / guardian) get filled by guardian on first login,
              or by you via Edit.
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                type="button"
                onClick={() => setNewOpen(false)}
                disabled={newBusy}
                className="text-xs rounded-full border border-white/30 hover:border-white text-white px-4 py-2 font-medium disabled:opacity-30"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitNewStudent}
                disabled={newBusy}
                className="text-xs rounded-full bg-[#ff7a17] hover:bg-[#ffc285] text-[#0a0a0a] px-4 py-2 font-medium disabled:opacity-30"
              >
                {newBusy ? "Enlisting…" : "Create account"}
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
          <div className="max-w-xl w-full bg-[#1a1c20] border border-[#212327] rounded-xl p-6 my-8">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] mb-1">
              ⟁ ai mission log
            </div>
            <div className="flex items-baseline gap-3 mb-4 flex-wrap">
              <div className="font-display text-xl font-medium tracking-tight text-white">
                <span className="font-mono uppercase tracking-wider text-base">{agentOf}</span>
                <span className="text-[#7d8187] mx-2">·</span>
                <span className="text-[#a0c3ec]">learning brief</span>
              </div>
              {agentData?.generatedAt && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#7d8187]">
                  {fmtRel(agentData.generatedAt)} · {agentData.model}
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => regenAgent(agentOf)}
                  disabled={agentBusy}
                  className="text-xs rounded-full bg-[#ff7a17] hover:bg-[#ffc285] text-[#0a0a0a] px-4 py-2 font-medium disabled:opacity-30"
                >
                  {agentBusy ? "GENERATING…" : agentData?.hasLatest || agentData?.summary ? "↻ REGEN" : "✨ GENERATE"}
                </button>
                <button
                  type="button"
                  onClick={() => setAgentOf(null)}
                  disabled={agentBusy}
                  className="text-xs rounded-full border border-white/30 hover:border-white text-white px-4 py-2 font-medium disabled:opacity-30"
                >
                  Close
                </button>
              </div>
            </div>

            {agentBusy && !agentData && (
              <div className="text-xs font-mono uppercase tracking-wider text-[#7d8187] mt-3">
                ⏳ FETCH CACHE / CALL LLM…
              </div>
            )}

            {agentData?.error && (
              <div className="text-xs font-mono uppercase tracking-wider text-rose-400 bg-[#0a0a0a] border border-rose-400/30 rounded-md p-3 mt-3">
                ⚠ {agentData.error}
              </div>
            )}

            {agentData?.parseError && agentData.raw && (
              <div className="text-xs text-amber-300 bg-[#0a0a0a] border border-amber-400/30 rounded-md p-3 mt-3 whitespace-pre-wrap">
                <div className="font-mono uppercase tracking-wider mb-1.5">⚠ LLM RETURNED NON-JSON · RAW:</div>
                <div className="text-[#dadbdf]">{agentData.raw}</div>
              </div>
            )}

            {agentData && !agentData.error && !agentData.parseError && (agentData.summary || agentData.messageToStudent || agentData.messageToGuardian) && (
              <div className="space-y-3 mt-3">
                {agentData.summary && (
                  <div className="rounded-md bg-[#0a0a0a] border border-[#212327] p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187]">
                        internal status briefing
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(agentData.summary ?? "");
                          setAgentCopied("summary");
                        }}
                        className="text-[10px] font-mono uppercase tracking-wider rounded-full border border-white/30 hover:border-white text-white px-3 py-1"
                      >
                        {agentCopied === "summary" ? "✓ COPIED" : "COPY"}
                      </button>
                    </div>
                    <div className="text-sm text-[#dadbdf] whitespace-pre-wrap leading-relaxed">{agentData.summary}</div>
                  </div>
                )}

                {agentData.messageToStudent && (
                  <div className="rounded-md bg-[#0a0a0a] border border-[#ff7a17]/25 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#ffc285]">
                        ⟁ transmission · to cadet
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(agentData.messageToStudent ?? "");
                          setAgentCopied("student");
                        }}
                        className="text-[10px] font-mono uppercase tracking-wider rounded-full border border-[#ff7a17]/40 hover:border-[#ff7a17] text-[#ffc285] px-3 py-1"
                      >
                        {agentCopied === "student" ? "✓ COPIED" : "COPY"}
                      </button>
                    </div>
                    <div className="text-sm text-white whitespace-pre-wrap leading-relaxed">{agentData.messageToStudent}</div>
                  </div>
                )}

                {agentData.messageToGuardian && (
                  <div className="rounded-md bg-[#0a0a0a] border border-[#7c3aed]/30 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#c4b5fd]">
                        ⟁ transmission · to {agentData.guardianRole ?? "guardian"}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(agentData.messageToGuardian ?? "");
                          setAgentCopied("guardian");
                        }}
                        className="text-[10px] font-mono uppercase tracking-wider rounded-full border border-[#7c3aed]/40 hover:border-[#c4b5fd] text-[#c4b5fd] px-3 py-1"
                      >
                        {agentCopied === "guardian" ? "✓ COPIED" : "COPY"}
                      </button>
                    </div>
                    <div className="text-sm text-white whitespace-pre-wrap leading-relaxed">{agentData.messageToGuardian}</div>
                  </div>
                )}
              </div>
            )}

            {agentData && !agentBusy && !agentData.error && !agentData.summary && !agentData.parseError && (
              <div className="text-xs font-mono uppercase tracking-wider text-[#7d8187] mt-3">
                NO CACHE · TAP ✨ GENERATE FOR FIRST BRIEF (~5-10s)
              </div>
            )}

            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] mt-4 pt-3 border-t border-[#212327]">
              profile + stats.json · qwen3.6-flash · phase 1 → cron
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
          <div className="max-w-lg w-full bg-[#1a1c20] border border-[#212327] rounded-xl p-6 my-8">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] mb-1">
              ⟁ cadet telemetry
            </div>
            <div className="flex items-baseline gap-3 mb-4 flex-wrap">
              <div className="font-display text-xl font-medium tracking-tight text-white">
                <span className="font-mono uppercase tracking-wider text-base">{statsOf}</span>
                <span className="text-[#7d8187] mx-2">·</span>
                <span className="text-[#a0c3ec]">flight log</span>
              </div>
              {statsData?.fetchedAt && (
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#7d8187]">
                  cache · {fmtRel(statsData.fetchedAt)}
                </span>
              )}
              <button
                type="button"
                onClick={() => setStatsOf(null)}
                className="ml-auto text-xs rounded-full border border-white/30 hover:border-white text-white px-4 py-2 font-medium"
              >
                Close
              </button>
            </div>

            {statsBusy && (
              <div className="text-xs font-mono uppercase tracking-wider text-[#7d8187]">
                ⏳ LOADING…
              </div>
            )}

            {!statsBusy && statsData?.empty && (
              <div className="text-xs text-amber-300 bg-[#0a0a0a] border border-amber-400/30 rounded-md p-3 mt-2">
                <div className="font-mono uppercase tracking-wider mb-1">⚠ NO TELEMETRY YET</div>
                <div className="text-[#dadbdf]">{statsData.note ?? "等同学下次开 app 自动 push 后再看。"}</div>
              </div>
            )}

            {!statsBusy && statsData && !statsData.empty && (
              <div className="space-y-4 mt-3 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-md bg-[#0a0a0a] border border-[#ff7a17]/25 p-3 text-center">
                    <div className="font-display text-2xl font-medium tracking-tight text-[#ffc285]">
                      {statsData.today?.attempts ?? 0}
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#7d8187] mt-1">today</div>
                  </div>
                  <div className="rounded-md bg-[#0a0a0a] border border-[#7c3aed]/30 p-3 text-center">
                    <div className="font-display text-2xl font-medium tracking-tight text-[#c4b5fd]">
                      {statsData.last7Days?.attempts ?? 0}
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#7d8187] mt-1">7d total</div>
                  </div>
                  <div className="rounded-md bg-[#0a0a0a] border border-[#a0c3ec]/30 p-3 text-center">
                    <div className="font-display text-2xl font-medium tracking-tight text-[#a0c3ec]">
                      {statsData.correctRateRecent100 ?? 0}%
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#7d8187] mt-1">acc · last 100</div>
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] mb-2">
                    cumulative
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-xs">
                    {Object.entries(statsData.counts ?? {}).map(([k, v]) => (
                      <div key={k} className="rounded-md bg-[#0a0a0a] border border-[#212327] p-2">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-[#7d8187]">{k}</div>
                        <div className="font-mono text-white">{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {statsData.bySubject && Object.keys(statsData.bySubject).length > 0 && (
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] mb-2">
                      attempts by subject
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {Object.entries(statsData.bySubject).map(([subj, n]) => (
                        <div key={subj} className="rounded-full bg-[#0a0a0a] border border-[#212327] px-3 py-1">
                          <span className="font-mono uppercase tracking-wider text-[#7d8187]">{subj}</span>
                          <span className="font-mono text-white ml-2">{n}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {statsData.topMistakeSkills && statsData.topMistakeSkills.length > 0 && (
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] mb-2">
                      top error hotspots
                    </div>
                    <div className="space-y-1 text-xs">
                      {statsData.topMistakeSkills.map((m, idx) => (
                        <div key={m.skillId} className="flex justify-between items-center bg-[#0a0a0a] border border-[#212327] rounded-md px-3 py-1.5">
                          <span className="flex items-center gap-2">
                            <span className="font-mono uppercase tracking-wider text-[#7d8187]">#{idx + 1}</span>
                            <code className="font-mono text-rose-300">{m.skillId}</code>
                          </span>
                          <span className="font-mono text-rose-400">{m.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] pt-3 border-t border-[#212327]">
                  last seen · {fmtRel(statsData.lastActivityMs)}
                  {statsData.snapshotBytes && (
                    <> · snapshot {(statsData.snapshotBytes / 1024).toFixed(0)}kb</>
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
          <div className="max-w-md w-full bg-[#1a1c20] border border-[#ff7a17]/40 rounded-xl p-6">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#ffc285] mb-1">
              ⟁ classified · single view
            </div>
            <div className="font-display text-xl font-medium tracking-tight text-white mb-3">
              {credResult.title}
            </div>
            <div className="text-xs font-mono uppercase tracking-wider text-[#ffc285] bg-[#0a0a0a] border border-[#ff7a17]/25 rounded-md p-3 mb-4">
              ⚠ password shown ONCE · copy now or it's gone
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] mb-1">
                  login url
                </div>
                <div className="font-mono text-white text-xs break-all bg-[#0a0a0a] border border-[#212327] rounded-md p-2">
                  {credResult.loginUrl}
                </div>
                <div className="text-[10px] font-mono tracking-wider text-[#7d8187] mt-1.5">
                  fallback · {credResult.fallbackUrl}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] mb-1">
                  password
                </div>
                <div className="font-mono text-[#ffc285] text-sm break-all bg-[#0a0a0a] border border-[#ff7a17]/30 rounded-md p-3">
                  {credResult.password}
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `登录: ${credResult.loginUrl}\n密码: ${credResult.password}`,
                  );
                  setCredCopied(true);
                }}
                className="text-xs rounded-full border border-white/30 hover:border-white text-white px-4 py-2 font-medium"
              >
                {credCopied ? "✓ COPIED" : "COPY URL+PASS"}
              </button>
              <button
                type="button"
                onClick={() => setCredResult(null)}
                className="text-xs rounded-full bg-[#ff7a17] hover:bg-[#ffc285] text-[#0a0a0a] px-4 py-2 font-medium"
              >
                ACKNOWLEDGED · CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
