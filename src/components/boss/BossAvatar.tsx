/**
 * v0.31.58: Boss 怪兽插画 — 优先 AI 生成图，回退 emoji。
 *
 * 7 张图（6 个 G4B 单元 boss + 1 期末大魔王）通过运维脚本
 * scripts/_generate-boss-images.mjs 生成，存到 db.trophyImages 下
 * trophyId = `math_boss_${unitId}`。useLiveQuery 订阅，下载完了立刻显示。
 *
 * v0.31.74：
 *   - 加 state prop: "normal" | "enraged" — 狂怒态优先用 _enraged 变体图
 *   - 找不到 _enraged 变体时 fallback 到普通图 + CSS 红色滤镜（让视觉立即区分）
 *
 * 使用：
 *   <BossAvatar unitId="G4B_U3_DECIMAL_MULTIPLY" emoji="✖️" size={96} />
 *   <BossAvatar unitId={boss.unitId} emoji={boss.emoji} state="enraged" size={64} />
 */
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/dexie";

interface BossAvatarProps {
  /** Boss 对应的单元 id（FINAL boss 用 "FINAL"） */
  unitId: string;
  /** 兜底 emoji，AI 图缺失时显示 */
  emoji: string;
  /** 尺寸（px）默认 64 */
  size?: number;
  className?: string;
  /** 用作 img alt 文本 */
  alt?: string;
  /** v0.31.74：boss 当前状态，影响图选择 + 视觉效果 */
  state?: "normal" | "enraged";
}

export function BossAvatar({
  unitId,
  emoji,
  size = 64,
  className = "",
  alt,
  state = "normal",
}: BossAvatarProps) {
  const baseTrophyId = `math_boss_${unitId}`;
  const enragedTrophyId = `math_boss_${unitId}_enraged`;

  // 同时订阅普通和狂怒态两张图，渲染时按 state 选
  const baseImg = useLiveQuery(
    async () => await db.trophyImages.get(baseTrophyId),
    [baseTrophyId],
  );
  const enragedImg = useLiveQuery(
    async () => await db.trophyImages.get(enragedTrophyId),
    [enragedTrophyId],
  );

  // 选图优先级：
  //   enraged 态 → enraged 变体 > 普通图（加红滤镜模拟狂怒）> emoji
  //   normal 态  → 普通图 > emoji
  const useImg =
    state === "enraged"
      ? enragedImg ?? baseImg
      : baseImg;

  // 没有专属 enraged 图时，给普通图加红色滤镜（hue rotate + saturation boost）
  const fallbackEnraged = state === "enraged" && !enragedImg && !!baseImg;

  if (useImg?.imageDataUrl) {
    return (
      <img
        src={useImg.imageDataUrl}
        alt={alt ?? `boss ${unitId}${state === "enraged" ? " (enraged)" : ""}`}
        className={`object-contain ${className}`}
        style={{
          width: size,
          height: size,
          filter: fallbackEnraged
            ? "hue-rotate(-30deg) saturate(1.6) brightness(1.05) drop-shadow(0 0 12px rgba(244, 63, 94, 0.65))"
            : undefined,
        }}
      />
    );
  }
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      style={{ fontSize: size * 0.85, width: size, height: size, lineHeight: 1 }}
      role="img"
      aria-label={alt ?? `boss ${unitId} (emoji fallback)`}
    >
      {emoji}
    </span>
  );
}
