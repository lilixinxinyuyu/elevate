/**
 * v0.32.3: 自定义 3D 拖拽组件 (R3F pointer events + raycast plane)。
 *
 * GPT-5.5 peer-review 建议：不用 drei `<DragControls>`，自己写 pointer 事件 +
 * raycast 投到柜台平面，iOS Safari 触屏最稳。
 *
 * 行为：
 *  - onPointerDown: stopPropagation + setPointerCapture, 进 dragging 态
 *  - onPointerMove: raycast 到 dragPlane (y = counterHeight) 更新位置
 *  - onPointerUp:
 *      - 落在 dropZones 之一 → onDrop(zoneId)
 *      - 否则 snap 回 origin
 *  - 拖动中视觉 lift (Y +0.1) + slight scale
 */

import { useEffect, useRef, useState } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Group } from "three";

interface DropZone {
  id: string;
  /** XZ center + radius (XY 半径) */
  x: number;
  z: number;
  radius: number;
}

interface DraggableObjectProps {
  children: React.ReactNode;
  /** 起始位置 (XZ) */
  origin: [number, number];
  /** 拖动平面 Y (默认 1.0 - 柜台表面) */
  planeY?: number;
  /** drop zones — 拖到这些 zone 触发 onDrop */
  dropZones?: DropZone[];
  /** 落入 zone 回调 */
  onDrop?: (zoneId: string) => void;
  /** 是否禁用拖动 (e.g. 已扫码后) */
  disabled?: boolean;
}

export function DraggableObject({
  children,
  origin,
  planeY = 1.0,
  dropZones = [],
  onDrop,
  disabled = false,
}: DraggableObjectProps) {
  const groupRef = useRef<Group>(null);
  const [dragging, setDragging] = useState(false);
  const { camera, gl } = useThree();
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY));
  const intersectionPoint = useRef(new THREE.Vector3());

  // 初始 position 应用
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(origin[0], planeY, origin[1]);
    }
  }, [origin, planeY]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (disabled) return;
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging || !groupRef.current) return;
    e.stopPropagation();
    // 用 e.ray (已 by R3F 计算好的 NDC raycaster) 与拖动平面相交
    const ray = e.ray as THREE.Ray;
    const hit = ray.intersectPlane(dragPlane.current, intersectionPoint.current);
    if (hit) {
      groupRef.current.position.x = intersectionPoint.current.x;
      groupRef.current.position.z = intersectionPoint.current.z;
      groupRef.current.position.y = planeY + 0.15; // 拖动时上抬
    }
    void camera;
    void gl;
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging || !groupRef.current) return;
    e.stopPropagation();
    setDragging(false);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    // 检查落入哪个 zone
    const px = groupRef.current.position.x;
    const pz = groupRef.current.position.z;
    let dropped: DropZone | null = null;
    for (const z of dropZones) {
      const dx = px - z.x;
      const dz = pz - z.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < z.radius) {
        dropped = z;
        break;
      }
    }
    if (dropped && onDrop) {
      onDrop(dropped.id);
    } else {
      // snap 回 origin
      groupRef.current.position.set(origin[0], planeY, origin[1]);
    }
  };

  return (
    <group
      ref={groupRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      scale={dragging ? 1.15 : 1.0}
    >
      {children}
    </group>
  );
}
