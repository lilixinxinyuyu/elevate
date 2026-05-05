/**
 * 管理面板：批量生成所有勋章 AI 图。
 *
 * 行为：
 *  - 列出所有 trophy（math + chinese）+ 它们的当前缓存状态（有图 / 无图）
 *  - "生成所有缺失的图" 按钮 — 串行跑，30+ 张，每张 15-25 秒
 *  - 进度条 + 当前正在生成的 trophy 名
 *  - 单张操作：重新生成 / 清空缓存
 *  - 已生成的图缩略预览
 */

import { useState } from "react";
import { db } from "../db/dexie";
import {
  clearAllTrophyImages,
  ensureTrophyImage,
  generateAllMissingTrophyImages,
  useAllTrophyImages,
} from "../lib/trophyImages";
import { getAllTrophyMeta } from "../lib/allTrophies";
import { regenerateMascot } from "../lib/mascot";
import { MascotAvatar } from "./MascotAvatar";

export function TrophyImagesAdminPanel() {
  const allTrophies = getAllTrophyMeta();
  const cached = useAllTrophyImages();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
    currentName: string;
    log: string[];
  } | null>(null);
  const [filter, setFilter] = useState<"all" | "missing" | "math" | "chinese">("missing");

  // v0.30.14: 之前直接用 cached.size 当 "已生成数" → 当 trophyImages 里有
  // orphan row（旧 trophy 改名/删除留下来的）时，cachedCount > allTrophies.length，
  // missing 算成负数（label "缺 −40"）。改成只算注册过的 trophy。
  const allTrophyIds = new Set(allTrophies.map((t) => t.id));
  const cachedRegisteredCount = Array.from(cached.keys()).filter((id) => allTrophyIds.has(id)).length;
  const orphanCachedCount = cached.size - cachedRegisteredCount;
  const cachedCount = cachedRegisteredCount;
  const missingCount = Math.max(0, allTrophies.length - cachedCount);

  const filtered = allTrophies.filter((t) => {
    if (filter === "missing") return !cached.has(t.id);
    if (filter === "math") return t.subjectId === "math";
    if (filter === "chinese") return t.subjectId === "chinese";
    return true;
  });

  const onGenerateAll = async () => {
    if (
      !window.confirm(
        `将为 ${missingCount} 个缺失的勋章生成 AI 图，预计 ${
          missingCount * 20
        } 秒。继续？`,
      )
    )
      return;
    setBusy(true);
    setProgress({ done: 0, total: allTrophies.length, currentName: "", log: [] });
    try {
      const r = await generateAllMissingTrophyImages(
        allTrophies,
        (done, total, name, status, error) => {
          setProgress((prev) => {
            if (!prev) return null;
            const log = [...prev.log];
            if (status === "done") log.push(`✓ ${name}`);
            else if (status === "skipped") log.push(`⤵ ${name}（已有缓存）`);
            else if (status === "failed") log.push(`✗ ${name}: ${error ?? ""}`);
            return { done, total, currentName: name, log: log.slice(-15) };
          });
        },
      );
      window.alert(
        `完成！新生成 ${r.generated}，跳过 ${r.skipped}，失败 ${r.failed}`,
      );
    } catch (e) {
      window.alert("生成失败：" + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const onClearAll = async () => {
    if (!window.confirm(`确定清空全部 ${cachedCount} 张勋章图缓存？`)) return;
    const n = await clearAllTrophyImages();
    window.alert(`已清空 ${n} 张缓存`);
  };

  const onRegenOne = async (t: ReturnType<typeof getAllTrophyMeta>[number]) => {
    setBusy(true);
    try {
      await ensureTrophyImage(t, { force: true });
    } catch (e) {
      window.alert("失败：" + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const onDeleteOne = async (id: string) => {
    await db.trophyImages.delete(id);
  };

  return (
    <div className="text-sm space-y-3">
      {/* 小进吉祥物专区 */}
      <div className="rounded-lg border border-violet-400/40 bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 p-3 flex items-center gap-3">
        <MascotAvatar size="lg" autoEnsure glow />
        <div className="flex-1 min-w-0">
          <div className="text-violet-100 font-bold">小进 · 你的 AI 学习伙伴</div>
          <div className="text-[11px] text-slate-300 leading-relaxed">
            出现在 BgGen 提示条 / 盲盒生成 / Tutor 面板 / AutoGen 卡片。<br />
            如果不喜欢现在的样子，可以重抽。
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          className="btn-ghost text-xs border border-violet-400/40 text-violet-200"
          onClick={async () => {
            setBusy(true);
            try {
              await regenerateMascot();
            } catch (e) {
              window.alert("失败：" + (e instanceof Error ? e.message : String(e)));
            } finally {
              setBusy(false);
            }
          }}
        >
          🔁 重抽
        </button>
      </div>

      <div className="text-xs text-slate-400 leading-relaxed">
        用 wan2.7-image-pro 给每个勋章生成专属卡通图（替换 emoji）。已生成{" "}
        <span className="text-emerald-300">{cachedCount}</span> / {allTrophies.length}
        {missingCount > 0 ? (
          <>，缺 <span className="text-amber-300">{missingCount}</span></>
        ) : (
          <span className="text-emerald-300"> · 全部齐了</span>
        )}
        {orphanCachedCount > 0 && (
          <>
            {" "}· 另有 <span className="text-slate-300">{orphanCachedCount}</span> 张孤儿缓存（旧勋章 ID）
          </>
        )}
        。每张 ~20 秒。<br />
        Round 6 改进：512×512 + sticker 风格 + 圆形遮罩 + 段位勋章 + 彻底禁文字
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onGenerateAll}
          disabled={busy || missingCount === 0}
          className="btn-primary text-sm"
        >
          {busy
            ? "生成中…"
            : missingCount === 0
              ? "✓ 已全部生成"
              : `🎨 一键生成 ${missingCount} 张缺失`}
        </button>
        {cachedCount > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            disabled={busy}
            className="btn-ghost text-sm text-rose-300 border border-rose-400/30"
          >
            🗑 清空所有缓存
          </button>
        )}
      </div>

      {/* 进度条 */}
      {progress && (
        <div className="rounded-lg border border-violet-400/30 bg-violet-500/5 p-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-violet-200 truncate">
              {progress.currentName || "准备中…"}
            </span>
            <span className="text-violet-300 tabular-nums">
              {progress.done} / {progress.total}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-ink-700/60 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-400 to-fuchsia-400 transition-all"
              style={{
                width: `${
                  (progress.done / Math.max(1, progress.total)) * 100
                }%`,
              }}
            />
          </div>
          <div className="text-[10px] text-slate-400 max-h-24 overflow-y-auto font-mono leading-relaxed">
            {progress.log.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        </div>
      )}

      {/* 过滤 */}
      <div className="flex gap-1.5 text-xs flex-wrap">
        {(
          [
            { id: "missing", label: `仅缺 (${missingCount})` },
            { id: "all", label: `全部 (${allTrophies.length})` },
            { id: "math", label: `数学 (${allTrophies.filter((t) => t.subjectId === "math").length})` },
            { id: "chinese", label: `语文 (${allTrophies.filter((t) => t.subjectId === "chinese").length})` },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`chip text-xs ${
              filter === f.id
                ? "bg-violet-500/30 text-violet-100 border border-violet-400/40"
                : "bg-white/5 text-slate-400 border border-white/10"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 列表 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-96 overflow-y-auto pr-2">
        {filtered.map((t) => {
          const row = cached.get(t.id);
          return (
            <div
              key={t.id}
              className={`rounded-lg border p-2 ${
                row
                  ? "border-emerald-400/30 bg-emerald-500/5"
                  : "border-amber-400/30 bg-amber-500/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 rounded shrink-0 overflow-hidden bg-ink-800/40 flex items-center justify-center">
                  {row?.imageDataUrl ? (
                    <img
                      src={row.imageDataUrl}
                      alt={t.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl">{t.icon}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-100 truncate">
                    {t.name}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {t.subjectId === "math" ? "📐 数学" : "📚 语文"}
                    {t.rare && " · ✨ rare"}
                  </div>
                </div>
              </div>
              <div className="mt-1.5 flex gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => onRegenOne(t)}
                  disabled={busy}
                  className="text-violet-300 hover:underline"
                >
                  {row ? "重新生成" : "生成"}
                </button>
                {row && (
                  <button
                    type="button"
                    onClick={() => onDeleteOne(t.id)}
                    disabled={busy}
                    className="text-rose-300 hover:underline ml-auto"
                  >
                    删除
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
