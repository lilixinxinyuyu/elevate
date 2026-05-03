#!/bin/bash
# 一键部署到 Cloudflare Pages
# 用法：./deploy.sh

set -e

cd "$(dirname "$0")"

# 加载 nvm（如果有）
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n1)/bin:$PATH"

echo "🔍 typecheck..."
pnpm typecheck

echo "🧪 tests..."
pnpm test

echo "🔨 build..."
pnpm build

echo "🚀 deploy..."
wrangler pages deploy dist \
  --project-name=selena-elevate \
  --branch=main \
  --commit-dirty=true

echo ""
echo "✅ 完成！https://selena-elevate.pages.dev"
echo "（自定义域名也会同步更新）"
