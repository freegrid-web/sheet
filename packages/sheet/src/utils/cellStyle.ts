/** A cell's own style (its `style` meta): what Excel's fonts, fills and borders become. */
export type CellStyle = {
  /** The font (`Arial`, `'Times New Roman', serif`). */
  fontFamily?: string;
  /** The font size, in points as a spreadsheet gives it (`'14pt'`), or any CSS size. */
  fontSize?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  color?: string;
  background?: string;
  /** A line on every side (`1px solid #000000`); a side's own setting wins. */
  border?: string;
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
};

export const CELL_STYLE_PROPERTIES: (keyof CellStyle)[] = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
  'textDecoration', 'color',
  'background', 'border', 'borderTop', 'borderRight', 'borderBottom', 'borderLeft'];

/** The properties a cell's own element style takes as they are (the borders are drawn as shadows). */
const DIRECT_PROPERTIES: (keyof CellStyle)[] = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'textDecoration',
  'color', 'background'];

const SIDES = [['borderTop', '0 {w}'], ['borderRight', '-{w} 0'], ['borderBottom', '0 -{w}'],
  ['borderLeft', '{w} 0']] as const;

/** A side's line (`2px solid #c00000`, `thin`) as its width and color, or `null` for no line. */
export const lineOf = (value: string | undefined): { width: number; color: string } | null => {
  if (!value || /^(none|0(px)?)(\s|$)/i.test(value.trim())) {
    return null;
  }
  const width = /(\d+(\.\d+)?)px/.exec(value)?.[1];
  const named = /\b(thin|medium|thick)\b/.exec(value)?.[1];
  // What is left without the width and the line style is the color.
  const color = value.replace(/\d+(\.\d+)?px|\b(solid|dashed|dotted|double|thin|medium|thick)\b/gi, '').trim();

  return {
    width: width ? Number(width) : { thin: 1, medium: 2, thick: 3 }[named || 'thin'] || 1,
    color: color || '#000000',
  };
};

/**
 * The borders of a style as inset shadows: they draw inside the cell, over its own grid lines, and do not change its
 * size (a CSS border would move the cell's content and the rows).
 */
export const bordersToShadow = (style: CellStyle): string => SIDES.map(([side, offset]) => {
  const line = lineOf(style[side] ?? style.border);

  return line ? `inset ${offset.replace('{w}', `${line.width}px`)} 0 0 ${line.color}` : '';
}).filter(Boolean).join(', ');

/** The relative luminance (0 to 1) of a color written as `#rgb`, `#rrggbb` or `rgb()`, or `null` for other colors. */
const luminanceOf = (color: string): number | null => {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())?.[1];
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(color.trim());
  const channels = hex ? (hex.length === 3 ? [...hex].map(digit => digit + digit) : [0, 2, 4].map(at => hex.slice(at, at + 2)))
    .map(part => parseInt(part, 16)) : rgb ? rgb.slice(1, 4).map(Number) : null;

  if (!channels) {
    return null;
  }

  return channels.map(channel => channel / 255)
    .map(channel => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
};

/**
 * The text color for a fill without a text color of its own, so the text stays readable in every theme: dark on a
 * light fill, white on a dark one (`--fs-text-on-light-fill`, `--fs-text-on-dark-fill`). `null` when the fill's
 * color is not one `luminanceOf` reads.
 */
export const textOnFill = (background: string): string | null => {
  const luminance = luminanceOf(background);

  if (luminance === null) {
    return null;
  }

  // 0.21: where dark text and white text have the same contrast.
  return luminance > 0.21 ? 'var(--fs-text-on-light-fill, #1f1f1f)' : 'var(--fs-text-on-dark-fill, #ffffff)';
};

/** Whether a cell's text color is one `textOnFill` chose (not a color the cell or a rule asked for). */
export const isTextOnFill = (color: string): boolean => color.startsWith('var(--fs-text-on-');

/**
 * Draws a cell's `style` meta on its cell, after removing the style the cell had for another cell (cells are reused
 * while scrolling). Conditional formatting draws over it.
 */
export const applyCellStyle = (TD: HTMLTableCellElement, style: CellStyle | undefined): void => {
  const previous = TD.dataset.fsStyle;

  if (previous) {
    previous.split(',').forEach((property) => {
      (TD.style as unknown as Record<string, string>)[property] = '';
    });
    delete TD.dataset.fsStyle;
  }
  if (!style || typeof style !== 'object') {
    return;
  }
  const applied: string[] = DIRECT_PROPERTIES.filter(property => typeof style[property] === 'string' &&
    style[property]);

  applied.forEach((property) => {
    (TD.style as unknown as Record<string, string>)[property] = style[property as keyof CellStyle]!;
  });
  const text = style.background && !style.color ? textOnFill(style.background) : null;

  if (text) {
    TD.style.color = text;
    applied.push('color');
  }
  const shadow = bordersToShadow(style);

  if (shadow) {
    TD.style.boxShadow = shadow;
    applied.push('boxShadow');
  }
  if (applied.length) {
    TD.dataset.fsStyle = applied.join(',');
  }
};
