// The phone menu: on narrow screens (web/base.css) the navigation links fold away under the "Menu"
// button (nav-menu); pressing it opens them. <nav> carries data-open="true" while they are open.
import { $ } from './dom.js';

const nav = $('nav');
const button = $('nav-menu');
if (nav && button) {
  button.onclick = () => {
    const open = nav.dataset.open !== 'true';
    nav.dataset.open = String(open);
    button.setAttribute('aria-expanded', String(open));
  };
}
