// The game parts page: each part from starter/parts in its states, with sample data.
import { screens, still } from './hooks.js';
import { fillFooter, markCurrentPage } from './site.js';
import { drawScoreboard, scoreboardState } from '../parts/scoreboard.js';
import { actionGridState, setUpActionGrid } from '../parts/action-grid.js';
import { showCountdown, startCountdown } from '../parts/countdown.js';
import { screenState, setUpScreen } from '../parts/screen.js';
import { clearMarkers, placeMarkers } from '../parts/markers.js';

const ROWS = [{ name: 'You', score: 12.4 }, { name: 'Them', score: -3.75 }];

markCurrentPage();
fillFooter(still);
setUpScreen();
setUpActionGrid(({ action, amount }) => { ROWS[0].score += action === 'buy' ? amount / 10 : -amount / 10; drawScoreboard(ROWS); });
drawScoreboard(ROWS);

function live(seconds) {
  screenState('live');
  placeMarkers({ x: 35, y: 62 }, { x: 68, y: 38 }, 50);
  scoreboardState('live');
  actionGridState('live');
  if (still) showCountdown(seconds, seconds <= 10 ? 'warning' : 'live');
  else startCountdown(seconds, done);
}

function done() {
  showCountdown(0, 'done');
  scoreboardState('done');
  actionGridState('done');
}

screens({
  game: () => { screenState('idle', 'Nothing on yet.'); clearMarkers(); showCountdown(60, 'idle'); },
  'game-loading': () => { screenState('loading', 'Tuning in…'); showCountdown(60, 'idle'); },
  'game-live': () => live(45),
  'game-warning': () => live(8),
  'game-done': () => { screenState('live'); placeMarkers({ x: 80, y: 30 }, { x: 72, y: 70 }, 50); done(); },
});
