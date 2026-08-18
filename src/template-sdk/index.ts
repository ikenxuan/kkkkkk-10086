import type { ComponentType } from 'react'

/**
 * The small subset of the Karin template contract used by the poster sources.
 *
 * This is intentionally owned by the Yunzai plugin.  The poster components are
 * authored against the upstream shape, but the bot runtime must not load
 * `node-karin` (or Karin's message/render/database globals).
 */
export interface RenderContext {
  scale: number
  theme?: {
    mode?: 'light' | 'dark'
  }
  [key: string]: unknown
}

export interface TemplateProps<Data = unknown> {
  data: Data
  ctx: RenderContext
}

export interface TemplateDefinition<Data = unknown> {
  name: string
  description?: string
  component: ComponentType<TemplateProps<Data>>
  validate?: (data: unknown) => boolean
}

export type TemplateComponent<Data = unknown> = ComponentType<TemplateProps<Data>>

export type DataOf<Definition> = Definition extends TemplateDefinition<infer Data> ? Data : never

export type LoadedRegistry = Record<string, TemplateDefinition>

/** Keep the upstream authoring API while making it a zero-runtime wrapper. */
export const defineTemplate = <Data>(definition: TemplateDefinition<Data>): TemplateDefinition<Data> => definition

/** Build configuration is consumed by our Vite config; this mirrors the authoring helper. */
export const defineConfig = <Value>(value: Value): Value => value

export type TemplateRendererResult = {
  success: boolean
  htmlPath: string
  error?: string
}
