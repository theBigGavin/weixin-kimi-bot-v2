/**
 * 日志模块单元测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  createLogger, 
  getDefaultLogger, 
  createAgentLogger, 
  createRequestLogger,
  initLoggerConfig,
  getLoggerConfig,
  trace,
  debug,
  info,
  warn,
  error,
  fatal,
} from '../../../src/logging/index.js';
import type { LogLevel, LoggerConfig, LogContext } from '../../../src/logging/types.js';
import { LOG_LEVEL_PRIORITY } from '../../../src/logging/types.js';
import { setBaseDir, resetBaseDir } from '../../../src/paths.js';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

describe('logging', () => {
  const testDir = join(os.tmpdir(), `weixin-kimi-bot-test-${Date.now()}`);

  beforeEach(() => {
    setBaseDir(testDir);
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }
    // Reset logger config for each test
    initLoggerConfig({
      level: 'debug',
      fileEnabled: false,
      colorize: false,
    });
  });

  afterEach(() => {
    resetBaseDir();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('createLogger', () => {
    it('应该创建带有上下文的日志记录器', () => {
      const context: LogContext = { agentId: 'test-agent', requestId: 'req-123' };
      const logger = createLogger(context);
      
      expect(logger).toBeDefined();
      expect(logger.context).toEqual(context);
    });

    it('应该支持子日志记录器', () => {
      const parentContext: LogContext = { agentId: 'parent-agent' };
      const parent = createLogger(parentContext);
      
      const childContext: LogContext = { requestId: 'child-req' };
      const child = parent.child(childContext);
      
      expect(child.context).toEqual({
        agentId: 'parent-agent',
        requestId: 'child-req',
      });
    });
  });

  describe('createAgentLogger', () => {
    it('应该创建带有 agentId 的日志记录器', () => {
      const logger = createAgentLogger('agent-123');
      
      expect(logger).toBeDefined();
      expect(logger.context.agentId).toBe('agent-123');
    });

    it('应该支持 wechatId 参数', () => {
      const logger = createAgentLogger('agent-123', 'wxid_test');
      
      expect(logger.context.agentId).toBe('agent-123');
      expect(logger.context.wechatId).toBe('wxid_test');
    });
  });

  describe('createRequestLogger', () => {
    it('应该创建带有 requestId 的日志记录器', () => {
      const logger = createRequestLogger('req-456');
      
      expect(logger).toBeDefined();
      expect(logger.context.requestId).toBe('req-456');
    });

    it('应该支持 agentId 参数', () => {
      const logger = createRequestLogger('req-456', 'agent-123');
      
      expect(logger.context.requestId).toBe('req-456');
      expect(logger.context.agentId).toBe('agent-123');
    });
  });

  describe('getDefaultLogger', () => {
    it('应该返回单例日志记录器', () => {
      const logger1 = getDefaultLogger();
      const logger2 = getDefaultLogger();
      
      expect(logger1).toBe(logger2);
    });
  });

  describe('initLoggerConfig', () => {
    it('应该更新全局日志配置', () => {
      initLoggerConfig({
        level: 'error',
        fileEnabled: true,
      });
      
      const config = getLoggerConfig();
      expect(config.level).toBe('error');
      expect(config.fileEnabled).toBe(true);
    });

    it('应该设置日志目录', () => {
      const logDir = join(testDir, 'custom-logs');
      initLoggerConfig({
        logDir,
        fileEnabled: true,
      });
      
      const config = getLoggerConfig();
      expect(config.logDir).toBe(logDir);
    });
  });

  describe('快捷函数', () => {
    it('应该支持 trace 快捷函数', () => {
      const logger = getDefaultLogger();
      const spy = vi.spyOn(logger, 'trace').mockImplementation(() => {});
      
      trace('test message');
      
      expect(spy).toHaveBeenCalledWith('test message');
    });

    it('应该支持 debug 快捷函数', () => {
      const logger = getDefaultLogger();
      const spy = vi.spyOn(logger, 'debug').mockImplementation(() => {});
      
      debug('test message');
      
      expect(spy).toHaveBeenCalledWith('test message');
    });

    it('应该支持 info 快捷函数', () => {
      const logger = getDefaultLogger();
      const spy = vi.spyOn(logger, 'info').mockImplementation(() => {});
      
      info('test message');
      
      expect(spy).toHaveBeenCalledWith('test message');
    });

    it('应该支持 warn 快捷函数', () => {
      const logger = getDefaultLogger();
      const spy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      
      warn('test message');
      
      expect(spy).toHaveBeenCalledWith('test message');
    });

    it('应该支持 error 快捷函数', () => {
      const logger = getDefaultLogger();
      const spy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      
      error('test message');
      
      expect(spy).toHaveBeenCalledWith('test message');
    });

    it('应该支持 fatal 快捷函数', () => {
      const logger = getDefaultLogger();
      const spy = vi.spyOn(logger, 'fatal').mockImplementation(() => {});
      
      fatal('test message');
      
      expect(spy).toHaveBeenCalledWith('test message');
    });
  });

  describe('LOG_LEVEL_PRIORITY', () => {
    it('应该有正确的优先级顺序', () => {
      expect(LOG_LEVEL_PRIORITY.trace).toBe(10);
      expect(LOG_LEVEL_PRIORITY.debug).toBe(20);
      expect(LOG_LEVEL_PRIORITY.info).toBe(30);
      expect(LOG_LEVEL_PRIORITY.warn).toBe(40);
      expect(LOG_LEVEL_PRIORITY.error).toBe(50);
      expect(LOG_LEVEL_PRIORITY.fatal).toBe(60);
    });
  });

  describe('日志级别过滤', () => {
    it('应该根据配置级别过滤日志', () => {
      initLoggerConfig({ level: 'warn', fileEnabled: false });
      const logger = createLogger();
      
      // info 级别低于 warn，应该被过滤
      expect(logger.level).toBe('warn');
    });
  });
});
