# 部署指南

本文档介绍 weixin-kimi-bot 的部署方法。

## 📋 部署要求

### 系统要求

- **操作系统**: Linux (Ubuntu 20.04+ / CentOS 8+)、macOS、Windows
- **Node.js**: 18.x LTS 或更高
- **内存**: 至少 1GB RAM（推荐 2GB）
- **磁盘**: 至少 1GB 可用空间

### 依赖服务

- **Kimi CLI**: 必须安装并配置 API Key
- **微信 iLink**: 如需微信集成
- **PM2**: 生产环境进程管理（推荐）

## 🚀 快速部署

### 1. 安装 Node.js

```bash
# 使用 nvm 安装
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
```

### 2. 安装 Kimi CLI

```bash
pip install kimi-cli
kimi config set api_key your-api-key
```

### 3. 部署应用

```bash
# 克隆项目
git clone <repository-url>
cd weixin-kimi-bot

# 安装依赖
npm ci --production

# 编译
npm run build

# 配置
cp config.example.json config.json
vim config.json
```

### 4. 配置说明

```json
{
  "environment": "production",
  "kimi": {
    "apiKey": "your-api-key",
    "model": "kimi-latest",
    "timeout": 60000,
    "maxRetries": 3
  },
  "wechat": {
    "enabled": true,
    "pollingInterval": 5000,
    "apiEndpoint": "https://ilink-api.example.com"
  },
  "server": {
    "port": 3000,
    "host": "0.0.0.0"
  },
  "logging": {
    "level": "info",
    "console": false,
    "file": "logs/app.log",
    "maxFiles": 7
  },
  "security": {
    "allowedOrigins": ["https://your-domain.com"]
  }
}
```

## 🐳 Docker 部署

### 使用 Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
RUN npm ci --production

# 复制源码
COPY . .
RUN npm run build

# 创建日志目录
RUN mkdir -p logs

EXPOSE 3000

CMD ["npm", "start"]
```

构建和运行：

```bash
# 构建镜像
docker build -t weixin-kimi-bot .

# 运行容器
docker run -d \
  --name kimi-bot \
  -p 3000:3000 \
  -v $(pwd)/config.json:/app/config.json \
  -v $(pwd)/logs:/app/logs \
  weixin-kimi-bot
```

### 使用 Docker Compose

```yaml
version: '3.8'

services:
  kimi-bot:
    build: .
    container_name: weixin-kimi-bot
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./config.json:/app/config.json
      - ./logs:/app/logs
      - ./data:/app/data
    environment:
      - NODE_ENV=production
```

运行：

```bash
docker-compose up -d
```

## ⚙️ PM2 部署

### 安装 PM2

```bash
npm install -g pm2
```

### 配置 ecosystem

创建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'weixin-kimi-bot',
    script: './dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production'
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    max_memory_restart: '1G',
    restart_delay: 3000,
    max_restarts: 5,
    min_uptime: '10s',
    watch: false,
    merge_logs: true
  }]
};
```

### 启动服务

```bash
# 启动
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs weixin-kimi-bot

# 重启
pm2 restart weixin-kimi-bot

# 停止
pm2 stop weixin-kimi-bot

# 保存配置
pm2 save
pm2 startup
```

## 🔄 自动部署

### GitHub Actions

创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build
      
      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/weixin-kimi-bot
            git pull
            npm ci --production
            npm run build
            pm2 restart weixin-kimi-bot
```

## 🔒 安全配置

### 1. 环境变量

敏感信息使用环境变量：

```bash
# .env
KIMI_API_KEY=your-secret-key
WECHAT_API_SECRET=your-secret
```

```typescript
// config.ts
export const config = {
  kimi: {
    apiKey: process.env.KIMI_API_KEY
  }
};
```

### 2. 文件权限

```bash
# 设置配置文件权限
chmod 600 config.json

# 设置日志目录权限
chmod 755 logs
```

### 3. 防火墙配置

```bash
# 仅开放必要端口
sudo ufw allow 3000/tcp
sudo ufw enable
```

## 📊 监控

### 健康检查

添加健康检查端点：

```typescript
// 在应用中实现
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime()
  });
});
```

### 日志监控

```bash
# 实时查看日志
pm2 logs --lines 100

# 导出日志
pm2 logs weixin-kimi-bot --lines 1000 > app.log
```

## 🆘 故障排除

### 启动失败

```bash
# 检查日志
pm2 logs

# 检查配置
node -e "console.log(require('./config.json'))"

# 检查依赖
npm ls
```

### 内存泄漏

```bash
# 监控内存使用
pm2 monit

# 设置自动重启
pm2 start app.js --max-memory-restart 1G
```

### 性能问题

```bash
# 检查 CPU 使用
top -p $(pgrep -d',' node)

# 生成性能报告
node --prof dist/index.js
```

## 📚 相关文档

- [环境搭建](../development/setup.md)
- [配置参考](./configuration.md)
- [监控指南](./monitoring.md)
