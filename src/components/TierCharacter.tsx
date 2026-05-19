/**
 * v0.35.85 — TierCharacter component (Phase 1 character growth infra).
 *
 * Bruce 提议 (基于 PUBG / Fortnite / Ring Fit Adventure 3 张 ref):
 * "段位徽章变成角色形象, 每次升级 → 形象变化"
 *
 * Peer review (Gemini + GPT 共识):
 * - 普罗透斯效应 (Proteus Effect): avatar 自我投射, 比段位徽章对受挫儿童更友好
 * - 同人物 + 不同 outfit + 配件 + 微表情, 不要"不同年龄"
 * - tier badge demote 头像角标, 不弃
 * - 必须 Phase 切分 (10 iter ≠ 一气呵成)
 *
 * Phase 1 (MVP, 本组件):
 * - UI 基础设施: 立绘 slot 替换 emoji 圆
 * - 5 tier (school/district/city/province/country) × 1 PNG/tier (later wan)
 * - Fallback: tier emoji 圆 (老样式) 若 PNG 未上传
 * - tier label below: "Lv1 · 学校段 · 锦江数学小达人"
 * - sub-rank ornament 跟 character 共存 (头像右下角)
 *
 * Phase 2 (下下轮 quota 恢复后):
 * - Wan 生成 4-5 张暗 bg 立绘 → CV 抠图 → OSS /character/tier-<id>-v1.png
 * - 同 character bible: 短发圆脸大眼 10岁, anime cel-shading, 蓝开衫 base (复用小进 DNA)
 *   每 tier outfit 进化: 校服 → 训练夹克 → 战术服 → 半披风 → hero 套装
 *
 * Phase 3:
 * - 升级白光爆开动画 + character bible 网页 (Bruce 评审)
 */
import type { Tier } from "../core/tiers";

/**
 * Avatar PNG 上传后放 public/character/tier-<id>-v1.png.
 * Empty list (current state) → 全 fallback emoji 圆.
 * 上传后无需改代码, 自动加载新立绘.
 */
const AVAILABLE_AVATARS = new Set<string>([
  "school",   // v0.35.88 Lv1 校园学者 (wan2.7-image-pro + CV 抠图)
  "country",  // v0.35.88 Lv5 国家英雄
  // "district", "city", "province" — 待生
]);

export function TierCharacter({
  tier,
  subRank,
  subRankRoman,
  size = "md",
}: {
  tier: Tier;
  subRank: number;
  subRankRoman: string;
  size?: "sm" | "md" | "lg";
}) {
  const hasAvatar = AVAILABLE_AVATARS.has(tier.id);
  const avatarUrl = hasAvatar ? `/character/tier-${tier.id}-v1.png` : null;

  // 尺寸 token (Mission Panel 用 md, 庆祝页用 lg, 紧凑 chip 用 sm)
  const dims = {
    sm: { w: "w-12", h: "h-16", emojiSize: "text-2xl", ornament: "text-xs" },
    md: { w: "w-20", h: "h-28", emojiSize: "text-4xl", ornament: "text-base" },
    lg: { w: "w-32", h: "h-44", emojiSize: "text-6xl", ornament: "text-xl" },
  }[size];

  // sub-rank ornament emoji (rank ≥2 显示)
  const ornamentEmoji = subRank >= 2
    ? (subRank === 5 ? "👑" : subRank === 4 ? "🏅" : subRank === 3 ? "💎" : "✨")
    : null;

  return (
    <div className={`relative shrink-0 ${dims.w} ${dims.h}`}>
      {/* 光环 (放角色后面) */}
      <div
        className="absolute inset-0 -m-2 rounded-2xl blur-xl opacity-50 pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(252,211,77,0.45), transparent 60%)" }}
      />

      {/* 主体 — 立绘 或 fallback emoji 圆 */}
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`${tier.name} 形象`}
          className={`relative ${dims.w} ${dims.h} object-cover object-top rounded-2xl border-[3px] border-amber-300 bg-gradient-to-b from-amber-900/30 to-amber-950/50 shadow-xl`}
          style={{ boxShadow: "0 0 30px rgba(252,211,77,0.4), inset 0 1px 4px rgba(255,255,255,0.2)" }}
        />
      ) : (
        <div
          className={`relative ${dims.w} ${dims.h} rounded-2xl border-[3px] border-amber-300 bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-xl flex flex-col items-center justify-center overflow-hidden`}
          style={{ boxShadow: "0 0 30px rgba(252,211,77,0.4), inset 0 2px 8px rgba(255,255,255,0.3)" }}
          title={`${tier.name} 立绘待生成`}
        >
          <span className={dims.emojiSize}>{tier.badgeIcon}</span>
          <span className="text-[9px] text-amber-100/70 mt-0.5 px-1 text-center leading-none">立绘 wip</span>
        </div>
      )}

      {/* sub-rank ornament (右下角, 跟立绘共存) */}
      {ornamentEmoji && (
        <span
          className={`absolute -bottom-1 -right-1 ${dims.ornament} drop-shadow-[0_0_4px_rgba(255,255,255,0.7)] z-10 select-none`}
          title={`${subRankRoman} 段`}
          aria-hidden
        >
          {ornamentEmoji}
        </span>
      )}
    </div>
  );
}
