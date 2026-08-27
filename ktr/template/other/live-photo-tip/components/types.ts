/**
 * 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。
 *
 * 这张图是纯静态的：标题与说明都写死在 LivePhotoTip.tsx 的 JSX 里（上游同一份组件也是），
 * 组件从不读 props.data。所以这里刻意不留任何字段 —— 之前有过 title / description 两个
 * 字段，传进来却没人消费，调用方以为改了文案就能改出图，实际改不动。
 *
 * 用 Record<string, never> 而不是空接口：空接口在 TS 里等价于「任意对象」，
 * 反而会把「传了没人读的字段」这个错误重新放进来。
 *
 * 要让文案可配，得先让组件消费 props.data，那是另一件事。
 */

export type LivePhotoTipData = Record<string, never>
