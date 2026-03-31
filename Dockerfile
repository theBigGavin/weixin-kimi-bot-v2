FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制构建输出
COPY dist ./dist

# 创建数据目录
RUN mkdir -p /data/.weixin-kimi-bot

# 设置环境变量
ENV NODE_ENV=production
ENV WEIXIN_KIMI_BOT_DIR=/data/.weixin-kimi-bot

# 暴露端口（如果需要 HTTP API）
EXPOSE 3000

# 启动命令
CMD ["node", "dist/index.js"]
