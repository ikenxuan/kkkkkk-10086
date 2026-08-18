import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertUnlinkedOwnedPath, resolveRequiredRoot } from "./path-safety.js";
export const TEMPLATE_BUILD_OUTPUTS = [
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
