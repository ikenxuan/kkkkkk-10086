import { Config } from './model/config.js'
// 支持锅巴
export function supportGuoba() {
    return {
        // 插件信息，将会显示在前端页面
        // 如果你的插件没有在插件库里，那么需要填上补充信息
        // 如果存在的话，那么填不填就无所谓了，填了就以你的信息为准
        pluginInfo: {
            name: 'kkkkkk-10086',
            title: 'kkkkkk-10086',
            author: '@ikenxuan',
            authorLink: 'https://gitee.com/ikenxuan',
            link: 'https://gitee.com/ikenxuan/kkkkkk-10086',
            isV3: true,
            isV2: false,
            description: '提供了视频解析功能，额外的语音盒资源。自用练手项目',
            // 显示图标，此为个性化配置
            // 图标可在 https://icon-sets.iconify.design 这里进行搜索
            icon: 'svg-spinners:blocks-shuffle-3',
            // 图标颜色，例：#FF0000 或 rgb(255, 0, 0)
            iconColor: '#00c3ff'
        },
        // 配置项信息
        configInfo: {
            // 配置项 schemas
            schemas: [
                {
                    field: 'videotool',
                    label: '视频解析',
                    bottomHelpMessage: '视频解析工具总开关，修改后重启生效',
                    component: 'Switch',
                    required: false,
                },
                {
                    field: 'defaulttool',
                    label: '默认解析',
                    bottomHelpMessage: '识别最高优先级',
                    component: 'Switch',
                    required: false,
                },
                {
                    field: 'comments',
                    label: '抖音评论解析',
                    bottomHelpMessage: '可以解析评论',
                    component: 'Switch',
                    required: false,
                },
                {
                    field: 'numcomments',
                    label: '评论解析数量',
                    bottomHelpMessage: '可选值1-50，默认为35，过高可能导致puppeteer渲染崩溃',
                    component: 'Input',
                    required: true
                },
                {
                    field: 'rmmp4',
                    label: '删除视频缓存',
                    bottomHelpMessage: '可以偷偷看群友解析的视频都是什么玩意()；保存目录/resources/kkkdownload',
                    component: 'Switch',
                    required: false,
                },
                {
                    field: 'ck',
                    label: '抖音ck',
                    bottomHelpMessage: '登录https://www.douyin.com/使用F12，进入控制台输入document.cookie获取',
                    component: 'InputPassword',
                    required: true
                },
            ],
            // 获取配置数据方法（用于前端填充显示数据）
            getConfigData() {
                return Config
            },
            // 设置配置的方法（前端点确定后调用的方法）
            setConfigData(data, { Result }) {
                for (let [keyPath, value] of Object.entries(data)) {
                    if (Config[keyPath] != value) { Config[keyPath] = value }
                }
                return Result.ok({}, '保存成功~')
            }
        }
    }
}
