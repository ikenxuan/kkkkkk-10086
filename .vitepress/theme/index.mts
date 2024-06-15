/* .vitepress\theme\index.ts */
import DefaultTheme from 'vitepress/theme'
import { DefaultTheme as DefaultThemeFonts } from 'vitepress/theme-without-fonts'
import mediumZoom from 'medium-zoom';
import { onMounted, watch, nextTick } from 'vue';
import { useData, useRoute } from 'vitepress';
import { inBrowser } from 'vitepress'
import busuanzi from 'busuanzi.pure.js'
import giscusTalk from 'vitepress-plugin-comment-with-giscus';
import Video from './components/Video.vue';
import Layout from './components/Layout.vue';
import 'vitepress-markdown-timeline/dist/theme/index.css';
import './style/index.css'

export default {
  extends: DefaultTheme,
  enhanceApp({app, router}) {
    // 注册全局组件
    app.component('Video', Video)
    app.component('Layout', Layout)
    if (inBrowser) {
      router.onAfterRouteChanged = () => {
        busuanzi.fetch()
      }
    }
  },
  setup() {
    const route = useRoute();
    const initZoom = () => {
      // mediumZoom('[data-zoomable]', { background: 'var(--vp-c-bg)' }); // 默认
      mediumZoom('.main img', { background: 'var(--vp-c-bg)' }); // 不显式添加{data-zoomable}的情况下为所有图像启用此功能
    };
    onMounted(() => {
      initZoom();
    });
    watch(
      () => route.path,
      () => nextTick(() => initZoom())
    );
    const { frontmatter } = useData();
    // giscus配置
    giscusTalk({
      repo: 'ikenxuan/kkkkkk-10086', //仓库
      repoId: 'R_kgDOJf_8Pw', //仓库ID
      category: 'Announcements', // 讨论分类
      categoryId: 'DIC_kwDOJf_8P84CWVhT', //讨论分类ID
      mapping: 'pathname',
      inputPosition: 'bottom',
      lang: 'zh-CN',
      }, 
      {
        frontmatter, route
      },
      //默认值为true，表示已启用，此参数可以忽略；
      //如果为false，则表示未启用
      //您可以使用“comment:true”序言在页面上单独启用它
      true
    );
  },
}