/**
 * /math/skills — 技能图入口（v0.31.89 起）
 *
 * 历史：v0.31.88 之前是表格列表（每行一个 skill + mastery chip + 单独"练"按钮）。
 * v0.31.89 重写为"星座式技能图"，把原来的 /math/free-practice 多选合并进来。
 * 单击节点 = 直接练；开"组合"模式 = 多选一起练。
 *
 * 实际渲染在 src/components/SkillsConstellation.tsx，这里只是路由包装。
 */

import { SkillsConstellation } from "../components/SkillsConstellation";

export function SkillsPage() {
  return <SkillsConstellation />;
}
