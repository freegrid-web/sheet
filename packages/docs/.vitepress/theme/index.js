import { h } from 'vue';
import { VPCarbon } from 'vitepress-carbon';
import ApiBlock from './ApiBlock.vue';
import DemoApp from './DemoApp.vue';
import LiveExample from './LiveExample.vue';
import RelatedApi from './RelatedApi.vue';
import StyleSwitch from './StyleSwitch.vue';
import ThemePlayground from './ThemePlayground.vue';
import './custom.css';

export default {
  extends: VPCarbon,
  Layout: () => h(VPCarbon.Layout, null, {
    'nav-bar-content-after': () => h(StyleSwitch),
    'aside-outline-after': () => h(RelatedApi),
    'doc-footer-before': () => h(ApiBlock),
  }),
  enhanceApp({ app }) {
    app.component('DemoApp', DemoApp);
    app.component('LiveExample', LiveExample);
    app.component('ThemePlayground', ThemePlayground);
  },
};
