/**
 * 语文 · 人教版四年级下册（C4B）单元清单。
 *
 * 期中考一般考前 4 单元；本文件登记 4 个单元，每个单元下挂一组技能。
 *
 * 命名空间：单元 id 全部以 C4B_ 开头（C = Chinese / 4 = 四年级 / B = 下册），
 * 跟数学 G4B_* 不撞，将来加上册时用 C4A_*。
 */

import type { CurriculumUnit } from "../../core/types";

export const UNITS_CHINESE: CurriculumUnit[] = [
  {
    id: "C4B_U1_NATURE",
    subjectId: "chinese",
    term: "下册",
    orderIndex: 1,
    name: "第一单元 · 古诗 + 乡村田园",
    description:
      "古诗三首（宿新市徐公店 / 四时田园杂兴 / 清平乐·村居）+ 乡下人家 + 天窗 + 三月桃花水。",
    priority: "VERY_HIGH",
  },
  {
    id: "C4B_U2_SCIENCE",
    subjectId: "chinese",
    term: "下册",
    orderIndex: 2,
    name: "第二单元 · 自然与科技",
    description:
      "琥珀 + 飞向蓝天的恐龙 + 纳米技术就在我们身边 + 千年梦圆在今朝。",
    priority: "VERY_HIGH",
  },
  {
    id: "C4B_U3_POETRY",
    subjectId: "chinese",
    term: "下册",
    orderIndex: 3,
    name: "第三单元 · 现代诗",
    description: "短诗三首 + 绿 + 白桦 + 在天晴了的时候。",
    priority: "HIGH",
  },
  {
    id: "C4B_U4_ANIMALS",
    subjectId: "chinese",
    term: "下册",
    orderIndex: 4,
    name: "第四单元 · 动物名家",
    description: "猫（老舍）+ 母鸡（老舍）+ 白鹅（丰子恺）。",
    priority: "VERY_HIGH",
  },
  {
    id: "C4B_U5_TRAVEL",
    subjectId: "chinese",
    term: "下册",
    orderIndex: 5,
    name: "第五单元 · 妙笔写美景（游记）",
    description:
      "海上日出（巴金）+ 记金华的双龙洞（叶圣陶）+ 习作例文：颐和园 / 七月的天山。重点：按游览/变化顺序写景 + 过渡句。",
    priority: "HIGH",
  },
  {
    id: "C4B_U6_GROWTH",
    subjectId: "chinese",
    term: "下册",
    orderIndex: 6,
    name: "第六单元 · 成长故事 + 文言文",
    description:
      "文言文二则（囊萤夜读 / 铁杵成针）+ 小英雄雨来（节选）+ 我们家的男子汉 + 芦花鞋（曹文轩）。重点：学习把握长文章的主要内容；从事件中感受人物成长。",
    priority: "VERY_HIGH",
  },
  {
    id: "C4B_U7_CHARACTER",
    subjectId: "chinese",
    term: "下册",
    orderIndex: 7,
    name: "第七单元 · 人物品质 + 古诗",
    description:
      "古诗三首（芙蓉楼送辛渐 / 塞下曲 / 墨梅）+ 黄继光 + “诺曼底号”遇难记（雨果）+ 挑山工。重点：从人物的语言、动作、神态描写中感受品质。",
    priority: "VERY_HIGH",
  },
  {
    id: "C4B_U8_FAIRYTALE",
    subjectId: "chinese",
    term: "下册",
    orderIndex: 8,
    name: "第八单元 · 童话故事",
    description:
      "宝葫芦的秘密（张天翼，节选）+ 巨人的花园（王尔德）+ 海的女儿（安徒生）。重点：感受童话奇妙的想象，体会人物形象，复述故事。",
    priority: "HIGH",
  },
];
