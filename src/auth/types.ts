/**
 * Authentication Types
 * 
 * Type definitions for login and authentication flows
 */

/**
 * Login result from QR code authentication
 */
export interface LoginResult {
  /** Bot authentication token */
  botToken: string;
  /** WeChat account ID */
  accountId: string;
  /** iLink API base URL */
  baseUrl: string;
  /** Optional user ID */
  userId?: string;
}

/**
 * Callbacks for login process
 */
export interface LoginCallbacks {
  /** Called when a QR code URL is available for display */
  onQRCode: (url: string) => void;
  /** Called when the login status changes */
  onStatusChange: (status: 'waiting' | 'scanned' | 'expired' | 'refreshing') => void;
}
