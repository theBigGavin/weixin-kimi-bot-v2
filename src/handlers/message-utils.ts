/**
 * Message Utilities
 * 
 * Core utilities for message parsing, formatting, and sanitization.
 */

export enum MessageType {
  TEXT = 'text',
  MARKDOWN = 'markdown',
  IMAGE = 'image',
  FILE = 'file',
  CODE = 'code',
}

export interface ParsedCommand {
  command: string;
  args: string[];
  raw: string;
}

export interface FormattedResponse {
  type: MessageType;
  content: string;
  metadata: Record<string, unknown>;
}

/**
 * Parse a command message into command and arguments
 */
export function parseCommand(message: string): ParsedCommand | null {
  const trimmed = message.trim();
  
  // Must start with /
  if (!trimmed.startsWith('/')) {
    return null;
  }

  // Split by spaces but respect quoted strings
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 1; i < trimmed.length; i++) {
    const char = trimmed[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    
    if (char === ' ' && !inQuotes) {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  
  if (current) {
    parts.push(current);
  }

  if (parts.length === 0) {
    return null;
  }

  return {
    command: parts[0].toLowerCase(),
    args: parts.slice(1),
    raw: trimmed,
  };
}

/**
 * Extract @mentions from a message
 */
export function extractMentions(message: string): string[] {
  const mentions: string[] = [];
  const regex = /@([a-zA-Z0-9_-]+)/g;
  let match;
  
  while ((match = regex.exec(message)) !== null) {
    mentions.push(match[1]);
  }
  
  return mentions;
}

/**
 * Check if a message is a command
 */
export function isCommandMessage(message: string): boolean {
  const trimmed = message.trim();
  return trimmed.startsWith('/') && trimmed.length > 1;
}

/**
 * Format a response for sending
 */
export function formatResponse(
  content: string,
  type: MessageType = MessageType.TEXT,
  metadata: Record<string, unknown> = {}
): FormattedResponse {
  return {
    type,
    content,
    metadata,
  };
}

/**
 * Truncate a message to maximum length
 */
export function truncateMessage(
  message: string,
  maxLength: number,
  suffix: string = '...'
): string {
  if (message.length <= maxLength) {
    return message;
  }
  
  return message.slice(0, maxLength) + suffix;
}

/**
 * Sanitize user input
 */
export function sanitizeInput(
  input: string,
  maxLength: number = 5000
): string {
  // Remove control characters first
  let sanitized = input.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
  
  // Normalize multiple spaces/newlines to single space
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength);
  }
  
  return sanitized;
}
