import { useMemo, useState } from "react";
import type { TemplateRenderProps } from "../GameShell";
import type { ChooseSubquestion, ClueSubquestion, NumericSubquestion, Question, SubQuestion } from "../../../core/types";
import { coerceNumber } from "../../../core/grading";

/**
 * 应用题连续分步：像 Elevate 的 reading comprehension 一样一步一步走。
 * 第一步通常是线索挑选，后续是选择题或数值输入。
 */
export function ShopCounterPanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const steps = useMemo(() => buildSubquestions(question), [question]);
  const [cursor, setCursor] = useState(0);
  const [stepOk, setStepOk] = useState<boolean[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [answers, setAnswers] = useState<unknown[]>([]);
  const [shakeStep, setShakeStep] = useState(false);

  const advance = (ok: boolean, ans: unknown, errorTag?: string) => {
    const nextStepOk = [...stepOk, ok];
    const nextAnswers = [...answers, ans];
    const nextTags = errorTag ? [...tags, errorTag] : tags;
    if (!ok) {
      setShakeStep(true);
      window.setTimeout(() => setShakeStep(false), 450);
    }
    if (cursor + 1 >= steps.length) {
      // v0.31.98 修：最后一步也要 setStepOk + setCursor，让进度条最末一格也能
      // 着 emerald/rose 色 → 短延迟让 render 一帧后再 onFinish unmount。
      // 之前直接 onFinish 没 setStepOk → 进度条最后一格永远是 violet "当前步"色。
      setStepOk(nextStepOk);
      setAnswers(nextAnswers);
      setTags(nextTags);
      setCursor(cursor + 1);
      window.setTimeout(() => {
        onFinish({
          answer: nextAnswers,
          isCorrect: ok,
          partialCorrect: false,
          matchedErrorTags: nextTags,
        });
      }, 400);
    } else {
      setStepOk(nextStepOk);
      setAnswers(nextAnswers);
      setTags(nextTags);
      setCursor(cursor + 1);
    }
  };

  const current = steps[cursor];

  if (!current) {
    return (
      <div>
        <div className="text-slate-300 text-sm mb-2 whitespace-pre-wrap leading-relaxed">
          {question.stem}
        </div>
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          这道题的小关数据还没准备好，先跳过并记录为内容配置问题。
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="btn-primary"
            disabled={disabled}
            onClick={() =>
              onFinish({
                answer: null,
                isCorrect: false,
                partialCorrect: false,
                matchedErrorTags: ["content_config_error"],
              })
            }
          >
            继续
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-slate-300 text-sm mb-2 whitespace-pre-wrap leading-relaxed">
        {question.stem}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        {steps.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i < cursor ? (stepOk[i] ? "bg-emerald-400" : "bg-rose-400") : i === cursor ? "bg-violet-300" : "bg-white/10"
            }`}
          />
        ))}
      </div>
      <div className={`mt-4 ${shakeStep ? "animate-shake" : ""}`}>
        {/* v0.31.90: key={cursor} 让 SubRenderer 在切步骤时彻底重建。
            之前没 key → React 复用 instance → Numeric 内 useState 保留上一步答案
            → 第 2 步输入框卡死显示第 1 步的答案 + locked 状态。 */}
        <SubRenderer
          key={cursor}
          sub={current}
          onFinishStep={advance}
          triggerFx={triggerFx}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function buildSubquestions(q: Question): SubQuestion[] {
  if (q.subquestions && q.subquestions.length > 0) {
    return q.subquestions.filter((s): s is SubQuestion => Boolean(s?.kind));
  }
  // Fallback: 从 word_problem_steps + answer 组一个简易两步
  const out: SubQuestion[] = [];
  const wps = q.word_problem_steps;
  if (wps && wps.relationship) {
    out.push({
      kind: "choose",
      prompt: "先选出本题最合适的数量关系：",
      options: relationshipOptions(wps.relationship),
    });
  }
  if (q.answer.type === "number") {
    out.push({
      kind: "numeric",
      prompt: wps?.question ? `${wps.question}` : "请算出最终结果：",
      value: q.answer.value,
      acceptable_error: q.answer.acceptable_error,
      unit: q.answer.unit,
    });
  }
  // v0.31.29：choice-type 答案 — AI 生成的"小数商店"题大量是这种形态。
  // 之前 fallthrough 到 else 渲染数字 input + value=0，输入永远判错。
  // 现在直接用 q.options 渲染选择题。
  if (q.answer.type === "choice" && q.options && q.options.length > 0) {
    const correctId = q.answer.value;
    out.push({
      kind: "choose",
      prompt: wps?.question ?? "选出正确答案：",
      options: q.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        correct: opt.id === correctId,
      })),
    });
  }
  if (out.length === 0) {
    // 最后的兜底
    out.push({
      kind: "numeric",
      prompt: "请给出答案：",
      value: q.answer.type === "number" ? q.answer.value : 0,
    });
  }
  return out;
}

function relationshipOptions(correctRel: string) {
  const distractors = [
    "平均数=总数×份数",
    "单价=总价×数量",
    "路程=速度÷时间",
    "总数=平均数÷份数",
    "差=和+已知",
  ].filter((d) => d !== correctRel);
  const pool = [correctRel, ...distractors.slice(0, 3)];
  // 简单 seeded shuffle
  let s = 7;
  for (let i = 0; i < correctRel.length; i++) s = (s * 33 + correctRel.charCodeAt(i)) >>> 0;
  const rng = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const shuffled = pool.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled.map((text, i) => ({
    id: "ABCD"[i]!,
    text,
    correct: text === correctRel,
    ...(text === correctRel ? {} : { errorTag: "relation_model_error" }),
  }));
}

function SubRenderer({
  sub,
  onFinishStep,
  triggerFx,
  disabled,
}: {
  sub: SubQuestion;
  onFinishStep: (ok: boolean, ans: unknown, errorTag?: string) => void;
  triggerFx: TemplateRenderProps["triggerFx"];
  disabled: boolean;
}) {
  switch (sub.kind) {
    case "clue_pick":
      return <CluePick sub={sub} onFinish={onFinishStep} triggerFx={triggerFx} disabled={disabled} />;
    case "choose":
      return <Choose sub={sub} onFinish={onFinishStep} triggerFx={triggerFx} disabled={disabled} />;
    case "numeric":
      return <Numeric sub={sub} onFinish={onFinishStep} triggerFx={triggerFx} disabled={disabled} />;
  }
}

function CluePick({
  sub,
  onFinish,
  triggerFx,
  disabled,
}: {
  sub: ClueSubquestion;
  onFinish: (ok: boolean, ans: unknown, errorTag?: string) => void;
  triggerFx: TemplateRenderProps["triggerFx"];
  disabled: boolean;
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [locked, setLocked] = useState(false);
  const targetSet = new Set(sub.correct);
  const toggle = (i: number) => {
    if (disabled || locked) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };
  const submit = (ev: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || locked || selected.size === 0) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    const sortedSelected = Array.from(selected).sort();
    const sortedTarget = Array.from(targetSet).sort();
    const ok =
      sortedSelected.length === sortedTarget.length &&
      sortedSelected.every((v, idx) => v === sortedTarget[idx]);
    if (ok) triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "✓");
    else triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
    setLocked(true);
    onFinish(ok, sortedSelected, ok ? undefined : "careless_reading");
  };
  return (
    <div>
      <div className="text-base text-slate-100 mb-3 font-medium">
        {sub.prompt}
        <span className="ml-2 text-xs text-slate-400">
          （{sub.mode === "pick_correct" ? "多选" : "挑出不是线索的"}）
        </span>
      </div>
      <div className="space-y-2">
        {sub.clues.map((c, i) => {
          const on = selected.has(i);
          return (
            <button
              key={i}
              type="button"
              disabled={disabled || locked}
              onClick={() => toggle(i)}
              className={`w-full text-left rounded-xl border px-3 py-2.5 transition-all active:scale-[0.98] ${
                on
                  ? "border-violet-400 bg-violet-500/20 text-violet-50 shadow-glow"
                  : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
              }`}
            >
              <span className={`inline-block mr-2 w-5 h-5 rounded border align-middle ${on ? "bg-violet-400 border-violet-300" : "border-white/20"}`}>
                {on && <span className="block text-center text-xs text-ink-900 font-bold leading-5">✓</span>}
              </span>
              {c}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex justify-end">
        <button type="button" className="btn-primary" disabled={disabled || locked || selected.size === 0} onClick={submit}>
          确定
        </button>
      </div>
    </div>
  );
}

function Choose({
  sub,
  onFinish,
  triggerFx,
  disabled,
}: {
  sub: ChooseSubquestion;
  onFinish: (ok: boolean, ans: unknown, errorTag?: string) => void;
  triggerFx: TemplateRenderProps["triggerFx"];
  disabled: boolean;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [locked, setLocked] = useState(false);
  const multi = !!sub.multi;
  const pick = (id: string, ev: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || locked) return;
    if (multi) {
      setPicked((p) => {
        const n = new Set(p);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      });
      return;
    }
    // 单选即提交
    const opt = sub.options.find((o) => o.id === id);
    if (!opt) return;
    const rect = ev.currentTarget.getBoundingClientRect();
    if (opt.correct) {
      setLocked(true);
      triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "✓");
      setPicked(new Set([id]));
      window.setTimeout(() => onFinish(true, id), 260);
    } else {
      setLocked(true);
      triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
      setPicked(new Set([id]));
      window.setTimeout(() => onFinish(false, id, opt.errorTag ?? "careless_reading"), 260);
    }
  };
  const submitMulti = () => {
    if (disabled || locked || picked.size === 0) return;
    const target = new Set(sub.options.filter((o) => o.correct).map((o) => o.id));
    const ok = picked.size === target.size && Array.from(picked).every((x) => target.has(x));
    setLocked(true);
    onFinish(ok, Array.from(picked), ok ? undefined : "careless_reading");
  };
  return (
    <div>
      <div className="text-base text-slate-100 mb-3 font-medium">{sub.prompt}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {sub.options.map((o) => {
          const on = picked.has(o.id);
          const showCorrect = on && o.correct;
          const showWrong = on && !o.correct && !multi;
          const klass = showCorrect
            ? "bubble bubble-correct"
            : showWrong
              ? "bubble bubble-wrong"
              : on
                ? "bubble shadow-glow"
                : "bubble";
          return (
            <button key={o.id} type="button" disabled={disabled || locked} onClick={(e) => pick(o.id, e)} className={klass}>
              <span className="mr-2 text-violet-200 font-bold">{o.id}.</span>
              {o.text}
            </button>
          );
        })}
      </div>
      {multi && (
        <div className="mt-3 flex justify-end">
          <button type="button" disabled={disabled || locked || picked.size === 0} className="btn-primary" onClick={submitMulti}>
            确定
          </button>
        </div>
      )}
    </div>
  );
}

function Numeric({
  sub,
  onFinish,
  triggerFx,
  disabled,
}: {
  sub: NumericSubquestion;
  onFinish: (ok: boolean, ans: unknown, errorTag?: string) => void;
  triggerFx: TemplateRenderProps["triggerFx"];
  disabled: boolean;
}) {
  const [value, setValue] = useState("");
  const [locked, setLocked] = useState(false);
  const distractors = sub.distractors && sub.distractors.length >= 2 ? sub.distractors : null;
  const submit = (ev: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled || locked || !value.trim()) return;
    const tol = sub.acceptable_error ?? 1e-6;
    const num = coerceNumber(value);
    const ok = num != null && Math.abs(num - sub.value) <= Math.max(tol, 1e-6);
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    if (ok) triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "✓");
    else triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
    setLocked(true);
    onFinish(ok, value, ok ? undefined : "careless_reading");
  };
  if (distractors) {
    // 展示为 4 选 1
    const pool = [sub.value, ...distractors].slice(0, 4);
    const pick = (n: number, ev: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || locked) return;
      const rect = ev.currentTarget.getBoundingClientRect();
      const ok = Math.abs(n - sub.value) <= (sub.acceptable_error ?? 1e-6);
      if (ok) triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "✓");
      else triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
      setLocked(true);
      window.setTimeout(() => onFinish(ok, n, ok ? undefined : "careless_reading"), 260);
    };
    return (
      <div>
        <div className="text-base text-slate-100 mb-3 font-medium">{sub.prompt}</div>
        <div className="grid grid-cols-2 gap-3">
          {pool.map((n, i) => (
            <button key={i} type="button" disabled={disabled || locked} onClick={(e) => pick(n, e)} className="bubble">
              {Number.isInteger(n) ? n : Math.round(n * 1000) / 1000}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="text-base text-slate-100 mb-3 font-medium">{sub.prompt}</div>
      <div className="flex items-center gap-2">
        <input
          inputMode="decimal"
          className="field text-2xl font-display"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && value.trim()) submit(e);
          }}
          disabled={disabled || locked}
          placeholder="答案"
        />
        <button type="button" className="btn-primary" disabled={disabled || locked || !value.trim()} onClick={submit}>
          确定
        </button>
      </div>
    </div>
  );
}
