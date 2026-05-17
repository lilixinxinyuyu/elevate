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

  // v0.34.75 iter 9: 课本 PDF 上传 modal
  const [textbookOpen, setTextbookOpen] = useState(false);
  const [textbookTargetUserId, setTextbookTargetUserId] = useState("");
  const [textbookSubject, setTextbookSubject] = useState<"math" | "chinese" | "english">("math");
  const [textbookGrade, setTextbookGrade] = useState<"1" | "2" | "3" | "4" | "5" | "6">("5");
  const [textbookFile, setTextbookFile] = useState<File | null>(null);
  const [textbookBusy, setTextbookBusy] = useState(false);
  const [textbookErr, setTextbookErr] = useState<string | null>(null);
  const [textbookResult, setTextbookResult] = useState<{
    uploadId: string;
    sizeBytes: number;
    estimatedParseMinutes: number;
  } | null>(null);
  // v0.34.76 iter 10: synthesize state
  const [synthBusy, setSynthBusy] = useState(false);
  const [synthResult, setSynthResult] = useState<{ count: number; model: string } | null>(null);
  const [synthErr, setSynthErr] = useState<string | null>(null);
  // v0.34.88 iter 22: auto-seed trophy-images progress toast
  const [seedingTrophy, setSeedingTrophy] = useState<{
    userId: string;
    copied: number;
    total: number;
    error?: string;
  } | null>(null);
  // v0.34.85 iter 19: textbook list 历史上传
  const [textbookHistory, setTextbookHistory] = useState<Array<{
    uploadId: string;
    filename?: string;
    subject?: string;
    grade?: string;
    sizeBytes?: number;
    uploadedAt?: number;
    status?: string;
    synthesizedCount?: number;
    synthesizedModel?: string;
  }> | null>(null);
  const [historyBusy, setHistoryBusy] = useState(false);

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

  // Ep41: fleet data-integrity (per-user table count matrix)
  interface IntegrityRow {
    userId: string;
    counts: Record<string, number>;
    snapshotBytes?: number;
    fetchedAt?: number;
    lastActivityMs?: number | null;
    alerts: string[];
    error?: string;
  }
  const [integrityData, setIntegrityData] = useState<{
    asOf: number;
    userCount: number;
    totalAlerts: number;
    requiredTables: string[];
    suspiciousTables: string[];
    users: IntegrityRow[];
  } | null>(null);
  const [integrityBusy, setIntegrityBusy] = useState(false);

  // Ep32: fallback proxy monitor 状态
  interface ProxyHit {
    path: string;
    count: number;
    lastTs: number;
    lastStatus: number;
    methods: Record<string, number>;
  }
  const [proxyStats, setProxyStats] = useState<{
    isolateStartedAt: number;
    totalHits: number;
    totalEndpoints: number;
    byPath: ProxyHit[];
    fetchedAt: number;
  } | null>(null);
  const [proxyBusy, setProxyBusy] = useState(false);

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

  /**
   * v0.34.90 iter 24: admin "test-as-student" — 拉同学密码 + copy 到剪贴板 +
   * 开新 tab 到学生子域. 演示前快速 QA 不用手动切账号 + 不记一堆密码.
   * 不重置密码 — 学生现有 session 不受影响.
   */
  async function testAsStudent(userId: string) {
    const pwd = getStoredPassword();
    if (!pwd) return;
    try {
      const r = await fetch(`/api/super-admin/users/${encodeURIComponent(userId)}/password`, {
        headers: { Authorization: `Bearer ${pwd}` },
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; password?: string; error?: string };
      if (!j.ok || !j.password) {
        alert(`Test as ${userId} failed: ${j.error ?? "no_password"}`);
        return;
      }
      try {
        await navigator.clipboard.writeText(j.password);
      } catch { /* clipboard write fail OK */ }
      // 开新 tab; admin paste 密码即可
      window.open(`https://${userId}.xiaojin.app/`, "_blank", "noopener");
      // toast 提示 (复用 hint 状态没有, 用 alert/title)
      console.log(`[test-as-student] password for ${userId} copied to clipboard, opening tab`);
      // 借用 cred result toast 暂时显示
      setCredResult({
        title: `🎭 Test as ${userId} — 密码已复制`,
        userId,
        password: j.password,
        loginUrl: `https://${userId}.xiaojin.app`,
        fallbackUrl: "https://xiaojin.app",
      });
      setCredCopied(true);
    } catch (e) {
      alert(`Test as ${userId} threw: ${(e as Error).message}`);
    }
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

  /** Ep41: 拉 fleet data-integrity matrix (跨 cadet 每表行数 + 0 行告警) */
  async function loadIntegrity() {
    const pwd = getStoredPassword();
    if (!pwd) return;
    setIntegrityBusy(true);
    try {
      const r = await fetch("/api/super-admin/data-integrity", {
        headers: { Authorization: `Bearer ${pwd}` },
      });
      const j = (await r.json().catch(() => null)) as
        | (typeof integrityData & { ok: boolean })
        | null;
      if (j?.ok) setIntegrityData(j as typeof integrityData);
    } finally {
      setIntegrityBusy(false);
    }
  }

  /** Ep32: 拉 EdgeRoutine 本 isolate 启动以来的 proxy-fallback 命中表 */
  async function loadProxyStats() {
    const pwd = getStoredPassword();
    if (!pwd) return;
    setProxyBusy(true);
    try {
      const r = await fetch("/api/super-admin/proxy-fallback-stats", {
        headers: { Authorization: `Bearer ${pwd}` },
      });
      const j = (await r.json().catch(() => null)) as
        | {
            ok: boolean;
            isolateStartedAt?: number;
            totalHits?: number;
            totalEndpoints?: number;
            byPath?: ProxyHit[];
          }
        | null;
      if (j?.ok) {
        setProxyStats({
          isolateStartedAt: j.isolateStartedAt ?? 0,
          totalHits: j.totalHits ?? 0,
          totalEndpoints: j.totalEndpoints ?? 0,
          byPath: j.byPath ?? [],
          fetchedAt: Date.now(),
        });
      }
    } finally {
      setProxyBusy(false);
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

  /**
   * Ep42: 一键下载某 cadet 的完整 snapshot.json
   * 走 fetch + Blob (因为 <a download> 不会带 Authorization header).
   */
  async function exportSnapshot(userId: string) {
    const pwd = getStoredPassword();
    if (!pwd) return;
    try {
      const r = await fetch(
        `/api/super-admin/users/${encodeURIComponent(userId)}/export`,
        { headers: { Authorization: `Bearer ${pwd}` } },
      );
      if (!r.ok) {
        const j = await r.json().catch(() => null);
        alert(`导出失败：${j?.error ?? r.status}`);
        return;
      }
      // Server sets Content-Disposition; honor filename if present
      let filename = `${userId}-snapshot.json`;
      const cd = r.headers.get("Content-Disposition") ?? "";
      const m = cd.match(/filename="([^"]+)"/);
      if (m) filename = m[1]!;
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      alert(`导出网络错：${(e as Error).message}`);
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
      // v0.34.88 iter 22: 自动种子 trophy-images 给新同学 (后台跑, 不阻塞 admin)
      // 之前要手动 `node scripts/_copy-trophy-images-to-cadet.mjs <userId>`, 现在
      // 在 enroll 成功后 client poll batched endpoint 直到 204 张全 copy 完.
      // 新同学打开 app 立即看到完整勋章柜.
      void autoSeedTrophyImages(j.userId);
    } catch (e) {
      setNewErr((e as Error).message);
    } finally {
      setNewBusy(false);
    }
  }

  /**
   * v0.34.88 iter 22: 新同学 enroll 后自动种子 204 张 trophy-images.
   * 客户端 poll seed-trophy-images batched endpoint (6 张/次, ~34 次), 直到 done=true.
   * 后台跑, 不阻塞 admin UI; 失败 silent (老 manual script 仍可用).
   * 进度 toast 显示 "🎨 种 trophy N/204" 给 admin 看.
   */
  async function autoSeedTrophyImages(userId: string) {
    const pwd = getStoredPassword();
    if (!pwd) return;
    setSeedingTrophy({ userId, copied: 0, total: 204 });
    let cursor = 0;
    let total = 204;
    let totalCopied = 0;
    try {
      while (true) {
        const r = await fetch(
          `/api/super-admin/users/${encodeURIComponent(userId)}/seed-trophy-images?cursor=${cursor}&batch=6`,
          { method: "POST", headers: { Authorization: `Bearer ${pwd}` } },
        );
        if (!r.ok) throw new Error(`http_${r.status}`);
        const j = (await r.json()) as {
          ok: boolean; nextCursor: number; total: number; copied: number; done: boolean;
        };
        if (!j.ok) throw new Error("seed_failed");
        cursor = j.nextCursor;
        total = j.total;
        totalCopied += j.copied;
        setSeedingTrophy({ userId, copied: totalCopied, total });
        if (j.done) break;
      }
      console.log(`[auto-seed] ${userId} trophy-images ${totalCopied}/${total} done`);
      window.setTimeout(() => setSeedingTrophy(null), 3000);
    } catch (e) {
      console.warn(`[auto-seed] ${userId} failed:`, (e as Error).message);
      setSeedingTrophy({ userId, copied: totalCopied, total, error: (e as Error).message });
      window.setTimeout(() => setSeedingTrophy(null), 5000);
    }
  }

  /** v0.34.85 iter 19: 拉某同学已上传课本历史 */
  async function loadTextbookHistory(userId: string) {
    if (!userId.trim()) { setTextbookHistory([]); return; }
    const pwd = getStoredPassword();
    if (!pwd) return;
    setHistoryBusy(true);
    try {
      const r = await fetch(`/api/super-admin/textbooks?userId=${encodeURIComponent(userId.trim())}`, {
        headers: { Authorization: `Bearer ${pwd}` },
      });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; textbooks?: Array<Record<string, unknown>> };
      if (j.ok && Array.isArray(j.textbooks)) {
        setTextbookHistory(j.textbooks as typeof textbookHistory);
      } else {
        setTextbookHistory([]);
      }
    } catch {
      setTextbookHistory([]);
    } finally {
      setHistoryBusy(false);
    }
  }

  /** v0.34.76 iter 10: 让 LLM 凭 subject+grade 出 5 道题入库 (演示权宜, 真 OCR iter 11+) */
  async function synthesizeQuestions() {
    if (!textbookResult) return;
    const pwd = getStoredPassword();
    if (!pwd) return;
    setSynthBusy(true);
    setSynthErr(null);
    try {
      const r = await fetch(
        `/api/super-admin/textbooks/${textbookResult.uploadId}/synthesize?targetUserId=${encodeURIComponent(textbookTargetUserId.trim())}`,
        { method: "POST", headers: { Authorization: `Bearer ${pwd}` } },
      );
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        detail?: string;
        synthesizedCount?: number;
        model?: string;
      };
      if (!j.ok) {
        setSynthErr(`生成失败: ${j.error ?? "unknown"} ${j.detail ?? ""}`);
        return;
      }
      setSynthResult({ count: j.synthesizedCount ?? 0, model: j.model ?? "?" });
    } catch (e) {
      setSynthErr((e as Error).message);
    } finally {
      setSynthBusy(false);
    }
  }

  /** v0.34.75 iter 9: 上传课本 PDF 到 OSS */
  async function submitTextbookUpload() {
    if (!textbookFile) { setTextbookErr("请先选 PDF 文件"); return; }
    if (!textbookTargetUserId.trim()) { setTextbookErr("请填目标同学 userId"); return; }
    if (textbookFile.size > 20 * 1024 * 1024) {
      setTextbookErr(`文件太大 (${(textbookFile.size / 1024 / 1024).toFixed(1)} MB), 上限 20 MB`);
      return;
    }
    const pwd = getStoredPassword();
    if (!pwd) return;
    setTextbookBusy(true);
    setTextbookErr(null);
    try {
      const form = new FormData();
      form.append("pdf", textbookFile);
      form.append("targetUserId", textbookTargetUserId.trim());
      form.append("subject", textbookSubject);
      form.append("grade", textbookGrade);
      const r = await fetch("/api/super-admin/textbooks/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${pwd}` },
        body: form,
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        detail?: string;
        uploadId?: string;
        sizeBytes?: number;
        estimatedParseMinutes?: number;
      };
      if (!j.ok || !j.uploadId) {
        setTextbookErr(`上传失败: ${j.error ?? "unknown"} ${j.detail ?? ""}`);
        return;
      }
      setTextbookResult({
        uploadId: j.uploadId,
        sizeBytes: j.sizeBytes ?? 0,
        estimatedParseMinutes: j.estimatedParseMinutes ?? 5,
      });
    } catch (e) {
      setTextbookErr((e as Error).message);
    } finally {
      setTextbookBusy(false);
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
      {/* v0.34.88 iter 22: 自动种 trophy-images 进度 toast (右上角, 不挡 UI) */}
      {seedingTrophy && (
        <div
          className="fixed top-4 right-4 z-[2000] bg-[#1a1c20] border border-violet-400/40 rounded-lg p-3 min-w-[260px] shadow-2xl"
          role="status"
          aria-live="polite"
        >
          <div className="text-[10px] font-mono uppercase tracking-wider text-violet-300 mb-1.5">
            {seedingTrophy.error ? "⚠ trophy seed failed" : "🎨 seeding trophy images"}
          </div>
          <div className="text-xs text-slate-300 mb-2 font-mono">
            <span className="text-white">{seedingTrophy.userId}</span> · {seedingTrophy.copied}/{seedingTrophy.total}
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={seedingTrophy.error
                ? "h-full bg-rose-500 transition-all"
                : "h-full bg-gradient-to-r from-violet-400 to-emerald-400 transition-all"}
              style={{ width: `${Math.round((seedingTrophy.copied / seedingTrophy.total) * 100)}%` }}
            />
          </div>
          {seedingTrophy.error && (
            <div className="text-[10px] text-rose-300 mt-1">{seedingTrophy.error}</div>
          )}
        </div>
      )}
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
          {/* v0.34.75 iter 9: 上传课本 PDF (5 年级 + 多年级支持基建) */}
          <button
            type="button"
            onClick={() => { setTextbookOpen(true); setTextbookErr(null); setTextbookResult(null); }}
            className="text-xs rounded-full border border-violet-400/40 hover:border-violet-300 text-violet-200 hover:bg-violet-500/10 px-4 py-2 font-medium transition-colors"
          >
            📚 Upload textbook PDF
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
          <summary className="cursor-pointer px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] hover:text-white select-none flex items-center gap-2 flex-wrap">
            <span>⟁ recent snapshots</span>
            <span className="text-[#363a3f]">·</span>
            <span className="text-[#7d8187]">
              {backupListBusy ? "loading…" : backupList ? `${backupList.length}` : "click to load"}
            </span>
            <span className="text-[#363a3f] ml-2">·</span>
            <span
              className="text-[#7d8187] normal-case tracking-normal"
              title="Retention 由 aliyun-deploy/scripts/_prune-backups.mjs 实施：keep last 14 days daily + 12 weeks weekly + 12 months monthly。run manually 或 cron 化"
            >
              retention 14d/12w/12m · prune via script
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

        {/* Ep32: fallback proxy monitor panel (lazy-load on expand) */}
        <details
          className="mb-4 rounded-lg bg-[#1a1c20] border border-[#212327]"
          onToggle={(e) => {
            if ((e.target as HTMLDetailsElement).open && !proxyStats && !proxyBusy) {
              void loadProxyStats();
            }
          }}
        >
          <summary className="cursor-pointer px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] hover:text-white select-none flex items-center gap-2 flex-wrap">
            <span>⟁ proxy fallback monitor</span>
            <span className="text-[#363a3f]">·</span>
            <span className="text-[#7d8187]">
              {proxyBusy
                ? "loading…"
                : proxyStats
                  ? `${proxyStats.totalHits} hits · ${proxyStats.totalEndpoints} paths`
                  : "click to load"}
            </span>
            <span className="text-[#363a3f] ml-2">·</span>
            <span className="text-[#7d8187] normal-case tracking-normal" title="本 EdgeRoutine isolate 启动以来命中老 CF Pages backend 的 path">
              cf-pages still serving these
            </span>
          </summary>
          <div className="px-4 pb-3 pt-1">
            <div className="text-[10px] text-amber-300/70 mb-2 leading-relaxed">
              ⚠ ESA isolates 1-2 min 寿命 + 多 isolate 池，counter 跨 request 大概率清零。
              这是 sampling 信号 —— refresh 几次抓到真有命中的 isolate 就代表那条 path 仍在被 client 用。
              空表 ≠ 没流量；多次 refresh 都空 → 可能真没人用了。
            </div>
            {/* Static list of paths configured to fall through to CF Pages */}
            <div className="mb-3">
              <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] mb-1.5">
                routes wired to fallback (from worker config)
              </div>
              <div className="space-y-1">
                {[
                  // Ep34 judge-questions native, Ep43 fix-question native → /api/agent/* 全部 native
                  // Ep36 generate/questions native
                  // 剩 2 条都是 async-required vision (Ep37 diagnostic 确证 ESA 11s 不能跑单 LLM call)
                  { path: "/api/tutor/voice", note: "tutor 语音判答 — 需 async vision pattern" },
                  { path: "/api/tutor/judge-handwriting", note: "tutor 手写判答 — 需 async vision pattern" },
                ].map((r) => (
                  <div
                    key={r.path}
                    className="flex items-center justify-between py-1 px-2 rounded-md bg-[#0a0a0a] border border-[#212327] text-[10px]"
                  >
                    <code className="font-mono text-[#a0c3ec]">{r.path}</code>
                    <span className="text-[#7d8187] truncate ml-2">{r.note}</span>
                  </div>
                ))}
              </div>
            </div>
            {proxyStats && proxyStats.byPath.length === 0 && (
              <div className="text-[11px] text-[#7d8187] py-2">
                ● 当前 isolate 0 fallback hits · isolate up {Math.round((Date.now() - proxyStats.isolateStartedAt) / 60000)} min · refresh 重抓
                <button
                  type="button"
                  onClick={loadProxyStats}
                  className="ml-2 underline hover:text-white"
                >
                  refresh
                </button>
              </div>
            )}
            {proxyStats && proxyStats.byPath.length > 0 && (
              <>
                <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] mb-2">
                  isolate up {Math.round((Date.now() - proxyStats.isolateStartedAt) / 60000)} min · fetched {Math.round((Date.now() - proxyStats.fetchedAt) / 1000)}s ago
                  <button
                    type="button"
                    onClick={loadProxyStats}
                    className="ml-2 underline hover:text-white"
                  >
                    refresh
                  </button>
                </div>
                <div className="space-y-1 max-h-[320px] overflow-y-auto">
                  {proxyStats.byPath.map((p) => {
                    const methodLabel = Object.entries(p.methods)
                      .map(([m, n]) => `${m}×${n}`)
                      .join(" ");
                    const isError = p.lastStatus >= 400;
                    const ageMin = Math.round((Date.now() - p.lastTs) / 60000);
                    return (
                      <div
                        key={p.path}
                        className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md bg-[#0a0a0a] border border-[#212327]"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <code className="font-mono text-[10px] text-white truncate">{p.path}</code>
                          <span className="font-mono text-[9px] uppercase tracking-wider text-[#7d8187] flex-shrink-0">
                            {methodLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className={`font-mono text-[9px] uppercase tracking-wider ${
                              isError ? "text-rose-400" : "text-[#a0c3ec]"
                            }`}
                          >
                            last {p.lastStatus} · {ageMin}m ago
                          </span>
                          <span className="font-mono text-[10px] tabular-nums text-[#ffc285] font-bold">
                            {p.count}×
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </details>

        {/* Ep41: fleet data integrity matrix (table count per cadet, 0-row 告警) */}
        <details
          className="mb-4 rounded-lg bg-[#1a1c20] border border-[#212327]"
          onToggle={(e) => {
            if ((e.target as HTMLDetailsElement).open && !integrityData && !integrityBusy) {
              void loadIntegrity();
            }
          }}
        >
          <summary className="cursor-pointer px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] hover:text-white select-none flex items-center gap-2 flex-wrap">
            <span>⟁ data integrity</span>
            <span className="text-[#363a3f]">·</span>
            <span className={integrityData && integrityData.totalAlerts > 0 ? "text-rose-400 font-bold" : "text-[#7d8187]"}>
              {integrityBusy
                ? "loading…"
                : integrityData
                  ? `${integrityData.totalAlerts} alert${integrityData.totalAlerts === 1 ? "" : "s"} across ${integrityData.userCount} cadets`
                  : "click to load"}
            </span>
            <span className="text-[#363a3f] ml-2">·</span>
            <span
              className="text-[#7d8187] normal-case tracking-normal"
              title="检查每个 cadet 的 stats.json 关键表行数. 大 snapshot 还出现 0 行 = 数据丢风险, 立即查"
            >
              prevent silent fluency/tutor data loss
            </span>
          </summary>
          <div className="px-4 pb-3 pt-1">
            {integrityData && integrityData.totalAlerts > 0 && (
              <div className="mb-2 text-[10px] font-mono uppercase tracking-wider text-rose-300 bg-rose-900/20 border border-rose-700/40 rounded p-2">
                ⚠ {integrityData.totalAlerts} 处告警 — 多见于 client 端 IDB 异常导致 push 上来表为空。
                受影响 cadet 应让她"立即推 OSS"前先 force-pull 一次合并历史。
              </div>
            )}
            {integrityData && integrityData.users.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] font-mono">
                  <thead>
                    <tr className="text-[#7d8187] uppercase tracking-wider">
                      <th className="text-left py-1.5 px-2">cadet</th>
                      {["attempts","mastery","mistakes","sessions","trophies","fluencyAttempts","tutorSessions"].map((t) => (
                        <th key={t} className="text-right py-1.5 px-2">{t}</th>
                      ))}
                      <th className="text-right py-1.5 px-2">bytes</th>
                      <th className="text-left py-1.5 px-2">alerts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {integrityData.users.map((u) => (
                      <tr key={u.userId} className="border-t border-[#212327]">
                        <td className="text-white uppercase py-1 px-2">{u.userId}</td>
                        {["attempts","mastery","mistakes","sessions","trophies","fluencyAttempts","tutorSessions"].map((t) => {
                          const v = u.counts[t] ?? 0;
                          const isReqZero = v === 0 && integrityData.requiredTables.includes(t) && (u.snapshotBytes ?? 0) > 50_000;
                          const isSusZero = v === 0 && integrityData.suspiciousTables.includes(t) && (u.snapshotBytes ?? 0) > 50_000;
                          const cls = isReqZero ? "text-rose-300 font-bold" : isSusZero ? "text-amber-300" : "text-[#dadbdf]";
                          return <td key={t} className={`text-right tabular-nums py-1 px-2 ${cls}`}>{v}</td>;
                        })}
                        <td className="text-right tabular-nums py-1 px-2 text-[#7d8187]">
                          {u.snapshotBytes ? `${(u.snapshotBytes/1024).toFixed(0)}K` : "—"}
                        </td>
                        <td className="py-1 px-2 text-rose-300 text-[9px]">
                          {u.alerts.slice(0,3).join(" · ")}
                          {u.alerts.length > 3 && ` +${u.alerts.length - 3}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-[9px] text-[#7d8187] mt-2">
                  asOf {new Date(integrityData.asOf).toLocaleTimeString("zh-CN")} · refresh
                  <button type="button" onClick={loadIntegrity} className="ml-1 underline hover:text-white">redo</button>
                </div>
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
                      {/* v0.34.90 iter 24: admin test-as-student 一键 */}
                      <button
                        type="button"
                        onClick={() => testAsStudent(u.userId)}
                        className="text-[10px] font-mono uppercase tracking-wider rounded-full border border-violet-400/40 hover:border-violet-300 text-violet-200 hover:text-white px-3 py-1 transition-colors"
                        title={`复制 ${u.userId} 密码 + 开新 tab 进她子域 (不重置, 学生 session 不变)`}
                      >
                        🎭 Test as
                      </button>
                      <button
                        type="button"
                        onClick={() => resetPassword(u.userId)}
                        className="text-[10px] font-mono uppercase tracking-wider rounded-full border border-[#ff7a17]/40 hover:border-[#ff7a17] text-[#ff7a17] hover:text-[#ffc285] px-3 py-1 transition-colors"
                      >
                        Reset PW
                      </button>
                      {/* Ep42: per-cadet 一键 snapshot 下载存档（爸爸本地保险） */}
                      {u.snapshot?.present && (
                        <button
                          type="button"
                          onClick={() => exportSnapshot(u.userId)}
                          className="text-[10px] font-mono uppercase tracking-wider rounded-full border border-[#7c3aed]/40 hover:border-[#c4b5fd] text-[#c4b5fd] hover:text-white px-3 py-1 transition-colors"
                          title={`下载 ${u.userId} 完整 snapshot.json (${u.snapshot.bytes ? ((u.snapshot.bytes/1024).toFixed(0)+'K') : '?'})`}
                        >
                          ⤓ Export
                        </button>
                      )}
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

      {/* v0.34.75 iter 9: 上传课本 PDF modal */}
      {textbookOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[1000] bg-black/80 flex items-center justify-center p-4"
          style={{ backdropFilter: "blur(6px)" }}
        >
          <div className="max-w-md w-full bg-[#1a1c20] border border-[#212327] rounded-xl p-6">
            <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#7d8187] mb-1">
              textbook ingest
            </div>
            <div className="font-display text-xl font-medium tracking-tight text-white mb-4">
              📚 Upload textbook PDF
            </div>
            {!textbookResult ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-[#7d8187] mb-1 block">
                    target user id <span className="text-[#ff7a17]">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={textbookTargetUserId}
                      onChange={(e) => setTextbookTargetUserId(e.target.value.toLowerCase())}
                      placeholder="democlass5"
                      className="flex-1 px-3 py-2 rounded-md bg-[#0a0a0a] border border-[#212327] focus:border-violet-400 focus:outline-none text-white text-sm font-mono"
                      maxLength={64}
                    />
                    {/* v0.34.85 iter 19: 看该同学历史上传 */}
                    <button
                      type="button"
                      onClick={() => void loadTextbookHistory(textbookTargetUserId)}
                      disabled={historyBusy || !textbookTargetUserId.trim()}
                      className="text-xs px-3 py-2 rounded-md border border-violet-400/40 text-violet-200 hover:bg-violet-500/10 disabled:opacity-30 whitespace-nowrap"
                      title="查这位同学已上传过的课本"
                    >
                      {historyBusy ? "..." : "📜 History"}
                    </button>
                  </div>
                </div>
                {textbookHistory && (
                  <div className="bg-[#0a0a0a] border border-[#212327] rounded-md p-2 max-h-48 overflow-y-auto">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#7d8187] mb-1.5">
                      {textbookHistory.length === 0
                        ? "no previous uploads"
                        : `${textbookHistory.length} previous upload${textbookHistory.length === 1 ? "" : "s"}`}
                    </div>
                    {textbookHistory.map((tb) => (
                      <div key={tb.uploadId} className="text-[11px] py-1 border-b border-[#212327] last:border-b-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-slate-300 truncate">
                            {tb.filename ?? tb.uploadId.slice(0, 14)}
                          </span>
                          <span className={
                            tb.status === "synthesized"
                              ? "text-emerald-300 text-[10px]"
                              : "text-amber-300 text-[10px]"
                          }>
                            {tb.status === "synthesized"
                              ? `✓ ${tb.synthesizedCount ?? "?"} 题`
                              : "⏳ pending"}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {tb.subject === "math" ? "数学" : tb.subject === "chinese" ? "语文" : "英语"} · G{tb.grade ?? "?"} ·
                          {tb.sizeBytes ? ` ${(tb.sizeBytes / 1024).toFixed(0)} KB · ` : " "}
                          {tb.uploadedAt ? new Date(tb.uploadedAt).toLocaleString("zh-CN", { hour12: false, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                          {tb.synthesizedModel ? ` · ${tb.synthesizedModel}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-[#7d8187] mb-1 block">
                      subject
                    </label>
                    <select
                      value={textbookSubject}
                      onChange={(e) => setTextbookSubject(e.target.value as typeof textbookSubject)}
                      className="w-full px-3 py-2 rounded-md bg-[#0a0a0a] border border-[#212327] text-white text-sm"
                    >
                      <option value="math">数学 math</option>
                      <option value="chinese">语文 chinese</option>
                      <option value="english">英语 english</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase tracking-wider text-[#7d8187] mb-1 block">
                      grade
                    </label>
                    <select
                      value={textbookGrade}
                      onChange={(e) => setTextbookGrade(e.target.value as typeof textbookGrade)}
                      className="w-full px-3 py-2 rounded-md bg-[#0a0a0a] border border-[#212327] text-white text-sm"
                    >
                      {(["1", "2", "3", "4", "5", "6"] as const).map((g) => (
                        <option key={g} value={g}>{g} 年级</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-[#7d8187] mb-1 block">
                    PDF file <span className="text-[#ff7a17]">*</span> <span className="text-[#7d8187] normal-case">(≤20MB)</span>
                  </label>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setTextbookFile(e.target.files?.[0] ?? null)}
                    className="w-full text-xs text-slate-300 file:mr-2 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-violet-500 file:text-white hover:file:bg-violet-400"
                  />
                  {textbookFile && (
                    <div className="text-[10px] text-slate-400 mt-1">
                      {textbookFile.name} · {(textbookFile.size / 1024).toFixed(1)} KB
                    </div>
                  )}
                </div>
                {textbookErr && (
                  <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400">⚠ {textbookErr}</div>
                )}
                <div className="text-[10px] text-[#7d8187] leading-relaxed">
                  上传后 OSS 存 <code className="text-[#dadbdf]">users/&lt;userId&gt;/textbooks/&lt;uploadId&gt;.pdf</code>。
                  Iter 10 加 OCR + parse, iter 11 把题入到学生的 ai-questions/。
                  当前先存下来给 iter 10 用。
                </div>
                <div className="flex gap-2 justify-end mt-2">
                  <button
                    type="button"
                    onClick={() => setTextbookOpen(false)}
                    disabled={textbookBusy}
                    className="text-xs rounded-full border border-white/30 hover:border-white text-white px-4 py-2 font-medium disabled:opacity-30"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitTextbookUpload}
                    disabled={textbookBusy || !textbookFile || !textbookTargetUserId.trim()}
                    className="text-xs rounded-full bg-violet-500 hover:bg-violet-400 text-white px-4 py-2 font-medium disabled:opacity-30"
                  >
                    {textbookBusy ? `Uploading… (${textbookFile ? (textbookFile.size / 1024 / 1024).toFixed(1) : "?"} MB)` : "Upload"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-emerald-300 text-3xl text-center mb-2">✓ 上传成功</div>
                <div className="text-xs text-slate-300 space-y-1.5 bg-emerald-500/10 border border-emerald-400/30 rounded p-3">
                  <div>📁 <span className="font-mono">{textbookResult.uploadId}</span></div>
                  <div>📊 {(textbookResult.sizeBytes / 1024).toFixed(1)} KB</div>
                </div>
                {!synthResult ? (
                  <>
                    <div className="text-[11px] text-slate-300 leading-relaxed bg-violet-500/10 border border-violet-400/30 rounded p-3">
                      <strong className="text-violet-200">🪄 立即生成 5 道 grade-{textbookGrade} 题 (演示用):</strong>
                      <br />
                      AI 按 {textbookSubject === "math" ? "数学" : textbookSubject === "chinese" ? "语文" : "英语"} + {textbookGrade} 年级标准凭空出 5 道题, 写到 <code>{textbookTargetUserId}</code> 的 ai-questions OSS.
                      学生下次 sync (~30s) 就看到。<strong className="text-amber-200">⚠ 不读 PDF 内容</strong>,
                      真 OCR 是后续 FC 函数路径 (iter 11+).
                    </div>
                    {synthErr && (
                      <div className="text-[11px] font-mono uppercase tracking-wider text-rose-400">⚠ {synthErr}</div>
                    )}
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => { setTextbookOpen(false); setTextbookFile(null); setTextbookResult(null); setSynthResult(null); }}
                        className="text-xs rounded-full border border-white/30 hover:border-white text-white px-4 py-2 font-medium"
                      >
                        Close (skip synthesis)
                      </button>
                      <button
                        type="button"
                        onClick={synthesizeQuestions}
                        disabled={synthBusy}
                        className="text-xs rounded-full bg-violet-500 hover:bg-violet-400 text-white px-4 py-2 font-medium disabled:opacity-30"
                      >
                        {synthBusy ? "AI 生成中… ~8s" : "🪄 Generate 5 sample questions"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-violet-300 text-2xl text-center">🪄 已生成 {synthResult.count} 道题</div>
                    <div className="text-[11px] text-slate-400 text-center">
                      via {synthResult.model} · 写到 <code className="text-slate-200">{textbookTargetUserId}</code> 的 ai-questions/<br />
                      学生 30 秒内 cloudSync pull 就能在 train 里看到 grade-{textbookGrade} 题
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => { setTextbookOpen(false); setTextbookFile(null); setTextbookResult(null); setSynthResult(null); }}
                        className="text-xs rounded-full bg-emerald-500 hover:bg-emerald-400 text-[#0a0a0a] px-4 py-2 font-medium"
                      >
                        完成
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
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
