/**
 * Login Script
 * 
 * Standalone login script: run `npm run login` to authenticate via QR code.
 * Saves credentials to ~/.weixin-kimi-bot/credentials.json
 */

import qrterm from 'qrcode-terminal';
import { loginWithQR } from './auth/index.js';
import { saveCredentials } from './config/credentials.js';

async function main() {
  console.log('=== 微信 Kimi Bot 登录 ===\n');

  try {
    const result = await loginWithQR({
      onQRCode: (url: string) => {
        console.log('\n请使用微信扫描以下二维码：\n');
        qrterm.generate(url, { small: true });
        console.log(`\n如无法显示，请在浏览器打开: ${url}\n`);
      },
      onStatusChange: (status) => {
        switch (status) {
          case 'waiting':
            process.stdout.write('.');
            break;
          case 'scanned':
            console.log('\n\n已扫码，请在微信上确认...');
            break;
          case 'refreshing':
            console.log('\n二维码已过期，正在刷新...');
            break;
        }
      },
    });

    saveCredentials(result);
    console.log('\n✅ 微信连接成功！');
    console.log(`\n账号 ID: ${result.accountId}`);
    console.log(`Base URL: ${result.baseUrl}`);
    if (result.userId) {
      console.log(`用户 ID: ${result.userId}`);
    }
    console.log('\n登录完成！现在可以运行 npm start 启动 Bot。');
  } catch (err) {
    console.error('\n❌ 登录失败:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
