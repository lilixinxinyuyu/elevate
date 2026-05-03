import { describe, expect, it } from "vitest";
import { normalizeJsonText } from "../src/lib/normalizeJsonText";

const LDQ = String.fromCharCode(0x201C); // “
const RDQ = String.fromCharCode(0x201D); // ”

describe("normalizeJsonText", () => {
  it("空字符串透传", () => {
    expect(normalizeJsonText("   ")).toBe("");
  });

  it("普通 ASCII JSON 不动", () => {
    const raw = `[{"a":1,"b":"hi"}]`;
    expect(JSON.parse(normalizeJsonText(raw))).toEqual([{ a: 1, b: "hi" }]);
  });

  it("中文弯引号在 JSON 边界 → 替换成 \"", () => {
    const raw = `[{${LDQ}id${RDQ}:${LDQ}A${RDQ}}]`;
    const parsed = JSON.parse(normalizeJsonText(raw));
    expect(parsed).toEqual([{ id: "A" }]);
  });

  it("夹在中文里的内层弯引号 → 转义成 \\\" 写进字符串", () => {
    // LLM 经常生成这种：remediation 内有"几个几"强调引号
    const raw = `[{${LDQ}r${RDQ}:${LDQ}用${LDQ}几个几${RDQ}来想${RDQ}}]`;
    const parsed = JSON.parse(normalizeJsonText(raw));
    // 解析出来的字符串里仍然能看到中文引号（用 ASCII " 表示）
    expect(parsed[0].r).toBe('用"几个几"来想');
  });

  it("用户实际报错的 case：position 2 column 3", () => {
    const raw = `[{${LDQ}question_id${RDQ}:${LDQ}TEST_001${RDQ},${LDQ}value${RDQ}:1.8}]`;
    // raw 直接 parse 必然失败
    expect(() => JSON.parse(raw)).toThrow();
    // normalize 之后必须成功
    const parsed = JSON.parse(normalizeJsonText(raw));
    expect(parsed[0].question_id).toBe("TEST_001");
    expect(parsed[0].value).toBe(1.8);
  });

  it("剥掉 ```json ... ``` markdown 围栏", () => {
    const raw = "```json\n[{\"a\":1}]\n```";
    expect(JSON.parse(normalizeJsonText(raw))).toEqual([{ a: 1 }]);
  });

  it("unicode 减号 / 全角减号 → ASCII -", () => {
    const raw = `[{"v":−1.5}]`; // U+2212 minus sign
    const parsed = JSON.parse(normalizeJsonText(raw));
    expect(parsed[0].v).toBe(-1.5);
  });

  it("NBSP 和零宽字符不影响 parse", () => {
    const raw = `[ {"a":​1}]`;
    const parsed = JSON.parse(normalizeJsonText(raw));
    expect(parsed).toEqual([{ a: 1 }]);
  });

  it("混合：弯引号 + 内层引号 + markdown 围栏（用户实际场景）", () => {
    const raw =
      "```json\n" +
      `[{${LDQ}question_id${RDQ}:${LDQ}Q1${RDQ},${LDQ}stem${RDQ}:${LDQ}0.6×3=?${RDQ},${LDQ}common_errors${RDQ}:[{${LDQ}remediation${RDQ}:${LDQ}用${LDQ}几个几${RDQ}来想${RDQ}}]}]` +
      "\n```";
    const parsed = JSON.parse(normalizeJsonText(raw));
    expect(parsed[0].question_id).toBe("Q1");
    expect(parsed[0].stem).toBe("0.6×3=?");
    expect(parsed[0].common_errors[0].remediation).toBe('用"几个几"来想');
  });
});
