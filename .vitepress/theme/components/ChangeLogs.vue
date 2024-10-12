<template>
  <div>
    <transition name="fade-slide" mode="out-in">
      <div v-if="loading" key="loading" class="loading">处理中......</div>
      <div v-else-if="error" key="error" class="error">获取更新日志失败，错误: {{ error }}</div>
      <div v-else key="content" v-html="compiledMarkdown" class="content"></div>
    </transition>
  </div>
</template>

<script>
import axios from 'axios';
import { marked } from 'marked';

export default {
  props: {
    src: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      markdownContent: '',
      compiledMarkdown: '',
      loading: true,
      error: null
    };
  },
  mounted() {
    this.fetchMarkdown();
  },
  methods: {
    fetchMarkdown() {
      axios.get(this.src, {
        timeout: 10000
      })
        .then(response => {
          this.markdownContent = response.data;
          this.compileMarkdown();
        })
        .catch(error => {
          this.error = error;
        })
        .finally(() => {
          this.loading = false;
        });
    },
    compileMarkdown() {
      this.compiledMarkdown = marked(this.markdownContent);
    }
  }
};
</script>

<style>
.fade-slide-enter-active, .fade-slide-leave-active {
  transition: opacity 0.5s, transform 0.5s;
}
.fade-slide-enter, .fade-slide-leave-to {
  opacity: 0;
  transform: translateX(300px); /* 滑动效果 */
}

.loading, .error {
  text-align: left;
  font-size: 30px;
}
</style>
