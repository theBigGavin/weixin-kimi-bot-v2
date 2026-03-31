# 微信用户与 Agent 的 N:M 关系设计

## 1. 概述

### 1.1 当前问题

当前系统将微信登录凭证保存在全局 `credentials.json` 中，这限制了：
- 只能有一个微信账号登录
- 无法支持多微信用户
- Agent 与微信用户的关系是固定的 1:1

### 1.2 目标架构

实现 **N:M 关系**：
- **N 个微信用户**：每个用户可以独立登录
- **M 个 Agent**：每个 Agent 可以服务多个微信用户
- **灵活绑定**：一个微信用户可以拥有多个 Agent，一个 Agent 可以被多个微信用户共享

## 2. 关系模型

### 2.1 关系图解

```
┌─────────────────────────────────────────────────────────────────┐
│                        N:M 关系模型                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   微信用户 (N)                      Agent (M)                   │
│   ┌─────────────┐                 ┌─────────────┐              │
│   │  用户 A     │◄───────────────►│  通用助手   │              │
│   │  wxid_001   │   绑定关系       │  agent_001  │              │
│   └──────┬──────┘                 └──────▲──────┘              │
│          │                                │                     │
│          │         ┌─────────────┐       │                     │
│          └────────►│  程序员     │◄──────┘                     │
│                    │  agent_002  │                             │
│                    └──────▲──────┘                             │
│                           │                                    │
│   ┌─────────────┐         │                                    │
│   │  用户 B     │─────────┘                                    │
│   │  wxid_002   │                                              │
│   └─────────────┘                                              │
│                                                                 │
│   ┌─────────────┐                 ┌─────────────┐              │
│   │  用户 C     │◄───────────────►│  写作助手   │              │
│   │  wxid_003   │                 │  agent_003  │              │
│   └─────────────┘                 └─────────────┘              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 绑定关系表设计

```typescript
// 微信用户视角的绑定表
// 存储位置：~/.weixin-kimi-bot/wechat-accounts/{wechat_prefix}/bindings.json

interface WechatAgentBinding {
  /** Agent ID */
  agentId: string;
  /** 是否为默认 Agent */
  isDefault: boolean;
  /** 绑定时间 */
  boundAt: number;
  /** 最后使用时间 */
  lastUsedAt: number;
  /** 用户对此 Agent 的个性化设置 */
  preferences: {
    /** 是否接收通知 */
    notifications: boolean;
    /** 自定义唤醒词 */
    wakeWords?: string[];
    /** 静音时段 */
    quietHours?: { start: string; end: string };
  };
}

interface WechatBindings {
  /** 微信用户ID */
  wechatId: string;
  /** 绑定的 Agent 列表 */
  agents: WechatAgentBinding[];
  /** 默认 Agent ID */
  defaultAgentId: string | null;
  /** 当前激活的 Agent ID */
  currentAgentId: string | null;
  /** 最后更新时间 */
  updatedAt: number;
}

// Agent 视角的绑定表
// 存储位置：~/.weixin-kimi-bot/agents/{agent_id}/config.json (boundWechatIds 字段)

interface AgentConfig {
  // ... 其他字段
  /** 绑定的微信用户列表 */
  boundWechatIds: string[];
  /** 主要绑定的微信用户 (创建者) */
  primaryWechatId: string;
}
```

## 3. 登录流程重新设计

### 3.1 首次登录流程 (创建创世 Agent)

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  npm run    │───►│  显示 QR    │───►│  扫码登录   │───►│  检测为首次 │
│   login     │    │    码       │    │             │    │  登录       │
└─────────────┘    └─────────────┘    └─────────────┘    └──────┬──────┘
                                                                 │
                                 ┌───────────────────────────────┘
                                 ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  保存凭证   │◄───│  按微信用户 │◄───│  标记为创世 │◄───│  交互式配置 │
│  到用户目录 │    │  隔离存储   │    │  Agent      │    │ 创世 Agent  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 3.2 交互式配置向导

```typescript
// src/login/interactive-config.ts

import readline from 'node:readline';
import { generateAgentId } from '../agent/id-generator.js';
import { TemplateType, getTemplateById } from '../templates/definitions.js';

/**
 * 交互式 Agent 配置
 */
export interface InteractiveAgentConfig {
  name: string;
  templateId: string;
  model: string;
  enableMemory: boolean;
  features: {
    shellExec: boolean;
    webSearch: boolean;
    fileAccess: boolean;
  };
}

/**
 * 运行交互式配置向导
 */
export async function runInteractiveConfig(
  wechatId: string,
  isFirstLogin: boolean
): Promise<InteractiveAgentConfig> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt: string): Promise<string> => 
    new Promise(resolve => rl.question(prompt, resolve));

  console.log('\n=== Agent 配置向导 ===\n');

  if (isFirstLogin) {
    console.log('欢迎使用 weixin-kimi-bot！');
    console.log('这是首次登录，我们将为您创建创世 Agent。\n');
  }

  // 1. Agent 名称
  const name = await question('请输入 Agent 名称 (默认: 小助手): ');
  const finalName = name.trim() || '小助手';

  // 2. 选择模板
  console.log('\n可用模板:');
  console.log('  1. 通用助手 (general)');
  console.log('  2. 程序员 (programmer)');
  console.log('  3. 作家 (writer)');
  console.log('  4. 交易员 (trader)');
  
  const templateChoice = await question('\n请选择模板 (1-4, 默认: 1): ');
  const templateMap: Record<string, string> = {
    '1': TemplateType.GENERAL,
    '2': TemplateType.PROGRAMMER,
    '3': TemplateType.WRITER,
    '4': TemplateType.CRYPTO_TRADER,
  };
  const templateId = templateMap[templateChoice.trim()] || TemplateType.GENERAL;

  // 3. 模型选择
  console.log('\n可用模型:');
  console.log('  1. kimi-k1.5 (默认)');
  console.log('  2. kimi-k1.5-long');
  
  const modelChoice = await question('\n请选择模型 (1-2, 默认: 1): ');
  const model = modelChoice.trim() === '2' ? 'kimi-k1.5-long' : 'kimi-k1.5';

  // 4. 功能特性
  console.log('\n功能配置:');
  const enableShell = (await question('  允许执行命令? (y/N): ')).toLowerCase() === 'y';
  const enableSearch = (await question('  允许网络搜索? (Y/n): ')).toLowerCase() !== 'n';
  const enableFile = (await question('  允许文件操作? (Y/n): ')).toLowerCase() !== 'n';

  // 5. 记忆功能
  const enableMemory = (await question('\n启用长期记忆? (Y/n): ')).toLowerCase() !== 'n';

  rl.close();

  return {
    name: finalName,
    templateId,
    model,
    enableMemory,
    features: {
      shellExec: enableShell,
      webSearch: enableSearch,
      fileAccess: enableFile,
    },
  };
}
```

### 3.3 登录主流程

```typescript
// src/login/index.ts

import qrterm from 'qrcode-terminal';
import { loginWithQR } from '../auth/index.js';
import { WechatAccountManager } from '../wechat/manager.js';
import { AgentManager } from '../agent/manager.js';
import { MasterConfigManager } from '../config/master-config.js';
import { runInteractiveConfig } from './interactive-config.js';
import { generateAgentId } from '../agent/id-generator.js';
import { Paths } from '../paths.js';

async function main() {
  console.log('=== 微信 Kimi Bot 登录 ===\n');

  // 初始化管理器
  const wechatManager = new WechatAccountManager();
  const agentManager = new AgentManager();
  const masterConfig = new MasterConfigManager();

  // 检查是否已存在创世 Agent
  const isFirstLogin = !(await masterConfig.getFounderAgentId());

  // 执行 QR 登录
  const loginResult = await loginWithQR({
    onQRCode: (url: string) => {
      console.log('\n请使用微信扫描以下二维码：\n');
      qrterm.generate(url, { small: true });
    },
    onStatusChange: (status) => {
      switch (status) {
        case 'scanned':
          console.log('\n已扫码，请在微信上确认...');
          break;
        case 'confirmed':
          console.log('\n登录确认成功！');
          break;
      }
    },
  });

  const wechatId = loginResult.userId || loginResult.accountId;

  // 保存凭证 (按微信用户隔离)
  await wechatManager.saveCredentials(wechatId, {
    botToken: loginResult.botToken,
    accountId: loginResult.accountId,
    baseUrl: loginResult.baseUrl,
    userId: loginResult.userId,
  });

  console.log(`\n✅ 微信连接成功！账号: ${wechatId}`);

  // 检查是否已有绑定的 Agent
  const existingBindings = await wechatManager.getBindings(wechatId);

  if (existingBindings && existingBindings.agents.length > 0) {
    // 已有 Agent，询问是否创建新 Agent
    console.log(`\n您已有 ${existingBindings.agents.length} 个绑定的 Agent:`);
    for (const binding of existingBindings.agents) {
      const agent = await agentManager.getAgent(binding.agentId);
      console.log(`  - ${agent?.name || binding.agentId} ${binding.isDefault ? '(默认)' : ''}`);
    }
    
    // 这里可以添加交互式选择逻辑
    console.log('\n您可以使用以下命令管理 Agent:');
    console.log('  npm run agent:create  - 创建新 Agent');
    console.log('  npm run agent:list    - 列出所有 Agent');
    console.log('  npm run agent:switch  - 切换 Agent');
  } else {
    // 首次绑定，创建新 Agent
    console.log('\n首次绑定，需要创建 Agent...\n');
    
    const config = await runInteractiveConfig(wechatId, isFirstLogin);
    const agentId = generateAgentId(config.name, wechatId);

    // 创建 Agent
    const agent = await agentManager.createAgent({
      id: agentId,
      name: config.name,
      wechatId,
      isFounder: isFirstLogin,
      templateId: config.templateId,
      model: config.model,
      enableMemory: config.enableMemory,
      features: config.features,
    });

    // 绑定到微信账号
    await wechatManager.bindAgent(wechatId, agentId, true);

    // 如果是首次登录，标记为创世 Agent
    if (isFirstLogin) {
      await masterConfig.setFounderAgentId(agentId);
      console.log('\n👑 已设置创世 Agent！');
    }

    console.log(`\n✅ Agent "${config.name}" 创建成功！`);
    console.log(`   ID: ${agentId}`);
    console.log(`   模板: ${config.templateId}`);
    console.log(`   模型: ${config.model}`);
  }

  console.log('\n现在可以运行 npm start 启动 Bot。');
}

main().catch((err) => {
  console.error('\n❌ 登录失败:', err.message);
  process.exit(1);
});
```

## 4. 运行时 Agent 选择

### 4.1 消息处理流程

```typescript
// src/handlers/message-handler.ts (更新版)

import { WechatAccountManager } from '../wechat/manager.js';
import { AgentManager } from '../agent/manager.js';

class MessageHandler {
  private wechatManager = new WechatAccountManager();
  private agentManager = new AgentManager();

  async handleMessage(
    client: ILinkClient,
    msg: WeixinMessage,
  ): Promise<void> {
    const wechatId = msg.from_user_id;
    if (!wechatId) return;

    const text = this.extractText(msg);
    if (!text) return;

    // 获取当前微信用户的绑定信息
    const bindings = await this.wechatManager.getBindings(wechatId);
    if (!bindings || bindings.agents.length === 0) {
      // 未绑定 Agent，提示用户
      await client.sendText(wechatId, 
        '您还没有绑定 Agent。请运行 `npm run agent:create` 创建一个。', 
        msg.context_token
      );
      return;
    }

    // 确定使用哪个 Agent
    let agentId = bindings.currentAgentId || bindings.defaultAgentId;

    // 检查是否是 Agent 切换命令
    if (text.startsWith('/agent switch ')) {
      const targetAgentName = text.replace('/agent switch ', '').trim();
      const targetAgent = bindings.agents.find(b => {
        const agent = this.agentManager.getAgent(b.agentId);
        return agent?.name === targetAgentName || b.agentId === targetAgentName;
      });

      if (targetAgent) {
        await this.wechatManager.setCurrentAgent(wechatId, targetAgent.agentId);
        await client.sendText(wechatId, `已切换到 Agent: ${targetAgentName}`, msg.context_token);
      } else {
        await client.sendText(wechatId, `未找到 Agent: ${targetAgentName}`, msg.context_token);
      }
      return;
    }

    // 检查是否是列出 Agent 命令
    if (text === '/agent list') {
      const agentList = await Promise.all(
        bindings.agents.map(async (b) => {
          const agent = await this.agentManager.getAgent(b.agentId);
          const current = b.agentId === agentId ? ' [当前]' : '';
          const default_ = b.isDefault ? ' [默认]' : '';
          return `- ${agent?.name || b.agentId}${current}${default_}`;
        })
      );
      await client.sendText(wechatId, `您的 Agent 列表:\n${agentList.join('\n')}`, msg.context_token);
      return;
    }

    if (!agentId) {
      await client.sendText(wechatId, '请设置默认 Agent 或使用 /agent switch <name> 切换', msg.context_token);
      return;
    }

    // 获取 Agent 并处理消息
    const agent = await this.agentManager.getAgent(agentId);
    if (!agent) {
      await client.sendText(wechatId, 'Agent 配置错误，请重新绑定', msg.context_token);
      return;
    }

    // 使用 Agent 处理消息 (通过 ACP)
    await this.processWithAgent(client, msg, agent);
  }

  private async processWithAgent(
    client: ILinkClient,
    msg: WeixinMessage,
    agent: Agent
  ): Promise<void> {
    // ... 使用 ACP 调用 Kimi
  }
}
```

### 4.2 Agent 切换命令

```typescript
// 微信端支持的 Agent 命令

const AGENT_COMMANDS = {
  // 列出所有绑定的 Agent
  '/agent list': async (ctx) => {
    const bindings = await ctx.wechatManager.getBindings(ctx.wechatId);
    const list = bindings.agents.map(b => {
      const marker = b.isDefault ? ' [默认]' : '';
      return `- ${b.agentId}${marker}`;
    });
    return `您的 Agent 列表:\n${list.join('\n')}`;
  },

  // 切换到指定 Agent
  '/agent switch <name>': async (ctx, name) => {
    await ctx.wechatManager.setCurrentAgent(ctx.wechatId, name);
    return `已切换到 Agent: ${name}`;
  },

  // 创建新 Agent (仅创世 Agent 或首次登录)
  '/agent create': async (ctx) => {
    // 检查权限
    if (!await ctx.hasPermission('create_agent')) {
      return '您没有权限创建新 Agent。';
    }
    // 启动交互式创建流程...
  },

  // 显示当前 Agent 配置
  '/agent config': async (ctx) => {
    const agent = await ctx.getCurrentAgent();
    return `当前 Agent: ${agent.name}\n模板: ${agent.ai.templateId}\n模型: ${agent.ai.model}`;
  },
};
```

## 5. 多微信用户共享 Agent

### 5.1 共享场景

```
场景1：家庭共享
- 家庭成员 A (wxid_dad001) 创建 "家庭助手" Agent
- 家庭成员 B (wxid_mom002) 绑定同一 Agent
- 两人共享同一记忆和工作空间

场景2：团队协作
- 项目经理创建 "项目助手" Agent
- 多名团队成员绑定同一 Agent
- 共享项目相关的记忆和上下文
```

### 5.2 共享 Agent 实现

```typescript
// 共享 Agent 绑定

async function shareAgent(
  ownerWechatId: string,
  targetWechatId: string,
  agentId: string
): Promise<void> {
  // 验证 owner 权限
  const agent = await agentManager.getAgent(agentId);
  if (agent.primaryWechatId !== ownerWechatId) {
    throw new Error('只有 Agent 创建者可以共享');
  }

  // 添加到目标用户的绑定列表
  await wechatManager.bindAgent(targetWechatId, agentId, false);

  // 更新 Agent 的绑定列表
  agent.boundWechatIds.push(targetWechatId);
  await agentManager.updateAgent(agentId, { boundWechatIds: agent.boundWechatIds });

  // 记录共享关系
  await agentManager.addShareRecord(agentId, {
    sharedBy: ownerWechatId,
    sharedTo: targetWechatId,
    sharedAt: Date.now(),
  });
}
```

## 6. 数据隔离保证

### 6.1 隔离级别

| 数据类型 | 隔离级别 | 说明 |
|---------|---------|------|
| 微信凭证 | 按微信用户 | 每个微信用户独立存储 |
| Agent 配置 | 按 Agent | 每个 Agent 独立存储 |
| 记忆 | 按 Agent | 多微信用户共享同一 Agent 时共享记忆 |
| 工作空间 | 按 Agent | 多微信用户共享同一 Agent 时共享工作空间 |
| 会话上下文 | 按 (Agent, 微信用户) | 即使共享 Agent，每个用户的会话独立 |

### 6.2 安全验证

```typescript
// 数据访问验证

class SecurityValidator {
  /**
   * 验证微信用户是否有权访问指定 Agent
   */
  async canAccessAgent(wechatId: string, agentId: string): Promise<boolean> {
    const bindings = await wechatManager.getBindings(wechatId);
    return bindings?.agents.some(b => b.agentId === agentId) || false;
  }

  /**
   * 验证是否为 Agent 创建者
   */
  async isAgentOwner(wechatId: string, agentId: string): Promise<boolean> {
    const agent = await agentManager.getAgent(agentId);
    return agent?.primaryWechatId === wechatId;
  }

  /**
   * 验证是否为创世 Agent
   */
  async isFounderAgent(agentId: string): Promise<boolean> {
    const founderId = await masterConfig.getFounderAgentId();
    return founderId === agentId;
  }
}
```

---

*文档版本：v1.0*  
*最后更新：2026-03-31*
