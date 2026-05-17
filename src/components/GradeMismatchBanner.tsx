/**
 * GradeMismatchBanner — v0.34.72 iter 6
 *
 * 当前题库 schema.ts 写死 grade: literal 4. 老师演示加 5 年级同学 alice, alice
 * 进数学只看 Selena 4 年级题, 体验奇怪. 这个 banner 检测 profile.grade != "4"
 * 时友好提示 "X 年级课本上传中, 先用 4 年级题热身", 给老师一个台阶下 + 设期
 * 望.
 *
 * 显示条件:
 *   - profile.grade 已设 (新同学填了 ProfileGate)
 *   - grade !== "4"
 *   - 用户没手动 dismiss 过 (localStorage `xiaojinapp.gradeMismatchDismissed`)
 *
 * 不阻塞 — 用户仍可练 4 年级题 (低难度的对 5-6 年级也能复习, 不会有害).
 */

import { useState } from "react";
import { useStoredGrade } from "../lib/displayName";

const DISMISS_KEY = "xiaojinapp.gradeMismatchDismissed";

const SUPPORTED_GRADE = "4";

export function GradeMismatchBanner() {
  const grade = useStoredGrade();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return Boolean(localStorage.getItem(DISMISS_KEY));
    } catch {
      return false;
    }
  });

  if (!grade || grade === SUPPORTED_GRADE) return null;
  if (dismissed) return null;

  const onDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch { /* */ }
    setDismissed(true);
  };

  return (
    <div className="card-glow border-amber-400/40 bg-gradient-to-br from-amber-500/15 to-rose-500/10 p-4">
      <div className="flex items-start gap-3">
        <div className="text-3xl">📚</div>
        <div className="flex-1">
          <div className="font-display font-bold text-amber-100 text-base mb-1">
            {grade} 年级课本上传中
          </div>
          <div className="text-sm text-amber-200/90 leading-relaxed mb-2">
            目前题库只覆盖 <strong>4 年级</strong>。老师 / 家长上传你的课本 PDF 后，
            我们会用 AI 帮你生成 {grade} 年级专属题（这周内）。
            先用 4 年级的题热身 / 复习也不亏 — 巩固基础。
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs px-3 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border border-amber-400/40"
            >
              知道了，先练 4 年级
            </button>
            <a
              href="mailto:teacher@xiaojin.app?subject=上传 {grade} 年级课本&body=请联系老师上传你的课本 PDF"
              className="text-xs px-3 py-1.5 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-100 border border-violet-400/40"
            >
              📨 联系老师上传
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
