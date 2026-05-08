/**
 * G4 写字表 500 字（人教版 4 年级上下册）— 含 group 提示 + meaning
 * 数据源：/Users/yong/Desktop/xy/chinese/g4_cn.html (upperWordList + lowerWordList)
 * 由 scripts/extract-chinese-chars.mjs 自动生成（不要手改）
 *
 * 字段：
 *   - pinyin: 拼音（带声调）
 *   - word: 目标字（汉字）
 *   - group: 词组提示（用 ___ 占位目标字）
 *   - meaning: 含义（不出现目标字）
 *   - semester: G4A (上册) / G4B (下册)
 */
export interface G4Char {
  pinyin: string;
  word: string;
  group: string;
  meaning: string;
  semester: "G4A" | "G4B";
}

export const G4A_CHARS: G4Char[] = [
  {
    "pinyin": "cháo",
    "word": "潮",
    "group": "___水、涨___",
    "meaning": "___水，海水因为日月引力而涨落的现象",
    "semester": "G4A"
  },
  {
    "pinyin": "jù",
    "word": "据",
    "group": "___说、根___",
    "meaning": "按照，依据；可以用作证明的事物",
    "semester": "G4A"
  },
  {
    "pinyin": "dī",
    "word": "堤",
    "group": "大___、河___",
    "meaning": "用土石等修筑的挡水建筑物",
    "semester": "G4A"
  },
  {
    "pinyin": "kuò",
    "word": "阔",
    "group": "宽___、辽___",
    "meaning": "宽广，面积大",
    "semester": "G4A"
  },
  {
    "pinyin": "pàn",
    "word": "盼",
    "group": "___望、期___",
    "meaning": "急切地期望",
    "semester": "G4A"
  },
  {
    "pinyin": "gǔn",
    "word": "滚",
    "group": "___动、翻___",
    "meaning": "物体在地面上转动",
    "semester": "G4A"
  },
  {
    "pinyin": "dùn",
    "word": "顿",
    "group": "___时、停___",
    "meaning": "忽然，立刻；稍停",
    "semester": "G4A"
  },
  {
    "pinyin": "zhú",
    "word": "逐",
    "group": "___渐、追___",
    "meaning": "一个接一个，依次",
    "semester": "G4A"
  },
  {
    "pinyin": "jiàn",
    "word": "渐",
    "group": "___渐、逐___",
    "meaning": "慢慢地，一点一点地",
    "semester": "G4A"
  },
  {
    "pinyin": "dǔ",
    "word": "堵",
    "group": "___住、___车",
    "meaning": "阻挡，塞住",
    "semester": "G4A"
  },
  {
    "pinyin": "yóu",
    "word": "犹",
    "group": "___如、___豫",
    "meaning": "好像；迟疑不决",
    "semester": "G4A"
  },
  {
    "pinyin": "bēng",
    "word": "崩",
    "group": "___塌、___裂",
    "meaning": "倒塌，裂开",
    "semester": "G4A"
  },
  {
    "pinyin": "zhèn",
    "word": "震",
    "group": "___动、地___",
    "meaning": "颤动，使颤动",
    "semester": "G4A"
  },
  {
    "pinyin": "shà",
    "word": "霎",
    "group": "___时、一___",
    "meaning": "极短的时间",
    "semester": "G4A"
  },
  {
    "pinyin": "yú",
    "word": "余",
    "group": "___剩、___下",
    "meaning": "剩下的，多出的",
    "semester": "G4A"
  },
  {
    "pinyin": "táo",
    "word": "淘",
    "group": "___气、___米",
    "meaning": "顽皮；用水冲洗",
    "semester": "G4A"
  },
  {
    "pinyin": "qiān",
    "word": "牵",
    "group": "___手、___挂",
    "meaning": "拉着，领着；挂念",
    "semester": "G4A"
  },
  {
    "pinyin": "é",
    "word": "鹅",
    "group": "白___、天___",
    "meaning": "一种水鸟，脖子长，羽毛白色",
    "semester": "G4A"
  },
  {
    "pinyin": "luǎn",
    "word": "卵",
    "group": "鹅___石、虫___",
    "meaning": "动植物的雌性生殖细胞",
    "semester": "G4A"
  },
  {
    "pinyin": "kēng",
    "word": "坑",
    "group": "水___、土___",
    "meaning": "地面上凹下去的地方",
    "semester": "G4A"
  },
  {
    "pinyin": "wā",
    "word": "洼",
    "group": "水___、___地",
    "meaning": "凹陷的地方",
    "semester": "G4A"
  },
  {
    "pinyin": "tián",
    "word": "填",
    "group": "___空、___写",
    "meaning": "把空缺的地方塞满",
    "semester": "G4A"
  },
  {
    "pinyin": "zhuāng",
    "word": "庄",
    "group": "___稼、村___",
    "meaning": "村落；田地里种的农作物",
    "semester": "G4A"
  },
  {
    "pinyin": "jià",
    "word": "稼",
    "group": "庄___、耕___",
    "meaning": "种植谷物，泛指农作物",
    "semester": "G4A"
  },
  {
    "pinyin": "sú",
    "word": "俗",
    "group": "风___、___语",
    "meaning": "社会上长期形成的风气、习惯",
    "semester": "G4A"
  },
  {
    "pinyin": "yuè",
    "word": "跃",
    "group": "跳___、飞___",
    "meaning": "跳，跳起",
    "semester": "G4A"
  },
  {
    "pinyin": "pú",
    "word": "葡",
    "group": "___萄、___萄糖",
    "meaning": "一种藤本植物的果实",
    "semester": "G4A"
  },
  {
    "pinyin": "táo",
    "word": "萄",
    "group": "葡___、葡___糖",
    "meaning": "一种藤本植物的果实",
    "semester": "G4A"
  },
  {
    "pinyin": "dào",
    "word": "稻",
    "group": "___田、水___",
    "meaning": "一种粮食作物，籽实可食用",
    "semester": "G4A"
  },
  {
    "pinyin": "shú",
    "word": "熟",
    "group": "成___、___悉",
    "meaning": "植物的果实长成；了解得清楚",
    "semester": "G4A"
  },
  {
    "pinyin": "wān",
    "word": "豌",
    "group": "___豆、___豆苗",
    "meaning": "一种豆类作物",
    "semester": "G4A"
  },
  {
    "pinyin": "àn",
    "word": "按",
    "group": "___照、___时",
    "meaning": "依照，按照；用手压",
    "semester": "G4A"
  },
  {
    "pinyin": "shū",
    "word": "舒",
    "group": "___服、___适",
    "meaning": "伸展，宽解；轻松愉快",
    "semester": "G4A"
  },
  {
    "pinyin": "shì",
    "word": "适",
    "group": "合___、___应",
    "meaning": "相合，妥当",
    "semester": "G4A"
  },
  {
    "pinyin": "àn",
    "word": "暗",
    "group": "黑___、___处",
    "meaning": "光线不足，不亮",
    "semester": "G4A"
  },
  {
    "pinyin": "kǒng",
    "word": "恐",
    "group": "___怕、___龙",
    "meaning": "害怕；表示估计",
    "semester": "G4A"
  },
  {
    "pinyin": "jiāng",
    "word": "僵",
    "group": "___硬、冻___",
    "meaning": "硬，不能活动",
    "semester": "G4A"
  },
  {
    "pinyin": "yìng",
    "word": "硬",
    "group": "坚___、软___",
    "meaning": "坚固，与“软”相对",
    "semester": "G4A"
  },
  {
    "pinyin": "qiāng",
    "word": "枪",
    "group": "手___、机___",
    "meaning": "一种发射子弹的武器",
    "semester": "G4A"
  },
  {
    "pinyin": "nài",
    "word": "耐",
    "group": "___心、忍___",
    "meaning": "忍受得住，禁得起",
    "semester": "G4A"
  },
  {
    "pinyin": "tàn",
    "word": "探",
    "group": "___索、___望",
    "meaning": "寻求，侦察；看望",
    "semester": "G4A"
  },
  {
    "pinyin": "yú",
    "word": "愉",
    "group": "___快、___悦",
    "meaning": "快乐，高兴",
    "semester": "G4A"
  },
  {
    "pinyin": "céng",
    "word": "曾",
    "group": "___经、未___",
    "meaning": "表示从前有过某种行为或情况",
    "semester": "G4A"
  },
  {
    "pinyin": "gōu",
    "word": "沟",
    "group": "水___、山___",
    "meaning": "流水的通道，凹下去的水道",
    "semester": "G4A"
  },
  {
    "pinyin": "yì",
    "word": "溢",
    "group": "洋___、___出",
    "meaning": "水满了流出来；充满而流露",
    "semester": "G4A"
  },
  {
    "pinyin": "wén",
    "word": "蚊",
    "group": "___子、___虫",
    "meaning": "一种会吸血的小飞虫",
    "semester": "G4A"
  },
  {
    "pinyin": "nòng",
    "word": "弄",
    "group": "摆___、___好",
    "meaning": "做，搞；摆弄",
    "semester": "G4A"
  },
  {
    "pinyin": "kē",
    "word": "科",
    "group": "___学、___目",
    "meaning": "学术或业务的类别",
    "semester": "G4A"
  },
  {
    "pinyin": "héng",
    "word": "横",
    "group": "___竖、___线",
    "meaning": "跟地面平行的，与“竖”相对",
    "semester": "G4A"
  },
  {
    "pinyin": "shù",
    "word": "竖",
    "group": "横___、___立",
    "meaning": "直立，跟地面垂直的",
    "semester": "G4A"
  },
  {
    "pinyin": "shéng",
    "word": "绳",
    "group": "___子、___索",
    "meaning": "用两股以上的纤维拧成的条状物",
    "semester": "G4A"
  },
  {
    "pinyin": "jì",
    "word": "系",
    "group": "___鞋带、___扣子",
    "meaning": "结，扣",
    "semester": "G4A"
  },
  {
    "pinyin": "yíng",
    "word": "蝇",
    "group": "苍___、___子",
    "meaning": "一种常见的害虫",
    "semester": "G4A"
  },
  {
    "pinyin": "zhèng",
    "word": "证",
    "group": "___明、___据",
    "meaning": "用可靠的材料来表明或断定",
    "semester": "G4A"
  },
  {
    "pinyin": "fù",
    "word": "复",
    "group": "重___、反___",
    "meaning": "又一次，再；回去",
    "semester": "G4A"
  },
  {
    "pinyin": "yán",
    "word": "研",
    "group": "___究、钻___",
    "meaning": "深入地探求",
    "semester": "G4A"
  },
  {
    "pinyin": "jiū",
    "word": "究",
    "group": "研___、___竟",
    "meaning": "追查，到底",
    "semester": "G4A"
  },
  {
    "pinyin": "dá",
    "word": "达",
    "group": "到___、___成",
    "meaning": "到，抵达；实现",
    "semester": "G4A"
  },
  {
    "pinyin": "jià",
    "word": "驾",
    "group": "___驶、___车",
    "meaning": "操纵车、船等交通工具",
    "semester": "G4A"
  },
  {
    "pinyin": "shǐ",
    "word": "驶",
    "group": "驾___、行___",
    "meaning": "开动交通工具",
    "semester": "G4A"
  },
  {
    "pinyin": "huàn",
    "word": "唤",
    "group": "呼___、叫___",
    "meaning": "呼叫，喊",
    "semester": "G4A"
  },
  {
    "pinyin": "jì",
    "word": "纪",
    "group": "世___、___念",
    "meaning": "记年代的单位；记载",
    "semester": "G4A"
  },
  {
    "pinyin": "jì",
    "word": "技",
    "group": "___术、科___",
    "meaning": "才能，手艺",
    "semester": "G4A"
  },
  {
    "pinyin": "gǎi",
    "word": "改",
    "group": "___变、___正",
    "meaning": "变更，更换",
    "semester": "G4A"
  },
  {
    "pinyin": "chéng",
    "word": "程",
    "group": "___度、进___",
    "meaning": "事物发展的阶段；限度",
    "semester": "G4A"
  },
  {
    "pinyin": "chāo",
    "word": "超",
    "group": "___过、___越",
    "meaning": "越过，高出",
    "semester": "G4A"
  },
  {
    "pinyin": "yì",
    "word": "亿",
    "group": "___万、一___",
    "meaning": "数目，一万万",
    "semester": "G4A"
  },
  {
    "pinyin": "hé",
    "word": "核",
    "group": "___心、原子___",
    "meaning": "中心，主要部分",
    "semester": "G4A"
  },
  {
    "pinyin": "ào",
    "word": "奥",
    "group": "___秘、深___",
    "meaning": "含义深，不容易懂",
    "semester": "G4A"
  },
  {
    "pinyin": "yì",
    "word": "益",
    "group": "有___、___处",
    "meaning": "好处，有好处的",
    "semester": "G4A"
  },
  {
    "pinyin": "lián",
    "word": "联",
    "group": "___系、___合",
    "meaning": "连接，结合",
    "semester": "G4A"
  },
  {
    "pinyin": "zhì",
    "word": "质",
    "group": "___量、本___",
    "meaning": "事物的根本属性；产品的优劣程度",
    "semester": "G4A"
  },
  {
    "pinyin": "zhé",
    "word": "哲",
    "group": "___学、___理",
    "meaning": "有智慧，关于世界观的学说",
    "semester": "G4A"
  },
  {
    "pinyin": "rèn",
    "word": "任",
    "group": "___何、___务",
    "meaning": "不论，无论；职责",
    "semester": "G4A"
  },
  {
    "pinyin": "shàn",
    "word": "善",
    "group": "___良、友___",
    "meaning": "心地好，与“恶”相对",
    "semester": "G4A"
  },
  {
    "pinyin": "mù",
    "word": "暮",
    "group": "___色、日___",
    "meaning": "傍晚，太阳落山的时候",
    "semester": "G4A"
  },
  {
    "pinyin": "yín",
    "word": "吟",
    "group": "___诗、___诵",
    "meaning": "有节奏地诵读",
    "semester": "G4A"
  },
  {
    "pinyin": "tí",
    "word": "题",
    "group": "___目、问___",
    "meaning": "练习或考试要解答的问题",
    "semester": "G4A"
  },
  {
    "pinyin": "cè",
    "word": "侧",
    "group": "___面、___边",
    "meaning": "旁边，与“正”相对",
    "semester": "G4A"
  },
  {
    "pinyin": "fēng",
    "word": "峰",
    "group": "山___、顶___",
    "meaning": "山的尖顶",
    "semester": "G4A"
  },
  {
    "pinyin": "lú",
    "word": "庐",
    "group": "___山、茅___",
    "meaning": "简陋的房屋",
    "semester": "G4A"
  },
  {
    "pinyin": "yuán",
    "word": "缘",
    "group": "___分、___故",
    "meaning": "原因；人与人之间命中注定的联系",
    "semester": "G4A"
  },
  {
    "pinyin": "xiáng",
    "word": "降",
    "group": "___落、下___",
    "meaning": "落下，与“升”相对",
    "semester": "G4A"
  },
  {
    "pinyin": "fèi",
    "word": "费",
    "group": "花___、___用",
    "meaning": "消耗；钱的开支",
    "semester": "G4A"
  },
  {
    "pinyin": "xū",
    "word": "须",
    "group": "必___、___要",
    "meaning": "一定要，应当",
    "semester": "G4A"
  },
  {
    "pinyin": "xùn",
    "word": "逊",
    "group": "___色、谦___",
    "meaning": "差，比不上；谦虚",
    "semester": "G4A"
  },
  {
    "pinyin": "shū",
    "word": "输",
    "group": "___赢、___入",
    "meaning": "失败，与“赢”相对",
    "semester": "G4A"
  },
  {
    "pinyin": "hǔ",
    "word": "虎",
    "group": "老___、猛___",
    "meaning": "一种凶猛的大型猫科动物",
    "semester": "G4A"
  },
  {
    "pinyin": "cāo",
    "word": "操",
    "group": "___场、___作",
    "meaning": "体力锻炼；控制",
    "semester": "G4A"
  },
  {
    "pinyin": "zhàn",
    "word": "占",
    "group": "___领、___据",
    "meaning": "用强力取得；处于某种地位",
    "semester": "G4A"
  },
  {
    "pinyin": "nèn",
    "word": "嫩",
    "group": "___红、___绿",
    "meaning": "初生而柔弱，与“老”相对",
    "semester": "G4A"
  },
  {
    "pinyin": "shùn",
    "word": "顺",
    "group": "___利、___着",
    "meaning": "方向一致，不违背",
    "semester": "G4A"
  },
  {
    "pinyin": "jūn",
    "word": "均",
    "group": "___匀、平___",
    "meaning": "相等，平分",
    "semester": "G4A"
  },
  {
    "pinyin": "dié",
    "word": "叠",
    "group": "重___、___加",
    "meaning": "一层加上一层，重复地堆",
    "semester": "G4A"
  },
  {
    "pinyin": "xì",
    "word": "隙",
    "group": "空___、缝___",
    "meaning": "裂缝，空着的地方",
    "semester": "G4A"
  },
  {
    "pinyin": "jīng",
    "word": "茎",
    "group": "___叶、花___",
    "meaning": "植物的主干，支撑枝叶的部分",
    "semester": "G4A"
  },
  {
    "pinyin": "bǐng",
    "word": "柄",
    "group": "叶___、手___",
    "meaning": "植物的花叶枝和茎连接的部分",
    "semester": "G4A"
  },
  {
    "pinyin": "wěi",
    "word": "萎",
    "group": "枯___、___缩",
    "meaning": "植物干枯，失去生机",
    "semester": "G4A"
  },
  {
    "pinyin": "qiáo",
    "word": "瞧",
    "group": "___见、___一___",
    "meaning": "看",
    "semester": "G4A"
  },
  {
    "pinyin": "gù",
    "word": "固",
    "group": "___定、牢___",
    "meaning": "结实，不容易移动",
    "semester": "G4A"
  },
  {
    "pinyin": "zhái",
    "word": "宅",
    "group": "住___、___院",
    "meaning": "居住的房子",
    "semester": "G4A"
  },
  {
    "pinyin": "lín",
    "word": "临",
    "group": "___时、___近",
    "meaning": "快要到；靠近",
    "semester": "G4A"
  },
  {
    "pinyin": "shèn",
    "word": "慎",
    "group": "谨___、___重",
    "meaning": "小心，当心",
    "semester": "G4A"
  },
  {
    "pinyin": "xuǎn",
    "word": "选",
    "group": "___择、挑___",
    "meaning": "挑出合适的",
    "semester": "G4A"
  },
  {
    "pinyin": "zé",
    "word": "择",
    "group": "选___、抉___",
    "meaning": "挑选",
    "semester": "G4A"
  },
  {
    "pinyin": "zhǐ",
    "word": "址",
    "group": "住___、地___",
    "meaning": "地点，位置",
    "semester": "G4A"
  },
  {
    "pinyin": "liáng",
    "word": "良",
    "group": "___好、优___",
    "meaning": "好，优秀",
    "semester": "G4A"
  },
  {
    "pinyin": "xué",
    "word": "穴",
    "group": "洞___、___位",
    "meaning": "洞，窟窿",
    "semester": "G4A"
  },
  {
    "pinyin": "tīng",
    "word": "厅",
    "group": "大___、客___",
    "meaning": "房屋里宽敞的房间",
    "semester": "G4A"
  },
  {
    "pinyin": "wò",
    "word": "卧",
    "group": "___室、___倒",
    "meaning": "躺下；睡觉的",
    "semester": "G4A"
  },
  {
    "pinyin": "zhuān",
    "word": "专",
    "group": "___门、___心",
    "meaning": "集中在一件事上",
    "semester": "G4A"
  },
  {
    "pinyin": "jí",
    "word": "即",
    "group": "___使、立___",
    "meaning": "就是；马上",
    "semester": "G4A"
  },
  {
    "pinyin": "jiào",
    "word": "较",
    "group": "比___、___量",
    "meaning": "对比，相比",
    "semester": "G4A"
  },
  {
    "pinyin": "zhēng",
    "word": "睁",
    "group": "___眼、___开",
    "meaning": "张开眼睛",
    "semester": "G4A"
  },
  {
    "pinyin": "fān",
    "word": "翻",
    "group": "___身、___开",
    "meaning": "反转，上下或内外交换位置",
    "semester": "G4A"
  },
  {
    "pinyin": "fǔ",
    "word": "斧",
    "group": "___头、___子",
    "meaning": "一种砍东西的工具",
    "semester": "G4A"
  },
  {
    "pinyin": "pī",
    "word": "劈",
    "group": "___开、___柴",
    "meaning": "用刀斧等破开",
    "semester": "G4A"
  },
  {
    "pinyin": "huǎn",
    "word": "缓",
    "group": "___慢、___和",
    "meaning": "慢，与“急”相对",
    "semester": "G4A"
  },
  {
    "pinyin": "zhuó",
    "word": "浊",
    "group": "浑___、污___",
    "meaning": "不清澈，不干净",
    "semester": "G4A"
  },
  {
    "pinyin": "zhàng",
    "word": "丈",
    "group": "___夫、___量",
    "meaning": "长度单位；成年男子",
    "semester": "G4A"
  },
  {
    "pinyin": "chēng",
    "word": "撑",
    "group": "支___、___开",
    "meaning": "抵住，支持住",
    "semester": "G4A"
  },
  {
    "pinyin": "jié",
    "word": "竭",
    "group": "___力、枯___",
    "meaning": "用尽，耗尽",
    "semester": "G4A"
  },
  {
    "pinyin": "lèi",
    "word": "累",
    "group": "劳___、疲___",
    "meaning": "疲乏，疲倦",
    "semester": "G4A"
  },
  {
    "pinyin": "yè",
    "word": "液",
    "group": "血___、___体",
    "meaning": "能流动、没有固定形状的物质",
    "semester": "G4A"
  },
  {
    "pinyin": "bēn",
    "word": "奔",
    "group": "___跑、___流",
    "meaning": "快跑，急走",
    "semester": "G4A"
  },
  {
    "pinyin": "mào",
    "word": "茂",
    "group": "___盛、___密",
    "meaning": "草木生长得旺盛",
    "semester": "G4A"
  },
  {
    "pinyin": "zī",
    "word": "滋",
    "group": "___润、___养",
    "meaning": "增添养分，使生长",
    "semester": "G4A"
  },
  {
    "pinyin": "yuē",
    "word": "曰",
    "group": "子___、诗云子___",
    "meaning": "说，说道",
    "semester": "G4A"
  },
  {
    "pinyin": "nì",
    "word": "溺",
    "group": "___水、___爱",
    "meaning": "淹没在水里；过分宠爱",
    "semester": "G4A"
  },
  {
    "pinyin": "fǎn",
    "word": "返",
    "group": "___回、往___",
    "meaning": "回来，回去",
    "semester": "G4A"
  },
  {
    "pinyin": "xián",
    "word": "衔",
    "group": "___接、___着",
    "meaning": "用嘴含着；连接",
    "semester": "G4A"
  },
  {
    "pinyin": "bēi",
    "word": "悲",
    "group": "___惨、___伤",
    "meaning": "伤心，难过",
    "semester": "G4A"
  },
  {
    "pinyin": "cǎn",
    "word": "惨",
    "group": "悲___、凄___",
    "meaning": "处境不好，令人伤心",
    "semester": "G4A"
  },
  {
    "pinyin": "shòu",
    "word": "兽",
    "group": "野___、猛___",
    "meaning": "野生的哺乳动物",
    "semester": "G4A"
  },
  {
    "pinyin": "pèi",
    "word": "佩",
    "group": "敬___、___戴",
    "meaning": "敬重，佩服；挂在身上",
    "semester": "G4A"
  },
  {
    "pinyin": "jiān",
    "word": "坚",
    "group": "___定、___强",
    "meaning": "不动摇，结实",
    "semester": "G4A"
  },
  {
    "pinyin": "wéi",
    "word": "违",
    "group": "___抗、___反",
    "meaning": "不遵守，不服从",
    "semester": "G4A"
  },
  {
    "pinyin": "kàng",
    "word": "抗",
    "group": "违___、抵___",
    "meaning": "拒绝，抵挡",
    "semester": "G4A"
  },
  {
    "pinyin": "huán",
    "word": "环",
    "group": "___绕、圆___",
    "meaning": "圆圈形的东西；围绕",
    "semester": "G4A"
  },
  {
    "pinyin": "suǒ",
    "word": "锁",
    "group": "___门、铁___",
    "meaning": "用来封闭的器具",
    "semester": "G4A"
  },
  {
    "pinyin": "jì",
    "word": "既",
    "group": "___然、___而",
    "meaning": "已经；既然",
    "semester": "G4A"
  },
  {
    "pinyin": "hěn",
    "word": "狠",
    "group": "凶___、___心",
    "meaning": "凶恶，残忍",
    "semester": "G4A"
  },
  {
    "pinyin": "zhù",
    "word": "著",
    "group": "___名、___作",
    "meaning": "显明，出名；写的书",
    "semester": "G4A"
  },
  {
    "pinyin": "fèn",
    "word": "愤",
    "group": "___怒、气___",
    "meaning": "生气，不满",
    "semester": "G4A"
  },
  {
    "pinyin": "huò",
    "word": "获",
    "group": "___得、收___",
    "meaning": "得到，取得",
    "semester": "G4A"
  },
  {
    "pinyin": "xiù",
    "word": "嗅",
    "group": "___觉、___闻",
    "meaning": "用鼻子闻",
    "semester": "G4A"
  },
  {
    "pinyin": "dāi",
    "word": "呆",
    "group": "发___、___板",
    "meaning": "发愣，不灵活",
    "semester": "G4A"
  },
  {
    "pinyin": "nài",
    "word": "奈",
    "group": "无___、___何",
    "meaning": "怎么办，没有办法",
    "semester": "G4A"
  },
  {
    "pinyin": "cháo",
    "word": "巢",
    "group": "鸟___、___穴",
    "meaning": "鸟搭的窝",
    "semester": "G4A"
  },
  {
    "pinyin": "chǐ",
    "word": "齿",
    "group": "牙___、口___",
    "meaning": "人和动物嘴里咀嚼食物的器官",
    "semester": "G4A"
  },
  {
    "pinyin": "qū",
    "word": "躯",
    "group": "身___、___干",
    "meaning": "身体",
    "semester": "G4A"
  },
  {
    "pinyin": "yǎn",
    "word": "掩",
    "group": "___护、___盖",
    "meaning": "遮蔽，遮盖",
    "semester": "G4A"
  },
  {
    "pinyin": "hù",
    "word": "护",
    "group": "保___、守___",
    "meaning": "保卫，使不受伤害",
    "semester": "G4A"
  },
  {
    "pinyin": "yòu",
    "word": "幼",
    "group": "___小、___儿",
    "meaning": "年纪小，未长大",
    "semester": "G4A"
  },
  {
    "pinyin": "bó",
    "word": "搏",
    "group": "___斗、拼___",
    "meaning": "对打，奋力争取",
    "semester": "G4A"
  },
  {
    "pinyin": "páng",
    "word": "庞",
    "group": "___大、___然大物",
    "meaning": "大，巨大",
    "semester": "G4A"
  },
  {
    "pinyin": "liàng",
    "word": "量",
    "group": "力___、重___",
    "meaning": "能发挥的作用；多少的程度",
    "semester": "G4A"
  },
  {
    "pinyin": "lèng",
    "word": "愣",
    "group": "发___、___住",
    "meaning": "发呆，失神",
    "semester": "G4A"
  },
  {
    "pinyin": "jí",
    "word": "级",
    "group": "年___、等___",
    "meaning": "学校的学年分段；层次",
    "semester": "G4A"
  },
  {
    "pinyin": "liàn",
    "word": "链",
    "group": "铁___、___条",
    "meaning": "用金属环连起来的条状物",
    "semester": "G4A"
  },
  {
    "pinyin": "chàn",
    "word": "颤",
    "group": "___抖、发___",
    "meaning": "发抖，抖动",
    "semester": "G4A"
  },
  {
    "pinyin": "pān",
    "word": "攀",
    "group": "___登、___爬",
    "meaning": "抓住东西向上爬",
    "semester": "G4A"
  },
  {
    "pinyin": "hóu",
    "word": "猴",
    "group": "___子、小___",
    "meaning": "一种灵长类动物",
    "semester": "G4A"
  },
  {
    "pinyin": "niàn",
    "word": "念",
    "group": "思___、想___",
    "meaning": "惦记，常常想",
    "semester": "G4A"
  },
  {
    "pinyin": "biàn",
    "word": "辫",
    "group": "___子、发___",
    "meaning": "把头发分股编成的条状物",
    "semester": "G4A"
  },
  {
    "pinyin": "hē",
    "word": "呵",
    "group": "___护、___斥",
    "meaning": "呼气；护卫；责备",
    "semester": "G4A"
  },
  {
    "pinyin": "mō",
    "word": "摸",
    "group": "抚___、触___",
    "meaning": "用手接触或轻轻移动",
    "semester": "G4A"
  },
  {
    "pinyin": "shèn",
    "word": "甚",
    "group": "___至、___好",
    "meaning": "很，极；超过",
    "semester": "G4A"
  },
  {
    "pinyin": "guì",
    "word": "跪",
    "group": "___下、___拜",
    "meaning": "两膝着地，腰和股伸直",
    "semester": "G4A"
  },
  {
    "pinyin": "chuí",
    "word": "捶",
    "group": "___打、___背",
    "meaning": "用拳头或棒槌敲打",
    "semester": "G4A"
  },
  {
    "pinyin": "rào",
    "word": "绕",
    "group": "环___、___路",
    "meaning": "围着转；走迂回的路",
    "semester": "G4A"
  },
  {
    "pinyin": "wán",
    "word": "顽",
    "group": "___皮、___固",
    "meaning": "淘气，不听话；固执",
    "semester": "G4A"
  },
  {
    "pinyin": "bó",
    "word": "脖",
    "group": "___子、___颈",
    "meaning": "头和身体连接的部分",
    "semester": "G4A"
  },
  {
    "pinyin": "tuō",
    "word": "脱",
    "group": "___下、___落",
    "meaning": "取下，掉下",
    "semester": "G4A"
  },
  {
    "pinyin": "gài",
    "word": "概",
    "group": "大___、___括",
    "meaning": "大致，总括",
    "semester": "G4A"
  },
  {
    "pinyin": "rě",
    "word": "惹",
    "group": "___招、___事",
    "meaning": "引起，招来",
    "semester": "G4A"
  },
  {
    "pinyin": "hūn",
    "word": "昏",
    "group": "___暗、___迷",
    "meaning": "光线暗；失去知觉",
    "semester": "G4A"
  },
  {
    "pinyin": "wò",
    "word": "握",
    "group": "___手、___住",
    "meaning": "用手攥住",
    "semester": "G4A"
  },
  {
    "pinyin": "shuāi",
    "word": "摔",
    "group": "___倒、___打",
    "meaning": "掉下，跌倒",
    "semester": "G4A"
  },
  {
    "pinyin": "píng",
    "word": "凭",
    "group": "___借、任___",
    "meaning": "依靠；不管",
    "semester": "G4A"
  },
  {
    "pinyin": "qiā",
    "word": "掐",
    "group": "___住、___断",
    "meaning": "用手指用力捏",
    "semester": "G4A"
  },
  {
    "pinyin": "bān",
    "word": "班",
    "group": "___级、___长",
    "meaning": "学校里的年级分段；团体",
    "semester": "G4A"
  },
  {
    "pinyin": "gǔ",
    "word": "鼓",
    "group": "___励、打___",
    "meaning": "一种打击乐器；激发",
    "semester": "G4A"
  },
  {
    "pinyin": "yīn",
    "word": "殷",
    "group": "___切、___勤",
    "meaning": "深厚，恳切",
    "semester": "G4A"
  },
  {
    "pinyin": "liǎ",
    "word": "俩",
    "group": "咱___、兄妹___",
    "meaning": "两个",
    "semester": "G4A"
  },
  {
    "pinyin": "liàn",
    "word": "练",
    "group": "___习、训___",
    "meaning": "反复学习，使熟练",
    "semester": "G4A"
  },
  {
    "pinyin": "tào",
    "word": "套",
    "group": "手___、圈___",
    "meaning": "罩在外面的东西；计谋",
    "semester": "G4A"
  },
  {
    "pinyin": "kù",
    "word": "裤",
    "group": "___子、长___",
    "meaning": "穿在腰部以下的衣服",
    "semester": "G4A"
  },
  {
    "pinyin": "táo",
    "word": "逃",
    "group": "___跑、___走",
    "meaning": "跑开，躲避",
    "semester": "G4A"
  },
  {
    "pinyin": "kuī",
    "word": "亏",
    "group": "吃___、___本",
    "meaning": "受损失；欠缺",
    "semester": "G4A"
  },
  {
    "pinyin": "wā",
    "word": "挖",
    "group": "___掘、___洞",
    "meaning": "用工具掘出",
    "semester": "G4A"
  },
  {
    "pinyin": "chè",
    "word": "撤",
    "group": "___退、___走",
    "meaning": "退回去，收回",
    "semester": "G4A"
  },
  {
    "pinyin": "táng",
    "word": "堂",
    "group": "课___、礼___",
    "meaning": "正房，高大的屋子",
    "semester": "G4A"
  },
  {
    "pinyin": "zá",
    "word": "砸",
    "group": "___破、___开",
    "meaning": "用重物撞击",
    "semester": "G4A"
  },
  {
    "pinyin": "guō",
    "word": "锅",
    "group": "铁___、火___",
    "meaning": "做饭用的器具",
    "semester": "G4A"
  },
  {
    "pinyin": "fǒu",
    "word": "否",
    "group": "___则、是___",
    "meaning": "不，不是；不然",
    "semester": "G4A"
  },
  {
    "pinyin": "xuán",
    "word": "旋",
    "group": "___转、盘___",
    "meaning": "转动，绕着圈动",
    "semester": "G4A"
  },
  {
    "pinyin": "kuàng",
    "word": "况",
    "group": "情___、___且",
    "meaning": "情形，状态",
    "semester": "G4A"
  },
  {
    "pinyin": "bài",
    "word": "败",
    "group": "失___、打___",
    "meaning": "输，与“胜”相对",
    "semester": "G4A"
  },
  {
    "pinyin": "yǐ",
    "word": "椅",
    "group": "___子、桌___",
    "meaning": "有靠背的坐具",
    "semester": "G4A"
  },
  {
    "pinyin": "yóu",
    "word": "尤",
    "group": "___其、___甚",
    "meaning": "更加，特别",
    "semester": "G4A"
  },
  {
    "pinyin": "hèn",
    "word": "恨",
    "group": "仇___、怨___",
    "meaning": "仇视，不满",
    "semester": "G4A"
  },
  {
    "pinyin": "shuài",
    "word": "帅",
    "group": "___气、元___",
    "meaning": "英俊；军队里的最高指挥官",
    "semester": "G4A"
  },
  {
    "pinyin": "yù",
    "word": "预",
    "group": "___告、___防",
    "meaning": "事先，提前",
    "semester": "G4A"
  },
  {
    "pinyin": "kuì",
    "word": "溃",
    "group": "___败、崩___",
    "meaning": "被打垮，散乱",
    "semester": "G4A"
  },
  {
    "pinyin": "pǐn",
    "word": "品",
    "group": "___质、___德",
    "meaning": "物品；德行；等级",
    "semester": "G4A"
  },
  {
    "pinyin": "chǒu",
    "word": "丑",
    "group": "___陋、___事",
    "meaning": "不好看，与“美”相对",
    "semester": "G4A"
  },
  {
    "pinyin": "háo",
    "word": "豪",
    "group": "自___、___放",
    "meaning": "气魄大，直爽痛快",
    "semester": "G4A"
  },
  {
    "pinyin": "sài",
    "word": "塞",
    "group": "边___、___外",
    "meaning": "边界上险要的地方",
    "semester": "G4A"
  },
  {
    "pinyin": "qín",
    "word": "秦",
    "group": "___国、___朝",
    "meaning": "中国古代的一个朝代",
    "semester": "G4A"
  },
  {
    "pinyin": "zhēng",
    "word": "征",
    "group": "___战、出___",
    "meaning": "远行打仗；讨伐",
    "semester": "G4A"
  },
  {
    "pinyin": "cí",
    "word": "词",
    "group": "___语、诗___",
    "meaning": "语言里最小的有意义的单位",
    "semester": "G4A"
  },
  {
    "pinyin": "cuī",
    "word": "催",
    "group": "___促、___办",
    "meaning": "叫人赶快行动",
    "semester": "G4A"
  },
  {
    "pinyin": "zuì",
    "word": "醉",
    "group": "喝___、陶___",
    "meaning": "饮酒过量神志不清；沉迷",
    "semester": "G4A"
  },
  {
    "pinyin": "jié",
    "word": "杰",
    "group": "___出、英雄豪___",
    "meaning": "才能出众的人",
    "semester": "G4A"
  },
  {
    "pinyin": "yì",
    "word": "亦",
    "group": "人云___云",
    "meaning": "也，也是",
    "semester": "G4A"
  },
  {
    "pinyin": "xióng",
    "word": "雄",
    "group": "英___、___伟",
    "meaning": "强有力的，有气魄的",
    "semester": "G4A"
  },
  {
    "pinyin": "xiàng",
    "word": "项",
    "group": "___目、___羽",
    "meaning": "事物的分类；脖子的后部",
    "semester": "G4A"
  },
  {
    "pinyin": "sù",
    "word": "肃",
    "group": "严___、___静",
    "meaning": "庄重，认真",
    "semester": "G4A"
  },
  {
    "pinyin": "mò",
    "word": "默",
    "group": "沉___、___写",
    "meaning": "不说话，不出声",
    "semester": "G4A"
  },
  {
    "pinyin": "xī",
    "word": "晰",
    "group": "清___、明___",
    "meaning": "清楚，明白",
    "semester": "G4A"
  },
  {
    "pinyin": "zhèn",
    "word": "振",
    "group": "___兴、___动",
    "meaning": "摇动，奋起",
    "semester": "G4A"
  },
  {
    "pinyin": "xiōng",
    "word": "胸",
    "group": "___怀、___口",
    "meaning": "身体的胸部；内心",
    "semester": "G4A"
  },
  {
    "pinyin": "huái",
    "word": "怀",
    "group": "___抱、___念",
    "meaning": "胸前；心里存有",
    "semester": "G4A"
  },
  {
    "pinyin": "zàn",
    "word": "赞",
    "group": "___美、称___",
    "meaning": "夸奖，表扬",
    "semester": "G4A"
  },
  {
    "pinyin": "xiào",
    "word": "效",
    "group": "___果、___率",
    "meaning": "功用，成果",
    "semester": "G4A"
  },
  {
    "pinyin": "fán",
    "word": "凡",
    "group": "平___、___是",
    "meaning": "平常，普通；所有的",
    "semester": "G4A"
  },
  {
    "pinyin": "gù",
    "word": "顾",
    "group": "照___、回___",
    "meaning": "照管；回头看",
    "semester": "G4A"
  },
  {
    "pinyin": "xùn",
    "word": "训",
    "group": "___斥、教___",
    "meaning": "教导，告诫",
    "semester": "G4A"
  },
  {
    "pinyin": "chì",
    "word": "斥",
    "group": "训___、___责",
    "meaning": "责备，责骂",
    "semester": "G4A"
  },
  {
    "pinyin": "róng",
    "word": "戎",
    "group": "___马、___装",
    "meaning": "军队，军事",
    "semester": "G4A"
  },
  {
    "pinyin": "cháng",
    "word": "尝",
    "group": "品___、___试",
    "meaning": "吃一点试试；试一试",
    "semester": "G4A"
  },
  {
    "pinyin": "zhū",
    "word": "诸",
    "group": "___位、___多",
    "meaning": "众多，各个",
    "semester": "G4A"
  },
  {
    "pinyin": "jìng",
    "word": "竞",
    "group": "___争、___赛",
    "meaning": "争着做，比赛",
    "semester": "G4A"
  },
  {
    "pinyin": "wéi",
    "word": "唯",
    "group": "___一、___有",
    "meaning": "只，单单",
    "semester": "G4A"
  },
  {
    "pinyin": "bào",
    "word": "豹",
    "group": "___子、猎___",
    "meaning": "一种凶猛的猫科动物",
    "semester": "G4A"
  },
  {
    "pinyin": "pài",
    "word": "派",
    "group": "___遣、气___",
    "meaning": "差遣；风度",
    "semester": "G4A"
  },
  {
    "pinyin": "qǔ",
    "word": "娶",
    "group": "___亲、___妻",
    "meaning": "把女子接过来成亲",
    "semester": "G4A"
  },
  {
    "pinyin": "xí",
    "word": "媳",
    "group": "___妇、儿___",
    "meaning": "儿子的妻子",
    "semester": "G4A"
  },
  {
    "pinyin": "fù",
    "word": "妇",
    "group": "___女、夫___",
    "meaning": "成年女子",
    "semester": "G4A"
  },
  {
    "pinyin": "yān",
    "word": "淹",
    "group": "___没、___死",
    "meaning": "被水漫过",
    "semester": "G4A"
  },
  {
    "pinyin": "bī",
    "word": "逼",
    "group": "___迫、___近",
    "meaning": "强迫，给人压力",
    "semester": "G4A"
  },
  {
    "pinyin": "fú",
    "word": "浮",
    "group": "___漂、___动",
    "meaning": "漂在水面上，与“沉”相对",
    "semester": "G4A"
  },
  {
    "pinyin": "hàn",
    "word": "旱",
    "group": "干___、___灾",
    "meaning": "长时间不下雨，缺水",
    "semester": "G4A"
  },
  {
    "pinyin": "tú",
    "word": "徒",
    "group": "___弟、___劳",
    "meaning": "学生；白白地",
    "semester": "G4A"
  },
  {
    "pinyin": "rēng",
    "word": "扔",
    "group": "___掉、___出",
    "meaning": "抛，丢弃",
    "semester": "G4A"
  },
  {
    "pinyin": "ráo",
    "word": "饶",
    "group": "富___、___命",
    "meaning": "多，丰富；宽恕",
    "semester": "G4A"
  },
  {
    "pinyin": "piàn",
    "word": "骗",
    "group": "欺___、___人",
    "meaning": "用谎言使人上当",
    "semester": "G4A"
  },
  {
    "pinyin": "guàn",
    "word": "灌",
    "group": "___溉、___水",
    "meaning": "浇水，注入",
    "semester": "G4A"
  },
  {
    "pinyin": "gài",
    "word": "溉",
    "group": "灌___、浇___",
    "meaning": "浇灌田地",
    "semester": "G4A"
  }
];
export const G4B_CHARS: G4Char[] = [
  {
    "pinyin": "zá",
    "word": "杂",
    "group": "复___、___杂",
    "meaning": "多种多样的，不单纯的",
    "semester": "G4B"
  },
  {
    "pinyin": "xī",
    "word": "稀",
    "group": "稀___、___稀",
    "meaning": "事物出现得少；浓度低，含水分多",
    "semester": "G4B"
  },
  {
    "pinyin": "qīng",
    "word": "蜻",
    "group": "蜻___、___蜻",
    "meaning": "蜻蜓，一种益虫",
    "semester": "G4B"
  },
  {
    "pinyin": "tíng",
    "word": "蜓",
    "group": "蜓___、___蜓",
    "meaning": "蜻蜓的别称",
    "semester": "G4B"
  },
  {
    "pinyin": "dié",
    "word": "蝶",
    "group": "蝴___、___蝶",
    "meaning": "蝴蝶，一种昆虫",
    "semester": "G4B"
  },
  {
    "pinyin": "sù",
    "word": "宿",
    "group": "宿___、___舍",
    "meaning": "夜里睡觉；住在一起的人",
    "semester": "G4B"
  },
  {
    "pinyin": "xú",
    "word": "徐",
    "group": "徐___、___徐",
    "meaning": "慢慢地",
    "semester": "G4B"
  },
  {
    "pinyin": "shū",
    "word": "疏",
    "group": "稀___、___疏",
    "meaning": "清除阻塞使通畅；关系远",
    "semester": "G4B"
  },
  {
    "pinyin": "máo",
    "word": "茅",
    "group": "茅___、___屋",
    "meaning": "茅草，一种植物",
    "semester": "G4B"
  },
  {
    "pinyin": "yán",
    "word": "檐",
    "group": "房___、___檐",
    "meaning": "屋顶向旁边伸出的部分",
    "semester": "G4B"
  },
  {
    "pinyin": "wēng",
    "word": "翁",
    "group": "老___、___翁",
    "meaning": "老年男子；丈夫的父亲",
    "semester": "G4B"
  },
  {
    "pinyin": "lóng",
    "word": "笼",
    "group": "鸟___、___笼",
    "meaning": "用竹木等编成的器具",
    "semester": "G4B"
  },
  {
    "pinyin": "lài",
    "word": "赖",
    "group": "依___、___赖",
    "meaning": "依靠；欠钱不还",
    "semester": "G4B"
  },
  {
    "pinyin": "bō",
    "word": "剥",
    "group": "剥___、___剥",
    "meaning": "去掉外面的皮或壳",
    "semester": "G4B"
  },
  {
    "pinyin": "gòu",
    "word": "构",
    "group": "构___、___构",
    "meaning": "制造，建造",
    "semester": "G4B"
  },
  {
    "pinyin": "shì",
    "word": "饰",
    "group": "饰___、___饰",
    "meaning": "装饰品，使美观",
    "semester": "G4B"
  },
  {
    "pinyin": "dūn",
    "word": "蹲",
    "group": "蹲___、___蹲",
    "meaning": "屈膝像坐但臀部不着地",
    "semester": "G4B"
  },
  {
    "pinyin": "fèng",
    "word": "凤",
    "group": "凤___、___凤",
    "meaning": "凤凰，古代传说中的鸟王",
    "semester": "G4B"
  },
  {
    "pinyin": "xù",
    "word": "序",
    "group": "序___、___序",
    "meaning": "排列的次第；文章的组成部分",
    "semester": "G4B"
  },
  {
    "pinyin": "tóu",
    "word": "投",
    "group": "投___、___投",
    "meaning": "抛掷，扔进去",
    "semester": "G4B"
  },
  {
    "pinyin": "lì",
    "word": "例",
    "group": "例___、___例",
    "meaning": "可以用来比照的事例",
    "semester": "G4B"
  },
  {
    "pinyin": "shuài",
    "word": "率",
    "group": "率___、___率",
    "meaning": "带领；爽直坦白",
    "semester": "G4B"
  },
  {
    "pinyin": "sǒng",
    "word": "耸",
    "group": "耸___、___耸",
    "meaning": "高起，直立",
    "semester": "G4B"
  },
  {
    "pinyin": "tà",
    "word": "踏",
    "group": "踏___、___踏",
    "meaning": "用脚踩；亲自到现场",
    "semester": "G4B"
  },
  {
    "pinyin": "tǎng",
    "word": "倘",
    "group": "倘___、___倘",
    "meaning": "如果，假如",
    "semester": "G4B"
  },
  {
    "pinyin": "huì",
    "word": "绘",
    "group": "绘___、___绘",
    "meaning": "画，描画",
    "semester": "G4B"
  },
  {
    "pinyin": "xié",
    "word": "谐",
    "group": "谐___、___谐",
    "meaning": "配合得当；滑稽",
    "semester": "G4B"
  },
  {
    "pinyin": "jì",
    "word": "寄",
    "group": "寄___、___寄",
    "meaning": "通过邮局递送；依靠",
    "semester": "G4B"
  },
  {
    "pinyin": "mián",
    "word": "眠",
    "group": "眠___、___眠",
    "meaning": "睡觉",
    "semester": "G4B"
  },
  {
    "pinyin": "wèi",
    "word": "慰",
    "group": "慰___、___慰",
    "meaning": "使人心情安适",
    "semester": "G4B"
  },
  {
    "pinyin": "jiè",
    "word": "藉",
    "group": "藉___、___藉",
    "meaning": "垫在下面的东西；依靠",
    "semester": "G4B"
  },
  {
    "pinyin": "bǔ",
    "word": "卜",
    "group": "卜___、___卜",
    "meaning": "预测吉凶的手段",
    "semester": "G4B"
  },
  {
    "pinyin": "ruì",
    "word": "锐",
    "group": "锐___、___锐",
    "meaning": "感觉灵敏；锋利",
    "semester": "G4B"
  },
  {
    "pinyin": "tān",
    "word": "滩",
    "group": "滩___、___滩",
    "meaning": "江、河、湖、海边水浅的地方",
    "semester": "G4B"
  },
  {
    "pinyin": "zhàng",
    "word": "帐",
    "group": "帐___、___帐",
    "meaning": "用布、纱等做的遮蔽物",
    "semester": "G4B"
  },
  {
    "pinyin": "shuò",
    "word": "烁",
    "group": "烁___、___烁",
    "meaning": "光亮的样子",
    "semester": "G4B"
  },
  {
    "pinyin": "biān",
    "word": "蝙",
    "group": "蝙___、___蝙",
    "meaning": "蝙蝠，哺乳动物",
    "semester": "G4B"
  },
  {
    "pinyin": "fú",
    "word": "蝠",
    "group": "蝠___、___蝠",
    "meaning": "蝙蝠的蝠",
    "semester": "G4B"
  },
  {
    "pinyin": "bà",
    "word": "霸",
    "group": "霸___、___霸",
    "meaning": "强行霸道；用强力独占",
    "semester": "G4B"
  },
  {
    "pinyin": "yīng",
    "word": "鹰",
    "group": "鹰___、___鹰",
    "meaning": "一种猛禽",
    "semester": "G4B"
  },
  {
    "pinyin": "nù",
    "word": "怒",
    "group": "怒___、___怒",
    "meaning": "气愤，愤怒",
    "semester": "G4B"
  },
  {
    "pinyin": "hǒu",
    "word": "吼",
    "group": "吼___、___吼",
    "meaning": "野兽大声叫；因愤怒而喊",
    "semester": "G4B"
  },
  {
    "pinyin": "zhī",
    "word": "脂",
    "group": "脂___、___脂",
    "meaning": "动植物所含的油质",
    "semester": "G4B"
  },
  {
    "pinyin": "shì",
    "word": "拭",
    "group": "拭___、___拭",
    "meaning": "擦，抹",
    "semester": "G4B"
  },
  {
    "pinyin": "cān",
    "word": "餐",
    "group": "餐___、___餐",
    "meaning": "吃的东西；吃饭",
    "semester": "G4B"
  },
  {
    "pinyin": "huá",
    "word": "划",
    "group": "划___、___划",
    "meaning": "用刀划开；分配",
    "semester": "G4B"
  },
  {
    "pinyin": "shǎng",
    "word": "晌",
    "group": "晌___、___晌",
    "meaning": "一天以内的一段时间",
    "semester": "G4B"
  },
  {
    "pinyin": "là",
    "word": "辣",
    "group": "辣___、___辣",
    "meaning": "像姜、蒜等的刺激味道",
    "semester": "G4B"
  },
  {
    "pinyin": "shèn",
    "word": "渗",
    "group": "渗___、___渗",
    "meaning": "液体慢慢地透入",
    "semester": "G4B"
  },
  {
    "pinyin": "zhēng",
    "word": "挣",
    "group": "挣___、___挣",
    "meaning": "用力支撑或摆脱",
    "semester": "G4B"
  },
  {
    "pinyin": "fān",
    "word": "番",
    "group": "番___、___番",
    "meaning": "量词；外国的",
    "semester": "G4B"
  },
  {
    "pinyin": "mái",
    "word": "埋",
    "group": "埋___、___埋",
    "meaning": "用土盖住；藏起来",
    "semester": "G4B"
  },
  {
    "pinyin": "shuā",
    "word": "刷",
    "group": "刷___、___刷",
    "meaning": "用刷子清扫；挑选",
    "semester": "G4B"
  },
  {
    "pinyin": "cè",
    "word": "测",
    "group": "测___、___测",
    "meaning": "用仪器量；猜想",
    "semester": "G4B"
  },
  {
    "pinyin": "xiáng",
    "word": "详",
    "group": "详___、___详",
    "meaning": "详细，与简单相对",
    "semester": "G4B"
  },
  {
    "pinyin": "bèn",
    "word": "笨",
    "group": "笨___、___笨",
    "meaning": "不聪明，不灵活",
    "semester": "G4B"
  },
  {
    "pinyin": "dùn",
    "word": "钝",
    "group": "钝___、___钝",
    "meaning": "不锋利；反应慢",
    "semester": "G4B"
  },
  {
    "pinyin": "gē",
    "word": "鸽",
    "group": "鸽___、___鸽",
    "meaning": "一种常见的鸟",
    "semester": "G4B"
  },
  {
    "pinyin": "háo",
    "word": "毫",
    "group": "毫___、___毫",
    "meaning": "细长的毛；极少",
    "semester": "G4B"
  },
  {
    "pinyin": "líng",
    "word": "凌",
    "group": "凌___、___凌",
    "meaning": "冰；侵犯；逼近",
    "semester": "G4B"
  },
  {
    "pinyin": "mò",
    "word": "末",
    "group": "末___、___末",
    "meaning": "东西的梢；最后",
    "semester": "G4B"
  },
  {
    "pinyin": "miáo",
    "word": "描",
    "group": "描___、___描",
    "meaning": "照着样子画",
    "semester": "G4B"
  },
  {
    "pinyin": "suì",
    "word": "隧",
    "group": "隧___、___隧",
    "meaning": "凿穿山石而成的通道",
    "semester": "G4B"
  },
  {
    "pinyin": "tài",
    "word": "态",
    "group": "态___、___态",
    "meaning": "形状，样子",
    "semester": "G4B"
  },
  {
    "pinyin": "dūn",
    "word": "吨",
    "group": "吨___、___吨",
    "meaning": "计量单位",
    "semester": "G4B"
  },
  {
    "pinyin": "lú",
    "word": "颅",
    "group": "颅___、___颅",
    "meaning": "头的内部",
    "semester": "G4B"
  },
  {
    "pinyin": "péng",
    "word": "膨",
    "group": "膨___、___膨",
    "meaning": "体积增大",
    "semester": "G4B"
  },
  {
    "pinyin": "zhī",
    "word": "肢",
    "group": "肢___、___肢",
    "meaning": "人的胳膊和腿",
    "semester": "G4B"
  },
  {
    "pinyin": "yì",
    "word": "翼",
    "group": "翼___、___翼",
    "meaning": "翅膀",
    "semester": "G4B"
  },
  {
    "pinyin": "pì",
    "word": "辟",
    "group": "辟___、___辟",
    "meaning": "开发；透彻",
    "semester": "G4B"
  },
  {
    "pinyin": "nà",
    "word": "纳",
    "group": "纳___、___纳",
    "meaning": "收进来；交付",
    "semester": "G4B"
  },
  {
    "pinyin": "yōng",
    "word": "拥",
    "group": "拥___、___拥",
    "meaning": "抱；围着",
    "semester": "G4B"
  },
  {
    "pinyin": "xiāng",
    "word": "箱",
    "group": "箱___、___箱",
    "meaning": "收藏衣物的方形器具",
    "semester": "G4B"
  },
  {
    "pinyin": "chòu",
    "word": "臭",
    "group": "臭___、___臭",
    "meaning": "气味难闻",
    "semester": "G4B"
  },
  {
    "pinyin": "shū",
    "word": "蔬",
    "group": "蔬___、___蔬",
    "meaning": "可以吃的菜",
    "semester": "G4B"
  },
  {
    "pinyin": "tàn",
    "word": "碳",
    "group": "碳___、___碳",
    "meaning": "一种非金属元素",
    "semester": "G4B"
  },
  {
    "pinyin": "gāng",
    "word": "钢",
    "group": "钢___、___钢",
    "meaning": "铁和碳的合金",
    "semester": "G4B"
  },
  {
    "pinyin": "yǐn",
    "word": "隐",
    "group": "隐___、___隐",
    "meaning": "藏起来不让人知道",
    "semester": "G4B"
  },
  {
    "pinyin": "jiàn",
    "word": "健",
    "group": "健___、___健",
    "meaning": "身体强壮",
    "semester": "G4B"
  },
  {
    "pinyin": "kāng",
    "word": "康",
    "group": "康___、___康",
    "meaning": "身体健康",
    "semester": "G4B"
  },
  {
    "pinyin": "bāo",
    "word": "胞",
    "group": "胞___、___胞",
    "meaning": "同胞；细胞",
    "semester": "G4B"
  },
  {
    "pinyin": "jí",
    "word": "疾",
    "group": "疾___、___疾",
    "meaning": "病；快",
    "semester": "G4B"
  },
  {
    "pinyin": "fáng",
    "word": "防",
    "group": "防___、___防",
    "meaning": "防备，防御",
    "semester": "G4B"
  },
  {
    "pinyin": "zào",
    "word": "灶",
    "group": "灶___、___灶",
    "meaning": "生火做饭的设备",
    "semester": "G4B"
  },
  {
    "pinyin": "xū",
    "word": "需",
    "group": "需___、___需",
    "meaning": "必须有",
    "semester": "G4B"
  },
  {
    "pinyin": "fán",
    "word": "繁",
    "group": "繁___、___繁",
    "meaning": "多；复杂",
    "semester": "G4B"
  },
  {
    "pinyin": "màn",
    "word": "漫",
    "group": "漫___、___漫",
    "meaning": "长到看不见头；随便",
    "semester": "G4B"
  },
  {
    "pinyin": "miè",
    "word": "灭",
    "group": "灭___、___灭",
    "meaning": "完结，消失",
    "semester": "G4B"
  },
  {
    "pinyin": "téng",
    "word": "藤",
    "group": "藤___、___藤",
    "meaning": "植物的匍匐茎",
    "semester": "G4B"
  },
  {
    "pinyin": "luó",
    "word": "萝",
    "group": "萝___、___萝",
    "meaning": "萝卜，一种蔬菜",
    "semester": "G4B"
  },
  {
    "pinyin": "xī",
    "word": "膝",
    "group": "膝___、___膝",
    "meaning": "大腿和小腿相连的关节",
    "semester": "G4B"
  },
  {
    "pinyin": "tāo",
    "word": "涛",
    "group": "涛___、___涛",
    "meaning": "大的波浪",
    "semester": "G4B"
  },
  {
    "pinyin": "duǒ",
    "word": "躲",
    "group": "躲___、___躲",
    "meaning": "避开",
    "semester": "G4B"
  },
  {
    "pinyin": "píng",
    "word": "瓶",
    "group": "瓶___、___瓶",
    "meaning": "口小腹大的容器",
    "semester": "G4B"
  },
  {
    "pinyin": "jǐ",
    "word": "挤",
    "group": "挤___、___挤",
    "meaning": "紧紧靠在一起；用压力排出",
    "semester": "G4B"
  },
  {
    "pinyin": "chā",
    "word": "叉",
    "group": "叉___、___叉",
    "meaning": "一端有齿的器具",
    "semester": "G4B"
  },
  {
    "pinyin": "huī",
    "word": "挥",
    "group": "挥___、___挥",
    "meaning": "摇摆，舞动",
    "semester": "G4B"
  },
  {
    "pinyin": "huà",
    "word": "桦",
    "group": "桦___、___桦",
    "meaning": "一种落叶乔木",
    "semester": "G4B"
  },
  {
    "pinyin": "tú",
    "word": "涂",
    "group": "涂___、___涂",
    "meaning": "使覆盖在表面；乱写",
    "semester": "G4B"
  },
  {
    "pinyin": "róng",
    "word": "茸",
    "group": "茸___、___茸",
    "meaning": "草初生纤细柔软的样子",
    "semester": "G4B"
  },
  {
    "pinyin": "xiù",
    "word": "绣",
    "group": "绣___、___绣",
    "meaning": "用彩线在布上做成图案",
    "semester": "G4B"
  },
  {
    "pinyin": "xiāo",
    "word": "潇",
    "group": "潇___、___潇",
    "meaning": "自然大方，不呆滞",
    "semester": "G4B"
  },
  {
    "pinyin": "suì",
    "word": "穗",
    "group": "穗___、___穗",
    "meaning": "谷物聚在一起的花或果实",
    "semester": "G4B"
  },
  {
    "pinyin": "méng",
    "word": "朦",
    "group": "朦___、___朦",
    "meaning": "模糊，不清楚",
    "semester": "G4B"
  },
  {
    "pinyin": "lóng",
    "word": "胧",
    "group": "胧___、___胧",
    "meaning": "模糊的样子",
    "semester": "G4B"
  },
  {
    "pinyin": "jì",
    "word": "寂",
    "group": "寂___、___寂",
    "meaning": "静，没有声音",
    "semester": "G4B"
  },
  {
    "pinyin": "xiá",
    "word": "霞",
    "group": "霞___、___霞",
    "meaning": "日出日落时的云彩",
    "semester": "G4B"
  },
  {
    "pinyin": "mǒ",
    "word": "抹",
    "group": "抹___、___抹",
    "meaning": "涂上；擦",
    "semester": "G4B"
  },
  {
    "pinyin": "yōu",
    "word": "忧",
    "group": "忧___、___忧",
    "meaning": "忧愁，愁闷",
    "semester": "G4B"
  },
  {
    "pinyin": "lǜ",
    "word": "虑",
    "group": "虑___、___虑",
    "meaning": "思考，谋划",
    "semester": "G4B"
  },
  {
    "pinyin": "tān",
    "word": "贪",
    "group": "贪___、___贪",
    "meaning": "想要得到；不满足",
    "semester": "G4B"
  },
  {
    "pinyin": "zhí",
    "word": "职",
    "group": "职___、___职",
    "meaning": "分内应做的事",
    "semester": "G4B"
  },
  {
    "pinyin": "píng",
    "word": "屏",
    "group": "屏___、___屏",
    "meaning": "挡风的障子；遮",
    "semester": "G4B"
  },
  {
    "pinyin": "cèng",
    "word": "蹭",
    "group": "蹭___、___蹭",
    "meaning": "摩擦；慢吞吞地走",
    "semester": "G4B"
  },
  {
    "pinyin": "gǎo",
    "word": "稿",
    "group": "稿___、___稿",
    "meaning": "写东西的底稿",
    "semester": "G4B"
  },
  {
    "pinyin": "qiāng",
    "word": "腔",
    "group": "腔___、___腔",
    "meaning": "动物身体内的空部分",
    "semester": "G4B"
  },
  {
    "pinyin": "jiě",
    "word": "解",
    "group": "解___、___解",
    "meaning": "分开；懂",
    "semester": "G4B"
  },
  {
    "pinyin": "mèn",
    "word": "闷",
    "group": "闷___、___闷",
    "meaning": "空气不流通；心烦",
    "semester": "G4B"
  },
  {
    "pinyin": "shé",
    "word": "蛇",
    "group": "蛇___、___蛇",
    "meaning": "一种爬行动物",
    "semester": "G4B"
  },
  {
    "pinyin": "zāo",
    "word": "遭",
    "group": "遭___、___遭",
    "meaning": "遇到；次，圈",
    "semester": "G4B"
  },
  {
    "pinyin": "yāng",
    "word": "殃",
    "group": "殃___、___殃",
    "meaning": "祸害，使受苦",
    "semester": "G4B"
  },
  {
    "pinyin": "pén",
    "word": "盆",
    "group": "盆___、___盆",
    "meaning": "盛东西的器具",
    "semester": "G4B"
  },
  {
    "pinyin": "bó",
    "word": "勃",
    "group": "勃___、___勃",
    "meaning": "突然；旺盛",
    "semester": "G4B"
  },
  {
    "pinyin": "tǎo",
    "word": "讨",
    "group": "讨___、___讨",
    "meaning": "研究；引起",
    "semester": "G4B"
  },
  {
    "pinyin": "yàn",
    "word": "厌",
    "group": "厌___、___厌",
    "meaning": "嫌恶，满足",
    "semester": "G4B"
  },
  {
    "pinyin": "bà",
    "word": "坝",
    "group": "坝___、___坝",
    "meaning": "拦住水流的建筑物",
    "semester": "G4B"
  },
  {
    "pinyin": "zhōng",
    "word": "忠",
    "group": "忠___、___忠",
    "meaning": "赤诚无私，诚心尽力",
    "semester": "G4B"
  },
  {
    "pinyin": "dú",
    "word": "毒",
    "group": "毒___、___毒",
    "meaning": "对生物有害的东西",
    "semester": "G4B"
  },
  {
    "pinyin": "jì",
    "word": "绩",
    "group": "绩___、___绩",
    "meaning": "成果，业绩",
    "semester": "G4B"
  },
  {
    "pinyin": "fū",
    "word": "孵",
    "group": "孵___、___孵",
    "meaning": "昆虫、鱼、鸟等产卵后用体温使卵内的胚胎发育成幼体",
    "semester": "G4B"
  },
  {
    "pinyin": "jǐng",
    "word": "警",
    "group": "警___、___警",
    "meaning": "注意并防备；使人注意",
    "semester": "G4B"
  },
  {
    "pinyin": "jiè",
    "word": "戒",
    "group": "戒___、___戒",
    "meaning": "防备；改掉不良习惯",
    "semester": "G4B"
  },
  {
    "pinyin": "wāi",
    "word": "歪",
    "group": "歪___、___歪",
    "meaning": "不正，偏",
    "semester": "G4B"
  },
  {
    "pinyin": "gū",
    "word": "咕",
    "group": "咕___、___咕",
    "meaning": "象声词",
    "semester": "G4B"
  },
  {
    "pinyin": "tāng",
    "word": "汤",
    "group": "汤___、___汤",
    "meaning": "热水；煮食物的汁水",
    "semester": "G4B"
  },
  {
    "pinyin": "jué",
    "word": "掘",
    "group": "掘___、___掘",
    "meaning": "刨，挖",
    "semester": "G4B"
  },
  {
    "pinyin": "fú",
    "word": "伏",
    "group": "伏___、___伏",
    "meaning": "趴；低下去",
    "semester": "G4B"
  },
  {
    "pinyin": "tí",
    "word": "啼",
    "group": "啼___、___啼",
    "meaning": "出声地哭；叫",
    "semester": "G4B"
  },
  {
    "pinyin": "diào",
    "word": "调",
    "group": "调___、___调",
    "meaning": "查访；更动",
    "semester": "G4B"
  },
  {
    "pinyin": "cù",
    "word": "促",
    "group": "促___、___促",
    "meaning": "催，推动",
    "semester": "G4B"
  },
  {
    "pinyin": "pō",
    "word": "颇",
    "group": "颇___、___颇",
    "meaning": "很，相当地",
    "semester": "G4B"
  },
  {
    "pinyin": "jù",
    "word": "剧",
    "group": "剧___、___剧",
    "meaning": "戏剧；厉害",
    "semester": "G4B"
  },
  {
    "pinyin": "gǒu",
    "word": "苟",
    "group": "苟___、___苟",
    "meaning": "只顾眼前；随便",
    "semester": "G4B"
  },
  {
    "pinyin": "pì",
    "word": "譬",
    "group": "譬___、___譬",
    "meaning": "比如，比方",
    "semester": "G4B"
  },
  {
    "pinyin": "shì",
    "word": "侍",
    "group": "侍___、___侍",
    "meaning": "陪伴伺候",
    "semester": "G4B"
  },
  {
    "pinyin": "guǎn",
    "word": "馆",
    "group": "馆___、___馆",
    "meaning": "招待客人住的地方",
    "semester": "G4B"
  },
  {
    "pinyin": "fù",
    "word": "附",
    "group": "附___、___附",
    "meaning": "另外加上；依从",
    "semester": "G4B"
  },
  {
    "pinyin": "pí",
    "word": "脾",
    "group": "脾___、___脾",
    "meaning": "内脏之一",
    "semester": "G4B"
  },
  {
    "pinyin": "mǐn",
    "word": "敏",
    "group": "敏___、___敏",
    "meaning": "反应快",
    "semester": "G4B"
  },
  {
    "pinyin": "jié",
    "word": "捷",
    "group": "捷___、___捷",
    "meaning": "快，战胜",
    "semester": "G4B"
  },
  {
    "pinyin": "áng",
    "word": "昂",
    "group": "昂___、___昂",
    "meaning": "抬起；高涨",
    "semester": "G4B"
  },
  {
    "pinyin": "gōng",
    "word": "供",
    "group": "供___、___供",
    "meaning": "献；审查的口供",
    "semester": "G4B"
  },
  {
    "pinyin": "tiān",
    "word": "添",
    "group": "添___、___添",
    "meaning": "增加",
    "semester": "G4B"
  },
  {
    "pinyin": "kuò",
    "word": "扩",
    "group": "扩___、___扩",
    "meaning": "放大",
    "semester": "G4B"
  },
  {
    "pinyin": "fàn",
    "word": "范",
    "group": "范___、___范",
    "meaning": "一定范围的标准；榜样",
    "semester": "G4B"
  },
  {
    "pinyin": "nǔ",
    "word": "努",
    "group": "努___、___努",
    "meaning": "尽量地用力",
    "semester": "G4B"
  },
  {
    "pinyin": "chà",
    "word": "刹",
    "group": "刹___、___刹",
    "meaning": "极短的时间；止住",
    "semester": "G4B"
  },
  {
    "pinyin": "làn",
    "word": "烂",
    "group": "烂___、___烂",
    "meaning": "过期；过度",
    "semester": "G4B"
  },
  {
    "pinyin": "tì",
    "word": "替",
    "group": "替___、___替",
    "meaning": "代，代理",
    "semester": "G4B"
  },
  {
    "pinyin": "xiāng",
    "word": "镶",
    "group": "镶___、___镶",
    "meaning": "把东西嵌进去或在外围加装饰",
    "semester": "G4B"
  },
  {
    "pinyin": "zǐ",
    "word": "紫",
    "group": "紫___、___紫",
    "meaning": "红和蓝合成的颜色",
    "semester": "G4B"
  },
  {
    "pinyin": "jǐn",
    "word": "仅",
    "group": "仅___、___仅",
    "meaning": "只，不过",
    "semester": "G4B"
  },
  {
    "pinyin": "zhè",
    "word": "浙",
    "group": "浙___、___浙",
    "meaning": "浙江，省名",
    "semester": "G4B"
  },
  {
    "pinyin": "luó",
    "word": "罗",
    "group": "罗___、___罗",
    "meaning": "排列；捉鸟的网",
    "semester": "G4B"
  },
  {
    "pinyin": "dù",
    "word": "杜",
    "group": "杜___、___杜",
    "meaning": "堵住，封闭",
    "semester": "G4B"
  },
  {
    "pinyin": "juān",
    "word": "鹃",
    "group": "鹃___、___鹃",
    "meaning": "杜鹃，一种鸟",
    "semester": "G4B"
  },
  {
    "pinyin": "zhǎi",
    "word": "窄",
    "group": "窄___、___窄",
    "meaning": "横的距离小",
    "semester": "G4B"
  },
  {
    "pinyin": "yù",
    "word": "郁",
    "group": "郁___、___郁",
    "meaning": "草木茂盛；忧愁",
    "semester": "G4B"
  },
  {
    "pinyin": "jiān",
    "word": "肩",
    "group": "肩___、___肩",
    "meaning": "脖子旁边胳膊上边的部分",
    "semester": "G4B"
  },
  {
    "pinyin": "tún",
    "word": "臀",
    "group": "臀___、___臀",
    "meaning": "屁股",
    "semester": "G4B"
  },
  {
    "pinyin": "yí",
    "word": "移",
    "group": "移___、___移",
    "meaning": "改换原来的位置",
    "semester": "G4B"
  },
  {
    "pinyin": "é",
    "word": "额",
    "group": "额___、___额",
    "meaning": "眉毛以上头发以下的部分",
    "semester": "G4B"
  },
  {
    "pinyin": "lù",
    "word": "陆",
    "group": "陆___、___陆",
    "meaning": "高出水面的土地",
    "semester": "G4B"
  },
  {
    "pinyin": "rǔ",
    "word": "乳",
    "group": "乳___、___乳",
    "meaning": "奶汁；像奶汁的",
    "semester": "G4B"
  },
  {
    "pinyin": "sǔn",
    "word": "笋",
    "group": "笋___、___笋",
    "meaning": "竹子的嫩芽",
    "semester": "G4B"
  },
  {
    "pinyin": "duān",
    "word": "端",
    "group": "端___、___端",
    "meaning": "正，不歪；东西的头",
    "semester": "G4B"
  },
  {
    "pinyin": "yuán",
    "word": "源",
    "group": "源___、___源",
    "meaning": "水流开始的地方",
    "semester": "G4B"
  },
  {
    "pinyin": "náng",
    "word": "囊",
    "group": "囊___、___囊",
    "meaning": "口袋",
    "semester": "G4B"
  },
  {
    "pinyin": "yíng",
    "word": "萤",
    "group": "萤___、___萤",
    "meaning": "萤火虫，一种昆虫",
    "semester": "G4B"
  },
  {
    "pinyin": "gōng",
    "word": "恭",
    "group": "恭___、___恭",
    "meaning": "肃敬，谦逊有礼貌",
    "semester": "G4B"
  },
  {
    "pinyin": "qín",
    "word": "勤",
    "group": "勤___、___勤",
    "meaning": "努力，不怕苦",
    "semester": "G4B"
  },
  {
    "pinyin": "bó",
    "word": "博",
    "group": "博___、___博",
    "meaning": "多，广",
    "semester": "G4B"
  },
  {
    "pinyin": "pín",
    "word": "贫",
    "group": "贫___、___贫",
    "meaning": "穷，收入少",
    "semester": "G4B"
  },
  {
    "pinyin": "féng",
    "word": "逢",
    "group": "逢___、___逢",
    "meaning": "遇到",
    "semester": "G4B"
  },
  {
    "pinyin": "jìn",
    "word": "晋",
    "group": "晋___、___晋",
    "meaning": "进；向前",
    "semester": "G4B"
  },
  {
    "pinyin": "niǔ",
    "word": "扭",
    "group": "扭___、___扭",
    "meaning": "掉转；揪住",
    "semester": "G4B"
  },
  {
    "pinyin": "kàng",
    "word": "炕",
    "group": "炕___、___炕",
    "meaning": "北方用砖、坯砌成的床",
    "semester": "G4B"
  },
  {
    "pinyin": "qiān",
    "word": "铅",
    "group": "铅___、___铅",
    "meaning": "金属元素",
    "semester": "G4B"
  },
  {
    "pinyin": "bīng",
    "word": "兵",
    "group": "兵___、___兵",
    "meaning": "战士；军队",
    "semester": "G4B"
  },
  {
    "pinyin": "huàng",
    "word": "晃",
    "group": "晃___、___晃",
    "meaning": "摇动；照耀",
    "semester": "G4B"
  },
  {
    "pinyin": "li",
    "word": "哩",
    "group": "哩___、___哩",
    "meaning": "英美计量单位",
    "semester": "G4B"
  },
  {
    "pinyin": "gē",
    "word": "胳",
    "group": "胳___、___胳",
    "meaning": "胳膊",
    "semester": "G4B"
  },
  {
    "pinyin": "bo",
    "word": "膊",
    "group": "膊___、___膊",
    "meaning": "胳膊",
    "semester": "G4B"
  },
  {
    "pinyin": "jié",
    "word": "劫",
    "group": "劫___、___劫",
    "meaning": "强取；威逼",
    "semester": "G4B"
  },
  {
    "pinyin": "chóu",
    "word": "绸",
    "group": "绸___、___绸",
    "meaning": "一种薄而软的丝织品",
    "semester": "G4B"
  },
  {
    "pinyin": "bā",
    "word": "扒",
    "group": "扒___、___扒",
    "meaning": "刨；拆；抓住",
    "semester": "G4B"
  },
  {
    "pinyin": "dí",
    "word": "敌",
    "group": "敌___、___敌",
    "meaning": "有利害冲突的；有仇恨的",
    "semester": "G4B"
  },
  {
    "pinyin": "shī",
    "word": "尸",
    "group": "尸___、___尸",
    "meaning": "死人的身体",
    "semester": "G4B"
  },
  {
    "pinyin": "huāng",
    "word": "慌",
    "group": "慌___、___慌",
    "meaning": "心里不沉着，动作忙乱",
    "semester": "G4B"
  },
  {
    "pinyin": "fú",
    "word": "芙",
    "group": "芙___、___芙",
    "meaning": "芙蓉，植物名",
    "semester": "G4B"
  },
  {
    "pinyin": "róng",
    "word": "蓉",
    "group": "蓉___、___蓉",
    "meaning": "四川成都的别称",
    "semester": "G4B"
  },
  {
    "pinyin": "luò",
    "word": "洛",
    "group": "洛___、___洛",
    "meaning": "洛河，水名",
    "semester": "G4B"
  },
  {
    "pinyin": "hú",
    "word": "壶",
    "group": "壶___、___壶",
    "meaning": "陶瓷或金属制成的容器",
    "semester": "G4B"
  },
  {
    "pinyin": "yàn",
    "word": "雁",
    "group": "雁___、___雁",
    "meaning": "一种候鸟",
    "semester": "G4B"
  },
  {
    "pinyin": "yíng",
    "word": "营",
    "group": "营___、___营",
    "meaning": "谋求；军队驻扎的地方",
    "semester": "G4B"
  },
  {
    "pinyin": "shè",
    "word": "射",
    "group": "射___、___射",
    "meaning": "用推力或弹力发出",
    "semester": "G4B"
  },
  {
    "pinyin": "dàn",
    "word": "弹",
    "group": "弹___、___弹",
    "meaning": "可以用弹力发射的圆形物体",
    "semester": "G4B"
  },
  {
    "pinyin": "róng",
    "word": "荣",
    "group": "荣___、___荣",
    "meaning": "草木茂盛；兴盛",
    "semester": "G4B"
  },
  {
    "pinyin": "bào",
    "word": "爆",
    "group": "爆___、___爆",
    "meaning": "猛然破裂；突然发生",
    "semester": "G4B"
  },
  {
    "pinyin": "zhà",
    "word": "炸",
    "group": "炸___、___炸",
    "meaning": "突然破裂",
    "semester": "G4B"
  },
  {
    "pinyin": "lún",
    "word": "伦",
    "group": "伦___、___伦",
    "meaning": "同类；条理",
    "semester": "G4B"
  },
  {
    "pinyin": "fù",
    "word": "腹",
    "group": "腹___、___腹",
    "meaning": "肚子",
    "semester": "G4B"
  },
  {
    "pinyin": "pōu",
    "word": "剖",
    "group": "剖___、___剖",
    "meaning": "破开",
    "semester": "G4B"
  },
  {
    "pinyin": "kū",
    "word": "窟",
    "group": "窟___、___窟",
    "meaning": "洞穴",
    "semester": "G4B"
  },
  {
    "pinyin": "lóng",
    "word": "窿",
    "group": "窿___、___窿",
    "meaning": "孔穴",
    "semester": "G4B"
  },
  {
    "pinyin": "hùn",
    "word": "混",
    "group": "混___、___混",
    "meaning": "搀杂在一起",
    "semester": "G4B"
  },
  {
    "pinyin": "sī",
    "word": "嘶",
    "group": "嘶___、___嘶",
    "meaning": "声音沙哑；喊",
    "semester": "G4B"
  },
  {
    "pinyin": "wéi",
    "word": "维",
    "group": "维___、___维",
    "meaning": "连接；保持",
    "semester": "G4B"
  },
  {
    "pinyin": "zhì",
    "word": "秩",
    "group": "秩___、___秩",
    "meaning": "有条理",
    "semester": "G4B"
  },
  {
    "pinyin": "gǎng",
    "word": "岗",
    "group": "岗___、___岗",
    "meaning": "守卫的位置；突起",
    "semester": "G4B"
  },
  {
    "pinyin": "zǎi",
    "word": "宰",
    "group": "宰___、___宰",
    "meaning": "杀；主管",
    "semester": "G4B"
  },
  {
    "pinyin": "cuò",
    "word": "措",
    "group": "措___、___措",
    "meaning": "安排；筹划",
    "semester": "G4B"
  },
  {
    "pinyin": "qiǎn",
    "word": "遣",
    "group": "遣___、___遣",
    "meaning": "派；打发",
    "semester": "G4B"
  },
  {
    "pinyin": "jiàn",
    "word": "践",
    "group": "践___、___践",
    "meaning": "踩；履行",
    "semester": "G4B"
  },
  {
    "pinyin": "jiè",
    "word": "介",
    "group": "介___、___介",
    "meaning": "在两者中间",
    "semester": "G4B"
  },
  {
    "pinyin": "shào",
    "word": "绍",
    "group": "绍___、___绍",
    "meaning": "接续；介绍",
    "semester": "G4B"
  },
  {
    "pinyin": "yāo",
    "word": "妖",
    "group": "妖___、___妖",
    "meaning": "神话中形状奇怪有害的怪物",
    "semester": "G4B"
  },
  {
    "pinyin": "jǔ",
    "word": "矩",
    "group": "矩___、___矩",
    "meaning": "画直角用的工具",
    "semester": "G4B"
  },
  {
    "pinyin": "guāi",
    "word": "乖",
    "group": "乖___、___乖",
    "meaning": "顺从；机灵",
    "semester": "G4B"
  },
  {
    "pinyin": "niǎn",
    "word": "撵",
    "group": "撵___、___撵",
    "meaning": "驱逐；赶走",
    "semester": "G4B"
  },
  {
    "pinyin": "tàng",
    "word": "烫",
    "group": "烫___、___烫",
    "meaning": "温度高；用温度高的东西使物体起变化",
    "semester": "G4B"
  },
  {
    "pinyin": "yā",
    "word": "丫",
    "group": "丫___、___丫",
    "meaning": "分叉的东西",
    "semester": "G4B"
  },
  {
    "pinyin": "zhuài",
    "word": "拽",
    "group": "拽___、___拽",
    "meaning": "拉，拖",
    "semester": "G4B"
  },
  {
    "pinyin": "fú",
    "word": "福",
    "group": "福___、___福",
    "meaning": "运气好",
    "semester": "G4B"
  },
  {
    "pinyin": "tiǎn",
    "word": "舔",
    "group": "舔___、___舔",
    "meaning": "用舌头接触东西",
    "semester": "G4B"
  },
  {
    "pinyin": "kuí",
    "word": "葵",
    "group": "葵___、___葵",
    "meaning": "植物名",
    "semester": "G4B"
  },
  {
    "pinyin": "shòu",
    "word": "瘦",
    "group": "瘦___、___瘦",
    "meaning": "脂肪少；窄小",
    "semester": "G4B"
  },
  {
    "pinyin": "bàng",
    "word": "棒",
    "group": "棒___、___棒",
    "meaning": "棍子；好",
    "semester": "G4B"
  },
  {
    "pinyin": "bà",
    "word": "罢",
    "group": "罢___、___罢",
    "meaning": "停止；免去",
    "semester": "G4B"
  },
  {
    "pinyin": "shuò",
    "word": "硕",
    "group": "硕___、___硕",
    "meaning": "大；学位名",
    "semester": "G4B"
  },
  {
    "pinyin": "yǔn",
    "word": "允",
    "group": "允___、___允",
    "meaning": "答应，许可",
    "semester": "G4B"
  },
  {
    "pinyin": "qì",
    "word": "砌",
    "group": "砌___、___砌",
    "meaning": "把砖石堆砌起来",
    "semester": "G4B"
  },
  {
    "pinyin": "pái",
    "word": "牌",
    "group": "牌___、___牌",
    "meaning": "用木板等做成的标志",
    "semester": "G4B"
  },
  {
    "pinyin": "jìn",
    "word": "禁",
    "group": "禁___、___禁",
    "meaning": "不许；法律或习俗的约束",
    "semester": "G4B"
  },
  {
    "pinyin": "chéng",
    "word": "惩",
    "group": "惩___、___惩",
    "meaning": "警戒；处罚",
    "semester": "G4B"
  },
  {
    "pinyin": "zōng",
    "word": "踪",
    "group": "踪___、___踪",
    "meaning": "脚印；行动留下的痕迹",
    "semester": "G4B"
  },
  {
    "pinyin": "xiào",
    "word": "啸",
    "group": "啸___、___啸",
    "meaning": "动物拉长声音叫",
    "semester": "G4B"
  },
  {
    "pinyin": "sī",
    "word": "私",
    "group": "私___、___私",
    "meaning": "属于个人的",
    "semester": "G4B"
  },
  {
    "pinyin": "jiá",
    "word": "颊",
    "group": "颊___、___颊",
    "meaning": "脸的两旁",
    "semester": "G4B"
  },
  {
    "pinyin": "chāi",
    "word": "拆",
    "group": "拆___、___拆",
    "meaning": "把合在一起的东西打开",
    "semester": "G4B"
  }
];
export const G4_CHARS_ALL: G4Char[] = [...G4A_CHARS, ...G4B_CHARS];
