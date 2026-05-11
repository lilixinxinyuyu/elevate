/**
 * 技能图 (Skills Constellation) — v0.31.89
 *
 * 把原来 /math/skills 的表格 + /math/free-practice 的勾选合并成一个
 * "星座式技能图"：每 unit 一个 card，card 内 skill 节点按蜂巢点阵排布。
 *
 * 交互：
 *   - 单击节点 → 直接进 train（单 skill）
 *   - 顶部 "组合练习" toggle → 开启后点击变多选 + 顶部 sticky 篮子 + "一起练" CTA
 *   - 未解锁 unit：整个 unit 暗化 + 🔒 chip + 节点禁用
 *
 * 视觉：
 *   - 节点圆 — 直径随 mastery 增大（36px → 80px），颜色随 mastery 变亮
 *   - "未涉足"节点（score=0）暗灰小圆 + 虚边
 *   - "精通"（≥ 90）节点带紫色光晕 (shadow-glow-violet)
 *   - "脆弱"（21 天没碰 / 最近 5 题错 ≥3）节点角标 ⚠
 *
 * Bruce v0.31.88 反馈：
 *   - 节点点击直接进 train ✓
 *   - 保留"一次选多个一起练" ✓（toggle 模式）
 *   - 未学到的 unit 锁住 ✓（用 getUnlockedUnitIdSet）
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { UNITS } from "../content/units";
import { SKILLS } from "../content/skills";
import { masteryLabel } from "../lib/format";
import { getSelectedTerm, setSelectedTerm } from "../db/service";
import { getUnlockedUnitIdSet, UNIT_UNLOCK_SCHEDULE } from "../db/unitUnlock";
import type { MasteryScore, Skill, Term } from "../core/types";
import { TutorPanel } from "./tutor/TutorPanel";

type ComboMode = "off" | "on";

export function SkillsConstellation() {
  const navigate = useNavigate();
  const student = useLiveQuery(async () => (await db.students.toArray())[0]);
  const mastery = useLiveQuery(
    async () => (student ? db.mastery.where({ studentId: student.id }).toArray() : []),
    [student?.id],
  );
  const questionCounts = useLiveQuery(async () => {
    const all = await db.questions.toArray();
    const counts = new Map<string, number>();
    for (const q of all) counts.set(q.skill_id, (counts.get(q.skill_id) ?? 0) + 1);
    return counts;
  });

  const [term, setTerm] = useState<Term>("下册");
  const [combo, setCombo] = useState<ComboMode>("off");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tutorSkill, setTutorSkill] = useState<{ id: string; name: string } | null>(null);
  const [unlockedUnits, setUnlockedUnits] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!student) return;
    getSelectedTerm(student.id).then(setTerm);
  }, [student?.id]);

  useEffect(() => {
    if (!student) return;
    getUnlockedUnitIdSet(student.id, term).then(setUnlockedUnits);
  }, [student?.id, term]);

  const masteryMap = useMemo(
    () => new Map((mastery ?? []).map((m) => [m.skillId, m])),
    [mastery],
  );

  const handleSwitchTerm = async (t: Term) => {
    if (!student) return;
    setTerm(t);
    setSelected(new Set());
    await setSelectedTerm(student.id, t);
  };

  function toggleSelect(skillId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  }

  function handleNodeClick(skillId: string, disabled: boolean) {
    if (disabled) return;
    if (combo === "on") {
      toggleSelect(skillId);
    } else {
      navigate(`/math/train?skillId=${encodeURIComponent(skillId)}&fresh=${Date.now()}`);
    }
  }

  function startCombo() {
    if (selected.size === 0) return;
    navigate(`/math/train?skillIds=${Array.from(selected).join(",")}&fresh=${Date.now()}`);
  }

  if (!student) return <div className="card">加载中…</div>;

  const visibleTerms: Term[] = term === "综合复习" ? ["下册", "上册"] : [term];

  return (
    <div className="space-y-5 pb-24">
      {/* Header — v0.31.91：组合模式按钮放大 + 单独成行 hero CTA，
          下方圆圈节点不再"抢眼"。组合按钮带主色调底 + 脉冲动效。 */}
      <header className="card-glow border-violet-400/20 bg-gradient-to-br from-violet-500/10 via-indigo-500/10 to-pink-500/5">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="text-3xl shrink-0">🌌</div>
          <div className="flex-1 min-w-[180px]">
            <h1 className="font-display font-bold text-xl text-brand">技能图</h1>
            <div className="text-xs text-slate-300 mt-0.5">
              单击节点 → 直接练这一个 skill
            </div>
          </div>
        </div>
        {/* 组合模式 CTA — 占据整行宽，比小 chip 显眼很多 */}
        <button
          type="button"
          onClick={() => {
            const next: ComboMode = combo === "on" ? "off" : "on";
            setCombo(next);
            if (next === "off") setSelected(new Set());
          }}
          className={`mt-3 w-full rounded-xl border-2 px-4 py-3 flex items-center justify-between gap-3 transition-all ${
            combo === "on"
              ? "bg-gradient-to-r from-violet-500/30 to-pink-500/25 border-violet-300/70 text-violet-50 shadow-glow-violet"
              : "bg-white/[0.04] border-violet-400/40 text-violet-100 hover:bg-violet-500/15 hover:border-violet-300/60"
          }`}
          aria-pressed={combo === "on"}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl shrink-0" aria-hidden>
              {combo === "on" ? "🎯" : "⊕"}
            </span>
            <div className="text-left min-w-0">
              <div className="font-display font-bold text-base">
                {combo === "on"
                  ? `组合模式 · 已选 ${selected.size} 个`
                  : "开启组合模式"}
              </div>
              <div className="text-[11px] opacity-80 mt-0.5">
                {combo === "on"
                  ? `再点节点继续添加 · 底部「一起练 →」提交`
                  : "想一次练多个 skill？开启后点节点变多选"}
              </div>
            </div>
          </div>
          <div className="text-xl shrink-0">{combo === "on" ? "✓" : "→"}</div>
        </button>
      </header>

      <TermSwitcher term={term} onSwitch={handleSwitchTerm} />

      {tutorSkill && student && (
        <TutorPanel
          subjectId="math"
          context="skill_help"
          studentId={student.id}
          skillId={tutorSkill.id}
          skillName={tutorSkill.name}
          onClose={() => setTutorSkill(null)}
        />
      )}

      {visibleTerms.map((t) => {
        const units = UNITS.filter((u) => u.term === t).sort(
          (a, b) => a.orderIndex - b.orderIndex,
        );
        return (
          <section key={t} className="space-y-3">
            <h2 className="text-base font-display font-bold text-slate-200">{t}</h2>
            {units.map((u) => {
              const skills = SKILLS.filter((s) => s.unitId === u.id);
              if (skills.length === 0) return null;
              const locked = unlockedUnits != null && !unlockedUnits.has(u.id);
              const scheduledAt = UNIT_UNLOCK_SCHEDULE[u.id];
              return (
                <UnitConstellation
                  key={u.id}
                  unit={u}
                  skills={skills}
                  locked={locked}
                  scheduledAt={scheduledAt}
                  masteryMap={masteryMap}
                  questionCounts={questionCounts}
                  selected={selected}
                  combo={combo}
                  onNodeClick={handleNodeClick}
                  onTutor={(s) => setTutorSkill(s)}
                />
              );
            })}
          </section>
        );
      })}

      <MasteryLegend />

      {/* 组合模式下：底部固定篮子 */}
      {combo === "on" && (
        <div className="fixed bottom-4 left-4 right-4 z-30 sm:left-auto sm:max-w-md sm:right-6 animate-slide-up">
          <div className="rounded-2xl bg-ink-900/95 backdrop-blur-md border border-violet-400/40 shadow-glow-violet px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-400">已选 {selected.size} 个 skill</div>
              <div className="text-[11px] text-slate-300 truncate">
                {selected.size === 0
                  ? "点节点添加进篮子"
                  : Array.from(selected)
                      .map((id) => SKILLS.find((s) => s.id === id)?.name ?? id)
                      .slice(0, 3)
                      .join(" · ") + (selected.size > 3 ? "…" : "")}
              </div>
            </div>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                清空
              </button>
            )}
            <button
              type="button"
              onClick={startCombo}
              disabled={selected.size === 0}
              className="btn-primary text-sm px-4 py-2 disabled:opacity-40"
            >
              一起练 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// v0.31.91: ComboToggle 删除 — 改为 header 内大 CTA 按钮

// ────────────────────────────────────────────────────────────

function UnitConstellation({
  unit,
  skills,
  locked,
  scheduledAt,
  masteryMap,
  questionCounts,
  selected,
  combo,
  onNodeClick,
  onTutor,
}: {
  unit: (typeof UNITS)[number];
  skills: Skill[];
  locked: boolean;
  scheduledAt?: string;
  masteryMap: Map<string, MasteryScore>;
  questionCounts: Map<string, number> | undefined;
  selected: Set<string>;
  combo: ComboMode;
  onNodeClick: (skillId: string, disabled: boolean) => void;
  onTutor: (s: { id: string; name: string }) => void;
}) {
  // 单元整体进度（已练过的 skill 占比 + 平均 mastery）
  const stats = useMemo(() => {
    let touched = 0;
    let avg = 0;
    for (const s of skills) {
      const m = masteryMap.get(s.id);
      if (m && m.score > 0) {
        touched += 1;
        avg += m.score;
      }
    }
    return {
      touched,
      total: skills.length,
      avgScore: touched > 0 ? Math.round(avg / touched) : 0,
    };
  }, [skills, masteryMap]);

  return (
    <div
      className={`card relative overflow-hidden ${
        locked ? "opacity-70" : ""
      }`}
    >
      {/* Unit 标题 */}
      <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-display font-semibold text-slate-100 text-base">
              {unit.name}
            </div>
            {locked && (
              <span className="chip text-[10px] bg-slate-700/50 text-slate-300 border border-slate-500/40">
                🔒 {scheduledAt ? `${scheduledAt} 开放` : "完成前置单元后解锁"}
              </span>
            )}
          </div>
          {unit.description && (
            <div className="text-[11px] text-slate-400 mt-0.5">
              {unit.description}
            </div>
          )}
        </div>
        {!locked && stats.touched > 0 && (
          <div className="text-right">
            <div className="text-[10px] text-slate-400">单元平均</div>
            <div className="font-display font-bold text-amber-200 text-base">
              {stats.avgScore}
            </div>
          </div>
        )}
      </div>

      {/* 节点蜂巢 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {skills.map((s) => {
          const m = masteryMap.get(s.id);
          const score = m?.score ?? 0;
          const count = questionCounts?.get(s.id) ?? 0;
          const isSelected = selected.has(s.id);
          const noPool = count === 0;
          const disabled = locked || noPool;

          // 节点尺寸：score 0→未涉足小一些；score 100→大
          const sizePx = noPool
            ? 44
            : Math.round(46 + (score / 100) * 28); // 46-74 px

          // 脆弱判定
          const recent5 = (m?.recent ?? []).slice(-5);
          const last5Wrong = recent5.filter((r) => !r.correct).length;
          const daysSinceSuccess =
            m?.lastSuccessAt
              ? (Date.now() - m.lastSuccessAt) / 86_400_000
              : Infinity;
          const fragile =
            score > 0 && (daysSinceSuccess > 21 || last5Wrong >= 3);

          return (
            <SkillNode
              key={s.id}
              skill={s}
              score={score}
              count={count}
              disabled={disabled}
              fragile={fragile}
              isSelected={isSelected}
              combo={combo}
              sizePx={sizePx}
              onClick={() => onNodeClick(s.id, disabled)}
              onTutor={() => onTutor({ id: s.id, name: s.name })}
            />
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────

function SkillNode({
  skill,
  score,
  count,
  disabled,
  fragile,
  isSelected,
  combo,
  sizePx,
  onClick,
  onTutor,
}: {
  skill: Skill;
  score: number;
  count: number;
  disabled: boolean;
  fragile: boolean;
  isSelected: boolean;
  combo: ComboMode;
  sizePx: number;
  onClick: () => void;
  onTutor: () => void;
}) {
  // 节点的圆形配色（独立于 chip / list，因为这里节点 = 整张 card 主视觉）
  const circleCls = (() => {
    if (disabled) return "bg-ink-800/60 border-ink-700/60 text-slate-500";
    if (score >= 90)
      return "bg-violet-500/35 border-violet-300/80 text-violet-50 shadow-glow-violet";
    if (score >= 75)
      return "bg-emerald-500/30 border-emerald-300/70 text-emerald-50 shadow-glow-emerald";
    if (score >= 60)
      return "bg-amber-500/30 border-amber-300/70 text-amber-50 shadow-glow-amber";
    if (score >= 40)
      return "bg-orange-500/25 border-orange-300/60 text-orange-50";
    if (score > 0)
      return "bg-rose-500/20 border-rose-300/50 text-rose-50";
    return "bg-white/5 border-white/15 text-slate-300 border-dashed";
  })();

  const ring = isSelected
    ? "ring-2 ring-violet-300 ring-offset-2 ring-offset-ink-900"
    : "";

  const fragileMark = fragile ? (
    <span
      title="该复习了"
      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-ink-900"
    >
      ⚠
    </span>
  ) : null;

  const examMark = skill.examPriority === "MUST_BIG" ? (
    <span
      title="必考大题"
      className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-rose-400/90 text-white text-[10px] font-bold flex items-center justify-center border-2 border-ink-900"
    >
      ⭐
    </span>
  ) : null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`group w-full rounded-2xl border p-2.5 flex items-center gap-2.5 text-left transition-all ${
          disabled
            ? "bg-white/[0.02] border-white/5 opacity-60 cursor-not-allowed"
            : "bg-white/[0.03] border-ink-700/60 hover:bg-white/[0.07] hover:border-violet-400/40"
        } ${ring}`}
        title={
          disabled
            ? count === 0
              ? "题库无题"
              : "单元未解锁"
            : combo === "on"
              ? isSelected
                ? `已选 · 再点取消`
                : `点击加入组合篮`
              : `单击直接练「${skill.name}」`
        }
      >
        {/* 圆形节点 — 大小随 mastery */}
        <div
          className={`relative shrink-0 rounded-full border-2 flex items-center justify-center font-display font-bold transition-all ${circleCls}`}
          style={{ width: sizePx, height: sizePx, fontSize: Math.max(11, sizePx / 5) }}
        >
          {score > 0 ? Math.round(score) : "·"}
          {fragileMark}
          {examMark}
        </div>

        {/* 文字 */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] text-slate-100 leading-tight font-medium line-clamp-2">
            {skill.name}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
            <span>{masteryLabel(score)}</span>
            <span className="opacity-50">·</span>
            <span>{count} 题</span>
          </div>
        </div>

        {/* 选中态显示勾 / 默认显示 ▶ */}
        <div className="shrink-0 text-slate-400 text-base group-hover:text-violet-200">
          {combo === "on"
            ? isSelected
              ? "✓"
              : "+"
            : disabled
              ? "🔒"
              : "▶"}
        </div>
      </button>

      {/* 听小进 — 悬浮在节点右下角，组合模式下隐藏 */}
      {!disabled && combo === "off" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTutor();
          }}
          className="absolute bottom-1 right-1 chip text-[9px] px-1.5 py-0.5 bg-amber-500/15 border border-amber-400/40 text-amber-200 hover:bg-amber-500/30 transition-colors"
          title={`让小进讲讲「${skill.name}」`}
        >
          👩‍🏫
        </button>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────

function TermSwitcher({
  term,
  onSwitch,
}: {
  term: Term;
  onSwitch: (t: Term) => void;
}) {
  const TERMS: { id: Term; label: string }[] = [
    { id: "下册", label: "📚 下册" },
    { id: "上册", label: "📕 上册" },
    { id: "综合复习", label: "🎯 综合" },
  ];
  return (
    <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1">
      <span className="text-xs text-slate-400 shrink-0">学期：</span>
      {TERMS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSwitch(t.id)}
          className={`shrink-0 chip text-xs px-3 py-1.5 transition-all ${
            term === t.id
              ? "bg-violet-500/30 text-violet-100 border border-violet-400/60 shadow-glow-violet"
              : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function MasteryLegend() {
  const tiers: { range: string; label: string; cls: string }[] = [
    { range: "·", label: "未涉足", cls: "bg-white/5 border-white/15 text-slate-300" },
    { range: "1-39", label: "起步", cls: "bg-rose-500/20 border-rose-300/50 text-rose-100" },
    { range: "40-59", label: "进步中", cls: "bg-orange-500/25 border-orange-300/60 text-orange-100" },
    { range: "60-74", label: "较稳", cls: "bg-amber-500/30 border-amber-300/70 text-amber-100" },
    { range: "75-89", label: "熟练", cls: "bg-emerald-500/30 border-emerald-300/70 text-emerald-100" },
    { range: "90+", label: "精通 ✨", cls: "bg-violet-500/35 border-violet-300/80 text-violet-100" },
  ];
  return (
    <details className="card text-sm">
      <summary className="cursor-pointer font-display font-semibold text-slate-100 select-none">
        📊 节点颜色含义
      </summary>
      <div className="mt-3 space-y-3 text-xs text-slate-300 leading-relaxed">
        <div className="flex flex-wrap gap-1.5">
          {tiers.map((t) => (
            <span
              key={t.label}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${t.cls}`}
            >
              <span className="font-mono">{t.range}</span>
              <span>{t.label}</span>
            </span>
          ))}
        </div>
        <ul className="list-disc list-inside space-y-0.5 text-slate-400 pl-1">
          <li>圆越大、颜色越亮 = 越熟练（节点尺寸跟 mastery 一起涨）</li>
          <li>角标 ⚠️ = 21 天没碰 / 最近 5 题错 ≥3，该复习了</li>
          <li>角标 ⭐ = 必考大题，期末分高</li>
          <li>🔒 = 单元未解锁（按时间表或前置单元）</li>
        </ul>
        <div className="text-[11px] text-slate-500 pt-1 border-t border-ink-700/30">
          算法：最近 30 题加权命中率 × 50% + Elo × 30% + 多样性 × 20%
        </div>
      </div>
    </details>
  );
}

// 备用导出
export { TermSwitcher as _SkillsTermSwitcher };
