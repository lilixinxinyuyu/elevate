/**
 * 闯关 v3 BOSS 战 (v0.31.49)
 *
 * 路由：/math/boss-battle/:unitId
 *
 * 状态机：
 *   loading → intro (1.5s) → playing (7 题分 3 phase) → victory | defeat
 *
 * 视觉布局：
 *   ┌─────────────────────────────────────┐
 *   │ ← 退出  [hearts ❤️❤️❤️] [📞救场×N]    │
 *   │ [boss 头像 + HP 条]                   │
 *   │ [phase 指示 ●●○]  [题 X / 7]          │
 *   ├─────────────────────────────────────┤
 *   │ <题目区 — 复用 GameShell 现有模板>    │
 *   │                                     │
 *   └─────────────────────────────────────┘
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../db/dexie";
import {
  finalizeSession,
  getOrCreateSession,
  submitAttempt,
} from "../db/service";
import type {
  DailySession,
  Question,
} from "../core/types";
import { GameShell, type AttemptResult } from "../components/game/GameShell";
import { TutorPanel } from "../components/tutor/TutorPanel";
import { BossAvatar } from "../components/boss/BossAvatar";
import { sfx } from "../lib/sfx";
import {
  bossForUnit,
  type BossPersona,
} from "../core/bossPersonas";
import {
  getRescueAllowance,
  loadBossState,
  recordBossAttempt,
  starsFromAccuracy,
  type BossState,
} from "../lib/bossBattleState";
import type { RescueAllowance } from "../core/bossPersonas";
import { BossPanel } from "../components/boss/BossPanel";
import { HeartsBar } from "../components/boss/HeartsBar";
import { PhaseIndicator, phaseFromIndex, type Phase } from "../components/boss/PhaseIndicator";
import { LifelineButton, type LifelineChoice } from "../components/boss/LifelineButton";
import { VictoryScreen } from "../components/boss/VictoryScreen";
import { DefeatScreen } from "../components/boss/DefeatScreen";
import { UNITS } from "../content/units";

// v0.31.74: 3 → 2，且阶段切换不再 +1 心，整场 boss 只有 2 个生命，错 2 次 = defeat。
// 之前 3 心 + 阶段奖励 +1 → 几乎不可能 game-over，挑战感弱。
const MAX_HEARTS = 2;

interface QuestionResult {
  questionId: string;
  isCorrect: boolean;
  skipped: boolean; // 救场跳过
  hintUsed: boolean; // 救场看提示
}

type Stage =
  | { kind: "loading" }
  | { kind: "missing_unit" }
  | { kind: "intro"; boss: BossPersona; questions: Question[]; session: DailySession; studentId: string; rescue: RescueAllowance; bossState: BossState }
  | { kind: "playing"; boss: BossPersona; questions: Question[]; session: DailySession; studentId: string; index: number; hearts: number; rescuesRemaining: number; rescue: RescueAllowance; bossState: BossState; results: QuestionResult[] }
  | { kind: "phase_break"; boss: BossPersona; nextPhase: Phase; nextStageBuilder: () => Stage }
  | { kind: "victory"; boss: BossPersona; stars: 1 | 2 | 3 | 4; bestStarsBefore: number; correct: number; total: number; xpEarned: number }
  | { kind: "defeat"; boss: BossPersona; correct: number; totalAnswered: number };

export function BossBattlePage() {
  const params = useParams<{ unitId: string }>();
  const navigate = useNavigate();
  const unitId = params.unitId ?? "";
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  const finalizingRef = useRef(false);
  // 临时存的 hint reveal 状态：lifeline 选了"看提示"后给 GameShell 自动展开提示
  const [autoRevealHint, setAutoRevealHint] = useState(0);
  // v0.31.74：小进讲题 panel 打开。两条触发路径：
  //   1. lifeline modal "听小进讲题" 直接选
  //   2. 答错且用过 hint 后，下方 CTA "继续不会？让小进讲题"
  const [tutorContext, setTutorContext] = useState<{
    questionId: string;
    stem: string;
    skillId: string;
    skillName?: string;
    studentAnswer?: string;
  } | null>(null);
  // v0.31.74：上一题答错且用过 hint，下一题渲染前显示 escalate CTA
  const [showTutorCta, setShowTutorCta] = useState(false);

  // 初始加载：拉 session + boss state + rescue 配额
  useEffect(() => {
    if (!unitId) {
      setStage({ kind: "missing_unit" });
      return;
    }
    const boss = bossForUnit(unitId);
    if (!boss) {
      setStage({ kind: "missing_unit" });
      return;
    }
    void (async () => {
      const ss = await db.students.toArray();
      const student = ss[0];
      if (!student) {
        setStage({ kind: "missing_unit" });
        return;
      }
      const { session, questions } = await getOrCreateSession(student.id, {
        mode: "big_problems",
        unitId,
        fresh: true, // 每次 boss 战都新开 session
      });
      const rescue = await getRescueAllowance(student.id);
      const bossState = await loadBossState(student.id, unitId);
      if (questions.length === 0) {
        setStage({ kind: "missing_unit" });
        return;
      }
      setStage({
        kind: "intro",
        boss,
        questions,
        session,
        studentId: student.id,
        rescue,
        bossState,
      });
      // intro 1.5s 后自动进入 playing
      setTimeout(() => {
        setStage((s) => {
          if (s.kind !== "intro") return s;
          return {
            kind: "playing",
            boss: s.boss,
            questions: s.questions,
            session: s.session,
            studentId: s.studentId,
            index: 0,
            hearts: MAX_HEARTS,
            rescuesRemaining: s.rescue.count,
            rescue: s.rescue,
            bossState: s.bossState,
            results: [],
          };
        });
      }, 1500);
    })();
  }, [unitId]);

  const computeHpPct = useCallback((results: QuestionResult[], total: number): number => {
    // 每题打掉 100/total% HP；答对全部削，答错削一半，跳过削 30%
    let dmg = 0;
    for (const r of results) {
      if (r.isCorrect) dmg += 1;
      else if (r.skipped) dmg += 0.3;
      else dmg += 0.4;
    }
    return Math.max(0, 1 - dmg / total);
  }, []);

  const handleSubmit = useCallback(
    async (result: AttemptResult) => {
      if (stage.kind !== "playing") return { points: 0 };
      const { session, studentId, questions, index } = stage;
      const q = questions[index]!;
      const outcome = await submitAttempt({
        studentId,
        session,
        question: q,
        userAnswer: result.answer,
        isCorrect: result.isCorrect,
        partialCorrect: result.partialCorrect,
        matchedErrorTags: result.matchedErrorTags,
        hintsOpened: result.hintsOpened,
        elapsedSeconds: result.elapsedSeconds,
        comboBeforeAttempt: 0,
        usedTutor: result.usedTutor,
        attemptOrdinal: result.attemptOrdinal,
      });
      return {
        points: outcome.points,
        repeatDecay: outcome.repeatDecay,
        newSkillBonus: outcome.newSkillBonus,
        errorPattern: outcome.errorPattern,
      };
    },
    [stage],
  );

  const handleNext = useCallback(async () => {
    if (stage.kind !== "playing") return;
    const { questions, index, results, hearts, boss, session, studentId, rescue } = stage;
    const nextIdx = index + 1;
    const curPhase = phaseFromIndex(index);
    const nextPhase = nextIdx < questions.length ? phaseFromIndex(nextIdx) : null;
    const battleEnded =
      hearts === 0 ||
      nextIdx >= questions.length;

    if (battleEnded) {
      if (finalizingRef.current) return;
      finalizingRef.current = true;
      try {
        const summary = await finalizeSession(studentId, session.id);
        const correct = results.filter((r) => r.isCorrect).length;
        const totalQs = questions.length;
        // 计算 stars 一次（noRetry 模式 onAnswerLogged 不会双计）
        const computedStars: 0 | 1 | 2 | 3 | 4 =
          hearts === 0 ? 0 : starsFromAccuracy(correct, totalQs, hearts);

        // v0.31.86: 把 hearts 和 stars 回写到 session.summary，让 Home 焦点环
        // 直接读 bossStars，不用拿不到 hearts 的 starsFromAccuracy(correct, total)
        // fallback（4 星会虚高）。
        try {
          const fresh = await db.sessions.get(session.id);
          if (fresh && fresh.summary) {
            fresh.summary.bossStars = computedStars;
            fresh.summary.bossHeartsLeft = hearts;
            await db.sessions.put(fresh);
          }
        } catch (writeErr) {
          console.warn("[BossBattle] write bossStars to summary failed:", writeErr);
        }

        // v0.31.83: 简化 defeat 条件 — hearts === 0 = defeat（不再 "&& correct < 4"，
        // 那个旧条件让"血没了但 retry 蒙对了 4 题"的题逃过 defeat）
        if (hearts === 0) {
          setStage({
            kind: "defeat",
            boss,
            correct,
            totalAnswered: results.length,
          });
        } else {
          // 通关算 stars
          const stars = computedStars;
          const bestStarsBefore = stage.bossState.bestStars;
          const newState = await recordBossAttempt(studentId, unitId, stars);
          const unlocked = (() => {
            if (stars === 4 && newState.perfectCount === 1) return "完美通关勋章";
            if (stars >= 1 && bestStarsBefore === 0) return `${boss.name} 单元印章`;
            return null;
          })();
          if (stars === 0) {
            setStage({
              kind: "defeat",
              boss,
              correct,
              totalAnswered: results.length,
            });
          } else {
            setStage({
              kind: "victory",
              boss,
              stars: stars as 1 | 2 | 3 | 4,
              bestStarsBefore,
              correct,
              total: totalQs,
              xpEarned: summary.xpGained,
              ...(unlocked ? { unlockedTrophy: unlocked } : {}),
            });
          }
        }
      } catch (e) {
        console.error("[BossBattle] finalize failed", e);
      } finally {
        finalizingRef.current = false;
      }
      return;
    }

    // 正常推进 — 如果切了阶段，先弹 1.5s phase break
    if (nextPhase && nextPhase !== curPhase) {
      // v0.31.74: 阶段切换不再 +1 心 — 心数完全carry over，整场 boss 只有 MAX_HEARTS=2 条命
      const heartsAfter = hearts;
      const breakStage: Stage = {
        kind: "phase_break",
        boss,
        nextPhase,
        nextStageBuilder: () => ({
          kind: "playing",
          boss,
          questions,
          session,
          studentId,
          index: nextIdx,
          hearts: heartsAfter,
          rescuesRemaining: stage.rescuesRemaining,
          rescue,
          bossState: stage.bossState,
          results,
        }),
      };
      // v0.31.74：阶段切换也清掉 escalate CTA（CTA 只针对刚才那道）
      setShowTutorCta(false);
      setStage(breakStage);
      // 1.5s 后切到下一阶段
      setTimeout(() => {
        setStage((s) => (s.kind === "phase_break" ? s.nextStageBuilder() : s));
      }, 1500);
      return;
    }

    // 同阶段下一题
    // v0.31.74：进入下一题清掉 escalate CTA（CTA 只针对刚才那道）
    setShowTutorCta(false);
    setStage({
      ...stage,
      index: nextIdx,
    });
  }, [stage, unitId]);

  const onAnswerLogged = useCallback(
    (isCorrect: boolean, hintUsed: boolean) => {
      if (stage.kind !== "playing") return;
      const { questions, index, results, hearts } = stage;
      const q = questions[index]!;
      const newResult: QuestionResult = {
        questionId: q.question_id,
        isCorrect,
        skipped: false,
        hintUsed,
      };
      // hearts: 错答 -1
      const newHearts = isCorrect ? hearts : Math.max(0, hearts - 1);
      if (!isCorrect) {
        sfx.wrong();
      }
      // v0.31.74：答错且用过 hint → 升级到"让小进讲题"CTA
      // 让 Selena 知道还有补救的方法，不只是 hint 一条路
      if (!isCorrect && hintUsed) {
        setShowTutorCta(true);
      }
      setStage({
        ...stage,
        results: [...results, newResult],
        hearts: newHearts,
      });
    },
    [stage],
  );

  // v0.31.74：从 escalate CTA 触发的"让小进讲题"——不消耗救场名额
  const onEscalateToTutor = useCallback(() => {
    if (stage.kind !== "playing") return;
    const q = stage.questions[stage.index]!;
    setTutorContext({
      questionId: q.question_id,
      stem: q.stem,
      skillId: q.skill_id,
      skillName: q.skill_name,
    });
    setShowTutorCta(false);
  }, [stage]);

  const onUseLifeline = useCallback(
    (choice: LifelineChoice) => {
      if (stage.kind !== "playing") return;
      const { questions, index, results, hearts, rescuesRemaining, rescue } = stage;
      if (rescuesRemaining <= 0) return;
      const q = questions[index]!;
      if (choice === "skip") {
        // 跳过：不算对错，0 XP
        const newResult: QuestionResult = {
          questionId: q.question_id,
          isCorrect: false,
          skipped: true,
          hintUsed: false,
        };
        setStage({
          ...stage,
          rescuesRemaining: rescuesRemaining - 1,
          results: [...results, newResult],
        });
        // 然后立即进入下一题
        setTimeout(() => {
          handleNext();
        }, 100);
      } else if (choice === "explain") {
        // v0.31.74：直接打开 TutorPanel — 让小进苏格拉底讲题，不只是展开 hint
        setTutorContext({
          questionId: q.question_id,
          stem: q.stem,
          skillId: q.skill_id,
          skillName: q.skill_name,
        });
        // 消耗 1 个救场名额
        setStage({
          ...stage,
          rescuesRemaining: rescuesRemaining - 1,
        });
      } else {
        // hint：展开提示，给 GameShell 一个信号
        setAutoRevealHint((n) => n + 1);
        setStage({
          ...stage,
          rescuesRemaining: rescuesRemaining - 1,
        });
        // 如果是 district+ 段位，答对后回血——这部分由 onAnswerLogged 触发，
        // 但 LifelineButton 里 allowance.refillHeartOnUse 会让 onAnswerLogged 加 +1 心。
        // 简化：用 allowance.refillHeartOnUse 作 flag，由 onAnswerLogged 检查。
        if (rescue.refillHeartOnUse && hearts < MAX_HEARTS) {
          // 标记为"下一次答对会回血"
          // （这里偷懒：直接立刻 +1，因为 hint 多半是答对的助力）
          setStage((s) => {
            if (s.kind !== "playing") return s;
            return { ...s, hearts: Math.min(MAX_HEARTS, s.hearts + 1) };
          });
        }
      }
    },
    [stage, handleNext],
  );

  // ============ Render ============

  if (stage.kind === "loading") {
    return <div className="card text-center text-slate-300 py-12">召唤 boss 中…</div>;
  }
  if (stage.kind === "missing_unit") {
    return (
      <div className="card text-center text-slate-300 py-8">
        <div className="text-2xl mb-2">⚠️</div>
        <div>这个单元没有 boss 数据 / 没题，去解锁更多 unit 再来。</div>
        <button type="button" onClick={() => navigate("/math/big-problems")} className="btn-primary mt-4">
          回闯关世界
        </button>
      </div>
    );
  }

  if (stage.kind === "intro") {
    return <IntroScreen boss={stage.boss} unitId={unitId} />;
  }

  if (stage.kind === "phase_break") {
    return <PhaseBreakScreen boss={stage.boss} phase={stage.nextPhase} />;
  }

  if (stage.kind === "victory") {
    return (
      <VictoryScreen
        boss={stage.boss}
        stars={stage.stars}
        bestStarsBefore={stage.bestStarsBefore}
        correct={stage.correct}
        total={stage.total}
        xpEarned={stage.xpEarned}
        onRetry={() => {
          setStage({ kind: "loading" });
          // 强制重新加载（fresh session）
          setTimeout(() => navigate(0), 50);
        }}
      />
    );
  }

  if (stage.kind === "defeat") {
    return (
      <DefeatScreen
        boss={stage.boss}
        correct={stage.correct}
        totalAnswered={stage.totalAnswered}
        onRetry={() => {
          setStage({ kind: "loading" });
          setTimeout(() => navigate(0), 50);
        }}
      />
    );
  }

  // playing
  const { boss, questions, index, hearts, rescuesRemaining, rescue, results, studentId } = stage;
  const q = questions[index]!;
  const phase = phaseFromIndex(index);
  const enraged = phase === "boss";
  const hpPct = computeHpPct(results, questions.length);

  return (
    <div className="space-y-3 relative">
      {/* Top: hearts + lifeline */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate("/math/big-problems")}
          className="text-xs text-slate-400 hover:text-slate-200"
        >
          ← 退出闯关
        </button>
        <div className="flex items-center gap-2">
          <HeartsBar hearts={hearts} max={MAX_HEARTS} />
          <LifelineButton
            remaining={rescuesRemaining}
            allowance={rescue}
            onUse={onUseLifeline}
          />
        </div>
      </div>

      {/* Boss panel */}
      <BossPanel boss={boss} hpPct={hpPct} enraged={enraged} />

      {/* Phase indicator (题序号由下方 GameShell 顶栏显示) */}
      <PhaseIndicator current={phase} />

      {/* Question via GameShell — pass autoRevealHint as resetKey for hint behavior */}
      <GameShell
        question={q}
        index={index}
        total={questions.length}
        xp={0}
        combo={0}
        countdownEnabled={false}
        examMode={false}
        // v0.31.83: 闯关 = 真挑战。1st 错答即定终局，不允许 silent + RetryHintPanel
        // + 变式重做。这避免了：
        //   1. 每题双重 onAnswerLogged 触发 → results 数组每题 2 entry → correct 计数膨胀
        //   2. retry 后看到正确答案再填上算对 → 4 星骗局
        noRetry={true}
        showStarter={false}
        onSubmit={async (result) => {
          const out = await handleSubmit(result);
          // log result for boss progress（noRetry=true 下 onSubmit 每题只触发一次）
          onAnswerLogged(result.isCorrect, (result.hintsOpened ?? 0) > 0 || autoRevealHint > 0);
          return out;
        }}
        onNext={handleNext}
      />

      {/* v0.31.74：答错且用过 hint 的 escalate CTA — 让小进讲题（不消耗救场名额）*/}
      {showTutorCta && !tutorContext && (
        <div className="card-glow border-amber-400/40 bg-gradient-to-br from-amber-500/15 to-orange-500/10 animate-slide-up">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🧙‍♀️</div>
            <div className="flex-1">
              <div className="font-display font-bold text-amber-100 text-sm">
                继续不会？让小进讲题
              </div>
              <div className="text-xs text-slate-300 mt-0.5">
                提示用了还卡 — 让小进苏格拉底式一步步带你想，**不消耗救场名额**
              </div>
            </div>
            <button
              type="button"
              onClick={onEscalateToTutor}
              className="btn-primary text-sm px-4 py-2 shrink-0"
            >
              叫小进
            </button>
          </div>
        </div>
      )}

      {/* v0.31.74：TutorPanel — 由 lifeline "讲题" 或 escalate CTA 触发 */}
      {tutorContext && (
        <TutorPanel
          subjectId="math"
          stem={tutorContext.stem}
          skillName={tutorContext.skillName}
          questionId={tutorContext.questionId}
          skillId={tutorContext.skillId}
          studentId={studentId}
          context="wrong_retry"
          onClose={() => setTutorContext(null)}
        />
      )}
    </div>
  );
}

function IntroScreen({ boss, unitId }: { boss: BossPersona; unitId: string }) {
  const unit = UNITS.find((u) => u.id === unitId);
  return (
    <div className="card-glow text-center py-12 animate-slide-up">
      <div className="inline-flex justify-center animate-pop">
        <BossAvatar
          unitId={boss.unitId}
          emoji={boss.emoji}
          size={144}
          className="rounded-3xl shadow-glow"
          alt={boss.name}
        />
      </div>
      <div className="font-display font-bold text-2xl text-amber-100 mt-3">
        {boss.name}
      </div>
      <div className="text-sm text-slate-300 italic mt-2">"{boss.tagline}"</div>
      <div className="text-xs text-slate-400 mt-4">
        准备挑战 · {unit?.name ?? unitId}
      </div>
    </div>
  );
}

function PhaseBreakScreen({ boss, phase }: { boss: BossPersona; phase: Phase }) {
  const messages: Record<Phase, { title: string; sub: string }> = {
    warmup: { title: "🔥 进入热身", sub: "开战前先来几道入门" },
    main: { title: "⚔️ 进入主战", sub: "boss 已被削弱，加把劲！" },
    boss: { title: "👑 BOSS 出击！", sub: "终极挑战，全力以赴" },
  };
  const m = messages[phase];
  return (
    <div className="card-glow text-center py-12 animate-slide-up bg-gradient-to-br from-amber-500/15 to-rose-500/10">
      <div className="inline-flex justify-center">
        <BossAvatar
          unitId={boss.unitId}
          emoji={boss.emoji}
          size={88}
          className="rounded-2xl"
          alt={boss.name}
        />
      </div>
      <div className="font-display font-bold text-2xl mt-3 text-amber-100">{m.title}</div>
      <div className="text-sm text-slate-300 mt-2">{m.sub}</div>
    </div>
  );
}
