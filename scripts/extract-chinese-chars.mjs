import { readFileSync, writeFileSync } from "node:fs";
const src = readFileSync("/Users/yong/Desktop/xy/chinese/lower_words_full.js", "utf-8");

// Match every { pinyin: "...", word: "...", group: "...", meaning: "..." }
const re = /\{\s*pinyin:\s*"([^"]*)"\s*,\s*word:\s*"([^"]*)"\s*,\s*group:\s*"([^"]*)"\s*,\s*meaning:\s*"([^"]*)"\s*\}/g;
const out = [];
let m;
while ((m = re.exec(src))) {
  out.push({ pinyin: m[1], word: m[2], group: m[3], meaning: m[4] });
}
console.log("Extracted", out.length, "chars");
const ts = `/**
 * G4B (人教版四年级下册) 写字表 250 字 — 完整含义版
 * 数据源：/Users/yong/Desktop/xy/chinese/lower_words_full.js
 * 由 scripts/extract-chinese-chars.mjs 自动生成（不要手改）
 *
 * 字段：
 *   - pinyin: 拼音（带声调）
 *   - word: 目标字（汉字）
 *   - group: 词组提示（用 ___ 占位目标字，零泄露）
 *   - meaning: 含义（不出现目标字）
 */
export interface G4bChar {
  pinyin: string;
  word: string;
  group: string;
  meaning: string;
}

export const G4B_CHARS: G4bChar[] = ${JSON.stringify(out, null, 2)};

/** 总字数（应该 = 250） */
export const G4B_CHAR_COUNT = G4B_CHARS.length;
`;
writeFileSync("/Users/yong/Desktop/xy/heping-math-trainer/src/subjects/chinese/charLibrary.ts", ts);
console.log("Wrote charLibrary.ts");
