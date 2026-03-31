# Agent 共享与绑定机制补充设计

## 1. 问题陈述

当前设计缺少：
- Agent 级别的共享/私有设置
- 用户绑定他人创建的 Agent 的流程
- 共享权限控制（谁可以绑定我的Agent）

## 2. Agent 可共享属性

### 2.1 扩展 Agent 配置

```typescript
// src/agent/types.ts

export interface AgentConfig {
  // ... 现有字段 ...
  
  /**
   * Agent 可见性
   */
  visibility: 'private' | 'shared' | 'invite_only';
  
  /**
   * 可绑定用户限制
   * - undefined/null: 无限制
   * - string[]: 仅限指定微信用户ID
   */
  allowedWechatIds?: string[];
  
  /**
   * 最大绑定用户数
   */
  maxBindings: number;
  
  /**
   * 当前绑定用户数
   */
  currentBindingCount: number;
}

/**
 * 可见性类型
 */
export enum AgentVisibility {
  /** 私有 - 仅创建者可使用 */
  PRIVATE = 'private',
  /** 共享 - 任何知道AgentID的用户都可绑定 */
  SHARED = 'shared',
  /** 邀请制 - 需要创建者批准 */
  INVITE_ONLY = 'invite_only',
}
```

## 3. 绑定已有Agent流程

### 3.1 CLI 命令扩展

```typescript
// src/cli/agent.ts

program
  .command('bind <agentId>')
  .description('绑定一个已有的Agent')
  .option('-w, --wechat <id>', '指定微信用户ID')
  .action(async (agentId, options) => {
    const wechatId = options.wechat || await selectWechatAccount();
    
    // 检查Agent是否存在
    const agent = await agentManager.getAgent(agentId);
    if (!agent) {
      console.error(`Agent 不存在: ${agentId}`);
      process.exit(1);
    }
    
    // 检查权限
    const canBind = await agentManager.canBind(agentId, wechatId);
    if (!canBind) {
      console.error('无法绑定此Agent：' + await agentManager.getBindRejectionReason(agentId, wechatId));
      process.exit(1);
    }
    
    // 执行绑定
    await wechatManager.bindAgent(wechatId, agentId, false);
    await agentManager.incrementBindingCount(agentId);
    
    console.log(`✅ 成功绑定 Agent: ${agent.name}`);
    console.log(`   ID: ${agentId}`);
    console.log(`   创建者: ${agent.primaryWechatId}`);
    
    // 如果绑定的是自己的账号，询问是否设为默认
    if (await confirm('是否设为默认Agent?')) {
      await wechatManager.setDefaultAgent(wechatId, agentId);
    }
  });

program
  .command('share <agentId>')
  .description('设置Agent的共享属性')
  .requiredOption('-v, --visibility <type>', '可见性: private/shared/invite_only')
  .option('-m, --max <number>', '最大绑定用户数', '5')
  .action(async (agentId, options) => {
    const wechatId = await getCurrentWechatId();
    
    // 验证所有权
    const isOwner = await agentManager.isAgentOwner(wechatId, agentId);
    if (!isOwner) {
      console.error('只有Agent创建者可以修改共享设置');
      process.exit(1);
    }
    
    await agentManager.updateAgent(agentId, {
      visibility: options.visibility,
      maxBindings: parseInt(options.max),
    });
    
    console.log(`✅ Agent ${agentId} 共享设置已更新:`);
    console.log(`   可见性: ${options.visibility}`);
    console.log(`   最大绑定数: ${options.max}`);
  });

program
  .command('invite <agentId> <wechatId>')
  .description('邀请指定用户绑定你的Agent (invite_only模式)')
  .action(async (agentId, targetWechatId) => {
    const ownerWechatId = await getCurrentWechatId();
    
    await agentManager.addAllowedUser(agentId, targetWechatId);
    console.log(`✅ 已邀请 ${targetWechatId} 绑定 Agent ${agentId}`);
    console.log('对方可以使用以下命令绑定:');
    console.log(`   npm run agent:bind ${agentId}`);
  });
```

### 3.2 交互式绑定流程

```typescript
// src/login/index.ts (更新版)

async function main() {
  // ... 登录流程 ...
  
  // 检查是否已有绑定的 Agent
  const existingBindings = await wechatManager.getBindings(wechatId);

  if (existingBindings && existingBindings.agents.length > 0) {
    console.log(`\n您已有 ${existingBindings.agents.length} 个绑定的 Agent`);
    
    const choices = [
      { name: '使用现有Agent', value: 'existing' },
      { name: '创建新Agent', value: 'create' },
      { name: '绑定他人的Agent', value: 'bind' },
    ];
    
    const action = await select('请选择:', choices);
    
    switch (action) {
      case 'existing':
        await selectAndSwitchAgent(wechatId, existingBindings);
        break;
      case 'create':
        await createNewAgent(wechatId, isFirstLogin);
        break;
      case 'bind':
        await bindExistingAgent(wechatId);
        break;
    }
  } else {
    // 首次绑定
    const choices = [
      { name: '创建新Agent', value: 'create' },
      { name: '绑定他人的Agent (需要Agent ID)', value: 'bind' },
    ];
    
    const action = await select('请选择:', choices);
    
    if (action === 'create') {
      await createNewAgent(wechatId, isFirstLogin);
    } else {
      await bindExistingAgent(wechatId);
    }
  }
}

/**
 * 绑定已有的Agent
 */
async function bindExistingAgent(wechatId: string): Promise<void> {
  const agentId = await input('请输入要绑定的Agent ID:');
  
  const agent = await agentManager.getAgent(agentId);
  if (!agent) {
    console.error('Agent 不存在');
    return;
  }
  
  // 检查是否可以绑定
  const canBind = await agentManager.canBind(agentId, wechatId);
  if (!canBind) {
    const reason = await agentManager.getBindRejectionReason(agentId, wechatId);
    console.error(`无法绑定: ${reason}`);
    return;
  }
  
  console.log(`\nAgent 信息:`);
  console.log(`  名称: ${agent.name}`);
  console.log(`  创建者: ${agent.primaryWechatId}`);
  console.log(`  当前绑定用户数: ${agent.currentBindingCount}/${agent.maxBindings}`);
  
  if (await confirm('确认绑定此Agent?')) {
    await wechatManager.bindAgent(wechatId, agentId, true);
    await agentManager.incrementBindingCount(agentId);
    console.log('✅ 绑定成功!');
  }
}
```

## 4. 权限检查实现

```typescript
// src/agent/manager.ts (新增方法)

export class AgentManager {
  // ... 现有方法 ...

  /**
   * 检查微信用户是否可以绑定指定Agent
   */
  async canBind(agentId: string, wechatId: string): Promise<boolean> {
    const agent = await this.getAgent(agentId);
    if (!agent) return false;
    
    // 检查是否已满
    if (agent.currentBindingCount >= agent.maxBindings) {
      return false;
    }
    
    // 检查是否已绑定
    const bindings = await this.wechatManager.getBindings(wechatId);
    if (bindings?.agents.some(b => b.agentId === agentId)) {
      return false; // 已绑定
    }
    
    switch (agent.visibility) {
      case 'private':
        // 私有：只有创建者可以绑定（但创建者已经绑定了，所以返回false）
        return false;
        
      case 'shared':
        // 共享：任何人都可以绑定
        return true;
        
      case 'invite_only':
        // 邀请制：检查是否在允许列表中
        return agent.allowedWechatIds?.includes(wechatId) || false;
        
      default:
        return false;
    }
  }

  /**
   * 获取无法绑定的原因
   */
  async getBindRejectionReason(agentId: string, wechatId: string): Promise<string> {
    const agent = await this.getAgent(agentId);
    if (!agent) return 'Agent 不存在';
    
    if (agent.currentBindingCount >= agent.maxBindings) {
      return 'Agent 已达到最大绑定用户数';
    }
    
    const bindings = await this.wechatManager.getBindings(wechatId);
    if (bindings?.agents.some(b => b.agentId === agentId)) {
      return '您已绑定此 Agent';
    }
    
    switch (agent.visibility) {
      case 'private':
        return '此 Agent 为私有，不接受绑定';
      case 'invite_only':
        return '此 Agent 为邀请制，您不在允许列表中';
      default:
        return '无法绑定';
    }
  }

  /**
   * 增加绑定计数
   */
  async incrementBindingCount(agentId: string): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (agent) {
      agent.currentBindingCount++;
      await this.updateAgent(agentId, {
        currentBindingCount: agent.currentBindingCount,
      });
    }
  }

  /**
   * 减少绑定计数
   */
  async decrementBindingCount(agentId: string): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (agent && agent.currentBindingCount > 0) {
      agent.currentBindingCount--;
      await this.updateAgent(agentId, {
        currentBindingCount: agent.currentBindingCount,
      });
    }
  }

  /**
   * 添加允许绑定的用户 (invite_only模式)
   */
  async addAllowedUser(agentId: string, wechatId: string): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) return;
    
    if (!agent.allowedWechatIds) {
      agent.allowedWechatIds = [];
    }
    
    if (!agent.allowedWechatIds.includes(wechatId)) {
      agent.allowedWechatIds.push(wechatId);
      await this.updateAgent(agentId, {
        allowedWechatIds: agent.allowedWechatIds,
      });
    }
  }
}
```

## 5. 微信端绑定命令

```typescript
// 微信端支持的绑定相关命令

const BINDING_COMMANDS = {
  // 列出可绑定的公共Agent
  '/agent discover': async (ctx) => {
    // 返回 visibility=shared 的Agent列表
    const sharedAgents = await ctx.agentManager.listSharedAgents();
    return `可绑定的公共Agent:\n${sharedAgents.map(a => 
      `- ${a.name} (${a.id}) - 绑定数: ${a.currentBindingCount}/${a.maxBindings}`
    ).join('\n')}`;
  },

  // 绑定指定Agent
  '/agent bind <agentId>': async (ctx, agentId) => {
    const canBind = await ctx.agentManager.canBind(agentId, ctx.wechatId);
    if (!canBind) {
      const reason = await ctx.agentManager.getBindRejectionReason(agentId, ctx.wechatId);
      return `❌ 无法绑定: ${reason}`;
    }
    
    await ctx.wechatManager.bindAgent(ctx.wechatId, agentId, false);
    await ctx.agentManager.incrementBindingCount(agentId);
    
    const agent = await ctx.agentManager.getAgent(agentId);
    return `✅ 成功绑定 Agent: ${agent?.name}`;
  },

  // 解绑Agent (保留数据，仅解除绑定关系)
  '/agent unbind <agentId>': async (ctx, agentId) => {
    // 检查是否为所有者
    const isOwner = await ctx.agentManager.isAgentOwner(ctx.wechatId, agentId);
    if (isOwner) {
      return '❌ 您是此Agent的创建者，无法解绑。如要删除请使用 /agent delete';
    }
    
    await ctx.wechatManager.unbindAgent(ctx.wechatId, agentId);
    await ctx.agentManager.decrementBindingCount(agentId);
    
    return '✅ 已解绑 Agent';
  },

  // 查看我的Agent的绑定情况 (仅所有者)
  '/agent bindings <agentId>': async (ctx, agentId) => {
    const isOwner = await ctx.agentManager.isAgentOwner(ctx.wechatId, agentId);
    if (!isOwner) {
      return '❌ 只有Agent创建者可查看绑定情况';
    }
    
    const agent = await ctx.agentManager.getAgent(agentId);
    const bindings = await ctx.wechatManager.getAllBindingsForAgent(agentId);
    
    return `Agent ${agent?.name} 的绑定情况:\n` +
           `可见性: ${agent?.visibility}\n` +
           `绑定用户: ${bindings.length}/${agent?.maxBindings}\n` +
           bindings.map(b => `- ${b.wechatId} ${b.isDefault ? '(默认)' : ''}`).join('\n');
  },
};
```

## 6. 默认行为（推荐设置）

```typescript
// 默认Agent配置
export const DEFAULT_AGENT_CONFIG = {
  // ... 其他默认配置 ...
  
  visibility: 'private' as const,  // 默认私有
  maxBindings: 1,                   // 默认只允许创建者绑定
  currentBindingCount: 0,
};

// 创建Agent时的交互式选择
async function promptVisibility(): Promise<AgentVisibility> {
  console.log('\n设置Agent可见性:');
  console.log('  1. private - 仅自己使用 (默认推荐)');
  console.log('  2. shared - 任何人都可以绑定');
  console.log('  3. invite_only - 仅邀请的用户可以绑定');
  
  const choice = await question('请选择 (1-3, 默认: 1): ');
  
  switch (choice.trim()) {
    case '2': return AgentVisibility.SHARED;
    case '3': return AgentVisibility.INVITE_ONLY;
    default: return AgentVisibility.PRIVATE;
  }
}
```

## 7. 流程总结

```
用户登录
   │
   ▼
已有Agent? ──否──► 创建新Agent? ──否──► 绑定他人Agent?
   │                                    │
   是                                   ▼
   │                              输入Agent ID
   ▼                                    │
选择使用方式                      检查权限
   │                                    │
┌──┴──────────┐                  允许绑定?
│ • 现有Agent  │                      │
│ • 创建新Agent│                   是─┴─否─► 显示错误
│ • 绑定其他   │                      │
└─────────────┘                       ▼
                                  绑定成功
```

---

*此文档为 Phase III 补充设计*  
*最后更新：2026-03-31*
