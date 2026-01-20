// ==========================================
// استيراد وضبط Firebase
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCFLZgmFU9hlRGVbURKu4aP74kW17B5fzM",
    authDomain: "ff-4eb72.firebaseapp.com",
    projectId: "ff-4eb72",
    storageBucket: "ff-4eb72.firebasestorage.app",
    messagingSenderId: "1086237232091",
    appId: "1:1086237232091:web:929fd6c2e462585100b5fe"
};

// تهيئة التطبيق وقاعدة البيانات
const app = initializeApp(firebaseConfig);
const dbFirestore = getFirestore(app);

// ==========================================
// إعدادات النظام والثوابت
// ==========================================
const ADMIN_PIN = "1972";  // رمز الأدمن
const DELETE_PIN = "121";  // رمز الحذف
let db = JSON.parse(localStorage.getItem('noorHusseinDB')) || { customers: [] };
let activeCustomer = null; // الزبون المحدد حالياً
let currentCart = [];      // سلة المشتريات
let targetCustomerId = null; // معرف الزبون للرابط

// ==========================================
// نقطة البداية (Boot Sequence)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

function initApp() {
    hideAllScreens();
    
    // --- الاستماع لقاعدة البيانات السحابية (Sync) ---
    // هذا يضمن التحديث التلقائي عند الاتصال بالإنترنت
    try {
        const docRef = doc(dbFirestore, "backup", "mainData");
        onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const cloudData = docSnap.data();
                if (cloudData && cloudData.customers) {
                    db = cloudData;
                    localStorage.setItem('noorHusseinDB', JSON.stringify(db)); // تحديث النسخة المحلية
                    // إذا كنا في شاشة الأدمن، حدث القائمة
                    if (document.getElementById('screen-admin-app').classList.contains('active-screen')) {
                         renderCustomerList(document.getElementById('customerSearchInput').value);
                    }
                }
            }
        }, (error) => {
            console.log("Offline mode or permission issue:", error);
        });
    } catch (e) {
        console.log("Firebase Init Error (Offline):", e);
    }

    const urlParams = new URLSearchParams(window.location.search);
    const linkedId = urlParams.get('id');

    if (linkedId) {
        // --- مسار الزبون ---
        targetCustomerId = parseInt(linkedId);
        const customer = db.customers.find(c => c.id === targetCustomerId);
        
        if (customer) {
            document.getElementById('client-welcome-name').innerText = customer.name;
            showScreen('screen-client-login');
        } else {
            alert('عذراً، الرابط غير صالح أو تم حذف الحساب.');
            window.history.replaceState({}, document.title, window.location.pathname);
            showScreen('screen-admin-login');
        }
    } else {
        // --- مسار الأدمن ---
        showScreen('screen-admin-login');
    }
}

function showScreen(screenId) {
    hideAllScreens();
    const screen = document.getElementById(screenId);
    if(screen) {
        screen.classList.add('active-screen');
    }
}

function hideAllScreens() {
    document.querySelectorAll('.app-section').forEach(el => {
        el.classList.remove('active-screen');
    });
}

// ==========================================
// منطق الزبون
// ==========================================
function checkClientLogin() {
    const pass = document.getElementById('clientPassInput').value;
    const customer = db.customers.find(c => c.id === targetCustomerId);
    
    if (customer && customer.password === pass) {
        showScreen('screen-client-view');
        fillClientViewData(customer);
    } else {
        alert("كلمة المرور غير صحيحة!");
        document.getElementById('clientPassInput').value = '';
    }
}

function fillClientViewData(c) {
    document.getElementById('cvName').innerText = c.name;
    const debt = c.totalSales - c.totalPaid;
    const sym = c.currency === 'USD' ? '$' : 'د.ع'; // تحديد الرمز
    
    document.getElementById('cvSales').innerText = c.totalSales.toLocaleString() + ' ' + sym;
    document.getElementById('cvPaid').innerText = c.totalPaid.toLocaleString() + ' ' + sym;
    document.getElementById('cvDebt').innerText = debt.toLocaleString() + ' ' + sym;

    const list = document.getElementById('cvTransList');
    list.innerHTML = '';
    
    [...c.transactions].reverse().forEach(t => {
        let details = '';
        if (t.type === 'sale') {
            details = `<div style="font-size:11px; color:#666; margin-top:4px;">${t.items.map(i => i.name).join(' + ')}</div>`;
        }
        
        list.innerHTML += `
            <div style="background:white; padding:12px; border-bottom:1px solid #eee; margin-bottom:5px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-weight:bold; color:${t.type === 'sale' ? '#c0392b' : '#27ae60'}">
                        ${t.type === 'sale' ? '<i class="fas fa-file-invoice"></i> فاتورة' : '<i class="fas fa-money-bill-wave"></i> تسديد'}
                    </div>
                    <div style="font-weight:bold; font-size:1.1rem;">${t.amount.toLocaleString()} ${sym}</div>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:5px;">
                     <div style="font-size:11px; color:#999;">${t.date}</div>
                </div>
                ${details}
            </div>
        `;
    });
}

// ==========================================
// منطق الأدمن
// ==========================================
function checkAdminLogin() {
    const pin = document.getElementById('adminPinInput').value;
    if (pin === ADMIN_PIN) {
        showScreen('screen-admin-app');
        setTimeout(() => {
            const splash = document.getElementById('splash-screen');
            if(splash) {
                splash.style.opacity = '0';
                setTimeout(() => splash.style.display = 'none', 1000);
            }
        }, 1200);
        renderCustomerList();
    } else {
        alert("الرمز السري غير صحيح");
        document.getElementById('adminPinInput').value = '';
    }
}

function switchTab(tabId) {
    if ((tabId === 'tab-invoice' || tabId === 'tab-payment' || tabId === 'tab-reports') && !activeCustomer) {
        alert('الرجاء اختيار زبون من القائمة أولاً');
        switchTab('tab-customers');
        return;
    }
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`[onclick="switchTab('${tabId}')"]`).classList.add('active');
}

// --- طباعة التقرير (جديد) ---
function printCustomerReport() {
    if (!activeCustomer) return alert('لا يوجد زبون محدد للطباعة');
    window.print();
}

// --- إدارة الزبائن ---
function openAddCustomerModal() { document.getElementById('addCustomerModal').style.display = 'block'; }
function closeAddCustomerModal() { document.getElementById('addCustomerModal').style.display = 'none'; }

function confirmAddCustomer() {
    const name = document.getElementById('newCName').value;
    const phone = document.getElementById('newCPhone').value;
    const pass = document.getElementById('newCPass').value;
    const currency = document.getElementById('newCCurrency').value; // استلام العملة

    if (!name || !pass) return alert("الاسم وكلمة المرور مطلوبان");

    const newC = {
        id: Date.now(),
        name: name,
        phone: phone,
        currency: currency, // حفظ العملة
        password: pass,
        totalSales: 0,
        totalPaid: 0,
        transactions: []
    };
    db.customers.push(newC);
    saveData();
    renderCustomerList();
    document.getElementById('newCName').value = '';
    document.getElementById('newCPhone').value = '';
    document.getElementById('newCPass').value = '';
    closeAddCustomerModal();
    selectCustomer(newC.id);
}

function renderCustomerList(filterText = '') {
    calculateGlobalDebt();

    const list = document.getElementById('customerListContainer');
    list.innerHTML = '';
    const filtered = db.customers.filter(c => c.name.includes(filterText));
    filtered.forEach(c => {
        const debt = c.totalSales - c.totalPaid;
        const sym = c.currency === 'USD' ? '$' : 'د.ع'; // عرض العملة في القائمة
        const div = document.createElement('div');
        div.className = 'customer-item';
        div.onclick = () => selectCustomer(c.id);
        div.innerHTML = `<div><strong>${c.name}</strong><br><small style="color:${debt > 0 ? 'red' : 'green'}">الدين: ${debt.toLocaleString()} ${sym}</small></div><i class="fas fa-chevron-left" style="color:#ccc"></i>`;
        list.appendChild(div);
    });
}

function filterCustomers() { renderCustomerList(document.getElementById('customerSearchInput').value); }

function selectCustomer(id) {
    activeCustomer = db.customers.find(c => c.id === id);
    document.getElementById('headerCustomerName').innerText = activeCustomer.name;
    const baseUrl = window.location.href.split('?')[0];
    document.getElementById('customerShareLink').value = `${baseUrl}?id=${activeCustomer.id}`;
    refreshAdminViews();
    switchTab('tab-invoice');
}

function clearSelection() {
    activeCustomer = null;
    document.getElementById('headerCustomerName').innerText = 'لم يتم التحديد';
    switchTab('tab-customers');
}

function copyLink() {
    const linkInput = document.getElementById('customerShareLink');
    linkInput.select();
    document.execCommand("copy");
    alert("تم نسخ الرابط!");
}

function deleteCustomer() {
    if (!activeCustomer) return;
    const pin = prompt("للحذف النهائي (121):");
    if (pin === DELETE_PIN) {
        db.customers = db.customers.filter(c => c.id !== activeCustomer.id);
        saveData();
        clearSelection();
        calculateGlobalDebt(); // تحديث بعد الحذف
        alert("تم حذف الزبون.");
    } else {
        alert("رمز الحذف خاطئ!");
    }
}

// --- عمليات البيع ---
function addItemToCart() {
    const name = document.getElementById('itemName').value;
    const price = parseFloat(document.getElementById('itemPrice').value);
    const qty = parseFloat(document.getElementById('itemQty').value);
    if (!name || !price) return;
    currentCart.push({ name, price, qty, total: price * qty });
    document.getElementById('itemName').value = '';
    document.getElementById('itemName').focus();
    renderCart();
}

function renderCart() {
    const tbody = document.querySelector('#cartTable tbody');
    tbody.innerHTML = '';
    let total = 0;
    currentCart.forEach((item, idx) => {
        total += item.total;
        tbody.innerHTML += `<tr><td>${item.name}</td><td>${item.price}</td><td>${item.qty}</td><td onclick="removeFromCart(${idx})" style="color:red; cursor:pointer; font-weight:bold;">X</td></tr>`;
    });
    document.getElementById('cartTotal').innerText = total.toLocaleString();
}
function removeFromCart(idx) { currentCart.splice(idx, 1); renderCart(); }

function saveInvoice() {
    if (currentCart.length === 0) return alert('السلة فارغة!');
    const totalAmount = currentCart.reduce((sum, i) => sum + i.total, 0);
    activeCustomer.totalSales += totalAmount;
    activeCustomer.transactions.push({
        type: 'sale',
        date: new Date().toLocaleDateString('ar-EG') + ' ' + new Date().toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'}),
        items: [...currentCart],
        amount: totalAmount
    });
    saveData();
    currentCart = [];
    renderCart();
    alert('تم الحفظ');
    switchTab('tab-reports');
    refreshAdminViews();
    calculateGlobalDebt(); // تحديث بعد زيادة الدين
}

// --- عمليات التسديد ---
function processPayment() {
    const amount = parseFloat(document.getElementById('paymentInput').value);
    if (!amount) return alert('أدخل المبلغ الواصل');
    activeCustomer.totalPaid += amount;
    activeCustomer.transactions.push({
        type: 'pay',
        date: new Date().toLocaleDateString('ar-EG') + ' ' + new Date().toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'}),
        amount: amount
    });
    saveData();
    document.getElementById('paymentInput').value = '';
    alert('تم التسديد');
    refreshAdminViews();
    calculateGlobalDebt(); // تحديث بعد نقصان الدين
}

function refreshAdminViews() {
    if (!activeCustomer) return;
    const currentDebt = activeCustomer.totalSales - activeCustomer.totalPaid;
    const sym = activeCustomer.currency === 'USD' ? '$' : 'د.ع'; // عرض العملة في لوحة الأدمن

    document.getElementById('currentDebtDisplay').innerText = currentDebt.toLocaleString() + ' ' + sym;
    document.getElementById('repSales').innerText = activeCustomer.totalSales.toLocaleString() + ' ' + sym;
    document.getElementById('repPaid').innerText = activeCustomer.totalPaid.toLocaleString() + ' ' + sym;
    document.getElementById('repDebt').innerText = currentDebt.toLocaleString() + ' ' + sym;
    
    const list = document.getElementById('transList');
    list.innerHTML = '';
    [...activeCustomer.transactions].reverse().forEach(t => {
        let details = '';
        if (t.type === 'sale') {
            details = `<div style="font-size:11px; color:#666;">${t.items.map(i => i.name).join(' + ')}</div>`;
        }
        list.innerHTML += `
            <div style="background:white; padding:10px; border-bottom:1px solid #eee; margin-bottom:5px;">
                <div style="display:flex; justify-content:space-between; color:${t.type === 'sale' ? 'red' : 'green'}">
                    <strong>${t.type === 'sale' ? 'فاتورة' : 'تسديد'}</strong>
                    <span>${t.amount.toLocaleString()} ${sym}</span>
                </div>
                <small style="color:#aaa;">${t.date}</small>
                ${details}
            </div>
        `;
    });
}

function saveData() {
    // 1. الحفظ المحلي (Offline First)
    localStorage.setItem('noorHusseinDB', JSON.stringify(db));

    // 2. المحاولة للحفظ السحابي (Sync)
    try {
        const docRef = doc(dbFirestore, "backup", "mainData");
        setDoc(docRef, db)
            .then(() => console.log("Cloud Saved"))
            .catch((e) => console.log("Saved Locally (Offline):", e));
    } catch (e) {
        console.log("Error saving to cloud:", e);
    }
}

// --- دالة حساب الدين الكلي للنظام ---
function calculateGlobalDebt() {
    // هذه الدالة تعرض رقمًا مجردًا، لأنه قد يكون خليطًا من العملات
    // لتبسيط العرض، سيتم عرض الرقم فقط أو يمكن تفصيله لاحقاً، حالياً سنتركه رقمًا كما هو
    const total = db.customers.reduce((acc, c) => acc + (c.totalSales - c.totalPaid), 0);
    const el = document.getElementById('sysTotalDebt');
    if (el) el.innerText = total.toLocaleString(); 
}

// ==========================================
// ربط الدوال بالـ Window (لأننا نستخدم Module)
// ==========================================
window.checkAdminLogin = checkAdminLogin;
window.checkClientLogin = checkClientLogin;
window.switchTab = switchTab;
window.printCustomerReport = printCustomerReport;
window.openAddCustomerModal = openAddCustomerModal;
window.closeAddCustomerModal = closeAddCustomerModal;
window.confirmAddCustomer = confirmAddCustomer;
window.filterCustomers = filterCustomers;
window.selectCustomer = selectCustomer;
window.clearSelection = clearSelection;
window.copyLink = copyLink;
window.deleteCustomer = deleteCustomer;
window.addItemToCart = addItemToCart;
window.removeFromCart = removeFromCart;
window.saveInvoice = saveInvoice;
window.processPayment = processPayment;
window.initApp = initApp;
