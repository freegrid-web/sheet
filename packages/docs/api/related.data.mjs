// The API reference's entries for the API lists of the pages (RelatedApi.vue, ApiBlock.vue): "Related API" and the API
// section of guide pages, and the index of each reference page.
import { buildReference, sourceFiles } from './reference.mjs';

/** The first sentence of a description, as plain text with `code` spans kept. */
export const summary = description => (description || '')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/^(.+?[.!?])(?:\s(?=[A-Z`])|$)[\s\S]*$/, '$1');

/** How an entry is written: `getData(row?, column?)`, `contextMenu: Boolean|Array`. */
const signature = (entry) => {
  if (entry.kind === 'setting') {
    return entry.type ? `${entry.name}: ${entry.type}` : entry.name;
  }
  const params = (entry.params || []).filter(param => !param.name.includes('.'))
    .map(param => `${param.name}${param.optional ? '?' : ''}`);

  return `${entry.name.split('.').pop()}(${params.join(', ')})`;
};

export default {
  watch: sourceFiles(),
  load() {
    const { topics, methods, events, settings, plugins } = buildReference();
    // A plugin's methods belong to the topic of its setting (RowGroups to "Row groups"); the rest to "Plugins".
    const pluginMethods = plugins.flatMap(plugin => plugin.methods.map(method => ({
      ...method,
      kind: 'plugin-method',
      name: `${plugin.name}.${method.name}`,
      topic: plugin.topic && plugin.topic !== 'Other' ? plugin.topic : 'Plugins',
      setting: plugin.setting,
    })));

    return {
      topics: topics.map(({ name }) => name),
      entries: [...methods, ...events, ...settings, ...pluginMethods]
        .map(entry => ({
          kind: entry.kind,
          name: entry.name,
          topic: entry.topic,
          link: `/api/${entry.page}#${entry.anchor}`,
          signature: signature(entry),
          summary: summary(entry.description),
          ...(entry.setting ? { setting: entry.setting } : {}),
        })),
    };
  },
};
