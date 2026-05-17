# xiaojinapp FC cron — 每日 backup + prune

> Aliyun Function Compute 3.0 函数。Timer trigger 每天 UTC 03:00（北京 11:00）
> 调 `/api/super-admin/backup-snapshot` 打 snapshot + 直接 OSS prune 老 backup。

## 文件

- `index.mjs` — handler，无依赖于 EdgeRoutine 代码（ali-oss SDK 直读 OSS）
- `package.json` — runtime deps（只有 ali-oss）
- `s.yaml` — [Serverless Devs](https://www.serverless-devs.com/) 部署配置

## 一次性部署

1. **装 Serverless Devs CLI**：
   ```bash
   npm i -g @serverless-devs/s
   ```

2. **配身份**（用 xiaojinapp-sync RAM 子账号，需先给它加 `AliyunFCFullAccess` policy）：
   ```bash
   s config add --AccessAlias default \
     --AccountID 524598... \
     --AccessKeyID $(grep ^ALIYUN_OSS_ACCESS_KEY_ID= /Users/yong/Desktop/xy/.dev.vars | cut -d= -f2-) \
     --AccessKeySecret $(grep ^ALIYUN_OSS_ACCESS_KEY_SECRET= /Users/yong/Desktop/xy/.dev.vars | cut -d= -f2-)
   ```

3. **export env vars**（s.yaml 会插值这些）：
   ```bash
   export $(grep -E '^(BACKUP_TOKEN|ALIYUN_OSS_REGION|ALIYUN_OSS_BUCKET|ALIYUN_OSS_ACCESS_KEY_ID|ALIYUN_OSS_ACCESS_KEY_SECRET)=' /Users/yong/Desktop/xy/.dev.vars | xargs)
   ```

4. **部署**：
   ```bash
   cd aliyun-deploy/fc-cron
   s deploy -y
   ```
   首次部署会自动：装 npm deps（pre-deploy hook） → 创建 FC service `xiaojinapp-cron` →
   创建函数 `xiaojinapp-backup-cron` → 挂 timer trigger `daily-3am-utc`。

5. **手动触发一次验证**：
   ```bash
   s invoke
   ```
   预期输出 `{"ok":true,"backup":{"backupId":"...","copied":2},"prune":{"total":N,"kept":N,"deletedSnapshots":0,"removedKeys":0}}`。

6. **查日志**：
   ```bash
   s logs -t   # tail mode
   ```

## 更新 cron / 调整 timeout

改完 `s.yaml` 重跑 `s deploy -y`。Serverless Devs 会 diff 出变化只更新函数/trigger 配置。

## 改了 index.mjs 重新部署

```bash
cd aliyun-deploy/fc-cron
s deploy -y
```

## 删除

```bash
s remove -y
```

## 监控

FC 控制台 → xiaojinapp-cron → 函数 xiaojinapp-backup-cron → 调用记录。

每次 invoke 日志会写到 SLS（Aliyun Log Service），可设报警：
- "execution failed" 关键字 → 邮件 / 钉钉
- duration > 30s → 邮件（snapshot 慢了可能 OSS 有问题）

## 安全

- BACKUP_TOKEN 是双向共享密钥（FC env + EdgeRoutine env baked），任一暴露
  都允许触发 backup（**只能 backup，不能 read/restore**，restore 仍需 user
  auth + super-admin role）
- 没有写权限到非 _backups/ 路径，OSS ACL 限定 xiaojinapp 子账号本就只对这个
  bucket 有 rw

## Failure modes

- BACKUP_TOKEN 不匹配 → 401 from EdgeRoutine → FC handler 返 502，SLS 日志记
- ESA 短暂 5xx → FC handler 502，下一天再跑（手 invoke 重试也行）
- OSS 限流 → ali-oss SDK 自动重试一次，再失败 prune 部分完成（仍 idempotent）
