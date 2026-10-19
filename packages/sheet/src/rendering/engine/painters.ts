import type { Scene } from './scene';

export interface Painter { element: HTMLElement; paint(scene: Scene): void; destroy(): void }

export function columnLabel(index: number): string {
  let label = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    label = String.fromCharCode(65 + (value - 1) % 26) + label;
  }
  return label;
}

export function canvasPainter(document: Document): Painter {
  const element = document.createElement('canvas');
  const context = element.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable');
  return { element, destroy() { element.width = 0; element.height = 0; }, paint(scene) {
    const ratio = document.defaultView?.devicePixelRatio || 1;
    const width = Math.round(scene.width * ratio);
    const height = Math.round(scene.height * ratio);
    if (element.width !== width || element.height !== height) { element.width = width; element.height = height; }
    element.style.width = `${scene.width}px`; element.style.height = `${scene.height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = '#fff'; context.fillRect(0, 0, scene.width, scene.height);
    context.font = '13px sans-serif'; context.textBaseline = 'middle';
    const cell = (x: number, y: number, w: number, h: number, text: string, header = false) => {
      context.save(); context.beginPath(); context.rect(x, y, w, h); context.clip();
      context.fillStyle = header ? '#f1f3f6' : '#fff'; context.fillRect(x, y, w, h);
      context.strokeStyle = '#dce1e8'; context.strokeRect(x + 0.5, y + 0.5, w, h);
      context.fillStyle = '#18202d'; context.fillText(text, x + 7, y + h / 2); context.restore();
    };
    context.save(); context.beginPath();
    context.rect(scene.headerWidth, scene.headerHeight, Math.max(0, scene.width - scene.headerWidth),
      Math.max(0, scene.height - scene.headerHeight)); context.clip();
    for (const item of scene.cells) cell(item.x, item.y, item.width, item.height, item.text);
    context.restore();
    context.save(); context.beginPath(); context.rect(scene.headerWidth, 0,
      Math.max(0, scene.width - scene.headerWidth), scene.headerHeight); context.clip();
    for (const col of scene.columns) cell(col.x, 0, col.width, scene.headerHeight, columnLabel(col.index), true);
    context.restore();
    context.save(); context.beginPath(); context.rect(0, scene.headerHeight, scene.headerWidth,
      Math.max(0, scene.height - scene.headerHeight)); context.clip();
    for (const row of scene.rows) cell(0, row.y, scene.headerWidth, row.height, String(row.index + 1), true);
    context.restore(); cell(0, 0, scene.headerWidth, scene.headerHeight, '', true);
  } };
}

/** Equivalent plain-cell control, reusing nodes. It is not the production DOM renderer. */
export function domPainter(document: Document): Painter {
  const element = document.createElement('div');
  const body = document.createElement('div');
  const headers = document.createElement('div');
  const rowHeaders = document.createElement('div');
  const corner = document.createElement('div');
  for (const layer of [body, headers, rowHeaders, corner]) {
    layer.style.cssText = 'position:absolute;overflow:hidden;'; element.append(layer);
  }
  const pools = [body, headers, rowHeaders].map(layer => ({ layer, nodes: [] as HTMLDivElement[] }));
  const style = 'position:absolute;box-sizing:border-box;border:1px solid #dce1e8;padding:0 7px;' +
    'font:13px sans-serif;white-space:nowrap;overflow:hidden;color:#18202d;';
  return { element, destroy() {
    for (const pool of pools) pool.nodes.length = 0;
    element.replaceChildren();
  }, paint(scene) {
    body.style.cssText += `left:${scene.headerWidth}px;top:${scene.headerHeight}px;` +
      `width:${Math.max(0, scene.width - scene.headerWidth)}px;height:${Math.max(0, scene.height - scene.headerHeight)}px;`;
    headers.style.cssText += `left:${scene.headerWidth}px;top:0;width:${Math.max(0, scene.width - scene.headerWidth)}px;height:${scene.headerHeight}px;`;
    rowHeaders.style.cssText += `left:0;top:${scene.headerHeight}px;width:${scene.headerWidth}px;height:${Math.max(0, scene.height - scene.headerHeight)}px;`;
    corner.style.cssText = `${style}left:0;top:0;width:${scene.headerWidth}px;height:${scene.headerHeight}px;background:#f1f3f6;`;
    const groups = [scene.cells.map(c => ({ ...c, x: c.x - scene.headerWidth, y: c.y - scene.headerHeight })),
      scene.columns.map(c => ({ x: c.x - scene.headerWidth, y: 0, width: c.width, height: scene.headerHeight, text: columnLabel(c.index) })),
      scene.rows.map(r => ({ x: 0, y: r.y - scene.headerHeight, width: scene.headerWidth, height: r.height, text: String(r.index + 1) }))];
    groups.forEach((items, index) => {
      const { nodes, layer } = pools[index];
      while (nodes.length > items.length) nodes.pop()?.remove();
      items.forEach((item, i) => {
        const node = nodes[i] || document.createElement('div');
        if (!nodes[i]) { nodes.push(node); layer.append(node); }
        node.style.cssText = `${style}left:${item.x}px;top:${item.y}px;width:${item.width}px;` +
          `height:${item.height}px;line-height:${item.height - 2}px;background:${index ? '#f1f3f6' : '#fff'};`;
        node.textContent = item.text;
      });
    });
  } };
}
