import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MATH_TRICKS, type MathTrick, type TrickPractice } from "../content/mathTricks";
import { db } from "../db/dexie";
import { getCompletedTricks, markTrickDone } from "../lib/mathTricksProgress";
import { MascotQuickAccess } from "../components/MascotQuickAccess";

/**
 * 巧算工具箱（v0.31.71 起步，v0.31.87 上云）：
 * 8 个核心心算技巧的展示 + 即时练习。
 *
 * 路由：/:subject/tricks（math-only）
 *
 * 设计：
 *  - 8 张卡片纵列；每张卡：标语、原理、worked example（默认折叠 1 个）、3 道动手练习
 *  - 练习输入数字、回车或点检查 → 即时反馈（对/错 + hint）
 *  - 全部答对一张卡 → 卡顶变绿 + 一个小烟花（v1 简化为 emoji 飘）
 *  - v0.31.87：进度从 localStorage 迁到 db.meta，跨设备同步 + 触发今日打卡内环
 *
 * 后续可加：
 *  - "巧算挑战赛" 模式（30s 内尽可能多）
 *  - "巧算 trophy" 系列
 *  - 题目随机生成（现在是固定 3 道，做完就没了——刷新页面重置）
 */

export function MathTricksPage() {
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());
  const [studentId, setStudentId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const ss = await db.students.toArray();
      const sid = ss[0]?.id;
      if (!sid) return;
      setStudentId(sid);
      setCompletedSet(await getCompletedTricks(sid));
    })();
  }, []);

  const totalDone = useMemo(
    () => MATH_TRICKS.filter((t) => completedSet.has(t.id)).length,
    [completedSet],
  );

  async function markDone(trickId: string) {
    if (!studentId || completedSet.has(trickId)) {
      // 即使已完成，也记一次"今日有做"
      if (studentId) await markTrickDone(studentId, trickId);
      return;
    }
    await markTrickDone(studentId, trickId);
    setCompletedSet((s) => new Set(s).add(trickId));
  }

  // 转一份给老 Card 子组件用的 Record 形式
  const completed: Record<string, boolean> = useMemo(() => {
    const r: Record<string, boolean> = {};
    for (const id of completedSet) r[id] = true;
    return r;
  }, [completedSet]);

  return (
    <div className="space-y-5">
      {/* Header / Hero */}
      <section className="card-glow bg-gradient-to-br from-violet-500/15 to-pink-500/10 border-violet-400/20">
        <div className="flex items-center gap-3">
          <div className="text-4xl">🪄</div>
          <div className="flex-1">
            <h1 className="font-display font-bold text-xl text-brand">巧算工具箱</h1>
            <div className="text-sm text-slate-300 mt-0.5">
              四年级速算 · 验算 · 估算的 8 个秘密武器
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-slate-400">已掌握</div>
            <div className="font-display text-2xl text-violet-200">
              {totalDone}<span className="text-sm text-slate-400"> / {MATH_TRICKS.length}</span>
            </div>
          </div>
        </div>
        <div className="text-xs text-slate-400 mt-2">
          这些不是教材内容，是数学基本功——会了之后做题更快、验算更稳，考试冲刺神器。
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {MATH_TRICKS.map((t) => (
            <a
              key={t.id}
              href={`#trick-${t.id}`}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                completed[t.id]
                  ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-100"
                  : "bg-white/5 border-ink-700/60 text-slate-300 hover:bg-white/10"
              }`}
            >
              <span className="mr-1">{t.emoji}</span>
              {t.name}
              {completed[t.id] && <span className="ml-1">✓</span>}
            </a>
          ))}
        </div>
      </section>

      {MATH_TRICKS.map((trick) => (
        <TrickCard
          key={trick.id}
          trick={trick}
          isComplete={!!completed[trick.id]}
          onAllCorrect={() => markDone(trick.id)}
        />
      ))}

      <div className="text-center py-6">
        <Link to="../" className="text-xs text-slate-400 hover:text-slate-200">
          ← 回首页
        </Link>
      </div>
      <MascotQuickAccess context="tricks" />
    </div>
  );
}

// ─── Trick Card ───────────────────────────────────────────

function TrickCard({
  trick,
  isComplete,
  onAllCorrect,
}: {
  trick: MathTrick;
  isComplete: boolean;
  onAllCorrect: () => void;
}) {
  const [exampleIdx, setExampleIdx] = useState(0);
  const [showSteps, setShowSteps] = useState(true);
  const [practiceState, setPracticeState] = useState<Record<number, "idle" | "ok" | "err">>({});
  const [celebrating, setCelebrating] = useState(false);

  const example = trick.examples[exampleIdx]!;
  const allCorrect = trick.practice.every((_, i) => practiceState[i] === "ok");

  function handleResult(idx: number, result: "ok" | "err") {
    setPracticeState((s) => {
      const next = { ...s, [idx]: result };
      // 检测全对（这次也是 ok）
      if (
        result === "ok" &&
        trick.practice.every((_, i) => (i === idx ? true : next[i] === "ok"))
      ) {
        // v0.31.98: 去掉 `if (!isComplete)` gate —— mastered trick 重做也要触发，
        // 否则 8 个 trick 全 mastered 后今日打卡环永远闭不上（巧算 + 速算双闭死锁）。
        // markDone 内部已正确区分"首次掌握 vs 今日复习"两路。
        if (!isComplete) {
          setCelebrating(true);
          setTimeout(() => setCelebrating(false), 2000);
        }
        onAllCorrect();
      }
      return next;
    });
  }

  return (
    <section
      id={`trick-${trick.id}`}
      className={`card-glow scroll-mt-20 transition-colors relative overflow-hidden ${
        isComplete ? "border-emerald-400/40 bg-emerald-500/5" : ""
      }`}
    >
      {celebrating && (
        <div
          className="absolute inset-0 pointer-events-none flex items-center justify-center text-6xl"
          aria-hidden
        >
          <span className="animate-bounce">🎉</span>
        </div>
      )}

      <header className="flex items-start gap-3">
        <div className="text-3xl shrink-0">{trick.emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display font-bold text-lg text-brand">{trick.name}</h2>
            {isComplete && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-100">
                已掌握 ✓
              </span>
            )}
          </div>
          <div className="text-sm text-slate-300 mt-0.5">{trick.tagline}</div>
        </div>
      </header>

      <div className="mt-3 grid sm:grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg bg-white/5 border border-ink-700/40 p-2.5">
          <div className="text-slate-400 mb-1">什么时候用</div>
          <div className="text-slate-200">{trick.whenToUse}</div>
        </div>
        <div className="rounded-lg bg-white/5 border border-ink-700/40 p-2.5">
          <div className="text-slate-400 mb-1">为什么管用</div>
          <div className="text-slate-200">{trick.principle}</div>
        </div>
      </div>

      {/* Worked Example */}
      <div className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-violet-200">
            🔍 例子：{example.problem}
          </div>
          <div className="flex gap-1.5">
            {trick.examples.length > 1 && (
              <div className="flex gap-1">
                {trick.examples.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setExampleIdx(i)}
                    className={`w-6 h-6 rounded-md text-[11px] ${
                      i === exampleIdx
                        ? "bg-violet-500/30 text-violet-100 border border-violet-400/40"
                        : "bg-white/5 text-slate-400 hover:bg-white/10"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowSteps((v) => !v)}
              className="text-[11px] text-slate-400 hover:text-slate-200 px-2"
            >
              {showSteps ? "收起" : "展开"}
            </button>
          </div>
        </div>
        {showSteps && (
          <div className="mt-2 rounded-lg bg-ink-900/60 border border-ink-700/60 p-3 space-y-1.5">
            {example.steps.map((s, i) => (
              <div key={i} className="flex items-baseline gap-2">
                <code className="text-violet-200 text-sm font-mono">{s.expr}</code>
                {s.note && <span className="text-[11px] text-slate-400">— {s.note}</span>}
              </div>
            ))}
            <div className="pt-1 mt-1 border-t border-ink-700/60">
              <span className="text-[11px] text-slate-400">答案：</span>
              <span className="font-mono text-emerald-300 font-semibold">{example.answer}</span>
            </div>
          </div>
        )}
      </div>

      {/* Practice */}
      <div className="mt-4">
        <div className="text-sm font-semibold text-violet-200 mb-2">
          ✏️ 动手试试 ({trick.practice.filter((_, i) => practiceState[i] === "ok").length}/
          {trick.practice.length})
        </div>
        <div className="space-y-2">
          {trick.practice.map((p, i) => (
            <PracticeRow
              key={i}
              practice={p}
              state={practiceState[i] ?? "idle"}
              onResult={(r) => handleResult(i, r)}
            />
          ))}
        </div>
        {allCorrect && (
          <div className="mt-3 text-sm text-emerald-200 font-display">
            🌟 全部答对！这个技巧你掌握了
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Practice Row ─────────────────────────────────────────

function PracticeRow({
  practice,
  state,
  onResult,
}: {
  practice: TrickPractice;
  state: "idle" | "ok" | "err";
  onResult: (r: "ok" | "err") => void;
}) {
  const [input, setInput] = useState("");
  const [showHint, setShowHint] = useState(false);

  function check() {
    if (!input.trim()) return;
    const norm = input.trim().replace(/\s+/g, "");
    const expected = practice.answer.trim().replace(/\s+/g, "");
    if (norm === expected) {
      onResult("ok");
    } else {
      onResult("err");
      setShowHint(true);
    }
  }

  return (
    <div
      className={`rounded-lg border p-2.5 flex items-center gap-2 flex-wrap ${
        state === "ok"
          ? "bg-emerald-500/10 border-emerald-400/40"
          : state === "err"
            ? "bg-rose-500/10 border-rose-400/40"
            : "bg-white/5 border-ink-700/40"
      }`}
    >
      <code className="text-violet-200 font-mono text-sm flex-1 min-w-[120px]">
        {practice.question}
      </code>
      {state === "ok" ? (
        <div className="text-emerald-300 text-sm font-mono">
          ✓ {practice.answer}
        </div>
      ) : (
        <>
          <input
            type="text"
            inputMode="numeric"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") check();
            }}
            placeholder="答案"
            className="w-24 px-2 py-1 rounded-md bg-ink-900/80 border border-ink-700/60 text-sm font-mono text-center focus:outline-none focus:border-violet-400/60"
          />
          <button
            type="button"
            onClick={check}
            disabled={!input.trim()}
            className="text-xs px-2.5 py-1 rounded-md bg-violet-500/20 border border-violet-400/40 text-violet-100 hover:bg-violet-500/30 disabled:opacity-40"
          >
            检查
          </button>
        </>
      )}
      {state === "err" && (
        <div className="basis-full text-[11px] text-rose-200">
          再想想 — 提示：{practice.hint}
        </div>
      )}
      {state === "idle" && showHint && (
        <div className="basis-full text-[11px] text-slate-400">提示：{practice.hint}</div>
      )}
    </div>
  );
}
