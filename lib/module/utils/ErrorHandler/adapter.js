// 这张表在 ktr/template/other/handlerError/components/handlerError.tsx 里有一份等价副本。
// 两份不是疏漏：ktr/ 是独立的 SSR/浏览器侧模板树，只从 ktr/utils/ 取共享代码，不导入 src/
// （模板构建没有配 "@/" 别名，也不该把 node 侧运行时代码拖进 vite bundle）。
// 改这里时必须同步改模板那一份，否则错误卡片上的适配器图标会和 src 侧判定结果不一致。
const ADAPTER_LOGO_RULES = [
    { pattern: /napcat/i, path: '/image/other/handlerError/napcat.webp' },
    { pattern: /lagrange/i, path: '/image/other/handlerError/lagrange.webp' },
    { pattern: /chronocat/i, path: '/image/other/handlerError/chronocat.svg' },
    { pattern: /llonebot|lltwo(bot)?/i, path: '/image/other/handlerError/llonebot.webp' },
    { pattern: /conwechat/i, path: '/image/other/handlerError/conwechat.webp' },
    { pattern: /go[-_ ]?cq|gocq[-_ ]?http/i, path: '/image/other/handlerError/gocq-http.webp' },
    { pattern: /milky/i, path: '/image/other/handlerError/Milky.png' },
    { pattern: /satori/i, path: '/image/other/handlerError/satori.png' },
    { pattern: /onebot|ob11/i, path: '/image/other/handlerError/onebot.png' }
];
const asRecord = (value) => typeof value === 'object' && value !== null ? value : {};
const asText = (value) => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
const firstText = (...values) => values.map(asText).find(Boolean) || '';
const getLabels = (event) => {
    const adapter = event.bot?.adapter;
    const adapterRecord = asRecord(adapter);
    const botVersion = asRecord(event.bot?.version);
    const apk = asRecord(event.bot?.apk);
    return [
        typeof adapter === 'string' ? adapter : '',
        event.adapter_id,
        event.adapter_name,
        ...Object.values(adapterRecord),
        ...Object.values(botVersion),
        ...Object.values(apk)
    ].map(asText).filter(Boolean);
};
const getStandard = (labels, explicit) => {
    const value = firstText(explicit);
    if (value)
        return value;
    const joined = labels.join(' ').toLowerCase();
    if (joined.includes('milky'))
        return 'Milky';
    if (joined.includes('satori') || joined.includes('chronocat'))
        return 'Satori';
    if (joined.includes('onebot') ||
        joined.includes('napcat') ||
        joined.includes('lagrange') ||
        joined.includes('llonebot') ||
        joined.includes('gocq') ||
        joined.includes('go-cq'))
        return 'OneBot';
    return 'unknown';
};
/**
 * Normalize the adapter fields exposed by different Yunzai protocols.
 * Some adapters only expose a generic adapter object, while their concrete
 * display name is available as `bot.version.app_name`.
 */
export const getAdapterInfo = (event) => {
    if (!event?.bot && !event?.adapter_name && !event?.adapter_id)
        return undefined;
    const adapter = event.bot?.adapter;
    const adapterRecord = asRecord(adapter);
    const botVersion = asRecord(event.bot?.version);
    const apk = asRecord(event.bot?.apk);
    const labels = getLabels(event);
    const name = firstText(adapterRecord.name, botVersion.app_name, event.adapter_name, typeof adapter === 'string' ? adapter : '', adapterRecord.id, adapterRecord.platform, event.adapter_id, apk.display, botVersion.app_full_name, botVersion.name, 'unknown');
    const version = firstText(adapterRecord.version, apk.version, botVersion.app_version, botVersion.version, botVersion.id, 'unknown');
    const platform = firstText(adapterRecord.platform, event.adapter_id, botVersion.app_name, typeof adapter === 'string' ? adapter : '', 'unknown');
    const protocol = firstText(adapterRecord.protocol, adapterRecord.protocol_name, adapterRecord.id, botVersion.id, botVersion.name, botVersion.app_name, 'unknown');
    const communication = firstText(adapterRecord.communication, adapterRecord.transport, adapterRecord.mode, adapterRecord.type, 'unknown');
    return {
        name,
        version,
        protocol,
        platform,
        standard: getStandard(labels, adapterRecord.standard),
        communication,
        labels
    };
};
/**
 * Resolve the handlerError asset by matching every normalized adapter field.
 */
export const getAdapterLogoPath = (adapterInfo) => {
    const values = Object.values(adapterInfo).map(asText).filter(Boolean).join(' ');
    return ADAPTER_LOGO_RULES.find(rule => rule.pattern.test(values))?.path;
};
