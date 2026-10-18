<script setup>
// Renders packages/docs/examples/<name>.js in the browser only: FreeSheet needs `window` when imported.
// Its toolbar copies the example's code or opens it in LiveCodes (https://livecodes.io), a playground that runs it.
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useData } from 'vitepress';
import { gridStyle, loadGridStyle } from './gridStyle';
import { playgroundCode } from './playground';

const props = defineProps({
  name: { type: String, required: true },
  height: { type: String, default: '' },
});

const { isDark } = useData();
// Set after mount: the built HTML is rendered without knowing the reader's appearance, and hydration keeps classes.
const mounted = ref(false);
const examples = import.meta.glob('../../examples/**/*.js');
// The code of the examples' own files; a live block's module has its code as `source` (.vitepress/liveSnippets.mjs).
const sources = import.meta.glob('../../examples/*.js', { query: '?raw', import: 'default' });
const container = ref(null);
const error = ref('');
const copied = ref(false);
// What the example logs (console.log), shown under the grid: the last lines.
const output = ref([]);
const show = value => (typeof value === 'string' ? value : (() => {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
})());
const log = (values) => {
  output.value = [...output.value, values.map(show).join(' ')].slice(-12);
};
let instance = null;
let create = null;

onMounted(async() => {
  loadGridStyle();
  mounted.value = true;
  const load = examples[`../../examples/${props.name}.js`];

  if (!load) {
    error.value = `Unknown example "${props.name}".`;
    return;
  }
  try {
    const module = await load();

    create = module.default;
    await nextTick();
    instance = await create(container.value, log);
  } catch (e) {
    error.value = e.message;
    throw e;
  }
});

// A new grid for the new style, so the row height (--fs-row-height) and the column widths are measured again.
watch(gridStyle, async() => {
  await nextTick();
  if (create && container.value) {
    instance?.destroy();
    output.value = [];
    instance = await create(container.value, log);
  }
});

const source = async() => {
  const file = `../../examples/${props.name}.js`;

  return sources[file] ? sources[file]() : (await examples[file]()).source;
};

const copy = async() => {
  await navigator.clipboard.writeText(await source());
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 1500);
};

const openPlayground = async() => {
  // Opened first, while the click still allows a new window; the address follows.
  const playground = window.open('', '_blank');
  const [{ getPlaygroundUrl }, code] = await Promise.all([import('livecodes'), source()]);
  const url = getPlaygroundUrl({
    config: {
      activeEditor: 'script',
      title: `FreeSheet: ${props.name.replace(/^live\//, '')}`,
      markup: { language: 'html', content: '<div id="grid"></div>\n' },
      script: { language: 'javascript', content: playgroundCode(code) },
    },
  });

  if (playground) {
    playground.opener = null;
    playground.location.href = url;
  } else {
    window.location.href = url;
  }
};

onBeforeUnmount(() => {
  if (instance && !instance.isDestroyed) {
    instance.destroy();
  }
});
</script>

<template>
  <div class="live-example vp-raw" :class="{ 'fs-theme-dark': mounted && isDark }"
    :data-fs-style="mounted ? gridStyle : null">
    <div ref="container" class="live-example__grid" :style="height ? { height, overflow: 'hidden' } : null" />
    <p v-if="error" class="live-example__error">{{ error }}</p>
    <pre v-if="output.length" class="live-example__output" aria-label="Console output" aria-live="polite">{{
      output.join('\n') }}</pre>
    <div class="live-example__actions">
      <button type="button" @click="copy">{{ copied ? 'Copied' : 'Copy code' }}</button>
      <button type="button" @click="openPlayground">Open in playground ↗</button>
    </div>
  </div>
</template>
