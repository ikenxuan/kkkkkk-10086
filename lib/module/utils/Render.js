import { randomUUID } from 'node:crypto';
import puppeteer from '../../runtime/host/puppeteer.js';
import { Config, Common } from './index.js';
import { renderReactTemplate, resolveReactTemplateRoute, withStaticHtmlFile } from './react-template/index.js';
import Version from './Version.js';
import { applyWatermarkToImages, buildWatermarkText } from './Watermark.js';
const getRenderScale = (pct = 1) => {
    const renderScale = Math.min(2, Math.max(0.5, Number(Config.app.renderScale) / 100));
    return pct * renderScale;
};
const getRenderTimeout = () => {
    const seconds = Number(Config.app.RenderWaitTime);
    return (Number.isFinite(seconds) && seconds > 0 ? seconds : 60) * 1000;
};
const getMultiPageHeight = () => {
    const height = Number(Config.app.multiPageHeight);
    return Number.isFinite(height) && height > 0 ? height : 12000;
};
const captureImages = async (name, htmlPath, data) => {
    if (Config.app.multiPageRender !== false) {
        return await puppeteer.screenshotsFile(name, htmlPath, data);
    }
    const image = await puppeteer.screenshotFile(name, htmlPath, data);
    return image ? [image] : false;
};
export const Render = async (templatePath, params = {}) => {
    const useDarkTheme = Common.useDarkTheme();
    const reactRoute = resolveReactTemplateRoute(templatePath);
    if (!reactRoute) {
        throw new Error(`[Render] 未注册 React 模板路由：${templatePath}`);
    }
    let version;
    if (!Config.app.RemoveWatermark) {
        version = {
            plugin: 'yunzai-plugin',
            pluginName: Version.pluginName,
            pluginVersion: Version.version,
            releaseType: Version.version.includes('-') ? 'Preview' : 'Stable',
            poweredBy: Version.BotName,
            frameworkVersion: Version.BotVersion,
            hasUpdate: false
        };
    }
    let rendered;
    try {
        rendered = await renderReactTemplate(reactRoute, params, {
            scale: getRenderScale(params.scale ?? 1),
            theme: { mode: useDarkTheme ? 'dark' : 'light' },
            ambientCover: Config.app.ambientCover,
            version
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`[Render] React SSR 渲染失败（${reactRoute}）：${message}`, { cause: error });
    }
    const saveStem = reactRoute.split('/').pop()?.replace(/[^a-zA-Z0-9_-]/g, '-') || 'template';
    const screenshotData = {
        saveId: `${saveStem}-${randomUUID()}`,
        imgType: 'png',
        omitBackground: true,
        multiPage: Config.app.multiPageRender !== false,
        multiPageHeight: getMultiPageHeight(),
        pageGotoParams: {
            waitUntil: 'load',
            timeout: getRenderTimeout()
        }
    };
    const images = await withStaticHtmlFile(rendered.html, async (htmlPath) => await captureImages(`${Version.pluginName}/react/${reactRoute}`, htmlPath, screenshotData));
    if (images === false)
        return false;
    if (Config.app.RemoveWatermark)
        return images;
    return await applyWatermarkToImages(images, buildWatermarkText());
};
