/**
 * weixin-kimi-bot — Bridge WeChat messages to Kimi via ACP protocol.
 *
 * Flow: WeChat → ILinkClient.poll() → TaskRouter → [DIRECT/LONGTASK/FLOWTASK] → ILinkClient.sendText()
 */

import { main } from './clients/polling.js';

// Only run main if this file is executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('启动失败:', err);
    process.exit(1);
  });
}
