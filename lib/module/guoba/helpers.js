export const option = (label, value = label) => ({ label, value });
export const group = (label) => ({ label, component: 'SOFT_GROUP_BEGIN' });
export const divider = (label) => ({
    component: 'Divider',
    label,
    componentProps: {
        orientation: 'left',
        plain: true
    }
});
export const input = (field, label, bottomHelpMessage = '', component = 'Input') => ({
    field,
    label,
    bottomHelpMessage,
    component,
    required: false
});
export const password = (field, label, bottomHelpMessage) => ({
    ...input(field, label, bottomHelpMessage, 'InputPassword'),
    componentProps: {
        placeholder: '建议配置'
    }
});
export const sw = (field, label, bottomHelpMessage = '') => ({
    field,
    label,
    bottomHelpMessage,
    component: 'Switch',
    required: false
});
export const num = (field, label, min = 0, max = 9999, addonAfter = '', bottomHelpMessage = '') => ({
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
});
export const radio = (field, label, options, bottomHelpMessage = '') => ({
    field,
    label,
    bottomHelpMessage,
    component: 'RadioGroup',
    required: false,
    componentProps: { options }
});
export const select = (field, label, options, bottomHelpMessage = '', multiple = false) => ({
    field,
    label,
    bottomHelpMessage,
    component: 'Select',
    required: false,
    componentProps: {
        options,
        ...(multiple ? { mode: 'multiple', allowCreate: false } : {})
    }
});
export const tags = (field, label, bottomHelpMessage = '') => ({
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
});
