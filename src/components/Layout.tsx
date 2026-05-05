import { Link, NavLink, Outlet } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useOptionalSubject } from "../subjects/context";
import { ORDERED_SUBJECT_IDS, SUBJECTS } from "../subjects";
import { mathSubject } from "../subjects/math";
import { BgGenIndicator } from "./BgGenIndicator";
import { ensureMascotImage } from "../lib/mascot";
import { migrateOldTierBadgeKeys } from "../lib/tierBadge";
import { runScheduledUnlocks, type ScheduledUnlockResult } from "../db/unitUnlock";
import { UnitUnlockCelebration } from "./UnitUnlockCelebration";
import { db } from "../db/dexie";

/**
 * Layout：所有 /:subject/* 子路由共用的壳。
 *
 * 多学科 v2：导航项不再写死，从 useSubject().navItems 拿。Header 右上加一个
 * 学科 chip，下拉显示已登记的学科 + "切换学科 →" 链回 picker。
 */
export function Layout() {
  // useOptionalSubject 是因为理论上有人不通过 SubjectShell 也能渲染 Layout（比如老
  // 路径直接命中），这种情况下回落到 mathSubject 继续渲染 —— 不让整页崩。
  const subject = useOptionalSubject() ?? mathSubject;
  const items = subject.navItems;
  const [chipOpen, setChipOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  // v0.30.10: 进 layout 时检查"按时间自动解锁"的单元；如果有就排队弹庆祝
  const [pendingUnlockCelebration, setPendingUnlockCelebration] = useState<ScheduledUnlockResult[]>([]);

  // 点击外部关闭下拉
  useEffect(() => {
    if (!chipOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setChipOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [chipOpen]);

  // 第一次进入 Layout 时（用户登录后访问任何 page），后台静默生成小进吉祥物
  // 缓存命中就立刻 return，缺失才 fetch image。失败 fallback emoji 不影响主流程。
  useEffect(() => {
    void ensureMascotImage().catch(() => void 0);
    // v0.30.3 一次性清理 v0.30.2 的旧 _tier_badge_* 键（key 改为 math_tier_*）
    void migrateOldTierBadgeKeys().catch(() => void 0);
    // v0.30.10: 检查 UNIT_UNLOCK_SCHEDULE，把"今天该解锁但还没解锁"的单元自动开放，
    // 弹庆祝弹窗。失败不影响主流程（catch 静默）。
    void (async () => {
      try {
        const students = await db.students.toArray();
        if (!students[0]) return;
        const newlyUnlocked = await runScheduledUnlocks(students[0].id);
        if (newlyUnlocked.length > 0) {
          setPendingUnlockCelebration(newlyUnlocked);
        }
      } catch (e) {
        console.warn("[Layout] runScheduledUnlocks failed:", e);
      }
    })();
  }, []);

  return (
    <div className="min-h-full flex flex-col">
      <BgGenIndicator />
      <header className="sticky top-0 z-20 bg-ink-900/80 border-b border-ink-700/70 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <NavLink to={`/${subject.id}`} className="flex items-center gap-2">
            <div
              className={`w-9 h-9 rounded-xl bg-gradient-to-br ${subject.themeColor} text-white flex items-center justify-center font-display font-bold shadow-glow`}
            >
              {subject.shortLabel}
            </div>
            <div>
              <div className="font-display font-bold text-brand text-lg leading-none">
                Selena's Elevate
              </div>
              <div className="text-[10px] text-slate-400">
                {subject.label} · 本地版
              </div>
            </div>
          </NavLink>

          <div className="flex items-center gap-3">
            <nav className="hidden sm:flex gap-1 text-sm">
              {items.map((it) => {
                const path = it.to ? `/${subject.id}/${it.to}` : `/${subject.id}`;
                return (
                  <NavLink
                    key={it.to}
                    to={path}
                    end={it.exact}
                    className={({ isActive }) =>
                      `px-3 py-1.5 rounded-lg ${
                        isActive
                          ? "bg-violet-500/20 text-violet-200 border border-violet-400/30"
                          : it.subtle
                            ? "text-slate-500 hover:text-slate-200"
                            : "text-slate-300 hover:bg-white/5"
                      }`
                    }
                  >
                    {it.label}
                  </NavLink>
                );
              })}
            </nav>

            {/* 学科切换 chip — v0.30.14: 不再重复显示当前 shortLabel（左上 logo 已经
                有了），改成中性切换图标，避免视觉冗余但仍保留可点性 */}
            <div className="relative" ref={popoverRef}>
              <button
                type="button"
                onClick={() => setChipOpen((v) => !v)}
                className="px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-ink-700/60 text-slate-300 text-xs flex items-center gap-1 transition-colors"
                aria-haspopup="menu"
                aria-expanded={chipOpen}
                aria-label="切换学科"
                title="切换学科"
              >
                <span aria-hidden>⇄</span>
                <span className="opacity-60">▾</span>
              </button>
              {chipOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-ink-700/60 bg-ink-900/95 backdrop-blur-md shadow-xl py-1 z-30">
                  {ORDERED_SUBJECT_IDS.map((sid) => {
                    const s = SUBJECTS[sid];
                    const active = sid === subject.id;
                    return (
                      <Link
                        key={sid}
                        to={`/${sid}`}
                        onClick={() => setChipOpen(false)}
                        className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 ${
                          active ? "text-violet-200" : "text-slate-300"
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-md bg-gradient-to-br ${s.themeColor} text-white text-[10px] font-bold flex items-center justify-center`}
                        >
                          {s.shortLabel}
                        </span>
                        <span className="flex-1">{s.label}</span>
                        {active && <span className="text-xs">✓</span>}
                      </Link>
                    );
                  })}
                  <div className="border-t border-ink-700/60 mt-1 pt-1">
                    <Link
                      to="/"
                      onClick={() => setChipOpen(false)}
                      className="block px-3 py-2 text-xs text-slate-400 hover:bg-white/5"
                    >
                      切换学科 →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>

      {/* 移动端底部导航 — v0.31.1：压到 5 项最多（首页/闪电口算/今日挑战/闯关/
          错题复活），desktopOnly 项目 (专项练/技能树) 在 Home CTA 卡片里访问。 */}
      <nav className="sm:hidden sticky bottom-0 z-20 bg-ink-900/90 border-t border-ink-700/70 backdrop-blur-md">
        <div
          className="grid text-xs"
          style={{
            gridTemplateColumns: `repeat(${items.filter((i) => !i.subtle && !i.desktopOnly).length}, minmax(0, 1fr))`,
          }}
        >
          {items
            .filter((i) => !i.subtle && !i.desktopOnly)
            .map((it) => {
              const path = it.to ? `/${subject.id}/${it.to}` : `/${subject.id}`;
              return (
                <NavLink
                  key={it.to}
                  to={path}
                  end={it.exact}
                  className={({ isActive }) =>
                    `py-3 text-center ${isActive ? "text-violet-300" : "text-slate-400"}`
                  }
                >
                  {it.label}
                </NavLink>
              );
            })}
        </div>
      </nav>

      <footer className="text-[11px] text-slate-500 text-center py-3">
        本地优先 · v0.31.8
      </footer>

      {/* v0.30.10: 自动解锁的单元庆祝（一次弹一个，关掉再弹下一个）*/}
      {pendingUnlockCelebration.length > 0 && (
        <UnitUnlockCelebration
          unitName={pendingUnlockCelebration[0]!.unitName}
          isScheduled
          onClose={() =>
            setPendingUnlockCelebration((qs) => qs.slice(1))
          }
        />
      )}
    </div>
  );
}
