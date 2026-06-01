// State management
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

// Initial Checks
window.addEventListener('DOMContentLoaded', () => {
    if (typeof CryptoJS === 'undefined') {
        showAlert("PERINGATAN: Library keamanan CryptoJS gagal dimuat secara lokal. Pastikan file 'crypto-js.min.js' ada di folder yang sama dengan 'index.html'.", "Peringatan Sistem");
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
            
            // Initialize empty encrypted DB structure
            saveDatabaseToStorage();
            
            loginSuccess();
        } else {
            // Verification
            const inputHash = CryptoJS.SHA256(passwordInput).toString();
            if (inputHash === hash) {
                masterKey = passwordInput;
                errorDiv.style.display = 'none';
                
                // Load and decrypt database
                if (loadDatabaseFromStorage()) {
                    loginSuccess();
                } else {
                    errorDiv.innerText = "Gagal memproses dekripsi database. Master password mungkin salah.";
                    errorDiv.style.display = 'block';
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
    renderApp();
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
                type: encrypt(bank.type || "custom"),
                category: encrypt(bank.category || "dp"),
                accountNo: encrypt(bank.accountNo),
                accountName: encrypt(bank.accountName),
                url: encrypt(bank.url),
                user: encrypt(bank.user),
                corpId: encrypt(bank.corpId || ""),
                password: encrypt(bank.password),
                pin: encrypt(bank.pin || ""),
                note: encrypt(bank.note)
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
        return true;
    } catch (e) {
        console.error("Error saving database:", e);
        return false;
    }
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
        db.banks = (encryptedDb.banks || []).map(bank => ({
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
            note: decrypt(bank.note)
        }));
        
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
        const typeLabel = bankTypeLabels[bank.type || 'custom'] || 'Kustom';
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
        
        let fieldsHtml = `
            <div class="data-card-header">
                <div class="data-card-title">
                    ${escapeHTML(bank.name)} 
                    <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-secondary); opacity: 0.8;">(${escapeHTML(typeLabel)})</span>
                    <span class="category-tag ${bank.category || 'dp'}">${(bank.category || 'dp').toUpperCase()}</span>
                </div>
                <div class="data-card-actions">
                    <button class="action-btn copy-all" onclick="copyAllBankData('${bank.id}')" title="Salin Semua Data (Chat)">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    </button>
                    <button class="action-btn edit" onclick="editBank('${bank.id}')" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button class="action-btn delete" onclick="deleteBank('${bank.id}')" title="Hapus">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
            </div>
            <div class="data-field">
                <div class="data-field-info">
                    <span class="data-field-label">No. Rekening</span>
                    <span class="data-field-value">${escapeHTML(bank.accountNo)}</span>
                </div>
            </div>
            <div class="data-field">
                <div class="data-field-info">
                    <span class="data-field-label">Atas Nama (A/N)</span>
                    <span class="data-field-value">${escapeHTML(bank.accountName)}</span>
                </div>
            </div>
        `;

        // Username (only if filled)
        if (bank.user) {
            fieldsHtml += `
                <div class="data-field">
                    <div class="data-field-info">
                        <span class="data-field-label">Username Login</span>
                        <span class="data-field-value">${escapeHTML(bank.user)}</span>
                    </div>
                </div>
            `;
        }

        // Corporate ID (only if filled)
        if (bank.corpId) {
            fieldsHtml += `
                <div class="data-field">
                    <div class="data-field-info">
                        <span class="data-field-label">Corporate ID</span>
                        <span class="data-field-value">${escapeHTML(bank.corpId)}</span>
                    </div>
                </div>
            `;
        }

        // Password (only if filled)
        if (bank.password) {
            fieldsHtml += `
                <div class="data-field">
                    <div class="data-field-info">
                        <span class="data-field-label">Password Login</span>
                        <span class="data-field-value">${escapeHTML(bank.password)}</span>
                    </div>
                </div>
            `;
        }

        // PIN (only if filled)
        if (bank.pin) {
            fieldsHtml += `
                <div class="data-field">
                    <div class="data-field-info">
                        <span class="data-field-label">PIN Transaksi / Login</span>
                        <span class="data-field-value">${escapeHTML(bank.pin)}</span>
                    </div>
                </div>
            `;
        }

        if (bank.url) {
            fieldsHtml += `
                <div style="margin-top: 15px; display: flex; gap: 10px; width: 100%;">
                    <a href="${escapeHTML(bank.url)}" target="_blank" class="btn-secondary" style="flex-grow: 1; font-size: 0.85rem; padding: 10px 12px; justify-content: center; margin: 0; display: flex; align-items: center; gap: 8px; text-decoration: none;">
                        Buka Link e-Banking
                        <svg xmlns="http://www.w3.org/2000/svg" style="width: 14px; height: 14px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                    <button class="btn-secondary" onclick="copyRawText('${escapeJSVal(bank.url)}')" title="Salin Link e-Banking" style="flex-shrink: 0; padding: 10px 14px; justify-content: center; margin: 0; display: flex; align-items: center;">
                        <svg xmlns="http://www.w3.org/2000/svg" style="width: 16px; height: 16px;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    </button>
                </div>
            `;
        }

        if (bank.note) {
            fieldsHtml += `
                <div style="margin-top: 12px; font-size: 0.8rem; background: rgba(0,0,0,0.2); padding: 8px; border-radius: var(--radius-sm); color: var(--text-secondary);">
                    <strong>Catatan:</strong> ${escapeHTML(bank.note)}
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
    db.mainContacts.phone = {
        value: document.getElementById('inMainPhone').value,
        note: document.getElementById('inMainPhoneNote').value
    };
    db.mainContacts.wa = {
        value: document.getElementById('inMainWA').value,
        note: document.getElementById('inMainWANote').value
    };
    db.mainContacts.tg = {
        value: document.getElementById('inMainTG').value,
        note: document.getElementById('inMainTGNote').value
    };
    db.mainContacts.tgPhone = {
        value: document.getElementById('inMainTGPhone').value,
        note: document.getElementById('inMainTGPhoneNote').value
    };
    
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
        db.backupContacts = db.backupContacts.filter(item => item.id !== id);
        saveDatabaseToStorage();
        renderApp();
        showToast('Kontak cadangan berhasil dihapus.');
    }
}

function saveBank(event) {
    event.preventDefault();
    const id = document.getElementById('bankId').value || 'bank_' + Date.now();
    const bankData = {
        id: id,
        name: document.getElementById('bankName').value,
        type: document.getElementById('bankType').value,
        category: document.getElementById('bankCategory').value,
        accountNo: document.getElementById('bankAccountNo').value,
        accountName: document.getElementById('bankAccountName').value,
        url: document.getElementById('bankUrl').value,
        user: document.getElementById('bankUser').value,
        corpId: document.getElementById('bankCorpId').value,
        password: document.getElementById('bankPassword').value,
        pin: document.getElementById('bankPin').value,
        note: document.getElementById('bankNote').value
    };

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
    document.getElementById('bankType').value = bank.type || 'custom';
    document.getElementById('bankCategory').value = bank.category || 'dp';
    document.getElementById('bankAccountNo').value = bank.accountNo;
    document.getElementById('bankAccountName').value = bank.accountName;
    document.getElementById('bankUrl').value = bank.url;
    document.getElementById('bankUser').value = bank.user || '';
    document.getElementById('bankCorpId').value = bank.corpId || '';
    document.getElementById('bankPassword').value = bank.password || '';
    document.getElementById('bankPin').value = bank.pin || '';
    document.getElementById('bankNote').value = bank.note;
    
    adjustBankFields();
    
    document.getElementById('bankModalTitle').innerText = 'Edit Rekening Bank';
    openModal('modalAddBank');
}

async function deleteBank(id) {
    if (await showConfirm('Apakah Anda yakin ingin menghapus data bank ini?')) {
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

function adjustBankFields() {
    const type = document.getElementById('bankType').value;
    const userGroup = document.querySelector('.field-bank-user');
    const corpIdGroup = document.querySelector('.field-bank-corpid');
    const passwordGroup = document.querySelector('.field-bank-password');
    const pinGroup = document.querySelector('.field-bank-pin');

    // Default: Tampilkan semua
    userGroup.style.display = 'block';
    corpIdGroup.style.display = 'block';
    passwordGroup.style.display = 'block';
    pinGroup.style.display = 'block';

    if (type === 'klik_bca') {
        corpIdGroup.style.display = 'none';
        pinGroup.style.display = 'none';
    } else if (type === 'mbanking_bca') {
        userGroup.style.display = 'none';
        corpIdGroup.style.display = 'none';
    } else if (type === 'mybca' || type === 'ebanking_bni' || type === 'mbanking_bni' || type === 'bni_wondr' || type === 'mbanking_bri') {
        corpIdGroup.style.display = 'none';
    } else if (type === 'qlola_bri') {
        pinGroup.style.display = 'none';
    }
}

function openModal(modalId) {
    // Reset forms when adding new
    if (modalId === 'modalAddBank' && !document.getElementById('bankId').value) {
        document.getElementById('bankForm').reset();
        document.getElementById('bankModalTitle').innerText = 'Tambah Rekening Bank';
        document.getElementById('bankType').value = 'custom';
        adjustBankFields();
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

function copyAllBankData(bankId) {
    const bank = db.banks.find(b => b.id === bankId);
    if (!bank) return;

    const nameUpper = (bank.name || '').toUpperCase();
    const accountNameUpper = (bank.accountName || '').toUpperCase();
    const accountNo = bank.accountNo || '';

    // Determine service header based on bank type
    let serviceHeader = "INTERNET BANKING";
    const type = bank.type || 'custom';
    if (type === 'mbanking_bca' || type === 'mbanking_bni' || type === 'mbanking_bri') {
        serviceHeader = "MOBILE BANKING";
    } else if (type === 'bni_wondr') {
        serviceHeader = "WONDR BY BNI";
    } else if (type === 'mybca') {
        serviceHeader = "MYBCA";
    } else {
        serviceHeader = "INTERNET BANKING";
    }

    let text = `${accountNameUpper} - ${nameUpper} / ${accountNo}\n\n`;
    text += `${serviceHeader}\n\n`;

    if (bank.corpId) {
        text += `- CORPORATE ID : ${bank.corpId}\n`;
    }
    if (bank.user) {
        text += `- USER ID : ${bank.user}\n`;
    }
    if (bank.pin) {
        text += `- PIN : ${bank.pin}\n`;
    }
    if (bank.password) {
        const isBca = nameUpper.includes('BCA') || type.toLowerCase().includes('bca');
        const passLabel = isBca ? 'KEYBCA' : 'PASSWORD';
        text += `- ${passLabel} : ${bank.password}\n`;
    }

    navigator.clipboard.writeText(text.trim()).then(() => {
        showToast('Data bank berhasil disalin untuk chat!');
    }).catch(err => {
        console.error('Failed to copy bank data:', err);
        showToast('Gagal menyalin data bank.');
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
