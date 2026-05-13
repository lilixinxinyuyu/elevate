/**
 * v0.32.0: P3 Worlds — 3 学科地图定义。
 *
 * 命名：百宝港(数学)/星帆岛(英语)/墨溪镇(语文)，game-style 命名（爸爸 GDD v3 拍板）。
 * Sprint 1 只解锁百宝港；星帆岛 + 墨溪镇展示锁定状态。
 *
 * v0.32.2: 入口 orb 加上 KayKit 资源组合（hex tile + 招牌建筑 + 装饰），
 * 替代 v0.32.0 我手画的 procedural shape（"难看的建筑"反馈）。
 */

export type WorldId = "baibao" | "xingfan" | "moxi";

/** 入口 orb 上的一个 GLTF 素材组件 */
export interface OrbAsset {
  gltf: string;
  offset: [number, number, number];
  /** Y 旋转（弧度）, 默认 0 */
  rotationY?: number;
  /** scale 默认 1 */
  scale?: number;
}

export interface WorldDef {
  id: WorldId;
  /** 显示名 */
  name: string;
  /** 副标题 / 一句话介绍 */
  tagline: string;
  /** emoji icon */
  emoji: string;
  /** 主题色（HSL hex） */
  accent: string;
  /** 学科训练（内部分析用，不显示给玩家） */
  subjectInternal: "math" | "english" | "chinese";
  /** Sprint 1 是否开放 */
  unlocked: boolean;
  /** 路由 */
  route: string;
  /** Lock 提示 */
  lockHint?: string;
  /** 入口 orb 的 KayKit 组合 — 底盘 hex tile + 上面摆的建筑/装饰 */
  orbAssets: {
    tile: string;
    /** tile 上摆的元素 (建筑/装饰/云朵) */
    items: OrbAsset[];
  };
}

const KAY = "/env/kaykit/medieval";

export const WORLDS: WorldDef[] = [
  {
    id: "baibao",
    name: "百宝港",
    tagline: "热闹的港口集市，跟商人讨价还价",
    emoji: "🏪",
    accent: "#fbbf24",
    subjectInternal: "math",
    unlocked: true,
    route: "/worlds/baibao",
    orbAssets: {
      tile: `${KAY}/tiles/hex_coast_A.gltf`,
      items: [
        { gltf: `${KAY}/blue/building_market_blue.gltf`, offset: [-0.1, 0.05, -0.05], scale: 0.85 },
        { gltf: `${KAY}/deco/barrel.gltf`, offset: [0.55, 0.05, 0.1], scale: 0.95 },
        { gltf: `${KAY}/deco/flag_blue.gltf`, offset: [0.4, 0.05, -0.55], rotationY: Math.PI / 6, scale: 0.95 },
      ],
    },
  },
  {
    id: "xingfan",
    name: "星帆岛",
    tagline: "远洋客船出发去看世界",
    emoji: "⛵",
    accent: "#06b6d4",
    subjectInternal: "english",
    unlocked: true,
    route: "/worlds/xingfan",
    orbAssets: {
      tile: `${KAY}/tiles/hex_coast_D.gltf`,
      items: [
        { gltf: `${KAY}/yellow/building_windmill_yellow.gltf`, offset: [-0.15, 0.05, -0.1], scale: 0.85 },
        { gltf: `${KAY}/yellow/building_home_A_yellow.gltf`, offset: [0.5, 0.05, 0.3], rotationY: -Math.PI / 4, scale: 0.8 },
      ],
    },
  },
  {
    id: "moxi",
    name: "墨溪镇",
    tagline: "古镇的茶馆、书院、戏台",
    emoji: "🏯",
    accent: "#a855f7",
    subjectInternal: "chinese",
    unlocked: false,
    route: "/worlds/moxi",
    lockHint: "Sprint 3+ 开放",
    orbAssets: {
      tile: `${KAY}/tiles/hex_grass.gltf`,
      items: [
        { gltf: `${KAY}/red/building_watermill_red.gltf`, offset: [-0.2, 0.05, -0.1], scale: 0.85 },
        { gltf: `${KAY}/red/building_church_red.gltf`, offset: [0.5, 0.05, 0.3], rotationY: -Math.PI / 5, scale: 0.8 },
      ],
    },
  },
];

export function getWorld(id: WorldId): WorldDef | undefined {
  return WORLDS.find((w) => w.id === id);
}
