/**
 * Phase D — 升段仪式动画 (rank-up celebration).
 *
 * 设计 (docs/character-growth-progress-pause-2026-05-19.md "Phase D"):
 *   当学生跨入新段位 (school → district → … → country) 时, 给角色形象一个进化仪式:
 *     旧立绘 fade out → 白光爆开 → 新立绘 spring-in → 庆祝弹窗 "🎉 形象进化!"
 *
 * Joyful, kid-friendly, framer-motion 驱动. 4 段 phase, 用本地 step state +
 * 定时器推进 (每段结束 setTimeout 进下一段); framer-motion 负责段内的
 * fade/scale/spring 过渡 + 白光 burst.
 *
 * 自包含 (self-contained): 只要 open=true 就从头跑动画, 不需要外部 trigger.
 * 复用 <TierCharacter size="xl" .../> 渲染新旧两个立绘 (Phase C resolver 以后
 * ship 了 district/city 等 per-tier PNG, 这里会自动显示真正不同的进化形象).
 *
 * NOTE: 现在还没接进真正的 level-up 流程 (后续步骤); 仅组件 + /math/tierup-preview
 * 评审页.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TierCharacter } from "./TierCharacter";
import { tierById, TIER_PREFIXES } from "../core/tiers";
import { ARCHETYPE_META, type CharacterChoice } from "../lib/characterChoice";

/** 动画分段 — 用本地 step state 推进, 每段一个 setTimeout. */
type Phase = "old" | "flash" | "new" | "card";

/** 各 phase 时长 (ms), 跟设计 doc 一致. */
const PHASE_MS: Record<Phase, number> = {
  old: 800, // 旧立绘 visible → fade + 缩小
  flash: 500, // 白光爆开 burst
  new: 800, // 新立绘 spring-in
  card: 0, // 庆祝卡常驻直到 onClose
};

const PHASE_ORDER: Phase[] = ["old", "flash", "new", "card"];

export function CharacterTierUpModal({
  open,
  oldTierId,
  newTierId,
  characterChoice,
  onClose,
}: {
  open: boolean;
  oldTierId: string;
  newTierId: string;
  characterChoice: CharacterChoice;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("old");

  // open=true → 从头跑动画; open=false → 复位到第一段, 等下次播放.
  useEffect(() => {
    if (!open) {
      setPhase("old");
      return;
    }
    setPhase("old");
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    // 链式排程: old → flash → new → card.
    for (let i = 0; i < PHASE_ORDER.length - 1; i++) {
      const cur = PHASE_ORDER[i]!;
      const next = PHASE_ORDER[i + 1]!;
      elapsed += PHASE_MS[cur];
      const at = elapsed;
      timers.push(setTimeout(() => setPhase(next), at));
    }
    return () => timers.forEach(clearTimeout);
  }, [open]);

  // Esc 关闭 (跟 LotteryBoxModal 一致的 a11y).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const oldTier = tierById(oldTierId) ?? tierById("school")!;
  const newTier = tierById(newTierId) ?? oldTier;

  // 解锁文案: tier 名 + archetype outfit RPG 名 (hybrid 命名, Bruce 拍板).
  const archMeta = ARCHETYPE_META[characterChoice.archetype];
  const prefix = TIER_PREFIXES[newTier.id] ?? "";
  const unlockLine = `解锁 ${newTier.name} ${archMeta.label} 形象`;
  // 进化称号 (前缀 + archetype label), 例如 "锦江学者".
  const evolveTitle = `${prefix}${archMeta.label}`;

  const showOld = phase === "old";
  const showFlash = phase === "flash";
  const showNew = phase === "new" || phase === "card";
  const showCard = phase === "card";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="tierup-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-black/80 backdrop-blur-md px-4"
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            paddingBottom: "max(16px, env(safe-area-inset-bottom, 0px))",
          }}
          // 卡片阶段允许点背景关闭 (动画进行中不响应, 避免误触打断仪式).
          onClick={(e: React.MouseEvent) => {
            if (e.target === e.currentTarget && showCard) onClose();
          }}
        >
          {/* 角色舞台 — 新旧立绘叠在同一中心位 */}
          <div className="relative flex items-center justify-center w-56 h-80 shrink-0">
            {/* 旧立绘: 可见 → fade + 缩小退场 */}
            <AnimatePresence>
              {showOld && (
                <motion.div
                  key="old-char"
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.78, filter: "blur(4px)" }}
                  transition={{ duration: 0.45, ease: "easeInOut" }}
                >
                  <TierCharacter
                    tier={oldTier}
                    subRank={5}
                    subRankRoman="V"
                    size="xl"
                    characterChoice={characterChoice}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* 新立绘: spring 弹入 (scale 0.6 → 1 + fade) */}
            <AnimatePresence>
              {showNew && (
                <motion.div
                  key="new-char"
                  className="absolute inset-0 flex items-center justify-center"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 16 }}
                >
                  <TierCharacter
                    tier={newTier}
                    subRank={1}
                    subRankRoman="I"
                    size="xl"
                    characterChoice={characterChoice}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* 白光爆开 — 白色 radial circle 放大 + fade */}
            <AnimatePresence>
              {showFlash && (
                <motion.div
                  key="flash"
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="rounded-full"
                    style={{
                      width: 280,
                      height: 280,
                      background:
                        "radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.9) 35%, rgba(252,211,77,0.5) 60%, transparent 75%)",
                    }}
                    initial={{ scale: 0.2, opacity: 0 }}
                    animate={{ scale: 2.4, opacity: [0, 1, 1, 0] }}
                    transition={{ duration: 0.5, ease: "easeOut", times: [0, 0.25, 0.6, 1] }}
                  />
                  {/* sparkle emojis 飞溅 */}
                  {["✨", "🎉", "⭐", "💫", "🌟", "✨"].map((s, i) => {
                    const angle = (i / 6) * Math.PI * 2;
                    return (
                      <motion.span
                        key={i}
                        className="absolute text-3xl select-none"
                        aria-hidden
                        initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                        animate={{
                          opacity: [0, 1, 0],
                          x: Math.cos(angle) * 140,
                          y: Math.sin(angle) * 140,
                          scale: [0.4, 1.2, 0.8],
                        }}
                        transition={{ duration: 0.55, ease: "easeOut" }}
                      >
                        {s}
                      </motion.span>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 庆祝卡 — slide up */}
          <AnimatePresence>
            {showCard && (
              <motion.div
                key="card"
                className={`relative mt-7 w-full max-w-sm rounded-3xl border-2 ${newTier.theme.borderColor} bg-gradient-to-br ${newTier.theme.fromColor} ${newTier.theme.toColor} bg-slate-900/90 px-6 py-6 text-center shadow-2xl`}
                style={{ boxShadow: "0 0 40px rgba(252,211,77,0.25)" }}
                initial={{ opacity: 0, y: 60 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 240, damping: 22 }}
              >
                <motion.div
                  className="font-display font-bold text-3xl text-white leading-tight"
                  initial={{ scale: 0.7 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.05 }}
                >
                  🎉 形象进化!
                </motion.div>

                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className="text-4xl select-none" aria-hidden>
                    {newTier.badgeIcon}
                  </span>
                  <div className="text-left">
                    <div className={`font-bold text-lg ${newTier.theme.textColor}`}>
                      {evolveTitle}
                    </div>
                    <div className={`text-sm ${newTier.theme.subTextColor}`}>{unlockLine}</div>
                  </div>
                </div>

                <div className={`mt-3 text-sm ${newTier.theme.subTextColor} italic`}>
                  {newTier.unlockSlogan}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="mt-5 w-full rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 py-3 font-display font-bold text-lg text-amber-950 shadow-lg active:scale-95 transition-transform"
                >
                  继续 →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
