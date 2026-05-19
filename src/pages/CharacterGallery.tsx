/**
 * v0.35.89 — Character Gallery (dev preview, 12 base avatars 4x3 grid).
 *
 * Bruce 拍板:
 * - 6 archetype: Scholar/Scientist/Explorer/Mage/Warrior/Artist
 * - 2 gender: female / male
 * = 12 base Lv1 avatars (pre-gen, instant onboarding 不等)
 *
 * 本页让 Bruce 一眼看完 12 张 base 评审:
 * - 风格一致 (anime cel-shading)?
 * - 同年龄段 (10岁 不漂)?
 * - archetype 差异化 (outfit + prop 清晰区别)?
 * - 性别可识别但保持 cute (不偏 mature)?
 *
 * 入口: `/math/character-gallery`
 */
import { Link } from "react-router-dom";

const ARCHETYPES = [
  { id: "scholar", label: "学者 Scholar", emoji: "📚", desc: "蓝开衫 + 笔记本 + 铅笔徽章" },
  { id: "scientist", label: "科学家 Scientist", emoji: "🔬", desc: "白大褂 + 烧瓶 + 护目镜" },
  { id: "explorer", label: "探险家 Explorer", emoji: "🗺️", desc: "冒险背心 + 罗盘 + 地图" },
  { id: "mage", label: "魔法师 Mage", emoji: "🧙", desc: "巫师袍 + 魔杖 + 巫师帽" },
  { id: "warrior", label: "武士 Warrior", emoji: "⚔️", desc: "道服 + 红头带 + 木剑" },
  { id: "artist", label: "艺术家 Artist", emoji: "🎨", desc: "围裙 + 调色板 + 画笔" },
] as const;

const GENDERS = ["female", "male"] as const;

export function CharacterGalleryPage() {
  return (
    <div
      className="fixed inset-0 z-50 overflow-auto text-amber-50"
      style={{
        minHeight: "100dvh",
        background: "radial-gradient(ellipse at top, #1e1b4b 0%, #0f0d2e 60%, #050315 100%)",
      }}
    >
      {/* 4 角 soft blob */}
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-violet-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-amber-500/15 blur-[120px] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6 text-center">
          <Link to="/math" className="inline-block mb-3 px-3 py-1.5 rounded-xl bg-black/50 backdrop-blur-md border border-violet-300/30 text-xs font-bold text-violet-100 hover:scale-105 transition">← 回首页</Link>
          <h1 className="text-2xl sm:text-3xl font-display font-black text-amber-200">Character Gallery v1</h1>
          <p className="text-sm text-violet-200 mt-1">12 张 Lv1 学校段 base avatar — wan2.7-image-pro × CV 抠图 (cn-beijing)</p>
          <p className="text-xs text-violet-300/70 mt-1">6 archetype × 2 gender — onboarding 选择后即时 load (跳过 wait)</p>
        </div>

        {/* 12 卡 4x3 grid (Female top 6, Male bottom 6) */}
        {GENDERS.map((gender) => (
          <div key={gender} className="mb-8">
            <h2 className="text-lg font-display font-bold text-amber-300 mb-3 px-2">
              {gender === "female" ? "♀ 女生 Female" : "♂ 男生 Male"}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {ARCHETYPES.map((arc) => (
                <div
                  key={`${arc.id}-${gender}`}
                  className="rounded-2xl bg-gradient-to-b from-violet-900/40 to-black/60 backdrop-blur-md border border-amber-300/30 overflow-hidden shadow-xl hover:scale-[1.03] transition"
                >
                  {/* Portrait */}
                  <div className="aspect-square bg-gradient-to-br from-indigo-900/40 to-fuchsia-900/30 relative">
                    <img
                      src={`/character/base-${arc.id}-${gender}-school-v1.png`}
                      alt={`${arc.label} ${gender}`}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-bold text-amber-300">
                      {arc.emoji} {arc.id}
                    </div>
                  </div>
                  {/* Info */}
                  <div className="px-3 py-2">
                    <div className="font-display font-bold text-amber-100 text-sm">{arc.label}</div>
                    <div className="text-[10px] text-violet-200/70 mt-0.5 leading-tight">{arc.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* 评审 question */}
        <div className="mt-6 p-4 rounded-2xl bg-black/40 backdrop-blur-md border border-amber-300/30 text-sm">
          <h3 className="font-display font-bold text-amber-300 mb-2">📋 Bruce 评审 question</h3>
          <ul className="space-y-1 text-violet-100 list-disc list-inside">
            <li>风格统一? (anime cel-shading + 短发 + 10岁感)</li>
            <li>archetype 一眼可识别? (outfit + prop 区别)</li>
            <li>男/女 区分清晰? (不混)</li>
            <li>哪个 archetype 需要 reroll / 调 prompt?</li>
            <li>是否同意以这 12 张作为 onboarding base?</li>
          </ul>
          <p className="text-[11px] text-violet-300/70 mt-2">
            评审通过后 → Phase B: onboarding modal + DB schema 接通选择 + Hub 自动 load 学生 base
          </p>
        </div>
      </div>
    </div>
  );
}
