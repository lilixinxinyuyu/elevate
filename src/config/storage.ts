/**
 * v0.35.44 Refactor Priority 11 (peer review #3 deferred): cross-file localStorage SSOT.
 *
 * 痛点: 几个 LS key 在多个文件里以裸字符串重复. 改 key 名 / 删 key 时漏一处 →
 * 一边读一边写不一致, 用户数据看似消失. e.g. ProfileGate 写 'xiaojinapp.birthday',
 * db/service.ts 2 处读 — 任何一边手误都坏掉.
 *
 * 范围: 仅集中 **跨文件共享** 的 key. 文件内 private const (e.g. DISMISS_KEY
 * in GradeMismatchBanner.tsx) 保留 — 单点使用不必抽出来.
 *
 * 注: 跟 featureFlags.ts 的 defineFlag (lsKey) 分工:
 *   - defineFlag: 默认 ON, URL ?param=off 关 / 显式 LS "false" 关 的 boolean toggle
 *   - 这里: 普通数据 key (string / number / json)
 */
export const STORAGE_KEYS = {
  /** 用户档案 — 生日 (yyyy-mm-dd 字符串). v0.32 onboarding 写入. */
  birthday: "xiaojinapp.birthday",
  /** 用户档案 — 学校名 (e.g. 和平街小学). */
  school: "xiaojinapp.school",
  /** 用户档案 — 年级 (e.g. "4"). */
  grade: "xiaojinapp.grade",
  /** 用户档案 — 显示名 (代号 / 昵称). */
  displayName: "xiaojinapp.displayName",
  /** 用户 ID — Aliyun OSS 多 tenant 路由用. */
  userId: "xiaojinapp.userId",

  /** 云密码 — 私下保存的 API token. **慎读**: 仅 vision/OCR/tutor fetch header 用. */
  cloudPwd: "selena.cloud.pwd",
  /** 云同步上次 push 时间戳. cloudSync.ts 维护. */
  cloudLastPush: "selena.cloud.lastPush",
  /** 云同步上次 pull 时间戳. cloudSync.ts 维护. */
  cloudLastPull: "selena.cloud.lastPull",
  /** 用户禁用云同步标志. */
  cloudDisabled: "selena.cloud.disabled",

  /** AuthGate 强制 trophy resync 上次看到的远端 ts. */
  lastForceTrophyResyncSeen: "xiaojinapp.lastForceTrophyResyncSeen",
  /** 家长资料快照 (用于多 device 切换显示). */
  snapshotParent: "xiaojinapp.snapshot.parent",
} as const;

/**
 * 类型: key 名 union (帮 lint 检测 typo). 加新 key 自动扩 union.
 */
export type StorageKey = keyof typeof STORAGE_KEYS;
