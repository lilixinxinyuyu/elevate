import { readFileSync, writeFileSync } from "node:fs";
const src = readFileSync("/Users/yong/Desktop/xy/chinese/g4_cn.html", "utf-8");

function extract(arrName) {
  const re = new RegExp(`const ${arrName}\\s*=\\s*\\[([\\s\\S]*?)\\];`);
  const m = re.exec(src);
  if (!m) return [];
  const body = m[1];
  // 注意 g4_cn.html 的 meaning 不一定是定义，有的就是"___水，海水..." 含有 ___
  const itemRe = /\{\s*pinyin:\s*"([^"]*)"\s*,\s*word:\s*"([^"]*)"\s*,\s*group:\s*"([^"]*)"\s*,\s*meaning:\s*"([^"]*)"\s*\}/g;
  const out = [];
  let mm;
  while ((mm = itemRe.exec(body))) {
    out.push({ pinyin: mm[1], word: mm[2], group: mm[3], meaning: mm[4] });
  }
  return out;
}

const upper = extract("upperWordList").map((x) => ({ ...x, semester: "G4A" }));
const lower = extract("lowerWordList").map((x) => ({ ...x, semester: "G4B" }));
console.log("upper(G4A)", upper.length, "lower(G4B)", lower.length);

const ts = `/**
 * G4 写字表 500 字（人教版 4 年级上下册）— 含 group 提示 + meaning
 * 数据源：/Users/yong/Desktop/xy/chinese/g4_cn.html (upperWordList + lowerWordList)
 * 由 scripts/extract-chinese-chars.mjs 自动生成（不要手改）
 *
 * 字段：
 *   - pinyin: 拼音（带声调）
 *   - word: 目标字（汉字）
 *   - group: 词组提示（用 ___ 占位目标字）
 *   - meaning: 含义（不出现目标字）
 *   - semester: G4A (上册) / G4B (下册)
 */
export interface G4Char {
  pinyin: string;
  word: string;
  group: string;
  meaning: string;
  semester: "G4A" | "G4B";
}

export const G4A_CHARS: G4Char[] = ${JSON.stringify(upper, null, 2)};
export const G4B_CHARS: G4Char[] = ${JSON.stringify(lower, null, 2)};
export const G4_CHARS_ALL: G4Char[] = [...G4A_CHARS, ...G4B_CHARS];
`;
writeFileSync("/Users/yong/Desktop/xy/heping-math-trainer/src/subjects/chinese/charLibrary.ts", ts);
console.log("Wrote charLibrary.ts; total", upper.length + lower.length);
