import { hook, screens, still } from './hooks.js';
import { fillFooter, markCurrentPage } from './site.js';

/** Shows each field's problem under it; true when there are none. */
function validate() {
  const nameOk = hook('name-input').value.trim() !== '';
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(hook('email-input').value.trim());
  hook('name-error').hidden = nameOk;
  hook('email-error').hidden = emailOk;
  return nameOk && emailOk;
}

function send(event) {
  event.preventDefault();
  if (!validate()) return;
  hook('contact-form').hidden = true;
  hook('form-sent').hidden = false;
}

markCurrentPage();
fillFooter(still);
hook('contact-form').addEventListener('submit', send);

screens({
  contact: () => {},
  'contact-errors': () => validate(),
  'contact-sent': () => {
    hook('name-input').value = 'Sample Person';
    hook('email-input').value = 'sample@example.com';
    hook('message-input').value = 'Hello!';
    hook('contact-form').requestSubmit();
  },
});
