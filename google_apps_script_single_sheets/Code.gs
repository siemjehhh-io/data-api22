// ============================================================
// PIN88 - Google Apps Script Backend
// Database: Google Sheets (shared & persistent)
// ============================================================

// ⚠️ WAJIB DIISI: Paste ID Google Spreadsheet Anda di sini
// Cara dapat ID: Buka Spreadsheet → salin dari URL:
// https://docs.google.com/spreadsheets/d/[INI_ADALAH_ID]/edit
var SPREADSHEET_ID = "12zPKhMD7M0jRO0wBDrF1ALZj5MGX_O7G8Tc0YSL9mMI";

// Nama-nama sheet tab (jangan diubah)
var SHEETS = {
  banks:        "Banks",
  pulsa:        "Pulsa",
  socials:      "Socials",
  qris:         "QRIS",
  contacts:     "MainContacts",
  backupContacts: "BackupContacts"
};

// ============================================================
// WEB APP ENTRY POINTS
// ============================================================

function debugIndex() {
  var content = HtmlService.createHtmlOutputFromFile('Index').getContent();
  Logger.log('Index length: ' + content.length);
  Logger.log('Has correct backtick: ' + content.includes('icon: `<svg'));
}

function doGet(e) {
  // Jika parameter request berisi 'action', handle sebagai JSON API
  if (e && e.parameter && e.parameter.action) {
    return handleApiRequest(e.parameter);
  }
  
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('PIN88 - Data & Akses Dashboard')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  var params;
  try {
    params = JSON.parse(e.postData.contents);
  } catch(err) {
    params = e.parameter;
  }
  
  return handleApiRequest(params);
}

function handleApiRequest(params) {
  var action = params.action;
  var result = { success: false, error: "Action tidak dikenal: " + action };
  
  try {
    if (action === "initSheets") {
      result = initSheets();
    } else if (action === "getAllData") {
      result = getAllData();
    } else if (action === "saveMainContacts") {
      result = saveMainContacts(params.data);
    } else if (action === "saveBackupContact") {
      result = saveBackupContact(params.data);
    } else if (action === "deleteBackupContact") {
      result = deleteBackupContact(params.id);
    } else if (action === "saveBank") {
      result = saveBank(params.data);
    } else if (action === "deleteBank") {
      result = deleteBank(params.id);
    } else if (action === "saveSocial") {
      result = saveSocial(params.data);
    } else if (action === "deleteSocial") {
      result = deleteSocial(params.id);
    } else if (action === "saveQris") {
      result = saveQris(params.data);
    } else if (action === "deleteQris") {
      result = deleteQris(params.id);
    } else if (action === "savePulsa") {
      result = savePulsa(params.data);
    } else if (action === "deletePulsa") {
      result = deletePulsa(params.id);
    } else if (action === "clearAllData") {
      result = clearAllData();
    }
  } catch(err) {
    result = { success: false, error: err.message };
  }
  
  // Set CORS headers so that external frontends (e.g. Vercel) can access it
  return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================================
// INIT: Buat sheet jika belum ada
// ============================================================

function initSheets() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // Banks
    _ensureSheet(ss, SHEETS.banks, [
      "id","name","type","category","accountNo","accountName",
      "url","user","corpId","password","pin","note","updatedAt","accesses"
    ]);
    // Pulsa
    _ensureSheet(ss, SHEETS.pulsa, [
      "id","name","phone","activePeriod","balance","difference","note","updatedAt"
    ]);
    // Socials
    _ensureSheet(ss, SHEETS.socials, [
      "id","platform","url","user","password","note","updatedAt"
    ]);
    // QRIS
    _ensureSheet(ss, SHEETS.qris, [
      "id","name","url","user","password","note","updatedAt"
    ]);
    // Main Contacts (single row key-value)
    _ensureSheet(ss, SHEETS.contacts, [
      "key","phone_value","phone_note","wa_value","wa_note",
      "tg_value","tg_note","tgPhone_value","tgPhone_note","updatedAt"
    ]);
    // Backup Contacts
    _ensureSheet(ss, SHEETS.backupContacts, [
      "id","name","type","value","note","updatedAt"
    ]);

    return { success: true, message: "Sheets berhasil diinisialisasi." };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

function _ensureSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground("#1a1a2e")
      .setFontColor("#e8d5b7")
      .setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ============================================================
// GENERIC READ: Baca semua data dari sebuah sheet
// ============================================================

function readSheet(sheetName) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: true, data: [] };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, data: [] };

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var rows = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

    var data = rows.map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) {
        obj[h] = (row[i] === null || row[i] === undefined) ? "" : String(row[i]);
      });
      return obj;
    }).filter(function(obj) {
      // Filter baris kosong (id kosong = dihapus)
      return obj.id && obj.id.trim() !== "";
    });

    return { success: true, data: data };
  } catch(e) {
    return { success: false, error: e.message, data: [] };
  }
}

// ============================================================
// READ ALL: Ambil semua data sekaligus (1 round trip)
// ============================================================

function getAllData() {
  try {
    ensureAccessesHeader();
    var banks    = readSheet(SHEETS.banks).data;
    if (banks) {
      banks.forEach(function(b) {
        if (b.accesses) {
          try {
            b.accesses = JSON.parse(b.accesses);
          } catch(err) {
            b.accesses = [];
          }
        } else {
          b.accesses = [];
        }
      });
    }
    var pulsa    = readSheet(SHEETS.pulsa).data;
    var socials  = readSheet(SHEETS.socials).data;
    var qris     = readSheet(SHEETS.qris).data;
    var contacts = readSheet(SHEETS.contacts).data;
    var backupContacts = readSheet(SHEETS.backupContacts).data;

    // Parse main contacts dari row pertama
    var mainContacts = {
      phone:   { value: "", note: "" },
      wa:      { value: "", note: "" },
      tg:      { value: "", note: "" },
      tgPhone: { value: "", note: "" }
    };
    if (contacts && contacts.length > 0) {
      var row = contacts[0];
      mainContacts.phone   = { value: row.phone_value   || "", note: row.phone_note   || "" };
      mainContacts.wa      = { value: row.wa_value      || "", note: row.wa_note      || "" };
      mainContacts.tg      = { value: row.tg_value      || "", note: row.tg_note      || "" };
      mainContacts.tgPhone = { value: row.tgPhone_value || "", note: row.tgPhone_note || "" };
    }

    return {
      success: true,
      db: {
        mainContacts:   mainContacts,
        backupContacts: backupContacts,
        banks:          banks,
        socials:        socials,
        qris:           qris,
        pulsa:          pulsa
      }
    };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// SAVE / UPSERT: Simpan atau update satu baris berdasarkan ID
// ============================================================

function saveRow(sheetName, rowData) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      initSheets();
      sheet = ss.getSheetByName(sheetName);
    }

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    rowData.updatedAt = new Date().toISOString();

    var lastRow = sheet.getLastRow();

    // Cari apakah ID sudah ada (update)
    if (lastRow >= 2) {
      var idColIndex = headers.indexOf("id");
      if (idColIndex >= 0) {
        var ids = sheet.getRange(2, idColIndex + 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === String(rowData.id)) {
            // Update baris yang ada
            var newRow = headers.map(function(h) { return rowData[h] !== undefined ? rowData[h] : ""; });
            sheet.getRange(i + 2, 1, 1, headers.length).setValues([newRow]);
            return { success: true, action: "updated", id: rowData.id };
          }
        }
      }
    }

    // Insert baris baru
    var newRow = headers.map(function(h) { return rowData[h] !== undefined ? rowData[h] : ""; });
    sheet.appendRow(newRow);
    return { success: true, action: "inserted", id: rowData.id };

  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// DELETE: Hapus baris berdasarkan ID
// ============================================================

function deleteRow(sheetName, id) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { success: false, error: "Sheet tidak ditemukan." };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, error: "Data tidak ditemukan." };

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var idColIndex = headers.indexOf("id");
    if (idColIndex < 0) return { success: false, error: "Kolom ID tidak ditemukan." };

    var ids = sheet.getRange(2, idColIndex + 1, lastRow - 1, 1).getValues();
    for (var i = ids.length - 1; i >= 0; i--) {
      if (String(ids[i][0]) === String(id)) {
        sheet.deleteRow(i + 2);
        return { success: true, action: "deleted", id: id };
      }
    }

    return { success: false, error: "ID tidak ditemukan: " + id };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// SAVE MAIN CONTACTS: Update kontak utama (1 baris saja)
// ============================================================

function saveMainContacts(contactsData) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEETS.contacts);
    if (!sheet) {
      initSheets();
      sheet = ss.getSheetByName(SHEETS.contacts);
    }

    var rowData = {
      key:           "main",
      phone_value:   contactsData.phone   ? contactsData.phone.value   : "",
      phone_note:    contactsData.phone   ? contactsData.phone.note    : "",
      wa_value:      contactsData.wa      ? contactsData.wa.value      : "",
      wa_note:       contactsData.wa      ? contactsData.wa.note       : "",
      tg_value:      contactsData.tg      ? contactsData.tg.value      : "",
      tg_note:       contactsData.tg      ? contactsData.tg.note       : "",
      tgPhone_value: contactsData.tgPhone ? contactsData.tgPhone.value : "",
      tgPhone_note:  contactsData.tgPhone ? contactsData.tgPhone.note  : "",
      updatedAt:     new Date().toISOString()
    };

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var newRow = headers.map(function(h) { return rowData[h] !== undefined ? rowData[h] : ""; });

    var lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      // Update baris pertama (selalu 1 baris saja untuk main contacts)
      sheet.getRange(2, 1, 1, headers.length).setValues([newRow]);
    } else {
      sheet.appendRow(newRow);
    }

    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
}

// ============================================================
// SAVE BANK
// ============================================================

function ensureAccessesHeader() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEETS.banks);
    if (sheet) {
      var lastCol = sheet.getLastColumn();
      if (lastCol > 0) {
        var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
        if (headers.indexOf("accesses") === -1) {
          // Append "accesses" to headers
          sheet.getRange(1, lastCol + 1).setValue("accesses");
          sheet.getRange(1, lastCol + 1)
            .setBackground("#1a1a2e")
            .setFontColor("#e8d5b7")
            .setFontWeight("bold");
        }
      }
    }
  } catch(e) {
    Logger.log("Failed to ensure accesses header: " + e.message);
  }
}

function saveBank(bankData) {
  ensureAccessesHeader();
  if (bankData.accesses && typeof bankData.accesses === 'object') {
    bankData.accesses = JSON.stringify(bankData.accesses);
  }
  return saveRow(SHEETS.banks, bankData);
}

function deleteBank(id) {
  return deleteRow(SHEETS.banks, id);
}

// ============================================================
// SAVE PULSA
// ============================================================

function savePulsa(pulsaData) {
  return saveRow(SHEETS.pulsa, pulsaData);
}

function deletePulsa(id) {
  return deleteRow(SHEETS.pulsa, id);
}

// ============================================================
// SAVE SOCIAL
// ============================================================

function saveSocial(socialData) {
  return saveRow(SHEETS.socials, socialData);
}

function deleteSocial(id) {
  return deleteRow(SHEETS.socials, id);
}

// ============================================================
// SAVE QRIS
// ============================================================

function saveQris(qrisData) {
  return saveRow(SHEETS.qris, qrisData);
}

function deleteQris(id) {
  return deleteRow(SHEETS.qris, id);
}

// ============================================================
// SAVE BACKUP CONTACT
// ============================================================

function saveBackupContact(contactData) {
  return saveRow(SHEETS.backupContacts, contactData);
}

function deleteBackupContact(id) {
  return deleteRow(SHEETS.backupContacts, id);
}

// ============================================================
// CLEAR ALL: Hapus semua data (kecuali header)
// ============================================================

function clearAllData() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheetNames = Object.values(SHEETS);
    sheetNames.forEach(function(name) {
      var sheet = ss.getSheetByName(name);
      if (sheet && sheet.getLastRow() >= 2) {
        sheet.deleteRows(2, sheet.getLastRow() - 1);
      }
    });
    return { success: true };
  } catch(e) {
    return { success: false, error: e.message };
  }
}
