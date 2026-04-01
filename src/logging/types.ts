/**
 * 日志模块类型定义
 * 
 * 提供统一的日志接口和配置类型
 */

/**
 * 日志级别
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * 日志上下文 - 用于追踪请求链路和添加结构化字段
 */
export interface LogContext {
  /** Agent ID */
  agentId?: string;
  /** 请求/消息 ID */
  requestId?: string;
  /** 微信账号 ID */
  wechatId?: string;
  /** 用户 ID */
  userId?: string;
  /** 任务 ID */
  taskId?: string;
  /** 流程 ID */
  flowId?: string;
  /** 其他自定义字段 */
  [key: string]: string | number | boolean | undefined;
}

/**
 * 日志配置
 */
export interface LoggerConfig {
  /** 日志级别 */
  level: LogLevel;
  /** 是否启用彩色输出（仅控制台） */
  colorize: boolean;
  /** 是否启用日志文件输出 */
  fileEnabled: boolean;
  /** 日志文件目录 */
  logDir: string;
  /** 是否按日期滚动日志 */
  rotateByDate: boolean;
  /** 保留日志天数 */
  retainDays: number;
  /** 环境名称 */
  env: 'development' | 'test' | 'production';
}

/**
 * 日志记录器接口
 */
export interface Logger {
  /**
   * 获取当前日志级别
   */
  readonly level: LogLevel;
  
  /**
   * 获取当前上下文
   */
  readonly context: LogContext;
  
  /**
   * 创建带上下文的子日志记录器
   * @param context 要绑定的上下文
   */
  child(context: LogContext): Logger;
  
  /**
   * 追踪级别日志（最详细）
   * @param message 日志消息
   * @param args 附加数据
   */
  trace(message: string, ...args: unknown[]): void;
  
  /**
   * 调试级别日志
   * @param message 日志消息
   * @param args 附加数据
   */
  debug(message: string, ...args: unknown[]): void;
  
  /**
   * 信息级别日志
   * @param message 日志消息
   * @param args 附加数据
   */
  info(message: string, ...args: unknown[]): void;
  
  /**
   * 警告级别日志
   * @param message 日志消息
   * @param args 附加数据
   */
  warn(message: string, ...args: unknown[]): void;
  
  /**
   * 错误级别日志
   * @param message 日志消息
   * @param args 附加数据
   */
  error(message: string, ...args: unknown[]): void;
  
  /**
   * 致命错误级别日志
   * @param message 日志消息
   * @param args 附加数据
   */
  fatal(message: string, ...args: unknown[]): void;
}

/**
 * 默认日志配置
 */
export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  level: 'info',
  colorize: true,
  fileEnabled: true,
  logDir: '',
  rotateByDate: true,
  retainDays: 7,
  env: 'development',
};

/**
 * 日志级别优先级（数字越大优先级越高）
 */
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};
