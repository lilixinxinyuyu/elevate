#!/usr/bin/env node
/**
 * 把 Hub 截图发给"能看图"的视觉模型做设计 critique。
 * 用法: node scripts/_visual-consult.mjs <port> <model> <role描述> <img1> [img2...]
 * 例:   node scripts/_visual-consult.mjs 8787 gemini-3-pro-preview "资深游戏设计师" /tmp/hub-v7-desktop.png /tmp/hub-orig-desktop.png
 * 提示词从 /tmp/pr_visual.txt 读 (没有就用通用提示)。视觉模型: 8787 gemini-3-pro-preview / 8788 gpt-5.5 / 8789 claude-opus-4-7 / 8790 qwen3.6-plus。
 */
import { readFileSync, existsSync } from "node:fs";
const [port, model, role, ...imgs] = process.argv.slice(2);
const prompt = existsSync("/tmp/pr_visual.txt") ? readFileSync("/tmp/pr_visual.txt", "utf-8")
  : "以你的专业角色 critique 这些 Hub 主界面截图: 视觉/布局/信息密度/精致度问题 + 具体可执行改进 + 最该先修的 1 个问题。中文具体决断。";
const content = [{ type: "text", text: prompt }];
imgs.forEach((p, i) => {
  content.push({ type: "text", text: `【图${i + 1}: ${p.split("/").pop()}】` });
  content.push({ type: "image_url", image_url: { url: "data:image/png;base64," + readFileSync(p).toString("base64") } });
});
const ctrl = new AbortController();
const t = setTimeout(() => ctrl.abort(), 230000);
try {
  const r = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 12000, messages: [{ role: "system", content: `你是世界顶级儿童 edutainment 游戏的${role}。中文，具体、决断、可执行。` }, { role: "user", content }] }),
    signal: ctrl.signal,
  });
  const j = await r.json();
  console.log(j.choices?.[0]?.message?.content ?? ("NO CONTENT: " + JSON.stringify(j).slice(0, 400)));
} catch (e) { console.log("ERR", e.message); } finally { clearTimeout(t); }
