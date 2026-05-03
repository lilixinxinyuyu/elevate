/**
 * 语文首页 — 简化版，不接入 mastery / trophy / rating（期中后再做）。
 *
 * 重点：
 *  - 大按钮"开始今日挑战"→ /chinese/train
 *  - 4 个单元卡，点击进 /chinese/free-practice?unitId=...
 *  - 期中倒计时（沿用 examDates 的 MIDTERM）
 *  - 题库总数小字（让 Selena 知道有多少题可以练）
 */

import { Link } from "react-router-dom";
import { useSubject } from "../../subjects/context";
import { MIDTERM, daysUntil } from "../../core/examDates";

export function ChineseHomePage() {
  const subject = useSubject();
  const totalQuestions = subject.seedQuestions.length;
  const totalSkills = subject.skills.length;
  const days = daysUntil(MIDTERM.date);

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

      {/* 单元卡 */}
      <div>
        <div className="text-sm text-slate-400 mb-2">按单元练习</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {subject.units.map((u) => {
            const unitQ = subject.seedQuestions.filter((q) => q.unit_id === u.id).length;
            const unitSk = subject.skills.filter((s) => s.unitId === u.id).length;
            return (
              <Link
                key={u.id}
                to={`/chinese/free-practice?unitId=${encodeURIComponent(u.id)}&fresh=${Date.now()}`}
                className="card hover:bg-ink-700/60 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div className="text-amber-300 text-lg leading-none mt-0.5">📖</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{u.name}</div>
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

      {/* 听写说明 */}
      <div className="card text-sm text-slate-300">
        <div className="font-semibold mb-1">🎧 听写题怎么做</div>
        <div className="text-xs text-slate-400 leading-relaxed">
          看到 ▶ 按钮，先点一下听一遍小晴姐姐读的词，再从下面四个写法里选正确的。
          可以多次播放，但要靠耳朵分辨。
        </div>
      </div>

      {/* 题库统计 + Phase 2 说明 */}
      <div className="text-center text-[11px] text-slate-500 mt-2 space-y-1">
        <div>题库：{totalQuestions} 道题 · {totalSkills} 个技能 · 4 个单元（人教版四下）</div>
        <div>期中考完后会扩到 200+ 题 + 课内阅读 + 病句修改 + 句子排序</div>
      </div>
    </div>
  );
}
