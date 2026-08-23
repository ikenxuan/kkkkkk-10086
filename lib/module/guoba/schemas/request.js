/** 「请求配置」分组：请求超时、Amagi 重试次数与代理。 */
import { divider, group, input, num, option, radio, sw } from '../../../module/guoba/helpers.js';
export const request = [
    group('请求配置'),
    divider('请求配置'),
    num('request.timeout', '请求超时时间', 5000, 9999999, 'ms', '请求超时时间，单位：毫秒'),
    num('request.amagiTimeout', 'Amagi 单次尝试超时', 1000, 60000, 'ms', '每次 Amagi 尝试的硬超时，最多一分钟'),
    num('request.amagiMaxRetries', 'Amagi 最大重试次数', 0, 5, '次', '初次请求之后的重试次数'),
    input('request.User-Agent', '请求 User-Agent', '专门用于核心库 amagi 请求的 User-Agent（Networks 模块不使用该 User-Agent）'),
    divider('代理配置'),
    sw('request.proxy.switch', '使用代理', '使用代理，开启后会使用代理服务器进行请求'),
    input('request.proxy.host', '代理主机', '代理服务器主机地址'),
    num('request.proxy.port', '代理端口', 0, 65535, '', '代理服务器端口'),
    radio('request.proxy.protocol', '代理协议', [
        option('HTTP', 'http'),
        option('HTTPS', 'https')
    ], '代理服务器协议类型(http/https)'),
    input('request.proxy.auth.username', '代理用户名', '没有用户名可以为空'),
    input('request.proxy.auth.password', '代理密码', '没有密码可以为空', 'InputPassword')
];
