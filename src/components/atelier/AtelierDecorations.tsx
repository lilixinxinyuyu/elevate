/**
 * 工坊大厅装饰层 —— 叠加在 Mascot3D viewport 上，随灵感 stage 解锁。
 *
 * Stage 1 (≥10):  📚 书架（左下）
 * Stage 2 (≥25):  ✨ 飘浮 sparkles
 * Stage 3 (≥50):  🪴 植物 + 🌟 星核更亮
 * Stage 4 (≥100): 🪐 行星 + 🌌 deeper glow
 * Stage 5 (≥200): 全部 + 🎀 蝴蝶结 + 工坊 "complete" 标记
 *
 * 设计原则：装饰是 HTML/CSS overlay，不动 R3F Canvas。
 * 每个装饰用 absolute 定位 + 简单 transition 淡入，让 stage 跳上去时有过渡感。
 */

interface Props {
  stage: number; // 0-5
}

export function AtelierDecorations({ stage }: Props) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Stage 1: 书架 — 左下角 */}
      <div
        className="absolute left-3 bottom-20 text-3xl transition-all duration-700"
        style={{
          opacity: stage >= 1 ? 1 : 0,
          transform: stage >= 1 ? "translateY(0)" : "translateY(20px)",
        }}
      >
        📚
      </div>

      {/* Stage 2: sparkles — 散布 */}
      {stage >= 2 && (
        <>
          <div className="absolute top-8 right-6 text-base animate-pulse" style={{ animationDelay: "0s" }}>
            ✨
          </div>
          <div className="absolute top-16 left-12 text-sm animate-pulse" style={{ animationDelay: "0.5s" }}>
            ✨
          </div>
          <div className="absolute top-24 right-20 text-base animate-pulse" style={{ animationDelay: "1s" }}>
            ✨
          </div>
        </>
      )}

      {/* Stage 3: 植物 + 茶杯 (left mid) + 星核亮 */}
      <div
        className="absolute left-3 bottom-36 text-2xl transition-all duration-700"
        style={{
          opacity: stage >= 3 ? 1 : 0,
          transform: stage >= 3 ? "translateY(0)" : "translateY(15px)",
        }}
      >
        🪴
      </div>
      <div
        className="absolute right-3 bottom-32 text-2xl transition-all duration-700"
        style={{
          opacity: stage >= 3 ? 1 : 0,
          transform: stage >= 3 ? "translateY(0)" : "translateY(15px)",
          transitionDelay: "200ms",
        }}
      >
        🍵
      </div>

      {/* Stage 3+: 星核 glow overlay — 弱光晕从中央散开 */}
      {stage >= 3 && (
        <div
          aria-hidden
          className="absolute inset-0 transition-opacity duration-1000"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(252,211,77,0.15) 0%, transparent 60%)",
            opacity: stage >= 3 ? 1 : 0,
          }}
        />
      )}

      {/* Stage 4: 行星 right-top */}
      <div
        className="absolute right-6 top-6 text-3xl transition-all duration-700"
        style={{
          opacity: stage >= 4 ? 1 : 0,
          transform: stage >= 4 ? "scale(1)" : "scale(0.7)",
        }}
      >
        🪐
      </div>

      {/* Stage 4+: deeper glow — 紫蓝色环绕 */}
      {stage >= 4 && (
        <div
          aria-hidden
          className="absolute inset-0 transition-opacity duration-1000"
          style={{
            background:
              "radial-gradient(ellipse at 50% 80%, rgba(167,139,250,0.18) 0%, transparent 50%)",
          }}
        />
      )}

      {/* Stage 5: 完整态 — 蝴蝶结 + complete badge */}
      <div
        className="absolute right-3 top-20 text-2xl transition-all duration-700"
        style={{
          opacity: stage >= 5 ? 1 : 0,
          transform: stage >= 5 ? "rotate(0deg) scale(1)" : "rotate(-30deg) scale(0.5)",
        }}
      >
        🎀
      </div>

      {stage >= 5 && (
        <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-amber-500/80 backdrop-blur-sm text-[10px] text-amber-50 font-bold border border-amber-300/60">
          🌟 工坊完整态
        </div>
      )}
    </div>
  );
}
