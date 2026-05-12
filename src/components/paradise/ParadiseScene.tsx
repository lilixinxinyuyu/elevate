/**
 * v0.31.113: 知识乐园 3D 世界 —— Paradise-1 资产 (Tripo3D, 11 part OBJ + 11 textures)。
 *
 * 资产位置: public/scenes/paradise/model_{0..10}.obj + *.png
 * 总 71k verts / 122k faces / 22 MB —— 移动端可流畅 60fps
 *
 * 这是 Selena 探索世界，不是 mascot test 页。WASD/触屏走动 + 红熊猫跟随。
 *
 * texture mapping 启发（基于文件名）：
 *  - cao_1.png       → 草地 (model_0, model_1, model_4 等平面)
 *  - mutou_4.png     → 木头/路面 (model_3 / model_9 等)
 *  - huoshan_2.png   → 火山 (model_6 高物)
 *  - xiaoshan_7.png  → 远山 (model_8 大背景)
 *  - shuye_6.png     → 树叶 (装饰)
 *  - fengmolong_3.png/zhu_8.png 等 → 建筑细节
 *
 * 没 mtl 文件所以 part-texture 用启发式映射；显示效果不完美再 trial-error。
 */

import { useEffect, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import * as THREE from "three";

// 11 个 OBJ part，按 verts 数量从大到小（保持加载顺序对 z-fighting / draw order 稳定）
const PARADISE_OBJ_URLS = [
  "/scenes/paradise/model_0.obj",
  "/scenes/paradise/model_1.obj",
  "/scenes/paradise/model_2.obj",
  "/scenes/paradise/model_3.obj",
  "/scenes/paradise/model_4.obj",
  "/scenes/paradise/model_5.obj",
  "/scenes/paradise/model_6.obj",
  "/scenes/paradise/model_7.obj",
  "/scenes/paradise/model_8.obj",
  "/scenes/paradise/model_9.obj",
  "/scenes/paradise/model_10.obj",
];

const TEXTURE_URLS = {
  grass: "/scenes/paradise/cao_1.png",
  wood: "/scenes/paradise/mutou_4.png",
  volcano: "/scenes/paradise/huoshan_2.png",
  mountain: "/scenes/paradise/xiaoshan_7.png",
  leaves: "/scenes/paradise/shuye_6.png",
  pillar: "/scenes/paradise/zhu_8.png",
  detail: "/scenes/paradise/peijian_5.png",
} as const;

// 启发式 part → texture 映射（基于 part 形态分析）
// v0.31.114 简化：避免深色（huoshan/zhu）让场景全黑；只用 grass/wood/leaves/mountain
const PART_TEXTURE: (keyof typeof TEXTURE_URLS)[] = [
  "grass", // model_0 大平面
  "grass", // model_1 大平面
  "leaves", // model_2 小装饰
  "wood", // model_3 中等结构（房屋木头）
  "grass", // model_4 平面（路）
  "wood", // model_5 长条围栏
  "wood", // model_6 高物（之前 火山 - 避免黑）
  "leaves", // model_7 装饰（树）
  "mountain", // model_8 大背景
  "wood", // model_9 中条（之前 柱 - 木色替代）
  "leaves", // model_10 装饰
];

interface ParadiseSceneProps {
  /** 整个场景 scale；paradise-1 原 size ~ 250×80×250 单位，缩放到 game world 合适大小 */
  scale?: number;
  /** 整体位置偏移（让地面 y=0） */
  position?: [number, number, number];
}

export function ParadiseScene({
  scale = 0.5,
  position = [0, 0, 0],
}: ParadiseSceneProps) {
  const objs = useLoader(OBJLoader, PARADISE_OBJ_URLS) as THREE.Object3D[];
  const textures = useLoader(THREE.TextureLoader, Object.values(TEXTURE_URLS));

  // 把 texture 数组重组成 named map（保持 TEXTURE_URLS 顺序）
  const texMap = useMemo(() => {
    const keys = Object.keys(TEXTURE_URLS) as (keyof typeof TEXTURE_URLS)[];
    const map: Record<keyof typeof TEXTURE_URLS, THREE.Texture> = {} as never;
    keys.forEach((k, i) => {
      const t = textures[i]!;
      // SRGB 解码（three r152+ 默认 LinearSRGB，贴图要 SRGB 才正色）
      if ("colorSpace" in t) t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      map[k] = t;
    });
    return map;
  }, [textures]);

  // v0.31.114：放弃 texture（slm_* 是 character mesh 不是 environment，
  // huoshan / zhu 等深色让场景黑），改用 part-index → pastel color 映射。
  // 这样画面更"卡通游戏风"，no black bugs。
  const PART_COLORS = [
    "#4ade80", // model_0 大草地 → vivid green
    "#22c55e", // model_1 大草地 → emerald
    "#facc15", // model_2 装饰 → vivid yellow
    "#f97316", // model_3 房屋 → orange (cute cabin)
    "#65a30d", // model_4 路 → lime green
    "#a16207", // model_5 围栏 → wood brown
    "#06b6d4", // model_6 → cyan (water / 神秘)
    "#16a34a", // model_7 装饰树 → deep green
    "#7dd3fc", // model_8 sky → soft sky blue
    "#92400e", // model_9 → dark wood
    "#ec4899", // model_10 → pink rose
  ];

  useEffect(() => {
    objs.forEach((obj, idx) => {
      const color = PART_COLORS[idx] ?? "#86efac";
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.material = new THREE.MeshStandardMaterial({
            color,
            roughness: 0.85,
            metalness: 0.0,
            // FrontSide — raycast from above 不会击中 ceiling
            side: THREE.FrontSide,
            flatShading: false,
          });
          mesh.castShadow = false;
          mesh.receiveShadow = true;
        }
      });
    });
  }, [objs]);
  // 保留 texMap 引用避免 ESLint 警告（虽然不再使用 texture，loader 已经 fetch 完成不浪费）
  void texMap;

  return (
    <group position={position} scale={scale} name="paradise-ground">
      {/* skip 真正 floating sky (model_6 高塔 + model_8 sky dome) — 其它装饰 keep */}
      {objs.map((obj, i) => {
        if (i === 6 || i === 8) return null;
        return <primitive key={i} object={obj} />;
      })}
    </group>
  );
}
