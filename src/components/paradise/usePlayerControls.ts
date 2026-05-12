/**
 * v0.31.113: WASD + touch joystick + camera-relative input。
 *
 * 桌面：WASD / 箭头键
 * 触屏：左下角虚拟摇杆（CSS overlay 接 touch event）
 *
 * 输出 cameraRelative input vector (X 左右，Z 前后)
 */

import { useEffect, useRef, useState } from "react";

export interface ControlState {
  inputX: number;
  inputZ: number;
  walking: boolean;
}

export function usePlayerControls() {
  const keysRef = useRef({ up: false, down: false, left: false, right: false });
  const joystickRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const [, force] = useState(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      let handled = true;
      if (k === "w" || k === "arrowup") keysRef.current.up = true;
      else if (k === "s" || k === "arrowdown") keysRef.current.down = true;
      else if (k === "a" || k === "arrowleft") keysRef.current.left = true;
      else if (k === "d" || k === "arrowright") keysRef.current.right = true;
      else handled = false;
      if (handled) e.preventDefault();
      force((x) => x + 1);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      let handled = true;
      if (k === "w" || k === "arrowup") keysRef.current.up = false;
      else if (k === "s" || k === "arrowdown") keysRef.current.down = false;
      else if (k === "a" || k === "arrowleft") keysRef.current.left = false;
      else if (k === "d" || k === "arrowright") keysRef.current.right = false;
      else handled = false;
      if (handled) e.preventDefault();
      force((x) => x + 1);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const setJoystick = (x: number, z: number) => {
    joystickRef.current = { x, z };
    force((v) => v + 1);
  };

  // 合并 keyboard + joystick
  const k = keysRef.current;
  const j = joystickRef.current;
  let inputX = (k.right ? 1 : 0) - (k.left ? 1 : 0);
  let inputZ = (k.up ? 1 : 0) - (k.down ? 1 : 0);
  if (Math.hypot(j.x, j.z) > 0.05) {
    inputX = j.x;
    inputZ = j.z;
  }
  // 走路 input 阈值
  const walking = Math.hypot(inputX, inputZ) > 0.08;
  // 注意：camera 在 player 后方 → 推 +Z（W 键）= 朝 camera 远端方向走 = world +Z
  // 但 player.atan2(inputX, inputZ) yaw 用的是 world 系，所以 input 就是 world XZ
  return {
    state: { inputX, inputZ, walking } satisfies ControlState,
    setJoystick,
  };
}
