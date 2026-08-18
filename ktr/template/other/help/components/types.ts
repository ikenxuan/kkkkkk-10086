/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */

/**
 * 帮助页面组件属性接口
 */
export interface HelpData {
  /** 页面标题 */
  title?: string
  /** 角色：主人/普通 */
  role?: 'master' | 'member'
  /** 菜单数据：按角色筛选后的分组 */
  menu?: MenuGroup[]
  /** 简单的列表数据 (用于 Help.tsx 渲染) */
  list: {
    title: string
    description: string
  }[]
}

/**
 * 菜单项接口
 */
export interface MenuItem {
  /** 菜单项标题 */
  title: string
  /** 菜单项描述 */
  description: string
  /** 图标：可以是图标名称字符串，或带颜色的对象 */
  icon?: string | { name: string; color?: string }
}

/**
 * 菜单分组接口
 */
export interface MenuGroup {
  /** 分组标题 */
  title: string
  /** 菜单项列表 */
  items: MenuItem[]
  /** 子分组（可选） */
  subGroups?: {
    /** 子分组标题 */
    title: string
    /** 子分组菜单项 */
    items: MenuItem[]
  }[]
}
