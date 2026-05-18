import { describe, expect, it } from "vitest";
import {
  genPaperId,
  genPaperMistakeId,
  paperListOssPrefix,
  paperOssKey,
  validatePaperMistake,
} from "../src/core/paperMistakes";

describe("validatePaperMistake", () => {
  it("空题干 → 报错", () => {
    expect(validatePaperMistake({
      paperQuestionId: "x",
      stem: "",
      correctAnswer: "1",
      studentAnswer: "2",
    })).toMatch(/题干/);
  });

  it("空正解 → 报错", () => {
    expect(validatePaperMistake({
      paperQuestionId: "x",
      stem: "1+1=?",
      correctAnswer: "",
      studentAnswer: "3",
    })).toMatch(/正确答案/);
  });

  it("空 Selena 答 → 报错 (要求显式'空')", () => {
    expect(validatePaperMistake({
      paperQuestionId: "x",
      stem: "1+1=?",
      correctAnswer: "2",
      studentAnswer: "",
    })).toMatch(/Selena/);
  });

  it("全填齐 → null", () => {
    expect(validatePaperMistake({
      paperQuestionId: "x",
      stem: "1+1=?",
      correctAnswer: "2",
      studentAnswer: "3",
    })).toBeNull();
  });

  it("Selena 答 '空' (没写) 也算合法", () => {
    expect(validatePaperMistake({
      paperQuestionId: "x",
      stem: "312×47=?",
      correctAnswer: "14664",
      studentAnswer: "空",
    })).toBeNull();
  });
});

describe("OSS key helpers", () => {
  it("paperOssKey", () => {
    expect(paperOssKey("selena", "paper-123")).toBe("users/selena/paper-mistakes/paper-123.json");
  });
  it("paperListOssPrefix", () => {
    expect(paperListOssPrefix("selena")).toBe("users/selena/paper-mistakes/");
  });
});

describe("ID generators", () => {
  it("genPaperId 含 paper- 前缀 + 唯一", () => {
    const ids = new Set([genPaperId(), genPaperId(), genPaperId()]);
    expect(ids.size).toBe(3);
    for (const id of ids) {
      expect(id.startsWith("paper-")).toBe(true);
    }
  });
  it("genPaperMistakeId 含 pm- 前缀", () => {
    const id = genPaperMistakeId();
    expect(id.startsWith("pm-")).toBe(true);
  });
});
