var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ResourcePath } from '../../../dir.js';
import { renderTemplateDocument } from './html.js';
import { resolveReactTemplateRoute } from './routes.js';
let registryPromise;
const runtimeRoot = dirname(fileURLToPath(import.meta.url));
const loadBuiltRegistry = async () => {
    const registryPath = join(runtimeRoot, '../../../template-registry.js');
    if (!existsSync(registryPath)) {
        throw new Error(`React 模板注册表不存在：${registryPath}，请先执行 pnpm build`);
    }
    const module = await import(__rewriteRelativeImportExtension(`${pathToFileURL(registryPath).href}?v=${readFileSync(registryPath).byteLength}`));
    if (!module.templates || typeof module.templates !== 'object') {
        throw new Error('React 模板注册表缺少 templates 导出');
    }
    return module.templates;
};
export const loadReactTemplateRegistry = () => {
    registryPromise ??= loadBuiltRegistry();
    return registryPromise;
};
let stylesheetCache;
const loadCss = () => {
    if (stylesheetCache)
        return stylesheetCache;
    const candidates = [
        {
            file: join(runtimeRoot, '../../../template-style.css'),
            assetsDir: join(runtimeRoot, '../../..')
        },
        {
            file: join(ResourcePath, 'react-template', 'style.css'),
            assetsDir: ResourcePath
        }
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate.file)) {
            stylesheetCache = {
                content: readFileSync(candidate.file, 'utf8'),
                assetsDir: candidate.assetsDir
            };
            return stylesheetCache;
        }
    }
    throw new Error(`React 模板样式不存在：${candidates.map(candidate => candidate.file).join(', ')}`);
};
export const renderReactTemplate = async (path, data, context) => {
    const route = resolveReactTemplateRoute(path);
    if (!route)
        throw new Error(`未注册 React 模板路由：${path}`);
    const registry = await loadReactTemplateRegistry();
    const definition = registry[route];
    if (!definition)
        throw new Error(`React 模板注册表缺少路由：${route}`);
    if (definition.validate && !definition.validate(data))
        throw new Error(`React 模板数据校验失败：${route}`);
    const stylesheet = loadCss();
    const result = await renderTemplateDocument({
        route,
        component: definition.component,
        data,
        context,
        css: stylesheet.content,
        assetsDir: ResourcePath,
        cssAssetsDir: stylesheet.assetsDir
    });
    return { ...result, route };
};
