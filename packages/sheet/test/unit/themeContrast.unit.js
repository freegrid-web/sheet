import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, '../../src/css/variables.css'), 'utf8');

const luminance = (hex) => {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? [...value].map(char => char + char).join('') : value;

  return [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16) / 255)
    .map(channel => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
};
const contrast = (a, b) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (lighter + 0.05) / (darker + 0.05);
};

// Each theme block that sets the cell background (the base, light, dark and auto themes).
const blocks = [...css.matchAll(/\{([^{}]*--fs-color-background:\s*(#[0-9a-f]{3,6})[^{}]*)\}/gi)]
  .map(([, body, background]) => ({
    background,
    value: name => new RegExp(`--fs-color-${name}:\\s*(#[0-9a-f]{3,6})`, 'i').exec(body)?.[1],
  }));

describe('theme colors', () => {
  it('finds the theme blocks', () => {
    expect(blocks.length).toBeGreaterThanOrEqual(5);
  });

  it.each(['link', 'readonly-text'])('the %s color is readable on the cells (WCAG AA, 4.5:1) in every theme', (name) => {
    blocks.forEach(({ background, value }) => {
      expect(value(name), `--fs-color-${name} next to background ${background}`).toBeDefined();
      expect(contrast(value(name), background)).toBeGreaterThanOrEqual(4.5);
    });
  });
});
