/**
 * Settings/Config Management Unit Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  saveConfig,
  loadConfig,
  type BotConfig,
} from '../../../src/config/settings.js';

const TEST_DIR = path.join(os.tmpdir(), 'weixin-kimi-bot-test', `settings-test-${Date.now()}`);

describe('Settings Management', () => {
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

  describe('loadConfig', () => {
    it('should return default config when no config exists', () => {
      // When
      const config = loadConfig();

      // Then
      expect(config.model).toBe('kimi-k1.5');
      expect(config.maxTurns).toBe(10);
      expect(config.systemPrompt).toBe('');
      expect(config.cwd).toBe(process.cwd());
      expect(config.multiTurn).toBe(true);
    });

    it('should merge saved config with defaults', () => {
      // Given
      const partialConfig: Partial<BotConfig> = {
        model: 'kimi-k1.5-long',
        maxTurns: 20,
      };
      saveConfig(partialConfig);

      // When
      const config = loadConfig();

      // Then
      expect(config.model).toBe('kimi-k1.5-long');
      expect(config.maxTurns).toBe(20);
      // Other defaults should be preserved
      expect(config.systemPrompt).toBe('');
      expect(config.cwd).toBe(process.cwd());
      expect(config.multiTurn).toBe(true);
    });

    it('should return complete config after save', () => {
      // Given
      const fullConfig: BotConfig = {
        model: 'custom-model',
        maxTurns: 5,
        systemPrompt: 'Custom system prompt',
        cwd: '/custom/path',
        multiTurn: false,
      };

      // When
      saveConfig(fullConfig);
      const loaded = loadConfig();

      // Then
      expect(loaded).toEqual(fullConfig);
    });
  });

  describe('saveConfig', () => {
    it('should save config to file', () => {
      // Given
      const config: Partial<BotConfig> = {
        model: 'test-model',
      };

      // When
      saveConfig(config);

      // Then
      const configPath = path.join(TEST_DIR, '.weixin-kimi-bot', 'config.json');
      expect(fs.existsSync(configPath)).toBe(true);
    });

    it('should merge with existing config', () => {
      // Given - initial config
      saveConfig({ model: 'model-1', maxTurns: 5 });

      // When - update only model
      saveConfig({ model: 'model-2' });

      // Then
      const config = loadConfig();
      expect(config.model).toBe('model-2');
      expect(config.maxTurns).toBe(5); // Should preserve previous value
    });

    it('should create directories if needed', () => {
      // Given
      const nestedDir = path.join(TEST_DIR, 'nested', `test-${Date.now()}`);
      process.env.WEIXIN_KIMI_BOT_HOME = nestedDir;

      // When
      saveConfig({ model: 'test' });

      // Then
      const configPath = path.join(nestedDir, '.weixin-kimi-bot', 'config.json');
      expect(fs.existsSync(configPath)).toBe(true);
    });
  });

  describe('config data structure', () => {
    it('should handle empty system prompt', () => {
      // Given
      const config: BotConfig = {
        model: 'test',
        maxTurns: 10,
        systemPrompt: '',
        cwd: process.cwd(),
        multiTurn: true,
      };

      // When
      saveConfig(config);
      const loaded = loadConfig();

      // Then
      expect(loaded.systemPrompt).toBe('');
    });

    it('should preserve special characters in system prompt', () => {
      // Given
      const specialPrompt = 'Line 1\nLine 2\tTabbed "quoted" text';
      saveConfig({ systemPrompt: specialPrompt });

      // When
      const loaded = loadConfig();

      // Then
      expect(loaded.systemPrompt).toBe(specialPrompt);
    });
  });
});
