'use strict';


/* ---------- Konfigurasi ---------- */
const API_URL = 'https://api-web.dnccudinus.org/api/mobil';
const STORAGE_KEY = 'Yasha-Autocar:favorit';
const WA_NUMBER = '62895800287546'; 
const FALLBACK_IMG =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'><rect width='800' height='600' fill='#eceef0'/>" +
    "<path d='M220 360l50-120h260l50 120M270 360v40m260-40v40' stroke='#9aa4ac' stroke-width='14' fill='none' stroke-linecap='round' stroke-linejoin='round'/>" +
    "<text x='400' y='480' font-family='sans-serif' font-size='28' text-anchor='middle' fill='#7b858d'>Foto tidak tersedia</text></svg>"
  );

/* ---------- State ---------- */
const state = {
  cars: [],
  filters: {
    query: '',
    brand: 'semua',
    transmisi: 'semua',
    status: 'semua',
    fuel: 'semua',
    sort: 'terbaru',
    favOnly: false
  },
  favorites: loadFavorites()
};

/* ---------- Referensi elemen ---------- */
const $ = (selector, root = document) => root.querySelector(selector);

const dom = {
  grid: $('#car-grid'),
  stateBox: $('#state-box'),
  count: $('#result-count'),
  heroStage: $('#hero-stage'),
  heroQuick: $('#hero-quick'),
  heroForm: $('#hero-search'),
  heroQuery: $('#hero-query'),
  fQuery: $('#f-query'),
  fBrand: $('#f-brand'),
  fTrans: $('#f-trans'),
  fStatus: $('#f-status'),
  fSort: $('#f-sort'),
  fuelChips: $('#fuel-chips'),
  favOnly: $('#fav-only'),
  reset: $('#reset-filter'),
  favTotal: $('#fav-total'),
  favShortcut: $('#fav-shortcut'),
  menuToggle: $('#menu-toggle'),
  nav: $('#main-nav'),
  detail: $('#detail'),
  detailInner: $('#detail-inner'),
  year: $('#year')
};

/* ---------- Helper ---------- */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const rupiah = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
});

function formatHarga(value) {
  return rupiah.format(value).replace(/\s/g, ' ');
}

function formatJuta(value) {
  const juta = value / 1_000_000;
  return 'Rp ' + juta.toLocaleString('id-ID', { maximumFractionDigits: 0 }) + ' juta';
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (error) {
    return new Set();
  }
}

function saveFavorites() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.favorites]));
  } catch (error) {
    /* Penyimpanan tidak tersedia, favorit hanya berlaku selama halaman terbuka. */
  }
}

function uniqueValues(list, key) {
  return [...new Set(list.map((item) => item[key]).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'id')
  );
}

function setImage(img, src, alt) {
  img.alt = alt;
  img.addEventListener('error', () => {
    img.src = FALLBACK_IMG;
  }, { once: true });
  img.src = src || FALLBACK_IMG;
}

/* ---------- Ambil data dari API ---------- */
function normalizeCar(raw) {
  return {
    id: Number(raw.id),
    nama: String(raw.nama ?? 'Tanpa nama'),
    brand: String(raw.brand ?? '-'),
    harga: Number(raw.harga) || 0,
    tahun: Number(raw.tahun) || 0,
    transmisi: String(raw.transmisi ?? '-'),
    bahanBakar: String(raw.bahan_bakar ?? '-'),
    status: String(raw.status ?? '').toLowerCase() === 'tersedia' ? 'tersedia' : 'sold',
    foto: raw.foto || ''
  };
}

async function loadCars() {
  showLoading();
  try {
    const response = await fetch(API_URL, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      throw new Error('Server membalas dengan kode ' + response.status + '.');
    }
    const json = await response.json();
    if (!json || !Array.isArray(json.data)) {
      throw new Error('Format data dari server tidak sesuai.');
    }

    state.cars = json.data.map(normalizeCar);
    setupFilters();
    renderHero();
    renderCatalog();
  } catch (error) {
    showError(error);
  }
}

/* ---------- Loading dan error ---------- */
function showLoading() {
  dom.stateBox.hidden = true;
  dom.grid.replaceChildren();
  dom.grid.setAttribute('aria-busy', 'true');
  dom.count.textContent = 'Memuat data mobil…';

  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 6; i += 1) {
    const sk = el('div', 'card-skeleton skeleton');
    sk.setAttribute('aria-hidden', 'true');
    fragment.append(sk);
  }
  dom.grid.append(fragment);
}

function showError(error) {
  dom.grid.replaceChildren();
  dom.grid.removeAttribute('aria-busy');
  dom.count.textContent = 'Data gagal dimuat';
  dom.heroStage.replaceChildren();

  dom.stateBox.replaceChildren();
  dom.stateBox.append(el('h3', '', 'Data mobil belum bisa dimuat'));
  dom.stateBox.append(
    el('p', '', 'Periksa koneksi internet Anda, lalu coba lagi. ' + (error && error.message ? error.message : ''))
  );
  const retry = el('button', 'btn btn-primary', 'Muat ulang data');
  retry.type = 'button';
  retry.addEventListener('click', loadCars);
  dom.stateBox.append(retry);
  dom.stateBox.hidden = false;
}

/* ---------- Filter ---------- */
function setupFilters() {
  fillSelect(dom.fBrand, uniqueValues(state.cars, 'brand'));
  fillSelect(dom.fTrans, uniqueValues(state.cars, 'transmisi'));

  const fuels = uniqueValues(state.cars, 'bahanBakar');
  dom.fuelChips.replaceChildren(buildChip('Semua bahan bakar', 'semua'));
  fuels.forEach((fuel) => dom.fuelChips.append(buildChip(fuel, fuel)));

  dom.heroQuick.replaceChildren();
  fuels.forEach((fuel) => {
    const chip = el('button', 'chip', fuel);
    chip.type = 'button';
    chip.addEventListener('click', () => {
      state.filters.fuel = fuel;
      syncControls();
      renderCatalog();
      $('#katalog').scrollIntoView();
    });
    dom.heroQuick.append(chip);
  });

  syncControls();
}

function fillSelect(select, values) {
  const first = select.options[0];
  select.replaceChildren(first);
  values.forEach((value) => {
    const option = el('option', '', value);
    option.value = value;
    select.append(option);
  });
}

function buildChip(label, value) {
  const chip = el('button', 'chip', label);
  chip.type = 'button';
  chip.dataset.value = value;
  chip.addEventListener('click', () => {
    state.filters.fuel = value;
    syncControls();
    renderCatalog();
  });
  return chip;
}

function syncControls() {
  const f = state.filters;
  dom.fQuery.value = f.query;
  dom.fBrand.value = f.brand;
  dom.fTrans.value = f.transmisi;
  dom.fStatus.value = f.status;
  dom.fSort.value = f.sort;
  dom.favOnly.setAttribute('aria-pressed', String(f.favOnly));
  dom.fuelChips.querySelectorAll('.chip').forEach((chip) => {
    chip.setAttribute('aria-pressed', String(chip.dataset.value === f.fuel));
  });
}

function getVisibleCars() {
  const f = state.filters;
  const query = f.query.trim().toLowerCase();

  const list = state.cars.filter((car) => {
    if (query && !(car.nama + ' ' + car.brand).toLowerCase().includes(query)) return false;
    if (f.brand !== 'semua' && car.brand !== f.brand) return false;
    if (f.transmisi !== 'semua' && car.transmisi !== f.transmisi) return false;
    if (f.fuel !== 'semua' && car.bahanBakar !== f.fuel) return false;
    if (f.status !== 'semua' && car.status !== f.status) return false;
    if (f.favOnly && !state.favorites.has(car.id)) return false;
    return true;
  });

  const sorters = {
    terbaru: (a, b) => b.id - a.id,
    'harga-asc': (a, b) => a.harga - b.harga,
    'harga-desc': (a, b) => b.harga - a.harga,
    'tahun-desc': (a, b) => b.tahun - a.tahun || b.id - a.id
  };
  return list.sort(sorters[f.sort] || sorters.terbaru);
}

function resetFilters() {
  state.filters = {
    query: '', brand: 'semua', transmisi: 'semua', status: 'semua',
    fuel: 'semua', sort: 'terbaru', favOnly: false
  };
  dom.heroQuery.value = '';
  syncControls();
  renderCatalog();
}

/* ---------- Render: hero ---------- */
function renderHero() {
  const featured =
    state.cars.filter((car) => car.status === 'tersedia').sort((a, b) => b.harga - a.harga)[0] ||
    state.cars[0];
  dom.heroStage.replaceChildren();
  if (!featured) return;

  const wrap = el('div', 'hero-car');
  const img = el('img');
  setImage(img, featured.foto, featured.nama);

  const sticker = el('div', 'price-sticker');
  sticker.append(el('p', 'sticker-brand', featured.brand));
  sticker.append(el('p', 'sticker-name', featured.nama));
  sticker.append(
    el('p', 'sticker-meta', [featured.tahun, featured.transmisi, featured.bahanBakar].join(', '))
  );
  sticker.append(el('p', 'sticker-price', formatJuta(featured.harga)));

  const btn = el('button', 'btn btn-primary btn-small', 'Lihat detail unit');
  btn.type = 'button';
  btn.addEventListener('click', () => openDetail(featured.id));
  sticker.append(btn);

  wrap.append(img, sticker);
  dom.heroStage.append(wrap);
}

/* ---------- Render: katalog ---------- */
function renderCatalog() {
  const cars = getVisibleCars();
  dom.grid.replaceChildren();
  dom.grid.removeAttribute('aria-busy');
  dom.stateBox.hidden = true;

  const total = state.cars.length;
  dom.count.textContent = cars.length + ' dari ' + total + ' unit ditampilkan';
  dom.favTotal.textContent = String(state.favorites.size);

  if (cars.length === 0) {
    dom.stateBox.replaceChildren();
    dom.stateBox.append(el('h3', '', 'Tidak ada mobil yang cocok'));
    dom.stateBox.append(el('p', '', 'Coba ubah kata kunci atau kurangi filter yang aktif.'));
    const clear = el('button', 'btn btn-outline', 'Atur ulang filter');
    clear.type = 'button';
    clear.addEventListener('click', resetFilters);
    dom.stateBox.append(clear);
    dom.stateBox.hidden = false;
    return;
  }

  const fragment = document.createDocumentFragment();
  cars.forEach((car) => fragment.append(buildCard(car)));
  dom.grid.append(fragment);
}

function buildCard(car) {
  const isSold = car.status === 'sold';
  const card = el('article', 'card' + (isSold ? ' is-sold' : ''));

  /* Media */
  const media = el('figure', 'card-media');
  const img = el('img');
  img.loading = 'lazy';
  setImage(img, car.foto, car.brand + ' ' + car.nama);
  media.append(img);

  const badge = el('span', 'badge ' + (isSold ? 'badge-sold' : 'badge-ok'), isSold ? 'Terjual' : 'Tersedia');
  media.append(badge);
  media.append(buildFavButton(car));

  /* Isi */
  const body = el('div', 'card-body');
  body.append(el('p', 'card-brand', car.brand));
  body.append(el('h3', 'card-title', car.nama));

  const specs = el('ul', 'specs');
  [car.tahun, car.transmisi, car.bahanBakar].forEach((text) => specs.append(el('li', '', String(text))));
  body.append(specs);

  const foot = el('div', 'card-foot');
  const price = el('p', 'price', formatJuta(car.harga));
  price.prepend(el('small', '', 'Harga'));

  const detailBtn = el('button', 'btn btn-outline btn-small', 'Lihat detail');
  detailBtn.type = 'button';
  detailBtn.setAttribute('aria-label', 'Lihat detail ' + car.nama);
  detailBtn.addEventListener('click', () => openDetail(car.id));

  foot.append(price, detailBtn);
  body.append(foot);

  card.append(media, body);
  return card;
}

function buildFavButton(car) {
  const btn = el('button', 'fav-btn');
  btn.type = 'button';
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z"/></svg>';
  updateFavButton(btn, car);

  btn.addEventListener('click', () => {
    if (state.favorites.has(car.id)) {
      state.favorites.delete(car.id);
    } else {
      state.favorites.add(car.id);
    }
    saveFavorites();
    dom.favTotal.textContent = String(state.favorites.size);
    if (state.filters.favOnly) {
      renderCatalog();
    } else {
      updateFavButton(btn, car);
    }
  });
  return btn;
}

function updateFavButton(btn, car) {
  const active = state.favorites.has(car.id);
  btn.setAttribute('aria-pressed', String(active));
  btn.setAttribute('aria-label', (active ? 'Hapus dari favorit: ' : 'Simpan ke favorit: ') + car.nama);
}

/* ---------- Detail mobil + simulasi cicilan ---------- */
function openDetail(id) {
  const car = state.cars.find((item) => item.id === id);
  if (!car) return;

  const isSold = car.status === 'sold';
  dom.detailInner.replaceChildren();

  const close = el('button', 'close-btn', '\u00d7');
  close.type = 'button';
  close.setAttribute('aria-label', 'Tutup detail');
  close.addEventListener('click', () => dom.detail.close());

  const photo = el('div', 'detail-photo');
  const img = el('img');
  setImage(img, car.foto, car.brand + ' ' + car.nama);
  photo.append(img);

  const info = el('div', 'detail-info');
  info.append(el('p', 'card-brand', car.brand));
  const title = el('h2', '', car.nama);
  title.id = 'detail-title';
  info.append(title);
  info.append(el('p', 'detail-price', formatHarga(car.harga)));

  info.append(buildSpecTable(car, isSold));
  if (!isSold) info.append(buildCreditBox(car));

  const actions = el('div', 'detail-actions');
  const wa = el('a', 'btn btn-primary', isSold ? 'Unit sudah terjual' : 'Hubungi sales');
  if (isSold) {
    wa.setAttribute('aria-disabled', 'true');
    wa.classList.add('btn-disabled');
    wa.setAttribute('disabled', '');
    wa.removeAttribute('href');
  } else {
    wa.href = 'https://wa.me/' + WA_NUMBER + '?text=' +
      encodeURIComponent('Halo Lintas Motor, saya tertarik dengan ' + car.nama + ' (' + car.tahun + ').');
    wa.target = '_blank';
    wa.rel = 'noopener noreferrer';
  }
  const closeAlt = el('button', 'btn btn-outline', 'Kembali ke katalog');
  closeAlt.type = 'button';
  closeAlt.addEventListener('click', () => dom.detail.close());
  actions.append(wa, closeAlt);
  info.append(actions);

  dom.detailInner.append(close, photo, info);
  dom.detail.showModal();
}

function buildSpecTable(car, isSold) {
  const table = el('table', 'spec-table');
  const rows = [
    ['Tahun', String(car.tahun)],
    ['Transmisi', car.transmisi],
    ['Bahan bakar', car.bahanBakar],
    ['Ketersediaan', isSold ? 'Terjual' : 'Tersedia']
  ];
  const tbody = el('tbody');
  rows.forEach(([label, value]) => {
    const tr = el('tr');
    tr.append(el('th', '', label), el('td', '', value));
    tr.firstChild.scope = 'row';
    tbody.append(tr);
  });
  table.append(tbody);
  return table;
}

function buildCreditBox(car) {
  const RATE = 0.05; // bunga flat 5% per tahun (estimasi)
  const box = el('div', 'credit');
  box.append(el('h3', '', 'Simulasi cicilan'));

  const row = el('div', 'credit-row');

  const dpWrap = el('div');
  const dpLabel = el('label', '', 'Uang muka: 30%');
  dpLabel.htmlFor = 'dp-range';
  const dp = el('input');
  dp.type = 'range';
  dp.id = 'dp-range';
  dp.min = '10';
  dp.max = '60';
  dp.step = '5';
  dp.value = '30';
  dpWrap.append(dpLabel, dp);

  const tenorWrap = el('div');
  const tenorLabel = el('label', '', 'Tenor');
  tenorLabel.htmlFor = 'tenor-select';
  const tenor = el('select');
  tenor.id = 'tenor-select';
  [1, 2, 3, 4, 5].forEach((year) => {
    const option = el('option', '', year + ' tahun');
    option.value = String(year);
    if (year === 3) option.selected = true;
    tenor.append(option);
  });
  tenorWrap.append(tenorLabel, tenor);
  row.append(dpWrap, tenorWrap);

  const result = el('div', 'credit-result');
  const monthly = el('strong');
  const note = el('small');
  result.append(el('span', '', 'Estimasi angsuran per bulan'), monthly, note);
  result.setAttribute('aria-live', 'polite');

  function update() {
    const dpPercent = Number(dp.value);
    const years = Number(tenor.value);
    const dpValue = car.harga * (dpPercent / 100);
    const principal = car.harga - dpValue;
    const monthlyPayment = (principal + principal * RATE * years) / (years * 12);

    dpLabel.textContent = 'Uang muka: ' + dpPercent + '%';
    monthly.textContent = formatHarga(Math.round(monthlyPayment));
    note.textContent =
      'Uang muka ' + formatHarga(dpValue) + ', bunga flat 5% per tahun. ' +
      'Angka ini hanya estimasi, bukan penawaran resmi.';
  }
  dp.addEventListener('input', update);
  tenor.addEventListener('change', update);
  update();

  box.append(row, result);
  return box;
}

/* ---------- Event listener ---------- */
function bindEvents() {
  dom.fQuery.addEventListener('input', () => {
    state.filters.query = dom.fQuery.value;
    renderCatalog();
  });
  dom.fBrand.addEventListener('change', () => { state.filters.brand = dom.fBrand.value; renderCatalog(); });
  dom.fTrans.addEventListener('change', () => { state.filters.transmisi = dom.fTrans.value; renderCatalog(); });
  dom.fStatus.addEventListener('change', () => { state.filters.status = dom.fStatus.value; renderCatalog(); });
  dom.fSort.addEventListener('change', () => { state.filters.sort = dom.fSort.value; renderCatalog(); });

  dom.favOnly.addEventListener('click', () => {
    state.filters.favOnly = !state.filters.favOnly;
    syncControls();
    renderCatalog();
  });
  dom.reset.addEventListener('click', resetFilters);

  dom.favShortcut.addEventListener('click', () => {
    state.filters.favOnly = true;
    syncControls();
    renderCatalog();
    $('#katalog').scrollIntoView();
  });

  dom.heroForm.addEventListener('submit', (event) => {
    event.preventDefault();
    state.filters.query = dom.heroQuery.value;
    syncControls();
    renderCatalog();
    $('#katalog').scrollIntoView();
  });

  /* Menu mobile */
  dom.menuToggle.addEventListener('click', () => {
    const open = dom.nav.classList.toggle('open');
    dom.menuToggle.setAttribute('aria-expanded', String(open));
    dom.menuToggle.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
  });
  dom.nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) {
      dom.nav.classList.remove('open');
      dom.menuToggle.setAttribute('aria-expanded', 'false');
    }
  });

  /* Tutup dialog saat klik area gelap di luar konten */
  dom.detail.addEventListener('click', (event) => {
    if (event.target === dom.detail) dom.detail.close();
  });
}

/* ---------- Mulai ---------- */
dom.year.textContent = String(new Date().getFullYear());
bindEvents();
loadCars();