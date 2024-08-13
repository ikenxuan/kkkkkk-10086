<template>
  <div v-if="loading">正在请求更新日志...</div>
  <div v-else-if="error">错误: {{ error }}</div>
  <div v-else v-html="compiledMarkdown"></div>
</template>

<script>
import axios from 'axios';
import {marked} from 'marked';

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
      axios.get(this.src)
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