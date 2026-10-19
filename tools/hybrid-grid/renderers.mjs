export class CanvasRenderer {
  constructor(container) {
    this.element = document.createElement('canvas');
    this.element.setAttribute('aria-hidden', 'true');
    container.append(this.element);
    this.context = this.element.getContext('2d', { alpha: false });
  }
  draw(panes, width, height) {
    const ratio = window.devicePixelRatio || 1;
    const canvas = this.element;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    }
    const ctx = this.context;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#edf2f5'; ctx.fillRect(0, 0, width, height);
    ctx.font = '13px Arial'; ctx.textBaseline = 'middle';
    for (const pane of panes) {
      ctx.save(); ctx.beginPath(); ctx.rect(pane.x, pane.y, pane.w, pane.h); ctx.clip();
      for (const cell of pane.cells) {
        ctx.fillStyle = cell.row % 2 ? '#f7fafc' : '#fff';
        ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
        ctx.strokeStyle = '#d9e2e8'; ctx.strokeRect(cell.x + .5, cell.y + .5, cell.w, cell.h);
        if (!cell.rich) {
          ctx.save(); ctx.beginPath(); ctx.rect(cell.x + 6, cell.y, cell.w - 12, cell.h); ctx.clip();
          ctx.fillStyle = '#183346'; ctx.fillText(cell.text, cell.x + 6, cell.y + cell.h / 2); ctx.restore();
        }
      }
      ctx.restore();
    }
  }
  destroy() { this.element.remove(); }
}

export class DOMRenderer {
  constructor(container) {
    this.element = document.createElement('div');
    this.element.className = 'dom-drawing';
    this.element.setAttribute('aria-hidden', 'true');
    this.panes = Array.from({ length: 4 }, () => {
      const element = document.createElement('div'); element.className = 'pane'; this.element.append(element); return element;
    });
    container.append(this.element);
  }
  draw(panes) {
    panes.forEach((pane, index) => {
      const container = this.panes[index];
      Object.assign(container.style, { left: `${pane.x}px`, top: `${pane.y}px`, width: `${pane.w}px`, height: `${pane.h}px` });
      while (container.childElementCount > pane.cells.length) container.lastElementChild.remove();
      pane.cells.forEach((cell, index) => {
        let element = container.children[index];
        if (!element) { element = document.createElement('div'); element.className = 'plain-cell'; container.append(element); }
        Object.assign(element.style, { left: `${cell.x - pane.x}px`, top: `${cell.y - pane.y}px`,
          width: `${cell.w}px`, height: `${cell.h}px`, background: cell.row % 2 ? '#f7fafc' : '#fff' });
        const text = cell.rich ? '' : cell.text;
        if (element.textContent !== text) element.textContent = text;
      });
    });
  }
  destroy() { this.element.remove(); }
}
