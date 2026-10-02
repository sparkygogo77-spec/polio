// The gallery page: every reusable part on one page, so a style can be judged everywhere at once.
import { fromTemplate, hook, part } from './hooks.js';

const copy = fromTemplate('template-list-item');
part(copy, 'list-item-name').textContent = 'A list row, drawn from its template';
part(copy, 'list-item-meta').textContent = 'meta text';
hook('gallery-list').replaceChildren(copy);
