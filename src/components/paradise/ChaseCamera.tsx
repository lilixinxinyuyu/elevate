/**
 * v0.31.113: 第三人称追逐 camera —— 始终在 player 身后 + 略上方
 * 平滑跟随 + 不抖动。
 */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { PlayerVRMHandle } from "./PlayerVRM";

interface ChaseCameraProps {
  playerRef: React.RefObject<PlayerVRMHandle | null>;
  /** camera 相对 player 后方距离 */
  distance?: number;
  /** camera 离地面高度 */
  height?: number;
  /** camera 平滑速度 */
  smoothness?: number;
  /** camera lookAt 高度（player 头部高度） */
  lookHeight?: number;
}

export function ChaseCamera({
  playerRef,
  distance = 10,
  height = 5,
  smoothness = 5,
  lookHeight = 1.2, // lookAt 略低让 camera tilt slightly down，4 portal 顶部进视野
}: ChaseCameraProps) {
  const { camera } = useThree();
  const lookAtRef = useRef(new THREE.Vector3());
  const targetPosRef = useRef(new THREE.Vector3());
  const initedRef = useRef(false);

  // 一次性 snap camera 到 player 后方初始位置（避免 lerp 期间 overhead view）
  useEffect(() => {
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const pos = p.getPosition();
      const yaw = p.getRotation();
      camera.position.set(
        pos.x + Math.sin(yaw) * distance,
        pos.y + height,
        pos.z + Math.cos(yaw) * distance,
      );
      camera.lookAt(pos.x, pos.y + lookHeight, pos.z);
      initedRef.current = true;
      window.clearInterval(id);
    }, 200);
    return () => window.clearInterval(id);
  }, [camera, playerRef, distance, height, lookHeight]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const p = playerRef.current;
    if (!p) return;
    const pos = p.getPosition();
    const yaw = p.getRotation();

    // camera 在 player 后方（player back direction）
    // VRM face -Z @ yaw=0，behind = +Z direction
    targetPosRef.current.set(
      pos.x + Math.sin(yaw) * distance,
      pos.y + height,
      pos.z + Math.cos(yaw) * distance,
    );
    // 已 snap 过初始位置后用 lerp 平滑跟随
    if (initedRef.current) {
      camera.position.lerp(targetPosRef.current, Math.min(1, smoothness * dt));
    } else {
      camera.position.copy(targetPosRef.current);
    }
    lookAtRef.current.set(pos.x, pos.y + lookHeight, pos.z);
    camera.lookAt(lookAtRef.current);
  });

  return null;
}
