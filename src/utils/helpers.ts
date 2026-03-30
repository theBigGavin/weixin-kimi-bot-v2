/**
 * 工具函数集合
 * 
 * 提供通用的工具函数，包括日期格式化、字符串处理、对象操作等
 */

/**
 * 格式化日期
 * @param date 日期对象或时间戳
 * @param format 格式模板，默认 'YYYY-MM-DD'
 * @returns 格式化后的日期字符串
 */
export function formatDate(date: Date | number, format: string = 'YYYY-MM-DD'): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day);
}

/**
 * 格式化时间戳（包含时间）
 * @param date 日期对象或时间戳
 * @returns 格式化后的时间字符串 'YYYY-MM-DD HH:mm:ss'
 */
export function formatTimestamp(date: Date | number): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const dateStr = formatDate(d, 'YYYY-MM-DD');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${dateStr} ${hours}:${minutes}:${seconds}`;
}

/**
 * 截断字符串
 * @param str 原始字符串
 * @param maxLength 最大长度
 * @param suffix 后缀，默认 '...'
 * @returns 截断后的字符串
 */
export function truncateString(str: string, maxLength: number, suffix: string = '...'): string {
  if (str.length <= maxLength) {
    return str;
  }
  // 确保至少保留2个字符，避免内容完全消失
  const minContentLength = Math.min(2, maxLength);
  const contentLength = Math.max(minContentLength, maxLength - suffix.length);
  return str.slice(0, contentLength) + suffix;
}

/**
 * 清理文件名中的非法字符
 * @param filename 原始文件名
 * @returns 清理后的文件名
 */
export function sanitizeFilename(filename: string): string {
  // Windows 和 Unix 的非法字符
  const illegalChars = /[<>:"|?*]/g;
  return filename.replace(illegalChars, '_');
}

/**
 * 深克隆对象或数组
 * @param obj 要克隆的对象
 * @returns 克隆后的对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }

  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

/**
 * 深度合并两个对象
 * @param target 目标对象
 * @param source 源对象
 * @returns 合并后的新对象
 */
export function deepMerge<T extends Record<string, unknown>, U extends Record<string, unknown>>(
  target: T,
  source: U
): T & U {
  const result = deepClone(target) as Record<string, unknown>;

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (isObject(sourceValue) && isObject(targetValue)) {
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
      } else {
        result[key] = deepClone(sourceValue);
      }
    }
  }

  return result as T & U;
}

/**
 * 检查值是否为普通对象（非数组、非null）
 * @param value 要检查的值
 * @returns 是否为对象
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 异步睡眠
 * @param ms 毫秒数
 * @returns Promise
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 重试异步函数
 * @param fn 要执行的函数
 * @param options 重试选项
 * @returns 函数执行结果
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxAttempts: number; delay?: number } = { maxAttempts: 3, delay: 1000 }
): Promise<T> {
  const { maxAttempts, delay = 1000 } = options;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts && delay > 0) {
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * 安全解析 JSON
 * @param json JSON 字符串
 * @returns 解析后的对象，失败返回 null
 */
export function parseJsonSafe<T = unknown>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * 计算字符串的简单哈希值
 * @param str 输入字符串
 * @returns 16进制哈希字符串
 */
export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  // 转换为16进制字符串，确保正数
  return Math.abs(hash).toString(16).padStart(16, '0');
}
