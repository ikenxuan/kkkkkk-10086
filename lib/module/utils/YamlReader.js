import fs from 'node:fs';
import YAML from 'yaml';
export default class YamlReader {
    filePath;
    document;
    constructor(filePath) {
        this.filePath = filePath;
        try {
            this.document = this.parseDocument();
        }
        catch (error) {
            logger.error(`解析YAML文件失败: ${filePath}`, error);
            this.document = new YAML.Document({});
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
    set(key, value) {
        try {
            if (key.includes('.'))
                this.document.setIn(key.split('.'), value);
            else
                this.document.set(key, value);
            this.write();
        }
        catch (error) {
            logger.error(`设置YAML配置失败 [${key}]:`, error);
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
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
