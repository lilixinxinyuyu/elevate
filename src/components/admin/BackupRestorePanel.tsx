/**
 * v0.34.6 (Ep137): 数据备份 / 恢复 + 云端状态面板
 *
 * 功能：
 *   1. 📥 导出全部本地 IDB → 下载 selena-backup-<ts>.json
 *   2. 📤 导入 JSON → bulkPut IDB → 自动 push OSS → 验证
 *   3. ☁️ 云端状态：bucket / snapshotKey / 上次推送 / 上次拉取 / 大小 / etag
 *   4. ↻ 立即推送到 OSS（debug + 紧急同步）
 *   5. ↻ 从 OSS 重新拉取（force pull，覆盖本地）
 *
 * 多用户场景：每个用户的密码 → OSS path `users/{userId}/snapshot.json`，
 * 云端状态显示具体 userId 让爸爸确认推到正确账号上。
 */

import { useEffect, useState } from "react";
import { db } from "../../db/dexie";
import {
  schedulePushToCloud,
  flushPushNow,
  pullFromCloud,
  getStoredPassword,
  getSyncState,
  subscribeSyncState,
  type SyncState,
} from "../../db/cloudSync";

/**
 * v0.34.9 (Ep139): 全表导出 — 含 units/skills/mascotWardrobe.
 * 跟 src/db/dexie.ts schema 完全一致（15 个表）。
 */
const BACKUP_TABLES = [
  "attempts",
  "mastery",
  "mistakes",
  "sessions",
  "trophies",
  "meta",
  "students",
  "units",
  "skills",
  "tutorSessions",
  "fluencyAttempts",
  "fluencyStats",
  "questions",
  "trophyImages",
  "mascotWardrobe",
] as const;

type BackupTable = (typeof BACKUP_TABLES)[number];

interface BackupFile {
  version: number;
  exportedAt: number;
  appVersion?: string;
  tableCounts: Record<string, number>;
  data: Record<string, unknown[]>;
}

/**
 * 把任意 backup 格式归一化成 { data, version, exportedAt }。
 *
 * 历史上有两套 backup shape：
 *   1. **嵌套**（BackupRestorePanel handleExport）：
 *      { version, exportedAt, appVersion, tableCounts, data: { attempts, mastery, ... } }
 *   2. **扁平**（Admin.tsx handleExport，老版"heping-backup-*.json"）：
 *      { version, exportedAt, students, questions, sessions, attempts, mastery,
 *        mistakes, trophies }
 *
 * 都要能 import。否则 Selena 的老备份导不回来。
 */
function normalizeBackup(raw: unknown): {
  data: Record<string, unknown[]>;
  version: number;
  exportedAt: number | string | undefined;
  format: "nested" | "flat";
} {
  if (!raw || typeof raw !== "object") {
    throw new Error("不是 JSON 对象");
  }
  const r = raw as Record<string, unknown>;
  // 嵌套
  if (r.data && typeof r.data === "object" && !Array.isArray(r.data)) {
    return {
      data: r.data as Record<string, unknown[]>,
      version: (r.version as number) ?? 1,
      exportedAt: r.exportedAt as number | string | undefined,
      format: "nested",
    };
  }
  // 扁平：从顶层抽出已知表名的数组
  const data: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) {
    const v = r[t];
    if (Array.isArray(v)) data[t] = v as unknown[];
  }
  if (Object.keys(data).length === 0) {
    throw new Error(
      "不是有效的 backup 文件 —— 既找不到 data 字段，也找不到任何已知的表（attempts/mastery/sessions 等）顶层数组",
    );
  }
  return {
    data,
    version: (r.version as number) ?? 1,
    exportedAt: r.exportedAt as number | string | undefined,
    format: "flat",
  };
}

interface CloudCheck {
  ok: boolean;
  userId?: string;
  snapshotKey?: string;
  bucket?: string;
  region?: string;
  headResult?: {
    status: number;
    ok: boolean;
    lastModifiedMs?: number;
    etag?: string;
    error?: string;
  };
  error?: string;
}

async function fetchCloudCheck(): Promise<CloudCheck | null> {
  try {
    const pwd = getStoredPassword();
    if (!pwd) return null;
    const r = await fetch("/api/sync/check", {
      headers: { Authorization: `Bearer ${pwd}` },
    });
    if (!r.ok && r.status !== 503) return null;
    return (await r.json()) as CloudCheck;
  } catch {
    return null;
  }
}

function fmtTs(ms?: number | null): string {
  if (!ms || ms <= 0) return "—";
  const d = new Date(ms);
  const now = Date.now();
  const diff = now - ms;
  let rel: string;
  if (diff < 60_000) rel = "刚刚";
  else if (diff < 3600_000) rel = `${Math.floor(diff / 60_000)}分钟前`;
  else if (diff < 86400_000) rel = `${Math.floor(diff / 3600_000)}小时前`;
  else rel = `${Math.floor(diff / 86400_000)}天前`;
  return `${d.toLocaleString()} · ${rel}`;
}

export function BackupRestorePanel() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<Record<string, number> | null>(null);
  const [cloudCheck, setCloudCheck] = useState<CloudCheck | null>(null);
  const [syncState, setSyncState] = useState<SyncState>(getSyncState());

  useEffect(() => {
    const off = subscribeSyncState((s) => setSyncState(s));
    return () => off();
  }, []);

  useEffect(() => {
    void refreshCloudCheck();
    const t = window.setInterval(() => void refreshCloudCheck(), 30_000);
    return () => window.clearInterval(t);
  }, []);

  async function refreshCloudCheck() {
    const c = await fetchCloudCheck();
    setCloudCheck(c);
  }

  async function handleExport() {
    setBusy(true);
    setStatus("📥 正在 dump 所有表…");
    try {
      const data: Record<string, unknown[]> = {};
      const tableCounts: Record<string, number> = {};
      for (const t of BACKUP_TABLES) {
        try {
          const rows = await (db as unknown as Record<BackupTable, { toArray(): Promise<unknown[]> }>)[t].toArray();
          data[t] = rows;
          tableCounts[t] = rows.length;
        } catch (e) {
          data[t] = [];
          tableCounts[t] = 0;
          console.warn(`[backup] table ${t} dump failed:`, e);
        }
      }
      const backup: BackupFile = {
        version: 1,
        exportedAt: Date.now(),
        appVersion:
          (typeof window !== "undefined" &&
            (window as unknown as { __APP_VERSION__?: string }).__APP_VERSION__) ||
          undefined,
        tableCounts,
        data,
      };
      const json = JSON.stringify(backup, null, 0);
      const totalBytes = json.length;
      const totalRows = Object.values(tableCounts).reduce((a, b) => a + b, 0);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.href = url;
      a.download = `selena-backup-${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(
        `✅ 导出完成 · ${totalRows} 条 · ${(totalBytes / 1024).toFixed(0)}KB · 已下载`,
      );
    } catch (e) {
      setStatus(`❌ 导出失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: File) {
    if (
      !confirm(
        `确认导入备份？\n\n` +
          `文件：${file.name} (${(file.size / 1024).toFixed(0)}KB)\n\n` +
          `导入会 union-merge（按 id 合并，新数据补充进本地，不会删现有数据）。\n` +
          `导入后自动 push 到云端 + 验证 OSS。`,
      )
    ) {
      return;
    }
    setBusy(true);
    setStatus("📤 正在读 + 解析…");
    setImportStats(null);
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const backup = normalizeBackup(raw);
      setStatus(
        `📤 解析成功（${backup.format} 格式）→ 写回 IDB（union-merge）…`,
      );
      const imported: Record<string, number> = {};
      let totalRows = 0;
      for (const t of BACKUP_TABLES) {
        const rows = (backup.data[t] as unknown[] | undefined) ?? [];
        if (rows.length === 0) {
          imported[t] = 0;
          continue;
        }
        try {
          const table = (
            db as unknown as Record<
              BackupTable,
              { bulkPut(items: unknown[]): Promise<unknown> }
            >
          )[t];
          await table.bulkPut(rows);
          imported[t] = rows.length;
          totalRows += rows.length;
        } catch (e) {
          console.error(`[backup] import ${t} failed:`, e);
          imported[t] = -1;
        }
      }
      setImportStats(imported);
      setStatus(`📤 IDB 写完 ${totalRows} 条，触发 OSS push…`);
      schedulePushToCloud(100);
      window.setTimeout(() => flushPushNow(), 500);
      // 等 push 完成 + 验证
      await new Promise((r) => setTimeout(r, 3000));
      await refreshCloudCheck();
      const c = await fetchCloudCheck();
      const verified = c?.headResult?.ok ?? false;
      setStatus(
        verified
          ? `✅ 导入 + 上传 OSS 验证通过 · userId=${c?.userId ?? "?"} · etag=${c?.headResult?.etag?.slice(1, 9) ?? "?"}`
          : `⚠️ 导入完成但 OSS 验证失败：${c?.headResult?.error ?? "未知"} · 请用 ↻ 重推`,
      );
    } catch (e) {
      setStatus(`❌ 导入失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleForcePush() {
    setBusy(true);
    setStatus("☁️ 强制推 IDB 到 OSS…");
    try {
      flushPushNow();
      await new Promise((r) => setTimeout(r, 2500));
      await refreshCloudCheck();
      const c = await fetchCloudCheck();
      setStatus(
        c?.headResult?.ok
          ? `✅ 推送完成 · etag=${c.headResult.etag?.slice(1, 9) ?? "?"} · ${fmtTs(c.headResult.lastModifiedMs)}`
          : `⚠️ 推送后 OSS HEAD 失败：${c?.headResult?.error ?? "未知"}`,
      );
    } catch (e) {
      setStatus(`❌ 推送失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleForcePull() {
    if (
      !confirm(
        "确认从 OSS 强制拉取？\n\n会用云端版本覆盖本地未推的变更（union-merge）。",
      )
    ) {
      return;
    }
    setBusy(true);
    setStatus("☁️ 从 OSS 强制拉取…");
    try {
      const r = await pullFromCloud({ force: true });
      setStatus(
        r.changed
          ? `✅ 拉取完成 · 有变更 · version=${r.version ?? "?"}`
          : `✓ 拉取完成 · 跟本地一致 · 无变更`,
      );
      await refreshCloudCheck();
    } catch (e) {
      setStatus(`❌ 拉取失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const head = cloudCheck?.headResult;
  const cloudReady = cloudCheck?.ok === true;

  return (
    <div className="card-glow p-4 mb-4 border-amber-400/40 bg-amber-500/5">
      <div className="font-display font-bold text-amber-200 mb-1">
        🛟 数据备份 / 恢复 + 云端状态
      </div>
      <div className="text-xs text-slate-300 mb-3">
        换设备 / 升级 / 故障应急。备份包含 attempts / mastery / mistakes / sessions /
        trophies / tutor / fluency / questions / 勋章图等所有本地表。
      </div>

      {/* 云端状态 */}
      <div className="rounded bg-slate-900/50 px-3 py-2 mb-3 text-xs font-mono space-y-0.5">
        <div className="flex items-center gap-2 mb-1">
          <span className={cloudReady ? "text-emerald-300" : "text-rose-300"}>
            {cloudReady ? "☁️ ✓" : "☁️ ✗"}
          </span>
          <span className="text-slate-200">OSS 云端状态</span>
          <button
            type="button"
            onClick={() => void refreshCloudCheck()}
            disabled={busy}
            className="ml-auto text-[10px] px-2 py-0.5 rounded bg-slate-700/60 hover:bg-slate-600/60 disabled:opacity-40"
          >
            ↻ 刷新
          </button>
        </div>
        {cloudCheck ? (
          <>
            <div>
              <span className="text-slate-400">userId:</span>{" "}
              <span className="text-amber-200">{cloudCheck.userId ?? "?"}</span>
            </div>
            <div>
              <span className="text-slate-400">snapshot:</span>{" "}
              <span className="text-slate-300">{cloudCheck.snapshotKey ?? "?"}</span>
            </div>
            <div>
              <span className="text-slate-400">bucket:</span>{" "}
              <span className="text-slate-300">
                {cloudCheck.bucket ?? "?"} ({cloudCheck.region ?? "?"})
              </span>
            </div>
            <div>
              <span className="text-slate-400">上次修改:</span>{" "}
              <span className="text-slate-300">{fmtTs(head?.lastModifiedMs)}</span>
            </div>
            <div>
              <span className="text-slate-400">etag:</span>{" "}
              <span className="text-slate-300">
                {head?.etag?.slice(1, 9) ?? "—"}
              </span>
              {head?.status === 404 && (
                <span className="text-amber-400 ml-2">(还没推过数据)</span>
              )}
            </div>
            <div className="pt-1 text-slate-400">
              本地：上次推 {fmtTs(syncState.lastPushAt)} · 上次拉{" "}
              {fmtTs(syncState.lastPullAt)}
              {syncState.pushing && (
                <span className="text-amber-300 ml-1">· 推送中…</span>
              )}
              {syncState.pulling && (
                <span className="text-amber-300 ml-1">· 拉取中…</span>
              )}
              {syncState.lastError && (
                <span className="text-rose-300 ml-1">· {syncState.lastError}</span>
              )}
            </div>
          </>
        ) : (
          <div className="text-slate-400">检测中…（或未登录）</div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleExport}
          disabled={busy}
          className="btn-primary text-sm px-3 py-2 disabled:opacity-40"
        >
          📥 导出全部数据
        </button>
        <label
          className={`btn-primary text-sm px-3 py-2 cursor-pointer ${
            busy ? "opacity-40 pointer-events-none" : ""
          }`}
        >
          📤 导入备份
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImport(f);
              e.target.value = "";
            }}
            className="hidden"
          />
        </label>
        <button
          type="button"
          onClick={handleForcePush}
          disabled={busy}
          className="btn-secondary text-sm px-3 py-2 disabled:opacity-40"
        >
          ↻ 立即推 OSS
        </button>
        <button
          type="button"
          onClick={handleForcePull}
          disabled={busy}
          className="btn-secondary text-sm px-3 py-2 disabled:opacity-40"
        >
          ↻ 从 OSS 拉
        </button>
      </div>

      {status && (
        <div
          className={`mt-3 text-xs ${
            status.startsWith("❌")
              ? "text-rose-300"
              : status.startsWith("⚠️")
                ? "text-amber-300"
                : "text-emerald-200"
          }`}
        >
          {status}
        </div>
      )}

      {importStats && (
        <div className="mt-2 text-xs text-slate-300 font-mono">
          <div className="font-bold mb-1">导入统计：</div>
          {Object.entries(importStats).map(([t, n]) => (
            <div key={t}>
              {n < 0 ? "❌" : n === 0 ? "—" : "✓"} {t}: {n < 0 ? "failed" : n}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
