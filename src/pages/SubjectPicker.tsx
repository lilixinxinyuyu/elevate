/**
 * 学科选择页：登录通过后第一次落地的页面，也是 header 学科 chip 上的"切换学科"
 * 跳转点。展示所有已注册学科的卡片，点击进入 /:subject。
 *
 * 行为：
 *  - 如果 meta:selectedSubject::<studentId> 已存在，顶部显示一个大"继续上次：xxx →"
 *    按钮，一键回到上次学科
 *  - 每张卡片显示：学科 emoji / shortLabel / label / homeTagline / status 角标
 *    （comingSoonLabel 如果有）/ 上次进入时间（attempts 最新一条）
 *  - 点击 chinese 卡也是允许的——SubjectShell 会因为 chinese.units.length===0 强制
 *    渲染 ComingSoon 页，让 Selena 看到"建设中"的预告 + 倒计时
 */

import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db } from "../db/dexie";
import { ORDERED_SUBJECT_IDS, SUBJECTS } from "../subjects";
import type { SubjectId } from "../core/types";

function formatDaysAgo(ts: number | null): string {
  if (!ts) return "还没开始";
  const days = (Date.now() - ts) / (24 * 60 * 60 * 1000);
  if (days < 1) return "今天";
  if (days < 2) return "昨天";
  if (days < 7) return `${Math.floor(days)} 天前`;
  return `${Math.floor(days / 7)} 周前`;
}

function formatDaysUntil(at: number): string {
  const days = Math.ceil((at - Date.now()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "马上开放";
  if (days === 1) return "明天开放";
  return `还有 ${days} 天`;
}

export function SubjectPickerPage() {
  const student = useLiveQuery(async () => (await db.students.toArray())[0]);
  const [lastSubject, setLastSubject] = useState<SubjectId | null>(null);
  const [lastTouchedAt, setLastTouchedAt] = useState<
    Partial<Record<SubjectId, number>>
  >({});

  // 读"上次学科" + 每个学科最新 attempt 时间
  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    (async () => {
      const sel = await db.meta.get(`selectedSubject::${student.id}`);
      if (!cancelled && sel?.value) {
        const sid = sel.value as SubjectId;
        if (SUBJECTS[sid]) setLastSubject(sid);
      }
      // 各学科最近 attempt
      const map: Partial<Record<SubjectId, number>> = {};
      for (const sid of ORDERED_SUBJECT_IDS) {
        const arr = await db.attempts
          .where("studentId").equals(student.id)
          .filter((a) => (a.subjectId ?? "math") === sid)
          .reverse()
          .limit(1)
          .toArray();
        if (arr[0]) map[sid] = arr[0].createdAt;
      }
      if (!cancelled) setLastTouchedAt(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [student?.id]);

  const lastSubjectObj = lastSubject ? SUBJECTS[lastSubject] : null;

  return (
    <div className="min-h-screen app-bg text-slate-100 px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="font-display font-bold text-4xl text-brand mb-2">
            Selena's Elevate
          </div>
          <div className="text-sm text-slate-400">
            选一个学科开始今天的练习
          </div>
        </div>

        {lastSubjectObj && (
          <Link
            to={`/${lastSubjectObj.id}`}
            className="block card-glow mb-6 hover:scale-[1.01] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${lastSubjectObj.themeColor} flex items-center justify-center font-display font-bold text-white shadow-glow`}
              >
                {lastSubjectObj.shortLabel}
              </div>
              <div className="flex-1">
                <div className="text-xs text-slate-400">继续上次</div>
                <div className="font-display font-bold text-lg">
                  {lastSubjectObj.label}
                </div>
              </div>
              <div className="text-violet-300 text-2xl">→</div>
            </div>
          </Link>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ORDERED_SUBJECT_IDS.map((sid) => {
            const s = SUBJECTS[sid];
            const lastAt = lastTouchedAt[sid] ?? null;
            const upcoming =
              s.status.releaseAt && s.status.releaseAt > Date.now();
            return (
              <Link
                key={sid}
                to={`/${sid}`}
                className="card-glow flex flex-col gap-3 hover:scale-[1.01] transition-transform"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${s.themeColor} flex items-center justify-center font-display font-bold text-2xl text-white shadow-glow shrink-0`}
                  >
                    {s.shortLabel}
                  </div>
                  <div className="flex-1">
                    <div className="font-display font-bold text-xl">
                      {s.label}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {s.homeTagline}
                    </div>
                  </div>
                </div>

                {s.status.comingSoonLabel && (
                  <div className="chip bg-amber-500/15 text-amber-200 border border-amber-400/30 text-xs">
                    🛠️ {s.status.comingSoonLabel}
                    {upcoming && s.status.releaseAt && (
                      <span className="ml-1 text-amber-100/80">
                        · {formatDaysUntil(s.status.releaseAt)}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-ink-700/40">
                  <span>上次：{formatDaysAgo(lastAt)}</span>
                  <span className="text-violet-300">进入 →</span>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="text-center text-[11px] text-slate-500 mt-8">
          本地优先 · 多学科平台 · 切换学科随时可回到这里
        </div>
      </div>
    </div>
  );
}
