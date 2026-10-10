import { hook, screens, setOn, still } from './hooks.js';
import { fillFooter, markCurrentPage } from './site.js';

function openSignup() {
  setOn('signup-modal', true);
  hook('signup-modal').showModal();
}

function closeSignup() {
  hook('signup-modal').close();
  setOn('signup-modal', false);
}

function setUp() {
  markCurrentPage();
  fillFooter(still);
  hook('hero-button').addEventListener('click', openSignup);
  hook('modal-close-button').addEventListener('click', closeSignup);
  hook('signup-modal').addEventListener('close', () => setOn('signup-modal', false));
  hook('modal-confirm-button').addEventListener('click', () => {
    hook('modal-text').textContent = 'Thanks, you are on the list.';
  });
}

setUp();
screens({
  home: () => {},
  'home-modal': () => openSignup(),
});
