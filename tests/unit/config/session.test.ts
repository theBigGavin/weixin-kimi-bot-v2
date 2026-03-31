/**
 * Session State Management Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  loadContextTokens,
  getContextToken,
  setContextToken,
  loadSessionIds,
  getSessionId,
  setSessionId,
  clearSessionId,
  saveSyncBuf,
  loadSyncBuf,
} from '../../../src/config/session.js';

const TEST_DIR = path.join(os.tmpdir(), 'weixin-kimi-bot-test', `session-test-${Date.now()}`);

describe('Session State Management', () => {
  beforeEach(() => {
    process.env.WEIXIN_KIMI_BOT_HOME = TEST_DIR;
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore
    }
    delete process.env.WEIXIN_KIMI_BOT_HOME;
  });

  describe('Context Tokens', () => {
    it('should return undefined for non-existent token', () => {
      loadContextTokens();
      const token = getContextToken('non-existent-user');
      expect(token).toBeUndefined();
    });

    it('should save and retrieve context token', () => {
      // Given
      loadContextTokens();
      const userId = 'user-123';
      const token = 'context-token-abc';

      // When
      setContextToken(userId, token);

      // Then
      const retrieved = getContextToken(userId);
      expect(retrieved).toBe(token);
    });

    it('should persist tokens across loads', () => {
      // Given
      loadContextTokens();
      setContextToken('user-1', 'token-1');

      // When - reload tokens
      loadContextTokens();
      const retrieved = getContextToken('user-1');

      // Then
      expect(retrieved).toBe('token-1');
    });

    it('should handle multiple users', () => {
      // Given
      loadContextTokens();

      // When
      setContextToken('user-1', 'token-1');
      setContextToken('user-2', 'token-2');

      // Then
      expect(getContextToken('user-1')).toBe('token-1');
      expect(getContextToken('user-2')).toBe('token-2');
    });
  });

  describe('Session IDs', () => {
    it('should return undefined for non-existent session', () => {
      loadSessionIds();
      const sessionId = getSessionId('non-existent-user');
      expect(sessionId).toBeUndefined();
    });

    it('should save and retrieve session ID', () => {
      // Given
      loadSessionIds();
      const userId = 'user-123';
      const sessionId = 'session-xyz';

      // When
      setSessionId(userId, sessionId);

      // Then
      const retrieved = getSessionId(userId);
      expect(retrieved).toBe(sessionId);
    });

    it('should persist session IDs across loads', () => {
      // Given
      loadSessionIds();
      setSessionId('user-1', 'session-1');

      // When - reload
      loadSessionIds();
      const retrieved = getSessionId('user-1');

      // Then
      expect(retrieved).toBe('session-1');
    });

    it('should clear session ID', () => {
      // Given
      loadSessionIds();
      setSessionId('user-1', 'session-1');

      // When
      clearSessionId('user-1');

      // Then
      expect(getSessionId('user-1')).toBeUndefined();
    });

    it('should handle clear for non-existent user', () => {
      // Given
      loadSessionIds();

      // When/Then - should not throw
      expect(() => clearSessionId('non-existent')).not.toThrow();
    });
  });

  describe('Sync Buffer', () => {
    it('should return empty string when no buffer exists', () => {
      const buf = loadSyncBuf();
      expect(buf).toBe('');
    });

    it('should save and load sync buffer', () => {
      // Given
      const buf = 'sync-buffer-data-123';

      // When
      saveSyncBuf(buf);
      const loaded = loadSyncBuf();

      // Then
      expect(loaded).toBe(buf);
    });

    it('should overwrite existing buffer', () => {
      // Given
      saveSyncBuf('old-data');

      // When
      saveSyncBuf('new-data');
      const loaded = loadSyncBuf();

      // Then
      expect(loaded).toBe('new-data');
    });

    it('should handle special characters in buffer', () => {
      // Given
      const buf = 'data\nwith\tspecial\rchars';

      // When
      saveSyncBuf(buf);
      const loaded = loadSyncBuf();

      // Then
      expect(loaded).toBe(buf);
    });
  });
});
