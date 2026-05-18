/**
 * v0.35.23 iter 52: FC 调用监控面板 (admin/super-admin only).
 *
 * 拉 /api/super-admin/fc-call-stats?days=7 显示:
 *  - 今日 image-gen / paper-ocr 调用次数
 *  - 7 天累计 + 失败率 + 平均耗时
 *  - 最近 20 条失败 entry
 *  - 阈值警告 (今日 image-gen > 50 → 显眼黄/红)
 *
 * 防"今天没加学生还在扣费" 再发生 — admin 可一眼看是不是有自动 trigger 在狂调.
 */
import { useEffect, useState } from "react";

interface StatsResp {
  ok: boolean;
  days: number;
  totalsByKind: Record<string, { total: number; failed: number; sumElapsed: number }>;
  totalsByDay: { date: string; image_gen: number; paper_ocr: number; failed: number }[];
  avgElapsedMs: Record<string, number>;
  recentFailed: { ts: number; kind: string; userId: string; error?: string; elapsedMs: number }[];
}

const DAILY_IMAGE_GEN_WARN_THRESHOLD = 50;
const DAILY_IMAGE_GEN_ALERT_THRESHOLD = 200;

export function FcCallStatsPanel({ pwd }: { pwd: string }) {
  const [stats, setStats] = useState<StatsResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [days, setDays] = useState(7);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/super-admin/fc-call-stats?days=${days}`, {
        headers: { Authorization: `Bearer ${pwd}` },
      });
      if (!r.ok) throw new Error(`http_${r.status}`);
      const j = (await r.json()) as StatsResp;
      if (!j.ok) throw new Error("server_not_ok");
      setStats(j);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const today = stats?.totalsByDay?.[0];
  const imageToday = today?.image_gen ?? 0;
  const ocrToday = today?.paper_ocr ?? 0;
  const failedToday = today?.failed ?? 0;

  const imageWarn = imageToday >= DAILY_IMAGE_GEN_WARN_THRESHOLD;
  const imageAlert = imageToday >= DAILY_IMAGE_GEN_ALERT_THRESHOLD;

  return (
    <section className="rounded-xl bg-slate-900/60 border border-purple-400/40 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-purple-100">
          📊 FC 调用监控 (image-gen + paper-ocr)
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            className="text-xs bg-slate-800 text-slate-200 border border-slate-600 rounded px-2 py-1"
          >
            <option value="1">今天</option>
            <option value="7">7 天</option>
            <option value="14">14 天</option>
            <option value="30">30 天</option>
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="text-xs px-2 py-1 rounded bg-purple-500 text-white font-semibold hover:bg-purple-400 disabled:opacity-50"
          >
            {loading ? "..." : "刷新"}
          </button>
        </div>
      </div>

      {err && (
        <div className="text-xs text-rose-200 bg-rose-500/15 border border-rose-400/30 px-2 py-1.5 rounded">
          加载失败: {err}
        </div>
      )}

      {/* 今日 */}
      <div className="grid grid-cols-3 gap-2">
        <div
          className={`rounded-lg p-2 ${
            imageAlert
              ? "bg-rose-500/20 border border-rose-400/50"
              : imageWarn
                ? "bg-amber-500/20 border border-amber-400/40"
                : "bg-slate-800/60 border border-slate-500/30"
          }`}
        >
          <div className="text-[10px] text-slate-300">今日 image-gen</div>
          <div className={`text-xl font-bold ${imageAlert ? "text-rose-100" : imageWarn ? "text-amber-100" : "text-purple-100"}`}>
            {imageToday}
          </div>
          {imageWarn && (
            <div className="text-[10px] text-amber-200 mt-0.5">
              ⚠️ 偏多, 检查自动 trigger
            </div>
          )}
          {imageAlert && (
            <div className="text-[10px] text-rose-200 mt-0.5">
              🚨 异常多, 可能被默默扣
            </div>
          )}
        </div>
        <div className="rounded-lg p-2 bg-slate-800/60 border border-slate-500/30">
          <div className="text-[10px] text-slate-300">今日 paper-ocr</div>
          <div className="text-xl font-bold text-cyan-100">{ocrToday}</div>
        </div>
        <div className={`rounded-lg p-2 ${failedToday > 0 ? "bg-rose-500/15 border border-rose-400/30" : "bg-slate-800/60 border border-slate-500/30"}`}>
          <div className="text-[10px] text-slate-300">今日失败</div>
          <div className={`text-xl font-bold ${failedToday > 0 ? "text-rose-200" : "text-slate-200"}`}>
            {failedToday}
          </div>
        </div>
      </div>

      {/* 累计统计 */}
      {stats && (
        <div className="text-xs text-slate-300 space-y-1.5">
          <div className="flex items-center justify-between border-b border-slate-700 pb-1">
            <span>{days} 天 image-gen</span>
            <span>
              <b className="text-purple-100">{stats.totalsByKind.image_gen?.total ?? 0}</b> 次
              · 失败 {stats.totalsByKind.image_gen?.failed ?? 0}
              · 平均 {((stats.avgElapsedMs.image_gen ?? 0) / 1000).toFixed(1)}s
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-slate-700 pb-1">
            <span>{days} 天 paper-ocr</span>
            <span>
              <b className="text-cyan-100">{stats.totalsByKind.paper_ocr?.total ?? 0}</b> 次
              · 失败 {stats.totalsByKind.paper_ocr?.failed ?? 0}
              · 平均 {((stats.avgElapsedMs.paper_ocr ?? 0) / 1000).toFixed(1)}s
            </span>
          </div>
        </div>
      )}

      {/* 按日趋势 */}
      {stats && stats.totalsByDay.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-purple-200">按日趋势</div>
          <div className="space-y-0.5 text-[11px] font-mono">
            {stats.totalsByDay.slice(0, days).map((d) => {
              const total = d.image_gen + d.paper_ocr;
              const bar = "█".repeat(Math.min(40, Math.ceil(total / 2)));
              return (
                <div key={d.date} className="flex items-center gap-2 text-slate-300">
                  <span className="w-24 shrink-0 text-slate-400">{d.date}</span>
                  <span className="w-8 text-right">img:{d.image_gen}</span>
                  <span className="w-8 text-right">ocr:{d.paper_ocr}</span>
                  {d.failed > 0 && <span className="text-rose-300">fail:{d.failed}</span>}
                  <span className="text-purple-400/60">{bar}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 最近失败 */}
      {stats && stats.recentFailed.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-semibold text-rose-200">最近失败 (top 20)</div>
          <div className="space-y-0.5 text-[10px] font-mono max-h-40 overflow-y-auto">
            {stats.recentFailed.map((f, i) => {
              const date = new Date(f.ts);
              const ts = `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
              return (
                <div key={i} className="flex items-center gap-2 text-rose-200/80">
                  <span className="w-16 shrink-0 text-slate-400">{ts}</span>
                  <span className="w-16 shrink-0">{f.kind}</span>
                  <span className="w-16 shrink-0">{f.userId}</span>
                  <span className="flex-1 truncate">{f.error}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
