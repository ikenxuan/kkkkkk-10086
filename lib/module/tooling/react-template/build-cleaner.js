import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertUnlinkedOwnedPath, resolveRequiredRoot } from "./path-safety.js";
/**
 * 需要清理的模板构建产物。
 *
 * 第一项是当前构建真正产出的目录，`karin.template.ts` 的 `standalone.outDir`
 * 是唯一事实来源，改那边必须同步这里——否则 `pnpm clean:template` 会变成静默空转：
 * 六个旧路径一个都不存在，rmSync 的 force 让它安静地什么都不删、还退出 0。
 */
export const TEMPLATE_BUILD_OUTPUTS = [
    'lib/react-template',
    // 以下是迁移前（分片产物时代）的遗留文件。现在的构建不再生成它们，但从旧 checkout
    // 升上来的工作区里还躺着，顺手一并清掉；force 对不存在的路径没有副作用。
    'lib/template-registry.js',
    'lib/template-registry.js.map',
    'lib/template-style.css',
    'lib/template-style.css.map',
    'lib/template-chunks',
    'lib/template-assets'
];
const assertOwnedTarget = (root, target) => {
    assertUnlinkedOwnedPath(root, target);
    if (target === resolve(root, 'lib')) {
        throw new Error(`拒绝清理整个 lib 目录：${target}`);
    }
};
export const resolveTemplateBuildTargets = (root) => {
    const absoluteRoot = resolveRequiredRoot(root, '模板构建清理根目录');
    return TEMPLATE_BUILD_OUTPUTS.map(output => {
        const target = resolve(absoluteRoot, output);
        assertOwnedTarget(absoluteRoot, target);
        return target;
    });
};
export const cleanTemplateBuild = (root) => {
    const absoluteRoot = resolveRequiredRoot(root, '模板构建清理根目录');
    const targets = resolveTemplateBuildTargets(absoluteRoot);
    for (const target of targets)
        assertOwnedTarget(absoluteRoot, target);
    for (const target of targets)
        rmSync(target, { recursive: true, force: true });
    return {
        root: absoluteRoot,
        targets
    };
};
