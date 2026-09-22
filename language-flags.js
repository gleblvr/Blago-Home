'use strict';
(() => {
  const select = document.getElementById('language-select');
  if (!select) return;
  const switcher = select.closest('.language-switcher');
  const labels = {ru: 'RU', en: 'EN', he: 'עברית'};
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'language-menu-button';
  button.setAttribute('aria-haspopup', 'listbox'); button.setAttribute('aria-expanded', 'false');
  const selectedFlag = document.createElement('span'); selectedFlag.className = 'language-flag';
  const selectedLabel = document.createElement('span'); button.append(selectedFlag, selectedLabel);
  const menu = document.createElement('div'); menu.className = 'language-menu-options'; menu.setAttribute('role', 'listbox'); menu.hidden = true;
  [...select.options].forEach(option => {
    const item = document.createElement('button'); item.type = 'button'; item.className = 'language-menu-option'; item.dataset.language = option.value; item.setAttribute('role', 'option');
    const flag = document.createElement('span'); flag.className = 'language-flag'; flag.dataset.language = option.value;
    const text = document.createElement('span'); text.textContent = labels[option.value] || option.textContent; item.append(flag, text);
    item.addEventListener('click', () => { select.value = option.value; select.dispatchEvent(new Event('change', {bubbles:true})); closeMenu(); button.focus(); });
    menu.append(item);
  });
  function sync() {
    selectedFlag.dataset.language = select.value; selectedLabel.textContent = labels[select.value] || select.selectedOptions[0]?.textContent || '';
    button.setAttribute('aria-label', select.getAttribute('aria-label') || 'Language');
    menu.querySelectorAll('.language-menu-option').forEach(item => item.setAttribute('aria-selected', String(item.dataset.language === select.value)));
  }
  function closeMenu() { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); }
  function openMenu() { menu.hidden = false; button.setAttribute('aria-expanded', 'true'); menu.querySelector('[aria-selected="true"]')?.focus(); }
  button.addEventListener('click', () => menu.hidden ? openMenu() : closeMenu());
  select.addEventListener('change', sync);
  document.addEventListener('click', event => { if (!switcher.contains(event.target)) closeMenu(); });
  switcher.addEventListener('keydown', event => { if (event.key === 'Escape') { closeMenu(); button.focus(); } if (event.key === 'ArrowDown' && document.activeElement === button) { event.preventDefault(); openMenu(); } });
  switcher.append(button, menu); sync();
})();
