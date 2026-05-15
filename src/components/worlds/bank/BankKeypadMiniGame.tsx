/**
 * v0.32.50 (Ep26 C): 银行虚拟键盘换零 mini-game —— 玩法差异化（不再拖硬币到托盘）。
 *
 * 玩法:
 *   柜员小窗 DOM overlay → 顾客带 ¥X 来 → Selena 在 0-9 键盘上输入金额 → "确认入账"
 *   - 输入: 数字键按序累加（cents 模式，无需小数点） e.g. 1→7→0 显示 ¥1.70
 *   - 校验: 等于 targetCent → drop + 完成；偏差 → wrong + 教学 hint 显示差额方向
 *
 * 数学训练 (暗在游戏后面):
 *   - 数位理解: ¥1.70 = 170 cent；¥6.80 = 680 cent
 *   - 比较: 输错时显示"还差 / 多了 ¥X.XX" → 大小比较
 */

import { useEffect, useRef, useState } from "react";
import type { BankOrder } from "../../../lib/worlds/bankOrders";
import { formatYuan } from "../../../lib/worlds/storeOrders";

interface BankKeypadMiniGameProps {
  order: BankOrder;
  onOrderComplete: () => void;
  onFeedback?: (
    kind: "pickup" | "drop" | "wrong" | "correct",
    label?: string,
    hint?: string,
  ) => void;
}

export function BankKeypadMiniGame({ order, onOrderComplete, onFeedback }: BankKeypadMiniGameProps) {
  const [digits, setDigits] = useState("");
  const [locked, setLocked] = useState(false);
  const inputCent = digits === "" ? 0 : parseInt(digits, 10);
  const diff = order.targetCent - inputCent;
  // v0.33.24 (Ep100 RRRRR): match 时大数字 360° flip + emerald glow
  // flipKey 每次"非匹配 → 匹配"过渡时 +1，给大数字 div 当 React key 让 animation 重启
  const matched = inputCent > 0 && inputCent === order.targetCent;
  const [flipKey, setFlipKey] = useState(0);
  const prevMatchedRef = useRef(false);
  useEffect(() => {
    if (matched && !prevMatchedRef.current) {
      setFlipKey((k) => k + 1);
    }
    prevMatchedRef.current = matched;
  }, [matched]);

  const press = (d: string) => {
    if (locked) return;
    // 最多 5 位（max ¥999.99 = 99999 cent）
    if (digits.length >= 5) return;
    // 不允许 leading 0 进位（除非清空）
    const next = (digits + d).replace(/^0+(?=\d)/, "");
    setDigits(next);
    onFeedback?.("pickup");
  };

  const backspace = () => {
    if (locked) return;
    setDigits((v) => v.slice(0, -1));
  };

  const clear = () => {
    if (locked) return;
    setDigits("");
  };

  const submit = () => {
    if (locked) return;
    if (inputCent === order.targetCent) {
      setLocked(true);
      onFeedback?.("drop", `${formatYuan(inputCent)} 入账！`);
      window.setTimeout(() => onOrderComplete(), 600);
      return;
    }
    onFeedback?.(
      "wrong",
      diff > 0 ? `还差 ${formatYuan(diff)}` : `多了 ${formatYuan(-diff)}`,
      order.hint ?? `目标是 ${formatYuan(order.targetCent)}；想想 ¥ + 角 + 分。`,
    );
  };

  const keys: { label: string; onClick: () => void; cls?: string }[] = [
    { label: "1", onClick: () => press("1") },
    { label: "2", onClick: () => press("2") },
    { label: "3", onClick: () => press("3") },
    { label: "4", onClick: () => press("4") },
    { label: "5", onClick: () => press("5") },
    { label: "6", onClick: () => press("6") },
    { label: "7", onClick: () => press("7") },
    { label: "8", onClick: () => press("8") },
    { label: "9", onClick: () => press("9") },
    { label: "⌫", onClick: backspace, cls: "bg-amber-100 text-amber-900" },
    { label: "0", onClick: () => press("0") },
    { label: "AC", onClick: clear, cls: "bg-rose-100 text-rose-700 text-sm" },
  ];

  return (
    <div
      className="absolute pointer-events-none inset-0 flex items-end justify-center pb-6"
      style={{ zIndex: 60 }}
    >
      <div className="pointer-events-auto world-panel" style={{ maxWidth: "min(92vw, 380px)", width: "100%" }}>
        {/* v0.33.24 (Ep100 RRRRR): bank big-number flip + emerald glow */}
        <style>{`
          .bank-big-amount {
            display: inline-block;
            perspective: 700px;
            transform-style: preserve-3d;
            transition: text-shadow 220ms ease-out;
          }
          .bank-big-amount.is-matched {
            animation: bank-big-flip 720ms cubic-bezier(.34, 1.56, .64, 1);
            text-shadow:
              0 0 8px rgba(16, 185, 129, 0.6),
              0 0 18px rgba(52, 211, 153, 0.55),
              0 0 32px rgba(16, 185, 129, 0.35);
          }
          @keyframes bank-big-flip {
            0%   { transform: rotateY(0deg)   scale(1); }
            35%  { transform: rotateY(180deg) scale(1.2); }
            70%  { transform: rotateY(360deg) scale(1.08); }
            100% { transform: rotateY(360deg) scale(1); }
          }
          .bank-display-frame.is-matched {
            box-shadow:
              0 0 0 3px rgba(16, 185, 129, 0.55),
              0 0 24px rgba(52, 211, 153, 0.45),
              inset 0 0 14px rgba(167, 243, 208, 0.45) !important;
            transition: box-shadow 260ms ease-out;
          }
          @media (prefers-reduced-motion: reduce) {
            .bank-big-amount.is-matched { animation: none; }
          }
        `}</style>
        <div className="world-panel-title flex items-center justify-between">
          <span>🏧 柜台终端</span>
          <span className="text-[10px] text-blue-700 font-mono">BANK-T01</span>
        </div>

        {/* 显示屏 */}
        <div
          className={`bank-display-frame rounded-xl border-2 border-blue-300 bg-gradient-to-b from-blue-50 to-blue-100 p-3 mb-3 shadow-inner ${
            matched ? "is-matched" : ""
          }`}
        >
          <div className="text-[10px] text-blue-700 font-bold uppercase tracking-wide flex justify-between">
            <span>目标 / 当前</span>
            <span className="font-mono">{order.targetCent} ¢</span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <div className="font-mono text-blue-900 text-lg font-bold">
              {formatYuan(order.targetCent)}
            </div>
            <div
              key={flipKey}
              className={`bank-big-amount font-mono text-2xl font-black ${
                matched ? "is-matched" : ""
              } ${
                inputCent === 0
                  ? "text-slate-300"
                  : matched
                    ? "text-emerald-600"
                    : "text-blue-900"
              }`}
            >
              {formatYuan(inputCent)}
            </div>
          </div>
          {inputCent !== 0 && inputCent !== order.targetCent && (
            <div
              className={`text-[11px] font-mono mt-1 ${
                diff > 0 ? "text-amber-700" : "text-rose-700"
              }`}
            >
              {diff > 0 ? `还差 ${formatYuan(diff)}` : `多了 ${formatYuan(-diff)}`}
            </div>
          )}
          {/* v0.33.31 (Ep107 bank-coin-stack): 当前金额的"纸币/硬币分解" chip 行 */}
          <CoinBreakdownRow cent={inputCent} matched={matched} />
        </div>

        {/* 键盘 3×4 — v0.32.82 (Ep58 XXXX): ripple + scale press feedback */}
        <div className="grid grid-cols-3 gap-2">
          {keys.map((k, i) => (
            <KeypadButton
              key={i}
              label={k.label}
              cls={k.cls}
              disabled={locked}
              onPress={k.onClick}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={locked || inputCent === 0}
          className="world-cta-btn w-full mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {locked ? "✅ 入账成功" : `💳 确认入账 ${inputCent > 0 ? formatYuan(inputCent) : ""}`}
        </button>
      </div>
    </div>
  );
}

/**
 * v0.32.82 (Ep58 XXXX): bank keypad 按键反馈 — ripple + 短暂 scale pop。
 * 每次点击触发一次性 ripple，260ms 后自动清掉，不堆栈。
 */
function KeypadButton({
  label,
  cls,
  disabled,
  onPress,
}: {
  label: string;
  cls?: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const [seq, setSeq] = useState(0);
  return (
    <>
      <style>{`
        .bank-keypad-btn {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          transform-origin: center;
          transition: transform 80ms ease-out;
        }
        .bank-keypad-btn:not(:disabled):active {
          transform: scale(0.94);
        }
        .bank-keypad-ripple {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          background: rgba(59, 130, 246, 0.34);
          transform: translate(-50%, -50%) scale(0);
          pointer-events: none;
          animation: bank-keypad-ripple-kf 420ms cubic-bezier(.16, 1, .3, 1) forwards;
        }
        @keyframes bank-keypad-ripple-kf {
          0%   { opacity: 0.9; transform: translate(-50%, -50%) scale(0); }
          70%  { opacity: 0.55; }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(10); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bank-keypad-ripple { animation: none; opacity: 0; }
          .bank-keypad-btn:not(:disabled):active { transform: none; }
        }
      `}</style>
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          setSeq((s) => s + 1);
          onPress();
        }}
        disabled={disabled}
        className={`bank-keypad-btn rounded-xl font-bold py-3 shadow select-none ${
          cls ?? "bg-white text-blue-900 hover:bg-blue-50"
        } border border-blue-200`}
        style={{ fontSize: "1.4rem" }}
      >
        <span>{label}</span>
        {seq > 0 && (
          <span
            key={seq}
            className="bank-keypad-ripple"
            aria-hidden
          />
        )}
      </button>
    </>
  );
}

/* ============================================================
 * v0.33.31 (Ep107 bank-coin-stack): 金额 → 纸币 + 硬币分解 chip 行
 * ============================================================
 * 玩法教育价值：Selena 输入 ¥1.70 时看到 "1× ¥1 + 7× 1角" 直观分解，
 * 强化"元/角/分"概念 + 货币组合心算。
 *
 * 算法：greedy 从大到小贪心 — 国币常用面额。
 * 渲染：每个面额 chunky chip (count× emoji label)，颜色按面额映射，
 * matched 时变 emerald + pulse。
 */
const DENOM_TABLE: { cent: number; label: string; color: string; bg: string }[] = [
  { cent: 10000, label: "¥100", color: "#fef2f2", bg: "#dc2626" },
  { cent: 5000,  label: "¥50",  color: "#fff7ed", bg: "#ea580c" },
  { cent: 2000,  label: "¥20",  color: "#fef3c7", bg: "#a16207" },
  { cent: 1000,  label: "¥10",  color: "#eff6ff", bg: "#2563eb" },
  { cent: 500,   label: "¥5",   color: "#faf5ff", bg: "#7c3aed" },
  { cent: 100,   label: "¥1",   color: "#fffbeb", bg: "#ca8a04" },
  { cent: 50,    label: "5角",  color: "#f0fdf4", bg: "#16a34a" },
  { cent: 20,    label: "2角",  color: "#ecfeff", bg: "#0891b2" },
  { cent: 10,    label: "1角",  color: "#eff6ff", bg: "#0284c7" },
  { cent: 5,     label: "5分",  color: "#f8fafc", bg: "#64748b" },
  { cent: 2,     label: "2分",  color: "#f8fafc", bg: "#94a3b8" },
  { cent: 1,     label: "1分",  color: "#f8fafc", bg: "#a3a3a3" },
];

function decomposeCent(cent: number) {
  const out: { idx: number; count: number }[] = [];
  let rem = cent;
  for (let i = 0; i < DENOM_TABLE.length; i++) {
    const d = DENOM_TABLE[i]!;
    const n = Math.floor(rem / d.cent);
    if (n > 0) {
      out.push({ idx: i, count: n });
      rem -= n * d.cent;
    }
  }
  return out;
}

function CoinBreakdownRow({
  cent,
  matched,
}: {
  cent: number;
  matched: boolean;
}) {
  const breakdown = decomposeCent(cent);
  const MAX_VISIBLE = 6;
  return (
    <>
      <style>{`
        /* v0.33.47 (Ep121 bank-coin-pyramid-3d): 3D 钱币堆叠塔
           - flex-row 多列，每列 = 一个面额的竖塔
           - 每枚硬币 = 椭圆 disc (perspective 顶部稍宽，底部稍窄)
           - margin-top: -10px 让 coin 叠在前一枚之上 (硬币堆感)
           - max 6 枚可见，多了显示 "+N" 顶 chip
        */
        .coin-stack-row {
          display: flex;
          flex-wrap: wrap;
          align-items: flex-end;
          gap: 0.42rem;
          margin-top: 0.5rem;
          min-height: 2.5rem;
          padding: 0.3rem 0.2rem 0.3rem;
        }
        .coin-stack-col {
          display: flex;
          flex-direction: column-reverse;
          align-items: center;
          position: relative;
        }
        .coin-stack-label {
          margin-top: 0.25rem;
          font-family: ui-monospace, monospace;
          font-size: 10px;
          font-weight: 900;
          color: #1e293b;
          background: rgba(255, 255, 255, 0.92);
          padding: 0.08rem 0.36rem;
          border-radius: 999px;
          border: 1.5px solid var(--coin-bg, #f59e0b);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
          letter-spacing: 0.02em;
        }
        .coin-disc {
          width: 30px;
          height: 12px;
          border-radius: 50%;
          background: radial-gradient(
            ellipse at 50% 30%,
            var(--coin-bg-light, #fde68a) 0%,
            var(--coin-bg, #f59e0b) 65%,
            color-mix(in srgb, var(--coin-bg, #f59e0b) 80%, #000) 100%
          );
          border: 1.2px solid color-mix(in srgb, var(--coin-bg, #f59e0b) 70%, #000);
          box-shadow:
            0 1.5px 0 color-mix(in srgb, var(--coin-bg, #f59e0b) 70%, #000),
            0 2px 3px rgba(0, 0, 0, 0.32);
          margin-top: -8px;
          position: relative;
          animation: coin-disc-stack 320ms cubic-bezier(.34, 1.56, .64, 1);
        }
        .coin-disc:first-child {
          margin-top: 0;
        }
        @keyframes coin-disc-stack {
          0%   { transform: translateY(-14px) scale(1.08); opacity: 0; }
          70%  { transform: translateY(1px) scale(1); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .coin-stack-overflow {
          font-size: 9.5px;
          font-weight: 900;
          color: #ffffff;
          background: rgba(15, 23, 42, 0.78);
          padding: 0.06rem 0.3rem;
          border-radius: 999px;
          margin-bottom: -3px;
          margin-top: 1px;
          letter-spacing: 0.02em;
          border: 1px solid rgba(255, 255, 255, 0.5);
        }
        .coin-stack-col.is-matched .coin-disc {
          animation: coin-disc-stack 320ms cubic-bezier(.34, 1.56, .64, 1),
                     coin-disc-glow 1.6s ease-in-out infinite;
        }
        .coin-stack-col.is-matched .coin-stack-label {
          background: #d1fae5;
          color: #065f46;
          border-color: #10b981;
        }
        @keyframes coin-disc-glow {
          0%, 100% { filter: brightness(1) drop-shadow(0 0 0 transparent); }
          50%      { filter: brightness(1.18) drop-shadow(0 0 6px rgba(16, 185, 129, 0.7)); }
        }
        .coin-breakdown-empty {
          font-size: 10px;
          color: #94a3b8;
          font-style: italic;
          margin-top: 0.55rem;
        }
        @media (prefers-reduced-motion: reduce) {
          .coin-disc { animation: none; }
          .coin-stack-col.is-matched .coin-disc { animation: none; }
        }
      `}</style>
      {breakdown.length === 0 ? (
        <div className="coin-breakdown-empty">输入数字 → 自动堆成纸币硬币</div>
      ) : (
        <div className="coin-stack-row" aria-label="金额分解">
          {breakdown.map(({ idx, count }) => {
            const d = DENOM_TABLE[idx]!;
            const visible = Math.min(count, MAX_VISIBLE);
            const overflow = count - visible;
            return (
              <div
                key={`${idx}-${count}`}
                className={`coin-stack-col ${matched ? "is-matched" : ""}`}
                style={
                  {
                    ["--coin-bg" as string]: d.bg,
                    ["--coin-bg-light" as string]: d.color,
                  } as React.CSSProperties
                }
                aria-label={`${count} 枚 ${d.label}`}
              >
                <span className="coin-stack-label">{d.label}</span>
                {overflow > 0 && (
                  <span className="coin-stack-overflow">+{overflow}</span>
                )}
                {Array.from({ length: visible }).map((_, i) => (
                  <span
                    key={i}
                    className="coin-disc"
                    style={{ animationDelay: `${i * 40}ms` }}
                  />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
