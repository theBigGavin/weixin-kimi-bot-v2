/**
 * 喝水提醒脚本
 * 2分钟后提醒用户喝水
 */

import { SchedulerManager, ScheduleType } from './src/scheduler/manager.js';

// 获取调度器实例
const scheduler = SchedulerManager.getInstance();

// 注册提醒处理器
scheduler.registerHandler('water-reminder', (data) => {
  const message = data?.message as string || '该喝水啦！💧';
  console.log('\n========================================');
  console.log('⏰ 提醒时间到！');
  console.log(message);
  console.log('========================================\n');
  
  // 退出程序
  scheduler.stopAll();
  process.exit(0);
});

// 创建2分钟后执行的提醒任务
const task = scheduler.schedule({
  name: '喝水提醒',
  type: ScheduleType.ONCE,
  schedule: {
    delay: 2 * 60 * 1000, // 2分钟（以毫秒为单位）
  },
  handler: 'water-reminder',
  data: {
    message: '💧 喝水时间到啦！起来喝杯水，休息一下吧~',
  },
});

console.log(`✅ 已设置提醒任务: ${task.name}`);
console.log(`🕐 将在 2 分钟后提醒您喝水`);
console.log(`⏳ 任务ID: ${task.id}`);
console.log('\n提示: 按 Ctrl+C 可以取消提醒\n');

// 启动调度器
scheduler.start();

// 显示倒计时
let remainingSeconds = 2 * 60;
const countdownInterval = setInterval(() => {
  remainingSeconds--;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  process.stdout.write(`\r⏱️  剩余时间: ${minutes}分${seconds}秒    `);
  
  if (remainingSeconds <= 0) {
    clearInterval(countdownInterval);
  }
}, 1000);

// 处理退出
process.on('SIGINT', () => {
  console.log('\n\n❌ 已取消提醒');
  scheduler.stopAll();
  process.exit(0);
});
