// Shared by every page: marks the current page in the navigation and fills the footer year.
import { hook } from './hooks.js';

export function markCurrentPage() {
  const page = document.body.dataset.hook.replace(/^page-/, '');
  const current = document.querySelector(`[data-hook="nav-${page}"]`); // hooks: nav-{home,about,contact,list}
  if (current) current.setAttribute('aria-current', 'page');
}

export function fillFooter(still) {
  hook('footer-year').textContent = still ? '2026' : String(new Date().getFullYear());
}
