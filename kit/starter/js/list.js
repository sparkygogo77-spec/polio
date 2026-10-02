import { fromTemplate, hook, part, screens, still } from './hooks.js';
import { fillFooter, markCurrentPage } from './site.js';

const SAMPLE = [
  { name: 'Morning walk', meta: '25 minutes' },
  { name: 'Read a chapter', meta: '40 minutes' },
  { name: 'Call a friend', meta: '15 minutes' },
];

/** Draws the list from data: one copy of template-list-item per entry. */
function draw(items) {
  const copies = items.map((item) => {
    const copy = fromTemplate('template-list-item');
    part(copy, 'list-item-name').textContent = item.name;
    part(copy, 'list-item-meta').textContent = item.meta;
    return copy;
  });
  hook('list-items').replaceChildren(...copies);
  hook('list-empty').hidden = items.length > 0;
}

markCurrentPage();
fillFooter(still);
screens({
  list: () => draw(SAMPLE),
  'list-empty': () => draw([]),
});
