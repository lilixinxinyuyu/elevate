/**
 * 语文首页 — Phase 2.x 升级版。
 *
 * 板块：
 *  1. 顶部"期中冲刺"banner + 倒计时 + 开始今日挑战
 *  2. 等级 / 称号 / XP 进度条（chineseLevelInfo: 童生→学子→秀才→...→状元）
 *  3. 单元卡（4 个）
 *  4. 错题复活入口（按 chinese 维度，最近 wrong 且没回答对的题）
 *  5. 勋章墙（已解锁 vs 未解锁灰章）
 *  6. 底部题库统计
 */

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/dexie";
import { useSubject } from "../../subjects/context";
import { MIDTERM, daysUntil } from "../../core/examDates";
import {
  chineseLevelInfo,
  getChineseTotalXp,
  getChineseTrophies,
  getChineseSkillMastery,
} from "../../subjects/chinese/service";
import { CHINESE_TROPHIES, type ChineseTrophyDef } from "../../subjects/chinese/trophies";
import type { MasteryScore } from "../../core/types";

export function ChineseHomePage() {
  const subject = useSubject();
  const totalQuestions = subject.seedQuestions.length;
  const totalSkills = subject.skills.length;
  const days = daysUntil(MIDTERM.date);

  const student = useLiveQuery(async () => (await db.students.toArray())[0]);
  const [totalXp, setTotalXp] = useState<number>(0);
  const [trophyState, setTrophyState] = useState<{
    defsById: Map<string, ChineseTrophyDef>;
    ownedCounts: Map<string, number>;
  } | null>(null);
  const [mastery, setMastery] = useState<MasteryScore[]>([]);
  const [openMistakes, setOpenMistakes] = useState<number>(0);

  useEffect(() => {
    if (!student?.id) return;
    let cancelled = false;
    (async () => {
      const [xp, trophies, m, attempts] = await Promise.all([
        getChineseTotalXp(student.id),
        getChineseTrophies(student.id),
        getChineseSkillMastery(student.id),
        db.attempts
          .where("studentId")
          .equals(student.id)
          .filter((a) => a.subjectId === "chinese")
          .toArray(),
      ]);
      if (cancelled) return;
      setTotalXp(xp);
      setTrophyState({ defsById: trophies.defsById, ownedCounts: trophies.ownedCounts });
      setMastery(m);
      // 错题计数：按 questionId 去重，最近一次该题答错且后续没再答对的算未消化错题
      const lastByQ = new Map<string, boolean>();
      for (const a of attempts) {
        lastByQ.set(a.questionId, a.isCorrect);
      }
      let mistakes = 0;
      for (const correct of lastByQ.values()) {
        if (!correct) mistakes++;
      }
      setOpenMistakes(mistakes);
    })();
    return () => {
      cancelled = true;
    };
    // 用 attempts/mastery/trophies 表的 hash 还会更精细，但 LiveQuery 这里太重；
    // 每次进 home 重读一次足够（user 也不会一直停在 home）
  }, [student?.id]);

  const level = chineseLevelInfo(totalXp);
  const ownedCount = trophyState
    ? Array.from(trophyState.ownedCounts.values()).reduce((s, n) => s + n, 0)
    : 0;
  const masteryAvg =
    mastery.length === 0
      ? 0
      : Math.round(mastery.reduce((s, m) => s + m.score, 0) / mastery.length);
  const xpProgress = Math.min(100, Math.round((level.xpThisLevel / level.xpNextLevel) * 100));

  return (
    <div className="space-y-5">
      {/* 期中冲刺 banner */}
      <div className="card-glow bg-gradient-to-br from-amber-500/20 to-rose-500/20 border border-amber-400/30">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-rose-400 text-white flex items-center justify-center font-display font-bold shadow-glow">
            语
          </div>
          <div className="flex-1">
            <div className="font-display font-bold text-xl">期中冲刺</div>
            <div className="text-xs text-slate-300 mt-0.5">
              人教版四下 1-4 单元 · 字音字形 / 古诗 / 词语 / 修辞 / 听写
            </div>
          </div>
          {days >= 0 && (
            <div className="text-right">
              <div className="text-xs text-slate-400">距期中</div>
              <div className="text-2xl font-display font-bold text-rose-300">
                {days} <span className="text-sm">天</span>
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <Link
            to={`/chinese/train?fresh=${Date.now()}`}
            className="btn-primary text-base px-5 py-2.5"
          >
            ▶ 开始今日挑战
          </Link>
        </div>
      </div>

      {/* 等级 / XP / 整体掌握度 / 错题数 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="card text-center">
          <div className="text-[11px] text-slate-400">称号</div>
          <div className="font-display font-bold text-xl text-amber-300 mt-1">{level.title}</div>
          <div className="text-[10px] text-slate-500 mt-1">Lv {level.level}</div>
        </div>
        <div className="card text-center">
          <div className="text-[11px] text-slate-400">总 XP</div>
          <div className="font-display font-bold text-xl text-violet-300 mt-1">{totalXp}</div>
          <div className="mt-1 h-1 bg-ink-700/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-400 to-pink-400"
              style={{ width: `${xpProgress}%` }}
            />
          </div>
        </div>
        <div className="card text-center">
          <div className="text-[11px] text-slate-400">平均掌握度</div>
          <div
            className={`font-display font-bold text-xl mt-1 ${
              masteryAvg >= 80 ? "text-emerald-300" : masteryAvg >= 60 ? "text-amber-300" : "text-rose-300"
            }`}
          >
            {mastery.length > 0 ? masteryAvg : "—"}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">{mastery.length} 个技能</div>
        </div>
        <div className="card text-center">
          <div className="text-[11px] text-slate-400">勋章</div>
          <div className="font-display font-bold text-xl text-rose-300 mt-1">{ownedCount}</div>
          <div className="text-[10px] text-slate-500 mt-1">
            / {CHINESE_TROPHIES.length} 类型
          </div>
        </div>
      </div>

      {/* 错题入口（暂时只显示数量；点击进 train review 模式 — Phase 3 做完整错题复活页） */}
      {openMistakes > 0 && (
        <div className="card bg-rose-500/10 border border-rose-400/30">
          <div className="flex items-center gap-3">
            <div className="text-2xl">📝</div>
            <div className="flex-1">
              <div className="font-semibold text-rose-100">
                有 {openMistakes} 道题最近答错了
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                期中后会做"错题复活"专项训练。现在重练一组练熟即可。
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 单元卡 */}
      <div>
        <div className="text-sm text-slate-400 mb-2">按单元练习</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {subject.units.map((u) => {
            const unitQ = subject.seedQuestions.filter((q) => q.unit_id === u.id).length;
            const unitSk = subject.skills.filter((s) => s.unitId === u.id).length;
            // 该单元 mastery 平均
            const unitMastery = mastery.filter((m) => {
              const skill = subject.skills.find((s) => s.id === m.skillId);
              return skill?.unitId === u.id;
            });
            const unitAvg =
              unitMastery.length > 0
                ? Math.round(unitMastery.reduce((s, x) => s + x.score, 0) / unitMastery.length)
                : null;
            return (
              <Link
                key={u.id}
                to={`/chinese/free-practice?unitId=${encodeURIComponent(u.id)}&fresh=${Date.now()}`}
                className="card hover:bg-ink-700/60 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div className="text-amber-300 text-lg leading-none mt-0.5">📖</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold flex items-center justify-between gap-2">
                      <span className="truncate">{u.name}</span>
                      {unitAvg !== null && (
                        <span
                          className={`text-[10px] chip border ${
                            unitAvg >= 80
                              ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
                              : unitAvg >= 60
                                ? "bg-amber-500/20 text-amber-200 border-amber-400/40"
                                : "bg-rose-500/20 text-rose-200 border-rose-400/40"
                          }`}
                        >
                          {unitAvg}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      {u.description}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-2">
                      {unitSk} 个技能 · {unitQ} 道题
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 勋章墙 */}
      <div>
        <div className="text-sm text-slate-400 mb-2 flex items-center justify-between">
          <span>勋章墙</span>
          <span className="text-[11px] text-slate-500">
            {ownedCount > 0 ? `已解锁 ${ownedCount} 枚` : "还没有勋章，做题就能拿"}
          </span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {CHINESE_TROPHIES.map((def) => {
            const owned = trophyState?.ownedCounts.get(def.id) ?? 0;
            const isOwned = owned > 0;
            return (
              <div
                key={def.id}
                className={`relative aspect-square rounded-xl border flex flex-col items-center justify-center text-center p-1 ${
                  isOwned
                    ? "bg-gradient-to-br from-amber-500/20 to-rose-500/20 border-amber-400/40"
                    : "bg-ink-800/40 border-ink-700/60 opacity-50"
                }`}
                title={`${def.name}：${def.description}`}
              >
                <div className={`text-2xl ${isOwned ? "" : "grayscale"}`}>{def.icon}</div>
                <div className="text-[9px] font-semibold mt-0.5 leading-tight">
                  {def.name}
                </div>
                {owned > 1 && (
                  <div className="absolute top-0.5 right-0.5 text-[9px] bg-rose-500/40 text-rose-50 rounded-full px-1 leading-none py-0.5">
                    ×{owned}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 听写说明 */}
      <div className="card text-sm text-slate-300">
        <div className="font-semibold mb-1">🎧 听写题怎么做</div>
        <div className="text-xs text-slate-400 leading-relaxed">
          看到 ▶ 按钮，先点一下听一遍小进读的词，再从下面四个写法里选正确的。
          可以多次播放，但要靠耳朵分辨。
        </div>
      </div>

      <div className="text-center text-[11px] text-slate-500 mt-2 space-y-1">
        <div>题库：{totalQuestions} 道题 · {totalSkills} 个技能 · 4 个单元（人教版四下）</div>
        <div>期中后会扩到 200+ 题 + 课内阅读 + 错题复活专项</div>
      </div>
    </div>
  );
}
