const KEY = 'minh-work-manager-v1-data';
const ROLE_KEY = 'dairycow-active-role';
const THEME_KEY = 'dairycow-sidebar-theme';
const SYNC_KEY = 'dairycow-cloud-sync-config';
const SNAP_KEY = 'dairycow-auto-snapshots-v1';
const AI_KEY = 'dairycow-deepseek-config';
const AI_CHAT_KEY = 'dairycow-deepseek-chat-v1';
const APP_TIMEZONE = 'Asia/Ho_Chi_Minh';
const BIZ_CLOSE_DAY = 26;

const lineTypes = ['Xách tay', 'Thanh toán hộ', 'Ký gửi kho', 'Mua hộ trọn gói', 'Khác'];
const shopPlatforms = [
  'POIZON',
  'TMALL',
  '1688',
  '95分',
  'TAOBAO',
  'JINGDONG',
  'PIN DUO DUO',
  'XIAN YU',
  'VIP SHOP',
  'Khác'
];
const goodsTypes = ['Thức ăn khô', 'Gia dụng', 'Mỹ phẩm', 'Quần áo', 'Giày dép', 'Đồ cơ khí', 'Điện tử / Phụ kiện', 'Khác'];
const packagingTypes = [
  'Tiêu chuẩn (Miễn phí)',
  'Đóng hộp gỗ',
  'Đóng hộp carton',
  'Chống sốc'
];
const packUnits = ['Cái', 'Cuộn', 'Mét', 'Lần sử dụng', 'Thùng'];
const extraShipStatuses = ['Chưa thu', 'Đã thu', 'Thu một phần'];
const orderStages = [
  'Mới tạo / Chờ xử lý',
  'Chờ khách thanh toán',
  'Đã thanh toán hộ',
  'Đang vận chuyển',
  'Đã về kho VN',
  'Đã giao khách',
  'Hoàn tất / Đã tất toán',
  'Đã hủy'
];
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
let financeTab = 'cashflow'; // 'cashflow' | 'debts' | 'report' | 'periods' | 'history'
let incTab = 'extraship'; // 'extraship' | 'wood' | 'carton' | 'shock'
let incPeriodMode = 'all'; // 'day' | 'week' | 'month' | 'custom' | 'all'
let incDate = dateKey();
let incWeekDate = dateKey();
let incMonth = dateKey().slice(0, 7);
let incFromDate = dateKey().slice(0, 8) + '01';
let incToDate = dateKey();
let draftOrderPackItems = [];
let query = '';
let todoFilter = 'all';
let periodMode = 'bizperiod'; // 'bizperiod' | 'day' | 'month' | 'year' | 'all'
let selectedBusinessPeriodId = ''; // '' => luôn bám kỳ kinh doanh đang hoạt động
let periodDetailId = ''; // kỳ đang mở xem báo cáo đối chiếu chi tiết trong tab Kỳ chốt 26
let periodDate = dateKey();
let periodMonth = dateKey().slice(0, 7);
let periodYear = String(getVNParts().year);
let toastTimer = null;
let formDirty = false;
let overlayMouseDownTarget = null;
let showCnyBox = false;
let showPackBox = false;
let currentUserRole = localStorage.getItem(ROLE_KEY) || 'admin';
let syncDebounceTimer = null;
let syncPollTimer = null;
let syncInFlight = false;
let lastAutoSnapTs = 0;
let lastActiveBizPeriodId = '';
let periodWatcherTimer = null;
window.statusFilter = '';
window.platformFilter = '';
window.ordersPeriodOnly = false;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function getAppNow() {
  if (typeof globalThis !== 'undefined' && globalThis.__testNowOverride) {
    return new Date(globalThis.__testNowOverride);
  }
  return new Date();
}

// Chuẩn hóa thời gian theo múi giờ kinh doanh cố định Asia/Ho_Chi_Minh (UTC+7, không DST)
function getVNParts(inputDate) {
  const d = inputDate ? new Date(inputDate) : getAppNow();
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const parts = {};
    fmt.formatToParts(d).forEach(p => { if (p.type !== 'literal') parts[p.type] = p.value; });
    const year = Number(parts.year);
    const month = Number(parts.month);
    const day = Number(parts.day);
    const hour = Number(parts.hour) % 24;
    const minute = Number(parts.minute);
    const second = Number(parts.second);
    if (year >= 2000 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return {
        year, month, day, hour, minute, second,
        dateStr: `${year}-${pad2(month)}-${pad2(day)}`,
        timeStr: `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`
      };
    }
  } catch {}
  // Fallback toán học chuẩn xác UTC+7 (Việt Nam không có giờ mùa hè DST)
  const vnMs = d.getTime() + 7 * 60 * 60 * 1000;
  const u = new Date(vnMs);
  const year = u.getUTCFullYear();
  const month = u.getUTCMonth() + 1;
  const day = u.getUTCDate();
  const hour = u.getUTCHours();
  const minute = u.getUTCMinutes();
  const second = u.getUTCSeconds();
  return {
    year, month, day, hour, minute, second,
    dateStr: `${year}-${pad2(month)}-${pad2(day)}`,
    timeStr: `${pad2(hour)}:${pad2(minute)}:${pad2(second)}`
  };
}

function dateKey(d) {
  if (d instanceof Date) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  return getVNParts(d).dateStr;
}

function nowStamp(withSeconds = false) {
  const p = getVNParts();
  const time = withSeconds
    ? `${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`
    : `${pad2(p.hour)}:${pad2(p.minute)}`;
  return `${time} - ${pad2(p.day)}/${pad2(p.month)}/${p.year}`;
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function samplePackagingCatalog() {
  return [
    {
      id: 'pk_wood_1',
      category: 'wood',
      name: 'Hộp gỗ',
      spec: 'Đóng kiện gỗ bảo vệ hàng dễ vỡ',
      unit: 'Cái',
      bulkCost: 0,
      usesPerBulk: 1,
      costPrice: 50000,
      sellPrice: 70000,
      qty: 0,
      date: dateKey(),
      note: 'Mẫu đóng hộp gỗ tiêu chuẩn',
      updatedAt: nowStamp(),
      history: []
    },
    {
      id: 'pk_carton_1',
      category: 'carton',
      name: 'Carton size M',
      spec: 'Thùng carton 5 lớp cứng cáp',
      unit: 'Thùng',
      bulkCost: 0,
      usesPerBulk: 1,
      costPrice: 7000,
      sellPrice: 12000,
      qty: 0,
      date: dateKey(),
      note: 'Mẫu thùng carton size M',
      updatedAt: nowStamp(),
      history: []
    },
    {
      id: 'pk_shock_1',
      category: 'shock',
      name: 'Chống sốc (Tính theo lần)',
      spec: 'Cuộn 105.000đ / 20 lần sử dụng',
      unit: 'Lần sử dụng',
      bulkCost: 105000,
      usesPerBulk: 20,
      costPrice: 5250,
      sellPrice: 10000,
      qty: 0,
      date: dateKey(),
      note: '1 cuộn 105.000đ dùng 20 lần => Giá vốn 5.250đ/lần',
      updatedAt: nowStamp(),
      history: []
    },
    {
      id: 'pk_shock_2',
      category: 'shock',
      name: 'Chống sốc tiêu chuẩn',
      spec: 'Quấn màng xốp hơi bảo vệ',
      unit: 'Lần sử dụng',
      bulkCost: 0,
      usesPerBulk: 1,
      costPrice: 5000,
      sellPrice: 10000,
      qty: 0,
      date: dateKey(),
      note: 'Mẫu chống sốc cơ bản',
      updatedAt: nowStamp(),
      history: []
    }
  ];
}

function sampleOrderNotes() {
  return [
    {
      id: 'on1',
      lineType: 'Thanh toán hộ',
      packages: 2,
      customer: 'Nguyễn Văn A',
      phone: '0909 888 123',
      code: 'DR0006',
      goodsType: 'Quần áo',
      product: 'Lô áo khoác thu đông',
      goodsCny: 1000,
      goodsVndInput: 0,
      includeGoodsInFlow: true,
      shipCost: 120000,
      shipCharge: 180000,
      serviceFeePct: 3,
      serviceFeeManual: 0,
      rateBuy: 3550,
      rateSell: 3650,
      extraCost: 10000,
      customerPaid: 2000000,
      warehousePaid: false,
      partnerPaid: true,
      status: 'Đang vận chuyển',
      date: dateKey(),
      note: 'Khách cọc trước 2 triệu, hàng về thu nốt [09:30 - 06/11/2026]',
      updatedAt: '09:30 - 06/11/2026',
      history: [{ time: '09:30:00 - 06/11/2026', action: 'Tạo mới', detail: 'Khởi tạo Note đơn mẫu' }]
    },
    {
      id: 'on2',
      lineType: 'Xách tay',
      packages: 1,
      customer: 'Thu Hà',
      phone: '0903 110 247',
      code: 'DR0003',
      goodsType: 'Mỹ phẩm',
      product: 'Set dưỡng da nội địa',
      goodsCny: 0,
      goodsVndInput: 2500000,
      includeGoodsInFlow: false,
      shipCost: 90000,
      shipCharge: 150000,
      serviceFeePct: 2,
      serviceFeeManual: 0,
      rateBuy: 0,
      rateSell: 0,
      extraCost: 0,
      customerPaid: 200000,
      warehousePaid: true,
      partnerPaid: true,
      status: 'Đã về kho VN',
      date: dateKey(),
      note: 'Hàng dễ vỡ, bọc xốp kỹ [14:15 - 06/11/2026]',
      updatedAt: '14:15 - 06/11/2026',
      history: [{ time: '14:15:00 - 06/11/2026', action: 'Tạo mới', detail: 'Khởi tạo Note đơn xách tay' }]
    }
  ];
}

function filterOutDeleted(arr, delMap) {
  if (!Array.isArray(arr)) return [];
  if (!delMap || typeof delMap !== 'object') return arr;
  return arr.filter(item => {
    if (!item || !item.id) return false;
    const delTs = Number(delMap[item.id]) || 0;
    if (!delTs) return true;
    const itemTs = Number(item.updatedAtMs) || 0;
    return itemTs > delTs;
  });
}

function resolvePackagingCatalog(rawCatalog, delMap, catalogInitialized = false) {
  if (Array.isArray(rawCatalog)) {
    return filterOutDeleted(rawCatalog, delMap);
  }
  if (catalogInitialized) {
    return [];
  }
  return filterOutDeleted(samplePackagingCatalog(), delMap);
}

function loadDB() {
  try {
    const saved = localStorage.getItem(KEY) || localStorage.getItem('linh-logistics-v1-data');
    if (saved) {
      const d = JSON.parse(saved);
      const delMap = (d.deletedIds && typeof d.deletedIds === 'object') ? d.deletedIds : {};
      const catInit = Boolean(d._catalogInitialized || Array.isArray(d.packagingCatalog) || Object.keys(delMap).some(k => k.startsWith('pk_')));
      return {
        orderNotes: filterOutDeleted(d.orderNotes, delMap),
        shipments: filterOutDeleted(d.shipments, delMap),
        purchases: filterOutDeleted(d.purchases, delMap),
        transactions: filterOutDeleted(d.transactions, delMap),
        extraShipments: filterOutDeleted(d.extraShipments, delMap),
        packagingCatalog: resolvePackagingCatalog(d.packagingCatalog, delMap, catInit),
        logs: Array.isArray(d.logs) ? d.logs : [],
        paymentRecords: filterOutDeleted(d.paymentRecords, delMap),
        businessPeriods: Array.isArray(d.businessPeriods) ? d.businessPeriods : [],
        deletedIds: delMap,
        _catalogInitialized: true,
        _userModified: Boolean(d._userModified || Object.keys(delMap).length > 0)
      };
    }
    const old = localStorage.getItem('linh-logistics-orders-v1');
    if (old) {
      const arr = JSON.parse(old);
      return { orderNotes: [], shipments: arr, purchases: [], transactions: [], extraShipments: [], packagingCatalog: samplePackagingCatalog(), logs: [], paymentRecords: [], businessPeriods: [], deletedIds: {}, _catalogInitialized: true, _userModified: true };
    }
  } catch (err) {
    console.error('Lỗi đọc dữ liệu localStorage:', err);
  }
  return {
    orderNotes: sampleOrderNotes(),
    shipments: [
      { id: 's1', customer: 'Minh Anh', phone: '0912 345 678', code: 'DR0001', address: '', platform: 'Taobao', waybill: 'SF1439827610', product: 'Áo khoác dạ nữ', qty: 2, value: 168, status: shipStages[1], date: '2026-11-05', note: '', updatedAt: '10:00 - 05/11/2026', history: [] },
      { id: 's2', customer: 'Hoàng Nam', phone: '0988 221 540', code: 'DR0002', address: '', platform: '1688', waybill: 'YT6720193845', product: 'Đèn bàn gỗ', qty: 1, value: 92, status: shipStages[3], date: '2026-11-04', note: 'Đóng gói chống sốc [15:20 - 04/11/2026]', updatedAt: '15:20 - 04/11/2026', history: [] },
      { id: 's3', customer: 'Thu Hà', phone: '0903 110 247', code: 'DR0003', address: '', platform: 'Pinduoduo', waybill: 'ZTO5567328190', product: 'Bộ cốc sứ (6 món)', qty: 1, value: 74, status: shipStages[5], date: '2026-11-02', note: '', updatedAt: '09:10 - 02/11/2026', history: [] }
    ],
    purchases: [
      { id: 'p1', customer: 'Quốc Bảo', phone: '0977 803 626', code: 'DR0004', address: '', platform: 'Poizon', url: 'https://www.poizon.com', product: 'Giày thể thao', variant: 'Màu trắng · Size 42', qty: 1, value: 510, quote: 0, status: buyStages[1], date: '2026-11-05', note: 'Khách cần nhận trước 15/11 [11:00 - 05/11/2026]', updatedAt: '11:00 - 05/11/2026', history: [] },
      { id: 'p2', customer: 'Ngọc Linh', phone: '0934 678 221', code: 'DR0005', address: '', platform: 'Taobao', url: 'https://www.taobao.com', product: 'Túi đeo chéo', variant: 'Màu nâu', qty: 1, value: 138, quote: 165, status: buyStages[2], date: '2026-11-06', note: '', updatedAt: '16:40 - 06/11/2026', history: [] }
    ],
    transactions: [
      { id: 't1', type: 'Thu', amount: 1200000, category: 'Phí dịch vụ', party: 'Minh Anh', related: 'DR0001 · Áo khoác', method: 'Chuyển khoản', date: '2026-11-05', note: '', updatedAt: '18:00 - 05/11/2026', history: [] },
      { id: 't2', type: 'Chi', amount: 700000, category: 'Cước vận chuyển', party: 'Nhà vận chuyển', related: 'DR0001 · Áo khoác', method: 'Tiền mặt', date: '2026-11-05', note: '', updatedAt: '18:05 - 05/11/2026', history: [] }
    ],
    extraShipments: [],
    packagingCatalog: samplePackagingCatalog(),
    logs: [
      { id: 'l1', time: nowStamp(true), action: 'Khởi động', target: 'Hệ thống', detail: 'Sẵn sàng lưu trữ và tính toán tự động' }
    ],
    paymentRecords: [],
    businessPeriods: [],
    deletedIds: {},
    _catalogInitialized: true,
    _userModified: false
  };
}

function persist(options = {}) {
  try {
    if (!db.deletedIds || typeof db.deletedIds !== 'object') db.deletedIds = {};
    if (!Array.isArray(db.paymentRecords)) db.paymentRecords = [];
    if (!Array.isArray(db.businessPeriods)) db.businessPeriods = [];
    db._catalogInitialized = true;
    if (!options.preserveSeedFlag) db._userModified = true;
    const payload = JSON.stringify(db);
    localStorage.setItem(KEY, payload);
    const verify = localStorage.getItem(KEY);
    const el = document.getElementById('saveStatus');
    if (verify) {
      if (el) {
        el.textContent = `✓ Đã lưu ${nowStamp()}`;
        el.classList.remove('warn');
      }
      if (!options.skipSnapshot && typeof maybeAutoSnapshot === 'function') {
        maybeAutoSnapshot('Tự động sao lưu định kỳ');
      }
      if (!options.skipSync && typeof scheduleCloudSync === 'function') {
        scheduleCloudSync();
      }
      if (typeof updateSyncBadge === 'function') updateSyncBadge();
      return true;
    }
    throw new Error('Không đọc lại được dữ liệu sau khi lưu');
  } catch (err) {
    console.error('Lỗi lưu localStorage:', err);
    const el = document.getElementById('saveStatus');
    if (el) {
      el.textContent = '⚠ Lỗi bộ nhớ! Hãy bấm Sao lưu';
      el.classList.add('warn');
    }
    alert('Không thể lưu vào trình duyệt (có thể đang bật ẩn danh bị khóa bộ nhớ hoặc đầy dung lượng). Vui lòng bấm nút "☁ Đồng bộ & Sao lưu" để tải tệp JSON về máy!');
    return false;
  }
}

if (!localStorage.getItem(KEY)) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
}

// Sửa 1 lần: mục mẫu đóng gói là bảng giá, không được tính vào doanh thu thật
(function fixSeedPackagingQty() {
  try {
    if (localStorage.getItem('dairycow-seedfix-v1')) return;
    const seedIds = ['pk_wood_1', 'pk_carton_1', 'pk_shock_1', 'pk_shock_2'];
    (db.packagingCatalog || []).forEach(x => {
      if (seedIds.includes(x.id) && (!x.history || !x.history.length)) x.qty = 0;
    });
    localStorage.setItem('dairycow-seedfix-v1', '1');
    persist({ preserveSeedFlag: true });
  } catch {}
})();


function addAuditLog(action, target, detail) {
  if (!Array.isArray(db.logs)) db.logs = [];
  db.logs.unshift({
    id: makeId(),
    time: nowStamp(true),
    action,
    target,
    detail
  });
  if (db.logs.length > 300) db.logs.length = 300;
}

// Tự động gắn dấu thời gian [HH:mm - DD/MM/YYYY] vào cuối ghi chú khi có nội dung mới hoặc sửa đổi
function stampNote(rawNew, rawPrev = '') {
  const next = String(rawNew || '').trim();
  const prev = String(rawPrev || '').trim();
  if (!next) return '';
  if (next === prev) return next;
  const stampRegex = /\[\d{2}:\d{2}(?::\d{2})?\s*-\s*\d{2}\/\d{2}\/\d{4}\]\s*$/;
  if (stampRegex.test(next)) return next;
  return `${next} [${nowStamp()}]`;
}

// Bộ đọc số thông minh: xử lý cả "1.500.000", "500,000", "3.650", lẫn số thập phân "168.5", "168,5", "2.5%"
function parseNum(raw) {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  let s = String(raw).trim().replace(/[₫¥%\s]/g, '');
  if (!s) return 0;
  const neg = s.startsWith('-') ? -1 : 1;
  s = s.replace(/^[+-]/, '');

  if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    return neg * Number(s.replace(/\./g, ''));
  }
  if (/^\d{1,3}(,\d{3})+$/.test(s)) {
    return neg * Number(s.replace(/,/g, ''));
  }
  if (s.includes('.') && s.includes(',')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? neg * n : 0;
}

function normalizeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  const match = s.match(/https?:\/\/[^\s"'<>]+/i);
  if (match) return match[0];
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(s)) return 'https://' + s;
  return s;
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

function jsArg(s = '') {
  return esc(String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
}

function money(n) {
  return Math.round(Number(n || 0)).toLocaleString('vi-VN');
}

function shortMoney(n) {
  const abs = Math.abs(Number(n || 0));
  const sign = Number(n || 0) < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(1).replace('.0', '')}tỷ`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(1).replace('.0', '')}tr`;
  if (abs >= 1e3) return `${sign}${Math.round(abs / 1e3)}k`;
  return `${sign}${Math.round(abs)}`;
}

function numFmt(n) {
  const v = Number(n || 0);
  return Number.isInteger(v) ? v.toLocaleString('vi-VN') : v.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

function dateText(d) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
}

function shortDateLabel(d) {
  if (!d) return '—';
  if (d.length === 7) {
    const [y, m] = d.split('-');
    return `T${Number(m)}/${y.slice(2)}`;
  }
  const parts = d.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
}

function avatar(name = '') {
  return name.trim().split(/\s+/).map(x => x[0] || '').slice(-2).join('').toUpperCase() || 'KH';
}

function linePill(lineType) {
  const l = lineType || 'Xách tay';
  if (l === 'Xách tay') return `<span class="line-pill line-xt">✈️ Xách tay</span>`;
  if (l === 'Thanh toán hộ') return `<span class="line-pill line-tth">💴 Thanh toán hộ</span>`;
  return `<span class="line-pill line-other">📦 ${esc(l)}</span>`;
}

function normalizePlatformName(raw = '') {
  const s = String(raw || '').trim();
  if (!s) return '';
  const up = s.toUpperCase();
  if (up === 'POIZON' || up === 'DEWU') return 'POIZON';
  if (up === 'TMALL') return 'TMALL';
  if (up === '1688') return '1688';
  if (s === '95分' || up === '95' || up === '95FEN') return '95分';
  if (up === 'TAOBAO') return 'TAOBAO';
  if (up === 'JINGDONG' || up === 'JD') return 'JINGDONG';
  if (up === 'PIN DUO DUO' || up === 'PINDUODUO' || up === 'PDD') return 'PIN DUO DUO';
  if (up === 'XIAN YU' || up === 'XIANYU') return 'XIAN YU';
  if (up === 'VIP SHOP' || up === 'VIPSHOP') return 'VIP SHOP';
  if (up === 'KHÁC') return 'Khác';
  return s;
}

function platformPill(platform) {
  const p = normalizePlatformName(platform);
  if (!p) return '';
  const clsMap = {
    'POIZON': 'shop-poizon',
    'TMALL': 'shop-tmall',
    '1688': 'shop-1688',
    '95分': 'shop-95',
    'TAOBAO': 'shop-taobao',
    'JINGDONG': 'shop-jd',
    'PIN DUO DUO': 'shop-pdd',
    'XIAN YU': 'shop-xianyu',
    'VIP SHOP': 'shop-vip'
  };
  const cls = clsMap[p] || 'shop-other';
  return `<span class="shop-pill ${cls}" title="Mua từ app ${esc(p)}">${esc(p)}</span>`;
}

function selectOrderPlatform(appVal) {
  const inp = document.getElementById('f_platform');
  if (!inp) return;
  const nextVal = inp.value === appVal ? '' : appVal;
  inp.value = nextVal;
  document.querySelectorAll('.shop-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.shop === nextVal);
  });
  formDirty = true;
}

function statusClass(s) {
  if (['Đã về kho Việt Nam', 'Đã về kho VN', 'Đã giao khách', 'Hoàn tất / Đã tất toán', 'Đặt hàng thành công', 'Đã thanh toán', 'Đã thanh toán hộ', 'Đã thu'].includes(s)) return 's-green';
  if (['Mới tạo / Chờ xử lý', 'Chờ khách thanh toán', 'Chờ người bán gửi', 'Chờ xác nhận', 'Chờ báo giá', 'Chờ thanh toán', 'Thu một phần'].includes(s)) return 's-amber';
  if (s === 'Đã hủy' || s === 'Chưa thu') return 's-red';
  return 's-blue';
}

function statusSelect(kind, id, current, stages) {
  return `<select class="status-select ${statusClass(current)}" aria-label="Đổi trạng thái" onchange="quickStatus('${kind}','${id}',this.value)">${stages.map(s => `<option value="${esc(s)}" ${s === current ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>`;
}

// ============================================================================
// AI TỰ ĐỘNG TÍNH TOÁN CHO TỪNG NOTE ĐƠN (MINH BẠCH DÒNG TIỀN)
// ============================================================================
function calcOrderMetrics(o) {
  if (o.status === 'Đã hủy') {
    return {
      finalGoodsVnd: 0,
      baseGoodsCostVnd: 0,
      shipCost: 0,
      shipCharge: 0,
      shipProfit: 0,
      packCost: 0,
      packCharge: 0,
      packProfit: 0,
      extraShipTotal: 0,
      extraShipPaid: 0,
      extraShipUnpaid: 0,
      serviceFee: 0,
      fxProfit: 0,
      extraCost: 0,
      totalCollectCustomer: 0,
      totalPayout: 0,
      netProfit: 0,
      customerPaid: 0,
      customerDebt: 0,
      warehouseDebt: 0,
      partnerDebt: 0
    };
  }
  const cny = parseNum(o.goodsCny);
  const vndInput = parseNum(o.goodsVndInput);
  const rateBuy = parseNum(o.rateBuy);
  const rateSell = parseNum(o.rateSell);
  const shipCost = Math.round(parseNum(o.shipCost));
  const shipCharge = Math.round(parseNum(o.shipCharge));

  // Tính chi phí & doanh thu đóng gói từ danh sách vật tư gắn vào đơn (giữ nguyên giá tại thời điểm phát sinh)
  const items = Array.isArray(o.packagingItems) ? o.packagingItems : [];
  const packCost = items.length > 0
    ? items.reduce((sum, it) => sum + Math.round(parseNum(it.costPrice) * parseNum(it.qty)), 0)
    : Math.round(parseNum(o.packCost));
  const packCharge = items.length > 0
    ? items.reduce((sum, it) => sum + Math.round(parseNum(it.sellPrice) * parseNum(it.qty)), 0)
    : Math.round(parseNum(o.packCharge));

  // Cước ship phát sinh liên kết với đơn hàng này (cộng vào tiền khách cần thanh toán, không tính là lợi nhuận mặc định)
  const linkedExtraShips = (db?.extraShipments || []).filter(x =>
    (o.id && x.orderId && x.orderId === o.id) ||
    (o.code && x.orderCode && String(x.orderCode).trim().toLowerCase() === String(o.code).trim().toLowerCase())
  );
  const extraShipTotal = linkedExtraShips.reduce((sum, x) => sum + Math.round(parseNum(x.amount)), 0);
  const extraShipPaid = linkedExtraShips.reduce((sum, x) => {
    const amt = Math.round(parseNum(x.amount));
    if (x.status === 'Đã thu') return sum + amt;
    if (x.status === 'Thu một phần') return sum + Math.min(amt, Math.max(0, Math.round(parseNum(x.paidAmount))));
    return sum;
  }, 0);
  const extraShipUnpaid = Math.max(0, extraShipTotal - extraShipPaid);

  const pct = parseNum(o.serviceFeePct);
  const feeManual = Math.round(parseNum(o.serviceFeeManual));
  const extraCost = Math.round(parseNum(o.extraCost));
  const includeGoods = o.includeGoodsInFlow !== undefined ? Boolean(o.includeGoodsInFlow) : ['Thanh toán hộ', 'Mua hộ trọn gói'].includes(o.lineType);

  const finalGoodsVnd = (cny > 0 && rateSell > 0) ? Math.round(cny * rateSell) : Math.round(vndInput);
  const baseGoodsCostVnd = (cny > 0 && rateSell > 0)
    ? Math.round(cny * (rateBuy > 0 ? rateBuy : rateSell))
    : Math.round(vndInput);

  // 1. Lãi phí vận chuyển = Cước thu khách - Cước gốc trả kho
  const shipProfit = shipCharge - shipCost;

  // 1b. Lãi dịch vụ đóng gói = Doanh thu đóng gói - Giá vốn vật tư đóng gói
  const packProfit = packCharge - packCost;

  // 2. Phí dịch vụ = Giá cuối sản phẩm × (% : 100), cước vận chuyển tính riêng
  const serviceFee = pct > 0 ? Math.round(finalGoodsVnd * (pct / 100)) : feeManual;

  // 3. Lãi tệ = Số tệ × (Tỷ giá tệ bán - Tỷ giá tệ thu/gốc) (tự động tính ngay khi có Số tệ, Tỷ giá gốc và Tỷ giá bán)
  const fxProfit = (cny > 0 && rateBuy > 0 && rateSell > 0) ? Math.round(cny * (rateSell - rateBuy)) : 0;

  // 4. Tổng phải thu từ khách (bao gồm phí dịch vụ, đóng gói và cước ship phát sinh liên kết)
  const totalCollectCustomer = (includeGoods ? finalGoodsVnd : 0) + serviceFee + packCharge + extraShipTotal;
  const totalPayout = (includeGoods ? baseGoodsCostVnd : 0) + shipCost + packCost + extraCost;

  // 5. Lợi nhuận thực tế của đơn (Cước ship phát sinh là khoản khách trả, không tính vào lợi nhuận mặc định)
  const netProfit = shipProfit + serviceFee + fxProfit + packProfit - extraCost;

  // 6. Công nợ khách hàng & Công nợ cước kho (Giữ nguyên Đã trả cước kho)
  const customerPaid = Math.round(parseNum(o.customerPaid)) + extraShipPaid;
  const customerDebt = Math.max(0, totalCollectCustomer - customerPaid);
  const warehouseDebt = o.warehousePaid ? 0 : shipCost;
  const partnerDebt = 0;

  return {
    finalGoodsVnd,
    baseGoodsCostVnd,
    shipCost,
    shipCharge,
    shipProfit,
    packCost,
    packCharge,
    packProfit,
    extraShipTotal,
    extraShipPaid,
    extraShipUnpaid,
    serviceFee,
    fxProfit,
    extraCost,
    totalCollectCustomer,
    totalPayout,
    netProfit,
    customerPaid,
    customerDebt,
    warehouseDebt,
    partnerDebt
  };
}

// ============================================================================
// HỆ THỐNG CHỐT KỲ KINH DOANH NGÀY 26 HÀNG THÁNG (MÚI GIỜ ASIA/HO_CHI_MINH)
// Chu kỳ: 26/M -> 25/(M+1) · Tự chốt lúc 00:00 ngày 26 · Không xóa dữ liệu gốc
// ============================================================================
function normalizeDateStr(dStr) {
  const s = String(dStr || '').trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function getBusinessPeriodForDate(dateStr) {
  const clean = normalizeDateStr(dateStr) || getVNParts().dateStr;
  const [y, m, d] = clean.split('-').map(Number);
  let sy = y, sm = m, ey = y, em = m;
  if (d >= BIZ_CLOSE_DAY) {
    if (m === 12) { ey = y + 1; em = 1; } else { em = m + 1; }
  } else {
    if (m === 1) { sy = y - 1; sm = 12; } else { sm = m - 1; }
  }
  const startDate = `${sy}-${pad2(sm)}-${pad2(BIZ_CLOSE_DAY)}`;
  const endDate = `${ey}-${pad2(em)}-${pad2(BIZ_CLOSE_DAY - 1)}`;
  const id = `${startDate}_${endDate}`;
  return {
    id,
    startDate,
    endDate,
    label: `Kỳ ${dateText(startDate)} – ${dateText(endDate)}`,
    shortLabel: `${pad2(BIZ_CLOSE_DAY)}/${pad2(sm)} – ${pad2(BIZ_CLOSE_DAY - 1)}/${pad2(em)}/${ey}`
  };
}

function getNextBusinessPeriod(p) {
  const [ey, em] = p.endDate.split('-').map(Number);
  return getBusinessPeriodForDate(`${ey}-${pad2(em)}-${pad2(BIZ_CLOSE_DAY)}`);
}

function getCurrentBusinessPeriod(nowInput) {
  return getBusinessPeriodForDate(getVNParts(nowInput).dateStr);
}

function getValidPaymentRecords() {
  const del = db.deletedIds || {};
  return (db.paymentRecords || []).filter(p => {
    if (!p || !p.id) return false;
    if (del[p.id]) return false;
    if (p.kind === 'order' && p.orderId && del[p.orderId]) return false;
    if (p.kind === 'extraship' && p.extraShipId && del[p.extraShipId]) return false;
    return true;
  });
}

function purgePaymentsForDeletedRecord(kind, targetId) {
  if (!targetId || !Array.isArray(db.paymentRecords)) return;
  db.paymentRecords = db.paymentRecords.filter(p => {
    const match = (kind === 'order' && p.orderId === targetId) ||
      (kind === 'extraship' && p.extraShipId === targetId);
    if (match) {
      markDeletedId(p.id);
      return false;
    }
    return true;
  });
}

function getOrderRecordedPaid(orderId, maxDate = '') {
  if (!orderId) return 0;
  return getValidPaymentRecords()
    .filter(p => p.kind === 'order' && p.orderId === orderId && (!maxDate || (normalizeDateStr(p.date) || '') <= maxDate))
    .reduce((sum, p) => sum + Math.max(0, Math.round(parseNum(p.amount))), 0);
}

function getExtraRecordedPaid(extraShipId, maxDate = '') {
  if (!extraShipId) return 0;
  return getValidPaymentRecords()
    .filter(p => p.kind === 'extraship' && p.extraShipId === extraShipId && (!maxDate || (normalizeDateStr(p.date) || '') <= maxDate))
    .reduce((sum, p) => sum + Math.max(0, Math.round(parseNum(p.amount))), 0);
}

function getOrderLegacyPaid(o) {
  const totalNow = Math.round(parseNum(o.customerPaid));
  const recordedAll = getOrderRecordedPaid(o.id);
  return Math.max(0, totalNow - recordedAll);
}

function getExtraCurrentPaid(x) {
  const amt = Math.round(parseNum(x.amount));
  if (x.status === 'Đã thu') return amt;
  if (x.status === 'Thu một phần') return Math.min(amt, Math.max(0, Math.round(parseNum(x.paidAmount))));
  return 0;
}

function getExtraLegacyPaid(x) {
  const currentPaid = getExtraCurrentPaid(x);
  const recordedAll = getExtraRecordedPaid(x.id);
  return Math.max(0, currentPaid - recordedAll);
}

function isExtraShipLinkedToOrder(x) {
  return (db.orderNotes || []).some(o =>
    o.status !== 'Đã hủy' && (
      (o.id && x.orderId && x.orderId === o.id) ||
      (o.code && x.orderCode && String(x.orderCode).trim().toLowerCase() === String(o.code).trim().toLowerCase())
    )
  );
}

// Tính công nợ khách hàng của 1 Note đơn tại thời điểm asOfDate (hoặc hiện tại nếu asOfDate rỗng)
function calcOrderDebtAsOf(o, asOfDate = '') {
  if (!o || o.status === 'Đã hủy') return 0;
  if (!asOfDate) return calcOrderMetrics(o).customerDebt;
  const oDate = normalizeDateStr(o.date);
  if (oDate && oDate > asOfDate) return 0;

  const m = calcOrderMetrics(o);
  const linkedExtrasAsOf = (db.extraShipments || []).filter(x => {
    const linked = (o.id && x.orderId && x.orderId === o.id) ||
      (o.code && x.orderCode && String(x.orderCode).trim().toLowerCase() === String(o.code).trim().toLowerCase());
    if (!linked) return false;
    const xDate = normalizeDateStr(x.date) || oDate;
    return !xDate || xDate <= asOfDate;
  });
  const extraTotalAsOf = linkedExtrasAsOf.reduce((s, x) => s + Math.round(parseNum(x.amount)), 0);
  const extraPaidAsOf = linkedExtrasAsOf.reduce((s, x) => s + getExtraLegacyPaid(x) + getExtraRecordedPaid(x.id, asOfDate), 0);

  const baseCollectWithoutExtra = Math.max(0, m.totalCollectCustomer - m.extraShipTotal);
  const totalCollectAsOf = baseCollectWithoutExtra + extraTotalAsOf;
  const orderPaidAsOf = getOrderLegacyPaid(o) + getOrderRecordedPaid(o.id, asOfDate);
  const paidAsOf = Math.min(totalCollectAsOf, orderPaidAsOf + extraPaidAsOf);
  return Math.max(0, totalCollectAsOf - paidAsOf);
}

function recordPaymentEvent({ kind, orderId = '', extraShipId = '', orderCode = '', customer = '', amount = 0, date = '', originDate = '', note = '' }) {
  const amt = Math.round(parseNum(amount));
  if (amt <= 0) return null;
  if (!Array.isArray(db.paymentRecords)) db.paymentRecords = [];
  const payDate = normalizeDateStr(date) || dateKey();
  const origDate = normalizeDateStr(originDate) || payDate;
  const originPeriod = getBusinessPeriodForDate(origDate);
  const paymentPeriod = getBusinessPeriodForDate(payDate);
  const rec = {
    id: 'pay_' + makeId(),
    kind: kind || 'order',
    orderId,
    extraShipId,
    orderCode: String(orderCode || ''),
    customer: String(customer || ''),
    amount: amt,
    date: payDate,
    originDate: origDate,
    originPeriodId: originPeriod.id,
    paymentPeriodId: paymentPeriod.id,
    isDebtRecovery: originPeriod.id !== paymentPeriod.id,
    note: String(note || ''),
    createdAt: nowStamp(true),
    updatedAtMs: Date.now()
  };
  db.paymentRecords.unshift(rec);
  return rec;
}

function reducePaymentEvents(kind, targetId, reduceAmt) {
  let rem = Math.round(parseNum(reduceAmt));
  if (rem <= 0 || !Array.isArray(db.paymentRecords)) return;
  for (let i = 0; i < db.paymentRecords.length && rem > 0; i++) {
    const p = db.paymentRecords[i];
    const match = (kind === 'order' && p.kind === 'order' && p.orderId === targetId) ||
      (kind === 'extraship' && p.kind === 'extraship' && p.extraShipId === targetId);
    if (!match) continue;
    const cur = Math.round(parseNum(p.amount));
    if (cur <= rem) {
      rem -= cur;
      markDeletedId(p.id);
      db.paymentRecords.splice(i, 1);
      i--;
    } else {
      p.amount = cur - rem;
      p.updatedAtMs = Date.now();
      rem = 0;
    }
  }
}

function recordClosedPeriodAdjustment(recordDate, action, target, detail) {
  const dStr = normalizeDateStr(recordDate);
  if (!dStr || !Array.isArray(db.businessPeriods)) return;
  const pInfo = getBusinessPeriodForDate(dStr);
  const closedP = db.businessPeriods.find(p => p.id === pInfo.id && p.status === 'closed');
  if (!closedP) return;
  if (!Array.isArray(closedP.adjustments)) closedP.adjustments = [];
  closedP.adjustments.unshift({
    id: 'adj_' + makeId(),
    time: nowStamp(true),
    action: String(action || 'Điều chỉnh sau chốt kỳ'),
    target: String(target || ''),
    detail: String(detail || '')
  });
  closedP.adjustments = closedP.adjustments.slice(0, 100);
  closedP.updatedAtMs = Date.now();
  addAuditLog('Điều chỉnh kỳ đã chốt', closedP.label, `[${action}] ${target}: ${detail}`);
}

function computeBusinessPeriodSnapshot(periodInfo) {
  const st = calcPeriodFinancials({
    startDate: periodInfo.startDate,
    endDate: periodInfo.endDate,
    periodId: periodInfo.id,
    asOfDate: periodInfo.endDate
  });
  const endingDebtItems = [];
  (db.orderNotes || []).filter(o => o.status !== 'Đã hủy').forEach(o => {
    const oDate = normalizeDateStr(o.date);
    if (oDate && oDate > periodInfo.endDate) return;
    const debtAtClose = calcOrderDebtAsOf(o, periodInfo.endDate);
    if (debtAtClose > 0) {
      endingDebtItems.push({
        orderId: o.id,
        orderCode: o.code || '',
        customer: o.customer || '',
        phone: o.phone || '',
        product: o.product || o.goodsType || '',
        orderDate: oDate,
        originPeriodId: getBusinessPeriodForDate(oDate || periodInfo.startDate).id,
        debtAtClose
      });
    }
  });
  (db.extraShipments || []).forEach(x => {
    if (isExtraShipLinkedToOrder(x)) return;
    const xDate = normalizeDateStr(x.date);
    if (xDate && xDate > periodInfo.endDate) return;
    const unpaid = Math.max(0, Math.round(parseNum(x.amount)) - (getExtraLegacyPaid(x) + getExtraRecordedPaid(x.id, periodInfo.endDate)));
    if (unpaid > 0) {
      endingDebtItems.push({
        orderId: '',
        extraShipId: x.id,
        orderCode: x.orderCode || '',
        customer: x.customer || '',
        phone: '',
        product: `Cước ship PS: ${x.content || ''}`,
        orderDate: xDate,
        originPeriodId: getBusinessPeriodForDate(xDate || periodInfo.startDate).id,
        debtAtClose: unpaid
      });
    }
  });
  return {
    orderCount: st.orderCount,
    shipmentCount: st.shipmentCount,
    purchaseCount: st.purchaseCount,
    totalTrafficOrders: st.totalTrafficOrders,
    txCount: st.txCount,
    netProfit: st.netProfit,
    shipCostTotal: st.shipCostTotal,
    shipChargeTotal: st.shipChargeTotal,
    shipProfitTotal: st.shipProfitTotal,
    packCostTotal: st.packCostTotal,
    packChargeTotal: st.packChargeTotal,
    packProfitTotal: st.packProfitTotal,
    totalServiceRevenue: st.totalServiceRevenue,
    fxProfitTotal: st.fxProfitTotal,
    txOtherIn: st.txOtherIn,
    totalIncidentalExpense: st.totalIncidentalExpense,
    totalCollectedFromCustomer: st.totalCollectedFromCustomer,
    periodDirectCollected: st.periodDirectCollected,
    debtRecoveryIn: st.debtRecoveryIn,
    totalBilledCustomer: st.totalBilledCustomer,
    totalTransferredOut: st.totalTransferredOut,
    txIn: st.txIn,
    txOut: st.txOut,
    periodNewCustomerDebt: st.periodNewCustomerDebt,
    endingCustomerDebt: st.allCustomerDebt,
    endingWarehouseDebt: st.allWarehouseUnpaid,
    endingDebtItems
  };
}

// Tự động đối chiếu và chốt các kỳ kinh doanh đã qua 00:00 ngày 26 (Asia/Ho_Chi_Minh)
// Hoạt động kể cả khi ứng dụng không được mở lúc 00:00 ngày 26 (idempotent, không tạo trùng kỳ)
function reconcileBusinessPeriods(nowInput, opts = {}) {
  if (!Array.isArray(db.businessPeriods)) db.businessPeriods = [];
  if (!Array.isArray(db.paymentRecords)) db.paymentRecords = [];
  const curP = getCurrentBusinessPeriod(nowInput);
  const periodMap = new Map();
  db.businessPeriods.forEach(p => { if (p && p.id) periodMap.set(p.id, p); });

  // Thu thập tất cả kỳ có dữ liệu phát sinh trước hoặc trong kỳ hiện tại
  const discoveredIds = new Set(periodMap.keys());
  const collectDate = dStr => {
    const clean = normalizeDateStr(dStr);
    if (!clean || clean > curP.endDate) return;
    discoveredIds.add(getBusinessPeriodForDate(clean).id);
  };
  (db.orderNotes || []).forEach(o => collectDate(o.date));
  (db.shipments || []).forEach(s => collectDate(s.date));
  (db.purchases || []).forEach(p => collectDate(p.date));
  (db.transactions || []).forEach(t => collectDate(t.date));
  (db.extraShipments || []).forEach(x => collectDate(x.date));
  (db.paymentRecords || []).forEach(p => collectDate(p.date));
  discoveredIds.add(curP.id);

  let changed = false;
  const newlyClosed = [];

  discoveredIds.forEach(pid => {
    const [startDate, endDate] = pid.split('_');
    if (!normalizeDateStr(startDate) || !normalizeDateStr(endDate)) return;
    const pInfo = getBusinessPeriodForDate(startDate);
    const existing = periodMap.get(pid);

    if (pInfo.endDate < curP.startDate) {
      // Kỳ đã kết thúc qua 00:00 ngày 26 -> tự động chốt và bảo toàn snapshot cuối kỳ
      if (!existing || existing.status !== 'closed' || !existing.snapshot) {
        const nextP = getNextBusinessPeriod(pInfo);
        const snap = computeBusinessPeriodSnapshot(pInfo);
        const closedObj = {
          id: pInfo.id,
          label: pInfo.label,
          shortLabel: pInfo.shortLabel,
          startDate: pInfo.startDate,
          endDate: pInfo.endDate,
          status: 'closed',
          closedAt: `00:00:00 - ${dateText(nextP.startDate)} (${APP_TIMEZONE})`,
          closedAtMs: Date.now(),
          snapshot: snap,
          adjustments: Array.isArray(existing?.adjustments) ? existing.adjustments : [],
          updatedAtMs: Date.now()
        };
        periodMap.set(pInfo.id, closedObj);
        newlyClosed.push(pInfo.label);
        changed = true;
      }
    } else if (pInfo.id === curP.id) {
      if (!existing || existing.status !== 'active') {
        periodMap.set(curP.id, {
          id: curP.id,
          label: curP.label,
          shortLabel: curP.shortLabel,
          startDate: curP.startDate,
          endDate: curP.endDate,
          status: 'active',
          closedAt: '',
          closedAtMs: 0,
          snapshot: null,
          adjustments: Array.isArray(existing?.adjustments) ? existing.adjustments : [],
          updatedAtMs: Date.now()
        });
        changed = true;
      }
    }
  });

  db.businessPeriods = [...periodMap.values()].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));

  const periodRolledOver = Boolean(lastActiveBizPeriodId && lastActiveBizPeriodId !== curP.id);
  const wasViewingOldActive = !selectedBusinessPeriodId || selectedBusinessPeriodId === lastActiveBizPeriodId;
  if (wasViewingOldActive || !periodMap.has(selectedBusinessPeriodId)) {
    selectedBusinessPeriodId = curP.id;
  }
  lastActiveBizPeriodId = curP.id;

  if (newlyClosed.length > 0 && !opts.silent) {
    if (typeof saveAutoSnapshot === 'function') {
      saveAutoSnapshot(`Tự động chốt kỳ ${newlyClosed.join(', ')}`, true);
    }
    addAuditLog('Tự động chốt kỳ 26', newlyClosed.join(', '), `Đã tự động chốt kỳ lúc 00:00 ngày 26 (${APP_TIMEZONE}) và mở ${curP.label} từ 0.`);
  }
  if (changed && !opts.skipPersist) {
    persist({ skipSnapshot: true });
  }
  return { currentPeriod: curP, newlyClosed, periodRolledOver, changed };
}

function getSelectedBusinessPeriod() {
  const curP = getCurrentBusinessPeriod();
  const list = Array.isArray(db.businessPeriods) ? db.businessPeriods : [];
  const found = list.find(p => p.id === selectedBusinessPeriodId) || list.find(p => p.id === curP.id);
  if (found) return found;
  return { ...curP, status: 'active', closedAt: '', snapshot: null, adjustments: [] };
}

function selectBusinessPeriod(periodId) {
  selectedBusinessPeriodId = periodId || getCurrentBusinessPeriod().id;
  periodMode = 'bizperiod';
  render();
}

function openBusinessPeriodOnDashboard(periodId) {
  selectedBusinessPeriodId = periodId || getCurrentBusinessPeriod().id;
  periodMode = 'bizperiod';
  view = 'overview';
  document.querySelectorAll('.nav').forEach(n => n.classList.toggle('active', n.dataset.view === 'overview'));
  render();
}

function startPeriodCloseWatcher() {
  if (periodWatcherTimer) clearInterval(periodWatcherTimer);
  periodWatcherTimer = setInterval(() => {
    const res = reconcileBusinessPeriods();
    if (res.newlyClosed.length > 0 || res.periodRolledOver) {
      render();
      toast(`📅 Đã tự động chốt kỳ và bắt đầu ${res.currentPeriod.label} từ 0!`);
    }
  }, 30000);
}

// ============================================================================
// TỔNG HỢP DÒNG TIỀN & BÁO CÁO TÀI CHÍNH THEO KỲ NGÀY 26 / NGÀY / THÁNG / NĂM
// ============================================================================
function getActivePeriodFilter() {
  if (periodMode === 'bizperiod') {
    const bp = getSelectedBusinessPeriod();
    return {
      mode: 'bizperiod',
      periodId: bp.id,
      startDate: bp.startDate,
      endDate: bp.endDate,
      status: bp.status,
      asOfDate: bp.status === 'closed' ? bp.endDate : '',
      periodObj: bp
    };
  }
  if (periodMode === 'day') {
    const d = periodDate || dateKey();
    return { mode: 'day', prefix: d, startDate: d, endDate: d, periodId: '', asOfDate: '' };
  }
  if (periodMode === 'month') {
    const m = periodMonth || dateKey().slice(0, 7);
    return { mode: 'month', prefix: m, startDate: '', endDate: '', periodId: '', asOfDate: '' };
  }
  if (periodMode === 'year') {
    const y = periodYear || String(getVNParts().year);
    return { mode: 'year', prefix: y, startDate: '', endDate: '', periodId: '', asOfDate: '' };
  }
  return { mode: 'all', prefix: '', startDate: '', endDate: '', periodId: '', asOfDate: '' };
}

function getActivePeriodPrefix() {
  return getActivePeriodFilter();
}

function matchesDateFilter(dStr, filterSpec) {
  if (!filterSpec) return true;
  const clean = normalizeDateStr(dStr);
  if (typeof filterSpec === 'string') {
    if (!filterSpec) return true;
    return clean.startsWith(filterSpec);
  }
  if (filterSpec.startDate && filterSpec.endDate) {
    return Boolean(clean && clean >= filterSpec.startDate && clean <= filterSpec.endDate);
  }
  if (filterSpec.prefix) {
    return clean.startsWith(filterSpec.prefix);
  }
  return true;
}

function getPeriodLabel(filterSpec = null) {
  if (filterSpec && filterSpec.periodObj) return filterSpec.periodObj.label;
  if (periodMode === 'bizperiod') return getSelectedBusinessPeriod().label;
  if (periodMode === 'day') return `Ngày ${dateText(periodDate)}`;
  if (periodMode === 'month') {
    const [y, m] = (periodMonth || dateKey().slice(0, 7)).split('-');
    return `Tháng ${m}/${y}`;
  }
  if (periodMode === 'year') return `Năm ${periodYear}`;
  return 'Toàn bộ thời gian';
}

function calcPeriodFinancials(filterSpec = '') {
  const isObj = filterSpec && typeof filterSpec === 'object';
  const periodId = isObj ? (filterSpec.periodId || '') : '';
  const asOfDate = isObj ? (filterSpec.asOfDate || '') : '';
  const matchDate = d => matchesDateFilter(d, filterSpec);

  const orders = (db.orderNotes || []).filter(o => o.status !== 'Đã hủy' && matchDate(o.date));
  const shipmentsInPeriod = (db.shipments || []).filter(s => matchDate(s.date));
  const purchasesInPeriod = (db.purchases || []).filter(p => matchDate(p.date));
  const extraShipsInPeriod = (db.extraShipments || []).filter(x => matchDate(x.date));
  const txs = (db.transactions || []).filter(x => matchDate(x.date));
  const paymentsInPeriod = getValidPaymentRecords().filter(p => matchDate(p.date));

  let orderBilledCustomer = 0;
  let legacyOrderCollected = 0;
  let orderActualOut = 0;
  let orderCommittedOut = 0;
  let shipCostTotal = 0;
  let shipChargeTotal = 0;
  let shipProfitTotal = 0;
  let packCostTotal = 0;
  let packChargeTotal = 0;
  let packProfitTotal = 0;
  let orderServiceFeeTotal = 0;
  let fxProfitTotal = 0;
  let orderExtraCostTotal = 0;
  let periodNewCustomerDebt = 0;

  orders.forEach(o => {
    const m = calcOrderMetrics(o);
    orderBilledCustomer += m.totalCollectCustomer;
    legacyOrderCollected += getOrderLegacyPaid(o);
    orderCommittedOut += m.totalPayout;
    const whPaidInThisPeriod = o.warehousePaid && (!o.warehousePaidDate || matchDate(o.warehousePaidDate));
    orderActualOut += ((o.includeGoodsInFlow && o.partnerPaid) ? m.baseGoodsCostVnd : 0) + (whPaidInThisPeriod ? m.shipCost : 0) + m.packCost + m.extraCost;
    shipCostTotal += m.shipCost;
    shipChargeTotal += m.shipCharge;
    shipProfitTotal += m.shipProfit;
    packCostTotal += m.packCost;
    packChargeTotal += m.packCharge;
    packProfitTotal += m.packProfit;
    orderServiceFeeTotal += m.serviceFee;
    fxProfitTotal += m.fxProfit;
    orderExtraCostTotal += m.extraCost;
    periodNewCustomerDebt += calcOrderDebtAsOf(o, asOfDate);
  });

  // Cộng tiền trả cước kho của đơn kỳ trước nếu thực trả vào kỳ này
  (db.orderNotes || []).filter(o => o.status !== 'Đã hủy' && !matchDate(o.date) && o.warehousePaid && o.warehousePaidDate && matchDate(o.warehousePaidDate)).forEach(o => {
    orderActualOut += calcOrderMetrics(o).shipCost;
  });

  // Cước ship phát sinh (legacy paid + công nợ phát sinh của cước ship không gắn đơn)
  let legacyExtraCollected = 0;
  extraShipsInPeriod.forEach(x => {
    legacyExtraCollected += getExtraLegacyPaid(x);
    if (!isExtraShipLinkedToOrder(x)) {
      const paidAsOf = getExtraLegacyPaid(x) + getExtraRecordedPaid(x.id, asOfDate);
      periodNewCustomerDebt += Math.max(0, Math.round(parseNum(x.amount)) - paidAsOf);
    }
  });

  (db.packagingCatalog || []).filter(item => matchDate(item.date)).forEach(item => {
    const q = Math.max(0, parseNum(item.qty));
    const c = Math.round(parseNum(item.costPrice) * q);
    const r = Math.round(parseNum(item.sellPrice) * q);
    packCostTotal += c;
    packChargeTotal += r;
    packProfitTotal += (r - c);
  });

  // Ghi nhận dòng tiền thực thu từ paymentRecords theo ĐÚNG NGÀY KHÁCH THANH TOÁN (kể cả thu công nợ kỳ trước)
  let recordedPaymentIn = 0;
  let debtRecoveryIn = 0;
  paymentsInPeriod.forEach(p => {
    const amt = Math.max(0, Math.round(parseNum(p.amount)));
    recordedPaymentIn += amt;
    if (periodId ? (p.originPeriodId && p.originPeriodId !== periodId) : Boolean(p.isDebtRecovery)) {
      debtRecoveryIn += amt;
    }
  });

  const nonProfitInCategories = ['Phí dịch vụ', 'Phí mua hộ', 'Đóng gói', 'Thu hộ', 'Thu công nợ', 'Thu công nợ kỳ trước'];
  const txIn = txs.filter(x => x.type === 'Thu').reduce((a, x) => a + parseNum(x.amount), 0);
  const txOut = txs.filter(x => x.type === 'Chi').reduce((a, x) => a + parseNum(x.amount), 0);
  const txServiceIn = txs.filter(x => x.type === 'Thu' && ['Phí dịch vụ', 'Phí mua hộ'].includes(x.category)).reduce((a, x) => a + parseNum(x.amount), 0);
  const txPackIn = txs.filter(x => x.type === 'Thu' && x.category === 'Đóng gói').reduce((a, x) => a + parseNum(x.amount), 0);
  const txPassThroughIn = txs.filter(x => x.type === 'Thu' && ['Thu hộ', 'Thu công nợ', 'Thu công nợ kỳ trước'].includes(x.category)).reduce((a, x) => a + parseNum(x.amount), 0);
  const txOtherIn = txs.filter(x => x.type === 'Thu' && !nonProfitInCategories.includes(x.category)).reduce((a, x) => a + parseNum(x.amount), 0);

  // Tổng công nợ thực tế còn phải thu (BẢO TOÀN XUYÊN KỲ — không bao giờ reset về 0 khi chốt kỳ)
  let allCustomerDebt = 0;
  let allWarehouseUnpaid = 0;
  let allPartnerUnpaid = 0;
  (db.orderNotes || []).filter(o => o.status !== 'Đã hủy').forEach(o => {
    const oDate = normalizeDateStr(o.date);
    if (asOfDate && oDate && oDate > asOfDate) return;
    allCustomerDebt += calcOrderDebtAsOf(o, asOfDate);
    const m = calcOrderMetrics(o);
    const whUnpaidAsOf = asOfDate
      ? (!o.warehousePaid || (o.warehousePaidDate && o.warehousePaidDate > asOfDate))
      : !o.warehousePaid;
    allWarehouseUnpaid += whUnpaidAsOf ? m.shipCost : 0;
    allPartnerUnpaid += m.partnerDebt;
  });
  (db.extraShipments || []).forEach(x => {
    if (isExtraShipLinkedToOrder(x)) return;
    const xDate = normalizeDateStr(x.date);
    if (asOfDate && xDate && xDate > asOfDate) return;
    const paidAsOf = asOfDate
      ? (getExtraLegacyPaid(x) + getExtraRecordedPaid(x.id, asOfDate))
      : getExtraCurrentPaid(x);
    allCustomerDebt += Math.max(0, Math.round(parseNum(x.amount)) - paidAsOf);
  });

  const periodDirectCollected = legacyOrderCollected + legacyExtraCollected + Math.max(0, recordedPaymentIn - debtRecoveryIn);
  const totalCollectedFromCustomer = legacyOrderCollected + legacyExtraCollected + recordedPaymentIn + txIn;
  const totalBilledCustomer = orderBilledCustomer + txIn;
  const totalTransferredOut = orderActualOut + txOut;
  const totalServiceRevenue = orderServiceFeeTotal + txServiceIn;
  const totalPackProfit = packProfitTotal + txPackIn;
  const totalIncidentalExpense = orderExtraCostTotal + txOut;
  // Lợi nhuận thực tế giữ nguyên công thức: KHÔNG biến tiền thu công nợ kỳ cũ / thu hộ thành lợi nhuận mới
  const netProfit = shipProfitTotal + totalServiceRevenue + fxProfitTotal + totalPackProfit + txOtherIn - totalIncidentalExpense;

  return {
    orderCount: orders.length,
    shipmentCount: shipmentsInPeriod.length,
    purchaseCount: purchasesInPeriod.length,
    totalTrafficOrders: orders.length + shipmentsInPeriod.length + purchasesInPeriod.length,
    txCount: txs.length,
    paymentCount: paymentsInPeriod.length,
    txIn,
    txOut,
    txPassThroughIn,
    periodDirectCollected,
    debtRecoveryIn,
    totalCollectedFromCustomer,
    totalBilledCustomer,
    totalTransferredOut,
    orderCommittedOut: orderCommittedOut + txOut,
    periodNewCustomerDebt,
    allWarehouseUnpaid,
    allCustomerDebt,
    allPartnerUnpaid,
    shipCostTotal,
    shipChargeTotal,
    shipProfitTotal,
    packCostTotal,
    packChargeTotal,
    packProfitTotal: totalPackProfit,
    totalServiceRevenue,
    fxProfitTotal,
    txOtherIn,
    totalIncidentalExpense,
    netProfit
  };
}

// ============================================================================
// BIỂU ĐỒ MÀU SẮC TRỰC QUAN (COREUI & CREATIVE TIM DASHBOARD WIDGETS)
// ============================================================================
function renderCoreUiWidgets(chartStats, allStats, chartPeriodLabel, allPendingCount, periodObj = null, filterSpec = null) {
  const hideProfit = currentUserRole === 'warehouse';
  const isClosedView = Boolean(periodObj && periodObj.status === 'closed' && periodObj.snapshot);
  const packCount = (db.orderNotes || []).filter(o =>
    o.status !== 'Đã hủy' &&
    matchesDateFilter(o.date, filterSpec) &&
    (parseNum(o.packCharge) > 0 || (o.packagingType && o.packagingType !== 'Tiêu chuẩn (Miễn phí)'))
  ).length;

  const debtMainVal = isClosedView ? periodObj.snapshot.endingCustomerDebt : allStats.allCustomerDebt;
  const debtMainLabel = isClosedView
    ? `📥 Phải thu khách chốt cuối kỳ (${dateText(periodObj.endDate)})`
    : '📥 Khách còn nợ phải thu (Thực tế)';
  const oldDebtCarry = Math.max(0, allStats.allCustomerDebt - (chartStats.periodNewCustomerDebt || 0));
  const debtSubText = isClosedView
    ? `Phát sinh trong kỳ: ${money(periodObj.snapshot.periodNewCustomerDebt)} ₫ · Nợ hiện tại: ${money(allStats.allCustomerDebt)} ₫`
    : `Phát sinh kỳ này: ${money(chartStats.periodNewCustomerDebt)} ₫ · Kỳ trước chuyển sang: ${money(oldDebtCarry)} ₫`;

  const cashSubText = chartStats.debtRecoveryIn > 0
    ? `Thu nợ kỳ trước: +${shortMoney(chartStats.debtRecoveryIn)} ₫ · Chi/Chuyển ra: −${shortMoney(chartStats.totalTransferredOut)} ₫`
    : `Phát sinh phải thu: ${shortMoney(chartStats.totalBilledCustomer)} ₫ · Chi/Chuyển ra: −${shortMoney(chartStats.totalTransferredOut)} ₫`;

  const scopeTag = isClosedView ? 'ĐÃ CHỐT' : 'KỲ NÀY';

  return `<div class="coreui-kpi-grid">
    <div class="coreui-widget w-blue" onclick="${hideProfit ? "setView('orders',document.querySelector('[data-view=orders]'))" : "openFinanceSubtab('report')"}">
      <div class="widget-top">
        <div>
          <div class="widget-val">${hideProfit ? `${chartStats.orderCount} Note đơn` : `${chartStats.netProfit > 0 ? '+' : ''}${money(chartStats.netProfit)} ₫`}</div>
          <div class="widget-label">${hideProfit ? `Note đơn (${esc(chartPeriodLabel)})` : `Lợi nhuận thực tế (${esc(chartPeriodLabel)})`}</div>
          <div class="widget-sub">${hideProfit ? `Đóng gói kỹ trong kỳ: ${packCount} đơn` : `Cước +${shortMoney(chartStats.shipProfitTotal)} · DV +${shortMoney(chartStats.totalServiceRevenue)} · ĐG +${shortMoney(chartStats.packProfitTotal || 0)} · Tệ +${shortMoney(chartStats.fxProfitTotal)}`}</div>
        </div>
        <span class="widget-scope-pill">${scopeTag}</span>
      </div>
      <svg class="widget-spark" viewBox="0 0 240 56" preserveAspectRatio="none" aria-hidden="true">
        <polyline fill="none" stroke="rgba(255,255,255,0.65)" stroke-width="2" points="14,42 52,22 90,34 128,14 166,24 204,12 228,36"/>
        <circle cx="14" cy="42" r="3.5" fill="#20a8d8" stroke="#fff" stroke-width="2"/>
        <circle cx="52" cy="22" r="3.5" fill="#20a8d8" stroke="#fff" stroke-width="2"/>
        <circle cx="90" cy="34" r="3.5" fill="#20a8d8" stroke="#fff" stroke-width="2"/>
        <circle cx="128" cy="14" r="3.5" fill="#20a8d8" stroke="#fff" stroke-width="2"/>
        <circle cx="166" cy="24" r="3.5" fill="#20a8d8" stroke="#fff" stroke-width="2"/>
        <circle cx="204" cy="12" r="3.5" fill="#20a8d8" stroke="#fff" stroke-width="2"/>
        <circle cx="228" cy="36" r="3.5" fill="#20a8d8" stroke="#fff" stroke-width="2"/>
      </svg>
    </div>

    <div class="coreui-widget w-cyan" onclick="openFinanceSubtab('cashflow')">
      <div class="widget-top">
        <div>
          <div class="widget-val">${hideProfit ? `${chartStats.shipmentCount} Ký gửi` : `${money(chartStats.totalCollectedFromCustomer)} ₫`}</div>
          <div class="widget-label">${hideProfit ? `Đơn ký gửi (${esc(chartPeriodLabel)})` : `Tiền đã thu trong kỳ (${esc(chartPeriodLabel)})`}</div>
          <div class="widget-sub">${hideProfit ? 'Bấm để quản lý mã vận đơn' : cashSubText}</div>
        </div>
        <span class="widget-scope-pill">${scopeTag}</span>
      </div>
      <svg class="widget-spark" viewBox="0 0 240 56" preserveAspectRatio="none" aria-hidden="true">
        <polyline fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2" points="14,46 54,36 94,26 134,12 174,25 214,34 228,44"/>
        <circle cx="14" cy="46" r="3.5" fill="#63c2de" stroke="#fff" stroke-width="2"/>
        <circle cx="54" cy="36" r="3.5" fill="#63c2de" stroke="#fff" stroke-width="2"/>
        <circle cx="94" cy="26" r="3.5" fill="#63c2de" stroke="#fff" stroke-width="2"/>
        <circle cx="134" cy="12" r="3.5" fill="#63c2de" stroke="#fff" stroke-width="2"/>
        <circle cx="174" cy="25" r="3.5" fill="#63c2de" stroke="#fff" stroke-width="2"/>
        <circle cx="214" cy="34" r="3.5" fill="#63c2de" stroke="#fff" stroke-width="2"/>
      </svg>
    </div>

    <div class="coreui-widget w-amber" onclick="openFinanceSubtab('debts')">
      <div class="widget-top">
        <div>
          <div class="widget-val">${money(debtMainVal)} ₫</div>
          <div class="widget-label">${esc(debtMainLabel)}</div>
          <div class="widget-sub">${esc(debtSubText)}</div>
        </div>
        <span class="widget-scope-pill scope-carry">${isClosedView ? 'CHỐT KỲ' : 'XUYÊN KỲ'}</span>
      </div>
      <svg class="widget-spark" viewBox="0 0 240 56" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,38 Q45,10 95,22 T185,34 T240,18 L240,56 L0,56 Z" fill="rgba(255,255,255,0.25)"/>
        <path d="M0,38 Q45,10 95,22 T185,34 T240,18" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2"/>
      </svg>
    </div>

    <div class="coreui-widget w-red" onclick="setView('orders',document.querySelector('[data-view=orders]'))">
      <div class="widget-top">
        <div>
          <div class="widget-val">${chartStats.totalTrafficOrders} đơn</div>
          <div class="widget-label">Lưu lượng đơn hàng (${esc(chartPeriodLabel)})</div>
          <div class="widget-sub">${chartStats.orderCount} Note đơn · ${chartStats.shipmentCount} Ký gửi · ${chartStats.purchaseCount} Mua hộ</div>
        </div>
        <span class="widget-scope-pill">${scopeTag}</span>
      </div>
      <svg class="widget-spark" viewBox="0 0 240 56" preserveAspectRatio="none" aria-hidden="true">
        ${[28, 38, 18, 32, 42, 26, 20, 36, 24, 40, 22, 34, 18, 38, 28, 22].map((h, i) => `<rect x="${10 + i * 14}" y="${56 - h}" width="7" height="${h}" rx="1.5" fill="rgba(255,255,255,0.45)"/>`).join('')}
      </svg>
    </div>
  </div>`;
}

function renderTrafficChartCard(s, periodLabel, filterSpec = null) {
  const activeFilter = filterSpec || getActivePeriodFilter();
  const bucketMap = new Map();
  const useMonthly = activeFilter.mode === 'year';
  const matchDate = d => matchesDateFilter(d, activeFilter);

  const getKey = d => {
    const raw = normalizeDateStr(d) || dateKey();
    return useMonthly ? raw.slice(0, 7) : raw;
  };
  const ensure = k => {
    if (!bucketMap.has(k)) bucketMap.set(k, { key: k, moneyIn: 0, moneyOut: 0, profit: 0, orders: 0 });
    return bucketMap.get(k);
  };

  (db.orderNotes || []).filter(o => o.status !== 'Đã hủy' && matchDate(o.date)).forEach(o => {
    const b = ensure(getKey(o.date));
    const m = calcOrderMetrics(o);
    b.orders += 1;
    b.moneyIn += getOrderLegacyPaid(o);
    const whPaidSame = o.warehousePaid && (!o.warehousePaidDate || matchDate(o.warehousePaidDate));
    b.moneyOut += ((o.includeGoodsInFlow && o.partnerPaid) ? m.baseGoodsCostVnd : 0) + (whPaidSame ? m.shipCost : 0) + m.packCost + m.extraCost;
    b.profit += m.netProfit;
  });

  (db.shipments || []).filter(sh => matchDate(sh.date)).forEach(sh => {
    ensure(getKey(sh.date)).orders += 1;
  });

  (db.purchases || []).filter(pu => matchDate(pu.date)).forEach(pu => {
    ensure(getKey(pu.date)).orders += 1;
  });

  (db.extraShipments || []).filter(x => matchDate(x.date)).forEach(x => {
    const lp = getExtraLegacyPaid(x);
    if (lp > 0) ensure(getKey(x.date)).moneyIn += lp;
  });

  // Cộng tiền khách thanh toán (kể cả công nợ kỳ cũ) vào đúng ngày thực thu — KHÔNG cộng trùng lợi nhuận
  getValidPaymentRecords().filter(p => matchDate(p.date)).forEach(p => {
    const amt = Math.max(0, Math.round(parseNum(p.amount)));
    if (amt > 0) ensure(getKey(p.date)).moneyIn += amt;
  });

  const nonProfitCats = ['Thu hộ', 'Thu công nợ', 'Thu công nợ kỳ trước'];
  (db.transactions || []).filter(x => matchDate(x.date)).forEach(x => {
    const b = ensure(getKey(x.date));
    const amt = parseNum(x.amount);
    if (x.type === 'Thu') {
      b.moneyIn += amt;
      if (!nonProfitCats.includes(x.category)) b.profit += amt;
    } else {
      b.moneyOut += amt;
      b.profit -= amt;
    }
  });

  // Tuyệt đối không tạo dữ liệu giả: chỉ hiển thị điểm dữ liệu thật trong kỳ
  const pts = [...bucketMap.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-12);
  const hasRealPoints = pts.length > 0;

  const maxV = hasRealPoints ? Math.max(100000, ...pts.flatMap(p => [p.moneyIn, p.moneyOut, Math.abs(p.profit)])) : 100000;
  const W = 760;
  const H = 195;
  const padL = 48;
  const padR = 18;
  const padT = 14;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const toX = idx => padL + (pts.length <= 1 ? plotW / 2 : (idx / (pts.length - 1)) * plotW);
  const toY = val => padT + plotH - Math.min(1, Math.max(0, val / maxV)) * plotH;

  const smoothPath = arr => {
    if (!arr.length) return '';
    if (arr.length === 1) return `M ${arr[0].x.toFixed(1)} ${arr[0].y.toFixed(1)}`;
    let d = `M ${arr[0].x.toFixed(1)} ${arr[0].y.toFixed(1)}`;
    for (let i = 0; i < arr.length - 1; i++) {
      const p0 = arr[i];
      const p1 = arr[i + 1];
      const cx = ((p0.x + p1.x) / 2).toFixed(1);
      d += ` C ${cx} ${p0.y.toFixed(1)}, ${cx} ${p1.y.toFixed(1)}, ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
    }
    return d;
  };

  const inCoords = pts.map((p, i) => ({ x: toX(i), y: toY(p.moneyIn), lbl: shortDateLabel(p.key), v: p.moneyIn, orders: p.orders }));
  const profCoords = pts.map((p, i) => ({ x: toX(i), y: toY(Math.max(0, p.profit)), v: p.profit }));
  const outCoords = pts.map((p, i) => ({ x: toX(i), y: toY(p.moneyOut), v: p.moneyOut }));

  const inLine = smoothPath(inCoords);
  const inArea = inCoords.length >= 2
    ? `${inLine} L ${inCoords[inCoords.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${inCoords[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
    : '';
  const profLine = smoothPath(profCoords);
  const outLine = smoothPath(outCoords);

  const posSum = Math.max(0, s.shipProfitTotal) + Math.max(0, s.totalServiceRevenue) + Math.max(0, s.packProfitTotal || 0) + Math.max(0, s.fxProfitTotal);
  const pctShip = posSum > 0 ? Math.min(100, Math.round((Math.max(0, s.shipProfitTotal) / posSum) * 100)) : 0;
  const pctFee = posSum > 0 ? Math.min(100, Math.round((Math.max(0, s.totalServiceRevenue) / posSum) * 100)) : 0;
  const pctPack = posSum > 0 ? Math.min(100, Math.round((Math.max(0, s.packProfitTotal || 0) / posSum) * 100)) : 0;
  const pctFx = posSum > 0 ? Math.min(100, Math.round((Math.max(0, s.fxProfitTotal) / posSum) * 100)) : 0;
  const collectRatio = s.totalBilledCustomer > 0 ? Math.min(100, Math.round((s.totalCollectedFromCustomer / s.totalBilledCustomer) * 100)) : (s.totalCollectedFromCustomer > 0 ? 100 : 0);

  return `<div class="traffic-card">
    <div class="traffic-head">
      <div>
        <h3 class="traffic-title">Traffic · Lưu lượng Đơn hàng, Dòng tiền & Lợi nhuận</h3>
        <div class="traffic-sub">${esc(periodLabel)} · <b>${s.totalTrafficOrders} đơn</b> (${s.orderCount} Note đơn · ${s.shipmentCount} Ký gửi · ${s.purchaseCount} Mua hộ) · Xanh lam: Thu · Xanh lá: Lãi · Đứt nét đỏ: Chi</div>
      </div>
      <div class="traffic-controls">
        <div class="btn-group-seg" role="group" aria-label="Chế độ kỳ báo cáo">
          <button type="button" class="seg-btn ${periodMode === 'bizperiod' ? 'active' : ''}" onclick="periodMode='bizperiod';render()">Kỳ 26</button>
          <button type="button" class="seg-btn ${periodMode === 'day' ? 'active' : ''}" onclick="periodMode='day';render()">Ngày</button>
          <button type="button" class="seg-btn ${periodMode === 'month' ? 'active' : ''}" onclick="periodMode='month';render()">Tháng</button>
          <button type="button" class="seg-btn ${periodMode === 'year' ? 'active' : ''}" onclick="periodMode='year';render()">Năm</button>
          <button type="button" class="seg-btn ${periodMode === 'all' ? 'active' : ''}" onclick="periodMode='all';render()">Tất cả</button>
        </div>
        <button type="button" class="cloud-btn" onclick="openFinanceSubtab('periods')" title="Xem lịch sử các kỳ chốt ngày 26">📅</button>
      </div>
    </div>

    <div class="traffic-chart-wrap">
      ${hasRealPoints ? `<svg viewBox="0 0 ${W} ${H}" class="traffic-svg" aria-label="Biểu đồ lưu lượng dòng tiền và lợi nhuận">
        ${[0, 0.25, 0.5, 0.75, 1].map(r => {
          const y = (padT + plotH * (1 - r)).toFixed(1);
          const vLabel = shortMoney(maxV * r);
          return `<g>
            <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#ebedef" stroke-width="1"/>
            <text x="${padL - 8}" y="${Number(y) + 4}" text-anchor="end" font-size="10" fill="#73818f">${vLabel}</text>
          </g>`;
        }).join('')}
        ${inArea ? `<path d="${inArea}" fill="rgba(32, 168, 216, 0.14)"/>` : ''}
        ${inCoords.length >= 2 ? `<path d="${inLine}" fill="none" stroke="#20a8d8" stroke-width="2.4"/>` : ''}
        ${profCoords.length >= 2 ? `<path d="${profLine}" fill="none" stroke="#4dbd74" stroke-width="2.4"/>` : ''}
        ${outCoords.length >= 2 ? `<path d="${outLine}" fill="none" stroke="#f86c6b" stroke-width="1.8" stroke-dasharray="5 4"/>` : ''}
        ${inCoords.map((c, idx) => `<g>
          <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="4" fill="#fff" stroke="#20a8d8" stroke-width="2">
            <title>${esc(c.lbl)} · ${c.orders} đơn · Thu: +${money(c.v)} ₫ · Chi: −${money(outCoords[idx].v)} ₫ · Lãi: ${profCoords[idx].v >= 0 ? '+' : ''}${money(profCoords[idx].v)} ₫</title>
          </circle>
          <circle cx="${profCoords[idx].x.toFixed(1)}" cy="${profCoords[idx].y.toFixed(1)}" r="3" fill="#4dbd74">
            <title>${esc(c.lbl)} · Lãi: ${profCoords[idx].v >= 0 ? '+' : ''}${money(profCoords[idx].v)} ₫</title>
          </circle>
          <text x="${c.x.toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#73818f">${esc(c.lbl)}</text>
        </g>`).join('')}
      </svg>` : `<div class="traffic-empty-zero">
        <strong>✨ ${esc(periodLabel)} đang bắt đầu từ 0</strong>
        <p>Chưa có đơn hàng hoặc giao dịch phát sinh trong kỳ này. Dữ liệu các kỳ trước vẫn được lưu nguyên vẹn trong <b>Lịch sử Kỳ chốt ngày 26</b>.</p>
      </div>`}
    </div>

    <div class="traffic-footer">
      <div class="tf-col">
        <span class="tf-label">Đã thu trong kỳ${s.debtRecoveryIn > 0 ? ` (gồm nợ cũ +${shortMoney(s.debtRecoveryIn)})` : ''}</span>
        <strong class="tf-val">${money(s.totalCollectedFromCustomer)} ₫ (${collectRatio}%)</strong>
        <div class="tf-bar"><span style="width:${collectRatio}%;background:#4dbd74"></span></div>
      </div>
      <div class="tf-col">
        <span class="tf-label">Lãi cước vận chuyển</span>
        <strong class="tf-val">${s.shipProfitTotal >= 0 ? '+' : ''}${money(s.shipProfitTotal)} ₫ (${pctShip}%)</strong>
        <div class="tf-bar"><span style="width:${pctShip}%;background:#63c2de"></span></div>
      </div>
      <div class="tf-col">
        <span class="tf-label">Doanh thu Phí dịch vụ</span>
        <strong class="tf-val">+${money(s.totalServiceRevenue)} ₫ (${pctFee}%)</strong>
        <div class="tf-bar"><span style="width:${pctFee}%;background:#f8cb00"></span></div>
      </div>
      <div class="tf-col">
        <span class="tf-label">Lãi Dịch vụ Đóng gói</span>
        <strong class="tf-val">${(s.packProfitTotal || 0) >= 0 ? '+' : ''}${money(s.packProfitTotal || 0)} ₫ (${pctPack}%)</strong>
        <div class="tf-bar"><span style="width:${pctPack}%;background:#f86c6b"></span></div>
      </div>
      <div class="tf-col">
        <span class="tf-label">Lãi tỷ giá tệ (FX)</span>
        <strong class="tf-val">${s.fxProfitTotal >= 0 ? '+' : ''}${money(s.fxProfitTotal)} ₫ (${pctFx}%)</strong>
        <div class="tf-bar"><span style="width:${pctFx}%;background:#20a8d8"></span></div>
      </div>
    </div>
  </div>`;
}

function renderCoreUiChannelCards(filterSpec = null, periodStats = null) {
  const matchDate = d => matchesDateFilter(d, filterSpec);
  const orders = (db.orderNotes || []).filter(o => o.status !== 'Đã hủy' && matchDate(o.date));
  const xtOrders = orders.filter(o => o.lineType === 'Xách tay');
  const xtProfit = xtOrders.reduce((s, o) => s + calcOrderMetrics(o).netProfit, 0);

  const tthOrders = orders.filter(o => o.lineType === 'Thanh toán hộ');
  const tthProfit = tthOrders.reduce((s, o) => s + calcOrderMetrics(o).netProfit, 0);

  const shipments = (db.shipments || []).filter(s => matchDate(s.date));
  const activeShip = shipments.filter(s => s.status !== 'Đã giao khách').length;

  const packItemsCount = (db.packagingCatalog || []).length;
  const packProfit = periodStats ? (periodStats.packProfitTotal || 0) : 0;

  return `<div class="channel-grid">
    <div class="channel-card" onclick="jumpToOrderFilter('__line_Xách tay')">
      <div class="channel-head ch-navy">
        <span class="channel-ico">✈️</span>
        <span class="channel-name">LINE XÁCH TAY</span>
        <svg class="channel-wave" viewBox="0 0 240 90" preserveAspectRatio="none"><path d="M0,68 Q60,30 120,58 T240,38 L240,90 L0,90 Z" fill="rgba(255,255,255,0.12)"/><path d="M0,68 Q60,30 120,58 T240,38" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1.8"/></svg>
      </div>
      <div class="channel-foot">
        <div class="ch-stat"><strong>${xtOrders.length} đơn</strong><span>Trong kỳ</span></div>
        <div class="ch-stat"><strong>${xtProfit >= 0 ? '+' : ''}${shortMoney(xtProfit)} ₫</strong><span>Lãi ròng</span></div>
      </div>
    </div>

    <div class="channel-card" onclick="jumpToOrderFilter('__line_Thanh toán hộ')">
      <div class="channel-head ch-sky">
        <span class="channel-ico">💴</span>
        <span class="channel-name">THANH TOÁN HỘ</span>
        <svg class="channel-wave" viewBox="0 0 240 90" preserveAspectRatio="none"><path d="M0,62 Q70,78 135,44 T240,28 L240,90 L0,90 Z" fill="rgba(255,255,255,0.14)"/><path d="M0,62 Q70,78 135,44 T240,28" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.8"/></svg>
      </div>
      <div class="channel-foot">
        <div class="ch-stat"><strong>${tthOrders.length} đơn</strong><span>Trong kỳ</span></div>
        <div class="ch-stat"><strong>${tthProfit >= 0 ? '+' : ''}${shortMoney(tthProfit)} ₫</strong><span>Lãi ròng</span></div>
      </div>
    </div>

    <div class="channel-card" onclick="setView('shipments',document.querySelector('[data-view=shipments]'))">
      <div class="channel-head ch-steel">
        <span class="channel-ico">📦</span>
        <span class="channel-name">ĐƠN KÝ GỬI KHO</span>
        <svg class="channel-wave" viewBox="0 0 240 90" preserveAspectRatio="none"><path d="M0,45 Q65,24 130,56 T240,52 L240,90 L0,90 Z" fill="rgba(255,255,255,0.12)"/><path d="M0,45 Q65,24 130,56 T240,52" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1.8"/></svg>
      </div>
      <div class="channel-foot">
        <div class="ch-stat"><strong>${shipments.length} VĐ</strong><span>Ký gửi kỳ này</span></div>
        <div class="ch-stat"><strong>${activeShip} kiện</strong><span>Đang vận hành</span></div>
      </div>
    </div>

    <div class="channel-card" onclick="setView('incidentals',document.querySelector('[data-view=incidentals]'))">
      <div class="channel-head ch-coral">
        <span class="channel-ico">🪵</span>
        <span class="channel-name">CHI PHÍ PHÁT SINH & ĐÓNG GÓI</span>
        <svg class="channel-wave" viewBox="0 0 240 90" preserveAspectRatio="none"><path d="M0,64 Q45,18 110,55 T240,24 L240,90 L0,90 Z" fill="rgba(255,255,255,0.13)"/><path d="M0,64 Q45,18 110,55 T240,24" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="1.8"/></svg>
      </div>
      <div class="channel-foot">
        <div class="ch-stat"><strong>${packItemsCount} mục</strong><span>Danh mục ĐG</span></div>
        <div class="ch-stat"><strong>${packProfit >= 0 ? '+' : ''}${shortMoney(packProfit)} ₫</strong><span>Lãi ĐG kỳ này</span></div>
      </div>
    </div>
  </div>`;
}

function renderProfitDonutChart(s, periodText) {
  const slices = [
    { label: 'Lãi phí vận chuyển', val: Math.max(0, s.shipProfitTotal), color: '#20a8d8' },
    { label: 'Doanh thu phí dịch vụ', val: Math.max(0, s.totalServiceRevenue), color: '#4dbd74' },
    { label: 'Lãi dịch vụ đóng gói', val: Math.max(0, s.packProfitTotal || 0), color: '#f86c6b' },
    { label: 'Lãi chênh lệch tỷ giá tệ', val: Math.max(0, s.fxProfitTotal), color: '#f8cb00' }
  ];
  if ((s.txOtherIn || 0) > 0) {
    slices.push({ label: 'Khoản thu khác', val: Math.max(0, s.txOtherIn), color: '#8b5cf6' });
  }

  const totalPos = slices.reduce((sum, x) => sum + x.val, 0);
  let cumulativePct = 0;

  const circlesHtml = totalPos > 0
    ? slices.filter(x => x.val > 0).map(x => {
        const pct = (x.val / totalPos) * 100;
        const seg = `<circle cx="21" cy="21" r="15.9154943" fill="transparent" stroke="${x.color}" stroke-width="6.2" stroke-dasharray="${pct.toFixed(2)} ${(100 - pct).toFixed(2)}" stroke-dashoffset="${(-cumulativePct).toFixed(2)}"><title>${esc(x.label)}: +${money(x.val)} ₫ (${Math.round(pct)}%)</title></circle>`;
        cumulativePct += pct;
        return seg;
      }).join('')
    : `<circle cx="21" cy="21" r="15.9154943" fill="transparent" stroke="#e2e8f0" stroke-width="6.2"></circle>`;

  return `<div class="chart-panel">
    <div class="chart-panel-head">
      <div>
        <div class="chart-panel-title">Cơ cấu nguồn lợi nhuận (Profit Statistics)</div>
        <div class="chart-panel-sub">${esc(periodText)} · Tỷ trọng từng dịch vụ vận hành & đóng gói</div>
      </div>
      ${s.totalIncidentalExpense > 0 ? `<span class="debt-pill owe" style="margin:0">Chi phát sinh: −${money(s.totalIncidentalExpense)} ₫</span>` : ''}
    </div>
    <div class="donut-layout">
      <div class="donut-svg-wrap">
        <svg viewBox="0 0 42 42" class="donut-svg" aria-label="Biểu đồ tròn cơ cấu lợi nhuận">
          <circle cx="21" cy="21" r="15.9154943" fill="transparent" stroke="#f1f5f9" stroke-width="6.2"></circle>
          ${circlesHtml}
        </svg>
        <div class="donut-center">
          <small>Lãi thực tế</small>
          <strong class="${s.netProfit >= 0 ? 'income-color' : 'expense-color'}">${s.netProfit >= 0 ? '+' : ''}${shortMoney(s.netProfit)} ₫</strong>
        </div>
      </div>
      <div class="donut-legend">
        ${slices.map(x => {
          const pct = totalPos > 0 ? Math.round((x.val / totalPos) * 100) : 0;
          return `<div class="legend-row">
            <div class="legend-left">
              <span class="swatch" style="background:${x.color}"></span>
              <span class="legend-name">${esc(x.label)}</span>
            </div>
            <div class="legend-right">
              <span class="legend-val">+${money(x.val)} ₫</span>
              <span class="legend-pct">${pct}%</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="chart-card-foot">
      <span>🕒 Tự động tổng hợp thời gian thực</span>
      <span>DAIRYCOW ANALYTICS</span>
    </div>
  </div>`;
}

function renderCashflowBarChart(filterSpec = '') {
  const bucketMap = new Map();
  const isObj = filterSpec && typeof filterSpec === 'object';
  const useMonthly = isObj ? filterSpec.mode === 'year' : String(filterSpec || '').length === 4;
  const matchDate = d => matchesDateFilter(d, filterSpec);

  const getKey = d => {
    const raw = normalizeDateStr(d) || dateKey();
    return useMonthly ? raw.slice(0, 7) : raw;
  };
  const ensure = k => {
    if (!bucketMap.has(k)) bucketMap.set(k, { key: k, moneyIn: 0, moneyOut: 0, profit: 0 });
    return bucketMap.get(k);
  };

  (db.orderNotes || []).filter(o => o.status !== 'Đã hủy' && matchDate(o.date)).forEach(o => {
    const b = ensure(getKey(o.date));
    const m = calcOrderMetrics(o);
    b.moneyIn += getOrderLegacyPaid(o);
    const whPaidSame = o.warehousePaid && (!o.warehousePaidDate || matchDate(o.warehousePaidDate));
    b.moneyOut += ((o.includeGoodsInFlow && o.partnerPaid) ? m.baseGoodsCostVnd : 0) + (whPaidSame ? m.shipCost : 0) + m.packCost + m.extraCost;
    b.profit += m.netProfit;
  });

  (db.extraShipments || []).filter(x => matchDate(x.date)).forEach(x => {
    const lp = getExtraLegacyPaid(x);
    if (lp > 0) ensure(getKey(x.date)).moneyIn += lp;
  });

  getValidPaymentRecords().filter(p => matchDate(p.date)).forEach(p => {
    const amt = Math.max(0, Math.round(parseNum(p.amount)));
    if (amt > 0) ensure(getKey(p.date)).moneyIn += amt;
  });

  const nonProfitCats = ['Thu hộ', 'Thu công nợ', 'Thu công nợ kỳ trước'];
  (db.transactions || []).filter(x => matchDate(x.date)).forEach(x => {
    const b = ensure(getKey(x.date));
    const amt = parseNum(x.amount);
    if (x.type === 'Thu') {
      b.moneyIn += amt;
      if (!nonProfitCats.includes(x.category)) b.profit += amt;
    } else {
      b.moneyOut += amt;
      b.profit -= amt;
    }
  });

  const buckets = [...bucketMap.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-8);
  const maxVal = buckets.length ? Math.max(100000, ...buckets.flatMap(b => [b.moneyIn, b.moneyOut, Math.abs(b.profit)])) : 100000;

  return `<div class="chart-panel">
    <div class="chart-panel-head">
      <div>
        <div class="chart-panel-title">📊 Biểu đồ Thu · Chi · Lợi nhuận</div>
        <div class="chart-panel-sub">So sánh trực quan dòng tiền vào (gồm thu nợ kỳ trước), chuyển ra và lãi ròng trong kỳ</div>
      </div>
      <div class="chart-legend-inline">
        <span><i class="swatch" style="background:#10b981"></i> Thu vào</span>
        <span><i class="swatch" style="background:#f97316"></i> Chuyển ra</span>
        <span><i class="swatch" style="background:#2563eb"></i> Lợi nhuận</span>
      </div>
    </div>
    ${buckets.length ? `<div class="vbar-stage">
      ${buckets.map(b => {
        const hIn = b.moneyIn > 0 ? Math.max(6, Math.round((b.moneyIn / maxVal) * 140)) : 3;
        const hOut = b.moneyOut > 0 ? Math.max(6, Math.round((b.moneyOut / maxVal) * 140)) : 3;
        const hProf = b.profit !== 0 ? Math.max(6, Math.round((Math.abs(b.profit) / maxVal) * 140)) : 3;
        const lbl = shortDateLabel(b.key);
        return `<div class="vbar-col">
          <div class="vbar-bars">
            <div class="vbar c-in" style="height:${hIn}px" title="${lbl} · Tiền thu vào: +${money(b.moneyIn)} ₫"></div>
            <div class="vbar c-out" style="height:${hOut}px" title="${lbl} · Tiền chuyển ra & chi: −${money(b.moneyOut)} ₫"></div>
            <div class="vbar ${b.profit >= 0 ? 'c-profit' : 'c-loss'}" style="height:${hProf}px" title="${lbl} · Lợi nhuận: ${b.profit >= 0 ? '+' : ''}${money(b.profit)} ₫"></div>
          </div>
          <span class="vbar-label">${esc(lbl)}</span>
        </div>`;
      }).join('')}
    </div>` : '<div class="empty" style="padding:20px"><p>Chưa có dòng tiền phát sinh trong kỳ đã chọn (đang ở mức 0 ₫).</p></div>'}
  </div>`;
}

function renderOrderPipelineBar(filterSpec = null, periodLabel = '') {
  const activeOrders = (db.orderNotes || []).filter(o => o.status !== 'Đã hủy' && matchesDateFilter(o.date, filterSpec));
  const groups = [
    { label: 'Chờ xử lý / Thanh toán', stages: ['Mới tạo / Chờ xử lý', 'Chờ khách thanh toán'], color: '#f59e0b', filter: '__pipe_wait' },
    { label: 'Đang vận chuyển / Đã TT', stages: ['Đã thanh toán hộ', 'Đang vận chuyển'], color: '#3b82f6', filter: '__pipe_ship' },
    { label: 'Đã về kho VN', stages: ['Đã về kho VN'], color: '#8b5cf6', filter: '__pipe_vn' },
    { label: 'Đã giao / Hoàn tất', stages: ['Đã giao khách', 'Hoàn tất / Đã tất toán'], color: '#10b981', filter: '__pipe_done' }
  ].map(g => ({
    ...g,
    count: activeOrders.filter(o => g.stages.includes(o.status)).length
  }));

  const total = Math.max(1, activeOrders.length);

  return `<div class="pipeline-panel">
    <div class="chart-panel-head">
      <div>
        <div class="chart-panel-title">🚚 Tiến độ Note đơn trong kỳ (${activeOrders.length} đơn)</div>
        <div class="chart-panel-sub">${periodLabel ? esc(periodLabel) + ' · ' : ''}Bấm vào nhãn màu để lọc nhanh danh sách đơn</div>
      </div>
      <button type="button" class="link-btn" onclick="setView('orders',document.querySelector('[data-view=orders]'))">Xem bảng Note đơn →</button>
    </div>
    <div class="pipeline-track">
      ${activeOrders.length ? groups.filter(g => g.count > 0).map(g => `<div class="pipeline-seg" style="width:${(g.count / total) * 100}%;background:${g.color}" title="${esc(g.label)}: ${g.count} đơn" onclick="jumpToOrderFilter('${esc(g.filter)}')"></div>`).join('') : '<div class="pipeline-seg" style="width:100%;background:#e2e8f0"></div>'}
    </div>
    <div class="pipeline-pills">
      ${groups.map(g => `<button type="button" class="pipe-pill" onclick="jumpToOrderFilter('${esc(g.filter)}')">
        <span class="swatch" style="background:${g.color}"></span>
        <span>${esc(g.label)}</span>
        <b>${g.count}</b>
      </button>`).join('')}
    </div>
  </div>`;
}

function renderGoodsCategoryChart(filterSpec = '') {
  const palette = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#0d9488', '#f97316'];
  const map = new Map();

  (db.orderNotes || []).filter(o => o.status !== 'Đã hủy' && matchesDateFilter(o.date, filterSpec)).forEach(o => {
    const k = o.goodsType || 'Khác';
    const cur = map.get(k) || { name: k, orders: 0, pkgs: 0, profit: 0 };
    cur.orders += 1;
    cur.pkgs += Number(o.packages || 1);
    cur.profit += calcOrderMetrics(o).netProfit;
    map.set(k, cur);
  });

  const rows = [...map.values()].sort((a, b) => b.profit - a.profit);
  const maxVal = Math.max(1, ...rows.map(r => Math.abs(r.profit)));

  return `<div class="chart-panel">
    <div class="chart-panel-head">
      <div>
        <div class="chart-panel-title">📦 Lợi nhuận theo Loại hàng hoá</div>
        <div class="chart-panel-sub">Nhóm mặt hàng mang lại hiệu quả cao nhất trong kỳ</div>
      </div>
    </div>
    ${rows.length ? `<div class="hbar-list">
      ${rows.map((r, idx) => {
        const color = palette[idx % palette.length];
        const w = Math.max(6, Math.round((Math.abs(r.profit) / maxVal) * 100));
        return `<div class="hbar-item">
          <div class="hbar-head">
            <span class="hbar-name"><i class="swatch" style="background:${color}"></i> ${esc(r.name)} <small style="color:var(--muted)">(${r.orders} đơn · ${r.pkgs} kiện)</small></span>
            <span class="hbar-val ${r.profit >= 0 ? 'income-color' : 'expense-color'}">${r.profit >= 0 ? '+' : ''}${money(r.profit)} ₫</span>
          </div>
          <div class="hbar-track">
            <div class="hbar-fill" style="width:${w}%;background:${color}"></div>
          </div>
        </div>`;
      }).join('')}
    </div>` : '<div class="empty" style="padding:20px"><p>Chưa có Note đơn nào trong kỳ đã chọn.</p></div>'}
  </div>`;
}

// ============================================================================
// ĐIỀU HƯỚNG & THAO TÁC NHANH
// ============================================================================
function jumpToOrderFilter(filterVal) {
  view = 'orders';
  query = '';
  window.statusFilter = filterVal;
  document.querySelectorAll('.nav').forEach(n => n.classList.toggle('active', n.dataset.view === 'orders'));
  render();
}

function jumpToCustomerDebt(customerName) {
  view = 'orders';
  query = customerName || '';
  window.statusFilter = '__debt';
  document.querySelectorAll('.nav').forEach(n => n.classList.toggle('active', n.dataset.view === 'orders'));
  render();
}

function viewCustomerOrders(customerName) {
  view = 'orders';
  query = customerName || '';
  window.statusFilter = '';
  document.querySelectorAll('.nav').forEach(n => n.classList.toggle('active', n.dataset.view === 'orders'));
  render();
}

function openFinanceSubtab(tab) {
  financeTab = tab;
  view = 'finance';
  query = '';
  window.statusFilter = '';
  document.querySelectorAll('.nav').forEach(n => n.classList.toggle('active', n.dataset.view === 'finance'));
  render();
}

function openHistoryTab() {
  openFinanceSubtab('history');
}

function quickStatus(kind, id, newStatus) {
  const list =
    kind === 'order' ? db.orderNotes :
    kind === 'shipment' ? db.shipments :
    kind === 'extraship' ? db.extraShipments :
    db.purchases;
  const item = (list || []).find(x => x.id === id);
  if (!item) return;
  const oldStatus = item.status;
  if (oldStatus === newStatus) return;
  const stamp = nowStamp();
  const prevExtraPaid = kind === 'extraship' ? getExtraCurrentPaid(item) : 0;
  item.status = newStatus;
  if (kind === 'extraship') {
    if (newStatus === 'Đã thu') item.paidAmount = Math.round(parseNum(item.amount));
    if (newStatus === 'Chưa thu') item.paidAmount = 0;
    const nextExtraPaid = getExtraCurrentPaid(item);
    if (nextExtraPaid > prevExtraPaid) {
      recordPaymentEvent({
        kind: 'extraship',
        extraShipId: item.id,
        orderId: item.orderId || '',
        orderCode: item.orderCode || '',
        customer: item.customer || '',
        amount: nextExtraPaid - prevExtraPaid,
        date: dateKey(),
        originDate: item.date,
        note: `Thu cước ship phát sinh (${item.content || ''})`
      });
    } else if (nextExtraPaid < prevExtraPaid) {
      reducePaymentEvents('extraship', item.id, prevExtraPaid - nextExtraPaid);
    }
  }
  // Đổi trạng thái giữ nguyên item.date ban đầu -> không biến đơn kỳ cũ thành đơn mới của kỳ hiện tại
  item.updatedAt = stamp;
  item.updatedAtMs = Date.now();
  if (!Array.isArray(item.history)) item.history = [];
  item.history.unshift({
    time: nowStamp(true),
    action: 'Đổi trạng thái',
    detail: `${oldStatus} → ${newStatus}`
  });
  const kindTitle = kind === 'order' ? 'Note đơn' : kind === 'shipment' ? 'Vận đơn' : kind === 'extraship' ? 'Cước ship phát sinh' : 'Mua hộ';
  addAuditLog('Đổi trạng thái', `${kindTitle} · ${item.customer || item.orderCode || ''}`, `${oldStatus} → ${newStatus}`);
  persist();
  render();
  toast(`✓ Đã đổi trạng thái: ${newStatus} (${stamp})`);
}

function settleOrderDebt(id, targetType) {
  const o = db.orderNotes.find(x => x.id === id);
  if (!o) return;
  const m = calcOrderMetrics(o);
  const stamp = nowStamp();
  const payDate = dateKey();
  if (!Array.isArray(o.history)) o.history = [];

  if (targetType === 'customer') {
    let extraCollectedNow = 0;
    // Đồng thời đánh dấu Đã thu cho các khoản cước ship phát sinh liên kết với đơn này và ghi nhận ngày thực thu
    (db.extraShipments || []).forEach(x => {
      if ((o.id && x.orderId === o.id) || (o.code && x.orderCode && String(x.orderCode).trim().toLowerCase() === String(o.code).trim().toLowerCase())) {
        const amt = Math.round(parseNum(x.amount));
        const prevPaid = getExtraCurrentPaid(x);
        const delta = Math.max(0, amt - prevPaid);
        x.status = 'Đã thu';
        x.paidAmount = amt;
        x.updatedAt = stamp;
        x.updatedAtMs = Date.now();
        if (delta > 0) {
          extraCollectedNow += delta;
          recordPaymentEvent({
            kind: 'extraship',
            extraShipId: x.id,
            orderId: o.id,
            orderCode: x.orderCode || o.code || '',
            customer: x.customer || o.customer || '',
            amount: delta,
            date: payDate,
            originDate: x.date || o.date,
            note: `Thu đủ cước ship PS liên kết đơn ${o.code || ''}`
          });
        }
      }
    });

    const baseTarget = Math.max(0, m.totalCollectCustomer - m.extraShipTotal);
    const prevOrderPaid = Math.round(parseNum(o.customerPaid));
    const orderDelta = Math.max(0, baseTarget - prevOrderPaid);
    o.customerPaid = prevOrderPaid + orderDelta;
    if (orderDelta > 0) {
      recordPaymentEvent({
        kind: 'order',
        orderId: o.id,
        orderCode: o.code || '',
        customer: o.customer || '',
        amount: orderDelta,
        date: payDate,
        originDate: o.date,
        note: `Thu đủ công nợ đơn ${o.product || o.goodsType || o.code || ''}`
      });
    }

    const totalCollectedNow = orderDelta + extraCollectedNow;
    const payPeriod = getBusinessPeriodForDate(payDate);
    const origPeriod = getBusinessPeriodForDate(o.date);
    const recoveryTag = origPeriod.id !== payPeriod.id ? ` (Thu công nợ kỳ trước -> dòng tiền ${payPeriod.shortLabel})` : '';

    o.updatedAt = stamp;
    o.updatedAtMs = Date.now();
    o.history.unshift({
      time: nowStamp(true),
      action: 'Thu đủ tiền khách',
      detail: `Thực thu +${money(totalCollectedNow)} ₫ ngày ${dateText(payDate)} · Tổng đã thu ${money(m.totalCollectCustomer)} ₫${recoveryTag}`
    });
    addAuditLog('Thu đủ công nợ', `Khách ${o.customer}`, `Thực thu +${money(totalCollectedNow)} ₫ ngày ${dateText(payDate)} cho đơn ${o.product || o.goodsType}${recoveryTag}`);
    toast(`✓ Đã thu +${money(totalCollectedNow)} ₫ từ ${o.customer}${origPeriod.id !== payPeriod.id ? ' (ghi nhận dòng tiền kỳ hiện tại)' : ''}`);
  } else if (targetType === 'warehouse') {
    o.warehousePaid = true;
    o.warehousePaidDate = payDate;
    o.updatedAt = stamp;
    o.updatedAtMs = Date.now();
    o.history.unshift({ time: nowStamp(true), action: 'Thanh toán cước kho', detail: `Đã trả kho ${money(m.shipCost)} ₫ ngày ${dateText(payDate)}` });
    addAuditLog('Trả cước kho', `Đơn ${o.customer}`, `Đã thanh toán cước gốc ${money(m.shipCost)} ₫ cho kho ngày ${dateText(payDate)}`);
    toast(`✓ Đã đánh dấu trả kho ${money(m.shipCost)} ₫`);
  }
  persist();
  render();
}

function cleanPhone(p = '') {
  return String(p || '').replace(/\D/g, '');
}

function sameCustomer(rec, cust) {
  if (!rec || !cust) return false;
  const rc = (rec.code || '').trim().toLowerCase();
  const cc = (cust.code || '').trim().toLowerCase();
  if (rc && cc && rc === cc) return true;
  const rp = cleanPhone(rec.phone);
  const cp = cleanPhone(cust.phone);
  if (rp.length >= 8 && rp === cp) return true;
  const rn = (rec.customer || '').trim().toLowerCase();
  const cn = (cust.customer || '').trim().toLowerCase();
  return Boolean(rn && cn && rn === cn);
}

function uniqueCustomers() {
  const list = [];
  [...(db.orderNotes || []), ...(db.shipments || []), ...(db.purchases || [])].forEach(o => {
    if (!String(o.customer || o.phone || o.code || '').trim()) return;
    const found = list.find(c => sameCustomer(o, c));
    if (!found) {
      list.push({
        customer: o.customer || '',
        phone: o.phone || '',
        code: o.code || '',
        address: o.address || '',
        platform: o.platform || 'Taobao'
      });
    } else {
      if (!found.customer && o.customer) found.customer = o.customer;
      if (!found.phone && o.phone) found.phone = o.phone;
      if (!found.code && o.code) found.code = o.code;
      if (!found.address && o.address) found.address = o.address;
    }
  });
  return list;
}

function findExistingCustomer(name, phone, code) {
  const probe = { customer: name, phone, code };
  return uniqueCustomers().find(c => sameCustomer(probe, c)) || null;
}

function autofillCustomerInfo(nameVal) {
  const matched = findExistingCustomer(nameVal, '', '');
  if (!matched) return;
  const phoneEl = document.getElementById('f_phone');
  const codeEl = document.getElementById('f_code');
  const addrEl = document.getElementById('f_address');
  if (phoneEl && !phoneEl.value.trim() && matched.phone) phoneEl.value = matched.phone;
  if (codeEl && !codeEl.value.trim() && matched.code) codeEl.value = matched.code;
  if (addrEl && !addrEl.value.trim() && matched.address) addrEl.value = matched.address;
}

function refreshCustomerDatalist() {
  const dl = document.getElementById('customerSuggestions');
  if (!dl) return;
  dl.innerHTML = uniqueCustomers().map(c => `<option value="${esc(c.customer)}">${esc(c.code || '')} ${esc(c.phone || '')}</option>`).join('');
}

function setView(v, el) {
  view = v;
  query = '';
  window.statusFilter = '';
  window.platformFilter = '';
  document.querySelectorAll('.nav').forEach(n => {
    n.classList.toggle('active', n.dataset.view === v);
  });
  document.querySelectorAll('.topnav-link').forEach(n => {
    n.classList.toggle('active', n.dataset.topnav === v);
  });
  if (el && el.classList.contains('nav')) el.classList.add('active');
  render();
}

function setFilter(val) {
  window.statusFilter = val;
  render();
}

function setPlatformFilter(val) {
  window.platformFilter = val;
  render();
}

function clearFilters() {
  query = '';
  window.statusFilter = '';
  window.platformFilter = '';
  window.ordersPeriodOnly = false;
  render();
}

function handleSearch(inputEl) {
  query = inputEl.value;
  document.getElementById('searchClearBtn')?.classList.toggle('hidden', !query);
  document.getElementById('resetFilterBtn')?.classList.toggle('hidden', !(query || window.statusFilter || window.platformFilter || window.ordersPeriodOnly));
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
  document.getElementById('resetFilterBtn')?.classList.toggle('hidden', !(window.statusFilter || window.platformFilter || window.ordersPeriodOnly));
  updateTableResults();
}

function updateTableResults() {
  const area = document.getElementById('tableArea');
  const countEl = document.getElementById('resultCount');
  if (!area) {
    render();
    return;
  }
  if (view === 'orders') {
    const data = getOrdersViewData();
    area.innerHTML = data.tableHtml;
    if (countEl) countEl.textContent = `${data.filteredCount} / ${data.totalCount} đơn`;
    const sumEl = document.getElementById('ordersSummaryBar');
    if (sumEl) sumEl.outerHTML = data.summaryHtml;
  } else if (view === 'incidentals') {
    if (incTab === 'extraship') {
      const data = getExtraShipViewData();
      area.innerHTML = data.tableHtml;
      if (countEl) countEl.textContent = `${data.filteredCount} / ${data.totalCount} khoản`;
    } else {
      const data = getPackagingTabViewData(incTab);
      area.innerHTML = data.tableHtml;
      if (countEl) countEl.textContent = `${data.filteredCount} / ${data.totalCount} sản phẩm`;
    }
  } else if (view === 'shipments') {
    const data = getShipmentsViewData();
    area.innerHTML = data.tableHtml;
    if (countEl) countEl.textContent = `${data.filteredCount} / ${data.totalCount} mục`;
  } else if (view === 'purchases') {
    const data = getPurchasesViewData();
    area.innerHTML = data.tableHtml;
    if (countEl) countEl.textContent = `${data.filteredCount} / ${data.totalCount} mục`;
  } else if (view === 'finance' && financeTab === 'cashflow') {
    const data = getFinanceViewData();
    area.innerHTML = data.tableHtml;
    if (countEl) countEl.textContent = `${data.filteredCount} / ${data.totalCount} giao dịch`;
  } else if (view === 'finance' && financeTab === 'history') {
    const data = getHistoryViewData();
    area.innerHTML = data.tableHtml;
    if (countEl) countEl.textContent = `${data.filteredCount} / ${data.totalCount} hoạt động`;
  } else if (view === 'customers') {
    const data = getCustomersViewData();
    area.innerHTML = data.tableHtml;
    if (countEl) countEl.textContent = `${data.filteredCount} / ${data.totalCount} khách`;
  }
}

function getPendingItems() {
  const pendingOrders = (db.orderNotes || [])
    .filter(o => {
      if (o.status === 'Đã hủy') return false;
      const m = calcOrderMetrics(o);
      const hasDebt = m.customerDebt > 0 || m.warehouseDebt > 0;
      return !['Đã giao khách', 'Hoàn tất / Đã tất toán'].includes(o.status) || hasDebt;
    })
    .map(o => {
      const m = calcOrderMetrics(o);
      return {
        ...o,
        kind: 'order',
        kindLabel: o.lineType || 'Note đơn',
        urgent: m.customerDebt > 0 || o.status === 'Đã về kho VN' || o.status === 'Chờ khách thanh toán',
        metrics: m
      };
    });

  const pendingBuy = (db.purchases || [])
    .filter(o => !['Đặt hàng thành công', 'Đã hủy'].includes(o.status))
    .map(o => ({ ...o, kind: 'purchase', kindLabel: 'Mua hộ', urgent: ['Chờ xác nhận', 'Chờ báo giá', 'Chờ thanh toán', 'Đã thanh toán'].includes(o.status) }));

  const pendingShip = (db.shipments || [])
    .filter(o => o.status !== 'Đã giao khách')
    .map(o => ({ ...o, kind: 'shipment', kindLabel: 'Ký gửi', urgent: o.status === 'Đã về kho Việt Nam' || o.status === 'Chờ người bán gửi' }));

  return [...pendingOrders, ...pendingBuy, ...pendingShip].sort((a, b) => (Number(b.urgent) - Number(a.urgent)) || (b.date || '').localeCompare(a.date || ''));
}

// ============================================================================
// ĐIỀU KHIỂN GIAO DIỆN SIDEBAR, TONE MÀU & PHÂN QUYỀN (DAIRYCOW LOGISTICS)
// ============================================================================
function toggleSidebar() {
  document.getElementById('appShell')?.classList.toggle('sidebar-collapsed');
}

function toggleSidebarTheme() {
  const isPurple = document.body.classList.toggle('theme-purple');
  try {
    localStorage.setItem(THEME_KEY, isPurple ? 'purple' : 'coreui');
  } catch {}
  toast(isPurple ? '🎨 Đã chuyển sang tone Tím (Creative Tim)' : '🎨 Đã chuyển sang tone Đậm (CoreUI Dark)');
}

function switchUserRole(role) {
  currentUserRole = ['admin', 'warehouse', 'sales'].includes(role) ? role : 'admin';
  try {
    localStorage.setItem(ROLE_KEY, currentUserRole);
  } catch {}
  if (currentUserRole === 'warehouse' && view === 'finance') {
    view = 'shipments';
  }
  addAuditLog('Đổi phân quyền', 'Hệ thống', `Chuyển chế độ làm việc sang quyền: ${currentUserRole.toUpperCase()}`);
  render();
  const roleNames = {
    admin: '👑 Admin (Toàn quyền quản trị & lợi nhuận)',
    warehouse: '📦 Nhân viên Kho & Đóng gói (WMS)',
    sales: '💼 Nhân viên Sale & CSKH (OMS)'
  };
  toast(`Đã chuyển sang chế độ: ${roleNames[currentUserRole]}`);
}

function openRoleModal() {
  const form = document.getElementById('recordForm');
  form.dataset.kind = 'role_info';
  form.dataset.id = '';
  formDirty = false;
  hideFormError();
  document.getElementById('modalBox')?.classList.remove('wide');
  document.getElementById('modalTitle').textContent = '🛡 Phân quyền vận hành · DAIRYCOW LOGISTICS';
  document.getElementById('modalSub').textContent = 'Thiết lập quyền truy cập theo vị trí công việc (Admin, Kho & Đóng gói, Sale/CSKH).';
  document.getElementById('deleteZone').classList.add('hidden');
  document.getElementById('recordHistoryZone').classList.add('hidden');
  document.getElementById('calcPreviewZone').innerHTML = '';

  document.getElementById('formFields').innerHTML = `
    <div class="full">
      <div class="form-card" style="grid-template-columns:1fr">
        <div class="form-card-title"><span>Chọn vai trò đang sử dụng trên thiết bị này</span></div>
        <div class="todo-row" style="padding:10px 4px">
          <div>
            <b>👑 Admin / Chủ hệ thống (Toàn quyền)</b>
            <div class="subline">Xem toàn bộ lợi nhuận thực tế, lãi đóng gói, lãi tỷ giá tệ, sổ thu chi, công nợ và sao lưu dữ liệu.</div>
          </div>
          <button type="button" class="btn small ${currentUserRole === 'admin' ? 'primary' : ''}" onclick="switchUserRole('admin');closeModal()">
            ${currentUserRole === 'admin' ? '✓ Đang dùng' : 'Chọn quyền này'}
          </button>
        </div>
        <div class="todo-row" style="padding:10px 4px">
          <div>
            <b>📦 Nhân viên Kho & Đóng gói (WMS)</b>
            <div class="subline">Quản lý Đơn ký gửi kho, cập nhật mã vận đơn TQ - VN, chọn quy cách đóng gói (đóng gỗ, bọt khí, thùng carton). Ẩn báo cáo lợi nhuận nhạy cảm.</div>
          </div>
          <button type="button" class="btn small ${currentUserRole === 'warehouse' ? 'primary' : ''}" onclick="switchUserRole('warehouse');closeModal()">
            ${currentUserRole === 'warehouse' ? '✓ Đang dùng' : 'Chọn quyền này'}
          </button>
        </div>
        <div class="todo-row" style="padding:10px 4px">
          <div>
            <b>💼 Nhân viên Sale & CSKH (OMS)</b>
            <div class="subline">Tạo Note đơn, báo giá Yêu cầu mua hộ, chăm sóc Danh bạ khách hàng và theo dõi tiến độ đơn.</div>
          </div>
          <button type="button" class="btn small ${currentUserRole === 'sales' ? 'primary' : ''}" onclick="switchUserRole('sales');closeModal()">
            ${currentUserRole === 'sales' ? '✓ Đang dùng' : 'Chọn quyền này'}
          </button>
        </div>
      </div>
    </div>
  `;
  const saveBtnEl = document.getElementById('saveBtn');
  if (saveBtnEl) saveBtnEl.textContent = '✓ Đóng';
  document.getElementById('modal').classList.add('open');
}

// ============================================================================
// RENDER CHÍNH (KHÔNG LẶP THẺ TRÙNG LẶP GIỮA CÁC TRANG)
// ============================================================================
function render() {
  refreshCustomerDatalist();
  const customerCount = uniqueCustomers().length;
  const pendingAll = getPendingItems();
  const pendingTotal = pendingAll.length;

  const debtRecordsCount = (db.orderNotes || []).filter(o => {
    if (o.status === 'Đã hủy') return false;
    const m = calcOrderMetrics(o);
    return m.customerDebt > 0 || m.warehouseDebt > 0;
  }).length;

  document.getElementById('orderCount').textContent = (db.orderNotes || []).length;
  document.getElementById('shipCount').textContent = (db.shipments || []).length;
  document.getElementById('buyCount').textContent = (db.purchases || []).length;
  document.getElementById('custCount').textContent = customerCount;

  const incCountEl = document.getElementById('incCount');
  if (incCountEl) {
    incCountEl.textContent = (db.extraShipments || []).length + (db.packagingCatalog || []).length;
  }

  document.querySelectorAll('.topnav-link').forEach(n => {
    n.classList.toggle('active', n.dataset.topnav === view);
  });

  const todoBadge = document.getElementById('todoCount');
  if (todoBadge) {
    todoBadge.textContent = pendingTotal;
    todoBadge.classList.toggle('hidden', pendingTotal === 0);
  }

  const topTodoBadge = document.getElementById('topTodoBadge');
  if (topTodoBadge) {
    topTodoBadge.textContent = pendingTotal;
    topTodoBadge.classList.toggle('hidden', pendingTotal === 0);
  }

  const debtBadge = document.getElementById('debtCount');
  if (debtBadge) {
    debtBadge.textContent = debtRecordsCount;
    debtBadge.classList.toggle('hidden', debtRecordsCount === 0);
  }

  const roleShortMap = { admin: 'Admin', warehouse: 'Kho WMS', sales: 'Sale OMS' };
  const roleAvatarMap = { admin: 'AD', warehouse: 'WH', sales: 'SL' };
  const roleSelectEl = document.getElementById('roleSelect');
  if (roleSelectEl) roleSelectEl.value = currentUserRole;
  const roleAvatarEl = document.getElementById('roleAvatar');
  if (roleAvatarEl) roleAvatarEl.textContent = roleAvatarMap[currentUserRole] || 'AD';
  const navRoleEl = document.getElementById('activeRoleNavLabel');
  if (navRoleEl) navRoleEl.textContent = roleShortMap[currentUserRole] || 'Admin';
  const bcRoleEl = document.getElementById('breadcrumbRole');
  if (bcRoleEl) bcRoleEl.textContent = roleShortMap[currentUserRole] || 'Admin';

  const navFinanceBtn = document.getElementById('navFinanceBtn');
  if (navFinanceBtn) navFinanceBtn.classList.toggle('hidden', currentUserRole === 'warehouse');
  const sideFinanceBtn = document.getElementById('sideFinanceBtn');
  if (sideFinanceBtn) sideFinanceBtn.classList.toggle('hidden', currentUserRole === 'warehouse');

  const titles = {
    overview: ['DAIRYCOW LOGISTICS · Dashboard Vận Hành', 'Hệ thống quản lý vận đơn ký gửi (WMS), dịch vụ đóng gói, dòng tiền và lợi nhuận thời gian thực.'],
    orders: ['Note đơn · Dịch vụ Đóng gói & Tính lãi', 'Quản lý đơn Xách tay / Thanh toán hộ / Ký gửi, gắn vật tư đóng gói, cước ship phát sinh và tự tính lãi.'],
    incidentals: ['Quản lý Chi phí phát sinh & Lợi nhuận Đóng gói', 'Quản lý Cước ship phát sinh và 3 danh mục Đóng hộp gỗ, Đóng hộp carton, Chống sốc.'],
    finance: ['Thu chi, Công nợ & Báo cáo Lợi nhuận', 'Theo dõi minh bạch dòng tiền theo Ngày / Tháng / Năm, lãi dịch vụ đóng gói và lịch sử chỉnh sửa.'],
    shipments: ['Quản lý Đơn ký gửi kho (WMS)', 'Theo dõi mã vận đơn Trung Quốc - Việt Nam, quy cách đóng gói và tiến độ xuất nhập kho.'],
    purchases: ['Quản lý Yêu cầu mua hộ (OMS)', 'Báo giá link sản phẩm Taobao/1688/Pinduoduo, xác nhận thanh toán và chuyển sang tính lãi 1 chạm.'],
    customers: ['Danh bạ khách hàng & Công nợ', 'Tổng hợp mã khách hàng DR, số lượng đơn, số điện thoại và công nợ theo từng khách.']
  };

  const bcCurrentMap = {
    overview: 'Dashboard',
    orders: 'Note đơn & Đóng gói',
    incidentals: 'Chi phí phát sinh',
    finance: 'Thu chi & Báo cáo',
    shipments: 'Đơn ký gửi kho',
    purchases: 'Yêu cầu mua hộ',
    customers: 'Khách hàng'
  };
  const bcCurEl = document.getElementById('breadcrumbCurrent');
  if (bcCurEl) bcCurEl.textContent = bcCurrentMap[view] || 'Dashboard';

  document.getElementById('pageTitle').textContent = (titles[view] || titles.overview)[0];
  document.getElementById('pageDesc').textContent = (titles[view] || titles.overview)[1];

  const actionsEl = document.getElementById('pageActions');
  if (view === 'overview') {
    actionsEl.innerHTML = `
      <button type="button" class="btn" onclick="setView('incidentals',document.querySelector('[data-view=incidentals]'))">🪵 Chi phí phát sinh</button>
      <button type="button" class="btn" onclick="openNew('shipment')">＋ Đơn ký gửi</button>
      <button id="addBtn" type="button" class="btn primary" onclick="openNew('order')">＋ Tạo Note đơn mới</button>
    `;
  } else if (view === 'orders') {
    actionsEl.innerHTML = `
      <button type="button" class="btn" onclick="openNew('extraship')">＋ Cước ship phát sinh</button>
      <button id="addBtn" type="button" class="btn primary" onclick="openNew('order')">＋ Tạo Note đơn mới</button>
    `;
  } else if (view === 'incidentals') {
    if (incTab === 'extraship') {
      actionsEl.innerHTML = `<button id="addBtn" type="button" class="btn primary" onclick="openNew('extraship')">＋ Thêm Cước ship phát sinh</button>`;
    } else {
      const catNames = { wood: 'Đóng hộp gỗ', carton: 'Đóng hộp carton', shock: 'Chống sốc' };
      actionsEl.innerHTML = `<button id="addBtn" type="button" class="btn primary" onclick="openNewPackItem('${incTab}')">＋ Thêm SP ${catNames[incTab] || 'Đóng gói'}</button>`;
    }
  } else if (view === 'finance') {
    actionsEl.innerHTML = `
      <button type="button" class="btn" onclick="openNew('order')">＋ Note đơn</button>
      <button id="addBtn" type="button" class="btn primary" onclick="openNew('finance')">＋ Ghi khoản thu / chi</button>
    `;
  } else if (view === 'customers') {
    actionsEl.innerHTML = `
      <button type="button" class="btn" onclick="openNew('shipment')">＋ Vận đơn ký gửi</button>
      <button id="addBtn" type="button" class="btn primary" onclick="openNew('order')">＋ Note đơn cho khách</button>
    `;
  } else {
    const label = view === 'purchases' ? '＋ Thêm yêu cầu mua hộ' : '＋ Thêm đơn ký gửi';
    const kind = view === 'purchases' ? 'purchase' : 'shipment';
    actionsEl.innerHTML = `<button id="addBtn" type="button" class="btn primary" onclick="openNew('${kind}')">${label}</button>`;
  }

  document.getElementById('content').innerHTML =
    view === 'overview' ? overviewPage() :
    view === 'orders' ? ordersPage() :
    view === 'incidentals' ? incidentalsPage() :
    view === 'finance' ? financePage() :
    view === 'shipments' ? shipmentsPage() :
    view === 'purchases' ? purchasesPage() :
    customersPage();
}

function kpiCard(label, val, sub, icon, tone = 'blue', onClick = '') {
  return `<div class="kpi-card tone-${tone} ${onClick ? 'clickable' : ''}" ${onClick ? `onclick="${onClick}"` : ''}>
    <div class="kpi-top">
      <span class="kpi-label">${label}</span>
      <span class="kpi-ico">${icon}</span>
    </div>
    <div class="kpi-val">${val}</div>
    <div class="kpi-sub">${sub}</div>
  </div>`;
}

// ============================================================================
// TRANG 1: DASHBOARD TỔNG QUAN (CHUẨN COREUI & CREATIVE TIM · CHỐT KỲ NGÀY 26)
// ============================================================================
function renderBusinessPeriodBanner() {
  const curP = getCurrentBusinessPeriod();
  const activeP = getSelectedBusinessPeriod();
  const periods = (db.businessPeriods || []).length ? db.businessPeriods : [activeP];
  const isClosed = activeP.status === 'closed';
  const nextCloseDate = dateText(getNextBusinessPeriod(curP).startDate);
  const adjCount = Array.isArray(activeP.adjustments) ? activeP.adjustments.length : 0;

  return `<div class="biz-period-banner ${isClosed ? 'is-closed' : 'is-active'}">
    <div class="biz-period-left">
      <div class="biz-period-title-row">
        <span class="biz-status-pill ${isClosed ? 'closed' : 'active'}">${isClosed ? '🔒 Kỳ đã chốt' : '● Đang hoạt động'}</span>
        <strong>${esc(activeP.label)}</strong>
        ${adjCount > 0 ? `<span class="biz-adj-pill" title="Có ghi nhận điều chỉnh sau khi chốt kỳ">⚠ ${adjCount} điều chỉnh sau chốt</span>` : ''}
      </div>
      <div class="biz-period-sub">
        ${isClosed
          ? `Đã chốt lúc <b>${esc(activeP.closedAt || '00:00 ngày 26')}</b> · Dữ liệu lịch sử được bảo toàn nguyên vẹn (công nợ chưa thu vẫn chuyển tiếp sang kỳ hiện tại).`
          : `Chu kỳ tự động chốt lúc <b>00:00 ngày ${esc(nextCloseDate)}</b> (Múi giờ ${APP_TIMEZONE}). Bộ đếm kỳ mới bắt đầu từ 0 · Công nợ chưa thu được bảo toàn xuyên kỳ.`}
      </div>
    </div>
    <div class="biz-period-controls">
      <label class="biz-period-select-wrap">
        <span>Chọn kỳ xem:</span>
        <select class="select biz-period-select" aria-label="Chọn kỳ kinh doanh chốt ngày 26" onchange="selectBusinessPeriod(this.value)">
          ${periods.map(p => `<option value="${esc(p.id)}" ${p.id === activeP.id ? 'selected' : ''}>${p.status === 'active' ? '● ' : '🔒 '}${esc(p.label)}${p.status === 'active' ? ' (Hiện tại)' : ' (Đã chốt)'}</option>`).join('')}
        </select>
      </label>
      ${isClosed ? `<button type="button" class="btn small primary" onclick="selectBusinessPeriod('${esc(curP.id)}')">↩ Về kỳ hiện tại</button>` : ''}
      <button type="button" class="btn small" onclick="openFinanceSubtab('periods')">📅 Lịch sử các kỳ (${periods.length})</button>
    </div>
  </div>`;
}

function overviewPage() {
  const filterSpec = getActivePeriodFilter();
  const selectedPeriodObj = periodMode === 'bizperiod' ? getSelectedBusinessPeriod() : null;
  const allStats = calcPeriodFinancials('');
  // Nếu đang xem kỳ đã chốt: dùng đúng snapshot bảo toàn của kỳ đó (vẫn cho phép đối chiếu với thực tế)
  const chartStats = (selectedPeriodObj && selectedPeriodObj.status === 'closed' && selectedPeriodObj.snapshot)
    ? selectedPeriodObj.snapshot
    : calcPeriodFinancials(filterSpec);
  const chartPeriodLabel = getPeriodLabel(filterSpec);

  const allPending = getPendingItems();
  const hasAnyDebt = m => m.customerDebt > 0 || m.warehouseDebt > 0;
  const filteredPending = allPending.filter(x =>
    todoFilter === 'all' ? true :
    todoFilter === 'debt' ? (x.kind === 'order' && hasAnyDebt(x.metrics)) :
    todoFilter === 'order' ? x.kind === 'order' :
    todoFilter === 'buy' ? x.kind === 'purchase' :
    todoFilter === 'ship' ? x.kind === 'shipment' : true
  );
  const debtOnlyCount = allPending.filter(x => x.kind === 'order' && hasAnyDebt(x.metrics)).length;
  const recentLogs = (db.logs || []).slice(0, 6);

  const actionStrip = `<div class="dash-alert-strip">
    <button type="button" class="dash-alert-pill ${allPending.length > 0 ? 'warn' : 'ok'}" onclick="scrollToTasksPanel()">
      <span>${allPending.length > 0 ? '⚠' : '✓'}</span>
      <b>${allPending.length} việc cần xử lý</b>
      <small>${allPending.length > 0 ? '(Bấm xem danh sách Tasks ↓)' : 'Mọi việc đều gọn gàng'}</small>
    </button>
    <button type="button" class="dash-alert-pill ${allStats.allWarehouseUnpaid > 0 ? 'payable' : 'ok'}" onclick="openFinanceSubtab('debts')">
      <span>📤</span>
      <b>Mình nợ cước kho phải trả: ${money(allStats.allWarehouseUnpaid)} ₫</b>
      <small>${allStats.allWarehouseUnpaid > 0 ? '(Tách riêng với khách nợ · Bấm để trả kho →)' : '✓ Đã thanh toán hết'}</small>
    </button>
  </div>`;

  return `<div class="section-stack">
    ${renderBusinessPeriodBanner()}

    ${actionStrip}

    ${renderCoreUiWidgets(chartStats, allStats, chartPeriodLabel, allPending.length, selectedPeriodObj, filterSpec)}

    ${renderTrafficChartCard(chartStats, chartPeriodLabel, filterSpec)}

    ${renderCoreUiChannelCards(filterSpec, chartStats)}

    <div class="visual-grid">
      ${renderProfitDonutChart(chartStats, chartPeriodLabel)}
      ${renderOrderPipelineBar(filterSpec, chartPeriodLabel)}
    </div>

    <div class="overview-split">
      <section class="panel" id="tasksPanel">
        <div class="panel-head">
          <div>
            <div class="panel-title">📌 Tasks · Việc cần xử lý & Công nợ mở</div>
            <div class="panel-sub">Đổi nhanh trạng thái hoặc bấm "Thu đủ" / "Trả kho" ngay trên dòng mà không cần mở form</div>
          </div>
          <div class="stage-strip" style="padding:0">
            <button type="button" class="chip ${todoFilter === 'all' ? 'active' : ''}" onclick="todoFilter='all';render()">Tất cả <span class="chip-count">${allPending.length}</span></button>
            <button type="button" class="chip ${todoFilter === 'debt' ? 'active' : ''}" onclick="todoFilter='debt';render()">Còn nợ <span class="chip-count">${debtOnlyCount}</span></button>
            <button type="button" class="chip ${todoFilter === 'order' ? 'active' : ''}" onclick="todoFilter='order';render()">Note đơn</button>
            <button type="button" class="chip ${todoFilter === 'buy' ? 'active' : ''}" onclick="todoFilter='buy';render()">Mua hộ</button>
            <button type="button" class="chip ${todoFilter === 'ship' ? 'active' : ''}" onclick="todoFilter='ship';render()">Ký gửi</button>
          </div>
        </div>
        ${filteredPending.length ? filteredPending.slice(0, 6).map(item => {
          if (item.kind === 'order') {
            const m = item.metrics;
            return `<div class="todo-row">
              <div class="todo-left">
                <div class="todo-info">
                  <div class="todo-title">
                    <span>${esc(item.customer)}</span>
                    ${linePill(item.lineType)}
                    ${platformPill(item.platform)}
                    <span class="code">${esc(item.packages || 1)} kiện · ${esc(item.goodsType)}</span>
                    ${item.packagingType && item.packagingType !== 'Tiêu chuẩn (Miễn phí)' ? `<span class="pack-pill">🪵 ${esc(item.packagingType)}</span>` : ''}
                  </div>
                  <div class="todo-meta">
                    <span>${currentUserRole !== 'warehouse' ? `Lãi: <b class="income-color">+${money(m.netProfit)} ₫</b>` : `Cước VC: <b>${money(m.shipCharge)} ₫</b>`}</span>
                    ${m.packProfit > 0 && currentUserRole !== 'warehouse' ? `<span>(Lãi ĐG: +${money(m.packProfit)} ₫)</span>` : ''}
                    ${m.customerDebt > 0 ? `<span class="expense-color">· <b>Khách nợ ${money(m.customerDebt)} ₫</b></span>` : ''}
                    ${m.warehouseDebt > 0 ? `<span class="amber-color">· <b>Nợ kho ${money(m.warehouseDebt)} ₫</b></span>` : ''}
                    ${item.updatedAt ? `<span>· 🕒 ${esc(item.updatedAt)}</span>` : ''}
                  </div>
                </div>
              </div>
              <div class="todo-right">
                ${statusSelect('order', item.id, item.status, orderStages)}
                ${m.customerDebt > 0 ? `<button type="button" class="iconbtn primary-tint" onclick="settleOrderDebt('${item.id}','customer')">Thu đủ</button>` : ''}
                ${m.warehouseDebt > 0 ? `<button type="button" class="iconbtn" onclick="settleOrderDebt('${item.id}','warehouse')">Trả kho</button>` : ''}
                <button type="button" class="iconbtn" onclick="editRecord('order','${item.id}')">Sửa</button>
              </div>
            </div>`;
          }
          const isShip = item.kind === 'shipment';
          return `<div class="todo-row">
            <div class="todo-left">
              <div class="todo-info">
                <div class="todo-title">
                  <span>${esc(item.customer)}</span>
                  <span class="line-pill line-other">${isShip ? '📦 Ký gửi' : '🛍 Mua hộ'}</span>
                  <span class="code">${esc(item.product)}</span>
                  ${item.packagingType && item.packagingType !== 'Tiêu chuẩn (Miễn phí)' ? `<span class="pack-pill">🪵 ${esc(item.packagingType)}</span>` : ''}
                </div>
                <div class="todo-meta">
                  <span>${isShip ? `Mã VĐ: <b>${esc(item.waybill)}</b>` : `Giá: <b>¥${numFmt(item.value)}</b>${item.quote ? ` · Báo: <b>¥${numFmt(item.quote)}</b>` : ''}`}</span>
                  ${item.updatedAt ? `<span>· 🕒 ${esc(item.updatedAt)}</span>` : ''}
                </div>
              </div>
            </div>
            <div class="todo-right">
              ${statusSelect(item.kind, item.id, item.status, isShip ? shipStages : buyStages)}
              <button type="button" class="iconbtn" onclick="editRecord('${item.kind}','${item.id}')">Sửa</button>
            </div>
          </div>`;
        }).join('') : `<div class="empty" style="padding:28px 16px">
          <strong>🎉 Mọi đơn hàng và công nợ trong mục này đều đã gọn gàng!</strong>
          <p>Bạn có thể tạo Note đơn mới để hệ thống tự động tính toán lợi nhuận.</p>
          <button type="button" class="btn small primary" onclick="openNew('order')">＋ Tạo Note đơn mới</button>
        </div>`}
      </section>

      <section class="panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">🕒 Lịch sử cập nhật gần đây</div>
            <div class="panel-sub">Tự động lưu dấu thời gian mỗi khi chỉnh sửa</div>
          </div>
          <button type="button" class="link-btn" onclick="openHistoryTab()">Xem tất cả →</button>
        </div>
        ${recentLogs.length ? recentLogs.map(l => `<div class="todo-row">
          <div class="todo-info">
            <div class="todo-title"><span class="code">${esc(l.action)}</span> <span>${esc(l.target)}</span></div>
            <div class="todo-meta">${esc(l.detail)}</div>
            <span class="ts-stamp">🕒 ${esc(l.time)}</span>
          </div>
        </div>`).join('') : '<div class="empty"><p>Chưa có hoạt động nào.</p></div>'}
      </section>
    </div>
  </div>`;
}

function loadSampleOrderNotes() {
  db.orderNotes = [...sampleOrderNotes(), ...(db.orderNotes || [])];
  addAuditLog('Tải mẫu', 'Note đơn', 'Đã thêm 2 Note đơn mẫu để tham khảo cách tính');
  persist();
  render();
  toast('✓ Đã thêm 2 Note đơn mẫu');
}

// ============================================================================
// TRANG 2: MỤC NOTE ĐƠN · DỊCH VỤ ĐÓNG GÓI & BẢNG TÍNH LÃI
// ============================================================================
function copyTextSafe(text, okMsg = '📋 Đã sao chép vào bộ nhớ tạm') {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => toast(okMsg)).catch(() => prompt('Sao chép nội dung:', text));
  } else {
    prompt('Sao chép nội dung:', text);
  }
}

function copyOrderBillZalo(orderId) {
  const o = (db.orderNotes || []).find(x => x.id === orderId);
  if (!o) return;
  const m = calcOrderMetrics(o);
  const lines = [
    `🐄 DAIRYCOW LOGISTICS — THÔNG TIN ĐƠN HÀNG`,
    `• Khách hàng: ${o.customer}${o.code ? ` (${o.code})` : ''}`,
    `• Mặt hàng: ${o.product || o.goodsType} (${o.packages || 1} kiện · ${o.lineType}${o.platform ? ' · ' + normalizePlatformName(o.platform) : ''})`,
    o.waybill ? `• Mã vận đơn: ${o.waybill}` : '',
    `• Ngày đơn: ${dateText(o.date)} · Trạng thái: ${o.status}`,
    `-----------------------`,
    m.finalGoodsVnd > 0 ? `• Giá trị hàng: ${money(m.finalGoodsVnd)} ₫` : '',
    m.serviceFee > 0 ? `• Phí dịch vụ: ${money(m.serviceFee)} ₫` : '',
    m.packCharge > 0 ? `• Phí đóng gói (${o.packagingType || 'Đóng gói'}): ${money(m.packCharge)} ₫` : '',
    m.extraShipTotal > 0 ? `• Cước ship phát sinh: ${money(m.extraShipTotal)} ₫` : '',
    m.shipCharge > 0 ? `• Cước vận chuyển (tính riêng): ${money(m.shipCharge)} ₫` : '',
    `👉 Tổng phải thu đơn: ${money(m.totalCollectCustomer)} ₫`,
    `• Đã thanh toán: ${money(m.customerPaid)} ₫`,
    `• CÒN LẠI CẦN THANH TOÁN: ${money(m.customerDebt)} ₫`
  ].filter(Boolean).join('\n');
  copyTextSafe(lines, `📋 Đã chép phiếu báo khách ${o.customer} — dán gửi Zalo được ngay!`);
}

function copyCustomerDebtZalo(custKey) {
  const c = uniqueCustomers().find(o => (o.code || o.phone || o.customer).toLowerCase() === String(custKey || '').toLowerCase());
  if (!c) return;
  const unpaidOrders = (db.orderNotes || []).filter(x => x.status !== 'Đã hủy' && sameCustomer(x, c) && calcOrderMetrics(x).customerDebt > 0);
  const unlinkedExtras = (db.extraShipments || []).filter(x => !isExtraShipLinkedToOrder(x) && sameCustomer(x, c) && (Math.round(parseNum(x.amount)) - getExtraCurrentPaid(x)) > 0);
  let totalDebt = 0;
  const detailLines = [];
  unpaidOrders.forEach((o, idx) => {
    const m = calcOrderMetrics(o);
    totalDebt += m.customerDebt;
    detailLines.push(`${idx + 1}. [${dateText(o.date)}] ${o.product || o.goodsType}${o.platform ? ` (${normalizePlatformName(o.platform)})` : ''}: còn ${money(m.customerDebt)} ₫`);
  });
  unlinkedExtras.forEach(x => {
    const rem = Math.max(0, Math.round(parseNum(x.amount)) - getExtraCurrentPaid(x));
    totalDebt += rem;
    detailLines.push(`${detailLines.length + 1}. [${dateText(x.date)}] Cước ship PS (${x.content || ''}): còn ${money(rem)} ₫`);
  });
  if (totalDebt <= 0) {
    toast('Khách hàng này hiện không còn khoản nợ nào.');
    return;
  }
  const msg = [
    `🐄 DAIRYCOW LOGISTICS xin phép gửi bảng đối chiếu công nợ của ${c.customer}:`,
    ...detailLines,
    `-----------------------`,
    `👉 TỔNG CỘNG CẦN THANH TOÁN: ${money(totalDebt)} ₫`,
    `Bạn kiểm tra giúp shop nhé, cảm ơn bạn nhiều ạ!`
  ].join('\n');
  copyTextSafe(msg, `📋 Đã chép phiếu nhắc nợ ${c.customer} (${money(totalDebt)} ₫)`);
}

function exportOrdersCsv() {
  const rows = [
    ['Ngày đơn', 'Mã KH', 'Khách hàng', 'SĐT', 'Line', 'App/Sàn', 'Loại hàng', 'Mặt hàng', 'Số kiện', 'Mã VĐ', 'Giá hàng VND', 'Phí DV', 'Cước gốc kho', 'Cước thu khách', 'Vốn đóng gói', 'Thu đóng gói', 'Cước ship PS', 'Tổng phải thu', 'Khách đã trả', 'Khách còn nợ', 'Lợi nhuận thực tế', 'Trạng thái']
  ];
  (db.orderNotes || []).forEach(o => {
    const m = calcOrderMetrics(o);
    rows.push([
      o.date || '', o.code || '', o.customer || '', o.phone || '', o.lineType || '',
      normalizePlatformName(o.platform || ''), o.goodsType || '', o.product || '', o.packages || 1, o.waybill || '',
      m.finalGoodsVnd, m.serviceFee, m.shipCost, m.shipCharge, m.packCost, m.packCharge, m.extraShipTotal,
      m.totalCollectCustomer, m.customerPaid, m.customerDebt, m.netProfit, o.status || ''
    ]);
  });
  const csv = '\uFEFF' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dairycow-note-don-${dateKey()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
  toast('📊 Đã xuất file Excel (.csv) danh sách Note đơn');
}

function getOrdersViewData() {
  const q = query.toLowerCase();
  const all = db.orderNotes || [];
  const activeBp = getSelectedBusinessPeriod();
  const filtered = all.filter(o => {
    if (window.ordersPeriodOnly && !matchesDateFilter(o.date, { startDate: activeBp.startDate, endDate: activeBp.endDate })) return false;
    const packNames = Array.isArray(o.packagingItems) ? o.packagingItems.map(x => x.name).join(' ') : '';
    const normPlat = normalizePlatformName(o.platform);
    const text = `${o.lineType} ${normPlat} ${o.platform || ''} ${o.customer} ${o.phone || ''} ${o.code || ''} ${o.waybill || ''} ${o.goodsType} ${o.packagingType || ''} ${packNames} ${o.product || ''} ${o.note || ''} ${o.status}`.toLowerCase();
    if (q && !text.includes(q)) return false;
    if (window.platformFilter && normPlat !== window.platformFilter) return false;
    if (!window.statusFilter) return true;
    if (window.statusFilter.startsWith('__line_')) return o.lineType === window.statusFilter.replace('__line_', '');
    if (window.statusFilter === '__pack') return (Array.isArray(o.packagingItems) && o.packagingItems.length > 0) || parseNum(o.packCharge) > 0 || (o.packagingType && o.packagingType !== 'Tiêu chuẩn (Miễn phí)');
    if (window.statusFilter === '__pipe_wait') return ['Mới tạo / Chờ xử lý', 'Chờ khách thanh toán'].includes(o.status);
    if (window.statusFilter === '__pipe_ship') return ['Đã thanh toán hộ', 'Đang vận chuyển'].includes(o.status);
    if (window.statusFilter === '__pipe_vn') return o.status === 'Đã về kho VN';
    if (window.statusFilter === '__pipe_done') return ['Đã giao khách', 'Hoàn tất / Đã tất toán'].includes(o.status);
    if (window.statusFilter === '__debt') {
      if (o.status === 'Đã hủy') return false;
      const m = calcOrderMetrics(o);
      return m.customerDebt > 0 || m.warehouseDebt > 0;
    }
    return o.status === window.statusFilter;
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const rows = filtered.map(o => {
    const m = calcOrderMetrics(o);
    const posTotal = Math.max(1, Math.max(0, m.shipProfit) + Math.max(0, m.serviceFee) + Math.max(0, m.packProfit) + Math.max(0, m.fxProfit));
    const wShip = Math.round((Math.max(0, m.shipProfit) / posTotal) * 100);
    const wFee = Math.round((Math.max(0, m.serviceFee) / posTotal) * 100);
    const wPack = Math.round((Math.max(0, m.packProfit) / posTotal) * 100);
    const wFx = Math.max(0, 100 - wShip - wFee - wPack);
    const pItems = Array.isArray(o.packagingItems) ? o.packagingItems : [];
    const hasPack = pItems.length > 0 || (o.packagingType && o.packagingType !== 'Tiêu chuẩn (Miễn phí)') || m.packCharge > 0 || m.packCost > 0;
    const packSummaryText = pItems.length > 0
      ? pItems.map(it => `${numFmt(it.qty)} ${it.name}`).join(' · ')
      : (o.packagingType || 'Đóng gói kỹ');

    return `<tr>
      <td data-label="Khách & Kiện hàng">
        <div class="customer">
          <div class="mini-avatar">${avatar(o.customer)}</div>
          <div>
            <div class="person">${esc(o.customer)} <span class="code">${esc(o.code || '—')}</span> ${linePill(o.lineType)} ${platformPill(o.platform)}</div>
            <div class="subline"><b>${esc(o.packages || 1)} kiện</b> · ${esc(o.goodsType)}${o.product ? ' · ' + esc(o.product) : ''}</div>
            ${hasPack ? `<div style="margin-top:3px"><span class="pack-pill">🪵 ${esc(packSummaryText)}${m.packCharge > 0 ? ` (+${money(m.packCharge)} ₫)` : ''}</span></div>` : ''}
            <div class="subline">Ngày: ${dateText(o.date)}${o.waybill ? ` · VĐ: <a class="link" target="_blank" rel="noopener" href="https://www.17track.net/en#nums=${encodeURIComponent(o.waybill)}">${esc(o.waybill)} ↗</a>` : ''}</div>
          </div>
        </div>
      </td>
      <td data-label="Giá hàng, Cước & Đóng gói">
        <div>Hàng: <b>${money(m.finalGoodsVnd)} ₫</b> ${parseNum(o.goodsCny) > 0 ? `<span class="code">¥${numFmt(o.goodsCny)}${parseNum(o.rateSell) > 0 ? ' × ' + money(o.rateSell) : ''}</span>` : ''}</div>
        <div class="subline">Cước thu: <b>${money(m.shipCharge)} ₫</b> (Gốc kho: ${money(m.shipCost)} ₫)</div>
        ${hasPack ? `<div class="subline">Đóng gói: Thu <b>${money(m.packCharge)} ₫</b> · Vốn <b>${money(m.packCost)} ₫</b> (Lãi: +${money(m.packProfit)} ₫)</div>` : ''}
        ${m.extraShipTotal > 0 ? `<div class="subline">🚚 Cước ship phát sinh: <b>+${money(m.extraShipTotal)} ₫</b></div>` : ''}
      </td>
      <td data-label="Phải thu & Công nợ">
        <div>Phải thu khách: <b>${money(m.totalCollectCustomer)} ₫</b></div>
        ${m.shipCharge > 0 ? `<div class="subline" title="Cước vận chuyển tính riêng, không gộp vào nợ khách">🚚 Cước VC riêng: <b>${money(m.shipCharge)} ₫</b></div>` : ''}
        <div>
          ${o.status === 'Đã hủy'
            ? `<span class="code">Đã hủy đơn</span>`
            : m.customerDebt > 0
              ? `<span class="debt-pill owe">Khách nợ ${money(m.customerDebt)} ₫</span>`
              : m.totalCollectCustomer > 0
                ? `<span class="debt-pill ok">✓ Đã thu đủ</span>`
                : `<span class="subline">Chưa nhập phí thu</span>`}
          ${m.warehouseDebt > 0 ? `<span class="debt-pill ware">Chưa trả cước kho ${shortMoney(m.warehouseDebt)}</span>` : `<span class="debt-pill ok">✓ Đã trả cước kho</span>`}
        </div>
      </td>
      <td data-label="Lợi nhuận thực tế">
        <div class="profit-num ${m.netProfit >= 0 ? 'income-color' : 'expense-color'}">${m.netProfit >= 0 ? '+' : ''}${money(m.netProfit)} ₫</div>
        <div class="mini-profit-bar" title="Xanh dương: Lãi cước · Xanh lá: Phí DV · Đỏ cam: Lãi đóng gói · Vàng: Lãi tệ">
          <span style="width:${wShip}%;background:#20a8d8"></span>
          <span style="width:${wFee}%;background:#4dbd74"></span>
          <span style="width:${wPack}%;background:#f86c6b"></span>
          <span style="width:${wFx}%;background:#f8cb00"></span>
        </div>
        <div class="subline">
          Cước ${m.shipProfit >= 0 ? '+' : ''}${shortMoney(m.shipProfit)} · DV +${shortMoney(m.serviceFee)}${o.serviceFeePct ? ` (${numFmt(o.serviceFeePct)}%)` : ''}${m.packProfit ? ` · ĐG ${m.packProfit >= 0 ? '+' : ''}${shortMoney(m.packProfit)}` : ''}${m.fxProfit ? ` · Tệ +${shortMoney(m.fxProfit)}` : ''}${m.extraCost ? ` · Chi −${shortMoney(m.extraCost)}` : ''}
        </div>
      </td>
      <td data-label="Trạng thái & Thao tác">
        <div style="display:flex;flex-direction:column;align-items:flex-start;gap:6px">
          ${statusSelect('order', o.id, o.status, orderStages)}
          ${o.note ? `<div class="note-box">${esc(o.note)}</div>` : ''}
          ${o.updatedAt ? `<span class="ts-stamp">🕒 ${esc(o.updatedAt)}</span>` : ''}
          <div class="row-actions" style="margin-top:2px">
            ${m.customerDebt > 0 ? `<button type="button" class="iconbtn primary-tint" onclick="settleOrderDebt('${o.id}','customer')">Thu đủ</button>` : ''}
            ${m.warehouseDebt > 0 ? `<button type="button" class="iconbtn" onclick="settleOrderDebt('${o.id}','warehouse')">Đã trả cước kho</button>` : ''}
            <button type="button" class="iconbtn" onclick="copyOrderBillZalo('${o.id}')" title="Sao chép chi tiết đơn gửi Zalo cho khách">📋 Báo khách</button>
            <button type="button" class="iconbtn" onclick="editRecord('order','${o.id}')">Sửa</button>
            <button type="button" class="iconbtn danger-tint" onclick="deleteItemDirect('order','${o.id}')">Xóa</button>
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');

  let sumPkgs = 0, sumCollect = 0, sumPaid = 0, sumDebt = 0, sumProfit = 0;
  filtered.forEach(o => {
    if (o.status === 'Đã hủy') return;
    const m = calcOrderMetrics(o);
    sumPkgs += Number(o.packages || 1);
    sumCollect += m.totalCollectCustomer;
    sumPaid += m.customerPaid;
    sumDebt += m.customerDebt;
    sumProfit += m.netProfit;
  });

  const hideProfit = currentUserRole === 'warehouse';
  const summaryHtml = `<div class="orders-summary-bar" id="ordersSummaryBar">
    <div class="osb-item"><span>Đang hiển thị</span><b>${filtered.length} đơn (${numFmt(sumPkgs)} kiện)</b></div>
    <div class="osb-item"><span>Tổng phải thu</span><b>${money(sumCollect)} ₫</b></div>
    <div class="osb-item"><span>Khách đã trả</span><b class="income-color">${money(sumPaid)} ₫</b></div>
    <div class="osb-item"><span>Khách còn nợ</span><b class="${sumDebt > 0 ? 'expense-color' : 'income-color'}">${money(sumDebt)} ₫</b></div>
    ${!hideProfit ? `<div class="osb-item"><span>Tổng lãi ròng</span><b class="${sumProfit >= 0 ? 'income-color' : 'expense-color'}">${sumProfit >= 0 ? '+' : ''}${money(sumProfit)} ₫</b></div>` : ''}
  </div>`;

  const headers = '<th>Khách & Kiện hàng</th><th>Giá trị hàng, Cước & Đóng gói</th><th>Phải thu & Công nợ</th><th>Lợi nhuận thực tế</th><th>Trạng thái, Ghi chú & Thao tác</th>';
  const hasFilter = Boolean(query || window.statusFilter || window.platformFilter || window.ordersPeriodOnly);
  const tableHtml = `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>` +
    (rows ? '' : `<div class="empty">
      <div class="empty-ico">${hasFilter ? '🔎' : '🧮'}</div>
      <strong>${hasFilter ? 'Không tìm thấy Note đơn phù hợp' : 'Chưa có Note đơn nào'}</strong>
      <p>${hasFilter ? 'Thử đổi từ khóa hoặc đặt lại bộ lọc.' : 'Tạo Note đơn để tự động tính lãi cước, lãi dịch vụ đóng gói, phí dịch vụ %, lãi tỷ giá tệ và theo dõi công nợ.'}</p>
      <div class="row-actions" style="justify-content:center">
        ${hasFilter
          ? `<button type="button" class="btn small" onclick="clearFilters()">Xóa bộ lọc</button>`
          : `<button type="button" class="btn small primary" onclick="openNew('order')">＋ Tạo Note đơn mới</button>
             <button type="button" class="btn small" onclick="loadSampleOrderNotes()">Tải 2 đơn mẫu</button>`
        }
      </div>
    </div>`);

  return { totalCount: all.length, filteredCount: filtered.length, tableHtml, summaryHtml };
}

function ordersPage() {
  const all = db.orderNotes || [];
  const activeBp = getSelectedBusinessPeriod();
  const periodCount = all.filter(x => matchesDateFilter(x.date, { startDate: activeBp.startDate, endDate: activeBp.endDate })).length;
  const xtCount = all.filter(x => x.lineType === 'Xách tay').length;
  const tthCount = all.filter(x => x.lineType === 'Thanh toán hộ').length;
  const kgCount = all.filter(x => x.lineType === 'Ký gửi kho').length;
  const packCount = all.filter(x => (Array.isArray(x.packagingItems) && x.packagingItems.length > 0) || parseNum(x.packCharge) > 0 || (x.packagingType && x.packagingType !== 'Tiêu chuẩn (Miễn phí)')).length;
  const debtCount = all.filter(x => {
    if (x.status === 'Đã hủy') return false;
    const m = calcOrderMetrics(x);
    return m.customerDebt > 0 || m.warehouseDebt > 0;
  }).length;
  const data = getOrdersViewData();
  const hasFilter = Boolean(query || window.statusFilter || window.platformFilter || window.ordersPeriodOnly);

  return `<div class="section-stack">
    <div class="stage-strip" aria-label="Lọc nhanh theo Line, Đóng gói và Công nợ">
      <button type="button" class="chip ${window.statusFilter === '' && !window.ordersPeriodOnly ? 'active' : ''}" onclick="window.ordersPeriodOnly=false;setFilter('')">Tất cả đơn <span class="chip-count">${all.length}</span></button>
      <button type="button" class="chip ${window.ordersPeriodOnly ? 'active' : ''}" onclick="window.ordersPeriodOnly=!window.ordersPeriodOnly;render()">📅 Riêng ${esc(activeBp.shortLabel)} <span class="chip-count">${periodCount}</span></button>
      <button type="button" class="chip ${window.statusFilter === '__line_Xách tay' ? 'active' : ''}" onclick="setFilter('__line_Xách tay')">✈️ Xách tay <span class="chip-count">${xtCount}</span></button>
      <button type="button" class="chip ${window.statusFilter === '__line_Thanh toán hộ' ? 'active' : ''}" onclick="setFilter('__line_Thanh toán hộ')">💴 Thanh toán hộ <span class="chip-count">${tthCount}</span></button>
      <button type="button" class="chip ${window.statusFilter === '__line_Ký gửi kho' ? 'active' : ''}" onclick="setFilter('__line_Ký gửi kho')">📦 Ký gửi kho <span class="chip-count">${kgCount}</span></button>
      <button type="button" class="chip ${window.statusFilter === '__pack' ? 'active' : ''}" onclick="setFilter('__pack')">🪵 Dịch vụ đóng gói <span class="chip-count">${packCount}</span></button>
      <button type="button" class="chip ${window.statusFilter === '__debt' ? 'active' : ''}" onclick="setFilter('__debt')">⚠️ Còn công nợ <span class="chip-count">${debtCount}</span></button>
    </div>

    ${data.summaryHtml}

    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Danh sách Note đơn · Dịch vụ Đóng gói & Minh bạch lãi lỗ</div>
          <div class="panel-sub">Thanh màu dưới số lãi thể hiện tỷ lệ: <b style="color:#20a8d8">Lãi cước</b> · <b style="color:#4dbd74">Phí dịch vụ</b> · <b style="color:#f86c6b">Lãi đóng gói</b> · <b style="color:#d97706">Lãi tỷ giá tệ</b></div>
        </div>
        <div class="row-actions">
          <button type="button" class="btn small" onclick="exportOrdersCsv()" title="Xuất bảng Excel (.csv) chuẩn tiếng Việt">📊 Xuất Excel</button>
          <span class="result-count" id="resultCount">${data.filteredCount} / ${data.totalCount} đơn</span>
        </div>
      </div>
      <div class="filters">
        <div class="search">
          <span class="search-ico" aria-hidden="true">⌕</span>
          <input id="searchInput" class="field" placeholder="Tìm khách hàng, loại hàng, quy cách đóng gói, mã vận đơn…" value="${esc(query)}" oninput="handleSearch(this)">
          <button type="button" id="searchClearBtn" class="search-clear ${query ? '' : 'hidden'}" onclick="clearSearchInput()" title="Xóa từ khóa">×</button>
        </div>
        <select class="select" aria-label="Lọc theo App / Sàn mua hàng" onchange="setPlatformFilter(this.value)">
          <option value="">Mọi App / Sàn</option>
          ${shopPlatforms.map(p => `<option value="${esc(p)}" ${window.platformFilter === p ? 'selected' : ''}>🛍 ${esc(p)}</option>`).join('')}
        </select>
        <select class="select" aria-label="Lọc trạng thái đơn" onchange="setFilter(this.value)">
          <option value="">Mọi trạng thái</option>
          <option value="__debt" ${window.statusFilter === '__debt' ? 'selected' : ''}>Đơn còn công nợ</option>
          ${orderStages.map(s => `<option value="${esc(s)}" ${window.statusFilter === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
        </select>
        <button type="button" id="resetFilterBtn" class="btn subtle small ${hasFilter ? '' : 'hidden'}" onclick="clearFilters()">Đặt lại lọc</button>
      </div>
      <div class="table-wrap" id="tableArea">${data.tableHtml}</div>
    </section>
  </div>`;
}

// ============================================================================
// TRANG 2B: CHI PHÍ PHÁT SINH & QUẢN LÝ LỢI NHUẬN ĐÓNG GÓI (4 TAB RIÊNG BIỆT)
// ============================================================================
function matchIncidentalDate(dStr) {
  if (incPeriodMode === 'all') return true;
  const d = String(dStr || dateKey()).slice(0, 10);
  if (incPeriodMode === 'day') return d === incDate;
  if (incPeriodMode === 'month') return d.startsWith(incMonth);
  if (incPeriodMode === 'custom') {
    const from = incFromDate || '0000-01-01';
    const to = incToDate || '9999-12-31';
    return d >= from && d <= to;
  }
  if (incPeriodMode === 'week') {
    const ref = new Date((incWeekDate || dateKey()) + 'T00:00:00');
    const dayOfWeek = ref.getDay() || 7; // 1 (Mon) .. 7 (Sun)
    const mon = new Date(ref);
    mon.setDate(ref.getDate() - dayOfWeek + 1);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    const from = dateKey(mon);
    const to = dateKey(sun);
    return d >= from && d <= to;
  }
  return true;
}

function getIncPeriodLabel() {
  if (incPeriodMode === 'day') return `Ngày ${dateText(incDate)}`;
  if (incPeriodMode === 'week') {
    const ref = new Date((incWeekDate || dateKey()) + 'T00:00:00');
    const dayOfWeek = ref.getDay() || 7;
    const mon = new Date(ref);
    mon.setDate(ref.getDate() - dayOfWeek + 1);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return `Tuần (${dateText(dateKey(mon))} – ${dateText(dateKey(sun))})`;
  }
  if (incPeriodMode === 'month') {
    const [y, m] = (incMonth || dateKey().slice(0, 7)).split('-');
    return `Tháng ${m}/${y}`;
  }
  if (incPeriodMode === 'custom') return `Từ ${dateText(incFromDate)} đến ${dateText(incToDate)}`;
  return 'Toàn bộ thời gian';
}

function renderIncPeriodPicker() {
  return `<div class="period-bar">
    <button type="button" class="chip ${incPeriodMode === 'day' ? 'active' : ''}" onclick="incPeriodMode='day';render()">Ngày</button>
    <button type="button" class="chip ${incPeriodMode === 'week' ? 'active' : ''}" onclick="incPeriodMode='week';render()">Tuần</button>
    <button type="button" class="chip ${incPeriodMode === 'month' ? 'active' : ''}" onclick="incPeriodMode='month';render()">Tháng</button>
    <button type="button" class="chip ${incPeriodMode === 'custom' ? 'active' : ''}" onclick="incPeriodMode='custom';render()">Tùy chọn</button>
    <button type="button" class="chip ${incPeriodMode === 'all' ? 'active' : ''}" onclick="incPeriodMode='all';render()">Tất cả</button>
    ${incPeriodMode === 'day' ? `<input type="date" class="field" style="padding:5px 9px" value="${esc(incDate)}" onchange="incDate=this.value;render()">` : ''}
    ${incPeriodMode === 'week' ? `<input type="date" class="field" style="padding:5px 9px" value="${esc(incWeekDate)}" title="Chọn 1 ngày bất kỳ trong tuần" onchange="incWeekDate=this.value;render()">` : ''}
    ${incPeriodMode === 'month' ? `<input type="month" class="field" style="padding:5px 9px" value="${esc(incMonth)}" onchange="incMonth=this.value;render()">` : ''}
    ${incPeriodMode === 'custom' ? `
      <input type="date" class="field" style="padding:5px 9px" value="${esc(incFromDate)}" onchange="incFromDate=this.value;render()">
      <span style="font-size:12px;color:var(--muted)">→</span>
      <input type="date" class="field" style="padding:5px 9px" value="${esc(incToDate)}" onchange="incToDate=this.value;render()">
    ` : ''}
  </div>`;
}

// Tính thống kê tổng hợp Chi phí phát sinh & 3 danh mục Đóng gói (Bảo toàn lịch sử giá trên từng đơn hàng)
function calcIncidentalsSummary() {
  const catalog = db.packagingCatalog || [];
  const catStats = {
    wood: { cost: 0, rev: 0, profit: 0 },
    carton: { cost: 0, rev: 0, profit: 0 },
    shock: { cost: 0, rev: 0, profit: 0 }
  };

  // 1. Từ bảng danh mục đóng gói trực tiếp
  catalog.forEach(item => {
    if (!matchIncidentalDate(item.date)) return;
    const cat = ['wood', 'carton', 'shock'].includes(item.category) ? item.category : 'wood';
    const qty = Math.max(0, parseNum(item.qty));
    const cost = Math.round(parseNum(item.costPrice) * qty);
    const rev = Math.round(parseNum(item.sellPrice) * qty);
    catStats[cat].cost += cost;
    catStats[cat].rev += rev;
    catStats[cat].profit += (rev - cost);
  });

  // 2. Từ các vật tư đóng gói đã gắn trực tiếp vào từng đơn hàng (dùng đúng giá nhập & giá bán tại thời điểm phát sinh)
  (db.orderNotes || []).filter(o => o.status !== 'Đã hủy' && matchIncidentalDate(o.date)).forEach(o => {
    const pItems = Array.isArray(o.packagingItems) ? o.packagingItems : [];
    pItems.forEach(it => {
      const cat = ['wood', 'carton', 'shock'].includes(it.category) ? it.category : 'wood';
      const qty = Math.max(0, parseNum(it.qty));
      const cost = Math.round(parseNum(it.costPrice) * qty);
      const rev = Math.round(parseNum(it.sellPrice) * qty);
      catStats[cat].cost += cost;
      catStats[cat].rev += rev;
      catStats[cat].profit += (rev - cost);
    });
  });

  const totalPackCost = catStats.wood.cost + catStats.carton.cost + catStats.shock.cost;
  const totalPackRevenue = catStats.wood.rev + catStats.carton.rev + catStats.shock.rev;
  const totalPackProfit = catStats.wood.profit + catStats.carton.profit + catStats.shock.profit;

  // 3. Thống kê Cước ship phát sinh (Khách phải trả, không phải lợi nhuận mặc định)
  const extraShips = (db.extraShipments || []).filter(x => matchIncidentalDate(x.date));
  let totalExtraShip = 0;
  let collectedExtraShip = 0;
  extraShips.forEach(x => {
    const amt = Math.round(parseNum(x.amount));
    totalExtraShip += amt;
    if (x.status === 'Đã thu') {
      collectedExtraShip += amt;
    } else if (x.status === 'Thu một phần') {
      collectedExtraShip += Math.min(amt, Math.max(0, Math.round(parseNum(x.paidAmount))));
    }
  });
  const uncollectedExtraShip = Math.max(0, totalExtraShip - collectedExtraShip);

  return {
    totalPackCost,
    totalPackRevenue,
    totalPackProfit,
    woodProfit: catStats.wood.profit,
    cartonProfit: catStats.carton.profit,
    shockProfit: catStats.shock.profit,
    woodStats: catStats.wood,
    cartonStats: catStats.carton,
    shockStats: catStats.shock,
    totalExtraShip,
    collectedExtraShip,
    uncollectedExtraShip
  };
}

function getExtraShipViewData() {
  const q = query.toLowerCase();
  const all = (db.extraShipments || []).filter(x => matchIncidentalDate(x.date));
  const filtered = all.filter(x => {
    const matchQ = `${x.orderCode || ''} ${x.customer || ''} ${x.content || ''} ${x.status || ''}`.toLowerCase().includes(q);
    const matchStatus = !window.statusFilter ? true : x.status === window.statusFilter;
    return matchQ && matchStatus;
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const rows = filtered.map(x => {
    const amt = Math.round(parseNum(x.amount));
    const paid = x.status === 'Đã thu' ? amt : x.status === 'Thu một phần' ? Math.min(amt, Math.max(0, Math.round(parseNum(x.paidAmount)))) : 0;
    const unpaid = Math.max(0, amt - paid);

    return `<tr>
      <td data-label="Mã đơn hàng">
        <span class="code">${esc(x.orderCode || 'Chưa gắn mã')}</span>
      </td>
      <td data-label="Tên khách hàng">
        <div class="person">${esc(x.customer || '—')}</div>
      </td>
      <td data-label="Nội dung phát sinh">
        <div><b>${esc(x.content || 'Cước ship phát sinh')}</b></div>
        ${x.updatedAt ? `<span class="ts-stamp">🕒 ${esc(x.updatedAt)}</span>` : ''}
      </td>
      <td data-label="Số tiền">
        <div><b>${money(amt)} ₫</b></div>
        ${x.status === 'Thu một phần' ? `<div class="subline">Đã thu: <b class="income-color">${money(paid)} ₫</b> · Còn thiếu: <b class="expense-color">${money(unpaid)} ₫</b></div>` : ''}
      </td>
      <td data-label="Ngày phát sinh">${dateText(x.date)}</td>
      <td data-label="Trạng thái thanh toán">
        ${statusSelect('extraship', x.id, x.status || 'Chưa thu', extraShipStatuses)}
      </td>
      <td data-label="Thao tác">
        <div class="row-actions">
          ${x.status !== 'Đã thu' ? `<button type="button" class="iconbtn primary-tint" onclick="settleExtraShip('${x.id}')">Thu đủ</button>` : ''}
          <button type="button" class="iconbtn" onclick="editRecord('extraship','${x.id}')">Sửa</button>
          <button type="button" class="iconbtn danger-tint" onclick="deleteExtraShip('${x.id}')">Xóa</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  const headers = '<th>Mã đơn hàng</th><th>Tên khách hàng</th><th>Nội dung phát sinh</th><th>Số tiền khách trả</th><th>Ngày phát sinh</th><th>Trạng thái thanh toán</th><th>Thao tác</th>';
  const tableHtml = `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>` +
    (rows ? '' : `<div class="empty">
      <div class="empty-ico">🚚</div>
      <strong>Chưa có khoản Cước ship phát sinh nào</strong>
      <p>Thêm khoản phí vận chuyển phát sinh mà khách hàng cần thanh toán (tự động cộng vào số tiền khách cần trả của đơn hàng liên kết).</p>
      <button type="button" class="btn small primary" onclick="openNew('extraship')">＋ Thêm Cước ship phát sinh</button>
    </div>`);

  return { totalCount: all.length, filteredCount: filtered.length, tableHtml };
}

function getPackagingTabViewData(cat) {
  const q = query.toLowerCase();
  const all = (db.packagingCatalog || []).filter(x => x.category === cat && matchIncidentalDate(x.date));
  const filtered = all.filter(x => `${x.name} ${x.spec || ''} ${x.unit || ''} ${x.note || ''}`.toLowerCase().includes(q));

  let sumCost = 0;
  let sumRev = 0;
  let sumProfit = 0;
  let sumQty = 0;

  const rows = filtered.map(x => {
    const costPrice = Math.round(parseNum(x.costPrice));
    const sellPrice = Math.round(parseNum(x.sellPrice));
    const unitProfit = sellPrice - costPrice;

    // Cộng thêm số lượng & doanh thu/giá vốn lịch sử từ các đơn hàng đã gắn sản phẩm này trong kỳ
    let orderQty = 0;
    let orderCost = 0;
    let orderRev = 0;
    (db.orderNotes || []).filter(o => o.status !== 'Đã hủy' && matchIncidentalDate(o.date)).forEach(o => {
      (o.packagingItems || []).forEach(it => {
        if (it.catalogId === x.id) {
          const qUsed = Math.max(0, parseNum(it.qty));
          orderQty += qUsed;
          orderCost += Math.round(parseNum(it.costPrice) * qUsed);
          orderRev += Math.round(parseNum(it.sellPrice) * qUsed);
        }
      });
    });

    const baseQty = Math.max(0, parseNum(x.qty));
    const totalQty = baseQty + orderQty;
    const totalCost = Math.round(costPrice * baseQty) + orderCost;
    const totalRevenue = Math.round(sellPrice * baseQty) + orderRev;
    const totalProfit = totalRevenue - totalCost;

    sumQty += totalQty;
    sumCost += totalCost;
    sumRev += totalRevenue;
    sumProfit += totalProfit;

    return `<tr>
      <td data-label="Sản phẩm">
        <div class="person">${esc(x.name)} <span class="code">${esc(x.unit || 'Cái')}</span></div>
        <div class="subline">${esc(x.spec || 'Tiêu chuẩn')}${parseNum(x.bulkCost) > 0 && parseNum(x.usesPerBulk) > 1 ? ` · Gốc lô: ${money(x.bulkCost)} ₫ / ${numFmt(x.usesPerBulk)} lần` : ''}</div>
        ${orderQty > 0 ? `<div class="subline" style="color:var(--core-blue)">📦 Đã gắn vào đơn: <b>${numFmt(orderQty)} ${esc(x.unit || 'lần')}</b> (bảo toàn giá lúc phát sinh)</div>` : ''}
      </td>
      <td data-label="Giá nhập"><b>${money(costPrice)} ₫</b><div class="subline">/ ${esc(x.unit || 'Cái')}</div></td>
      <td data-label="Giá bán"><b>${money(sellPrice)} ₫</b><div class="subline">/ ${esc(x.unit || 'Cái')}</div></td>
      <td data-label="Lãi đơn vị"><b class="${unitProfit >= 0 ? 'income-color' : 'expense-color'}">${unitProfit >= 0 ? '+' : ''}${money(unitProfit)} ₫</b></td>
      <td data-label="Số lượng">
        <div class="qty-stepper">
          <button type="button" class="qty-step-btn" onclick="stepPackQty('${x.id}', -1)" title="Giảm 1">−</button>
          <b style="min-width:28px;text-align:center">${numFmt(totalQty)}</b>
          <button type="button" class="qty-step-btn" onclick="stepPackQty('${x.id}', 1)" title="Tăng 1">＋</button>
        </div>
      </td>
      <td data-label="Tổng giá vốn"><b>${money(totalCost)} ₫</b></td>
      <td data-label="Tổng doanh thu"><b class="blue-color">${money(totalRevenue)} ₫</b></td>
      <td data-label="Tổng lãi"><b class="${totalProfit >= 0 ? 'income-color' : 'expense-color'}">${totalProfit >= 0 ? '+' : ''}${money(totalProfit)} ₫</b></td>
      <td data-label="Thao tác">
        <div class="row-actions">
          <button type="button" class="iconbtn" onclick="editRecord('packitem','${x.id}')">Sửa</button>
          <button type="button" class="iconbtn danger-tint" onclick="deletePackItem('${x.id}')">Xóa</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  const headers = '<th>Sản phẩm</th><th>Giá nhập</th><th>Giá bán</th><th>Lãi đơn vị</th><th>Số lượng</th><th>Tổng giá vốn</th><th>Tổng doanh thu</th><th>Tổng lãi</th><th>Thao tác</th>';
  const tfoot = rows ? `<tfoot>
    <tr>
      <td colspan="4">Tổng cộng danh mục này</td>
      <td>${numFmt(sumQty)}</td>
      <td>${money(sumCost)} ₫</td>
      <td class="blue-color">${money(sumRev)} ₫</td>
      <td class="${sumProfit >= 0 ? 'income-color' : 'expense-color'}">${sumProfit >= 0 ? '+' : ''}${money(sumProfit)} ₫</td>
      <td></td>
    </tr>
  </tfoot>` : '';

  const catNames = { wood: 'Đóng hộp gỗ', carton: 'Đóng hộp carton', shock: 'Chống sốc' };
  const tableHtml = `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody>${tfoot}</table>` +
    (rows ? '' : `<div class="empty">
      <div class="empty-ico">🪵</div>
      <strong>Chưa có sản phẩm trong mục ${esc(catNames[cat] || '')}</strong>
      <p>Nhấn nút bên dưới để thêm sản phẩm đóng gói và tự động tính giá vốn, doanh thu, lợi nhuận.</p>
      <div class="row-actions" style="justify-content:center">
        <button type="button" class="btn small primary" onclick="openNewPackItem('${cat}')">＋ Thêm sản phẩm ${esc(catNames[cat] || '')}</button>
        <button type="button" class="btn small" onclick="restoreSamplePackCategory('${cat}')">↺ Khôi phục mẫu ${esc(catNames[cat] || '')}</button>
      </div>
    </div>`);

  return { totalCount: all.length, filteredCount: filtered.length, tableHtml };
}

function restoreSamplePackCategory(cat) {
  const samples = samplePackagingCatalog().filter(x => x.category === cat).map(x => ({
    ...x,
    qty: 0,
    updatedAt: nowStamp(),
    updatedAtMs: Date.now()
  }));
  if (!samples.length) return;
  if (!Array.isArray(db.packagingCatalog)) db.packagingCatalog = [];
  samples.forEach(s => {
    if (db.deletedIds) delete db.deletedIds[s.id];
    if (!db.packagingCatalog.some(ex => ex.id === s.id)) {
      db.packagingCatalog.push(s);
    }
  });
  persist();
  render();
  toast('✓ Đã thêm lại mẫu bảng giá đóng gói');
}

function stepPackQty(id, delta) {
  const item = (db.packagingCatalog || []).find(x => x.id === id);
  if (!item) return;
  item.qty = Math.max(0, parseNum(item.qty) + delta);
  item.updatedAt = nowStamp();
  item.updatedAtMs = Date.now();
  persist();
  render();
}

function settleExtraShip(id) {
  const item = (db.extraShipments || []).find(x => x.id === id);
  if (!item) return;
  const amt = Math.round(parseNum(item.amount));
  const prevPaid = getExtraCurrentPaid(item);
  const delta = Math.max(0, amt - prevPaid);
  item.status = 'Đã thu';
  item.paidAmount = amt;
  item.updatedAt = nowStamp();
  item.updatedAtMs = Date.now();
  if (delta > 0) {
    recordPaymentEvent({
      kind: 'extraship',
      extraShipId: item.id,
      orderId: item.orderId || '',
      orderCode: item.orderCode || '',
      customer: item.customer || '',
      amount: delta,
      date: dateKey(),
      originDate: item.date,
      note: `Thu đủ cước ship PS: ${item.content || ''}`
    });
  }
  addAuditLog('Thu cước ship phát sinh', `${item.customer || item.orderCode || 'Khách hàng'}`, `Thực thu +${money(delta)} ₫ (${item.content || ''})`);
  persist();
  render();
  toast(`✓ Đã thu đủ cước ship phát sinh: +${money(delta)} ₫`);
}

function deleteExtraShip(id) {
  const item = (db.extraShipments || []).find(x => x.id === id);
  if (!item) return;
  if (!confirm(`Xóa khoản Cước ship phát sinh "${item.content || ''}" (${money(item.amount)} ₫) của khách ${item.customer || ''}?`)) return;
  saveAutoSnapshot(`Trước khi xóa cước ship ${item.orderCode || ''}`, true);
  recordClosedPeriodAdjustment(item.date, 'Xóa cước ship PS kỳ đã chốt', item.customer || item.orderCode || 'Cước ship', `Đã xóa ${item.content || ''} (${money(item.amount)} ₫)`);
  markDeletedId(id);
  purgePaymentsForDeletedRecord('extraship', id);
  db.extraShipments = (db.extraShipments || []).filter(x => x.id !== id);
  addAuditLog('Xóa cước ship phát sinh', item.customer || item.orderCode || 'Cước ship', `Đã xóa ${item.content || ''} (${money(item.amount)} ₫)`);
  persist();
  render();
  toast('Đã xóa khoản cước ship phát sinh (đã tạo mốc dự phòng)');
}

function deletePackItem(id) {
  const item = (db.packagingCatalog || []).find(x => x.id === id);
  if (!item) return;
  if (!confirm(`Xóa sản phẩm đóng gói "${item.name}"? (Các đơn hàng cũ đã gắn sản phẩm này vẫn giữ nguyên dữ liệu lịch sử).`)) return;
  saveAutoSnapshot(`Trước khi xóa vật tư ${item.name}`, true);
  recordClosedPeriodAdjustment(item.date, 'Xóa vật tư đóng gói kỳ đã chốt', item.name, `Đã xóa khỏi danh mục đóng gói`);
  markDeletedId(id);
  db.packagingCatalog = (db.packagingCatalog || []).filter(x => x.id !== id);
  addAuditLog('Xóa vật tư đóng gói', item.name, `Đã xóa khỏi danh mục đóng gói`);
  persist();
  render();
  toast(`Đã xóa "${item.name}" (đã tạo mốc dự phòng)`);
}

function incidentalsPage() {
  const sum = calcIncidentalsSummary();
  const extraCount = (db.extraShipments || []).length;
  const woodCount = (db.packagingCatalog || []).filter(x => x.category === 'wood').length;
  const cartonCount = (db.packagingCatalog || []).filter(x => x.category === 'carton').length;
  const shockCount = (db.packagingCatalog || []).filter(x => x.category === 'shock').length;
  const hasFilter = Boolean(query || window.statusFilter);

  const topTabs = `<div class="toolbar-row">
    <div class="subtabs" role="tablist" aria-label="4 Tab Chi phí phát sinh & Đóng gói">
      <button type="button" class="subtab ${incTab === 'extraship' ? 'active' : ''}" onclick="incTab='extraship';query='';window.statusFilter='';render()">🚚 1. Cước ship phát sinh <span class="chip-count">${extraCount}</span></button>
      <button type="button" class="subtab ${incTab === 'wood' ? 'active' : ''}" onclick="incTab='wood';query='';window.statusFilter='';render()">🪵 2. Đóng hộp gỗ <span class="chip-count">${woodCount}</span></button>
      <button type="button" class="subtab ${incTab === 'carton' ? 'active' : ''}" onclick="incTab='carton';query='';window.statusFilter='';render()">📦 3. Đóng hộp carton <span class="chip-count">${cartonCount}</span></button>
      <button type="button" class="subtab ${incTab === 'shock' ? 'active' : ''}" onclick="incTab='shock';query='';window.statusFilter='';render()">🫧 4. Chống sốc <span class="chip-count">${shockCount}</span></button>
    </div>
    ${renderIncPeriodPicker()}
  </div>`;

  // Khu vực thống kê tổng hợp 9 chỉ số dành cho Admin
  const statsSection = `<div class="inc-stats-grid">
    <div class="inc-stat-group">
      <div class="inc-stat-group-head">
        <span>📊 Tổng hợp Vật tư & Đóng gói (${esc(getIncPeriodLabel())})</span>
      </div>
      <div class="inc-stat-rows">
        <div class="inc-stat-row"><span>Tổng vốn nhập vật tư:</span><b>${money(sum.totalPackCost)} ₫</b></div>
        <div class="inc-stat-row"><span>Tổng doanh thu đóng gói:</span><b class="blue-color">${money(sum.totalPackRevenue)} ₫</b></div>
        <div class="inc-stat-row"><span>Tổng lợi nhuận đóng gói:</span><b class="${sum.totalPackProfit >= 0 ? 'income-color' : 'expense-color'}">${sum.totalPackProfit >= 0 ? '+' : ''}${money(sum.totalPackProfit)} ₫</b></div>
      </div>
    </div>

    <div class="inc-stat-group">
      <div class="inc-stat-group-head">
        <span>🪵 Lợi nhuận từng Danh mục Đóng gói</span>
      </div>
      <div class="inc-stat-rows">
        <div class="inc-stat-row"><span>1. Lợi nhuận từ hộp gỗ:</span><b class="income-color">+${money(sum.woodProfit)} ₫</b></div>
        <div class="inc-stat-row"><span>2. Lợi nhuận từ carton:</span><b class="income-color">+${money(sum.cartonProfit)} ₫</b></div>
        <div class="inc-stat-row"><span>3. Lợi nhuận từ chống sốc:</span><b class="income-color">+${money(sum.shockProfit)} ₫</b></div>
      </div>
    </div>

    <div class="inc-stat-group">
      <div class="inc-stat-group-head">
        <span>🚚 Thống kê Cước ship phát sinh (Khách trả)</span>
      </div>
      <div class="inc-stat-rows">
        <div class="inc-stat-row"><span>Tổng cước ship phát sinh:</span><b>${money(sum.totalExtraShip)} ₫</b></div>
        <div class="inc-stat-row"><span>Cước ship đã thu:</span><b class="income-color">${money(sum.collectedExtraShip)} ₫</b></div>
        <div class="inc-stat-row"><span>Cước ship chưa thu:</span><b class="${sum.uncollectedExtraShip > 0 ? 'expense-color' : ''}">${money(sum.uncollectedExtraShip)} ₫</b></div>
      </div>
    </div>
  </div>`;

  if (incTab === 'extraship') {
    const data = getExtraShipViewData();
    return `<div class="section-stack">
      ${topTabs}
      ${statsSection}
      <section class="panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">🚚 Danh sách Cước ship phát sinh</div>
            <div class="panel-sub">Khoản phí vận chuyển phát sinh thêm mà khách hàng phải thanh toán (tự động cộng vào phải thu của đơn liên kết, không tính là lợi nhuận mặc định)</div>
          </div>
          <div class="row-actions">
            <span class="result-count" id="resultCount">${data.filteredCount} / ${data.totalCount} khoản</span>
            <button type="button" class="btn small primary" onclick="openNew('extraship')">＋ Thêm Cước ship phát sinh</button>
          </div>
        </div>
        <div class="filters">
          <div class="search">
            <span class="search-ico" aria-hidden="true">⌕</span>
            <input id="searchInput" class="field" placeholder="Tìm theo mã đơn hàng, tên khách hàng, nội dung phát sinh…" value="${esc(query)}" oninput="handleSearch(this)">
            <button type="button" id="searchClearBtn" class="search-clear ${query ? '' : 'hidden'}" onclick="clearSearchInput()" title="Xóa từ khóa">×</button>
          </div>
          <select class="select" aria-label="Lọc trạng thái thanh toán" onchange="setFilter(this.value)">
            <option value="">Mọi trạng thái</option>
            ${extraShipStatuses.map(s => `<option value="${esc(s)}" ${window.statusFilter === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}
          </select>
          <button type="button" id="resetFilterBtn" class="btn subtle small ${hasFilter ? '' : 'hidden'}" onclick="clearFilters()">Đặt lại lọc</button>
        </div>
        <div class="table-wrap" id="tableArea">${data.tableHtml}</div>
      </section>
    </div>`;
  }

  const catTitles = {
    wood: ['🪵 Danh mục 1: ĐÓNG HỘP GỖ', 'Quản lý giá nhập, giá bán, số lượng sử dụng và lợi nhuận đóng kiện gỗ'],
    carton: ['📦 Danh mục 2: ĐÓNG HỘP CARTON', 'Quản lý giá nhập, giá bán, số lượng thùng carton các kích cỡ và lợi nhuận'],
    shock: ['🫧 Danh mục 3: CHỐNG SỐC', 'Hỗ trợ tính giá vốn theo từng lần sử dụng (VD: 1 cuộn 105.000đ / 20 lần = 5.250đ/lần) và tự động tính lãi']
  };
  const data = getPackagingTabViewData(incTab);

  return `<div class="section-stack">
    ${topTabs}
    ${statsSection}
    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">${catTitles[incTab][0]}</div>
          <div class="panel-sub">${catTitles[incTab][1]}</div>
        </div>
        <div class="row-actions">
          <span class="result-count" id="resultCount">${data.filteredCount} / ${data.totalCount} sản phẩm</span>
          <button type="button" class="btn small primary" onclick="openNewPackItem('${incTab}')">＋ Thêm sản phẩm</button>
        </div>
      </div>
      <div class="filters">
        <div class="search">
          <span class="search-ico" aria-hidden="true">⌕</span>
          <input id="searchInput" class="field" placeholder="Tìm tên sản phẩm, quy cách, kích thước, đơn vị tính…" value="${esc(query)}" oninput="handleSearch(this)">
          <button type="button" id="searchClearBtn" class="search-clear ${query ? '' : 'hidden'}" onclick="clearSearchInput()" title="Xóa từ khóa">×</button>
        </div>
      </div>
      <div class="table-wrap" id="tableArea">${data.tableHtml}</div>
    </section>
  </div>`;
}

// ============================================================================
// TRANG 3: THU CHI, CÔNG NỢ, BÁO CÁO AI, KỲ CHỐT 26 & LỊCH SỬ
// ============================================================================
function renderPeriodPicker() {
  const periods = db.businessPeriods || [];
  const activeP = getSelectedBusinessPeriod();
  return `<div class="period-bar">
    <button type="button" class="chip ${periodMode === 'bizperiod' ? 'active' : ''}" onclick="periodMode='bizperiod';render()">Kỳ 26</button>
    <button type="button" class="chip ${periodMode === 'day' ? 'active' : ''}" onclick="periodMode='day';render()">Ngày</button>
    <button type="button" class="chip ${periodMode === 'month' ? 'active' : ''}" onclick="periodMode='month';render()">Tháng</button>
    <button type="button" class="chip ${periodMode === 'year' ? 'active' : ''}" onclick="periodMode='year';render()">Năm</button>
    <button type="button" class="chip ${periodMode === 'all' ? 'active' : ''}" onclick="periodMode='all';render()">Tất cả</button>
    ${periodMode === 'bizperiod' ? `<select class="select" style="padding:5px 9px;font-size:12.5px" aria-label="Chọn kỳ kinh doanh" onchange="selectBusinessPeriod(this.value)">
      ${(periods.length ? periods : [activeP]).map(p => `<option value="${esc(p.id)}" ${p.id === activeP.id ? 'selected' : ''}>${p.status === 'active' ? '● ' : '🔒 '}${esc(p.shortLabel || p.label)}</option>`).join('')}
    </select>` : ''}
    ${periodMode === 'day' ? `<input type="date" class="field" style="padding:5px 9px" value="${esc(periodDate)}" onchange="periodDate=this.value;render()">` : ''}
    ${periodMode === 'month' ? `<input type="month" class="field" style="padding:5px 9px" value="${esc(periodMonth)}" onchange="periodMonth=this.value;render()">` : ''}
    ${periodMode === 'year' ? `<input type="number" class="field" style="padding:5px 9px;width:92px" min="2020" max="2100" value="${esc(periodYear)}" onchange="periodYear=this.value;render()">` : ''}
  </div>`;
}

function getFinanceViewData() {
  const filterSpec = getActivePeriodFilter();
  const q = query.toLowerCase();
  const items = (db.transactions || [])
    .filter(x => matchesDateFilter(x.date, filterSpec) && (`${x.type} ${x.category} ${x.party} ${x.related} ${x.method} ${x.note}`.toLowerCase().includes(q)) && (!window.statusFilter || x.type === window.statusFilter))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const rows = items.map(x => `<tr>
    <td data-label="Ngày">${dateText(x.date)}</td>
    <td data-label="Loại"><span class="status ${x.type === 'Thu' ? 's-green' : 's-red'}">${esc(x.type)}</span></td>
    <td data-label="Danh mục">
      <b>${esc(x.category)}</b>
      <div class="subline">${esc(x.related || 'Không gắn mã đơn')}</div>
      ${x.note ? `<div class="note-box">${esc(x.note)}</div>` : ''}
      ${x.updatedAt ? `<span class="ts-stamp">🕒 ${esc(x.updatedAt)}</span>` : ''}
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
    totalCount: (db.transactions || []).length,
    filteredCount: items.length,
    tableHtml: renderTableInner('<th>Ngày</th><th>Loại</th><th>Danh mục & Ghi chú</th><th>Đối tượng / Hình thức</th><th>Số tiền</th><th>Thao tác</th>', rows, 'finance')
  };
}

function getHistoryViewData() {
  const q = query.toLowerCase();
  const logs = db.logs || [];
  const filtered = logs.filter(l => !q || `${l.time} ${l.action} ${l.target} ${l.detail}`.toLowerCase().includes(q));
  const rows = filtered.slice(0, 120).map(l => `<tr>
    <td data-label="Thời gian"><span class="ts-stamp" style="font-size:12px">🕒 ${esc(l.time)}</span></td>
    <td data-label="Thao tác"><span class="code">${esc(l.action)}</span></td>
    <td data-label="Mục tác động"><b>${esc(l.target)}</b></td>
    <td data-label="Chi tiết">${esc(l.detail)}</td>
  </tr>`).join('');

  const tableHtml = `<table>
    <thead><tr><th>Thời gian (Giờ - Ngày/Tháng/Năm)</th><th>Thao tác</th><th>Mục tác động</th><th>Chi tiết thay đổi</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>${rows ? '' : '<div class="empty"><p>Không tìm thấy lịch sử phù hợp.</p></div>'}`;

  return { totalCount: logs.length, filteredCount: filtered.length, tableHtml };
}

function getDailyBreakdown(filterSpec) {
  const map = new Map();
  const matchDate = d => matchesDateFilter(d, filterSpec);
  const ensure = d => {
    if (!map.has(d)) map.set(d, { date: d, orders: 0, collected: 0, shipFee: 0, serviceFee: 0, extra: 0, profit: 0 });
    return map.get(d);
  };

  (db.orderNotes || []).filter(o => o.status !== 'Đã hủy' && matchDate(o.date)).forEach(o => {
    const d = normalizeDateStr(o.date) || dateKey();
    const row = ensure(d);
    const m = calcOrderMetrics(o);
    row.orders++;
    row.collected += getOrderLegacyPaid(o);
    row.shipFee += m.shipCharge;
    row.serviceFee += m.serviceFee;
    row.extra += m.extraCost;
    row.profit += m.netProfit;
  });

  (db.extraShipments || []).filter(x => matchDate(x.date)).forEach(x => {
    const lp = getExtraLegacyPaid(x);
    if (lp > 0) ensure(normalizeDateStr(x.date) || dateKey()).collected += lp;
  });

  getValidPaymentRecords().filter(p => matchDate(p.date)).forEach(p => {
    const d = normalizeDateStr(p.date) || dateKey();
    const amt = Math.max(0, Math.round(parseNum(p.amount)));
    if (amt > 0) ensure(d).collected += amt;
  });

  const nonProfitCats = ['Thu hộ', 'Thu công nợ', 'Thu công nợ kỳ trước'];
  (db.transactions || []).filter(x => matchDate(x.date)).forEach(x => {
    const d = normalizeDateStr(x.date) || dateKey();
    const row = ensure(d);
    const amt = parseNum(x.amount);
    if (x.type === 'Thu') {
      row.collected += amt;
      if (['Phí dịch vụ', 'Phí mua hộ'].includes(x.category)) row.serviceFee += amt;
      if (!nonProfitCats.includes(x.category)) row.profit += amt;
    } else {
      row.extra += amt;
      row.profit -= amt;
    }
  });

  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function buildAiInsights(s, filterSpec = null) {
  const insights = [];
  const label = getPeriodLabel(filterSpec);
  insights.push(`Kỳ <b>${esc(label)}</b>: Lợi nhuận thực tế đạt <b class="${s.netProfit >= 0 ? 'income-color' : 'expense-color'}">${s.netProfit >= 0 ? '+' : ''}${money(s.netProfit)} ₫</b> (tổng hợp từ <b>${s.orderCount}</b> Note đơn, <b>${s.shipmentCount || 0}</b> VĐ ký gửi và <b>${s.txCount}</b> giao dịch thu chi trong kỳ).`);

  if (s.debtRecoveryIn > 0) {
    insights.push(`Dòng tiền kỳ này có <b class="income-color">+${money(s.debtRecoveryIn)} ₫</b> tiền khách thanh toán <b>công nợ kỳ trước</b> (được ghi nhận vào dòng tiền thu kỳ này, KHÔNG cộng trùng vào lợi nhuận).`);
  }

  const sources = [
    { name: 'Lãi phí vận chuyển', val: s.shipProfitTotal },
    { name: 'Doanh thu phí dịch vụ', val: s.totalServiceRevenue },
    { name: 'Lãi dịch vụ đóng gói', val: s.packProfitTotal || 0 },
    { name: 'Chênh lệch tỷ giá tệ', val: s.fxProfitTotal }
  ].sort((a, b) => b.val - a.val);

  if (sources[0].val > 0) {
    insights.push(`Nguồn đóng góp lãi cao nhất trong kỳ là <b>${sources[0].name} (+${money(sources[0].val)} ₫)</b>.`);
  }

  const lossOrders = (db.orderNotes || []).filter(o => o.status !== 'Đã hủy' && matchesDateFilter(o.date, filterSpec) && calcOrderMetrics(o).netProfit < 0);
  if (lossOrders.length > 0) {
    insights.push(`<span class="expense-color"><b>Cảnh báo kiểm tra:</b> Có <b>${lossOrders.length} đơn</b> trong kỳ đang bị âm lợi nhuận (${lossOrders.map(x => esc(x.customer)).join(', ')}) — hãy kiểm tra lại cước thu khách hoặc phụ phí phát sinh.</span>`);
  }

  if (s.allCustomerDebt > 0 || s.allWarehouseUnpaid > 0) {
    insights.push(`Phân tách công nợ: <b>Phát sinh mới kỳ này: ${money(s.periodNewCustomerDebt || 0)} ₫</b> · <b>Tổng công nợ thực tế còn phải thu (xuyên kỳ): ${money(s.allCustomerDebt)} ₫</b> · Cước kho chưa trả: <b>${money(s.allWarehouseUnpaid)} ₫</b>.`);
  } else {
    insights.push(`Tuyệt vời: Tất cả công nợ khách hàng và tiền cước kho đều đã được tất toán sạch sẽ.`);
  }
  return insights;
}

function refreshClosedPeriodSnapshotControlled(periodId) {
  const p = (db.businessPeriods || []).find(x => x.id === periodId && x.status === 'closed');
  if (!p) return;
  if (!confirm(`Cập nhật lại số liệu báo cáo đã chốt của ${p.label} theo các điều chỉnh sau chốt đã ghi nhận?\n\nHệ thống sẽ tự chụp 1 bản dự phòng và lưu lịch sử đối chiếu.`)) {
    return;
  }
  saveAutoSnapshot(`Trước khi cập nhật đối chiếu ${p.label}`, true);
  const oldProfit = p.snapshot?.netProfit || 0;
  const oldDebt = p.snapshot?.endingCustomerDebt || 0;
  const nextSnap = computeBusinessPeriodSnapshot(p);
  p.snapshot = nextSnap;
  if (!Array.isArray(p.adjustments)) p.adjustments = [];
  p.adjustments.unshift({
    id: 'adj_' + makeId(),
    time: nowStamp(true),
    action: 'Cập nhật lại báo cáo kỳ đã chốt',
    target: p.label,
    detail: `Lãi: ${money(oldProfit)} → ${money(nextSnap.netProfit)} ₫ · Nợ cuối kỳ: ${money(oldDebt)} → ${money(nextSnap.endingCustomerDebt)} ₫`
  });
  p.updatedAtMs = Date.now();
  addAuditLog('Đối chiếu lại kỳ đã chốt', p.label, `Admin xác nhận cập nhật báo cáo có kiểm soát (Lãi ${money(nextSnap.netProfit)} ₫)`);
  persist({ skipSnapshot: true });
  render();
  toast(`✓ Đã cập nhật báo cáo ${p.label} có ghi log kiểm soát`);
}

function renderBusinessPeriodsTab(topToolbar) {
  const periods = (db.businessPeriods || []).length ? db.businessPeriods : [getSelectedBusinessPeriod()];
  const curP = getCurrentBusinessPeriod();
  const detailObj = periods.find(p => p.id === periodDetailId) || periods.find(p => p.id === selectedBusinessPeriodId) || periods[0];
  const isDetailClosed = detailObj && detailObj.status === 'closed' && detailObj.snapshot;
  const detailStats = isDetailClosed
    ? detailObj.snapshot
    : calcPeriodFinancials({ startDate: detailObj.startDate, endDate: detailObj.endDate, periodId: detailObj.id, asOfDate: '' });

  // Đối chiếu live hiện tại cho các khoản công nợ cuối kỳ (để thấy rõ khoản nào khách đã trả ở kỳ sau)
  const endingItems = isDetailClosed
    ? (detailObj.snapshot.endingDebtItems || [])
    : computeBusinessPeriodSnapshot(detailObj).endingDebtItems;

  const debtReconcileRows = endingItems.map(item => {
    const postPayments = (db.paymentRecords || []).filter(pr => {
      const sameTarget = (item.orderId && pr.kind === 'order' && pr.orderId === item.orderId) ||
        (item.extraShipId && pr.kind === 'extraship' && pr.extraShipId === item.extraShipId);
      return sameTarget && (normalizeDateStr(pr.date) || '') > detailObj.endDate;
    });
    const paidAfterClose = postPayments.reduce((a, pr) => a + Math.round(parseNum(pr.amount)), 0);
    let currentRemaining = 0;
    if (item.orderId) {
      const ord = (db.orderNotes || []).find(o => o.id === item.orderId);
      currentRemaining = ord ? calcOrderMetrics(ord).customerDebt : 0;
    } else if (item.extraShipId) {
      const ex = (db.extraShipments || []).find(x => x.id === item.extraShipId);
      currentRemaining = ex ? Math.max(0, Math.round(parseNum(ex.amount)) - getExtraCurrentPaid(ex)) : 0;
    }
    return { ...item, paidAfterClose, currentRemaining, postPayments };
  });

  const totalEndingDebt = isDetailClosed ? detailStats.endingCustomerDebt : detailStats.allCustomerDebt;
  const totalPaidAfter = debtReconcileRows.reduce((a, r) => a + r.paidAfterClose, 0);
  const totalStillOwed = debtReconcileRows.reduce((a, r) => a + r.currentRemaining, 0);

  const periodPayments = (db.paymentRecords || []).filter(p => matchesDateFilter(p.date, { startDate: detailObj.startDate, endDate: detailObj.endDate }));
  const adjustments = Array.isArray(detailObj.adjustments) ? detailObj.adjustments : [];

  return `<div class="section-stack">
    ${topToolbar}
    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">📅 Danh sách các Kỳ kinh doanh (Tự chốt 00:00 ngày 26 · ${APP_TIMEZONE})</div>
          <div class="panel-sub">Chu kỳ cố định ngày 26 tháng này → ngày 25 tháng sau · Bộ đếm tự về 0 ngày 26 · Toàn bộ dữ liệu gốc & công nợ được bảo toàn</div>
        </div>
        <span class="result-count">${periods.length} kỳ lưu trữ</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Kỳ kinh doanh</th>
              <th>Trạng thái & Thời điểm chốt</th>
              <th>Lưu lượng đơn</th>
              <th>Tổng thu / Tổng chi</th>
              <th>Lợi nhuận thực tế</th>
              <th>Công nợ cuối kỳ</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            ${periods.map(p => {
              const isCl = p.status === 'closed' && p.snapshot;
              const st = isCl ? p.snapshot : calcPeriodFinancials({ startDate: p.startDate, endDate: p.endDate, periodId: p.id, asOfDate: '' });
              const endDebt = isCl ? st.endingCustomerDebt : st.allCustomerDebt;
              const adjN = Array.isArray(p.adjustments) ? p.adjustments.length : 0;
              const isSel = detailObj && p.id === detailObj.id;
              return `<tr class="${isSel ? 'row-selected-period' : ''}">
                <td data-label="Kỳ kinh doanh">
                  <b>${esc(p.label)}</b>
                  <div class="subline">Từ ${dateText(p.startDate)} đến ${dateText(p.endDate)}</div>
                  ${adjN > 0 ? `<span class="biz-adj-pill" style="margin-top:4px">⚠ ${adjN} điều chỉnh sau chốt</span>` : ''}
                </td>
                <td data-label="Trạng thái">
                  <span class="status ${isCl ? 's-slate' : 's-green'}">${isCl ? '🔒 Đã chốt' : '● Đang hoạt động'}</span>
                  <div class="subline">${isCl ? esc(p.closedAt) : `Chốt 00:00 ngày ${dateText(getNextBusinessPeriod(curP).startDate)}`}</div>
                </td>
                <td data-label="Lưu lượng đơn">
                  <b>${st.totalTrafficOrders || 0} đơn</b>
                  <div class="subline">${st.orderCount || 0} Note · ${st.shipmentCount || 0} VĐ · ${st.purchaseCount || 0} MH</div>
                </td>
                <td data-label="Thu / Chi">
                  <div class="income-color">Thu: <b>+${money(st.totalCollectedFromCustomer || 0)} ₫</b></div>
                  <div class="expense-color subline">Chi: −${money(st.totalTransferredOut || 0)} ₫${st.debtRecoveryIn > 0 ? ` · Thu nợ cũ: +${shortMoney(st.debtRecoveryIn)}` : ''}</div>
                </td>
                <td data-label="Lợi nhuận" class="${(st.netProfit || 0) >= 0 ? 'income-color' : 'expense-color'}">
                  <b>${(st.netProfit || 0) >= 0 ? '+' : ''}${money(st.netProfit || 0)} ₫</b>
                </td>
                <td data-label="Công nợ cuối kỳ">
                  <b class="${endDebt > 0 ? 'expense-color' : 'income-color'}">${money(endDebt)} ₫</b>
                  <div class="subline">Phát sinh kỳ này: ${money(st.periodNewCustomerDebt || 0)} ₫</div>
                </td>
                <td data-label="Thao tác">
                  <div class="row-actions">
                    <button type="button" class="iconbtn ${isSel ? 'primary-tint' : ''}" onclick="periodDetailId='${esc(p.id)}';render()">Đối chiếu</button>
                    <button type="button" class="iconbtn" onclick="openBusinessPeriodOnDashboard('${esc(p.id)}')">Mở Dashboard</button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">🔍 Báo cáo đối chiếu chi tiết: ${esc(detailObj.label)} ${isDetailClosed ? '(Bản lưu đã chốt)' : '(Đang hoạt động)'}</div>
          <div class="panel-sub">${isDetailClosed ? `Thời điểm chốt: ${esc(detailObj.closedAt)} · Báo cáo chốt được bảo toàn độc lập với các thanh toán phát sinh ở kỳ sau.` : 'Số liệu thời gian thực của kỳ kinh doanh hiện tại.'}</div>
        </div>
        <div class="row-actions">
          <button type="button" class="btn small" onclick="openBusinessPeriodOnDashboard('${esc(detailObj.id)}')">📊 Xem Dashboard kỳ này</button>
          ${isDetailClosed && adjustments.length > 0 && currentUserRole === 'admin' ? `<button type="button" class="btn small primary" onclick="refreshClosedPeriodSnapshotControlled('${esc(detailObj.id)}')">↻ Cập nhật báo cáo sau điều chỉnh</button>` : ''}
        </div>
      </div>

      <div class="cashflow-grid" style="padding:14px 16px 6px">
        <div class="cash-card">
          <span class="cash-label">Lưu lượng đơn trong kỳ</span>
          <strong class="cash-val">${detailStats.totalTrafficOrders || 0} đơn</strong>
          <span class="cash-sub">${detailStats.orderCount || 0} Note đơn · ${detailStats.shipmentCount || 0} Ký gửi · ${detailStats.purchaseCount || 0} Mua hộ</span>
        </div>
        <div class="cash-card">
          <span class="cash-label">Tổng dòng tiền thu trong kỳ</span>
          <strong class="cash-val income-color">+${money(detailStats.totalCollectedFromCustomer || 0)} ₫</strong>
          <span class="cash-sub">Thu nợ kỳ trước: +${money(detailStats.debtRecoveryIn || 0)} ₫ · Tổng chi/chuyển: −${money(detailStats.totalTransferredOut || 0)} ₫</span>
        </div>
        <div class="cash-card">
          <span class="cash-label">Lợi nhuận thực tế của kỳ</span>
          <strong class="cash-val ${(detailStats.netProfit || 0) >= 0 ? 'income-color' : 'expense-color'}">${(detailStats.netProfit || 0) >= 0 ? '+' : ''}${money(detailStats.netProfit || 0)} ₫</strong>
          <span class="cash-sub">Cước +${shortMoney(detailStats.shipProfitTotal || 0)} · DV +${shortMoney(detailStats.totalServiceRevenue || 0)} · ĐG +${shortMoney(detailStats.packProfitTotal || 0)} · Tệ +${shortMoney(detailStats.fxProfitTotal || 0)}</span>
        </div>
        <div class="cash-card">
          <span class="cash-label">${isDetailClosed ? `Công nợ chốt cuối kỳ (${dateText(detailObj.endDate)})` : 'Tổng công nợ còn phải thu'}</span>
          <strong class="cash-val ${totalEndingDebt > 0 ? 'expense-color' : 'income-color'}">${money(totalEndingDebt)} ₫</strong>
          <span class="cash-sub">Phát sinh kỳ này: ${money(detailStats.periodNewCustomerDebt || 0)} ₫${isDetailClosed ? ` · Đã thu sau chốt: +${money(totalPaidAfter)} ₫ · Còn nợ: ${money(totalStillOwed)} ₫` : ''}</span>
        </div>
      </div>

      <div style="padding:10px 16px 16px">
        <h4 style="margin:8px 0;font-size:13.5px">📋 Đối chiếu Công nợ cuối kỳ (${debtReconcileRows.length} khoản)</h4>
        ${debtReconcileRows.length ? `<div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Khách hàng & Đơn hàng</th>
                <th>Ngày đơn</th>
                <th>Nợ tại thời điểm cuối kỳ</th>
                <th>Đã thanh toán sau chốt kỳ</th>
                <th>Còn nợ thực tế hiện tại</th>
              </tr>
            </thead>
            <tbody>
              ${debtReconcileRows.map(r => `<tr>
                <td data-label="Khách hàng"><b>${esc(r.customer)}</b> ${r.orderCode ? `<span class="code">${esc(r.orderCode)}</span>` : ''}<div class="subline">${esc(r.product || '')}</div></td>
                <td data-label="Ngày đơn">${dateText(r.orderDate)}</td>
                <td data-label="Nợ cuối kỳ" class="expense-color"><b>${money(r.debtAtClose)} ₫</b></td>
                <td data-label="Đã thu sau kỳ" class="income-color">${r.paidAfterClose > 0 ? `<b>+${money(r.paidAfterClose)} ₫</b><div class="subline">${r.postPayments.map(pr => `${dateText(pr.date)}: +${money(pr.amount)} ₫`).join(' · ')}</div>` : '—'}</td>
                <td data-label="Còn nợ hiện tại"><b class="${r.currentRemaining > 0 ? 'expense-color' : 'income-color'}">${r.currentRemaining > 0 ? `${money(r.currentRemaining)} ₫` : '✓ Đã thanh toán hết'}</b></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : '<div class="empty" style="padding:14px"><p>✓ Không có khoản công nợ nào tồn đọng cuối kỳ này.</p></div>'}

        ${periodPayments.length ? `<h4 style="margin:16px 0 8px;font-size:13.5px">💵 Lịch sử khách thanh toán ghi nhận vào dòng tiền kỳ này (${periodPayments.length} lần)</h4>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Ngày thực thu</th><th>Khách hàng</th><th>Liên kết đơn gốc</th><th>Phân loại</th><th>Số tiền thực thu</th></tr></thead>
            <tbody>
              ${periodPayments.map(pr => `<tr>
                <td data-label="Ngày thu"><b>${dateText(pr.date)}</b></td>
                <td data-label="Khách hàng">${esc(pr.customer)} ${pr.orderCode ? `<span class="code">${esc(pr.orderCode)}</span>` : ''}</td>
                <td data-label="Đơn gốc">Ngày đơn ${dateText(pr.originDate)} · ${esc(pr.note)}</td>
                <td data-label="Phân loại"><span class="status ${pr.isDebtRecovery ? 's-amber' : 's-green'}">${pr.isDebtRecovery ? 'Thu công nợ kỳ trước' : 'Thu trong kỳ'}</span></td>
                <td data-label="Số tiền" class="income-color"><b>+${money(pr.amount)} ₫</b></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}

        ${adjustments.length ? `<h4 style="margin:16px 0 8px;font-size:13.5px;color:#b45309">⚠ Lịch sử điều chỉnh sau khi chốt kỳ (${adjustments.length})</h4>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Thời điểm</th><th>Thao tác</th><th>Mục tác động</th><th>Chi tiết</th></tr></thead>
            <tbody>
              ${adjustments.map(a => `<tr>
                <td data-label="Thời điểm"><span class="ts-stamp">${esc(a.time)}</span></td>
                <td data-label="Thao tác"><span class="code">${esc(a.action)}</span></td>
                <td data-label="Mục tác động"><b>${esc(a.target)}</b></td>
                <td data-label="Chi tiết">${esc(a.detail)}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}
      </div>
    </section>
  </div>`;
}

function financePage() {
  const filterSpec = getActivePeriodFilter();
  const selectedPeriodObj = periodMode === 'bizperiod' ? getSelectedBusinessPeriod() : null;
  const s = (selectedPeriodObj && selectedPeriodObj.status === 'closed' && selectedPeriodObj.snapshot)
    ? selectedPeriodObj.snapshot
    : calcPeriodFinancials(filterSpec);
  const liveAllStats = calcPeriodFinancials('');
  const curBizP = getCurrentBusinessPeriod();
  const curBizStats = calcPeriodFinancials({ startDate: curBizP.startDate, endDate: curBizP.endDate, periodId: curBizP.id, asOfDate: '' });

  const debtOrdersCount = (db.orderNotes || []).filter(o => {
    if (o.status === 'Đã hủy') return false;
    const m = calcOrderMetrics(o);
    return m.customerDebt > 0 || m.warehouseDebt > 0 || m.partnerDebt > 0;
  }).length;
  const closedCount = (db.businessPeriods || []).filter(p => p.status === 'closed').length;

  const topToolbar = `<div class="toolbar-row">
    <div class="subtabs" role="tablist" aria-label="Chế độ xem tài chính">
      <button type="button" class="subtab ${financeTab === 'cashflow' ? 'active' : ''}" onclick="financeTab='cashflow';query='';window.statusFilter='';render()">💰 Thu chi & Dòng tiền</button>
      <button type="button" class="subtab ${financeTab === 'periods' ? 'active' : ''}" onclick="financeTab='periods';render()">📅 Kỳ chốt 26 ${closedCount ? `<span class="subtab-badge">${closedCount}</span>` : ''}</button>
      <button type="button" class="subtab" onclick="setView('incidentals',document.querySelector('[data-view=incidentals]'))">🪵 Chi phí phát sinh (4 Tab)</button>
      <button type="button" class="subtab ${financeTab === 'debts' ? 'active' : ''}" onclick="financeTab='debts';render()">🤝 Công nợ Khách & Kho ${debtOrdersCount ? `<span class="subtab-badge">${debtOrdersCount}</span>` : ''}</button>
      <button type="button" class="subtab ${financeTab === 'report' ? 'active' : ''}" onclick="financeTab='report';render()">📊 Báo cáo AI</button>
      <button type="button" class="subtab ${financeTab === 'history' ? 'active' : ''}" onclick="financeTab='history';query='';render()">🕒 Lịch sử (${(db.logs || []).length})</button>
    </div>
    ${financeTab !== 'debts' && financeTab !== 'history' && financeTab !== 'periods' ? renderPeriodPicker() : ''}
  </div>`;

  if (financeTab === 'periods') {
    return renderBusinessPeriodsTab(topToolbar);
  }

  if (financeTab === 'cashflow') {
    const data = getFinanceViewData();
    const hasFilter = Boolean(query || window.statusFilter);
    const periodPayments = (db.paymentRecords || []).filter(p => matchesDateFilter(p.date, filterSpec));
    return `<div class="section-stack">
      ${topToolbar}
      <div class="cashflow-grid">
        <div class="cash-card">
          <span class="cash-label">1. Tổng tiền thu trong kỳ (${esc(getPeriodLabel(filterSpec))})</span>
          <strong class="cash-val income-color">+${money(s.totalCollectedFromCustomer)} ₫</strong>
          <span class="cash-sub">${s.debtRecoveryIn > 0 ? `Gồm thu công nợ kỳ trước: +${money(s.debtRecoveryIn)} ₫ · ` : ''}Phát sinh phải thu kỳ này: ${money(s.totalBilledCustomer)} ₫</span>
        </div>
        <div class="cash-card">
          <span class="cash-label">2. Tổng tiền chi & chuyển ra (${esc(getPeriodLabel(filterSpec))})</span>
          <strong class="cash-val expense-color">−${money(s.totalTransferredOut)} ₫</strong>
          <span class="cash-sub">Sổ chi phát sinh: −${money(s.txOut || 0)} ₫ · Tổng cam kết vốn + kho: ${money(s.orderCommittedOut)} ₫</span>
        </div>
        <div class="cash-card">
          <span class="cash-label">3. Công nợ phát sinh mới kỳ này / Tổng nợ thực tế</span>
          <strong class="cash-val ${liveAllStats.allCustomerDebt > 0 ? 'expense-color' : 'income-color'}">${money(s.periodNewCustomerDebt || 0)} ₫ / ${money(liveAllStats.allCustomerDebt)} ₫</strong>
          <span class="cash-sub">Cước kho chưa trả hiện tại: ${money(liveAllStats.allWarehouseUnpaid)} ₫</span>
        </div>
        <div class="cash-card">
          <span class="cash-label">4. Doanh thu phí dịch vụ & Lãi đóng gói</span>
          <strong class="cash-val blue-color">+${money(s.totalServiceRevenue + (s.packProfitTotal || 0))} ₫</strong>
          <span class="cash-sub">Phí DV: +${money(s.totalServiceRevenue)} ₫ · Lãi ĐG: +${money(s.packProfitTotal || 0)} ₫ · Lãi cước: +${money(s.shipProfitTotal)} ₫</span>
        </div>
        <div class="cash-card" style="cursor:pointer" onclick="setView('incidentals',document.querySelector('[data-view=incidentals]'))" title="Bấm để mở 4 tab Quản lý Chi phí phát sinh & Đóng gói">
          <span class="cash-label">5. Chi phí phát sinh (Bấm quản lý 4 tab →)</span>
          <strong class="cash-val expense-color">−${money(s.totalIncidentalExpense)} ₫</strong>
          <span class="cash-sub" style="color:var(--core-blue);font-weight:600">Mở Cước ship phát sinh · Hộp gỗ · Carton · Chống sốc →</span>
        </div>
        <div class="cash-card profit-highlight">
          <span class="cash-label">6. LỢI NHUẬN THỰC TẾ (${esc(getPeriodLabel(filterSpec))})</span>
          <strong class="cash-val ${s.netProfit >= 0 ? 'income-color' : 'expense-color'}">${s.netProfit >= 0 ? '+' : ''}${money(s.netProfit)} ₫</strong>
          <span class="cash-sub">= Lãi cước + Phí DV + Lãi ĐG + Lãi tệ${s.txOtherIn > 0 ? ' + Thu khác' : ''} − Chi phí phát sinh</span>
        </div>
      </div>

      ${renderCashflowBarChart(filterSpec)}

      ${periodPayments.length ? `<section class="panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">💵 Khoản thực thu từ khách & Thu hồi công nợ (${esc(getPeriodLabel(filterSpec))})</div>
            <div class="panel-sub">Tiền khách thanh toán công nợ cũ được ghi nhận vào dòng tiền kỳ thu, liên kết chặt với đơn gốc (không cộng trùng lợi nhuận)</div>
          </div>
          <span class="result-count">${periodPayments.length} lần thu</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Ngày thực thu</th><th>Khách hàng</th><th>Đơn hàng gốc</th><th>Loại thu</th><th>Số tiền</th></tr></thead>
            <tbody>
              ${periodPayments.map(pr => `<tr>
                <td data-label="Ngày thu"><b>${dateText(pr.date)}</b></td>
                <td data-label="Khách hàng">${esc(pr.customer)} ${pr.orderCode ? `<span class="code">${esc(pr.orderCode)}</span>` : ''}</td>
                <td data-label="Đơn gốc">Phát sinh ngày ${dateText(pr.originDate)} · ${esc(pr.note)}</td>
                <td data-label="Loại"><span class="status ${pr.isDebtRecovery ? 's-amber' : 's-green'}">${pr.isDebtRecovery ? 'Thu công nợ kỳ trước' : 'Thu trong kỳ'}</span></td>
                <td data-label="Số tiền" class="income-color"><b>+${money(pr.amount)} ₫</b></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </section>` : ''}

      <section class="panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">Sổ thu chi lẻ ngoài Note đơn</div>
            <div class="panel-sub">Ghi nhanh các khoản chi chung (băng keo, đi lại, ăn uống...) hoặc thu lẻ ngoài đơn</div>
          </div>
          <span class="result-count" id="resultCount">${data.filteredCount} / ${data.totalCount} giao dịch</span>
        </div>
        <div class="filters">
          <div class="search">
            <span class="search-ico" aria-hidden="true">⌕</span>
            <input id="searchInput" class="field" placeholder="Tìm danh mục, đối tượng, ghi chú…" value="${esc(query)}" oninput="handleSearch(this)">
            <button type="button" id="searchClearBtn" class="search-clear ${query ? '' : 'hidden'}" onclick="clearSearchInput()" title="Xóa từ khóa">×</button>
          </div>
          <select class="select" aria-label="Lọc loại thu chi" onchange="setFilter(this.value)">
            <option value="">Thu và chi</option>
            <option value="Thu" ${window.statusFilter === 'Thu' ? 'selected' : ''}>Khoản thu</option>
            <option value="Chi" ${window.statusFilter === 'Chi' ? 'selected' : ''}>Khoản chi / Phát sinh</option>
          </select>
          <button type="button" id="resetFilterBtn" class="btn subtle small ${hasFilter ? '' : 'hidden'}" onclick="clearFilters()">Đặt lại lọc</button>
        </div>
        <div class="table-wrap" id="tableArea">${data.tableHtml}</div>
      </section>
    </div>`;
  }

  if (financeTab === 'debts') {
    const custDebtList = [];
    (db.orderNotes || []).filter(o => o.status !== 'Đã hủy').forEach(o => {
      const m = calcOrderMetrics(o);
      if (m.customerDebt > 0) {
        let cur = custDebtList.find(c => sameCustomer(o, c));
        if (!cur) {
          cur = { customer: o.customer, phone: o.phone, code: o.code, debt: 0, orders: [] };
          custDebtList.push(cur);
        }
        const origP = getBusinessPeriodForDate(o.date);
        const isOldPeriod = origP.id !== curBizP.id;
        cur.debt += m.customerDebt;
        cur.orders.push({ id: o.id, label: o.product || o.goodsType, amount: m.customerDebt, date: o.date, isOldPeriod, periodShort: origP.shortLabel });
      }
    });

    const partnerDebts = (db.orderNotes || []).filter(o => {
      if (o.status === 'Đã hủy') return false;
      const m = calcOrderMetrics(o);
      return m.warehouseDebt > 0 || m.partnerDebt > 0;
    });

    const oldPeriodDebtOnly = Math.max(0, liveAllStats.allCustomerDebt - curBizStats.periodNewCustomerDebt);

    return `<div class="section-stack">
      ${topToolbar}
      <div class="cashflow-grid">
        <div class="cash-card">
          <span class="cash-label">1. Công nợ phát sinh mới trong kỳ (${esc(curBizP.shortLabel)})</span>
          <strong class="cash-val ${curBizStats.periodNewCustomerDebt > 0 ? 'amber-color' : 'income-color'}">${money(curBizStats.periodNewCustomerDebt)} ₫</strong>
          <span class="cash-sub">Chỉ tính các khoản nợ mới phát sinh từ ngày ${dateText(curBizP.startDate)} (tự bắt đầu từ 0 mỗi ngày 26)</span>
        </div>
        <div class="cash-card profit-highlight">
          <span class="cash-label">2. TỔNG CÔNG NỢ THỰC TẾ CÒN PHẢI THU (Xuyên kỳ)</span>
          <strong class="cash-val ${liveAllStats.allCustomerDebt > 0 ? 'expense-color' : 'income-color'}">${money(liveAllStats.allCustomerDebt)} ₫</strong>
          <span class="cash-sub">Bao gồm nợ kỳ trước chuyển sang: <b>${money(oldPeriodDebtOnly)} ₫</b> + phát sinh kỳ này: <b>${money(curBizStats.periodNewCustomerDebt)} ₫</b></span>
        </div>
        <div class="cash-card">
          <span class="cash-label">3. Tiền khách đã trả nợ cũ trong kỳ này</span>
          <strong class="cash-val income-color">+${money(curBizStats.debtRecoveryIn)} ₫</strong>
          <span class="cash-sub">Được hạch toán vào dòng tiền thu của ${esc(curBizP.shortLabel)} · Giữ nguyên báo cáo kỳ cũ</span>
        </div>
      </div>

      <div class="debt-grid">
        <section class="panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">📥 Công nợ Khách hàng (Bảo toàn xuyên kỳ)</div>
              <div class="panel-sub">Tổng tiền khách còn nợ thực tế: <b class="expense-color">${money(liveAllStats.allCustomerDebt)} ₫</b></div>
            </div>
          </div>
          ${custDebtList.length ? custDebtList.map(c => `<div class="todo-row">
            <div class="todo-left">
              <div class="mini-avatar">${avatar(c.customer)}</div>
              <div class="todo-info">
                <div class="todo-title">${esc(c.customer)} ${c.phone ? `<span class="code">${esc(c.phone)}</span>` : ''}</div>
                <div class="todo-meta">${c.orders.map(x => `${esc(x.label)} (${money(x.amount)} ₫ · ${x.isOldPeriod ? `<b class="amber-color">Nợ kỳ trước ${dateText(x.date)}</b>` : `Kỳ này ${dateText(x.date)}`})`).join(' · ')}</div>
              </div>
            </div>
            <div class="todo-right">
              <b class="expense-color">${money(c.debt)} ₫</b>
              ${c.orders.length === 1
                ? `<button type="button" class="iconbtn primary-tint" onclick="settleOrderDebt('${c.orders[0].id}','customer')">Thu đủ</button>
                   <button type="button" class="iconbtn" onclick="editRecord('order','${c.orders[0].id}')">Sửa</button>`
                : `<button type="button" class="iconbtn" onclick="jumpToCustomerDebt('${jsArg(c.customer)}')">Xem ${c.orders.length} đơn</button>`}
            </div>
          </div>`).join('') : '<div class="empty"><p>✓ Tuyệt vời! Không có khách hàng nào còn nợ.</p></div>'}
        </section>

        <section class="panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">📤 Quản lý Đã Trả Cước Kho (Phải trả)</div>
              <div class="panel-sub">Tổng cước kho chưa thanh toán: <b class="amber-color">${money(liveAllStats.allWarehouseUnpaid)} ₫</b></div>
            </div>
          </div>
          ${partnerDebts.length ? partnerDebts.map(o => {
            const m = calcOrderMetrics(o);
            return `<div class="todo-row">
              <div class="todo-info">
                <div class="todo-title">${esc(o.product || o.goodsType)} <span class="code">Khách: ${esc(o.customer)}</span></div>
                <div class="todo-meta">
                  ${m.warehouseDebt > 0 ? `Cước kho chưa trả: <b class="amber-color">${money(m.warehouseDebt)} ₫</b> · Ngày đơn ${dateText(o.date)}` : ''}
                </div>
              </div>
              <div class="todo-right">
                ${m.warehouseDebt > 0 ? `<button type="button" class="iconbtn primary-tint" onclick="settleOrderDebt('${o.id}','warehouse')">Đã trả cước kho</button>` : ''}
                <button type="button" class="iconbtn" onclick="editRecord('order','${o.id}')">Sửa</button>
              </div>
            </div>`;
          }).join('') : '<div class="empty"><p>✓ Đã thanh toán hết tiền cước kho.</p></div>'}
        </section>
      </div>
    </div>`;
  }

  if (financeTab === 'report') {
    const dailyRows = getDailyBreakdown(filterSpec);
    const insights = buildAiInsights(s, filterSpec);
    const label = getPeriodLabel(filterSpec);

    const sumOrders = dailyRows.reduce((a, r) => a + r.orders, 0);
    const sumCollected = dailyRows.reduce((a, r) => a + r.collected, 0);
    const sumShip = dailyRows.reduce((a, r) => a + r.shipFee, 0);
    const sumFee = dailyRows.reduce((a, r) => a + r.serviceFee, 0);
    const sumExtra = dailyRows.reduce((a, r) => a + r.extra, 0);
    const sumProfit = dailyRows.reduce((a, r) => a + r.profit, 0);

    return `<div class="section-stack">
      ${topToolbar}
      <div class="ai-banner">
        <div class="ai-banner-title">🤖 AI Tự Động Tính Toán & Phân Tích Dòng Tiền (${esc(label)})</div>
        <ul class="ai-banner-list">
          ${insights.map(line => `<li>${line}</li>`).join('')}
        </ul>
      </div>

      <div class="cashflow-grid">
        <div class="cash-card">
          <span class="cash-label">Tổng phí vận chuyển thu khách (${esc(label)})</span>
          <strong class="cash-val blue-color">${money(s.shipChargeTotal)} ₫</strong>
          <span class="cash-sub">Cước gốc kho: ${money(s.shipCostTotal)} ₫ · Lãi cước: +${money(s.shipProfitTotal)} ₫</span>
        </div>
        <div class="cash-card">
          <span class="cash-label">Tổng phí dịch vụ (${esc(label)})</span>
          <strong class="cash-val income-color">+${money(s.totalServiceRevenue)} ₫</strong>
          <span class="cash-sub">Lãi đóng gói: +${money(s.packProfitTotal || 0)} ₫ · Lãi tỷ giá tệ: +${money(s.fxProfitTotal)} ₫</span>
        </div>
        <div class="cash-card">
          <span class="cash-label">Tổng chi phí phát sinh (${esc(label)})</span>
          <strong class="cash-val expense-color">−${money(s.totalIncidentalExpense)} ₫</strong>
          <span class="cash-sub">Lợi nhuận ròng kỳ này: <b class="${s.netProfit >= 0 ? 'income-color' : 'expense-color'}">${s.netProfit >= 0 ? '+' : ''}${money(s.netProfit)} ₫</b></span>
        </div>
      </div>

      <div class="visual-grid">
        ${renderProfitDonutChart(s, label)}
        ${renderGoodsCategoryChart(filterSpec)}
      </div>

      <section class="panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">📅 Bảng doanh thu & Lợi nhuận theo từng ngày (${esc(getPeriodLabel())})</div>
            <div class="panel-sub">Tổng hợp tự động từ mọi Note đơn và Sổ thu chi</div>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Số đơn</th>
                <th>Tổng phải thu khách</th>
                <th>Tổng phí vận chuyển</th>
                <th>Tổng phí dịch vụ</th>
                <th>Chi phí phát sinh</th>
                <th>Lợi nhuận thực tế</th>
              </tr>
            </thead>
            <tbody>
              ${dailyRows.map(r => `<tr>
                <td data-label="Ngày"><b>${dateText(r.date)}</b></td>
                <td data-label="Số đơn">${r.orders} đơn</td>
                <td data-label="Phải thu khách">${money(r.collected)} ₫</td>
                <td data-label="Phí vận chuyển">${money(r.shipFee)} ₫</td>
                <td data-label="Phí dịch vụ" class="blue-color">+${money(r.serviceFee)} ₫</td>
                <td data-label="Chi phát sinh" class="expense-color">−${money(r.extra)} ₫</td>
                <td data-label="Lợi nhuận" class="${r.profit >= 0 ? 'income-color' : 'expense-color'}"><b>${r.profit >= 0 ? '+' : ''}${money(r.profit)} ₫</b></td>
              </tr>`).join('')}
            </tbody>
            ${dailyRows.length ? `<tfoot>
              <tr>
                <td>Tổng cộng</td>
                <td>${sumOrders} đơn</td>
                <td>${money(sumCollected)} ₫</td>
                <td>${money(sumShip)} ₫</td>
                <td class="blue-color">+${money(sumFee)} ₫</td>
                <td class="expense-color">−${money(sumExtra)} ₫</td>
                <td class="${sumProfit >= 0 ? 'income-color' : 'expense-color'}">${sumProfit >= 0 ? '+' : ''}${money(sumProfit)} ₫</td>
              </tr>
            </tfoot>` : ''}
          </table>
          ${dailyRows.length ? '' : '<div class="empty"><p>Chưa có dữ liệu phát sinh trong kỳ đã chọn.</p></div>'}
        </div>
      </section>
    </div>`;
  }

  // Tab 4: History (Audit Log)
  const histData = getHistoryViewData();
  return `<div class="section-stack">
    ${topToolbar}
    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">🕒 Lịch sử mỗi khi chỉnh sửa (Audit Log)</div>
          <div class="panel-sub">Ghi nhận chi tiết giờ, phút, giây và nội dung thay đổi mỗi khi tạo mới, sửa, đổi trạng thái hoặc xóa</div>
        </div>
        <span class="result-count" id="resultCount">${histData.filteredCount} / ${histData.totalCount} hoạt động</span>
      </div>
      <div class="filters">
        <div class="search">
          <span class="search-ico" aria-hidden="true">⌕</span>
          <input id="searchInput" class="field" placeholder="Tìm theo tên khách, thao tác, ngày giờ…" value="${esc(query)}" oninput="handleSearch(this)">
          <button type="button" id="searchClearBtn" class="search-clear ${query ? '' : 'hidden'}" onclick="clearSearchInput()" title="Xóa từ khóa">×</button>
        </div>
      </div>
      <div class="table-wrap" id="tableArea">${histData.tableHtml}</div>
    </section>
  </div>`;
}

// ============================================================================
// TRANG 4, 5, 6: ĐƠN KÝ GỬI, MUA HỘ, KHÁCH HÀNG
// ============================================================================
function stageCounts(data, stages) {
  const map = new Map(stages.map(s => [s, 0]));
  for (const x of (data || [])) map.set(x.status, (map.get(x.status) || 0) + 1);
  return [...map].map(([label, value]) => ({ label, value }));
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
  const hasFilter = Boolean(query || window.statusFilter || window.platformFilter);
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
      <select class="select" aria-label="Lọc theo App / Sàn mua hàng" onchange="setPlatformFilter(this.value)">
        <option value="">Mọi App / Sàn</option>
        ${shopPlatforms.map(p => `<option value="${esc(p)}" ${window.platformFilter === p ? 'selected' : ''}>🛍 ${esc(p)}</option>`).join('')}
      </select>
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
  const filtered = (db.shipments || []).filter(o => {
    const normPlat = normalizePlatformName(o.platform);
    const matchQ = `${o.customer} ${o.code} ${o.waybill} ${o.product} ${normPlat} ${o.packagingType || ''} ${o.phone} ${o.note || ''}`.toLowerCase().includes(q);
    if (window.platformFilter && normPlat !== window.platformFilter) return false;
    const matchStatus = !window.statusFilter ? true : window.statusFilter === '__active' ? o.status !== 'Đã giao khách' : o.status === window.statusFilter;
    return matchQ && matchStatus;
  });

  const rows = filtered.map(o => {
    const linkedOrder = (db.orderNotes || []).find(x =>
      x.sourceShipmentId === o.id ||
      (o.sourcePurchaseId && x.sourcePurchaseId === o.sourcePurchaseId) ||
      (o.waybill && x.waybill === o.waybill)
    );
    const hasPack = (o.packagingType && o.packagingType !== 'Tiêu chuẩn (Miễn phí)') || parseNum(o.packCharge) > 0;
    return `<tr>
    <td data-label="Khách hàng">
      <div class="customer">
        <div class="mini-avatar">${avatar(o.customer)}</div>
        <div>
          <div class="person">${esc(o.customer)} <span class="code">${esc(o.code || 'Chưa có mã')}</span> ${platformPill(o.platform)}</div>
          <div class="subline">${esc(o.phone || 'Chưa có SĐT')}</div>
        </div>
      </div>
    </td>
    <td data-label="Mã vận đơn">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <a class="link" target="_blank" rel="noopener" href="https://www.17track.net/en#nums=${encodeURIComponent(o.waybill)}" title="Tra cứu trên 17Track">${esc(o.waybill)} ↗</a>
        <button type="button" class="iconbtn" style="padding:2px 6px;font-size:11px" onclick="copyTextSafe('${jsArg(o.waybill)}','📋 Đã chép mã vận đơn ${jsArg(o.waybill)}')" title="Sao chép mã vận đơn">📋</button>
      </div>
    </td>
    <td data-label="Sản phẩm">
      <div class="person">${esc(o.product)} ${hasPack ? `<span class="pack-pill">🪵 ${esc(o.packagingType || 'Đóng gói')}${parseNum(o.packCharge) > 0 ? ` (+${money(o.packCharge)} ₫)` : ''}</span>` : ''}</div>
      <div class="subline">${esc(o.platform)} · SL: ${esc(o.qty)}${o.value ? ` · ¥${numFmt(o.value)}` : ''}</div>
      ${o.note ? `<div class="note-box">${esc(o.note)}</div>` : ''}
      ${o.updatedAt ? `<span class="ts-stamp">🕒 ${esc(o.updatedAt)}</span>` : ''}
    </td>
    <td data-label="Ngày tạo">${dateText(o.date)}</td>
    <td data-label="Trạng thái">${statusSelect('shipment', o.id, o.status, shipStages)}</td>
    <td data-label="Thao tác">
      <div class="row-actions">
        ${linkedOrder
          ? `<button type="button" class="iconbtn primary-tint" onclick="editRecord('order','${linkedOrder.id}')" title="Mở Note đơn tính lãi đã liên kết">✓ Xem Note đơn</button>`
          : `<button type="button" class="iconbtn primary-tint" onclick="makeOrderFromShipment('${o.id}')" title="Tạo Note đơn tính cước & lãi từ vận đơn này">＋ Tính lãi</button>`}
        <a class="iconbtn" target="_blank" rel="noopener" href="https://www.17track.net/en#nums=${encodeURIComponent(o.waybill)}">Tra cứu ↗</a>
        <button type="button" class="iconbtn" onclick="editRecord('shipment','${o.id}')">Sửa</button>
        <button type="button" class="iconbtn danger-tint" onclick="deleteItemDirect('shipment','${o.id}')">Xóa</button>
      </div>
    </td>
  </tr>`;
  }).join('');

  return {
    totalCount: (db.shipments || []).length,
    filteredCount: filtered.length,
    tableHtml: renderTableInner('<th>Khách hàng</th><th>Mã vận đơn</th><th>Sản phẩm & Ghi chú</th><th>Ngày tạo</th><th>Trạng thái</th><th>Thao tác</th>', rows, 'shipments')
  };
}

function shipmentsPage() {
  const ships = db.shipments || [];
  const counts = stageCounts(ships, shipStages);
  const activeCount = ships.filter(o => o.status !== 'Đã giao khách').length;
  const inTransitCount = ships.filter(o => ['Đang vận chuyển nội địa TQ', 'Đã đến kho Trung Quốc', 'Đã nhập kho Trung Quốc', 'Đang về Việt Nam'].includes(o.status)).length;
  const atVnCount = ships.filter(o => o.status === 'Đã về kho Việt Nam').length;
  const data = getShipmentsViewData();
  return `<div class="section-stack">
    <div class="cashflow-grid">
      <div class="cash-card" style="cursor:pointer" onclick="setFilter('')">
        <span class="cash-label">📦 Tổng vận đơn ký gửi</span>
        <strong class="cash-val">${ships.length} vận đơn</strong>
        <span class="cash-sub">Đang xử lý: ${activeCount} · Đã giao khách: ${ships.length - activeCount}</span>
      </div>
      <div class="cash-card" style="cursor:pointer" onclick="setFilter('__active')">
        <span class="cash-label">🚚 Đang trên đường TQ → VN</span>
        <strong class="cash-val blue-color">${inTransitCount} kiện</strong>
        <span class="cash-sub">Bấm tra cứu 17Track trực tiếp trên từng mã vận đơn</span>
      </div>
      <div class="cash-card" style="cursor:pointer" onclick="setFilter('Đã về kho Việt Nam')">
        <span class="cash-label">🏠 Đã về kho VN (Chờ giao / Tính lãi)</span>
        <strong class="cash-val ${atVnCount > 0 ? 'amber-color' : 'income-color'}">${atVnCount} kiện</strong>
        <span class="cash-sub">Bấm "＋ Tính lãi" trên dòng để tạo Note đơn 1 chạm</span>
      </div>
    </div>
    <div class="stage-strip" aria-label="Lọc nhanh trạng thái vận đơn">
      <button type="button" class="chip ${window.statusFilter === '' ? 'active' : ''}" onclick="setFilter('')">Tất cả <span class="chip-count">${ships.length}</span></button>
      <button type="button" class="chip ${window.statusFilter === '__active' ? 'active' : ''}" onclick="setFilter('__active')">Cần theo dõi <span class="chip-count">${activeCount}</span></button>
      ${counts.filter(c => c.value > 0).map(c => `<button type="button" class="chip ${window.statusFilter === c.label ? 'active' : ''}" onclick="setFilter('${esc(c.label)}')">${esc(c.label)} <span class="chip-count">${c.value}</span></button>`).join('')}
    </div>
    ${tableShell('Danh sách đơn ký gửi', 'Bấm trực tiếp vào nhãn trạng thái để đổi nhanh; bấm 📋 để chép nhanh mã vận đơn.', 'Tìm tên khách, mã DR, SĐT, mã vận đơn, sản phẩm…', shipStages, data.tableHtml, data.totalCount, data.filteredCount)}
  </div>`;
}

function safeUrl(u) {
  try {
    const x = new URL(normalizeUrl(u));
    return ['http:', 'https:'].includes(x.protocol) ? esc(x.href) : '#';
  } catch {
    return '#';
  }
}

function getPurchasesViewData() {
  const q = query.toLowerCase();
  const filtered = (db.purchases || []).filter(o => {
    const normPlat = normalizePlatformName(o.platform);
    const matchQ = `${o.customer} ${o.code} ${o.product} ${normPlat} ${o.phone} ${o.variant || ''} ${o.note || ''}`.toLowerCase().includes(q);
    if (window.platformFilter && normPlat !== window.platformFilter) return false;
    const matchStatus = !window.statusFilter ? true : window.statusFilter === '__active' ? !['Đặt hàng thành công', 'Đã hủy'].includes(o.status) : o.status === window.statusFilter;
    return matchQ && matchStatus;
  });

  const rows = filtered.map(o => {
    const linkedOrder = (db.orderNotes || []).find(x => x.sourcePurchaseId === o.id);
    const linkedShip = (db.shipments || []).find(x => x.sourcePurchaseId === o.id);
    const imgSafe = o.image && safeUrl(o.image) !== '#' ? safeUrl(o.image) : '';
    return `<tr>
    <td data-label="Khách hàng">
      <div class="customer">
        <div class="mini-avatar">${avatar(o.customer)}</div>
        <div>
          <div class="person">${esc(o.customer)} <span class="code">${esc(o.code || 'Chưa có mã')}</span> ${platformPill(o.platform)}</div>
          <div class="subline">${esc(o.phone || 'Chưa có SĐT')}</div>
        </div>
      </div>
    </td>
    <td data-label="Sản phẩm">
      <div style="display:flex;align-items:center;gap:10px">
        ${imgSafe ? `<img src="${imgSafe}" alt="" class="prod-thumb" loading="lazy" onerror="this.style.display='none'">` : ''}
        <div>
          <div class="person">${esc(o.product)}</div>
          <div class="subline">${esc(o.variant || 'Chưa chọn phân loại')}</div>
          ${o.note ? `<div class="note-box">${esc(o.note)}</div>` : ''}
          ${o.updatedAt ? `<span class="ts-stamp">🕒 ${esc(o.updatedAt)}</span>` : ''}
        </div>
      </div>
    </td>
    <td data-label="Số lượng"><b>${esc(o.qty)}</b></td>
    <td data-label="Giá / Báo khách">
      <div>Giá gốc: <b>¥${numFmt(o.value)}</b></div>
      <div class="subline">${o.quote ? `Báo khách: <b>¥${numFmt(o.quote)}</b>` : 'Chưa báo giá'}</div>
    </td>
    <td data-label="Trạng thái">${statusSelect('purchase', o.id, o.status, buyStages)}</td>
    <td data-label="Thao tác">
      <div class="row-actions">
        ${o.url ? `<a class="iconbtn" href="${safeUrl(o.url)}" target="_blank" rel="noopener">Mở link ↗</a>` : ''}
        ${linkedOrder
          ? `<button type="button" class="iconbtn primary-tint" onclick="editRecord('order','${linkedOrder.id}')" title="Mở Note đơn tính lãi đã tạo">✓ Xem Note đơn</button>`
          : `<button type="button" class="iconbtn primary-tint" onclick="makeOrderFromPurchase('${o.id}')" title="Chuyển sang bảng Note đơn tính lãi">＋ Tính lãi</button>`}
        ${linkedShip
          ? `<button type="button" class="iconbtn" onclick="editRecord('shipment','${linkedShip.id}')" title="Mở vận đơn ký gửi đã tạo">✓ Xem Vận đơn</button>`
          : (['Đặt hàng thành công', 'Đang đặt hàng', 'Đã thanh toán'].includes(o.status) ? `<button type="button" class="iconbtn" onclick="makeShipmentFromPurchase('${o.id}')">＋ Vận đơn</button>` : '')}
        <button type="button" class="iconbtn" onclick="editRecord('purchase','${o.id}')">Sửa</button>
        <button type="button" class="iconbtn danger-tint" onclick="deleteItemDirect('purchase','${o.id}')">Xóa</button>
      </div>
    </td>
  </tr>`;
  }).join('');

  return {
    totalCount: (db.purchases || []).length,
    filteredCount: filtered.length,
    tableHtml: renderTableInner('<th>Khách hàng</th><th>Sản phẩm / Ghi chú</th><th>SL</th><th>Giá / Báo khách</th><th>Trạng thái</th><th>Thao tác</th>', rows, 'purchases')
  };
}

function purchasesPage() {
  const buys = db.purchases || [];
  const counts = stageCounts(buys, buyStages);
  const activeCount = buys.filter(o => !['Đặt hàng thành công', 'Đã hủy'].includes(o.status)).length;
  const totalCny = buys.filter(o => o.status !== 'Đã hủy').reduce((s, o) => s + parseNum(o.quote || o.value) * Math.max(1, parseNum(o.qty) || 1), 0);
  const doneCount = buys.filter(o => o.status === 'Đặt hàng thành công').length;
  const data = getPurchasesViewData();
  return `<div class="section-stack">
    <div class="cashflow-grid">
      <div class="cash-card" style="cursor:pointer" onclick="setFilter('')">
        <span class="cash-label">🛍 Tổng yêu cầu mua hộ</span>
        <strong class="cash-val">${buys.length} yêu cầu</strong>
        <span class="cash-sub">Đặt thành công: ${doneCount} · Đang xử lý: ${activeCount}</span>
      </div>
      <div class="cash-card" style="cursor:pointer" onclick="setFilter('__active')">
        <span class="cash-label">⏳ Chờ báo giá / Thanh toán / Đặt hàng</span>
        <strong class="cash-val ${activeCount > 0 ? 'amber-color' : 'income-color'}">${activeCount} yêu cầu</strong>
        <span class="cash-sub">Bấm lọc nhanh các đơn cần xử lý ngay</span>
      </div>
      <div class="cash-card">
        <span class="cash-label">💴 Tổng giá trị hàng sàn ước tính</span>
        <strong class="cash-val blue-color">¥${numFmt(totalCny)}</strong>
        <span class="cash-sub">Bấm "＋ Tính lãi" trên dòng để chuyển sang Note đơn VND</span>
      </div>
    </div>
    <div class="stage-strip" aria-label="Lọc nhanh trạng thái mua hộ">
      <button type="button" class="chip ${window.statusFilter === '' ? 'active' : ''}" onclick="setFilter('')">Tất cả <span class="chip-count">${buys.length}</span></button>
      <button type="button" class="chip ${window.statusFilter === '__active' ? 'active' : ''}" onclick="setFilter('__active')">Cần xử lý <span class="chip-count">${activeCount}</span></button>
      ${counts.filter(c => c.value > 0).map(c => `<button type="button" class="chip ${window.statusFilter === c.label ? 'active' : ''}" onclick="setFilter('${esc(c.label)}')">${esc(c.label)} <span class="chip-count">${c.value}</span></button>`).join('')}
    </div>
    ${tableShell('Danh sách yêu cầu mua hộ', 'Bấm "＋ Tính lãi" để đưa đơn sang bảng Note đơn tính cước, phí dịch vụ % và chênh lệch tỷ giá.', 'Tìm khách hàng, mã DR, tên sản phẩm hoặc ghi chú…', buyStages, data.tableHtml, data.totalCount, data.filteredCount)}
  </div>`;
}

function getCustomersViewData() {
  const q = query.toLowerCase();
  const allCustomers = uniqueCustomers().map(o => {
    const custOrders = (db.orderNotes || []).filter(x => sameCustomer(x, o));
    const oc = custOrders.length;
    const sc = (db.shipments || []).filter(x => sameCustomer(x, o)).length;
    const pc = (db.purchases || []).filter(x => sameCustomer(x, o)).length;
    const activeCustOrders = custOrders.filter(x => x.status !== 'Đã hủy');
    const unlinkedCustExtras = (db.extraShipments || []).filter(x => !isExtraShipLinkedToOrder(x) && sameCustomer(x, o));
    const unlinkedExtraDebt = unlinkedCustExtras.reduce((sum, x) => sum + Math.max(0, Math.round(parseNum(x.amount)) - getExtraCurrentPaid(x)), 0);
    const debt = activeCustOrders.reduce((sum, x) => sum + calcOrderMetrics(x).customerDebt, 0) + unlinkedExtraDebt;
    const totalProfit = activeCustOrders.reduce((sum, x) => sum + calcOrderMetrics(x).netProfit, 0);
    return { ...o, oc, sc, pc, totalCountAll: oc + sc + pc, debt, totalProfit };
  });

  const customers = allCustomers.filter(o => {
    const matchQ = `${o.customer} ${o.code} ${o.phone} ${o.address}`.toLowerCase().includes(q);
    if (!matchQ) return false;
    if (window.statusFilter === '__cust_debt') return o.debt > 0;
    if (window.statusFilter === '__cust_vip') return o.totalCountAll >= 2;
    return true;
  }).sort((a, b) => (b.debt - a.debt) || (b.totalCountAll - a.totalCountAll));

  const rows = customers.map(o => {
    const custKey = jsArg(o.code || o.phone || o.customer);

    return `<tr>
      <td data-label="Khách hàng">
        <div class="customer">
          <div class="mini-avatar">${avatar(o.customer)}</div>
          <div>
            <div class="person">${esc(o.customer)} <span class="code">${esc(o.code || '—')}</span> ${o.totalCountAll >= 2 ? '<span class="shop-pill shop-95">💎 Thân thiết</span>' : ''}</div>
            <div>
              ${o.debt > 0 ? `<span class="debt-pill owe">Đang nợ ${money(o.debt)} ₫</span>` : '<span class="debt-pill ok">✓ Không nợ</span>'}
              ${o.oc > 0 && currentUserRole !== 'warehouse' ? `<span class="subline" style="margin-left:6px">Lãi tích lũy: <b class="${o.totalProfit >= 0 ? 'income-color' : 'expense-color'}">${o.totalProfit >= 0 ? '+' : ''}${money(o.totalProfit)} ₫</b></span>` : ''}
            </div>
          </div>
        </div>
      </td>
      <td data-label="Số điện thoại">${o.phone ? `<span style="cursor:pointer" onclick="copyTextSafe('${jsArg(o.phone)}','📋 Đã chép SĐT ${jsArg(o.phone)}')" title="Bấm sao chép SĐT">${esc(o.phone)} 📋</span>` : 'Chưa cập nhật'}</td>
      <td data-label="Địa chỉ nhận">${esc(o.address || 'Chưa nhập địa chỉ')}</td>
      <td data-label="Tổng đơn"><b>${o.oc}</b> note đơn · <b>${o.sc}</b> vận đơn · <b>${o.pc}</b> mua hộ</td>
      <td data-label="Thao tác nhanh">
        <div class="row-actions">
          ${o.debt > 0 ? `<button type="button" class="iconbtn danger-tint" onclick="copyCustomerDebtZalo('${custKey}')" title="Sao chép bảng đối chiếu công nợ gửi Zalo cho khách">📋 Nhắc nợ Zalo</button>` : ''}
          ${o.oc > 0 ? `<button type="button" class="iconbtn" onclick="viewCustomerOrders('${jsArg(o.customer)}')">Xem đơn</button>` : ''}
          <button type="button" class="iconbtn primary-tint" onclick="openForCustomer('order','${custKey}')">＋ Note đơn</button>
          <button type="button" class="iconbtn" onclick="openForCustomer('shipment','${custKey}')">＋ Vận đơn</button>
          <button type="button" class="iconbtn" onclick="openForCustomer('purchase','${custKey}')">＋ Mua hộ</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  return {
    allCustomers,
    totalCount: allCustomers.length,
    filteredCount: customers.length,
    tableHtml: renderTableInner('<th>Khách hàng & Công nợ</th><th>Số điện thoại</th><th>Địa chỉ nhận hàng</th><th>Số lượng đơn</th><th>Thao tác nhanh</th>', rows, 'customers')
  };
}

function customersPage() {
  const data = getCustomersViewData();
  const debtCusts = data.allCustomers.filter(c => c.debt > 0);
  const totalCustDebt = debtCusts.reduce((s, c) => s + c.debt, 0);
  const vipCusts = data.allCustomers.filter(c => c.totalCountAll >= 2);
  const hasFilter = Boolean(query || window.statusFilter);

  return `<div class="section-stack">
    <div class="cashflow-grid">
      <div class="cash-card" style="cursor:pointer" onclick="setFilter('')">
        <span class="cash-label">👥 Tổng danh bạ khách hàng</span>
        <strong class="cash-val">${data.totalCount} khách hàng</strong>
        <span class="cash-sub">Tự động gom từ Note đơn, Vận đơn ký gửi &amp; Mua hộ</span>
      </div>
      <div class="cash-card" style="cursor:pointer" onclick="setFilter('__cust_debt')">
        <span class="cash-label">⚠️ Khách đang còn nợ chưa thu</span>
        <strong class="cash-val ${totalCustDebt > 0 ? 'expense-color' : 'income-color'}">${debtCusts.length} khách · ${money(totalCustDebt)} ₫</strong>
        <span class="cash-sub">Bấm lọc khách nợ &amp; chép phiếu nhắc nợ Zalo 1 chạm</span>
      </div>
      <div class="cash-card" style="cursor:pointer" onclick="setFilter('__cust_vip')">
        <span class="cash-label">💎 Khách hàng thân thiết (≥ 2 đơn)</span>
        <strong class="cash-val income-color">${vipCusts.length} khách hàng</strong>
        <span class="cash-sub">Tự điền sẵn SĐT, mã DR &amp; địa chỉ khi tạo đơn mới</span>
      </div>
    </div>

    <div class="stage-strip" aria-label="Lọc nhanh danh bạ khách hàng">
      <button type="button" class="chip ${window.statusFilter === '' ? 'active' : ''}" onclick="setFilter('')">Tất cả khách <span class="chip-count">${data.totalCount}</span></button>
      <button type="button" class="chip ${window.statusFilter === '__cust_debt' ? 'active' : ''}" onclick="setFilter('__cust_debt')">⚠️ Đang còn nợ <span class="chip-count">${debtCusts.length}</span></button>
      <button type="button" class="chip ${window.statusFilter === '__cust_vip' ? 'active' : ''}" onclick="setFilter('__cust_vip')">💎 Khách thân thiết (≥ 2 đơn) <span class="chip-count">${vipCusts.length}</span></button>
    </div>

    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Danh bạ khách hàng &amp; Đối chiếu Công nợ nhanh</div>
          <div class="panel-sub">Khách đang nợ được ưu tiên xếp lên đầu; bấm "📋 Nhắc nợ Zalo" để chép chi tiết từng đơn chưa thanh toán.</div>
        </div>
        <span class="result-count" id="resultCount">${data.filteredCount} / ${data.totalCount} khách</span>
      </div>
      <div class="filters">
        <div class="search">
          <span class="search-ico" aria-hidden="true">⌕</span>
          <input id="searchInput" class="field" placeholder="Tìm tên khách, mã DR, số điện thoại hoặc địa chỉ…" value="${esc(query)}" oninput="handleSearch(this)">
          <button type="button" id="searchClearBtn" class="search-clear ${query ? '' : 'hidden'}" onclick="clearSearchInput()" title="Xóa từ khóa">×</button>
        </div>
        <button type="button" id="resetFilterBtn" class="btn subtle small ${hasFilter ? '' : 'hidden'}" onclick="clearFilters()">Đặt lại lọc</button>
      </div>
      <div class="table-wrap" id="tableArea">${data.tableHtml}</div>
    </section>
  </div>`;
}

// ============================================================================
// BIỂU MẪU (MODAL) GỌN GÀNG THEO TỪNG BƯỚC & LƯU AN TOÀN TUYỆT ĐỐI
// ============================================================================
function markFormDirty() {
  formDirty = true;
  hideFormError();
  const kind = document.getElementById('recordForm')?.dataset.kind;
  if (kind === 'order') {
    updateOrderCalcPreview();
  } else if (kind === 'packitem') {
    updatePackItemCalcPreview();
  }
}

function showFormError(msg, fieldId = '') {
  const errEl = document.getElementById('formError');
  if (errEl) {
    errEl.textContent = '⚠ ' + msg;
    errEl.classList.remove('hidden');
    errEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  document.querySelectorAll('.field.invalid').forEach(el => el.classList.remove('invalid'));
  if (fieldId) {
    const input = document.getElementById('f_' + fieldId);
    if (input) {
      input.classList.add('invalid');
      input.focus();
    }
  }
}

function hideFormError() {
  document.getElementById('formError')?.classList.add('hidden');
  document.querySelectorAll('.field.invalid').forEach(el => el.classList.remove('invalid'));
}

function handleOverlayMouseDown(e) {
  overlayMouseDownTarget = e.target;
}

function handleOverlayClick(e) {
  if (e.target === e.currentTarget && overlayMouseDownTarget === e.currentTarget) {
    requestCloseModal();
  }
  overlayMouseDownTarget = null;
}

function requestCloseModal() {
  if (formDirty && !confirm('Bạn có thông tin vừa nhập chưa bấm Lưu. Đóng biểu mẫu và hủy thay đổi?')) {
    return;
  }
  closeModal();
}

function closeModal() {
  formDirty = false;
  hideFormError();
  document.getElementById('modal').classList.remove('open');
  document.getElementById('modalBox')?.classList.remove('wide');
  const saveBtnEl = document.getElementById('saveBtn');
  if (saveBtnEl) saveBtnEl.textContent = '✓ Lưu thông tin';
  cancelDeleteModal();
}

function openForCustomer(kind, key) {
  const c = uniqueCustomers().find(o => (o.code || o.phone || o.customer).toLowerCase() === String(key || '').toLowerCase());
  openNew(kind);
  if (c) {
    renderFields(kind, {
      customer: c.customer,
      phone: c.phone,
      code: c.code,
      address: c.address,
      platform: c.platform || 'Taobao'
    });
    if (kind === 'order') updateOrderCalcPreview();
  }
}

function openNewPackItem(cat = 'wood') {
  openNew('packitem', { category: cat, unit: cat === 'shock' ? 'Lần sử dụng' : cat === 'carton' ? 'Thùng' : 'Cái', qty: 1 });
}

function openNew(kind = view === 'purchases' ? 'purchase' : view === 'finance' ? 'finance' : view === 'shipments' ? 'shipment' : view === 'incidentals' ? (incTab === 'extraship' ? 'extraship' : 'packitem') : 'order', preset = {}) {
  const form = document.getElementById('recordForm');
  form.reset();
  form.dataset.kind = kind;
  form.dataset.id = '';
  formDirty = false;
  hideFormError();
  document.getElementById('modalBox')?.classList.toggle('wide', kind === 'order' || kind === 'packitem');

  document.getElementById('modalTitle').textContent =
    kind === 'order' ? 'Tạo Note đơn & Tính lãi tự động' :
    kind === 'extraship' ? 'Thêm Cước ship phát sinh (Khách thanh toán)' :
    kind === 'packitem' ? 'Thêm sản phẩm / dịch vụ đóng gói' :
    kind === 'purchase' ? 'Thêm yêu cầu mua hộ' :
    kind === 'finance' ? 'Ghi khoản thu / chi' :
    'Thêm đơn ký gửi';
  document.getElementById('modalSub').textContent = 'Gõ số bình thường (500000 hoặc 500.000 đều được); tự động lưu thời gian cập nhật.';
  document.getElementById('deleteZone').classList.add('hidden');
  document.getElementById('recordHistoryZone').classList.add('hidden');
  const saveBtnEl = document.getElementById('saveBtn');
  if (saveBtnEl) saveBtnEl.textContent = '✓ Lưu thông tin';
  cancelDeleteModal();

  renderFields(kind, preset);
  if (kind === 'order') updateOrderCalcPreview();
  else if (kind === 'packitem') updatePackItemCalcPreview();
  else document.getElementById('calcPreviewZone').innerHTML = '';

  document.getElementById('modal').classList.add('open');
  setTimeout(() => {
    const first = document.querySelector('#formFields input:not([type=hidden]):not([type=checkbox])');
    if (first) first.focus();
  }, 30);
}

function makeOrderFromPurchase(id) {
  const p = (db.purchases || []).find(x => x.id === id);
  if (!p) return;
  const linkedShip = (db.shipments || []).find(x => x.sourcePurchaseId === p.id);
  openNew('order');
  document.getElementById('modalTitle').textContent = 'Tạo Note đơn tính lãi từ đơn Mua hộ';
  renderFields('order', {
    lineType: 'Thanh toán hộ',
    platform: normalizePlatformName(p.platform),
    packages: Math.max(1, parseNum(p.qty) || 1),
    customer: p.customer,
    phone: p.phone,
    code: p.code,
    waybill: linkedShip?.waybill || '',
    sourcePurchaseId: p.id,
    sourceShipmentId: linkedShip?.id || '',
    goodsType: 'Khác',
    product: p.product + (p.variant ? ` (${p.variant})` : ''),
    goodsCny: p.quote || p.value || 0,
    includeGoodsInFlow: true,
    rateBuy: 3550,
    rateSell: 3650,
    serviceFeePct: 3,
    note: p.note || ''
  });
  updateOrderCalcPreview();
}

function makeOrderFromShipment(id) {
  const s = (db.shipments || []).find(x => x.id === id);
  if (!s) return;
  openNew('order');
  document.getElementById('modalTitle').textContent = 'Tạo Note đơn tính cước & lãi từ Đơn ký gửi';
  renderFields('order', {
    lineType: 'Ký gửi kho',
    platform: normalizePlatformName(s.platform),
    packages: Math.max(1, parseNum(s.qty) || 1),
    customer: s.customer,
    phone: s.phone,
    code: s.code,
    waybill: s.waybill,
    sourcePurchaseId: s.sourcePurchaseId || '',
    sourceShipmentId: s.id,
    goodsType: 'Khác',
    product: `${s.product}${s.waybill ? ` · VĐ ${s.waybill}` : ''}`,
    goodsCny: s.value || 0,
    includeGoodsInFlow: false,
    packagingType: s.packagingType || packagingTypes[0],
    packCost: s.packCost || 0,
    packCharge: s.packCharge || 0,
    status: s.status === 'Đã về kho Việt Nam' ? 'Đã về kho VN' : s.status === 'Đã giao khách' ? 'Đã giao khách' : 'Đang vận chuyển',
    note: s.note || ''
  });
  updateOrderCalcPreview();
}

function makeShipmentFromPurchase(id) {
  const p = (db.purchases || []).find(x => x.id === id);
  if (!p) return;
  openNew('shipment');
  document.getElementById('modalTitle').textContent = 'Tạo vận đơn từ đơn mua hộ';
  renderFields('shipment', {
    customer: p.customer,
    phone: p.phone,
    code: p.code,
    sourcePurchaseId: p.id,
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
  const list =
    kind === 'order' ? db.orderNotes :
    kind === 'shipment' ? db.shipments :
    kind === 'purchase' ? db.purchases :
    kind === 'extraship' ? db.extraShipments :
    kind === 'packitem' ? db.packagingCatalog :
    db.transactions;
  const o = (list || []).find(x => x.id === id);
  if (!o) return;

  const form = document.getElementById('recordForm');
  form.dataset.kind = kind;
  form.dataset.id = id;
  formDirty = false;
  hideFormError();
  document.getElementById('modalBox')?.classList.toggle('wide', kind === 'order' || kind === 'packitem');

  document.getElementById('modalTitle').textContent =
    kind === 'order' ? 'Cập nhật Note đơn · Đóng gói & Bảng tính' :
    kind === 'extraship' ? 'Cập nhật Cước ship phát sinh' :
    kind === 'packitem' ? 'Cập nhật sản phẩm / dịch vụ đóng gói' :
    kind === 'purchase' ? 'Cập nhật yêu cầu mua hộ' :
    kind === 'finance' ? 'Cập nhật khoản thu / chi' :
    'Cập nhật đơn ký gửi kho';
  document.getElementById('modalSub').textContent = o.updatedAt ? `Lần sửa gần nhất: ${o.updatedAt}` : 'Chỉnh sửa thông tin rồi bấm Lưu.';
  document.getElementById('deleteZone').classList.remove('hidden');
  const saveBtnEl = document.getElementById('saveBtn');
  if (saveBtnEl) saveBtnEl.textContent = '✓ Lưu thông tin';
  cancelDeleteModal();

  renderFields(kind, o);
  if (kind === 'order') updateOrderCalcPreview();
  else if (kind === 'packitem') updatePackItemCalcPreview();
  else document.getElementById('calcPreviewZone').innerHTML = '';

  renderRecordHistory(o);
  document.getElementById('modal').classList.add('open');
}

function renderRecordHistory(o) {
  const zone = document.getElementById('recordHistoryZone');
  if (!zone) return;
  const hist = Array.isArray(o.history) ? o.history : [];
  if (!hist.length) {
    zone.classList.add('hidden');
    zone.innerHTML = '';
    return;
  }
  zone.classList.remove('hidden');
  zone.innerHTML = `
    <div class="record-history-head">🕒 Lịch sử chỉnh sửa của mục này (${hist.length} lần)</div>
    <div class="history-list">
      ${hist.map(h => `<div class="history-item">
        <div><b>${esc(h.action)}:</b> ${esc(h.detail)}</div>
        <span class="ts-stamp" style="margin:0">${esc(h.time)}</span>
      </div>`).join('')}
    </div>
  `;
}

function field(id, label, value = '', type = 'text', required = false, full = false, placeholder = '', extraAttr = '') {
  const isNumeric = type === 'money' || type === 'decimal';
  const inputType = isNumeric ? 'text' : type;
  const inputMode = isNumeric ? 'inputmode="decimal"' : '';
  const displayVal = (value === 0 || value) ? value : '';
  return `<div class="${full ? 'full' : ''}">
    <label for="f_${id}">${label}${required ? ' *' : ''}</label>
    <input id="f_${id}" class="field" type="${inputType}" ${inputMode} value="${esc(displayVal)}" placeholder="${esc(placeholder)}" ${extraAttr}>
  </div>`;
}

function selectField(id, label, values, value, full = false, onChange = '') {
  return `<div class="${full ? 'full' : ''}">
    <label for="f_${id}">${label}</label>
    <select id="f_${id}" class="select" ${onChange ? `onchange="${onChange}"` : ''}>${values.map(x => `<option value="${esc(x)}" ${x === value ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
  </div>`;
}

function selectLineType(lineVal) {
  const inp = document.getElementById('f_lineType');
  if (inp) inp.value = lineVal;
  document.querySelectorAll('.line-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.line === lineVal);
  });
  const isTth = ['Thanh toán hộ', 'Mua hộ trọn gói'].includes(lineVal);
  toggleCnyBox(isTth || parseNum(val('goodsCny')) > 0);
  formDirty = true;
  updateOrderCalcPreview();
}

function toggleCnyBox(forceState) {
  showCnyBox = typeof forceState === 'boolean' ? forceState : !showCnyBox;
  document.getElementById('cnyExchangeBox')?.classList.toggle('hidden', !showCnyBox);
  const btn = document.getElementById('toggleCnyBtn');
  if (btn) {
    btn.textContent = showCnyBox ? '▾ Đang bật quy đổi Tệ (CNY)' : '＋ Quy đổi Nhân dân tệ (CNY) & tính lãi tỷ giá';
  }
  updateOrderCalcPreview();
}

function setPkgCount(n) {
  const inp = document.getElementById('f_packages');
  if (inp) {
    inp.value = String(n);
    formDirty = true;
    syncPkgButtons(n);
  }
}

function syncPkgButtons(valRaw) {
  const num = Number(parseNum(valRaw));
  document.querySelectorAll('.pkg-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.pkg) === num));
}

function fillFullCustomerPay() {
  const draft = readDraftOrderFromForm();
  const m = calcOrderMetrics(draft);
  const inp = document.getElementById('f_customerPaid');
  if (inp) {
    inp.value = String(Math.max(0, m.totalCollectCustomer - m.extraShipPaid));
    formDirty = true;
    updateOrderCalcPreview();
  }
}

// ============================================================================
// GẮN VẬT TƯ ĐÓNG GÓI VÀO ĐƠN HÀNG (BẢO TOÀN LỊCH SỬ GIÁ NHẬP & GIÁ BÁN)
// ============================================================================
function renderDraftOrderPackList() {
  const listEl = document.getElementById('orderPackListZone');
  if (!listEl) return;
  if (!draftOrderPackItems.length) {
    listEl.innerHTML = `<div style="font-size:12px;color:var(--muted)">Chưa gắn vật tư đóng gói chi tiết (hoặc bạn có thể nhập nhanh ở ô Chi phí / Phí đóng gói bên dưới).</div>`;
    return;
  }
  const sumCost = draftOrderPackItems.reduce((s, it) => s + Math.round(parseNum(it.costPrice) * parseNum(it.qty)), 0);
  const sumSell = draftOrderPackItems.reduce((s, it) => s + Math.round(parseNum(it.sellPrice) * parseNum(it.qty)), 0);
  const sumProf = sumSell - sumCost;

  listEl.innerHTML = `
    <div class="order-pack-list">
      ${draftOrderPackItems.map((it, idx) => {
        const c = Math.round(parseNum(it.costPrice) * parseNum(it.qty));
        const s = Math.round(parseNum(it.sellPrice) * parseNum(it.qty));
        const p = s - c;
        return `<div class="order-pack-item">
          <div>
            <b>${numFmt(it.qty)} ${esc(it.unit || 'lần')} · ${esc(it.name)}</b>
            <span class="subline" style="margin-left:6px">(Vốn: ${money(it.costPrice)} ₫ → Bán: ${money(it.sellPrice)} ₫)</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span>Vốn: <b>${money(c)} ₫</b> · Thu: <b class="blue-color">${money(s)} ₫</b> · Lãi: <b class="income-color">+${money(p)} ₫</b></span>
            <button type="button" class="iconbtn danger-tint" onclick="removeDraftOrderPackItem(${idx})" title="Gỡ vật tư này">×</button>
          </div>
        </div>`;
      }).join('')}
      <div style="display:flex;justify-content:space-between;padding:6px 4px 0;font-size:12.5px;border-top:1px dashed var(--line)">
        <span>Tổng cộng vật tư đóng gói của đơn này (đã chốt cứng giá):</span>
        <span>Tổng vốn: <b>${money(sumCost)} ₫</b> · Tổng thu khách: <b class="blue-color">${money(sumSell)} ₫</b> · Tổng lãi ĐG: <b class="income-color">+${money(sumProf)} ₫</b></span>
      </div>
    </div>
  `;
}

function addDraftOrderPackItem() {
  const catId = document.getElementById('f_pickPackCatalogId')?.value;
  const qty = Math.max(0.5, parseNum(document.getElementById('f_pickPackQty')?.value || 1));
  const found = (db.packagingCatalog || []).find(x => x.id === catId);
  if (!found) {
    toast('Chưa có vật tư đóng gói trong danh mục — hãy thêm ở mục Chi phí phát sinh hoặc nhập trực tiếp giá vốn/bán bên dưới.');
    return;
  }

  // Chụp (snapshot) giá nhập và giá bán tại thời điểm gắn vào đơn
  draftOrderPackItems.push({
    id: makeId(),
    catalogId: found.id,
    category: found.category,
    name: found.name,
    spec: found.spec || '',
    unit: found.unit || 'Cái',
    costPrice: Math.round(parseNum(found.costPrice)),
    sellPrice: Math.round(parseNum(found.sellPrice)),
    qty
  });

  // Đồng bộ tự động sang ô packCost / packCharge để hiển thị trực quan
  syncPackInputsFromDraftItems();
  formDirty = true;
  renderDraftOrderPackList();
  updateOrderCalcPreview();
}

function removeDraftOrderPackItem(idx) {
  draftOrderPackItems.splice(idx, 1);
  syncPackInputsFromDraftItems();
  formDirty = true;
  renderDraftOrderPackList();
  updateOrderCalcPreview();
}

function syncPackInputsFromDraftItems() {
  const costInp = document.getElementById('f_packCost');
  const chargeInp = document.getElementById('f_packCharge');
  const typeSel = document.getElementById('f_packagingType');
  if (draftOrderPackItems.length > 0) {
    const sumCost = draftOrderPackItems.reduce((s, it) => s + Math.round(parseNum(it.costPrice) * parseNum(it.qty)), 0);
    const sumSell = draftOrderPackItems.reduce((s, it) => s + Math.round(parseNum(it.sellPrice) * parseNum(it.qty)), 0);
    if (costInp) costInp.value = String(sumCost);
    if (chargeInp) chargeInp.value = String(sumSell);
    if (typeSel && typeSel.value === packagingTypes[0]) {
      const firstCat = draftOrderPackItems[0].category;
      typeSel.value = firstCat === 'wood' ? 'Đóng hộp gỗ' : firstCat === 'carton' ? 'Đóng hộp carton' : 'Chống sốc';
    }
  } else {
    if (costInp) costInp.value = '';
    if (chargeInp) chargeInp.value = '';
  }
}

function readDraftOrderFromForm() {
  const id = document.getElementById('recordForm')?.dataset.id || '';
  const prev = (db.orderNotes || []).find(x => x.id === id);
  const lineType = val('lineType') || 'Xách tay';
  // Bảo toàn dữ liệu lịch sử nếu không đổi Line; nếu người dùng đổi Line thì tính lại theo Line mới
  const includeGoods = (prev && prev.lineType === lineType && prev.includeGoodsInFlow !== undefined)
    ? Boolean(prev.includeGoodsInFlow)
    : ['Thanh toán hộ', 'Mua hộ trọn gói'].includes(lineType);

  return {
    id,
    lineType,
    platform: normalizePlatformName(val('platform')),
    packages: Math.max(1, Math.round(parseNum(val('packages')) || 1)),
    customer: val('customer'),
    phone: val('phone'),
    code: val('code'),
    waybill: val('waybill'),
    sourcePurchaseId: val('sourcePurchaseId'),
    sourceShipmentId: val('sourceShipmentId'),
    goodsType: val('goodsType') || goodsTypes[0],
    product: val('product'),
    goodsCny: parseNum(val('goodsCny')),
    goodsVndInput: parseNum(val('goodsVndInput')),
    includeGoodsInFlow: includeGoods,
    shipCost: parseNum(val('shipCost')),
    shipCharge: parseNum(val('shipCharge')),
    packagingType: val('packagingType') || packagingTypes[0],
    packCost: parseNum(val('packCost')),
    packCharge: parseNum(val('packCharge')),
    packagingItems: [...draftOrderPackItems],
    serviceFeePct: parseNum(val('serviceFeePct')),
    serviceFeeManual: parseNum(val('serviceFeeManual')),
    rateBuy: parseNum(val('rateBuy')),
    rateSell: parseNum(val('rateSell')),
    extraCost: parseNum(val('extraCost')),
    customerPaid: parseNum(val('customerPaid')),
    warehousePaid: Boolean(document.getElementById('f_warehousePaid')?.checked),
    partnerPaid: prev && prev.partnerPaid !== undefined ? Boolean(prev.partnerPaid) : true,
    status: val('status') || orderStages[0],
    date: val('date') || dateKey()
  };
}

function updateOrderCalcPreview() {
  const zone = document.getElementById('calcPreviewZone');
  if (!zone) return;
  const draft = readDraftOrderFromForm();
  const m = calcOrderMetrics(draft);

  const vndHint = document.getElementById('vndAutoHint');
  if (vndHint) {
    vndHint.textContent = (draft.goodsCny > 0 && draft.rateSell > 0)
      ? `Tự động quy đổi: ¥${numFmt(draft.goodsCny)} × ${money(draft.rateSell)} = ${money(m.finalGoodsVnd)} ₫`
      : 'Nhập trực tiếp VND nếu đơn không tính theo tệ';
  }

  const posTotal = Math.max(1, Math.max(0, m.shipProfit) + Math.max(0, m.serviceFee) + Math.max(0, m.packProfit) + Math.max(0, m.fxProfit));
  const wShip = Math.round((Math.max(0, m.shipProfit) / posTotal) * 100);
  const wFee = Math.round((Math.max(0, m.serviceFee) / posTotal) * 100);
  const wPack = Math.round((Math.max(0, m.packProfit) / posTotal) * 100);
  const wFx = Math.max(0, 100 - wShip - wFee - wPack);

  zone.innerHTML = `<div class="ai-calc-box ${m.netProfit < 0 ? 'loss' : ''}">
    <div class="ai-calc-top">
      <div>
        <strong style="font-size:13.5px">🤖 Lợi nhuận thực tế đơn này: <span class="${m.netProfit >= 0 ? 'income-color' : 'expense-color'}" style="font-size:17px">${m.netProfit >= 0 ? '+' : ''}${money(m.netProfit)} ₫</span></strong>
      </div>
      <span style="font-size:12px;color:var(--muted)">Phải thu khách: <b>${money(m.totalCollectCustomer)} ₫</b>${m.extraShipTotal > 0 ? ` (gồm Cước ship phát sinh +${money(m.extraShipTotal)} ₫)` : ''} · ${m.customerDebt > 0 ? `<b class="expense-color">Còn nợ ${money(m.customerDebt)} ₫</b>` : m.totalCollectCustomer > 0 ? '<b class="income-color">✓ Đã thu đủ</b>' : '<span>Chưa phát sinh phải thu</span>'}</span>
    </div>
    <div class="pipeline-track" style="height:8px">
      <div style="width:${wShip}%;background:#20a8d8"></div>
      <div style="width:${wFee}%;background:#4dbd74"></div>
      <div style="width:${wPack}%;background:#f86c6b"></div>
      <div style="width:${wFx}%;background:#f8cb00"></div>
    </div>
    <div class="ai-calc-metrics">
      <div class="ai-mini">
        <span>Giá cuối SP</span>
        <b>${money(m.finalGoodsVnd)} ₫</b>
      </div>
      <div class="ai-mini">
        <span>🔵 Lãi cước VC</span>
        <b class="${m.shipProfit >= 0 ? 'blue-color' : 'expense-color'}">${m.shipProfit >= 0 ? '+' : ''}${money(m.shipProfit)} ₫</b>
      </div>
      <div class="ai-mini">
        <span>🟢 Phí DV (${numFmt(draft.serviceFeePct)}%)</span>
        <b class="income-color">+${money(m.serviceFee)} ₫</b>
      </div>
      <div class="ai-mini">
        <span>🪵 Lãi đóng gói</span>
        <b class="${m.packProfit >= 0 ? 'income-color' : 'expense-color'}">${m.packProfit >= 0 ? '+' : ''}${money(m.packProfit)} ₫</b>
      </div>
      <div class="ai-mini">
        <span>🟡 Lãi tỷ giá tệ</span>
        <b class="amber-color">${m.fxProfit >= 0 ? '+' : ''}${money(m.fxProfit)} ₫</b>
      </div>
    </div>
  </div>`;
}

// Tự động tính giá vốn mỗi lần sử dụng (VD: 1 cuộn chống sốc 105.000đ / 20 lần = 5.250đ) và preview lãi đóng gói
function recalcBulkUnitCost() {
  const bulk = parseNum(val('bulkCost'));
  const uses = parseNum(val('usesPerBulk'));
  if (bulk > 0 && uses > 0) {
    const unitCost = Math.round(bulk / uses);
    const costInp = document.getElementById('f_costPrice');
    if (costInp) costInp.value = String(unitCost);
  }
  updatePackItemCalcPreview();
}

function updatePackItemCalcPreview() {
  const zone = document.getElementById('calcPreviewZone');
  if (!zone) return;
  const costPrice = Math.round(parseNum(val('costPrice')));
  const sellPrice = Math.round(parseNum(val('sellPrice')));
  const qty = Math.max(0, parseNum(val('qty')));
  const unitProfit = sellPrice - costPrice;
  const totalCost = Math.round(costPrice * qty);
  const totalRevenue = Math.round(sellPrice * qty);
  const totalProfit = totalRevenue - totalCost;

  zone.innerHTML = `<div class="ai-calc-box ${totalProfit < 0 ? 'loss' : ''}">
    <div class="ai-calc-top">
      <strong style="font-size:13.5px">🪵 Tự động tính Lợi nhuận Đóng gói: <span class="${totalProfit >= 0 ? 'income-color' : 'expense-color'}" style="font-size:17px">${totalProfit >= 0 ? '+' : ''}${money(totalProfit)} ₫</span></strong>
      <span style="font-size:12px;color:var(--muted)">Công thức: Lãi đơn vị = Giá bán − Giá nhập · Tổng lãi = Tổng doanh thu − Tổng giá vốn</span>
    </div>
    <div class="ai-calc-metrics" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      <div class="ai-mini">
        <span>Lãi đơn vị</span>
        <b class="${unitProfit >= 0 ? 'income-color' : 'expense-color'}">${unitProfit >= 0 ? '+' : ''}${money(unitProfit)} ₫</b>
      </div>
      <div class="ai-mini">
        <span>Tổng giá vốn (${numFmt(qty)})</span>
        <b>${money(totalCost)} ₫</b>
      </div>
      <div class="ai-mini">
        <span>Tổng doanh thu (${numFmt(qty)})</span>
        <b class="blue-color">${money(totalRevenue)} ₫</b>
      </div>
      <div class="ai-mini">
        <span>Tổng lợi nhuận</span>
        <b class="${totalProfit >= 0 ? 'income-color' : 'expense-color'}">${totalProfit >= 0 ? '+' : ''}${money(totalProfit)} ₫</b>
      </div>
    </div>
  </div>`;
}

function onSelectExtraShipOrder(orderId) {
  const ord = (db.orderNotes || []).find(x => x.id === orderId);
  if (!ord) return;
  const codeInp = document.getElementById('f_orderCode');
  const custInp = document.getElementById('f_customer');
  if (codeInp) codeInp.value = ord.code || ord.id;
  if (custInp) custInp.value = ord.customer || '';
}

function renderFields(kind, o) {
  if (kind === 'order') {
    const line = o.lineType || 'Xách tay';
    const currentPlat = normalizePlatformName(o.platform || '');
    const pkg = o.packages ?? 1;
    showCnyBox = Boolean(parseNum(o.goodsCny) > 0 || ['Thanh toán hộ', 'Mua hộ trọn gói'].includes(line));
    draftOrderPackItems = Array.isArray(o.packagingItems) ? o.packagingItems.map(x => ({ ...x })) : [];

    const lineChoices = [
      { val: 'Xách tay', label: '✈️ Xách tay' },
      { val: 'Thanh toán hộ', label: '💴 Thanh toán hộ' },
      { val: 'Ký gửi kho', label: '📦 Ký gửi kho' },
      { val: 'Mua hộ trọn gói', label: '🛍 Mua hộ trọn gói' }
    ];

    const catalogOpts = (db.packagingCatalog || []).length
      ? (db.packagingCatalog || []).map(item => {
          const catLabel = item.category === 'wood' ? '🪵 Hộp gỗ' : item.category === 'carton' ? '📦 Carton' : '🫧 Chống sốc';
          return `<option value="${esc(item.id)}">${catLabel}: ${esc(item.name)} (Vốn ${money(item.costPrice)}đ → Bán ${money(item.sellPrice)}đ / ${esc(item.unit || 'Cái')})</option>`;
        }).join('')
      : `<option value="">-- Chưa có vật tư trong danh mục (Thêm ở Chi phí phát sinh hoặc nhập tay bên dưới) --</option>`;

    document.getElementById('formFields').innerHTML = `
      <input type="hidden" id="f_lineType" value="${esc(line)}">
      <input type="hidden" id="f_code" value="${esc(o.code || '')}">
      <input type="hidden" id="f_waybill" value="${esc(o.waybill || '')}">
      <input type="hidden" id="f_sourcePurchaseId" value="${esc(o.sourcePurchaseId || '')}">
      <input type="hidden" id="f_sourceShipmentId" value="${esc(o.sourceShipmentId || '')}">
      <div class="line-selector" role="group" aria-label="Chọn loại Line">
        ${lineChoices.map(c => `<button type="button" class="line-opt ${line === c.val ? 'active' : ''}" data-line="${esc(c.val)}" onclick="selectLineType('${esc(c.val)}')">${c.label}</button>`).join('')}
      </div>

      <div class="form-card">
        <div class="form-card-title">
          <span>1. Khách hàng & Kiện hàng</span>
        </div>
        ${field('customer', 'Tên khách hàng', o.customer || '', 'text', true, false, 'Ví dụ: Nguyễn Văn A', 'list="customerSuggestions" onchange="autofillCustomerInfo(this.value)"')}
        <div>
          <label for="f_packages">Số kiện *</label>
          <div class="pkg-row">
            ${[1, 2, 3, 4].map(n => `<button type="button" class="pkg-btn ${Number(pkg) === n ? 'active' : ''}" data-pkg="${n}" onclick="setPkgCount(${n})">${n}</button>`).join('')}
            <input id="f_packages" class="field" type="text" inputmode="numeric" value="${esc(pkg)}" oninput="syncPkgButtons(this.value)" style="width:68px;text-align:center" placeholder="Khác">
          </div>
        </div>
        ${selectField('goodsType', 'Loại hàng hoá', goodsTypes, o.goodsType || goodsTypes[0])}
        ${field('product', 'Tên mặt hàng / Mã vận đơn phụ', o.product || '', 'text', false, false, 'Ví dụ: Áo khoác, Máy mài…')}
        ${field('phone', 'Số điện thoại khách', o.phone || '', 'tel', false, false, '09xx xxx xxx')}
        ${field('date', 'Ngày đơn hàng', o.date || dateKey(), 'date', true)}
        <div class="full">
          <label>Mua ở App / Sàn nào (Bấm chọn nhanh để phân biệt đơn từ shop nào)</label>
          <input type="hidden" id="f_platform" value="${esc(currentPlat)}">
          <div class="shop-picker" role="group" aria-label="Chọn app mua hàng">
            ${shopPlatforms.map(p => `<button type="button" class="shop-opt ${currentPlat === p ? 'active' : ''}" data-shop="${esc(p)}" onclick="selectOrderPlatform('${esc(p)}')">${esc(p)}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="form-card">
        <div class="form-card-title">
          <span>2. Giá trị hàng hoá & Phí dịch vụ</span>
          <button type="button" class="link-btn" id="toggleCnyBtn" onclick="toggleCnyBox()">${showCnyBox ? '▾ Đang bật quy đổi Tệ (CNY)' : '＋ Quy đổi Nhân dân tệ (CNY) & tính lãi tỷ giá'}</button>
        </div>

        <div id="cnyExchangeBox" class="cny-box ${showCnyBox ? '' : 'hidden'}">
          ${field('goodsCny', 'Số Tệ (CNY - ¥)', o.goodsCny ?? '', 'decimal', false, false, 'VD: 1000')}
          ${field('rateBuy', 'Tỷ giá tệ thu / gốc (₫)', o.rateBuy ?? '', 'decimal', false, false, 'VD: 3550')}
          ${field('rateSell', 'Tỷ giá tệ bán / báo khách (₫)', o.rateSell ?? '', 'decimal', false, false, 'VD: 3650')}
        </div>

        <div>
          <label for="f_goodsVndInput">Giá trị hàng hoá (VND - ₫)</label>
          <input id="f_goodsVndInput" class="field" type="text" inputmode="decimal" value="${esc(o.goodsVndInput || '')}" placeholder="Tự tính nếu đã nhập Tệ">
          <span class="field-hint" id="vndAutoHint">Nhập trực tiếp VND nếu đơn không tính theo tệ</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${field('serviceFeePct', 'Phí DV (% giá SP)', o.serviceFeePct ?? 0, 'decimal', false, false, 'VD: 3')}
          ${field('serviceFeeManual', 'Hoặc Phí cố định (₫)', o.serviceFeeManual || '', 'money', false, false, 'Khi % = 0')}
        </div>
      </div>

      <div class="form-card">
        <div class="form-card-title">
          <span>3. Cước vận chuyển, Vật tư Đóng gói & Thanh toán</span>
        </div>
        ${field('shipCost', 'Cước vận chuyển gốc trả kho (₫)', o.shipCost ?? '', 'money', false, false, 'VD: 120000')}
        ${field('shipCharge', 'Cước vận chuyển thu khách (₫) — tính riêng', o.shipCharge ?? '', 'money', false, false, 'VD: 180000 (tách riêng, không gộp vào nợ khách)')}

        <div class="order-pack-zone">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px">
            <strong style="font-size:12.5px">🪵 Ghi nhận vật tư đóng gói trực tiếp vào đơn hàng (Tự lưu cứng giá nhập & giá bán lúc phát sinh)</strong>
          </div>
          <div class="order-pack-picker">
            <div>
              <label for="f_pickPackCatalogId">Chọn vật tư đóng gói (Hộp gỗ / Carton / Chống sốc)</label>
              <select id="f_pickPackCatalogId" class="select">${catalogOpts}</select>
            </div>
            <div>
              <label for="f_pickPackQty">Số lượng</label>
              <input id="f_pickPackQty" class="field" type="text" inputmode="decimal" value="1">
            </div>
            <button type="button" class="btn primary" onclick="addDraftOrderPackItem()">＋ Gắn vào đơn</button>
          </div>
          <div id="orderPackListZone"></div>
        </div>

        <div class="pack-box">
          ${selectField('packagingType', 'Nhãn đóng gói chính', packagingTypes, o.packagingType || packagingTypes[0], false, 'updateOrderCalcPreview()')}
          ${field('packCost', 'Tổng giá vốn đóng gói (₫)', o.packCost ?? '', 'money', false, false, 'Tự tính khi gắn vật tư')}
          ${field('packCharge', 'Tổng tiền đóng gói thu khách (₫)', o.packCharge ?? '', 'money', false, false, 'Tự tính khi gắn vật tư')}
        </div>

        <div>
          <label for="f_customerPaid">Tiền khách đã thanh toán (₫)</label>
          <div class="input-with-btn">
            <input id="f_customerPaid" class="field" type="text" inputmode="decimal" value="${esc(o.customerPaid ?? '')}" placeholder="0 (hoặc số tiền khách cọc)">
            <button type="button" class="btn small primary" onclick="fillFullCustomerPay()">Thu đủ</button>
          </div>
        </div>
        ${field('extraCost', 'Chi phí phát sinh nội bộ (₫)', o.extraCost || '', 'money', false, false, 'Phụ phí nội bộ nếu có…')}

        <div class="check-pills">
          <label class="check-pill">
            <input type="checkbox" id="f_warehousePaid" ${o.warehousePaid ? 'checked' : ''} onchange="updateOrderCalcPreview()">
            <span>✓ Đã trả cước kho</span>
          </label>
        </div>

        ${selectField('status', 'Trạng thái đơn hàng', orderStages, o.status || orderStages[0], true)}
        <div class="full">
          <label for="f_note">Ghi chú (Tự động gắn [Giờ:Phút - Ngày/Tháng/Năm] ở cuối khi lưu)</label>
          <textarea id="f_note" class="field" placeholder="Nhập ghi chú đơn hàng…">${esc(o.note || '')}</textarea>
        </div>
      </div>
    `;
    renderDraftOrderPackList();
    return;
  }

  if (kind === 'extraship') {
    const orderChoices = (db.orderNotes || []).filter(x => x.status !== 'Đã hủy');
    document.getElementById('formFields').innerHTML = `
      <div class="full">
        <label for="f_orderId">Liên kết với đơn hàng hiện có (Tùy chọn — tự điền Mã đơn & Tên khách)</label>
        <select id="f_orderId" class="select" onchange="onSelectExtraShipOrder(this.value)">
          <option value="">-- Chọn đơn hàng để liên kết hoặc nhập trực tiếp bên dưới --</option>
          ${orderChoices.map(ord => `<option value="${esc(ord.id)}" ${o.orderId === ord.id ? 'selected' : ''}>${esc(ord.code || ord.id)} · ${esc(ord.customer)} (${esc(ord.product || ord.goodsType)})</option>`).join('')}
        </select>
      </div>
      ${field('orderCode', 'Mã đơn hàng', o.orderCode || '', 'text', true, false, 'Ví dụ: DC001, DR0006')}
      ${field('customer', 'Tên khách hàng', o.customer || '', 'text', true, false, 'Ví dụ: Nguyễn Văn A', 'list="customerSuggestions"')}
      ${field('content', 'Nội dung phát sinh', o.content || '', 'text', true, true, 'Ví dụ: Cước ship giao ngoại tỉnh, phụ phí kiện quá khổ…')}
      ${field('amount', 'Số tiền cước ship phát sinh (₫)', o.amount ?? '', 'money', true, false, 'Ví dụ: 50000')}
      ${field('date', 'Ngày phát sinh', o.date || dateKey(), 'date', true)}
      ${selectField('status', 'Trạng thái thanh toán', extraShipStatuses, o.status || 'Chưa thu', false)}
      ${field('paidAmount', 'Số tiền đã thu (₫) (nếu Thu một phần)', o.paidAmount ?? '', 'money', false, false, 'Tự động thu đủ nếu chọn Đã thu')}
      <div class="full" style="font-size:12px;color:var(--muted);background:var(--paper-subtle);padding:8px 11px;border-radius:6px;border:1px solid var(--line-soft)">
        ℹ️ <b>Lưu ý:</b> Đây là khoản tiền khách hàng phải thanh toán thêm (được cộng vào số tiền khách cần trả của đơn hàng liên kết), <b>không phải lợi nhuận mặc định của hệ thống</b>.
      </div>
    `;
    return;
  }

  if (kind === 'packitem') {
    const cat = o.category || (incTab !== 'extraship' ? incTab : 'wood');
    const catChoices = [
      { val: 'wood', label: '🪵 1. Đóng hộp gỗ' },
      { val: 'carton', label: '📦 2. Đóng hộp carton' },
      { val: 'shock', label: '🫧 3. Chống sốc' }
    ];
    document.getElementById('formFields').innerHTML = `
      <div class="full">
        <label for="f_category">Danh mục chi phí đóng gói *</label>
        <select id="f_category" class="select">
          ${catChoices.map(c => `<option value="${c.val}" ${cat === c.val ? 'selected' : ''}>${c.label}</option>`).join('')}
        </select>
      </div>
      ${field('name', 'Tên sản phẩm / Dịch vụ đóng gói', o.name || '', 'text', true, false, 'VD: Hộp gỗ, Carton size M, Chống sốc…')}
      ${field('spec', 'Quy cách hoặc kích thước', o.spec || '', 'text', false, false, 'VD: 40x30x30cm, Cuộn 20 lần dùng…')}
      ${selectField('unit', 'Đơn vị tính', packUnits, o.unit || (cat === 'shock' ? 'Lần sử dụng' : 'Cái'))}
      ${field('qty', 'Số lượng sử dụng', o.qty ?? 1, 'decimal', true, false, 'VD: 1')}

      <div class="bulk-calc-box">
        <div style="grid-column:1/-1;font-size:12px;font-weight:700;color:#0284c7">
          🧮 Công cụ chia giá vốn theo lần sử dụng (Đặc biệt tiện cho Chống sốc: VD 1 cuộn 105.000đ dùng 20 lần = 5.250đ/lần)
        </div>
        ${field('bulkCost', 'Giá mua nguyên cuộn / lô (₫) (nếu có)', o.bulkCost || '', 'money', false, false, 'VD: 105000', 'oninput="recalcBulkUnitCost()"')}
        ${field('usesPerBulk', 'Số lần sử dụng mỗi cuộn', o.usesPerBulk || '', 'decimal', false, false, 'VD: 20', 'oninput="recalcBulkUnitCost()"')}
      </div>

      ${field('costPrice', 'Giá nhập đơn vị (₫)', o.costPrice ?? '', 'money', true, false, 'VD: 50000 (hoặc tự tính từ cuộn)')}
      ${field('sellPrice', 'Giá bán đơn vị thu khách (₫)', o.sellPrice ?? '', 'money', true, false, 'VD: 70000')}
      ${field('date', 'Ngày ghi nhận', o.date || dateKey(), 'date', true)}
      ${field('note', 'Ghi chú thêm', o.note || '', 'text', false, false, 'Ghi chú vật tư…')}
    `;
    return;
  }

  if (kind === 'finance') {
    const cats = ['Phí dịch vụ', 'Phí mua hộ', 'Đóng gói', 'Cước vận chuyển', 'Chi phí phát sinh', 'Tiền mua hàng', 'Hoàn tiền', 'Đi lại', 'Ăn uống', 'Công cụ', 'Khác'];
    document.getElementById('formFields').innerHTML =
      selectField('type', 'Loại giao dịch', ['Thu', 'Chi'], o.type || 'Thu') +
      field('amount', 'Số tiền (₫)', o.amount ?? '', 'money', true, false, 'Ví dụ: 500000 hoặc 500.000') +
      selectField('category', 'Danh mục', cats, o.category || cats[0]) +
      field('date', 'Ngày giao dịch', o.date || dateKey(), 'date', true) +
      field('party', 'Khách hàng / bên nhận', o.party || '', 'text', false, false, 'Tên khách hoặc đối tác', 'list="customerSuggestions"') +
      field('related', 'Liên quan đến đơn', o.related || '', 'text', false, false, 'Mã DR hoặc tên hàng') +
      selectField('method', 'Hình thức thanh toán', ['Chuyển khoản', 'Tiền mặt', 'Ví điện tử', 'Khác'], o.method || 'Chuyển khoản', true) +
      `<div class="full"><label for="f_note">Ghi chú (Tự gắn giờ & ngày tháng năm ở cuối)</label><textarea id="f_note" class="field" placeholder="Nội dung ghi chú thêm">${esc(o.note || '')}</textarea></div>`;
    return;
  }

  let s =
    `<input type="hidden" id="f_sourcePurchaseId" value="${esc(o.sourcePurchaseId || '')}">` +
    field('customer', 'Tên khách hàng', o.customer || '', 'text', true, false, 'Ví dụ: Minh Anh', 'list="customerSuggestions" onchange="autofillCustomerInfo(this.value)"') +
    field('phone', 'Số điện thoại', o.phone || '', 'tel', false, false, '09xx xxx xxx') +
    field('code', 'Mã khách hàng', o.code || '', 'text', false, false, 'Tự gắn mã khách cũ hoặc tạo DR mới') +
    selectField('platform', 'Mua ở App / Sàn nào', shopPlatforms, normalizePlatformName(o.platform) || 'TAOBAO') +
    field('address', 'Địa chỉ nhận hàng', o.address || '', 'text', false, true, 'Địa chỉ giao hàng tại Việt Nam');

  if (kind === 'shipment') {
    s +=
      field('waybill', 'Mã vận đơn Trung Quốc', o.waybill || '', 'text', true, false, 'SF..., YT..., ZTO...') +
      field('product', 'Tên sản phẩm', o.product || '', 'text', true, false, 'Ví dụ: Áo khoác dạ') +
      field('qty', 'Số lượng kiện', o.qty ?? 1, 'decimal') +
      field('value', 'Giá trị hàng (¥)', o.value ?? '', 'decimal', false, false, 'Ví dụ: 168.5') +
      selectField('packagingType', '🪵 Quy cách đóng gói', packagingTypes, o.packagingType || packagingTypes[0]) +
      field('packCharge', 'Phí đóng gói dự kiến (₫)', o.packCharge ?? '', 'money', false, false, 'VD: 50000') +
      field('appOrder', 'Mã đơn trên sàn (nếu có)', o.appOrder || '', 'text') +
      field('image', 'Link ảnh sản phẩm', o.image || '', 'text', false, false, 'https://...') +
      selectField('status', 'Trạng thái vận chuyển', shipStages, o.status || shipStages[0], true) +
      `<div class="full"><label for="f_note">Ghi chú nội bộ (Tự gắn giờ & ngày tháng năm ở cuối)</label><textarea id="f_note" class="field" placeholder="Yêu cầu đóng gói, lưu ý giao hàng…">${esc(o.note || '')}</textarea></div>`;
  } else {
    s +=
      field('url', 'Link sản phẩm cần mua (hoặc dán mã chia sẻ Taobao)', o.url || '', 'text', false, true, 'https://... (có thể bổ sung sau)') +
      field('product', 'Tên sản phẩm', o.product || '', 'text', true, false, 'Ví dụ: Giày thể thao') +
      field('variant', 'Phân loại (màu, size)', o.variant || '', 'text', false, false, 'Màu trắng · Size 42') +
      field('qty', 'Số lượng', o.qty ?? 1, 'decimal') +
      field('value', 'Giá trên sàn (¥)', o.value ?? '', 'decimal', false, false, 'Ví dụ: 138.5') +
      field('quote', 'Giá báo khách (¥)', o.quote ?? '', 'decimal', false, false, 'Nhập khi báo giá') +
      field('image', 'Link ảnh sản phẩm', o.image || '', 'text', false, false, 'https://...') +
      selectField('status', 'Trạng thái yêu cầu', buyStages, o.status || buyStages[0], true) +
      `<div class="full"><label for="f_note">Ghi chú / yêu cầu riêng (Tự gắn giờ & ngày tháng năm ở cuối)</label><textarea id="f_note" class="field" placeholder="Lưu ý về thời gian nhận, kiểm hàng…">${esc(o.note || '')}</textarea></div>`;
  }
  document.getElementById('formFields').innerHTML = s;
}

function val(id) {
  return String(document.getElementById('f_' + id)?.value ?? '').trim();
}

function nextCustomerCode() {
  const nums = [...(db.orderNotes || []), ...(db.shipments || []), ...(db.purchases || [])].map(o => Number((o.code || '').match(/^DR(\d+)$/i)?.[1] || 0));
  return 'DR' + String(Math.max(0, ...nums) + 1).padStart(4, '0');
}

function describeOrderChanges(prev, next) {
  if (!prev) return `Tạo mới đơn ${next.lineType} (${next.packages} kiện) · Lãi dự kiến ${money(calcOrderMetrics(next).netProfit)} ₫`;
  const diffs = [];
  if (prev.lineType !== next.lineType) diffs.push(`Line: ${prev.lineType} → ${next.lineType}`);
  if ((prev.platform || '') !== (next.platform || '')) diffs.push(`Sàn: ${prev.platform || '—'} → ${next.platform || '—'}`);
  if (prev.packages !== next.packages) diffs.push(`Số kiện: ${prev.packages} → ${next.packages}`);
  if (prev.status !== next.status) diffs.push(`Trạng thái: ${prev.status} → ${next.status}`);
  if (prev.shipCharge !== next.shipCharge || prev.shipCost !== next.shipCost) diffs.push(`Cước (Gốc ${money(next.shipCost)} / Thu ${money(next.shipCharge)} ₫)`);
  if ((prev.packagingType || '') !== (next.packagingType || '') || prev.packCharge !== next.packCharge) diffs.push(`Đóng gói: ${next.packagingType} (+${money(next.packCharge)} ₫)`);
  if (prev.rateBuy !== next.rateBuy || prev.rateSell !== next.rateSell || prev.goodsCny !== next.goodsCny) diffs.push('Tệ/Tỷ giá cập nhật');
  if (prev.customerPaid !== next.customerPaid) diffs.push(`Khách trả: ${money(prev.customerPaid)} → ${money(next.customerPaid)} ₫`);
  if (prev.warehousePaid !== next.warehousePaid) diffs.push(next.warehousePaid ? 'Đã trả kho' : 'Chưa trả kho');
  if ((prev.note || '') !== (next.note || '')) diffs.push('Cập nhật ghi chú');
  return diffs.length ? diffs.join(' · ') : 'Lưu cập nhật thông tin đơn';
}

function saveRecord(e) {
  e.preventDefault();
  hideFormError();
  const form = e.currentTarget;
  const kind = form.dataset.kind;
  if (kind === 'role_info') {
    closeModal();
    return;
  }
  if (kind === 'sync_config') {
    saveSyncSettingsFromModal();
    return;
  }
  const id = form.dataset.id;
  const stamp = nowStamp();
  const stampFull = nowStamp(true);
  const nowMs = Date.now();

  if (kind === 'extraship') {
    const orderCode = val('orderCode');
    const customer = val('customer');
    const content = val('content');
    const amount = Math.round(parseNum(val('amount')));
    if (!orderCode) {
      showFormError('Vui lòng nhập Mã đơn hàng.', 'orderCode');
      return;
    }
    if (!customer) {
      showFormError('Vui lòng nhập Tên khách hàng.', 'customer');
      return;
    }
    if (!content) {
      showFormError('Vui lòng nhập Nội dung phát sinh.', 'content');
      return;
    }
    if (amount <= 0) {
      showFormError('Vui lòng nhập Số tiền lớn hơn 0.', 'amount');
      return;
    }
    if (!Array.isArray(db.extraShipments)) db.extraShipments = [];
    const prev = db.extraShipments.find(x => x.id === id);
    const status = val('status') || 'Chưa thu';
    const rawPaid = Math.round(parseNum(val('paidAmount')));
    const paidAmount = status === 'Đã thu' ? amount : status === 'Chưa thu' ? 0 : Math.min(amount, Math.max(0, rawPaid));
    const history = Array.isArray(prev?.history) ? [...prev.history] : [];

    const item = {
      id: id || makeId(),
      orderId: val('orderId') || prev?.orderId || '',
      orderCode,
      customer,
      content,
      amount,
      paidAmount,
      date: val('date') || dateKey(),
      status,
      updatedAt: stamp,
      updatedAtMs: nowMs,
      history
    };
    const detail = `${item.orderCode} · ${item.customer}: ${money(item.amount)} ₫ (${item.status})`;
    item.history.unshift({ time: stampFull, action: prev ? 'Chỉnh sửa' : 'Tạo mới', detail });
    addAuditLog(prev ? 'Sửa cước ship phát sinh' : 'Thêm cước ship phát sinh', `${item.customer} (${item.orderCode})`, detail);

    const prevPaid = prev ? getExtraCurrentPaid(prev) : 0;
    const nextPaid = getExtraCurrentPaid(item);
    if (!prev && nextPaid > 0) {
      recordPaymentEvent({
        kind: 'extraship', extraShipId: item.id, orderId: item.orderId, orderCode: item.orderCode,
        customer: item.customer, amount: nextPaid, date: item.date, originDate: item.date,
        note: `Thu cước ship PS: ${item.content}`
      });
    } else if (prev && nextPaid > prevPaid) {
      recordPaymentEvent({
        kind: 'extraship', extraShipId: item.id, orderId: item.orderId, orderCode: item.orderCode,
        customer: item.customer, amount: nextPaid - prevPaid, date: dateKey(), originDate: item.date,
        note: `Thu thêm cước ship PS: ${item.content}`
      });
    } else if (prev && nextPaid < prevPaid) {
      reducePaymentEvents('extraship', item.id, prevPaid - nextPaid);
    }

    if (!prev || prev.amount !== item.amount || prev.date !== item.date || prev.content !== item.content) {
      recordClosedPeriodAdjustment(item.date, prev ? 'Sửa cước ship PS kỳ đã chốt' : 'Bổ sung cước ship PS vào kỳ đã chốt', `${item.customer} (${item.orderCode})`, detail);
    }

    db.extraShipments = prev ? db.extraShipments.map(x => x.id === id ? item : x) : [item, ...db.extraShipments];
    if (!persist()) return;
    closeModal();
    render();
    toast(`✓ Đã lưu Cước ship phát sinh (${stamp})`);
    return;
  }

  if (kind === 'packitem') {
    const name = val('name');
    const costPrice = Math.round(parseNum(val('costPrice')));
    const sellPrice = Math.round(parseNum(val('sellPrice')));
    if (!name) {
      showFormError('Vui lòng nhập Tên sản phẩm đóng gói.', 'name');
      return;
    }
    if (costPrice < 0 || sellPrice <= 0) {
      showFormError('Vui lòng nhập Giá bán lớn hơn 0.', 'sellPrice');
      return;
    }
    if (!Array.isArray(db.packagingCatalog)) db.packagingCatalog = [];
    const prev = db.packagingCatalog.find(x => x.id === id);
    const history = Array.isArray(prev?.history) ? [...prev.history] : [];
    const category = val('category') || 'wood';

    const item = {
      id: id || makeId(),
      category,
      name,
      spec: val('spec'),
      unit: val('unit') || 'Cái',
      bulkCost: Math.round(parseNum(val('bulkCost'))),
      usesPerBulk: parseNum(val('usesPerBulk')) || 1,
      costPrice,
      sellPrice,
      qty: Math.max(0, parseNum(val('qty'))),
      date: val('date') || dateKey(),
      note: stampNote(val('note'), prev?.note || ''),
      updatedAt: stamp,
      updatedAtMs: nowMs,
      history
    };
    const unitProf = item.sellPrice - item.costPrice;
    const detail = `Giá nhập ${money(item.costPrice)} ₫ · Giá bán ${money(item.sellPrice)} ₫ · Lãi ĐV +${money(unitProf)} ₫ · SL ${numFmt(item.qty)}`;
    item.history.unshift({ time: stampFull, action: prev ? 'Chỉnh sửa' : 'Tạo mới', detail });
    addAuditLog(prev ? 'Sửa SP đóng gói' : 'Thêm SP đóng gói', item.name, detail);
    recordClosedPeriodAdjustment(item.date, prev ? 'Sửa vật tư đóng gói kỳ đã chốt' : 'Thêm vật tư đóng gói vào kỳ đã chốt', item.name, detail);

    db.packagingCatalog = prev ? db.packagingCatalog.map(x => x.id === id ? item : x) : [item, ...db.packagingCatalog];
    incTab = category;
    if (!persist()) return;
    closeModal();
    render();
    toast(`✓ Đã lưu sản phẩm đóng gói (${stamp})`);
    return;
  }

  if (kind === 'order') {
    const customer = val('customer');
    if (!customer) {
      showFormError('Vui lòng nhập Tên khách hàng trước khi lưu.', 'customer');
      return;
    }
    if (!Array.isArray(db.orderNotes)) db.orderNotes = [];
    const prev = db.orderNotes.find(x => x.id === id);
    const draft = readDraftOrderFromForm();
    const stampedNote = stampNote(val('note'), prev?.note || '');
    const history = Array.isArray(prev?.history) ? [...prev.history] : [];

    const existingCust = findExistingCustomer(customer, draft.phone, draft.code);
    const item = {
      ...draft,
      id: id || makeId(),
      phone: draft.phone || prev?.phone || existingCust?.phone || '',
      code: draft.code || prev?.code || existingCust?.code || nextCustomerCode(),
      waybill: draft.waybill || prev?.waybill || '',
      sourcePurchaseId: draft.sourcePurchaseId || prev?.sourcePurchaseId || '',
      sourceShipmentId: draft.sourceShipmentId || prev?.sourceShipmentId || '',
      warehousePaidDate: (!prev?.warehousePaid && draft.warehousePaid) ? (prev ? dateKey() : (draft.date || dateKey())) : (draft.warehousePaid ? (prev?.warehousePaidDate || '') : ''),
      note: stampedNote,
      updatedAt: stamp,
      updatedAtMs: nowMs,
      history
    };
    const changeDesc = describeOrderChanges(prev, item);
    item.history.unshift({ time: stampFull, action: prev ? 'Chỉnh sửa' : 'Tạo mới', detail: changeDesc });
    addAuditLog(prev ? 'Sửa Note đơn' : 'Thêm Note đơn', `${item.customer} · ${item.product || item.goodsType}`, changeDesc);

    const prevPaid = prev ? Math.round(parseNum(prev.customerPaid)) : 0;
    const nextPaid = Math.round(parseNum(item.customerPaid));
    if (!prev && nextPaid > 0) {
      recordPaymentEvent({
        kind: 'order', orderId: item.id, orderCode: item.code, customer: item.customer,
        amount: nextPaid, date: item.date, originDate: item.date,
        note: `Thanh toán lúc tạo đơn ${item.product || item.goodsType || ''}`
      });
    } else if (prev && nextPaid > prevPaid) {
      recordPaymentEvent({
        kind: 'order', orderId: item.id, orderCode: item.code, customer: item.customer,
        amount: nextPaid - prevPaid, date: dateKey(), originDate: item.date,
        note: `Khách thanh toán thêm đơn ${item.product || item.goodsType || item.code || ''}`
      });
    } else if (prev && nextPaid < prevPaid) {
      reducePaymentEvents('order', item.id, prevPaid - nextPaid);
    }

    const financialEdited = !prev ||
      prev.shipCost !== item.shipCost || prev.shipCharge !== item.shipCharge ||
      prev.packCost !== item.packCost || prev.packCharge !== item.packCharge ||
      prev.goodsCny !== item.goodsCny || prev.goodsVndInput !== item.goodsVndInput ||
      prev.rateBuy !== item.rateBuy || prev.rateSell !== item.rateSell ||
      prev.serviceFeePct !== item.serviceFeePct || prev.serviceFeeManual !== item.serviceFeeManual ||
      prev.extraCost !== item.extraCost || prev.date !== item.date;
    if (financialEdited) {
      recordClosedPeriodAdjustment(item.date, prev ? 'Sửa số liệu Note đơn kỳ đã chốt' : 'Bổ sung Note đơn vào kỳ đã chốt', `${item.customer} (${item.code})`, changeDesc);
    }

    db.orderNotes = prev ? db.orderNotes.map(x => x.id === id ? item : x) : [item, ...db.orderNotes];
    if (!persist()) return;
    closeModal();
    render();
    toast(`✓ Đã lưu Note đơn (${stamp})`);
    return;
  }

  if (kind === 'finance') {
    const amount = parseNum(val('amount'));
    if (amount <= 0) {
      showFormError('Vui lòng nhập Số tiền lớn hơn 0.', 'amount');
      return;
    }
    const prev = (db.transactions || []).find(x => x.id === id);
    const stampedNote = stampNote(val('note'), prev?.note || '');
    const history = Array.isArray(prev?.history) ? [...prev.history] : [];
    const item = {
      id: id || makeId(),
      type: val('type') || 'Thu',
      amount: Math.round(amount),
      category: val('category'),
      date: val('date') || dateKey(),
      party: val('party'),
      related: val('related'),
      method: val('method'),
      note: stampedNote,
      updatedAt: stamp,
      updatedAtMs: nowMs,
      history
    };
    const detail = `${item.type} ${money(item.amount)} ₫ (${item.category})${item.party ? ' · ' + item.party : ''}`;
    item.history.unshift({ time: stampFull, action: prev ? 'Chỉnh sửa' : 'Ghi mới', detail });
    addAuditLog(prev ? 'Sửa thu chi' : 'Ghi thu chi', item.category, detail);
    recordClosedPeriodAdjustment(item.date, prev ? 'Sửa giao dịch kỳ đã chốt' : 'Bổ sung giao dịch vào kỳ đã chốt', item.category, detail);

    db.transactions = prev ? db.transactions.map(x => x.id === id ? item : x) : [item, ...(db.transactions || [])];
    if (!persist()) return;
    closeModal();
    render();
    toast(`✓ Đã lưu khoản thu chi (${stamp})`);
    return;
  }

  const customer = val('customer');
  if (!customer) {
    showFormError('Vui lòng nhập Tên khách hàng.', 'customer');
    return;
  }
  if (kind === 'shipment' && !val('waybill')) {
    showFormError('Vui lòng nhập Mã vận đơn Trung Quốc.', 'waybill');
    return;
  }
  if (!val('product')) {
    showFormError('Vui lòng nhập Tên sản phẩm.', 'product');
    return;
  }

  const listKey = kind === 'shipment' ? 'shipments' : 'purchases';
  const prev = (db[listKey] || []).find(o => o.id === id);
  const stampedNote = stampNote(val('note'), prev?.note || '');
  const history = Array.isArray(prev?.history) ? [...prev.history] : [];

  const existingCust = findExistingCustomer(customer, val('phone'), val('code'));
  const o = {
    id: id || makeId(),
    customer,
    phone: val('phone') || prev?.phone || existingCust?.phone || '',
    code: val('code') || prev?.code || existingCust?.code || nextCustomerCode(),
    address: val('address') || prev?.address || existingCust?.address || '',
    platform: val('platform'),
    product: val('product'),
    image: normalizeUrl(val('image')),
    qty: Math.max(1, parseNum(val('qty')) || 1),
    value: parseNum(val('value')),
    status: val('status'),
    note: stampedNote,
    date: prev?.date || dateKey(),
    updatedAt: stamp,
    updatedAtMs: nowMs,
    history
  };

  if (kind === 'shipment') {
    o.waybill = val('waybill');
    o.appOrder = val('appOrder');
    o.packagingType = val('packagingType') || packagingTypes[0];
    o.packCharge = parseNum(val('packCharge'));
    o.sourcePurchaseId = val('sourcePurchaseId') || prev?.sourcePurchaseId || '';
    (db.orderNotes || []).forEach(ord => {
      const sameLink = ord.sourceShipmentId === o.id || (o.sourcePurchaseId && ord.sourcePurchaseId === o.sourcePurchaseId);
      if (sameLink) {
        if (!ord.sourceShipmentId) ord.sourceShipmentId = o.id;
        if (o.waybill && (!ord.waybill || ord.waybill === prev?.waybill)) ord.waybill = o.waybill;
      }
    });
  } else {
    o.url = normalizeUrl(val('url'));
    o.variant = val('variant');
    o.quote = parseNum(val('quote'));
  }

  const detail = prev
    ? `Cập nhật ${o.product} (${o.status})`
    : `Thêm mới ${o.product} (${o.status})`;
  o.history.unshift({ time: stampFull, action: prev ? 'Chỉnh sửa' : 'Tạo mới', detail });
  addAuditLog(prev ? `Sửa ${kind === 'shipment' ? 'vận đơn' : 'mua hộ'}` : `Thêm ${kind === 'shipment' ? 'vận đơn' : 'mua hộ'}`, `${o.customer} · ${o.product}`, detail);

  db[listKey] = prev ? db[listKey].map(x => x.id === id ? o : x) : [o, ...(db[listKey] || [])];
  if (!persist()) return;
  closeModal();
  render();
  toast(`✓ Đã lưu thông tin (${stamp})`);
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
  const key =
    kind === 'order' ? 'orderNotes' :
    kind === 'shipment' ? 'shipments' :
    kind === 'purchase' ? 'purchases' :
    kind === 'extraship' ? 'extraShipments' :
    kind === 'packitem' ? 'packagingCatalog' :
    'transactions';
  const target = (db[key] || []).find(x => x.id === id);
  saveAutoSnapshot(`Trước khi xóa ${target?.customer || target?.name || id}`, true);
  if (target?.date) recordClosedPeriodAdjustment(target.date, 'Xóa bản ghi kỳ đã chốt', target?.customer || target?.name || target?.category || id, `Đã xóa ${target?.product || target?.name || target?.content || target?.category || id}`);
  markDeletedId(id);
  if (kind === 'order') purgePaymentsForDeletedRecord('order', id);
  if (kind === 'extraship') purgePaymentsForDeletedRecord('extraship', id);
  db[key] = (db[key] || []).filter(x => x.id !== id);
  addAuditLog('Xóa bản ghi', target?.customer || target?.name || target?.category || 'Bản ghi', `Đã xóa ${target?.product || target?.name || target?.content || target?.category || id}`);
  persist();
  closeModal();
  render();
  toast(`Đã xóa bản ghi (đã tạo mốc dự phòng · ${nowStamp()})`);
}

function deleteItemDirect(kind, id) {
  const key = kind === 'order' ? 'orderNotes' : kind === 'shipment' ? 'shipments' : 'purchases';
  const item = (db[key] || []).find(x => x.id === id);
  if (!item) return;
  const label =
    kind === 'order' ? `Note đơn "${item.product || item.goodsType}"` :
    kind === 'shipment' ? `vận đơn "${item.waybill} · ${item.product}"` :
    `yêu cầu mua hộ "${item.product}"`;
  if (!confirm(`Bạn có chắc muốn xóa ${label} của khách ${item.customer}?`)) return;
  saveAutoSnapshot(`Trước khi xóa ${item.customer}`, true);
  if (item?.date) recordClosedPeriodAdjustment(item.date, 'Xóa bản ghi kỳ đã chốt', item.customer, `Đã xóa ${label}`);
  markDeletedId(id);
  if (kind === 'order') purgePaymentsForDeletedRecord('order', id);
  db[key] = db[key].filter(x => x.id !== id);
  addAuditLog('Xóa bản ghi', `${item.customer}`, `Đã xóa ${label}`);
  persist();
  render();
  toast(`Đã xóa (đã tạo mốc dự phòng · ${nowStamp()})`);
}

function deleteTransaction(id) {
  const item = (db.transactions || []).find(x => x.id === id);
  const desc = item ? `${item.type} ${money(item.amount)} ₫ (${item.category})` : 'khoản thu chi này';
  if (!confirm(`Xóa ${desc}?`)) return;
  saveAutoSnapshot(`Trước khi xóa thu chi`, true);
  if (item?.date) recordClosedPeriodAdjustment(item.date, 'Xóa thu chi kỳ đã chốt', item?.category || 'Thu chi', `Đã xóa ${desc}`);
  markDeletedId(id);
  db.transactions = db.transactions.filter(x => x.id !== id);
  addAuditLog('Xóa thu chi', item?.category || 'Thu chi', `Đã xóa ${desc}`);
  persist();
  render();
  toast(`Đã xóa khoản thu chi (đã tạo mốc dự phòng · ${nowStamp()})`);
}

function toast(s) {
  const t = document.getElementById('toast');
  t.textContent = s;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

function exportData() {
  const blob = new Blob([JSON.stringify({ system: 'DAIRYCOW LOGISTICS', version: 2, exportedAt: nowStamp(true), ...db }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dairycow-logistics-backup-${dateKey()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
  toast('↓ Đã tải tệp sao lưu DAIRYCOW LOGISTICS');
}

function importData(e, mergeMode = false) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      let d = JSON.parse(r.result);
      if (Array.isArray(d)) d = { orderNotes: [], shipments: d, purchases: [], transactions: [], logs: [] };
      if (!Array.isArray(d.shipments) && !Array.isArray(d.orderNotes)) throw Error();
      const inDel = (d.deletedIds && typeof d.deletedIds === 'object') ? d.deletedIds : {};
      const nextDb = {
        orderNotes: filterOutDeleted(d.orderNotes, inDel),
        shipments: filterOutDeleted(d.shipments, inDel),
        purchases: filterOutDeleted(d.purchases, inDel),
        transactions: filterOutDeleted(d.transactions, inDel),
        extraShipments: filterOutDeleted(d.extraShipments, inDel),
        packagingCatalog: resolvePackagingCatalog(d.packagingCatalog, inDel, Boolean(d._catalogInitialized || Array.isArray(d.packagingCatalog))),
        logs: Array.isArray(d.logs) ? d.logs : [],
        paymentRecords: filterOutDeleted(d.paymentRecords, inDel),
        businessPeriods: Array.isArray(d.businessPeriods) ? d.businessPeriods : [],
        deletedIds: inDel,
        _catalogInitialized: true,
        _userModified: true
      };
      if (mergeMode) {
        if (confirm(`Gộp thêm an toàn ${nextDb.orderNotes.length} Note đơn, ${nextDb.shipments.length} vận đơn, ${nextDb.purchases.length} đơn mua hộ từ tệp JSON? Dữ liệu hiện tại KHÔNG bị xóa.`)) {
          saveAutoSnapshot('Trước khi gộp tệp JSON', true);
          db = smartMergeDB(db, nextDb, { ignoreDeletes: true });
          reconcileBusinessPeriods(undefined, { skipPersist: true, silent: true });
          addAuditLog('Gộp dữ liệu JSON', 'Hệ thống', `Gộp an toàn tệp JSON (${nextDb.orderNotes.length} Note đơn, ${nextDb.shipments.length} vận đơn)`);
          persist();
          render();
          toast('✓ Đã gộp dữ liệu an toàn (không mất dữ liệu cũ)');
        }
      } else {
        if (confirm(`Khôi phục ${nextDb.orderNotes.length} Note đơn, ${nextDb.shipments.length} vận đơn, ${nextDb.purchases.length} đơn mua hộ và ${nextDb.transactions.length} giao dịch?\n\nHệ thống sẽ tự động chụp 1 bản dự phòng dữ liệu hiện tại trước khi khôi phục.`)) {
          saveAutoSnapshot('Trước khi khôi phục tệp JSON', true);
          db = nextDb;
          reconcileBusinessPeriods(undefined, { skipPersist: true, silent: true });
          addAuditLog('Khôi phục dữ liệu', 'Hệ thống', `Nhập tệp JSON (${nextDb.orderNotes.length} Note đơn, ${nextDb.shipments.length} vận đơn)`);
          persist();
          render();
          toast('✓ Đã khôi phục dữ liệu thành công');
        }
      }
    } catch {
      alert('Tệp không đúng định dạng bản sao lưu JSON của ứng dụng.');
    }
    e.target.value = '';
  };
  r.readAsText(f);
}

/* ============================================================
   HỆ THỐNG ĐỒNG BỘ 2 CHIỀU (FIREBASE REST) & CHỐNG MẤT DỮ LIỆU
   Nguyên tắc: KHÔNG BAO GIỜ tự xóa dữ liệu người dùng.
   ============================================================ */
function markDeletedId(id) {
  if (!id) return;
  if (!db.deletedIds || typeof db.deletedIds !== 'object') db.deletedIds = {};
  db.deletedIds[id] = Date.now();
}

function loadSyncConfig() {
  try {
    const raw = localStorage.getItem(SYNC_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        url: String(parsed.url || '').trim(),
        room: String(parsed.room || 'dairycow-main').trim() || 'dairycow-main',
        autoSync: parsed.autoSync !== false,
        lastSyncAt: String(parsed.lastSyncAt || '')
      };
    }
  } catch {}
  return { url: '', room: 'dairycow-main', autoSync: true, lastSyncAt: '' };
}

function saveSyncConfig(cfg) {
  try {
    localStorage.setItem(SYNC_KEY, JSON.stringify(cfg));
  } catch {}
  updateSyncBadge();
}

function cleanFirebaseUrl(url) {
  let u = String(url || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  u = u.replace(/\/+$/, '');
  u = u.replace(/\.json$/i, '');
  return u;
}

function cleanRoomId(room) {
  return String(room || 'dairycow-main')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'dairycow-main';
}

function dbCounts(d = db) {
  return {
    orderNotes: (d.orderNotes || []).length,
    shipments: (d.shipments || []).length,
    purchases: (d.purchases || []).length,
    transactions: (d.transactions || []).length,
    extraShipments: (d.extraShipments || []).length,
    packagingCatalog: (d.packagingCatalog || []).length
  };
}

function loadAutoSnapshots() {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
  } catch {}
  return [];
}

function saveAutoSnapshot(reason = 'Tự động sao lưu', force = false) {
  const now = Date.now();
  if (!force && now - lastAutoSnapTs < 5 * 60 * 1000) return false;
  lastAutoSnapTs = now;
  try {
    const snaps = loadAutoSnapshots();
    const snapshot = {
      id: 'snap_' + now.toString(36) + Math.random().toString(36).slice(2, 5),
      ts: now,
      time: nowStamp(true),
      reason: String(reason || 'Tự động sao lưu'),
      counts: dbCounts(db),
      data: JSON.parse(JSON.stringify(db))
    };
    const next = [snapshot, ...snaps].slice(0, 10);
    while (next.length > 0) {
      try {
        localStorage.setItem(SNAP_KEY, JSON.stringify(next));
        return true;
      } catch {
        next.pop();
      }
    }
  } catch {}
  return false;
}

function maybeAutoSnapshot(reason = 'Tự động sao lưu định kỳ') {
  saveAutoSnapshot(reason, false);
}

function restoreAutoSnapshot(snapId) {
  const snaps = loadAutoSnapshots();
  const target = snaps.find(s => s.id === snapId);
  if (!target || !target.data) {
    toast('Không tìm thấy bản dự phòng này.');
    return;
  }
  const c = target.counts || dbCounts(target.data);
  if (!confirm(`Khôi phục dữ liệu về mốc "${target.time}" (${target.reason})?\n\n• Note đơn: ${c.orderNotes} · Vận đơn: ${c.shipments} · Mua hộ: ${c.purchases} · Thu chi: ${c.transactions}\n\n(Hệ thống sẽ tự lưu 1 bản dự phòng trạng thái hiện tại trước khi khôi phục.)`)) {
    return;
  }
  saveAutoSnapshot('Trước khi khôi phục mốc cũ', true);
  const d = target.data;
  const snapDel = (d.deletedIds && typeof d.deletedIds === 'object') ? d.deletedIds : {};
  db = {
    orderNotes: filterOutDeleted(d.orderNotes, snapDel),
    shipments: filterOutDeleted(d.shipments, snapDel),
    purchases: filterOutDeleted(d.purchases, snapDel),
    transactions: filterOutDeleted(d.transactions, snapDel),
    extraShipments: filterOutDeleted(d.extraShipments, snapDel),
    packagingCatalog: resolvePackagingCatalog(d.packagingCatalog, snapDel, Boolean(d._catalogInitialized || Array.isArray(d.packagingCatalog))),
    logs: Array.isArray(d.logs) ? d.logs : [],
    paymentRecords: filterOutDeleted(d.paymentRecords, snapDel),
    businessPeriods: Array.isArray(d.businessPeriods) ? d.businessPeriods : [],
    deletedIds: snapDel,
    _catalogInitialized: true,
    _userModified: true
  };
  reconcileBusinessPeriods(undefined, { skipPersist: true, silent: true });
  addAuditLog('Khôi phục mốc dự phòng', 'Hệ thống', `Khôi phục về mốc ${target.time} (${target.reason})`);
  persist({ skipSnapshot: true });
  render();
  if (document.getElementById('modal')?.classList.contains('open')) openSyncModal();
  toast(`✓ Đã khôi phục về mốc ${target.time}`);
}

function isUntouchedSeedDB(candidate) {
  if (!candidate || typeof candidate !== 'object') return false;
  if (candidate._userModified) return false;
  if (candidate.deletedIds && Object.keys(candidate.deletedIds).length > 0) return false;
  if (Array.isArray(candidate.paymentRecords) && candidate.paymentRecords.length > 0) return false;
  const seedOrderIds = new Set(['on1', 'on2']);
  const seedShipIds = new Set(['s1', 's2', 's3']);
  const seedBuyIds = new Set(['p1', 'p2']);
  const seedTxIds = new Set(['t1', 't2']);
  const seedPackIds = new Set(['pk_wood_1', 'pk_carton_1', 'pk_shock_1', 'pk_shock_2']);

  const orders = candidate.orderNotes || [];
  const ships = candidate.shipments || [];
  const buys = candidate.purchases || [];
  const txs = candidate.transactions || [];
  const extras = candidate.extraShipments || [];
  const packs = candidate.packagingCatalog || [];

  if (orders.length !== 2 || ships.length !== 3 || buys.length !== 2 || txs.length !== 2) return false;
  if (extras.length > 0) return false;
  if (orders.some(x => !seedOrderIds.has(x.id) || (x.history && x.history.length > 1) || x.updatedAtMs)) return false;
  if (ships.some(x => !seedShipIds.has(x.id) || (x.history && x.history.length > 0) || x.updatedAtMs)) return false;
  if (buys.some(x => !seedBuyIds.has(x.id) || (x.history && x.history.length > 0) || x.updatedAtMs)) return false;
  if (txs.some(x => !seedTxIds.has(x.id) || (x.history && x.history.length > 0) || x.updatedAtMs)) return false;
  if (packs.some(x => !seedPackIds.has(x.id) || (x.history && x.history.length > 0) || x.updatedAtMs)) return false;
  return true;
}

function normalizeIncomingDB(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const toArr = v => Array.isArray(v) ? v.filter(Boolean) : (v && typeof v === 'object' ? Object.values(v).filter(Boolean) : []);
  return {
    orderNotes: toArr(raw.orderNotes),
    shipments: toArr(raw.shipments),
    purchases: toArr(raw.purchases),
    transactions: toArr(raw.transactions),
    extraShipments: toArr(raw.extraShipments),
    packagingCatalog: toArr(raw.packagingCatalog),
    logs: toArr(raw.logs),
    paymentRecords: toArr(raw.paymentRecords),
    businessPeriods: toArr(raw.businessPeriods),
    deletedIds: (raw.deletedIds && typeof raw.deletedIds === 'object') ? { ...raw.deletedIds } : {}
  };
}

function smartMergeDB(localDb, remoteRaw, opts = {}) {
  const remoteDb = normalizeIncomingDB(remoteRaw);
  if (!remoteDb) return localDb;

  const remoteHasData =
    remoteDb.orderNotes.length + remoteDb.shipments.length + remoteDb.purchases.length +
    remoteDb.transactions.length + remoteDb.extraShipments.length > 0;

  // Nếu máy mới mở lần đầu (chỉ có dữ liệu mẫu chưa sửa) và trên mây đã có dữ liệu thật -> tải thẳng dữ liệu thật về
  if (remoteHasData && isUntouchedSeedDB(localDb)) {
    return {
      orderNotes: remoteDb.orderNotes,
      shipments: remoteDb.shipments,
      purchases: remoteDb.purchases,
      transactions: remoteDb.transactions,
      extraShipments: remoteDb.extraShipments,
      packagingCatalog: Array.isArray(remoteDb.packagingCatalog) ? remoteDb.packagingCatalog : [],
      logs: remoteDb.logs.slice(0, 300),
      paymentRecords: remoteDb.paymentRecords,
      businessPeriods: remoteDb.businessPeriods,
      deletedIds: remoteDb.deletedIds || {},
      _catalogInitialized: true,
      _userModified: true
    };
  }

  // Gộp danh sách ID đã được người dùng chủ động bấm Xóa
  const mergedDeleted = opts.ignoreDeletes ? {} : { ...(localDb.deletedIds || {}) };
  if (!opts.ignoreDeletes) {
    Object.entries(remoteDb.deletedIds || {}).forEach(([k, ts]) => {
      const nTs = Number(ts) || 0;
      if (!mergedDeleted[k] || nTs > mergedDeleted[k]) mergedDeleted[k] = nTs;
    });
  }

  const mergeList = (localArr = [], remoteArr = []) => {
    const map = new Map();
    const put = (item, source) => {
      if (!item || !item.id) return;
      const delTs = mergedDeleted[item.id] || 0;
      const itemTs = Number(item.updatedAtMs) || 0;
      // Chỉ bỏ qua nếu người dùng đã chủ động bấm Xóa SAU thời điểm bản ghi được sửa
      if (delTs && itemTs < delTs) return;

      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, { item, source });
        return;
      }
      const exTs = Number(existing.item.updatedAtMs) || 0;
      if (itemTs > exTs) {
        map.set(item.id, { item, source });
      } else if (itemTs === exTs) {
        const exHist = Array.isArray(existing.item.history) ? existing.item.history.length : 0;
        const inHist = Array.isArray(item.history) ? item.history.length : 0;
        if (inHist > exHist) map.set(item.id, { item, source });
      }
    };
    (localArr || []).forEach(x => put(x, 'local'));
    (remoteArr || []).forEach(x => put(x, 'remote'));
    return Array.from(map.values()).map(v => v.item);
  };

  // Gộp kỳ kinh doanh: ưu tiên bản đã chốt (closed + snapshot) để bảo toàn lịch sử đồng nhất giữa nhiều máy
  const mergePeriods = (localArr = [], remoteArr = []) => {
    const map = new Map();
    const put = p => {
      if (!p || !p.id) return;
      const ex = map.get(p.id);
      if (!ex) { map.set(p.id, p); return; }
      const pClosed = p.status === 'closed' && p.snapshot;
      const exClosed = ex.status === 'closed' && ex.snapshot;
      if (pClosed && !exClosed) { map.set(p.id, p); return; }
      if (!pClosed && exClosed) return;
      if ((Number(p.updatedAtMs) || 0) >= (Number(ex.updatedAtMs) || 0)) map.set(p.id, p);
    };
    (localArr || []).forEach(put);
    (remoteArr || []).forEach(put);
    return [...map.values()].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  };

  const mergedLogs = mergeList(localDb.logs, remoteDb.logs).slice(0, 300);
  const mergedPack = mergeList(localDb.packagingCatalog, remoteDb.packagingCatalog);

  return {
    orderNotes: mergeList(localDb.orderNotes, remoteDb.orderNotes),
    shipments: mergeList(localDb.shipments, remoteDb.shipments),
    purchases: mergeList(localDb.purchases, remoteDb.purchases),
    transactions: mergeList(localDb.transactions, remoteDb.transactions),
    extraShipments: mergeList(localDb.extraShipments, remoteDb.extraShipments),
    packagingCatalog: mergedPack,
    logs: mergedLogs,
    paymentRecords: mergeList(localDb.paymentRecords, remoteDb.paymentRecords),
    businessPeriods: mergePeriods(localDb.businessPeriods, remoteDb.businessPeriods),
    deletedIds: mergedDeleted,
    _catalogInitialized: true,
    _userModified: true
  };
}

function updateSyncBadge(state = '') {
  const cfg = loadSyncConfig();
  const statusEl = document.getElementById('saveStatus');
  const topBtn = document.getElementById('syncTopBtn');
  const enabled = Boolean(cleanFirebaseUrl(cfg.url));

  if (state === 'syncing') {
    if (statusEl) {
      statusEl.textContent = '↻ Đang đồng bộ mây...';
      statusEl.classList.remove('warn');
    }
    if (topBtn) topBtn.textContent = '↻ Đang đồng bộ...';
    return;
  }

  if (state === 'error') {
    if (statusEl) {
      statusEl.textContent = '⚠ Offline · Đã lưu trên máy';
      statusEl.classList.add('warn');
    }
    if (topBtn) topBtn.textContent = '⚠ Đồng bộ (Offline)';
    return;
  }

  if (enabled) {
    const t = cfg.lastSyncAt || nowStamp();
    const shortT = String(t).split(' - ')[0] || t;
    if (statusEl) {
      statusEl.textContent = `☁ Đồng bộ ${shortT}`;
      statusEl.title = `Đã đồng bộ đám mây (${cleanRoomId(cfg.room)}) lúc ${t} · Bấm để xem chi tiết`;
      statusEl.classList.remove('warn');
    }
    if (topBtn) topBtn.textContent = `☁ Đã đồng bộ · ${cleanRoomId(cfg.room)}`;
  } else {
    const t = nowStamp();
    const shortT = String(t).split(' - ')[0] || t;
    if (statusEl && !statusEl.textContent.includes('Lỗi bộ nhớ')) {
      statusEl.textContent = `✓ Đã lưu ${shortT}`;
      statusEl.title = `Đã lưu an toàn trên máy lúc ${t} · Bấm để bật đồng bộ 2 máy (Bạn & Minh)`;
      statusEl.classList.remove('warn');
    }
    if (topBtn) topBtn.textContent = '☁ Đồng bộ & Sao lưu';
  }
}

function scheduleCloudSync() {
  const cfg = loadSyncConfig();
  if (!cleanFirebaseUrl(cfg.url)) return;
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    syncNow(true);
  }, 1200);
}

async function syncNow(silent = false) {
  const cfg = loadSyncConfig();
  const baseUrl = cleanFirebaseUrl(cfg.url);
  if (!baseUrl) {
    if (!silent) toast('Chưa cấu hình đường dẫn Đồng bộ đám mây.');
    return false;
  }
  if (syncInFlight) return false;
  syncInFlight = true;
  updateSyncBadge('syncing');

  const room = cleanRoomId(cfg.room);
  const endpoint = `${baseUrl}/rooms/${encodeURIComponent(room)}.json`;

  try {
    const getRes = await fetch(endpoint, { method: 'GET', cache: 'no-store' });
    if (!getRes.ok) throw new Error(`HTTP ${getRes.status} khi đọc dữ liệu đám mây`);
    const remoteData = await getRes.json();

    const beforeStr = JSON.stringify(db);
    const merged = remoteData ? smartMergeDB(db, remoteData) : db;
    const afterStr = JSON.stringify(merged);

    if (afterStr !== beforeStr) {
      saveAutoSnapshot('Trước khi nhận dữ liệu đồng bộ từ mây', false);
      db = merged;
      reconcileBusinessPeriods(undefined, { skipPersist: true, silent: true });
      localStorage.setItem(KEY, JSON.stringify(db));
      render();
    }

    const payload = {
      ...db,
      _meta: {
        system: 'DAIRYCOW LOGISTICS',
        room,
        syncedAt: nowStamp(true),
        syncedAtMs: Date.now()
      }
    };

    const putRes = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!putRes.ok) throw new Error(`HTTP ${putRes.status} khi đẩy dữ liệu lên đám mây`);

    cfg.lastSyncAt = nowStamp();
    saveSyncConfig(cfg);
    updateSyncBadge('synced');
    if (!silent) toast(`☁ Đồng bộ thành công với kho "${room}" (${cfg.lastSyncAt})`);
    return true;
  } catch (err) {
    console.error('Lỗi đồng bộ đám mây:', err);
    updateSyncBadge('error');
    if (!silent) {
      alert(`Không kết nối được đám mây (${err.message || 'Lỗi mạng'}).\n\nDữ liệu trên máy bạn vẫn được LƯU AN TOÀN, không bị mất. Hãy kiểm tra lại Link Firebase Realtime Database và quyền truy cập Rules (read/write: true).`);
    }
    return false;
  } finally {
    syncInFlight = false;
  }
}

function startCloudSyncLoop() {
  if (syncPollTimer) clearInterval(syncPollTimer);
  syncPollTimer = setInterval(() => {
    const cfg = loadSyncConfig();
    if (!cleanFirebaseUrl(cfg.url) || !cfg.autoSync) return;
    if (document.hidden) return;
    if (document.getElementById('modal')?.classList.contains('open')) return;
    syncNow(true);
  }, 15000);
}

function buildSyncShareLink() {
  const cfg = loadSyncConfig();
  const baseUrl = cleanFirebaseUrl(cfg.url);
  if (!baseUrl) return '';
  const payload = JSON.stringify({ u: baseUrl, r: cleanRoomId(cfg.room) });
  const b64 = btoa(unescape(encodeURIComponent(payload)));
  const pageUrl = window.location.origin + window.location.pathname;
  return `${pageUrl}#sync=${encodeURIComponent(b64)}`;
}

function copySyncShareLink() {
  const urlInput = document.getElementById('f_syncUrl');
  const roomInput = document.getElementById('f_syncRoom');
  if (urlInput && urlInput.value.trim()) {
    const cfg = loadSyncConfig();
    cfg.url = cleanFirebaseUrl(urlInput.value);
    cfg.room = cleanRoomId(roomInput ? roomInput.value : cfg.room);
    saveSyncConfig(cfg);
  }
  const link = buildSyncShareLink();
  if (!link) {
    alert('Vui lòng nhập Link Firebase Realtime Database trước khi chép link gửi bạn!');
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link)
      .then(() => toast('📋 Đã chép link đồng bộ! Gửi link này cho bạn qua Zalo để mở là tự kết nối.'))
      .catch(() => prompt('Sao chép đường dẫn đồng bộ dưới đây gửi cho bạn:', link));
  } else {
    prompt('Sao chép đường dẫn đồng bộ dưới đây gửi cho bạn:', link);
  }
}

function applySyncLinkFromUrl() {
  try {
    const hash = window.location.hash || '';
    const match = hash.match(/sync=([^&]+)/);
    if (!match) return false;
    const raw = decodeURIComponent(match[1]);
    const parsed = JSON.parse(decodeURIComponent(escape(atob(raw))));
    if (parsed && parsed.u) {
      const cfg = {
        url: cleanFirebaseUrl(parsed.u),
        room: cleanRoomId(parsed.r || 'dairycow-main'),
        autoSync: true,
        lastSyncAt: ''
      };
      saveSyncConfig(cfg);
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      toast(`☁ Đã tự động kết nối kho đồng bộ "${cfg.room}"!`);
      setTimeout(() => syncNow(false), 400);
      return true;
    }
  } catch (err) {
    console.error('Lỗi đọc link đồng bộ:', err);
  }
  return false;
}

function triggerManualSnapshot() {
  saveAutoSnapshot('Người dùng chủ động tạo mốc dự phòng', true);
  toast('🛡 Đã chụp mốc dự phòng an toàn trên máy!');
  openSyncModal();
}

function disableCloudSync() {
  if (!confirm('Tắt đồng bộ đám mây trên máy này? Dữ liệu đang có trên máy và trên mây đều KHÔNG bị xóa.')) return;
  const cfg = loadSyncConfig();
  cfg.url = '';
  saveSyncConfig(cfg);
  toast('Đã tắt đồng bộ đám mây (dữ liệu trên máy vẫn giữ nguyên).');
  openSyncModal();
}

function saveSyncSettingsFromModal() {
  const urlRaw = document.getElementById('f_syncUrl')?.value || '';
  const roomRaw = document.getElementById('f_syncRoom')?.value || 'dairycow-main';
  const autoSync = Boolean(document.getElementById('f_syncAuto')?.checked);

  const cleanUrl = cleanFirebaseUrl(urlRaw);
  if (cleanUrl && !/^https:\/\/.+\.(firebaseio\.com|firebasedatabase\.app)$/i.test(cleanUrl)) {
    if (!confirm('Link vừa nhập không có đuôi .firebaseio.com hoặc .firebasedatabase.app. Bạn vẫn muốn thử kết nối?')) {
      return;
    }
  }
  const cfg = {
    url: cleanUrl,
    room: cleanRoomId(roomRaw),
    autoSync,
    lastSyncAt: ''
  };
  saveSyncConfig(cfg);
  if (cleanUrl) {
    syncNow(false).then(ok => {
      if (ok && document.getElementById('modal')?.classList.contains('open')) {
        openSyncModal();
      }
    });
  } else {
    toast('✓ Đã lưu cài đặt (chế độ lưu trên máy).');
    closeModal();
  }
}

async function testFirebaseConnection() {
  const urlInput = document.getElementById('f_syncUrl');
  const roomInput = document.getElementById('f_syncRoom');
  const baseUrl = cleanFirebaseUrl(urlInput ? urlInput.value : loadSyncConfig().url);
  const room = cleanRoomId(roomInput ? roomInput.value : loadSyncConfig().room);
  if (!baseUrl) {
    alert('Vui lòng dán Link Firebase Realtime Database vào ô số 1 trước khi kiểm tra kết nối!');
    return;
  }
  try {
    toast('🔌 Đang kiểm tra kết nối tới kho đám mây...');
    const res = await fetch(`${baseUrl}/rooms/${encodeURIComponent(room)}/_meta.json`, { method: 'GET', cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const meta = await res.json();
    alert(`✅ KẾT NỐI THÀNH CÔNG!\n\nKho dùng chung: ${room}\n${meta?.syncedAt ? `Lần đồng bộ gần nhất trên mây: ${meta.syncedAt}` : 'Kho sẵn sàng — hãy bấm "✓ Lưu & Đồng bộ ngay" để đẩy dữ liệu lên!'}`);
  } catch (err) {
    alert(`❌ Chưa kết nối được (${err.message || 'Lỗi mạng'}).\n\nHãy kiểm tra:\n1. Link có đúng dạng https://...firebasedatabase.app hoặc .firebaseio.com chưa?\n2. Trong Firebase → Realtime Database → tab Rules đã để ".read": true, ".write": true và bấm Publish chưa?`);
  }
}

function flushPendingStateOnExit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
    if (syncDebounceTimer) {
      clearTimeout(syncDebounceTimer);
      syncDebounceTimer = null;
      syncNow(true);
    }
  } catch {}
}

function openSyncModal() {
  const form = document.getElementById('recordForm');
  form.reset();
  form.dataset.kind = 'sync_config';
  form.dataset.id = '';
  formDirty = false;
  hideFormError();
  document.getElementById('modalBox')?.classList.add('wide');
  document.getElementById('modalTitle').textContent = '☁ Đồng bộ 2 chiều (Bạn & Minh) & Sao lưu chống mất dữ liệu';
  document.getElementById('modalSub').textContent = 'GitHub Pages chỉ lưu giao diện web. Dữ liệu luôn tự lưu trên máy + kết nối Firebase để 2 máy Bạn & Minh tự đồng bộ sang nhau.';
  document.getElementById('deleteZone').classList.add('hidden');
  document.getElementById('calcPreviewZone').innerHTML = '';
  document.getElementById('recordHistoryZone').classList.add('hidden');

  const cfg = loadSyncConfig();
  const snaps = loadAutoSnapshots();
  const counts = dbCounts(db);
  const connected = Boolean(cleanFirebaseUrl(cfg.url));

  const snapRows = snaps.length
    ? snaps.map(s => {
        const c = s.counts || {};
        return `<div class="sync-snap-row">
          <div class="sync-snap-info">
            <strong>${esc(s.time)}</strong>
            <span class="sync-snap-reason">${esc(s.reason)}</span>
            <div class="sync-snap-meta">Note đơn: <b>${c.orderNotes || 0}</b> · Vận đơn: <b>${c.shipments || 0}</b> · Mua hộ: <b>${c.purchases || 0}</b> · Thu chi: <b>${c.transactions || 0}</b> · Ship PS: <b>${c.extraShipments || 0}</b></div>
          </div>
          <button type="button" class="btn small" onclick="restoreAutoSnapshot('${esc(s.id)}')">↺ Khôi phục</button>
        </div>`;
      }).join('')
    : `<div class="sync-empty">Chưa có mốc dự phòng nào. Bấm "＋ Chụp mốc ngay" để tạo bản sao an toàn đầu tiên.</div>`;

  document.getElementById('formFields').innerHTML = `
    <div class="full sync-status-banner ${connected ? 'connected' : ''}">
      <div>
        <div class="sync-banner-title">${connected ? `☁ ĐÃ BẬT ĐỒNG BỘ 2 MÁY · Kho "${esc(cleanRoomId(cfg.room))}"` : '⚠ CHƯA NỐI MÂY GIỮA 2 MÁY · Đang lưu an toàn trên riêng máy này'}</div>
        <div class="sync-banner-sub">${connected ? 'Mọi đơn bạn hoặc Minh nhập đều tự gộp 2 chiều, không bao giờ tự xóa dữ liệu của nhau.' : 'Lưu ý quan trọng: GitHub chỉ chứa code giao diện, không tự truyền đơn hàng giữa 2 máy. Hãy dán Link Firebase bên dưới 1 lần để máy bạn và máy Minh thông nhau!'}</div>
        <div class="sync-banner-sub" style="margin-top:4px">Đang lưu: <b>${counts.orderNotes}</b> Note đơn · <b>${counts.shipments}</b> Vận đơn · <b>${counts.purchases}</b> Mua hộ · <b>${counts.transactions}</b> Thu chi · <b>${counts.extraShipments}</b> Cước ship PS${cfg.lastSyncAt ? ` · Đồng bộ lúc: <b>${esc(cfg.lastSyncAt)}</b>` : ''}</div>
      </div>
      <div class="sync-banner-actions">
        ${connected ? `<button type="button" class="btn small primary" onclick="syncNow(false)">↻ Đồng bộ ngay</button>` : ''}
        <button type="button" class="btn small" onclick="exportData()">↓ Tải JSON</button>
      </div>
    </div>

    <div class="full sync-card">
      <div class="sync-card-head">
        <strong>1. Đồng bộ tự động giữa máy Bạn &amp; máy Minh (Miễn phí qua Firebase)</strong>
        <span class="sync-pill">Gộp thông minh · Không mất dữ liệu</span>
      </div>
      <div class="sync-grid-2">
        <div class="field-group">
          <label for="f_syncUrl">Link Firebase Realtime Database</label>
          <input id="f_syncUrl" class="field" type="url" value="${esc(cfg.url)}" placeholder="https://ten-du-an-default-rtdb.asia-southeast1.firebasedatabase.app" />
        </div>
        <div class="field-group">
          <label for="f_syncRoom">Mã kho dùng chung (Room ID)</label>
          <input id="f_syncRoom" class="field" type="text" value="${esc(cfg.room || 'dairycow-main')}" placeholder="dairycow-main" />
        </div>
      </div>
      <label class="sync-check-row">
        <input id="f_syncAuto" type="checkbox" ${cfg.autoSync ? 'checked' : ''} />
        <span>Tự động đồng bộ nền mỗi 15 giây &amp; ngay sau khi bấm Lưu (điện thoại và máy tính tự cập nhật qua lại)</span>
      </label>
      <div class="sync-btn-row">
        <button type="button" class="btn primary small" onclick="saveSyncSettingsFromModal()">✓ Lưu &amp; Đồng bộ ngay</button>
        <button type="button" class="btn small" onclick="testFirebaseConnection()">🔌 Kiểm tra kết nối</button>
        <button type="button" class="btn small" onclick="copySyncShareLink()">📋 Chép link cài sẵn gửi Minh</button>
        ${connected ? `<button type="button" class="btn small" onclick="disableCloudSync()">Tắt đồng bộ</button>` : ''}
      </div>
      <details class="sync-guide" ${connected ? '' : 'open'}>
        <summary>📖 Cách lấy Link Firebase miễn phí trong 2 phút để Bạn &amp; Minh dùng chung vĩnh viễn</summary>
        <ol>
          <li>Vào <a href="https://console.firebase.google.com" target="_blank" rel="noopener">console.firebase.google.com</a> bằng Gmail → bấm <b>Add project</b> / <b>Create a project</b> (đặt tên <code>dairycow-minh</code>, tắt Google Analytics cho nhanh → <b>Create</b>).</li>
          <li>Menu trái chọn <b>Build → Realtime Database → Create Database</b> → chọn <b>Singapore (asia-southeast1)</b> → chọn <b>Start in test mode</b> → bấm <b>Enable</b>. (Để dùng lâu dài không hết hạn 30 ngày: sang tab <b>Rules</b> sửa thành <code>{ "rules": { ".read": true, ".write": true } }</code> rồi bấm <b>Publish</b>).</li>
          <li>Copy đường link <code>https://...firebasedatabase.app</code> dán vào ô trên → bấm <b>✓ Lưu &amp; Đồng bộ ngay</b>.</li>
          <li>Bấm <b>📋 Chép link cài sẵn gửi Minh</b> gửi qua Zalo cho Minh — Minh bấm mở link đó là tự kết nối chung kho ngay lập tức!</li>
        </ol>
      </details>
    </div>

    <div class="full sync-card">
      <div class="sync-card-head">
        <strong>2. Kho 10 bản Tự động Dự phòng trên máy (Chống xóa nhầm)</strong>
        <button type="button" class="btn small" onclick="triggerManualSnapshot()">＋ Chụp mốc ngay</button>
      </div>
      <p class="sync-note">Mỗi khi bạn xóa bản ghi, nhập file JSON, hoặc sửa dữ liệu định kỳ, hệ thống tự chụp 1 mốc dự phòng để bạn có thể quay lại bất cứ lúc nào.</p>
      <div class="sync-snap-list">${snapRows}</div>
    </div>

    <div class="full sync-card">
      <div class="sync-card-head">
        <strong>3. Sao lưu &amp; Khôi phục bằng tệp JSON thủ công</strong>
      </div>
      <div class="sync-btn-row">
        <button type="button" class="btn small" onclick="exportData()">↓ Tải file sao lưu JSON về máy</button>
        <label class="btn small" style="cursor:pointer">↑ Gộp thêm từ JSON (An toàn)<input type="file" accept=".json" style="display:none" onchange="importData(event, true)" /></label>
        <label class="btn small" style="cursor:pointer">↑ Khôi phục thay thế từ JSON<input type="file" accept=".json" style="display:none" onchange="importData(event, false)" /></label>
      </div>
    </div>
  `;

  document.getElementById('saveBtn').textContent = '✓ Lưu cài đặt đồng bộ';
  document.getElementById('modal').classList.add('open');
}

window.addEventListener('online', () => {
  const cfg = loadSyncConfig();
  if (cleanFirebaseUrl(cfg.url)) syncNow(true);
});

window.addEventListener('pagehide', flushPendingStateOnExit);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    flushPendingStateOnExit();
  } else {
    const res = reconcileBusinessPeriods();
    if (res.newlyClosed.length > 0 || res.periodRolledOver) {
      render();
      toast(`📅 Đã tự động chốt kỳ và bắt đầu ${res.currentPeriod.label} từ 0!`);
    }
    const cfg = loadSyncConfig();
    if (cleanFirebaseUrl(cfg.url) && cfg.autoSync) syncNow(true);
  }
});

/* ============================================================
   POPOVER THÔNG BÁO (CHUÔNG 🔔) & CUỘN NHANH ĐẾN TASKS
   ============================================================ */
function scrollToTasksPanel() {
  closeNotifPopover();
  if (view !== 'overview') {
    setView('overview', document.querySelector('[data-view=overview]'));
  }
  setTimeout(() => {
    const el = document.getElementById('tasksPanel');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

function renderNotifPopover() {
  const pop = document.getElementById('notifPopover');
  if (!pop) return;
  const items = getPendingItems();
  const rows = items.slice(0, 12).map(item => {
    if (item.kind === 'order') {
      const m = item.metrics;
      const tags = [];
      if (m.customerDebt > 0) tags.push(`<span class="notif-tag owe">Khách nợ ${money(m.customerDebt)} ₫</span>`);
      if (m.warehouseDebt > 0) tags.push(`<span class="notif-tag ware">Nợ kho ${money(m.warehouseDebt)} ₫</span>`);
      if (!tags.length) tags.push(`<span class="notif-tag info">${esc(item.status)}</span>`);
      return `<div class="notif-pop-item" onclick="closeNotifPopover();editRecord('order','${item.id}')">
        <div class="notif-pop-main">
          <b>${esc(item.customer)} · ${esc(item.product || item.goodsType)}</b>
          <div class="notif-pop-tags">${tags.join(' ')}</div>
        </div>
        <div class="notif-pop-actions" onclick="event.stopPropagation()">
          ${m.customerDebt > 0 ? `<button type="button" class="iconbtn primary-tint" onclick="settleOrderDebt('${item.id}','customer');renderNotifPopover()">Thu đủ</button>` : ''}
          ${m.warehouseDebt > 0 ? `<button type="button" class="iconbtn" onclick="settleOrderDebt('${item.id}','warehouse');renderNotifPopover()">Trả kho</button>` : ''}
        </div>
      </div>`;
    }
    const isShip = item.kind === 'shipment';
    return `<div class="notif-pop-item" onclick="closeNotifPopover();editRecord('${item.kind}','${item.id}')">
      <div class="notif-pop-main">
        <b>${esc(item.customer)} · ${esc(item.product)}</b>
        <div class="notif-pop-tags"><span class="notif-tag info">${isShip ? '📦 Ký gửi' : '🛍 Mua hộ'} · ${esc(item.status)}</span></div>
      </div>
    </div>`;
  }).join('');

  pop.innerHTML = `
    <div class="notif-pop-head">
      <strong>🔔 Việc cần xử lý &amp; Công nợ mở (${items.length})</strong>
      <button type="button" class="link-btn" onclick="scrollToTasksPanel()">Xem trên Dashboard →</button>
    </div>
    <div class="notif-pop-body">
      ${rows || '<div class="notif-pop-empty">🎉 Tuyệt vời! Không còn việc tồn đọng hay công nợ mở nào.</div>'}
    </div>
  `;
}

function toggleNotifPopover(e) {
  if (e) e.stopPropagation();
  const pop = document.getElementById('notifPopover');
  const btn = document.getElementById('notifBtn');
  if (!pop) return;
  const willOpen = pop.classList.contains('hidden');
  if (willOpen) {
    renderNotifPopover();
    pop.classList.remove('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  } else {
    closeNotifPopover();
  }
}

function closeNotifPopover() {
  document.getElementById('notifPopover')?.classList.add('hidden');
  document.getElementById('notifBtn')?.setAttribute('aria-expanded', 'false');
}

document.addEventListener('click', e => {
  const wrap = document.getElementById('notifWrap');
  if (wrap && !wrap.contains(e.target)) {
    closeNotifPopover();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!document.getElementById('notifPopover')?.classList.contains('hidden')) {
      closeNotifPopover();
      return;
    }
    if (document.getElementById('aiDrawerOverlay')?.classList.contains('open')) {
      closeAiDrawer();
      return;
    }
    if (document.getElementById('modal')?.classList.contains('open')) {
      requestCloseModal();
    }
  }
});

/* ============================================================
   TRỢ LÝ AI DEEPSEEK (CHAT TỰ DO + TỔNG HỢP SỐ LIỆU THẬT APP)
   Bảo mật: API Key chỉ lưu localStorage trên máy, KHÔNG lên GitHub.
   ============================================================ */
let aiSending = false;

function loadAiConfig() {
  try {
    const raw = localStorage.getItem(AI_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        apiKey: String(p.apiKey || '').trim(),
        model: p.model === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat',
        includeAppData: p.includeAppData !== false
      };
    }
  } catch {}
  return { apiKey: '', model: 'deepseek-chat', includeAppData: true };
}

function saveAiConfig(cfg) {
  try { localStorage.setItem(AI_KEY, JSON.stringify(cfg)); } catch {}
  updateAiStatusUI();
}

function loadAiChat() {
  try {
    const raw = localStorage.getItem(AI_CHAT_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
  } catch {}
  return [];
}

function saveAiChat(list) {
  try { localStorage.setItem(AI_CHAT_KEY, JSON.stringify((list || []).slice(-30))); } catch {}
}

function updateAiStatusUI() {
  const cfg = loadAiConfig();
  const btn = document.getElementById('aiChatTopBtn');
  const sub = document.getElementById('aiStatusSub');
  const periodLbl = document.getElementById('aiContextPeriodLabel');
  const ctxBtn = document.getElementById('aiIncludeDataBtn');
  const fabDot = document.getElementById('aiFabDot');
  const modelSel = document.getElementById('aiModelSelect');
  if (btn) btn.textContent = cfg.apiKey ? '🤖 Trợ lý AI ●' : '🤖 Trợ lý AI';
  if (sub) sub.textContent = cfg.apiKey ? `Sẵn sàng · ${cfg.model === 'deepseek-reasoner' ? 'DeepSeek R1' : 'DeepSeek Chat'}` : 'Chưa gắn API Key — bấm ⚙ Key';
  if (periodLbl) periodLbl.textContent = cfg.includeAppData ? `App: ${getSelectedBusinessPeriod().shortLabel}` : 'Chat tự do';
  if (ctxBtn) ctxBtn.classList.toggle('active', Boolean(cfg.includeAppData));
  if (fabDot) fabDot.classList.toggle('online', Boolean(cfg.apiKey));
  if (modelSel) modelSel.value = cfg.model;
}

function toggleAiDrawer() {
  const overlay = document.getElementById('aiDrawerOverlay');
  if (!overlay) return;
  if (overlay.classList.contains('open')) closeAiDrawer();
  else openAiDrawer();
}

function toggleAiExpand() {
  const popup = document.getElementById('aiDrawerOverlay');
  if (!popup) return;
  const isWide = popup.classList.toggle('expanded');
  const btn = document.getElementById('aiExpandBtn');
  if (btn) btn.textContent = isWide ? '⤡' : '⤢';
}

function autoGrowAiInput(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = Math.min(130, el.scrollHeight) + 'px';
}

function onChangeAiModel(modelVal) {
  const cfg = loadAiConfig();
  cfg.model = modelVal === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';
  saveAiConfig(cfg);
  toast(`Đã chuyển sang ${cfg.model === 'deepseek-reasoner' ? 'DeepSeek R1 (Suy luận sâu)' : 'DeepSeek Chat (Nhanh)'}`);
}

function openAiDrawer() {
  const overlay = document.getElementById('aiDrawerOverlay');
  if (!overlay) return;
  const cfg = loadAiConfig();
  const keyInp = document.getElementById('aiApiKeyInput');
  const modelSel = document.getElementById('aiModelSelect');
  if (keyInp) keyInp.value = cfg.apiKey;
  if (modelSel) modelSel.value = cfg.model;
  // Tự mở ô nhập Key nếu máy chưa dán Key
  document.getElementById('aiSettingsPanel')?.classList.toggle('hidden', Boolean(cfg.apiKey));
  updateAiStatusUI();
  renderAiMessages();
  overlay.classList.add('open');
  document.getElementById('aiFabBtn')?.classList.add('is-open');
  setTimeout(() => {
    if (cfg.apiKey) document.getElementById('aiInput')?.focus();
    else keyInp?.focus();
  }, 60);
}

function closeAiDrawer() {
  document.getElementById('aiDrawerOverlay')?.classList.remove('open');
  document.getElementById('aiFabBtn')?.classList.remove('is-open');
}

function toggleAiSettings() {
  document.getElementById('aiSettingsPanel')?.classList.toggle('hidden');
}

function toggleAiIncludeData(forceVal) {
  const cfg = loadAiConfig();
  cfg.includeAppData = typeof forceVal === 'boolean' ? forceVal : !cfg.includeAppData;
  saveAiConfig(cfg);
  toast(cfg.includeAppData ? '📊 Đã bật đọc số liệu App cho DeepSeek' : '💬 Chế độ chat DeepSeek tự do (không gửi dữ liệu App)');
}

function saveAiSettingsUI() {
  const apiKey = String(document.getElementById('aiApiKeyInput')?.value || '').trim();
  const model = document.getElementById('aiModelSelect')?.value || 'deepseek-chat';
  if (!apiKey) {
    alert('Vui lòng dán DeepSeek API Key (bắt đầu bằng sk-...) trước khi lưu.');
    return;
  }
  const cfg = loadAiConfig();
  cfg.apiKey = apiKey;
  cfg.model = model;
  saveAiConfig(cfg);
  document.getElementById('aiSettingsPanel')?.classList.add('hidden');
  toast('✓ Đã lưu DeepSeek API Key trên máy này (không đẩy lên GitHub)');
  document.getElementById('aiInput')?.focus();
}

function removeAiKey() {
  if (!confirm('Xóa DeepSeek API Key khỏi trình duyệt máy này?')) return;
  const cfg = loadAiConfig();
  cfg.apiKey = '';
  saveAiConfig(cfg);
  const keyInp = document.getElementById('aiApiKeyInput');
  if (keyInp) keyInp.value = '';
  toast('Đã xóa DeepSeek API Key khỏi máy này');
}

function copyAiShareLink() {
  const keyInp = document.getElementById('aiApiKeyInput');
  const modelSel = document.getElementById('aiModelSelect');
  const cfg = loadAiConfig();
  const apiKey = String(keyInp?.value || cfg.apiKey || '').trim();
  const model = modelSel?.value || cfg.model || 'deepseek-chat';
  if (!apiKey) {
    alert('Vui lòng dán DeepSeek API Key trước khi chép link cài sẵn gửi Minh!');
    return;
  }
  cfg.apiKey = apiKey;
  cfg.model = model;
  saveAiConfig(cfg);

  const payload = JSON.stringify({ k: apiKey, m: model });
  const b64 = btoa(unescape(encodeURIComponent(payload)));
  const pageUrl = window.location.origin + window.location.pathname;
  const link = `${pageUrl}#ai=${encodeURIComponent(b64)}`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link)
      .then(() => toast('📋 Đã chép link cài sẵn AI! Gửi riêng cho Minh qua Zalo (không chia sẻ công khai).'))
      .catch(() => prompt('Sao chép link cài sẵn AI gửi riêng cho Minh qua Zalo:', link));
  } else {
    prompt('Sao chép link cài sẵn AI gửi riêng cho Minh qua Zalo:', link);
  }
}

function applyAiLinkFromUrl() {
  try {
    const hash = window.location.hash || '';
    const match = hash.match(/ai=([^&]+)/);
    if (!match) return false;
    const raw = decodeURIComponent(match[1]);
    const parsed = JSON.parse(decodeURIComponent(escape(atob(raw))));
    if (parsed && parsed.k) {
      const cfg = loadAiConfig();
      cfg.apiKey = String(parsed.k).trim();
      cfg.model = parsed.m === 'deepseek-reasoner' ? 'deepseek-reasoner' : 'deepseek-chat';
      saveAiConfig(cfg);
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
      toast('🤖 Đã tự động cài xong Trợ lý AI DeepSeek trên máy này!');
      setTimeout(() => openAiDrawer(), 350);
      return true;
    }
  } catch (err) {
    console.error('Lỗi đọc link cài AI:', err);
  }
  return false;
}

async function testDeepSeekKey() {
  const keyInp = document.getElementById('aiApiKeyInput');
  const apiKey = String(keyInp?.value || loadAiConfig().apiKey || '').trim();
  if (!apiKey) {
    alert('Vui lòng dán DeepSeek API Key trước khi kiểm tra!');
    return;
  }
  toast('🔌 Đang kiểm tra kết nối DeepSeek API...');
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Trả lời ngắn gọn: OK' }],
        max_tokens: 16
      })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData?.error?.message || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    alert('✅ KẾT NỐI DEEPSEEK THÀNH CÔNG!\n\nKey hoạt động tốt. Bạn có thể bấm "✓ Lưu Key" và dùng ngay, hoặc bấm "📋 Chép link cài sẵn gửi Minh".');
  } catch (err) {
    alert(`❌ Chưa gọi được DeepSeek API (${err.message || 'Lỗi mạng'}).\n\nKiểm tra lại:\n1. Key có đúng định dạng sk-... và còn hoạt động trên platform.deepseek.com chưa?\n2. Tài khoản DeepSeek còn số dư (Balance) không?`);
  }
}

function buildAppContextForDeepSeek() {
  const filterSpec = getActivePeriodFilter();
  const label = getPeriodLabel(filterSpec);
  const selectedPeriodObj = periodMode === 'bizperiod' ? getSelectedBusinessPeriod() : null;
  const s = (selectedPeriodObj && selectedPeriodObj.status === 'closed' && selectedPeriodObj.snapshot)
    ? selectedPeriodObj.snapshot
    : calcPeriodFinancials(filterSpec);
  const liveAll = calcPeriodFinancials('');
  const ordersInPeriod = (db.orderNotes || []).filter(o => o.status !== 'Đã hủy' && matchesDateFilter(o.date, filterSpec));

  // Thống kê theo App/Sàn trong kỳ
  const byApp = {};
  ordersInPeriod.forEach(o => {
    const app = normalizePlatformName(o.platform) || 'Chưa gắn sàn';
    if (!byApp[app]) byApp[app] = { count: 0, profit: 0, debt: 0 };
    const m = calcOrderMetrics(o);
    byApp[app].count += 1;
    byApp[app].profit += m.netProfit;
    byApp[app].debt += m.customerDebt;
  });

  // Danh sách khách đang còn nợ (toàn hệ thống - xuyên kỳ)
  const debtMap = new Map();
  (db.orderNotes || []).filter(o => o.status !== 'Đã hủy').forEach(o => {
    const m = calcOrderMetrics(o);
    if (m.customerDebt > 0) {
      const k = o.customer || 'Khách lẻ';
      const cur = debtMap.get(k) || { customer: k, totalDebt: 0, orders: 0 };
      cur.totalDebt += m.customerDebt;
      cur.orders += 1;
      debtMap.set(k, cur);
    }
  });
  const topDebts = [...debtMap.values()].sort((a, b) => b.totalDebt - a.totalDebt).slice(0, 20);

  const compactOrders = ordersInPeriod.slice(0, 35).map(o => {
    const m = calcOrderMetrics(o);
    return `- [${o.date}] ${o.code || ''} | ${o.customer} | ${o.lineType}${o.platform ? ` (${normalizePlatformName(o.platform)})` : ''} | ${o.product || o.goodsType} | Lãi: ${money(m.netProfit)}đ | Phải thu: ${money(m.totalCollectCustomer)}đ | Nợ: ${money(m.customerDebt)}đ | TT: ${o.status}`;
  }).join('\n');

  const appLines = Object.entries(byApp)
    .sort((a, b) => b[1].profit - a[1].profit)
    .map(([k, v]) => `- ${k}: ${v.count} đơn | Lãi ${money(v.profit)}đ | Nợ ${money(v.debt)}đ`)
    .join('\n');

  const debtLines = topDebts.length
    ? topDebts.map(d => `- ${d.customer}: còn nợ ${money(d.totalDebt)}đ (${d.orders} đơn)`).join('\n')
    : '- Không có khách hàng nào đang nợ.';

  const viewNames = {
    overview: 'Dashboard Tổng quan',
    orders: 'Note đơn · Dịch vụ Đóng gói & Tính lãi',
    incidentals: `Chi phí phát sinh & Đóng gói (Tab đang mở: ${incTab === 'extraship' ? '1. Cước ship phát sinh' : incTab === 'wood' ? '2. Đóng hộp gỗ' : incTab === 'carton' ? '3. Đóng hộp carton' : '4. Chống sốc'})`,
    finance: `Thu chi & Báo cáo (Tab đang mở: ${financeTab === 'cashflow' ? 'Thu chi & Dòng tiền' : financeTab === 'periods' ? 'Kỳ chốt 26' : financeTab === 'debts' ? 'Công nợ Khách & Kho' : financeTab === 'report' ? 'Báo cáo AI' : 'Lịch sử chỉnh sửa'})`,
    shipments: 'Đơn ký gửi kho (WMS)',
    purchases: 'Yêu cầu mua hộ (OMS)',
    customers: 'Danh bạ khách hàng & Công nợ'
  };
  const visibleTextRaw = String(document.getElementById('content')?.innerText || '').replace(/\s+/g, ' ').trim();
  const visibleScreenExcerpt = visibleTextRaw.slice(0, 1200);
  const syncCfg = loadSyncConfig();
  const incSum = calcIncidentalsSummary();

  return `MÀN HÌNH NGƯỜI DÙNG ĐANG MỞ TRƯỚC MẮT:
- Trang hiện tại: ${viewNames[view] || view}
- Vai trò đang chọn: ${currentUserRole}
- Bộ lọc đang bật: Từ khóa đang nhập=${query ? `"${query}"` : '(trống - không lọc)'} | Trạng thái=${window.statusFilter ? `"${window.statusFilter}"` : '(tất cả)'} | App/Sàn=${window.platformFilter ? `"${window.platformFilter}"` : '(tất cả)'} | Chế độ kỳ="${periodMode}"
- Trạng thái đồng bộ 2 máy (Bạn & Minh): ${cleanFirebaseUrl(syncCfg.url) ? `Đã bật Firebase (Kho: ${cleanRoomId(syncCfg.room)}, đồng bộ lúc ${syncCfg.lastSyncAt || 'vừa xong'})` : 'Chưa gắn link Firebase (đang lưu cục bộ trên máy này)'}
- Nội dung đang hiển thị trên màn hình: ${visibleScreenExcerpt || '(trống)'}

SƠ ĐỒ CHỨC NĂNG APP DAIRYCOW LOGISTICS (để tư vấn & hướng dẫn người dùng bấm đúng nút):
1. Dashboard: 4 thẻ KPI (Lợi nhuận kỳ, Tổng thu kỳ, Tổng công nợ thực tế xuyên kỳ, Lưu lượng đơn kỳ), biểu đồ Traffic, thanh chọn Kỳ chốt ngày 26 (26/tháng này -> 25/tháng sau, tự chốt 00:00 ngày 26 giờ VN).
2. Note đơn · Tính lãi: 4 loại Line (Xách tay, Thanh toán hộ, Ký gửi kho, Mua hộ trọn gói), chọn 9 App/Sàn (POIZON, TMALL, 1688, 95分, TAOBAO, JINGDONG, PIN DUO DUO, XIAN YU, VIP SHOP), tự tính lãi cước, lãi đóng gói, phí DV %, lãi tỷ giá tệ, công nợ khách & nút Đã trả cước kho.
3. Chi phí phát sinh (4 tab): 1. Cước ship phát sinh (cộng vào phải thu khách, không tính lợi nhuận mặc định), 2. Đóng hộp gỗ, 3. Đóng hộp carton, 4. Chống sốc (có công cụ chia giá vốn theo số lần dùng/cuộn). Hiện tổng lãi đóng gói: ${money(incSum.totalPackProfit)}đ (Gỗ ${money(incSum.woodProfit)}đ, Carton ${money(incSum.cartonProfit)}đ, Chống sốc ${money(incSum.shockProfit)}đ); Cước ship PS: tổng ${money(incSum.totalExtraShip)}đ (chưa thu ${money(incSum.uncollectedExtraShip)}đ).
4. Thu chi & Báo cáo: Tab Thu chi, Kỳ chốt 26 (tra cứu lịch sử các kỳ đã chốt & đối chiếu công nợ), Công nợ Khách & Kho, Báo cáo AI, Lịch sử sửa (Audit Log).
5. Đồng bộ & Sao lưu: Nút "☁ Đồng bộ & Sao lưu" trên thanh công cụ có đồng bộ Firebase 2 chiều + 10 mốc dự phòng tự động chống xóa nhầm + xuất/nhập JSON.

DỮ LIỆU THẬT TỪ ỨNG DỤNG DAIRYCOW LOGISTICS (Thời điểm: ${nowStamp(true)}, Múi giờ: ${APP_TIMEZONE})
Kỳ đang xem: ${label}${selectedPeriodObj ? ` (${selectedPeriodObj.status === 'closed' ? 'ĐÃ CHỐT' : 'ĐANG HOẠT ĐỘNG'})` : ''}
TỔNG HỢP KỲ ĐANG XEM:
- Lưu lượng đơn: ${s.totalTrafficOrders || 0} đơn (${s.orderCount || 0} Note đơn, ${s.shipmentCount || 0} Ký gửi, ${s.purchaseCount || 0} Mua hộ)
- Lợi nhuận thực tế kỳ này: ${money(s.netProfit || 0)} ₫ (Lãi cước: ${money(s.shipProfitTotal || 0)} ₫ | Phí DV: ${money(s.totalServiceRevenue || 0)} ₫ | Lãi đóng gói: ${money(s.packProfitTotal || 0)} ₫ | Lãi tỷ giá tệ: ${money(s.fxProfitTotal || 0)} ₫ | Chi phát sinh: -${money(s.totalIncidentalExpense || 0)} ₫)
- Dòng tiền thu kỳ này: ${money(s.totalCollectedFromCustomer || 0)} ₫ (trong đó thu công nợ kỳ trước: ${money(s.debtRecoveryIn || 0)} ₫)
- Dòng tiền chi/chuyển ra kỳ này: ${money(s.totalTransferredOut || 0)} ₫
- Công nợ phát sinh mới trong kỳ: ${money(s.periodNewCustomerDebt || 0)} ₫
- TỔNG CÔNG NỢ THỰC TẾ KHÁCH CÒN NỢ (Xuyên kỳ): ${money(liveAll.allCustomerDebt || 0)} ₫
- Tổng cước kho chưa trả: ${money(liveAll.allWarehouseUnpaid || 0)} ₫

THỐNG KÊ THEO APP / SÀN TRONG KỲ:
${appLines || '- Chưa có đơn trong kỳ.'}

TOP KHÁCH ĐANG CÒN NỢ (THỰC TẾ HIỆN TẠI):
${debtLines}

DANH SÁCH NOTE ĐƠN TRONG KỲ (tối đa 35 đơn gần nhất):
${compactOrders || '- Chưa có Note đơn nào trong kỳ.'}`;
}

function formatAiMarkdown(raw) {
  let s = esc(String(raw || ''));
  s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\n/g, '<br>');
  return s;
}

function copyAiMessageText(idx) {
  const msgs = loadAiChat();
  const text = msgs[idx]?.content || '';
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => toast('📋 Đã chép câu trả lời'));
  }
}

function renderAiMessages() {
  const box = document.getElementById('aiMessages');
  if (!box) return;
  const msgs = loadAiChat();
  const quickEl = document.getElementById('aiQuickPrompts');
  if (quickEl) quickEl.classList.toggle('compact', msgs.length > 0);
  if (!msgs.length) {
    box.innerHTML = `<div class="ai-welcome">
      <div class="ai-welcome-ico">✦</div>
      <strong>DeepSeek AI · DAIRYCOW</strong>
      <p>Hỏi tự do như ChatGPT hoặc tổng hợp lãi, công nợ, đơn theo sàn POIZON/1688/95分 ngay tại đây.</p>
    </div>`;
    return;
  }
  box.innerHTML = msgs.map((m, idx) => m.role === 'user'
    ? `<div class="ai-msg is-user">
        <div class="ai-bubble">${esc(m.content).replace(/\n/g, '<br>')}</div>
      </div>`
    : `<div class="ai-msg is-bot">
        <div class="ai-bot-row">
          <span class="ai-bot-avatar" aria-hidden="true">✦</span>
          <div class="ai-bot-body">
            <div class="ai-bubble">${formatAiMarkdown(m.content)}</div>
            <div class="ai-bot-meta">
              <span>${esc(m.time || '')}</span>
              <button type="button" class="ai-copy-btn" onclick="copyAiMessageText(${idx})" title="Sao chép">📋 Chép</button>
            </div>
          </div>
        </div>
      </div>`
  ).join('') + (aiSending ? `<div class="ai-msg is-bot"><div class="ai-bot-row"><span class="ai-bot-avatar" aria-hidden="true">✦</span><div class="ai-bubble ai-typing">DeepSeek đang suy nghĩ<span>.</span><span>.</span><span>.</span></div></div></div>` : '');
  box.scrollTop = box.scrollHeight;
}

function clearAiChat() {
  if (!loadAiChat().length) return;
  if (!confirm('Bắt đầu cuộc trò chuyện mới? (Không ảnh hưởng dữ liệu đơn hàng).')) return;
  saveAiChat([]);
  renderAiMessages();
}

function handleAiSubmit(e) {
  if (e) e.preventDefault();
  const inp = document.getElementById('aiInput');
  const text = String(inp?.value || '').trim();
  if (!text) return;
  if (inp) {
    inp.value = '';
    inp.style.height = 'auto';
  }
  sendAiMessage(text);
}

async function sendAiMessage(text) {
  if (aiSending) return;
  const content = String(text || '').trim();
  if (!content) return;

  const cfg = loadAiConfig();
  if (!cfg.apiKey) {
    document.getElementById('aiSettingsPanel')?.classList.remove('hidden');
    document.getElementById('aiApiKeyInput')?.focus();
    toast('Vui lòng dán DeepSeek API Key vào mục ⚙ Key trước khi chat!');
    return;
  }

  const msgs = loadAiChat();
  msgs.push({ role: 'user', content, time: nowStamp() });
  saveAiChat(msgs);
  aiSending = true;
  const sendBtn = document.getElementById('aiSendBtn');
  if (sendBtn) sendBtn.disabled = true;
  renderAiMessages();

  const sysPrompt = cfg.includeAppData
    ? `Bạn là Trợ lý AI thông minh của hệ thống quản lý Logistics & Tài chính DAIRYCOW LOGISTICS. Trả lời bằng tiếng Việt rõ ràng, ngắn gọn, chính xác.\nNGUYÊN TẮC BẮT BUỘC:\n1. Chỉ sử dụng đúng số liệu thật được cung cấp bên dưới, tuyệt đối KHÔNG bịa thêm số liệu.\n2. Phân biệt rõ Lợi nhuận thực tế với Dòng tiền thu và Công nợ kỳ trước.\n3. Nếu người dùng hỏi câu hỏi chung (dịch tiếng Trung, soạn tin nhắn, nghiệp vụ), vẫn trả lời tự nhiên hữu ích.\n\n${buildAppContextForDeepSeek()}`
    : 'Bạn là Trợ lý AI DeepSeek hữu ích cho chủ shop Logistics Trung - Việt (DAIRYCOW LOGISTICS). Trả lời tiếng Việt tự nhiên, ngắn gọn, chính xác.';

  const historyPayload = msgs.slice(-12).map(m => ({ role: m.role, content: m.content }));

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({
        model: cfg.model || 'deepseek-chat',
        messages: [{ role: 'system', content: sysPrompt }, ...historyPayload],
        temperature: 0.3
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = data?.error?.message || `HTTP ${res.status}`;
      throw new Error(errMsg);
    }
    const reply = data?.choices?.[0]?.message?.content?.trim() || 'DeepSeek không trả về nội dung.';
    msgs.push({ role: 'assistant', content: reply, time: nowStamp() });
    saveAiChat(msgs);
  } catch (err) {
    msgs.push({
      role: 'assistant',
      content: `⚠ Không gọi được DeepSeek API: \`${err.message || 'Lỗi kết nối'}\`.\nHãy kiểm tra lại API Key hoặc số dư tài khoản tại platform.deepseek.com (bấm nút ⚙ Key ở góc trên).`,
      time: nowStamp()
    });
    saveAiChat(msgs);
  } finally {
    aiSending = false;
    if (sendBtn) sendBtn.disabled = false;
    renderAiMessages();
  }
}

window.addEventListener('beforeunload', e => {
  if (formDirty && document.getElementById('modal')?.classList.contains('open')) {
    e.preventDefault();
    e.returnValue = '';
  }
});

if (localStorage.getItem(THEME_KEY) === 'purple') {
  document.body.classList.add('theme-purple');
}

const todayBrandEl = document.getElementById('today');
if (todayBrandEl) {
  todayBrandEl.textContent = 'WMS & OMS';
}

// Sao lưu an toàn 1 lần trước khi kích hoạt cơ chế Chốt kỳ ngày 26 (phương án khôi phục)
try {
  if (!localStorage.getItem('dairycow-bizperiod-v1-backup')) {
    saveAutoSnapshot('Sao lưu an toàn trước khi kích hoạt Chốt kỳ ngày 26', true);
    localStorage.setItem('dairycow-bizperiod-v1-backup', nowStamp(true));
  }
} catch {}

// Tự động xác định kỳ kinh doanh hiện tại (Asia/Ho_Chi_Minh) & chốt các kỳ đã qua 00:00 ngày 26
reconcileBusinessPeriods();
render();
updateSyncBadge();
updateAiStatusUI();
startCloudSyncLoop();
startPeriodCloseWatcher();
applyAiLinkFromUrl();
if (!applySyncLinkFromUrl()) {
  const _initSyncCfg = loadSyncConfig();
  if (cleanFirebaseUrl(_initSyncCfg.url) && _initSyncCfg.autoSync) {
    setTimeout(() => syncNow(true), 600);
  }
}
