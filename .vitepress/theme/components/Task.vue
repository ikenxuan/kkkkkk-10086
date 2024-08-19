<template>
  <div class="task-item">
    <div 
      class="task-status"
      :class="getStatusClass"
    >
      <!-- 根据状态显示不同的图标 -->
      <div v-if="status === '已发布'" class="check-circle"></div>
      <div v-else class="circle-container" :style="{ animationDuration: '5s' }">
        <div v-for="n in 8" :key="n" :style="{ backgroundColor: statusColor }"></div>
      </div>
    </div>
    <div class="task-description" v-html="compiledMarkdown"></div>
  </div>
</template>

<script>
import { marked } from 'marked';

export default {
  name: 'Task',
  props: {
    status: {
      type: String,
      default: '待确定',
      validator: (value) => ['待确定', '开发中', '已发布'].includes(value)
    },
    content: {
      type: String,
      required: true
    }
  },
  computed: {
    getStatusClass() {
      return `status-${this.status}`;
    },
    statusColor() {
      switch (this.status) {
        case '待确定':
          return 'grey';
        case '开发中':
          return '#FFB805';
        case '已发布':
          return 'green';
        default:
          return 'grey';
      }
    },
    compiledMarkdown() {
      return marked(this.content);
    }
  }
};
</script>

<style scoped>
.task-item {
  display: flex;
  align-items: center;
  margin: 0;
  padding: 0;
}

.task-status {
  margin-right: 8px;
}

/* 圆圈 + 勾的样式 */
.check-circle {
  position: relative;
  width: 20px;
  height: 20px;
  border: 2px solid #00D26A;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.check-circle::after {
    content: '';
    width: 6px;
    height: 11px;
    border-right: 2px solid #00D26A;
    border-bottom: 2px solid #00D26A;
    transform: rotate(45deg);
    position: absolute;
    margin: 0 0 2px 0.1px;
    border-radius: 1px;
}

/* 动态旋转的小圆点动画 */
.circle-container {
  position: relative;
  width: 15px;
  height: 15px;
  margin: 0 auto;
  border-radius: 50%;
  animation: rotate 5s linear infinite;
}

.circle-container div {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(1440deg); /* 4圈 */
  }
}

/* 定位点的位置 */
.circle-container div:nth-child(1) { top: 50%; left: 100%; transform: translate(-50%, -50%); }
.circle-container div:nth-child(2) { top: 15%; left: 85%; transform: translate(-50%, -50%); }
.circle-container div:nth-child(3) { top: 0%; left: 50%; transform: translate(-50%, -50%); }
.circle-container div:nth-child(4) { top: 15%; left: 15%; transform: translate(-50%, -50%); }
.circle-container div:nth-child(5) { top: 50%; left: 0%; transform: translate(-50%, -50%); }
.circle-container div:nth-child(6) { top: 85%; left: 15%; transform: translate(-50%, -50%); }
.circle-container div:nth-child(7) { top: 100%; left: 50%; transform: translate(-50%, -50%); }
.circle-container div:nth-child(8) { top: 85%; left: 85%; transform: translate(-50%, -50%); }

.vp-doc p, .vp-doc summary {
  margin: 16px 0;
}

.task-description {
  flex: 1;
}
</style>
