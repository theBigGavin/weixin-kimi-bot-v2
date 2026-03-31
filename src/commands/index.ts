/**
 * Commands Index
 * 
 * Exports all commands and initializes the command registry.
 */

// Framework
export { 
  Command, 
  SubCommand, 
  CommandRegistry,
  ResponseBuilder,
  CommandType,
  registry,
  type CommandContext,
  type CommandResult,
  type CommandMetadata,
  type SubCommandMetadata,
} from './framework.js';

// Command implementations
export { HelpCommand } from './help.js';
export { MemoryCommand } from './memory.js';
export { ScheduleCommand } from './schedule.js';
export { OnboardCommand } from './onboard.js';
export { TaskCommand } from './task.js';
export { StartCommand, StatusCommand, ResetCommand, TestCommand, TemplateCommand } from './simple.js';

// Initialize registry with all commands
import { registry } from './framework.js';
import { HelpCommand } from './help.js';
import { MemoryCommand } from './memory.js';
import { ScheduleCommand } from './schedule.js';
import { OnboardCommand } from './onboard.js';
import { TaskCommand } from './task.js';
import { StartCommand, StatusCommand, ResetCommand, TestCommand, TemplateCommand } from './simple.js';

// Register all commands
registry.register(new HelpCommand());
registry.register(new StartCommand());
registry.register(new StatusCommand());
registry.register(new ResetCommand());
registry.register(new TestCommand());
registry.register(new TemplateCommand());
registry.register(new MemoryCommand());
registry.register(new ScheduleCommand());
registry.register(new OnboardCommand());
registry.register(new TaskCommand());

export { registry as commandRegistry };
