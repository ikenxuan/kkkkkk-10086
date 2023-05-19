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
            icon: 'emojione-v1:face-savoring-food',
            // 图标颜色，例：#FF0000 或 rgb(255, 0, 0)
            iconColor: '#00c3ff'
        },
        // 配置项信息
        configInfo: {
            // 配置项 schemas
            schemas: [
                {
                    field: 'account',
                    label: 'TikHub 账号',
                    bottomHelpMessage: '可到 https://api.tikhub.io/#/Authorization/register_user_users_register__post 注册账号',
                    component: 'Input',
                    required: false,
                    componentProps: {
                        placeholder: '在此填写账号'
                    },
                },
                {
                    field: 'password',
                    label: 'TikHub 账号密码',
                    bottomHelpMessage: '获取方法同上',
                    component: 'InputPassword',
                    required: false,
                    componentProps: {
                        placeholder: '在此填写密码'
                    },
                },
                {
                    field: 'access_token',
                    label: 'TikHub 鉴权密钥',
                    bottomHelpMessage: 'https://api.tikhub.io/#/Authorization/login_for_access_token_user_login_post 页面获取',
                    component: 'InputPassword',
                    required: false,
                    componentProps: {
                        placeholder: '在此填写鉴权密钥'
                    },
                },
                {
                    field: 'address',
                    label: '请求接口API',
                    bottomHelpMessage: '没有部署可以不填，将会使用公共API',
                    component: 'Input',
                    componentProps: {
                        placeholder: '127.0.0.1:8000 或者 IP+端口号 或 域名'
                    },
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
