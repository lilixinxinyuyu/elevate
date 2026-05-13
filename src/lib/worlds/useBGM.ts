/**
 * v0.32.21: 在 worlds page mount 时启动主题 BGM，unmount 时停。
 *
 * 用法：
 *   useBGM("store");
 *
 * 注：第一次启动需要 user gesture（点击 intro 按钮等），iOS Safari 限制。
 * BGM 内部已 hook visibilitychange，切后台自动 suspend。
 */
import { useEffect } from "react";
import { BGM_THEMES, startBgm, stopBgm } from "./bgm";

export type BgmThemeKey = keyof typeof BGM_THEMES;

export function useBgm(themeKey: BgmThemeKey | null): void {
  useEffect(() => {
    if (!themeKey) {
      stopBgm();
      return;
    }
    const theme = BGM_THEMES[themeKey];
    if (theme) startBgm(theme);
    return () => {
      stopBgm();
    };
  }, [themeKey]);
}
