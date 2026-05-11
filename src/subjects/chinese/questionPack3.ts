/**
 * 语文题包 v3 — Phase 3 新游戏模板题（PairMatch / SentenceShuffle / PoemCloze）。
 *
 * 内容：
 *  - 10 道古诗填空（清明 / 江南春 / 宿新市徐公店 / 独坐敬亭山 / 四时田园杂兴 / 等）
 *  - 10 道配对题（多音字 / 近义词 / 反义词 / 量词搭配 / 关联词）
 *  - 10 道句子重排（古诗 / 现代文 / 关联词句）
 *
 * 设计原则：
 *  - 古诗都是人教四下要求背诵 / 学过的篇目（《忆江南》《宿新市》《清明》《江南春》《滁州西涧》《惠崇春江晚景》等）
 *  - 多音字 / 近反义词都是单元课文里出现过的高频字
 *  - 关联词覆盖期中常考：因为...所以... / 不但...而且... / 虽然...但是... / 只要...就...
 */

import type { Question } from "../../core/types";

/**
 * v0.28.2：根据 game_type 给不同的默认时间（之前一刀切 30s 不合理）。
 *   - poem_cloze 古诗补字 → 28s（要回忆 + 操作填字）
 *   - pair_match 配对 → 30s（看选项 + 配对）
 *   - sentence_shuffle 句子重排 → 35s（要理解结构）
 * Question 自己显式给 estimated_time_seconds 时覆盖默认。
 */
function defaultTimeFor(gameType: string | undefined): number {
  if (gameType === "poem_cloze") return 28;
  if (gameType === "sentence_shuffle") return 35;
  if (gameType === "pair_match") return 30;
  return 30;
}

const v = (q: Partial<Question>): Question =>
  ({
    version: 1,
    status: "approved",
    grade: 4,
    term: "下册",
    subjectId: "chinese",
    estimated_time_seconds: defaultTimeFor(q.game_type),
    cognitive_level: "conceptual",
    ability_dimension: ["accumulation"],
    exam_priority: "HIGH_BIG",
    question_format: "single_choice",
    options: [],
    answer: { type: "choice", value: "__game_correct__" },
    common_errors: [],
    feedback_correct: "棒！这就是这首诗里 Selena 应该牢牢记住的句子。",
    feedback_wrong: "再想一想，多读两遍就熟了。",
    solution_steps: [],
    hints: [],
    ...q,
  }) as Question;

// ============================================================
//  10 道古诗填空（poem_cloze）
// ============================================================
const POEM_CLOZE: Question[] = [
  v({
    question_id: "C4B_POEM_CLOZE_001",
    unit_id: "C4B_U1_NATURE",
    skill_id: "C4B_U1_POEM_RECITE",
    skill_name: "古诗补字",
    game_type: "poem_cloze",
    difficulty: 2,
    stem: "把字塞进《宿新市徐公店》的空格里：",
    feedback_correct: "杨万里的童趣诗，黄蝶飞入菜花就找不到了——这画面要记牢。",
    feedback_wrong: "再读两遍：篱落疏疏一径深，树头新绿未成阴。",
    game_data: {
      kind: "poem_cloze",
      template:
        "篱落疏___一径深，树头新___未成阴。\n儿童急走追___蝶，飞入菜花无处寻。",
      blanks: ["疏", "绿", "黄"],
      pool: ["疏", "绿", "黄", "深", "新", "白"],
    },
  }),
  v({
    question_id: "C4B_POEM_CLOZE_002",
    unit_id: "C4B_U1_NATURE",
    skill_id: "C4B_U1_POEM_RECITE",
    skill_name: "古诗补字",
    game_type: "poem_cloze",
    difficulty: 2,
    stem: "把字塞进范成大《四时田园杂兴》的空格里：",
    feedback_correct: "梅黄杏肥，麦白菜稀——典型的农家初夏景。",
    feedback_wrong: "再读：梅子金黄杏子肥，麦花雪白菜花稀。",
    game_data: {
      kind: "poem_cloze",
      template:
        "梅子金___杏子肥，麦花雪___菜花稀。\n日长篱落无人过，惟有蜻蜓蛱蝶飞。",
      blanks: ["黄", "白"],
      pool: ["黄", "白", "红", "绿", "肥"],
    },
  }),
  v({
    question_id: "C4B_POEM_CLOZE_003",
    unit_id: "C4B_U1_NATURE",
    skill_id: "C4B_U1_POEM_RECITE",
    skill_name: "古诗补字",
    game_type: "poem_cloze",
    difficulty: 3,
    stem: "把字塞进辛弃疾《清平乐·村居》的空格里：",
    feedback_correct: "茅檐低小、溪上青青草——田园生活的安详被这首词写绝了。",
    feedback_wrong: "再读：茅檐低小，溪上青青草。",
    game_data: {
      kind: "poem_cloze",
      template: "茅___低小，溪上青青草。醉里吴音相媚好，白发谁家___媪？",
      blanks: ["檐", "翁"],
      pool: ["檐", "翁", "屋", "村", "婆"],
    },
  }),
  v({
    question_id: "C4B_POEM_CLOZE_004",
    unit_id: "C4B_U3_POETRY",
    skill_id: "C4B_U3_RHETORIC",
    skill_name: "古诗补字",
    game_type: "poem_cloze",
    difficulty: 2,
    stem: "把字塞进杜牧《清明》的空格里：",
    feedback_correct: "清明 + 雨纷纷 = 千古名句。'欲断魂' 写出了行人的愁思。",
    feedback_wrong: "再读：清明时节雨纷纷，路上行人欲断魂。",
    game_data: {
      kind: "poem_cloze",
      template:
        "清___时节雨纷纷，路上行人欲断___。\n借问酒家何处有，牧童遥指杏花村。",
      blanks: ["明", "魂"],
      pool: ["明", "魂", "晴", "心", "村"],
    },
  }),
  v({
    question_id: "C4B_POEM_CLOZE_005",
    unit_id: "C4B_U3_POETRY",
    skill_id: "C4B_U3_RHETORIC",
    skill_name: "古诗补字",
    game_type: "poem_cloze",
    difficulty: 3,
    stem: "把字塞进杜牧《江南春》的空格里：",
    feedback_correct: "千里莺啼，水村山郭——江南春光被四句写尽。",
    feedback_wrong: "再读：千里莺啼绿映红，水村山郭酒旗风。",
    game_data: {
      kind: "poem_cloze",
      template:
        "千里莺啼___映红，水村山郭酒___风。\n南朝四百八十寺，多少楼台烟雨中。",
      blanks: ["绿", "旗"],
      pool: ["绿", "旗", "草", "风", "红"],
    },
  }),
  v({
    question_id: "C4B_POEM_CLOZE_006",
    unit_id: "C4B_U3_POETRY",
    skill_id: "C4B_U3_RHETORIC",
    skill_name: "古诗补字",
    game_type: "poem_cloze",
    difficulty: 3,
    stem: "把字塞进苏轼《惠崇春江晚景》的空格里：",
    feedback_correct: "竹外桃花、春江水暖——苏轼写画上的春天。",
    feedback_wrong: "再读：竹外桃花三两枝，春江水暖鸭先知。",
    game_data: {
      kind: "poem_cloze",
      template:
        "竹外桃花三两___，春江水___鸭先知。\n蒌蒿满地芦芽短，正是河豚欲上时。",
      blanks: ["枝", "暖"],
      pool: ["枝", "暖", "朵", "凉", "深"],
    },
  }),
  v({
    question_id: "C4B_POEM_CLOZE_007",
    unit_id: "C4B_U3_POETRY",
    skill_id: "C4B_U3_RHETORIC",
    skill_name: "古诗补字",
    game_type: "poem_cloze",
    difficulty: 3,
    stem: "把字塞进韦应物《滁州西涧》的空格里：",
    feedback_correct: "独怜幽草、黄鹂深树——很有意境的山水诗。",
    feedback_wrong: "再读：独怜幽草涧边生，上有黄鹂深树鸣。",
    game_data: {
      kind: "poem_cloze",
      template:
        "独怜幽草涧边___，上有黄___深树鸣。\n春潮带雨晚来急，野渡无人舟自横。",
      blanks: ["生", "鹂"],
      pool: ["生", "鹂", "长", "莺", "起"],
    },
  }),
  v({
    question_id: "C4B_POEM_CLOZE_008",
    unit_id: "C4B_U1_NATURE",
    skill_id: "C4B_U1_POEM_RECITE",
    skill_name: "古诗补字",
    game_type: "poem_cloze",
    difficulty: 4,
    stem: "把字塞进白居易《忆江南》的空格里：",
    feedback_correct: "日出江花、春来江水——白居易回忆江南的经典词句。",
    feedback_wrong: "再读：日出江花红胜火，春来江水绿如蓝。",
    game_data: {
      kind: "poem_cloze",
      template:
        "江南好，风景旧曾___。\n日出江花___胜火，春来江水绿如___。\n能不忆江南？",
      blanks: ["谙", "红", "蓝"],
      pool: ["谙", "红", "蓝", "好", "知", "黄"],
    },
  }),
  v({
    question_id: "C4B_POEM_CLOZE_009",
    unit_id: "C4B_U3_POETRY",
    skill_id: "C4B_U3_RHETORIC",
    skill_name: "古诗补字",
    game_type: "poem_cloze",
    difficulty: 2,
    stem: "把字塞进李白《独坐敬亭山》的空格里：",
    feedback_correct: "众鸟高飞、孤云独去——李白笔下的孤独。",
    feedback_wrong: "再读：众鸟高飞尽，孤云独去闲。",
    game_data: {
      kind: "poem_cloze",
      template: "众鸟高___尽，孤云独去闲。\n相看两不___，只有敬亭山。",
      blanks: ["飞", "厌"],
      pool: ["飞", "厌", "走", "倦", "弃"],
    },
  }),
  v({
    question_id: "C4B_POEM_CLOZE_010",
    unit_id: "C4B_U3_POETRY",
    skill_id: "C4B_U3_RHETORIC",
    skill_name: "古诗补字",
    game_type: "poem_cloze",
    difficulty: 4,
    stem: "把字塞进刘禹锡《望洞庭》的空格里：",
    feedback_correct: "湖光秋月、白银盘里——洞庭比作白银盘的奇思。",
    feedback_wrong: "再读：湖光秋月两相和，潭面无风镜未磨。",
    game_data: {
      kind: "poem_cloze",
      template: "湖光秋月两相___，潭面无风镜未___。\n遥望洞庭山水翠，白银盘里一青螺。",
      blanks: ["和", "磨"],
      pool: ["和", "磨", "同", "圆", "明"],
    },
  }),
];

// ============================================================
//  10 道配对题（pair_match）
// ============================================================
const PAIR_MATCH: Question[] = [
  v({
    question_id: "C4B_PAIR_001",
    unit_id: "C4B_U1_NATURE",
    skill_id: "C4B_U1_PINYIN",
    skill_name: "字音配对",
    game_type: "pair_match",
    difficulty: 2,
    stem: "把多音字 '了' '得' '为' '行' 分别配上正确的读音：",
    feedback_correct: "多音字要看上下文。读对一组就稳了！",
    feedback_wrong: "再想想：'为人民' 的 '为' 读 wèi（替谁做事的意思）。",
    game_data: {
      kind: "pair_match",
      leftLabel: "词语",
      rightLabel: "拼音",
      pairs: [
        { left: "了不起", right: "liǎo bù qǐ" },
        { left: "跑得快", right: "pǎo de kuài" },
        { left: "为人民", right: "wèi rén mín" },
        { left: "银行", right: "yín háng" },
      ],
    },
  }),
  v({
    question_id: "C4B_PAIR_002",
    unit_id: "C4B_U2_SCIENCE",
    skill_id: "C4B_U2_VOCAB",
    skill_name: "近义词配对",
    game_type: "pair_match",
    difficulty: 2,
    stem: "把下面词语配上它的近义词：",
    feedback_correct: "近义词不一定完全相同，但意思接近就能互换。",
    feedback_wrong: "看意思：'仔细' 强调认真细致。",
    game_data: {
      kind: "pair_match",
      leftLabel: "词语",
      rightLabel: "近义词",
      pairs: [
        { left: "仔细", right: "认真" },
        { left: "鼓励", right: "激励" },
        { left: "美丽", right: "漂亮" },
        { left: "突然", right: "忽然" },
      ],
    },
  }),
  v({
    question_id: "C4B_PAIR_003",
    unit_id: "C4B_U2_SCIENCE",
    skill_id: "C4B_U2_VOCAB",
    skill_name: "反义词配对",
    game_type: "pair_match",
    difficulty: 2,
    stem: "把下面词语配上它的反义词：",
    feedback_correct: "反义词意思相反，背的时候成对记最快。",
    feedback_wrong: "想想：'勤劳' 是经常做事，反义就是不爱做事。",
    game_data: {
      kind: "pair_match",
      leftLabel: "词语",
      rightLabel: "反义词",
      pairs: [
        { left: "勤劳", right: "懒惰" },
        { left: "茂盛", right: "枯萎" },
        { left: "宽阔", right: "狭窄" },
        { left: "明亮", right: "昏暗" },
      ],
    },
  }),
  v({
    question_id: "C4B_PAIR_004",
    unit_id: "C4B_U1_NATURE",
    skill_id: "C4B_U1_VOCAB",
    skill_name: "量词搭配",
    game_type: "pair_match",
    difficulty: 1,
    stem: "把名词配上正确的量词：",
    feedback_correct: "量词搭配习惯成自然，多说几次就稳了。",
    feedback_wrong: "想想：水牛要用 '头'，狗要用 '只'。",
    game_data: {
      kind: "pair_match",
      leftLabel: "名词",
      rightLabel: "量词",
      pairs: [
        { left: "水牛", right: "一头" },
        { left: "小狗", right: "一只" },
        { left: "树", right: "一棵" },
        { left: "诗", right: "一首" },
      ],
    },
  }),
  v({
    question_id: "C4B_PAIR_005",
    unit_id: "C4B_U4_ANIMALS",
    skill_id: "C4B_U4_VOCAB",
    skill_name: "量词搭配",
    game_type: "pair_match",
    difficulty: 2,
    stem: "把动物 / 物品配上正确的量词：",
    feedback_correct: "动物的量词大多和它的体型 / 习性有关。",
    feedback_wrong: "想想：马用 '匹'，鱼用 '条'。",
    game_data: {
      kind: "pair_match",
      leftLabel: "名词",
      rightLabel: "量词",
      pairs: [
        { left: "马", right: "一匹" },
        { left: "鱼", right: "一条" },
        { left: "鸡", right: "一只" },
        { left: "蜻蜓", right: "一只" },
      ],
    },
  }),
  v({
    question_id: "C4B_PAIR_006",
    unit_id: "C4B_U2_SCIENCE",
    skill_id: "C4B_U2_PINYIN",
    skill_name: "多音字辨义",
    game_type: "pair_match",
    difficulty: 3,
    stem: "把同一个字在不同词里的读音对上：",
    feedback_correct: "'还' 在 '还书' 读 huán（归还），'还有' 读 hái。",
    feedback_wrong: "看上下文：表示 '依然 / 又' 时读 hái。",
    game_data: {
      kind: "pair_match",
      leftLabel: "词语",
      rightLabel: "拼音",
      pairs: [
        { left: "还书", right: "huán shū" },
        { left: "还有", right: "hái yǒu" },
        { left: "重新", right: "chóng xīn" },
        { left: "重要", right: "zhòng yào" },
      ],
    },
  }),
  v({
    question_id: "C4B_PAIR_007",
    unit_id: "C4B_U2_SCIENCE",
    skill_id: "C4B_U2_VOCAB",
    skill_name: "形近字辨析",
    game_type: "pair_match",
    difficulty: 3,
    stem: "把下面形近字配上对应的词语：",
    feedback_correct: "形近字看偏旁：辶（走之底）多与走动有关。",
    feedback_wrong: "想想 '巡逻' 是绕着走，所以是 '逻'（辶）。",
    game_data: {
      kind: "pair_match",
      leftLabel: "字",
      rightLabel: "组词",
      pairs: [
        { left: "辑", right: "编辑" },
        { left: "缉", right: "通缉" },
        { left: "逻", right: "巡逻" },
        { left: "罗", right: "罗列" },
      ],
    },
  }),
  v({
    question_id: "C4B_PAIR_008",
    unit_id: "C4B_U3_POETRY",
    skill_id: "C4B_U3_RHETORIC",
    skill_name: "修辞辨认",
    game_type: "pair_match",
    difficulty: 3,
    stem: "把句子配上它使用的修辞手法：",
    feedback_correct: "修辞看本体和喻体的关系：比喻 = 像；拟人 = 把物当人。",
    feedback_wrong: "想想：'风轻轻地走' 是把风当人写。",
    game_data: {
      kind: "pair_match",
      leftLabel: "句子",
      rightLabel: "修辞",
      pairs: [
        { left: "弯弯的月儿像小船。", right: "比喻" },
        { left: "风轻轻地走过田野。", right: "拟人" },
        { left: "山在动，海在笑，森林在歌唱。", right: "排比" },
        { left: "难道我们不应该爱护花草吗？", right: "反问" },
      ],
    },
  }),
  v({
    question_id: "C4B_PAIR_009",
    unit_id: "C4B_U2_SCIENCE",
    skill_id: "C4B_U2_VOCAB",
    skill_name: "关联词配对",
    game_type: "pair_match",
    difficulty: 3,
    stem: "把关联词的前半句和后半句对上：",
    feedback_correct: "关联词成对出现：因为/所以、虽然/但是、不但/而且。",
    feedback_wrong: "想想：'虽然' 后面常跟 '但是'。",
    game_data: {
      kind: "pair_match",
      leftLabel: "前半句",
      rightLabel: "后半句",
      pairs: [
        { left: "因为下雨", right: "所以路滑" },
        { left: "虽然天冷", right: "但是不下雪" },
        { left: "不但勤劳", right: "而且节俭" },
        { left: "只要努力", right: "就会进步" },
      ],
    },
  }),
  v({
    question_id: "C4B_PAIR_010",
    unit_id: "C4B_U4_ANIMALS",
    skill_id: "C4B_U4_VOCAB",
    skill_name: "成语配对",
    game_type: "pair_match",
    difficulty: 4,
    stem: "把成语配上它的意思：",
    feedback_correct: "成语要会用：老马识途 = 经验丰富的人引路。",
    feedback_wrong: "再想想：'狐假虎威' 字面意思就是借老虎吓人。",
    game_data: {
      kind: "pair_match",
      leftLabel: "成语",
      rightLabel: "意思",
      pairs: [
        { left: "老马识途", right: "经验丰富" },
        { left: "狐假虎威", right: "借势欺人" },
        { left: "画蛇添足", right: "多此一举" },
        { left: "守株待兔", right: "不思进取" },
      ],
    },
  }),
];

// ============================================================
//  10 道句子重排（sentence_shuffle）
// ============================================================
const SENTENCE_SHUFFLE: Question[] = [
  v({
    question_id: "C4B_SHUFFLE_001",
    unit_id: "C4B_U3_POETRY",
    skill_id: "C4B_U3_RHETORIC",
    skill_name: "古诗排序",
    game_type: "sentence_shuffle",
    difficulty: 2,
    stem: "按正确顺序点出贺知章《咏柳》第一句：",
    feedback_correct: "碧玉妆成一树高——把柳树比作披碧玉的少女。",
    feedback_wrong: "顺序：碧玉 / 妆成 / 一树 / 高。",
    game_data: {
      kind: "sentence_shuffle",
      tokens: ["碧玉", "妆成", "一树", "高"],
      fullSentence: "碧玉妆成一树高",
    },
  }),
  v({
    question_id: "C4B_SHUFFLE_002",
    unit_id: "C4B_U3_POETRY",
    skill_id: "C4B_U3_RHETORIC",
    skill_name: "古诗排序",
    game_type: "sentence_shuffle",
    difficulty: 2,
    stem: "按正确顺序点出杜甫《绝句》前两句：",
    feedback_correct: "两个黄鹂鸣翠柳，一行白鹭上青天——色彩对仗工整。",
    feedback_wrong: "黄鹂在翠柳上，白鹭飞青天。",
    game_data: {
      kind: "sentence_shuffle",
      tokens: ["两个", "黄鹂", "鸣", "翠柳", "一行", "白鹭", "上", "青天"],
      fullSentence: "两个黄鹂鸣翠柳，一行白鹭上青天",
    },
  }),
  v({
    question_id: "C4B_SHUFFLE_003",
    unit_id: "C4B_U2_SCIENCE",
    skill_id: "C4B_U2_VOCAB",
    skill_name: "句子重排",
    game_type: "sentence_shuffle",
    difficulty: 2,
    stem: "把词块按正确顺序点亮组成一句话：",
    feedback_correct: "句子主干：科学家 / 经过努力 / 终于 / 解开了 / 这个谜团。",
    feedback_wrong: "时间状语 '经过努力' 放在主语后、谓语前。",
    game_data: {
      kind: "sentence_shuffle",
      tokens: ["科学家", "经过努力", "终于", "解开了", "这个", "谜团"],
      fullSentence: "科学家经过努力终于解开了这个谜团",
    },
  }),
  v({
    question_id: "C4B_SHUFFLE_004",
    unit_id: "C4B_U2_SCIENCE",
    skill_id: "C4B_U2_VOCAB",
    skill_name: "关联词组句",
    game_type: "sentence_shuffle",
    difficulty: 3,
    stem: "用关联词组句（点击顺序：'虽然...但是...'）：",
    feedback_correct: "虽然 + 让步条件，但是 + 转折结果。",
    feedback_wrong: "顺序：虽然 / 天气很冷 / 但是 / 我们 / 还是 / 坚持 / 锻炼。",
    game_data: {
      kind: "sentence_shuffle",
      tokens: ["虽然", "天气", "很冷", "但是", "我们", "还是", "坚持", "锻炼"],
      fullSentence: "虽然天气很冷，但是我们还是坚持锻炼",
    },
  }),
  v({
    question_id: "C4B_SHUFFLE_005",
    unit_id: "C4B_U1_NATURE",
    skill_id: "C4B_U1_VOCAB",
    skill_name: "句子重排",
    game_type: "sentence_shuffle",
    difficulty: 2,
    stem: "把词块按正确顺序点亮组成《乡下人家》风格的描写：",
    feedback_correct: "主谓宾完整：燕子 / 在屋檐下 / 筑起了 / 温暖的 / 小巢。",
    feedback_wrong: "状语 '在屋檐下' 放在动词前。",
    game_data: {
      kind: "sentence_shuffle",
      tokens: ["燕子", "在", "屋檐下", "筑起了", "温暖的", "小巢"],
      fullSentence: "燕子在屋檐下筑起了温暖的小巢",
    },
  }),
  v({
    question_id: "C4B_SHUFFLE_006",
    unit_id: "C4B_U4_ANIMALS",
    skill_id: "C4B_U4_VOCAB",
    skill_name: "句子重排",
    game_type: "sentence_shuffle",
    difficulty: 2,
    stem: "把词块按正确顺序点亮：",
    feedback_correct: "猫 / 蹑手蹑脚地 / 朝鸟笼 / 走了 / 过去。",
    feedback_wrong: "状语 '蹑手蹑脚地' 修饰 '走'。",
    game_data: {
      kind: "sentence_shuffle",
      tokens: ["猫", "蹑手蹑脚地", "朝", "鸟笼", "走了", "过去"],
      fullSentence: "猫蹑手蹑脚地朝鸟笼走了过去",
    },
  }),
  v({
    question_id: "C4B_SHUFFLE_007",
    unit_id: "C4B_U2_SCIENCE",
    skill_id: "C4B_U2_VOCAB",
    skill_name: "关联词组句",
    game_type: "sentence_shuffle",
    difficulty: 3,
    stem: "用关联词组句（'因为...所以...'）：",
    feedback_correct: "因为 + 原因，所以 + 结果。",
    feedback_wrong: "顺序：因为 / 他 / 认真复习 / 所以 / 考试 / 取得了 / 好成绩。",
    game_data: {
      kind: "sentence_shuffle",
      tokens: ["因为", "他", "认真复习", "所以", "考试", "取得了", "好成绩"],
      fullSentence: "因为他认真复习，所以考试取得了好成绩",
    },
  }),
  v({
    question_id: "C4B_SHUFFLE_008",
    unit_id: "C4B_U3_POETRY",
    skill_id: "C4B_U3_RHETORIC",
    skill_name: "古诗排序",
    game_type: "sentence_shuffle",
    difficulty: 3,
    stem: "按正确顺序点出王维《送元二使安西》前两句：",
    feedback_correct: "渭城朝雨浥轻尘，客舍青青柳色新——清晨送别的画面。",
    feedback_wrong: "雨在前，柳色在后。",
    game_data: {
      kind: "sentence_shuffle",
      tokens: ["渭城", "朝雨", "浥", "轻尘", "客舍", "青青", "柳色", "新"],
      fullSentence: "渭城朝雨浥轻尘，客舍青青柳色新",
    },
  }),
  v({
    question_id: "C4B_SHUFFLE_009",
    unit_id: "C4B_U2_SCIENCE",
    skill_id: "C4B_U2_VOCAB",
    skill_name: "关联词组句",
    game_type: "sentence_shuffle",
    difficulty: 3,
    stem: "用关联词组句（'不但...而且...'）：",
    feedback_correct: "不但 + 第一个特点，而且 + 更进一层的特点。",
    feedback_wrong: "顺序：他 / 不但 / 学习好 / 而且 / 乐于 / 助人。",
    game_data: {
      kind: "sentence_shuffle",
      tokens: ["他", "不但", "学习好", "而且", "乐于", "助人"],
      fullSentence: "他不但学习好，而且乐于助人",
    },
  }),
  v({
    question_id: "C4B_SHUFFLE_010",
    unit_id: "C4B_U1_NATURE",
    skill_id: "C4B_U1_VOCAB",
    skill_name: "句子重排（带修饰）",
    game_type: "sentence_shuffle",
    difficulty: 4,
    stem: "把词块按正确顺序点亮（注意定语 / 状语位置）：",
    feedback_correct: "定语 '金色的' 修饰麦浪；状语 '在风中' 修饰翻滚。",
    feedback_wrong: "顺序：金色的 / 麦浪 / 在风中 / 一波一波地 / 翻滚。",
    game_data: {
      kind: "sentence_shuffle",
      tokens: ["金色的", "麦浪", "在风中", "一波一波地", "翻滚"],
      fullSentence: "金色的麦浪在风中一波一波地翻滚",
    },
  }),
];

// ============================================================
//  第五单元（U5 · 游记）扩展游戏题
// ============================================================
const U5_GAMES: Question[] = [
  // 配对：游记词语 ↔ 出处
  v({
    question_id: "C4B_PAIR_U5_001",
    unit_id: "C4B_U5_TRAVEL",
    skill_id: "C4B_U5_VOCAB",
    skill_name: "游记词语配对",
    game_type: "pair_match",
    difficulty: 2,
    stem: "把词语配上《海上日出》/《双龙洞》里描写的对象：",
    feedback_correct: "巴金写日出抓颜色变化，叶圣陶写洞抓空间变化——风格不同。",
    feedback_wrong: '"突兀森郁"是写山的样子；"镶金边"是写黑云里的太阳。',
    game_data: {
      kind: "pair_match",
      leftLabel: "词语",
      rightLabel: "描写的对象",
      pairs: [
        { left: "镶了一道金边", right: "黑云中的太阳" },
        { left: "突兀森郁", right: "双龙洞外的山" },
        { left: "蜿蜒在洞顶", right: "石钟乳和石笋" },
        { left: "明艳", right: "山上各色花和新绿" },
      ],
    },
  }),

  // 多音字配对：U5 重点
  v({
    question_id: "C4B_PAIR_U5_002",
    unit_id: "C4B_U5_TRAVEL",
    skill_id: "C4B_U5_VOCAB",
    skill_name: "多音字配对",
    game_type: "pair_match",
    difficulty: 3,
    stem: "把多音字 '刹' '荷' '调' '系' 配上《海上日出》/《双龙洞》里的读音：",
    feedback_correct: "多音字看上下文。刹那读 chà，重荷读 hè——课文里都有原句对照。",
    feedback_wrong: '"船两头都系着绳子"的"系"读 jì（系绳子），不是 xì。',
    game_data: {
      kind: "pair_match",
      leftLabel: "句子里的字",
      rightLabel: "读音",
      pairs: [
        { left: "刹那间（一瞬间）", right: "chà" },
        { left: "负着重荷（扛）", right: "hè" },
        { left: "变换调子（音调）", right: "diào" },
        { left: "系着绳子（绑）", right: "jì" },
      ],
    },
  }),

  // 句子重排：游记过渡句
  v({
    question_id: "C4B_SHUFFLE_U5_001",
    unit_id: "C4B_U5_TRAVEL",
    skill_id: "C4B_U5_ORDER",
    skill_name: "过渡句重排",
    game_type: "sentence_shuffle",
    difficulty: 3,
    stem: "把词块按正确顺序点亮组成《双龙洞》的过渡句：",
    feedback_correct: "'大约行了两三丈的水程吧，就登陆了。这就到了内洞。' —— 这种'就' 字过渡很自然。",
    feedback_wrong: "时间 / 距离 + 就 + 动作，是游记过渡常用句式。",
    game_data: {
      kind: "sentence_shuffle",
      tokens: ["大约行了", "两三丈的", "水程吧", "就", "登陆了"],
      fullSentence: "大约行了两三丈的水程吧就登陆了",
    },
  }),

  // 古诗补字：U5 没有古诗，但有课文背诵句，做成补字游戏（poem_cloze 复用）
  v({
    question_id: "C4B_POEM_CLOZE_U5_001",
    unit_id: "C4B_U5_TRAVEL",
    skill_id: "C4B_U5_ORDER",
    skill_name: "课文补字",
    game_type: "poem_cloze",
    difficulty: 3,
    stem: "把字塞进巴金《海上日出》经典句子：",
    feedback_correct: "拟人写法 —— 太阳像人一样'负重荷'、'努力上升'，写出日出的力量感。",
    feedback_wrong: "原句：太阳好像负着重荷似的一步一步，慢慢地努力上升。",
    game_data: {
      kind: "poem_cloze",
      template:
        "太阳好像___着重___似的一步一步，慢慢地___力上升，到了最后，终于冲___了云霞，完全跳出了海面。",
      blanks: ["负", "荷", "努", "破"],
      pool: ["负", "荷", "努", "破", "扛", "新", "进", "穿"],
    },
  }),
];

export const SEED_QUESTIONS_CHINESE_V3: Question[] = [
  ...POEM_CLOZE,
  ...PAIR_MATCH,
  ...SENTENCE_SHUFFLE,
  ...U5_GAMES,
];
