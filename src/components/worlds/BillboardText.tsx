/**
 * v0.32.22: drei Text wrapper — 默认关 depthTest，确保 3D 文字始终
 * 绘在前面，不被柜台/物体遮挡（Gemini Ep7 P0 issue: "Text occlusion 视觉硬伤"）。
 *
 * 用法：跟 drei <Text> 完全一样，import 替换即可。
 *   import { Text } from "./BillboardText";
 *
 * caller 传 material-depthTest 可显式覆盖默认 false。
 */
import { Text as DreiText } from "@react-three/drei";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof DreiText>;

export function Text(props: Props) {
  return (
    <DreiText
      // 默认 props — caller 用 {...props} 之后可覆盖
      material-depthTest={false}
      material-depthWrite={false}
      renderOrder={10}
      {...props}
    />
  );
}
