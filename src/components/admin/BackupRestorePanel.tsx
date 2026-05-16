/**
 * v0.33.59 (Ep132): 数据备份 / 恢复 — 安全网
 *
 * 用户在迁移阿里云期间随时可：
 *   1. 📥 导出全部本地 IDB → 下载 selena-backup-<timestamp>.json
 *   2. 📤 选 JSON 文件 → 写回 IDB + 触发 cloud push
 *
 * 也作为"换设备"应急路径：旧设备导出 → U 盘 → 新设备导入。
 *
 * 表覆盖（跟 cloudSync.PUSH_TABLES 完全一致 + questions/trophyImages 也带）。
 */

import { useState } from "react";
import { db } from "../../db/dexie";
import { schedulePushToCloud, flushPushNow } from "../../db/cloudSync";

const BACKUP_TABLES = [
  "attempts",
  "mastery",
  "mistakes",
  "sessions",
  "trophies",
  "meta",
  "students",
  "tutorSessions",
  "fluencyAttempts",
  "fluencyStats",
  "questions",
  "trophyImages",
] as const;

type BackupTable = (typeof BACKUP_TABLES)[number];

interface BackupFile {
  version: number;
  exportedAt: number;
  appVersion?: string;
  tableCounts: Record<string, number>;
  data: Record<string, unknown[]>;
}

export function BackupRestorePanel() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [importStats, setImportStats] = useState<Record<string, number> | null>(null);

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
          // 表不存在 / 没数据 → 留空
          data[t] = [];
          tableCounts[t] = 0;
          console.warn(`[backup] table ${t} dump failed:`, e);
        }
      }
      const backup: BackupFile = {
        version: 1,
        exportedAt: Date.now(),
        appVersion: (typeof window !== "undefined" && (window as unknown as { __APP_VERSION__?: string }).__APP_VERSION__) || undefined,
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
        `✅ 导出完成 · ${totalRows} 条记录 · ${(totalBytes / 1024).toFixed(0)}KB · 已下载`,
      );
    } catch (e) {
      setStatus(`❌ 导出失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: File) {
    if (!confirm(
      `确认导入备份？\n\n` +
      `文件：${file.name} (${(file.size / 1024).toFixed(0)}KB)\n\n` +
      `导入会 union-merge（按 id 合并，新数据补充进本地，不会删现有数据）。\n` +
      `导入后自动 push 到云端。`
    )) {
      return;
    }
    setBusy(true);
    setStatus("📤 正在读 + 解析…");
    setImportStats(null);
    try {
      const text = await file.text();
      const backup = JSON.parse(text) as BackupFile;
      if (!backup || typeof backup !== "object" || !backup.data) {
        throw new Error("不是有效的 backup 文件（缺 data 字段）");
      }
      setStatus("📤 正在写回 IDB（union-merge）…");
      const imported: Record<string, number> = {};
      for (const t of BACKUP_TABLES) {
        const rows = (backup.data[t] as unknown[] | undefined) ?? [];
        if (rows.length === 0) {
          imported[t] = 0;
          continue;
        }
        try {
          const table = (db as unknown as Record<BackupTable, {
            bulkPut(items: unknown[]): Promise<unknown>;
          }>)[t];
          // bulkPut = union-merge by primary key（已有的 update，新的 insert）
          await table.bulkPut(rows);
          imported[t] = rows.length;
        } catch (e) {
          console.error(`[backup] import ${t} failed:`, e);
          imported[t] = -1;
        }
      }
      setImportStats(imported);
      setStatus("📤 触发 cloud push…");
      // 立刻推到云端
      schedulePushToCloud(100);
      window.setTimeout(() => flushPushNow(), 500);
      setStatus("✅ 导入完成 → 已触发云端同步");
    } catch (e) {
      setStatus(`❌ 导入失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-glow p-4 mb-4 border-amber-400/40 bg-amber-500/5">
      <div className="font-display font-bold text-amber-200 mb-1">
        🛟 数据备份 / 恢复
      </div>
      <div className="text-xs text-slate-300 mb-3">
        换设备 / 升级 / 故障应急用。备份包含所有本地数据（attempts /
        mastery / mistakes / sessions / trophies / tutor / fluency / questions
        / 勋章图等）。
      </div>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleExport}
          disabled={busy}
          className="btn-primary text-sm px-3 py-2 disabled:opacity-40"
        >
          📥 导出全部数据
        </button>
        <label className="btn-primary text-sm px-3 py-2 cursor-pointer disabled:opacity-40">
          📤 导入备份
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImport(f);
              e.target.value = ""; // 让相同文件能重选
            }}
            className="hidden"
          />
        </label>
      </div>
      {status && (
        <div
          className={`mt-3 text-xs ${
            status.startsWith("❌") ? "text-rose-300" : "text-emerald-200"
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
