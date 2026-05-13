/**
 * v0.31.113: Selena VRM 可控角色 —— 知识乐园里的玩家。
 *
 * 跟 Mascot3D 区别：
 *  - 可控移动（WASD / 触屏摇杆）
 *  - 自动朝向移动方向
 *  - 走路时摆臂动画（VRM humanoid bones procedural）
 *  - 不做 gesture 系统（idle / walk 两个状态）
 *
 * Mascot3D 的 VRM 加载 + viseme + skin accessory 这边不需要——这是 game 角色不是
 * "对话头像"，所以简化。
 *
 * 外部通过 ref 拿 world position（红熊猫 follower / camera follow 用）。
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import * as THREE from "three";
import type { Group } from "three";

const DEFAULT_VRM = "/avatars/xiaojin.vrm";

/** 玩家移动配置 */
export interface PlayerControls {
  /** 当前 input vector，跟 camera-relative XY (左右 +x，前 +z) */
  inputX: number;
  inputZ: number;
  /** 是否在走（决定动画） */
  walking: boolean;
}

interface PlayerVRMProps {
  /** 初始位置 */
  initialPosition?: [number, number, number];
  /** 初始朝向 yaw（弧度，默认 0 = 默认 VRM forward -Z）。
   * 老师精灵在 paradise 中心面向 +Z（朝俯视相机抬头）时传 Math.PI */
  initialYaw?: number;
  /** input vector (call-by-ref / parent state) */
  controls: PlayerControls;
  /** 移动速度（单位/秒） */
  speed?: number;
  /** 转身平滑速度 */
  turnSpeed?: number;
  /** 角色 scale (相对世界单位 — paradise scale 0.5 + Selena 1.5m 实际世界占 0.75m，game-fit) */
  scale?: number;
}

export interface PlayerVRMHandle {
  /** 拿当前 world position（红熊猫 + camera 用） */
  getPosition: () => THREE.Vector3;
  /** 拿当前朝向（弧度） */
  getRotation: () => number;
}

export const PlayerVRM = forwardRef<PlayerVRMHandle, PlayerVRMProps>(function PlayerVRM(
  {
    initialPosition = [0, 0, 0],
    initialYaw = 0,
    controls,
    speed = 4.5,
    turnSpeed = 9,
    scale = 1,
  },
  ref,
) {
  const groupRef = useRef<Group>(null);
  const [vrm, setVrm] = useState<VRM | null>(null);
  const targetYawRef = useRef(initialYaw);
  const currentYawRef = useRef(initialYaw);
  // walking animation phase
  const walkPhaseRef = useRef(0);

  useImperativeHandle(ref, () => ({
    getPosition: () => {
      if (groupRef.current) return groupRef.current.position.clone();
      return new THREE.Vector3();
    },
    getRotation: () => currentYawRef.current,
  }));

  // VRM 加载（一次）
  useEffect(() => {
    let cancelled = false;
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader.load(
      DEFAULT_VRM,
      (gltf) => {
        if (cancelled) return;
        const v = gltf.userData.vrm as VRM | undefined;
        if (!v) return;
        // 性能优化：去掉看不到的 vertex（mocap rig 内部不用 BG）
        VRMUtils.removeUnnecessaryVertices(gltf.scene);
        VRMUtils.combineSkeletons(gltf.scene);
        // VRM 默认朝 -Z (three.js convention)，保留默认 — chase camera 在 player +Z 方向，
        // 看 -Z 看到 player 背面 = 正常第三人称
        setVrm(v);
      },
      undefined,
      (err) => {
        console.warn("[PlayerVRM] failed to load VRM:", err);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // 初始 position 应用（只在 mount 时设一次，避免 parent 每次 re-render
  // 都 reset player position 把 WASD 移动抵消掉）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(...initialPosition);
    }
  }, []);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.05); // clamp 防卡顿后大 step
    const t = state.clock.getElapsedTime();

    const { inputX, inputZ, walking } = controls;
    const inputMag = Math.hypot(inputX, inputZ);

    // 移动
    // VRM 默认 forward = -Z (three.js convention)。W 按下 → inputZ=+1 语义"前进"
    // → 实际世界方向 = -Z。在这里转换 input → world direction。
    if (inputMag > 0.05) {
      const nx = inputX / inputMag;
      const nz = inputZ / inputMag;
      const moveX = nx;
      const moveZ = -nz; // W (inputZ=+1) → move -Z forward
      groupRef.current.position.x += moveX * speed * dt * Math.min(1, inputMag);
      groupRef.current.position.z += moveZ * speed * dt * Math.min(1, inputMag);
      // 朝向：让 character 的 -Z 朝向 (moveX, moveZ)
      // rotation.y = atan2(moveX, -moveZ) = atan2(nx, nz)
      targetYawRef.current = Math.atan2(nx, nz);
    }

    // 平滑转身
    const dyaw = wrapAngle(targetYawRef.current - currentYawRef.current);
    currentYawRef.current += dyaw * Math.min(1, turnSpeed * dt);
    groupRef.current.rotation.y = currentYawRef.current;

    // v0.31.115: 不做 ground following (paradise 不是简单平面，raycast 会跳到上方 mesh)
    // Selena 走在 y=0 平面，paradise 当 scenery backdrop
    groupRef.current.position.y = 0;

    // VRM 更新 + 走路动画
    if (vrm) {
      vrm.update(dt);
      animateVrm(vrm, { walking, t, walkPhase: walkPhaseRef });
      if (walking) walkPhaseRef.current += dt * 6; // 走路节奏 ~1 Hz
    }
  });

  return (
    <group ref={groupRef} position={initialPosition} scale={scale}>
      {vrm ? <primitive object={vrm.scene} /> : (
        // VRM 加载中显示一个占位 cylinder
        <mesh position={[0, 0.75, 0]}>
          <cylinderGeometry args={[0.25, 0.3, 1.5, 16]} />
          <meshStandardMaterial color="#a78bfa" roughness={0.6} />
        </mesh>
      )}
    </group>
  );
});

/** wrap [-π, π] */
function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * 极简 procedural walking animation：
 *  - 走路：双臂前后摆 + 双腿前后步 + 小幅 root bob + 头微点
 *  - idle：胸腔呼吸 + 头微晃 (跟 Mascot3D idle 相似但更简)
 */
function animateVrm(
  vrm: VRM,
  state: {
    walking: boolean;
    t: number;
    walkPhase: React.MutableRefObject<number>;
  },
) {
  const h = vrm.humanoid;
  if (!h) return;
  const phase = state.walkPhase.current;
  const t = state.t;

  // ===== idle base：呼吸 + 微晃 =====
  const chest = h.getNormalizedBoneNode("chest");
  if (chest) {
    chest.scale.setScalar(1 + Math.sin(t * 1.3) * 0.012);
  }
  const head = h.getNormalizedBoneNode("head");
  if (head) {
    head.rotation.x = Math.sin(t * 0.6) * 0.04;
    head.rotation.y = Math.sin(t * 0.45) * 0.06;
    head.rotation.z = 0;
  }

  // ===== walking 双腿 + 双臂摆 =====
  const lUpper = h.getNormalizedBoneNode("leftUpperArm");
  const rUpper = h.getNormalizedBoneNode("rightUpperArm");
  const lLower = h.getNormalizedBoneNode("leftLowerArm");
  const rLower = h.getNormalizedBoneNode("rightLowerArm");
  const lUpLeg = h.getNormalizedBoneNode("leftUpperLeg");
  const rUpLeg = h.getNormalizedBoneNode("rightUpperLeg");
  const lLowLeg = h.getNormalizedBoneNode("leftLowerLeg");
  const rLowLeg = h.getNormalizedBoneNode("rightLowerLeg");

  if (state.walking) {
    const armSwing = Math.sin(phase) * 0.7; // 大约 40° max
    const legSwing = Math.sin(phase) * 0.5; // 大约 28° max
    // 上臂前后摆（轴 X = pitch）
    if (lUpper) {
      lUpper.rotation.x = armSwing;
      lUpper.rotation.z = THREE.MathUtils.degToRad(72); // 维持自然下垂
    }
    if (rUpper) {
      rUpper.rotation.x = -armSwing;
      rUpper.rotation.z = THREE.MathUtils.degToRad(-72);
    }
    // 前臂略弯（走路时手臂不直）
    if (lLower) lLower.rotation.y = THREE.MathUtils.degToRad(-15);
    if (rLower) rLower.rotation.y = THREE.MathUtils.degToRad(15);
    // 腿前后摆（反相 — 左手右脚 / 右手左脚）
    if (lUpLeg) lUpLeg.rotation.x = -legSwing;
    if (rUpLeg) rUpLeg.rotation.x = legSwing;
    // 小腿弯（摆到后面时小腿不弯）
    if (lLowLeg)
      lLowLeg.rotation.x = Math.max(0, -Math.sin(phase + 1) * 0.6);
    if (rLowLeg)
      rLowLeg.rotation.x = Math.max(0, Math.sin(phase + 1) * 0.6);
  } else {
    // idle：把走路的 pose 平滑归零
    if (lUpper) {
      lUpper.rotation.x = 0;
      lUpper.rotation.z = THREE.MathUtils.degToRad(72);
    }
    if (rUpper) {
      rUpper.rotation.x = 0;
      rUpper.rotation.z = THREE.MathUtils.degToRad(-72);
    }
    if (lLower) lLower.rotation.y = 0;
    if (rLower) rLower.rotation.y = 0;
    if (lUpLeg) lUpLeg.rotation.x = 0;
    if (rUpLeg) rUpLeg.rotation.x = 0;
    if (lLowLeg) lLowLeg.rotation.x = 0;
    if (rLowLeg) rLowLeg.rotation.x = 0;
  }
}
