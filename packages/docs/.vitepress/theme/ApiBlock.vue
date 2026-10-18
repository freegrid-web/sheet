<script setup>
// The API of a guide page, at its end: each setting, method and event of the page's topics (frontmatter
// `api: [Row groups]`) with its signature and the first sentence of its description, linked to the reference.
import { computed } from 'vue';
import { useData, withBase } from 'vitepress';
import { data } from '../../api/related.data.mjs';

const KINDS = [['setting', 'Settings'], ['method', 'Methods'], ['event', 'Events']];
const { frontmatter } = useData();

const topics = computed(() => (frontmatter.value.api || []).filter(name => data.topics.includes(name)));
const groups = computed(() => {
  const entries = data.entries.filter(entry => topics.value.includes(entry.topic));
  const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  const plugins = [...new Set(entries.filter(entry => entry.kind === 'plugin-method').map(entry => entry.setting))].sort();

  return [
    ...KINDS.map(([kind, name]) => ({ name, items: entries.filter(entry => entry.kind === kind).sort(byName) })),
    // A plugin's methods in their order in the source, under `getPlugin('name')`.
    ...plugins.map(setting => ({
      name: `getPlugin('${setting}')`,
      code: true,
      items: entries.filter(entry => entry.kind === 'plugin-method' && entry.setting === setting),
    })),
  ].filter(group => group.items.length);
});

const escape = text => text.replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
// The summaries are plain text with `code` spans.
const summaryHtml = text => escape(text).replace(/`([^`]+)`/g, '<code>$1</code>');
</script>

<template>
  <section v-if="groups.length" class="api-block" aria-labelledby="api-block-title">
    <h2 id="api-block-title" tabindex="-1">API reference</h2>
    <div v-for="group in groups" :key="group.name" class="api-block__group">
      <h3 class="api-block__label">
        <code v-if="group.code">{{ group.name }}</code><template v-else>{{ group.name }}</template>
      </h3>
      <dl>
        <template v-for="item in group.items" :key="item.link">
          <dt><a :href="withBase(item.link)"><code>{{ item.signature }}</code></a></dt>
          <!-- eslint-disable-next-line vue/no-v-html -- escaped above; only `code` spans become markup -->
          <dd v-if="item.summary" v-html="summaryHtml(item.summary)" />
        </template>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.api-block {
  margin-top: 48px;
  padding-top: 24px;
  border-top: 1px solid var(--vp-c-divider);
}

.api-block h2 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
}

.api-block__label {
  margin: 24px 0 8px;
  font-size: 16px;
  font-weight: 600;
}

.api-block dl {
  margin: 0;
}

.api-block dt {
  margin-top: 10px;
  font-size: 14px;
}

.api-block dd {
  margin: 2px 0 0 16px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}
</style>
