# 数据库系统文档

本文档介绍了基于 Sequelize 和 SQLite3 的新数据库系统，该系统复刻了 TypeScript 版本的功能。

## 概述

新的数据库系统提供了以下功能：
- 用户订阅管理
- 动态/作品缓存
- 过滤词和过滤标签管理
- 自动配置同步
- 数据清理功能

## 数据库结构

### Bilibili 数据库

#### 表结构
- **Bots**: 存储机器人信息
- **Groups**: 存储群组信息
- **BilibiliUsers**: 存储B站用户信息
- **GroupUserSubscriptions**: 存储群组订阅关系
- **DynamicCaches**: 存储已推送的动态ID
- **FilterWords**: 存储过滤词
- **FilterTags**: 存储过滤标签

#### 主要字段
- `host_mid`: B站用户UID
- `dynamic_id`: 动态ID
- `groupId`: 群组ID
- `botId`: 机器人ID
- `filterMode`: 过滤模式（blacklist/whitelist）

### Douyin 数据库

#### 表结构
- **Bots**: 存储机器人信息
- **Groups**: 存储群组信息
- **DouyinUsers**: 存储抖音用户信息
- **GroupUserSubscriptions**: 存储群组订阅关系
- **AwemeCaches**: 存储已推送的作品ID
- **FilterWords**: 存储过滤词
- **FilterTags**: 存储过滤标签

#### 主要字段
- `sec_uid`: 抖音用户sec_uid
- `short_id`: 抖音号
- `aweme_id`: 作品ID
- `living`: 是否正在直播
- `filterMode`: 过滤模式（blacklist/whitelist）

## 使用方法

### 基本使用

```javascript
import { getBilibiliDB, getDouyinDB, bilibiliDB, douyinDB } from './module/db/index.js'

// 方式1：获取数据库实例（推荐）
const bilibiliDB = await getBilibiliDB()
const douyinDB = await getDouyinDB()

// 方式2：直接使用预初始化的实例
// 注意：这些实例在模块加载时已经初始化
console.log(bilibiliDB) // 已初始化的B站数据库实例
console.log(douyinDB)   // 已初始化的抖音数据库实例
```

### Bilibili 数据库操作

#### 订阅管理
```javascript
// 订阅UP主
await bilibiliDB.subscribeBilibiliUser('群组ID', '机器人ID', 123456789, 'UP主昵称')

// 取消订阅
await bilibiliDB.unsubscribeBilibiliUser('群组ID', 123456789)

// 检查是否已订阅
const isSubscribed = await bilibiliDB.isSubscribed(123456789, '群组ID')
```

#### 动态缓存
```javascript
// 添加动态缓存
await bilibiliDB.addDynamicCache('动态ID', 123456789, '群组ID', '动态类型')

// 检查动态是否已推送
const isPushed = await bilibiliDB.isDynamicPushed('动态ID', 123456789, '群组ID')
```

#### 过滤管理
```javascript
// 添加过滤词
await bilibiliDB.addFilterWord(123456789, '广告')

// 删除过滤词
await bilibiliDB.removeFilterWord(123456789, '广告')

// 添加过滤标签
await bilibiliDB.addFilterTag(123456789, '游戏')

// 获取过滤配置
const filterConfig = await bilibiliDB.getFilterConfig(123456789)

// 检查内容是否应该被过滤
const shouldFilter = await bilibiliDB.shouldFilter(pushItem, extraTags)
```

### Douyin 数据库操作

#### 订阅管理
```javascript
// 订阅抖音用户
await douyinDB.subscribeDouyinUser('群组ID', '机器人ID', 'sec_uid', '抖音号', '用户昵称')

// 取消订阅
await douyinDB.unsubscribeDouyinUser('群组ID', 'sec_uid')

// 检查是否已订阅
const isSubscribed = await douyinDB.isSubscribed('sec_uid', '群组ID')
```

#### 作品缓存
```javascript
// 添加作品缓存
await douyinDB.addAwemeCache('作品ID', 'sec_uid', '群组ID')

// 检查作品是否已推送
const isPushed = await douyinDB.isAwemePushed('作品ID', 'sec_uid', '群组ID')
```

#### 直播状态管理
```javascript
// 更新直播状态
await douyinDB.updateLiveStatus('sec_uid', true)

// 获取直播状态
const liveStatus = await douyinDB.getLiveStatus('sec_uid')
```

#### 过滤管理
```javascript
// 添加过滤词
await douyinDB.addFilterWord('sec_uid', '广告')

// 删除过滤词
await douyinDB.removeFilterWord('sec_uid', '广告')

// 添加过滤标签
await douyinDB.addFilterTag('sec_uid', '游戏')

// 获取过滤配置
const filterConfig = await douyinDB.getFilterConfig('sec_uid')

// 检查内容是否应该被过滤
const shouldFilter = await douyinDB.shouldFilter(pushItem, tags)
```

### 预初始化实例

为了方便使用，模块提供了预初始化的数据库实例：

```javascript
import { bilibiliDB, douyinDB } from './module/db/index.js'

// 直接使用，无需await初始化
await bilibiliDB.subscribeBilibiliUser('123456', 'bot1', 123456789, 'UP主昵称')
await douyinDB.subscribeDouyinUser('123456', 'bot1', 'sec_uid', 'douyin123', '抖音用户昵称')
```

这些实例在模块加载时已经完成初始化，可以直接使用。

## 高级功能

### 配置同步
数据库会自动同步配置文件中的订阅信息：
```javascript
// 手动触发配置同步
await bilibiliDB.syncConfigSubscriptions(Config.pushlist.bilibili)
await douyinDB.syncConfigSubscriptions(Config.pushlist.douyin)
```

### 数据清理
```javascript
// 清理7天前的缓存数据
const bilibiliCleaned = await bilibiliDB.cleanOldDynamicCache(7)
const douyinCleaned = await douyinDB.cleanOldAwemeCache(7)

// 或使用统一接口
import { cleanOldDynamicCache } from './module/db/index.js'
const cleaned = await cleanOldDynamicCache('bilibili', 7)
```

### 批量操作
```javascript
// 获取群组的所有订阅
const subscriptions = await bilibiliDB.getGroupSubscriptions('群组ID')

// 获取用户的所有订阅群组
const groups = await bilibiliDB.getUserSubscribedGroups(123456789)

// 获取机器人管理的所有群组
const botGroups = await bilibiliDB.getBotGroups('机器人ID')
```

### API 对比

| 方法 | 描述 | 优势 |
|------|------|------|
| `getBilibiliDB()` | 获取数据库实例 | 适合在函数内使用，确保初始化完成 |
| `bilibiliDB` | 预初始化实例 | 适合在模块顶层使用，无需await |
| `douyinDB` | 预初始化实例 | 适合在模块顶层使用，无需await |

## 迁移指南

### 从旧系统迁移
如果你正在从旧的数据库系统迁移，请注意以下变化：

1. **API 变化**: 新系统使用面向对象的API，而不是函数式API
2. **数据结构**: 新系统使用关系型数据库结构，支持更复杂的查询
3. **配置同步**: 新系统会自动同步配置文件中的订阅信息



## 错误处理

```javascript
try {
  const bilibiliDB = await getBilibiliDB()
  await bilibiliDB.subscribeBilibiliUser('群组ID', '机器人ID', 123456789, 'UP主昵称')
} catch (error) {
  console.error('数据库操作失败:', error)
}
```

## 性能优化

1. **连接池**: 数据库使用连接池来优化性能
2. **缓存**: 频繁访问的数据会被缓存
3. **批量操作**: 支持批量插入和更新操作
4. **索引**: 关键字段已建立索引以提高查询性能

## 注意事项

1. 数据库文件位于 `data/` 目录下
2. 首次运行时会自动创建数据库表结构
3. 配置文件变化时会自动同步到数据库
4. 建议定期清理旧的缓存数据以节省存储空间

## 示例代码

完整的使用示例请参考 `example.js` 文件。