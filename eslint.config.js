import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const tsSources = ['packages/sheet/src/**/*.ts'];
const tsTypeTests = ['packages/sheet/src/**/test/**'];

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', 'packages/sheet/lib/**', 'packages/sheet/test/lib/**',
      'packages/sheet/src/3rdparty/walkontable/test/lib/**', 'packages/sheet/test-results/**', '.superpowers/**',
      'packages/docs/.vitepress/cache/**', 'packages/docs/.vitepress/dist/**',
      // Written from the pages' live code blocks (packages/docs/.vitepress/liveSnippets.mjs).
      'packages/docs/examples/live/**'],
  },
  js.configs.recommended,
  {
    // A disable comment for a rule that reports nothing there (e.g. an airbnb rule upstream used) is an error.
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, __FG_VERSION__: 'readonly', __FG_BUILD_DATE__: 'readonly', __FG_PACKAGE_NAME__: 'readonly' },
    },
    rules: {
      // ESLint 4 (upstream) did not report unused catch bindings.
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
    },
  },
  {
    // Walkontable keeps dead initial values until it is reworked (#71).
    files: ['packages/sheet/src/3rdparty/walkontable/**'],
    rules: { 'no-useless-assignment': 'off' },
  },
  {
    files: ['packages/sheet/test/**', 'packages/sheet/src/**/test/**', 'packages/sheet/src/**/*.unit.js', 'packages/sheet/src/**/*.e2e.js'],
    languageOptions: {
      globals: { ...globals.jasmine, ...globals.jquery, ...globals.vitest, jest: 'readonly', Handsontable: 'readonly', FreeGrid: 'readonly', Walkontable: 'readonly' },
    },
    // Upstream specs call helpers that test/helpers exports onto window at runtime.
    rules: { 'no-undef': 'off' },
  },
  {
    files: ['packages/sheet/build/**', 'packages/sheet/test/runner/**', 'packages/sheet/test/build/**', 'packages/sheet/*.config.js', 'tools/**', 'eslint.config.js',
      'packages/docs/test/**', 'packages/docs/.vitepress/config.mjs', 'packages/docs/postcss.config.mjs'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['tools/baseline/run-puppeteer-json.js'],
    languageOptions: { sourceType: 'commonjs' },
  },
  // TypeScript (spec docs/specs/2026-10-12-typescript-and-clean-code-design.md). `no-explicit-any` is an error:
  // an unavoidable `any` needs `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <reason>`.
  // Type tests in src/**/test/ belong to `pnpm test:types`, like the ones in test/types/.
  ...tseslint.configs.recommended.map(config => ({ ...config, files: tsSources, ignores: tsTypeTests })),
  {
    files: tsSources,
    ignores: tsTypeTests,
    rules: {
      // Same option as for JS: unused catch bindings are allowed. A parameter only overriding methods use (the base
      // class ignores it) starts with `_`.
      '@typescript-eslint/no-unused-vars': ['error', { caughtErrors: 'none', argsIgnorePattern: '^_' }],
    },
  },
];
