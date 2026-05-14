/**
 * v0.32.22: drei Text wrapper — 默认关 depthTest 防遮挡 + game-feel 中文卡通字体。
 *
 * v0.32.39 (Ep16): 全局加 ZCOOL KuaiLe 中文卡通字体（Google Fonts 免费商用）
 * 替代系统 sans-serif，让 3D 文字立刻有"游戏感"。
 *
 * 字体文件：public/fonts/ZCOOLKuaiLe.ttf (1.5MB)，由 troika 一次性下载 SDF 转换。
 *
 * 用法：跟 drei <Text> 完全一样，import 替换即可。
 *   import { Text } from "./BillboardText";
 *
 * caller 传 material-depthTest / font 可显式覆盖默认值。
 */
import { Text as DreiText } from "@react-three/drei";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof DreiText>;

const WORLD_FONT = "/fonts/ZCOOLKuaiLe.ttf";

export function Text(props: Props) {
  return (
    <DreiText
      // 默认 props — caller 用 {...props} 之后可覆盖
      font={WORLD_FONT}
      material-depthTest={false}
      material-depthWrite={false}
      renderOrder={10}
      {...props}
    />
  );
}
