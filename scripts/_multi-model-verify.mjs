#!/usr/bin/env node
/**
 * 多模型并行验题 (数学出题 loop). 把一批题的 Q&A 同时丢给 4 个模型, 各自核对答案,
 * 任何一个模型报错就高亮 → Claude 人工复核该题. 爸爸要求 codex/gemini/qwen/deepseek 并行验证.
 *
 * 模型 (全部 prepaid 订阅 / 本地 proxy, 无按量付费风险):
 *   - qwen3.7-max      token-plan CN (订阅)
 *   - deepseek-v4-pro  token-plan CN (订阅)
 *   - gpt-5.5          本地 proxy 8788
 *   - gemini-3-pro     本地 proxy 8787 (thinking 模型, max_tokens 要给大)
 *
 * 用法: node scripts/_multi-model-verify.mjs /tmp/verify-batch.txt
 *   batch 文件就是一段纯文本: 每行 "题号. 题目 → 我的答案". 末尾让模型"错的列题号+正解,全对回OK".
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const batchFile = process.argv[2] || "/tmp/verify-batch.txt";
const body = readFileSync(batchFile, "utf8").trim();
const KEY = execSync("grep ^TOKEN_PLAN_CN_API_KEY= /Users/yong/Desktop/xy/.dev.vars | cut -d= -f2-").toString().trim();
const TP = "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions";

const prompt = `你是小学四年级数学老师, 逐题核对下面的答案是否正确(北师大版四下). 只回报错误的题号+正确答案; 若全部正确, 只回 "OK"。\n\n${body}`;

const MODELS = [
  { name: "qwen3.7-max", url: TP, model: "qwen3.7-max", auth: KEY, max: 1500 },
  { name: "deepseek-v4-pro", url: TP, model: "deepseek-v4-pro", auth: KEY, max: 1500 },
  { name: "gpt-5.5", url: "http://127.0.0.1:8788/v1/chat/completions", model: "gpt-5.5", max: 1500 },
  { name: "gemini-3-pro", url: "http://127.0.0.1:8787/v1/chat/completions", model: "gemini-3-pro-preview", max: 6000 },
];

async function ask(m) {
  const headers = { "Content-Type": "application/json" };
  if (m.auth) headers.Authorization = `Bearer ${m.auth}`;
  try {
    const r = await fetch(m.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: m.model, messages: [{ role: "user", content: prompt }], max_tokens: m.max }),
      signal: AbortSignal.timeout(90000),
    });
    const j = await r.json();
    const c = j?.choices?.[0]?.message?.content;
    return { name: m.name, ok: true, text: (c || `[空/err: ${JSON.stringify(j?.error || j).slice(0, 120)}]`).trim() };
  } catch (e) {
    return { name: m.name, ok: false, text: `[请求失败: ${String(e).slice(0, 100)}]` };
  }
}

const results = await Promise.all(MODELS.map(ask));
let allClean = true;
for (const r of results) {
  const clean = /^OK\b/i.test(r.text) || r.text === "OK";
  if (!clean) allClean = false;
  console.log(`\n──── ${r.name} ${clean ? "✅ OK" : "⚠️ 有反馈"} ────`);
  console.log(r.text.slice(0, 600));
}
console.log(`\n===== 汇总: ${allClean ? "✅ 4 模型一致全对" : "⚠️ 有模型提出异议, Claude 需复核上面 ⚠️ 的题"} =====`);
