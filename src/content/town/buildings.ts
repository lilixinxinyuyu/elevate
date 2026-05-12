/**
 * 小镇 V1 — 4 个建筑定义。每个建筑是一个 3D 场景里的 box，
 * 点击进入对应的 scene 玩法。
 *
 * 坐标系：场景中心 (0,0,0)，X 横向，Z 纵向（正南北），Y 高度。
 * 建筑用 [x, z] 表示俯视平面位置，y 高度跟着 building.height。
 */

export type BuildingId = "bank" | "bus-stop" | "shop" | "school";

export interface Building {
  id: BuildingId;
  name: string;
  emoji: string;
  /** 俯视场景中的位置 [x, z] */
  position: [number, number];
  /** 楼宽 / 楼高 / 楼深（R3F box geometry） */
  size: [number, number, number];
  /** 墙体颜色 */
  color: string;
  /** roof / sign color */
  accent: string;
  /** 描述 — hover tooltip 用 */
  desc: string;
  /** Xiaojin 进这个建筑时穿的衣服 */
  xiaojinOutfit: "default" | "sandi" | "zhou" | "mint" | "ren";
  /** 数学主题 */
  mathFocus: string;
  /** route segment */
  route: string;
}

export const BUILDINGS: Building[] = [
  {
    id: "bank",
    name: "村庄银行",
    emoji: "🏦",
    position: [-4, -3],
    size: [2.2, 2.2, 2.2],
    color: "#fef3c7", // 米黄
    accent: "#92400e", // 棕褐屋顶
    desc: "客户排队找零、存钱、汇款",
    xiaojinOutfit: "sandi", // 小礼服 — 银行职员
    mathFocus: "小数加减 / 找零 / 单位换算",
    route: "/math/town/bank",
  },
  {
    id: "bus-stop",
    name: "公交站台",
    emoji: "🚌",
    position: [4, -3],
    size: [2, 1.4, 1.8],
    color: "#cffafe", // 浅青
    accent: "#155e75",
    desc: "时刻表查询 / 路线规划",
    xiaojinOutfit: "mint", // 白短款 — 探险服
    mathFocus: "速度 × 时间 = 距离 / 时刻表读图",
    route: "/math/town/bus-stop",
  },
  {
    id: "shop",
    name: "村口小卖部",
    emoji: "🏪",
    position: [-4, 3.5],
    size: [2.2, 2, 2.2],
    color: "#fce7f3", // 浅粉
    accent: "#9d174d",
    desc: "标价、找钱、组合购物",
    xiaojinOutfit: "default", // 校服 — 日常
    mathFocus: "单价 × 数量 / 小数乘 / 折扣",
    route: "/math/town/shop",
  },
  {
    id: "school",
    name: "村庄小学",
    emoji: "🏫",
    position: [4, 3.5],
    size: [2.5, 2.5, 2.2],
    color: "#dcfce7", // 浅绿
    accent: "#14532d",
    desc: "黑板等式、平衡天平",
    xiaojinOutfit: "zhou", // 中国风 — 老师范
    mathFocus: "字母表示 / 方程 / 平衡等式",
    route: "/math/town/school",
  },
];

export function getBuildingById(id: string | undefined): Building | null {
  if (!id) return null;
  return BUILDINGS.find((b) => b.id === id) ?? null;
}
