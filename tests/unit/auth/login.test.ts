/**
 * Login Module Unit Tests
 * 
 * Tests for the login script functionality
 */

import { describe, it, expect } from 'vitest';
import type { LoginCallbacks, LoginResult } from '../../../src/auth/types.js';

describe('Login Types', () => {
  it('should have correct LoginResult structure', () => {
    const result: LoginResult = {
      botToken: 'test-token',
      accountId: 'test-account',
      baseUrl: 'https://test.example.com',
      userId: 'test-user',
    };

    expect(result.botToken).toBe('test-token');
    expect(result.accountId).toBe('test-account');
    expect(result.baseUrl).toBe('https://test.example.com');
    expect(result.userId).toBe('test-user');
  });

  it('should have optional userId in LoginResult', () => {
    const result: LoginResult = {
      botToken: 'test-token',
      accountId: 'test-account',
      baseUrl: 'https://test.example.com',
      // userId is optional
    };

    expect(result.userId).toBeUndefined();
  });

  it('should have correct LoginCallbacks structure', () => {
    const callbacks: LoginCallbacks = {
      onQRCode: (url: string) => {
        expect(typeof url).toBe('string');
      },
      onStatusChange: (status) => {
        expect(['waiting', 'scanned', 'expired', 'refreshing']).toContain(status);
      },
    };

    // Test callbacks
    callbacks.onQRCode('https://example.com/qr');
    callbacks.onStatusChange('waiting');
  });
});
