// ============ DATA & STORAGE ============
const DEFAULT_MENU = [
  {id:'m01', cat:'Minuman Tradisional', name:'Wedang Jahe', price:9000, honey:true},
  {id:'m02', cat:'Minuman Tradisional', name:'Wedang Jahe Kunyit', price:10000, honey:true},
  {id:'m03', cat:'Minuman Tradisional', name:'Wedang Uwuh', price:13000, honey:true},
  {id:'m04', cat:'Minuman Tradisional', name:'Bandrek Susu', price:11000, honey:true},
  {id:'m05', cat:'Minuman Tradisional', name:'Bandrek Susu Telang', price:13000, honey:true},
  {id:'m06', cat:'Minuman Tradisional', name:'Bandrek Susu Secang', price:13000, honey:true},
  {id:'m07', cat:'Minuman Tradisional', name:'Bandrek Susu Rosella', price:13000, honey:true},
  {id:'m08', cat:'Minuman Tradisional', name:'STMJ', price:15000, honey:true},
  {id:'m09', cat:'Mocktail', name:'Mocktail Bunga Telang', price:0, honey:false},
  {id:'m10', cat:'Mocktail', name:'Mocktail Kayu Secang', price:0, honey:false},
  {id:'m11', cat:'Mocktail', name:'Es Teh Rempah', price:0, honey:false},
  {id:'m12', cat:'Non Rempah', name:'Coklat Kolonial', price:18000, honey:false},
  {id:'m13', cat:'Non Rempah', name:'Es Matcha Romusha', price:15000, honey:false},
  {id:'m14', cat:'Non Rempah', name:'Susu Soda Gembira', price:10000, honey:false},
  {id:'m15', cat:'Non Rempah', name:'Kopi Susu Tugu', price:18000, honey:false},
  {id:'m16', cat:'Non Rempah', name:'Americano', price:15000, honey:false},
  {id:'m17', cat:'Non Rempah', name:'Kopi Lemon', price:18000, honey:false},
  {id:'m18', cat:'Non Rempah', name:'Lemon Tea', price:15000, honey:false},
  {id:'m19', cat:'Cemilan', name:'Roti Bakar', price:10000, honey:false},
  {id:'m20', cat:'Cemilan', name:'Kukusan', price:9000, honey:false},
  {id:'m21', cat:'Cemilan', name:'Cireng Bumbu Rujak', price:8000, honey:false},
  {id:'m22', cat:'Cemilan', name:'Cireng Kuah', price:12000, honey:false},
  {id:'m23', cat:'Cemilan', name:'Kulit Cabe Garam', price:15000, honey:false},
  {id:'m24', cat:'Makanan', name:'Mie Rebus', price:10000, honey:false},
  {id:'m25', cat:'Makanan', name:'Mie Goreng', price:10000, honey:false},
];
const CATEGORIES = ['Minuman Tradisional','Mocktail','Non Rempah','Cemilan','Makanan'];
const HONEY_FEE = 2000;

let state = {
  menu: [],
  transactions: [],
  tab: 'kasir',
  activeCategory: CATEGORIES[0],
  cart: [],
  cartOpen: false,
  itemSheet: null, // {menuItem, qty, addon}
  editingTrxId: null,
  loading: true,
};

function uid(prefix){ return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function rupiah(n){ return 'Rp' + Number(n||0).toLocaleString('id-ID'); }

async function loadData(){
  try {
    const menuRes = await window.storage.get('menu-items', false);
    state.menu = menuRes ? JSON.parse(menuRes.value) : DEFAULT_MENU;
  } catch(e){ state.menu = DEFAULT_MENU; }
  try {
    const trxRes = await window.storage.get('transactions', false);
    state.transactions = trxRes ? JSON.parse(trxRes.value) : [];
  } catch(e){ state.transactions = []; }
  state.loading = false;
  render();
}
async function saveMenu(){
  try { await window.storage.set('menu-items', JSON.stringify(state.menu), false); }
  catch(e){ showToast('Gagal menyimpan menu'); }
}
async function saveTransactions(){
  try { await window.storage.set('transactions', JSON.stringify(state.transactions), false); }
  catch(e){ showToast('Gagal menyimpan transaksi'); }
}

function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(()=> t.classList.remove('show'), 1800);
}

// ============ CART LOGIC ============
function openItemSheet(menuItem){
  state.itemSheet = { menuItem, qty: 1, addon: 'gula' };
  render();
}
function closeItemSheet(){ state.itemSheet = null; render(); }

function addToCart(){
  const { menuItem, qty, addon } = state.itemSheet;
  const unitPrice = menuItem.price + (menuItem.honey && addon === 'madu' ? HONEY_FEE : 0);
  state.cart.push({
    lineId: uid('l'), menuId: menuItem.id, name: menuItem.name,
    qty, addon: menuItem.honey ? addon : null, unitPrice,
    subtotal: unitPrice * qty
  });
  state.itemSheet = null;
  render();
  showToast(menuItem.name + ' ditambahkan');
}
function removeCartLine(lineId){
  state.cart = state.cart.filter(l => l.lineId !== lineId);
  render();
}
function cartTotal(){ return state.cart.reduce((s,l)=> s + l.subtotal, 0); }
function cartCount(){ return state.cart.reduce((s,l)=> s + l.qty, 0); }

async function finalizeTransaction(paymentMethod){
  if (state.cart.length === 0) return;
  const now = new Date();
  const trx = {
    id: uid('t'),
    dateKey: now.toISOString().slice(0,10),
    time: now.toTimeString().slice(0,5),
    timestamp: now.getTime(),
    items: state.cart.map(l => ({ name:l.name, qty:l.qty, addon:l.addon, unitPrice:l.unitPrice, subtotal:l.subtotal })),
    total: cartTotal(),
    payment: paymentMethod
  };
  state.transactions.unshift(trx);
  await saveTransactions();
  state.cart = [];
  state.cartOpen = false;
  render();
  showToast('Transaksi tersimpan ✓');
}

function deleteTransaction(id){
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveTransactions();
  state.editingTrxId = null;
  render();
  showToast('Transaksi dihapus');
}

// ============ MENU MANAGEMENT ============
function updatePrice(menuId, value){
  const item = state.menu.find(m => m.id === menuId);
  if (item) item.price = Math.max(0, parseInt(value)||0);
}
function commitMenu(){ saveMenu(); }
function toggleHoney(menuId){
  const item = state.menu.find(m => m.id === menuId);
  if (item) { item.honey = !item.honey; saveMenu(); render(); }
}
function addCustomMenuItem(){
  const name = prompt('Nama menu baru:');
  if (!name) return;
  const cat = prompt('Kategori (' + CATEGORIES.join(', ') + '):', CATEGORIES[0]);
  const item = { id: uid('m'), cat: CATEGORIES.includes(cat) ? cat : CATEGORIES[0], name, price: 0, honey: false };
  state.menu.push(item);
  saveMenu();
  render();
}

// ============ RENDER ============
function render(){
  const root = document.getElementById('root');
  if (state.loading){
    root.innerHTML = '<div style="padding:60px 20px;text-align:center;color:var(--text-tertiary);font-weight:600;">Memuat...</div>';
    return;
  }
  root.innerHTML = `
    ${renderHeader()}
    ${state.tab === 'kasir' ? renderKasir() : ''}
    ${state.tab === 'riwayat' ? renderRiwayat() : ''}
    ${state.tab === 'menu' ? renderMenuManage() : ''}
    ${state.tab === 'kasir' && state.cart.length > 0 ? renderCartBar() : ''}
    ${renderCartSheet()}
    ${renderItemSheet()}
    ${renderTrxDetailSheet()}
  `;
  attachEvents();
}

function renderHeader(){
  const titles = { kasir: ['Kasir', 'Ketuk menu untuk mulai jual'], riwayat: ['Riwayat', 'Rekap transaksi harian'], menu: ['Menu', 'Atur harga & varian'] };
  const [title, sub] = titles[state.tab];
  return `
  <div class="app-header" id="header">
    <h1 class="app-title">${title}</h1>
    <p class="app-subtitle">${sub}</p>
    <div class="tabbar">
      <button data-tab="kasir" class="${state.tab==='kasir'?'active':''}">Kasir</button>
      <button data-tab="riwayat" class="${state.tab==='riwayat'?'active':''}">Riwayat</button>
      <button data-tab="menu" class="${state.tab==='menu'?'active':''}">Menu</button>
    </div>
  </div>`;
}

function renderKasir(){
  const items = state.menu.filter(m => m.cat === state.activeCategory);
  return `
  <div class="view">
    <div class="chip-row">
      ${CATEGORIES.map(c => `<div class="chip ${c===state.activeCategory?'active':''}" data-cat="${c}">${c}</div>`).join('')}
    </div>
    <div class="menu-grid">
      ${items.map(m => `
        <div class="menu-card" data-menu="${m.id}">
          <div class="menu-card-name">${m.name}</div>
          <div class="menu-card-price ${m.price===0?'unset':''}">${m.price===0?'Atur harga':rupiah(m.price)}</div>
          ${cartQtyForMenu(m.id) > 0 ? `<div class="menu-card-badge">${cartQtyForMenu(m.id)}</div>` : ''}
        </div>
      `).join('')}
    </div>
  </div>`;
}
function cartQtyForMenu(menuId){
  return state.cart.filter(l => l.menuId === menuId).reduce((s,l)=>s+l.qty,0);
}

function renderCartBar(){
  return `
  <div class="cart-bar">
    <div class="cart-bar-inner">
      <div class="cart-pill" id="openCart">
        <div class="cart-pill-left">
          <div class="cart-count">${cartCount()}</div>
          <div>
            <div class="cart-pill-label">Lihat keranjang</div>
            <div class="cart-pill-total">${rupiah(cartTotal())}</div>
          </div>
        </div>
        <div style="font-size:20px;">→</div>
      </div>
    </div>
  </div>`;
}

function renderItemSheet(){
  const s = state.itemSheet;
  const open = !!s;
  if (!s) return `<div class="sheet-overlay" id="itemOverlay"></div><div class="sheet" id="itemSheet"></div>`;
  const unitPrice = s.menuItem.price + (s.menuItem.honey && s.addon === 'madu' ? HONEY_FEE : 0);
  return `
  <div class="sheet-overlay open" id="itemOverlay"></div>
  <div class="sheet open" id="itemSheet">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <div class="sheet-title">${s.menuItem.name}</div>
      <button class="sheet-close" id="closeItemSheet">✕</button>
    </div>
    <div class="sheet-body">
      ${s.menuItem.honey ? `
      <div class="field-label">Pemanis</div>
      <div class="segmented">
        <button data-addon="gula" class="${s.addon==='gula'?'active':''}">Gula Putih</button>
        <button data-addon="madu" class="${s.addon==='madu'?'active':''}">Madu (+${rupiah(HONEY_FEE)})</button>
      </div>` : ''}
      <div class="field-label">Jumlah</div>
      <div class="stepper">
        <button id="qtyMinus">−</button>
        <div class="stepper-value">${s.qty}</div>
        <button id="qtyPlus">+</button>
      </div>
      <button class="btn-primary" id="addToCartBtn">Tambah · ${rupiah(unitPrice * s.qty)}</button>
    </div>
  </div>`;
}

function renderCartSheet(){
  const open = state.cartOpen && state.cart.length > 0;
  return `
  <div class="sheet-overlay ${open?'open':''}" id="cartOverlay"></div>
  <div class="sheet ${open?'open':''}" id="cartSheet">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <div class="sheet-title">Keranjang</div>
      <button class="sheet-close" id="closeCartSheet">✕</button>
    </div>
    <div class="sheet-body">
      ${state.cart.map(l => `
        <div class="cart-item">
          <div class="cart-item-info">
            <div class="cart-item-name">${l.qty}× ${l.name}</div>
            <div class="cart-item-meta">${l.addon === 'madu' ? 'Madu' : l.addon === 'gula' ? 'Gula putih' : ''}</div>
            <button class="cart-item-remove" data-remove="${l.lineId}">Hapus</button>
          </div>
          <div class="cart-item-price">${rupiah(l.subtotal)}</div>
        </div>
      `).join('')}
      <div class="summary-row total">
        <div class="summary-label">Total</div>
        <div class="summary-value">${rupiah(cartTotal())}</div>
      </div>
      <div class="field-label">Metode Bayar</div>
      <div class="segmented" id="paySegmented">
        <button data-pay="Cash" class="active">Cash</button>
        <button data-pay="QRIS">QRIS</button>
      </div>
      <button class="btn-primary" id="finalizeBtn">Simpan Transaksi</button>
    </div>
  </div>`;
}

function renderRiwayat(){
  if (state.transactions.length === 0){
    return `<div class="view"><div class="empty-state">
      <div class="empty-state-icon">🧾</div>
      <div class="empty-state-title">Belum ada transaksi</div>
      <div class="empty-state-sub">Transaksi yang disimpan akan muncul di sini</div>
    </div></div>`;
  }
  const grouped = {};
  state.transactions.forEach(t => { (grouped[t.dateKey] = grouped[t.dateKey] || []).push(t); });
  const dateKeys = Object.keys(grouped).sort().reverse();
  return `
  <div class="view">
    ${dateKeys.map(dk => {
      const trxs = grouped[dk];
      const dayTotal = trxs.reduce((s,t)=>s+t.total,0);
      const dateLabel = new Date(dk + 'T00:00:00').toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
      return `
      <div class="day-card">
        <div class="day-card-header">
          <div class="day-card-date">${dateLabel}</div>
          <div class="day-card-total">${rupiah(dayTotal)}</div>
        </div>
        <div class="day-card-sub">${trxs.length} transaksi</div>
        ${trxs.map(t => `
          <div class="trx-row" data-trx="${t.id}">
            <div class="trx-row-left">
              <div class="trx-time">${t.time}</div>
              <div class="trx-items">${t.items.map(i=>`${i.qty}× ${i.name}`).join(', ')}</div>
              <span class="trx-pay ${t.payment==='Cash'?'cash':'qris'}">${t.payment}</span>
            </div>
            <div class="trx-total">${rupiah(t.total)}</div>
          </div>
        `).join('')}
      </div>`;
    }).join('')}
  </div>`;
}

function renderTrxDetailSheet(){
  const open = !!state.editingTrxId;
  const trx = open ? state.transactions.find(t => t.id === state.editingTrxId) : null;
  if (!trx) return `<div class="sheet-overlay" id="trxOverlay"></div><div class="sheet" id="trxSheet"></div>`;
  return `
  <div class="sheet-overlay open" id="trxOverlay"></div>
  <div class="sheet open" id="trxSheet">
    <div class="sheet-handle"></div>
    <div class="sheet-header">
      <div class="sheet-title">Detail Transaksi</div>
      <button class="sheet-close" id="closeTrxSheet">✕</button>
    </div>
    <div class="sheet-body">
      ${trx.items.map(i => `
        <div class="cart-item">
          <div class="cart-item-info">
            <div class="cart-item-name">${i.qty}× ${i.name}</div>
            <div class="cart-item-meta">${i.addon === 'madu' ? 'Madu' : i.addon === 'gula' ? 'Gula putih' : ''}</div>
          </div>
          <div class="cart-item-price">${rupiah(i.subtotal)}</div>
        </div>
      `).join('')}
      <div class="summary-row total">
        <div class="summary-label">Total (${trx.payment})</div>
        <div class="summary-value">${rupiah(trx.total)}</div>
      </div>
      <button class="btn-danger-text" id="deleteTrxBtn">Hapus Transaksi</button>
    </div>
  </div>`;
}

function renderMenuManage(){
  return `
  <div class="view">
    ${CATEGORIES.map(cat => `
      <div class="cat-block">
        <div class="cat-title">${cat}</div>
        ${state.menu.filter(m=>m.cat===cat).map(m => `
          <div class="menu-manage-row">
            <div class="menu-manage-name">${m.name}</div>
            <div class="honey-toggle ${m.honey?'on':''}" data-honey="${m.id}" title="Opsi madu/gula">🍯</div>
            <input class="price-input" type="number" inputmode="numeric" value="${m.price}" data-price="${m.id}" placeholder="0">
          </div>
        `).join('')}
      </div>
    `).join('')}
    <button class="add-menu-btn" id="addMenuBtn">+ Tambah Menu Baru</button>
  </div>`;
}

// ============ EVENTS ============
function attachEvents(){
  document.querySelectorAll('.tabbar button').forEach(b => b.onclick = () => { state.tab = b.dataset.tab; render(); });
  document.querySelectorAll('.chip').forEach(c => c.onclick = () => { state.activeCategory = c.dataset.cat; render(); });
  document.querySelectorAll('.menu-card').forEach(c => c.onclick = () => {
    const item = state.menu.find(m => m.id === c.dataset.menu);
    if (item.price === 0) { showToast('Atur harga menu ini dulu di tab Menu'); return; }
    openItemSheet(item);
  });

  const openCartBtn = document.getElementById('openCart');
  if (openCartBtn) openCartBtn.onclick = () => { state.cartOpen = true; render(); };
  const closeCartSheet = document.getElementById('closeCartSheet');
  if (closeCartSheet) closeCartSheet.onclick = () => { state.cartOpen = false; render(); };
  const cartOverlay = document.getElementById('cartOverlay');
  if (cartOverlay) cartOverlay.onclick = () => { state.cartOpen = false; render(); };

  document.querySelectorAll('[data-remove]').forEach(b => b.onclick = (e) => { e.stopPropagation(); removeCartLine(b.dataset.remove); });

  const paySeg = document.getElementById('paySegmented');
  let selectedPay = 'Cash';
  if (paySeg){
    paySeg.querySelectorAll('button').forEach(b => b.onclick = () => {
      paySeg.querySelectorAll('button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active'); selectedPay = b.dataset.pay;
    });
  }
  const finalizeBtn = document.getElementById('finalizeBtn');
  if (finalizeBtn) finalizeBtn.onclick = () => finalizeTransaction(selectedPay);

  const closeItemBtn = document.getElementById('closeItemSheet');
  if (closeItemBtn) closeItemBtn.onclick = closeItemSheet;
  const itemOverlay = document.getElementById('itemOverlay');
  if (itemOverlay && state.itemSheet) itemOverlay.onclick = closeItemSheet;
  const qtyMinus = document.getElementById('qtyMinus');
  const qtyPlus = document.getElementById('qtyPlus');
  if (qtyMinus) qtyMinus.onclick = () => { if (state.itemSheet.qty > 1) state.itemSheet.qty--; render(); };
  if (qtyPlus) qtyPlus.onclick = () => { state.itemSheet.qty++; render(); };
  document.querySelectorAll('[data-addon]').forEach(b => b.onclick = () => { state.itemSheet.addon = b.dataset.addon; render(); });
  const addToCartBtn = document.getElementById('addToCartBtn');
  if (addToCartBtn) addToCartBtn.onclick = addToCart;

  document.querySelectorAll('[data-trx]').forEach(r => r.onclick = () => { state.editingTrxId = r.dataset.trx; render(); });
  const closeTrxSheet = document.getElementById('closeTrxSheet');
  if (closeTrxSheet) closeTrxSheet.onclick = () => { state.editingTrxId = null; render(); };
  const trxOverlay = document.getElementById('trxOverlay');
  if (trxOverlay && state.editingTrxId) trxOverlay.onclick = () => { state.editingTrxId = null; render(); };
  const deleteTrxBtn = document.getElementById('deleteTrxBtn');
  if (deleteTrxBtn) deleteTrxBtn.onclick = () => { if (confirm('Hapus transaksi ini?')) deleteTransaction(state.editingTrxId); };

  document.querySelectorAll('[data-price]').forEach(inp => {
    inp.oninput = () => updatePrice(inp.dataset.price, inp.value);
    inp.onblur = () => { commitMenu(); render(); };
  });
  document.querySelectorAll('[data-honey]').forEach(h => h.onclick = () => toggleHoney(h.dataset.honey));
  const addMenuBtn = document.getElementById('addMenuBtn');
  if (addMenuBtn) addMenuBtn.onclick = addCustomMenuItem;

  const header = document.getElementById('header');
  const view = document.querySelector('.view');
  if (header && view){
    window.onscroll = () => header.classList.toggle('scrolled', window.scrollY > 4);
  }
}

loadData();