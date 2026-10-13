export const NASA_VIEWS = Object.freeze(['fleet', 'detail', 'thermal', 'operations']);

export function initialView(search = '') {
  const view = new URLSearchParams(search).get('view');
  return NASA_VIEWS.includes(view) || view === 'carpark' ? view : 'carpark';
}

export function navigationState(view, lastNASAView = 'fleet') {
  const nasa = NASA_VIEWS.includes(view);
  return { section: nasa ? 'rules' : 'carpark', lastNASAView: nasa ? view : NASA_VIEWS.includes(lastNASAView) ? lastNASAView : 'fleet' };
}

export function chromeState(section) {
  return { primaryHidden: section === 'carpark', rulesHidden: true, nasaHidden: section !== 'rules' };
}

export function installNavigation(bridge) {
  const primary = document.getElementById('primaryNav'), nasa = document.getElementById('nasaNav');
  const rules = document.getElementById('rulesTab'), carpark = document.getElementById('carparkTab');
  let current = navigationState(bridge.view);
  const words = {
    zh: { primary: '主要功能', nasa: 'NASA 電芯規則驗證檢視', rules: '規則驗證（NASA 電芯）', carpark: '車位監控', carparkBack: '返回車位監控' },
    en: { primary: 'Main navigation', nasa: 'NASA cell rule validation views', rules: 'Rule validation (NASA cells)', carpark: 'Bay monitor', carparkBack: 'Back to bay monitor' }
  };
  function render() {
    const text = words[bridge.language], chrome = chromeState(current.section);
    primary.setAttribute('aria-label', text.primary); nasa.setAttribute('aria-label', text.nasa);
    rules.textContent = text.rules; carpark.textContent = current.section === 'rules' ? text.carparkBack : text.carpark;
    primary.hidden = chrome.primaryHidden; rules.hidden = chrome.rulesHidden; nasa.hidden = chrome.nasaHidden;
    for (const [button, section] of [[carpark, 'carpark'], [rules, 'rules']]) {
      button.classList.toggle('active', current.section === section);
      button.setAttribute('aria-current', current.section === section ? 'page' : 'false');
    }
  }
  rules.addEventListener('click', () => document.getElementById(`${current.lastNASAView}Tab`).click());
  window.addEventListener('voltguard-view', event => { current = navigationState(event.detail.view, current.lastNASAView); render(); });
  window.addEventListener('voltguard-language', render);
  render();
}
