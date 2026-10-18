// Reads FreeSheet's JSDoc comments for the API reference (see api.data.mjs). Only what the reference shows is kept:
// description, parameters, return value, examples, and the deprecated/since/private markers.

const BLOCK = /\/\*\*([\s\S]*?)\*\//g;
const PAGES = { Core: 'methods', Hooks: 'events', Options: 'settings' };

/** The anchor of an entry: `getData` → `getdata`, `ColumnSorting#sort` → `columnsorting-sort`. */
export const anchor = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const linkTo = (target, text) => {
  const [owner, member] = target.split('#');

  if (!member) {
    return text || owner;
  }
  if (PAGES[owner]) {
    const label = text || (owner === 'Core' ? `${member}()` : member);

    return `[${label}](./${PAGES[owner]}#${anchor(member)})`;
  }

  return `[${text || `${owner}.${member}()`}](./plugins#${anchor(`${owner}-${member}`)})`;
};

// Upstream links to its documentation were replaced with links to the repository; they lead nowhere useful.
const PLACEHOLDER = '\\]\\(https://github\\.com/freegrid-web/sheet\\)';
const SEE_DOCS = new RegExp(`(^|[.!?][ \\t]+|\\n)[ \\t]*(See|You can read more|See more|Read more)[^.\\n]*${PLACEHOLDER}[^.\\n]*\\.[ \\t]*`, 'g');
const PLACEHOLDER_LINK = new RegExp(`\\[([^\\]]+)${PLACEHOLDER}`, 'g');

// Upstream wording and links: FreeSheet's own name; links to other sites keep only their text.
const clean = text => text
  .replace(/\[(Core|Hooks|Options)#(\w+)\]\(https?:[^)]*\)/g, (match, owner, member) => linkTo(`${owner}#${member}`))
  .replace(SEE_DOCS, '$1')
  .replace(PLACEHOLDER_LINK, '$1')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\[([^\]]+)\]\{@link\s+([^}\s]+)\s*\}/g, (match, label, target) => (/^https?:/.test(target) ? label : linkTo(target, label)))
  .replace(/\{@link\s+([^}\s]+)(?:\s+([^}]*))?\}/g, (match, target, label) => (/^https?:/.test(target) ? (label || '') : linkTo(target, label)))
  .replace(/Handsontable/g, 'FreeSheet');

// Markdown text: paragraphs and lists stay; 4+ spaces of indentation (which markdown would show as code) go.
const prose = lines => clean(lines
  .map(line => line.replace(/\s+$/, ''))
  .map(line => (/^ {4,}/.test(line) ? line.trimStart() : line))
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim());

// `{Type} name description`, or `name description` in TypeScript (the type comes from the signature).
const parseParam = (text) => {
  const match = /^(?:\{([^}]*)\}\s*)?(\[[^\]]*\]|\S+)\s*([\s\S]*)$/.exec(text.trim());

  if (!match) {
    return null;
  }
  const [, type = '', rawName, description] = match;
  const optional = rawName.startsWith('[');
  const [name, value] = optional ? rawName.slice(1, -1).split('=') : [rawName];

  return { name: name.trim(), type, optional, default: value?.trim(), description: clean(description.replace(/\s+/g, ' ').trim()) };
};

/**
 * Parses one comment's text (without the `/**` and `*\/`).
 */
export const parseBlock = (text) => {
  const lines = text.split('\n').map(line => line.replace(/^\s*\*? ?/, ''));
  const description = [];
  const tags = [];

  lines.forEach((line) => {
    const tag = /^@(\w+)\s?(.*)$/.exec(line);

    if (tag) {
      tags.push({ tag: tag[1], lines: tag[2] ? [tag[2]] : [] });
    } else if (tags.length) {
      tags[tags.length - 1].lines.push(line);
    } else {
      description.push(line);
    }
  });
  const block = { description: prose(description), params: [], examples: [], private: false };

  tags.forEach(({ tag, lines: tagLines }) => {
    const text_ = tagLines.join('\n');

    switch (tag) {
      case 'description':
        block.description = prose(tagLines);
        break;
      case 'memberof':
        block.owner = text_.trim().replace(/#$/, '');
        break;
      case 'function':
      case 'method':
        block.kind = 'method';
        block.name = text_.trim();
        break;
      case 'event': {
        const [owner, name] = text_.trim().split('#');

        block.kind = 'event';
        block.owner = owner;
        block.name = name;
        break;
      }
      case 'param': {
        const param = parseParam(tagLines.join(' '));

        if (param) {
          block.params.push(param);
        }
        break;
      }
      case 'returns':
      case 'return': {
        const match = /^\{([^}]*)\}\s*([\s\S]*)$/.exec(tagLines.join(' ').trim());

        block.returns = match ? { type: match[1], description: prose([match[2]]) } : { type: '', description: prose(tagLines) };
        break;
      }
      case 'example':
        block.examples.push(clean(text_.replace(/^\n+|\s+$/g, '')));
        break;
      case 'type':
        block.type = text_.trim().replace(/^\{|\}$/g, '');
        break;
      case 'default':
        block.default = text_.trim();
        break;
      case 'private':
        block.private = true;
        break;
      case 'deprecated':
        block.deprecated = prose(tagLines) || true;
        break;
      case 'since':
        block.since = text_.trim();
        break;
      default:
    }
  });

  return block;
};

/**
 * Every JSDoc comment of `source`.
 */
export const parseBlocks = source => [...source.matchAll(BLOCK)].map(([, text]) => parseBlock(text));

/**
 * The settings of defaultSettings: each comment followed by `name: value,` or by a method `name(…) {` (a function
 * setting, default `function`). The default is `@default` or the value.
 */
export const readSettings = source => [...source.matchAll(/\/\*\*((?:(?!\*\/)[\s\S])*?)\*\/\s*\n\s*(\w+)\s*(?::\s*([^\n]*)|\()/g)]
  .map(([, text, name, value]) => {
    const block = parseBlock(text);
    const shown = value === undefined ? 'function' : value.trim().replace(/,$/, '');

    return {
      ...block,
      kind: 'setting',
      name,
      default: block.default ?? (shown === 'void 0' ? 'undefined' : shown),
    };
  })
  .filter(setting => !setting.private);

const OPEN = '([{<';
const CLOSE = ')]}>';

/**
 * Splits `text` at `separator` characters that are not inside brackets (`=>` is not a bracket).
 */
const splitTopLevel = (text, separator) => {
  const parts = [''];
  let depth = 0;

  [...text].forEach((char, index) => {
    if (OPEN.includes(char)) {
      depth += 1;
    } else if (CLOSE.includes(char) && !(char === '>' && text[index - 1] === '=')) {
      depth -= 1;
    }
    if (char === separator && depth === 0 && !(char === '=' && text[index + 1] === '>')) {
      parts.push('');
    } else {
      parts[parts.length - 1] += char;
    }
  });

  return parts.map(part => part.trim()).filter(Boolean);
};

/** The type TypeScript infers from a literal default value (`true`, `50`, `'px'`), or `''`. */
const literalType = (value) => {
  if (/^(true|false)$/.test(value)) {
    return 'boolean';
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return 'number';
  }

  return /^(['"`]).*\1$/.test(value) ? 'string' : '';
};

/**
 * A TypeScript method's parameter types and return type, from the text after its name's `(` (empty for JavaScript).
 */
const readSignature = (text) => {
  let depth = 1;
  let end = 0;

  while (end < text.length && depth > 0) {
    if (text[end] === '(') {
      depth += 1;
    } else if (text[end] === ')') {
      depth -= 1;
    }
    end += 1;
  }
  const params = splitTopLevel(text.slice(0, end - 1), ',').map((param) => {
    const [declaration, ...value] = splitTopLevel(param, '=');
    const [name, ...type] = splitTopLevel(declaration, ':');

    const defaultValue = value.join('=') || undefined;

    return {
      name: name.replace(/^\.\.\.|\?$/g, ''),
      type: type.join(': ') || literalType(defaultValue),
      default: defaultValue,
      optional: /\?$/.test(name) || defaultValue !== undefined,
    };
  });
  const returns = /^\s*:\s*([\s\S]*?)\s*\{\s*$/m.exec(text.slice(end).split('\n').slice(0, 3).join('\n'));

  return { params, returns: returns?.[1] ?? '' };
};

/** Fills the types (and the parameters) a TypeScript method's JSDoc leaves out from its signature. */
const withSignatureTypes = (method, signature) => ({
  ...method,
  params: !method.params.length ? signature.params.filter(({ name }) => name)
    .map(({ name, type, optional }) => ({ name, type, optional, description: '' })) : method.params.map((param) => {
    const typed = signature.params.find(({ name }) => name === param.name);

    return param.type || !typed ? param : { ...param, type: typed.type };
  }),
  returns: (() => {
    const type = signature.returns === 'void' ? '' : signature.returns;

    if (!method.returns) {
      return type ? { type, description: '' } : undefined;
    }

    return !method.returns.type && type ? { ...method.returns, type } : method.returns;
  })(),
});

/**
 * A plugin's file: the `@plugin` comment (name, description, examples) and the class's public methods (the comments
 * followed by `  name(…) {`). `null` when the file has no `@plugin` comment.
 */
export const readPlugin = (source, className) => {
  const tagged = [...source.matchAll(BLOCK)].map(([, text]) => text).find(text => /@plugin\s+\w+/.test(text));
  // Without `@plugin`, the comment right above the plugin's class (`class Name extends BasePlugin` or a base of it).
  const untagged = tagged ? null : new RegExp(String.raw`\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*\n(?:export\s+)?class\s+(${
    className || '\\w+'})\s+extends\s+${className ? '\\w+' : 'BasePlugin'}\b`).exec(source);
  const headerText = tagged ?? untagged?.[1];

  if (!headerText) {
    return null;
  }
  const header = parseBlock(headerText);
  const name = tagged ? /@plugin\s+(\w+)/.exec(tagged)[1] : untagged[2];

  return { ...header, kind: 'plugin', name, methods: readMethods(source, name) };
};

/** The documented public methods of a class's source, as methods of `owner`. */
export const readMethods = (source, owner) => {
  // The comment's text has no `*/`; line comments (e.g. eslint's) may come between it and the method.
  return [...source.matchAll(/\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*\n(?: {2}\/\/[^\n]*\n)* {2}(?:static\s+)?(\w+)\s*\(/g)]
    .map(({ 0: match, 1: text, 2: method, index }) => withSignatureTypes(
      { ...parseBlock(text), kind: 'method', owner, name: method },
      readSignature(source.slice(index + match.length)),
    ))
    .filter(method => !method.private && method.name !== 'constructor');
};
