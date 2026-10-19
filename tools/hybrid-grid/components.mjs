import { createApp, h, inject, nextTick, onMounted, onUnmounted, provide, reactive, shallowRef, Teleport } from '/vendor/vue.mjs';

// One Vue tree owns all cell components. Hosts are plain DOM nodes owned by the grid.
export class CellComponents {
  constructor(root, model) {
    this.entries = shallowRef([]);
    this.counts = { mounted: 0, unmounted: 0, ticks: 0, active: 0 };
    this.state = reactive(Object.create(null));
    const entries = this.entries;
    const counts = this.counts;
    const state = this.state;
    const Cell = {
      props: ['id'],
      setup(props) {
        const label = inject('label');
        let timer;
        onMounted(() => {
          counts.mounted++; counts.active++;
          timer = setInterval(() => { counts.ticks++; }, 1000);
        });
        onUnmounted(() => { counts.unmounted++; counts.active--; clearInterval(timer); });
        return () => h('button', {
          class: 'vote', 'data-id': props.id, 'aria-label': `Vote for record ${props.id}`,
          onPointerdown: event => event.stopPropagation(),
          onKeydown: event => event.stopPropagation(),
          onDblclick: event => event.stopPropagation(),
          onClick: () => {
            const value = (model.votes.get(props.id) ?? 0) + 1;
            model.votes.set(props.id, value); state[props.id] = value;
          },
        }, `${label} ${props.id}: ${state[props.id] ?? model.votes.get(props.id) ?? 0}`);
      },
    };
    this.app = createApp({
      setup() {
        provide('label', 'Vote');
        return () => entries.value.map(entry => h(Teleport, { to: entry.host, key: entry.key }, [h(Cell, { id: entry.id })]));
      },
    });
    this.app.mount(root);
  }
  async update(entries) { this.entries.value = entries; await nextTick(); }
  destroy() { this.app.unmount(); }
}
