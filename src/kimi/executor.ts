/**
 * Kimi CLI Executor
 * 
 * Provides Kimi CLI command execution and output parsing
 */

import { spawn } from 'node:child_process';
import type { KimiError } from './types.js';

/**
 * Options for executing Kimi CLI
 */
export interface KimiExecutorOptions {
  /** The prompt to send to Kimi */
  prompt: string;
  /** Model to use (e.g., 'k1.5') */
  model?: string;
  /** Working directory */
  cwd?: string;
  /** System prompt */
  systemPrompt?: string;
  /** Session ID for multi-turn conversation */
  sessionId?: string;
  /** Maximum turns */
  maxTurns?: number;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Result of executing Kimi CLI
 */
export interface KimiExecutionResult {
  /** Response text */
  text: string;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Session ID for next turn (if available) */
  sessionId?: string;
  /** Error if execution failed */
  error?: KimiError;
}

/**
 * Build the Kimi CLI command string
 * @param params Command parameters
 * @returns Complete command string
 */
export function buildKimiCommand(params: KimiExecutorOptions): string {
  if (!params.prompt) {
    throw new Error('Prompt is required');
  }

  const parts: string[] = ['kimi'];

  if (params.model) {
    parts.push('--model', params.model);
  }

  if (params.cwd) {
    parts.push('--work-dir', params.cwd);
  }

  // Note: kimi CLI doesn't support --system-prompt
  // systemPrompt is reserved for future API integration

  // Note: kimi CLI doesn't support --max-turns directly
  // maxTurns is reserved for future API integration

  // Add prompt (escaped)
  parts.push(escapeShellArg(params.prompt));

  return parts.join(' ');
}

/**
 * Escape shell argument
 * @param arg Argument value
 * @returns Escaped argument
 */
function escapeShellArg(arg: string): string {
  // Escape double quotes and wrap in double quotes
  return `"${arg.replace(/"/g, '\\"')}"`;
}

/**
 * Parse Kimi CLI output
 * @param output Raw CLI output
 * @returns Parsed result with text and optional error
 */
export function parseKimiOutput(output: string): {
  text: string;
  error?: KimiError;
} {
  if (!output) {
    return { text: '' };
  }

  // Strip ANSI escape codes
  const cleanedOutput = stripAnsiCodes(output);

  // Check for errors
  const error = detectError(cleanedOutput);
  if (error) {
    return { text: '', error };
  }

  return { text: cleanedOutput.trim() };
}

/**
 * Strip ANSI escape codes from string
 * @param str Input string
 * @returns Cleaned string
 */
function stripAnsiCodes(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Detect error in output
 * @param output Output content
 * @returns Error object or undefined
 */
function detectError(output: string): KimiError | undefined {
  const lowerOutput = output.toLowerCase();

  if (
    lowerOutput.includes('authentication failed') ||
    lowerOutput.includes('unauthorized') ||
    lowerOutput.includes('401')
  ) {
    return {
      code: 'AUTH_ERROR',
      message: 'Authentication failed',
      retryable: false,
    };
  }

  if (lowerOutput.includes('timeout') || lowerOutput.includes('etimedout')) {
    return {
      code: 'TIMEOUT',
      message: 'Request timeout',
      retryable: true,
    };
  }

  if (lowerOutput.includes('rate limit') || lowerOutput.includes('429')) {
    return {
      code: 'RATE_LIMIT',
      message: 'Rate limit exceeded',
      retryable: true,
    };
  }

  if (lowerOutput.includes('not found') || lowerOutput.includes('command not found')) {
    return {
      code: 'CLI_NOT_FOUND',
      message: 'Kimi CLI not found',
      retryable: false,
    };
  }

  return undefined;
}

/**
 * Execute Kimi CLI with the given options
 * @param options Execution options
 * @returns Execution result
 */
export async function executeKimi(
  options: KimiExecutorOptions
): Promise<KimiExecutionResult> {
  const start = Date.now();
  const timeout = options.timeout || 120_000; // 2 minute default timeout

  return new Promise((resolve) => {
    const cmd = 'kimi';
    const args: string[] = [];

    if (options.model) {
      args.push('--model', options.model);
    }

    // Use session ID for multi-turn context (if provided)
    if (options.sessionId) {
      args.push('--session', options.sessionId);
    }

    // Add the prompt as the last argument
    args.push(options.prompt);

    const child = spawn(cmd, args, {
      shell: true,
      env: { ...process.env },
      cwd: options.cwd,
    });

    let stdout = '';
    let stderr = '';
    let killed = false;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      killed = true;
      child.kill('SIGTERM');
      resolve({
        text: '',
        durationMs: Date.now() - start,
        error: {
          code: 'TIMEOUT',
          message: `Execution timed out after ${timeout}ms`,
          retryable: true,
        },
      });
    }, timeout);

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      if (killed) return;
      clearTimeout(timeoutId);

      const errorCode = error.message.includes('ENOENT')
        ? 'CLI_NOT_FOUND'
        : 'EXECUTION_ERROR';

      resolve({
        text: '',
        durationMs: Date.now() - start,
        error: {
          code: errorCode,
          message: error.message,
          retryable: false,
        },
      });
    });

    child.on('close', (code) => {
      if (killed) return;
      clearTimeout(timeoutId);

      const durationMs = Date.now() - start;
      const output = stdout + stderr;

      // Check for errors in output
      const parsed = parseKimiOutput(output);
      if (parsed.error) {
        resolve({
          text: '',
          durationMs,
          error: parsed.error,
        });
        return;
      }

      // Check exit code
      if (code !== 0) {
        resolve({
          text: '',
          durationMs,
          error: {
            code: 'EXECUTION_ERROR',
            message: `Process exited with code ${code}: ${stderr || output}`,
            retryable: false,
          },
        });
        return;
      }

      resolve({
        text: parsed.text,
        durationMs,
      });
    });
  });
}
