var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import { existsSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PluginPath } from '../../../dir.js';
import { resolveReactTemplateRoute } from './routes.js';
const standaloneEntry = join(PluginPath, 'lib', 'react-template', 'index.mjs');
const renderOutputRoot = join(process.cwd(), 'temp', 'html');
let standaloneModulePromise;
const loadStandaloneModule = async () => {
    if (!existsSync(standaloneEntry)) {
        throw new Error(`React standalone 模板构建不存在：${standaloneEntry}，请先执行 pnpm build`);
    }
    const version = statSync(standaloneEntry).mtimeMs;
    const module = await import(__rewriteRelativeImportExtension(`${pathToFileURL(standaloneEntry).href}?v=${version}`));
    if (typeof module.createTemplateRenderer !== 'function') {
        throw new Error(`React standalone 模板入口缺少 createTemplateRenderer 导出：${standaloneEntry}`);
    }
    return module;
};
const getStandaloneModule = () => {
    if (!standaloneModulePromise) {
        standaloneModulePromise = loadStandaloneModule().catch(error => {
            standaloneModulePromise = undefined;
            throw error;
        });
    }
    return standaloneModulePromise;
};
const createRenderOutputDir = async () => {
    await mkdir(renderOutputRoot, { recursive: true });
    return await mkdtemp(join(renderOutputRoot, 'kkkkkk-10086-ktr-'));
};
export const renderReactTemplate = async (path, data, context) => {
    const route = resolveReactTemplateRoute(path);
    if (!route)
        throw new Error(`未注册 React 模板路由：${path}`);
    const outputDir = await createRenderOutputDir();
    let cleaned = false;
    const cleanup = async () => {
        if (cleaned)
            return;
        cleaned = true;
        await rm(outputDir, { recursive: true, force: true });
    };
    try {
        const module = await getStandaloneModule();
        const renderTemplate = module.createTemplateRenderer({
            outputDir,
            htmlFileName: 'fixed'
        });
        const result = await renderTemplate(route, data, context);
        if (!result.success || !result.htmlPath) {
            throw new Error(result.error || `React standalone 模板渲染失败：${route}`);
        }
        return { route, htmlPath: result.htmlPath, cleanup };
    }
    catch (error) {
        await cleanup();
        throw error;
    }
};
