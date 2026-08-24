import fs from 'node:fs';
import { basename, join } from 'node:path';
import { ClientPath, PluginPath } from '../../dir.js';
import { isRecord } from './record.js';
const hostPackageJson = readPackageMetadata(join(ClientPath, 'package.json'));
const pluginPath = PluginPath.replace(/\\/g, '/');
const pluginName = basename(pluginPath);
const getBotName = () => {
    try {
        const globalWithBot = globalThis;
        if (Array.isArray(globalWithBot.Bot?.uin))
            return 'TRSS-Yunzai';
    }
    catch { }
    return 'Miao-Yunzai';
};
const BotVersion = hostPackageJson.version;
const clientPath = ClientPath;
export default {
    get version() {
        return readPackageMetadata(`${pluginPath}/package.json`).version;
    },
    pluginName,
    pluginPath,
    get BotName() {
        return getBotName();
    },
    BotVersion,
    clientPath
};
function readPackageMetadata(file) {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!isRecord(value) || typeof value.version !== 'string') {
        throw new TypeError(`package.json version is invalid: ${file}`);
    }
    return { version: value.version };
}
