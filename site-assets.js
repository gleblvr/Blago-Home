'use strict';

(() => {
  const cfg = window.BLAGO_CONFIG || {};
  const registry = new Map();
  const safeUrl = value => {
    try {
      const url = new URL(value, location.href);
      return url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  };

  function apply() {
    document.querySelectorAll('[data-site-asset]').forEach(node => {
      const url = registry.get(node.dataset.siteAsset);
      if (url) node.src = url;
    });
    document.querySelectorAll('[data-site-asset-href]').forEach(node => {
      const url = registry.get(node.dataset.siteAssetHref);
      if (url) node.href = url;
    });
    const eilat = registry.get('eilat_panorama');
    if (eilat) document.documentElement.style.setProperty('--site-eilat-panorama', `url("${eilat.replaceAll('"', '%22')}")`);
  }

  async function load() {
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return registry;
    const response = await fetch(
      cfg.supabaseUrl + '/rest/v1/site_assets?select=asset_key,public_url',
      {headers: {apikey: cfg.supabaseAnonKey}}
    );
    if (!response.ok) throw new Error('Unable to load site assets.');
    const rows = await response.json();
    rows.forEach(row => {
      const url = safeUrl(row.public_url);
      if (url) registry.set(row.asset_key, url);
    });
    apply();
    return registry;
  }

  const ready = load().catch(error => {
    console.error(error);
    return registry;
  });

  window.BLAGO_ASSETS = {
    ready,
    get: key => registry.get(key) || '',
    refresh: async () => {
      registry.clear();
      await load();
      return registry;
    }
  };
})();
