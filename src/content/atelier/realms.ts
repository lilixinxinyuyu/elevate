/**
 * 小进的星海工坊 — 5 个维度领域定义
 *
 * 每个领域：
 *  - id / name / emoji / desc：UI 显示
 *  - skillIds：进入领域 → 跳 `/math/train?skillIds=...` 跑这些 skill
 *  - xiaojinOutfit：进入该领域时 Xiaojin 切换的衣服（MascotOutfit）
 *  - xiaojinSkin：可选，进入该领域时 Mascot3D 用的背景皮肤（MascotSkin）
 *  - tagline：Xiaojin 在 hub 介绍该领域时说的一句话
 *  - greeting：进入领域 landing 页时 Xiaojin 的欢迎语
 *  - accent：UI 主色（卡片描边 / 按钮）
 */
import type { MascotOutfit, MascotSkin } from "../../components/Mascot3D";

export type AtelierRealmId =
  | "discount-street"
  | "chrono-tower"
  | "gem-grotto"
  | "geo-forge"
  | "equation-hall"
  | "data-vault";

export interface AtelierRealm {
  id: AtelierRealmId;
  name: string;
  emoji: string;
  desc: string;
  tagline: string;
  greeting: string;
  skillIds: string[];
  xiaojinOutfit: MascotOutfit;
  xiaojinSkin: MascotSkin;
  accent: {
    /** card border / glow color */
    color: string;
    /** card background gradient endpoints */
    grad: [string, string];
  };
  /** 进入该领域所需累积灵感（0 = 默认解锁）。沙箱版默认全部 0 解锁 */
  inspirationGate: number;
}

export const ATELIER_REALMS: AtelierRealm[] = [
  {
    id: "discount-street",
    name: "折扣街",
    emoji: "💸",
    desc: "霓虹小数集市 — 单价、数量、小数点",
    tagline: "今天打折！我们去算算单价 × 数量好不好？",
    greeting: "欢迎来到折扣街，这里的标签全是小数。小心小数点的位置哦～",
    skillIds: [
      "decimal_price_quantity",
      "decimal_point_shift",
      "decimal_mul_vertical",
      "decimal_unit_conversion",
      "decimal_segment_pricing",
    ],
    xiaojinOutfit: "default",
    xiaojinSkin: "default",
    accent: { color: "#f0abfc", grad: ["#9333ea33", "#db277711"] },
    inspirationGate: 0,
  },
  {
    id: "chrono-tower",
    name: "时光塔",
    emoji: "⏰",
    desc: "古铜齿轮塔 — 速度、时间、相遇",
    tagline: "塔顶的钟摆停了，需要用速度和时间唤醒它。",
    greeting: "时光塔的指针又不动了。我们用「路程 = 速度 × 时间」帮它转起来吧！",
    skillIds: [
      "speed_time_distance",
      "decimal_speed_distance",
      "equation_meeting_problem",
      "div_3_by_2_trial",
    ],
    xiaojinOutfit: "zhou", // 中国风 — 古风时间感
    xiaojinSkin: "graduation", // 偏暖 / 历史感
    accent: { color: "#fcd34d", grad: ["#d9770633", "#92400e11"] },
    inspirationGate: 0,
  },
  {
    id: "gem-grotto",
    name: "宝石矿",
    emoji: "💎",
    desc: "水晶洞穴 — 大数比较、数位、四舍五入",
    tagline: "矿洞里每颗水晶都刻着大数 — 比谁更亮？",
    greeting: "这里的宝石按数值排列。我们用数位 + 比较给它们分等级吧～",
    skillIds: [
      "large_compare",
      "large_place_value",
      "large_approx_rounding",
      "decimal_compare",
      "large_rewrite_wan_yi",
    ],
    xiaojinOutfit: "mint", // 白短款 — 探险服
    xiaojinSkin: "legendary", // 星空感
    accent: { color: "#67e8f9", grad: ["#0891b233", "#0c4a6e11"] },
    inspirationGate: 0,
  },
  {
    id: "geo-forge",
    name: "几何工坊",
    emoji: "🎯",
    desc: "蓝图绘图房 — 三角形、角度、坐标",
    tagline: "这里的图纸全是三角形和角度，我们一起画清楚它们～",
    greeting: "工坊的蓝图缺了几条边和角。先帮我量好三角形的边和角吧！",
    skillIds: [
      "triangle_inequality",
      "triangle_angle_sum",
      "triangle_classification",
      "angle_types",
      "angle_measure",
      "grid_coordinates",
    ],
    xiaojinOutfit: "ren", // 白旗袍 — 专业绘师
    xiaojinSkin: "wizard", // 紫蓝魔法 / 蓝图感
    accent: { color: "#a78bfa", grad: ["#7c3aed33", "#1e1b4b11"] },
    inspirationGate: 0,
  },
  {
    id: "equation-hall",
    name: "方程之厅",
    emoji: "🧪",
    desc: "悬浮符号大厅 — 字母、方程、应用题",
    tagline: "符号们在等着被解开！我们用方程把它们配对吧～",
    greeting: "欢迎来到方程之厅。这里的每个 x 都藏着一个故事，我们一起找出来～",
    skillIds: [
      "letter_expression",
      "equation_meaning_balance",
      "equation_solve_simple",
      "equation_one_step_word",
      "equation_two_step_word",
      "equation_sum_difference",
      "decimal_inverse_problem",
    ],
    xiaojinOutfit: "sandi", // 小礼服 — 隆重感
    xiaojinSkin: "wizard",
    accent: { color: "#f472b6", grad: ["#be185d33", "#3b076211"] },
    inspirationGate: 0,
  },
  {
    id: "data-vault",
    name: "数据宝库",
    emoji: "📊",
    desc: "结晶图表洞 — 平均数、统计、可能性",
    tagline: "宝库里藏着数据的秘密 —— 我们一起破译它们 📈",
    greeting: "欢迎来到数据宝库！每张图、每个平均数都在告诉一个故事。",
    skillIds: [
      "average_meaning",
      "average_compute",
      "average_inverse_total",
      "average_inverse_missing",
      "data_bar_chart",
      "probability_compare",
    ],
    xiaojinOutfit: "sandi", // 小礼服 — 解锁后的"宝藏"感
    xiaojinSkin: "legendary", // 金紫光感
    accent: { color: "#fbbf24", grad: ["#d9770633", "#9a341211"] },
    inspirationGate: 25, // 这个 realm 需要 25 灵感才解锁，给沙箱进度一个目标
  },
];

export function getRealmById(id: AtelierRealmId | string | undefined): AtelierRealm | null {
  if (!id) return null;
  return ATELIER_REALMS.find((r) => r.id === id) ?? null;
}
