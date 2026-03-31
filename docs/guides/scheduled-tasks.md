# 定时任务使用指南

系统内置了三个定时任务处理器，用于自动化提醒和系统维护。

## 可用处理器

### 1. reminder - 提醒任务

**用途**: 在指定时间向用户发送提醒消息

**使用场景**:
- 会议提醒
- 待办事项
- 重要事件

**创建方式**:

```
# 5分钟后提醒
/schedule create once 5 reminder 5分钟后开会

# 指定具体时间提醒
/schedule create once 2026-04-01T09:00:00 reminder 早上9点团队会议

# 每小时提醒一次（不太常用）
/schedule create interval 3600000 reminder 每小时喝水提醒
```

**数据格式**:
```json
{
  "agentId": "创始者_6265403e_i5dq",
  "userId": "wxid_xxx",
  "message": "5分钟后开会"
}
```

**微信通知效果**:
```
⏰ 提醒

5分钟后开会
```

---

### 2. daily_report - 日报生成

**用途**: 定时生成并发送日报

**使用场景**:
- 每日工作总结
- 定时数据汇报
- 定时健康/状态报告

**创建方式**:

```
# 每天早上9点生成日报
/schedule create cron "0 9 * * *" daily_report

# 每天晚上6点生成日报
/schedule create cron "0 18 * * *" daily_report

# 每4小时生成一次报告
/schedule create interval 14400000 daily_report
```

**数据格式**:
```json
{
  "agentId": "创始者_6265403e_i5dq",
  "userId": "wxid_xxx"
}
```

**微信通知效果**:
```
🟡 日报

日报生成时间: 2026/3/31 09:00:00
```

**注意**: 目前日报内容是简单的生成时间，后续可以扩展为包含：
- 当日处理的消息数量
- 执行的任务统计
- 系统运行状态
- 重要事件汇总

---

### 3. health_check - 健康检查

**用途**: 定时执行系统健康检查

**使用场景**:
- 监控系统状态
- 检查内存/磁盘使用情况
- 验证外部服务连接

**创建方式**:

```
# 每30分钟检查一次
/schedule create interval 1800000 health_check

# 每小时检查一次
/schedule create interval 3600000 health_check

# 每天早上8点检查
/schedule create cron "0 8 * * *" health_check
```

**数据格式**:
```json
{
  "agentId": "创始者_6265403e_i5dq",
  "userId": "wxid_xxx"
}
```

**微信通知效果**（仅在有异常时发送）:
```
🔴 系统健康检查

⚠️ 内存使用率: 85%
⚠️ 磁盘空间不足: 剩余 2GB
```

---

## 时间格式说明

### ONCE 类型

**相对时间（分钟数）**:
```
/schedule create once 5 reminder 5分钟后提醒我
/schedule create once 30 reminder 半小时后提醒我
/schedule create once 60 reminder 1小时后提醒我
```

**绝对时间（ISO格式）**:
```
/schedule create once 2026-04-01T10:00:00 reminder 指定时间提醒
/schedule create once 2026-04-01T10:00:00.000+08:00 reminder 带时区
```

### INTERVAL 类型

单位是**毫秒**：
```
60000     = 1分钟
300000    = 5分钟
3600000   = 1小时
86400000  = 1天
```

### CRON 类型

格式: `"分 时 日 月 周"`

```
"0 9 * * *"      每天9:00
"0 9 * * 1"      每周一9:00
"0 9 1 * *"      每月1日9:00
"*/30 * * * *"   每30分钟
```

---

## 管理任务

### 查看所有任务
```
/schedule list
```

### 取消任务
```
/schedule cancel <任务ID>
```

示例:
```
/schedule cancel task_1774977493813_ny2a0do
```

---

## 完整使用示例

### 场景1：工作日每天早上提醒
```
# 创建工作日提醒（Cron不支持工作日，需要创建5个每日任务）
/schedule create cron "0 9 * * 1" reminder 周一早上好，开始工作了
/schedule create cron "0 9 * * 2" reminder 周二早上好
...
```

### 场景2：番茄工作法
```
# 25分钟工作 + 5分钟休息
/schedule create interval 1500000 reminder 番茄钟结束，休息5分钟
```

### 场景3：系统监控
```
```
/schedule create interval 3600000 health_check
/schedule create cron "0 9 * * *" daily_report
```

---

## 注意事项

1. **任务持久化**: 定时任务是内存中的，重启后会丢失。需要持久化的任务后续会支持存储到文件。

2. **处理器限制**: 目前只有 reminder、daily_report、health_check 三个内置处理器。后续可以扩展自定义处理器。

3. **精度**: Cron 解析只支持简单格式（分 时），复杂的 cron 表达式会被简化。

4. **时区**: 服务器使用本地时区，跨时区场景需要注意时间换算。
