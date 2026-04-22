import './styles.css';
import { APPS } from './apps.js';
import { glyphFor } from './glyphs.js';

const grid = document.getElementById('apps');

function renderCard(app) {
  const isLive = app.status === 'live';
  const card = document.createElement(isLive ? 'a' : 'div');
  card.className = `app-card app-card--${app.status}`;
  card.dataset.appId = app.id;
  card.style.setProperty('--accent', app.accent);
  card.style.setProperty('--accent-2', app.accent2);
  if (isLive) {
    card.href = app.path;
    card.setAttribute('aria-label', `Launch ${app.name}`);
  }

  const glyphMarkup = glyphFor(app.glyph, app.accent, app.accent2);

  card.innerHTML = `
    <div class="app-card__top">
      <div class="app-card__glyph" aria-hidden="true">${glyphMarkup}</div>
      <div class="app-card__meta">
        <div class="app-card__version">${app.version} · ${app.status === 'live' ? 'Live' : 'Coming soon'}</div>
        <h3 class="app-card__name">${app.name}</h3>
        <div class="app-card__tagline">${app.tagline}</div>
      </div>
    </div>
    <p class="app-card__desc">${app.description}</p>
    <div class="app-card__tags">
      ${app.tags.map((t) => `<span class="chip">${t}</span>`).join('')}
    </div>
    <div class="app-card__cta">
      <span class="cta-label">${isLive ? 'LAUNCH' : 'IN PROGRESS'}</span>
      <svg class="cta-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 12h14"/>
        <path d="M13 6l6 6-6 6"/>
      </svg>
    </div>
  `;

  if (isLive) {
    card.addEventListener('click', (e) => {
      // Let the browser follow the link, but show a brief launch splash first.
      e.preventDefault();
      launch(app);
    });
  }

  return card;
}

// Launch transition — quick splash ≤ 500ms, then navigate
function launch(app) {
  const splash = document.getElementById('splash');
  splash.style.setProperty('--accent', app.accent);
  splash.style.setProperty('--accent-2', app.accent2);
  splash.querySelector('.splash__name').textContent = app.name;
  splash.querySelector('.splash__glyph').innerHTML = glyphFor(app.glyph, app.accent, app.accent2);
  splash.classList.add('is-active');
  setTimeout(() => {
    window.location.href = app.path;
  }, 420);
}

// Populate cards
APPS.forEach((app) => grid.appendChild(renderCard(app)));
