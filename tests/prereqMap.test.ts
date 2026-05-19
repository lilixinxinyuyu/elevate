/**
 * v0.35.70: Tests for P0-5 前置降级知识图谱.
 */
import { describe, expect, it } from "vitest";
import {
  PREREQ_MAP,
  G3_PLACEHOLDER_SKILLS,
  getPrereqSkillIds,
  hasPrereqs,
  isG3Placeholder,
  getPrereqMapStats,
} from "../src/content/prereqMap";
import { SKILLS } from "../src/content/skills";

describe("PREREQ_MAP basic API", () => {
  it("getPrereqSkillIds returns prereqs for known skill", () => {
    const prereqs = getPrereqSkillIds("decimal_add_sub_vertical");
    expect(prereqs).toContain("int_add_sub_vertical_g3");
    expect(prereqs).toContain("decimal_meaning_place");
  });

  it("getPrereqSkillIds returns empty array for unknown skill", () => {
    expect(getPrereqSkillIds("nonexistent_skill")).toEqual([]);
  });

  it("hasPrereqs is true for mapped skills", () => {
    expect(hasPrereqs("decimal_add_sub_vertical")).toBe(true);
    expect(hasPrereqs("decimal_speed_distance")).toBe(true);
    expect(hasPrereqs("triangle_inequality")).toBe(true);
  });

  it("hasPrereqs is false for unknown skill", () => {
    expect(hasPrereqs("nonexistent")).toBe(false);
  });

  it("isG3Placeholder correctly identifies G3 IDs", () => {
    expect(isG3Placeholder("int_add_sub_basic_g3")).toBe(true);
    expect(isG3Placeholder("decimal_add_sub_vertical")).toBe(false);
  });
});

describe("PREREQ_MAP coverage", () => {
  it("includes 5 critical exam-priority G4B skills", () => {
    // 这 5 个是 FINAL_SPRINT_G4B 高 priority 必须有前置映射
    const criticalSkills = [
      "decimal_add_sub_vertical",
      "decimal_mul_vertical",
      "decimal_price_quantity",
      "decimal_speed_distance",
      "average_compute",
    ];
    for (const s of criticalSkills) {
      expect(hasPrereqs(s)).toBe(true);
    }
  });

  it("G3 placeholders are 13", () => {
    expect(G3_PLACEHOLDER_SKILLS.length).toBe(13);
  });

  it("stats: skillsMapped >= 20, distinctPrereqs > 10", () => {
    const stats = getPrereqMapStats();
    expect(stats.skillsMapped).toBeGreaterThanOrEqual(20);
    expect(stats.distinctPrereqs).toBeGreaterThan(10);
    expect(stats.g3Placeholders).toBeGreaterThanOrEqual(8); // 至少一半 G3 placeholder 被引用
  });
});

describe("PREREQ_MAP integrity", () => {
  const SKILL_IDS = new Set(SKILLS.map((s) => s.id));

  it("non-G3-placeholder prereqs must exist in SKILLS table", () => {
    // 引用的非 G3-placeholder skill ID 必须是真实 G4A/G4B skill
    const invalid: string[] = [];
    for (const [skillId, prereqs] of Object.entries(PREREQ_MAP)) {
      for (const p of prereqs) {
        if (!isG3Placeholder(p) && !SKILL_IDS.has(p)) {
          invalid.push(`${skillId} → ${p}`);
        }
      }
    }
    expect(invalid).toEqual([]);
  });

  it("source skills (keys) must exist in SKILLS table", () => {
    // 被映射的 G4B skill 必须真实存在
    const invalidKeys = Object.keys(PREREQ_MAP).filter((id) => !SKILL_IDS.has(id));
    expect(invalidKeys).toEqual([]);
  });
});
