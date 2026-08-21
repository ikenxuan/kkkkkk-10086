var __rewriteRelativeImportExtension = (this && this.__rewriteRelativeImportExtension) || function (path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
};
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ClientPath } from '../../dir.js';
export async function importHost(...segments) {
    const url = pathToFileURL(join(ClientPath, ...segments)).href;
    return await import(__rewriteRelativeImportExtension(url));
}
