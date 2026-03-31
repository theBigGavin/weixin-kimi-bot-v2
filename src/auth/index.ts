/**
 * Authentication Module
 * 
 * Provides WeChat QR code login functionality.
 * Re-exports from weixin-ilink for convenience.
 */

export { loginWithQR } from 'weixin-ilink';
export type { LoginResult, LoginCallbacks } from './types.js';
