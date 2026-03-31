/**
 * Command Framework
 * 
 * Provides a unified, extensible command system with:
 * - Base command class with common functionality
 * - Automatic help text generation
 * - Standardized response formatting
 * - Sub-command support
 * - Parameter validation
 */

import type { Agent } from '../agent/types.js';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface CommandContext {
  agent: Agent;
  args: string[];
  rawMessage: string;
  onProgress?: (message: string) => Promise<void>;
}

export enum CommandType {
  HELP = 'help',
  START = 'start',
  TEMPLATE = 'template',
  STATUS = 'status',
  RESET = 'reset',
  MEMORY = 'memory',
  TASK = 'task',
  TEST = 'test',
  ONBOARD = 'onboard',
  SCHEDULE = 'schedule',
  UNKNOWN = 'unknown',
}

export interface CommandResult {
  type: CommandType;
  success: boolean;
  response: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface CommandMetadata {
  name: string;
  description: string;
  usage: string;
  examples?: string[];
  adminOnly?: boolean;
  hidden?: boolean;
}

export interface SubCommandMetadata {
  name: string;
  description: string;
  usage?: string;
  examples?: string[];
}

// ============================================================================
// Response Builder
// ============================================================================

export class ResponseBuilder {
  private lines: string[] = [];

  static create(): ResponseBuilder {
    return new ResponseBuilder();
  }

  static success(message: string, type: CommandType = CommandType.UNKNOWN): CommandResult {
    return { type, success: true, response: `✅ ${message}` };
  }

  static error(message: string, errorCode?: string, type: CommandType = CommandType.UNKNOWN): CommandResult {
    return { 
      type,
      success: false, 
      response: `❌ ${message}`,
      error: errorCode || message,
    };
  }

  static info(message: string, type: CommandType = CommandType.UNKNOWN): CommandResult {
    return { type, success: true, response: `ℹ️ ${message}` };
  }

  static warning(message: string, type: CommandType = CommandType.UNKNOWN): CommandResult {
    return { type, success: true, response: `⚠️ ${message}` };
  }

  icon(icon: string): this {
    this.lines.push(icon);
    return this;
  }

  title(title: string): this {
    this.lines.push(`${title}`);
    this.lines.push('================');
    return this;
  }

  section(name: string): this {
    this.lines.push(`\n【${name}】`);
    return this;
  }

  line(text: string = ''): this {
    this.lines.push(text);
    return this;
  }

  addLines(texts: string[]): this {
    this.lines.push(...texts);
    return this;
  }

  list(items: string[], bullet: string = '•'): this {
    items.forEach(item => this.lines.push(`${bullet} ${item}`));
    return this;
  }

  numbered(items: string[]): this {
    items.forEach((item, i) => this.lines.push(`${i + 1}. ${item}`));
    return this;
  }

  code(text: string): this {
    this.lines.push(`\`${text}\``);
    return this;
  }

  bold(text: string): this {
    this.lines.push(`**${text}**`);
    return this;
  }

  build(): string {
    return this.lines.join('\n');
  }

  toResult(type: CommandType, success: boolean = true, data?: Record<string, unknown>): CommandResult {
    return {
      type,
      success,
      response: this.build(),
      data,
    };
  }
}

// ============================================================================
// Base Command Class
// ============================================================================

export abstract class Command {
  readonly metadata: CommandMetadata;
  protected subCommands = new Map<string, SubCommand>();

  constructor(metadata: CommandMetadata) {
    this.metadata = metadata;
  }

  /**
   * Main entry point for the command
   */
  abstract execute(context: CommandContext): Promise<CommandResult> | CommandResult;

  /**
   * Register a sub-command
   */
  protected registerSubCommand(subCommand: SubCommand): void {
    this.subCommands.set(subCommand.metadata.name, subCommand);
  }

  /**
   * Get sub-command by name
   */
  protected getSubCommand(name: string): SubCommand | undefined {
    return this.subCommands.get(name);
  }

  /**
   * Get all registered sub-commands
   */
  protected getSubCommands(): SubCommand[] {
    return Array.from(this.subCommands.values());
  }

  /**
   * Check if this command has sub-commands
   */
  protected hasSubCommands(): boolean {
    return this.subCommands.size > 0;
  }

  /**
   * Execute a sub-command by name
   */
  protected async executeSubCommand(
    name: string, 
    context: CommandContext
  ): Promise<CommandResult> {
    const subCommand = this.getSubCommand(name);
    if (!subCommand) {
      return this.unknownSubCommand(name);
    }
    return subCommand.execute(context);
  }

  /**
   * Generate help text for this command
   */
  generateHelp(): string {
    const rb = ResponseBuilder.create()
      .title(`📖 ${this.metadata.name} 命令帮助`)
      .line(`描述: ${this.metadata.description}`)
      .line(`用法: ${this.metadata.usage}`);

    if (this.metadata.examples && this.metadata.examples.length > 0) {
      rb.section('示例');
      rb.list(this.metadata.examples);
    }

    if (this.hasSubCommands()) {
      rb.section('子命令');
      for (const sub of this.getSubCommands()) {
        rb.line(`  ${sub.metadata.name} - ${sub.metadata.description}`);
      }
    }

    return rb.build();
  }

  /**
   * Default handler for unknown sub-commands
   */
  getCommandType(): CommandType {
    // Map command name to CommandType
    const nameToType: Record<string, CommandType> = {
      help: CommandType.HELP,
      start: CommandType.START,
      template: CommandType.TEMPLATE,
      status: CommandType.STATUS,
      reset: CommandType.RESET,
      memory: CommandType.MEMORY,
      task: CommandType.TASK,
      test: CommandType.TEST,
      onboard: CommandType.ONBOARD,
      schedule: CommandType.SCHEDULE,
    };
    return nameToType[this.metadata.name] ?? CommandType.UNKNOWN;
  }

  protected unknownSubCommand(name: string): CommandResult {
    const available = this.getSubCommands().map(s => s.metadata.name).join(', ');
    return ResponseBuilder.error(
      `未知操作: ${name}。可用操作: ${available || '无'}`,
      'UnknownSubcommand',
      this.getCommandType()
    );
  }

  protected missingArgument(paramName: string, usage: string): CommandResult {
    return ResponseBuilder.error(
      `请提供${paramName}。用法: ${usage}`,
      'MissingArgument',
      this.getCommandType()
    );
  }

  protected invalidArgument(paramName: string, value: string, expected?: string): CommandResult {
    let message = `无效的${paramName}: ${value}`;
    if (expected) {
      message += `。${expected}`;
    }
    return ResponseBuilder.error(message, 'InvalidArgument', this.getCommandType());
  }
}

// ============================================================================
// SubCommand Class
// ============================================================================

export abstract class SubCommand {
  readonly metadata: SubCommandMetadata;

  constructor(metadata: SubCommandMetadata) {
    this.metadata = metadata;
  }

  abstract execute(context: CommandContext): Promise<CommandResult> | CommandResult;

  /**
   * Get full usage string including parent command
   */
  getFullUsage(parentUsage: string): string {
    return `${parentUsage} ${this.metadata.name}${this.metadata.usage ? ' ' + this.metadata.usage : ''}`;
  }
}

// ============================================================================
// Command Registry
// ============================================================================

export class CommandRegistry {
  private commands = new Map<string, Command>();
  private metadata: CommandMetadata[] = [];

  /**
   * Register a command
   */
  register(command: Command): void {
    this.commands.set(command.metadata.name, command);
    this.metadata.push(command.metadata);
  }

  /**
   * Get a command by name
   */
  get(name: string): Command | undefined {
    return this.commands.get(name);
  }

  /**
   * Check if a command exists
   */
  has(name: string): boolean {
    return this.commands.has(name);
  }

  /**
   * Execute a command
   */
  async execute(
    name: string, 
    context: CommandContext
  ): Promise<CommandResult> {
    const command = this.get(name);
    if (!command) {
      return ResponseBuilder.error(
        `未知命令: ${name}。输入 /help 查看可用命令。`,
        'UnknownCommand',
        CommandType.UNKNOWN
      );
    }
    const result = await command.execute(context);
    // Ensure type is set
    if (!result.type || result.type === CommandType.UNKNOWN) {
      result.type = command.getCommandType();
    }
    return result;
  }

  /**
   * Get all registered command metadata
   */
  getAllMetadata(): CommandMetadata[] {
    return [...this.metadata].filter(m => !m.hidden);
  }

  /**
   * Generate global help text
   */
  generateHelp(): string {
    const rb = ResponseBuilder.create()
      .title('📋 可用命令列表');

    for (const meta of this.getAllMetadata()) {
      rb.line(`/${meta.name} - ${meta.description}`);
      rb.line(`  用法: ${meta.usage}`);
      rb.line();
    }

    return rb.build();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const registry = new CommandRegistry();
