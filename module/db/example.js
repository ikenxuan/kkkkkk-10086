import Config from '../utils/Config.js'

/**
 * 数据库使用示例
 * 展示如何使用新的数据库系统
 */

import { getBilibiliDB, getDouyinDB, bilibiliDB, cleanOldDynamicCache } from './index.js'

// 使用示例
async function example() {
  try {
    // 获取数据库实例
    const bilibiliDB = await getBilibiliDB()
    const douyinDB = await getDouyinDB()

    // Bilibili 数据库操作示例
    console.log('=== Bilibili 数据库操作示例 ===')

    // 1. 订阅UP主
    await bilibiliDB.subscribeBilibiliUser('123456', 'bot1', 123456789, 'UP主昵称')
    console.log('订阅UP主成功')

    // 2. 检查是否已订阅
    const isSubscribed = await bilibiliDB.isSubscribed(123456789, '123456')
    console.log('是否已订阅:', isSubscribed)

    // 3. 添加动态缓存
    await bilibiliDB.addDynamicCache('dynamic123', 123456789, '123456', 'DYNAMIC_TYPE_AV')
    console.log('添加动态缓存成功')

    // 4. 检查动态是否已推送
    const isPushed = await bilibiliDB.isDynamicPushed('dynamic123', 123456789, '123456')
    console.log('动态是否已推送:', isPushed)

    // 5. 添加过滤词
    await bilibiliDB.addFilterWord(123456789, '广告')
    console.log('添加过滤词成功')

    // 6. 获取过滤配置
    const filterConfig = await bilibiliDB.getFilterConfig(123456789)
    console.log('过滤配置:', filterConfig)

    // Douyin 数据库操作示例
    console.log('\n=== Douyin 数据库操作示例 ===')

    // 1. 订阅抖音用户
    await douyinDB.subscribeDouyinUser('123456', 'bot1', 'MS4wLjABAAAA...', 'douyin123', '抖音用户昵称')
    console.log('订阅抖音用户成功')

    // 2. 检查是否已订阅
    const isDouyinSubscribed = await douyinDB.isSubscribed('MS4wLjABAAAA...', '123456')
    console.log('是否已订阅:', isDouyinSubscribed)

    // 3. 添加作品缓存
    await douyinDB.addAwemeCache('aweme123', 'MS4wLjABAAAA...', '123456')
    console.log('添加作品缓存成功')

    // 4. 检查作品是否已推送
    const isAwemePushed = await douyinDB.isAwemePushed('aweme123', 'MS4wLjABAAAA...', '123456')
    console.log('作品是否已推送:', isAwemePushed)

    // 5. 更新直播状态
    await douyinDB.updateLiveStatus('MS4wLjABAAAA...', true)
    console.log('更新直播状态成功')

    // 6. 获取直播状态
    const liveStatus = await douyinDB.getLiveStatus('MS4wLjABAAAA...')
    console.log('直播状态:', liveStatus)

    // 清理旧缓存示例
    console.log('\n=== 清理旧缓存示例 ===')

    // 清理7天前的B站动态缓存
    const bilibiliCleaned = await bilibiliDB.cleanOldDynamicCache(7)
    console.log('清理的B站动态缓存数量:', bilibiliCleaned)

    // 清理7天前的抖音作品缓存
    const douyinCleaned = await douyinDB.cleanOldAwemeCache(7)
    console.log('清理的抖音作品缓存数量:', douyinCleaned)

  } catch (error) {
    console.error('数据库操作失败:', error)
  }
}

// 如果直接运行此文件，执行示例
example()

export { example }
