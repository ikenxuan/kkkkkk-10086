/**
 * B站平台的类型声明。
 *
 * 从 `bilibili.ts` 与 `push.ts` 搬过来的接口与别名，形状保持原样。两个文件里同名不同形状的
 * 那几个，push 侧统一加 `Push` 前缀区分；`bilibili.ts` 里跟 `getid.ts` 撞名的两个宽松副本
 * 改叫 `BilibiliResource*`，因为 barrel 里 `getid.js` 的那份才是规范定义。
 */
export {};
