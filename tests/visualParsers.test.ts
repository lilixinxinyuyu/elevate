import { describe, expect, it } from "vitest";
import {
  parseVisuals,
  parseOptionSolids,
  parseOptionGrids,
} from "../src/components/game/templates/CubeViewer";
import { parseTriangle } from "../src/components/game/templates/TriangleJudge";

describe("CubeViewer parsers", () => {
  it("solid tag → cube positions", () => {
    const v = parseVisuals(["solid:0,0,0|1,0,0|2,0,0|1,1,0"]);
    expect(v.solid).toHaveLength(4);
    expect(v.solid?.[0]).toEqual({ x: 0, y: 0, z: 0 });
    expect(v.solid?.[3]).toEqual({ x: 1, y: 1, z: 0 });
  });

  it("grid-front:3x2:1,0,0|1,1,1 parses to L-shape grid", () => {
    const v = parseVisuals(["grid-front:3x2:1,0,0|1,1,1"]);
    expect(v.gridFront).toBeDefined();
    expect(v.gridFront!.cols).toBe(3);
    expect(v.gridFront!.rows).toBe(2);
    expect(v.gridFront!.cells).toEqual([
      [1, 0, 0],
      [1, 1, 1],
    ]);
  });

  it("grid-top / grid-left both parse independently", () => {
    const v = parseVisuals([
      "grid-top:2x2:1,1|1,0",
      "grid-left:2x1:1,1",
    ]);
    expect(v.gridTop?.cells).toEqual([[1, 1], [1, 0]]);
    expect(v.gridLeft?.cells).toEqual([[1, 1]]);
  });

  it("opt-solid-A / opt-solid-B parsed separately", () => {
    const m = parseOptionSolids([
      "opt-solid-A:0,0,0|1,0,0",
      "opt-solid-B:0,0,0|0,1,0|1,1,0",
    ]);
    expect(m.size).toBe(2);
    expect(m.get("A")).toHaveLength(2);
    expect(m.get("B")).toHaveLength(3);
  });

  it("opt-grid-A / opt-grid-B parsed separately", () => {
    const m = parseOptionGrids([
      "opt-grid-A:2x2:1,0|1,1",
      "opt-grid-B:2x2:1,1|0,1",
    ]);
    expect(m.size).toBe(2);
    expect(m.get("A")?.cells).toEqual([[1, 0], [1, 1]]);
    expect(m.get("B")?.cells).toEqual([[1, 1], [0, 1]]);
  });

  it("malformed tag returns undefined / empty", () => {
    expect(parseVisuals(["solid:abc"]).solid).toEqual([]);
    expect(parseVisuals(["grid-front:bad"]).gridFront).toBeUndefined();
  });
});

describe("TriangleJudge parsers", () => {
  it("tri-angles:60,60,60 → equilateral, no right angle", () => {
    const t = parseTriangle(["tri-angles:60,60,60"]);
    expect(t).not.toBeNull();
    expect(t!.pts).toHaveLength(3);
    expect(t!.angleLabels).toEqual(["60°", "60°", "60°"]);
    expect(t!.rightAngle).toBeUndefined();
    expect(t!.isoceles).toBe(true);
  });

  it("tri-angles:30,60,90 marks right angle at index 2", () => {
    const t = parseTriangle(["tri-angles:30,60,90"]);
    expect(t!.rightAngle).toBe(2);
  });

  it("tri-sides:7,7,3 valid triangle, not flat", () => {
    const t = parseTriangle(["tri-sides:7,7,3"]);
    expect(t).not.toBeNull();
    expect(t!.flat).toBeUndefined();
    expect(t!.pts).toHaveLength(3);
    expect(t!.isoceles).toBe(true);
  });

  it("tri-sides:3,4,8 invalid → flat layout", () => {
    const t = parseTriangle(["tri-sides:3,4,8"]);
    expect(t).not.toBeNull();
    expect(t!.flat).toBeDefined();
    expect(t!.flat!.segments.length).toBe(3);
  });

  it("tri-iso:apex=110,base=8 → apex angle on top vertex", () => {
    const t = parseTriangle(["tri-iso:apex=110,base=8"]);
    expect(t).not.toBeNull();
    // angleLabels[2] is the apex
    expect(t!.angleLabels[2]).toBe("110°");
    expect(t!.angleLabels[0]).toBeNull();
    expect(t!.isoceles).toBe(true);
  });
});
