<script setup>
// The full-page demo (/demo): examples/demo.js fills the window under the top bar, in the docs' appearance and grid
// style.
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useData, withBase } from 'vitepress';
import { gridStyle, loadGridStyle } from './gridStyle';

const { isDark } = useData();
const mounted = ref(false);
const container = ref(null);
const error = ref('');
let instance = null;
let create = null;

const start = async() => {
  instance?.destroy();
  container.value.replaceChildren();
  instance = await create(container.value);
};

onMounted(async() => {
  loadGridStyle();
  mounted.value = true;
  try {
    create = (await import('../../examples/demo.js')).default;
    await nextTick();
    await start();
  } catch (e) {
    error.value = e.message;
    throw e;
  }
});

// A new grid for the new style, so the row height and the column widths are measured again.
watch(gridStyle, async() => {
  await nextTick();
  if (create && container.value) {
    await start();
  }
});

onBeforeUnmount(() => {
  if (instance && !instance.isDestroyed) {
    instance.destroy();
  }
});
</script>

<template>
  <div class="demo-app vp-raw" :class="{ 'fs-theme-dark': mounted && isDark }" :data-fs-style="mounted ? gridStyle : null">
    <div ref="container" class="demo-app__body" />
    <p v-if="error" class="demo-app__error">{{ error }}</p>
    <p class="demo-app__source">
      The code: <a :href="withBase('/examples/demo-source')">examples/demo.js</a>
    </p>
  </div>
</template>
