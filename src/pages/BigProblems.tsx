/**
 * Big Problems Camp — 大题营 landing。
 *
 * Phase 2 Axis 1：多步应用题专练，5 道/场，不限时。区别于今日挑战 15 题闪电式，
 * 这里 cognitive load 高 — 但仍然走主 XP / Elo 系统（这是真实 skill 题）。
 *
 * 实际的训练页直接复用 /math/train?mode=big_problems。本页面只做入口介绍。
 */

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { db } from "../db/dexie";
import { SEED_QUESTIONS } from "../content/questions";
import type { Question } from "../core/types";

export function BigProblemsPage() {
  const [counts, setCounts] = useState<{
    totalEligible: number;
    bySkill: number;
  } | null>(null);

  useEffect(() => {
    void (async () => {
      const all = await db.questions.toArray();
      const pool = all.length > 0 ? all : (SEED_QUESTIONS as Question[]);
      const eligible = pool.filter(
        (q: Question) =>
          q.difficulty >= 3 &&
          q.difficulty <= 4 &&
          Array.isArray(q.subquestions) &&
          q.subquestions.length > 0,
      );
      const skillSet = new Set(eligible.map((q: Question) => q.skill_id));
      setCounts({ totalEligible: eligible.length, bySkill: skillSet.size });
    })();
  }, []);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display font-bold text-2xl text-brand">大题营</h1>
        <p className="text-sm text-slate-300 mt-1">
          多步应用题专练 — 单步搞定不算高手，把题目"翻译"成数学才算。每场 5 道，
          不计时。XP / Elo 跟今日挑战一样涨。
        </p>
      </header>

      <section className="rounded-3xl bg-gradient-to-br from-orange-500/30 via-rose-500/20 to-violet-500/30 border border-orange-400/40 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="text-4xl">🧗</div>
          <div>
            <div className="font-display font-bold text-lg text-orange-100">单场 5 道大题</div>
            <div className="text-xs text-orange-200/80">D3-D4 多步应用题，含分步小问。</div>
          </div>
        </div>

        {counts && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-black/20 px-3 py-2">
              <div className="text-xs text-slate-400">题库可选</div>
              <div className="font-display font-bold text-2xl text-amber-200 tabular-nums">
                {counts.totalEligible}
              </div>
              <div className="text-[11px] text-slate-400">道大题</div>
            </div>
            <div className="rounded-xl bg-black/20 px-3 py-2">
              <div className="text-xs text-slate-400">覆盖技能</div>
              <div className="font-display font-bold text-2xl text-violet-200 tabular-nums">
                {counts.bySkill}
              </div>
              <div className="text-[11px] text-slate-400">个 skill</div>
            </div>
          </div>
        )}

        <Link
          to="../train?mode=big_problems&fresh=1"
          className="mt-5 block w-full text-center btn-primary py-3 font-display text-base"
        >
          ▶ 开始 5 道大题
        </Link>
      </section>

      <section className="rounded-2xl border border-ink-700/50 bg-ink-900/40 p-4 text-xs text-slate-400 leading-relaxed">
        💡 跟今日挑战的区别：
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>大题需要分步答（子问题逐步解锁），cognitive load 高，**不限时**</li>
          <li>每场 5 道（vs. 今日挑战 15 道）</li>
          <li>难度全部 D3-D4，期中/期末重点题型</li>
          <li>XP / Elo / 错题复活 / mastery 跟主线一样累计</li>
        </ul>
      </section>
    </div>
  );
}
