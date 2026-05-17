/**
 * ESA EdgeRoutine env binding types.
 *
 * 配置位置：ESA 控制台 → 边缘程序 → xiaojinapp-api → 环境变量
 * 也支持 plain text + secret 两种类型。
 *
 * 跟 CF Pages Env 不同点：
 *   - 没有 D1（用 OSS 替代）
 *   - 没有 KV / R2 binding（都走 OSS REST）
 *   - 所有 env var 都是 string（即便是数字也是 string）
 */
export interface Env {
  /** 单家庭密码（向后兼容 Selena 家） */
  APP_PASSWORD: string;
  /**
   * 多租户 JSON map: '{"alice-pwd":"alice","bob-pwd":"bob"}'
   * 不设 → 全部 fallback 到 APP_PASSWORD → userId="selena"
   */
  APP_USERS?: string;
  /** 阿里云 OSS（私有 bucket，数据 + 静态站点都在里面） */
  ALIYUN_OSS_REGION: string;            // "oss-cn-hongkong"
  ALIYUN_OSS_BUCKET: string;            // "xiaojinapp"
  ALIYUN_OSS_ACCESS_KEY_ID: string;
  ALIYUN_OSS_ACCESS_KEY_SECRET: string;
  /** TOKEN_PLAN_CN（cn-beijing 订阅版）主路径 */
  TOKEN_PLAN_CN_API_KEY?: string;
  /** BAILIAN（百炼，cn-hangzhou 按量付费）fallback + 实时语音 */
  BAILIAN_API_KEY?: string;
  /** 旧 intl 兼容（迁完可删） */
  TOKEN_PLAN_API_KEY?: string;
  DASHSCOPE_API_KEY?: string;
  /**
   * v0.34.15 (Ep145) super-admin 白名单：JSON array `["selena","admin"]` 或
   * 逗号分隔 `selena,admin`。默认 ["selena"]（爸爸 currently uses Selena's password）。
   */
  SUPER_ADMINS?: string;
  /**
   * Ep33 (2026-05-17) backup cron service token：
   * 非空时，POST/GET /api/super-admin/backup-snapshot* 接受
   *   Authorization: Bearer <BACKUP_TOKEN>
   * 旁路 user/role 检查，让 Aliyun FC cron 函数能定时调（不需要 super-admin 密码）。
   * 仅作用于 backup-snapshot* paths，其它 super-admin endpoint 仍走原 auth。
   */
  BACKUP_TOKEN?: string;
}
