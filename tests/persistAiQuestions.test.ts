import { describe, expect, it, vi, beforeEach } from "vitest";
import { aiQuestionKey } from "../aliyun-deploy/src/lib/persistAiQuestions";

// 我们不直接 mock fetch (ossPut 用 globalThis.fetch); 用 happy/sad path
// 通过 ossPut mock 验。把 ossPut 替换更直接。
import * as ossMod from "../aliyun-deploy/src/lib/oss";
import { persistAiQuestions } from "../aliyun-deploy/src/lib/persistAiQuestions";

const fakeCfg = {
  region: "oss-cn-hongkong",
  bucket: "test-bucket",
  accessKeyId: "x",
  accessKeySecret: "y",
};

describe("persistAiQuestions — Ep46 救 1288 missing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("key 格式: users/{uid}/ai-questions/{qid}.json", () => {
    expect(aiQuestionKey("selena", "AI_decimal_001__abc123_0")).toBe(
      "users/selena/ai-questions/AI_decimal_001__abc123_0.json",
    );
  });

  it("happy path: 3 题全 succ → report.succeeded=3, failed=0", async () => {
    const spy = vi.spyOn(ossMod, "ossPut").mockResolvedValue({ ok: true, status: 200 });
    const r = await persistAiQuestions(fakeCfg, "selena", [
      { question_id: "q1", stem: "x" },
      { question_id: "q2", stem: "y" },
      { question_id: "q3", stem: "z" },
    ]);
    expect(r.attempted).toBe(3);
    expect(r.succeeded).toBe(3);
    expect(r.failed).toBe(0);
    expect(r.errors).toEqual([]);
    expect(spy).toHaveBeenCalledTimes(3);
    // 验 key 用对了 prefix
    const keys = spy.mock.calls.map((c) => c[1]).sort();
    expect(keys).toEqual([
      "users/selena/ai-questions/q1.json",
      "users/selena/ai-questions/q2.json",
      "users/selena/ai-questions/q3.json",
    ]);
  });

  it("payload 包含 persistedAt + 原 question 字段", async () => {
    const spy = vi.spyOn(ossMod, "ossPut").mockResolvedValue({ ok: true, status: 200 });
    await persistAiQuestions(fakeCfg, "selena", [
      { question_id: "q1", stem: "Hello", difficulty: 2 },
    ]);
    expect(spy).toHaveBeenCalledOnce();
    const body = spy.mock.calls[0]![2] as string;
    const parsed = JSON.parse(body);
    expect(parsed.question_id).toBe("q1");
    expect(parsed.stem).toBe("Hello");
    expect(parsed.difficulty).toBe(2);
    expect(parsed.persistedAt).toBeTypeOf("number");
    expect(parsed.persistedAt).toBeGreaterThan(1e12);
  });

  it("sad path: 部分失败 → succeeded + failed 准, error 收集前 3 条", async () => {
    let n = 0;
    vi.spyOn(ossMod, "ossPut").mockImplementation(async () => {
      n++;
      if (n % 2 === 0) {
        return { ok: false, status: 500, error: `oss_500: err${n}` };
      }
      return { ok: true, status: 200 };
    });
    const r = await persistAiQuestions(fakeCfg, "selena", [
      { question_id: "q1" },
      { question_id: "q2" },
      { question_id: "q3" },
      { question_id: "q4" },
      { question_id: "q5" },
    ]);
    expect(r.attempted).toBe(5);
    // q2, q4 fail → 3 succ + 2 fail
    expect(r.succeeded).toBe(3);
    expect(r.failed).toBe(2);
    expect(r.errors.length).toBeLessThanOrEqual(3);
    expect(r.errors.every((e) => /oss_500/.test(e))).toBe(true);
  });

  it("空数组 → 立刻返 attempted=0", async () => {
    const spy = vi.spyOn(ossMod, "ossPut");
    const r = await persistAiQuestions(fakeCfg, "selena", []);
    expect(r.attempted).toBe(0);
    expect(r.succeeded).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  it("missing question_id → 标 failed 不写 OSS", async () => {
    const spy = vi.spyOn(ossMod, "ossPut").mockResolvedValue({ ok: true, status: 200 });
    const r = await persistAiQuestions(fakeCfg, "selena", [
      { question_id: "q1", stem: "x" },
      { stem: "y" }, // no qid
      { question_id: "", stem: "z" }, // empty qid
    ]);
    expect(r.attempted).toBe(3);
    expect(r.succeeded).toBe(1);
    expect(r.failed).toBe(2);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(r.errors).toContain("missing_question_id");
  });
});
