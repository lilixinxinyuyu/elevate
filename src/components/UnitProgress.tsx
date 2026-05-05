/**
 * 学期进度（v0.30.9）—— Home 页一个折叠卡片：
 *
 *   📅 学期进度
 *      U1 小数加减   ✅ 已学
 *      U2 三角形     ✅ 已学
 *      U3 小数乘法   ✅ 已学
 *      U4 观察物体   ✅ 已学
 *      U5 方程       🔒 [解锁这个单元]
 *      U6 数据图表   🔒 （等 U5 学完再开放）
 *
 * 默认 G4B 解锁 U1-U4（期中范围）。点"解锁"按钮就把对应 unit 加进
 * meta:unlockedUnits 列表 —— 之后 buildDailySession 会让它的题进每日挑战，
 * SkillPicker 也允许选这个 unit。
 *
 * 用 useLiveQuery + 写后立即刷新；每次切学期重新查列表。
 */

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { UNITS } from "../content/units";
import { getUnlockedUnitIds, unlockUnit, lockUnit } from "../db/unitUnlock";
import type { Term } from "../core/types";

export function UnitProgress({
  studentId,
  term,
}: {
  studentId: string;
  term: Term;
}) {
  // 综合复习模式不展示（用户在主单学期界面控制）
  if (term === "综合复习") return null;

  const [open, setOpen] = useState(false);
  const [unlocked, setUnlocked] = useState<Set<string> | null>(null);
  // 让 useLiveQuery 监听 meta key 的变化，重新拉
  const metaTick = useLiveQuery(async () => {
    const all = await db.meta.toArray();
    return all
      .filter((m) => m.key.startsWith(`unlockedUnits::${studentId}::`))
      .map((m) => m.key + ":" + JSON.stringify(m.value))
      .join("|");
  }, [studentId]);
  useEffect(() => {
    void getUnlockedUnitIds(studentId, term).then((list) =>
      setUnlocked(new Set(list)),
    );
  }, [studentId, term, metaTick]);

  const units = UNITS.filter((u) => u.term === term).sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );
  if (units.length === 0) return null;

  const unlockedCount = units.filter((u) => unlocked?.has(u.id)).length;

  const handleUnlock = async (unitId: string) => {
    if (!unlocked) return;
    const next = await unlockUnit(studentId, term, unitId);
    setUnlocked(new Set(next));
  };
  const handleLock = async (unitId: string) => {
    if (!unlocked) return;
    if (!confirm("确认锁回这个单元吗？锁回后每日挑战不会出这个单元的题。")) return;
    const next = await lockUnit(studentId, term, unitId);
    setUnlocked(new Set(next));
  };

  return (
    <section className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📅</span>
          <span className="font-display font-bold text-slate-100">
            学期进度
          </span>
          <span className="text-xs text-slate-400">
            {term} · 已解锁 <span className="text-emerald-300 font-bold">{unlockedCount}</span> / {units.length}
          </span>
        </div>
        <span
          className={`text-slate-400 text-sm transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-2 animate-slide-up">
          <div className="text-[11px] text-slate-400 mb-2">
            没解锁的单元不会出现在每日挑战 / 自由练里。学到一个单元就来这里解锁。
          </div>
          {units.map((u, idx) => {
            const isUnlocked = unlocked?.has(u.id) ?? false;
            // 上一单元未解锁时，不能跳着解锁这个（强制按顺序）
            const prevUnitsLocked = idx > 0 && !unlocked?.has(units[idx - 1]!.id);
            return (
              <div
                key={u.id}
                className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border ${
                  isUnlocked
                    ? "bg-emerald-500/10 border-emerald-400/30"
                    : "bg-white/5 border-white/10"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-display font-semibold text-slate-100 truncate">
                    <span className="text-slate-400 mr-1">U{u.orderIndex}</span>
                    {u.name}
                  </div>
                  {u.description && (
                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {u.description}
                    </div>
                  )}
                </div>
                {isUnlocked ? (
                  <div className="flex items-center gap-1">
                    <span className="chip text-[10px] bg-emerald-500/20 border border-emerald-400/40 text-emerald-200">
                      ✅ 已学
                    </span>
                    <button
                      type="button"
                      onClick={() => handleLock(u.id)}
                      className="text-[11px] text-slate-500 hover:text-slate-300 px-1"
                      title="锁回（误开了可以撤）"
                    >
                      🔒
                    </button>
                  </div>
                ) : prevUnitsLocked ? (
                  <span className="chip text-[10px] bg-slate-700/40 border border-slate-500/30 text-slate-400">
                    🔒 等上一单元
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleUnlock(u.id)}
                    className="text-xs px-3 py-1 rounded-lg bg-violet-500/20 border border-violet-400/40 text-violet-100 hover:bg-violet-500/30 transition-colors"
                  >
                    解锁
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
