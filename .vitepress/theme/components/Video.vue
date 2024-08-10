<template>
  <div class="video-container">
    <!-- <div class="video-bg"></div> -->
    <div class="video-mask">
      <video ref="video" class="video" autoplay muted playsinline loop @click="enableControls">
        <source :src="src" type="video/mp4">
        Your browser does not support the video tag.
      </video>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const video = ref(null);
const props = defineProps({
  src: {
    type: String,
    required: true
  }
});

const enableControls = () => {
  if (video.value) {
    video.value.controls = true;
  }
};
</script>

<style scoped>
.video-container {
  width: 100%;
  max-width: 1080px;
  position: relative;
  padding: 0.5rem;
  overflow: hidden;
  border-radius: 1rem;
}

/* .video-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  margin: 2rem;
  z-index: -1;
  background-image: linear-gradient(-45deg, #8c6bef 50%, #ef7b95 50%);
  filter: blur(44px);
} */

.video-mask {
  position: relative;
  width: 100%;
  /* 16:9 的宽高比 */
  /* padding-top: 56.25%;  */
  /* 16:10 宽高比，100%宽度的62.5%作为高度 */
  padding-top: 62.5%;
  overflow: hidden;
  border-radius: 1rem;
}

.video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover; /* 确保视频填满容器并保持宽高比 */
}

/* @media (min-width: 640px) {
  .video-bg {
    filter: blur(56px);
  }
}

@media (min-width: 960px) {
  .video-bg {
    filter: blur(68px);
  }
} */
</style>