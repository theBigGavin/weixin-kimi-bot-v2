/**
 * Credentials Management Unit Tests
 * 
 * TDD Approach:
 * 1. Write tests that define expected behavior
 * 2. Run tests - they should fail (RED)
 * 3. Implement minimal code to pass tests (GREEN)
 * 4. Refactor if needed (BLUE)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  saveCredentials,
  loadCredentials,
  type Credentials,
} from '../../../src/config/credentials.js';

// Test directory - unique per test file to avoid conflicts
const TEST_DIR = path.join(os.tmpdir(), 'weixin-kimi-bot-test', `credentials-test-${Date.now()}`);

describe('Credentials Management', () => {
  beforeEach(() => {
    // Set custom home directory for this test
    process.env.WEIXIN_KIMI_BOT_HOME = TEST_DIR;
    
    // Ensure test directory exists
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Cleanup test directory
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    
    // Clean up environment variable
    delete process.env.WEIXIN_KIMI_BOT_HOME;
  });

  describe('saveCredentials', () => {
    it('should save credentials to the correct location', () => {
      // Given
      const creds: Omit<Credentials, 'savedAt'> = {
        botToken: 'test-token-123',
        accountId: 'test-account-456',
        baseUrl: 'https://test.example.com',
        userId: 'test-user-789',
      };

      // When
      saveCredentials(creds);

      // Then
      const credsPath = path.join(TEST_DIR, '.weixin-kimi-bot', 'credentials.json');
      expect(fs.existsSync(credsPath)).toBe(true);
    });

    it('should add savedAt timestamp', () => {
      // Given
      const creds: Omit<Credentials, 'savedAt'> = {
        botToken: 'test-token',
        accountId: 'test-account',
        baseUrl: 'https://test.example.com',
      };

      // When
      saveCredentials(creds);

      // Then
      const loaded = loadCredentials();
      expect(loaded).not.toBeNull();
      expect(loaded?.savedAt).toBeDefined();
      expect(new Date(loaded!.savedAt).getTime()).toBeGreaterThan(0);
    });

    it('should create directories if they do not exist', () => {
      // Given - use a nested path that doesn't exist yet
      const nestedDir = path.join(TEST_DIR, 'nested', `test-${Date.now()}`);
      process.env.WEIXIN_KIMI_BOT_HOME = nestedDir;

      const creds: Omit<Credentials, 'savedAt'> = {
        botToken: 'test-token',
        accountId: 'test-account',
        baseUrl: 'https://test.example.com',
      };

      // When
      saveCredentials(creds);

      // Then
      const credsPath = path.join(nestedDir, '.weixin-kimi-bot', 'credentials.json');
      expect(fs.existsSync(credsPath)).toBe(true);
    });

    it('should set file permissions to 0o600 on Unix', () => {
      // Skip on Windows
      if (process.platform === 'win32') {
        return;
      }
      
      // Given
      const creds: Omit<Credentials, 'savedAt'> = {
        botToken: 'secret-token',
        accountId: 'test-account',
        baseUrl: 'https://test.example.com',
      };

      // When
      saveCredentials(creds);

      // Then
      const credsPath = path.join(TEST_DIR, '.weixin-kimi-bot', 'credentials.json');
      const stats = fs.statSync(credsPath);
      // 0o600 = owner read/write, group none, others none
      expect(stats.mode & 0o777).toBe(0o600);
    });
  });

  describe('loadCredentials', () => {
    it('should return null when credentials do not exist', () => {
      // Given - ensure no credentials exist by using a fresh directory
      const emptyDir = path.join(TEST_DIR, 'empty', `test-${Date.now()}`);
      process.env.WEIXIN_KIMI_BOT_HOME = emptyDir;

      // When
      const result = loadCredentials();

      // Then
      expect(result).toBeNull();
    });

    it('should return credentials when they exist', () => {
      // Given
      const creds: Omit<Credentials, 'savedAt'> = {
        botToken: 'test-token-123',
        accountId: 'test-account-456',
        baseUrl: 'https://test.example.com',
        userId: 'test-user-789',
      };
      saveCredentials(creds);

      // When
      const loaded = loadCredentials();

      // Then
      expect(loaded).not.toBeNull();
      expect(loaded?.botToken).toBe('test-token-123');
      expect(loaded?.accountId).toBe('test-account-456');
      expect(loaded?.baseUrl).toBe('https://test.example.com');
      expect(loaded?.userId).toBe('test-user-789');
    });

    it('should handle corrupted credential files', () => {
      // Given
      const credsDir = path.join(TEST_DIR, '.weixin-kimi-bot');
      fs.mkdirSync(credsDir, { recursive: true });
      fs.writeFileSync(path.join(credsDir, 'credentials.json'), 'invalid json{');

      // When
      const loaded = loadCredentials();

      // Then
      expect(loaded).toBeNull();
    });

    it('should return saved credentials after save-load cycle', () => {
      // Given
      const original: Omit<Credentials, 'savedAt'> = {
        botToken: 'cycle-test-token',
        accountId: 'cycle-test-account',
        baseUrl: 'https://cycle.example.com',
      };

      // When
      saveCredentials(original);
      const loaded = loadCredentials();

      // Then
      expect(loaded).not.toBeNull();
      expect(loaded?.botToken).toBe(original.botToken);
      expect(loaded?.accountId).toBe(original.accountId);
      expect(loaded?.baseUrl).toBe(original.baseUrl);
    });
  });

  describe('credentials data structure', () => {
    it('should handle credentials without optional userId', () => {
      // Given
      const creds: Omit<Credentials, 'savedAt'> = {
        botToken: 'test-token',
        accountId: 'test-account',
        baseUrl: 'https://test.example.com',
        // userId is optional
      };

      // When
      saveCredentials(creds);
      const loaded = loadCredentials();

      // Then
      expect(loaded).not.toBeNull();
      expect(loaded?.botToken).toBe(creds.botToken);
      expect(loaded?.userId).toBeUndefined();
    });

    it('should preserve all fields in JSON format', () => {
      // Given
      const creds: Omit<Credentials, 'savedAt'> = {
        botToken: 'token-with-"quotes"',
        accountId: 'account\nwith\nnewlines',
        baseUrl: 'https://test.example.com/path?query=1',
        userId: 'user\twith\ttabs',
      };

      // When
      saveCredentials(creds);
      const credsPath = path.join(TEST_DIR, '.weixin-kimi-bot', 'credentials.json');
      const rawContent = fs.readFileSync(credsPath, 'utf-8');
      const parsed = JSON.parse(rawContent);

      // Then
      expect(parsed.botToken).toBe(creds.botToken);
      expect(parsed.accountId).toBe(creds.accountId);
      expect(parsed.baseUrl).toBe(creds.baseUrl);
      expect(parsed.userId).toBe(creds.userId);
      expect(parsed.savedAt).toBeDefined();
    });
  });
});
