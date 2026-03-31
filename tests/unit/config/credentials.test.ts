/**
 * Credentials Management Unit Tests
 * 
 * Tests for the new per-Agent credentials structure:
 * ~/.weixin-kimi-bot/agents/{agent_id}/credentials.json
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  saveCredentials,
  loadCredentialsForAgent,
  loadAllCredentials,
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
    it('should save credentials to global location', () => {
      // Given
      const creds: Omit<Credentials, 'savedAt'> = {
        botToken: 'test-token-123',
        accountId: 'test-account-456',
        baseUrl: 'https://test.example.com',
        userId: 'test-user-789',
      };

      // When
      saveCredentials(creds);

      // Then - saved to global location for backward compat in tests
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

      // Then - verify by reading the file directly
      const credsPath = path.join(TEST_DIR, '.weixin-kimi-bot', 'credentials.json');
      const raw = fs.readFileSync(credsPath, 'utf-8');
      const loaded = JSON.parse(raw) as Credentials;
      expect(loaded.savedAt).toBeDefined();
      expect(new Date(loaded.savedAt).getTime()).toBeGreaterThan(0);
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

  describe('loadCredentialsForAgent', () => {
    it('should return null when agent credentials do not exist', () => {
      // Given - empty agents directory
      const agentsDir = path.join(TEST_DIR, '.weixin-kimi-bot', 'agents');
      fs.mkdirSync(agentsDir, { recursive: true });

      // When
      const result = loadCredentialsForAgent('nonexistent_agent');

      // Then
      expect(result).toBeNull();
    });

    it('should return credentials for existing agent', () => {
      // Given - create agent credentials directly
      const agentId = '测试助手_abc12345_x7k9';
      const agentsDir = path.join(TEST_DIR, '.weixin-kimi-bot', 'agents');
      const agentDir = path.join(agentsDir, agentId);
      fs.mkdirSync(agentDir, { recursive: true });
      
      const creds: Credentials = {
        botToken: 'agent-token-123',
        accountId: 'agent-account-456',
        baseUrl: 'https://ilink.example.com',
        userId: 'user-789',
        savedAt: new Date().toISOString(),
      };
      
      const credsPath = path.join(agentDir, 'credentials.json');
      fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2), 'utf-8');

      // When
      const loaded = loadCredentialsForAgent(agentId);

      // Then
      expect(loaded).not.toBeNull();
      expect(loaded?.botToken).toBe('agent-token-123');
      expect(loaded?.accountId).toBe('agent-account-456');
      expect(loaded?.userId).toBe('user-789');
    });
  });

  describe('loadAllCredentials', () => {
    it('should return empty map when no agents exist', () => {
      // Given - empty agents directory
      const agentsDir = path.join(TEST_DIR, '.weixin-kimi-bot', 'agents');
      fs.mkdirSync(agentsDir, { recursive: true });

      // When
      const result = loadAllCredentials();

      // Then
      expect(result.size).toBe(0);
    });

    it('should return credentials for all agents', () => {
      // Given - create multiple agent credentials
      const agentsDir = path.join(TEST_DIR, '.weixin-kimi-bot', 'agents');
      
      const agent1Dir = path.join(agentsDir, '助手1_abc12345_a1b2');
      fs.mkdirSync(agent1Dir, { recursive: true });
      fs.writeFileSync(
        path.join(agent1Dir, 'credentials.json'),
        JSON.stringify({
          botToken: 'token-1',
          accountId: 'account-1',
          baseUrl: 'https://ilink.example.com',
          userId: 'user-1',
          savedAt: new Date().toISOString(),
        } as Credentials, null, 2)
      );
      
      const agent2Dir = path.join(agentsDir, '助手2_def67890_c3d4');
      fs.mkdirSync(agent2Dir, { recursive: true });
      fs.writeFileSync(
        path.join(agent2Dir, 'credentials.json'),
        JSON.stringify({
          botToken: 'token-2',
          accountId: 'account-2',
          baseUrl: 'https://ilink.example.com',
          userId: 'user-2',
          savedAt: new Date().toISOString(),
        } as Credentials, null, 2)
      );

      // When
      const result = loadAllCredentials();

      // Then
      expect(result.size).toBe(2);
      expect(result.has('助手1_abc12345_a1b2')).toBe(true);
      expect(result.has('助手2_def67890_c3d4')).toBe(true);
      expect(result.get('助手1_abc12345_a1b2')?.botToken).toBe('token-1');
      expect(result.get('助手2_def67890_c3d4')?.botToken).toBe('token-2');
    });

    it('should skip invalid credential files', () => {
      // Given - mix of valid and invalid credentials
      const agentsDir = path.join(TEST_DIR, '.weixin-kimi-bot', 'agents');
      
      // Valid agent
      const validDir = path.join(agentsDir, 'valid_agent');
      fs.mkdirSync(validDir, { recursive: true });
      fs.writeFileSync(
        path.join(validDir, 'credentials.json'),
        JSON.stringify({
          botToken: 'valid-token',
          accountId: 'valid-account',
          baseUrl: 'https://ilink.example.com',
          savedAt: new Date().toISOString(),
        } as Credentials, null, 2)
      );
      
      // Invalid agent (corrupted JSON)
      const invalidDir = path.join(agentsDir, 'invalid_agent');
      fs.mkdirSync(invalidDir, { recursive: true });
      fs.writeFileSync(
        path.join(invalidDir, 'credentials.json'),
        'not valid json'
      );

      // When
      const result = loadAllCredentials();

      // Then
      expect(result.size).toBe(1);
      expect(result.has('valid_agent')).toBe(true);
      expect(result.get('valid_agent')?.botToken).toBe('valid-token');
    });
  });

  describe('credentials data structure', () => {
    it('should handle credentials without optional userId', () => {
      // Given
      const agentId = '测试助手_no_userid';
      const agentsDir = path.join(TEST_DIR, '.weixin-kimi-bot', 'agents');
      const agentDir = path.join(agentsDir, agentId);
      fs.mkdirSync(agentDir, { recursive: true });
      
      const creds: Credentials = {
        botToken: 'test-token',
        accountId: 'test-account',
        baseUrl: 'https://test.example.com',
        savedAt: new Date().toISOString(),
        // userId is optional
      };
      
      fs.writeFileSync(
        path.join(agentDir, 'credentials.json'),
        JSON.stringify(creds, null, 2)
      );

      // When
      const loaded = loadCredentialsForAgent(agentId);

      // Then
      expect(loaded).not.toBeNull();
      expect(loaded?.botToken).toBe('test-token');
      expect(loaded?.userId).toBeUndefined();
    });
  });
});
