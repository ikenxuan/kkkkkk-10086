import fs from 'node:fs';
import YAML from 'yaml';
import { isRecord } from './record.js';
export default class YamlReader {
    filePath;
    document;
    /**
     * 解析失败时置真，`write()` 会据此拒绝落盘。
     *
     * 没有这个标志的话：构造函数 catch 之后 document 是空文档，而 `set()` 紧接着就
     * `write()`，于是用户 yaml 里少写一个缩进 —— 整个文件会被这一次写入截成只剩刚设的
     * 那一个键。触发面是全部 `Config.modify` / `ModifyPro` 调用点（改 cookies、改推送
     * 配置、锅巴面板保存都在内），代价是用户手写的其余配置全丢。
     *
     * 宁可这次设置静默失效（日志里已经有解析失败的 error），也不能拿空文档覆盖原文件。
     */
    degraded;
    /**
     * 这份文件当前能不能写。
     *
     * 给「先读现状、改完再写回」那类调用方用：解析失败时 `document` 是空文档，
     * 读出来的现状会是「什么都没有」，照着它算增量等于拿空白覆盖用户配置。
     * `write()` 最后会拦住，但改动函数可能带副作用（发消息、写库），
     * 所以要能在跑它之前就问出来。
     */
    get writable() {
        return !this.degraded;
    }
    constructor(filePath) {
        this.filePath = filePath;
        try {
            this.document = this.parseDocument();
            this.degraded = false;
        }
        catch (error) {
            logger.error(`解析YAML文件失败: ${filePath}`, error);
            this.document = new YAML.Document({});
            this.degraded = true;
        }
    }
    parseDocument() {
        try {
            const fileContent = fs.readFileSync(this.filePath, 'utf8');
            const document = YAML.parseDocument(fileContent);
            if (document.errors.length > 0)
                throw document.errors[0];
            const value = document.toJS();
            if (!isRecord(value))
                throw new TypeError('YAML root must be a non-array record');
            return document;
        }
        catch (error) {
            logger.error(`读取YAML文件失败: ${this.filePath}`, error);
            throw error;
        }
    }
    /**
     * 写入一个键。
     *
     * 返回值是「到底写进磁盘了没有」—— 与同类的 `rm()` 一个约定。原来这里是 `void`，
     * 把 `write()` 的 false 和 catch 里的异常一起吞掉了，于是「解析失败 → 拒绝写入」
     * 这条保护路径对调用方完全不可见：锅巴面板照样回「保存成功」，磁盘上一个字没变。
     */
    set(key, value) {
        try {
            if (key.includes('.'))
                this.document.setIn(key.split('.'), value);
            else
                this.document.set(key, value);
            return this.write();
        }
        catch (error) {
            logger.error(`设置YAML配置失败 [${key}]:`, error);
            return false;
        }
    }
    rm(key) {
        try {
            if (key.includes('.'))
                this.document.deleteIn(key.split('.'));
            else
                this.document.delete(key);
            return this.write();
        }
        catch (error) {
            logger.error(`删除YAML配置失败 [${key}]:`, error);
            return false;
        }
    }
    get(key) {
        try {
            const value = key.includes('.')
                ? this.document.getIn(key.split('.'))
                : this.document.get(key);
            return value;
        }
        catch (error) {
            logger.error(`获取YAML配置失败 [${key}]:`, error);
            return undefined;
        }
    }
    write() {
        // 解析失败过就不写：此时 document 是空文档，落盘等于清空用户配置（见 degraded 注释）
        if (this.degraded) {
            logger.error(`拒绝写入YAML文件（解析失败，写入会清空原内容）: ${this.filePath}`);
            return false;
        }
        try {
            fs.writeFileSync(this.filePath, this.document.toString({
                lineWidth: -1,
                simpleKeys: true
            }), 'utf8');
            return true;
        }
        catch (error) {
            logger.error(`写入YAML文件失败: ${this.filePath}`, error);
            return false;
        }
    }
}
