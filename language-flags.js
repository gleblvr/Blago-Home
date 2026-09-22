'use strict';
(() => {
  const select = document.getElementById('language-select');
  if (!select) return;
  const switcher = select.closest('.language-switcher');
  const updateFlag = () => { switcher.dataset.language = select.value; };
  updateFlag();
  select.addEventListener('change', updateFlag);
})();
