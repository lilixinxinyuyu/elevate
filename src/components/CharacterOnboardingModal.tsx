/**
 * v0.35.90 — Character Onboarding Modal (3 step).
 *
 * Bruce 拍板:
 * - 6 archetype + 2 gender 选择
 * - Blocking wait + wait-time questions (利用 gen 时间问 personalization)
 * - 因 base 已 pre-gen (12 张), 不需真 wait, 但仍跑 personalization 增强 ownership
 *
 * 3 step flow:
 * 1. Gender (女 / 男 chip)
 * 2. Archetype (6 卡片, 显示对应 gender 的 base avatar preview)
 * 3. Personalization (3 题 multiple choice)
 *
 * Save to db.meta::characterChoice + characterPersonalization.
 * close 后 Hub 自动 load 新 avatar.
 */
import { useState } from "react";
import {
  type Archetype,
  type Gender,
  ARCHETYPE_META,
  setCharacterChoice,
  setPersonalization,
} from "../lib/characterChoice";

interface Props {
  studentId: string;
  onComplete: () => void;
}

const PERSONALIZATION_QUESTIONS: { id: string; q: string; options: string[] }[] = [
  {
    id: "hardestUnit",
    q: "数学最让你头疼的是?",
    options: ["分数小数", "应用题", "几何图形", "时间金钱", "口算速度", "其他都行"],
  },
  {
    id: "encouragement",
    q: "希望小进怎么鼓励你?",
    options: ["温柔陪伴 🌸", "热血加油 🔥", "幽默搞笑 😆", "认真分析 📊"],
  },
  {
    id: "learnTime",
    q: "你最爱什么时候练数学?",
    options: ["放学回家立刻", "晚饭后", "睡前", "周末上午", "想练就练"],
  },
];

export function CharacterOnboardingModal({ studentId, onComplete }: Props) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [gender, setGender] = useState<Gender | null>(null);
  const [archetype, setArchetype] = useState<Archetype | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!gender || !archetype) return;
    setSaving(true);
    try {
      await setCharacterChoice(studentId, { archetype, gender });
      await setPersonalization(studentId, answers);
      // step 4 reveal 动画
      setStep(4);
      setTimeout(() => onComplete(), 1800);
    } catch (e) {
      console.error("[onboarding] save failed", e);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" style={{ height: "100dvh" }}>
      <div className="relative w-full max-w-2xl bg-gradient-to-br from-violet-900 via-fuchsia-900 to-violet-950 rounded-3xl border-2 border-amber-300 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">

        {/* 装饰光环 */}
        <div className="absolute -top-32 -left-32 w-64 h-64 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-64 h-64 rounded-full bg-violet-400/20 blur-3xl pointer-events-none" />

        {/* 进度 指示 */}
        <div className="relative px-6 pt-5 pb-2 flex items-center gap-2 border-b border-white/10">
          <div className="text-amber-300 text-2xl">🐼</div>
          <div className="flex-1">
            <div className="text-amber-200 text-xs uppercase tracking-widest">小进 数学伙伴 onboarding</div>
            <div className="font-display font-bold text-white text-sm">
              {step === 1 && "✦ 第 1 / 3 步 · 选择性别"}
              {step === 2 && "✦ 第 2 / 3 步 · 选择身份"}
              {step === 3 && "✦ 第 3 / 3 步 · 了解一下你"}
              {step === 4 && "✨ 形象激活!"}
            </div>
          </div>
          {/* dots progress */}
          <div className="flex gap-1.5">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`w-2 h-2 rounded-full ${step >= s ? "bg-amber-300" : "bg-white/20"}`} />
            ))}
          </div>
        </div>

        {/* Step 1: Gender */}
        {step === 1 && (
          <div className="relative px-6 py-6 text-white">
            <h2 className="font-display font-bold text-2xl text-center mb-1">你是男生还是女生?</h2>
            <p className="text-center text-violet-200 text-sm mb-6">选一个跟你最像的</p>
            <div className="grid grid-cols-2 gap-4">
              {(["female", "male"] as Gender[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`p-6 rounded-2xl border-2 transition-all ${
                    gender === g
                      ? "bg-amber-400 border-amber-200 text-amber-950 scale-105 shadow-xl"
                      : "bg-white/5 border-white/20 hover:bg-white/10 hover:scale-[1.02]"
                  }`}
                >
                  <div className="text-6xl mb-3">{g === "female" ? "👧" : "👦"}</div>
                  <div className="font-display font-black text-xl">{g === "female" ? "女生" : "男生"}</div>
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!gender}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 font-bold shadow-lg disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 transition"
              >
                下一步 →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Archetype */}
        {step === 2 && gender && (
          <div className="relative px-6 py-5 text-white">
            <h2 className="font-display font-bold text-2xl text-center mb-1">你想做哪种数学伙伴?</h2>
            <p className="text-center text-violet-200 text-sm mb-4">点头像看看 — 之后升级形象会一起进化</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(Object.keys(ARCHETYPE_META) as Archetype[]).map((arc) => {
                const meta = ARCHETYPE_META[arc];
                const selected = archetype === arc;
                return (
                  <button
                    key={arc}
                    onClick={() => setArchetype(arc)}
                    className={`p-2 rounded-2xl border-2 transition-all ${
                      selected
                        ? "bg-amber-400/20 border-amber-300 scale-[1.05] shadow-lg"
                        : "bg-white/5 border-white/15 hover:bg-white/10"
                    }`}
                  >
                    <div className="aspect-square rounded-xl overflow-hidden mb-1 bg-gradient-to-br from-violet-900/60 to-fuchsia-900/40">
                      <img
                        src={`/character/base-${arc}-${gender}-school-v1.png`}
                        alt={meta.label}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className={`font-display font-bold text-sm ${selected ? "text-amber-200" : "text-white"}`}>
                      {meta.emoji} {meta.label}
                    </div>
                    <div className="text-[10px] text-violet-200/70 leading-tight">{meta.desc}</div>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-between">
              <button onClick={() => setStep(1)} className="text-violet-200 text-sm hover:text-white">← 回上一步</button>
              <button
                onClick={() => setStep(3)}
                disabled={!archetype}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-amber-950 font-bold shadow-lg disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 transition"
              >
                下一步 →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Personalization */}
        {step === 3 && (
          <div className="relative px-6 py-5 text-white">
            <h2 className="font-display font-bold text-2xl text-center mb-1">了解一下你</h2>
            <p className="text-center text-violet-200 text-sm mb-4">回答 3 题, 小进可以给你更合适的鼓励</p>
            <div className="space-y-4">
              {PERSONALIZATION_QUESTIONS.map((q) => (
                <div key={q.id}>
                  <div className="font-bold text-amber-200 text-sm mb-2">{q.q}</div>
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((opt) => {
                      const selected = answers[q.id] === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                            selected
                              ? "bg-amber-400 border-amber-200 text-amber-950"
                              : "bg-white/5 border-white/15 text-violet-100 hover:bg-white/10"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-between">
              <button onClick={() => setStep(2)} className="text-violet-200 text-sm hover:text-white">← 回上一步</button>
              <button
                onClick={save}
                disabled={Object.keys(answers).length < PERSONALIZATION_QUESTIONS.length || saving}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 text-amber-950 font-bold shadow-xl disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 transition"
              >
                {saving ? "保存中..." : "✦ 激活我的形象"}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Reveal */}
        {step === 4 && gender && archetype && (
          <div className="relative px-6 py-8 text-white text-center" style={{ animation: "onboarding-reveal 1.5s ease-out" }}>
            <div className="text-amber-300 text-xs uppercase tracking-widest mb-2">形象激活</div>
            <div className="mx-auto w-40 h-40 rounded-3xl overflow-hidden border-4 border-amber-300 shadow-[0_0_40px_rgba(252,211,77,0.7)] mb-3">
              <img
                src={`/character/base-${archetype}-${gender}-school-v1.png`}
                alt="你的形象"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="font-display font-black text-2xl text-amber-200">
              {ARCHETYPE_META[archetype].emoji} {ARCHETYPE_META[archetype].label}
            </div>
            <div className="text-sm text-violet-200 mt-1">{ARCHETYPE_META[archetype].outfit}</div>
            <div className="text-xs text-violet-300/80 mt-3">和小进一起开始数学冒险!</div>
          </div>
        )}

        <style>{`
          @keyframes onboarding-reveal {
            0% { transform: scale(0.6); opacity: 0; }
            60% { transform: scale(1.1); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}
