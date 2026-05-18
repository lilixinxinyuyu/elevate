/**
 * v0.35.39 Refactor Priority 7 (peer review #3 共识): Routes / URL params SSOT.
 *
 * 痛点 (Gemini 中-高 ROI + GPT 类似):
 *   - ExamPrep.tsx 手写 `new URLSearchParams({mode, fresh, size, hard})` + `navigate(\`/math/train?\${...}\`)`
 *   - Train.tsx 手写 `params.get("size")` + 自己 parseInt + clamp
 *   - Home.tsx 跳转 `/math/train?mode=normal` 又是另一处 hardcode 字符串
 *   - hard 字段 build 用 "0"/"1", parse 用 === "1" — 强 coupling 没文档
 *   - typo 风险: 一处写 'sizes' 一处 'size', URL 静默坏掉, dev 不知道
 *
 * 解法: 强类型 TrainRoute.build(opts) / MockReportRoute.build(opts).
 *   - 参数类型由 TS 检查, 没法 typo
 *   - hard 接受 boolean, 内部 encode 成 "1"/"0"
 *   - undefined 字段自动 omit (不污染 URL)
 *
 * 本轮只迁 builder (低风险). parser 留下一轮再迁 (要小心 ?fresh=Date.now()
 * pattern 跟 history.replaceState 等 React Router 内部行为).
 */
import type { SessionMode } from "../core/types";
import type { AtelierRealmId } from "../content/atelier/realms";

export type TrainSearchParams = {
  mode?: SessionMode;
  /** unix ms 时间戳, 强制新 session — `?fresh=1779116189934` */
  fresh?: number;
  /** 单 skill scope — `?skillId=decimal_speed_distance` */
  skillId?: string;
  /** 多 skill scope, 内部 csv 编码 — `?skillIds=a,b,c` */
  skillIds?: string[];
  /** mock_exam 题数 (20-100, 由 config/constants 控制) */
  size?: number;
  /** mock_exam 硬限时 */
  hard?: boolean;
  unitId?: string;
  fromAtelier?: AtelierRealmId;
};

export type MockReportSearchParams = {
  sessionId: string;
};

/** 内部 helper: undefined / 空串 → 不进 URL */
function buildSearch(entries: Array<[string, string | undefined]>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of entries) {
    if (v !== undefined && v !== "") sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/**
 * /math/train URL 构造/解析.
 */
export const TrainRoute = {
  path: "/math/train",
  build(p: TrainSearchParams = {}): string {
    return (
      this.path +
      buildSearch([
        ["mode", p.mode],
        ["fresh", p.fresh?.toString()],
        ["skillId", p.skillId],
        ["skillIds", p.skillIds && p.skillIds.length > 0 ? p.skillIds.join(",") : undefined],
        ["size", p.size?.toString()],
        ["hard", p.hard === undefined ? undefined : (p.hard ? "1" : "0")],
        ["unitId", p.unitId],
        ["fromAtelier", p.fromAtelier],
      ])
    );
  },
  /**
   * 从 URLSearchParams 提取强类型对象. 容错: 非法 size 不抛, 返 undefined.
   * 调用方 (Train.tsx) 可继续做 clamp (用 MOCK_EXAM_MIN/MAX_SIZE).
   */
  parse(sp: URLSearchParams): TrainSearchParams {
    const mode = sp.get("mode");
    const fresh = sp.get("fresh");
    const skillIds = sp.get("skillIds");
    const size = sp.get("size");
    const hard = sp.get("hard");
    const freshNum = fresh ? Number(fresh) : undefined;
    const sizeNum = size ? Number(size) : undefined;
    return {
      mode: (mode as SessionMode | null) ?? undefined,
      fresh: Number.isFinite(freshNum) ? freshNum : undefined,
      skillId: sp.get("skillId") ?? undefined,
      skillIds: skillIds ? skillIds.split(",").filter(Boolean) : undefined,
      size: Number.isFinite(sizeNum) ? sizeNum : undefined,
      hard: hard === "1" ? true : hard === "0" ? false : undefined,
      unitId: sp.get("unitId") ?? undefined,
      fromAtelier: (sp.get("fromAtelier") as AtelierRealmId | null) ?? undefined,
    };
  },
};

/**
 * /math/mock-report URL 构造.
 */
export const MockReportRoute = {
  path: "/math/mock-report",
  build(p: MockReportSearchParams): string {
    return this.path + buildSearch([["sessionId", p.sessionId]]);
  },
};
