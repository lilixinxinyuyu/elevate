/**
 * v0.31.122: paradise 真素材底座 —— town-3 (Synty-style low-poly 村庄)。
 *
 * 资产: public/env/town-3/
 *   - model_0.obj (14.5 MB) + model_1.obj (9.9 MB) — 单 mesh 全村庄
 *   - Main_Pallete.png (94 KB) — color atlas，UV 自动对齐
 *   - Main_Pallete_Emmision.png / _Reflection.png — 可选加分项
 *
 * 总 raw 24 MB / gzipped wire ~3 MB（CF 自动 gzip text-based .obj）
 *
 * 选型：peer-review 双投票（Gemini-3-Pro + GPT-5.5）一致认为 town-3 RPG village 感
 * 最契合 Ring Fit Adventure 风格 + 适合 paradise "知识乐园 hub" 定位。
 * town-pack-2 是备选（更轻 + Panda 主题，跟红熊猫副手呼应，但是单体角色不是村庄）。
 *
 * 实现要点：
 *  - 无 .mtl，atlas 手动绑定到所有 mesh
 *  - texture.colorSpace = SRGBColorSpace (Gemini 强调，否则颜色洗白)
 *  - generateMipmaps = false + LinearFilter (GPT-5.5: 调色板 atlas 避免 mip bleeding)
 *  - 自动 bbox normalize：缩放到 TARGET_DIAMETER 单位，y=0 贴地，xz 居中
 *  - castShadow off (mobile perf) / receiveShadow off (避免阴影自相 clip)
 */

import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import * as THREE from "three";

const OBJ_URLS = [
  "/env/town-3/model_0.obj",
  "/env/town-3/model_1.obj",
];
const ATLAS_URL = "/env/town-3/Main_Pallete.png";

/** 目标村庄直径（world units）— 4 个 portal 围在外圈，留 8 单位空隙 */
const TARGET_DIAMETER = 32;

interface ParadiseTownProps {
  /** 是否朝俯视相机翻转（如果素材是 Y-up 就 false，Z-up 就 true） */
  flipZUp?: boolean;
}

export function ParadiseTown({ flipZUp = false }: ParadiseTownProps) {
  const objs = useLoader(OBJLoader, OBJ_URLS) as THREE.Group[];
  const atlas = useLoader(THREE.TextureLoader, ATLAS_URL);

  // 一次性配置 atlas + material + auto-normalize root group
  const root = useMemo(() => {
    // ===== Atlas 配置 =====
    atlas.colorSpace = THREE.SRGBColorSpace; // 关键：不设会洗白
    atlas.generateMipmaps = false; // 调色板 atlas 避免 mip 颜色渗透
    atlas.minFilter = THREE.LinearFilter;
    atlas.magFilter = THREE.LinearFilter;
    atlas.wrapS = THREE.ClampToEdgeWrapping;
    atlas.wrapT = THREE.ClampToEdgeWrapping;
    atlas.needsUpdate = true;

    // ===== 共享 material =====
    const mat = new THREE.MeshStandardMaterial({
      map: atlas,
      roughness: 0.92,
      metalness: 0,
      side: THREE.FrontSide,
    });

    // ===== 装配 group =====
    const g = new THREE.Group();
    g.name = "paradise-town-3";
    if (flipZUp) g.rotation.x = -Math.PI / 2;

    for (const src of objs) {
      // 不 clone — useLoader 缓存且 ParadiseTown 只在 paradise 出现一次
      src.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (!mesh.geometry.attributes.normal) {
            mesh.geometry.computeVertexNormals();
          }
          mesh.material = mat;
          mesh.castShadow = false;
          mesh.receiveShadow = false; // 关 — paradise 没 shadow casters
          mesh.frustumCulled = true;
        }
      });
      g.add(src);
    }

    // ===== Auto-normalize: scale to TARGET_DIAMETER + center XZ + bottom on Y=0 =====
    const bbox = new THREE.Box3().setFromObject(g);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const diameter = Math.max(size.x, size.z);
    const scale = diameter > 0.001 ? TARGET_DIAMETER / diameter : 1;
    g.scale.setScalar(scale);

    // 重算 scaled bbox
    bbox.setFromObject(g);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    g.position.set(-center.x, -bbox.min.y, -center.z);

    return g;
  }, [objs, atlas, flipZUp]);

  return <primitive object={root} />;
}
