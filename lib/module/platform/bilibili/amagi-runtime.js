/**
 * `push.ts` 用到的 amagi 枚举，以及取不到包时的兜底副本。
 *
 * 单独一个叶子模块：兜底字面量必须能被契约测试直接 import 出来跟真包逐键对，
 * 而 `push.ts` 自身拖着 Base / 数据库 / 渲染一整条依赖链，测试要先摆一堆 mock
 * 才 import 得动。这里只依赖 `node:module` 和一个 type，测试直接引就行。
 *
 * `createRequire` 的基准目录仍是本目录（与 `push.ts` 同级，lib 产物里也同级），
 * 所以搬过来不影响 `@ikenxuan/amagi` 的解析结果。
 */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
/**
 * amagi 缺失时的枚举副本。
 *
 * 值逐字抄自 `@ikenxuan/amagi@6.5.0`，由 `tests/contracts/amagi-enums.test.ts`
 * 与真包逐键校验——手写副本没有任何编译期约束，上游改名后类型检查照样全绿，
 * 只有契约测试能拦住。新增成员时必须同步那个测试里的读取清单。
 */
export const fallbackAmagiRuntime = {
    DynamicType: {
        AV: 'DYNAMIC_TYPE_AV',
        DRAW: 'DYNAMIC_TYPE_DRAW',
        WORD: 'DYNAMIC_TYPE_WORD',
        LIVE_RCMD: 'DYNAMIC_TYPE_LIVE_RCMD',
        FORWARD: 'DYNAMIC_TYPE_FORWARD',
        ARTICLE: 'DYNAMIC_TYPE_ARTICLE'
    },
    MajorType: {
        DRAW: 'MAJOR_TYPE_DRAW',
        OPUS: 'MAJOR_TYPE_OPUS',
        LIVE_RCMD: 'MAJOR_TYPE_LIVE_RCMD'
    }
};
const require = createRequire(import.meta.url);
/**
 * 载入真包，失败退到 {@link fallbackAmagiRuntime}。
 *
 * 先直接 require 包名；Vite 下这一步会跟到 amagi 的开发入口而抛错，
 * 于是从稳定导出的 `axios` 子路径反推 CJS 产物——与 `bilibili.ts` 同一套路。
 * 两级都不成才用兜底副本。
 */
export const loadAmagiRuntime = () => {
    try {
        return require('@ikenxuan/amagi');
    }
    catch {
        try {
            const axiosEntry = require.resolve('@ikenxuan/amagi/axios');
            return require(resolve(axiosEntry, '../../default/index.cjs'));
        }
        catch {
            return fallbackAmagiRuntime;
        }
    }
};
