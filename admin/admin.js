'use strict';

const cfg = window.BLAGO_CONFIG || {};
const $ = selector => document.querySelector(selector);
let token = '';
let rows = [];
let editing = null;
let photos = [];
let propertyVideo = null;
let pendingVideo = null;
let videoRemoved = false;
let videoPreviewUrl = '';
let siteAssets = [];
let busy = false;

const configured = cfg.supabaseUrl && cfg.supabaseAnonKey;
const publicStorageUrl = (bucket, path) => `${cfg.supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;

function status(text, error = false) {
  $('#status').textContent = text;
  $('#status').classList.toggle('error', error);
}

function photoStatus(text, error = false) {
  const element = $('#photo-status');
  element.textContent = text;
  element.classList.toggle('error', error);
}

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function button(text, handler, className = 'small-btn') {
  const element = node('button', text, className);
  element.type = 'button';
  element.onclick = handler;
  return element;
}

async function request(path, {method = 'GET', body, headers = {}} = {}) {
  const requestHeaders = {
    apikey: cfg.supabaseAnonKey,
    ...(token ? {Authorization: `Bearer ${token}`} : {}),
    ...headers
  };
  if (body !== undefined && !(body instanceof Blob)) requestHeaders['Content-Type'] = 'application/json';
  const response = await fetch(cfg.supabaseUrl + path, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : body instanceof Blob ? body : JSON.stringify(body)
  });
  const responseText = await response.text();
  if (!response.ok) {
    if (response.status === 401) {
      token = '';
      $('#dashboard').hidden = true;
      $('#editor').hidden = true;
      $('#login').hidden = false;
      throw new Error('Войдите снова: срок действия сеанса истёк.');
    }
    let details = {};
    try { details = responseText ? JSON.parse(responseText) : {}; } catch {}
    const error = new Error(details.message || 'Не удалось выполнить действие. Проверьте соединение и права доступа.');
    error.code = details.code || '';
    error.details = details.details || '';
    throw error;
  }
  return responseText ? JSON.parse(responseText) : null;
}

async function uploadFile(bucket, path, file) {
  const response = await fetch(`${cfg.supabaseUrl}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      apikey: cfg.supabaseAnonKey,
      Authorization: `Bearer ${token}`,
      'Content-Type': file.type
    },
    body: file
  });
  if (!response.ok) {
    const responseText = await response.text();
    let details = {};
    try { details = JSON.parse(responseText); } catch {}
    const reason = details.message || details.error || responseText.slice(0, 180) || 'Причина не указана';
    throw new Error(`Не удалось загрузить файл (${response.status}): ${reason}`);
  }
}

async function deleteStorageFiles(bucket, paths) {
  if (!paths.length) return;
  await request(`/storage/v1/object/${bucket}`, {
    method: 'DELETE',
    body: {prefixes: paths}
  });
}

function imageExtension(file) {
  const extensions = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/svg+xml': 'svg'
  };
  return extensions[file.type] || '';
}

const descriptionLanguages = ['ru', 'en', 'he'];

function translationSegments(text) {
  const encoder = new TextEncoder();
  const segments = [];
  let segment = '';
  for (const part of text.match(/\S+\s*|\s+/gu) || []) {
    if (encoder.encode(segment + part).length > 450 && segment) {
      segments.push(segment);
      segment = '';
    }
    for (const character of part) {
      if (encoder.encode(segment + character).length > 450) {
        segments.push(segment);
        segment = '';
      }
      segment += character;
    }
  }
  if (segment) segments.push(segment);
  return segments;
}

async function translateDescription(text, source, target) {
  if ('Translator' in self) {
    try {
      const options = {sourceLanguage: source, targetLanguage: target};
      if (await Translator.availability(options) !== 'unavailable') {
        const translator = await Translator.create(options);
        try { return (await translator.translate(text)).trim(); }
        finally { translator.destroy(); }
      }
    } catch {} // Use the network translator if this language pair or device is unsupported.
  }
  const segments = translationSegments(text);
  const translated = [];
  for (const segment of segments) {
    if (!segment.trim()) { translated.push(segment); continue; }
    const url = new URL('https://api.mymemory.translated.net/get');
    url.searchParams.set('q', segment.trim());
    url.searchParams.set('langpair', `${source}|${target}`);
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || Number(data.responseStatus) !== 200 || !data.responseData?.translatedText) {
      throw new Error(`Автоперевод ${source.toUpperCase()} → ${target.toUpperCase()} недоступен: ${data.responseDetails || `ошибка ${response.status}`}. Текст не сохранён; попробуйте позже или заполните этот язык вручную.`);
    }
    const decoder = document.createElement('textarea');
    decoder.innerHTML = data.responseData.translatedText;
    translated.push(decoder.value + (segment.match(/\s+$/u)?.[0] || ''));
  }
  return translated.join('').trim();
}

async function refresh() {
  const [propertyRows, assetRows] = await Promise.all([
    request('/rest/v1/properties?select=*,property_photos(*),property_videos(*)&order=sort_order.asc&property_photos.order=display_order.asc'),
    request('/rest/v1/site_assets?select=*&order=asset_key.asc')
  ]);
  rows = propertyRows;
  siteAssets = assetRows;
  renderProperties();
  renderSiteAssets();
  window.BLAGO_CALENDAR?.setProperties(rows);
}

function renderProperties() {
  const list = $('#list');
  list.replaceChildren();
  if (!rows.length) list.append(node('p', 'Пока нет объектов. Добавьте первый.'));
  rows.forEach(property => {
    const row = node('div', undefined, 'admin-row');
    const name = node('div');
    const archived = Boolean(property.archived_at);
    name.append(node('strong', property.name), node('div', archived ? 'В архиве' : 'Опубликован', 'muted'));
    const actions = node('div', undefined, 'actions');
    actions.append(button('Календарь', () => window.BLAGO_CALENDAR?.selectOnly(property.id)));
    actions.append(button('Изменить', () => edit(property)));
    if (archived) {
      actions.append(button('Восстановить', () => setArchived(property, false)));
      actions.append(button('Удалить навсегда', () => permanentlyDelete(property), 'small-btn danger'));
    } else {
      actions.append(button('В архив', () => setArchived(property, true)));
    }
    row.append(name, actions);
    list.append(row);
  });
}

async function setArchived(property, archived) {
  try {
    await request(`/rest/v1/properties?id=eq.${encodeURIComponent(property.id)}`, {
      method: 'PATCH',
      body: {archived_at: archived ? new Date().toISOString() : null}
    });
    await refresh();
    status(archived ? 'Объект перемещён в архив.' : 'Объект восстановлен.');
  } catch (error) {
    status(error.message, true);
  }
}

async function permanentlyDelete(property) {
  if (!confirm(`Удалить объект «${property.name}» без возможности восстановления?`)) return;
  try {
    await request(`/rest/v1/properties?id=eq.${encodeURIComponent(property.id)}`, {method: 'DELETE'});
    await refresh();
    status('Объект удалён навсегда.');
  } catch (error) {
    status(error.message, true);
  }
}

function renderSiteAssets() {
  const container = $('#site-assets');
  container.replaceChildren();
  siteAssets.forEach(asset => {
    const row = node('div', undefined, 'image-row');
    const preview = node('img');
    preview.src = asset.public_url;
    preview.alt = asset.label;
    const copy = node('div');
    copy.append(node('strong', asset.label), node('div', asset.asset_key, 'muted'));
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,image/svg+xml';
    input.className = 'asset-file-input';
    input.setAttribute('aria-label', `Заменить: ${asset.label}`);
    input.onchange = event => replaceSiteAsset(asset, event.target.files[0], input);
    row.append(preview, copy, input);
    container.append(row);
  });
}

async function replaceSiteAsset(asset, file, input) {
  if (!file || busy) return;
  const extension = imageExtension(file);
  if (!extension || file.size > 5 * 1024 * 1024) {
    input.value = '';
    status('Разрешены JPG, PNG, WebP и SVG до 5 МБ.', true);
    return;
  }
  busy = true;
  input.disabled = true;
  status(`Загружаем: ${asset.label}…`);
  try {
    const folder = asset.storage_path.split('/')[0];
    const path = `${folder}/${asset.asset_key}-${crypto.randomUUID()}.${extension}`;
    await uploadFile('site-assets', path, file);
    await request(`/rest/v1/site_assets?asset_key=eq.${encodeURIComponent(asset.asset_key)}`, {
      method: 'PATCH',
      body: {storage_path: path, public_url: publicStorageUrl('site-assets', path)}
    });
    await refresh();
    await window.BLAGO_ASSETS?.refresh();
    status(`${asset.label}: изображение заменено во всех версиях сайта.`);
  } catch (error) {
    status(error.message, true);
  } finally {
    busy = false;
    input.disabled = false;
    input.value = '';
  }
}

function renderPhotos() {
  const container = $('#photos');
  container.replaceChildren();
  photos.forEach((photo, index) => {
    const row = node('div', undefined, 'image-row');
    const preview = node('img');
    preview.src = photo.public_url;
    preview.alt = `Фото ${index + 1}`;
    row.append(preview, node('span', index === 0 ? 'Обложка' : `Фото ${index + 1}`));
    if (index > 0) row.append(button('Выше', () => {
      [photos[index - 1], photos[index]] = [photos[index], photos[index - 1]];
      renderPhotos();
    }));
    if (index < photos.length - 1) row.append(button('Ниже', () => {
      [photos[index], photos[index + 1]] = [photos[index + 1], photos[index]];
      renderPhotos();
    }));
    row.append(button('Убрать', () => {
      photos.splice(index, 1);
      renderPhotos();
    }));
    container.append(row);
  });
}

function clearVideoPreviewUrl() {
  if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
  videoPreviewUrl = '';
}

function formatMegabytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function renderPropertyVideo() {
  const container = $('#property-video');
  container.replaceChildren();
  clearVideoPreviewUrl();
  const activeVideo = pendingVideo || (!videoRemoved ? propertyVideo : null);
  if (!activeVideo) {
    container.append(node('p', 'Видео не добавлено.', 'muted'));
    return;
  }

  const row = node('div', undefined, 'video-admin-row');
  const preview = document.createElement('video');
  preview.controls = true;
  preview.preload = 'metadata';
  preview.playsInline = true;
  if (pendingVideo) {
    videoPreviewUrl = URL.createObjectURL(pendingVideo.file);
    preview.src = videoPreviewUrl;
  } else {
    preview.src = propertyVideo.public_url;
  }
  const details = node('div');
  const size = activeVideo.file?.size ?? activeVideo.size_bytes;
  const duration = activeVideo.durationSeconds ?? activeVideo.duration_seconds;
  details.append(
    node('strong', pendingVideo ? 'Сжатое видео готово' : 'Текущее видео'),
    node('div', `${formatMegabytes(size)} · ${Math.round(duration || 0)} сек.`, 'muted')
  );
  details.append(button('Убрать видео', () => {
    pendingVideo = null;
    videoRemoved = true;
    $('#video-upload').value = '';
    renderPropertyVideo();
  }, 'small-btn danger'));
  row.append(preview, details);
  container.append(row);
}

function edit(property) {
  editing = property.id;
  photos = structuredClone(property.property_photos || []);
  const videoRelation = property.property_videos;
  propertyVideo = structuredClone((Array.isArray(videoRelation) ? videoRelation[0] : videoRelation) || null);
  pendingVideo = null;
  videoRemoved = false;
  const form = $('#editor');
  ['name', 'location', 'sort_order'].forEach(key => {
    form.elements[key].value = property[key] ?? '';
  });
  descriptionLanguages.forEach(language => {
    form.elements[`description_${language}`].value = property.translations?.[language]?.description || (language === 'ru' ? property.description : '') || '';
  });
  form.elements.visible.checked = !property.archived_at;
  $('#upload').value = '';
  photoStatus('');
  $('#video-upload').value = '';
  $('#editor-title').textContent = rows.some(row => row.id === editing) ? 'Редактировать объект' : 'Новый объект';
  renderPhotos();
  renderPropertyVideo();
  form.hidden = false;
  form.scrollIntoView({behavior: 'smooth'});
}

$('#login').onsubmit = async event => {
  event.preventDefault();
  const submit = event.submitter;
  submit.disabled = true;
  try {
    const data = await request('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: {
        email: event.target.elements.email.value,
        password: event.target.elements.password.value
      }
    });
    token = data.access_token;
    event.target.elements.password.value = '';
    await refresh();
    $('#login').hidden = true;
    $('#dashboard').hidden = false;
    status('Вы вошли. Изменения после сохранения появятся во всех версиях сайта.');
  } catch (error) {
    status(error.message, true);
  } finally {
    submit.disabled = false;
  }
};

$('#logout').onclick = async () => {
  try {
    await request('/auth/v1/logout', {method: 'POST'});
  } catch {}
  token = '';
  rows = [];
  photos = [];
  propertyVideo = null;
  pendingVideo = null;
  videoRemoved = false;
  clearVideoPreviewUrl();
  siteAssets = [];
  $('#editor').reset();
  $('#list').replaceChildren();
  $('#site-assets').replaceChildren();
  window.BLAGO_CALENDAR?.reset();
  $('#dashboard').hidden = true;
  $('#editor').hidden = true;
  $('#login').hidden = false;
  status('Вы вышли.');
};

$('#add').onclick = () => {
  const id = crypto.randomUUID();
  edit({
    id,
    slug: `property-${id}`,
    name: '',
    location: 'Эйлат',
    description: '',
    translations: {},
    archived_at: new Date().toISOString(),
    sort_order: rows.length + 1,
    property_photos: [],
    property_videos: []
  });
};

$('#cancel').onclick = () => {
  $('#editor').hidden = true;
  photos = [];
  propertyVideo = null;
  pendingVideo = null;
  videoRemoved = false;
  clearVideoPreviewUrl();
};

$('#upload').onchange = async event => {
  if (!event.target.files.length || busy) return;
  if (!token) {
    photoStatus('Войдите снова, чтобы загрузить фотографии.', true);
    return;
  }
  busy = true;
  const submit = $('#editor button[type=submit]');
  submit.disabled = true;
  event.target.disabled = true;
  photoStatus('Загружаем фотографии…');
  status('Загружаем фотографии…');
  try {
    for (const file of event.target.files) {
      const extension = imageExtension(file);
      if (!['jpg', 'png', 'webp'].includes(extension) || file.size > 5 * 1024 * 1024) {
        throw new Error('Разрешены JPG, PNG и WebP до 5 МБ на фотографию.');
      }
      const path = `properties/${editing}/${crypto.randomUUID()}.${extension}`;
      await uploadFile('property-photos', path, file);
      photos.push({
        storage_path: path,
        public_url: publicStorageUrl('property-photos', path),
        top_offset: null,
        mobile_top_offset: null,
        alt_text: ''
      });
    }
    renderPhotos();
    photoStatus('Фотографии загружены. Нажмите «Сохранить», чтобы привязать их к объекту.');
    status('Фотографии загружены. Нажмите «Сохранить», чтобы привязать их к объекту.');
  } catch (error) {
    photoStatus(error.message, true);
    status(error.message, true);
  } finally {
    busy = false;
    submit.disabled = false;
    event.target.disabled = false;
    event.target.value = '';
  }
};

$('#video-upload').onchange = async event => {
  const file = event.target.files[0];
  if (!file || !token || busy) return;
  busy = true;
  const submit = $('#editor button[type=submit]');
  submit.disabled = true;
  videoRemoved = false;
  status('Подготавливаем видео к сжатию…');
  try {
    pendingVideo = await window.BLAGO_VIDEO.compress(file, progress => {
      status(`Сжимаем видео: ${progress}% — не закрывайте вкладку.`);
    });
    renderPropertyVideo();
    status(`Видео сжато до ${formatMegabytes(pendingVideo.file.size)}. Нажмите «Сохранить», чтобы загрузить его.`);
  } catch (error) {
    pendingVideo = null;
    event.target.value = '';
    renderPropertyVideo();
    status(error.message, true);
  } finally {
    busy = false;
    submit.disabled = false;
  }
};

$('#editor').onsubmit = async event => {
  event.preventDefault();
  if (busy) return;
  const form = event.target;
  const submit = event.submitter;
  submit.disabled = true;
  try {
    if (form.elements.visible.checked && !photos.length) throw new Error('Добавьте хотя бы одну фотографию перед публикацией.');
    const existing = rows.find(row => row.id === editing);
    const descriptions = Object.fromEntries(descriptionLanguages.map(language => [language, form.elements[`description_${language}`].value.trim()]));
    const sourceLanguage = descriptionLanguages.find(language => descriptions[language]);
    if (!sourceLanguage) throw new Error('Заполните описание хотя бы на одном языке.');
    for (const language of descriptionLanguages) {
      if (descriptions[language]) continue;
      status(`Переводим описание: ${sourceLanguage.toUpperCase()} → ${language.toUpperCase()}…`);
      descriptions[language] = await translateDescription(descriptions[sourceLanguage], sourceLanguage, language);
      form.elements[`description_${language}`].value = descriptions[language];
    }
    const translations = structuredClone(existing?.translations || {});
    descriptionLanguages.forEach(language => {
      translations[language] = {...(translations[language] || {}), description: descriptions[language]};
    });
    const property = {
      id: editing,
      slug: existing?.slug || `property-${editing}`,
      name: form.elements.name.value.trim(),
      location: form.elements.location.value.trim(),
      description: descriptions.ru,
      translations,
      sort_order: Number(form.elements.sort_order.value),
      archived_at: form.elements.visible.checked ? null : (existing?.archived_at || new Date().toISOString())
    };
    await request('/rest/v1/properties?on_conflict=id', {
      method: 'POST',
      body: property,
      headers: {Prefer: 'resolution=merge-duplicates'}
    });
    await request(`/rest/v1/property_photos?property_id=eq.${encodeURIComponent(editing)}`, {method: 'DELETE'});
    if (photos.length) {
      await request('/rest/v1/property_photos', {
        method: 'POST',
        body: photos.map((photo, index) => ({
          property_id: editing,
          storage_path: photo.storage_path,
          public_url: photo.public_url,
          display_order: index,
          top_offset: photo.top_offset,
          mobile_top_offset: photo.mobile_top_offset,
          alt_text: photo.alt_text || property.name
        }))
      });
    }
    const oldVideoPath = propertyVideo?.storage_path || '';
    if (pendingVideo) {
      const extension = pendingVideo.file.type === 'video/mp4' ? 'mp4' : 'webm';
      const path = `properties/${editing}/${crypto.randomUUID()}.${extension}`;
      status('Загружаем сжатое видео…');
      await uploadFile('property-videos', path, pendingVideo.file);
      try {
        await request('/rest/v1/property_videos?on_conflict=property_id', {
          method: 'POST',
          body: {
            property_id: editing,
            storage_path: path,
            public_url: publicStorageUrl('property-videos', path),
            mime_type: pendingVideo.file.type,
            size_bytes: pendingVideo.file.size,
            duration_seconds: pendingVideo.durationSeconds,
            updated_at: new Date().toISOString()
          },
          headers: {Prefer: 'resolution=merge-duplicates'}
        });
      } catch (error) {
        await deleteStorageFiles('property-videos', [path]).catch(() => {});
        throw error;
      }
      if (oldVideoPath && oldVideoPath !== path) {
        await deleteStorageFiles('property-videos', [oldVideoPath]).catch(() => {});
      }
    } else if (videoRemoved && propertyVideo) {
      await request(`/rest/v1/property_videos?property_id=eq.${encodeURIComponent(editing)}`, {method: 'DELETE'});
      if (oldVideoPath) await deleteStorageFiles('property-videos', [oldVideoPath]).catch(() => {});
    }
    await refresh();
    form.hidden = true;
    propertyVideo = null;
    pendingVideo = null;
    videoRemoved = false;
    clearVideoPreviewUrl();
    status('Сохранено. Изменения доступны во всех версиях сайта.');
  } catch (error) {
    status(error.message, true);
  } finally {
    submit.disabled = false;
  }
};

if (configured) {
  $('#login').hidden = false;
  status('Вход доступен только администраторам.');
} else {
  $('#setup').hidden = false;
  status('Настройка хранения данных ещё не завершена.');
}

window.BLAGO_ADMIN_API = {request, status};
