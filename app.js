// GasFlow - Vanilla JS + Supabase
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const staffNames = ['GOVINDAN','RAMESH','PK RAJA','MUTHU KANNAN','RAJKUMAR','OFFICE STAFF','GOPI','RAJA AND KANNAN','PRABHU','SURESH','KANNAN','AJITH','NIVETHA','SATHISH','S15','S16','OFFICE'];
const state = {
  page: 'dashboard',
  rows: { entries: [], customers: [], staff: [], stock: [], vehicles: [], expenses: [], attendance: [], cash_counts: [], rates: [] },
  charts: {},
  loading: false
};
let sb = null;

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

function enterApp(session) {
  $('#loginScreen').classList.add('hidden');
  $('#appScreen').classList.remove('hidden');
  const email = session.user?.email || '';
  $('#sideUser').textContent = email;
  $('#avatarBtn').textContent = email.slice(0, 2).toUpperCase() || 'VA';
  showPage('dashboard');
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
  const orderColumn = table === 'rates' ? 'updated_at' : 'created_at';
  const { data, error } = await sb.from(table).select('*').order(orderColumn, { ascending: false }).limit(500);
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

function table(headers, rows, mapper) {
  if (!rows.length) return '<div class="empty">No records yet. Add your first record.</div>';
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${mapper(r).map(v=>`<td>${v ?? ''}</td>`).join('')}<td><button class="btn danger small" onclick="deleteRow('${r.id}')">Delete</button></td></tr>`).join('')}</tbody></table></div>`;
}

function pageTable(title, button, body) {
  $('#content').innerHTML = `<div class="panel"><div class="panel-head"><h3>${title}</h3>${button || ''}</div>${body}</div>`;
}
function deliveryBoys() {
  const db = state.rows.staff.filter(x => x.active !== false && ['Delivery Boy','Delivery Team'].includes(x.role)).map(x=>x.name).filter(Boolean);
  return [...new Set(db.length ? db : staffNames)];
}
function deliverySelect(id='staff', label='Delivery person') { return {id,label,type:'select',options:deliveryBoys()}; }
function actionsHeader(headers){ return [...headers,'Actions']; }

function entries() { pageTable('Daily delivery & sales records', `<button class="btn" onclick="openEntry()">＋ Add Entry</button>`, table(actionsHeader(['Date','Customer','Delivery Person','Type','Qty','Cylinder Price','Amount','Payment','Prepaid','Cash','In Hand']), state.rows.entries, r => [esc(r.entry_date),esc(r.customer_name),esc(r.staff_name),esc(r.cylinder_type),esc(r.quantity),money(r.rate),money(r.amount),`<span class="badge ${r.payment_status==='Paid'?'':'red'}">${esc(r.payment_status||'Pending')}</span>`,money(r.prepaid_amount),money(r.cash_amount),money(r.in_hand_amount)])); }
function customers() { pageTable('Customer master', `<button class="btn" onclick="openCustomer()">＋ Add Customer</button>`, table(actionsHeader(['Name','Phone','Type','Address','Outstanding']), state.rows.customers, r => [esc(r.name),esc(r.phone),esc(r.customer_type),esc(r.address),money(r.outstanding)])); }
function staff() { pageTable('Staff & delivery team', `<button class="btn" onclick="openStaff()">＋ Add Staff</button>`, table(actionsHeader(['Name','Role','Phone','Active']), state.rows.staff, r => [esc(r.name),esc(r.role),esc(r.phone),`<span class="badge">${r.active?'Active':'Inactive'}</span>`])); }
function stock() { pageTable('Cylinder stock movements', `<button class="btn" onclick="openStock()">＋ Stock Movement</button>`, table(actionsHeader(['Date','Type','Full In','Full Out','Empty In','Empty Out','Delivery Person','Note']), state.rows.stock, r => [esc(r.movement_date),esc(r.cylinder_type),esc(r.full_in),esc(r.full_out),esc(r.empty_in),esc(r.empty_out),esc(r.delivery_person),esc(r.note)])); }
function vehicles() { pageTable('Vehicle & fuel log', `<button class="btn" onclick="openVehicle()">＋ Add Vehicle Log</button>`, table(actionsHeader(['Date','Vehicle','Driver','Start KM','End KM','Total KM','Diesel L','Diesel Amount','Service']), state.rows.vehicles, r => [esc(r.log_date),esc(r.vehicle_no),esc(r.driver),esc(r.starting_km),esc(r.ending_km),esc(r.total_km),esc(r.diesel_filled),money(r.diesel_amount),esc(r.service||'—')])); }
function expenses() { pageTable('Expenses', `<button class="btn" onclick="openExpense()">＋ Add Expense</button>`, table(actionsHeader(['Date','Category','Description','Amount','Payment']), state.rows.expenses, r => [esc(r.expense_date),esc(r.category),esc(r.description),money(r.amount),esc(r.payment_method)])); }
function attendance() { pageTable('Delivery boy attendance', `<button class="btn" onclick="openAttendance()">＋ Mark Attendance</button>`, table(actionsHeader(['Date','Delivery Person','Status','Note']), state.rows.attendance, r => [esc(r.attendance_date),esc(r.delivery_person),esc(r.status),esc(r.note)])); }
function cashCounts() { pageTable('Cash denomination counts', `<button class="btn" onclick="openCashCount()">＋ Add Cash Count</button>`, table(actionsHeader(['Date','Delivery Person','₹2000','₹500','₹200','₹100','₹50','₹20','₹10','₹5','₹2','₹1','Total']), state.rows.cash_counts, r => [esc(r.cash_date),esc(r.delivery_person),r.d2000,r.d500,r.d200,r.d100,r.d50,r.d20,r.d10,r.d5,r.d2,r.d1,money(r.total_cash)])); }

function reports() {
  const selected = $('#globalDate').value || today();
  const es = state.rows.entries.filter(x=>x.entry_date===selected), ex = state.rows.expenses.filter(x=>x.expense_date===selected);
  const at = state.rows.attendance.filter(x=>x.attendance_date===selected), cc = state.rows.cash_counts.filter(x=>x.cash_date===selected);
  const sales = es.reduce((a,x)=>a+Number(x.amount||0),0), prepaid=es.reduce((a,x)=>a+Number(x.prepaid_amount||0),0), cash=es.reduce((a,x)=>a+Number(x.cash_amount||0),0), inhand=es.reduce((a,x)=>a+Number(x.in_hand_amount||0),0), expensesTotal = ex.reduce((a,x)=>a+Number(x.amount||0),0), cashCounted=cc.reduce((a,x)=>a+Number(x.total_cash||0),0);
  $('#content').innerHTML = `<div class="cards"><div class="card metric"><div class="top">DAILY SALES</div><div class="value">${money(sales)}</div><div class="sub">${esc(selected)}</div></div><div class="card metric"><div class="top">PREPAID</div><div class="value">${money(prepaid)}</div></div><div class="card metric"><div class="top">CASH / IN HAND</div><div class="value">${money(cash+inhand)}</div></div><div class="card metric"><div class="top">CASH COUNTED</div><div class="value">${money(cashCounted)}</div></div></div>
  <div class="panel"><div class="panel-head"><h3>Daily report — ${esc(selected)}</h3><div class="toolbar"><button class="btn" onclick="openAttendance()">＋ Attendance</button><button class="btn" onclick="openCashCount()">＋ Cash Denomination</button><button class="btn secondary" onclick="exportExcel()">Export Excel</button></div></div>
  <div class="summary-list"><div class="summary-row"><span>Sales</span><b>${money(sales)}</b></div><div class="summary-row"><span>Prepaid</span><b>${money(prepaid)}</b></div><div class="summary-row"><span>Cash</span><b>${money(cash)}</b></div><div class="summary-row"><span>Cash handed in / in hand</span><b>${money(inhand)}</b></div><div class="summary-row"><span>Expenses</span><b>${money(expensesTotal)}</b></div></div></div>
  <div class="panel"><div class="panel-head"><h3>Cylinder Prices</h3><button class="btn" onclick="openRate()">＋ Update Price</button></div>${table(actionsHeader(['Cylinder Type','Price','Updated']),state.rows.rates,r=>[esc(r.cylinder_type),money(r.rate),esc(r.updated_at ? new Date(r.updated_at).toLocaleString('en-IN') : '')])}</div>
  <div class="panel"><div class="panel-head"><h3>Attendance</h3></div>${table(actionsHeader(['Date','Delivery Person','Status','Note']),at,r=>[esc(r.attendance_date),esc(r.delivery_person),esc(r.status),esc(r.note)])}</div>
  <div class="panel"><div class="panel-head"><h3>Cash denominations</h3></div>${table(actionsHeader(['Date','Delivery Person','₹2000','₹500','₹200','₹100','₹50','₹20','₹10','₹5','₹2','₹1','Total']),cc,r=>[esc(r.cash_date),esc(r.delivery_person),r.d2000,r.d500,r.d200,r.d100,r.d50,r.d20,r.d10,r.d5,r.d2,r.d1,money(r.total_cash)])}</div>
  <div class="panel"><div class="panel-head"><h3>Daily delivery report</h3></div>${table(actionsHeader(['Date','Customer','Delivery Person','Type','Qty','Cylinder Price','Amount','Payment','Prepaid','Cash','In Hand']),es,r=>[esc(r.entry_date),esc(r.customer_name),esc(r.staff_name),esc(r.cylinder_type),esc(r.quantity),money(r.rate),money(r.amount),esc(r.payment_status),money(r.prepaid_amount),money(r.cash_amount),money(r.in_hand_amount)])}</div>`;
}

function form(fields) {
  return `<form id="dynamicForm" onsubmit="return submitDynamicForm(event)"><div class="form-grid">${fields.map(f => {
    const type = f.type || 'text';
    let control = '';
    if (type === 'select') control = `<select id="f_${f.id}" ${f.required===false?'':'required'}>${(f.options||[]).map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`;
    else if (type === 'textarea') control = `<textarea id="f_${f.id}" rows="3" placeholder="${esc(f.placeholder||'')}" ${f.required===false?'':'required'}>${esc(f.value||'')}</textarea>`;
    else control = `<input id="f_${f.id}" type="${type}" value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder||'')}" ${f.required===false?'':'required'}>`;
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
function openEntry() {
  const types=['14.2 KG','NC 14.2 KG','ADC 14.2 KG','19 KG','5 KG Red','5 KG Blue','47.5 KG'];
  openModal('Add Daily Entry', form([
    {id:'date',label:'Date',type:'date',value:$('#globalDate').value},{id:'customer',label:'Customer name',required:false},
    deliverySelect('staff','Delivery person'),{id:'type',label:'Cylinder type',type:'select',options:types},
    {id:'qty',label:'Quantity',type:'number',value:1},{id:'rate',label:'Cylinder price',type:'number',value:currentRate(types[0])},
    {id:'payment',label:'Payment status',type:'select',options:['Paid','Pending','Partial']},{id:'prepaid',label:'Prepaid amount',type:'number',value:0,required:false},{id:'cash',label:'Cash received',type:'number',value:0,required:false},{id:'inhand',label:'Cash in hand / handed in',type:'number',value:0,required:false},{id:'notes',label:'Notes',type:'textarea',required:false,full:true}
  ]), () => insert('entries',{entry_date:v('date'),customer_name:v('customer'),staff_name:v('staff'),cylinder_type:v('type'),quantity:+v('qty'),rate:+v('rate'),payment_status:v('payment'),prepaid_amount:+v('prepaid'),cash_amount:+v('cash'),in_hand_amount:+v('inhand'),notes:v('notes')}));
}
function openCustomer() { openModal('Add Customer', form([{id:'name',label:'Customer name'},{id:'phone',label:'Phone',required:false},{id:'type',label:'Customer type',type:'select',options:['Commercial','Domestic','Institution','Other']},{id:'address',label:'Address',full:true,required:false},{id:'outstanding',label:'Opening outstanding',type:'number',value:0}]), () => insert('customers',{name:v('name'),phone:v('phone'),customer_type:v('type'),address:v('address'),outstanding:+v('outstanding')})); }
function openStaff() { openModal('Add Staff', form([{id:'name',label:'Name'},{id:'role',label:'Role',type:'select',options:['Delivery Boy','Office Staff','Driver','Helper','Other']},{id:'phone',label:'Phone',required:false},{id:'active',label:'Status',type:'select',options:['Active','Inactive']}]), () => insert('staff',{name:v('name'),role:v('role'),phone:v('phone'),active:v('active')==='Active'})); }
function openStock() { openModal('Stock Movement', form([{id:'date',label:'Date',type:'date',value:$('#globalDate').value},{id:'type',label:'Cylinder type',type:'select',options:['14.2 KG','NC 14.2 KG','ADC 14.2 KG','19 KG','5 KG Red','5 KG Blue','47.5 KG']},{id:'fin',label:'Full in',type:'number',value:0},{id:'fout',label:'Full out',type:'number',value:0},{id:'ein',label:'Empty in',type:'number',value:0},{id:'eout',label:'Empty out',type:'number',value:0},deliverySelect('delivery','Delivery person'),{id:'note',label:'Note',required:false,full:true}]), () => insert('stock',{movement_date:v('date'),cylinder_type:v('type'),full_in:+v('fin'),full_out:+v('fout'),empty_in:+v('ein'),empty_out:+v('eout'),delivery_person:v('delivery'),note:v('note')})); }
function openAttendance() { openModal('Delivery Boy Attendance', form([{id:'date',label:'Date',type:'date',value:$('#globalDate').value},deliverySelect('delivery','Delivery person'),{id:'status',label:'Attendance',type:'select',options:['Present','Absent','Half Day','Leave']},{id:'note',label:'Note',required:false,full:true}]), () => insert('attendance',{attendance_date:v('date'),delivery_person:v('delivery'),status:v('status'),note:v('note')})); }
function openCashCount() { openModal('Cash Denomination Count', form([{id:'date',label:'Date',type:'date',value:$('#globalDate').value},deliverySelect('delivery','Delivery person'),...['2000','500','200','100','50','20','10','5','2','1'].map(d=>({id:'d'+d,label:'₹'+d+' notes/coins',type:'number',value:0,required:false}))]), () => { const den=['2000','500','200','100','50','20','10','5','2','1']; const p={cash_date:v('date'),delivery_person:v('delivery')}; let total=0; den.forEach(d=>{p['d'+d]=+v('d'+d); total+=p['d'+d]*Number(d)}); p.total_cash=total; insert('cash_counts',p); }); }
function openRate() { openModal('Update Cylinder Price', form([{id:'type',label:'Cylinder type',type:'select',options:['14.2 KG','NC 14.2 KG','ADC 14.2 KG','19 KG','5 KG Red','5 KG Blue','47.5 KG']},{id:'rate',label:'Cylinder price',type:'number',value:0}]), async () => { if(!sb) return toast('Supabase is not connected.',true); const {error}=await sb.from('rates').upsert({cylinder_type:v('type'),rate:+v('rate'),updated_at:new Date().toISOString()},{onConflict:'cylinder_type'}); if(error){toast(error.message,true);return;} closeModal(); toast('Cylinder price updated'); await refresh(); }); }
function openVehicle() { openModal('Vehicle Log', form([{id:'date',label:'Date',type:'date',value:$('#globalDate').value},{id:'vehicle',label:'Vehicle number'},{id:'driver',label:'Driver',required:false},{id:'start',label:'Starting KM',type:'number',value:0},{id:'end',label:'Ending KM',type:'number',value:0},{id:'diesel',label:'Diesel filled (L)',type:'number',value:0},{id:'dieselamt',label:'Diesel amount',type:'number',value:0},{id:'service',label:'Service',required:false}]), () => insert('vehicles',{log_date:v('date'),vehicle_no:v('vehicle'),driver:v('driver'),starting_km:+v('start'),ending_km:+v('end'),diesel_filled:+v('diesel'),diesel_amount:+v('dieselamt'),service:v('service')})); }
function openExpense() { openModal('Add Expense', form([{id:'date',label:'Date',type:'date',value:$('#globalDate').value},{id:'category',label:'Category',type:'select',options:['DIESEL / PETROL','ONLINE PAYMENT','SALARY + INCENTIVES + OTHERS','MAINTENANCE','OTHER']},{id:'desc',label:'Description',required:false},{id:'amount',label:'Amount',type:'number',value:0},{id:'payment',label:'Payment method',type:'select',options:['Cash','GPay','Bank','Other']}]), () => insert('expenses',{expense_date:v('date'),category:v('category'),description:v('desc'),amount:+v('amount'),payment_method:v('payment')})); }
function v(id) { return $(`#f_${id}`).value; }

async function deleteRow(id) {
  if (!sb) { toast('Supabase is not connected.', true); return; }
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
