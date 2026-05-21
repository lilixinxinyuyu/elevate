/**
 * v0.36.75: 语文模拟测试能力覆盖保底测试。
 *
 * 修复前 bug: buildMockExamQuestions 纯按难度桶 shuffle, 没能力配额 → 题量最少的能力
 * (积累 33 题) 在 ~30% 模拟卷里被完全漏掉。修复后: 每个出现的能力至少 1 道。
 */
import { describe, expect, it } from "vitest";
import { buildChineseMockExam } from "../src/subjects/chinese/practiceSelect";
import { chineseSubject } from "../src/subjects/chinese";
import type { Question } from "../src/core/types";

// 简单可种子 PRNG (mulberry32) — 让测试可复现, 跑多个种子。
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("语文 mock_exam 能力覆盖保底", () => {
  const pool = chineseSubject.seedQuestions as Question[];
  const skills = chineseSubject.skills as { id: string; ability: readonly string[] }[];
  const abilityOf = new Map(skills.map((s) => [s.id, s.ability]));

  // 池里实际出现的所有能力
  const abilitiesInPool = new Set<string>();
  for (const q of pool) for (const a of abilityOf.get(q.skill_id) ?? []) abilitiesInPool.add(a);

  it("每个种子的模拟卷都覆盖池里出现的全部能力维度 (含积累/阅读)", () => {
    for (let s = 1; s <= 30; s++) {
      const qs = buildChineseMockExam(pool, skills, { size: 20, rng: seeded(s) });
      expect(qs.length).toBe(20);
      const hit = new Set<string>();
      for (const q of qs) for (const a of abilityOf.get(q.skill_id) ?? []) hit.add(a);
      for (const ab of abilitiesInPool) {
        expect(hit.has(ab), `seed ${s} 应覆盖能力 ${ab}`).toBe(true);
      }
    }
  });

  it("积累 (最薄能力) 每次都至少 1 道", () => {
    for (let s = 1; s <= 30; s++) {
      const qs = buildChineseMockExam(pool, skills, { size: 20, rng: seeded(s) });
      const accCount = qs.filter((q) => (abilityOf.get(q.skill_id) ?? []).includes("accumulation")).length;
      expect(accCount, `seed ${s} 积累题数`).toBeGreaterThanOrEqual(1);
    }
  });

  it("无重复题", () => {
    const qs = buildChineseMockExam(pool, skills, { size: 20, rng: seeded(7) });
    expect(new Set(qs.map((q) => q.question_id)).size).toBe(qs.length);
  });
});
