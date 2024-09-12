<script setup lang="ts">
import confetti from 'canvas-confetti'
import { inBrowser } from 'vitepress';

if (inBrowser) {
/* 纸屑 */
confetti({
    particleCount: 100,
    spread: 170,
    origin: { y: 0.6 },
})
}
</script>