/**
 * 「实况图提示」(other/live-photo-tip) 的开发面板 mock。
 *
 * 关于不用 `defineMock`、以及导出名为什么带模板前缀，见 other/runtime/mock.ts 顶部的说明。
 *
 * 这张图没有数据：标题与说明写死在 LivePhotoTip.tsx 的 JSX 里，组件不读 props.data，
 * payload 契约（components/types.ts 的 LivePhotoTipData）因此是空的。面板上要验排版
 * 只能改组件本身，改不了这里 —— 这也正是那两个旧字段被删掉的原因。
 */
import type { LivePhotoTipData } from './components/types'

/** 生产端唯一的调用形态：Render('other/live-photo-tip')，不带 payload。 */
export const livePhotoTipBasic: LivePhotoTipData = {}
