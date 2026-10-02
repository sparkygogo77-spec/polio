// The preview page: every screen listed in builder.json, each frozen (?still=1) in its own frame.
import { fromTemplate, hook, part } from './hooks.js';

async function draw() {
  const manifest = await (await fetch('../builder.json')).json();
  const root = new URL('../', location.href);
  const copies = manifest.preview.screens.map((screen) => {
    const copy = fromTemplate('template-preview-screen');
    part(copy, 'preview-caption').textContent = screen.name;
    part(copy, 'preview-frame').src = new URL(`${screen.page}?still=1&screen=${screen.name}`, root).href;
    return copy;
  });
  hook('preview-screens').replaceChildren(...copies);
}

draw();
