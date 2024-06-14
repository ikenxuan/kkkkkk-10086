// .vitepress/theme/index.js

// 可以直接在主题入口导入 Vue 文件
// VitePress 已预先配置 @vitejs/plugin-vue
import Layout from './Layout.vue'

export default {
  Layout,
  enhanceApp({ app, router, siteData }) {
    // ...
  },
}
