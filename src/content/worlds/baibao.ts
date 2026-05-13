/**
 * v0.32.0: 百宝港（数学地图）建筑定义。
 *
 * Sprint 1: 小卖部 + 银行 + 面包店 active；其他 3 个建设中。
 */

export type BaibaoBuildingId =
  | "store"
  | "bank"
  | "bakery"
  | "bus-stop"
  | "carpentry"
  | "my-room";

export interface BaibaoBuilding {
  id: BaibaoBuildingId;
  name: string;
  emoji: string;
  tagline: string;
  /** 数学 skill 概述（内部，给玩家展示简短） */
  skillHint: string;
  /** 在 30×30 俯视地图上的位置 [x, z] (y=0 是地面) */
  position: [number, number];
  /** Y 旋转 (弧度) — 让建筑大门朝中央广场 */
  rotationY?: number;
  /** Sprint 1 是否可玩 */
  active: boolean;
  /** 主题色（active 顶端状态光球用） */
  color: string;
  /** 进入后路由 */
  route: string;
  /** KayKit GLTF 建筑模型路径 */
  gltfUrl: string;
}

/** KayKit Medieval Hexagon Pack 建筑路径 */
const KAY_BLUE = "/env/kaykit/medieval/blue/";
const SCAFFOLDING = "/env/kaykit/medieval/neutral/building_scaffolding.gltf";

export const BAIBAO_BUILDINGS: BaibaoBuilding[] = [
  {
    id: "store",
    name: "和平小卖部",
    emoji: "🏪",
    tagline: "扫码 + 找零",
    skillHint: "小数加减乘",
    position: [-7, -5],
    rotationY: Math.PI * 0.25, // 朝向中央广场
    active: true,
    color: "#f59e0b",
    route: "/worlds/baibao/store",
    gltfUrl: KAY_BLUE + "building_market_blue.gltf",
  },
  {
    id: "bank",
    name: "百宝银行",
    emoji: "🏦",
    tagline: "兑换钱币",
    skillHint: "单位换算 1元=10角",
    position: [7, -5],
    rotationY: -Math.PI * 0.25,
    active: true,
    color: "#3b82f6",
    route: "/worlds/baibao/bank",
    gltfUrl: KAY_BLUE + "building_blacksmith_blue.gltf",
  },
  {
    id: "bakery",
    name: "甜心面包店",
    emoji: "🥖",
    tagline: "切蛋糕分给客人",
    skillHint: "分数 ½ + ¼",
    position: [0, -10],
    rotationY: 0,
    active: true,
    color: "#ec4899",
    route: "/worlds/baibao/bakery",
    gltfUrl: KAY_BLUE + "building_tavern_blue.gltf",
  },
  {
    id: "bus-stop",
    name: "和平公交站",
    emoji: "🚌",
    tagline: "建设中（Sprint 2 开放）",
    skillHint: "速度×时间=距离",
    position: [-7, 5],
    rotationY: Math.PI * 0.75,
    active: false,
    color: "#10b981",
    route: "",
    gltfUrl: SCAFFOLDING,
  },
  {
    id: "carpentry",
    name: "百宝木工坊",
    emoji: "🛠️",
    tagline: "建设中",
    skillHint: "多边形面积",
    position: [7, 5],
    rotationY: -Math.PI * 0.75,
    active: false,
    color: "#a16207",
    route: "",
    gltfUrl: SCAFFOLDING,
  },
  {
    id: "my-room",
    name: "我的房间",
    emoji: "🏠",
    tagline: "建设中",
    skillHint: "周长 + 长度单位",
    position: [0, 10],
    rotationY: Math.PI,
    active: false,
    color: "#a78bfa",
    route: "",
    gltfUrl: SCAFFOLDING,
  },
];

export function getBaibaoBuilding(id: BaibaoBuildingId): BaibaoBuilding | undefined {
  return BAIBAO_BUILDINGS.find((b) => b.id === id);
}
