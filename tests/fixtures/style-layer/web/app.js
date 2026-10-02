/* A practice flow driven only by hooks, the way PST's app.js is. */
const $ = (h) => document.querySelector(`[data-hook="${h}"]`);
let balance = 0;
const setText = (hook, text) => { $(hook).textContent = text; };
$('wallet-connect-test').addEventListener('click', () => {
  $('wallet-address').textContent = 'Test1111wallet';
  document.body.dataset.state = 'signed-in';
});
$('wallet-new').addEventListener('click', () => { $('newwallet-panel').hidden = false; });
$('newwallet-ack').addEventListener('change', (e) => { $('newwallet-create').disabled = !e.target.checked; });
$('deposit-review').addEventListener('click', () => {
  $('deposit-summary').textContent = `Deposit ${$('deposit-amount').value} SOL`;
  $('deposit-confirm-panel').hidden = false;
});
$('deposit-confirm').addEventListener('click', () => {
  balance += Number($('deposit-amount').value);
  $('balance-available').textContent = String(balance);
  $('deposit-confirm-panel').hidden = true;
  $('balance-message').textContent = 'Deposited.';
  const you = $('score-you');
  you.dataset.sign = 'gain';
  you.textContent = 'You +1.45%';
  /* The duel, the way PST's refreshDuel draws it: the bigger circle is ahead. */
  $('duel-circle-me').setAttribute('r', '70');
  /* Read back the way PST's overlay.js reads its colours. */
  window.gainColour = getComputedStyle(document.documentElement).getPropertyValue('--pons-gain').trim();
});
document.querySelectorAll('.panel').forEach((p) => p.classList.add('ready'));
$('withdraw-max').onclick = () => setText('balance-message', `All ${balance} SOL available.`);
