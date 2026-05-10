import { useMemo, useState } from "react";
import type { TemplateRenderProps } from "../GameShell";

/**
 * 折扣漂移（Discount Drift） — v0.31.87
 *
 * 训练：小数乘法 / 小数点移动 / 百分比萌芽（4 年级用 X 折表达 X*10%）
 *
 * 玩法：商品图 + 原价（划掉）+ 折扣 chip → 4 个折后价 chip 让玩家选。
 * 答对：折扣条 +1 段绿色波纹；答错：钻石碎片飘落（柔和提示）。
 *
 * 数据来源：question.discount + question.options（4 选）
 *
 * 落档原因：之前 fluency 速算只覆盖加减乘除，没"购物 + 折扣"情境。
 * iOS Elevate 的 Discount 游戏体感非常流畅，参考它做的是 30s 答多题，
 * 这里因为闯关 / 挑战是单题节奏，先做单题版。
 */
export function DiscountDriftPanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const spec = question.discount;
  const sessionSalt = useMemo(
    () => Math.random().toString(36).slice(2),
    [question.question_id],
  );
  const options = useMemo(
    () => buildOptions(question, sessionSalt),
    [question.question_id, sessionSalt],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  function handlePick(optId: string, ev: React.MouseEvent<HTMLButtonElement>) {
    if (disabled || locked) return;
    const opt = options.find((o) => o.id === optId);
    if (!opt) return;
    setPicked(optId);
    setLocked(true);
    const rect = ev.currentTarget.getBoundingClientRect();
    if (opt.correct) {
      triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "💸");
      window.setTimeout(() => {
        onFinish({
          answer: opt.id,
          isCorrect: true,
          partialCorrect: false,
          matchedErrorTags: [],
        });
      }, 400);
    } else {
      triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
      window.setTimeout(() => {
        onFinish({
          answer: opt.id,
          isCorrect: false,
          partialCorrect: false,
          matchedErrorTags: opt.errorTag ? [opt.errorTag] : ["calc_error"],
        });
      }, 400);
    }
  }

  if (!spec) {
    // 没有 discount spec 就降级到普通选择题展示
    return <FallbackToPlainChoice options={options} onPick={handlePick} picked={picked} disabled={disabled || locked} stem={question.stem} />;
  }

  const discountLabel = renderDiscountLabel(spec);

  return (
    <div>
      {/* 商品 + 价格牌 */}
      <div className="rounded-3xl bg-gradient-to-br from-amber-500/15 via-pink-500/10 to-violet-500/10 border border-amber-400/30 p-5 mb-4">
        <div className="flex items-center gap-4">
          <div className="text-5xl">{spec.emoji ?? "🛒"}</div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-slate-400">{spec.itemName}</div>
            <div className="flex items-baseline gap-3 mt-1">
              <div className="font-display font-bold text-2xl text-slate-200 line-through opacity-60 tabular-nums">
                ¥{formatPrice(spec.originalPrice)}
              </div>
              <div className="chip bg-rose-500/25 border border-rose-400/40 text-rose-100 text-xs font-bold">
                {discountLabel}
              </div>
            </div>
          </div>
          <div className="text-amber-300 text-3xl">→</div>
          <div className="text-3xl font-display font-bold text-amber-200 tabular-nums">¥?</div>
        </div>
      </div>

      {/* 题面（文字版备用） */}
      <div className="text-sm text-slate-300 mb-4 whitespace-pre-wrap">
        {question.stem}
      </div>

      {/* 4 选 1 价格 */}
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => {
          const isPicked = picked === opt.id;
          const showAnswer = disabled || locked;
          const reveal = showAnswer && opt.correct;
          let cls = "bubble";
          if (reveal) cls = "bubble bubble-correct animate-pop";
          else if (isPicked && !opt.correct) cls = "bubble bubble-wrong";
          else if (showAnswer) cls = "bubble bubble-faded";
          return (
            <button
              key={opt.id}
              type="button"
              onClick={(e) => handlePick(opt.id, e)}
              disabled={disabled || locked}
              className={`${cls} text-2xl font-display font-bold tabular-nums py-5`}
            >
              ¥{opt.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function renderDiscountLabel(d: NonNullable<TemplateRenderProps["question"]["discount"]>): string {
  const { discount } = d;
  if (discount.kind === "percent") {
    // value=70 → 7 折；value=80 → 8 折；value=50 → 半价
    if (discount.value === 50) return "半价 (5 折)";
    if (discount.value % 10 === 0) return `${discount.value / 10} 折`;
    return `${discount.value}%`;
  }
  if (discount.kind === "yuan_off") return `减 ¥${formatPrice(discount.value)}`;
  if (discount.kind === "buy_n_get_m")
    return `买 ${discount.n} 送 ${discount.m}`;
  return "优惠";
}

function formatPrice(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "");
}

function buildOptions(
  q: TemplateRenderProps["question"],
  salt: string,
): Array<{ id: string; text: string; correct: boolean; errorTag?: string }> {
  const opts = (q.options ?? []).map((o) => ({
    id: o.id,
    text: o.text,
    correct:
      q.answer.type === "choice" && q.answer.value === o.id
        ? true
        : false,
    errorTag: o.errorTag,
  }));
  // shuffle 但 stable salt
  const arr = [...opts];
  let h = 0;
  for (const c of salt) h = (h * 31 + c.charCodeAt(0)) | 0;
  for (let i = arr.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) | 0;
    const j = Math.abs(h) % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function FallbackToPlainChoice({
  options,
  onPick,
  picked,
  disabled,
  stem,
}: {
  options: Array<{ id: string; text: string; correct: boolean }>;
  onPick: (id: string, e: React.MouseEvent<HTMLButtonElement>) => void;
  picked: string | null;
  disabled: boolean;
  stem: string;
}) {
  return (
    <div>
      <div className="font-display font-bold text-2xl mb-4 whitespace-pre-wrap">{stem}</div>
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={(e) => onPick(opt.id, e)}
            disabled={disabled}
            className={`bubble py-5 text-xl ${picked === opt.id ? (opt.correct ? "bubble-correct" : "bubble-wrong") : ""}`}
          >
            {opt.text}
          </button>
        ))}
      </div>
    </div>
  );
}
