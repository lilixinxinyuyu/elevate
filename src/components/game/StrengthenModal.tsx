/**
 * v0.35.3 (iter 37 P1-2): 强化挑战 modal — 错答后 FeedbackPanel 旁边的入口.
 *
 * 评审共识: 不要 10s 自动消失 — 改成 inline CTA, 用户点"继续/跳过"才走.
 * 这里实现成 inline panel (而不是 modal overlay), 跟 FeedbackPanel 并列.
 */
import { useNavigate } from "react-router-dom";
import { STRENGTHEN_SESSION_SIZE, markSkillSkipped, type StrengthenSkillContext } from "../../core/strengthenPolicy";

interface Props {
  skillCtx: StrengthenSkillContext;
  /** 关闭 modal — 跳过时调用 */
  onSkip: () => void;
  /** 接受 — navigate 走 strengthen route */
  onAccept?: () => void;
}

export function StrengthenInlineCTA({ skillCtx, onSkip, onAccept }: Props) {
  const navigate = useNavigate();

  function accept() {
    onAccept?.();
    // navigate 带上 skill context 作 query string
    const params = new URLSearchParams({
      skill: skillCtx.skill_id,
      diff: String(skillCtx.difficulty),
      exclude: skillCtx.excludeQuestionId,
      count: String(STRENGTHEN_SESSION_SIZE),
    });
    navigate(`/math/strengthen?${params.toString()}`);
  }

  function skip() {
    markSkillSkipped(skillCtx.skill_id);
    onSkip();
  }

  return (
    <div className="mt-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-3 space-y-2 animate-slide-up">
      <div className="flex items-start gap-2">
        <span className="text-xl">💪</span>
        <div className="flex-1">
          <p className="text-sm text-amber-100 font-semibold">来 {STRENGTHEN_SESSION_SIZE} 道同型加练?</p>
          <p className="text-xs text-amber-200/80 mt-0.5">
            刚才那道题的同类型 — 全对 +15 XP
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={accept}
          className="flex-1 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-400"
        >
          ✅ 来 {STRENGTHEN_SESSION_SIZE} 题
        </button>
        <button
          onClick={skip}
          className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-sm hover:bg-slate-600"
        >
          先跳过
        </button>
      </div>
    </div>
  );
}
