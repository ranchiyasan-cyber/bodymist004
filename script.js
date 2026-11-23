/* ==========================================================
   Body Scent — shared script (product.html, order.html, admin.html)
   ========================================================== */

const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbwOEJ1dLNXDPG1kK79OfVsoRfU0kmVQnsox1onGUz2xXh0gypr8RmdzyN71BxQorgQ/exec';

const SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSQGIp8FVukcb0IJFTF8dRvUO642O3WqfoGhmCqgcbI9XdKEiKkY1RjZUA7KMh9yRhXbJr8WslDwder/pub?gid=0&single=true&output=csv';

const MOODS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'sweet', label: 'Sweet' },
  { key: 'confident', label: 'Confident' },
  { key: 'romance', label: 'Romance' }
];

const TYPE_LABEL = { spray: 'น้ำหอมฉีดตัว', rollon: 'โรลออน' };

/* ---------- Helpers ---------- */
function formatPrice(n) {
  return Number(n).toLocaleString('th-TH');
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ==========================================================
   1) product.html
   ========================================================== */
function initProductPage() {
  const filterBar = document.getElementById('filter-bar');
  const list = document.getElementById('product-list');
  if (!filterBar || !list) return;

  let products = [];
  const validMoods = MOODS.map(m => m.key);
  const requested = (new URLSearchParams(window.location.search).get('mood') || '').toLowerCase();
  let activeMood = validMoods.includes(requested) ? requested : 'all';

  function buildCard(p) {
    const card = el('article', 'product-card');
    card.dataset.mood = p.mood;

    const imgWrap = el('div', 'product-card__image');
    const img = document.createElement('img');
    img.src = p.image;
    img.alt = p.name;
    img.loading = 'lazy';
    imgWrap.appendChild(img);

    const body = el('div', 'product-card__body');

    const moodLabel = el('span', 'mood-label product-card__mood');
    moodLabel.appendChild(el('span', 'mood-dot'));
    moodLabel.appendChild(document.createTextNode(p.mood));

    const name = el('h3', 'product-card__name', p.name);
    const meta = el('p', 'product-card__meta', p.size || TYPE_LABEL[p.type] || '');

    const footer = el('div', 'product-card__footer');
    const price = el('span', 'price', formatPrice(p.price));
    price.appendChild(el('small', '', 'บาท'));

    const order = el('a', 'btn btn--small', 'สั่งซื้อ');
    order.href =
      'order.html?item=' + encodeURIComponent(p.name + (p.size ? ' ' + p.size : '')) +
      '&price=' + encodeURIComponent(p.price);

    footer.append(price, order);
    body.append(moodLabel, name, meta, footer);
    card.append(imgWrap, body);
    return card;
  }

  function renderProducts() {
    list.replaceChildren();
    const shown = activeMood === 'all' ? products : products.filter(p => p.mood === activeMood);
    if (!shown.length) {
      list.appendChild(el('p', 'text-mute', 'ไม่พบสินค้า'));
      return;
    }
    shown.forEach(p => list.appendChild(buildCard(p)));
  }

  function renderFilters() {
    filterBar.replaceChildren();
    MOODS.forEach(m => {
      const btn = el('button', 'filter-btn' + (m.key === activeMood ? ' is-active' : ''), m.label);
      btn.type = 'button';
      btn.dataset.mood = m.key;
      btn.addEventListener('click', () => {
        activeMood = m.key;
        filterBar.querySelectorAll('.filter-btn').forEach(b =>
          b.classList.toggle('is-active', b.dataset.mood === activeMood)
        );
        renderProducts();
      });
      filterBar.appendChild(btn);
    });
  }

  renderFilters();

  fetch('products.json')
    .then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(data => {
      products = data;
      renderProducts();
    })
    .catch(error => {
      console.error(error);
      list.replaceChildren(el('p', 'text-mute', 'โหลดข้อมูลสินค้าไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง'));
    });
}

/* ==========================================================
   2) order.html
   ========================================================== */
function initOrderPage() {
  const form = document.getElementById('orderForm');
  if (!form) return;

  // Auto-fill item + total from URL parameters
  const params = new URLSearchParams(window.location.search);
  const itemField = document.getElementById('items');
  const totalField = document.getElementById('total');
  const item = params.get('item');
  const price = params.get('price');
  if (itemField && item !== null) itemField.value = item;
  if (totalField && price !== null) totalField.value = price;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const getValue = id => {
      const node = document.getElementById(id);
      return node ? node.value.trim() : '';
    };

    const payload = {
      customerName: getValue('customerName'),
      contact: getValue('contact'),
      items: getValue('items'),
      total: getValue('total'),
      note: getValue('note')
    };

    const submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      if (submitBtn) submitBtn.disabled = false;
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    });
  });
}

/* ==========================================================
   3) admin.html
   ========================================================== */

// Minimal CSV parser: handles quoted fields, escaped quotes ("") and
// commas / line breaks inside quotes.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter(r => r.some(cell => cell.trim() !== ''));
}

function initAdminPage() {
  const tbody = document.querySelector('#ordersTable tbody');
  if (!tbody) return;

  const COLS = 6; // วันเวลา, ชื่อ, เบอร์/Line, รายการ, ยอดรวม, หมายเหตุ

  function showMessage(msg) {
    tbody.replaceChildren();
    const tr = document.createElement('tr');
    const td = el('td', 'text-center text-mute', msg);
    td.colSpan = COLS;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  showMessage('กำลังโหลดข้อมูล...');

  fetch(SHEET_CSV_URL)
    .then(res => {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(text => {
      const rows = parseCSV(text);
      rows.shift(); // drop header row

      if (!rows.length) {
        showMessage('ยังไม่มีรายการสั่งซื้อ');
        return;
      }

      // Sheet rows are appended in time order → reverse for newest first
      rows.reverse();

      tbody.replaceChildren();
      rows.forEach(r => {
        const tr = document.createElement('tr');
        for (let i = 0; i < COLS; i++) {
          tr.appendChild(el('td', '', r[i] !== undefined ? r[i] : ''));
        }
        tbody.appendChild(tr);
      });
    })
    .catch(error => {
      console.error(error);
      showMessage('โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง');
    });
}

/* ---------- Boot: run only what the current page needs ---------- */
document.addEventListener('DOMContentLoaded', () => {
  initProductPage();
  initOrderPage();
  initAdminPage();
});
