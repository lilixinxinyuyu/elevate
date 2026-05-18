/**
 * v0.35.5 (iter 39 P1-4): 脑力雷达 主页面.
 *
 * Selena 43% master plan P1-4. 把 iter 32-38 累积的训练数据可视化:
 *   - 5 维度 RPG 风格属性 (直觉 / 严谨 / 拆解 / 专项 / 框架)
 *   - SVG 雷达图
 *   - 每维度卡片 + CTA
 *   - 时间窗口切换 (本周 / 本月 / 全部)
 *
 * 数据源:
 *   - attempts (db.attempts) with metadata.estimationGate/scratch/multiStep/strengthen*
 *   - localStorage base_system_lesson_progress
 *
 * 评审整合: 分母 0 给 CTA, 维度副标"我做了什么才会涨", week fallback "最近 N 次"
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { computeBrainpowerRadar, type TimeWindow } from "../core/brainpowerRadar";
import { RadarChart } from "../components/radar/RadarChart";
import { MascotQuickAccess } from "../components/MascotQuickAccess";

export default function BrainpowerRadarPage() {
  const navigate = useNavigate();
  const [window, setWindow] = useState<TimeWindow>("week");

  const studentId = useLiveQuery(async () => {
    const s = await db.students.toCollection().first();
    return s?.id ?? null;
  }, []);

  const attempts = useLiveQuery(async () => {
    if (!studentId) return [];
    return db.attempts.where("studentId").equals(studentId).toArray();
  }, [studentId]) ?? [];

  const snapshot = useMemo(() => computeBrainpowerRadar(attempts, window), [attempts, window]);

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-indigo-100">🧠 脑力雷达</h1>
        <button onClick={() => navigate(-1)} className="text-xs text-slate-400 hover:text-slate-200">返回</button>
      </div>

      <p className="text-xs text-indigo-200/70">
        基于 {snapshot.totalSampledAttempts} 题数据 · 5 个脑力属性
      </p>

      {/* 时间窗口 */}
      <div className="flex gap-2">
        {(["week", "month", "all"] as TimeWindow[]).map((w) => (
          <button
            key={w}
            onClick={() => setWindow(w)}
            className={`flex-1 px-3 py-1.5 rounded-lg text-xs border transition ${
              window === w
                ? "bg-indigo-500 text-white border-indigo-400 font-semibold"
                : "bg-slate-800 text-indigo-200 border-indigo-400/30 hover:bg-slate-700"
            }`}
          >
            {w === "week" ? "本周" : w === "month" ? "本月" : "全部"}
          </button>
        ))}
      </div>

      {/* SVG 雷达图 */}
      <div className="rounded-xl bg-slate-900/50 border border-indigo-400/30 p-2">
        <RadarChart dimensions={snapshot.dimensions} size={300} />
      </div>

      {/* 维度卡片 */}
      <div className="space-y-2">
        {snapshot.dimensions.map((d) => {
          const pct = Math.round(d.value * 100);
          const isEmpty = d.denominator === 0;
          // 评审共识: 样本太少 (< 5) 不显示红色, 改"正在点亮" 蓝色 (防新手满屏红)
          const isLowSample = !isEmpty && d.denominator < 5;
          return (
            <div
              key={d.id}
              className={`rounded-xl border p-3 ${
                isEmpty
                  ? "bg-slate-800/30 border-slate-500/30"
                  : isLowSample
                    ? "bg-sky-500/10 border-sky-400/40"
                    : pct >= 70
                      ? "bg-emerald-500/10 border-emerald-400/40"
                      : pct >= 40
                        ? "bg-amber-500/10 border-amber-400/40"
                        : "bg-rose-500/10 border-rose-400/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{d.icon}</span>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-indigo-50">{d.name}</p>
                  <p className="text-[10px] text-indigo-200/60">{d.description}</p>
                </div>
                {!isEmpty && (
                  <span className={`text-lg font-bold ${
                    isLowSample ? "text-sky-200" :
                    pct >= 70 ? "text-emerald-200" : pct >= 40 ? "text-amber-200" : "text-rose-200"
                  }`}>
                    {pct}%
                  </span>
                )}
              </div>
              {!isEmpty && (
                <div className="mt-2 h-2 rounded-full bg-slate-900/60 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      isLowSample ? "bg-sky-400" :
                      pct >= 70 ? "bg-emerald-400" : pct >= 40 ? "bg-amber-400" : "bg-rose-400"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
              <p className="mt-1.5 text-xs text-indigo-200/80">
                {isLowSample ? `🌱 正在点亮 — ${d.detail}` : d.detail}
              </p>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg bg-slate-900/30 border border-slate-500/30 p-3 text-xs text-slate-300">
        💡 这 5 个属性反映你最近的训练. 多做做对应题型可以提升属性!
      </div>
      <MascotQuickAccess context="radar" />
    </div>
  );
}
