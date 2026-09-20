'use strict';

const cfg = window.BLAGO_CONFIG || {};
const translations = window.BLAGO_TOURIST_I18N;
const supportedLanguages = ['he', 'en', 'ru'];
const languageLabels = {he: 'בחירת שפה', en: 'Choose language', ru: 'Выбор языка'};
let currentLanguage = getInitialLanguage();
let propertiesData = null;
const t = key => translations[currentLanguage][key] ?? translations.he[key] ?? key;
const safeUrl = value => { try { const url = new URL(value, location.href); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };

function getInitialLanguage() {
  const queryLanguage = new URLSearchParams(location.search).get('lang');
  if (supportedLanguages.includes(queryLanguage)) return queryLanguage;
  try { const saved = localStorage.getItem('blagoTouristLanguage'); if (supportedLanguages.includes(saved)) return saved; } catch {}
  return 'he';
}

function localizeProperty(property, field) {
  return property.translations?.[currentLanguage]?.[field] || property[field] || '';
}

function applyLanguage() {
  const dictionary = translations[currentLanguage];
  document.documentElement.lang = currentLanguage;
  document.documentElement.dir = currentLanguage === 'he' ? 'rtl' : 'ltr';
  document.title = dictionary.pageTitle;
  document.querySelector('meta[name="description"]').content = dictionary.metaDescription;
  document.querySelectorAll('[data-i18n]').forEach(node => { const value = dictionary[node.dataset.i18n]; if (value !== undefined && !Array.isArray(value)) node.textContent = value; });
  document.querySelectorAll('[data-i18n-html]').forEach(node => { const value = dictionary[node.dataset.i18nHtml]; if (value !== undefined) node.innerHTML = value; });
  document.querySelectorAll('[data-i18n-aria]').forEach(node => { const value = dictionary[node.dataset.i18nAria]; if (value !== undefined) node.setAttribute('aria-label', value); });
  document.querySelectorAll('[data-brand-link]').forEach(node => { node.href = '?lang=' + currentLanguage; node.setAttribute('aria-label', dictionary.brandHome); });
  document.querySelectorAll('[data-business-link]').forEach(node => { node.href = 'business/?lang=' + currentLanguage; });
  document.getElementById('menu').setAttribute('aria-label', dictionary.openMenu);
  const languageSelect = document.getElementById('language-select');
  languageSelect.value = currentLanguage;
  languageSelect.setAttribute('aria-label', languageLabels[currentLanguage]);
}

function photo(photoData, name) {
  const frame = el('div', undefined, 'tour-photo' + (photoData.top === undefined ? ' regular' : ''));
  if (photoData.top !== undefined) {
    frame.style.setProperty('--top', photoData.top + '%');
    frame.style.setProperty('--mobile-top', (photoData.mobileTop ?? photoData.top) + '%');
  }
  const image = el('img');
  image.src = safeUrl(photoData.src); image.alt = name; image.loading = 'lazy';
  frame.append(image);
  return frame;
}

async function getProperties() {
  if (propertiesData) return propertiesData;
  if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
    const response = await fetch(cfg.supabaseUrl + '/rest/v1/properties?visible=eq.true&order=sort_order.asc', {headers:{apikey:cfg.supabaseAnonKey,Authorization:'Bearer ' + cfg.supabaseAnonKey}});
    if (!response.ok) throw Error(t('loadError'));
    propertiesData = await response.json();
  } else {
    const response = await fetch('data/properties.json');
    if (!response.ok) throw Error(t('loadError'));
    propertiesData = await response.json();
  }
  return propertiesData;
}

function detailUrl(id) { return '?property=' + encodeURIComponent(id) + '&lang=' + currentLanguage; }

async function render() {
  try {
    const properties = (await getProperties()).filter(property => property.visible);
    const id = new URLSearchParams(location.search).get('property');
    if (id) return renderDetail(properties, id);
    const cards = document.getElementById('cards');
    cards.replaceChildren();
    if (!properties.length) cards.append(el('p', t('empty'), 'tour-empty'));
    properties.forEach(property => {
      const name = localizeProperty(property, 'name') || property.name;
      const card = el('article', undefined, 'tour-card');
      if (property.photos?.length) card.append(photo(property.photos[0], name));
      const content = el('div', undefined, 'tour-card-content');
      content.append(el('h3', name), el('p', localizeProperty(property, 'location') || t('eilatIsrael'), 'tour-location'), el('p', t('priceRequest'), 'tour-price'));
      const link = el('a', t('details'), 'tour-card-link'); link.href = detailUrl(property.id);
      content.append(link); card.append(content); cards.append(card);
    });
  } catch (error) {
    const target = document.getElementById('cards') || document.querySelector('main');
    target.replaceChildren(el('p', error.message, 'tour-empty'));
  }
}

function renderDetail(properties, id) {
  const property = properties.find(item => item.id === id);
  const main = document.querySelector('main'); main.replaceChildren();
  const section = el('section', undefined, 'tour-detail tour-wrap');
  const back = el('a', t('back'), 'tour-back'); back.href = '?lang=' + currentLanguage + '#properties'; section.append(back);
  if (!property) { section.append(el('h1', t('notFound')), el('p', t('notFoundText'))); main.append(section); return; }
  const name = localizeProperty(property, 'name') || property.name;
  document.title = name + ' — BLAGO home';
  section.append(el('div', t('detailEyebrow'), 'tour-kicker'), el('h1', name));
  const gallery = el('div', undefined, 'tour-gallery'); (property.photos || []).forEach(item => gallery.append(photo(item, name))); section.append(gallery);
  const info = el('div', undefined, 'tour-detail-copy'); info.append(el('h2', t('about')), el('p', localizeProperty(property, 'description')), el('h3', t('priceRequest')), el('p', t('demoDetail')));
  const action = el('a', t('chooseDates'), 'tour-primary'); action.href = '#'; action.setAttribute('aria-disabled', 'true'); info.append(action); section.append(info); main.append(section);
}

async function setLanguage(language) {
  if (!supportedLanguages.includes(language)) return;
  currentLanguage = language;
  try { localStorage.setItem('blagoTouristLanguage', language); } catch {}
  const url = new URL(location.href); url.searchParams.set('lang', language); history.replaceState({}, '', url);
  applyLanguage(); await render();
}

document.getElementById('year').textContent = new Date().getFullYear();
document.getElementById('menu').onclick = () => { const nav = document.getElementById('nav'); const open = nav.classList.toggle('open'); document.getElementById('menu').setAttribute('aria-expanded', String(open)); };
document.querySelectorAll('nav a').forEach(link => link.addEventListener('click', () => { document.getElementById('nav').classList.remove('open'); document.getElementById('menu').setAttribute('aria-expanded', 'false'); }));
document.getElementById('language-select').addEventListener('change', event => setLanguage(event.target.value));
applyLanguage();
render();
