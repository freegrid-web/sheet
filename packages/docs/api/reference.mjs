// The API reference model: FreeSheet's methods, events, settings and plugins read from the source code's JSDoc,
// each with its topic and its page and anchor in the docs.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { anchor, parseBlocks, readMethods, readPlugin, readSettings } from './jsdoc.mjs';
import { TOPICS, UNAVAILABLE, topicOf } from './topics.mjs';

export const SOURCE = new URL('../../sheet/src/', import.meta.url).pathname;

const read = file => readFileSync(join(SOURCE, file), 'utf8');

/** `name.ts`, or `name.js` while the module is not converted yet. */
const moduleFile = name => [`${name}.ts`, `${name}.js`].find(file => existsSync(join(SOURCE, file)));

/** The source files the reference is read from (for watching). */
export const sourceFiles = () => [moduleFile('core'), moduleFile('pluginHooks'), moduleFile('defaultSettings'),
  ...pluginFiles()].map(file => join(SOURCE, file));

/** The files that register a plugin (`registerPlugin('name', Class)`), or a plugin's main file that documents it (`@plugin`). */
function pluginFiles() {
  return readdirSync(join(SOURCE, 'plugins'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .flatMap(({ name }) => readdirSync(join(SOURCE, 'plugins', name))
      .filter(file => /\.[jt]s$/.test(file))
      .map(file => `plugins/${name}/${file}`))
    .filter(file => /registerPlugin\(\s*'\w+'/.test(read(file))
      || (/plugins\/(\w+)\/\1\.[jt]s$/.test(file) && /@plugin\s+\w+/.test(read(file))));
}

/** The source of a plugin's base class when it is in its own file next to it (e.g. Outline), or ''. */
function baseSource(file, source, className) {
  const base = new RegExp(String.raw`class\s+${className}\s+extends\s+(\w+)`).exec(source)?.[1];
  const from = base && base !== 'BasePlugin' && new RegExp(String.raw`import\s+${base}\b[^;]*from\s+'(\.[^']+)'`).exec(source)?.[1];
  const path = from && moduleFile(posix.join(posix.dirname(file), from));

  return path ? read(path) : '';
}

// A plugin's lifecycle (BasePlugin's) and its hook handlers (`onBeforeKeyDown`) are not its API.
const LIFECYCLE = new Set(['isEnabled', 'enablePlugin', 'updatePlugin', 'disablePlugin', 'destroy']);

const withTopic = page => entry => ({ ...entry, topic: topicOf(entry.kind, entry.name), page, anchor: anchor(entry.name) });

export const buildReference = () => {
  const methods = parseBlocks(read(moduleFile('core')))
    .filter(block => block.kind === 'method' && block.owner === 'Core' && !block.private)
    .map(withTopic('methods'));
  const events = parseBlocks(read(moduleFile('pluginHooks')))
    .filter(block => block.kind === 'event' && !block.private && !UNAVAILABLE.has(block.name))
    .map(withTopic('events'));
  const settings = readSettings(read(moduleFile('defaultSettings')))
    .filter(setting => !UNAVAILABLE.has(setting.name))
    .map(withTopic('settings'));
  const plugins = pluginFiles()
    .map((file) => {
      const source = read(file);
      const registered = /registerPlugin\(\s*'(\w+)',\s*(\w+)\)/.exec(source) || [];
      const plugin = readPlugin(source, registered[2]);

      if (!plugin) {
        return null;
      }
      const inherited = readMethods(baseSource(file, source, registered[2]), plugin.name)
        .filter(method => !plugin.methods.some(own => own.name === method.name));
      // Older plugins document their methods with @memberof (e.g. UndoRedo#undo).
      const members = plugin.methods.length || inherited.length ? [...plugin.methods, ...inherited] : parseBlocks(source)
        .filter(block => block.kind === 'method' && block.owner === plugin.name && !block.private);

      return {
        ...plugin,
        setting: registered[1] || plugin.name[0].toLowerCase() + plugin.name.slice(1),
        topic: topicOf('setting', registered[1] || plugin.name[0].toLowerCase() + plugin.name.slice(1)),
        anchor: anchor(plugin.name),
        methods: members.filter(method => !LIFECYCLE.has(method.name) && !/^on[A-Z]/.test(method.name)).map(method => ({ ...method, page: 'plugins', anchor: anchor(`${plugin.name}-${method.name}`) })),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!methods.length || !events.length || !settings.length || !plugins.length) {
    throw new Error(`API reference: nothing read from ${SOURCE} (methods ${methods.length}, events ${events.length}, `
      + `settings ${settings.length}, plugins ${plugins.length}).`);
  }
  const unsorted = [...methods, ...events, ...settings].filter(entry => entry.topic === 'Other');

  if (unsorted.length) {
    console.warn(`API reference: no topic for ${unsorted.map(({ kind, name }) => `${kind} ${name}`).join(', ')} `
      + '(add them to packages/docs/api/topics.mjs).');
  }

  return { topics: [...TOPICS.map(({ name, description }) => ({ name, description })), { name: 'Other', description: '' }],
    methods, events, settings, plugins };
};
