const KEY = 'minh-work-manager-v1-data';

const lineTypes = ['Xách tay', 'Thanh toán hộ', 'Ký gửi kho', 'Mua hộ trọn gói', 'Khác'];
const goodsTypes = ['Thức ăn khô', 'Gia dụng', 'Mỹ phẩm', 'Quần áo', 'Giày dép', 'Đồ cơ khí', 'Điện tử / Phụ kiện', 'Khác'];
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
let financeTab = 'cashflow'; // 'cashflow' | 'debts' | 'report' | 'history'
let query = '';
let todoFilter = 'all';
let periodMode = 'month'; // 'day' | 'month' | 'year' | 'all'
let periodDate = dateKey();
let periodMonth = dateKey().slice(0, 7);
let periodYear = String(new Date().getFullYear());
let toastTimer = null;
let formDirty = false;
let overlayMouseDownTarget = null;
let showCnyBox = false;
window.statusFilter = '';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function nowStamp(withSeconds = false) {
  const d = new Date();
  const time = withSeconds
    ? `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
    : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return `${time} - ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
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

function loadDB() {
  try {
    const saved = localStorage.getItem(KEY) || localStorage.getItem('linh-logistics-v1-data');
    if (saved) {
      const d = JSON.parse(saved);
      return {
        orderNotes: Array.isArray(d.orderNotes) ? d.orderNotes : [],
        shipments: Array.isArray(d.shipments) ? d.shipments : [],
        purchases: Array.isArray(d.purchases) ? d.purchases : [],
        transactions: Array.isArray(d.transactions) ? d.transactions : [],
        logs: Array.isArray(d.logs) ? d.logs : []
      };
    }
    const old = localStorage.getItem('linh-logistics-orders-v1');
    if (old) {
      const arr = JSON.parse(old);
      return { orderNotes: [], shipments: arr, purchases: [], transactions: [], logs: [] };
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
    logs: [
      { id: 'l1', time: nowStamp(true), action: 'Khởi động', target: 'Hệ thống', detail: 'Sẵn sàng lưu trữ và tính toán tự động' }
    ]
  };
}

function persist() {
  try {
    const payload = JSON.stringify(db);
    localStorage.setItem(KEY, payload);
    const verify = localStorage.getItem(KEY);
    const el = document.getElementById('saveStatus');
    if (verify) {
      if (el) {
        el.textContent = `✓ Đã lưu ${nowStamp()}`;
        el.classList.remove('warn');
      }
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
    alert('Không thể lưu vào trình duyệt (có thể đang bật ẩn danh bị khóa bộ nhớ hoặc đầy dung lượng). Vui lòng bấm nút "↓ Sao lưu" để tải tệp JSON về máy!');
    return false;
  }
}

if (!localStorage.getItem(KEY)) {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
}

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

function statusClass(s) {
  if (['Đã về kho Việt Nam', 'Đã về kho VN', 'Đã giao khách', 'Hoàn tất / Đã tất toán', 'Đặt hàng thành công', 'Đã thanh toán', 'Đã thanh toán hộ'].includes(s)) return 's-green';
  if (['Mới tạo / Chờ xử lý', 'Chờ khách thanh toán', 'Chờ người bán gửi', 'Chờ xác nhận', 'Chờ báo giá', 'Chờ thanh toán'].includes(s)) return 's-amber';
  if (s === 'Đã hủy') return 's-red';
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
  const pct = parseNum(o.serviceFeePct);
  const feeManual = Math.round(parseNum(o.serviceFeeManual));
  const extraCost = Math.round(parseNum(o.extraCost));
  const includeGoods = Boolean(o.includeGoodsInFlow);

  const finalGoodsVnd = (cny > 0 && rateSell > 0) ? Math.round(cny * rateSell) : Math.round(vndInput);
  const baseGoodsCostVnd = (cny > 0 && rateSell > 0)
    ? Math.round(cny * (rateBuy > 0 ? rateBuy : rateSell))
    : Math.round(vndInput);

  // 1. Lãi phí vận chuyển = Cước thu khách - Cước gốc trả kho
  const shipProfit = shipCharge - shipCost;

  // 2. Phí dịch vụ = Giá cuối sản phẩm × (% : 100), cước vận chuyển tính riêng
  const serviceFee = pct > 0 ? Math.round(finalGoodsVnd * (pct / 100)) : feeManual;

  // 3. Lãi tệ = Số tệ × (Tỷ giá tệ bán - Tỷ giá tệ thu/gốc) (chỉ phát sinh khi có thu & trả hộ tiền hàng bằng tệ)
  const fxProfit = (includeGoods && cny > 0 && rateBuy > 0 && rateSell > 0) ? Math.round(cny * (rateSell - rateBuy)) : 0;

  // 4. Tổng phải thu từ khách & Tổng tiền phải chuyển ra
  const totalCollectCustomer = (includeGoods ? finalGoodsVnd : 0) + shipCharge + serviceFee;
  const totalPayout = (includeGoods ? baseGoodsCostVnd : 0) + shipCost + extraCost;

  // 5. Lợi nhuận thực tế của đơn
  const netProfit = shipProfit + serviceFee + fxProfit - extraCost;

  // 6. Công nợ khách hàng & Công nợ kho / đối tác
  const customerPaid = Math.round(parseNum(o.customerPaid));
  const customerDebt = Math.max(0, totalCollectCustomer - customerPaid);
  const warehouseDebt = o.warehousePaid ? 0 : shipCost;
  const partnerDebt = (includeGoods && !o.partnerPaid) ? baseGoodsCostVnd : 0;

  return {
    finalGoodsVnd,
    baseGoodsCostVnd,
    shipCost,
    shipCharge,
    shipProfit,
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
// TỔNG HỢP DÒNG TIỀN & BÁO CÁO TÀI CHÍNH THEO NGÀY / THÁNG / NĂM
// ============================================================================
function getActivePeriodPrefix() {
  if (periodMode === 'day') return periodDate || dateKey();
  if (periodMode === 'month') return periodMonth || dateKey().slice(0, 7);
  if (periodMode === 'year') return periodYear || String(new Date().getFullYear());
  return '';
}

function getPeriodLabel() {
  if (periodMode === 'day') return `Ngày ${dateText(periodDate)}`;
  if (periodMode === 'month') {
    const [y, m] = (periodMonth || dateKey().slice(0, 7)).split('-');
    return `Tháng ${m}/${y}`;
  }
  if (periodMode === 'year') return `Năm ${periodYear}`;
  return 'Toàn bộ thời gian';
}

function calcPeriodFinancials(prefix = '') {
  const matchDate = d => !prefix || String(d || '').startsWith(prefix);
  const orders = (db.orderNotes || []).filter(o => o.status !== 'Đã hủy' && matchDate(o.date));
  const txs = (db.transactions || []).filter(x => matchDate(x.date));

  let orderBilledCustomer = 0;
  let orderCollectedCustomer = 0;
  let orderActualOut = 0;
  let orderCommittedOut = 0;
  let shipCostTotal = 0;
  let shipChargeTotal = 0;
  let shipProfitTotal = 0;
  let orderServiceFeeTotal = 0;
  let fxProfitTotal = 0;
  let orderExtraCostTotal = 0;

  orders.forEach(o => {
    const m = calcOrderMetrics(o);
    orderBilledCustomer += m.totalCollectCustomer;
    orderCollectedCustomer += m.customerPaid;
    orderCommittedOut += m.totalPayout;
    orderActualOut += ((o.includeGoodsInFlow && o.partnerPaid) ? m.baseGoodsCostVnd : 0) + (o.warehousePaid ? m.shipCost : 0) + m.extraCost;
    shipCostTotal += m.shipCost;
    shipChargeTotal += m.shipCharge;
    shipProfitTotal += m.shipProfit;
    orderServiceFeeTotal += m.serviceFee;
    fxProfitTotal += m.fxProfit;
    orderExtraCostTotal += m.extraCost;
  });

  const txIn = txs.filter(x => x.type === 'Thu').reduce((a, x) => a + parseNum(x.amount), 0);
  const txOut = txs.filter(x => x.type === 'Chi').reduce((a, x) => a + parseNum(x.amount), 0);
  const txServiceIn = txs.filter(x => x.type === 'Thu' && ['Phí dịch vụ', 'Phí mua hộ'].includes(x.category)).reduce((a, x) => a + parseNum(x.amount), 0);
  const txOtherIn = txs.filter(x => x.type === 'Thu' && !['Phí dịch vụ', 'Phí mua hộ'].includes(x.category)).reduce((a, x) => a + parseNum(x.amount), 0);

  let allCustomerDebt = 0;
  let allWarehouseUnpaid = 0;
  let allPartnerUnpaid = 0;
  (db.orderNotes || []).filter(o => o.status !== 'Đã hủy').forEach(o => {
    const m = calcOrderMetrics(o);
    allCustomerDebt += m.customerDebt;
    allWarehouseUnpaid += m.warehouseDebt;
    allPartnerUnpaid += m.partnerDebt;
  });

  const totalCollectedFromCustomer = orderCollectedCustomer + txIn;
  const totalBilledCustomer = orderBilledCustomer + txIn;
  const totalTransferredOut = orderActualOut + txOut;
  const totalServiceRevenue = orderServiceFeeTotal + txServiceIn;
  const totalIncidentalExpense = orderExtraCostTotal + txOut;
  const netProfit = shipProfitTotal + totalServiceRevenue + fxProfitTotal + txOtherIn - totalIncidentalExpense;

  return {
    orderCount: orders.length,
    txCount: txs.length,
    totalCollectedFromCustomer,
    totalBilledCustomer,
    totalTransferredOut,
    orderCommittedOut: orderCommittedOut + txOut,
    allWarehouseUnpaid,
    allCustomerDebt,
    allPartnerUnpaid,
    shipCostTotal,
    shipChargeTotal,
    shipProfitTotal,
    totalServiceRevenue,
    fxProfitTotal,
    txOtherIn,
    totalIncidentalExpense,
    netProfit
  };
}

// ============================================================================
// BIỂU ĐỒ MÀU SẮC TRỰC QUAN (PURE SVG & CSS - KHÔNG CẦN THƯ VIỆN NGOÀI)
// ============================================================================
function renderProfitDonutChart(s, periodText) {
  const slices = [
    { label: 'Lãi phí vận chuyển', val: Math.max(0, s.shipProfitTotal), color: '#2563eb' },
    { label: 'Doanh thu phí dịch vụ', val: Math.max(0, s.totalServiceRevenue), color: '#10b981' },
    { label: 'Lãi chênh lệch tỷ giá tệ', val: Math.max(0, s.fxProfitTotal), color: '#f59e0b' }
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
        <div class="chart-panel-title">🎨 Cơ cấu nguồn lợi nhuận</div>
        <div class="chart-panel-sub">${esc(periodText)} · Tỷ trọng từng nguồn sinh lời</div>
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
  </div>`;
}

function renderCashflowBarChart(prefix = '') {
  const bucketMap = new Map();
  const useMonthly = prefix.length === 4; // Đang xem theo Năm -> gom theo Tháng

  const getKey = d => {
    const raw = d || dateKey();
    return useMonthly ? raw.slice(0, 7) : raw;
  };
  const ensure = k => {
    if (!bucketMap.has(k)) bucketMap.set(k, { key: k, moneyIn: 0, moneyOut: 0, profit: 0 });
    return bucketMap.get(k);
  };

  (db.orderNotes || []).filter(o => o.status !== 'Đã hủy' && (!prefix || String(o.date || '').startsWith(prefix))).forEach(o => {
    const b = ensure(getKey(o.date));
    const m = calcOrderMetrics(o);
    b.moneyIn += m.customerPaid;
    b.moneyOut += ((o.includeGoodsInFlow && o.partnerPaid) ? m.baseGoodsCostVnd : 0) + (o.warehousePaid ? m.shipCost : 0) + m.extraCost;
    b.profit += m.netProfit;
  });

  (db.transactions || []).filter(x => !prefix || String(x.date || '').startsWith(prefix)).forEach(x => {
    const b = ensure(getKey(x.date));
    const amt = parseNum(x.amount);
    if (x.type === 'Thu') {
      b.moneyIn += amt;
      b.profit += amt;
    } else {
      b.moneyOut += amt;
      b.profit -= amt;
    }
  });

  let buckets = [...bucketMap.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(-6);
  if (!buckets.length) {
    buckets = [{ key: dateKey(), moneyIn: 0, moneyOut: 0, profit: 0 }];
  }

  const maxVal = Math.max(100000, ...buckets.flatMap(b => [b.moneyIn, b.moneyOut, Math.abs(b.profit)]));

  return `<div class="chart-panel">
    <div class="chart-panel-head">
      <div>
        <div class="chart-panel-title">📊 Biểu đồ Thu · Chi · Lợi nhuận</div>
        <div class="chart-panel-sub">So sánh trực quan dòng tiền vào, chuyển ra và lãi ròng (di chuột vào cột để xem số chi tiết)</div>
      </div>
      <div class="chart-legend-inline">
        <span><i class="swatch" style="background:#10b981"></i> Thu vào</span>
        <span><i class="swatch" style="background:#f97316"></i> Chuyển ra</span>
        <span><i class="swatch" style="background:#2563eb"></i> Lợi nhuận</span>
      </div>
    </div>
    <div class="vbar-stage">
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
    </div>
  </div>`;
}

function renderOrderPipelineBar() {
  const activeOrders = (db.orderNotes || []).filter(o => o.status !== 'Đã hủy');
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
        <div class="chart-panel-title">🚚 Tiến độ các Note đơn hiện tại (${activeOrders.length} đơn)</div>
        <div class="chart-panel-sub">Bấm vào từng nhãn màu bên dưới để lọc nhanh danh sách đơn</div>
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

function renderGoodsCategoryChart(prefix = '') {
  const palette = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#0d9488', '#f97316'];
  const map = new Map();

  (db.orderNotes || []).filter(o => o.status !== 'Đã hủy' && (!prefix || String(o.date || '').startsWith(prefix))).forEach(o => {
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
  const list = kind === 'order' ? db.orderNotes : kind === 'shipment' ? db.shipments : db.purchases;
  const item = list.find(x => x.id === id);
  if (!item) return;
  const oldStatus = item.status;
  if (oldStatus === newStatus) return;
  const stamp = nowStamp();
  item.status = newStatus;
  item.updatedAt = stamp;
  if (!Array.isArray(item.history)) item.history = [];
  item.history.unshift({
    time: nowStamp(true),
    action: 'Đổi trạng thái',
    detail: `${oldStatus} → ${newStatus}`
  });
  addAuditLog('Đổi trạng thái', `${kind === 'order' ? 'Note đơn' : kind === 'shipment' ? 'Vận đơn' : 'Mua hộ'} · ${item.customer}`, `${oldStatus} → ${newStatus}`);
  persist();
  render();
  toast(`✓ Đã đổi trạng thái: ${newStatus} (${stamp})`);
}

function settleOrderDebt(id, targetType) {
  const o = db.orderNotes.find(x => x.id === id);
  if (!o) return;
  const m = calcOrderMetrics(o);
  const stamp = nowStamp();
  if (!Array.isArray(o.history)) o.history = [];

  if (targetType === 'customer') {
    o.customerPaid = m.totalCollectCustomer;
    o.updatedAt = stamp;
    o.history.unshift({ time: nowStamp(true), action: 'Thu đủ tiền khách', detail: `Đã thu đủ ${money(m.totalCollectCustomer)} ₫` });
    addAuditLog('Thu đủ công nợ', `Khách ${o.customer}`, `Thu đủ ${money(m.totalCollectCustomer)} ₫ cho đơn ${o.product || o.goodsType}`);
    toast(`✓ Đã xác nhận thu đủ ${money(m.totalCollectCustomer)} ₫ từ ${o.customer}`);
  } else if (targetType === 'warehouse') {
    o.warehousePaid = true;
    o.updatedAt = stamp;
    o.history.unshift({ time: nowStamp(true), action: 'Thanh toán cước kho', detail: `Đã trả kho ${money(m.shipCost)} ₫` });
    addAuditLog('Trả cước kho', `Đơn ${o.customer}`, `Đã thanh toán cước gốc ${money(m.shipCost)} ₫ cho kho`);
    toast(`✓ Đã đánh dấu trả kho ${money(m.shipCost)} ₫`);
  } else if (targetType === 'partner') {
    o.partnerPaid = true;
    o.updatedAt = stamp;
    o.history.unshift({ time: nowStamp(true), action: 'Chuyển tiền hàng', detail: `Đã chuyển vốn hàng ${money(m.baseGoodsCostVnd)} ₫` });
    addAuditLog('Chuyển tiền hàng', `Đơn ${o.customer}`, `Đã thanh toán vốn hàng ${money(m.baseGoodsCostVnd)} ₫`);
    toast(`✓ Đã đánh dấu chuyển tiền hàng ${money(m.baseGoodsCostVnd)} ₫`);
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
  if (view === 'orders') {
    const data = getOrdersViewData();
    area.innerHTML = data.tableHtml;
    if (countEl) countEl.textContent = `${data.filteredCount} / ${data.totalCount} đơn`;
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
      const hasDebt = m.customerDebt > 0 || m.warehouseDebt > 0 || m.partnerDebt > 0;
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
    return m.customerDebt > 0 || m.warehouseDebt > 0 || m.partnerDebt > 0;
  }).length;

  document.getElementById('orderCount').textContent = (db.orderNotes || []).length;
  document.getElementById('shipCount').textContent = (db.shipments || []).length;
  document.getElementById('buyCount').textContent = (db.purchases || []).length;
  document.getElementById('custCount').textContent = customerCount;

  const todoBadge = document.getElementById('todoCount');
  if (todoBadge) {
    todoBadge.textContent = pendingTotal;
    todoBadge.classList.toggle('hidden', pendingTotal === 0);
  }

  const debtBadge = document.getElementById('debtCount');
  if (debtBadge) {
    debtBadge.textContent = debtRecordsCount;
    debtBadge.classList.toggle('hidden', debtRecordsCount === 0);
  }

  const titles = {
    overview: ['Tổng quan trực quan', 'Nắm nhanh lợi nhuận, biểu đồ dòng tiền và những việc cần xử lý ngay.'],
    orders: ['Note đơn · Tính lãi tự động', 'Quản lý đơn Xách tay / Thanh toán hộ, tự tính lãi cước, phí dịch vụ %, lãi tỷ giá tệ và công nợ.'],
    finance: ['Thu chi, Công nợ & Báo cáo AI', 'Theo dõi minh bạch dòng tiền theo Ngày / Tháng / Năm, biểu đồ phân tích và lịch sử chỉnh sửa.'],
    shipments: ['Đơn ký gửi kho', 'Theo dõi mã vận đơn Trung Quốc, tiến độ kho và giao hàng.'],
    purchases: ['Yêu cầu mua hộ', 'Báo giá link sản phẩm, xác nhận thanh toán và chuyển sang tính lãi 1 chạm.'],
    customers: ['Danh bạ khách hàng', 'Tổng hợp số lượng đơn, số điện thoại và công nợ theo từng khách.']
  };

  document.getElementById('pageTitle').textContent = titles[view][0];
  document.getElementById('pageDesc').textContent = titles[view][1];

  const actionsEl = document.getElementById('pageActions');
  if (view === 'overview') {
    actionsEl.innerHTML = `
      <button type="button" class="btn" onclick="openNew('finance')">＋ Ghi thu / chi</button>
      <button id="addBtn" type="button" class="btn primary" onclick="openNew('order')">＋ Tạo Note đơn mới</button>
    `;
  } else if (view === 'orders') {
    actionsEl.innerHTML = `<button id="addBtn" type="button" class="btn primary" onclick="openNew('order')">＋ Tạo Note đơn mới</button>`;
  } else if (view === 'finance') {
    actionsEl.innerHTML = `
      <button type="button" class="btn" onclick="openNew('order')">＋ Note đơn</button>
      <button id="addBtn" type="button" class="btn primary" onclick="openNew('finance')">＋ Ghi khoản thu / chi</button>
    `;
  } else if (view === 'customers') {
    actionsEl.innerHTML = `
      <button type="button" class="btn" onclick="openNew('shipment')">＋ Vận đơn</button>
      <button id="addBtn" type="button" class="btn primary" onclick="openNew('order')">＋ Note đơn cho khách</button>
    `;
  } else {
    const label = view === 'purchases' ? '＋ Thêm yêu cầu mua hộ' : '＋ Thêm vận đơn';
    const kind = view === 'purchases' ? 'purchase' : 'shipment';
    actionsEl.innerHTML = `<button id="addBtn" type="button" class="btn primary" onclick="openNew('${kind}')">${label}</button>`;
  }

  document.getElementById('content').innerHTML =
    view === 'overview' ? overviewPage() :
    view === 'orders' ? ordersPage() :
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
// TRANG 1: TỔNG QUAN TRỰC QUAN (BIỂU ĐỒ MÀU SẮC + VIỆC CẦN LÀM GỌN GÀNG)
// ============================================================================
function overviewPage() {
  const curMonth = dateKey().slice(0, 7);
  const s = calcPeriodFinancials(curMonth);
  const allStats = calcPeriodFinancials('');
  // Nếu tháng hiện tại chưa có đơn nào (ví dụ dữ liệu ở tháng khác), hiển thị biểu đồ toàn thời gian để luôn trực quan
  const chartStats = (s.orderCount > 0 || s.txCount > 0) ? s : allStats;
  const chartPeriodLabel = (s.orderCount > 0 || s.txCount > 0) ? `Tháng ${curMonth.split('-')[1]}/${curMonth.split('-')[0]}` : 'Toàn bộ dữ liệu';

  const allPending = getPendingItems();
  const hasAnyDebt = m => m.customerDebt > 0 || m.warehouseDebt > 0 || m.partnerDebt > 0;
  const filteredPending = allPending.filter(x =>
    todoFilter === 'all' ? true :
    todoFilter === 'debt' ? (x.kind === 'order' && hasAnyDebt(x.metrics)) :
    todoFilter === 'order' ? x.kind === 'order' :
    todoFilter === 'buy' ? x.kind === 'purchase' :
    todoFilter === 'ship' ? x.kind === 'shipment' : true
  );
  const debtOnlyCount = allPending.filter(x => x.kind === 'order' && hasAnyDebt(x.metrics)).length;
  const recentLogs = (db.logs || []).slice(0, 6);

  return `<div class="section-stack">
    <div class="kpi-grid">
      ${kpiCard(
        `Lợi nhuận thực tế (${chartPeriodLabel})`,
        `${chartStats.netProfit >= 0 ? '+' : ''}${money(chartStats.netProfit)} ₫`,
        `Cước +${shortMoney(chartStats.shipProfitTotal)} · DV +${shortMoney(chartStats.totalServiceRevenue)} · Tệ +${shortMoney(chartStats.fxProfitTotal)}`,
        '📈',
        'emerald',
        "openFinanceSubtab('report')"
      )}
      ${kpiCard(
        `Đã thu từ khách (${chartPeriodLabel})`,
        `${money(chartStats.totalCollectedFromCustomer)} ₫`,
        `Tổng phát sinh phải thu: ${money(chartStats.totalBilledCustomer)} ₫`,
        '💰',
        'blue',
        "openFinanceSubtab('cashflow')"
      )}
      ${kpiCard(
        'Khách còn nợ chưa thu',
        `${money(allStats.allCustomerDebt)} ₫`,
        allStats.allWarehouseUnpaid > 0 ? `Cước kho chưa trả: ${money(allStats.allWarehouseUnpaid)} ₫` : '✓ Đã trả hết cước kho',
        '🤝',
        allStats.allCustomerDebt > 0 ? 'rose' : 'amber',
        "openFinanceSubtab('debts')"
      )}
      ${kpiCard(
        'Việc & Đơn đang xử lý',
        `${allPending.length} mục`,
        `${(db.orderNotes || []).length} Note đơn · ${(db.shipments || []).length} Ký gửi · ${(db.purchases || []).length} Mua hộ`,
        '⚡',
        'violet',
        "setView('orders',document.querySelector('[data-view=orders]'))"
      )}
    </div>

    <div class="visual-grid">
      ${renderProfitDonutChart(chartStats, chartPeriodLabel)}
      ${renderCashflowBarChart('')}
    </div>

    ${renderOrderPipelineBar()}

    <div class="overview-split">
      <section class="panel">
        <div class="panel-head">
          <div>
            <div class="panel-title">📌 Việc cần xử lý & Công nợ mở</div>
            <div class="panel-sub">Đổi nhanh trạng thái hoặc bấm "Thu đủ" ngay trên dòng mà không cần mở form</div>
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
                ${linePill(item.lineType)}
                <div class="todo-info">
                  <div class="todo-title">
                    <span>${esc(item.customer)}</span>
                    <span class="code">${esc(item.packages || 1)} kiện · ${esc(item.goodsType)}</span>
                  </div>
                  <div class="todo-meta">
                    Lãi: <b class="income-color">+${money(m.netProfit)} ₫</b>
                    ${m.customerDebt > 0 ? ` · <b class="expense-color">Khách nợ ${money(m.customerDebt)} ₫</b>` : ''}
                    ${m.warehouseDebt > 0 ? ` · <span class="amber-color">Nợ kho ${money(m.warehouseDebt)} ₫</span>` : ''}
                    ${m.partnerDebt > 0 ? ` · <span class="amber-color">Chưa chuyển vốn ${money(m.partnerDebt)} ₫</span>` : ''}
                    ${item.updatedAt ? ` · 🕒 ${esc(item.updatedAt)}` : ''}
                  </div>
                </div>
              </div>
              <div class="todo-right">
                ${statusSelect('order', item.id, item.status, orderStages)}
                ${m.customerDebt > 0 ? `<button type="button" class="iconbtn primary-tint" onclick="settleOrderDebt('${item.id}','customer')">Thu đủ</button>` : ''}
                <button type="button" class="iconbtn" onclick="editRecord('order','${item.id}')">Sửa</button>
              </div>
            </div>`;
          }
          const isShip = item.kind === 'shipment';
          return `<div class="todo-row">
            <div class="todo-left">
              <span class="line-pill line-other">${isShip ? '📦 Ký gửi' : '🛍 Mua hộ'}</span>
              <div class="todo-info">
                <div class="todo-title">
                  <span>${esc(item.customer)}</span>
                  <span class="code">${esc(item.product)}</span>
                </div>
                <div class="todo-meta">${isShip ? `Mã VĐ: ${esc(item.waybill)}` : `Giá: ¥${numFmt(item.value)}${item.quote ? ` · Báo: ¥${numFmt(item.quote)}` : ''}`}${item.updatedAt ? ` · 🕒 ${esc(item.updatedAt)}` : ''}</div>
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
// TRANG 2: MỤC NOTE ĐƠN · BẢNG TÍNH LÃI (5 CỘT THOÁNG ĐÃNG, DỄ ĐỌC)
// ============================================================================
function getOrdersViewData() {
  const q = query.toLowerCase();
  const all = db.orderNotes || [];
  const filtered = all.filter(o => {
    const text = `${o.lineType} ${o.customer} ${o.phone || ''} ${o.code || ''} ${o.waybill || ''} ${o.goodsType} ${o.product || ''} ${o.note || ''} ${o.status}`.toLowerCase();
    if (q && !text.includes(q)) return false;
    if (!window.statusFilter) return true;
    if (window.statusFilter.startsWith('__line_')) return o.lineType === window.statusFilter.replace('__line_', '');
    if (window.statusFilter === '__pipe_wait') return ['Mới tạo / Chờ xử lý', 'Chờ khách thanh toán'].includes(o.status);
    if (window.statusFilter === '__pipe_ship') return ['Đã thanh toán hộ', 'Đang vận chuyển'].includes(o.status);
    if (window.statusFilter === '__pipe_vn') return o.status === 'Đã về kho VN';
    if (window.statusFilter === '__pipe_done') return ['Đã giao khách', 'Hoàn tất / Đã tất toán'].includes(o.status);
    if (window.statusFilter === '__debt') {
      if (o.status === 'Đã hủy') return false;
      const m = calcOrderMetrics(o);
      return m.customerDebt > 0 || m.warehouseDebt > 0 || m.partnerDebt > 0;
    }
    return o.status === window.statusFilter;
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const rows = filtered.map(o => {
    const m = calcOrderMetrics(o);
    const posTotal = Math.max(1, Math.max(0, m.shipProfit) + Math.max(0, m.serviceFee) + Math.max(0, m.fxProfit));
    const wShip = Math.round((Math.max(0, m.shipProfit) / posTotal) * 100);
    const wFee = Math.round((Math.max(0, m.serviceFee) / posTotal) * 100);
    const wFx = Math.max(0, 100 - wShip - wFee);

    return `<tr>
      <td data-label="Khách & Kiện hàng">
        <div class="customer">
          <div class="mini-avatar">${avatar(o.customer)}</div>
          <div>
            <div class="person">${esc(o.customer)} ${linePill(o.lineType)}</div>
            <div class="subline"><b>${esc(o.packages || 1)} kiện</b> · ${esc(o.goodsType)}${o.product ? ' · ' + esc(o.product) : ''}</div>
            <div class="subline">Ngày: ${dateText(o.date)}${o.waybill ? ` · VĐ: <a class="link" target="_blank" rel="noopener" href="https://www.17track.net/en#nums=${encodeURIComponent(o.waybill)}">${esc(o.waybill)} ↗</a>` : ''}</div>
          </div>
        </div>
      </td>
      <td data-label="Giá hàng & Cước VC">
        <div>Hàng: <b>${money(m.finalGoodsVnd)} ₫</b> ${parseNum(o.goodsCny) > 0 ? `<span class="code">¥${numFmt(o.goodsCny)}${parseNum(o.rateSell) > 0 ? ' × ' + money(o.rateSell) : ''}</span>` : ''}</div>
        <div class="subline">Cước thu: <b>${money(m.shipCharge)} ₫</b> (Gốc kho: ${money(m.shipCost)} ₫)</div>
        ${parseNum(o.goodsCny) > 0 && parseNum(o.rateBuy) > 0 ? `<div class="subline">Tỷ giá gốc: ${money(o.rateBuy)} · Báo khách: ${money(o.rateSell)}</div>` : ''}
      </td>
      <td data-label="Phải thu & Công nợ">
        <div>Tổng thu: <b>${money(m.totalCollectCustomer)} ₫</b></div>
        <div>
          ${o.status === 'Đã hủy'
            ? `<span class="code">Đã hủy đơn</span>`
            : m.customerDebt > 0
              ? `<span class="debt-pill owe">Khách nợ ${money(m.customerDebt)} ₫</span>`
              : m.totalCollectCustomer > 0
                ? `<span class="debt-pill ok">✓ Đã thu đủ</span>`
                : `<span class="subline">Chưa nhập phí thu</span>`}
          ${m.warehouseDebt > 0 ? `<span class="debt-pill ware">Nợ kho ${shortMoney(m.warehouseDebt)}</span>` : ''}
          ${m.partnerDebt > 0 ? `<span class="debt-pill ware">Chưa chuyển vốn ${shortMoney(m.partnerDebt)}</span>` : ''}
        </div>
      </td>
      <td data-label="Lợi nhuận thực tế">
        <div class="profit-num ${m.netProfit >= 0 ? 'income-color' : 'expense-color'}">${m.netProfit >= 0 ? '+' : ''}${money(m.netProfit)} ₫</div>
        <div class="mini-profit-bar" title="Xanh dương: Lãi cước · Xanh lá: Phí DV · Vàng: Lãi tệ">
          <span style="width:${wShip}%;background:#3b82f6"></span>
          <span style="width:${wFee}%;background:#10b981"></span>
          <span style="width:${wFx}%;background:#f59e0b"></span>
        </div>
        <div class="subline">
          Cước ${m.shipProfit >= 0 ? '+' : ''}${shortMoney(m.shipProfit)} · DV +${shortMoney(m.serviceFee)}${o.serviceFeePct ? ` (${numFmt(o.serviceFeePct)}%)` : ''}${m.fxProfit ? ` · Tệ +${shortMoney(m.fxProfit)}` : ''}${m.extraCost ? ` · Chi −${shortMoney(m.extraCost)}` : ''}
        </div>
      </td>
      <td data-label="Trạng thái & Thao tác">
        <div style="display:flex;flex-direction:column;align-items:flex-start;gap:6px">
          ${statusSelect('order', o.id, o.status, orderStages)}
          ${o.note ? `<div class="note-box">${esc(o.note)}</div>` : ''}
          ${o.updatedAt ? `<span class="ts-stamp">🕒 ${esc(o.updatedAt)}</span>` : ''}
          <div class="row-actions" style="margin-top:2px">
            ${m.customerDebt > 0 ? `<button type="button" class="iconbtn primary-tint" onclick="settleOrderDebt('${o.id}','customer')">Thu đủ</button>` : ''}
            ${m.warehouseDebt > 0 ? `<button type="button" class="iconbtn" onclick="settleOrderDebt('${o.id}','warehouse')">Trả kho</button>` : ''}
            ${m.partnerDebt > 0 ? `<button type="button" class="iconbtn" onclick="settleOrderDebt('${o.id}','partner')">Đã chuyển tệ</button>` : ''}
            <button type="button" class="iconbtn" onclick="editRecord('order','${o.id}')">Sửa</button>
            <button type="button" class="iconbtn danger-tint" onclick="deleteItemDirect('order','${o.id}')">Xóa</button>
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');

  const headers = '<th>Khách & Kiện hàng</th><th>Giá trị hàng & Cước VC</th><th>Phải thu & Công nợ</th><th>Lợi nhuận thực tế</th><th>Trạng thái, Ghi chú & Thao tác</th>';
  const hasFilter = Boolean(query || window.statusFilter);
  const tableHtml = `<table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>` +
    (rows ? '' : `<div class="empty">
      <div class="empty-ico">${hasFilter ? '🔎' : '🧮'}</div>
      <strong>${hasFilter ? 'Không tìm thấy Note đơn phù hợp' : 'Chưa có Note đơn nào'}</strong>
      <p>${hasFilter ? 'Thử đổi từ khóa hoặc đặt lại bộ lọc.' : 'Tạo Note đơn để tự động tính lãi cước, phí dịch vụ %, lãi tỷ giá tệ và theo dõi công nợ.'}</p>
      <div class="row-actions" style="justify-content:center">
        ${hasFilter
          ? `<button type="button" class="btn small" onclick="clearFilters()">Xóa bộ lọc</button>`
          : `<button type="button" class="btn small primary" onclick="openNew('order')">＋ Tạo Note đơn mới</button>
             <button type="button" class="btn small" onclick="loadSampleOrderNotes()">Tải 2 đơn mẫu</button>`
        }
      </div>
    </div>`);

  return { totalCount: all.length, filteredCount: filtered.length, tableHtml };
}

function ordersPage() {
  const all = db.orderNotes || [];
  const xtCount = all.filter(x => x.lineType === 'Xách tay').length;
  const tthCount = all.filter(x => x.lineType === 'Thanh toán hộ').length;
  const debtCount = all.filter(x => {
    if (x.status === 'Đã hủy') return false;
    const m = calcOrderMetrics(x);
    return m.customerDebt > 0 || m.warehouseDebt > 0 || m.partnerDebt > 0;
  }).length;
  const data = getOrdersViewData();
  const hasFilter = Boolean(query || window.statusFilter);

  return `<div class="section-stack">
    <div class="stage-strip" aria-label="Lọc nhanh theo Line và Công nợ">
      <button type="button" class="chip ${window.statusFilter === '' ? 'active' : ''}" onclick="setFilter('')">Tất cả đơn <span class="chip-count">${all.length}</span></button>
      <button type="button" class="chip ${window.statusFilter === '__line_Xách tay' ? 'active' : ''}" onclick="setFilter('__line_Xách tay')">✈️ Xách tay <span class="chip-count">${xtCount}</span></button>
      <button type="button" class="chip ${window.statusFilter === '__line_Thanh toán hộ' ? 'active' : ''}" onclick="setFilter('__line_Thanh toán hộ')">💴 Thanh toán hộ <span class="chip-count">${tthCount}</span></button>
      <button type="button" class="chip ${window.statusFilter === '__debt' ? 'active' : ''}" onclick="setFilter('__debt')">⚠️ Còn công nợ <span class="chip-count">${debtCount}</span></button>
    </div>

    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Danh sách Note đơn & Minh bạch lãi lỗ</div>
          <div class="panel-sub">Thanh màu dưới số lãi thể hiện tỷ lệ: <b style="color:#2563eb">Lãi cước</b> · <b style="color:#059669">Phí dịch vụ</b> · <b style="color:#d97706">Lãi tỷ giá tệ</b></div>
        </div>
        <span class="result-count" id="resultCount">${data.filteredCount} / ${data.totalCount} đơn</span>
      </div>
      <div class="filters">
        <div class="search">
          <span class="search-ico" aria-hidden="true">⌕</span>
          <input id="searchInput" class="field" placeholder="Tìm khách hàng, loại hàng (quần áo, mỹ phẩm...), ghi chú…" value="${esc(query)}" oninput="handleSearch(this)">
          <button type="button" id="searchClearBtn" class="search-clear ${query ? '' : 'hidden'}" onclick="clearSearchInput()" title="Xóa từ khóa">×</button>
        </div>
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
// TRANG 3: THU CHI, CÔNG NỢ, BÁO CÁO AI & LỊCH SỬ (GỘP GỌN THÀNH 4 TAB RÕ RÀNG)
// ============================================================================
function renderPeriodPicker() {
  return `<div class="period-bar">
    <button type="button" class="chip ${periodMode === 'day' ? 'active' : ''}" onclick="periodMode='day';render()">Ngày</button>
    <button type="button" class="chip ${periodMode === 'month' ? 'active' : ''}" onclick="periodMode='month';render()">Tháng</button>
    <button type="button" class="chip ${periodMode === 'year' ? 'active' : ''}" onclick="periodMode='year';render()">Năm</button>
    <button type="button" class="chip ${periodMode === 'all' ? 'active' : ''}" onclick="periodMode='all';render()">Tất cả</button>
    ${periodMode === 'day' ? `<input type="date" class="field" style="padding:5px 9px" value="${esc(periodDate)}" onchange="periodDate=this.value;render()">` : ''}
    ${periodMode === 'month' ? `<input type="month" class="field" style="padding:5px 9px" value="${esc(periodMonth)}" onchange="periodMonth=this.value;render()">` : ''}
    ${periodMode === 'year' ? `<input type="number" class="field" style="padding:5px 9px;width:92px" min="2020" max="2100" value="${esc(periodYear)}" onchange="periodYear=this.value;render()">` : ''}
  </div>`;
}

function getFinanceViewData() {
  const prefix = getActivePeriodPrefix();
  const q = query.toLowerCase();
  const items = (db.transactions || [])
    .filter(x => (!prefix || String(x.date || '').startsWith(prefix)) && (`${x.type} ${x.category} ${x.party} ${x.related} ${x.method} ${x.note}`.toLowerCase().includes(q)) && (!window.statusFilter || x.type === window.statusFilter))
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

function getDailyBreakdown(prefix) {
  const map = new Map();
  const ensure = d => {
    if (!map.has(d)) map.set(d, { date: d, orders: 0, collected: 0, shipFee: 0, serviceFee: 0, extra: 0, profit: 0 });
    return map.get(d);
  };

  (db.orderNotes || []).filter(o => o.status !== 'Đã hủy' && (!prefix || String(o.date || '').startsWith(prefix))).forEach(o => {
    const d = o.date || dateKey();
    const row = ensure(d);
    const m = calcOrderMetrics(o);
    row.orders++;
    row.collected += m.totalCollectCustomer;
    row.shipFee += m.shipCharge;
    row.serviceFee += m.serviceFee;
    row.extra += m.extraCost;
    row.profit += m.netProfit;
  });

  (db.transactions || []).filter(x => !prefix || String(x.date || '').startsWith(prefix)).forEach(x => {
    const d = x.date || dateKey();
    const row = ensure(d);
    const amt = parseNum(x.amount);
    if (x.type === 'Thu') {
      row.collected += amt;
      if (['Phí dịch vụ', 'Phí mua hộ'].includes(x.category)) row.serviceFee += amt;
      row.profit += amt;
    } else {
      row.extra += amt;
      row.profit -= amt;
    }
  });

  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function buildAiInsights(s) {
  const insights = [];
  insights.push(`Kỳ <b>${esc(getPeriodLabel())}</b>: Lợi nhuận thực tế đạt <b class="${s.netProfit >= 0 ? 'income-color' : 'expense-color'}">${s.netProfit >= 0 ? '+' : ''}${money(s.netProfit)} ₫</b> (tổng hợp từ <b>${s.orderCount}</b> Note đơn và <b>${s.txCount}</b> giao dịch sổ thu chi).`);

  const sources = [
    { name: 'Lãi phí vận chuyển', val: s.shipProfitTotal },
    { name: 'Doanh thu phí dịch vụ', val: s.totalServiceRevenue },
    { name: 'Chênh lệch tỷ giá tệ', val: s.fxProfitTotal }
  ].sort((a, b) => b.val - a.val);

  if (sources[0].val > 0) {
    insights.push(`Nguồn đóng góp lãi cao nhất là <b>${sources[0].name} (+${money(sources[0].val)} ₫)</b>.`);
  }

  const lossOrders = (db.orderNotes || []).filter(o => o.status !== 'Đã hủy' && calcOrderMetrics(o).netProfit < 0);
  if (lossOrders.length > 0) {
    insights.push(`<span class="expense-color"><b>Cảnh báo kiểm tra:</b> Có <b>${lossOrders.length} đơn</b> đang bị âm lợi nhuận (${lossOrders.map(x => esc(x.customer)).join(', ')}) — hãy kiểm tra lại cước thu khách hoặc phụ phí phát sinh.</span>`);
  }

  if (s.allCustomerDebt > 0 || s.allWarehouseUnpaid > 0 || s.allPartnerUnpaid > 0) {
    insights.push(`Công nợ cần lưu ý: Khách còn nợ <b>${money(s.allCustomerDebt)} ₫</b> · Cước kho chưa thanh toán <b>${money(s.allWarehouseUnpaid)} ₫</b>${s.allPartnerUnpaid > 0 ? ` · Tiền hàng chưa chuyển <b>${money(s.allPartnerUnpaid)} ₫</b>` : ''}.`);
  } else {
    insights.push(`Tuyệt vời: Tất cả công nợ khách hàng và tiền cước kho đều đã được tất toán sạch sẽ.`);
  }
  return insights;
}

function financePage() {
  const prefix = getActivePeriodPrefix();
  const s = calcPeriodFinancials(prefix);
  const debtOrdersCount = (db.orderNotes || []).filter(o => {
    if (o.status === 'Đã hủy') return false;
    const m = calcOrderMetrics(o);
    return m.customerDebt > 0 || m.warehouseDebt > 0 || m.partnerDebt > 0;
  }).length;

  const topToolbar = `<div class="toolbar-row">
    <div class="subtabs" role="tablist" aria-label="Chế độ xem tài chính">
      <button type="button" class="subtab ${financeTab === 'cashflow' ? 'active' : ''}" onclick="financeTab='cashflow';query='';window.statusFilter='';render()">💰 Thu chi & Dòng tiền</button>
      <button type="button" class="subtab ${financeTab === 'debts' ? 'active' : ''}" onclick="financeTab='debts';render()">🤝 Công nợ Khách & Kho ${debtOrdersCount ? `<span class="subtab-badge">${debtOrdersCount}</span>` : ''}</button>
      <button type="button" class="subtab ${financeTab === 'report' ? 'active' : ''}" onclick="financeTab='report';render()">📊 Báo cáo & Biểu đồ AI</button>
      <button type="button" class="subtab ${financeTab === 'history' ? 'active' : ''}" onclick="financeTab='history';query='';render()">🕒 Lịch sử sửa (${(db.logs || []).length})</button>
    </div>
    ${financeTab !== 'debts' && financeTab !== 'history' ? renderPeriodPicker() : ''}
  </div>`;

  if (financeTab === 'cashflow') {
    const data = getFinanceViewData();
    const hasFilter = Boolean(query || window.statusFilter);
    return `<div class="section-stack">
      ${topToolbar}
      <div class="cashflow-grid">
        <div class="cash-card">
          <span class="cash-label">1. Tổng tiền thu từ khách (${esc(getPeriodLabel())})</span>
          <strong class="cash-val income-color">+${money(s.totalCollectedFromCustomer)} ₫</strong>
          <span class="cash-sub">Tổng phát sinh phải thu: ${money(s.totalBilledCustomer)} ₫</span>
        </div>
        <div class="cash-card">
          <span class="cash-label">2. Tổng tiền chuyển ra (${esc(getPeriodLabel())})</span>
          <strong class="cash-val expense-color">−${money(s.totalTransferredOut)} ₫</strong>
          <span class="cash-sub">Tổng cam kết vốn + kho + chi: ${money(s.orderCommittedOut)} ₫</span>
        </div>
        <div class="cash-card">
          <span class="cash-label">3. Tiền vận chuyển phải thanh toán cho kho</span>
          <strong class="cash-val ${s.allWarehouseUnpaid > 0 ? 'amber-color' : ''}">${money(s.allWarehouseUnpaid)} ₫</strong>
          <span class="cash-sub">Tổng cước gốc phát sinh kỳ này: ${money(s.shipCostTotal)} ₫</span>
        </div>
        <div class="cash-card">
          <span class="cash-label">4. Doanh thu phí dịch vụ</span>
          <strong class="cash-val blue-color">+${money(s.totalServiceRevenue)} ₫</strong>
          <span class="cash-sub">Lãi cước: +${money(s.shipProfitTotal)} ₫ · Lãi tệ: +${money(s.fxProfitTotal)} ₫</span>
        </div>
        <div class="cash-card">
          <span class="cash-label">5. Chi phí phát sinh</span>
          <strong class="cash-val expense-color">−${money(s.totalIncidentalExpense)} ₫</strong>
          <span class="cash-sub">Gồm phụ phí trên đơn & chi phí ngoài sổ</span>
        </div>
        <div class="cash-card profit-highlight">
          <span class="cash-label">6. LỢI NHUẬN THỰC TẾ (${esc(getPeriodLabel())})</span>
          <strong class="cash-val ${s.netProfit >= 0 ? 'income-color' : 'expense-color'}">${s.netProfit >= 0 ? '+' : ''}${money(s.netProfit)} ₫</strong>
          <span class="cash-sub">= Lãi cước + Phí DV + Lãi tệ${s.txOtherIn > 0 ? ' + Thu khác' : ''} − Chi phí phát sinh</span>
        </div>
      </div>

      ${renderCashflowBarChart(prefix)}

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
        cur.debt += m.customerDebt;
        cur.orders.push({ id: o.id, label: o.product || o.goodsType, amount: m.customerDebt });
      }
    });

    const partnerDebts = (db.orderNotes || []).filter(o => {
      if (o.status === 'Đã hủy') return false;
      const m = calcOrderMetrics(o);
      return m.warehouseDebt > 0 || m.partnerDebt > 0;
    });

    return `<div class="section-stack">
      ${topToolbar}
      <div class="debt-grid">
        <section class="panel">
          <div class="panel-head">
            <div>
              <div class="panel-title">📥 Công nợ Khách hàng (Phải thu)</div>
              <div class="panel-sub">Tổng tiền khách còn nợ: <b class="expense-color">${money(s.allCustomerDebt)} ₫</b></div>
            </div>
          </div>
          ${custDebtList.length ? custDebtList.map(c => `<div class="todo-row">
            <div class="todo-left">
              <div class="mini-avatar">${avatar(c.customer)}</div>
              <div class="todo-info">
                <div class="todo-title">${esc(c.customer)} ${c.phone ? `<span class="code">${esc(c.phone)}</span>` : ''}</div>
                <div class="todo-meta">${c.orders.map(x => `${esc(x.label)} (${money(x.amount)} ₫)`).join(' · ')}</div>
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
              <div class="panel-title">📤 Công nợ Kho & Đối tác (Phải trả)</div>
              <div class="panel-sub">Nợ cước kho: <b class="amber-color">${money(s.allWarehouseUnpaid)} ₫</b> · Nợ vốn hàng: <b>${money(s.allPartnerUnpaid)} ₫</b></div>
            </div>
          </div>
          ${partnerDebts.length ? partnerDebts.map(o => {
            const m = calcOrderMetrics(o);
            return `<div class="todo-row">
              <div class="todo-info">
                <div class="todo-title">${esc(o.product || o.goodsType)} <span class="code">Khách: ${esc(o.customer)}</span></div>
                <div class="todo-meta">
                  ${m.warehouseDebt > 0 ? `Cước kho chưa trả: <b class="amber-color">${money(m.warehouseDebt)} ₫</b> ` : ''}
                  ${m.partnerDebt > 0 ? `· Vốn hàng chưa chuyển: <b>${money(m.partnerDebt)} ₫</b>` : ''}
                </div>
              </div>
              <div class="todo-right">
                ${m.warehouseDebt > 0 ? `<button type="button" class="iconbtn primary-tint" onclick="settleOrderDebt('${o.id}','warehouse')">Trả kho</button>` : ''}
                ${m.partnerDebt > 0 ? `<button type="button" class="iconbtn" onclick="settleOrderDebt('${o.id}','partner')">Đã chuyển tệ</button>` : ''}
                <button type="button" class="iconbtn" onclick="editRecord('order','${o.id}')">Sửa</button>
              </div>
            </div>`;
          }).join('') : '<div class="empty"><p>✓ Đã thanh toán hết tiền cước kho và đối tác.</p></div>'}
        </section>
      </div>
    </div>`;
  }

  if (financeTab === 'report') {
    const monthPrefix = periodMode === 'month' ? periodMonth : dateKey().slice(0, 7);
    const monthStats = calcPeriodFinancials(monthPrefix);
    const dailyRows = getDailyBreakdown(prefix);
    const insights = buildAiInsights(s);

    const sumOrders = dailyRows.reduce((a, r) => a + r.orders, 0);
    const sumCollected = dailyRows.reduce((a, r) => a + r.collected, 0);
    const sumShip = dailyRows.reduce((a, r) => a + r.shipFee, 0);
    const sumFee = dailyRows.reduce((a, r) => a + r.serviceFee, 0);
    const sumExtra = dailyRows.reduce((a, r) => a + r.extra, 0);
    const sumProfit = dailyRows.reduce((a, r) => a + r.profit, 0);

    return `<div class="section-stack">
      ${topToolbar}
      <div class="ai-banner">
        <div class="ai-banner-title">🤖 AI Tự Động Tính Toán & Phân Tích Dòng Tiền</div>
        <ul class="ai-banner-list">
          ${insights.map(line => `<li>${line}</li>`).join('')}
        </ul>
      </div>

      <div class="cashflow-grid">
        <div class="cash-card">
          <span class="cash-label">Tổng phí vận chuyển thu khách (${monthPrefix})</span>
          <strong class="cash-val blue-color">${money(monthStats.shipChargeTotal)} ₫</strong>
          <span class="cash-sub">Cước gốc kho: ${money(monthStats.shipCostTotal)} ₫ · Lãi cước: +${money(monthStats.shipProfitTotal)} ₫</span>
        </div>
        <div class="cash-card">
          <span class="cash-label">Tổng phí dịch vụ (${esc(getPeriodLabel())})</span>
          <strong class="cash-val income-color">+${money(s.totalServiceRevenue)} ₫</strong>
          <span class="cash-sub">Lãi chênh lệch tỷ giá tệ: +${money(s.fxProfitTotal)} ₫</span>
        </div>
        <div class="cash-card">
          <span class="cash-label">Tổng chi phí phát sinh (${esc(getPeriodLabel())})</span>
          <strong class="cash-val expense-color">−${money(s.totalIncidentalExpense)} ₫</strong>
          <span class="cash-sub">Lợi nhuận ròng: <b class="${s.netProfit >= 0 ? 'income-color' : 'expense-color'}">${s.netProfit >= 0 ? '+' : ''}${money(s.netProfit)} ₫</b></span>
        </div>
      </div>

      <div class="visual-grid">
        ${renderProfitDonutChart(s, getPeriodLabel())}
        ${renderGoodsCategoryChart(prefix)}
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
  const filtered = (db.shipments || []).filter(o => {
    const matchQ = `${o.customer} ${o.code} ${o.waybill} ${o.product} ${o.phone} ${o.note || ''}`.toLowerCase().includes(q);
    const matchStatus = !window.statusFilter ? true : window.statusFilter === '__active' ? o.status !== 'Đã giao khách' : o.status === window.statusFilter;
    return matchQ && matchStatus;
  });

  const rows = filtered.map(o => {
    const linkedOrder = (db.orderNotes || []).find(x =>
      x.sourceShipmentId === o.id ||
      (o.sourcePurchaseId && x.sourcePurchaseId === o.sourcePurchaseId) ||
      (o.waybill && x.waybill === o.waybill)
    );
    return `<tr>
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
  const counts = stageCounts(db.shipments, shipStages);
  const activeCount = (db.shipments || []).filter(o => o.status !== 'Đã giao khách').length;
  const data = getShipmentsViewData();
  return `<div class="section-stack">
    <div class="stage-strip" aria-label="Lọc nhanh trạng thái vận đơn">
      <button type="button" class="chip ${window.statusFilter === '' ? 'active' : ''}" onclick="setFilter('')">Tất cả <span class="chip-count">${(db.shipments || []).length}</span></button>
      <button type="button" class="chip ${window.statusFilter === '__active' ? 'active' : ''}" onclick="setFilter('__active')">Cần theo dõi <span class="chip-count">${activeCount}</span></button>
      ${counts.filter(c => c.value > 0).map(c => `<button type="button" class="chip ${window.statusFilter === c.label ? 'active' : ''}" onclick="setFilter('${esc(c.label)}')">${esc(c.label)} <span class="chip-count">${c.value}</span></button>`).join('')}
    </div>
    ${tableShell('Danh sách đơn ký gửi', 'Bấm trực tiếp vào nhãn trạng thái để đổi nhanh; mọi ghi chú tự gắn giờ ngày tháng năm.', 'Tìm tên khách, mã DR, SĐT, mã vận đơn, sản phẩm…', shipStages, data.tableHtml, data.totalCount, data.filteredCount)}
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
    const matchQ = `${o.customer} ${o.code} ${o.product} ${o.phone} ${o.variant || ''} ${o.note || ''}`.toLowerCase().includes(q);
    const matchStatus = !window.statusFilter ? true : window.statusFilter === '__active' ? !['Đặt hàng thành công', 'Đã hủy'].includes(o.status) : o.status === window.statusFilter;
    return matchQ && matchStatus;
  });

  const rows = filtered.map(o => {
    const linkedOrder = (db.orderNotes || []).find(x => x.sourcePurchaseId === o.id);
    const linkedShip = (db.shipments || []).find(x => x.sourcePurchaseId === o.id);
    return `<tr>
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
      <div class="subline">${esc(o.variant || 'Chưa chọn phân loại')}</div>
      ${o.note ? `<div class="note-box">${esc(o.note)}</div>` : ''}
      ${o.updatedAt ? `<span class="ts-stamp">🕒 ${esc(o.updatedAt)}</span>` : ''}
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
  const counts = stageCounts(db.purchases, buyStages);
  const activeCount = (db.purchases || []).filter(o => !['Đặt hàng thành công', 'Đã hủy'].includes(o.status)).length;
  const data = getPurchasesViewData();
  return `<div class="section-stack">
    <div class="stage-strip" aria-label="Lọc nhanh trạng thái mua hộ">
      <button type="button" class="chip ${window.statusFilter === '' ? 'active' : ''}" onclick="setFilter('')">Tất cả <span class="chip-count">${(db.purchases || []).length}</span></button>
      <button type="button" class="chip ${window.statusFilter === '__active' ? 'active' : ''}" onclick="setFilter('__active')">Cần xử lý <span class="chip-count">${activeCount}</span></button>
      ${counts.filter(c => c.value > 0).map(c => `<button type="button" class="chip ${window.statusFilter === c.label ? 'active' : ''}" onclick="setFilter('${esc(c.label)}')">${esc(c.label)} <span class="chip-count">${c.value}</span></button>`).join('')}
    </div>
    ${tableShell('Danh sách yêu cầu mua hộ', 'Bấm "＋ Tính lãi" để đưa đơn sang bảng Note đơn tính cước, phí dịch vụ % và chênh lệch tỷ giá.', 'Tìm khách hàng, mã DR, tên sản phẩm hoặc ghi chú…', buyStages, data.tableHtml, data.totalCount, data.filteredCount)}
  </div>`;
}

function getCustomersViewData() {
  const q = query.toLowerCase();
  const allCustomers = uniqueCustomers();
  const customers = allCustomers.filter(o => `${o.customer} ${o.code} ${o.phone} ${o.address}`.toLowerCase().includes(q));

  const rows = customers.map(o => {
    const custOrders = (db.orderNotes || []).filter(x => sameCustomer(x, o));
    const oc = custOrders.length;
    const sc = (db.shipments || []).filter(x => sameCustomer(x, o)).length;
    const pc = (db.purchases || []).filter(x => sameCustomer(x, o)).length;
    const activeCustOrders = custOrders.filter(x => x.status !== 'Đã hủy');
    const debt = activeCustOrders.reduce((sum, x) => sum + calcOrderMetrics(x).customerDebt, 0);
    const totalProfit = activeCustOrders.reduce((sum, x) => sum + calcOrderMetrics(x).netProfit, 0);
    const custKey = jsArg(o.code || o.phone || o.customer);

    return `<tr>
      <td data-label="Khách hàng">
        <div class="customer">
          <div class="mini-avatar">${avatar(o.customer)}</div>
          <div>
            <div class="person">${esc(o.customer)} <span class="code">${esc(o.code || '—')}</span></div>
            <div>
              ${debt > 0 ? `<span class="debt-pill owe">Đang nợ ${money(debt)} ₫</span>` : '<span class="debt-pill ok">✓ Không nợ</span>'}
              ${oc > 0 ? `<span class="subline" style="margin-left:6px">Lãi tích lũy: <b class="${totalProfit >= 0 ? 'income-color' : 'expense-color'}">${totalProfit >= 0 ? '+' : ''}${money(totalProfit)} ₫</b></span>` : ''}
            </div>
          </div>
        </div>
      </td>
      <td data-label="Số điện thoại">${esc(o.phone || 'Chưa cập nhật')}</td>
      <td data-label="Địa chỉ nhận">${esc(o.address || 'Chưa nhập địa chỉ')}</td>
      <td data-label="Tổng đơn"><b>${oc}</b> note đơn · <b>${sc}</b> vận đơn · <b>${pc}</b> mua hộ</td>
      <td data-label="Thao tác nhanh">
        <div class="row-actions">
          ${oc > 0 ? `<button type="button" class="iconbtn" onclick="viewCustomerOrders('${jsArg(o.customer)}')">Xem đơn</button>` : ''}
          <button type="button" class="iconbtn primary-tint" onclick="openForCustomer('order','${custKey}')">＋ Note đơn</button>
          <button type="button" class="iconbtn" onclick="openForCustomer('shipment','${custKey}')">＋ Vận đơn</button>
          <button type="button" class="iconbtn" onclick="openForCustomer('purchase','${custKey}')">＋ Mua hộ</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  return {
    totalCount: allCustomers.length,
    filteredCount: customers.length,
    tableHtml: renderTableInner('<th>Khách hàng & Công nợ</th><th>Số điện thoại</th><th>Địa chỉ nhận hàng</th><th>Số lượng đơn</th><th>Thao tác nhanh</th>', rows, 'customers')
  };
}

function customersPage() {
  const data = getCustomersViewData();
  return `<div class="section-stack">
    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Danh bạ khách hàng & Công nợ</div>
          <div class="panel-sub">Tổng hợp tự động từ Note đơn, Đơn ký gửi và Mua hộ.</div>
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
  </div>`;
}

// ============================================================================
// BIỂU MẪU (MODAL) GỌN GÀNG THEO TỪNG BƯỚC & LƯU AN TOÀN TUYỆT ĐỐI
// ============================================================================
function markFormDirty() {
  formDirty = true;
  hideFormError();
  if (document.getElementById('recordForm')?.dataset.kind === 'order') {
    updateOrderCalcPreview();
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

function openNew(kind = view === 'purchases' ? 'purchase' : view === 'finance' ? 'finance' : view === 'shipments' ? 'shipment' : 'order') {
  const form = document.getElementById('recordForm');
  form.reset();
  form.dataset.kind = kind;
  form.dataset.id = '';
  formDirty = false;
  hideFormError();
  document.getElementById('modalBox')?.classList.toggle('wide', kind === 'order');

  document.getElementById('modalTitle').textContent =
    kind === 'order' ? 'Tạo Note đơn & Tính lãi tự động' :
    kind === 'purchase' ? 'Thêm yêu cầu mua hộ' :
    kind === 'finance' ? 'Ghi khoản thu / chi' :
    'Thêm đơn ký gửi';
  document.getElementById('modalSub').textContent = 'Gõ số bình thường (500000 hoặc 500.000 đều được); tự động lưu thời gian cập nhật.';
  document.getElementById('deleteZone').classList.add('hidden');
  document.getElementById('recordHistoryZone').classList.add('hidden');
  cancelDeleteModal();

  renderFields(kind, {});
  if (kind === 'order') updateOrderCalcPreview();
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
  const list = kind === 'order' ? db.orderNotes : kind === 'shipment' ? db.shipments : kind === 'purchase' ? db.purchases : db.transactions;
  const o = (list || []).find(x => x.id === id);
  if (!o) return;

  const form = document.getElementById('recordForm');
  form.dataset.kind = kind;
  form.dataset.id = id;
  formDirty = false;
  hideFormError();
  document.getElementById('modalBox')?.classList.toggle('wide', kind === 'order');

  document.getElementById('modalTitle').textContent =
    kind === 'order' ? 'Cập nhật Note đơn & Bảng tính' :
    kind === 'purchase' ? 'Cập nhật yêu cầu mua hộ' :
    kind === 'finance' ? 'Cập nhật khoản thu / chi' :
    'Cập nhật đơn ký gửi';
  document.getElementById('modalSub').textContent = o.updatedAt ? `Lần sửa gần nhất: ${o.updatedAt}` : 'Chỉnh sửa thông tin rồi bấm Lưu.';
  document.getElementById('deleteZone').classList.remove('hidden');
  cancelDeleteModal();

  renderFields(kind, o);
  if (kind === 'order') updateOrderCalcPreview();
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
  const chk = document.getElementById('f_includeGoodsInFlow');
  if (chk) chk.checked = isTth;
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
    inp.value = String(m.totalCollectCustomer);
    formDirty = true;
    updateOrderCalcPreview();
  }
}

function readDraftOrderFromForm() {
  return {
    lineType: val('lineType') || 'Xách tay',
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
    includeGoodsInFlow: Boolean(document.getElementById('f_includeGoodsInFlow')?.checked),
    shipCost: parseNum(val('shipCost')),
    shipCharge: parseNum(val('shipCharge')),
    serviceFeePct: parseNum(val('serviceFeePct')),
    serviceFeeManual: parseNum(val('serviceFeeManual')),
    rateBuy: parseNum(val('rateBuy')),
    rateSell: parseNum(val('rateSell')),
    extraCost: parseNum(val('extraCost')),
    customerPaid: parseNum(val('customerPaid')),
    warehousePaid: Boolean(document.getElementById('f_warehousePaid')?.checked),
    partnerPaid: Boolean(document.getElementById('f_partnerPaid')?.checked),
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

  const posTotal = Math.max(1, Math.max(0, m.shipProfit) + Math.max(0, m.serviceFee) + Math.max(0, m.fxProfit));
  const wShip = Math.round((Math.max(0, m.shipProfit) / posTotal) * 100);
  const wFee = Math.round((Math.max(0, m.serviceFee) / posTotal) * 100);
  const wFx = Math.max(0, 100 - wShip - wFee);

  zone.innerHTML = `<div class="ai-calc-box ${m.netProfit < 0 ? 'loss' : ''}">
    <div class="ai-calc-top">
      <div>
        <strong style="font-size:13.5px">🤖 Lợi nhuận thực tế đơn này: <span class="${m.netProfit >= 0 ? 'income-color' : 'expense-color'}" style="font-size:17px">${m.netProfit >= 0 ? '+' : ''}${money(m.netProfit)} ₫</span></strong>
      </div>
      <span style="font-size:12px;color:var(--muted)">Phải thu khách: <b>${money(m.totalCollectCustomer)} ₫</b> · ${m.customerDebt > 0 ? `<b class="expense-color">Còn nợ ${money(m.customerDebt)} ₫</b>` : m.totalCollectCustomer > 0 ? '<b class="income-color">✓ Đã thu đủ</b>' : '<span>Chưa phát sinh phải thu</span>'}</span>
    </div>
    <div class="pipeline-track" style="height:8px">
      <div style="width:${wShip}%;background:#3b82f6"></div>
      <div style="width:${wFee}%;background:#10b981"></div>
      <div style="width:${wFx}%;background:#f59e0b"></div>
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
        <span>🟡 Lãi tỷ giá tệ</span>
        <b class="amber-color">${m.fxProfit >= 0 ? '+' : ''}${money(m.fxProfit)} ₫</b>
      </div>
    </div>
  </div>`;
}

function renderFields(kind, o) {
  if (kind === 'order') {
    const line = o.lineType || 'Xách tay';
    const pkg = o.packages ?? 1;
    const includeGoods = o.includeGoodsInFlow !== undefined ? o.includeGoodsInFlow : ['Thanh toán hộ', 'Mua hộ trọn gói'].includes(line);
    showCnyBox = Boolean(parseNum(o.goodsCny) > 0 || ['Thanh toán hộ', 'Mua hộ trọn gói'].includes(line));

    const lineChoices = [
      { val: 'Xách tay', label: '✈️ Xách tay' },
      { val: 'Thanh toán hộ', label: '💴 Thanh toán hộ' },
      { val: 'Ký gửi kho', label: '📦 Ký gửi kho' },
      { val: 'Mua hộ trọn gói', label: '🛍 Mua hộ trọn gói' }
    ];

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
        ${field('product', 'Tên mặt hàng / SĐT phụ', o.product || '', 'text', false, false, 'Ví dụ: Áo khoác, Máy mài…')}
        ${field('phone', 'Số điện thoại khách', o.phone || '', 'tel', false, false, '09xx xxx xxx')}
        ${field('date', 'Ngày đơn hàng', o.date || dateKey(), 'date', true)}
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
          <span>3. Cước vận chuyển, Thanh toán & Ghi chú</span>
        </div>
        ${field('shipCost', 'Cước vận chuyển gốc trả kho (₫)', o.shipCost ?? '', 'money', false, false, 'VD: 120000')}
        ${field('shipCharge', 'Cước vận chuyển thu khách (₫)', o.shipCharge ?? '', 'money', false, false, 'VD: 180000')}
        <div>
          <label for="f_customerPaid">Tiền khách đã thanh toán (₫)</label>
          <div class="input-with-btn">
            <input id="f_customerPaid" class="field" type="text" inputmode="decimal" value="${esc(o.customerPaid ?? '')}" placeholder="0 (hoặc số tiền khách cọc)">
            <button type="button" class="btn small primary" onclick="fillFullCustomerPay()">Thu đủ</button>
          </div>
        </div>
        ${field('extraCost', 'Chi phí phát sinh thêm (₫)', o.extraCost || '', 'money', false, false, 'Đóng gỗ, ship phụ…')}

        <div class="check-pills">
          <label class="check-pill">
            <input type="checkbox" id="f_includeGoodsInFlow" ${includeGoods ? 'checked' : ''} onchange="updateOrderCalcPreview()">
            <span>Thu & trả hộ cả tiền hàng</span>
          </label>
          <label class="check-pill">
            <input type="checkbox" id="f_warehousePaid" ${o.warehousePaid ? 'checked' : ''} onchange="updateOrderCalcPreview()">
            <span>Đã trả cước kho</span>
          </label>
          <label class="check-pill">
            <input type="checkbox" id="f_partnerPaid" ${o.partnerPaid !== false ? 'checked' : ''} onchange="updateOrderCalcPreview()">
            <span>Đã chuyển vốn hàng</span>
          </label>
        </div>

        ${selectField('status', 'Trạng thái đơn hàng', orderStages, o.status || orderStages[0], true)}
        <div class="full">
          <label for="f_note">Ghi chú (Tự động gắn [Giờ:Phút - Ngày/Tháng/Năm] ở cuối khi lưu)</label>
          <textarea id="f_note" class="field" placeholder="Nhập ghi chú đơn hàng…">${esc(o.note || '')}</textarea>
        </div>
      </div>
    `;
    return;
  }

  if (kind === 'finance') {
    const cats = ['Phí dịch vụ', 'Phí mua hộ', 'Cước vận chuyển', 'Chi phí phát sinh', 'Tiền mua hàng', 'Đóng gói', 'Hoàn tiền', 'Đi lại', 'Ăn uống', 'Công cụ', 'Khác'];
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
    selectField('platform', 'Nền tảng mua hàng', ['Taobao', '1688', 'Pinduoduo', 'Poizon', 'Khác'], o.platform || 'Taobao') +
    field('address', 'Địa chỉ nhận hàng', o.address || '', 'text', false, true, 'Địa chỉ giao hàng tại Việt Nam');

  if (kind === 'shipment') {
    s +=
      field('waybill', 'Mã vận đơn Trung Quốc', o.waybill || '', 'text', true, false, 'SF..., YT..., ZTO...') +
      field('product', 'Tên sản phẩm', o.product || '', 'text', true, false, 'Ví dụ: Áo khoác dạ') +
      field('qty', 'Số lượng', o.qty ?? 1, 'decimal') +
      field('value', 'Giá trị hàng (¥)', o.value ?? '', 'decimal', false, false, 'Ví dụ: 168.5') +
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
  if (prev.packages !== next.packages) diffs.push(`Số kiện: ${prev.packages} → ${next.packages}`);
  if (prev.status !== next.status) diffs.push(`Trạng thái: ${prev.status} → ${next.status}`);
  if (prev.shipCharge !== next.shipCharge || prev.shipCost !== next.shipCost) diffs.push(`Cước (Gốc ${money(next.shipCost)} / Thu ${money(next.shipCharge)} ₫)`);
  if (prev.rateBuy !== next.rateBuy || prev.rateSell !== next.rateSell || prev.goodsCny !== next.goodsCny) diffs.push('Tệ/Tỷ giá cập nhật');
  if (prev.customerPaid !== next.customerPaid) diffs.push(`Khách trả: ${money(prev.customerPaid)} → ${money(next.customerPaid)} ₫`);
  if (prev.warehousePaid !== next.warehousePaid) diffs.push(next.warehousePaid ? 'Đã trả kho' : 'Chưa trả kho');
  if (prev.partnerPaid !== next.partnerPaid) diffs.push(next.partnerPaid ? 'Đã chuyển vốn hàng' : 'Chưa chuyển vốn hàng');
  if ((prev.note || '') !== (next.note || '')) diffs.push('Cập nhật ghi chú');
  return diffs.length ? diffs.join(' · ') : 'Lưu cập nhật thông tin đơn';
}

function saveRecord(e) {
  e.preventDefault();
  hideFormError();
  const form = e.currentTarget;
  const kind = form.dataset.kind;
  const id = form.dataset.id;
  const stamp = nowStamp();
  const stampFull = nowStamp(true);

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
      note: stampedNote,
      updatedAt: stamp,
      history
    };
    const changeDesc = describeOrderChanges(prev, item);
    item.history.unshift({ time: stampFull, action: prev ? 'Chỉnh sửa' : 'Tạo mới', detail: changeDesc });
    addAuditLog(prev ? 'Sửa Note đơn' : 'Thêm Note đơn', `${item.customer} · ${item.product || item.goodsType}`, changeDesc);

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
      history
    };
    const detail = `${item.type} ${money(item.amount)} ₫ (${item.category})${item.party ? ' · ' + item.party : ''}`;
    item.history.unshift({ time: stampFull, action: prev ? 'Chỉnh sửa' : 'Ghi mới', detail });
    addAuditLog(prev ? 'Sửa thu chi' : 'Ghi thu chi', item.category, detail);

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
    history
  };

  if (kind === 'shipment') {
    o.waybill = val('waybill');
    o.appOrder = val('appOrder');
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
  const key = kind === 'order' ? 'orderNotes' : kind === 'shipment' ? 'shipments' : kind === 'purchase' ? 'purchases' : 'transactions';
  const target = (db[key] || []).find(x => x.id === id);
  db[key] = (db[key] || []).filter(x => x.id !== id);
  addAuditLog('Xóa bản ghi', target?.customer || target?.category || 'Bản ghi', `Đã xóa ${target?.product || target?.category || id}`);
  persist();
  closeModal();
  render();
  toast(`Đã xóa bản ghi (${nowStamp()})`);
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
  db[key] = db[key].filter(x => x.id !== id);
  addAuditLog('Xóa bản ghi', `${item.customer}`, `Đã xóa ${label}`);
  persist();
  render();
  toast(`Đã xóa (${nowStamp()})`);
}

function deleteTransaction(id) {
  const item = (db.transactions || []).find(x => x.id === id);
  const desc = item ? `${item.type} ${money(item.amount)} ₫ (${item.category})` : 'khoản thu chi này';
  if (!confirm(`Xóa ${desc}?`)) return;
  db.transactions = db.transactions.filter(x => x.id !== id);
  addAuditLog('Xóa thu chi', item?.category || 'Thu chi', `Đã xóa ${desc}`);
  persist();
  render();
  toast(`Đã xóa khoản thu chi (${nowStamp()})`);
}

function toast(s) {
  const t = document.getElementById('toast');
  t.textContent = s;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

function exportData() {
  const blob = new Blob([JSON.stringify({ version: 2, exportedAt: nowStamp(true), ...db }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sao-luu-quan-ly-minh-${dateKey()}.json`;
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
      if (Array.isArray(d)) d = { orderNotes: [], shipments: d, purchases: [], transactions: [], logs: [] };
      if (!Array.isArray(d.shipments) && !Array.isArray(d.orderNotes)) throw Error();
      const nextDb = {
        orderNotes: Array.isArray(d.orderNotes) ? d.orderNotes : [],
        shipments: Array.isArray(d.shipments) ? d.shipments : [],
        purchases: Array.isArray(d.purchases) ? d.purchases : [],
        transactions: Array.isArray(d.transactions) ? d.transactions : [],
        logs: Array.isArray(d.logs) ? d.logs : []
      };
      if (confirm(`Khôi phục ${nextDb.orderNotes.length} Note đơn, ${nextDb.shipments.length} vận đơn, ${nextDb.purchases.length} đơn mua hộ và ${nextDb.transactions.length} giao dịch? Dữ liệu hiện tại trên trình duyệt sẽ được thay thế.`)) {
        db = nextDb;
        addAuditLog('Khôi phục dữ liệu', 'Hệ thống', `Nhập tệp JSON (${nextDb.orderNotes.length} Note đơn, ${nextDb.shipments.length} vận đơn)`);
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
    requestCloseModal();
  }
});

window.addEventListener('beforeunload', e => {
  if (formDirty && document.getElementById('modal')?.classList.contains('open')) {
    e.preventDefault();
    e.returnValue = '';
  }
});

document.getElementById('today').textContent = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
}).format(new Date());

render();
