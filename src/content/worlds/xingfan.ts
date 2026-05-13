/**
 * v0.32.7: 星帆岛（英语训练地图）建筑定义。
 *
 * 主题：海岸 + 远航 + 国际旅游。
 * Sprint 2 Day 1: 登机口 active；其他 3 建设中。
 */

export type XingfanBuildingId =
  | "airport"
  | "customs"
  | "cafe"
  | "newsstand";

export interface XingfanBuilding {
  id: XingfanBuildingId;
  name: string;
  emoji: string;
  tagline: string;
  skillHint: string;
  position: [number, number];
  rotationY?: number;
  active: boolean;
  color: string;
  route: string;
  gltfUrl: string;
}

const KAY_YELLOW = "/env/kaykit/medieval/yellow";
const SCAFFOLDING = "/env/kaykit/medieval/neutral/building_scaffolding.gltf";

export const XINGFAN_BUILDINGS: XingfanBuilding[] = [
  {
    id: "airport",
    name: "登机口",
    emoji: "✈️",
    tagline: "数行李",
    skillHint: "Quantity + Plural",
    position: [-7, -5],
    rotationY: Math.PI * 0.25,
    active: true,
    color: "#06b6d4",
    route: "/worlds/xingfan/airport",
    gltfUrl: `${KAY_YELLOW}/building_windmill_yellow.gltf`,
  },
  {
    id: "customs",
    name: "海关",
    emoji: "🛂",
    tagline: "建设中",
    skillHint: "Greetings Q&A",
    position: [7, -5],
    rotationY: -Math.PI * 0.25,
    active: false,
    color: "#94a3b8",
    route: "",
    gltfUrl: SCAFFOLDING,
  },
  {
    id: "cafe",
    name: "海风咖啡馆",
    emoji: "☕",
    tagline: "建设中",
    skillHint: "Menu reading",
    position: [0, -10],
    rotationY: 0,
    active: false,
    color: "#a16207",
    route: "",
    gltfUrl: SCAFFOLDING,
  },
  {
    id: "newsstand",
    name: "报刊亭",
    emoji: "📰",
    tagline: "建设中",
    skillHint: "Sign reading",
    position: [0, 5],
    rotationY: Math.PI,
    active: false,
    color: "#a78bfa",
    route: "",
    gltfUrl: SCAFFOLDING,
  },
];

export function getXingfanBuilding(id: XingfanBuildingId): XingfanBuilding | undefined {
  return XINGFAN_BUILDINGS.find((b) => b.id === id);
}
