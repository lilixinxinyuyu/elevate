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
  return (
    <>
      <style>{`
        .coin-breakdown-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.3rem;
          margin-top: 0.55rem;
          min-height: 1.8rem;
        }
        .coin-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.22rem;
          padding: 0.18rem 0.5rem;
          border-radius: 999px;
          font-family: ui-monospace, monospace;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.02em;
          color: var(--chip-fg, #fff);
          background: linear-gradient(180deg, var(--chip-bg-light, #fbbf24), var(--chip-bg, #f59e0b));
          border: 1.5px solid rgba(255, 255, 255, 0.7);
          box-shadow:
            0 2px 0 rgba(0, 0, 0, 0.18),
            0 4px 8px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.55);
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.25);
          animation: coin-chip-in 280ms cubic-bezier(.34, 1.56, .64, 1);
        }
        .coin-chip-count {
          font-size: 12px;
          padding: 0 0.16rem 0 0;
          opacity: 0.92;
        }
        .coin-chip-times {
          font-size: 9px;
          opacity: 0.62;
        }
        .coin-chip.is-matched {
          --chip-bg-light: #6ee7b7;
          --chip-bg: #10b981;
          animation: coin-chip-in 280ms cubic-bezier(.34, 1.56, .64, 1),
                     coin-chip-pulse 1.6s ease-in-out infinite;
        }
        @keyframes coin-chip-in {
          0%   { transform: scale(0.3) translateY(6px); opacity: 0; }
          70%  { transform: scale(1.12) translateY(0); opacity: 1; }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes coin-chip-pulse {
          0%, 100% { box-shadow:
            0 2px 0 rgba(0, 0, 0, 0.18),
            0 4px 8px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(255, 255, 255, 0.55); }
          50%      { box-shadow:
            0 2px 0 rgba(0, 0, 0, 0.18),
            0 4px 14px rgba(16, 185, 129, 0.7),
            0 0 0 2px rgba(167, 243, 208, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.7); }
        }
        .coin-breakdown-empty {
          font-size: 10px;
          color: #94a3b8;
          font-style: italic;
          margin-top: 0.55rem;
        }
        @media (prefers-reduced-motion: reduce) {
          .coin-chip { animation: none; }
          .coin-chip.is-matched { animation: none; }
        }
      `}</style>
      {breakdown.length === 0 ? (
        <div className="coin-breakdown-empty">输入数字 → 自动分解成纸币硬币</div>
      ) : (
        <div className="coin-breakdown-row" aria-label="金额分解">
          {breakdown.map(({ idx, count }) => {
            const d = DENOM_TABLE[idx]!;
            return (
              <span
                key={`${idx}-${count}`}
                className={`coin-chip ${matched ? "is-matched" : ""}`}
                style={
                  {
                    ["--chip-bg" as string]: d.bg,
                    ["--chip-bg-light" as string]: d.color,
                    ["--chip-fg" as string]: "#fff",
                  } as React.CSSProperties
                }
              >
                <span className="coin-chip-count">{count}</span>
                <span className="coin-chip-times">×</span>
                <span>{d.label}</span>
              </span>
            );
          })}
        </div>
      )}
    </>
  );
}
