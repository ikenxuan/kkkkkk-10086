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
                    field: 'voicebox',
                    label: '语音盒',
                    bottomHelpMessage: '开启鸡音盒、丁真盒、鸡汤盒、耀阳盒、神鹰盒',
                    component: 'Switch',
                    required: false,
                },
                {
                    field: 'videotool',
                    label: '视频解析',
                    bottomHelpMessage: '是否开启视频解析工具',
                    component: 'Switch',
                    required: false,
                },
                {
                    field: 'address',
                    label: '抖音解析服务地址',
                    bottomHelpMessage: '没有本地部署可不填，将会默认使用在线接口',
                    component: 'Input',
                    componentProps: {
                        placeholder: '127.0.0.1:8000 或者 IP+端口号 或 域名'
                    },
                },
                {
                    field: 'rmmp4',
                    label: '删除视频/图集文件',
                    bottomHelpMessage: '可以偷偷看群友解析的视频都是什么玩意()；保存目录/resources/kkkdownload',
                    component: 'Switch',
                    required: false,
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
