import { readFileSync, writeFileSync } from "node:fs";
const src = readFileSync("/Users/yong/Desktop/xy/english/g4_english.html", "utf-8");

// Find upperWords / lowerWords arrays
function extract(arrName) {
  const re = new RegExp(`const ${arrName}\\s*=\\s*\\[([\\s\\S]*?)\\];`);
  const m = re.exec(src);
  if (!m) return [];
  const body = m[1];
  const itemRe = /\{\s*w:\s*"([^"]*)"\s*,\s*c:\s*"([^"]*)"\s*\}/g;
  const out = [];
  let mm;
  while ((mm = itemRe.exec(body))) {
    out.push({ w: mm[1], c: mm[2] });
  }
  return out;
}

const upper = extract("upperWords");
const lower = extract("lowerWords");
console.log("upper", upper.length, "lower", lower.length);

// Tag each with semester
const baked = [
  ...upper.map((x) => ({ ...x, semester: "G4A" })),
  ...lower.map((x) => ({ ...x, semester: "G4B" })),
];
// 去重 by w (lowercase) — keep first occurrence
const seen = new Set();
const dedup = [];
for (const w of baked) {
  const k = w.w.toLowerCase();
  if (seen.has(k)) continue;
  seen.add(k);
  dedup.push(w);
}
console.log("dedup", dedup.length);

const ts = `/**
 * G4 英语单词表（4 年级上 + 下）— 由 scripts/extract-english-words.mjs 自动生成（不要手改）
 * 数据源：/Users/yong/Desktop/xy/english/g4_english.html
 *
 * 字段：
 *   - w: 英文单词或词组
 *   - c: 中文释义
 *   - semester: G4A / G4B
 */
export interface G4Word {
  w: string;
  c: string;
  semester: "G4A" | "G4B";
}

export const G4_WORDS: G4Word[] = ${JSON.stringify(dedup, null, 2)};
export const G4_WORDS_COUNT = G4_WORDS.length;
`;
writeFileSync("/Users/yong/Desktop/xy/heping-math-trainer/src/subjects/english/wordList.ts", ts);
console.log("Wrote wordList.ts");
