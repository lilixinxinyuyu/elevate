/**
 * v0.33.30 (Ep106 customer-ribbon): 4 mini-game 共享的 customer bubble。
 *
 * 之前 Bank/Bakery/Store/Airport Page 各自 inline 复制粘贴一份，4 份 ~35 行
 * 几乎一致只差 line 字段（Airport 双语；其他单语）。这里抽成 shared 组件。
 *
 * 新加 `ribbon` 槽：顶部小 banner 显示"订单要求"概要 — emoji + 短文。
 * 例如 "📋 想要 ¥1.70" / "📋 切 3 块 🍰" / "🛄 牛奶x2 面包x1"。
 *
 * Props:
 *   - emoji: 顾客头像 emoji
 *   - mood: hello / focus / happy → 决定 emote (💬/👀/🎉) 和 bubble class
 *   - children: 对白内容（ReactNode；Airport 用 双语 div，其他用单串）
 *   - hint: 可选小灯泡提示
 *   - hintIcon: hint 前缀图标，默认 💡（Airport 历来用 🛄）
 *   - ribbon: 可选顶部 order banner —  { text, accent? }，accent 用作 CSS var --ribbon-accent
 */

import type { ReactNode } from "react";

export type CustomerMood = "hello" | "focus" | "happy";

export interface CustomerBubbleProps {
  emoji: string;
  mood?: CustomerMood;
  hint?: string;
  hintIcon?: string;
  ribbon?: { text: string; accent?: string };
  children: ReactNode;
}

export function CustomerBubble({
  emoji,
  mood = "hello",
  hint,
  hintIcon = "💡",
  ribbon,
  children,
}: CustomerBubbleProps) {
  const emote = mood === "happy" ? "🎉" : mood === "focus" ? "👀" : "💬";
  return (
    <div
      className="absolute world-customer-bubble-wrap"
      style={{
        zIndex: 55,
        left: "50%",
        transform: "translateX(-50%)",
        top: "12%",
      }}
    >
      {ribbon && (
        <div
          className="world-customer-ribbon"
          style={
            ribbon.accent
              ? ({ ["--ribbon-accent" as string]: ribbon.accent } as React.CSSProperties)
              : undefined
          }
        >
          <span className="world-customer-ribbon-icon" aria-hidden>📋</span>
          <span>{ribbon.text}</span>
        </div>
      )}
      <div className={`world-customer-bubble world-customer-bubble-${mood}`}>
        <div className="world-customer-bubble-avatar-wrap">
          <div className="world-customer-bubble-avatar">{emoji}</div>
          <span className="world-customer-emote">{emote}</span>
        </div>
        <div className="max-w-md">
          <div className="world-customer-bubble-card">
            {children}
            {hint && (
              <div className="world-customer-bubble-hint">
                {hintIcon} {hint}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
