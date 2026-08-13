/**
 * Kamalarani Foundation — Language Switcher
 * Toggles entire public site between English and Bengali.
 */
(function () {
  'use strict';

  const SKIP_SELECTORS = [
    'script', 'style', 'noscript', 'code', 'pre',
    '.notranslate', '#langToggleBtn'
  ].join(',');

  function shouldSkip(el) {
    if (!el || el.nodeType !== 1) return true;
    if (el.closest('#langToggleBtn')) return true;
    if (el.closest('.notranslate')) return true;
    return false;
  }

  function getDictionary() {
    return window.KF_TRANSLATIONS || {};
  }

  function sortedKeys(dict) {
    return Object.keys(dict).sort((a, b) => b.length - a.length);
  }

  function translateText(text, dict, keys) {
    if (!text || !text.trim()) return text;
    let result = text.replace(/\u2019|\u2018/g, "'");
    for (const key of keys) {
      const k = key.replace(/\u2019|\u2018/g, "'");
      if (result.includes(k)) {
        result = result.split(k).join(dict[key]);
      }
    }
    return result;
  }

  function storeOriginal(el, attr, value) {
    const dataKey = 'data-orig-' + attr;
    if (!el.hasAttribute(dataKey)) {
      el.setAttribute(dataKey, value);
    }
  }

  function getOriginal(el, attr, current) {
    const dataKey = 'data-orig-' + attr;
    return el.hasAttribute(dataKey) ? el.getAttribute(dataKey) : current;
  }

  function applyDataAttributes(lang) {
    document.querySelectorAll('[data-en][data-bn]').forEach(el => {
      if (shouldSkip(el)) return;
      storeOriginal(el, 'text', el.textContent.trim());
      el.textContent = lang === 'bn' ? el.getAttribute('data-bn') : el.getAttribute('data-en');
    });

    document.querySelectorAll('[data-en-placeholder][data-bn-placeholder]').forEach(el => {
      storeOriginal(el, 'placeholder', el.getAttribute('placeholder') || '');
      el.setAttribute(
        'placeholder',
        lang === 'bn' ? el.getAttribute('data-bn-placeholder') : el.getAttribute('data-en-placeholder')
      );
    });
  }

  function applyFormAttributes(lang, dict, keys) {
    document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
      if (el.hasAttribute('data-en-placeholder')) return;
      const ph = el.getAttribute('placeholder');
      if (!ph) return;
      storeOriginal(el, 'placeholder', ph);
      const orig = getOriginal(el, 'placeholder', ph);
      el.setAttribute('placeholder', lang === 'bn' ? translateText(orig, dict, keys) : orig);
    });

    document.querySelectorAll('option').forEach(el => {
      if (shouldSkip(el)) return;
      storeOriginal(el, 'text', el.textContent.trim());
      const orig = getOriginal(el, 'text', el.textContent.trim());
      el.textContent = lang === 'bn' ? translateText(orig, dict, keys) : orig;
    });

    ['title', 'aria-label', 'alt'].forEach(attr => {
      document.querySelectorAll('[' + attr + ']').forEach(el => {
        if (shouldSkip(el)) return;
        const val = el.getAttribute(attr);
        if (!val) return;
        storeOriginal(el, attr, val);
        const orig = getOriginal(el, attr, val);
        el.setAttribute(attr, lang === 'bn' ? translateText(orig, dict, keys) : orig);
      });
    });

    document.querySelectorAll('input[value], textarea[value]').forEach(el => {
      if (shouldSkip(el)) return;
      const val = el.getAttribute('value');
      if (!val || !val.trim()) return;
      storeOriginal(el, 'value', val);
      const orig = getOriginal(el, 'value', val);
      const translated = lang === 'bn' ? translateText(orig, dict, keys) : orig;
      el.setAttribute('value', translated);
      if (el.value === orig || (lang === 'en' && el.value === translated)) {
        el.value = translated;
      }
    });
  }

  function applyAllTextNodes(lang, dict, keys) {
    if (!document.body) return;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.textContent || !node.textContent.trim()) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest(SKIP_SELECTORS)) return NodeFilter.FILTER_REJECT;
        if (parent.closest('[data-en][data-bn]')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      if (!node._kfOrigText) node._kfOrigText = node.textContent;
      node.textContent = lang === 'bn'
        ? translateText(node._kfOrigText, dict, keys)
        : node._kfOrigText;
    });
  }

  function applyDocumentMeta(lang, dict, keys) {
    if (!document.title) return;
    if (!document._kfOrigTitle) document._kfOrigTitle = document.title;
    document.title = lang === 'bn'
      ? translateText(document._kfOrigTitle, dict, keys)
      : document._kfOrigTitle;
  }

  let currentLang = localStorage.getItem('kf_lang') || 'en';

  function updateButtonUI() {
    const toggleBtn = document.getElementById('langToggleBtn');
    if (toggleBtn) {
      const isBn = currentLang === 'bn';
      toggleBtn.classList.toggle('is-bn', isBn);
      toggleBtn.setAttribute('aria-pressed', isBn ? 'true' : 'false');
      toggleBtn.setAttribute(
        'title',
        isBn
          ? 'Switch Language (বাংলা → ENG)'
          : 'Switch Language (ENG → বাংলা)'
      );
    }
    document.documentElement.lang = currentLang === 'bn' ? 'bn' : 'en';
    document.documentElement.classList.toggle('lang-bn', currentLang === 'bn');
  }

  function applyDOMTranslations(lang) {
    const dict = getDictionary();
    const keys = sortedKeys(dict);
    applyDataAttributes(lang);
    applyFormAttributes(lang, dict, keys);
    applyAllTextNodes(lang, dict, keys);
    applyDocumentMeta(lang, dict, keys);
  }

  function notifyLangChange(lang) {
    window.dispatchEvent(new CustomEvent('kf-lang-change', { detail: { lang } }));
  }

  window.toggleLanguage = function () {
    currentLang = currentLang === 'en' ? 'bn' : 'en';
    localStorage.setItem('kf_lang', currentLang);
    updateButtonUI();
    applyDOMTranslations(currentLang);
    notifyLangChange(currentLang);
  };

  window.reapplyLanguage = function () {
    applyDOMTranslations(currentLang);
  };

  window.getCurrentLang = function () {
    return currentLang;
  };

  function init() {
    currentLang = localStorage.getItem('kf_lang') || 'en';
    updateButtonUI();
    if (currentLang === 'bn') {
      applyDOMTranslations('bn');
      notifyLangChange('bn');
    }

    const toggleBtn = document.getElementById('langToggleBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.toggleLanguage();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
