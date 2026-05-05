/**
 * Phase 2 Axis 2 demo pack — 点子图画图题（5 道起步）。
 *
 * 这些题用 play_as: "dot_grid_draw" 强制走 DotGridDraw 模板。
 * `answer` 字段是 schema filler — 真正判分在 checkShape() 里按
 * `dot_grid.targetShape` 判定。
 */

import type { Question } from "../core/types";

const base = {
  version: 1 as const,
  status: "approved" as const,
  grade: 4 as const,
  term: "下册" as const,
  unit_id: "G4B_U2_TRI_QUAD",
  unit_name: "认识三角形和四边形",
  exam_priority: "MUST_BIG" as const,
  game_type: "geometry_operation",
  play_as: "dot_grid_draw" as const,
  cognitive_level: "application" as const,
  difficulty: 3 as const,
  estimated_time_seconds: 90,
  question_format: "geometry_operation" as const,
  answer: { type: "choice" as const, value: "drawn" },
  common_errors: [],
  feedback_correct: "✓ 形状对了！",
  feedback_wrong: "形状不对——再画一次试试。",
  hints: [],
};

export const DOT_GRID_DEMO_PACK: Question[] = [
  {
    ...base,
    question_id: "DOT_DEMO_PARALLELOGRAM",
    skill_id: "triangle_classification",
    skill_name: "按角/边给三角形分类",
    ability_dimension: ["spatial"],
    stem: "在点子图上画一个平行四边形（不是矩形）。",
    solution_steps: ["选 4 个顶点，使两组对边平行但角不是直角。"],
    parent_tip: "提示：先决定底边方向，再'平移'画对边。",
    dot_grid: {
      gridWidth: 6,
      gridHeight: 5,
      targetShape: "parallelogram",
      targetLabel: "平行四边形",
      snapToDots: true,
    },
  },
  {
    ...base,
    question_id: "DOT_DEMO_TRAPEZOID",
    skill_id: "triangle_classification",
    skill_name: "按角/边给三角形分类",
    ability_dimension: ["spatial"],
    stem: "在点子图上画一个梯形（恰好一组对边平行）。",
    solution_steps: ["4 个顶点，一组对边平行，另一组不平行。"],
    dot_grid: {
      gridWidth: 6,
      gridHeight: 5,
      targetShape: "trapezoid",
      targetLabel: "梯形",
      snapToDots: true,
    },
  },
  {
    ...base,
    question_id: "DOT_DEMO_RECTANGLE",
    skill_id: "triangle_classification",
    skill_name: "按角/边给三角形分类",
    ability_dimension: ["spatial"],
    stem: "在点子图上画一个长方形（4 个直角）。",
    solution_steps: ["底边水平，对边平行且边长不全相等。"],
    dot_grid: {
      gridWidth: 6,
      gridHeight: 5,
      targetShape: "rectangle",
      targetLabel: "长方形",
      snapToDots: true,
    },
  },
  {
    ...base,
    question_id: "DOT_DEMO_ISOSCELES",
    skill_id: "triangle_classification",
    skill_name: "按角/边给三角形分类",
    ability_dimension: ["spatial"],
    stem: "在点子图上画一个等腰三角形。",
    solution_steps: ["3 个顶点，至少有两条边长度相等。"],
    parent_tip: "提示：底边水平，顶点放在底边垂直平分线上。",
    dot_grid: {
      gridWidth: 6,
      gridHeight: 5,
      targetShape: "isosceles_triangle",
      targetLabel: "等腰三角形",
      snapToDots: true,
    },
  },
  {
    ...base,
    question_id: "DOT_DEMO_ANY_TRI",
    skill_id: "triangle_classification",
    skill_name: "按角/边给三角形分类",
    ability_dimension: ["spatial"],
    stem: "在点子图上画一个三角形（任意 3 个不共线的点）。",
    solution_steps: ["3 个不共线的顶点，构成三角形。"],
    difficulty: 2 as const,
    dot_grid: {
      gridWidth: 5,
      gridHeight: 5,
      targetShape: "any_triangle",
      targetLabel: "三角形（任意）",
      snapToDots: true,
    },
  },
];
