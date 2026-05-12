/**
 * v0.31.113: 红熊猫小番作为 follower —— 跟在 Selena 屁股后面跑。
 *
 * 跟之前"死死悬空"的副手区别：
 *  - 用 player 实时位置做目标，lerp 平滑跟随（保持 1.5 单位距离 + 偏右 0.6 单位）
 *  - 跟随时 walking animation：整体上下 bouncing + tilt
 *  - 朝向跟着 player 方向（不会卡僵）
 *
 * 红熊猫 OBJ 是 Tripo3D Blender Z-up export，需要 [-PI/2, 0, 0] 让 Y up。
 * texture 应用是 Tex_RedPanda.png（橙色毛色）。
 */

import { useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import * as THREE from "three";
import type { Group, Object3D } from "three";
import type { PlayerVRMHandle } from "./PlayerVRM";

const RED_PANDA_URLS = [
  "/avatars/red-panda/model_0.obj",
  "/avatars/red-panda/model_1.obj",
  "/avatars/red-panda/model_2.obj",
  "/avatars/red-panda/model_3.obj",
  "/avatars/red-panda/model_4.obj",
  "/avatars/red-panda/model_5.obj",
  "/avatars/red-panda/model_6.obj",
  "/avatars/red-panda/model_7.obj",
];

interface RedPandaFollowerProps {
  /** player ref — 用来拿位置 + 朝向，做 follow */
  playerRef: React.RefObject<PlayerVRMHandle | null>;
  /** 跟在后面距离 */
  distanceBehind?: number;
  /** 跟随平滑速度（lerp t） */
  followSmoothness?: number;
  /** 是否在 walking（外部传 — 跟 player 走路状态联动） */
  walking: boolean;
}

export function RedPandaFollower({
  playerRef,
  distanceBehind = 1.4,
  followSmoothness = 4,
  walking,
}: RedPandaFollowerProps) {
  const groupRef = useRef<Group>(null);
  const objs = useLoader(OBJLoader, RED_PANDA_URLS) as Object3D[];
  const texture = useLoader(THREE.TextureLoader, "/avatars/red-panda/texture.png");
  const targetPos = useRef(new THREE.Vector3());
  const targetYaw = useRef(0);

  // 配置 texture + 算 bbox 用于 normalize
  const { recenter, normalizeScale } = useMemo(() => {
    if ("colorSpace" in texture) {
      (texture as THREE.Texture).colorSpace = THREE.SRGBColorSpace;
    }
    const box = new THREE.Box3();
    let inited = false;
    objs.forEach((obj) => {
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.78,
            metalness: 0.0,
          });
          mesh.geometry.computeBoundingBox();
          const meshBox = mesh.geometry.boundingBox;
          if (meshBox) {
            if (!inited) {
              box.copy(meshBox);
              inited = true;
            } else {
              box.union(meshBox);
            }
          }
        }
      });
    });
    if (!inited) {
      return { recenter: new THREE.Vector3(0, 0, 0), normalizeScale: 1 };
    }
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    // 目标 size 0.5（中等小宠物大小，跟 Selena 1.5m 比合理）
    const maxDim = Math.max(size.x, size.y, size.z);
    const ns = maxDim > 0 ? 0.5 / maxDim : 1;
    return { recenter: center.multiplyScalar(-1), normalizeScale: ns };
  }, [objs, texture]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const dt = Math.min(delta, 0.05);
    const t = state.clock.getElapsedTime();
    const playerHandle = playerRef.current;
    if (!playerHandle) return;
    const pPos = playerHandle.getPosition();
    const pYaw = playerHandle.getRotation();

    // 红熊猫站在 player 右前方（让 camera 在背后能看到）
    // VRM face -Z @ yaw=0 → forward = -Z direction
    // Player local axes: forward = -Z, right = +X
    // Red panda at player local (right=+0.8, forward=-0.6)
    // world: (sin(yaw)*forward + cos(yaw)*right, _, cos(yaw)*forward - sin(yaw)*right) — complex.
    // 实际：用 player local space (right, forward) → world
    // forward direction in world = (sin(yaw - PI/2)*... wait, just use rotation matrix)
    // forward (world) = (-sin(pYaw + PI), cos(pYaw + PI))? Let me simplify:
    //   yaw=0: player face -Z; "right" of player (player's right hand) = world +X
    //   yaw=PI/2: player face +X; "right" = world +Z (clockwise rotation)
    // right_world = (cos(yaw), -sin(yaw))，forward_world = (-sin(yaw), -cos(yaw))
    const rightX = Math.cos(pYaw);
    const rightZ = -Math.sin(pYaw);
    const forwardX = -Math.sin(pYaw);
    const forwardZ = -Math.cos(pYaw);
    const localRight = 0.9;
    const localForward = -0.4; // 略前 (more visible from camera behind)
    targetPos.current.set(
      pPos.x + rightX * localRight + forwardX * localForward,
      pPos.y,
      pPos.z + rightZ * localRight + forwardZ * localForward,
    );

    // lerp 平滑跟随
    const t_ = Math.min(1, followSmoothness * dt);
    groupRef.current.position.lerp(targetPos.current, t_);

    // 朝向跟 player 同向（朝 walking direction 而非 face camera）
    // walking 时朝 player 方向，idle 时也跟 player 同向 = 一起站着
    targetYaw.current = pYaw;
    const dy = wrapAngle(targetYaw.current - groupRef.current.rotation.y);
    groupRef.current.rotation.y += dy * Math.min(1, followSmoothness * dt);

    // walking 时上下 bouncing（小跑节奏）+ idle 时呼吸 bobbing
    const bob = walking
      ? Math.abs(Math.sin(t * 8)) * 0.08
      : Math.sin(t * 1.4) * 0.025;
    // red panda 高 0.5，center 在 group origin，脚要在地面 (y=0) → y = 0.25 + bob
    groupRef.current.position.y = 0.25 + bob;
  });

  return (
    <group ref={groupRef}>
      {/* OBJ Z-up 翻 X -90° → +Y up. 朝向跟随 player yaw (外层 groupRef rotation) */}
      <group scale={normalizeScale} rotation={[-Math.PI / 2, 0, 0]}>
        <group position={[recenter.x, recenter.y, recenter.z]}>
          {objs.map((obj, i) => (
            <primitive key={i} object={obj} />
          ))}
        </group>
      </group>
    </group>
  );
}

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
