/** 「快手配置」分组：快手解析开关、解析提示与评论数量。 */
import { divider, group, num, sw } from '../../../module/guoba/helpers.js';
export const kuaishou = [
    group('快手配置'),
    divider('快手解析'),
    sw('kuaishou.kuaishoutool', '快手解析开关（旧版键）', '受总开关影响'),
    sw('kuaishou.switch', '快手解析开关', '受总开关影响'),
    sw('kuaishou.comment', '快手评论解析', '快手评论解析（新项目配置名）'),
    sw('kuaishou.kuaishoutip', '快手解析提示', '快手解析提示，发送提示信息：“检测到快手链接，开始解析”'),
    num('kuaishou.kuaishounumcomments', '快手评论数量（旧版键）', 0, 30, '条', '快手评论数量，范围1~30条。已被「评论解析数量」取代，保留以兼容旧配置'),
    num('kuaishou.numcomment', '快手评论数量', 0, 30, '条', '快手评论数量（新项目配置名，兼容 kuaishounumcomments）')
];
