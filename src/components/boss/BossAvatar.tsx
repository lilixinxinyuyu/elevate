/**
 * v0.31.58: Boss 怪兽插画 — 优先 AI 生成图，回退 emoji。
 *
 * 7 张图（6 个 G4B 单元 boss + 1 期末大魔王）通过运维脚本
 * scripts/_generate-boss-images.mjs 生成，存到 db.trophyImages 下
 * trophyId = `math_boss_${unitId}`。useLiveQuery 订阅，下载完了立刻显示。
 *
 * 使用：
 *   <BossAvatar unitId="G4B_U3_DECIMAL_MULTIPLY" emoji="✖️" size={96} />
 *   <BossAvatar unitId={boss.unitId} emoji={boss.emoji} size={64} className="rounded-2xl" />
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
}

export function BossAvatar({
  unitId,
  emoji,
  size = 64,
  className = "",
  alt,
}: BossAvatarProps) {
  const trophyId = `math_boss_${unitId}`;
  const img = useLiveQuery(
    async () => await db.trophyImages.get(trophyId),
    [trophyId],
  );

  if (img?.imageDataUrl) {
    return (
      <img
        src={img.imageDataUrl}
        alt={alt ?? `boss ${unitId}`}
        className={`object-contain ${className}`}
        style={{ width: size, height: size }}
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
