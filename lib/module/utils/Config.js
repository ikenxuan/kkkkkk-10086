import fs from 'node:fs';
import { join } from 'node:path';
import chokidar, {} from 'chokidar';
import _ from 'lodash';
import YAML from 'yaml';
import YamlReader from './YamlReader.js';
import Version from './Version.js';
import { isRecord } from './record.js';
const APP_UPLOAD_KEYS = new Set([
    'videoSendMode',
    'sendbase64',
    'usefilelimit',
    'filelimit',
    'compress',
    'compresstrigger',
    'compressvalue',
    'usegroupfile',
    'groupfilevalue',
    'imageSendMode',
    'downloadMultiThread',
    'downloadConcurrency',
    'downloadThrottle',
    'downloadMaxSpeed',
    'downloadAutoReduce',
    'downloadMinSpeed'
]);
const CONFIG_NAMES = [
    'app',
    'bilibili',
    'cookies',
    'douyin',
    'kuaishou',
    'pushlist',
    'request',
    'upload',
    'xiaohongshu'
];
export class Cfg {
    pluginRoot;
    config = {};
    watcher = {};
    constructor(pluginRoot = Version.pluginPath) {
        this.pluginRoot = pluginRoot;
    }
    initCfg() {
        const userPath = this.configDirectory('config');
        const defaultPath = this.configDirectory('default_config');
        if (!fs.existsSync(userPath))
            fs.mkdirSync(userPath, { recursive: true });
        const files = fs.readdirSync(defaultPath).filter(file => file.endsWith('.yaml'));
        for (const file of files) {
            const userFile = join(userPath, file);
            const defaultFile = join(defaultPath, file);
            const name = file.slice(0, -'.yaml'.length);
            if (!isConfigName(name))
                continue;
            if (!fs.existsSync(userFile)) {
                fs.copyFileSync(defaultFile, userFile);
            }
            else {
                const configResult = this.parseYamlRecordResult(userFile);
                if (!configResult.valid) {
                    this.watch(userFile, name, 'config');
                    continue;
                }
                const defConfigResult = this.parseYamlRecordResult(defaultFile);
                if (!defConfigResult.valid) {
                    this.watch(userFile, name, 'config');
                    continue;
                }
                const { differences, result } = this.mergeObjectsWithPriority(configResult.value, defConfigResult.value);
                if (differences) {
                    fs.copyFileSync(defaultFile, userFile);
                    for (const [key, value] of Object.entries(result))
                        this.modify(name, key, value);
                }
            }
            this.watch(userFile, name, 'config');
        }
        return this;
    }
    get app() {
        return this.getDefOrConfig('app');
    }
    get cookies() {
        return this.getDefOrConfig('cookies');
    }
    get douyin() {
        return this.getDefOrConfig('douyin');
    }
    get bilibili() {
        return this.getDefOrConfig('bilibili');
    }
    get pushlist() {
        return this.getDefOrConfig('pushlist');
    }
    get kuaishou() {
        return this.getDefOrConfig('kuaishou');
    }
    get xiaohongshu() {
        return this.getDefOrConfig('xiaohongshu');
    }
    get request() {
        return this.getDefOrConfig('request');
    }
    get upload() {
        return this.getDefOrConfig('upload');
    }
    get amagi() {
        const request = this.request;
        const app = this.app;
        return {
            timeout: request.timeout,
            'User-Agent': request['User-Agent'],
            proxy: request.proxy,
            cookies: this.cookies,
            APIServer: app.APIServer,
            APIServerMount: app.APIServerMount,
            APIServerPort: app.APIServerPort
        };
    }
    async All() {
        const rawConfig = {};
        const files = fs.readdirSync(this.configDirectory('default_config')).filter(file => file.endsWith('.yaml'));
        for (const file of files) {
            const name = file.slice(0, -'.yaml'.length);
            if (isConfigName(name))
                rawConfig[name] = this.getDefOrConfig(name);
        }
        const config = rawConfig;
        if (config.pushlist) {
            const { getDouyinDB, getBilibiliDB } = await import('../../module/db/index.js');
            const douyinDB = await getDouyinDB();
            const bilibiliDB = await getBilibiliDB();
            try {
                if (config.pushlist.douyin) {
                    for (const item of config.pushlist.douyin) {
                        const filterWords = await callLegacyLookup(douyinDB, douyinDB?.getFilterWords, item.sec_uid);
                        const filterTags = await callLegacyLookup(douyinDB, douyinDB?.getFilterTags, item.sec_uid);
                        const userInfo = await callLegacyLookup(douyinDB, douyinDB?.getDouyinUser, item.sec_uid);
                        if (userInfo)
                            item.filterMode = userInfo.filterMode || 'blacklist';
                        item.Keywords = filterWords;
                        item.Tags = filterTags;
                    }
                }
                if (config.pushlist.bilibili) {
                    for (const item of config.pushlist.bilibili) {
                        const filterWords = await bilibiliDB?.getFilterWords(item.host_mid);
                        const filterTags = await bilibiliDB?.getFilterTags(item.host_mid);
                        const userInfo = await bilibiliDB?.getOrCreateBilibiliUser(item.host_mid);
                        if (userInfo)
                            item.filterMode = userInfo.filterMode || 'blacklist';
                        item.Keywords = filterWords;
                        item.Tags = filterTags;
                    }
                }
            }
            catch (error) {
                logger.error(`从数据库获取过滤配置时出错: ${String(error)}`);
            }
        }
        const result = { ...config, amagi: this.amagi };
        if (config.app && config.upload) {
            result.app = {
                ...config.app,
                ...config.upload,
                videoSendMode: config.upload.videoSendMode || (config.upload.sendbase64 ? 'base64' : 'file')
            };
        }
        return result;
    }
    getDefOrConfig(name) {
        return { ...this.getdefSet(name), ...this.getConfig(name) };
    }
    getdefSet(name) {
        return this.getYaml('default_config', name);
    }
    getConfig(name) {
        return this.getYaml('config', name);
    }
    getYaml(type, name) {
        const file = this.configFile(type, name);
        const key = `${type}.${name}`;
        const cached = this.config[key];
        if (isRecord(cached))
            return cached;
        let value = {};
        if (fs.existsSync(file))
            value = this.parseYamlRecord(file);
        this.config[key] = value;
        this.watch(file, name, type);
        return value;
    }
    watch(file, name, type = 'default_config') {
        const key = `${type}.${name}`;
        if (this.watcher[key])
            return;
        const watcher = chokidar.watch(file);
        watcher.on('change', async () => {
            delete this.config[key];
            logger.mark(`[${Version.pluginName}][修改配置文件][${type}][${name}]`);
            if (name === 'pushlist' && type === 'config') {
                try {
                    await this.syncPushlistToDatabase();
                }
                catch (error) {
                    logger.error('[Config] 文件监听同步数据库失败:', error);
                }
                finally {
                    await this.syncConfigToDatabase();
                }
            }
        });
        this.watcher[key] = watcher;
    }
    modify(name, key, value, type = 'config') {
        new YamlReader(this.configFile(type, name)).set(key, value);
        delete this.config[`${type}.${name}`];
    }
    ModifyPro(name, value, type = 'config') {
        if (!isRecord(value))
            return false;
        if (name === 'amagi') {
            if ('timeout' in value)
                this.modify('request', 'timeout', value.timeout, type);
            if ('User-Agent' in value)
                this.modify('request', 'User-Agent', value['User-Agent'], type);
            if ('proxy' in value)
                this.modify('request', 'proxy', value.proxy, type);
            if (isRecord(value.cookies))
                this.ModifyPro('cookies', value.cookies, type);
            if ('APIServer' in value)
                this.modify('app', 'APIServer', value.APIServer, type);
            if ('APIServerMount' in value)
                this.modify('app', 'APIServerMount', value.APIServerMount, type);
            if ('APIServerPort' in value)
                this.modify('app', 'APIServerPort', value.APIServerPort, type);
            return true;
        }
        if (name === 'app') {
            const appValue = {};
            const uploadValue = {};
            for (const [key, item] of Object.entries(value)) {
                if (APP_UPLOAD_KEYS.has(key))
                    uploadValue[key] = item;
                else
                    appValue[key] = item;
            }
            if ('videoSendMode' in uploadValue)
                uploadValue.sendbase64 = uploadValue.videoSendMode === 'base64';
            const appSuccess = Object.keys(appValue).length ? this.writeModuleConfig('app', appValue, type) : true;
            const uploadSuccess = Object.keys(uploadValue).length ? this.writeModuleConfig('upload', uploadValue, type) : true;
            return appSuccess && uploadSuccess;
        }
        return this.writeModuleConfig(name, value, type);
    }
    async syncPushlistToDatabase() {
        const { getDouyinDB, getBilibiliDB } = await import('../../module/db/index.js');
        try {
            const pushlistConfig = this.getDefOrConfig('pushlist');
            if (pushlistConfig.douyin) {
                await this.syncFilterConfigToDb(pushlistConfig.douyin, await getDouyinDB(), 'sec_uid');
            }
            if (pushlistConfig.bilibili) {
                await this.syncFilterConfigToDb(pushlistConfig.bilibili, await getBilibiliDB(), 'host_mid');
            }
            logger.info('[Config] pushlist的过滤配置已同步到数据库');
        }
        catch (error) {
            logger.error('[Config] 同步pushlist配置到数据库失败:', error);
            throw error;
        }
    }
    async syncFilterConfigToDb(items, db, idField) {
        for (const item of items) {
            if (!item.switch)
                continue;
            const rawId = item[idField];
            if (!rawId || (typeof rawId !== 'string' && typeof rawId !== 'number'))
                continue;
            const id = rawId;
            if (item.filterMode !== undefined)
                await db?.updateFilterMode?.(id, item.filterMode);
            const configWords = item.Keywords || [];
            const existingWords = await db?.getFilterWords?.(id);
            for (const word of existingWords || []) {
                if (!configWords.includes(word))
                    await db?.removeFilterWord?.(id, word);
            }
            for (const word of configWords) {
                if (!existingWords?.includes(word))
                    await db?.addFilterWord?.(id, word);
            }
            const configTags = item.Tags || [];
            const existingTags = await db?.getFilterTags?.(id);
            for (const tag of existingTags || []) {
                if (!configTags.includes(tag))
                    await db?.removeFilterTag?.(id, tag);
            }
            for (const tag of configTags) {
                if (!existingTags?.includes(tag))
                    await db?.addFilterTag?.(id, tag);
            }
        }
    }
    mergeObjectsWithPriority(objA, objB) {
        let differences = false;
        const customizer = (objValue, srcValue) => {
            if (_.isArray(objValue) && _.isArray(srcValue))
                return objValue;
            if (_.isPlainObject(objValue) && _.isPlainObject(srcValue)) {
                if (!_.isEqual(objValue, srcValue)) {
                    return _.mergeWith(_.cloneDeep(objValue), srcValue, customizer);
                }
            }
            else if (!_.isEqual(objValue, srcValue)) {
                differences = true;
                return objValue !== undefined ? objValue : srcValue;
            }
            return objValue !== undefined ? objValue : srcValue;
        };
        const result = _.mergeWith(_.cloneDeep(objA), objB, customizer);
        return { differences, result };
    }
    async syncConfigToDatabase() {
        try {
            const pushCfg = this.getDefOrConfig('pushlist');
            const { getDouyinDB, getBilibiliDB } = await import('../../module/db/index.js');
            const douyinDB = await getDouyinDB();
            const bilibiliDB = await getBilibiliDB();
            if (pushCfg.bilibili)
                await bilibiliDB?.syncConfigSubscriptions(pushCfg.bilibili);
            if (pushCfg.douyin)
                await douyinDB?.syncConfigSubscriptions(pushCfg.douyin);
            logger.debug('[BilibiliDB] + [DouyinDB] 配置已同步到数据库');
        }
        catch (error) {
            logger.error('同步配置到数据库失败:', error);
        }
    }
    configDirectory(type) {
        return join(this.pluginRoot, 'config', type);
    }
    configFile(type, name) {
        return join(this.configDirectory(type), `${name}.yaml`);
    }
    parseYamlRecord(file) {
        return this.parseYamlRecordResult(file).value;
    }
    parseYamlRecordResult(file) {
        try {
            const value = YAML.parse(fs.readFileSync(file, 'utf8'));
            if (!isRecord(value))
                throw new TypeError('YAML root must be a non-array record');
            return { valid: true, value };
        }
        catch {
            logger.warn(`[Config] 解析配置文件失败: ${file}`);
            return { valid: false, value: {} };
        }
    }
    writeModuleConfig(name, value, type) {
        const path = this.configFile(type, name);
        if (!fs.existsSync(path))
            return false;
        const reader = new YamlReader(path);
        for (const [key, item] of Object.entries(value))
            reader.document.set(key, item);
        const success = reader.write();
        if (success)
            delete this.config[`${type}.${name}`];
        return success;
    }
}
let configInstance;
const getConfigInstance = () => {
    if (!configInstance) {
        const cfg = new Cfg().initCfg();
        configInstance = new Proxy(cfg, {
            get(target, prop, receiver) {
                if (Reflect.has(target, prop))
                    return Reflect.get(target, prop, receiver);
                if (typeof prop === 'string' && isConfigName(prop))
                    return target.getDefOrConfig(prop);
                return undefined;
            }
        });
    }
    return configInstance;
};
export default new Proxy({}, {
    get(_target, prop) {
        return Reflect.get(getConfigInstance(), prop);
    }
});
async function callLegacyLookup(receiver, method, id) {
    if (typeof method !== 'function')
        return undefined;
    return await Reflect.apply(method, receiver, [id]);
}
function isConfigName(value) {
    return CONFIG_NAMES.includes(value);
}
