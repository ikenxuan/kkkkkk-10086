<template>
  <Transition name="fade">
    <div v-show="showBackTop" class="vitepress-backTop-main" title="返回顶部" @click="scrollToTop()">
      <svg t="1724177461951" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4181" width="200" height="200"><path d="M832.133669 191.866842 191.866331 191.866842c-28.281113 0-51.216475-22.930245-51.216475-51.216475L140.649855 115.034966c0-28.28009 22.936385-51.216475 51.216475-51.216475l640.267339 0c28.287253 0 51.215452 22.937408 51.215452 51.216475l0 25.614377C883.348098 168.936597 860.419899 191.866842 832.133669 191.866842L832.133669 191.866842zM170.859901 529.980513l276.510638-219.36922c1.877767-2.591011 3.730974-5.167696 6.5553-7.941879 13.059434-12.706393 29.137621-20.440541 45.621037-23.130813 1.594311-0.277316 3.200902-0.554632 4.801353-0.730641 2.572592-0.271176 5.098111-0.327458 7.65126-0.297782 2.554172-0.023536 5.074575 0.026606 7.632841 0.297782 1.620917 0.176009 3.201925 0.453325 4.802376 0.730641 16.508999 2.697435 32.580023 10.425444 45.633317 23.130813 2.835581 2.7486 4.676509 5.350868 6.535857 7.922437l276.512684 219.388662c30.233582 29.459962 27.65485 59.770292-2.578732 89.243557-30.203906 29.457916-70.673619 2.772136-100.907201-26.686802L576.022641 455.104175l0 453.853695c0 28.288277-22.928199 51.223638-51.215452 51.223638l-25.608238 0c-28.287253 0-51.223638-22.935362-51.223638-51.223638L447.975313 455.104175 274.382673 592.532151c-30.233582 29.457916-70.710458 56.149834-100.921527 26.677593C143.228587 589.751828 140.649855 559.440475 170.859901 529.980513L170.859901 529.980513zM170.859901 529.980513" fill="#e8b91d" p-id="4182"></path></svg>
    </div>
  </Transition>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

// 是否显示返回顶部
const showBackTop = ref(true);

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

// 节流
function throttle(fn, delay = 100) {
  let lastTime = 0;
  return function () {
    let nowTime = +new Date();
    if (nowTime - lastTime > delay) {
      fn.apply(this, arguments);
      lastTime = nowTime;
    }
  };
}
const onScroll = throttle(
  () => (showBackTop.value = Boolean(window.scrollY > 100))
);

// 监听滚动事件
onMounted(() => window.addEventListener("scroll", onScroll));

// 移除监听事件
onBeforeUnmount(() => window.removeEventListener("scroll", onScroll));
</script>

<style lang="css" scoped>
.vitepress-backTop-main {
  z-index: 999;
  position: fixed;
  bottom: 20px;
  right: 20px;
  cursor: pointer;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background-color: #c2c2c200;
  backdrop-filter: blur(5px);
  padding: 10px;
  box-shadow: 2px 2px 10px 4px rgba(0, 0, 0, 0.15);
}

.vitepress-backTop-main:hover {
  background-color: #c2c2c200;
}

svg {
  width: 100%;
  height: 100%;
}

/* 旋转动画 */
@keyframes bounce {
  0% {
    transform: translateY(0) rotateY(0);
  }

  50% {
    transform: translateY(-10px) rotateY(180deg);
  }

  100% {
    transform: translateY(0) rotateY(360deg);
  }
}

/* 进入 退出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>