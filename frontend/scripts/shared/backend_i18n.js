(function backendI18nBootstrap() {
  const CATALOG = window.ASIATRAVELPLAN_LANGUAGE_CATALOG;
  const LANGUAGES = Array.isArray(CATALOG?.backendUiLanguages)
    ? orderLanguageMenuItems(CATALOG.backendUiLanguages.map((item) => ({
        code: item.code,
        label: item.nativeLabel,
        shortLabel: item.shortLabel,
        flagClass: item.flagClass,
        sortLabel: item.promptName || item.apiValue || item.nativeLabel || item.code
      })))
    : [];

  const CONFIG = {
    storageKey: 'asiatravelplan_backend_lang',
    supported: Array.isArray(CATALOG?.backendUiLanguageCodes) ? CATALOG.backendUiLanguageCodes : ['en'],
    defaultLang: 'en',
    basePath: '/frontend/data/i18n/backend'
  };

  const state = {
    lang: 'en',
    dict: {}
  };

  window.backendT = function backendT(id, fallback, vars) {
    const template = String(state.dict[id] ?? fallback ?? id);
    return interpolate(template, vars);
  };

  window.backendI18n = {
    getLang: () => state.lang,
    applyDataI18nAttributes,
    mountLanguageMenu,
    translateDocument: () => applyDataI18nAttributes(document)
  };

  window.__BACKEND_I18N_PROMISE = init();

  async function init() {
    state.lang = resolveLang();
    state.dict = await loadDictionary(state.lang);
    document.documentElement.lang = state.lang;
    applyDataI18nAttributes(document);
    mountLanguageMenu();
    window.addEventListener('backend-nav-mounted', mountLanguageMenu);
    window.dispatchEvent(new CustomEvent('backend-i18n-ready', { detail: { lang: state.lang } }));
  }

  function resolveLang() {
    const params = new URLSearchParams(window.location.search);
    const query = normalizeText(params.get('lang')).toLowerCase();
    if (CONFIG.supported.includes(query)) return query;

    const saved = normalizeText(localStorage.getItem(CONFIG.storageKey)).toLowerCase();
    if (CONFIG.supported.includes(saved)) return saved;

    const browser = normalizeText(navigator.language).toLowerCase().split('-')[0];
    if (CONFIG.supported.includes(browser)) return browser;

    return CONFIG.defaultLang;
  }

  async function loadDictionary(lang) {
    try {
      const response = await fetch(`${CONFIG.basePath}/${lang}.json`, { cache: 'no-store' });
      if (response.ok) return await response.json();
    } catch {}

    if (lang !== CONFIG.defaultLang) {
      try {
        const fallback = await fetch(`${CONFIG.basePath}/${CONFIG.defaultLang}.json`, { cache: 'no-store' });
        if (fallback.ok) return await fallback.json();
      } catch {}
    }

    return {};
  }

  function orderLanguageMenuItems(items) {
    return [...items].sort((left, right) => {
      const priorityDifference = languagePriority(left?.code) - languagePriority(right?.code);
      if (priorityDifference !== 0) return priorityDifference;
      return String(left?.sortLabel || left?.label || left?.code || '')
        .localeCompare(String(right?.sortLabel || right?.label || right?.code || ''), 'en', { sensitivity: 'base' });
    });
  }

  function languagePriority(code) {
    const normalized = normalizeText(code).toLowerCase();
    if (normalized === 'en') return 0;
    if (normalized === 'vi') return 1;
    return 2;
  }

  function mountLanguageMenu() {
    const mount = document.getElementById('backendLangMenuMount');
    if (!mount || mount.dataset.langMounted === '1') return;
    mount.dataset.langMounted = '1';
    mount.replaceChildren(createLanguageMenu());
  }

  function createLanguageMenu() {
    const active = LANGUAGES.find((item) => item.code === state.lang) || LANGUAGES[0] || {
      code: state.lang || CONFIG.defaultLang,
      label: (state.lang || CONFIG.defaultLang).toUpperCase(),
      shortLabel: (state.lang || CONFIG.defaultLang).toUpperCase(),
      flagClass: `flag-${state.lang || CONFIG.defaultLang}`
    };
    const root = document.createElement('div');
    root.className = 'lang-menu lang-menu--backend';
    root.setAttribute('data-lang-menu', 'true');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'lang-menu-trigger';
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', window.backendT('lang.select_label', 'Select language'));
    trigger.innerHTML = `
      <span class="lang-flag ${escapeHtml(active.flagClass)}" aria-hidden="true"></span>
      <span class="lang-menu-code">${escapeHtml(active.shortLabel)}</span>
      <span class="lang-menu-caret" aria-hidden="true"></span>
    `;

    const panel = document.createElement('div');
    panel.className = 'lang-menu-panel';
    panel.setAttribute('role', 'menu');
    panel.hidden = true;
    panel.innerHTML = LANGUAGES.filter((item) => item.code !== active.code)
      .map((item) => `
        <button type="button" class="lang-menu-item" data-lang-option="${escapeHtml(item.code)}" role="menuitem">
          <span class="lang-flag ${escapeHtml(item.flagClass)}" aria-hidden="true"></span>
          <span class="lang-menu-label">${escapeHtml(item.label)}</span>
        </button>
      `)
      .join('');

    const closeMenu = () => {
      root.classList.remove('is-open');
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    };

    const openMenu = () => {
      root.classList.add('is-open');
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
    };

    trigger.addEventListener('click', () => {
      if (root.classList.contains('is-open')) closeMenu();
      else openMenu();
    });

    panel.querySelectorAll('[data-lang-option]').forEach((item) => {
      item.addEventListener('click', () => {
        const next = normalizeText(item.getAttribute('data-lang-option')).toLowerCase() || CONFIG.defaultLang;
        localStorage.setItem(CONFIG.storageKey, next);
        const url = new URL(window.location.href);
        url.searchParams.set('lang', next);
        window.location.href = url.toString();
      });
    });

    document.addEventListener('click', (event) => {
      if (!root.contains(event.target)) closeMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });

    root.appendChild(trigger);
    root.appendChild(panel);
    return root;
  }

  function applyDataI18nAttributes(root) {
    root.querySelectorAll('[data-i18n-id]').forEach((node) => {
      const id = normalizeText(node.getAttribute('data-i18n-id'));
      if (!id) return;
      node.textContent = window.backendT(id, node.textContent || '');
    });

    root.querySelectorAll('[data-i18n-html-id]').forEach((node) => {
      const id = normalizeText(node.getAttribute('data-i18n-html-id'));
      if (!id) return;
      node.innerHTML = window.backendT(id, node.innerHTML || '');
    });

    root.querySelectorAll('[data-i18n-placeholder-id]').forEach((node) => {
      const id = normalizeText(node.getAttribute('data-i18n-placeholder-id'));
      if (!id) return;
      node.setAttribute('placeholder', window.backendT(id, node.getAttribute('placeholder') || ''));
    });

    root.querySelectorAll('[data-i18n-aria-label-id]').forEach((node) => {
      const id = normalizeText(node.getAttribute('data-i18n-aria-label-id'));
      if (!id) return;
      node.setAttribute('aria-label', window.backendT(id, node.getAttribute('aria-label') || ''));
    });

    root.querySelectorAll('[data-i18n-title-id]').forEach((node) => {
      const id = normalizeText(node.getAttribute('data-i18n-title-id'));
      if (!id) return;
      node.setAttribute('title', window.backendT(id, node.getAttribute('title') || ''));
    });
  }

  function interpolate(template, vars) {
    if (!vars || typeof vars !== 'object') return template;
    return template.replace(/\{([^{}]+)\}/g, (match, key) => {
      const normalizedKey = String(key || "").trim();
      return normalizedKey in vars ? String(vars[normalizedKey]) : match;
    });
  }

  function normalizeText(value) {
    return String(value || '').trim();
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
