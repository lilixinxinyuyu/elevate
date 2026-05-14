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

import { useState } from "react";
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
        <div className="world-panel-title flex items-center justify-between">
          <span>🏧 柜台终端</span>
          <span className="text-[10px] text-blue-700 font-mono">BANK-T01</span>
        </div>

        {/* 显示屏 */}
        <div className="rounded-xl border-2 border-blue-300 bg-gradient-to-b from-blue-50 to-blue-100 p-3 mb-3 shadow-inner">
          <div className="text-[10px] text-blue-700 font-bold uppercase tracking-wide flex justify-between">
            <span>目标 / 当前</span>
            <span className="font-mono">{order.targetCent} ¢</span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <div className="font-mono text-blue-900 text-lg font-bold">
              {formatYuan(order.targetCent)}
            </div>
            <div
              className={`font-mono text-2xl font-black ${
                inputCent === 0
                  ? "text-slate-300"
                  : inputCent === order.targetCent
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
        </div>

        {/* 键盘 3×4 */}
        <div className="grid grid-cols-3 gap-2">
          {keys.map((k, i) => (
            <button
              key={i}
              type="button"
              onClick={k.onClick}
              disabled={locked}
              className={`rounded-xl font-bold py-3 shadow active:translate-y-0.5 transition-transform select-none ${
                k.cls ?? "bg-white text-blue-900 hover:bg-blue-50"
              } border border-blue-200`}
              style={{ fontSize: "1.4rem" }}
            >
              {k.label}
            </button>
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
