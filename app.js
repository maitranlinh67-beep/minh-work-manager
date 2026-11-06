const KEY = 'minh-work-manager-v1-data';
const shipStages = [
  'Chờ người bán gửi',
  'Đang vận chuyển nội địa TQ',
  'Đã đến kho Trung Quốc',
  'Đã nhập kho Trung Quốc',
  'Đang về Việt Nam',
  'Đã về kho Việt Nam',
  'Đã giao khách'
];
const buyStages = [
  'Chờ xác nhận',
  'Chờ báo giá',
  'Chờ thanh toán',
  'Đã thanh toán',
  'Đang đặt hàng',
  'Đặt hàng thành công',
  'Đã hủy'
];

let db = loadDB();
let view = 'overview';
let query = '';
let todoFilter = 'all';
let toastTimer = null;
window.statusFilter = '';

function loadDB() {
  try {
    const saved = localStorage.getItem(KEY) || localStorage.getItem('linh-logistics-v1-data');
    if (saved) {
      const d = JSON.parse(saved);
      return {
        shipments: d.shipments || [],
        purchases: d.purchases || [],
        transactions: d.transactions || []
      };
    }
    const old = localStorage.getItem('linh-logistics-orders-v1');
    if (old) {
      const arr = JSON.parse(old);
      return { shipments: arr, purchases: [], transactions: [] };
    }
  } catch {}
  return {
    shipments: [
      { id: 's1', customer: 'Minh Anh', phone: '0912 345 678', code: 'DR0001', address: '', platform: 'Taobao', waybill: 'SF1439827610', product: 'Áo khoác dạ nữ', qty: 2, value: 168, status: shipStages[1], date: '2026-11-05', note: '' },
      { id: 's2', customer: 'Hoàng Nam', phone: '0988 221 540', code: 'DR0002', address: '', platform: '1688', waybill: 'YT6720193845', product: 'Đèn bàn gỗ', qty: 1, value: 92, status: shipStages[3], date: '2026-11-04', note: 'Đóng gói chống sốc' },
      { id: 's3', customer: 'Thu Hà', phone: '0903 110 247', code: 'DR0003', address: '', platform: 'Pinduoduo', waybill: 'ZTO5567328190', product: 'Bộ cốc sứ (6 món)', qty: 1, value: 74, status: shipStages[5], date: '2026-11-02', note: '' }
    ],
    purchases: [
      { id: 'p1', customer: 'Quốc Bảo', phone: '0977 803 626', code: 'DR0004', address: '', platform: 'Poizon', url: 'https://www.poizon.com', product: 'Giày thể thao', variant: 'Màu trắng · Size 42', qty: 1, value: 510, quote: 0, status: buyStages[1], date: '2026-11-05', note: 'Khách cần nhận trước 15/11' },
      { id: 'p2', customer: 'Ngọc Linh', phone: '0934 678 221', code: 'DR0005', address: '', platform: 'Taobao', url: 'https://www.taobao.com', product: 'Túi đeo chéo', variant: 'Màu nâu', qty: 1, value: 138, quote: 165, status: buyStages[2], date: '2026-11-06', note: '' }
    ],
    transactions: [
      { id: 't1', type: 'Thu', amount: 1200000, category: 'Phí dịch vụ', party: 'Minh Anh', related: 'DR0001 · Áo khoác', method: 'Chuyển khoản', date: '2026-11-05', note: '' },
      { id: 't2', type: 'Chi', amount: 700000, category: 'Cước vận chuyển', party: 'Nhà vận chuyển', related: 'DR0001 · Áo khoác', method: 'Tiền mặt', date: '2026-11-05', note: '' }
    ]
  };
}

function persist() {
  localStorage.setItem(KEY, JSON.stringify(db));
}

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function money(n) {
  return Number(n || 0).toLocaleString('vi-VN');
}

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateText(d) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
}

function avatar(name = '') {
  return name.trim().split(/\s+/).map(x => x[0] || '').slice(-2).join('').toUpperCase() || 'KH';
}

function statusClass(s) {
  if (['Đã về kho Việt Nam', 'Đã giao khách', 'Đặt hàng thành công', 'Đã thanh toán'].includes(s)) return 's-green';
  if (['Chờ người bán gửi', 'Chờ xác nhận', 'Chờ báo giá', 'Chờ thanh toán'].includes(s)) return 's-amber';
  if (s === 'Đã hủy') return 's-red';
  return 's-blue';
}

function statusTag(s) {
  return `<span class="status ${statusClass(s)}">${esc(s)}</span>`;
}

function statusSelect(kind, id, current, stages) {
  return `<select class="status-select ${statusClass(current)}" aria-label="Đổi trạng thái" onchange="quickStatus('${kind}','${id}',this.value)">${stages.map(s => `<option value="${esc(s)}" ${s === current ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>`;
}

function quickStatus(kind, id, newStatus) {
  const list = kind === 'shipment' ? db.shipments : db.purchases;
  const item = list.find(x => x.id === id);
  if (!item) return;
  item.status = newStatus;
  persist();
  render();
  toast(`Đã đổi trạng thái: ${newStatus}`);
}

function uniqueCustomers() {
  const map = new Map();
  [...db.shipments, ...db.purchases].forEach(o => {
    const k = (o.code || o.phone || o.customer || '').trim().toLowerCase();
    if (!k) return;
    if (!map.has(k)) {
      map.set(k, { ...o });
    } else {
      const x = map.get(k);
      if (!x.address && o.address) x.address = o.address;
      if (!x.phone && o.phone) x.phone = o.phone;
      if (!x.code && o.code) x.code = o.code;
    }
  });
  return [...map.values()];
}

function setView(v, el) {
  view = v;
  query = '';
  window.statusFilter = '';
  document.querySelectorAll('.nav').forEach(n => {
    n.classList.toggle('active', n.dataset.view === v);
  });
  if (el) el.classList.add('active');
  render();
}

function setFilter(val) {
  window.statusFilter = val;
  render();
}

function clearFilters() {
  query = '';
  window.statusFilter = '';
  render();
}

function handleSearch(inputEl) {
  query = inputEl.value;
  document.getElementById('searchClearBtn')?.classList.toggle('hidden', !query);
  document.getElementById('resetFilterBtn')?.classList.toggle('hidden', !(query || window.statusFilter));
  updateTableResults();
}

function clearSearchInput() {
  query = '';
  const input = document.getElementById('searchInput');
  if (input) {
    input.value = '';
    input.focus();
  }
  document.getElementById('searchClearBtn')?.classList.add('hidden');
  document.getElementById('resetFilterBtn')?.classList.toggle('hidden', !window.statusFilter);
  updateTableResults();
}

function updateTableResults() {
  const area = document.getElementById('tableArea');
  const countEl = document.getElementById('resultCount');
  if (!area) {
    render();
    return;
  }
  if (view === 'shipments') {
    const data = getShipmentsViewData();
    area.innerHTML = data.tableHtml;
    if (countEl) countEl.textContent = `${data.filteredCount} / ${data.totalCount} mục`;
  } else if (view === 'purchases') {
    const data = getPurchasesViewData();
    area.innerHTML = data.tableHtml;
    if (countEl) countEl.textContent = `${data.filteredCount} / ${data.totalCount} mục`;
  } else if (view === 'finance') {
    const data = getFinanceViewData();
    area.innerHTML = data.tableHtml;
    if (countEl) countEl.textContent = `${data.filteredCount} / ${data.totalCount} giao dịch`;
  } else if (view === 'customers') {
    const data = getCustomersViewData();
    area.innerHTML = data.tableHtml;
    if (countEl) countEl.textContent = `${data.filteredCount} / ${data.totalCount} khách`;
  }
}

function monthTotals() {
  const m = dateKey().slice(0, 7);
  const items = db.transactions.filter(x => (x.date || '').startsWith(m));
  return {
    income: items.filter(x => x.type === 'Thu').reduce((a, x) => a + Number(x.amount || 0), 0),
    expense: items.filter(x => x.type === 'Chi').reduce((a, x) => a + Number(x.amount || 0), 0)
  };
}

function getPendingItems() {
  const pendingBuy = db.purchases
    .filter(o => !['Đặt hàng thành công', 'Đã hủy'].includes(o.status))
    .map(o => ({ ...o, kind: 'purchase', kindLabel: 'Mua hộ', urgent: ['Chờ xác nhận', 'Chờ báo giá', 'Chờ thanh toán', 'Đã thanh toán'].includes(o.status) }));
  const pendingShip = db.shipments
    .filter(o => o.status !== 'Đã giao khách')
    .map(o => ({ ...o, kind: 'shipment', kindLabel: 'Vận đơn', urgent: o.status === 'Đã về kho Việt Nam' || o.status === 'Chờ người bán gửi' }));
  return [...pendingBuy, ...pendingShip].sort((a, b) => (Number(b.urgent) - Number(a.urgent)) || (b.date || '').localeCompare(a.date || ''));
}

function render() {
  const customerCount = uniqueCustomers().length;
  const activeShips = db.shipments.filter(o => o.status !== 'Đã giao khách').length;
  const readyVN = db.shipments.filter(o => o.status === 'Đã về kho Việt Nam').length;
  const activeBuys = db.purchases.filter(o => !['Đặt hàng thành công', 'Đã hủy'].includes(o.status)).length;
  const pendingTotal = activeShips + activeBuys;
  const totals = monthTotals();
  const balance = totals.income - totals.expense;

  document.getElementById('shipCount').textContent = db.shipments.length;
  document.getElementById('buyCount').textContent = db.purchases.length;
  document.getElementById('custCount').textContent = customerCount;
  document.getElementById('financeCount').textContent = db.transactions.length;

  const todoBadge = document.getElementById('todoCount');
  if (todoBadge) {
    todoBadge.textContent = pendingTotal;
    todoBadge.classList.toggle('hidden', pendingTotal === 0);
  }

  const titles = {
    overview: ['Tổng quan công việc', 'Ưu tiên xử lý việc tồn đọng, xem số liệu chính và cập nhật đơn nhanh.'],
    shipments: ['Đơn ký gửi', 'Theo dõi mã vận đơn, cập nhật trạng thái kho và giao hàng cho khách.'],
    purchases: ['Yêu cầu mua hộ', 'Báo giá, xác nhận thanh toán, đặt hàng và chuyển sang vận đơn.'],
    customers: ['Khách hàng', 'Danh sách khách tổng hợp tự động từ vận đơn và yêu cầu mua hộ.'],
    finance: ['Sổ thu chi', 'Ghi chép các khoản thu, chi phí vận hành và theo dõi số dư.']
  };
  document.getElementById('pageTitle').textContent = titles[view][0];
  document.getElementById('pageDesc').textContent = titles[view][1];

  const actionsEl = document.getElementById('pageActions');
  if (view === 'overview') {
    actionsEl.innerHTML = `
      <button type="button" class="btn" onclick="openNew('purchase')">＋ Mua hộ</button>
      <button type="button" class="btn" onclick="openNew('finance')">＋ Thu / chi</button>
      <button id="addBtn" type="button" class="btn primary" onclick="openNew('shipment')">＋ Thêm vận đơn</button>
    `;
  } else if (view === 'customers') {
    actionsEl.innerHTML = `
      <button type="button" class="btn" onclick="openNew('purchase')">＋ Thêm mua hộ</button>
      <button id="addBtn" type="button" class="btn primary" onclick="openNew('shipment')">＋ Thêm vận đơn</button>
    `;
  } else {
    const label = view === 'purchases' ? '＋ Thêm yêu cầu mua hộ' : view === 'finance' ? '＋ Ghi khoản thu / chi' : '＋ Thêm vận đơn';
    const kind = view === 'purchases' ? 'purchase' : view === 'finance' ? 'finance' : 'shipment';
    actionsEl.innerHTML = `<button id="addBtn" type="button" class="btn primary" onclick="openNew('${kind}')">${label}</button>`;
  }

  // Tier 1: Priority Action Zone (Việc cần xử lý)
  document.getElementById('priorityZone').innerHTML = renderPriorityZone();

  // Tier 2: Key Metrics (Số liệu chính)
  document.getElementById('metrics').innerHTML =
    metric('Việc cần xử lý', pendingTotal, `${activeShips} vận đơn · ${activeBuys} mua hộ chưa xong`, '⚡', "setView('overview',document.querySelector('[data-view=overview]'))") +
    metric('Đơn ký gửi', db.shipments.length, readyVN ? `${readyVN} đơn đã về kho VN chờ giao` : 'Tất cả đơn ký gửi đã khai báo', '📦', "setView('shipments',document.querySelector('[data-view=shipments]'))") +
    metric('Yêu cầu mua hộ', db.purchases.length, activeBuys ? `${activeBuys} yêu cầu đang xử lý` : 'Đã xử lý xong các yêu cầu', '🛍', "setView('purchases',document.querySelector('[data-view=purchases]'))") +
    metric('Số dư tháng này', (balance >= 0 ? '+' : '') + money(balance) + ' ₫', `Thu ${money(totals.income)} ₫ · Chi ${money(totals.expense)} ₫`, '₫', "setView('finance',document.querySelector('[data-view=finance]'))");

  // Tier 3: Detailed Content & Compact Charts
  document.getElementById('content').innerHTML =
    view === 'overview' ? overview() :
    view === 'shipments' ? shipmentsPage() :
    view === 'purchases' ? purchasesPage() :
    view === 'finance' ? financePage() :
    customersPage();
}

function metric(label, val, foot, icon, onClick = '') {
  return `<div class="metric ${onClick ? 'clickable' : ''}" ${onClick ? `onclick="${onClick}"` : ''}>
    <div class="metric-top"><span>${label}</span><span class="metric-icon">${icon}</span></div>
    <div class="metric-value">${val}</div>
    <div class="metric-foot">${foot}</div>
  </div>`;
}

function renderPriorityZone() {
  if (view === 'overview') {
    const allPending = getPendingItems();
    const filtered = allPending.filter(x =>
      todoFilter === 'all' ? true :
      todoFilter === 'buy' ? x.kind === 'purchase' :
      todoFilter === 'ship' ? x.kind === 'shipment' : true
    );
    const buyPendingCount = allPending.filter(x => x.kind === 'purchase').length;
    const shipPendingCount = allPending.filter(x => x.kind === 'shipment').length;

    return `<div class="priority-panel ${allPending.length ? 'has-urgent' : ''}">
      <div class="priority-head">
        <div class="priority-title-wrap">
          <span class="priority-title">1. Việc cần xử lý ngay</span>
          <span class="priority-badge ${allPending.length ? '' : 'done'}">${allPending.length ? `${allPending.length} việc đang chờ` : 'Đã hoàn tất'}</span>
        </div>
        <div class="stage-strip" style="padding:0">
          <button type="button" class="chip ${todoFilter === 'all' ? 'active' : ''}" onclick="todoFilter='all';render()">Tất cả <span class="chip-count">${allPending.length}</span></button>
          <button type="button" class="chip ${todoFilter === 'buy' ? 'active' : ''}" onclick="todoFilter='buy';render()">Mua hộ <span class="chip-count">${buyPendingCount}</span></button>
          <button type="button" class="chip ${todoFilter === 'ship' ? 'active' : ''}" onclick="todoFilter='ship';render()">Vận đơn <span class="chip-count">${shipPendingCount}</span></button>
        </div>
      </div>
      ${filtered.length ? `<div class="priority-list">
        ${filtered.slice(0, 6).map(item => {
          const isShip = item.kind === 'shipment';
          const detail = isShip
            ? `Mã VĐ: ${esc(item.waybill)} · ${esc(item.platform)} · SL ${esc(item.qty)}`
            : `${esc(item.variant || item.platform)} · Giá: ¥${money(item.value)}${item.quote ? ` · Báo khách: ¥${money(item.quote)}` : ' · Chưa báo giá'}`;
          return `<div class="priority-item">
            <div class="priority-main">
              <span class="kind-pill ${isShip ? 'kind-ship' : 'kind-buy'}">${item.kindLabel}</span>
              <div class="priority-info">
                <div class="priority-name">
                  <span>${esc(item.product)}</span>
                  <span class="code">${esc(item.customer)} · ${esc(item.code || '—')}</span>
                </div>
                <div class="priority-meta">${detail}${item.note ? ' · Ghi chú: ' + esc(item.note) : ''}</div>
              </div>
            </div>
            <div class="priority-controls">
              ${statusSelect(item.kind, item.id, item.status, isShip ? shipStages : buyStages)}
              ${isShip
                ? `<a class="iconbtn" target="_blank" rel="noopener" href="https://www.17track.net/en#nums=${encodeURIComponent(item.waybill)}">Tra cứu ↗</a>`
                : `${item.url ? `<a class="iconbtn" target="_blank" rel="noopener" href="${safeUrl(item.url)}">Mở link ↗</a>` : ''}`
              }
              <button type="button" class="iconbtn" onclick="editRecord('${item.kind}','${item.id}')">Sửa</button>
            </div>
          </div>`;
        }).join('')}
      </div>` : `<div class="priority-done">
        <span>Không có việc tồn đọng trong mục này. Mọi đơn hàng đều đã hoàn tất hoặc cập nhật xong.</span>
        <button type="button" class="btn small" onclick="openNew('shipment')">＋ Thêm đơn mới</button>
      </div>`}
    </div>`;
  }

  if (view === 'shipments') {
    const counts = stageCounts(db.shipments, shipStages);
    const activeCount = db.shipments.filter(o => o.status !== 'Đã giao khách').length;
    return `<div class="stage-strip" aria-label="Lọc nhanh trạng thái vận đơn">
      <button type="button" class="chip ${window.statusFilter === '' ? 'active' : ''}" onclick="setFilter('')">Tất cả <span class="chip-count">${db.shipments.length}</span></button>
      <button type="button" class="chip ${window.statusFilter === '__active' ? 'active' : ''}" onclick="setFilter('__active')">Cần theo dõi <span class="chip-count">${activeCount}</span></button>
      ${counts.map(c => `<button type="button" class="chip ${window.statusFilter === c.label ? 'active' : ''}" onclick="setFilter('${esc(c.label)}')">${esc(c.label)} <span class="chip-count">${c.value}</span></button>`).join('')}
    </div>`;
  }

  if (view === 'purchases') {
    const counts = stageCounts(db.purchases, buyStages);
    const activeCount = db.purchases.filter(o => !['Đặt hàng thành công', 'Đã hủy'].includes(o.status)).length;
    return `<div class="stage-strip" aria-label="Lọc nhanh trạng thái mua hộ">
      <button type="button" class="chip ${window.statusFilter === '' ? 'active' : ''}" onclick="setFilter('')">Tất cả <span class="chip-count">${db.purchases.length}</span></button>
      <button type="button" class="chip ${window.statusFilter === '__active' ? 'active' : ''}" onclick="setFilter('__active')">Cần xử lý <span class="chip-count">${activeCount}</span></button>
      ${counts.map(c => `<button type="button" class="chip ${window.statusFilter === c.label ? 'active' : ''}" onclick="setFilter('${esc(c.label)}')">${esc(c.label)} <span class="chip-count">${c.value}</span></button>`).join('')}
    </div>`;
  }

  if (view === 'finance') {
    const inCount = db.transactions.filter(x => x.type === 'Thu').length;
    const outCount = db.transactions.filter(x => x.type === 'Chi').length;
    return `<div class="stage-strip" aria-label="Lọc nhanh khoản thu chi">
      <button type="button" class="chip ${window.statusFilter === '' ? 'active' : ''}" onclick="setFilter('')">Tất cả giao dịch <span class="chip-count">${db.transactions.length}</span></button>
      <button type="button" class="chip ${window.statusFilter === 'Thu' ? 'active' : ''}" onclick="setFilter('Thu')">Khoản thu <span class="chip-count">${inCount}</span></button>
      <button type="button" class="chip ${window.statusFilter === 'Chi' ? 'active' : ''}" onclick="setFilter('Chi')">Khoản chi <span class="chip-count">${outCount}</span></button>
    </div>`;
  }

  return '';
}

function stageCounts(data, stages) {
  const map = new Map(stages.map(s => [s, 0]));
  for (const x of data) map.set(x.status, (map.get(x.status) || 0) + 1);
  return [...map].map(([label, value]) => ({ label, value }));
}

function chartCard(title, items, format = 'count') {
  const max = Math.max(1, ...items.map(x => Number(x.value) || 0));
  const sum = items.reduce((a, x) => a + Number(x.value || 0), 0);
  const fmt = v => format === 'money' ? money(v) + ' ₫' : v;
  const visibleItems = items.length > 5 ? items.filter(x => x.value > 0).concat(items.filter(x => !x.value).slice(0, 2)) : items;
  return `<div class="chart-card">
    <div class="chart-head">
      <span class="chart-title">${esc(title)}</span>
      <span class="chart-total">${fmt(sum)}</span>
    </div>
    ${visibleItems.length ? visibleItems.map(x => `<div class="chart-row ${x.value ? '' : 'zero'}">
      <div class="chart-labels"><span>${esc(x.label)}</span><span>${fmt(x.value)}</span></div>
      <div class="chart-track"><div class="chart-fill" style="width:${x.value ? Math.max(4, Number(x.value) / max * 100) : 0}%"></div></div>
    </div>`).join('') : '<div class="chart-empty">Chưa có dữ liệu</div>'}
  </div>`;
}

function customerWorkload() {
  const m = new Map();
  [...db.shipments, ...db.purchases].forEach(x => {
    const key = (x.code || x.phone || x.customer || '').trim();
    if (!key) return;
    const item = m.get(key) || { label: x.customer, value: 0 };
    item.value++;
    m.set(key, item);
  });
  return [...m.values()].sort((a, b) => b.value - a.value).slice(0, 5);
}

function overview() {
  const recent = [
    ...db.shipments.map(o => ({ ...o, kind: 'shipment', kindName: 'Vận đơn' })),
    ...db.purchases.map(o => ({ ...o, kind: 'purchase', kindName: 'Mua hộ' }))
  ].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);

  const recentMoney = [...db.transactions]
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 5);

  return `<div class="section-stack">
    <div class="overview-grid">
      <div class="subpanel">
        <div class="subpanel-head">
          <span>Đơn hàng gần đây</span>
          <button type="button" class="link-btn" onclick="setView('shipments',document.querySelector('[data-view=shipments]'))">Xem tất cả →</button>
        </div>
        ${recent.length ? recent.map(o => `<div class="customer-card">
          <div class="mini-avatar">${avatar(o.customer)}</div>
          <div class="customer-details">
            <div class="person">${esc(o.product)} <span class="code">${esc(o.kindName)}</span></div>
            <div class="customer-stats">${esc(o.customer)} · ${dateText(o.date)}</div>
          </div>
          ${statusTag(o.status)}
          <button type="button" class="iconbtn" onclick="editRecord('${o.kind}','${o.id}')">Sửa</button>
        </div>`).join('') : `<div class="empty"><p>Chưa có đơn hàng nào.</p><button type="button" class="btn small primary" onclick="openNew('shipment')">＋ Thêm vận đơn</button></div>`}
      </div>

      <div class="subpanel">
        <div class="subpanel-head">
          <span>Thu chi gần đây</span>
          <button type="button" class="link-btn" onclick="setView('finance',document.querySelector('[data-view=finance]'))">Mở sổ thu chi →</button>
        </div>
        ${recentMoney.length ? recentMoney.map(o => `<div class="customer-card">
          <div class="mini-avatar ${o.type === 'Thu' ? 'income-color' : 'expense-color'}">${o.type === 'Thu' ? '+' : '−'}</div>
          <div class="customer-details">
            <div class="person">${esc(o.category)} ${o.party ? '· ' + esc(o.party) : ''}</div>
            <div class="customer-stats">${dateText(o.date)} · ${esc(o.method || '')}${o.related ? ' · ' + esc(o.related) : ''}</div>
          </div>
          <b class="${o.type === 'Thu' ? 'income-color' : 'expense-color'}">${o.type === 'Thu' ? '+' : '−'}${money(o.amount)} ₫</b>
          <button type="button" class="iconbtn" onclick="editRecord('finance','${o.id}')">Sửa</button>
        </div>`).join('') : `<div class="empty"><p>Chưa ghi nhận giao dịch thu chi.</p><button type="button" class="btn small primary" onclick="openNew('finance')">＋ Ghi thu / chi</button></div>`}
      </div>
    </div>

    <div class="chart-grid">
      ${chartCard('Đơn ký gửi theo trạng thái', stageCounts(db.shipments, shipStages))}
      ${chartCard('Mua hộ theo trạng thái', stageCounts(db.purchases, buyStages))}
      ${chartCard('Khách có nhiều đơn', customerWorkload())}
    </div>
  </div>`;
}

function renderTableInner(headersHtml, rows, kind) {
  const hasFilter = Boolean(query || window.statusFilter);
  const newKind = kind === 'shipments' ? 'shipment' : kind === 'purchases' ? 'purchase' : 'finance';
  const newLabel = kind === 'shipments' ? '＋ Thêm vận đơn' : kind === 'purchases' ? '＋ Thêm mua hộ' : '＋ Ghi khoản thu / chi';

  return `<table>
    <thead>
      <tr>${headersHtml}</tr>
    </thead>
    <tbody>${rows || ''}</tbody>
  </table>
  ${rows ? '' : `<div class="empty">
    <div class="empty-ico">${hasFilter ? '🔎' : '📋'}</div>
    <strong>${hasFilter ? 'Không tìm thấy bản ghi phù hợp' : 'Danh sách hiện đang trống'}</strong>
    <p>${hasFilter ? 'Thử tìm bằng từ khóa khác hoặc xóa bộ lọc trạng thái.' : 'Nhấn nút bên dưới để thêm bản ghi đầu tiên vào danh sách.'}</p>
    ${hasFilter
      ? `<button type="button" class="btn small" onclick="clearFilters()">Xóa bộ lọc</button>`
      : kind === 'customers'
        ? ''
        : `<button type="button" class="btn small primary" onclick="openNew('${newKind}')">${newLabel}</button>`
    }
  </div>`}`;
}

function tableShell(title, sub, placeholder, statuses, tableHtml, totalCount, filteredCount) {
  const hasFilter = Boolean(query || window.statusFilter);
  return `<section class="panel">
    <div class="panel-head">
      <div>
        <div class="panel-title">${title}</div>
        <div class="panel-sub">${sub}</div>
      </div>
      <span class="result-count" id="resultCount">${filteredCount} / ${totalCount} mục</span>
    </div>
    <div class="filters">
      <div class="search">
        <span class="search-ico" aria-hidden="true">⌕</span>
        <input id="searchInput" class="field" placeholder="${placeholder}" value="${esc(query)}" oninput="handleSearch(this)">
        <button type="button" id="searchClearBtn" class="search-clear ${query ? '' : 'hidden'}" onclick="clearSearchInput()" title="Xóa từ khóa">×</button>
      </div>
      <select class="select" aria-label="Lọc theo trạng thái" onchange="setFilter(this.value)">
        <option value="">Mọi trạng thái</option>
        <option value="__active" ${window.statusFilter === '__active' ? 'selected' : ''}>Đang xử lý</option>
        ${statuses.map(s => `<option value="${esc(s)}" ${window.statusFilter === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
      </select>
      <button type="button" id="resetFilterBtn" class="btn subtle small ${hasFilter ? '' : 'hidden'}" onclick="clearFilters()">Đặt lại lọc</button>
    </div>
    <div class="table-wrap" id="tableArea">${tableHtml}</div>
  </section>`;
}

function getShipmentsViewData() {
  const q = query.toLowerCase();
  const filtered = db.shipments.filter(o => {
    const matchQ = `${o.customer} ${o.code} ${o.waybill} ${o.product} ${o.phone} ${o.note || ''}`.toLowerCase().includes(q);
    const matchStatus = !window.statusFilter ? true : window.statusFilter === '__active' ? o.status !== 'Đã giao khách' : o.status === window.statusFilter;
    return matchQ && matchStatus;
  });

  const rows = filtered.map(o => `<tr>
    <td data-label="Khách hàng">
      <div class="customer">
        <div class="mini-avatar">${avatar(o.customer)}</div>
        <div>
          <div class="person">${esc(o.customer)} <span class="code">${esc(o.code || 'Chưa có mã')}</span></div>
          <div class="subline">${esc(o.phone || 'Chưa có SĐT')}</div>
        </div>
      </div>
    </td>
    <td data-label="Mã vận đơn">
      <a class="link" target="_blank" rel="noopener" href="https://www.17track.net/en#nums=${encodeURIComponent(o.waybill)}" title="Tra cứu trên 17Track">${esc(o.waybill)} ↗</a>
    </td>
    <td data-label="Sản phẩm">
      <div class="person">${esc(o.product)}</div>
      <div class="subline">${esc(o.platform)} · SL: ${esc(o.qty)}${o.value ? ` · ¥${money(o.value)}` : ''}${o.note ? ` · ${esc(o.note)}` : ''}</div>
    </td>
    <td data-label="Ngày tạo">${dateText(o.date)}</td>
    <td data-label="Trạng thái">${statusSelect('shipment', o.id, o.status, shipStages)}</td>
    <td data-label="Thao tác">
      <div class="row-actions">
        <a class="iconbtn" target="_blank" rel="noopener" href="https://www.17track.net/en#nums=${encodeURIComponent(o.waybill)}">Tra cứu ↗</a>
        <button type="button" class="iconbtn" onclick="editRecord('shipment','${o.id}')">Sửa</button>
        <button type="button" class="iconbtn danger-tint" onclick="deleteItemDirect('shipment','${o.id}')">Xóa</button>
      </div>
    </td>
  </tr>`).join('');

  return {
    totalCount: db.shipments.length,
    filteredCount: filtered.length,
    tableHtml: renderTableInner('<th>Khách hàng</th><th>Mã vận đơn</th><th>Sản phẩm</th><th>Ngày tạo</th><th>Trạng thái</th><th>Thao tác</th>', rows, 'shipments')
  };
}

function shipmentsPage() {
  const data = getShipmentsViewData();
  return `<div class="section-stack">
    ${tableShell('Danh sách đơn ký gửi', 'Bấm trực tiếp vào nhãn trạng thái để đổi nhanh hoặc bấm Sửa để cập nhật chi tiết.', 'Tìm tên khách, mã DR, SĐT, mã vận đơn, sản phẩm…', shipStages, data.tableHtml, data.totalCount, data.filteredCount)}
    <div class="chart-grid two-col">
      ${chartCard('Thống kê vận đơn theo trạng thái', stageCounts(db.shipments, shipStages))}
      ${chartCard('Khách gửi nhiều đơn', customerWorkload())}
    </div>
  </div>`;
}

function getPurchasesViewData() {
  const q = query.toLowerCase();
  const filtered = db.purchases.filter(o => {
    const matchQ = `${o.customer} ${o.code} ${o.product} ${o.phone} ${o.variant || ''} ${o.note || ''}`.toLowerCase().includes(q);
    const matchStatus = !window.statusFilter ? true : window.statusFilter === '__active' ? !['Đặt hàng thành công', 'Đã hủy'].includes(o.status) : o.status === window.statusFilter;
    return matchQ && matchStatus;
  });

  const rows = filtered.map(o => `<tr>
    <td data-label="Khách hàng">
      <div class="customer">
        <div class="mini-avatar">${avatar(o.customer)}</div>
        <div>
          <div class="person">${esc(o.customer)} <span class="code">${esc(o.code || 'Chưa có mã')}</span></div>
          <div class="subline">${esc(o.platform)} · ${esc(o.phone || 'Chưa có SĐT')}</div>
        </div>
      </div>
    </td>
    <td data-label="Sản phẩm">
      <div class="person">${esc(o.product)}</div>
      <div class="subline">${esc(o.variant || 'Chưa chọn phân loại')}${o.note ? ' · ' + esc(o.note) : ''}</div>
    </td>
    <td data-label="Số lượng"><b>${esc(o.qty)}</b></td>
    <td data-label="Giá / Báo khách">
      <div>Giá gốc: <b>¥${money(o.value)}</b></div>
      <div class="subline">${o.quote ? `Báo khách: <b>¥${money(o.quote)}</b>` : 'Chưa báo giá'}</div>
    </td>
    <td data-label="Trạng thái">${statusSelect('purchase', o.id, o.status, buyStages)}</td>
    <td data-label="Thao tác">
      <div class="row-actions">
        ${o.url ? `<a class="iconbtn" href="${safeUrl(o.url)}" target="_blank" rel="noopener">Mở link ↗</a>` : ''}
        ${['Đặt hàng thành công', 'Đang đặt hàng', 'Đã thanh toán'].includes(o.status) ? `<button type="button" class="iconbtn primary-tint" onclick="makeShipmentFromPurchase('${o.id}')" title="Chuyển thông tin sang đơn ký gửi">＋ Tạo vận đơn</button>` : ''}
        <button type="button" class="iconbtn" onclick="editRecord('purchase','${o.id}')">Sửa</button>
        <button type="button" class="iconbtn danger-tint" onclick="deleteItemDirect('purchase','${o.id}')">Xóa</button>
      </div>
    </td>
  </tr>`).join('');

  return {
    totalCount: db.purchases.length,
    filteredCount: filtered.length,
    tableHtml: renderTableInner('<th>Khách hàng</th><th>Sản phẩm / phân loại</th><th>SL</th><th>Giá / Báo khách</th><th>Trạng thái</th><th>Thao tác</th>', rows, 'purchases')
  };
}

function purchasesPage() {
  const data = getPurchasesViewData();
  return `<div class="section-stack">
    ${tableShell('Danh sách yêu cầu mua hộ', 'Đổi nhanh trạng thái trên từng dòng; khi có mã vận đơn hãy bấm "+ Tạo vận đơn".', 'Tìm khách hàng, mã DR, tên sản phẩm hoặc ghi chú…', buyStages, data.tableHtml, data.totalCount, data.filteredCount)}
    <div class="chart-grid two-col">
      ${chartCard('Yêu cầu mua hộ theo trạng thái', stageCounts(db.purchases, buyStages))}
      ${chartCard('Khách đặt mua hộ', customerWorkload())}
    </div>
  </div>`;
}

function safeUrl(u) {
  try {
    const x = new URL(u);
    return ['http:', 'https:'].includes(x.protocol) ? esc(x.href) : '#';
  } catch {
    return '#';
  }
}

function monthlyFinance(type) {
  const now = new Date();
  const out = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('vi-VN', { month: 'short' });
    out.push({
      label,
      value: db.transactions
        .filter(x => x.type === type && (x.date || '').startsWith(key))
        .reduce((a, x) => a + Number(x.amount || 0), 0)
    });
  }
  return out;
}

function expenseCategories() {
  const m = new Map();
  db.transactions
    .filter(x => x.type === 'Chi')
    .forEach(x => m.set(x.category || 'Khác', (m.get(x.category || 'Khác') || 0) + Number(x.amount || 0)));
  return [...m].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);
}

function getFinanceViewData() {
  const q = query.toLowerCase();
  const items = db.transactions
    .filter(x => (`${x.type} ${x.category} ${x.party} ${x.related} ${x.method} ${x.note}`.toLowerCase().includes(q)) && (!window.statusFilter || x.type === window.statusFilter))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const rows = items.map(x => `<tr>
    <td data-label="Ngày">${dateText(x.date)}</td>
    <td data-label="Loại"><span class="status ${x.type === 'Thu' ? 's-green' : 's-red'}">${esc(x.type)}</span></td>
    <td data-label="Danh mục">
      <b>${esc(x.category)}</b>
      <div class="subline">${esc(x.related || 'Không gắn mã đơn')}${x.note ? ' · ' + esc(x.note) : ''}</div>
    </td>
    <td data-label="Đối tượng">
      <div>${esc(x.party || '—')}</div>
      <div class="subline">${esc(x.method || '')}</div>
    </td>
    <td data-label="Số tiền" class="${x.type === 'Thu' ? 'income-color' : 'expense-color'}">
      <b>${x.type === 'Thu' ? '+' : '−'}${money(x.amount)} ₫</b>
    </td>
    <td data-label="Thao tác">
      <div class="row-actions">
        <button type="button" class="iconbtn" onclick="editRecord('finance','${x.id}')">Sửa</button>
        <button type="button" class="iconbtn danger-tint" onclick="deleteTransaction('${x.id}')">Xóa</button>
      </div>
    </td>
  </tr>`).join('');

  return {
    totalCount: db.transactions.length,
    filteredCount: items.length,
    tableHtml: renderTableInner('<th>Ngày</th><th>Loại</th><th>Danh mục / Đơn liên quan</th><th>Đối tượng / Hình thức</th><th>Số tiền</th><th>Thao tác</th>', rows, 'finance')
  };
}

function financePage() {
  const totals = monthTotals();
  const allIn = db.transactions.filter(x => x.type === 'Thu').reduce((a, x) => a + Number(x.amount || 0), 0);
  const allOut = db.transactions.filter(x => x.type === 'Chi').reduce((a, x) => a + Number(x.amount || 0), 0);
  const hasFilter = Boolean(query || window.statusFilter);
  const data = getFinanceViewData();

  return `<div class="section-stack">
    <div class="finance-top">
      <div class="finance-total">
        <span>Tổng thu tháng này</span>
        <strong class="income-color">+${money(totals.income)} ₫</strong>
        <small>Lũy kế mọi thời điểm: ${money(allIn)} ₫</small>
      </div>
      <div class="finance-total">
        <span>Tổng chi tháng này</span>
        <strong class="expense-color">−${money(totals.expense)} ₫</strong>
        <small>Lũy kế mọi thời điểm: ${money(allOut)} ₫</small>
      </div>
      <div class="finance-total">
        <span>Số dư tháng này</span>
        <strong>${totals.income - totals.expense >= 0 ? '+' : ''}${money(totals.income - totals.expense)} ₫</strong>
        <small>Số dư lũy kế: ${money(allIn - allOut)} ₫</small>
      </div>
    </div>

    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Nhật ký giao dịch thu chi</div>
          <div class="panel-sub">Ghi chép nội bộ bằng đồng Việt Nam (₫).</div>
        </div>
        <span class="result-count" id="resultCount">${data.filteredCount} / ${data.totalCount} giao dịch</span>
      </div>
      <div class="filters">
        <div class="search">
          <span class="search-ico" aria-hidden="true">⌕</span>
          <input id="searchInput" class="field" placeholder="Tìm danh mục, khách hàng, mã đơn hoặc ghi chú…" value="${esc(query)}" oninput="handleSearch(this)">
          <button type="button" id="searchClearBtn" class="search-clear ${query ? '' : 'hidden'}" onclick="clearSearchInput()" title="Xóa từ khóa">×</button>
        </div>
        <select class="select" aria-label="Lọc loại thu chi" onchange="setFilter(this.value)">
          <option value="">Thu và chi</option>
          <option value="Thu" ${window.statusFilter === 'Thu' ? 'selected' : ''}>Chỉ khoản thu</option>
          <option value="Chi" ${window.statusFilter === 'Chi' ? 'selected' : ''}>Chỉ khoản chi</option>
        </select>
        <button type="button" id="resetFilterBtn" class="btn subtle small ${hasFilter ? '' : 'hidden'}" onclick="clearFilters()">Đặt lại lọc</button>
      </div>
      <div class="table-wrap" id="tableArea">${data.tableHtml}</div>
    </section>

    <div class="chart-grid">
      ${chartCard('Thu 6 tháng gần nhất', monthlyFinance('Thu'), 'money')}
      ${chartCard('Chi 6 tháng gần nhất', monthlyFinance('Chi'), 'money')}
      ${chartCard('Chi phí theo danh mục', expenseCategories(), 'money')}
    </div>
  </div>`;
}

function getCustomersViewData() {
  const q = query.toLowerCase();
  const allCustomers = uniqueCustomers();
  const customers = allCustomers.filter(o => `${o.customer} ${o.code} ${o.phone} ${o.address}`.toLowerCase().includes(q));

  const rows = customers.map(o => {
    const c = (o.code || o.phone || o.customer).toLowerCase();
    const sc = db.shipments.filter(x => (x.code || x.phone || x.customer).toLowerCase() === c).length;
    const pc = db.purchases.filter(x => (x.code || x.phone || x.customer).toLowerCase() === c).length;
    const activeCount =
      db.shipments.filter(x => (x.code || x.phone || x.customer).toLowerCase() === c && x.status !== 'Đã giao khách').length +
      db.purchases.filter(x => (x.code || x.phone || x.customer).toLowerCase() === c && !['Đặt hàng thành công', 'Đã hủy'].includes(x.status)).length;

    return `<tr>
      <td data-label="Khách hàng">
        <div class="customer">
          <div class="mini-avatar">${avatar(o.customer)}</div>
          <div>
            <div class="person">${esc(o.customer)} <span class="code">${esc(o.code || '—')}</span></div>
            <div class="subline">${activeCount ? `${activeCount} đơn đang xử lý` : 'Tất cả đơn đã hoàn tất'}</div>
          </div>
        </div>
      </td>
      <td data-label="Số điện thoại">${esc(o.phone || 'Chưa cập nhật')}</td>
      <td data-label="Địa chỉ nhận">${esc(o.address || 'Chưa nhập địa chỉ')}</td>
      <td data-label="Tổng đơn"><b>${sc}</b> vận đơn · <b>${pc}</b> mua hộ</td>
      <td data-label="Thao tác nhanh">
        <div class="row-actions">
          <button type="button" class="iconbtn" onclick="openForCustomer('shipment','${esc(o.code || o.phone || o.customer)}')">＋ Vận đơn</button>
          <button type="button" class="iconbtn" onclick="openForCustomer('purchase','${esc(o.code || o.phone || o.customer)}')">＋ Mua hộ</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  return {
    totalCount: allCustomers.length,
    filteredCount: customers.length,
    tableHtml: renderTableInner('<th>Khách hàng</th><th>Số điện thoại</th><th>Địa chỉ nhận hàng</th><th>Số lượng đơn</th><th>Thao tác nhanh</th>', rows, 'customers')
  };
}

function customersPage() {
  const data = getCustomersViewData();
  return `<div class="section-stack">
    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Danh bạ khách hàng</div>
          <div class="panel-sub">Tự động tổng hợp từ các vận đơn và yêu cầu mua hộ. Bấm "+ Vận đơn" hoặc "+ Mua hộ" để tạo đơn nhanh cho khách.</div>
        </div>
        <span class="result-count" id="resultCount">${data.filteredCount} / ${data.totalCount} khách</span>
      </div>
      <div class="filters">
        <div class="search">
          <span class="search-ico" aria-hidden="true">⌕</span>
          <input id="searchInput" class="field" placeholder="Tìm tên khách, mã DR, số điện thoại hoặc địa chỉ…" value="${esc(query)}" oninput="handleSearch(this)">
          <button type="button" id="searchClearBtn" class="search-clear ${query ? '' : 'hidden'}" onclick="clearSearchInput()" title="Xóa từ khóa">×</button>
        </div>
      </div>
      <div class="table-wrap" id="tableArea">${data.tableHtml}</div>
    </section>
    ${chartCard('Khách hàng có nhiều đơn nhất', customerWorkload())}
  </div>`;
}

function openForCustomer(kind, key) {
  const c = uniqueCustomers().find(o => (o.code || o.phone || o.customer).toLowerCase() === key.toLowerCase());
  openNew(kind);
  if (c) {
    renderFields(kind, {
      customer: c.customer,
      phone: c.phone,
      code: c.code,
      address: c.address,
      platform: c.platform || 'Taobao'
    });
  }
}

function openNew(kind = view === 'purchases' ? 'purchase' : view === 'finance' ? 'finance' : 'shipment') {
  const form = document.getElementById('recordForm');
  form.reset();
  form.dataset.kind = kind;
  form.dataset.id = '';
  document.getElementById('modalTitle').textContent =
    kind === 'purchase' ? 'Thêm yêu cầu mua hộ' :
    kind === 'finance' ? 'Ghi khoản thu / chi' :
    'Thêm đơn ký gửi';
  document.getElementById('modalSub').textContent = 'Điền các trường có dấu (*); các mục khác có thể bổ sung sau.';
  document.getElementById('deleteZone').classList.add('hidden');
  cancelDeleteModal();
  renderFields(kind, {});
  document.getElementById('modal').classList.add('open');
  setTimeout(() => {
    const first = document.querySelector('#formFields input, #formFields select');
    if (first) first.focus();
  }, 30);
}

function makeShipmentFromPurchase(id) {
  const p = db.purchases.find(x => x.id === id);
  if (!p) return;
  openNew('shipment');
  document.getElementById('modalTitle').textContent = 'Tạo vận đơn từ đơn mua hộ';
  document.getElementById('modalSub').textContent = `Khách hàng: ${p.customer} (${p.code || '—'}) · Nhập mã vận đơn TQ để theo dõi.`;
  renderFields('shipment', {
    customer: p.customer,
    phone: p.phone,
    code: p.code,
    address: p.address,
    platform: p.platform,
    product: p.product,
    image: p.image,
    qty: p.qty,
    value: p.value,
    status: shipStages[0],
    note: p.note
  });
}

function editRecord(kind, id) {
  const list = kind === 'shipment' ? db.shipments : kind === 'purchase' ? db.purchases : db.transactions;
  const o = list.find(x => x.id === id);
  if (!o) return;
  const form = document.getElementById('recordForm');
  form.dataset.kind = kind;
  form.dataset.id = id;
  document.getElementById('modalTitle').textContent =
    kind === 'purchase' ? 'Cập nhật yêu cầu mua hộ' :
    kind === 'finance' ? 'Cập nhật khoản thu / chi' :
    'Cập nhật đơn ký gửi';
  document.getElementById('modalSub').textContent = 'Chỉnh sửa thông tin hoặc trạng thái rồi bấm Lưu.';
  document.getElementById('deleteZone').classList.remove('hidden');
  cancelDeleteModal();
  renderFields(kind, o);
  document.getElementById('modal').classList.add('open');
}

function field(id, label, value = '', type = 'text', required = false, full = false, placeholder = '') {
  return `<div class="${full ? 'full' : ''}">
    <label for="f_${id}">${label}${required ? ' *' : ''}</label>
    <input id="f_${id}" class="field" type="${type}" value="${esc(value)}" ${required ? 'required' : ''} placeholder="${esc(placeholder)}">
  </div>`;
}

function selectField(id, label, values, value, full = false) {
  return `<div class="${full ? 'full' : ''}">
    <label for="f_${id}">${label}</label>
    <select id="f_${id}" class="select">${values.map(x => `<option ${x === value ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
  </div>`;
}

function renderFields(kind, o) {
  if (kind === 'finance') {
    const cats = ['Phí dịch vụ', 'Phí mua hộ', 'Cước vận chuyển', 'Tiền mua hàng', 'Đóng gói', 'Hoàn tiền', 'Đi lại', 'Ăn uống', 'Công cụ', 'Khác'];
    document.getElementById('formFields').innerHTML =
      selectField('type', 'Loại giao dịch', ['Thu', 'Chi'], o.type || 'Thu') +
      field('amount', 'Số tiền (₫)', o.amount ?? '', 'number', true, false, 'Ví dụ: 500000') +
      selectField('category', 'Danh mục', cats, o.category || cats[0]) +
      field('date', 'Ngày giao dịch', o.date || dateKey(), 'date', true) +
      field('party', 'Khách hàng / bên nhận', o.party || '', 'text', false, false, 'Tên khách hoặc đối tác') +
      field('related', 'Liên quan đến đơn', o.related || '', 'text', false, false, 'Mã DR hoặc tên hàng') +
      selectField('method', 'Hình thức thanh toán', ['Chuyển khoản', 'Tiền mặt', 'Ví điện tử', 'Khác'], o.method || 'Chuyển khoản', true) +
      `<div class="full"><label for="f_note">Ghi chú</label><textarea id="f_note" class="field" placeholder="Nội dung ghi chú thêm (không bắt buộc)">${esc(o.note || '')}</textarea></div>`;
    return;
  }

  let s =
    field('customer', 'Tên khách hàng', o.customer || '', 'text', true, false, 'Ví dụ: Minh Anh') +
    field('phone', 'Số điện thoại', o.phone || '', 'tel', false, false, '09xx xxx xxx') +
    field('code', 'Mã khách hàng', o.code || '', 'text', false, false, 'Tự tạo DR0001 nếu để trống') +
    selectField('platform', 'Nền tảng mua hàng', ['Taobao', '1688', 'Pinduoduo', 'Poizon', 'Khác'], o.platform || 'Taobao') +
    field('address', 'Địa chỉ nhận hàng', o.address || '', 'text', false, true, 'Địa chỉ giao hàng tại Việt Nam');

  if (kind === 'shipment') {
    s +=
      field('waybill', 'Mã vận đơn Trung Quốc', o.waybill || '', 'text', true, false, 'SF..., YT..., ZTO...') +
      field('product', 'Tên sản phẩm', o.product || '', 'text', true, false, 'Ví dụ: Áo khoác dạ') +
      field('qty', 'Số lượng', o.qty ?? 1, 'number') +
      field('value', 'Giá trị hàng (¥)', o.value ?? '', 'number', false, false, '0') +
      field('appOrder', 'Mã đơn trên sàn (nếu có)', o.appOrder || '', 'text') +
      field('image', 'Link ảnh sản phẩm', o.image || '', 'url', false, false, 'https://...') +
      selectField('status', 'Trạng thái vận chuyển', shipStages, o.status || shipStages[0], true) +
      `<div class="full"><label for="f_note">Ghi chú nội bộ</label><textarea id="f_note" class="field" placeholder="Yêu cầu đóng gói, lưu ý giao hàng…">${esc(o.note || '')}</textarea></div>`;
  } else {
    s +=
      field('url', 'Link sản phẩm cần mua', o.url || '', 'url', true, true, 'https://...') +
      field('product', 'Tên sản phẩm', o.product || '', 'text', true, false, 'Ví dụ: Giày thể thao') +
      field('variant', 'Phân loại (màu, size)', o.variant || '', 'text', false, false, 'Màu trắng · Size 42') +
      field('qty', 'Số lượng', o.qty ?? 1, 'number') +
      field('value', 'Giá trên sàn (¥)', o.value ?? '', 'number', false, false, '0') +
      field('quote', 'Giá báo khách (¥)', o.quote ?? '', 'number', false, false, 'Nhập khi báo giá') +
      field('image', 'Link ảnh sản phẩm', o.image || '', 'url', false, false, 'https://...') +
      selectField('status', 'Trạng thái yêu cầu', buyStages, o.status || buyStages[0], true) +
      `<div class="full"><label for="f_note">Ghi chú / yêu cầu riêng</label><textarea id="f_note" class="field" placeholder="Lưu ý về thời gian nhận, kiểm hàng…">${esc(o.note || '')}</textarea></div>`;
  }
  document.getElementById('formFields').innerHTML = s;
}

function val(id) {
  return document.getElementById('f_' + id)?.value.trim() || '';
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function saveFinance(form, id) {
  const prev = db.transactions.find(x => x.id === id);
  const item = {
    id: id || makeId(),
    type: val('type'),
    amount: Number(val('amount') || 0),
    category: val('category'),
    date: val('date') || dateKey(),
    party: val('party'),
    related: val('related'),
    method: val('method'),
    note: val('note')
  };
  db.transactions = prev ? db.transactions.map(x => x.id === id ? item : x) : [item, ...db.transactions];
  persist();
  closeModal();
  render();
  toast(prev ? '✓ Đã cập nhật khoản thu chi' : '✓ Đã ghi khoản thu chi mới');
}

function nextCustomerCode() {
  const nums = [...db.shipments, ...db.purchases].map(o => Number((o.code || '').match(/^DR(\d+)$/i)?.[1] || 0));
  return 'DR' + String(Math.max(0, ...nums) + 1).padStart(4, '0');
}

function saveRecord(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const kind = form.dataset.kind;
  const id = form.dataset.id;
  if (kind === 'finance') {
    saveFinance(form, id);
    return;
  }
  const prev = (kind === 'shipment' ? db.shipments : db.purchases).find(o => o.id === id);
  const o = {
    id: id || makeId(),
    customer: val('customer'),
    phone: val('phone'),
    code: val('code') || prev?.code || nextCustomerCode(),
    address: val('address'),
    platform: val('platform'),
    product: val('product'),
    image: val('image'),
    qty: Number(val('qty') || 1),
    value: Number(val('value') || 0),
    status: val('status'),
    note: val('note'),
    date: prev?.date || dateKey()
  };
  if (kind === 'shipment') {
    o.waybill = val('waybill');
    o.appOrder = val('appOrder');
  } else {
    o.url = val('url');
    o.variant = val('variant');
    o.quote = Number(val('quote') || 0);
  }
  const key = kind === 'shipment' ? 'shipments' : 'purchases';
  db[key] = prev ? db[key].map(x => x.id === id ? o : x) : [o, ...db[key]];
  persist();
  closeModal();
  render();
  toast(prev ? '✓ Đã lưu thay đổi' : '✓ Đã thêm mới thành công');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  cancelDeleteModal();
}

function askDeleteModal() {
  document.getElementById('deletePromptBtn')?.classList.add('hidden');
  document.getElementById('deleteConfirmBox')?.classList.remove('hidden');
}

function cancelDeleteModal() {
  document.getElementById('deletePromptBtn')?.classList.remove('hidden');
  document.getElementById('deleteConfirmBox')?.classList.add('hidden');
}

function deleteRecord(confirmedInline = false) {
  const f = document.getElementById('recordForm');
  const kind = f.dataset.kind;
  const id = f.dataset.id;
  if (!id) return;
  if (!confirmedInline && !confirm('Xóa mục này khỏi danh sách?')) return;
  const key = kind === 'shipment' ? 'shipments' : kind === 'purchase' ? 'purchases' : 'transactions';
  db[key] = db[key].filter(x => x.id !== id);
  persist();
  closeModal();
  render();
  toast('Đã xóa bản ghi');
}

function deleteItemDirect(kind, id) {
  const list = kind === 'shipment' ? db.shipments : db.purchases;
  const item = list.find(x => x.id === id);
  if (!item) return;
  const label = kind === 'shipment' ? `vận đơn "${item.waybill} · ${item.product}"` : `yêu cầu mua hộ "${item.product}"`;
  if (!confirm(`Bạn có chắc muốn xóa ${label} của khách ${item.customer}?`)) return;
  const key = kind === 'shipment' ? 'shipments' : 'purchases';
  db[key] = db[key].filter(x => x.id !== id);
  persist();
  render();
  toast('Đã xóa mục đã chọn');
}

function deleteTransaction(id) {
  const item = db.transactions.find(x => x.id === id);
  const desc = item ? `${item.type} ${money(item.amount)} ₫ (${item.category})` : 'khoản thu chi này';
  if (!confirm(`Xóa ${desc}?`)) return;
  db.transactions = db.transactions.filter(x => x.id !== id);
  persist();
  render();
  toast('Đã xóa khoản thu chi');
}

function toast(s) {
  const t = document.getElementById('toast');
  t.textContent = s;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

function exportData() {
  const blob = new Blob([JSON.stringify({ version: 1, ...db }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'sao-luu-quan-ly-minh.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
  toast('↓ Đã tải tệp sao lưu dữ liệu');
}

function importData(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      let d = JSON.parse(r.result);
      if (Array.isArray(d)) d = { shipments: d, purchases: [], transactions: [] };
      if (!Array.isArray(d.shipments) || !Array.isArray(d.purchases)) throw Error();
      d.transactions = Array.isArray(d.transactions) ? d.transactions : [];
      if (confirm(`Khôi phục ${d.shipments.length} vận đơn, ${d.purchases.length} yêu cầu mua hộ và ${d.transactions.length} giao dịch? Dữ liệu hiện tại trên trình duyệt sẽ được thay thế.`)) {
        db = { shipments: d.shipments, purchases: d.purchases, transactions: d.transactions };
        persist();
        render();
        toast('✓ Đã khôi phục dữ liệu thành công');
      }
    } catch {
      alert('Tệp không đúng định dạng bản sao lưu JSON của ứng dụng.');
    }
    e.target.value = '';
  };
  r.readAsText(f);
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('modal')?.classList.contains('open')) {
    closeModal();
  }
});

document.getElementById('today').textContent = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
}).format(new Date());

render();
