/**
 * 微信账号类型测试
 */

import { describe, it, expect } from 'vitest';
import {
  WechatAccount,
  WechatBindings,
  WechatCredentials,
  AgentBinding,
  BindingStatus,
  createWechatAccount,
  createWechatBindings,
  createAgentBinding,
  createWechatCredentials,
} from '../../../src/wechat/types.js';

describe('wechat/types', () => {
  describe('createWechatAccount', () => {
    it('应该创建微信账号', () => {
      const account = createWechatAccount('wxid_a1b2c3d4', '测试用户');

      expect(account.id).toBe('wxid_a1b2c3d4');
      expect(account.nickname).toBe('测试用户');
      expect(account.createdAt).toBeGreaterThan(0);
      expect(account.lastLoginAt).toBeGreaterThan(0);
    });

    it('应该支持没有昵称的账号', () => {
      const account = createWechatAccount('wxid_a1b2c3d4');

      expect(account.id).toBe('wxid_a1b2c3d4');
      expect(account.nickname).toBeUndefined();
    });
  });

  describe('createWechatBindings', () => {
    it('应该创建空的绑定配置', () => {
      const bindings = createWechatBindings('wxid_a1b2c3d4');

      expect(bindings.wechatId).toBe('wxid_a1b2c3d4');
      expect(bindings.agents).toEqual([]);
      expect(bindings.updatedAt).toBeGreaterThan(0);
      expect(bindings.defaultAgentId).toBeUndefined();
    });
  });

  describe('createAgentBinding', () => {
    it('应该创建创建者绑定', () => {
      const binding = createAgentBinding('助手_a1b2c3d4_x7k9', 'creator', true);

      expect(binding.agentId).toBe('助手_a1b2c3d4_x7k9');
      expect(binding.bindingType).toBe('creator');
      expect(binding.isDefault).toBe(true);
      expect(binding.boundAt).toBeGreaterThan(0);
    });

    it('应该创建绑定者绑定', () => {
      const binding = createAgentBinding('助手_a1b2c3d4_x7k9', 'binder', false);

      expect(binding.agentId).toBe('助手_a1b2c3d4_x7k9');
      expect(binding.bindingType).toBe('binder');
      expect(binding.isDefault).toBe(false);
    });
  });

  describe('createWechatCredentials', () => {
    it('应该创建凭证', () => {
      const credentials = createWechatCredentials('wxid_a1b2c3d4');

      expect(credentials.wechatId).toBe('wxid_a1b2c3d4');
      expect(credentials.updatedAt).toBeGreaterThan(0);
      expect(credentials.token).toBeUndefined();
      expect(credentials.refreshToken).toBeUndefined();
    });
  });

  describe('BindingStatus', () => {
    it('应该定义所有绑定状态', () => {
      expect(BindingStatus.SUCCESS).toBe('success');
      expect(BindingStatus.AGENT_NOT_FOUND).toBe('agent_not_found');
      expect(BindingStatus.MAX_BINDINGS_REACHED).toBe('max_bindings_reached');
      expect(BindingStatus.PRIVATE_AGENT).toBe('private_agent');
      expect(BindingStatus.NOT_INVITED).toBe('not_invited');
      expect(BindingStatus.ALREADY_BOUND).toBe('already_bound');
      expect(BindingStatus.ERROR).toBe('error');
    });
  });
});
