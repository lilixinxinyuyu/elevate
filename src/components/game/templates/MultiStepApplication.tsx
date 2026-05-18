/**
 * v0.35.1 (iter 35 P0-3): MultiStepApplication template.
 *
 * 应用题 4 步框架: 已知 → 求 → 算式 → 答.
 * 详见 src/core/multiStepPolicy.ts + docs/iter35-multistep-application-design.md.
 *
 * Peer review 共识整合:
 *  - chip + click (不要拖拽) for 已知 — 题面数字可点
 *  - "求" 候选 = word_problem_steps.question + 1-2 个干扰 (单位换个)
 *  - 算式 textarea + 安全 shunting-yard parser
 *  - 答 numeric + unit
 *  - attempt.isCorrect 由 Phase 4 答最终决定 (统一)
 *  - 过程险: Phase 3 算式对但 Phase 4 答错 → 部分 XP, isCorrect=false
 */
import { useMemo, useRef, useState } from "react";
import type { TemplateRenderProps } from "../GameShell";
import {
  MULTI_STEP_XP,
  extractAnswerUnit,
  extractKnownCandidates,
  extractQuestionCandidates,
  validateEquation,
} from "../../../core/multiStepPolicy";

// v0.35.28 (爸爸第 4 次反馈 + AB peer review): Phase 3 算式 sanitize 全/半角.
// 即使 chip 工具栏让她不必打中文, 也 belt-and-suspenders 兜底所有可能字符.
function sanitizeEquation(raw: string): string {
  return raw
    .replace(/[×x✕✖]/g, "×")
    .replace(/[÷／/]/g, "÷")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/[＝]/g, "=")
    .replace(/[＋]/g, "+")
    .replace(/[－—–]/g, "-")
    .replace(/[．。]/g, ".")
    .replace(/[０１２３４５６７８９]/g, (d) => String("０１２３４５６７８９".indexOf(d)))
    .replace(/\s+/g, " ")
    .trim();
}

export function MultiStepApplicationPanel(props: TemplateRenderProps) {
  const { question, onFinish, disabled } = props;
  const expectedAnswer = question.answer.type === "number" && typeof question.answer.value === "number"
    ? question.answer.value
    : 0;
  const knownCands = useMemo(() => extractKnownCandidates(question), [question.question_id]);
  const questionCands = useMemo(() => extractQuestionCandidates(question), [question.question_id]);
  const defaultUnit = useMemo(() => extractAnswerUnit(question), [question.question_id]);

  // 数字 chip 候选 — 从 stem 提单独数字 (点击可飞入已知)
  const stemNumbers = useMemo(() => {
    const matches = question.stem.match(/\d+(?:\.\d+)?/g) ?? [];
    return [...new Set(matches)].slice(0, 6);
  }, [question.question_id]);

  const [phase, setPhase] = useState<1 | 2 | 3 | 4>(1);

  // Phase 1
  const [knownChips, setKnownChips] = useState<string[]>([]);
  const [knownManualInput, setKnownManualInput] = useState("");
  const [phase1Err, setPhase1Err] = useState("");

  // Phase 2
  const [questionSelected, setQuestionSelected] = useState<string>("");
  const [questionManualInput, setQuestionManualInput] = useState("");
  const [phase2Err, setPhase2Err] = useState("");

  // Phase 3
  const [equation, setEquation] = useState("");
  const [phase3Err, setPhase3Err] = useState("");
  const [equationOk, setEquationOk] = useState(false);

  // Phase 4
  const [finalAnswer, setFinalAnswer] = useState("");
  const [finalUnit, setFinalUnit] = useState(defaultUnit);
  const [phase4Err, setPhase4Err] = useState("");

  const [phaseXp, setPhaseXp] = useState<number[]>([0, 0, 0, 0]);

  // v0.35.28 (peer review B): 加入手敲的"已知" 文字 → chip
  function addKnownManual() {
    const v = knownManualInput.trim();
    if (!v) return;
    setKnownChips((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setKnownManualInput("");
    setPhase1Err("");
  }

  function onPhase1Submit() {
    // 先把 input 里没"+加入"的内容也算上 (用户可能写了但没点 + 直接点下一步)
    const draft = knownManualInput.trim();
    const allChips = draft && !knownChips.includes(draft) ? [...knownChips, draft] : knownChips;
    if (allChips.length < 2) {
      setPhase1Err("至少选 2 个数 / 量 (点上面的 + 或者自己写后按 Enter / 点 加入)");
      return;
    }
    if (draft) {
      setKnownChips(allChips);
      setKnownManualInput("");
    }
    setPhase1Err("");
    const newXp = [...phaseXp];
    newXp[0] = MULTI_STEP_XP.KNOWN;
    setPhaseXp(newXp);
    setPhase(2);
  }

  function onPhase2Submit() {
    // v0.35.28: 优先 chip 选中, 否则用手敲文字 (按 Enter / 点下一步都走这)
    const final = (questionSelected || questionManualInput).trim();
    if (final.length < 2) {
      setPhase2Err("写一下要求什么 (例: 一共多少元?) — 选上面候选或自己写后按 Enter");
      return;
    }
    // 如果用户手敲了但没选 chip, 把手敲的当 questionSelected (这样 onFinish 能拿到)
    if (!questionSelected && questionManualInput.trim()) {
      setQuestionSelected(questionManualInput.trim());
    }
    setPhase2Err("");
    const newXp = [...phaseXp];
    newXp[1] = MULTI_STEP_XP.QUESTION;
    setPhaseXp(newXp);
    setPhase(3);
  }

  function onPhase3Submit() {
    // v0.35.28 (peer review Gemini + GPT 共识): sanitize 全角字符防"看着对系统判错"
    const cleaned = sanitizeEquation(equation);
    if (cleaned !== equation) setEquation(cleaned);
    if (!cleaned) {
      setPhase3Err("写一个算式 (例: 5 × 12 = 60). 用下面的按钮拼也可以.");
      return;
    }
    const v = validateEquation(cleaned, expectedAnswer);
    if (!v.ok) {
      const hint = v.reason === "wrong_value"
        ? `算的不太对, 你算出了 ${v.computed}, 但跟答案差距大. 检查一下数字和运算符`
        : v.reason === "result_mismatch"
          ? "算式两边不相等. 检查 = 后面写的数 (用下面按钮改)"
          : "格式不对 (用数字 + 运算符 + 等号, 例: 5 × 12 = 60)";
      setPhase3Err(hint);
      // peer review D: 失败时不锁 button — 用户可改 input 再点 (button disabled 仅 props.disabled)
      return;
    }
    setPhase3Err("");
    setEquationOk(true);
    const newXp = [...phaseXp];
    newXp[2] = MULTI_STEP_XP.EQUATION;
    setPhaseXp(newXp);
    setPhase(4);
  }

  // v0.35.28 (peer review GPT): 运算符 chip 工具栏 insert at cursor (10 岁孩子打中文标点难)
  const equationInputRef = useRef<HTMLInputElement | null>(null);
  function insertAtCursor(token: string) {
    const el = equationInputRef.current;
    const start = el?.selectionStart ?? equation.length;
    const end = el?.selectionEnd ?? equation.length;
    const next = equation.slice(0, start) + token + equation.slice(end);
    setEquation(next);
    // restore cursor after token
    requestAnimationFrame(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      }
    });
    setPhase3Err(""); // 用户开始改 → 清错
  }
  function backspaceEquation() {
    const el = equationInputRef.current;
    const start = el?.selectionStart ?? equation.length;
    const end = el?.selectionEnd ?? equation.length;
    if (start === end && start > 0) {
      const next = equation.slice(0, start - 1) + equation.slice(start);
      setEquation(next);
      requestAnimationFrame(() => {
        if (el) {
          el.focus();
          el.setSelectionRange(start - 1, start - 1);
        }
      });
    } else if (start !== end) {
      const next = equation.slice(0, start) + equation.slice(end);
      setEquation(next);
      requestAnimationFrame(() => {
        if (el) {
          el.focus();
          el.setSelectionRange(start, start);
        }
      });
    }
    setPhase3Err("");
  }

  function onPhase4Submit() {
    const num = Number(finalAnswer);
    if (!Number.isFinite(num)) {
      setPhase4Err("填一个数字");
      return;
    }
    const tol = Math.max(0.01, Math.abs(expectedAnswer) * 0.01);
    const numericMatch = Math.abs(num - expectedAnswer) <= tol;
    // 过程险: Phase 3 算式对但 Phase 4 答错 → 仍计 Phase 4 XP 部分给 (≤ 2/8)
    const phase4Xp = numericMatch ? MULTI_STEP_XP.ANSWER : (equationOk ? 2 : 0);
    const newXp = [...phaseXp];
    newXp[3] = phase4Xp;
    const total = newXp.reduce((s, v) => s + v, 0);

    // attempt isCorrect 由 Phase 4 数字决定 (GPT 共识统一)
    onFinish({
      answer: { value: num, unit: finalUnit },
      isCorrect: numericMatch,
      partialCorrect: !numericMatch && equationOk,
      matchedErrorTags: [],
      multiStep: {
        phasePass: [true, true, equationOk, numericMatch],
        earnedXp: total,
        userKnown: [...knownChips, ...(knownManualInput ? [knownManualInput] : [])],
        userQuestion: questionSelected || questionManualInput,
        userEquation: equation,
        userAnswer: num,
        userUnit: finalUnit,
      },
    });
  }

  function addKnownChip(text: string) {
    setKnownChips((prev) => prev.includes(text) ? prev : [...prev, text]);
  }

  function removeKnownChip(text: string) {
    setKnownChips((prev) => prev.filter((c) => c !== text));
  }

  return (
    <div className="rounded-2xl border border-cyan-400/40 bg-cyan-500/10 px-4 py-4 space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-cyan-100">
          📋 应用题 4 步法 ({phase}/4)
        </h3>
        <span className="text-[11px] text-cyan-300/80">+{phaseXp.reduce((s, v) => s + v, 0)} / +20 XP</span>
      </div>

      <div className="text-sm text-cyan-50/95 bg-slate-900/40 rounded-lg px-3 py-2 leading-relaxed">
        {question.stem}
      </div>

      {/* Phase 1: 已知 */}
      {phase === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-cyan-100 font-semibold">第 1 步: 题里告诉了我们什么? (点数字加进来)</p>

          <div className="flex flex-wrap gap-1.5">
            {stemNumbers.map((n) => (
              <button
                key={n}
                onClick={() => addKnownChip(n)}
                disabled={disabled}
                className="px-2 py-1 rounded-md bg-slate-800 border border-cyan-400/30 text-cyan-100 text-xs hover:bg-slate-700"
              >
                +{n}
              </button>
            ))}
            {knownCands.filter((c) => !stemNumbers.includes(c)).map((c) => (
              <button
                key={c}
                onClick={() => addKnownChip(c)}
                disabled={disabled}
                className="px-2 py-1 rounded-md bg-slate-800 border border-cyan-400/30 text-cyan-100 text-xs hover:bg-slate-700"
              >
                +{c}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {knownChips.length === 0 && (
              <span className="text-xs text-cyan-200/50">已知卡片 (点上面 + 按钮加)</span>
            )}
            {knownChips.map((c) => (
              <span key={c} className="px-2 py-1 rounded-md bg-cyan-400/30 border border-cyan-300/50 text-cyan-50 text-xs flex items-center gap-1">
                {c}
                <button onClick={() => removeKnownChip(c)} className="text-cyan-200 hover:text-rose-300">×</button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-cyan-200/80">手动补一个:</span>
            <input
              type="text"
              value={knownManualInput}
              onChange={(e) => setKnownManualInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addKnownManual();
                }
              }}
              placeholder="例: 30 元 (写完按 Enter 或点 +加入)"
              className="flex-1 rounded-md px-2 py-1 bg-slate-800 text-cyan-50 text-xs border border-cyan-400/30 focus:outline-none focus:border-cyan-300"
            />
            <button
              type="button"
              onClick={addKnownManual}
              disabled={disabled || !knownManualInput.trim()}
              className="px-2.5 py-1 rounded-md bg-cyan-500 text-white text-xs font-semibold hover:bg-cyan-400 disabled:opacity-40"
            >
              + 加入
            </button>
          </div>

          {phase1Err && <p className="text-xs text-amber-200 bg-amber-500/20 rounded px-2 py-1">{phase1Err}</p>}

          <button
            onClick={onPhase1Submit}
            disabled={disabled}
            className="px-3 py-1.5 rounded-lg bg-cyan-500 text-white text-sm font-semibold hover:bg-cyan-400"
          >
            下一步 →
          </button>
        </div>
      )}

      {/* Phase 2: 求 */}
      {phase === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-cyan-100 font-semibold">第 2 步: 题目问什么?</p>

          {questionCands.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {questionCands.map((c) => (
                <button
                  key={c}
                  onClick={() => setQuestionSelected(c)}
                  disabled={disabled}
                  className={`px-2.5 py-1 rounded-md text-sm text-left border ${
                    questionSelected === c
                      ? "bg-cyan-400/30 border-cyan-300 text-cyan-50 font-semibold"
                      : "bg-slate-800 border-cyan-400/30 text-cyan-200 hover:bg-slate-700"
                  }`}
                >
                  {questionSelected === c && "✓ "}{c}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-cyan-200/80">或自己写:</span>
            <input
              type="text"
              value={questionManualInput}
              onChange={(e) => { setQuestionManualInput(e.target.value); setQuestionSelected(""); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && questionManualInput.trim().length >= 2) {
                  e.preventDefault();
                  onPhase2Submit();
                }
              }}
              placeholder="例: 还剩多少米? (写完按 Enter 进下一步)"
              className="flex-1 rounded-md px-2 py-1 bg-slate-800 text-cyan-50 text-xs border border-cyan-400/30 focus:outline-none focus:border-cyan-300"
            />
          </div>

          {phase2Err && <p className="text-xs text-amber-200 bg-amber-500/20 rounded px-2 py-1">{phase2Err}</p>}

          <button
            onClick={onPhase2Submit}
            disabled={disabled}
            className="px-3 py-1.5 rounded-lg bg-cyan-500 text-white text-sm font-semibold hover:bg-cyan-400"
          >
            下一步 →
          </button>
        </div>
      )}

      {/* Phase 3: 算式 — v0.35.28 全面重写 (peer review 共识)
          - input readOnly: 防原生键盘 / 中文 IME 弹起 (Gemini 强 emphasize)
          - 计算器 chip 工具栏: 0-9 + 运算符, 点击 insertAtCursor (GPT)
          - sanitizeEquation 兜底全角字符 (Gemini)
          - 错误后 button 不锁 — disabled 仅 props.disabled (peer review D) */}
      {phase === 3 && (
        <div className="space-y-3">
          <p className="text-sm text-cyan-100 font-semibold">第 3 步: 写算式 (用下面按钮拼)</p>

          <input
            ref={equationInputRef}
            type="text"
            value={equation}
            readOnly
            placeholder="例: 5 × 12 = 60 — 点下面按钮拼"
            className="w-full rounded-md px-3 py-2 bg-slate-900/60 text-cyan-50 text-base font-mono border border-cyan-400/30 focus:outline-none focus:border-cyan-300"
            onClick={(e) => {
              // 让用户能 click 移动 cursor
              const target = e.currentTarget;
              equationInputRef.current = target;
            }}
          />

          {/* 数字 keypad */}
          <div className="grid grid-cols-5 gap-1.5">
            {["7", "8", "9", "+", "−"].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => insertAtCursor(k === "−" ? "-" : k)}
                disabled={disabled}
                className="px-2 py-2 rounded-md bg-slate-800 text-cyan-100 text-base font-mono border border-cyan-400/30 hover:bg-slate-700 disabled:opacity-40 active:scale-95 transition-transform"
              >
                {k}
              </button>
            ))}
            {["4", "5", "6", "×", "÷"].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => insertAtCursor(k)}
                disabled={disabled}
                className="px-2 py-2 rounded-md bg-slate-800 text-cyan-100 text-base font-mono border border-cyan-400/30 hover:bg-slate-700 disabled:opacity-40 active:scale-95 transition-transform"
              >
                {k}
              </button>
            ))}
            {["1", "2", "3", "(", ")"].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => insertAtCursor(k)}
                disabled={disabled}
                className="px-2 py-2 rounded-md bg-slate-800 text-cyan-100 text-base font-mono border border-cyan-400/30 hover:bg-slate-700 disabled:opacity-40 active:scale-95 transition-transform"
              >
                {k}
              </button>
            ))}
            {["0", ".", "=", "⌫", "🗑"].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  if (k === "⌫") backspaceEquation();
                  else if (k === "🗑") { setEquation(""); setPhase3Err(""); }
                  else insertAtCursor(k);
                }}
                disabled={disabled}
                className={`px-2 py-2 rounded-md text-base font-mono border active:scale-95 transition-transform disabled:opacity-40 ${
                  k === "🗑"
                    ? "bg-rose-500/15 text-rose-200 border-rose-400/30 hover:bg-rose-500/25"
                    : k === "⌫"
                      ? "bg-amber-500/15 text-amber-200 border-amber-400/30 hover:bg-amber-500/25"
                      : "bg-slate-800 text-cyan-100 border-cyan-400/30 hover:bg-slate-700"
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          <p className="text-[11px] text-cyan-200/60">
            写完点"算完了"; 例如 <code className="text-cyan-100">5 × 12 = 60</code>. 错了点 ⌫ 删一个, 🗑 全清.
          </p>

          {phase3Err && (
            <p className="text-xs text-amber-200 bg-amber-500/20 rounded px-2 py-1">
              {phase3Err}
            </p>
          )}

          <button
            type="button"
            onClick={onPhase3Submit}
            disabled={disabled || !equation.trim()}
            className="px-3 py-1.5 rounded-lg bg-cyan-500 text-white text-sm font-semibold hover:bg-cyan-400 disabled:opacity-40"
          >
            算完了 →
          </button>
        </div>
      )}

      {/* Phase 4: 答 */}
      {phase === 4 && (
        <div className="space-y-3">
          <p className="text-sm text-cyan-100 font-semibold">第 4 步: 写答案 + 单位</p>
          <div className="flex items-center gap-2">
            <span className="text-cyan-100 font-semibold">答:</span>
            <input
              type="number"
              inputMode="decimal"
              value={finalAnswer}
              onChange={(e) => setFinalAnswer(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && finalAnswer.trim()) onPhase4Submit(); }}
              autoFocus
              className="w-32 rounded-md px-2 py-1.5 bg-slate-800 text-cyan-50 border border-cyan-400/30 focus:outline-none focus:border-cyan-300"
            />
            <input
              type="text"
              value={finalUnit}
              onChange={(e) => setFinalUnit(e.target.value)}
              placeholder="单位"
              className="w-20 rounded-md px-2 py-1.5 bg-slate-800 text-cyan-50 border border-cyan-400/30 focus:outline-none focus:border-cyan-300"
            />
          </div>

          {phase4Err && <p className="text-xs text-amber-200 bg-amber-500/20 rounded px-2 py-1">{phase4Err}</p>}

          <button
            onClick={onPhase4Submit}
            disabled={disabled}
            className="px-3 py-1.5 rounded-lg bg-cyan-500 text-white text-sm font-semibold hover:bg-cyan-400"
          >
            交答案 ✓
          </button>
        </div>
      )}
    </div>
  );
}
