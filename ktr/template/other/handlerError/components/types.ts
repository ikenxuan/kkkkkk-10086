/** 本模板的数据类型（路由 index.tsx 与 components/ 实现共用）。 */

/**
 * API错误组件属性接口
 */
export interface ApiErrorData {
  /** 错误类型 */
  type: 'business_error'
  /** 平台名称 */
  platform: 'douyin' | 'bilibili' | 'kuaishou' | 'system' | 'unknown'
  /** 错误信息 */
  error: BusinessError
  /** 调用的方法名 */
  method: string
  /** 错误发生时间 */
  timestamp: string
  /** 收集到的日志信息 */
  logs?: LogEntry[]
  /** 触发命令 */
  triggerCommand?: string
  /** 框架版本 */
  frameworkVersion: string
  /** 插件版本 */
  pluginVersion: string
  /** 构建时间 */
  buildTime?: string
  /** Commit ID */
  commitHash?: string
  /** 适配器信息 */
  adapterInfo?: AdapterInfo
  /** 是否为验证流程 */
  isVerification?: boolean
  /** 验证链接 */
  verificationUrl?: string
  /** 分享链接（用于生成二维码） */
  share_url?: string
}

/**
 * 业务错误类型
 */
export interface BusinessError {
  /** 错误消息 */
  message: string
  /** 错误名称 */
  name: string
  /** 调用栈信息 */
  stack: string
  /** 业务名称 */
  businessName: string
  /** 结构化诊断字段：接口类错误没有 JS 调用栈，改用键值对呈现 */
  diagnostics?: ErrorDiagnostic[]
}

/**
 * 结构化诊断条目
 */
export interface ErrorDiagnostic {
  /** 字段名 */
  label: string
  /** 字段值 */
  value: string
}

/**
 * 内部错误类型
 */
export interface InternalError {
  /** 错误消息 */
  message: string
  /** 错误名称 */
  name: string
  /** 调用栈信息 */
  stack: string
}

/**
 * 平台配置映射
 */
export interface PlatformConfig {
  /** 平台显示名称 */
  displayName: string
  /** 平台颜色主题 */
  color: string
  /** 平台图标 */
  icon: string
}

/**
 * 日志等级类型
 */
export type LogLevel = 'TRAC' | 'DEBU' | 'MARK' | 'INFO' | 'ERRO' | 'WARN' | 'FATA'

/**
 * 日志条目接口
 */
export interface LogEntry {
  /** 时间戳 */
  timestamp: string
  /** 日志等级 */
  level: LogLevel
  /** 日志内容 */
  message: string
  /** 原始日志字符串 */
  raw: string
}

/**
 * 适配器信息接口
 */
export interface AdapterInfo {
  name: string
  version: string
  protocol?: string
  platform?: string
  standard?: string
  [key: string]: unknown
}

/**
 * 平台配置映射表
 */
export const PLATFORM_CONFIG: Record<ApiErrorData['platform'], PlatformConfig> = {
  douyin: {
    displayName: '抖音',
    color: '#fe2c55',
    icon: '🎵'
  },
  bilibili: {
    displayName: '哔哩哔哩',
    color: '#00a1d6',
    icon: '📺'
  },
  kuaishou: {
    displayName: '快手',
    color: '#ff6600',
    icon: '⚡'
  },
  system: {
    displayName: '系统',
    color: '#666666',
    icon: '⚙️'
  },
  unknown: {
    displayName: '未知平台',
    color: '#666666',
    icon: '❓'
  }
}

/**
 * 错误处理组件属性接口
 * 定义错误处理组件的完整属性结构
 */
export interface HandlerErrorProps {
  /** 错误类型 */
  type: 'api_error' | 'internal_error' | 'business_error'
  /** 平台标识 */
  platform: string
  /** 错误对象 */
  error: BusinessError
  /** 方法名称 */
  method: string
  /** 时间戳 */
  timestamp: string
  /** 相关日志 */
  logs?: LogEntry[]
  /** 触发命令 - 新增字段 */
  triggerCommand?: string
  /** 分享链接 - 新增字段 */
  share_url?: string
  /** 模板类型 */
  templateType: string
  /** 模板名称 */
  templateName: string
}
