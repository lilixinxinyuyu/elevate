import type { CurriculumUnit } from "../core/types";

export const UNITS: CurriculumUnit[] = [
  // 上册
  { id: "G4A_U1_LARGE_NUMBERS", term: "上册", orderIndex: 1, name: "认识更大的数", description: "万、十万、百万、千万、亿；大数读写、比较、改写、近似数。", priority: "HIGH" },
  { id: "G4A_U2_LINES_ANGLES", term: "上册", orderIndex: 2, name: "线与角", description: "线段、射线、直线；相交、垂直、平移、平行；角的分类与量画。", priority: "HIGH" },
  { id: "G4A_U3_MULTIPLICATION", term: "上册", orderIndex: 3, name: "乘法", description: "三位数乘两位数；估算；计算器规律；有趣的算式。", priority: "VERY_HIGH" },
  { id: "G4A_U4_LAWS", term: "上册", orderIndex: 4, name: "运算律", description: "四则混合含中括号；加乘交换/结合律；分配律；简便计算。", priority: "VERY_HIGH" },
  { id: "G4A_U5_POSITION", term: "上册", orderIndex: 5, name: "方向与位置", description: "简单路线描述；数对（列，行）。", priority: "HIGH" },
  { id: "G4A_U6_DIVISION", term: "上册", orderIndex: 6, name: "除法", description: "三位数除以两位数；试商、调商；路程时间速度；商不变规律。", priority: "VERY_HIGH" },
  { id: "G4A_U7_NEGATIVE", term: "上册", orderIndex: 7, name: "生活中的负数", description: "温度、海拔、收支；正负数表示相反意义；0 的特殊性。", priority: "HIGH" },
  { id: "G4A_U8_PROBABILITY", term: "上册", orderIndex: 8, name: "可能性", description: "事件不确定性；可能性大小；摸球游戏。", priority: "MEDIUM" },
  // 下册
  { id: "G4B_U1_DECIMAL_ADD_SUB", term: "下册", orderIndex: 1, name: "小数的意义和加减法", description: "小数意义与数位；单位换算；小数加减竖式；混合与简便。", priority: "VERY_HIGH" },
  { id: "G4B_U2_TRI_QUAD", term: "下册", orderIndex: 2, name: "认识三角形和四边形", description: "图形分类；三边关系；内角和；三角形分类；四边形分类。", priority: "HIGH" },
  { id: "G4B_U3_DECIMAL_MULTIPLY", term: "下册", orderIndex: 3, name: "小数乘法", description: "意义；小数点移动；竖式；积的位数；乘加乘减；简便。", priority: "VERY_HIGH" },
  { id: "G4B_U4_OBSERVE_OBJECTS", term: "下册", orderIndex: 4, name: "观察物体", description: "正面、上面、左面观察；按要求搭立体图形。", priority: "MEDIUM" },
  { id: "G4B_U5_EQUATIONS", term: "下册", orderIndex: 5, name: "认识方程", description: "字母表示数；等量关系；方程意义；等式性质；解方程；列方程解决实际问题。", priority: "VERY_HIGH" },
  { id: "G4B_U6_DATA", term: "下册", orderIndex: 6, name: "数据的表示和分析", description: "条形、折线统计图；平均数意义与计算。", priority: "VERY_HIGH" },
];
