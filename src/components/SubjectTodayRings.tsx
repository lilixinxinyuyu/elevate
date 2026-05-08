/**
 * SubjectTodayRings — 通用版同心 3 环（v0.31.42）
 *
 * 把 math 专属的 TodayRings 抽出来，让任何 subject 都能用：
 *   <SubjectTodayRings rings={[ring1, ring2, ring3]} />
 *
 * 跟 TodayRings 视觉一致（Apple Watch 同心 3 环）+ 5 色梯度，但调用方
 * 自定义 ring 内容（icon / label / progress / 链接）。
 */

import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

export interface RingSpec {
  id: string;
  icon: string;
  shortLabel: string;
  /** 进度 0-1 */
  progress: number;
  statusText: string;
  to: string;
  /** 主色 hex */
  hue: string;
  hue2: string;
  done: boolean;
}

export function SubjectTodayRings({ rings, title = "今日打卡" }: { rings: RingSpec[]; title?: string }) {
  const closedCount = rings.filter((r) => r.done).length;
  const allDone = closedCount === rings.length;

  const justClosedRef = useRef<Set<string>>(new Set());
  const lastDoneSetRef = useRef<Set<string>>(new Set());
  // v0.31.43: 首次 render 不算"新闭" — 否则页面初次加载已经 done 的环会持续 sparkle
  // 导致环里的小点不停跳。只 mount 完成后才开始监听新闭合事件。
  const initializedRef = useRef(false);
  const [pulseId, setPulseId] = useState<string | null>(null);
  useEffect(() => {
    const cur = new Set(rings.filter((r) => r.done).map((r) => r.id));
    if (!initializedRef.current) {
      // 首次：仅记录当前 done 集合，不触发 sparkle
      lastDoneSetRef.current = cur;
      initializedRef.current = true;
      return;
    }
    const prev = lastDoneSetRef.current;
    for (const id of cur) {
      if (!prev.has(id)) justClosedRef.current.add(id);
    }
    lastDoneSetRef.current = cur;
    const newly = rings.find((r) => r.done && justClosedRef.current.has(r.id));
    if (newly) {
      setPulseId(newly.id);
      const t = window.setTimeout(() => {
        setPulseId(null);
        justClosedRef.current.delete(newly.id);
      }, 900);
      return () => window.clearTimeout(t);
    }
  }, [rings.map((r) => `${r.id}:${r.done}`).join(",")]);

  return (
    <div className="rounded-3xl border border-ink-700/40 bg-ink-900/30 px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-bold text-sm text-slate-200">{title}</h3>
        <span className="text-xs text-slate-400 tabular-nums">
          {closedCount} / {rings.length}
        </span>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
        <ConcentricRings rings={rings} allDone={allDone} pulseId={pulseId} />
        {/* v0.31.44: 移动端改成纵向 stack — 横向 3 chip 在 320-420px 宽下文字会被截断
            ("词...", "闪...", "复...", "0/...", "60..."），改成 flex column 全宽展示 */}
        <div className="flex-1 w-full flex flex-col gap-2">
          {rings.map((r) => (
            <Link
              key={r.id}
              to={r.to}
              className={`group flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors ${
                r.done ? "bg-white/[0.03] hover:bg-white/[0.06]" : "hover:bg-white/[0.05]"
              }`}
              style={{
                borderLeft: `3px solid ${r.hue}`,
                background: r.done
                  ? undefined
                  : `linear-gradient(90deg, ${r.hue}1F, transparent 70%)`,
              }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] shrink-0"
                style={{
                  background: r.done
                    ? `${r.hue}30`
                    : `linear-gradient(135deg, ${r.hue}, ${r.hue2})`,
                  color: r.done ? r.hue : "#fff",
                }}
              >
                {r.done ? "✓" : r.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-bold truncate ${r.done ? "text-slate-200" : "text-slate-100"}`}>
                  {r.shortLabel}
                </div>
                <div className="text-[10px] truncate text-slate-300">{r.statusText}</div>
              </div>
              <div className={`text-xs shrink-0 group-hover:text-slate-200 transition-colors ${r.done ? "text-slate-500" : "text-slate-400"}`}>→</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConcentricRings({
  rings,
  allDone,
  pulseId,
}: {
  rings: RingSpec[];
  allDone: boolean;
  pulseId: string | null;
}) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = 14;
  const gap = 4;
  const radii = rings.map((_, i) => cx - i * (stroke + gap) - stroke / 2 - 4);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-[160px] h-[160px] sm:w-[200px] sm:h-[200px] block">
        <defs>
          {rings.map((r) => (
            <linearGradient key={r.id} id={`subj-${r.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={r.hue} />
              <stop offset="100%" stopColor={r.hue2} />
            </linearGradient>
          ))}
        </defs>
        {rings.map((r, i) => {
          const radius = radii[i] ?? 50;
          const c = 2 * Math.PI * radius;
          const offset = c * (1 - Math.max(0.09, r.progress));
          return (
            <g key={r.id}>
              <circle cx={cx} cy={cy} r={radius} fill="none" stroke={r.hue} strokeOpacity={0.18} strokeWidth={stroke} />
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={`url(#subj-${r.id})`}
                strokeWidth={stroke}
                strokeLinecap={r.progress >= 0.5 ? "round" : "butt"}
                strokeDasharray={c}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${cx} ${cy})`}
                className={`transition-[stroke-dashoffset] duration-700 ${pulseId === r.id ? "animate-pulse-bar" : ""}`}
                opacity={r.done ? 0.85 : 1}
              />
              {pulseId === r.id && (
                <g>
                  {Array.from({ length: 12 }).map((_, k) => {
                    const angle = (k / 12) * 2 * Math.PI - Math.PI / 2;
                    const px = cx + Math.cos(angle) * radius;
                    const py = cy + Math.sin(angle) * radius;
                    return (
                      <circle
                        key={k}
                        cx={px}
                        cy={py}
                        r={3}
                        fill={r.hue2}
                        className="animate-sparkle"
                        style={{ animationDelay: `${(k / 12) * 0.4}s` }}
                      />
                    );
                  })}
                </g>
              )}
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
        {allDone ? (
          <>
            <div className="text-3xl sm:text-4xl">🎉</div>
            <div className="text-[11px] sm:text-xs text-amber-200 font-bold mt-0.5">今日满分</div>
          </>
        ) : (
          <>
            <div className="font-display font-bold text-2xl sm:text-3xl text-slate-100 leading-none tabular-nums">
              {rings.filter((r) => r.done).length}
              <span className="text-slate-400 text-base sm:text-lg">/{rings.length}</span>
            </div>
            <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">环已闭</div>
          </>
        )}
      </div>
    </div>
  );
}
