/**
 * 小进基础形象的 5 种风格候选 — 跨用户对比挑选用。
 *
 * 每种风格灵感都是网上经典/流行的熊猫吉祥物，目的是让 Selena 在多个方向里
 * 看到、感受、最终决定基础形象走哪个方向。一旦选定一个，以后所有 wardrobe
 * 衣装生成都会以那个风格作为前缀。
 *
 * 共同硬约束（不管走哪个风格都必须遵守）：
 *  - 女性熊猫
 *  - 居中正面胸像 / 头像
 *  - 512×512 干净背景
 *  - 不出现文字 / 数字 / 水印
 *
 * 风格之间的 unique selling point：
 *  A 玩偶照（plushie photo）：商业玩具摄影感，立体光影 + 缝线，最"真实"
 *  B 极简春植风（Choonsik 韩国 IP）：候温暖治愈，超少细节，单色 pastel
 *  C 圆胖 Pusheen-panda：肥嘟嘟球形，dot 眼睛，扁平插画
 *  D Tare Panda 慵懒：日式极简 kawaii，黑白只一两个细节
 *  E Anime chibi 萌系：少女 sparkle，大眼睛 + 装饰 + 高饱和度
 */

export interface MascotStyleVariant {
  id: string;
  name: string;
  /** 给爸妈看的中文一句话描述 */
  tagline: string;
  /** 灵感参考 */
  inspiration: string;
  /** 完整生成 prompt */
  prompt: string;
}

const SHARED_CONSTRAINTS = [
  "正面胸像，居中、对称",
  "512×512 正方形构图",
  "干净纯色或柔光渐变背景",
  "禁止出现：任何文字、字母、数字、签名、水印、其他角色",
  "主体是一只可爱的女性熊猫吉祥物",
  "最终图作为 UI 头像使用，圆形遮罩裁剪",
].join("，");

export const MASCOT_STYLE_VARIANTS: MascotStyleVariant[] = [
  {
    id: "plushie",
    name: "毛绒玩偶 Plushie",
    tagline: `像商场货架上真实的毛绒玩具，最有"想抱回家"感`,
    inspiration: "Jellycat 玩偶 / Build-A-Bear 商业摄影",
    prompt: [
      "一只可爱的女性熊猫毛绒玩偶（cute female panda plushie / stuffed animal），",
      "**真实毛绒玩具质感**：明显绒毛纹理、立体光影、缝线细节、高光反光，",
      "像玩具柜里真实的毛绒玩具，3D 渲染般立体感；",
      "chibi 圆润比例（大头小身约 1:1.1），胖胖肉乎乎、圆滚滚的体型；",
      "标志熊猫特征：胖圆脸、椭圆黑眼圈、毛茸茸圆耳朵、白脸白肚黑手脚；",
      "女性化：长睫毛、小巧粉嫩鼻头、淡腮红，温暖友善微笑，眼神亮晶晶；",
      "头戴小巧紫色学士帽，胸前抱紫色魔法书；",
      "深紫罗兰到淡粉色柔光渐变背景；",
      "商业级毛绒玩偶官方摄影风格，光线柔和均匀；",
      "色彩鲜明、童真可爱、温暖治愈。",
      SHARED_CONSTRAINTS,
    ].join(" "),
  },
  {
    id: "choonsik",
    name: "极简春植 Choonsik",
    tagline: "韩国 Kakao 春植同风，超简洁治愈，胖嘟嘟一个圆",
    inspiration: "Kakao Friends Choonsik (춘식이) / Apeach",
    prompt: [
      "一只极简风格的可爱女性熊猫吉祥物，",
      "灵感：韩国 Kakao Friends Choonsik 春植风格，但角色是熊猫；",
      "**超简洁线条**：很少装饰，胖胖圆圆软软的轮廓最重要；",
      "几乎是一团圆圆的白色身体加两个圆形黑耳朵 + 黑眼圈；",
      "黑色简单的 dot 眼睛配上小小弯弯笑容；",
      "圆滚滚 blob 身体几乎没有四肢，胖嘟嘟的小手趴在身前；",
      "头顶一个粉色小蝴蝶结作为唯一装饰；",
      "candy pastel 配色：奶白、淡粉、淡黄；",
      "温暖治愈、minimal kawaii、舒服简单的风格；",
      "纯色淡奶油色背景，不要复杂细节；",
      "扁平有质感的简笔插画风格，几何形状清晰，留白充足。",
      SHARED_CONSTRAINTS,
    ].join(" "),
  },
  {
    id: "pusheen",
    name: "圆胖球 Pusheen-panda",
    tagline: "胖到溢出来的球形熊猫，扁平插画，dot 眼可爱到爆",
    inspiration: "Pusheen the Cat 同款扁平 chibi",
    prompt: [
      "一只 Pusheen 风格的胖嘟嘟女性熊猫，",
      "**身体几乎是个球**：又圆又胖，软乎乎像一个白色团子加上熊猫纹路；",
      "标志特征：黑耳朵在头顶两侧、椭圆黑眼圈、白脸白肚黑手脚；",
      "**dot 眼睛**：两个简单的小黑点配略弯的微笑嘴；",
      "横向线条简单条纹纹理表示绒毛感（Pusheen 的招牌 feature）；",
      "短小四肢若隐若现地藏在圆胖身体下面；",
      "头顶一朵粉色樱花或一个小蝴蝶结；",
      "扁平插画风格，但有柔光阴影体现立体感；",
      "粉嫩 pastel 配色，舒适温暖的氛围；",
      "正面 3/4 胖胖的姿势，可爱到让人想 squeeze；",
      "纯色淡薰衣草背景。",
      SHARED_CONSTRAINTS,
    ].join(" "),
  },
  {
    id: "tare",
    name: "慵懒 Tare Panda",
    tagline: "日式 kawaii 极简，黑白配色，懒洋洋少女味",
    inspiration: "たれぱんだ (Tare Panda) / 鸡蛋君",
    prompt: [
      "一只 Tare Panda 风格的女性熊猫吉祥物，",
      "**日式 kawaii 极简风**：超简单的线条，少即是多；",
      "圆圆的白色头大于身体，懒洋洋的姿势（像在打瞌睡或刚醒来）；",
      "标志的黑耳朵 + 椭圆黑眼圈，但比例精炼；",
      "极简的笑眯眯小眼睛（像两个倒 U），温柔的小弧线嘴；",
      "白色软乎乎身体，一点黑色尖尖手脚；",
      "唯一装饰：耳朵上别一朵小粉花或粉色小蝴蝶结，作为女性化标识；",
      "纯色奶白或淡米色背景，几乎没有阴影；",
      "黑白主调 + 一点点粉色 accent；",
      "简单的日式平面插画风格，干净利落、温柔治愈；",
      "构图大量留白，画面呼吸感强。",
      SHARED_CONSTRAINTS,
    ].join(" "),
  },
  {
    id: "anime",
    name: "Anime 萌系少女",
    tagline: "二次元少女向，大眼睛闪亮，饱和度高，装饰丰富",
    inspiration: "Sanrio 萌系 / 原神 chibi 风",
    prompt: [
      "一只 Anime chibi 风格的女性熊猫女孩吉祥物，",
      "**少女系萌系风**：大大闪亮的眼睛、长睫毛、夸张可爱比例；",
      "chibi 比例（大头小身 1:1），圆润但有手有脚有姿态；",
      "熊猫特征明确：黑耳朵、椭圆黑眼圈、白脸白肚；",
      "**眼睛是亮点**：超大的圆眼睛带星形高光、紫色虹膜、长睫毛；",
      "可爱小嘴：微笑或抿嘴，配粉嫩腮红；",
      "头顶戴一个粉色蝴蝶结发饰，胸前抱一本紫色魔法书；",
      "穿一件粉色系学院风装饰物（领结、颈饰）；",
      "饱和度高的色彩：粉色、紫色、薰衣草、金色高光；",
      "高质量 anime 插画风格，柔光内发光，少女系闪亮 sparkle 元素；",
      "少量数学符号 ✨ 装饰飘浮在背景；",
      "深紫罗兰柔光背景。",
      SHARED_CONSTRAINTS,
    ].join(" "),
  },
];
