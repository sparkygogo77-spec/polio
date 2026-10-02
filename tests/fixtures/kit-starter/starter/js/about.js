import { screens, still } from './hooks.js';
import { fillFooter, markCurrentPage } from './site.js';

markCurrentPage();
fillFooter(still);
screens({ about: () => {} });
