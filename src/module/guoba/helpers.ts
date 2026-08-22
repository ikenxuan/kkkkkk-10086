/**
 * 锅巴面板的通用字段构造器。
 *
 * 面板 schema 是一大堆结构重复的字面量，逐条手写会让「哪些字段是开关、哪些是数字框」
 * 淹没在 component / required / componentProps 里。这里把每种控件收成一个函数，
 * 配置节文件只需要声明 field、label 和说明文案。
 *
 * 这里不放任何业务知识，只负责拼出锅巴认识的表单项形状。
 */
import type { GuobaComponentType, GuobaSchema, GuobaSchemaOption } from '@/types/guoba'

export const option = (label: string, value: string | number = label): GuobaSchemaOption => ({ label, value })

export const group = (label: string): GuobaSchema => ({ label, component: 'SOFT_GROUP_BEGIN' })

export const divider = (label: string): GuobaSchema => ({
  component: 'Divider',
  label,
  componentProps: {
    orientation: 'left',
    plain: true
  }
})

export const input = (
  field: string,
  label: string,
  bottomHelpMessage = '',
  component: GuobaComponentType = 'Input'
): GuobaSchema => ({
  field,
  label,
  bottomHelpMessage,
  component,
  required: false
})

export const password = (field: string, label: string, bottomHelpMessage?: string): GuobaSchema => ({
  ...input(field, label, bottomHelpMessage, 'InputPassword'),
  componentProps: {
    placeholder: '建议配置'
  }
})

export const sw = (field: string, label: string, bottomHelpMessage = ''): GuobaSchema => ({
  field,
  label,
  bottomHelpMessage,
  component: 'Switch',
  required: false
})

export const num = (
  field: string,
  label: string,
  min = 0,
  max = 9999,
  addonAfter = '',
  bottomHelpMessage = ''
): GuobaSchema => ({
  field,
  label,
  bottomHelpMessage,
  component: 'InputNumber',
  required: false,
  componentProps: {
    min,
    max,
    addonAfter
  }
})

export const radio = (
  field: string,
  label: string,
  options: GuobaSchemaOption[],
  bottomHelpMessage = ''
): GuobaSchema => ({
  field,
  label,
  bottomHelpMessage,
  component: 'RadioGroup',
  required: false,
  componentProps: { options }
})

export const select = (
  field: string,
  label: string,
  options: GuobaSchemaOption[],
  bottomHelpMessage = '',
  multiple = false
): GuobaSchema => ({
  field,
  label,
  bottomHelpMessage,
  component: 'Select',
  required: false,
  componentProps: {
    options,
    ...(multiple ? { mode: 'multiple', allowCreate: false } : {})
  }
})

export const tags = (field: string, label: string, bottomHelpMessage = ''): GuobaSchema => ({
  field,
  label,
  bottomHelpMessage,
  component: 'GTags',
  required: false,
  componentProps: {
    allowCreate: true,
    allowAdd: true,
    allowDel: true
  }
})
