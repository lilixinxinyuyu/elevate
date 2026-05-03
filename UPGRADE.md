# 给 Selena 升级 App

> 这份文档是给"管理员（爸爸 / 妈妈）"看的。Selena 自己不需要管。

整个 App 都在 Selena 的电脑上本地运行，没有云端服务。"升级"就是把仓库里最新的代码拿到她电脑上，重新 build 一下，下次双击 `start-fast.command` 就是新版了。

## 三种升级路径，按场景挑

### 场景 A：你是在自己电脑改完代码，要同步到 Selena 的电脑

最常见情形。

#### A.1 用 Git（推荐，能回滚）

**前置一次性准备**（Selena 电脑上做一次，以后不用再做）：
```bash
# 在 Selena 电脑的终端
cd ~/Desktop                           # 或者你想放代码的位置
git clone <你的仓库地址> heping-math-trainer
cd heping-math-trainer
pnpm install                           # 安装依赖
pnpm build                             # 第一次 build
```
把 `start-fast.command` 拖到桌面或 Dock 做替身。

**之后每次升级**（Selena 电脑上 30 秒搞定）：
```bash
cd ~/Desktop/heping-math-trainer       # 进项目
git pull                               # 拉最新代码
pnpm install                           # 更新依赖（如果 package.json 变了）
pnpm build                             # 重新打包
```
然后让她双击 `start-fast.command` 就是新版。

> 如果你不想每次都让她进终端，可以做一个脚本（见 [自动化脚本](#自动化脚本)）。

#### A.2 用 U 盘 / AirDrop（不用 Git）

如果你只是改了几行配置不想搞 git：
1. 在你电脑上 `pnpm build`
2. 把整个 `heping-math-trainer` 文件夹（**含 `dist/` 和 `node_modules/` 是可选**，但 `src/` `package.json` `start-fast.command` 必须有）压缩
3. AirDrop 给 Selena
4. 解压到她电脑，覆盖原目录
5. 进项目跑 `pnpm install && pnpm build`（如果你压缩里没带 dist）

> 注意：**Selena 电脑里的 IndexedDB（她的进度数据）不在项目目录里**，存在浏览器里。覆盖代码不会丢她的练习记录。

#### A.3 直接部署到云上（一劳永逸 ⭐ v0.8 推荐）

> **完整步骤见 [DEPLOY.md](./DEPLOY.md)**——D1 创建、密码门、首次数据导入都写了。

简版流程：
1. 仓库已推到 `git@github.com:lilixinxinyuyu/elevate.git`
2. Cloudflare → Workers & Pages → 创建 D1 数据库 `selena-elevate-db`
3. Cloudflare Pages → Connect to Git → 选这个仓库
4. Bind D1 到 Pages（变量名 `DB`）
5. 设环境变量 `APP_PASSWORD`（一个家长密码）
6. 跑 `wrangler d1 execute --remote --file=db/schema.sql` 建表
7. 用 `db/import-dump.mjs` 把 Selena 现有 IndexedDB 进度灌进 D1（一次性）
8. `git push` → 自动部署 → 给 Selena 一个 URL

以后你每次 `git push`，Cloudflare 自动 build。**Selena 在任何设备打开 URL 输密码，进度自动同步**——iPad、手机、新电脑都行。

> 不想搞云端就跳过这段，回到 A.1 / A.2。

---

### 场景 B：在 Selena 电脑上改代码

不推荐——但偶尔急修小 bug 时这样做：
```bash
cd ~/Desktop/heping-math-trainer
# 改文件…
pnpm build       # 让生产版本重新打包
# 双击 start-fast.command 验证
```
如果改前先 `git pull`，改后 `git push`，跟 A.1 完全融合。

---

## 关键概念

### Selena 的"进度数据"放在哪里？

- 答题记录、错题、奖杯、XP、等级 → 都在浏览器 **IndexedDB**（数据库名 `selena-elevate-db`）
- 升级代码不会动这些。除非你跑 `/admin → 完全清空` 或在浏览器 DevTools 里手动删 IndexedDB
- 如果你换浏览器、换电脑，进度数据不跟着走（除非导出/导入——这个我们目前没做，未来可加）

### `SEED_VERSION` 是什么？

- 在 `src/db/seed.ts` 里有个 `const SEED_VERSION = 14`
- 每次我们加新题 / 改题库结构 / 改 schema 都会 +1
- App 启动时检测到本地 SEED_VERSION 比代码低，会**自动重新导入题库**
- **不会动 Selena 的进度数据**——只刷题库 + 学生档案
- 所以加新题的版本升级对她无感：刷一下就能做到新题

### 什么情况下要让 Selena "完全清空"？

几乎不需要。只有这两种情况：
1. 题库底层数据结构改了（很少发生），新版打不开她旧数据
2. 你想给她一个"新学期，从头来过"的体验

清空步骤：进 `/admin` → 点"完全清空"→ 刷新页面。她所有进度归零。

### 什么情况下让她"只清空进度数据"？

- 你刚做完一轮内部测试，想清掉测试数据让她从干净的起点开始 → `/admin` → "只清空进度数据"
- 题库不动，只擦掉答题/奖杯/连胜/XP

---

## 自动化脚本（可选）

如果你想在 Selena 电脑做一个"双击即升级"按钮，新建一个 `~/Desktop/升级 Selena 数学.command`：

```bash
#!/bin/bash
set -e
cd ~/Desktop/heping-math-trainer

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n1)/bin:$PATH"

echo "🔄 拉取最新代码…"
git pull

if [ package.json -nt node_modules ]; then
  echo "📦 依赖有更新，安装中…"
  pnpm install
fi

echo "🔨 打包新版…"
pnpm build

echo ""
echo "✅ 升级完成！现在双击 start-fast.command 就是新版啦"
echo "（按任意键关闭）"
read -n 1
```

```bash
chmod +x ~/Desktop/升级\ Selena\ 数学.command
```

---

## 当前版本

- **v0.7**（本次）
  - 新增 `cube_view` 立体观察 SVG 模板
  - 新增 `triangle_judge` 三角形法庭 SVG 模板
  - U2 / U4 真题错题全部加上视觉
  - 期中冲刺 `/train?mode=midterm`
  - 单题 mastered 门槛（连续 3 次答对暂退主池）
  - 题库枯竭时主动提示家长出题
  - 题库 ~225 道
  - SEED_VERSION = 14

详细变更见 `feedback_log.md`。

---

## 出新题（不需要改代码）

如果你只是想给 Selena 加几道她最近做错的题，**不需要重新升级代码**：

1. Selena 浏览器打开 `/admin`
2. "AI 出题 Prompt 生成器"：选单元 / 技能 / 数量 / 难度 → 复制 prompt
3. 粘到 ChatGPT / Claude / 任何 LLM
4. 拿到 JSON 数组复制
5. 回到 `/admin` "导入题目 JSON" 粘贴 → 入库

这些题只存在她的浏览器里，下次代码升级（SEED_VERSION 变了）会被覆盖。如果你想把它们**永久**加进项目源码：把 JSON 给我（开发者），我会进 `examPaperPack.ts` 或新建一个文件。

---

## 出问题怎么办？

| 现象 | 处理 |
|---|---|
| `start-fast.command` 双击没反应 | 右键 → 打开（绕过 macOS Gatekeeper）；或终端 `bash start-fast.command` 看错误 |
| 浏览器空白 | F12 看 Console；如果是 React 报错，截图发给我 |
| 题库少了 / 数据不对 | `/admin` → "只清空进度数据"，重新做几道。如果不行，"完全清空"会让她从头开始 |
| 题做完一轮后再训练总是同样几道 | 这是 v0.7 之前的 bug；升到 v0.7 后启用 mastered 门槛会自动过滤 |
| `pnpm` 找不到 / Node 版本太老 | 装 nvm + node 20：`curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh \| bash`，然后 `nvm install 20 && nvm use 20 && npm i -g pnpm` |
