var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import { readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AppsPath } from '../../dir.js';
function isConstructable(value) {
    if (typeof value !== 'function' || !value.prototype)
        return false;
    try {
        Reflect.construct(String, [], value);
        return true;
    }
    catch {
        return false;
    }
}
function getPluginConstructor(module, file) {
    const exports = Object.entries(module);
    const pluginExport = exports[0];
    if (exports.length !== 1 || !pluginExport || pluginExport[0] === 'default' || !isConstructable(pluginExport[1])) {
        throw new Error(`${file} must export exactly one named plugin constructor`);
    }
    return pluginExport[1];
}
export function compareAppFilenames(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}
export async function loadAppsFrom(appsDir) {
    const entries = await readdir(appsDir, { withFileTypes: true });
    const files = entries
        .filter(entry => entry.isFile() && entry.name.endsWith('.js'))
        .map(entry => entry.name)
        .sort(compareAppFilenames);
    const imports = files.map(file => import(__rewriteRelativeImportExtension(pathToFileURL(join(appsDir, file)).href)));
    const results = await Promise.allSettled(imports);
    const apps = {};
    const loadedFiles = [];
    const failedFiles = [];
    files.forEach((file, index) => {
        const result = results[index];
        if (!result || result.status === 'rejected') {
            failedFiles.push({ file, error: result?.reason ?? new Error(`Missing import result for ${file}`) });
            return;
        }
        try {
            Object.defineProperty(apps, basename(file, '.js'), {
                value: getPluginConstructor(result.value, file),
                enumerable: true,
                writable: true,
                configurable: true
            });
            loadedFiles.push(file);
        }
        catch (error) {
            failedFiles.push({ file, error });
        }
    });
    return { apps, loadedFiles, failedFiles };
}
export async function loadApps() {
    return await loadAppsFrom(AppsPath);
}
