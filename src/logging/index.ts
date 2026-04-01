/**
 * 日志模块主实现
 * 
 * 基于 pino 的日志封装，提供统一的日志接口
 * 
 * 使用示例：
 * ```typescript
 * import { createLogger, getDefaultLogger } from './logging/index.js';
 * 
 * // 创建带上下文的日志记录器
 * const logger = createLogger({ agentId: 'agent_123' });
 * logger.info('消息已收到', { content: 'hello' });
 * 
 * // 或使用默认日志记录器
 * const log = getDefaultLogger();
 * log.error('发生错误', error);
 * ```
 */

import pino, { type Logger as PinoLogger } from 'pino';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { format } from 'util';
import type { Logger, LoggerConfig, LogContext, LogLevel } from './types.js';
import { DEFAULT_LOGGER_CONFIG, LOG_LEVEL_PRIORITY } from './types.js';
import { getBaseDir } from '../paths.js';

// ===== 内部状态 =====

let defaultLogger: Logger | null = null;
let globalConfig: LoggerConfig = { ...DEFAULT_LOGGER_CONFIG };

// ===== 工具函数 =====

/**
 * 获取环境对应的日志配置
 */
function getEnvConfig(): Partial<LoggerConfig> {
  const env = process.env.NODE_ENV;
  
  switch (env) {
    case 'test':
      return {
        level: 'error',
        colorize: false,
        fileEnabled: false,
        env: 'test',
      };
    case 'production':
      return {
        level: 'info',
        colorize: false,
        fileEnabled: true,
        env: 'production',
      };
    default:
      return {
        level: 'debug',
        colorize: true,
        fileEnabled: true,
        env: 'development',
      };
  }
}

/**
 * 确保日志目录存在
 */
function ensureLogDir(logDir: string): void {
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
}

/**
 * 获取日志文件路径
 */
function getLogFilePath(logDir: string): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return join(logDir, `app-${date}.log`);
}

/**
 * 检查当前日志级别是否满足最低级别要求
 */
function isLevelEnabled(currentLevel: LogLevel, targetLevel: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[currentLevel] <= LOG_LEVEL_PRIORITY[targetLevel];
}

// ===== Logger 实现 =====

class PinoLoggerWrapper implements Logger {
  private readonly pinoLogger: PinoLogger;
  private readonly config: LoggerConfig;
  private readonly ctx: LogContext;

  constructor(pinoLogger: PinoLogger, config: LoggerConfig, context: LogContext = {}) {
    this.pinoLogger = pinoLogger;
    this.config = config;
    this.ctx = { ...context };
  }

  get level(): LogLevel {
    return this.config.level;
  }

  get context(): LogContext {
    return { ...this.ctx };
  }

  child(context: LogContext): Logger {
    const mergedContext = { ...this.ctx, ...context };
    const childLogger = this.pinoLogger.child(mergedContext);
    return new PinoLoggerWrapper(childLogger, this.config, mergedContext);
  }

  private log(level: LogLevel, message: string, args: unknown[]): void {
    if (!isLevelEnabled(this.config.level, level)) {
      return;
    }

    // 格式化消息（支持 util.format 风格）
    const formattedMessage = args.length > 0 ? format(message, ...args) : message;

    // 提取最后一个参数作为结构化数据（如果是对象）
    const lastArg = args[args.length - 1];
    const mergeObject = typeof lastArg === 'object' && lastArg !== null && !(lastArg instanceof Error)
      ? lastArg as Record<string, unknown>
      : undefined;

    // 调用 pino 记录日志
    switch (level) {
      case 'trace':
        this.pinoLogger.trace(mergeObject, formattedMessage);
        break;
      case 'debug':
        this.pinoLogger.debug(mergeObject, formattedMessage);
        break;
      case 'info':
        this.pinoLogger.info(mergeObject, formattedMessage);
        break;
      case 'warn':
        this.pinoLogger.warn(mergeObject, formattedMessage);
        break;
      case 'error':
        this.pinoLogger.error(mergeObject, formattedMessage);
        break;
      case 'fatal':
        this.pinoLogger.fatal(mergeObject, formattedMessage);
        break;
    }
  }

  trace(message: string, ...args: unknown[]): void {
    this.log('trace', message, args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, args);
  }

  info(message: string, ...args: unknown[]): void {
    this.log('info', message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, args);
  }

  error(message: string, ...args: unknown[]): void {
    this.log('error', message, args);
  }

  fatal(message: string, ...args: unknown[]): void {
    this.log('fatal', message, args);
  }
}

// ===== 工厂函数 =====

/**
 * 初始化全局日志配置
 * @param config 日志配置（部分）
 */
export function initLoggerConfig(config?: Partial<LoggerConfig>): void {
  const envConfig = getEnvConfig();
  const logDir = config?.logDir || join(getBaseDir(), 'logs');
  
  globalConfig = {
    ...DEFAULT_LOGGER_CONFIG,
    ...envConfig,
    ...config,
    logDir,
  };

  // 如果启用了文件日志，确保目录存在
  if (globalConfig.fileEnabled) {
    ensureLogDir(globalConfig.logDir);
  }

  // 重置默认日志记录器，以便下次获取时使用新配置
  defaultLogger = null;
}

/**
 * 获取当前日志配置
 */
export function getLoggerConfig(): LoggerConfig {
  return { ...globalConfig };
}

/**
 * 创建 pino 实例
 */
function createPinoInstance(config: LoggerConfig, context: LogContext = {}): PinoLogger {
  // 控制台输出配置
  const consoleTarget: pino.TransportTargetOptions = {
    target: 'pino-pretty',
    options: {
      colorize: config.colorize,
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss.l',
      ignore: 'pid,hostname',
      messageFormat: '{msg}',
    },
    level: config.level,
  };

  // 构建 transports
  const transportTargets: pino.TransportTargetOptions[] = [consoleTarget];

  // 如果启用文件日志，添加文件输出
  if (config.fileEnabled) {
    const logFilePath = getLogFilePath(config.logDir);
    transportTargets.push({
      target: 'pino/file',
      options: {
        destination: logFilePath,
        mkdir: true,
      },
      level: config.level,
    });
  }

  // 创建 pino 实例
  return pino({
    level: config.level,
    base: {
      env: config.env,
      ...context,
    },
  }, pino.transport({
    targets: transportTargets,
  }));
}

/**
 * 创建日志记录器
 * @param context 日志上下文
 * @param config 自定义配置（可选，默认使用全局配置）
 */
export function createLogger(context?: LogContext, config?: Partial<LoggerConfig>): Logger {
  // 合并配置
  const mergedConfig: LoggerConfig = config
    ? { ...globalConfig, ...config }
    : globalConfig;

  // 确保日志目录存在
  if (mergedConfig.fileEnabled) {
    ensureLogDir(mergedConfig.logDir);
  }

  const pinoInstance = createPinoInstance(mergedConfig, context);
  return new PinoLoggerWrapper(pinoInstance, mergedConfig, context);
}

/**
 * 获取默认日志记录器（单例）
 */
export function getDefaultLogger(): Logger {
  if (!defaultLogger) {
    // 自动初始化配置（如果还没有初始化）
    if (!globalConfig.logDir) {
      initLoggerConfig();
    }
    defaultLogger = createLogger();
  }
  return defaultLogger;
}

/**
 * 创建带 Agent 上下文的日志记录器
 * @param agentId Agent ID
 * @param wechatId 微信账号 ID（可选）
 */
export function createAgentLogger(agentId: string, wechatId?: string): Logger {
  const context: LogContext = { agentId };
  if (wechatId) {
    context.wechatId = wechatId;
  }
  return createLogger(context);
}

/**
 * 创建带请求上下文的日志记录器
 * @param requestId 请求 ID
 * @param agentId Agent ID（可选）
 */
export function createRequestLogger(requestId: string, agentId?: string): Logger {
  const context: LogContext = { requestId };
  if (agentId) {
    context.agentId = agentId;
  }
  return createLogger(context);
}

// ===== 快捷函数（直接使用默认日志记录器） =====

/** 追踪级别日志 */
export function trace(message: string, ...args: unknown[]): void {
  getDefaultLogger().trace(message, ...args);
}

/** 调试级别日志 */
export function debug(message: string, ...args: unknown[]): void {
  getDefaultLogger().debug(message, ...args);
}

/** 信息级别日志 */
export function info(message: string, ...args: unknown[]): void {
  getDefaultLogger().info(message, ...args);
}

/** 警告级别日志 */
export function warn(message: string, ...args: unknown[]): void {
  getDefaultLogger().warn(message, ...args);
}

/** 错误级别日志 */
export function error(message: string, ...args: unknown[]): void {
  getDefaultLogger().error(message, ...args);
}

/** 致命错误级别日志 */
export function fatal(message: string, ...args: unknown[]): void {
  getDefaultLogger().fatal(message, ...args);
}

// ===== 初始化 =====

// 增加进程监听器限制，避免 pino transport 引起的 MaxListenersExceededWarning
process.setMaxListeners(20);

// 模块加载时自动初始化
initLoggerConfig();
