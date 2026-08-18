import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const STATIC_HTML_PREFIX = 'kkkkkk-10086-render-';
/**
 * Neutralize art-template's opening delimiter for compatibility with Yunzai
 * renderers that still preprocess every `tplFile` before opening it.
 *
 * Only the opening delimiter needs escaping. Keeping `}}` untouched is
 * important because compiled CSS commonly contains adjacent closing braces;
 * character references are not decoded inside HTML raw-text `<style>` blocks.
 */
export const escapeTemplateDelimiters = (html) => html.replaceAll('{{', '&#123;&#123;');
/**
 * Materialize one standalone React document for Yunzai Puppeteer and always
 * remove it after the screenshot callback settles. A unique directory keeps
 * concurrent renders isolated from each other.
 */
export const withStaticHtmlFile = async (html, callback) => {
    const rendererTempRoot = join(process.cwd(), 'temp', 'html');
    await mkdir(rendererTempRoot, { recursive: true });
    const directory = await mkdtemp(join(rendererTempRoot, STATIC_HTML_PREFIX));
    const htmlPath = join(directory, 'index.html');
    try {
        await writeFile(htmlPath, escapeTemplateDelimiters(html), 'utf8');
        return await callback(htmlPath);
    }
    finally {
        await rm(directory, { recursive: true, force: true });
    }
};
