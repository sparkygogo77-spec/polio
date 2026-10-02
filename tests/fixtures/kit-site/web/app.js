/* A practice flow by hooks alone, kit style. */
const $ = (h) => document.querySelector(`[data-hook="${h}"]`);
const setText = (hook, text) => { $(hook).textContent = text; };

function signIn() {
  setText('wallet-address', 'Test1111wallet');
  document.body.dataset.state = 'signed-in';
}

function addRow(when, amount) {
  const row = $('template-ledger-row').content.firstElementChild.cloneNode(true);
  row.querySelector('[data-hook="ledger-when"]').textContent = when;
  row.querySelector('[data-hook="ledger-amount"]').textContent = amount;
  $('ledger-rows').append(row);
}

function review() {
  const amount = Number($('deposit-amount').value);
  setText('balance-message', `Deposited ${amount} SOL.`);
  addRow('now', `${amount} SOL`);
  const you = $('score-you');
  you.dataset.sign = 'gain';
  you.textContent = 'You +1.45%';
  window.gainColour = getComputedStyle(document.documentElement).getPropertyValue('--pons-gain').trim();
}

$('wallet-connect-test').addEventListener('click', signIn);
$('deposit-review').onclick = review;
