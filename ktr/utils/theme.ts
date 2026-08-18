import type { RenderContext } from '@karinjs/template-react'

/** Whether this render explicitly requests dark mode. */
export const isDark = (ctx: RenderContext): boolean => ctx.theme?.mode === 'dark'
