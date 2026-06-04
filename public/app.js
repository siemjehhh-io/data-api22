// State management
const API_TOKEN = "pin88_sec_e2c8a7b9d4f6c8e3";
let masterKey = "";
let currentBankFilter = "dp";
let db = {
    mainContacts: {
        phone: { value: "", note: "" },
        wa: { value: "", note: "" },
        tg: { value: "", note: "" },
        tgPhone: { value: "", note: "" }
    },
    backupContacts: [],
    banks: [],
    socials: [],
    qris: [],
    pulsa: []
};

// ============================================================
// Google Sheets Database API Integration (Vercel Mode)
// ============================================================

function getDbMode() {
    return localStorage.getItem('pin88_db_mode') || 'local';
}

function callSheetsAPI(action, data, successCallback, failureCallback) {
    const gasUrl = localStorage.getItem('pin88_gas_url');
    if (!gasUrl) {
        if (failureCallback) failureCallback(new Error("URL Google Apps Script belum dikonfigurasi."));
        return;
    }
    
    const payload = {
        action: action,
        data: data
    };
    if (data && typeof data === 'string') {
        payload.id = data;
    } else if (data && data.id) {
        payload.id = data.id;
    }
    
    fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: {
            'Content-Type': 'text/plain'
        },
        body: JSON.stringify(payload)
    })
    .then(response => {
        if (!response.ok) throw new Error("HTTP error " + response.status);
        return response.json();
    })
    .then(result => {
        if (result && result.success) {
            if (successCallback) successCallback(result);
        } else {
            throw new Error(result ? result.error : "Gagal memproses request.");
        }
    })
    .catch(err => {
        console.error("Sheets API Error:", err);
        if (failureCallback) failureCallback(err);
    });
}

function loadAllDataFromSheets(callback) {
    showLoadingOverlay('Memuat data dari Google Sheets...');
    callSheetsAPI('getAllData', null, function(result) {
        hideLoadingOverlay();
        if (result && result.db) {
            db = result.db;
            renderApp();
            if (callback) callback();
        }
    }, function(err) {
        hideLoadingOverlay();
        showAlert('Gagal memuat data dari Google Sheets: ' + err.message + '\n\nPastikan SPREADSHEET_ID di Code.gs sudah diisi dengan benar.', 'Error Koneksi');
    });
}

function toggleDbModeSettings() {
    const mode = document.getElementById('dbModeSelect').value;
    const fieldsDiv = document.getElementById('gasSettingsFields');
    if (mode === 'sheets') {
        fieldsDiv.style.display = 'block';
        document.getElementById('gasWebAppUrlInput').value = localStorage.getItem('pin88_gas_url') || '';
    } else {
        fieldsDiv.style.display = 'none';
    }
}

function saveGasSettings() {
    const gasUrl = document.getElementById('gasWebAppUrlInput').value.trim();
    if (!gasUrl) {
        showAlert('Silakan masukkan URL Web App Google Script!', 'Peringatan');
        return;
    }
    
    showLoadingOverlay('Menghubungkan ke Google Sheets...');
    fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'initSheets' })
    })
    .then(res => {
        if (!res.ok) throw new Error("HTTP error " + res.status);
        return res.json();
    })
    .then(result => {
        hideLoadingOverlay();
        if (result && result.success) {
            localStorage.setItem('pin88_db_mode', 'sheets');
            localStorage.setItem('pin88_gas_url', gasUrl);
            showToast('Koneksi Google Sheets berhasil dihubungkan!');
            loadAllDataFromSheets();
        } else {
            showAlert('Gagal menghubungkan. Google Script merespon: ' + (result ? result.error : ''), 'Koneksi Gagal');
        }
    })
    .catch(err => {
        hideLoadingOverlay();
        showAlert('Gagal menghubungkan. Pastikan URL benar dan Google Script dideploy sebagai "Anyone".\n\nDetail: ' + err.message, 'Koneksi Gagal');
    });
}

function resetToLocalServerSettings() {
    localStorage.removeItem('pin88_db_mode');
    localStorage.removeItem('pin88_gas_url');
    document.getElementById('dbModeSelect').value = 'local';
    document.getElementById('gasSettingsFields').style.display = 'none';
    showToast('Reset ke Server API Lokal. Silakan reload halaman.');
    setTimeout(() => window.location.reload(), 1500);
}

function resetToLocalMode() {
    localStorage.setItem('pin88_db_mode', 'local');
    localStorage.removeItem('pin88_gas_url');
    showToast('Mengalihkan ke database Vercel KV...');
    setTimeout(() => window.location.reload(), 1000);
}

function testSetupGasUrl() {
    const gasUrl = document.getElementById('setupGasUrl').value.trim();
    if (!gasUrl) {
        showAlert('Silakan masukkan URL Web App Google Script!', 'Peringatan');
        return;
    }
    
    const btn = document.getElementById('btnTestSetupGasUrl');
    btn.innerText = 'Menghubungkan...';
    btn.disabled = true;
    
    fetch(gasUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'initSheets' })
    })
    .then(res => {
        if (!res.ok) throw new Error("HTTP error " + res.status);
        return res.json();
    })
    .then(result => {
        btn.innerText = 'Hubungkan ke Sheets';
        btn.disabled = false;
        if (result && result.success) {
            localStorage.setItem('pin88_db_mode', 'sheets');
            localStorage.setItem('pin88_gas_url', gasUrl);
            showAlert('Koneksi Google Sheets berhasil! Silakan tentukan/masukkan Master Password di atas untuk masuk.', 'Sukses');
            document.getElementById('gasConfigContainer').style.display = 'none';
        } else {
            showAlert('Gagal menghubungkan. Google Script merespon: ' + (result ? result.error : ''), 'Koneksi Gagal');
        }
    })
    .catch(err => {
        btn.innerText = 'Hubungkan ke Sheets';
        btn.disabled = false;
        showAlert('Gagal menghubungkan. Pastikan URL benar dan Google Script dideploy sebagai "Anyone".\n\nDetail: ' + err.message, 'Koneksi Gagal');
    });
}

// Initial Checks
window.addEventListener('DOMContentLoaded', async () => {
    if (typeof CryptoJS === 'undefined') {
        showAlert("PERINGATAN: Library keamanan CryptoJS gagal dimuat secara lokal. Pastikan file 'crypto-js.min.js' ada di folder yang sama dengan 'index.html'.", "Peringatan Sistem");
    }
    
    // Default to 'local' mode (which on Vercel connects to our Serverless Vercel KV API)
    if (!localStorage.getItem('pin88_db_mode')) {
        localStorage.setItem('pin88_db_mode', 'local');
    }
    
    const dbMode = getDbMode();
    const gasUrl = localStorage.getItem('pin88_gas_url');
    
    // Setup UI for Settings
    const modeSelect = document.getElementById('dbModeSelect');
    if (modeSelect) {
        modeSelect.value = dbMode;
        toggleDbModeSettings();
    }
    
    if (dbMode === 'sheets') {
        if (!gasUrl) {
            // Show configuration setup on login screen
            const setupDiv = document.getElementById('gasConfigContainer');
            if (setupDiv) setupDiv.style.display = 'block';
        }
    } else {
        // Only sync from Express API if we are in local server mode
        await syncFromServer();
    }
    
    checkPasswordStatus();
    
    // Auto-format nominal inputs with dots
    const balanceInput = document.getElementById('pulsaBalance');
    const diffInput = document.getElementById('pulsaDifference');
    if (balanceInput) {
        balanceInput.addEventListener('input', (e) => {
            e.target.value = formatNominalInput(e.target.value);
        });
    }
    if (diffInput) {
        diffInput.addEventListener('input', (e) => {
            e.target.value = formatNominalInput(e.target.value);
        });
    }
});

function checkPasswordStatus() {
    const hash = localStorage.getItem('pin88_password_hash');
    const authTitle = document.getElementById('authTitle');
    const authDesc = document.getElementById('authDesc');
    const authBtnText = document.getElementById('authBtnText');
    
    if (hash) {
        authTitle.innerText = "Masukkan Master Password";
        authDesc.innerText = "Gunakan kata sandi Anda untuk memecahkan enkripsi dan membuka data PIN88.";
        authBtnText.innerText = "Buka Dashboard";
    } else {
        authTitle.innerText = "Set Master Password Baru";
        authDesc.innerText = "Tentukan kata sandi utama untuk mengamankan data secara lokal di browser Anda.";
        authBtnText.innerText = "Simpan & Masuk";
    }
}

// Authentication
function handleAuth(event) {
    event.preventDefault();
    const passwordInput = document.getElementById('masterPasswordInput').value;
    const hash = localStorage.getItem('pin88_password_hash');
    const errorDiv = document.getElementById('authError');
    
    if (getDbMode() === 'sheets' && !localStorage.getItem('pin88_gas_url')) {
        showAlert('Silakan hubungkan database Google Sheets Anda terlebih dahulu sebelum masuk!', 'Peringatan');
        return;
    }
    
    if (typeof CryptoJS === 'undefined') {
        showAlert("Library enkripsi CryptoJS tidak ditemukan. Hubungi developer atau download kembali file 'crypto-js.min.js'.", "Kesalahan Sistem");
        return;
    }
    
    try {
        if (!hash) {
            // First time setup
            const newHash = CryptoJS.SHA256(passwordInput).toString();
            localStorage.setItem('pin88_password_hash', newHash);
            masterKey = passwordInput;
            
            if (getDbMode() !== 'sheets') {
                // Initialize empty encrypted DB structure for local server
                saveDatabaseToStorage();
            }
            
            loginSuccess();
        } else {
            // Verification
            const inputHash = CryptoJS.SHA256(passwordInput).toString();
            if (inputHash === hash) {
                masterKey = passwordInput;
                errorDiv.style.display = 'none';
                
                if (getDbMode() === 'sheets') {
                    loginSuccess();
                } else {
                    // Load and decrypt local database
                    if (loadDatabaseFromStorage()) {
                        loginSuccess();
                    } else {
                        errorDiv.innerText = "Gagal memproses dekripsi database. Master password mungkin salah.";
                        errorDiv.style.display = 'block';
                    }
                }
            } else {
                errorDiv.innerText = "Kata sandi salah! Coba lagi.";
                errorDiv.style.display = 'block';
            }
        }
    } catch (e) {
        console.error("Authentication Error: ", e);
        errorDiv.innerText = "Terjadi kesalahan sistem: " + e.message;
        errorDiv.style.display = 'block';
    }
}

function loginSuccess() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'grid';
    document.getElementById('masterPasswordInput').value = '';
    
    if (getDbMode() === 'sheets') {
        loadAllDataFromSheets();
    } else {
        renderApp();
    }
}

function lockApp() {
    masterKey = "";
    document.getElementById('appScreen').style.display = 'none';
    document.getElementById('authScreen').style.display = 'flex';
    checkPasswordStatus();
}

// Encryption Helpers
function encrypt(text) {
    if (!text) return "";
    return CryptoJS.AES.encrypt(text, masterKey).toString();
}

function decrypt(ciphertext) {
    if (!ciphertext) return "";
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, masterKey);
        return bytes.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        console.error("Decryption error:", e);
        return null;
    }
}

// Storage Management
function saveDatabaseToStorage() {
    try {
        const encryptedDb = {
            mainContacts: {
                phone: encrypt(JSON.stringify(db.mainContacts.phone)),
                wa: encrypt(JSON.stringify(db.mainContacts.wa)),
                tg: encrypt(JSON.stringify(db.mainContacts.tg)),
                tgPhone: encrypt(JSON.stringify(db.mainContacts.tgPhone || { value: "", note: "" }))
            },
            backupContacts: (db.backupContacts || []).map(bc => ({
                id: bc.id,
                name: encrypt(bc.name),
                type: encrypt(bc.type),
                value: encrypt(bc.value),
                note: encrypt(bc.note || "")
            })),
            banks: db.banks.map(bank => ({
                id: bank.id,
                name: encrypt(bank.name),
                category: encrypt(bank.category || "dp"),
                accountNo: encrypt(bank.accountNo),
                accountName: encrypt(bank.accountName),
                note: encrypt(bank.note || ""),
                accesses: (bank.accesses || []).map(acc => ({
                    id: acc.id,
                    type: encrypt(acc.type || "custom"),
                    url: encrypt(acc.url || ""),
                    user: encrypt(acc.user || ""),
                    corpId: encrypt(acc.corpId || ""),
                    password: encrypt(acc.password || ""),
                    pin: encrypt(acc.pin || ""),
                    note: encrypt(acc.note || "")
                }))
            })),
            socials: db.socials.map(soc => ({
                id: soc.id,
                platform: encrypt(soc.platform),
                url: encrypt(soc.url),
                user: encrypt(soc.user),
                password: encrypt(soc.password),
                note: encrypt(soc.note)
            })),
            qris: db.qris.map(q => ({
                id: q.id,
                name: encrypt(q.name),
                url: encrypt(q.url),
                user: encrypt(q.user),
                password: encrypt(q.password),
                note: encrypt(q.note)
            })),
            pulsa: (db.pulsa || []).map(p => ({
                id: p.id,
                name: encrypt(p.name),
                phone: encrypt(p.phone),
                activePeriod: encrypt(p.activePeriod),
                balance: encrypt(p.balance || ""),
                difference: encrypt(p.difference || ""),
                note: encrypt(p.note || "")
            }))
        };
        localStorage.setItem('pin88_secure_db', JSON.stringify(encryptedDb));
        
        // Push payload to server API in the background
        const payload = {
            hash: localStorage.getItem('pin88_password_hash'),
            db: encryptedDb
        };
        fetch('/api/db', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-PIN88-Token': API_TOKEN
            },
            body: JSON.stringify(payload)
        }).catch(err => console.error("Failed to sync to server database:", err));

        return true;
    } catch (e) {
        console.error("Error saving database:", e);
        return false;
    }
}

function migrateDatabaseSchema() {
    if (db.banks && db.banks.length > 0) {
        const isFlat = db.banks.some(b => !Array.isArray(b.accesses));
        if (isFlat) {
            console.log("Migrating database banks schema to nested accesses format...");
            const grouped = {};
            db.banks.forEach(b => {
                if (Array.isArray(b.accesses)) {
                    const key = `${(b.name || '').trim().toLowerCase()}_${(b.accountNo || '').trim()}_${b.category || 'dp'}`;
                    if (!grouped[key]) {
                        grouped[key] = b;
                    } else {
                        grouped[key].accesses = grouped[key].accesses.concat(b.accesses);
                    }
                } else {
                    const name = (b.name || '').trim();
                    const accNo = (b.accountNo || '').trim();
                    const category = b.category || 'dp';
                    const accName = b.accountName || '';
                    const note = b.note || '';

                    const key = `${name.toLowerCase()}_${accNo}_${category}`;
                    if (!grouped[key]) {
                        grouped[key] = {
                            id: 'bank_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                            name: name,
                            category: category,
                            accountNo: accNo,
                            accountName: accName,
                            note: note,
                            accesses: []
                        };
                    }
                    
                    grouped[key].accesses.push({
                        id: b.id || 'access_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                        type: b.type || 'custom',
                        url: b.url || '',
                        user: b.user || '',
                        corpId: b.corpId || '',
                        password: b.password || '',
                        pin: b.pin || '',
                        note: b.note || ''
                    });
                }
            });
            db.banks = Object.values(grouped);
            return true;
        }
    }
    return false;
}

function loadDatabaseFromStorage() {
    const rawData = localStorage.getItem('pin88_secure_db');
    if (!rawData) {
        // DB does not exist yet
        return true;
    }
    try {
        const encryptedDb = JSON.parse(rawData);
        
        // Helper to parse contact object safely
        const parseContactObj = (decryptedStr) => {
            if (!decryptedStr) return { value: "", note: "" };
            try {
                const obj = JSON.parse(decryptedStr);
                if (obj && typeof obj === 'object') {
                    return {
                        value: obj.value || "",
                        note: obj.note || ""
                    };
                }
            } catch (e) {}
            return { value: decryptedStr, note: "" };
        };

        // Decrypt main contacts
        const rawPhone = decrypt(encryptedDb.mainContacts?.phone || "");
        const rawWa = decrypt(encryptedDb.mainContacts?.wa || "");
        const rawTg = decrypt(encryptedDb.mainContacts?.tg || "");
        const rawTgPhone = decrypt(encryptedDb.mainContacts?.tgPhone || "");
        
        db.mainContacts = {
            phone: parseContactObj(rawPhone),
            wa: parseContactObj(rawWa),
            tg: parseContactObj(rawTg),
            tgPhone: parseContactObj(rawTgPhone)
        };

        // Decrypt backup contacts or migrate
        db.backupContacts = [];
        if (encryptedDb.backupContacts) {
            db.backupContacts = (encryptedDb.backupContacts || []).map(bc => ({
                id: bc.id,
                name: decrypt(bc.name),
                type: decrypt(bc.type) || "phone",
                value: decrypt(bc.value),
                note: decrypt(bc.note || "")
            }));
        } else {
            // Migrate old backup contacts
            const rawBackupWa = decrypt(encryptedDb.mainContacts?.backupWa || "");
            const rawBackupTg = decrypt(encryptedDb.mainContacts?.backupTg || "");
            if (rawBackupWa) {
                db.backupContacts.push({
                    id: 'backup_wa_migrated',
                    name: 'WhatsApp Cadangan',
                    type: 'wa',
                    value: rawBackupWa,
                    note: 'Migrasi otomatis'
                });
            }
            if (rawBackupTg) {
                db.backupContacts.push({
                    id: 'backup_tg_migrated',
                    name: 'Telegram Cadangan',
                    type: 'tg',
                    value: rawBackupTg,
                    note: 'Migrasi otomatis'
                });
            }
        }
        
        // Decrypt banks
        db.banks = (encryptedDb.banks || []).map(bank => {
            if (Array.isArray(bank.accesses)) {
                return {
                    id: bank.id,
                    name: decrypt(bank.name),
                    category: decrypt(bank.category) || "dp",
                    accountNo: decrypt(bank.accountNo),
                    accountName: decrypt(bank.accountName),
                    note: decrypt(bank.note || ""),
                    accesses: bank.accesses.map(acc => ({
                        id: acc.id,
                        type: decrypt(acc.type) || "custom",
                        url: decrypt(acc.url || ""),
                        user: decrypt(acc.user || ""),
                        corpId: decrypt(acc.corpId || ""),
                        password: decrypt(acc.password || ""),
                        pin: decrypt(acc.pin || ""),
                        note: decrypt(acc.note || "")
                    }))
                };
            } else {
                return {
                    id: bank.id,
                    name: decrypt(bank.name),
                    type: decrypt(bank.type) || "custom",
                    category: decrypt(bank.category) || "dp",
                    accountNo: decrypt(bank.accountNo),
                    accountName: decrypt(bank.accountName),
                    url: decrypt(bank.url),
                    user: decrypt(bank.user),
                    corpId: decrypt(bank.corpId || ""),
                    password: decrypt(bank.password),
                    pin: decrypt(bank.pin || ""),
                    note: decrypt(bank.note || "")
                };
            }
        });

        // Trigger migration if there are flat bank entries
        const hasFlat = db.banks.some(b => !Array.isArray(b.accesses));
        if (hasFlat) {
            migrateDatabaseSchema();
            // Save the migrated structure to storage
            setTimeout(() => {
                saveDatabaseToStorage();
            }, 100);
        }
        
        // Decrypt socials
        db.socials = (encryptedDb.socials || []).map(soc => ({
            id: soc.id,
            platform: decrypt(soc.platform),
            url: decrypt(soc.url),
            user: decrypt(soc.user),
            password: decrypt(soc.password),
            note: decrypt(soc.note)
        }));

        // Decrypt qris
        db.qris = (encryptedDb.qris || []).map(q => ({
            id: q.id,
            name: decrypt(q.name),
            url: decrypt(q.url),
            user: decrypt(q.user),
            password: decrypt(q.password),
            note: decrypt(q.note)
        }));
        
        // Decrypt pulsa
        db.pulsa = (encryptedDb.pulsa || []).map(p => ({
            id: p.id,
            name: decrypt(p.name),
            phone: decrypt(p.phone),
            activePeriod: decrypt(p.activePeriod),
            balance: decrypt(p.balance) || "",
            difference: decrypt(p.difference) || "",
            note: decrypt(p.note) || ""
        }));
        
        // Validation check (if any decrypted value is null, password key might be wrong)
        if (rawPhone === null && rawData.length > 50) {
            return false;
        }
        
        return true;
    } catch (e) {
        console.error("Failed to load or parse database:", e);
        return false;
    }
}

// UI Rendering
function renderApp() {
    // Render Main & Backup Contacts
    renderContacts();

    // Stats
    document.getElementById('statBanks').innerText = db.banks.length;
    document.getElementById('statSocials').innerText = db.socials.length;

    // Render Bank List
    renderBanks();
    
    // Render Socials
    renderSocials();

    // Render QRIS
    renderQris();
}

function renderContacts() {
    // 1. Render Main Contacts
    const mainContainer = document.getElementById('mainContactsContainer');
    if (mainContainer) {
        mainContainer.innerHTML = '';
        
        const phone = db.mainContacts.phone || { value: "", note: "" };
        const wa = db.mainContacts.wa || { value: "", note: "" };
        const tg = db.mainContacts.tg || { value: "", note: "" };
        const tgPhone = db.mainContacts.tgPhone || { value: "", note: "" };
        
        const contactsList = [
            { key: 'phone', label: 'No. Telepon Utama', data: phone, icon: `<svg xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px; color: var(--accent-active);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>` },
            { key: 'wa', label: 'No. WhatsApp Utama', data: wa, icon: `<svg xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px; color: var(--pastel-green-text);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>` },
            { key: 'tg', label: 'Username Telegram Utama', data: tg, icon: `<svg xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px; color: var(--pastel-blue-text);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>` },
            { key: 'tgPhone', label: 'No. Telepon Telegram Utama', data: tgPhone, icon: `<svg xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px; color: var(--pastel-blue-text);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>` }
        ];
        
        contactsList.forEach(c => {
            const row = document.createElement('div');
            row.className = 'contact-row-highlighted';
            
            const hasVal = !!c.data.value;
            const displayVal = hasVal ? c.data.value : 'Belum diisi';
            const noteHtml = c.data.note ? `<div class="contact-note-bubble">${escapeHTML(c.data.note)}</div>` : '';
            const copyButton = hasVal ? `
                <button class="copy-btn" onclick="copyRawText('${escapeJSVal(c.data.value)}')" title="Salin">
                    <svg xmlns="http://www.w3.org/2000/svg" style="width: 14px; height: 14px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </button>
            ` : '';
            
            row.innerHTML = `
                <div style="display: flex; align-items: flex-start; gap: 12px; width: 100%;">
                    <div class="contact-icon-wrapper">${c.icon}</div>
                    <div style="flex-grow: 1;">
                        <div class="contact-label-new">${c.label}</div>
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
                            <span class="contact-value-new ${hasVal ? 'filled' : 'empty'}">${escapeHTML(displayVal)}</span>
                            ${copyButton}
                        </div>
                        ${noteHtml}
                    </div>
                </div>
            `;
            mainContainer.appendChild(row);
        });
    }

    // 2. Render Backup Contacts
    const backupContainer = document.getElementById('backupContactsContainer');
    if (backupContainer) {
        backupContainer.innerHTML = '';
        
        const backupList = db.backupContacts || [];
        if (backupList.length === 0) {
            backupContainer.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 25px 20px; font-size: 0.9rem;">Belum ada kontak cadangan. Klik "Tambah Cadangan" di atas.</div>';
            return;
        }
        
        backupList.forEach(bc => {
            let icon = '';
            if (bc.type === 'wa') {
                icon = `<svg xmlns="http://www.w3.org/2000/svg" style="width: 16px; height: 16px; color: var(--pastel-green-text);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>`;
            } else if (bc.type === 'tg') {
                icon = `<svg xmlns="http://www.w3.org/2000/svg" style="width: 16px; height: 16px; color: var(--pastel-blue-text);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>`;
            } else {
                icon = `<svg xmlns="http://www.w3.org/2000/svg" style="width: 16px; height: 16px; color: var(--accent-active);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>`;
            }
            
            const row = document.createElement('div');
            row.className = 'contact-row-highlighted';
            row.style.borderLeftColor = bc.type === 'wa' ? 'var(--pastel-green)' : (bc.type === 'tg' ? 'var(--pastel-blue)' : 'var(--accent-active)');
            
            const noteHtml = bc.note ? `<div class="contact-note-bubble">${escapeHTML(bc.note)}</div>` : '';
            
            row.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                    <div style="display: flex; gap: 12px; flex-grow: 1;">
                        <div class="contact-icon-wrapper" style="background: rgba(0,0,0,0.03);">${icon}</div>
                        <div style="flex-grow: 1;">
                            <div class="contact-label-new">${escapeHTML(bc.name)} <span style="font-weight: normal; opacity: 0.7; font-size: 0.8rem;">(${bc.type.toUpperCase()})</span></div>
                            <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
                                <span class="contact-value-new filled">${escapeHTML(bc.value)}</span>
                                <button class="copy-btn" onclick="copyRawText('${escapeJSVal(bc.value)}')" title="Salin">
                                    <svg xmlns="http://www.w3.org/2000/svg" style="width: 14px; height: 14px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                </button>
                            </div>
                            ${noteHtml}
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px; align-items: center; margin-left: 10px; flex-shrink: 0;">
                        <button class="action-btn edit" onclick="editBackupContact('${bc.id}')" title="Edit" style="width: 28px; height: 28px;">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button class="action-btn delete" onclick="deleteBackupContact('${bc.id}')" title="Hapus" style="width: 28px; height: 28px;">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                </div>
            `;
            backupContainer.appendChild(row);
        });
    }
}

const bankTypeLabels = {
    custom: "Kustom",
    klik_bca: "Klik BCA",
    mbanking_bca: "M-Banking BCA",
    mybca: "MyBCA",
    ebanking_bni: "E-Banking BNI",
    mbanking_bni: "M-Banking BNI",
    bni_wondr: "BNI Wondr",
    qlola_bri: "Qlola BRI",
    mbanking_bri: "M-Banking BRI"
};

function renderBanks() {
    const container = document.getElementById('banksContainer');
    container.innerHTML = '';
    
    // Render Pulsa cards if currentBankFilter is 'pulsa'
    if (currentBankFilter === 'pulsa') {
        const pulsaList = db.pulsa || [];
        if (pulsaList.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); grid-column: span 3; text-align: center; padding: 40px;">Belum ada data Pulsa. Klik "Tambah Pulsa" di atas.</div>';
            return;
        }
        
        pulsaList.forEach(item => {
            const card = document.createElement('div');
            card.className = 'data-card pulsa-card';
            
            // Determine styling for "Selisih"
            let diffStyle = 'color: var(--text-primary);';
            const diffVal = (item.difference || '').trim();
            if (diffVal) {
                if (diffVal.startsWith('-')) {
                    diffStyle = 'color: var(--accent-red); font-weight: bold;';
                } else if (diffVal === '0') {
                    diffStyle = 'color: var(--text-secondary); font-weight: normal;';
                } else {
                    diffStyle = 'color: var(--pastel-green-text); font-weight: bold;';
                }
            }
            
            let fieldsHtml = `
                <div class="data-card-header">
                    <div class="data-card-title">
                        ${escapeHTML(item.name)}
                        <span class="category-tag pulsa" style="background-color: var(--pastel-purple); color: var(--pastel-purple-text); margin-left: 8px;">PULSA</span>
                    </div>
                    <div class="data-card-actions">
                        <button class="action-btn edit" onclick="editPulsa('${item.id}')" title="Edit">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button class="action-btn delete" onclick="deletePulsa('${item.id}')" title="Hapus">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                </div>
                <div class="data-field">
                    <div class="data-field-info">
                        <span class="data-field-label">Nomor Telepon</span>
                        <span class="data-field-value" id="phone-${item.id}">${escapeHTML(item.phone)}</span>
                    </div>
                    <button class="copy-btn" onclick="copyText('phone-${item.id}')" title="Salin Nomor">
                        <svg xmlns="http://www.w3.org/2000/svg" style="width: 14px; height: 14px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    </button>
                </div>
                <div class="data-field">
                    <div class="data-field-info">
                        <span class="data-field-label">Masa Aktif</span>
                        <span class="data-field-value">${escapeHTML(formatDisplayDate(item.activePeriod))}</span>
                    </div>
                </div>
            `;
            
            if (item.balance) {
                fieldsHtml += `
                    <div class="data-field">
                        <div class="data-field-info">
                            <span class="data-field-label">Saldo Akhir</span>
                            <span class="data-field-value">${escapeHTML(item.balance)}</span>
                        </div>
                    </div>
                `;
            }
            
            if (item.difference) {
                fieldsHtml += `
                    <div class="data-field">
                        <div class="data-field-info">
                            <span class="data-field-label">Selisih</span>
                            <span class="data-field-value" style="${diffStyle}">${escapeHTML(item.difference)}</span>
                        </div>
                    </div>
                `;
            }
            
            if (item.note) {
                fieldsHtml += `
                    <div style="margin-top: 12px; font-size: 0.8rem; background: rgba(0,0,0,0.04); padding: 8px; border-radius: var(--radius-sm); color: var(--text-secondary); border: 1px solid var(--border-color);">
                        <strong>Keterangan:</strong> ${escapeHTML(item.note)}
                    </div>
                `;
            }
            
            card.innerHTML = fieldsHtml;
            container.appendChild(card);
        });
        return;
    }
    
    // Filter banks
    const filteredBanks = db.banks.filter(bank => {
        return (bank.category || 'dp') === currentBankFilter;
    });
    
    if (filteredBanks.length === 0) {
        let emptyMsg = 'Belum ada data bank.';
        if (currentBankFilter === 'dp') {
            emptyMsg = 'Belum ada data BANK DP (Deposit).';
        } else if (currentBankFilter === 'wd') {
            emptyMsg = 'Belum ada data BANK WD (Withdrawal).';
        }
        container.innerHTML = `<div style="color: var(--text-muted); grid-column: span 3; text-align: center; padding: 40px;">${emptyMsg} Klik "Tambah Bank" di atas.</div>`;
        return;
    }
    
    filteredBanks.forEach(bank => {
        const nameLower = (bank.name || '').toLowerCase();
        let bankClass = '';
        if (nameLower.includes('bca')) {
            bankClass = 'bank-bca';
        } else if (nameLower.includes('bni')) {
            bankClass = 'bank-bni';
        } else if (nameLower.includes('bri')) {
            bankClass = 'bank-bri';
        } else if (nameLower.includes('mandiri')) {
            bankClass = 'bank-mandiri';
        }
        
        const card = document.createElement('div');
        card.className = `data-card bank ${bankClass}`;
        card.id = `bank-card-${bank.id}`;
        
        let fieldsHtml = `
            <div class="bank-header-new">
                <div class="bank-header-left">
                    ${getBankLogoHtml(bank.name)}
                    <div class="bank-title-group">
                        <span class="bank-name-title">${escapeHTML(bank.name)}</span>
                        <span class="bank-category-subtitle">(${bank.category === 'dp' ? 'Deposit' : 'Withdrawal'})</span>
                    </div>
                </div>
                <div class="bank-header-right">
                    <div class="bank-acc-no-row">
                        <span class="bank-acc-no">${escapeHTML(bank.accountNo)}</span>
                        <button class="copy-icon-btn" onclick="copyRawText('${escapeJSVal(bank.accountNo)}')" title="Salin Rekening">
                            <svg xmlns="http://www.w3.org/2000/svg" style="width: 14px; height: 14px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        </button>
                    </div>
                    <div class="bank-acc-name-row" style="display: flex; align-items: center; gap: 8px;">
                        <span class="bank-acc-name">${escapeHTML(bank.accountName)}</span>
                        <div style="display: flex; gap: 4px; margin-left: 4px;">
                            <button class="copy-icon-btn" onclick="editBank('${bank.id}')" title="Edit Rekening">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button class="copy-icon-btn" onclick="deleteBank('${bank.id}')" title="Hapus Rekening" style="color: rgba(234, 112, 102, 0.75);">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width: 12px; height: 12px;"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (bank.note) {
            fieldsHtml += `
                <div class="bank-note-box">
                    <strong>Catatan Rekening:</strong> ${escapeHTML(bank.note)}
                </div>
            `;
        }

        // Render Accesses
        const accesses = bank.accesses || [];
        if (accesses.length > 0) {
            fieldsHtml += `
                <div class="bank-accesses-box">
                    <div class="bank-access-tabs-pill">
            `;
            
            accesses.forEach((acc, aIdx) => {
                const typeLabel = bankTypeLabels[acc.type || 'custom'] || 'Kustom';
                fieldsHtml += `
                    <button class="bank-access-tab-link" data-access-id="${acc.id}" onclick="switchBankAccessTab('${bank.id}', '${acc.id}')">
                        ${escapeHTML(typeLabel)}
                    </button>
                `;
            });
            
            fieldsHtml += `
                    </div>
                    <div class="bank-access-panels">
            `;
            
            accesses.forEach((acc, aIdx) => {
                const isBca = nameLower.includes('bca') || acc.type.toLowerCase().includes('bca');
                const passLabel = isBca ? 'KeyBCA / Password' : 'Password Login';
                
                fieldsHtml += `
                    <div class="bank-access-panel" id="panel-${bank.id}-${acc.id}" style="display: none; animation: slideDown 0.3s ease;">
                        <div class="bank-credentials-grid">
                            ${acc.user ? `
                                <div class="bank-cred-cell">
                                    <div class="bank-cred-label">Username:</div>
                                    <div class="bank-cred-val-row">
                                        <span class="bank-cred-value">${escapeHTML(acc.user)}</span>
                                        <button class="copy-btn-nobg" onclick="copyRawText('${escapeJSVal(acc.user)}')" title="Salin Username">
                                            <svg xmlns="http://www.w3.org/2000/svg" style="width: 13px; height: 13px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                        </button>
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${acc.password ? `
                                <div class="bank-cred-cell">
                                    <div class="bank-cred-label">${passLabel}:</div>
                                    <div class="bank-cred-val-row">
                                        <span class="bank-cred-value password-val" data-value="${escapeHTML(acc.password)}" data-hidden="true">••••••••</span>
                                        <div style="display: flex; gap: 4px;">
                                            <button class="copy-btn-nobg" onclick="copyRawText('${escapeJSVal(acc.password)}')" title="Salin Password">
                                                <svg xmlns="http://www.w3.org/2000/svg" style="width: 13px; height: 13px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                            </button>
                                            <button class="copy-btn-nobg eye-btn" onclick="togglePasswordVisibility(this)" title="Lihat Password">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px;"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${acc.corpId ? `
                                <div class="bank-cred-cell">
                                    <div class="bank-cred-label">Corporate ID:</div>
                                    <div class="bank-cred-val-row">
                                        <span class="bank-cred-value">${escapeHTML(acc.corpId)}</span>
                                        <button class="copy-btn-nobg" onclick="copyRawText('${escapeJSVal(acc.corpId)}')" title="Salin Corporate ID">
                                            <svg xmlns="http://www.w3.org/2000/svg" style="width: 13px; height: 13px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                        </button>
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${acc.pin ? `
                                <div class="bank-cred-cell">
                                    <div class="bank-cred-label">PIN:</div>
                                    <div class="bank-cred-val-row">
                                        <span class="bank-cred-value">${escapeHTML(acc.pin)}</span>
                                        <button class="copy-btn-nobg" onclick="copyRawText('${escapeJSVal(acc.pin)}')" title="Salin PIN">
                                            <svg xmlns="http://www.w3.org/2000/svg" style="width: 13px; height: 13px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                        </button>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        
                        ${acc.note ? `
                            <div class="bank-note-box">
                                <strong>Keterangan Akses:</strong> ${escapeHTML(acc.note)}
                            </div>
                        ` : ''}
                        
                        ${acc.url ? `
                            <a href="${escapeHTML(acc.url)}" target="_blank" class="bank-pill-btn">
                                <span>Buka Link</span>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                        ` : ''}
                        <button class="bank-pill-btn" onclick="copyAllAccessData('${bank.id}', '${acc.id}')">
                            <span>Salin Data Chat</span>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                        </button>
                    </div>
                `;
            });
            
            fieldsHtml += `
                    </div>
                </div>
            `;
        }
        
        card.innerHTML = fieldsHtml;
        container.appendChild(card);
    });
}

function renderSocials() {
    const container = document.getElementById('socialsContainer');
    container.innerHTML = '';
    
    if (db.socials.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); grid-column: span 3; text-align: center; padding: 40px;">Belum ada data sosial media. Klik "Tambah Akses" di atas.</div>';
        return;
    }
    
    db.socials.forEach(soc => {
        const card = document.createElement('div');
        card.className = 'data-card social';
        card.innerHTML = `
            <div class="data-card-header">
                <div class="data-card-title">${escapeHTML(soc.platform)}</div>
                <div class="data-card-actions">
                    <button class="action-btn edit" onclick="editSocial('${soc.id}')" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button class="action-btn delete" onclick="deleteSocial('${soc.id}')" title="Hapus">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            </div>
            <div class="data-field">
                <div class="data-field-info">
                    <span class="data-field-label">Username / Email</span>
                    <span class="data-field-value" id="user-${soc.id}">${escapeHTML(soc.user)}</span>
                </div>
                <button class="copy-btn" onclick="copyText('user-${soc.id}')">
                    <svg xmlns="http://www.w3.org/2000/svg" style="width: 14px; height: 14px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </button>
            </div>
            <div class="data-field">
                <div class="data-field-info" style="flex-grow: 1;">
                    <span class="data-field-label">Password</span>
                    <span class="data-field-value" id="pass-${soc.id}">${escapeHTML(soc.password || '-')}</span>
                </div>
                ${soc.password ? `
                <button class="copy-btn" onclick="copyText('pass-${soc.id}')">
                    <svg xmlns="http://www.w3.org/2000/svg" style="width: 14px; height: 14px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </button>
                ` : ''}
            </div>
            ${soc.url ? `
                <div style="margin-top: 15px;">
                    <a href="${escapeHTML(soc.url)}" target="_blank" class="btn-secondary" style="font-size: 0.85rem; padding: 8px 12px; justify-content: center; width: 100%;">
                        Buka Halaman Login
                        <svg xmlns="http://www.w3.org/2000/svg" style="width: 14px; height: 14px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                </div>
            ` : ''}
            ${soc.note ? `
                <div style="margin-top: 12px; font-size: 0.8rem; background: rgba(0,0,0,0.2); padding: 8px; border-radius: var(--radius-sm); color: var(--text-secondary);">
                    <strong>Catatan:</strong> ${escapeHTML(soc.note)}
                </div>
            ` : ''}
        `;
        container.appendChild(card);
    });
}

function renderQris() {
    const container = document.getElementById('qrisContainer');
    container.innerHTML = '';
    
    if (db.qris.length === 0) {
        container.innerHTML = '<div style="color: var(--text-muted); grid-column: span 3; text-align: center; padding: 40px;">Belum ada data QRIS. Klik "Tambah Akses QRIS" di atas.</div>';
        return;
    }
    
    db.qris.forEach(q => {
        const card = document.createElement('div');
        card.className = 'data-card';
        card.innerHTML = `
            <div class="data-card-header">
                <div class="data-card-title">${escapeHTML(q.name)}</div>
                <div class="data-card-actions">
                    <button class="action-btn edit" onclick="editQris('${q.id}')" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button class="action-btn delete" onclick="deleteQris('${q.id}')" title="Hapus">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            </div>
            <div class="data-field">
                <div class="data-field-info">
                    <span class="data-field-label">Username / Merchant ID</span>
                    <span class="data-field-value" id="user-${q.id}">${escapeHTML(q.user)}</span>
                </div>
                <button class="copy-btn" onclick="copyText('user-${q.id}')">
                    <svg xmlns="http://www.w3.org/2000/svg" style="width: 14px; height: 14px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </button>
            </div>
            <div class="data-field">
                <div class="data-field-info" style="flex-grow: 1;">
                    <span class="data-field-label">Password / Secret Key</span>
                    <span class="data-field-value" id="pass-${q.id}">${escapeHTML(q.password || '-')}</span>
                </div>
                ${q.password ? `
                <button class="copy-btn" onclick="copyText('pass-${q.id}')">
                    <svg xmlns="http://www.w3.org/2000/svg" style="width: 14px; height: 14px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </button>
                ` : ''}
            </div>
            ${q.url ? `
                <div style="margin-top: 15px;">
                    <a href="${escapeHTML(q.url)}" target="_blank" class="btn-secondary" style="font-size: 0.85rem; padding: 8px 12px; justify-content: center; width: 100%;">
                        Buka Dashboard QRIS
                        <svg xmlns="http://www.w3.org/2000/svg" style="width: 14px; height: 14px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                </div>
            ` : ''}
            ${q.note ? `
                <div style="margin-top: 12px; font-size: 0.8rem; background: rgba(0,0,0,0.2); padding: 8px; border-radius: var(--radius-sm); color: var(--text-secondary);">
                    <strong>Catatan:</strong> ${escapeHTML(q.note)}
                </div>
            ` : ''}
        `;
        container.appendChild(card);
    });
}

// Form Saves (CRUD)
function saveMainContacts(event) {
    event.preventDefault();
    const contactsData = {
        phone: {
            value: document.getElementById('inMainPhone').value,
            note: document.getElementById('inMainPhoneNote').value
        },
        wa: {
            value: document.getElementById('inMainWA').value,
            note: document.getElementById('inMainWANote').value
        },
        tg: {
            value: document.getElementById('inMainTG').value,
            note: document.getElementById('inMainTGNote').value
        },
        tgPhone: {
            value: document.getElementById('inMainTGPhone').value,
            note: document.getElementById('inMainTGPhoneNote').value
        }
    };
    
    if (getDbMode() === 'sheets') {
        showLoadingOverlay('Menyimpan kontak...');
        callSheetsAPI('saveMainContacts', contactsData, function() {
            hideLoadingOverlay();
            db.mainContacts = contactsData;
            renderApp();
            closeModal('modalMainContacts');
            showToast('Kontak utama berhasil diperbarui!');
        }, function(err) {
            hideLoadingOverlay();
            showAlert('Gagal menyimpan ke Google Sheets: ' + err.message, 'Error');
        });
        return;
    }
    
    db.mainContacts = contactsData;
    saveDatabaseToStorage();
    renderApp();
    closeModal('modalMainContacts');
    showToast('Kontak utama berhasil diperbarui!');
}

function saveBackupContact(event) {
    event.preventDefault();
    const id = document.getElementById('backupContactId').value || 'backup_' + Date.now();
    const contactData = {
        id: id,
        name: document.getElementById('backupContactName').value,
        type: document.getElementById('backupContactType').value,
        value: document.getElementById('backupContactValue').value,
        note: document.getElementById('backupContactNote').value
    };

    if (getDbMode() === 'sheets') {
        showLoadingOverlay('Menyimpan kontak cadangan...');
        callSheetsAPI('saveBackupContact', contactData, function() {
            hideLoadingOverlay();
            if (!db.backupContacts) db.backupContacts = [];
            const idx = db.backupContacts.findIndex(bc => bc.id === id);
            if (idx > -1) db.backupContacts[idx] = contactData;
            else db.backupContacts.push(contactData);
            renderApp();
            closeModal('modalAddBackupContact');
            showToast('Kontak cadangan berhasil disimpan!');
        }, function(err) {
            hideLoadingOverlay();
            showAlert('Gagal menyimpan: ' + err.message, 'Error');
        });
        return;
    }

    if (!db.backupContacts) {
        db.backupContacts = [];
    }

    const existingIndex = db.backupContacts.findIndex(bc => bc.id === id);
    if (existingIndex > -1) {
        db.backupContacts[existingIndex] = contactData;
    } else {
        db.backupContacts.push(contactData);
    }

    saveDatabaseToStorage();
    renderApp();
    closeModal('modalAddBackupContact');
    showToast('Kontak cadangan berhasil disimpan!');
}

function editBackupContact(id) {
    const bc = db.backupContacts.find(item => item.id === id);
    if (!bc) return;

    document.getElementById('backupContactId').value = bc.id;
    document.getElementById('backupContactName').value = bc.name;
    document.getElementById('backupContactType').value = bc.type || 'wa';
    document.getElementById('backupContactValue').value = bc.value;
    document.getElementById('backupContactNote').value = bc.note || '';

    document.getElementById('backupContactModalTitle').innerText = 'Edit Kontak Cadangan';
    openModal('modalAddBackupContact');
}

async function deleteBackupContact(id) {
    if (await showConfirm('Apakah Anda yakin ingin menghapus kontak cadangan ini?')) {
        if (getDbMode() === 'sheets') {
            showLoadingOverlay('Menghapus kontak cadangan...');
            callSheetsAPI('deleteBackupContact', id, function() {
                hideLoadingOverlay();
                db.backupContacts = db.backupContacts.filter(item => item.id !== id);
                renderApp();
                showToast('Kontak cadangan berhasil dihapus.');
            }, function(err) {
                hideLoadingOverlay();
                showAlert('Gagal menghapus: ' + err.message, 'Error');
            });
            return;
        }
        db.backupContacts = db.backupContacts.filter(item => item.id !== id);
        saveDatabaseToStorage();
        renderApp();
        showToast('Kontak cadangan berhasil dihapus.');
    }
}

function saveBank(event) {
    event.preventDefault();
    const id = document.getElementById('bankId').value || 'bank_' + Date.now();
    
    const accesses = [];
    const container = document.getElementById('formAccessesContainer');
    if (container) {
        const rows = container.querySelectorAll('.access-form-row');
        rows.forEach(row => {
            const accId = row.id.replace('accessRow_', 'access_') || 'access_' + Math.random().toString(36).substr(2, 9);
            accesses.push({
                id: accId,
                type: row.querySelector('.access-type-select').value,
                user: row.querySelector('.access-user').value,
                password: row.querySelector('.access-pass').value,
                pin: row.querySelector('.access-pin').value,
                corpId: row.querySelector('.access-corpid').value,
                url: row.querySelector('.access-url').value,
                note: row.querySelector('.access-note').value
            });
        });
    }

    const bankData = {
        id: id,
        name: document.getElementById('bankName').value,
        category: document.getElementById('bankCategory').value,
        accountNo: document.getElementById('bankAccountNo').value,
        accountName: document.getElementById('bankAccountName').value,
        note: document.getElementById('bankNote').value,
        accesses: accesses
    };

    if (getDbMode() === 'sheets') {
        showLoadingOverlay('Menyimpan data bank...');
        callSheetsAPI('saveBank', bankData, function() {
            hideLoadingOverlay();
            const idx = db.banks.findIndex(b => b.id === id);
            if (idx > -1) db.banks[idx] = bankData;
            else db.banks.push(bankData);
            renderApp();
            closeModal('modalAddBank');
            showToast('Data bank berhasil disimpan!');
        }, function(err) {
            hideLoadingOverlay();
            showAlert('Gagal menyimpan: ' + err.message, 'Error');
        });
        return;
    }

    const existingIndex = db.banks.findIndex(b => b.id === id);
    if (existingIndex > -1) {
        db.banks[existingIndex] = bankData;
    } else {
        db.banks.push(bankData);
    }

    saveDatabaseToStorage();
    renderApp();
    closeModal('modalAddBank');
}

function saveSocial(event) {
    event.preventDefault();
    const id = document.getElementById('socialId').value || 'soc_' + Date.now();
    const socData = {
        id: id,
        platform: document.getElementById('socialPlatform').value,
        url: document.getElementById('socialUrl').value,
        user: document.getElementById('socialUser').value,
        password: document.getElementById('socialPassword').value,
        note: document.getElementById('socialNote').value
    };

    if (getDbMode() === 'sheets') {
        showLoadingOverlay('Menyimpan akses sosmed...');
        callSheetsAPI('saveSocial', socData, function() {
            hideLoadingOverlay();
            const idx = db.socials.findIndex(s => s.id === id);
            if (idx > -1) db.socials[idx] = socData;
            else db.socials.push(socData);
            renderApp();
            closeModal('modalAddSocial');
            showToast('Akses sosmed berhasil disimpan!');
        }, function(err) {
            hideLoadingOverlay();
            showAlert('Gagal menyimpan: ' + err.message, 'Error');
        });
        return;
    }

    const existingIndex = db.socials.findIndex(s => s.id === id);
    if (existingIndex > -1) {
        db.socials[existingIndex] = socData;
    } else {
        db.socials.push(socData);
    }

    saveDatabaseToStorage();
    renderApp();
    closeModal('modalAddSocial');
}

function saveQris(event) {
    event.preventDefault();
    const id = document.getElementById('qrisId').value || 'qris_' + Date.now();
    const qData = {
        id: id,
        name: document.getElementById('qrisName').value,
        url: document.getElementById('qrisUrl').value,
        user: document.getElementById('qrisUser').value,
        password: document.getElementById('qrisPassword').value,
        note: document.getElementById('qrisNote').value
    };

    if (getDbMode() === 'sheets') {
        showLoadingOverlay('Menyimpan kredensial QRIS...');
        callSheetsAPI('saveQris', qData, function() {
            hideLoadingOverlay();
            const idx = db.qris.findIndex(q => q.id === id);
            if (idx > -1) db.qris[idx] = qData;
            else db.qris.push(qData);
            renderApp();
            closeModal('modalAddQris');
            showToast('Kredensial QRIS berhasil disimpan!');
        }, function(err) {
            hideLoadingOverlay();
            showAlert('Gagal menyimpan: ' + err.message, 'Error');
        });
        return;
    }

    const existingIndex = db.qris.findIndex(q => q.id === id);
    if (existingIndex > -1) {
        db.qris[existingIndex] = qData;
    } else {
        db.qris.push(qData);
    }

    saveDatabaseToStorage();
    renderApp();
    closeModal('modalAddQris');
}

// Edit & Delete Handlers
function editBank(id) {
    const bank = db.banks.find(b => b.id === id);
    if (!bank) return;
    
    document.getElementById('bankId').value = bank.id;
    document.getElementById('bankName').value = bank.name;
    document.getElementById('bankCategory').value = bank.category || 'dp';
    document.getElementById('bankAccountNo').value = bank.accountNo;
    document.getElementById('bankAccountName').value = bank.accountName;
    document.getElementById('bankNote').value = bank.note || '';
    
    const container = document.getElementById('formAccessesContainer');
    if (container) {
        container.innerHTML = '';
        if (bank.accesses && bank.accesses.length > 0) {
            bank.accesses.forEach(acc => {
                addAccessFieldToForm(acc);
            });
        } else {
            addAccessFieldToForm();
        }
    }
    
    document.getElementById('bankModalTitle').innerText = 'Edit Rekening Bank';
    openModal('modalAddBank');
}

async function deleteBank(id) {
    if (await showConfirm('Apakah Anda yakin ingin menghapus data bank ini?')) {
        if (getDbMode() === 'sheets') {
            showLoadingOverlay('Menghapus data bank...');
            callSheetsAPI('deleteBank', id, function() {
                hideLoadingOverlay();
                db.banks = db.banks.filter(b => b.id !== id);
                renderApp();
                showToast('Data bank berhasil dihapus.');
            }, function(err) {
                hideLoadingOverlay();
                showAlert('Gagal menghapus: ' + err.message, 'Error');
            });
            return;
        }
        db.banks = db.banks.filter(b => b.id !== id);
        saveDatabaseToStorage();
        renderApp();
        showToast('Data bank berhasil dihapus.');
    }
}

function editSocial(id) {
    const soc = db.socials.find(s => s.id === id);
    if (!soc) return;
    
    document.getElementById('socialId').value = soc.id;
    document.getElementById('socialPlatform').value = soc.platform;
    document.getElementById('socialUrl').value = soc.url;
    document.getElementById('socialUser').value = soc.user;
    document.getElementById('socialPassword').value = soc.password;
    document.getElementById('socialNote').value = soc.note;
    
    document.getElementById('socialModalTitle').innerText = 'Edit Akses Sosmed';
    openModal('modalAddSocial');
}

async function deleteSocial(id) {
    if (await showConfirm('Apakah Anda yakin ingin menghapus data akses sosmed ini?')) {
        if (getDbMode() === 'sheets') {
            showLoadingOverlay('Menghapus akses sosmed...');
            callSheetsAPI('deleteSocial', id, function() {
                hideLoadingOverlay();
                db.socials = db.socials.filter(s => s.id !== id);
                renderApp();
                showToast('Akses sosmed berhasil dihapus.');
            }, function(err) {
                hideLoadingOverlay();
                showAlert('Gagal menghapus: ' + err.message, 'Error');
            });
            return;
        }
        db.socials = db.socials.filter(s => s.id !== id);
        saveDatabaseToStorage();
        renderApp();
        showToast('Akses sosmed berhasil dihapus.');
    }
}

function editQris(id) {
    const q = db.qris.find(q => q.id === id);
    if (!q) return;
    
    document.getElementById('qrisId').value = q.id;
    document.getElementById('qrisName').value = q.name;
    document.getElementById('qrisUrl').value = q.url;
    document.getElementById('qrisUser').value = q.user;
    document.getElementById('qrisPassword').value = q.password;
    document.getElementById('qrisNote').value = q.note;
    
    document.getElementById('qrisModalTitle').innerText = 'Edit Akses QRIS';
    openModal('modalAddQris');
}

async function deleteQris(id) {
    if (await showConfirm('Apakah Anda yakin ingin menghapus data QRIS/akses ini?')) {
        if (getDbMode() === 'sheets') {
            showLoadingOverlay('Menghapus kredensial QRIS...');
            callSheetsAPI('deleteQris', id, function() {
                hideLoadingOverlay();
                db.qris = db.qris.filter(q => q.id !== id);
                renderApp();
                showToast('Data QRIS/akses berhasil dihapus.');
            }, function(err) {
                hideLoadingOverlay();
                showAlert('Gagal menghapus: ' + err.message, 'Error');
            });
            return;
        }
        db.qris = db.qris.filter(q => q.id !== id);
        saveDatabaseToStorage();
        renderApp();
        showToast('Data QRIS/akses berhasil dihapus.');
    }
}

// Settings Handlers
function changeMasterPassword(event) {
    event.preventDefault();
    const oldPass = document.getElementById('oldMasterPass').value;
    const newPass = document.getElementById('newMasterPass').value;
    const currentHash = localStorage.getItem('pin88_password_hash');
    
    if (CryptoJS.SHA256(oldPass).toString() !== currentHash) {
        showAlert('Master Password lama salah!', 'Peringatan');
        return;
    }
    
    // Set new key and hash
    masterKey = newPass;
    localStorage.setItem('pin88_password_hash', CryptoJS.SHA256(newPass).toString());
    
    // Re-encrypt database with the new key
    saveDatabaseToStorage();
    
    document.getElementById('oldMasterPass').value = '';
    document.getElementById('newMasterPass').value = '';
    showToast('Master Password berhasil diperbarui!');
}

async function clearAllData() {
    if (await showConfirm('PERINGATAN: Seluruh data penting PIN88 akan dihapus secara permanen. Apakah Anda yakin?', 'Hapus Semua Data')) {
        if (getDbMode() === 'sheets') {
            showLoadingOverlay('Menghapus seluruh data dari Google Sheets...');
            callSheetsAPI('clearAllData', null, function() {
                hideLoadingOverlay();
                localStorage.clear();
                db = {
                    mainContacts: { phone: { value: "", note: "" }, wa: { value: "", note: "" }, tg: { value: "", note: "" }, tgPhone: { value: "", note: "" } },
                    backupContacts: [], banks: [], socials: [], qris: [], pulsa: []
                };
                masterKey = "";
                showAlert('Seluruh data berhasil dihapus.', 'Informasi').then(() => window.location.reload());
            }, function(err) {
                hideLoadingOverlay();
                showAlert('Gagal menghapus data dari Sheets: ' + err.message, 'Error');
            });
            return;
        }
        
        localStorage.clear();
        db = {
            mainContacts: {
                phone: { value: "", note: "" },
                wa: { value: "", note: "" },
                tg: { value: "", note: "" },
                tgPhone: { value: "", note: "" }
            },
            backupContacts: [],
            banks: [],
            socials: [],
            qris: [],
            pulsa: []
        };
        masterKey = "";
        await showAlert('Seluruh data berhasil dihapus.', 'Informasi');
        window.location.reload();
    }
}

function savePulsa(event) {
    event.preventDefault();
    const id = document.getElementById('pulsaId').value || 'pulsa_' + Date.now();
    const pulsaData = {
        id: id,
        name: document.getElementById('pulsaName').value,
        phone: document.getElementById('pulsaPhone').value,
        activePeriod: document.getElementById('pulsaActivePeriod').value,
        balance: document.getElementById('pulsaBalance').value,
        difference: document.getElementById('pulsaDifference').value,
        note: document.getElementById('pulsaNote').value
    };

    if (getDbMode() === 'sheets') {
        showLoadingOverlay('Menyimpan data pulsa...');
        callSheetsAPI('savePulsa', pulsaData, function() {
            hideLoadingOverlay();
            if (!db.pulsa) db.pulsa = [];
            const idx = db.pulsa.findIndex(p => p.id === id);
            if (idx > -1) db.pulsa[idx] = pulsaData;
            else db.pulsa.push(pulsaData);
            renderApp();
            closeModal('modalAddPulsa');
            showToast('Data pulsa berhasil disimpan!');
        }, function(err) {
            hideLoadingOverlay();
            showAlert('Gagal menyimpan: ' + err.message, 'Error');
        });
        return;
    }

    if (!db.pulsa) {
        db.pulsa = [];
    }

    const existingIndex = db.pulsa.findIndex(p => p.id === id);
    if (existingIndex > -1) {
        db.pulsa[existingIndex] = pulsaData;
    } else {
        db.pulsa.push(pulsaData);
    }

    saveDatabaseToStorage();
    renderApp();
    closeModal('modalAddPulsa');
    showToast('Data Pulsa berhasil disimpan!');
}

function editPulsa(id) {
    const item = db.pulsa.find(p => p.id === id);
    if (!item) return;

    document.getElementById('pulsaId').value = item.id;
    document.getElementById('pulsaName').value = item.name;
    document.getElementById('pulsaPhone').value = item.phone;
    document.getElementById('pulsaActivePeriod').value = item.activePeriod;
    document.getElementById('pulsaBalance').value = item.balance || '';
    document.getElementById('pulsaDifference').value = item.difference || '';
    document.getElementById('pulsaNote').value = item.note || '';

    document.getElementById('pulsaModalTitle').innerText = 'Edit Akun Pulsa';
    openModal('modalAddPulsa');
}

async function deletePulsa(id) {
    if (await showConfirm('Apakah Anda yakin ingin menghapus data pulsa ini?')) {
        if (getDbMode() === 'sheets') {
            showLoadingOverlay('Menghapus data pulsa...');
            callSheetsAPI('deletePulsa', id, function() {
                hideLoadingOverlay();
                db.pulsa = db.pulsa.filter(p => p.id !== id);
                renderApp();
                showToast('Data pulsa berhasil dihapus.');
            }, function(err) {
                hideLoadingOverlay();
                showAlert('Gagal menghapus: ' + err.message, 'Error');
            });
            return;
        }
        db.pulsa = db.pulsa.filter(p => p.id !== id);
        saveDatabaseToStorage();
        renderApp();
        showToast('Data pulsa berhasil dihapus.');
    }
}

// Export / Import JSON Encrypted File
function exportData() {
    const rawData = localStorage.getItem('pin88_secure_db');
    if (!rawData) {
        showAlert('Tidak ada data untuk diekspor!', 'Informasi');
        return;
    }
    
    const exportObj = {
        hash: localStorage.getItem('pin88_password_hash'),
        db: JSON.parse(rawData)
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `PIN88_Secure_Backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!importedData.hash || !importedData.db) {
                showAlert('Format file backup tidak valid!', 'Format Salah');
                return;
            }
            
            if (await showConfirm('Mengimpor data baru akan menimpa data yang ada saat ini. Lanjutkan?', 'Konfirmasi Impor')) {
                localStorage.setItem('pin88_password_hash', importedData.hash);
                localStorage.setItem('pin88_secure_db', JSON.stringify(importedData.db));
                await showAlert('Data berhasil diimpor! Silakan masuk kembali dengan password dari file backup.', 'Impor Berhasil');
                window.location.reload();
            }
        } catch (err) {
            showAlert('Gagal membaca file JSON: ' + err.message, 'Gagal Impor');
        }
    };
    reader.readAsText(file);
}

// Helper Utilities
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    
    document.getElementById(`${tabName}Tab`).style.display = 'block';
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}

function switchBankFilter(filterVal) {
    currentBankFilter = filterVal;
    document.querySelectorAll('[data-bank-filter]').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-bank-filter') === filterVal);
    });
    
    const btn = document.getElementById('btnHeaderBank');
    const btnText = document.getElementById('btnHeaderBankText');
    if (btn && btnText) {
        if (filterVal === 'pulsa') {
            btn.setAttribute('onclick', "openModal('modalAddPulsa')");
            btnText.innerText = "Tambah Pulsa";
        } else {
            btn.setAttribute('onclick', "openModal('modalAddBank')");
            btnText.innerText = "Tambah Bank";
        }
    }
    
    renderBanks();
}

function addAccessFieldToForm(data = null) {
    const container = document.getElementById('formAccessesContainer');
    if (!container) return;
    
    const rowId = 'accessRow_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const type = data ? data.type : 'custom';
    const user = data ? data.user : '';
    const pass = data ? data.password : '';
    const pin = data ? data.pin : '';
    const corpId = data ? data.corpId : '';
    const url = data ? data.url : '';
    const note = data ? data.note : '';
    
    const rowDiv = document.createElement('div');
    rowDiv.className = 'access-form-row';
    rowDiv.id = rowId;
    rowDiv.style.border = '1px solid var(--border-color)';
    rowDiv.style.padding = '15px';
    rowDiv.style.borderRadius = 'var(--radius-md)';
    rowDiv.style.marginBottom = '15px';
    rowDiv.style.position = 'relative';
    rowDiv.style.background = 'var(--bg-secondary)';
    
    rowDiv.innerHTML = `
        <button type="button" onclick="document.getElementById('${rowId}').remove()" style="position: absolute; top: 10px; right: 10px; background: transparent; border: none; color: var(--accent-red); font-size: 1.5rem; cursor: pointer; line-height: 1; padding: 0 5px;">&times;</button>
        <div class="form-group" style="margin-bottom: 12px; padding-right: 20px;">
            <label style="font-size: 0.85rem; font-weight: 700; margin-bottom: 4px;">Tipe Layanan / Akses</label>
            <select class="form-control access-type-select" style="padding: 8px 12px; font-size: 0.9rem;" onchange="adjustAccessRowFields('${rowId}')">
                <option value="custom" ${type === 'custom' ? 'selected' : ''}>Kustom / Lainnya</option>
                <option value="klik_bca" ${type === 'klik_bca' ? 'selected' : ''}>Klik BCA</option>
                <option value="mbanking_bca" ${type === 'mbanking_bca' ? 'selected' : ''}>M-Banking BCA</option>
                <option value="mybca" ${type === 'mybca' ? 'selected' : ''}>MyBCA</option>
                <option value="ebanking_bni" ${type === 'ebanking_bni' ? 'selected' : ''}>E-Banking BNI</option>
                <option value="mbanking_bni" ${type === 'mbanking_bni' ? 'selected' : ''}>M-Banking BNI</option>
                <option value="bni_wondr" ${type === 'bni_wondr' ? 'selected' : ''}>BNI Wondr</option>
                <option value="qlola_bri" ${type === 'qlola_bri' ? 'selected' : ''}>Qlola BRI</option>
                <option value="mbanking_bri" ${type === 'mbanking_bri' ? 'selected' : ''}>M-Banking BRI</option>
            </select>
        </div>
        <div class="form-row fields-grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
            <div class="form-group" style="margin-bottom: 0;" id="user-group-${rowId}">
                <label style="font-size: 0.8rem; margin-bottom: 4px;">Username</label>
                <input type="text" class="form-control access-user" value="${escapeHTML(user)}" style="padding: 8px 12px; font-size: 0.9rem;">
            </div>
            <div class="form-group" style="margin-bottom: 0;" id="pass-group-${rowId}">
                <label style="font-size: 0.8rem; margin-bottom: 4px;">Password</label>
                <input type="text" class="form-control access-pass" value="${escapeHTML(pass)}" style="padding: 8px 12px; font-size: 0.9rem;">
            </div>
        </div>
        <div class="form-row fields-grid-2" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
            <div class="form-group" style="margin-bottom: 0;" id="pin-group-${rowId}">
                <label style="font-size: 0.8rem; margin-bottom: 4px;">PIN</label>
                <input type="text" class="form-control access-pin" value="${escapeHTML(pin)}" style="padding: 8px 12px; font-size: 0.9rem;">
            </div>
            <div class="form-group" style="margin-bottom: 0;" id="corp-group-${rowId}">
                <label style="font-size: 0.8rem; margin-bottom: 4px;">Corporate ID</label>
                <input type="text" class="form-control access-corpid" value="${escapeHTML(corpId)}" style="padding: 8px 12px; font-size: 0.9rem;">
            </div>
        </div>
        <div class="form-group" style="margin-bottom: 10px;" id="url-group-${rowId}">
            <label style="font-size: 0.8rem; margin-bottom: 4px;">Link URL Login</label>
            <input type="url" class="form-control access-url" value="${escapeHTML(url)}" style="padding: 8px 12px; font-size: 0.9rem;" placeholder="https://...">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
            <label style="font-size: 0.8rem; margin-bottom: 4px;">Catatan Akses</label>
            <input type="text" class="form-control access-note" value="${escapeHTML(note)}" style="padding: 8px 12px; font-size: 0.9rem;" placeholder="Pertanyaan keamanan, token info, dll...">
        </div>
    `;
    
    container.appendChild(rowDiv);
    adjustAccessRowFields(rowId);
}

function adjustAccessRowFields(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;
    
    const type = row.querySelector('.access-type-select').value;
    const userGroup = row.querySelector(`#user-group-${rowId}`);
    const passGroup = row.querySelector(`#pass-group-${rowId}`);
    const pinGroup = row.querySelector(`#pin-group-${rowId}`);
    const corpGroup = row.querySelector(`#corp-group-${rowId}`);
    const urlGroup = row.querySelector(`#url-group-${rowId}`);
    
    userGroup.style.display = 'block';
    passGroup.style.display = 'block';
    pinGroup.style.display = 'block';
    corpGroup.style.display = 'block';
    urlGroup.style.display = 'block';
    
    const passLabel = row.querySelector(`#pass-group-${rowId} label`);
    if (passLabel) passLabel.innerText = 'Password';

    if (type === 'klik_bca') {
        corpGroup.style.display = 'none';
        pinGroup.style.display = 'none';
        row.querySelector('.access-url').value = row.querySelector('.access-url').value || 'https://ibank.klikbca.com';
    } else if (type === 'mbanking_bca') {
        corpGroup.style.display = 'none';
        passGroup.style.display = 'none';
        urlGroup.style.display = 'none';
    } else if (type === 'mybca') {
        corpGroup.style.display = 'none';
        row.querySelector('.access-url').value = row.querySelector('.access-url').value || 'https://mybca.bca.co.id';
    } else if (type === 'ebanking_bni') {
        corpGroup.style.display = 'none';
        pinGroup.style.display = 'none';
        row.querySelector('.access-url').value = row.querySelector('.access-url').value || 'https://ibank.bni.co.id';
    } else if (type === 'mbanking_bni' || type === 'bni_wondr') {
        corpGroup.style.display = 'none';
        urlGroup.style.display = 'none';
    } else if (type === 'qlola_bri') {
        pinGroup.style.display = 'none';
        row.querySelector('.access-url').value = row.querySelector('.access-url').value || 'https://qlola.bri.co.id';
    } else if (type === 'mbanking_bri') {
        corpGroup.style.display = 'none';
        urlGroup.style.display = 'none';
    }
}

function openModal(modalId) {
    if (modalId === 'modalAddBank' && !document.getElementById('bankId').value) {
        document.getElementById('bankForm').reset();
        document.getElementById('bankModalTitle').innerText = 'Tambah Rekening Bank';
        const container = document.getElementById('formAccessesContainer');
        if (container) {
            container.innerHTML = '';
            addAccessFieldToForm();
        }
    }
    if (modalId === 'modalAddSocial' && !document.getElementById('socialId').value) {
        document.getElementById('socialForm').reset();
        document.getElementById('socialModalTitle').innerText = 'Tambah Akses Sosmed & Chat';
    }
    if (modalId === 'modalAddQris' && !document.getElementById('qrisId').value) {
        document.getElementById('qrisForm').reset();
        document.getElementById('qrisModalTitle').innerText = 'Tambah Akses QRIS';
    }
    if (modalId === 'modalAddBackupContact' && !document.getElementById('backupContactId').value) {
        document.getElementById('backupContactForm').reset();
        document.getElementById('backupContactModalTitle').innerText = 'Tambah Kontak Cadangan';
        document.getElementById('backupContactType').value = 'wa';
    }
    if (modalId === 'modalAddPulsa' && !document.getElementById('pulsaId').value) {
        document.getElementById('pulsaForm').reset();
        document.getElementById('pulsaModalTitle').innerText = 'Tambah Akun Pulsa';
    }
    
    // Load current values for contacts update
    if (modalId === 'modalMainContacts') {
        document.getElementById('inMainPhone').value = db.mainContacts.phone?.value || '';
        document.getElementById('inMainPhoneNote').value = db.mainContacts.phone?.note || '';
        document.getElementById('inMainWA').value = db.mainContacts.wa?.value || '';
        document.getElementById('inMainWANote').value = db.mainContacts.wa?.note || '';
        document.getElementById('inMainTG').value = db.mainContacts.tg?.value || '';
        document.getElementById('inMainTGNote').value = db.mainContacts.tg?.note || '';
        document.getElementById('inMainTGPhone').value = db.mainContacts.tgPhone?.value || '';
        document.getElementById('inMainTGPhoneNote').value = db.mainContacts.tgPhone?.note || '';
    }

    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    // Clear IDs on close
    if (modalId === 'modalAddBank') document.getElementById('bankId').value = '';
    if (modalId === 'modalAddSocial') document.getElementById('socialId').value = '';
    if (modalId === 'modalAddQris') document.getElementById('qrisId').value = '';
    if (modalId === 'modalAddBackupContact') document.getElementById('backupContactId').value = '';
    if (modalId === 'modalAddPulsa') document.getElementById('pulsaId').value = '';
}

function togglePassword(btn, originalPassword) {
    const fieldVal = btn.parentElement.previousElementSibling.querySelector('.data-field-value');
    if (fieldVal.classList.contains('password-masked')) {
        fieldVal.innerText = originalPassword;
        fieldVal.classList.remove('password-masked');
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" style="width: 16px; height: 16px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>`;
    } else {
        fieldVal.innerText = '••••••••';
        fieldVal.classList.add('password-masked');
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" style="width: 16px; height: 16px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>`;
    }
}

function copyText(elementId) {
    const val = document.getElementById(elementId).innerText;
    navigator.clipboard.writeText(val).then(() => {
        showToast('Teks berhasil disalin!');
    }).catch(err => {
        console.error('Copy failed:', err);
        showToast('Gagal menyalin teks.');
    });
}

function copyRawText(val) {
    navigator.clipboard.writeText(val).then(() => {
        showToast('Kredensial disalin!');
    }).catch(err => {
        console.error('Copy failed:', err);
        showToast('Gagal menyalin kredensial.');
    });
}

function switchBankAccessTab(bankId, accessId) {
    const card = document.getElementById(`bank-card-${bankId}`);
    if (!card) return;
    
    const tabEl = card.querySelector(`[data-access-id="${accessId}"]`);
    const panelEl = card.querySelector(`#panel-${bankId}-${accessId}`);
    if (!tabEl || !panelEl) return;
    
    const isAlreadyActive = tabEl.classList.contains('active');
    
    // Deactivate all tabs and hide panels in this card
    card.querySelectorAll('.bank-access-tab-link').forEach(tab => tab.classList.remove('active'));
    card.querySelectorAll('.bank-access-panel').forEach(panel => {
        panel.classList.remove('active');
        panel.style.display = 'none';
    });
    
    // Toggle active if not already active
    if (!isAlreadyActive) {
        tabEl.classList.add('active');
        panelEl.classList.add('active');
        panelEl.style.display = 'block';
    }
}

function togglePasswordVisibility(btn) {
    const valRow = btn.closest('.bank-cred-val-row');
    if (!valRow) return;
    
    const valEl = valRow.querySelector('.password-val');
    if (!valEl) return;
    
    const isHidden = valEl.getAttribute('data-hidden') === 'true';
    if (isHidden) {
        valEl.innerText = valEl.getAttribute('data-value');
        valEl.setAttribute('data-hidden', 'false');
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px;"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>`;
    } else {
        valEl.innerText = '••••••••';
        valEl.setAttribute('data-hidden', 'true');
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width: 13px; height: 13px;"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>`;
    }
}

function copyAllAccessData(bankId, accessId) {
    const bank = db.banks.find(b => b.id === bankId);
    if (!bank) return;
    
    const acc = bank.accesses.find(a => a.id === accessId);
    if (!acc) return;

    const nameUpper = (bank.name || '').toUpperCase();
    const accountNameUpper = (bank.accountName || '').toUpperCase();
    const accountNo = bank.accountNo || '';
    const typeLabel = (bankTypeLabels[acc.type || 'custom'] || 'KUSTOM').toUpperCase();

    let text = `${accountNameUpper} - ${nameUpper} / ${accountNo}\n\n`;
    text += `${typeLabel}\n\n`;

    if (acc.corpId) {
        text += `- CORPORATE ID : ${acc.corpId}\n`;
    }
    if (acc.user) {
        text += `- USER ID : ${acc.user}\n`;
    }
    if (acc.pin) {
        text += `- PIN : ${acc.pin}\n`;
    }
    if (acc.password) {
        const isBca = nameUpper.includes('BCA') || acc.type.toLowerCase().includes('bca');
        const passLabel = isBca ? 'KEYBCA' : 'PASSWORD';
        text += `- ${passLabel} : ${acc.password}\n`;
    }

    navigator.clipboard.writeText(text.trim()).then(() => {
        showToast('Kredensial disalin untuk chat!');
    }).catch(err => {
        console.error('Copy failed:', err);
        showToast('Gagal menyalin kredensial.');
    });
}

function customDialog({ title, message, isConfirm = false, okText = 'OK', cancelText = 'Batal' }) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.zIndex = '99999';
        
        const dialogCard = document.createElement('div');
        dialogCard.className = 'modal';
        dialogCard.style.maxWidth = '420px';
        dialogCard.style.padding = '35px 30px';
        dialogCard.style.textAlign = 'center';
        
        let buttonsHtml = '';
        if (isConfirm) {
            buttonsHtml = `
                <div style="display: flex; gap: 15px; margin-top: 25px; width: 100%;">
                    <button class="btn-secondary" id="dialogCancelBtn" style="flex: 1; justify-content: center; margin: 0; padding: 12px 20px; font-size: 0.95rem;">${escapeHTML(cancelText)}</button>
                    <button class="btn-primary" id="dialogOkBtn" style="flex: 1; justify-content: center; margin: 0; padding: 12px 20px; font-size: 0.95rem;">${escapeHTML(okText)}</button>
                </div>
            `;
        } else {
            buttonsHtml = `
                <div style="display: flex; margin-top: 25px; width: 100%;">
                    <button class="btn-primary" id="dialogOkBtn" style="width: 100%; justify-content: center; margin: 0; padding: 12px 20px; font-size: 0.95rem;">${escapeHTML(okText)}</button>
                </div>
            `;
        }
        
        dialogCard.innerHTML = `
            <div style="font-family: var(--font-heading); font-size: 1.4rem; font-weight: 700; color: var(--text-primary); margin-bottom: 15px; border-bottom: 1px solid var(--border-color); padding-bottom: 12px;">
                ${escapeHTML(title || 'Pemberitahuan')}
            </div>
            <div style="color: var(--text-secondary); font-size: 1rem; line-height: 1.6; margin-bottom: 10px; word-break: break-word;">
                ${escapeHTML(message)}
            </div>
            ${buttonsHtml}
        `;
        
        overlay.appendChild(dialogCard);
        document.body.appendChild(overlay);
        
        // Trigger opening transition
        setTimeout(() => overlay.classList.add('active'), 10);
        
        const closeDialog = (val) => {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.remove();
                resolve(val);
            }, 300);
        };
        
        overlay.querySelector('#dialogOkBtn').addEventListener('click', () => {
            closeDialog(true);
        });
        
        if (isConfirm) {
            overlay.querySelector('#dialogCancelBtn').addEventListener('click', () => {
                closeDialog(false);
            });
        }
    });
}

function showAlert(message, title = 'Informasi') {
    return customDialog({ title, message, isConfirm: false, okText: 'OK' });
}

function showConfirm(message, title = 'Konfirmasi') {
    return customDialog({ title, message, isConfirm: true, okText: 'Ya', cancelText: 'Tidak' });
}

function showToast(message) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px; color: var(--pastel-green);" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>${escapeHTML(message)}</span>
    `;
    container.appendChild(toast);
    
    // Fade out after 2.5s, then remove
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            toast.remove();
            if (container.children.length === 0) {
                container.remove();
            }
        }, 300);
    }, 2500);
}

function getBankLogoHtml(bankName) {
    const name = (bankName || '').toLowerCase();
    
    if (name.includes('bca')) {
        return `<img src="logo_bca.png" alt="BCA" style="width: 36px; height: 36px; object-fit: contain; display: block; flex-shrink: 0;">`;
    } else if (name.includes('bni')) {
        return `<img src="logo_bni.png" alt="BNI" style="width: 36px; height: 36px; object-fit: contain; display: block; flex-shrink: 0;">`;
    } else if (name.includes('bri')) {
        return `<img src="logo_bri.png" alt="BRI" style="width: 36px; height: 36px; object-fit: contain; display: block; flex-shrink: 0;">`;
    } else if (name.includes('mandiri')) {
        return `<img src="logo_mandiri.png" alt="Mandiri" style="width: 36px; height: 36px; object-fit: contain; display: block; flex-shrink: 0;">`;
    }

    // Generic safe/bank card logo
    const initials = (bankName || 'BK').trim().substring(0, 2).toUpperCase();
    return `<svg viewBox="0 0 40 40" width="36" height="36" style="display: block; flex-shrink: 0;">
        <rect x="1" y="1" width="38" height="38" rx="8" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.25;"/>
        <text x="20" y="24" font-family="'Inter', sans-serif" font-weight="900" font-size="12" fill="currentColor" text-anchor="middle">${initials}</text>
    </svg>`;
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
}

function escapeJSVal(str) {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
}

function formatNominalInput(inputVal) {
    if (!inputVal) return '';
    let isNegative = inputVal.startsWith('-');
    let digits = inputVal.replace(/\D/g, '');
    if (!digits) return isNegative ? '-' : '';
    let formatted = Number(digits).toLocaleString('id-ID');
    return isNegative ? '-' + formatted : formatted;
}

function formatDisplayDate(dStr) {
    if (!dStr) return '';
    // Expected format: YYYY-MM-DD
    const parts = dStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
        const year = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1;
        const day = parts[2];
        
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const month = months[monthIndex] || parts[1];
        return `${day} ${month} ${year}`;
    }
    return dStr;
}

async function syncFromServer() {
    try {
        const response = await fetch('/api/db', {
            headers: { 'X-PIN88-Token': API_TOKEN }
        });
        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();
        if (data && !data.empty) {
            if (data.hash) {
                localStorage.setItem('pin88_password_hash', data.hash);
            }
            if (data.db) {
                localStorage.setItem('pin88_secure_db', JSON.stringify(data.db));
            }
        }
    } catch (err) {
        console.error("Failed to sync from server API, using local storage cache:", err);
    }
}
