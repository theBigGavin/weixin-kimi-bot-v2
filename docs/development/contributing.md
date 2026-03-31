# 贡献指南

感谢您对 weixin-kimi-bot 项目的关注！本文档指导您如何参与项目贡献。

## 🚀 开始贡献

### 1. Fork 项目

```bash
# 点击 GitHub 页面的 Fork 按钮
# 然后克隆您的 Fork
git clone https://github.com/YOUR_USERNAME/weixin-kimi-bot.git
cd weixin-kimi-bot
```

### 2. 创建分支

```bash
# 创建功能分支
git checkout -b feature/your-feature-name

# 或修复分支
git checkout -b fix/bug-description
```

### 3. 开发流程

遵循 TDD 开发模式：

```bash
# 1. 编写测试
vim tests/unit/your-module.test.ts

# 2. 运行测试确认失败（红阶段）
npm test -- tests/unit/your-module.test.ts

# 3. 实现功能
vim src/your-module.ts

# 4. 运行测试确认通过（绿阶段）
npm test -- tests/unit/your-module.test.ts

# 5. 重构优化代码
# ...

# 6. 确保覆盖率达标
npm run test:coverage
```

### 4. 提交更改

```bash
# 添加更改
git add .

# 提交（遵循提交信息规范）
git commit -m "feat: add new feature description"

# 推送到您的 Fork
git push origin feature/your-feature-name
```

### 5. 创建 Pull Request

1. 访问原项目的 GitHub 页面
2. 点击 "New Pull Request"
3. 选择您的分支
4. 填写 PR 描述
5. 等待代码审查

## 📝 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

### 类型 (Type)

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式（不影响功能） |
| `refactor` | 重构 |
| `test` | 测试相关 |
| `chore` | 构建/工具相关 |

### 示例

```bash
# 新功能
feat(agent): add memory compression support

# Bug 修复
fix(context): resolve session timeout issue

# 文档
docs(readme): update installation guide

# 测试
test(router): add edge case tests for task routing
```

## 🔍 代码审查标准

### 必须满足

- [ ] 所有测试通过
- [ ] 覆盖率 >= 80%
- [ ] 类型检查通过
- [ ] ESLint 无错误
- [ ] 代码符合项目风格

### 审查重点

- 测试是否覆盖主要路径和边界情况
- 错误处理是否完善
- 代码可读性和可维护性
- 是否引入不必要的依赖

## 🐛 报告 Bug

使用 GitHub Issues 报告问题，包含：

1. **问题描述** - 清晰描述 Bug
2. **复现步骤** - 详细的复现步骤
3. **期望行为** - 说明期望的结果
4. **实际行为** - 说明实际的结果
5. **环境信息** - Node.js 版本、操作系统等
6. **错误日志** - 相关的错误信息

### Bug 报告模板

```markdown
## 问题描述
简明扼要地描述 Bug

## 复现步骤
1. 步骤 1
2. 步骤 2
3. 步骤 3

## 期望行为
描述期望的结果

## 实际行为
描述实际的结果

## 环境信息
- Node.js 版本: 
- 操作系统: 
- 项目版本: 

## 错误日志
```
粘贴错误日志
```
```

## 💡 功能建议

欢迎提出新功能建议！请包含：

1. **功能描述** - 详细描述功能
2. **使用场景** - 说明为什么需要这个功能
3. **期望行为** - 描述功能如何工作
4. **替代方案** - 是否有其他实现方式

## 📚 开发资源

- [开发环境搭建](./setup.md)
- [TDD 开发指南](./tdd-guide.md)
- [架构文档](../architecture/architecture-overview.md)
- [API 文档](../api/README.md)

## 🤝 行为准则

- 尊重所有贡献者
- 接受建设性批评
- 关注什么对项目最好
- 展示同理心

## 📞 联系方式

- GitHub Issues: [提交问题](../../issues)
-  discussions: [参与讨论](../../discussions)

感谢您的贡献！🎉
