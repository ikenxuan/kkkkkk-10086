import { isAbsolute, relative, sep } from 'node:path';
import { importHost } from './import-host.js';
const STATIC_HTML_FILE_KEY = '__kkkStaticHtmlFile';
const { default: hostPuppeteer } = await importHost('lib', 'puppeteer', 'puppeteer.js');
const yunzaiPuppeteer = hostPuppeteer;
/**
 * Yunzai's legacy renderer preprocesses every `tplFile` with art-template.
 * Intercept only KKK's explicitly marked standalone documents and return their
 * renderer-relative path unchanged; ordinary Yunzai templates keep the native
 * `dealTpl` implementation.
 */
const originalDealTemplate = yunzaiPuppeteer.dealTpl;
if (originalDealTemplate) {
    yunzaiPuppeteer.dealTpl = (name, data) => {
        const staticHtmlPath = data[STATIC_HTML_FILE_KEY];
        if (typeof staticHtmlPath === 'string') {
            const relativePath = relative(process.cwd(), staticHtmlPath);
            const escapesRoot = relativePath === '..' ||
                relativePath.startsWith(`..${sep}`) ||
                isAbsolute(relativePath);
            if (relativePath && !escapesRoot) {
                return `./${relativePath.split(sep).join('/')}`;
            }
            return false;
        }
        return originalDealTemplate.call(yunzaiPuppeteer, name, data);
    };
}
const withStaticHtml = (htmlPath, data) => ({
    ...data,
    tplFile: htmlPath,
    [STATIC_HTML_FILE_KEY]: htmlPath
});
const puppeteer = {
    screenshot: async (name, data) => await hostPuppeteer.screenshot(name, data),
    screenshots: async (name, data) => await hostPuppeteer.screenshots(name, data),
    screenshotFile: async (name, htmlPath, data) => await hostPuppeteer.screenshot(name, withStaticHtml(htmlPath, data)),
    screenshotsFile: async (name, htmlPath, data) => await hostPuppeteer.screenshots(name, withStaticHtml(htmlPath, data))
};
export default puppeteer;
