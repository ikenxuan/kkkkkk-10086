import React from 'react'

/**
 * KkkLogo 组件的属性
 */
interface KkkLogoProps {
  /** SVG 元素本体的类名（调用方用它决定尺寸，例如 `w-auto h-18`） */
  className?: string
  /**
   * 墨迹颜色。写到 `style={{ color }}`，配合三段 path 的 `fill="currentColor"` 生效。
   * 缺省时继承父级的 `currentColor`（页脚里就是 `text-foreground`）。
   */
  color?: string
}

/**
 * kkk 插件的矢量品牌图（三段 path 的 k 字形）。
 *
 * 全仓唯一的一份路径数据：DefaultLayout 的共享页脚和 live-photo-tip 的自绘页脚
 * 都 import 这里，别再往模板里内联第二份（tests/contracts/react-template-branding.test.ts
 * 会拦住）。
 *
 * viewBox 从上游的 `0 0 230 221` 收到墨迹本身的包围盒。
 * 实测（浏览器 getBBox）路径墨迹是 x=28.5 y=21.4 w=178.3 h=178.3，
 * 也就是四周各留了约 9.7% 的空白，上下对称、并没有偏移。
 * 但框架那个 logo 是 PNG 且墨迹铺满整张图（398×398 全不透明），
 * 同样给 h-18 时插件 logo 的实际图形只有它的 80.6%，看着小一圈、
 * 在视觉上就读成了「偏上、没对齐」。
 * 裁掉留白之后两个 logo 的墨迹等高，观感才真正齐平。
 *
 * 连带的后果是刻意留下的：同一个 h-* 值下，这份裁过留白的 viewBox 画出来的墨迹
 * 比上游那个 viewBox 大约 24%（1 / 0.806）。所以照搬上游写法的调用点
 * （live-photo-tip 页脚的 `h-20`）不要为了对齐上游观感去调小尺寸。
 */
export const KkkLogo: React.FC<KkkLogoProps> = ({ className, color }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="28.5 21.4 178.3 178.3" className={className} style={{ color }}>
    <path
      d="M132.75,87.37l-53.72-53.37c-4.66-4.63-1.38-12.58,5.18-12.58h115.13c6.57,0,9.84,7.95,5.18,12.58l-53.72,53.37c-4.99,4.96-13.06,4.96-18.05,0Z"
      fill="currentColor"
    />
    <path
      d="M28.49,186.89l.03-51.42c-.02-6.57,7.92-9.87,12.56-5.23l57.02,57.02c4.64,4.64,1.34,12.41-5.23,12.39h-51.42c-7.04-.02-12.94-5.72-12.96-12.76Z"
      fill="currentColor"
    />
    <path
      d="M41.54,23.68l163.04,163.05c4.78,4.78,1.39,12.95-5.36,12.94h-47.88c-9.69,0-18.99-3.86-25.84-10.71L39.3,102.75c-6.85-6.85-10.7-16.15-10.7-25.84V29.04c0-6.76,8.16-10.14,12.94-5.36Z"
      fill="currentColor"
    />
  </svg>
)
