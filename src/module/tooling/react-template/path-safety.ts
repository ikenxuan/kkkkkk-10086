import { lstatSync } from 'node:fs'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'

const relativePathEscapesRoot = (relativePath: string): boolean =>
  relativePath === '..' ||
  relativePath.startsWith(`..${sep}`) ||
  isAbsolute(relativePath)

export const resolveRequiredRoot = (root: string, label: string): string => {
  if (!root.trim()) throw new Error(`${label}不能为空`)
  return resolve(root)
}

/**
 * Refuse paths outside the selected root and any existing descendant symlink.
 * The latter also covers Windows Junctions reported by Node as symbolic links.
 */
export const assertUnlinkedOwnedPath = (root: string, target: string): void => {
  const absoluteRoot = resolve(root)
  const absoluteTarget = resolve(target)
  const relativeTarget = relative(absoluteRoot, absoluteTarget)

  if (relativeTarget === '' || relativePathEscapesRoot(relativeTarget)) {
    throw new Error(`拒绝访问模板工具根目录之外的路径：${absoluteTarget}`)
  }

  let current = absoluteRoot
  for (const part of relativeTarget.split(sep)) {
    current = join(current, part)
    const stats = lstatSync(current, { throwIfNoEntry: false })
    if (!stats) break
    if (stats.isSymbolicLink()) {
      throw new Error(`拒绝通过符号链接或 Junction 访问模板工具路径：${current}`)
    }
  }
}
