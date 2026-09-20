'use strict';

window.BLAGO_CALENDAR = (() => {
  const api = window.BLAGO_ADMIN_API;
  const colors = ['#0872ce', '#008a78', '#c56b12', '#8b5bb6', '#c03d67', '#547226', '#915443', '#266f91'];
  let properties = [];
  let selected = new Set();
  let month = new Date();
  let bookings = [];
  let prices = [];

  month = new Date(month.getFullYear(), month.getMonth(), 1);

  const $ = selector => document.querySelector(selector);
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };

  function isoDate(date) {
    const year = date.getFullYear();
    const monthValue = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${monthValue}-${day}`;
  }

  function parseDate(value) {
    const [year, monthValue, day] = value.split('-').map(Number);
    return new Date(year, monthValue - 1, day);
  }

  function addDays(date, count) {
    const result = new Date(date);
    result.setDate(result.getDate() + count);
    return result;
  }

  function propertyName(id) {
    return properties.find(property => property.id === id)?.name || 'Объект';
  }

  function colorFor(id) {
    const index = Math.max(0, properties.findIndex(property => property.id === id));
    return colors[index % colors.length];
  }

  function monthRange() {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    return {start: isoDate(start), end: isoDate(end), last: isoDate(addDays(end, -1))};
  }

  function fillPropertySelect(select) {
    const current = select.value;
    select.replaceChildren();
    properties.forEach(property => {
      const option = element('option', property.name + (property.archived_at ? ' — архив' : ''));
      option.value = property.id;
      select.append(option);
    });
    if ([...select.options].some(option => option.value === current)) select.value = current;
  }

  function renderFilters() {
    const filters = $('#calendar-property-filters');
    filters.replaceChildren();
    properties.forEach(property => {
      const label = element('label', undefined, 'calendar-filter');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = selected.has(property.id);
      checkbox.onchange = () => {
        checkbox.checked ? selected.add(property.id) : selected.delete(property.id);
        load();
      };
      const dot = element('span', undefined, 'calendar-dot');
      dot.style.background = colorFor(property.id);
      label.append(checkbox, dot, document.createTextNode(property.name));
      if (property.archived_at) label.append(element('small', 'архив', 'muted'));
      filters.append(label);
    });
    fillPropertySelect($('#booking-property'));
    fillPropertySelect($('#price-property'));
  }

  function renderLegend() {
    const legend = $('#calendar-legend');
    legend.replaceChildren();
    properties.filter(property => selected.has(property.id)).forEach(property => {
      const item = element('span', undefined, 'calendar-legend-item');
      const dot = element('span', undefined, 'calendar-dot');
      dot.style.background = colorFor(property.id);
      item.append(dot, document.createTextNode(property.name));
      legend.append(item);
    });
  }

  function bookingEvents(dateValue) {
    const result = [];
    bookings.forEach(booking => {
      if (!selected.has(booking.property_id)) return;
      if (booking.check_in === dateValue) result.push({booking, kind: 'arrival', label: `↘ ${propertyName(booking.property_id)}`});
      if (booking.check_in < dateValue && booking.check_out > dateValue) result.push({booking, kind: 'stay', label: `■ ${propertyName(booking.property_id)}`});
      if (booking.check_out === dateValue) result.push({booking, kind: 'departure', label: `↗ ${propertyName(booking.property_id)}`});
    });
    return result;
  }

  function priceEvents(dateValue) {
    return prices
      .filter(price => selected.has(price.property_id) && price.price_date === dateValue)
      .map(price => ({...price, name: propertyName(price.property_id)}));
  }

  function renderCalendar() {
    const localeTitle = new Intl.DateTimeFormat('ru-RU', {month: 'long', year: 'numeric'}).format(month);
    $('#calendar-month-title').textContent = localeTitle.charAt(0).toUpperCase() + localeTitle.slice(1);
    renderLegend();

    const grid = $('#calendar-grid');
    grid.replaceChildren();
    ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach(day => grid.append(element('div', day, 'calendar-weekday')));
    const firstWeekday = (month.getDay() + 6) % 7;
    for (let index = 0; index < firstWeekday; index += 1) grid.append(element('div', undefined, 'calendar-day empty'));

    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const today = isoDate(new Date());
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      const dateValue = isoDate(date);
      const cell = element('div', undefined, 'calendar-day');
      if (dateValue === today) cell.classList.add('today');
      cell.append(element('strong', String(day), 'calendar-date-number'));

      bookingEvents(dateValue).forEach(event => {
        const chip = element('button', event.label, `calendar-event ${event.kind}`);
        chip.type = 'button';
        chip.style.setProperty('--event-color', colorFor(event.booking.property_id));
        chip.title = `${event.booking.booking_name}: ${event.booking.check_in} — ${event.booking.check_out}`;
        chip.onclick = () => {
          $('#booking-property').value = event.booking.property_id;
          $('#booking-name').value = event.booking.booking_name;
          $('#booking-check-in').value = event.booking.check_in;
          $('#booking-check-out').value = event.booking.check_out;
          $('#booking-form').scrollIntoView({behavior: 'smooth', block: 'center'});
        };
        cell.append(chip);
      });

      priceEvents(dateValue).forEach(price => {
        const priceNode = element('div', `${price.name}: ₪${Number(price.price_ils).toLocaleString('ru-RU')}`, 'calendar-price');
        priceNode.style.setProperty('--event-color', colorFor(price.property_id));
        cell.append(priceNode);
      });
      grid.append(cell);
    }
    renderBookingList();
  }

  function renderBookingList() {
    const list = $('#calendar-booking-list');
    list.replaceChildren();
    const visible = bookings.filter(booking => selected.has(booking.property_id));
    if (!visible.length) {
      list.append(element('p', 'В выбранном месяце бронирований нет.', 'muted'));
      return;
    }
    visible.forEach(booking => {
      const row = element('div', undefined, 'calendar-booking-row');
      const text = element('div');
      text.append(
        element('strong', booking.booking_name),
        element('div', `${propertyName(booking.property_id)} · ${booking.check_in} → ${booking.check_out}`, 'muted')
      );
      const remove = element('button', 'Удалить', 'small-btn danger');
      remove.type = 'button';
      remove.onclick = async () => {
        if (!confirm(`Удалить бронирование «${booking.booking_name}»?`)) return;
        try {
          await api.request(`/rest/v1/bookings?id=eq.${encodeURIComponent(booking.id)}`, {method: 'DELETE'});
          api.status('Бронирование удалено.');
          await load();
        } catch (error) {
          api.status(error.message, true);
        }
      };
      row.append(text, remove);
      list.append(row);
    });
  }

  async function load() {
    if (!properties.length || !selected.size) {
      bookings = [];
      prices = [];
      renderCalendar();
      return;
    }
    const range = monthRange();
    const ids = [...selected].join(',');
    try {
      [bookings, prices] = await Promise.all([
        api.request(`/rest/v1/bookings?select=*&property_id=in.(${ids})&check_in=lt.${range.end}&check_out=gt.${range.start}&order=check_in.asc`),
        api.request(`/rest/v1/daily_prices?select=*&property_id=in.(${ids})&price_date=gte.${range.start}&price_date=lte.${range.last}&order=price_date.asc`)
      ]);
      renderCalendar();
    } catch (error) {
      api.status(error.message, true);
    }
  }

  async function saveBooking(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = {
      property_id: form.elements.property_id.value,
      booking_name: form.elements.booking_name.value.trim(),
      check_in: form.elements.check_in.value,
      check_out: form.elements.check_out.value,
      updated_at: new Date().toISOString()
    };
    if (!data.property_id || !data.booking_name || !data.check_in || !data.check_out) return;
    if (data.check_out <= data.check_in) {
      api.status('Дата выезда должна быть позже даты заезда.', true);
      return;
    }
    try {
      await api.request('/rest/v1/bookings', {method: 'POST', body: data});
      form.elements.booking_name.value = '';
      api.status('Бронирование добавлено.');
      selected.add(data.property_id);
      renderFilters();
      await load();
    } catch (error) {
      if (error.code === '23P01') api.status('Эти даты пересекаются с другим бронированием выбранной квартиры.', true);
      else api.status(error.message, true);
    }
  }

  function datesBetween(startValue, endValue) {
    const start = parseDate(startValue);
    const end = parseDate(endValue);
    const result = [];
    for (let date = start; date <= end; date = addDays(date, 1)) {
      result.push(isoDate(date));
      if (result.length > 366) throw new Error('Цена может быть назначена максимум на один год за один раз.');
    }
    return result;
  }

  async function savePrices(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const propertyId = form.elements.property_id.value;
    const start = form.elements.date_from.value;
    const end = form.elements.date_to.value;
    const price = Number(form.elements.price_ils.value);
    if (!propertyId || !start || !end || !Number.isFinite(price) || price < 0) return;
    if (end < start) {
      api.status('Конечная дата цены должна быть не раньше начальной.', true);
      return;
    }
    try {
      const rows = datesBetween(start, end).map(priceDate => ({
        property_id: propertyId,
        price_date: priceDate,
        price_ils: price,
        updated_at: new Date().toISOString()
      }));
      await api.request('/rest/v1/daily_prices?on_conflict=property_id,price_date', {
        method: 'POST',
        body: rows,
        headers: {Prefer: 'resolution=merge-duplicates'}
      });
      selected.add(propertyId);
      renderFilters();
      api.status(`Цена ₪${price.toLocaleString('ru-RU')} сохранена для выбранного диапазона.`);
      await load();
    } catch (error) {
      api.status(error.message, true);
    }
  }

  async function clearPrices() {
    const form = $('#price-form');
    const propertyId = form.elements.property_id.value;
    const start = form.elements.date_from.value;
    const end = form.elements.date_to.value;
    if (!propertyId || !start || !end) {
      api.status('Выберите квартиру и диапазон дат для удаления цен.', true);
      return;
    }
    if (end < start) {
      api.status('Конечная дата должна быть не раньше начальной.', true);
      return;
    }
    try {
      await api.request(`/rest/v1/daily_prices?property_id=eq.${encodeURIComponent(propertyId)}&price_date=gte.${start}&price_date=lte.${end}`, {method: 'DELETE'});
      api.status('Индивидуальные цены удалены для выбранного диапазона.');
      await load();
    } catch (error) {
      api.status(error.message, true);
    }
  }

  function setProperties(nextProperties) {
    properties = nextProperties;
    const validIds = new Set(properties.map(property => property.id));
    selected = new Set([...selected].filter(id => validIds.has(id)));
    if (!selected.size) properties.filter(property => !property.archived_at).forEach(property => selected.add(property.id));
    renderFilters();
    load();
  }

  function selectOnly(propertyId) {
    selected = new Set([propertyId]);
    renderFilters();
    load();
    $('#calendar-panel').scrollIntoView({behavior: 'smooth'});
  }

  function reset() {
    properties = [];
    selected.clear();
    bookings = [];
    prices = [];
    renderFilters();
    renderCalendar();
  }

  $('#calendar-prev').onclick = () => {
    month = new Date(month.getFullYear(), month.getMonth() - 1, 1);
    load();
  };
  $('#calendar-next').onclick = () => {
    month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    load();
  };
  $('#calendar-today').onclick = () => {
    const today = new Date();
    month = new Date(today.getFullYear(), today.getMonth(), 1);
    load();
  };
  $('#calendar-select-all').onclick = () => {
    selected = new Set(properties.map(property => property.id));
    renderFilters();
    load();
  };
  $('#calendar-select-none').onclick = () => {
    selected.clear();
    renderFilters();
    load();
  };
  $('#booking-form').onsubmit = saveBooking;
  $('#price-form').onsubmit = savePrices;
  $('#price-clear').onclick = clearPrices;

  renderCalendar();
  return {setProperties, selectOnly, reset, reload: load};
})();
