/**
 * 内置能力定义
 */

import { CreateCapabilityParams } from '../types.js';
import { ExecutionMode } from '../../types.js';

export const BUILTIN_CAPABILITIES: CreateCapabilityParams[] = [
  {
    id: 'code-analyzer',
    description: '分析代码结构、质量、复杂度，生成分析报告',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: '分析目标路径' },
        depth: { type: 'string', description: '分析深度', enum: ['shallow', 'deep'], default: 'shallow' },
        metrics: { type: 'array', description: '要分析的指标', items: { type: 'string' } },
      },
      required: ['target'],
    },
    allowedModes: [ExecutionMode.DIRECT, ExecutionMode.LONGTASK],
    maxDuration: 600000,
    requireConfirmation: false,
  },
  {
    id: 'code-refactorer',
    description: '执行代码重构，优化代码结构和质量',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: '重构目标路径' },
        strategy: { type: 'string', description: '重构策略', enum: ['gradual', 'aggressive'], default: 'gradual' },
        preserveBehavior: { type: 'boolean', description: '是否保持行为不变', default: true },
      },
      required: ['target'],
    },
    allowedModes: [ExecutionMode.LONGTASK, ExecutionMode.FLOWTASK],
    maxDuration: 3600000,
    requireConfirmation: true,
  },
  {
    id: 'test-runner',
    description: '运行测试套件，生成测试报告',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: '测试范围' },
        failFast: { type: 'boolean', description: '是否快速失败', default: false },
        coverage: { type: 'boolean', description: '是否生成覆盖率', default: true },
      },
      required: ['scope'],
    },
    allowedModes: [ExecutionMode.DIRECT, ExecutionMode.LONGTASK],
    maxDuration: 600000,
    requireConfirmation: false,
  },
  {
    id: 'file-operator',
    description: '执行文件读写、复制、移动等操作',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string', description: '操作类型', enum: ['read', 'write', 'copy', 'move', 'delete', 'list'] },
        source: { type: 'string', description: '源路径' },
        destination: { type: 'string', description: '目标路径' },
        content: { type: 'string', description: '写入内容' },
      },
      required: ['operation', 'source'],
    },
    allowedModes: [ExecutionMode.DIRECT],
    maxDuration: 60000,
    requireConfirmation: false,
  },
  {
    id: 'search-provider',
    description: '执行代码搜索、文件搜索、内容搜索',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索查询' },
        type: { type: 'string', description: '搜索类型', enum: ['code', 'file', 'content'], default: 'code' },
        scope: { type: 'string', description: '搜索范围', default: '.' },
      },
      required: ['query'],
    },
    allowedModes: [ExecutionMode.DIRECT, ExecutionMode.LONGTASK],
    maxDuration: 300000,
    requireConfirmation: false,
  },
  {
    id: 'notification-sender',
    description: '发送通知消息到各种渠道',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '消息内容' },
        channels: { type: 'array', description: '通知渠道', items: { type: 'string', enum: ['wechat', 'email', 'console'] }, default: ['console'] },
        priority: { type: 'string', description: '优先级', enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
      },
      required: ['message'],
    },
    allowedModes: [ExecutionMode.DIRECT],
    maxDuration: 30000,
    requireConfirmation: false,
  },
  {
    id: 'scheduler',
    description: '创建和管理定时任务',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: '操作类型', enum: ['create', 'cancel', 'list', 'update'] },
        task: {
          type: 'object',
          description: '任务配置',
          properties: {
            type: { type: 'string', enum: ['ONCE', 'INTERVAL', 'CRON'] },
            schedule: { type: 'string', description: '调度表达式' },
            handler: { type: 'string', description: '处理器名称' },
            data: { type: 'object', description: '任务数据' },
          },
        },
      },
      required: ['action'],
    },
    allowedModes: [ExecutionMode.DIRECT],
    maxDuration: 60000,
    requireConfirmation: false,
  },
];
