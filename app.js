// GasFlow - Vanilla JS + Supabase
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const staffNames = ['GOVINDAN','RAMESH','PK RAJA','MUTHU KANNAN','RAJKUMAR','OFFICE STAFF','GOPI','RAJA AND KANNAN','PRABHU','SURESH','KANNAN','AJITH','NIVETHA','SATHISH','S15','S16','OFFICE'];
const cylinderTypes = ['14.2 KG','NC 14.2 KG','ADC 14.2 KG','19 KG','5 KG Red','5 KG Blue','47.5 KG'];
const state = {
  page: 'dashboard',
  rows: { entries: [], customers: [], staff: [], stock: [], vehicles: [], expenses: [], attendance: [], cash_counts: [], rates: [] },
  charts: {},
  loading: false,
  role: 'employee',
  reportFilters: { from: '', to: '', person: '', type: '', payment: '' }
};
let sb = null;
let entryItemsDraft = [];

function today() { return new Date().toISOString().slice(0, 10); }
function money(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }
function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function init() {
  const configured = window.supabase && window.SUPABASE_URL && window.SUPABASE_KEY && !String(window.SUPABASE_URL).includes('YOUR_SUPABASE');
  try {
    if (configured) sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
  } catch (e) {
    console.error('Supabase initialization failed:', e);
    toast('Supabase configuration is invalid.', true);
  }

  if ($('#globalDate')) $('#globalDate').value = today();
  $$('#nav button').forEach(b => b.addEventListener('click', () => showPage(b.dataset.page)));
  $('#loginForm').addEventListener('submit', handleLogin);
  $('#logoutBtn').addEventListener('click', handleLogout);
  $('#forgotBtn').addEventListener('click', handleForgotPassword);

  if (!configured) {
    $('#configWarning').classList.remove('hidden');
    $('#loginSubmit').disabled = true;
    return;
  }

  sb.auth.onAuthStateChange((_event, session) => {
    if (session) enterApp(session); else showLogin();
  });
  sb.auth.getSession().then(({ data }) => {
    if (data.session) enterApp(data.session); else showLogin();
  });
}

function showLogin() {
  $('#appScreen').classList.add('hidden');
  $('#loginScreen').classList.remove('hidden');
}

async function enterApp(session) {
  $('#loginScreen').classList.add('hidden');
  $('#appScreen').classList.remove('hidden');
  const email = session.user?.email || '';
  $('#sideUser').textContent = email;
  $('#avatarBtn').textContent = email.slice(0, 2).toUpperCase() || 'VA';
  state.role = await fetchRole(session.user.id);
  updateRoleUI();
  showPage('dashboard');
}

async function fetchRole(userId) {
  if (!sb || !userId) return 'employee';
  try {
    const { data, error } = await sb.from('profiles').select('role').eq('id', userId).maybeSingle();
    if (error || !data) return 'employee';
    return data.role === 'admin' ? 'admin' : 'employee';
  } catch (e) { return 'employee'; }
}

function updateRoleUI() {
  const badge = $('#roleBadge');
  if (badge) {
    badge.textContent = state.role === 'admin' ? 'Admin' : 'Employee';
    badge.className = 'role-badge ' + (state.role === 'admin' ? 'admin' : 'employee');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = $('#loginEmail').value.trim();
  const password = $('#loginPassword').value;
  const btn = $('#loginSubmit');
  const errBox = $('#loginError');
  errBox.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  const { error } = await sb.auth.signInWithPassword({ email, password });
  btn.disabled = false;
  btn.textContent = 'Sign in';
  if (error) {
    errBox.textContent = error.message || 'Could not sign in. Check your credentials.';
    errBox.classList.remove('hidden');
  }
}

async function handleLogout() {
  if (!sb) return;
  await sb.auth.signOut();
  showLogin();
}

async function handleForgotPassword() {
  const email = ($('#loginEmail').value || '').trim();
  if (!email) { toast('Enter your email above first', true); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email);
  if (error) toast(error.message, true);
  else toast('Password reset email sent');
}

async function load(table) {
  if (!sb) return [];
  const { data, error } = await sb.from(table).select('*').order('created_at', { ascending: false }).limit(500);
  if (error) {
    console.error(`Load ${table}:`, error);
    toast(`${table}: ${error.message}`, true);
    return [];
  }
  return data || [];
}

async function refresh() {
  if (!sb || state.loading) return;
  state.loading = true;
  try {
    for (const t of ['entries','customers','staff','stock','vehicles','expenses','attendance','cash_counts','rates']) state.rows[t] = await load(t);
    render();
  } finally {
    state.loading = false;
  }
}

function showPage(page) {
  state.page = page;
  $$('#nav button').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  const names = { dashboard:'Dashboard', entries:'Daily Entry', customers:'Customers', staff:'Staff', stock:'Stock', vehicles:'Vehicles', expenses:'Expenses', reports:'Reports' };
  $('#pageTitle').textContent = names[page] || 'Dashboard';
  $('#headline').textContent = page === 'dashboard' ? 'Good afternoon 👋' : (names[page] || 'Dashboard');
  render();
  if (sb) refresh();
}

function render() {
  const p = state.page;
  if (p === 'dashboard') dashboard();
  else if (p === 'entries') entries();
  else if (p === 'customers') customers();
  else if (p === 'staff') staff();
  else if (p === 'stock') stock();
  else if (p === 'vehicles') vehicles();
  else if (p === 'expenses') expenses();
  else if (p === 'reports') reports();
}

function dashboard() {
  const es = state.rows.entries, ex = state.rows.expenses;
  const sales = es.reduce((a,x) => a + Number(x.amount || 0), 0);
  const paid = es.filter(x => x.payment_status === 'Paid').reduce((a,x) => a + Number(x.amount || 0), 0);
  const expense = ex.reduce((a,x) => a + Number(x.amount || 0), 0);
  const qty = es.reduce((a,x) => a + Number(x.quantity || 0), 0);
  $('#content').innerHTML = `
    <div class="cards">
      <div class="card metric"><div class="top">TOTAL SALES <span class="ico">₹</span></div><div class="value">${money(sales)}</div><div class="sub">${sb ? 'Live database total' : 'Connect Supabase for live data'}</div></div>
      <div class="card metric"><div class="top">COLLECTION <span class="ico">✓</span></div><div class="value">${money(paid)}</div><div class="sub">Paid transactions</div></div>
      <div class="card metric"><div class="top">EXPENSES <span class="ico">−</span></div><div class="value">${money(expense)}</div><div class="sub">All recorded expenses</div></div>
      <div class="card metric"><div class="top">UNITS SOLD <span class="ico">▣</span></div><div class="value">${qty}</div><div class="sub">All cylinder types</div></div>
    </div>
    <div class="grid2">
      <div class="panel"><div class="panel-head"><h3>Sales overview</h3><small>Recent transactions</small></div><div class="chart-wrap"><canvas id="salesChart"></canvas></div></div>
      <div class="panel"><div class="panel-head"><h3>Quick actions</h3></div>
        <div class="quick">
          <button onclick="openEntry()"><b>＋ Daily Entry</b><span>Record a delivery</span></button>
          <button onclick="openCustomer()"><b>＋ Customer</b><span>Add customer</span></button>
          <button onclick="openExpense()"><b>＋ Expense</b><span>Record expense</span></button>
          <button onclick="showPage('reports')"><b>▤ Reports</b><span>View reports</span></button>
        </div>
        <div class="panel-head" style="margin-top:22px"><h3>Stock snapshot</h3></div>
        <div class="stock-grid">
          <div class="stock-box"><b>14.2 KG</b><strong>${stockSum('14.2 KG','full')}</strong><span>Full</span></div>
          <div class="stock-box"><b>14.2 KG</b><strong>${stockSum('14.2 KG','empty')}</strong><span>Empty</span></div>
          <div class="stock-box"><b>19 KG</b><strong>${stockSum('19 KG','full')}</strong><span>Full</span></div>
          <div class="stock-box"><b>19 KG</b><strong>${stockSum('19 KG','empty')}</strong><span>Empty</span></div>
        </div>
      </div>
    </div>
    <div class="panel"><div class="panel-head"><h3>Latest transactions</h3><button class="btn secondary" onclick="showPage('entries')">View all</button></div>
      ${table(['Date','Customer','Type','Qty','Amount','Payment'], es.slice(0,8), r => [esc(r.entry_date),esc(r.customer_name),esc(r.cylinder_type),esc(r.quantity),money(r.amount),`<span class="badge ${r.payment_status === 'Paid' ? '' : 'red'}">${esc(r.payment_status || 'Pending')}</span>`])}
    </div>`;
  drawSales(es);
}

function drawSales(es) {
  if (!window.Chart) return;
  const c = $('#salesChart');
  if (!c) return;
  if (state.charts.sales) state.charts.sales.destroy();
  const map = {};
  es.forEach(r => { map[r.entry_date] = (map[r.entry_date] || 0) + Number(r.amount || 0); });
  const labels = Object.keys(map).sort().slice(-14);
  state.charts.sales = new Chart(c, {
    type:'line',
    data:{ labels, datasets:[{ label:'Sales', data:labels.map(x=>map[x]), tension:.35, fill:true }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true},x:{grid:{display:false}}} }
  });
}

function stockSum(type, kind) {
  return state.rows.stock.filter(x => x.cylinder_type === type).reduce((a,x) => a + Number(x[kind] || 0), 0);
}

function table(headers, rows, mapper, entity) {
  if (!rows.length) return '<div class="empty">No records yet. Add your first record.</div>';
  const canDelete = state.role === 'admin';
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${mapper(r).map(v=>`<td>${v ?? ''}</td>`).join('')}<td class="row-actions">${entity?`<button class="btn secondary small" onclick="editRow('${entity}','${r.id}')">Edit</button>`:''}${canDelete?`<button class="btn danger small" onclick="deleteRow('${r.id}')">Delete</button>`:''}</td></tr>`).join('')}</tbody></table></div>`;
}

const editors = { entries: openEntry, customers: openCustomer, staff: openStaff, stock: openStock, vehicles: openVehicle, expenses: openExpense, attendance: openAttendance, cash_counts: openCashCount, rates: openRate };
function editRow(entity, id) {
  const row = (state.rows[entity] || []).find(r => r.id === id);
  if (!row) { toast('Record not found', true); return; }
  const fn = editors[entity];
  if (fn) fn(row); else toast('Editing is not available for this record type.', true);
}

function pageTable(title, button, body) {
  $('#content').innerHTML = `<div class="panel"><div class="panel-head"><h3>${title}</h3>${button || ''}</div>${body}</div>`;
}
function deliveryBoys() {
  const db = state.rows.staff.filter(x => x.active !== false && ['Delivery Boy','Delivery Team'].includes(x.role)).map(x=>x.name).filter(Boolean);
  return [...new Set(db.length ? db : staffNames)];
}
function deliverySelect(id='staff', label='Delivery person', value) { const opts = deliveryBoys(); if (value && !opts.includes(value)) opts.unshift(value); return {id,label,type:'select',options:opts,value}; }
function actionsHeader(headers){ return [...headers,'Actions']; }

function entries() {
  const tab = state.entriesTab || 'sales';
  const tabs = [
    { id:'sales', label:'Sales Entry' },
    { id:'attendance', label:'Attendance' },
    { id:'cash', label:'Cash Denomination' },
    { id:'prices', label:'Cylinder Prices' }
  ];
  const tabBar = `<div class="tab-bar">${tabs.map(t=>`<button class="tab-btn ${tab===t.id?'active':''}" onclick="switchEntriesTab('${t.id}')">${esc(t.label)}</button>`).join('')}</div>`;

  let body = '';
  if (tab === 'attendance') {
    body = `<div class="panel"><div class="panel-head"><h3>Delivery boy attendance</h3><button class="btn" onclick="openAttendance()">＋ Mark Attendance</button></div>${table(actionsHeader(['Date','Delivery Person','Status','Note']), state.rows.attendance, r => [esc(r.attendance_date),esc(r.delivery_person),esc(r.status),esc(r.note)], 'attendance')}</div>`;
  } else if (tab === 'cash') {
    body = `<div class="panel"><div class="panel-head"><h3>Cash denomination counts</h3><button class="btn" onclick="openCashCount()">＋ Add Cash Count</button></div>${table(actionsHeader(['Date','Delivery Person','₹2000','₹500','₹200','₹100','₹50','₹20','₹10','₹5','₹2','₹1','Total']), state.rows.cash_counts, r => [esc(r.cash_date),esc(r.delivery_person),r.d2000,r.d500,r.d200,r.d100,r.d50,r.d20,r.d10,r.d5,r.d2,r.d1,money(r.total_cash)], 'cash_counts')}</div>`;
  } else if (tab === 'prices') {
    body = `<div class="panel"><div class="panel-head"><h3>Cylinder Prices</h3><button class="btn" onclick="openRate()">＋ Update Price</button></div>${table(actionsHeader(['Cylinder Type','Price','Updated']), state.rows.rates, r => [esc(r.cylinder_type),money(r.rate),esc(r.updated_at ? new Date(r.updated_at).toLocaleString('en-IN') : '')], 'rates')}</div>`;
  } else {
    body = `<div class="panel"><div class="panel-head"><h3>Daily delivery & sales records</h3><button class="btn" onclick="openEntry()">＋ Add Entry</button></div>${table(actionsHeader(['Date','Customer','Delivery Person','Type','Qty','Cylinder Price','Amount','Payment','Prepaid','Cash','In Hand','Cylinder in Hand','Attendance','Cash Counted','Tally']), state.rows.entries, r => { const t=tallyFor(r); return [esc(r.entry_date),esc(r.customer_name),esc(r.staff_name),esc(r.cylinder_type),esc(r.quantity),money(r.rate),money(r.amount),`<span class="badge ${r.payment_status==='Paid'?'':'red'}">${esc(r.payment_status||'Pending')}</span>`,money(r.prepaid_amount),money(r.cash_amount),money(r.in_hand_amount),esc(r.cylinder_in_hand),`<span class="badge ${attendanceFor(r.entry_date,r.staff_name)==='Present'?'':'red'}">${esc(attendanceFor(r.entry_date,r.staff_name))}</span>`,money(r.denomination_total),`<span class="badge ${t.ok?'':'red'}">${esc(t.label)}</span>`]; }, 'entries')}</div>`;
  }
  $('#content').innerHTML = tabBar + body;
}
function switchEntriesTab(tab) { state.entriesTab = tab; entries(); }
function customers() { pageTable('Customer master', `<button class="btn" onclick="openCustomer()">＋ Add Customer</button>`, table(actionsHeader(['Name','Phone','Type','Address','Outstanding']), state.rows.customers, r => [esc(r.name),esc(r.phone),esc(r.customer_type),esc(r.address),money(r.outstanding)], 'customers')); }
function staff() { pageTable('Staff & delivery team', `<button class="btn" onclick="openStaff()">＋ Add Staff</button>`, table(actionsHeader(['Name','Role','Phone','Active']), state.rows.staff, r => [esc(r.name),esc(r.role),esc(r.phone),`<span class="badge">${r.active?'Active':'Inactive'}</span>`], 'staff')); }
function stock() { pageTable('Cylinder stock movements', `<button class="btn" onclick="openStock()">＋ Stock Movement</button>`, table(actionsHeader(['Date','Type','Full In','Full Out','Empty In','Empty Out','Delivery Person','Note']), state.rows.stock, r => [esc(r.movement_date),esc(r.cylinder_type),esc(r.full_in),esc(r.full_out),esc(r.empty_in),esc(r.empty_out),esc(r.delivery_person),esc(r.note)], 'stock')); }
function vehicles() { pageTable('Vehicle & fuel log', `<button class="btn" onclick="openVehicle()">＋ Add Vehicle Log</button>`, table(actionsHeader(['Date','Vehicle','Driver','Start KM','End KM','Total KM','Diesel L','Diesel Amount','Service']), state.rows.vehicles, r => [esc(r.log_date),esc(r.vehicle_no),esc(r.driver),esc(r.starting_km),esc(r.ending_km),esc(r.total_km),esc(r.diesel_filled),money(r.diesel_amount),esc(r.service||'—')], 'vehicles')); }
function expenses() { pageTable('Expenses', `<button class="btn" onclick="openExpense()">＋ Add Expense</button>`, table(actionsHeader(['Date','Category','Description','Amount','Payment']), state.rows.expenses, r => [esc(r.expense_date),esc(r.category),esc(r.description),money(r.amount),esc(r.payment_method)], 'expenses')); }

function reports() {
  const rf = state.reportFilters;
  const fromD = rf.from || $('#globalDate').value || today();
  const toD = rf.to || fromD;
  const rangeLabel = fromD === toD ? fromD : `${fromD} to ${toD}`;
  const people = deliveryBoys();

  let es = state.rows.entries.filter(x => x.entry_date >= fromD && x.entry_date <= toD);
  let ex = state.rows.expenses.filter(x => x.expense_date >= fromD && x.expense_date <= toD);
  let cc = state.rows.cash_counts.filter(x => x.cash_date >= fromD && x.cash_date <= toD);

  if (rf.person) { es = es.filter(x => x.staff_name === rf.person); cc = cc.filter(x => x.delivery_person === rf.person); }
  if (rf.type) es = es.filter(x => x.cylinder_type === rf.type);
  if (rf.payment) es = es.filter(x => x.payment_status === rf.payment);

  const sales = es.reduce((a,x)=>a+Number(x.amount||0),0), prepaid=es.reduce((a,x)=>a+Number(x.prepaid_amount||0),0), cash=es.reduce((a,x)=>a+Number(x.cash_amount||0),0), inhand=es.reduce((a,x)=>a+Number(x.in_hand_amount||0),0), expensesTotal = ex.reduce((a,x)=>a+Number(x.amount||0),0), cashCounted=cc.reduce((a,x)=>a+Number(x.total_cash||0),0);
  $('#content').innerHTML = `
  <div class="panel"><div class="panel-head"><h3>Filters</h3></div>
    <div class="form-grid">
      <div class="form-group"><label>From date</label><input type="date" id="rf_from" value="${esc(fromD)}"></div>
      <div class="form-group"><label>To date</label><input type="date" id="rf_to" value="${esc(toD)}"></div>
      <div class="form-group"><label>Delivery person</label><select id="rf_person"><option value="">All</option>${people.map(p=>`<option value="${esc(p)}" ${rf.person===p?'selected':''}>${esc(p)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Cylinder type</label><select id="rf_type"><option value="">All</option>${cylinderTypes.map(t=>`<option value="${esc(t)}" ${rf.type===t?'selected':''}>${esc(t)}</option>`).join('')}</select></div>
      <div class="form-group"><label>Payment status</label><select id="rf_payment"><option value="">All</option>${['Paid','Pending','Partial'].map(p=>`<option value="${p}" ${rf.payment===p?'selected':''}>${p}</option>`).join('')}</select></div>
    </div>
    <div class="modal-actions"><button class="btn secondary" onclick="resetReportFilters()">Reset</button><button class="btn" onclick="applyReportFilters()">Apply Filters</button></div>
  </div>
  <div class="cards"><div class="card metric"><div class="top">SALES</div><div class="value">${money(sales)}</div><div class="sub">${esc(rangeLabel)}</div></div><div class="card metric"><div class="top">PREPAID</div><div class="value">${money(prepaid)}</div></div><div class="card metric"><div class="top">CASH / IN HAND</div><div class="value">${money(cash+inhand)}</div></div><div class="card metric"><div class="top">CASH COUNTED</div><div class="value">${money(cashCounted)}</div></div></div>
  <div class="panel"><div class="panel-head"><h3>Report — ${esc(rangeLabel)}</h3><div class="toolbar"><button class="btn secondary" onclick="exportExcel()">Export Excel</button></div></div>
  <div class="summary-list"><div class="summary-row"><span>Sales</span><b>${money(sales)}</b></div><div class="summary-row"><span>Prepaid</span><b>${money(prepaid)}</b></div><div class="summary-row"><span>Cash</span><b>${money(cash)}</b></div><div class="summary-row"><span>Cash handed in / in hand</span><b>${money(inhand)}</b></div><div class="summary-row"><span>Expenses</span><b>${money(expensesTotal)}</b></div></div></div>
  <div class="panel"><div class="panel-head"><h3>Delivery report</h3></div>${table(actionsHeader(['Date','Customer','Delivery Person','Type','Qty','Cylinder Price','Amount','Payment','Prepaid','Cash','In Hand','Cylinder in Hand','Attendance','Cash Counted','Tally']),es,r=>{ const t=tallyFor(r); return [esc(r.entry_date),esc(r.customer_name),esc(r.staff_name),esc(r.cylinder_type),esc(r.quantity),money(r.rate),money(r.amount),esc(r.payment_status),money(r.prepaid_amount),money(r.cash_amount),money(r.in_hand_amount),esc(r.cylinder_in_hand),esc(attendanceFor(r.entry_date,r.staff_name)),money(r.denomination_total),t.label]; },'entries')}</div>`;
}

function applyReportFilters() {
  state.reportFilters = { from: $('#rf_from').value || today(), to: $('#rf_to').value || $('#rf_from').value || today(), person: $('#rf_person').value, type: $('#rf_type').value, payment: $('#rf_payment').value };
  reports();
}
function resetReportFilters() {
  state.reportFilters = { from: '', to: '', person: '', type: '', payment: '' };
  reports();
}

function form(fields) {
  return `<form id="dynamicForm" onsubmit="return submitDynamicForm(event)"><div class="form-grid">${fields.map(f => {
    if (f.type === 'html') return `<div class="form-group full">${f.html}</div>`;
    const type = f.type || 'text';
    let control = '';
    if (type === 'select') control = `<select id="f_${f.id}" ${f.required===false?'':'required'}>${(f.options||[]).map(o=>`<option value="${esc(o)}" ${f.value!=null && String(o)===String(f.value)?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
    else if (type === 'textarea') control = `<textarea id="f_${f.id}" rows="3" placeholder="${esc(f.placeholder||'')}" ${f.required===false?'':'required'}>${esc(f.value||'')}</textarea>`;
    else control = `<input id="f_${f.id}" type="${type}" value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder||'')}" ${f.required===false?'':'required'} ${f.readonly?'readonly class="readonly-field"':''}>`;
    return `<div class="form-group ${f.full?'full':''}"><label for="f_${f.id}">${esc(f.label)}</label>${control}</div>`;
  }).join('')}</div><div class="modal-actions"><button type="button" class="btn secondary" onclick="closeModal()">Cancel</button><button type="submit" class="btn">Save</button></div></form>`;
}

let pendingSubmit = null;
function openModal(title, body, onSubmit) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = body;
  pendingSubmit = onSubmit;
  $('#modal').classList.remove('hidden');
}
function closeModal() { $('#modal').classList.add('hidden'); $('#modalBody').innerHTML=''; pendingSubmit=null; }
function submitDynamicForm(e) { e.preventDefault(); if (pendingSubmit) pendingSubmit(); return false; }

function currentRate(type){ const r=state.rows.rates.find(x=>x.cylinder_type===type); return r ? Number(r.rate||0) : 0; }
function attendanceFor(date, person) {
  const rec = state.rows.attendance.find(a => a.attendance_date === date && a.delivery_person === person);
  return rec ? rec.status : '\u2014';
}
function tallyFor(r) {
  const amount = Number(r.amount||0), prepaid = Number(r.prepaid_amount||0), counted = Number(r.denomination_total||0);
  const balance = amount - prepaid;
  if (!counted && !balance) return { label: '\u2014', ok: true };
  const diff = counted - balance;
  if (diff === 0) return { label: 'Matched', ok: true };
  return { label: (diff>0?'Excess ':'Short ') + money(Math.abs(diff)), ok: false };
}
async function autoMarkAttendance(date, person) {
  if (!sb || !date || !person) return;
  try {
    const { error } = await sb.from('attendance').upsert(
      { attendance_date: date, delivery_person: person, status: 'Present' },
      { onConflict: 'attendance_date,delivery_person' }
    );
    if (error) console.error('Auto attendance:', error);
  } catch (e) { console.error('Auto attendance failed:', e); }
}
const denomKeys = ['d2000','d500','d200','d100','d50','d20','d10','d5','d2','d1'];
const denomVal = { d2000:2000, d500:500, d200:200, d100:100, d50:50, d20:20, d10:10, d5:5, d2:2, d1:1 };
function itemsListHtml() {
  if (!entryItemsDraft.length) return '<div class="empty-small">No cylinder lines added yet. Add at least one below.</div>';
  return entryItemsDraft.map((it,i) => { const rate = currentRate(it.type); return `<div class="item-row"><span>${esc(it.type)}</span><span>${esc(it.qty)} \u00d7 ${money(rate)}</span><b>${money(it.qty*rate)}</b><button type="button" class="btn danger small" onclick="removeEntryItem(${i})">Remove</button></div>`; }).join('');
}
function renderEntryItems() {
  const list = $('#itemsList');
  if (list) list.innerHTML = itemsListHtml();
  recalcEntryTally();
}
function addEntryItem() {
  const typeEl = $('#newItemType'), qtyEl = $('#newItemQty');
  if (!typeEl || !qtyEl) return;
  const qty = Number(qtyEl.value) || 0;
  if (qty <= 0) { toast('Enter a quantity greater than 0', true); return; }
  entryItemsDraft.push({ type: typeEl.value, qty });
  qtyEl.value = 1;
  renderEntryItems();
}
function removeEntryItem(i) { entryItemsDraft.splice(i,1); renderEntryItems(); }
function recalcEntryTally() {
  const amtEl=$('#tallyAmount'), prepEl=$('#tallyPrepaid'), balEl=$('#tallyBalance'), cntEl=$('#tallyCounted'), diffEl=$('#tallyDiff'), prepaidInput=$('#f_prepaid');
  if (!amtEl) return;
  const amount = entryItemsDraft.reduce((a,it)=>a + it.qty*currentRate(it.type), 0);
  const prepaid = Number(prepaidInput && prepaidInput.value) || 0;
  const balance = amount - prepaid;
  let counted = 0;
  denomKeys.forEach(k => { const el = $('#f_'+k); counted += (Number(el && el.value)||0) * denomVal[k]; });
  const diff = counted - balance;
  amtEl.textContent = money(amount); prepEl.textContent = money(prepaid); balEl.textContent = money(balance); cntEl.textContent = money(counted);
  diffEl.textContent = diff===0 ? 'Matched \u2713' : (diff>0 ? 'Excess '+money(Math.abs(diff)) : 'Short '+money(Math.abs(diff)));
  diffEl.className = diff===0 ? 'tally-ok' : 'tally-bad';
}
async function saveEntry(rows, editId) {
  if (!sb) { toast('Supabase is not connected.', true); return; }
  try {
    if (editId) {
      const { error: e1 } = await sb.from('entries').update(rows[0]).eq('id', editId);
      if (e1) throw e1;
      if (rows.length > 1) { const { error: e2 } = await sb.from('entries').insert(rows.slice(1)); if (e2) throw e2; }
    } else {
      const { error } = await sb.from('entries').insert(rows);
      if (error) throw error;
    }
    closeModal();
    toast(rows.length > 1 ? `Saved ${rows.length} cylinder lines` : 'Saved successfully');
    await refresh();
  } catch (err) { console.error('Save entry:', err); toast(err.message || 'Failed to save entry', true); }
}
function openEntry(row) {
  const types=cylinderTypes;
  const isEdit = !!row;
  entryItemsDraft = isEdit ? [{ type: row.cylinder_type, qty: Number(row.quantity)||1 }] : [{ type: types[0], qty: 1 }];
  const tallyHtml = `<div class="tally-box" id="tallyBox"><h4>Cash Tally</h4>
    <div class="tally-row"><span>Amount (Cylinders \u00d7 Price)</span><b id="tallyAmount">\u20b90</b></div>
    <div class="tally-row"><span>Prepaid</span><b id="tallyPrepaid">\u20b90</b></div>
    <div class="tally-row"><span>Balance (Postpaid)</span><b id="tallyBalance">\u20b90</b></div>
    <div class="tally-row"><span>Cash Counted (Denomination)</span><b id="tallyCounted">\u20b90</b></div>
    <div class="tally-row total"><span>Difference</span><b id="tallyDiff">\u20b90</b></div>
  </div>`;
  const itemsHtml = `<h4 class="form-subhead">Cylinder Items</h4>
    <div class="items-list" id="itemsList"></div>
    <div class="item-add-row">
      <select id="newItemType">${types.map(t=>`<option value="${esc(t)}">${esc(t)} \u2014 ${money(currentRate(t))}</option>`).join('')}</select>
      <input id="newItemQty" type="number" min="1" value="1">
      <button type="button" class="btn secondary" onclick="addEntryItem()">＋ Add Line</button>
    </div>`;
  openModal(isEdit?'Edit Daily Entry':'Add Daily Entry', form([
    {id:'date',label:'Date',type:'date',value:isEdit?row.entry_date:$('#globalDate').value},
    {id:'customer',label:'Customer name',required:false,value:isEdit?row.customer_name:''},
    deliverySelect('staff','Delivery person',isEdit?row.staff_name:undefined),
    {type:'html',html:itemsHtml},
    {id:'cylinderinhand',label:'Cylinder in Hand',type:'number',value:isEdit?row.cylinder_in_hand:0,required:false},
    {id:'payment',label:'Payment status',type:'select',options:['Paid','Pending','Partial'],value:isEdit?row.payment_status:'Paid'},
    {id:'prepaid',label:'Prepaid amount',type:'number',value:isEdit?row.prepaid_amount:0,required:false},
    {id:'cash',label:'Cash received',type:'number',value:isEdit?row.cash_amount:0,required:false},
    {id:'inhand',label:'Cash in hand / handed in',type:'number',value:isEdit?row.in_hand_amount:0,required:false},
    {id:'notes',label:'Notes',type:'textarea',required:false,full:true,value:isEdit?row.notes:''},
    {type:'html',html:'<h4 class="form-subhead">Cash Denomination Count</h4>'},
    ...denomKeys.map(k=>({id:k,label:'\u20b9'+k.slice(1)+' notes/coins',type:'number',value:isEdit?row[k]:0,required:false})),
    {type:'html',html:tallyHtml}
  ]), () => {
    if (!entryItemsDraft.length) { toast('Add at least one cylinder line before saving.', true); return; }
    const shared = {entry_date:v('date'),customer_name:v('customer'),staff_name:v('staff'),cylinder_in_hand:+v('cylinderinhand'),payment_status:v('payment'),notes:v('notes')};
    const prepaid = +v('prepaid'), cash = +v('cash'), inhand = +v('inhand');
    let denomTotal = 0; const denomFields = {};
    denomKeys.forEach(k => { const n = +v(k); denomFields[k] = n; denomTotal += n * denomVal[k]; });
    const zeroDenom = Object.fromEntries(denomKeys.map(k=>[k,0]));
    const groupId = (isEdit && row.group_id) ? row.group_id : (crypto.randomUUID ? crypto.randomUUID() : (Date.now()+'-'+Math.random()));
    const rows = entryItemsDraft.map((it,i) => {
      const primary = i === 0;
      return { ...shared, cylinder_type: it.type, quantity: it.qty, rate: currentRate(it.type), group_id: groupId, is_primary: primary,
        prepaid_amount: primary ? prepaid : 0, cash_amount: primary ? cash : 0, in_hand_amount: primary ? inhand : 0,
        ...(primary ? denomFields : zeroDenom), denomination_total: primary ? denomTotal : 0 };
    });
    (async () => { await autoMarkAttendance(shared.entry_date, shared.staff_name); await saveEntry(rows, isEdit ? row.id : null); })();
  });
  renderEntryItems();
  const prepaidEl = $('#f_prepaid');
  [prepaidEl, ...denomKeys.map(k=>$('#f_'+k))].forEach(el => el && el.addEventListener('input', recalcEntryTally));
}
function openCustomer(row) {
  const isEdit = !!row;
  openModal(isEdit?'Edit Customer':'Add Customer', form([
    {id:'name',label:'Customer name',value:isEdit?row.name:''},
    {id:'phone',label:'Phone',required:false,value:isEdit?row.phone:''},
    {id:'type',label:'Customer type',type:'select',options:['Commercial','Domestic','Institution','Other'],value:isEdit?row.customer_type:undefined},
    {id:'address',label:'Address',full:true,required:false,value:isEdit?row.address:''},
    {id:'outstanding',label:'Opening outstanding',type:'number',value:isEdit?row.outstanding:0}
  ]), () => { const p={name:v('name'),phone:v('phone'),customer_type:v('type'),address:v('address'),outstanding:+v('outstanding')}; isEdit?update('customers',row.id,p):insert('customers',p); });
}
function openStaff(row) {
  const isEdit = !!row;
  openModal(isEdit?'Edit Staff':'Add Staff', form([
    {id:'name',label:'Name',value:isEdit?row.name:''},
    {id:'role',label:'Role',type:'select',options:['Delivery Boy','Office Staff','Driver','Helper','Other'],value:isEdit?row.role:undefined},
    {id:'phone',label:'Phone',required:false,value:isEdit?row.phone:''},
    {id:'active',label:'Status',type:'select',options:['Active','Inactive'],value:isEdit?(row.active?'Active':'Inactive'):'Active'}
  ]), () => { const p={name:v('name'),role:v('role'),phone:v('phone'),active:v('active')==='Active'}; isEdit?update('staff',row.id,p):insert('staff',p); });
}
function openStock(row) {
  const isEdit = !!row;
  openModal(isEdit?'Edit Stock Movement':'Stock Movement', form([
    {id:'date',label:'Date',type:'date',value:isEdit?row.movement_date:$('#globalDate').value},
    {id:'type',label:'Cylinder type',type:'select',options:cylinderTypes,value:isEdit?row.cylinder_type:undefined},
    {id:'fin',label:'Full in',type:'number',value:isEdit?row.full_in:0},
    {id:'fout',label:'Full out',type:'number',value:isEdit?row.full_out:0},
    {id:'ein',label:'Empty in',type:'number',value:isEdit?row.empty_in:0},
    {id:'eout',label:'Empty out',type:'number',value:isEdit?row.empty_out:0},
    deliverySelect('delivery','Delivery person',isEdit?row.delivery_person:undefined),
    {id:'note',label:'Note',required:false,full:true,value:isEdit?row.note:''}
  ]), () => { const p={movement_date:v('date'),cylinder_type:v('type'),full_in:+v('fin'),full_out:+v('fout'),empty_in:+v('ein'),empty_out:+v('eout'),delivery_person:v('delivery'),note:v('note')}; isEdit?update('stock',row.id,p):insert('stock',p); });
}
function openAttendance(row) {
  const isEdit = !!row;
  openModal(isEdit?'Edit Attendance':'Delivery Boy Attendance', form([
    {id:'date',label:'Date',type:'date',value:isEdit?row.attendance_date:$('#globalDate').value},
    deliverySelect('delivery','Delivery person',isEdit?row.delivery_person:undefined),
    {id:'status',label:'Attendance',type:'select',options:['Present','Absent','Half Day','Leave'],value:isEdit?row.status:undefined},
    {id:'note',label:'Note',required:false,full:true,value:isEdit?row.note:''}
  ]), () => { const p={attendance_date:v('date'),delivery_person:v('delivery'),status:v('status'),note:v('note')}; isEdit?update('attendance',row.id,p):insert('attendance',p); });
}
function openCashCount(row) {
  const isEdit = !!row;
  const den = ['2000','500','200','100','50','20','10','5','2','1'];
  openModal(isEdit?'Edit Cash Denomination Count':'Cash Denomination Count', form([
    {id:'date',label:'Date',type:'date',value:isEdit?row.cash_date:$('#globalDate').value},
    deliverySelect('delivery','Delivery person',isEdit?row.delivery_person:undefined),
    ...den.map(d=>({id:'d'+d,label:'₹'+d+' notes/coins',type:'number',value:isEdit?row['d'+d]:0,required:false}))
  ]), () => { const p={cash_date:v('date'),delivery_person:v('delivery')}; let total=0; den.forEach(d=>{p['d'+d]=+v('d'+d); total+=p['d'+d]*Number(d)}); p.total_cash=total; isEdit?update('cash_counts',row.id,p):insert('cash_counts',p); });
}
function openRate(row) {
  const isEdit = !!row;
  openModal(isEdit?'Edit Cylinder Price':'Update Cylinder Price', form([
    {id:'type',label:'Cylinder type',type:'select',options:cylinderTypes,value:isEdit?row.cylinder_type:undefined},
    {id:'rate',label:'Cylinder price',type:'number',value:isEdit?row.rate:0}
  ]), async () => {
    if (!sb) return toast('Supabase is not connected.',true);
    const { error } = await sb.from('rates').upsert({cylinder_type:v('type'),rate:+v('rate'),updated_at:new Date().toISOString()},{onConflict:'cylinder_type'});
    if (error) { toast(error.message,true); return; }
    closeModal(); toast('Cylinder price updated'); await refresh();
  });
}
function openVehicle(row) {
  const isEdit = !!row;
  openModal(isEdit?'Edit Vehicle Log':'Vehicle Log', form([
    {id:'date',label:'Date',type:'date',value:isEdit?row.log_date:$('#globalDate').value},
    {id:'vehicle',label:'Vehicle number',value:isEdit?row.vehicle_no:''},
    {id:'driver',label:'Driver',required:false,value:isEdit?row.driver:''},
    {id:'start',label:'Starting KM',type:'number',value:isEdit?row.starting_km:0},
    {id:'end',label:'Ending KM',type:'number',value:isEdit?row.ending_km:0},
    {id:'diesel',label:'Diesel filled (L)',type:'number',value:isEdit?row.diesel_filled:0},
    {id:'dieselamt',label:'Diesel amount',type:'number',value:isEdit?row.diesel_amount:0},
    {id:'service',label:'Service',required:false,value:isEdit?row.service:''}
  ]), () => { const p={log_date:v('date'),vehicle_no:v('vehicle'),driver:v('driver'),starting_km:+v('start'),ending_km:+v('end'),diesel_filled:+v('diesel'),diesel_amount:+v('dieselamt'),service:v('service')}; isEdit?update('vehicles',row.id,p):insert('vehicles',p); });
}
function openExpense(row) {
  const isEdit = !!row;
  openModal(isEdit?'Edit Expense':'Add Expense', form([
    {id:'date',label:'Date',type:'date',value:isEdit?row.expense_date:$('#globalDate').value},
    {id:'category',label:'Category',type:'select',options:['DIESEL / PETROL','ONLINE PAYMENT','SALARY + INCENTIVES + OTHERS','MAINTENANCE','OTHER'],value:isEdit?row.category:undefined},
    {id:'desc',label:'Description',required:false,value:isEdit?row.description:''},
    {id:'amount',label:'Amount',type:'number',value:isEdit?row.amount:0},
    {id:'payment',label:'Payment method',type:'select',options:['Cash','GPay','Bank','Other'],value:isEdit?row.payment_method:undefined}
  ]), () => { const p={expense_date:v('date'),category:v('category'),description:v('desc'),amount:+v('amount'),payment_method:v('payment')}; isEdit?update('expenses',row.id,p):insert('expenses',p); });
}
function v(id) { return $(`#f_${id}`).value; }

async function deleteRow(id) {
  if (!sb) { toast('Supabase is not connected.', true); return; }
  if (state.role !== 'admin') { toast('Only Admins can delete records.', true); return; }
  if (!id || !confirm('Delete this record? This cannot be undone.')) return;
  const tables = ['entries','customers','staff','stock','vehicles','expenses','attendance','cash_counts','rates'];
  let found = false;
  for (const table of tables) { const {data,error}=await sb.from(table).select('id').eq('id',id).limit(1); if(error) continue; if(data && data.length){ const res=await sb.from(table).delete().eq('id',id); if(res.error){toast(res.error.message,true);return;} found=true; break; } }
  if(found){ toast('Deleted successfully'); await refresh(); } else toast('Record not found',true);
}

async function insert(table, payload) {
  if (!sb) { toast('Supabase is not connected. Check config.js.', true); return; }
  const { error } = await sb.from(table).insert(payload);
  if (error) { console.error(`Insert ${table}:`, error); toast(error.message, true); return; }
  closeModal();
  toast('Saved successfully');
  await refresh();
}

async function update(table, id, payload) {
  if (!sb) { toast('Supabase is not connected. Check config.js.', true); return; }
  const { error } = await sb.from(table).update(payload).eq('id', id);
  if (error) { console.error(`Update ${table}:`, error); toast(error.message, true); return; }
  closeModal();
  toast('Updated successfully');
  await refresh();
}

function toast(msg, bad=false) {
  $('#toast').innerHTML = `<div class="toast" style="background:${bad?'#a33b3b':'#172033'}">${esc(msg)}</div>`;
  setTimeout(() => $('#toast').innerHTML='', 3500);
}

function importExcel() {
  const f = $('#excelFile')?.files?.[0];
  if (!f) { toast('Choose an Excel file first', true); return; }
  const r = new FileReader();
  r.onload = e => { const wb = XLSX.read(e.target.result,{type:'array'}); toast(`${wb.SheetNames.length} sheets detected`); };
  r.readAsArrayBuffer(f);
}
function exportExcel() {
  if (!window.XLSX) { toast('Excel library is not loaded.', true); return; }
  const wb = XLSX.utils.book_new();
  for (const [name,rows] of Object.entries(state.rows)) XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),name.slice(0,31));
  XLSX.writeFile(wb,'GasFlow_Report.xlsx');
}
function toggleTheme() { document.body.classList.toggle('dark'); localStorage.setItem('dark',document.body.classList.contains('dark')); }

(function(){ if(localStorage.getItem('dark')==='true') document.body.classList.add('dark'); init(); })();
