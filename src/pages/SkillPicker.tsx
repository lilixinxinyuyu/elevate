/**
 * /math/free-practice — v0.31.89 起重定向到 /math/skills
 *
 * 历史：v0.31.88 之前这页是"勾选多个 skill 一起练"的 picker。
 * v0.31.89 把这个功能合并到技能图（/math/skills）的"组合模式"，
 * 老链接保留 redirect 防止外部书签 / PWA shortcut 失效。
 */

import { Navigate, useLocation } from "react-router-dom";

export function SkillPickerPage() {
  const loc = useLocation();
  // 保留 query string + hash（老链接可能带 skillIds=... 等参数）
  return (
    <Navigate to={`/math/skills${loc.search}${loc.hash}`} replace />
  );
}
