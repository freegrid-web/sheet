// The code an example runs in the playground: a live block as it is; an example file's `createGrid(container)` is
// called with the page's #grid.
export const playgroundCode = (code) => {
  const match = /^export default (async )?function (\w+)/m.exec(code);

  if (!match) {
    return code;
  }

  return `${code.replace(/^export default /m, '').trimEnd()}\n\n${match[2]}(document.getElementById('grid'));\n`;
};
