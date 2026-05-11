/**
 * v0.31.103 G4 英语短句库（朗读 + 造句游戏用）。
 *
 * 句子选自 G4 单元话题（季节 / 天气 / 食物 / 衣服 / 职业 / 兴趣等），
 * 控制在 8 词以内、用 G4_WORDS 高频词，符合 4 年级口语水平。
 *
 * 字段：
 *   - en: 英文句子
 *   - cn: 中文翻译
 *   - difficulty: 1（最简单）/ 2 / 3（最长）
 */

export interface G4Sentence {
  en: string;
  cn: string;
  difficulty: 1 | 2 | 3;
}

export const G4_SENTENCES: G4Sentence[] = [
  // 难度 1：3-4 词，最基础
  { en: "I like apples.", cn: "我喜欢苹果。", difficulty: 1 },
  { en: "She is happy.", cn: "她很开心。", difficulty: 1 },
  { en: "The sun is hot.", cn: "太阳很热。", difficulty: 1 },
  { en: "We are friends.", cn: "我们是朋友。", difficulty: 1 },
  { en: "It is rainy today.", cn: "今天下雨。", difficulty: 1 },
  { en: "I have a cat.", cn: "我有一只猫。", difficulty: 1 },
  { en: "Books are fun.", cn: "书很有趣。", difficulty: 1 },
  { en: "He plays football.", cn: "他踢足球。", difficulty: 1 },

  // 难度 2：5-6 词，G4 句型
  { en: "The cat is on the bed.", cn: "猫在床上。", difficulty: 2 },
  { en: "I can ride a bike.", cn: "我会骑自行车。", difficulty: 2 },
  { en: "She likes singing songs.", cn: "她喜欢唱歌。", difficulty: 2 },
  { en: "We go to school by bus.", cn: "我们坐公交车上学。", difficulty: 2 },
  { en: "What is your favourite season?", cn: "你最喜欢哪个季节？", difficulty: 2 },
  { en: "I want to be a doctor.", cn: "我想成为一名医生。", difficulty: 2 },
  { en: "It is cold in winter.", cn: "冬天很冷。", difficulty: 2 },
  { en: "Can you help me, please?", cn: "你能帮我一下吗？", difficulty: 2 },
  { en: "We can fly kites in spring.", cn: "春天我们可以放风筝。", difficulty: 2 },
  { en: "He is good at maths.", cn: "他数学很好。", difficulty: 2 },
  { en: "Turn left at the supermarket.", cn: "在超市左转。", difficulty: 2 },
  { en: "I make my bed every day.", cn: "我每天整理床铺。", difficulty: 2 },

  // 难度 3：7-8 词，连接词或更复杂
  { en: "I like summer because I can swim.", cn: "我喜欢夏天因为可以游泳。", difficulty: 3 },
  { en: "My mother is a kind teacher.", cn: "我妈妈是一位善良的老师。", difficulty: 3 },
  { en: "The library is next to the hospital.", cn: "图书馆在医院旁边。", difficulty: 3 },
  { en: "We have a picnic when it is sunny.", cn: "天晴时我们去野餐。", difficulty: 3 },
  { en: "She wants to travel by plane.", cn: "她想坐飞机旅行。", difficulty: 3 },
  { en: "I sweep the floor and wash the dishes.", cn: "我扫地洗碗。", difficulty: 3 },
  { en: "What do you do on weekends?", cn: "你周末做什么？", difficulty: 3 },
  { en: "He gives a gift to his friend.", cn: "他送给他朋友一个礼物。", difficulty: 3 },
  { en: "There are many flowers in the garden.", cn: "花园里有很多花。", difficulty: 3 },
  { en: "I feel excited about the school trip.", cn: "我对学校旅行感到兴奋。", difficulty: 3 },
];
