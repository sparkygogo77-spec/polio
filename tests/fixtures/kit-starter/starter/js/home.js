import { hook, screens, still } from './hooks.js';
import { fillFooter, markCurrentPage } from './site.js';

function openSignup() {
  hook('signup-modal').showModal();
}

function setUp() {
  markCurrentPage();
  fillFooter(still);
  hook('hero-button').addEventListener('click', openSignup);
  hook('modal-close-button').addEventListener('click', () => hook('signup-modal').close());
  hook('modal-confirm-button').addEventListener('click', () => {
    hook('modal-text').textContent = 'Thanks, you are on the list.';
  });
}

setUp();
screens({
  home: () => {},
  'home-modal': () => openSignup(),
});
