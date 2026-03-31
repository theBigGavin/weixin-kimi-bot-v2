/**
 * Login Script
 * 
 * 完整的登录流程：
 * 1. 扫码登录获取微信账号
 * 2. 交互式配置 Agent（名称、模板）
 * 3. 使用新的 ID 格式创建 Agent
 * 4. 创建正确的目录结构
 * 
 * 目录结构：
 * ~/.weixin-kimi-bot/
 * ├── agents/{agent_id}/
 * │   ├── config.json
 * │   ├── memory.json
 * │   ├── credentials.json  (微信凭证)
 * │   ├── context/
 * │   └── workspace/
 * └── master-config.json
 */

import qrterm from 'qrcode-terminal';
import readline from 'node:readline';
import { loginWithQR } from './auth/index.js';
import { AgentManager } from './agent/manager.js';
import { FileStore } from './store.js';
import { Paths, getBaseDir } from './paths.js';
import { mkdir } from 'fs/promises';
import { writeFile } from 'fs/promises';
import { getTemplateById, listTemplates } from './templates/definitions.js';
import { TemplateType } from './agent/types.js';
import { loadMasterConfig } from './config/master-config.js';

// 创建 readline 接口
function createRL(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

// 提问封装
function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// 选择模板
async function selectTemplate(rl: readline.Interface): Promise<TemplateType> {
  console.log('\n📋 可用模板：');
  console.log('');
  
  const templates = listTemplates();
  templates.forEach((tpl, index) => {
    console.log(`  ${index + 1}. ${tpl.name} (${tpl.id})`);
    console.log(`     ${tpl.description}`);
    console.log('');
  });
  
  const answer = await ask(rl, '请选择模板 (1-' + templates.length + ', 默认 1): ');
  
  // 直接回车使用第一个模板
  if (answer === '') {
    console.log(`  → 使用默认: ${templates[0].name}`);
    return templates[0].id as TemplateType;
  }
  
  const index = parseInt(answer) - 1;
  
  if (isNaN(index) || index < 0 || index >= templates.length) {
    console.log(`  → 无效输入，使用默认: ${templates[0].name}`);
    return templates[0].id as TemplateType;
  }
  
  console.log(`  → 已选择: ${templates[index].name}`);
  return templates[index].id as TemplateType;
}

// 确认配置
async function confirmConfig(rl: readline.Interface, config: {
  name: string;
  templateId: string;
  wechatId: string;
}): Promise<boolean> {
  console.log('\n📋 配置确认：');
  console.log(`  名称: ${config.name}`);
  console.log(`  模板: ${config.templateId}`);
  console.log(`  微信: ${config.wechatId}`);
  
  const answer = await ask(rl, '\n确认创建? (y/n, 默认 y): ');
  return answer.toLowerCase() !== 'n';
}

async function main() {
  console.log('=== 微信 Kimi Bot 登录 ===\n');
  console.log('此流程将：');
  console.log('  1. 扫码登录微信账号');
  console.log('  2. 配置您的 AI Agent');
  console.log('  3. 创建数据目录\n');

  const rl = createRL();

  try {
    // ===== 步骤 1: 微信登录 =====
    console.log('--- 步骤 1: 微信登录 ---\n');
    
    const loginResult = await loginWithQR({
      onQRCode: (url: string) => {
        console.log('\n请使用微信扫描以下二维码：\n');
        qrterm.generate(url, { small: true });
        console.log(`\n如无法显示，请在浏览器打开: ${url}\n`);
      },
      onStatusChange: (status) => {
        switch (status) {
          case 'waiting':
            process.stdout.write('.');
            break;
          case 'scanned':
            console.log('\n\n已扫码，请在微信上确认...');
            break;
          case 'refreshing':
            console.log('\n二维码已过期，正在刷新...');
            break;
        }
      },
    });

    console.log('\n✅ 微信登录成功！');
    console.log(`  账号 ID: ${loginResult.accountId}`);
    if (loginResult.userId) {
      console.log(`  用户 ID: ${loginResult.userId}`);
    }

    // ===== 步骤 2: Agent 配置 =====
    console.log('\n--- 步骤 2: Agent 配置 ---\n');
    
    // 输入 Agent 名称
    const defaultName = '小助手';
    const nameInput = await ask(rl, `Agent 名称 (默认: ${defaultName}): `);
    const agentName = nameInput || defaultName;
    if (!nameInput) {
      console.log(`  → 使用默认名称: ${defaultName}`);
    }
    
    // 选择模板
    const templateId = await selectTemplate(rl);
    const template = getTemplateById(templateId);
    
    console.log(`\n已选择模板: ${template?.name || templateId}`);
    
    // 确认配置
    const config = {
      name: agentName,
      templateId: templateId,
      wechatId: loginResult.accountId,
    };
    
    const confirmed = await confirmConfig(rl, config);
    if (!confirmed) {
      console.log('\n❌ 已取消创建');
      rl.close();
      process.exit(0);
    }

    // ===== 步骤 3: 初始化系统配置 =====
    console.log('\n--- 步骤 3: 初始化系统配置 ---\n');
    
    // 初始化存储
    const baseDir = getBaseDir();
    await mkdir(baseDir, { recursive: true });
    
    // 创建/加载 master-config.json
    const masterConfig = await loadMasterConfig();
    console.log('✅ 系统配置已初始化');
    console.log(`  配置版本: ${masterConfig.version}`);
    console.log(`  默认模板: ${masterConfig.settings.defaultTemplateId}`);
    console.log(`  自动备份: ${masterConfig.settings.autoBackup ? '开启' : '关闭'}`);
    
    // ===== 步骤 4: 创建 Agent =====
    console.log('\n--- 步骤 4: 创建 Agent ---\n');
    
    const store = new FileStore(baseDir);
    const agentManager = new AgentManager(store);
    
    // 创建 Agent
    const agent = await agentManager.createAgent({
      name: agentName,
      wechatAccountId: loginResult.accountId,
      wechatNickname: loginResult.userId,
      templateId: templateId,
    });
    
    console.log('✅ Agent 创建成功！');
    console.log(`  Agent ID: ${agent.id}`);
    console.log(`  名称: ${agent.name}`);
    console.log(`  模板: ${agent.ai.templateId}`);
    
    // ===== 步骤 5: 保存微信凭证 =====
    console.log('\n--- 步骤 5: 保存微信凭证 ---\n');
    
    // 创建 Agent 目录结构
    const agentDir = Paths.agentDir(agent.id);
    const contextDir = Paths.agentContextDir(agent.id);
    const workspaceDir = Paths.agentWorkspace(agent.id);
    
    await mkdir(agentDir, { recursive: true });
    await mkdir(contextDir, { recursive: true });
    await mkdir(workspaceDir, { recursive: true });
    
    // 保存微信凭证到 Agent 目录
    const credentialsPath = `${agentDir}/credentials.json`;
    const credentials = {
      botToken: loginResult.botToken,
      accountId: loginResult.accountId,
      baseUrl: loginResult.baseUrl,
      userId: loginResult.userId,
      savedAt: new Date().toISOString(),
    };
    
    await writeFile(credentialsPath, JSON.stringify(credentials, null, 2), 'utf-8');
    
    // 初始化 memory.json
    const memoryPath = Paths.agentMemory(agent.id);
    const memory = {
      enabled: agent.memory.enabledL,
      items: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await writeFile(memoryPath, JSON.stringify(memory, null, 2), 'utf-8');
    
    console.log('✅ 目录结构创建完成');
    console.log(`  Agent 目录: ${agentDir}`);
    console.log(`  配置文件: ${Paths.agentConfig(agent.id)}`);
    console.log(`  凭证文件: ${credentialsPath}`);
    console.log(`  记忆文件: ${memoryPath}`);
    console.log(`  上下文目录: ${contextDir}`);
    console.log(`  工作空间: ${workspaceDir}`);
    
    // ===== 完成 =====
    console.log('\n=== 登录完成 ===\n');
    console.log('创建的数据目录：');
    console.log(`  ${baseDir}`);
    console.log('现在可以运行以下命令：');
    console.log('  npm start    - 启动 Bot');
    console.log('  npm run dev  - 开发模式启动\n');
    
    rl.close();
    
  } catch (err) {
    rl.close();
    console.error('\n❌ 登录失败:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
