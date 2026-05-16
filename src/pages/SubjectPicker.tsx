/**
 * 学科选择页：登录通过后第一次落地的页面。
 *
 * v0.31.103 改版（Bruce 反馈）：
 *  - 去掉"继续上次：xxx →"大按钮（3 学科切换很容易，不需要）
 *  - 加 DailySummaryCard：三学科当日进步 + 易错 + 累计 + 截屏分享
 *  - 学科卡片缩小放底部，专注 daily summary
 *
 * 数据：DailySummaryCard 自己查 db。
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { ORDERED_SUBJECT_IDS, SUBJECTS } from "../subjects";
import type { SubjectId } from "../core/types";
import { DailySummaryCard } from "../components/DailySummaryCard";
import { getStoredPassword } from "../db/cloudSync";

/** Ep151: super-admin 入口探活；返 true 时 picker 顶部显示 🛠 link */
function useSuperAdminCheck() {
  const [isSuper, setIsSuper] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const pwd = getStoredPassword();
        if (!pwd) return;
        const r = await fetch("/api/super-admin/me", {
          headers: { Authorization: `Bearer ${pwd}` },
        });
        if (!r.ok) return;
        const j = (await r.json()) as { isSuperAdmin?: boolean };
        if (j.isSuperAdmin) setIsSuper(true);
      } catch { /* */ }
    })();
  }, []);
  return isSuper;
}

function formatDaysUntil(at: number): string {
  const days = Math.ceil((at - Date.now()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "马上开放";
  if (days === 1) return "明天开放";
  return `还有 ${days} 天`;
}

export function SubjectPickerPage() {
  const student = useLiveQuery(async () => (await db.students.toArray())[0]);
  const isSuper = useSuperAdminCheck();

  return (
    <div className="min-h-screen app-bg text-slate-100 px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="text-center pb-1">
          <div className="font-display font-bold text-3xl text-brand">
            Selena's Elevate
          </div>
        </div>

        {/* Ep151: super-admin 入口 */}
        {isSuper && (
          <Link
            to="/super-admin"
            className="block rounded-xl bg-gradient-to-r from-sky-500/20 to-violet-500/20 border border-sky-400/40 px-4 py-2.5 text-sm text-sky-100 hover:from-sky-500/30 hover:to-violet-500/30 transition-colors"
          >
            <span className="font-bold">🛠 项目管理后台</span>
            <span className="text-xs text-sky-200/70 ml-2 hidden sm:inline">看所有同学 / 编辑档案 / AI 摘要</span>
          </Link>
        )}

        {/* v0.31.103: 三学科今日总结卡（顶部 hero） */}
        {student && (
          <DailySummaryCard
            studentId={student.id}
            studentName={student.name}
          />
        )}

        {/* 学科切换 — 3 列紧凑（chinese 加了内容已经不是 coming-soon） */}
        <div className="grid grid-cols-3 gap-2.5">
          {ORDERED_SUBJECT_IDS.map((sid: SubjectId) => {
            const s = SUBJECTS[sid];
            const upcoming =
              s.status.releaseAt && s.status.releaseAt > Date.now();
            return (
              <Link
                key={sid}
                to={`/${sid}`}
                className="card-glow flex flex-col items-center gap-1.5 py-3 hover:scale-[1.02] transition-transform active:scale-[0.98]"
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.themeColor} flex items-center justify-center font-display font-bold text-xl text-white shadow-glow`}
                >
                  {s.shortLabel}
                </div>
                <div className="font-display font-bold text-sm">{s.label}</div>
                {s.status.comingSoonLabel ? (
                  <div className="text-[9px] text-amber-200/80 truncate">
                    🛠 {upcoming && s.status.releaseAt
                      ? formatDaysUntil(s.status.releaseAt)
                      : s.status.comingSoonLabel}
                  </div>
                ) : (
                  <div className="text-[9px] text-violet-300/70">进入 →</div>
                )}
              </Link>
            );
          })}
        </div>

        <div className="text-center text-[10px] text-slate-500">
          本地优先 · 数据存在你设备里
        </div>
      </div>
    </div>
  );
}
