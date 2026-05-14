/**
 * v0.32.22: drei Text wrapper — 默认关 depthTest 防遮挡。
 *
 * v0.32.39 试用 ZCOOL KuaiLe 字体导致 R3F 渲染挂起（截图实测 3D 场景全空）。
 * v0.32.40 rollback 字体，仅保留 depthTest=false 防遮挡。
 *
 * 用法：跟 drei <Text> 完全一样，import 替换即可。
 */
import { Text as DreiText } from "@react-three/drei";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof DreiText>;

export function Text(props: Props) {
  return (
    <DreiText
      material-depthTest={false}
      material-depthWrite={false}
      renderOrder={10}
      {...props}
    />
  );
}
