import type { RenderContext } from '@karinjs/template-react'

/**
 * 判断当前渲染是否为深色主题。
 * 唯一事实来源是 `ctx.theme.mode`：生产渲染由 core 显式传入（'light' | 'dark'），
 * 开发面板由「模板主题」弹窗下发；未设置时按浅色处理（框架不发明默认主题）。
 * @param ctx ktr 注入的运行时上下文。
 * @returns 深色主题返回 true。
 */
export const isDark = (ctx: RenderContext): boolean => ctx.theme?.mode === 'dark'
