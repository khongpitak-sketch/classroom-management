/**
 * =========================================================================
 * ระบบจัดการห้องเรียนและห้องปฏิบัติการคอมพิวเตอร์ (Classroom Management System)
 * Backend Google Apps Script (Code.gs) + Google Sheets Database
 * =========================================================================
 * 
 * 🏛️ โครงสร้างฐานข้อมูล Google Sheets:
 *  1. Sheet "Rooms"       : ข้อมูลห้องเรียน 302-308, 401-406, ห้องปฏิบัติการคอม 1-4
 *  2. Sheet "Timetable"   : ตารางการใช้ห้องเรียนประจำสัปดาห์
 *  3. Sheet "Bookings"    : ข้อมูลการจองห้องเรียน
 *  4. Sheet "Maintenance" : รายการแจ้งซ่อมและสถานะอุปกรณ์
 */

// ชื่อแผ่นงาน (Sheet Names)
const SHEET_ROOMS = "Rooms";
const SHEET_TIMETABLE = "Timetable";
const SHEET_BOOKINGS = "Bookings";
const SHEET_MAINTENANCE = "Maintenance";

/**
 * ฟังก์ชันเปิดหน้าเว็บ Web App (เมื่อเปิดผ่าน Google Apps Script URL)
 */
function doGet(e) {
  // ตรวจสอบว่าเป็นการเรียกผ่าน API หรือเปิดหน้าเว็บ
  if (e && e.parameter && e.parameter.action) {
    return handleApiGet(e.parameter);
  }
  
  // เปิดหน้าเว็บ Index.html
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('ระบบจัดการห้องเรียนและห้องปฏิบัติการคอมพิวเตอร์')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * ฟังก์ชันรับคำขอ POST สำหรับเชื่อมต่อจาก GitHub Pages หรือภายนอก
 */
function doPost(e) {
  try {
    let requestData = {};
    if (e && e.postData && e.postData.contents) {
      requestData = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      requestData = e.parameter;
    }

    const action = requestData.action;
    let result = { success: false, message: "Unknown action" };

    switch (action) {
      case 'addBooking':
        result = apiAddBooking(requestData.booking);
        break;
      case 'cancelBooking':
        result = apiCancelBooking(requestData.id);
        break;
      case 'approveBooking':
        result = apiApproveBooking(requestData.id);
        break;
      case 'addMaintenance':
        result = apiAddMaintenance(requestData.ticket);
        break;
      case 'resolveMaintenance':
        result = apiResolveMaintenance(requestData.id);
        break;
      case 'deleteMaintenance':
        result = apiDeleteMaintenance(requestData.id);
        break;
      case 'addRoom':
        result = apiAddRoom(requestData.room);
        break;
      case 'updateRoom':
        result = apiUpdateRoom(requestData.room);
        break;
      case 'deleteRoom':
        result = apiDeleteRoom(requestData.id);
        break;
      case 'updateRoomStatus':
        result = apiUpdateRoomStatus(requestData.id, requestData.status, requestData.currentClass);
        break;
      case 'addTimetable':
        result = apiAddTimetable(requestData.item || requestData.timetable);
        break;
      case 'updateTimetable':
        result = apiUpdateTimetable(requestData.item || requestData.timetable);
        break;
      case 'deleteTimetable':
        result = apiDeleteTimetable(requestData.id);
        break;
      case 'initDatabase':
        result = setupDatabase();
        break;
      default:
        result = { success: false, message: "Invalid action: " + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * จัดการ API GET (ส่งออกข้อมูล JSON ให้ GitHub Pages / Web)
 */
function handleApiGet(params) {
  try {
    const action = params.action;
    let responseData = {};

    if (action === 'getData' || action === 'getAll') {
      responseData = {
        success: true,
        data: apiGetData()
      };
    } else if (action === 'init' || action === 'setupDatabase' || action === 'initDatabase') {
      responseData = setupDatabase();
      responseData.data = apiGetData();
    } else if (action === 'addBooking') {
      let booking = {};
      if (params.booking) {
        booking = typeof params.booking === 'string' ? JSON.parse(params.booking) : params.booking;
      } else if (params.data) {
        booking = typeof params.data === 'string' ? JSON.parse(params.data) : params.data;
      } else {
        booking = params;
      }
      responseData = apiAddBooking(booking);
      if (responseData.success) {
        responseData.data = apiGetData();
      }
    } else if (action === 'approveBooking') {
      responseData = apiApproveBooking(params.id);
      if (responseData.success) {
        responseData.data = apiGetData();
      }
    } else if (action === 'rejectBooking') {
      responseData = apiRejectBooking(params.id);
      if (responseData.success) {
        responseData.data = apiGetData();
      }
    } else if (action === 'cancelBooking' || action === 'deleteBooking') {
      responseData = apiCancelBooking(params.id);
      if (responseData.success) {
        responseData.data = apiGetData();
      }
    } else if (action === 'addMaintenance') {
      let ticket = {};
      if (params.ticket) {
        ticket = typeof params.ticket === 'string' ? JSON.parse(params.ticket) : params.ticket;
      } else if (params.data) {
        ticket = typeof params.data === 'string' ? JSON.parse(params.data) : params.data;
      } else {
        ticket = params;
      }
      responseData = apiAddMaintenance(ticket);
      if (responseData.success) {
        responseData.data = apiGetData();
      }
    } else if (action === 'resolveMaintenance') {
      responseData = apiResolveMaintenance(params.id);
      if (responseData.success) {
        responseData.data = apiGetData();
      }
    } else if (action === 'deleteMaintenance') {
      responseData = apiDeleteMaintenance(params.id);
      if (responseData.success) {
        responseData.data = apiGetData();
      }
    } else if (action === 'addRoom') {
      let room = {};
      if (params.room) room = typeof params.room === 'string' ? JSON.parse(params.room) : params.room;
      else if (params.data) room = typeof params.data === 'string' ? JSON.parse(params.data) : params.data;
      else room = params;
      responseData = apiAddRoom(room);
      if (responseData.success) responseData.data = apiGetData();
    } else if (action === 'updateRoom') {
      let room = {};
      if (params.room) room = typeof params.room === 'string' ? JSON.parse(params.room) : params.room;
      else if (params.data) room = typeof params.data === 'string' ? JSON.parse(params.data) : params.data;
      else room = params;
      responseData = apiUpdateRoom(room);
      if (responseData.success) responseData.data = apiGetData();
    } else if (action === 'deleteRoom') {
      responseData = apiDeleteRoom(params.id);
      if (responseData.success) responseData.data = apiGetData();
    } else if (action === 'addTimetable') {
      let item = {};
      if (params.item) item = typeof params.item === 'string' ? JSON.parse(params.item) : params.item;
      else if (params.timetable) item = typeof params.timetable === 'string' ? JSON.parse(params.timetable) : params.timetable;
      else if (params.data) item = typeof params.data === 'string' ? JSON.parse(params.data) : params.data;
      else item = params;
      responseData = apiAddTimetable(item);
      if (responseData.success) responseData.data = apiGetData();
    } else if (action === 'updateTimetable') {
      let item = {};
      if (params.item) item = typeof params.item === 'string' ? JSON.parse(params.item) : params.item;
      else if (params.timetable) item = typeof params.timetable === 'string' ? JSON.parse(params.timetable) : params.timetable;
      else if (params.data) item = typeof params.data === 'string' ? JSON.parse(params.data) : params.data;
      else item = params;
      responseData = apiUpdateTimetable(item);
      if (responseData.success) responseData.data = apiGetData();
    } else if (action === 'deleteTimetable') {
      responseData = apiDeleteTimetable(params.id);
      if (responseData.success) responseData.data = apiGetData();
    } else if (action === 'init') {
      responseData = setupDatabase();
    } else {
      responseData = { success: false, message: "Invalid action: " + action };
    }

    if (params.callback) {
      return ContentService.createTextOutput(params.callback + '(' + JSON.stringify(responseData) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService.createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ดึง Spreadsheet ที่ผูกอยู่กับสคริปต์
 */
function getDb() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * =========================================================================
 * API Functions (เรียกผ่าน google.script.run หรือ REST API)
 * =========================================================================
 */

/**
 * ดึงข้อมูลทั้งหมดในฐานข้อมูลส่งไปยังหน้าเว็บ
 */
function apiGetData() {
  const ss = getDb();
  
  // ตรวจสอบว่ามีชีทครบหรือไม่ หรือตารางเรียนว่างเปล่าหรือไม่ หากยังไม่มีให้สร้างอัตโนมัติ
  let roomsSheet = ss.getSheetByName(SHEET_ROOMS);
  let ttSheet = ss.getSheetByName(SHEET_TIMETABLE);
  if (!roomsSheet || !ttSheet || ttSheet.getLastRow() <= 1) {
    setupDatabase();
  }

  const rooms = getSheetObjects(ss.getSheetByName(SHEET_ROOMS));
  const timetable = getSheetObjects(ss.getSheetByName(SHEET_TIMETABLE));
  const bookings = getSheetObjects(ss.getSheetByName(SHEET_BOOKINGS));
  const maintenance = getSheetObjects(ss.getSheetByName(SHEET_MAINTENANCE));

  // แปลง JSON fields ที่ถูกเก็บเป็นสตริง
  rooms.forEach(r => {
    if (typeof r.facilities === 'string') {
      try { r.facilities = JSON.parse(r.facilities); } catch(e) { r.facilities = r.facilities.split(',').map(s=>s.trim()); }
    }
    if (typeof r.specs === 'string' && r.specs) {
      try { r.specs = JSON.parse(r.specs); } catch(e) {}
    }
    if (typeof r.software === 'string' && r.software) {
      try { r.software = JSON.parse(r.software); } catch(e) { r.software = r.software.split(',').map(s=>s.trim()); }
    }
    if (typeof r.currentClass === 'string' && r.currentClass) {
      try { r.currentClass = JSON.parse(r.currentClass); } catch(e) { r.currentClass = null; }
    }
  });

  return {
    rooms: rooms,
    timetable: timetable,
    bookings: bookings,
    maintenance: maintenance
  };
}

/**
 * บันทึกการจองห้องใหม่
 */
function apiAddBooking(booking) {
  try {
    const ss = getDb();
    const sheet = ss.getSheetByName(SHEET_BOOKINGS);
    if (!sheet) return { success: false, message: "Sheet not found" };

    if (!booking.id) {
      booking.id = "BK-" + Math.floor(1000 + Math.random() * 9000);
    }
    if (!booking.createdAt) {
      booking.createdAt = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm");
    }

    const bName = booking.bookerName || booking.reservedBy || booking.reservedby || "";
    const bSubject = booking.subject || booking.purpose || "";
    const bPurpose = booking.purpose || booking.subject || "";
    const bStatus = booking.status || "pending";
    const bPhone = booking.phone ? String(booking.phone) : "";

    const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    if (headers && headers.length > 1) {
      const row = [];
      for (let j = 0; j < headers.length; j++) {
        const h = String(headers[j]).trim().toLowerCase();
        if (h === 'id') row.push(booking.id);
        else if (h === 'roomid') row.push(booking.roomId || booking.roomid || "");
        else if (h === 'roomname') row.push(booking.roomName || booking.roomname || "");
        else if (h === 'date') row.push(booking.date || "");
        else if (h === 'starttime') row.push(booking.startTime || booking.starttime || "");
        else if (h === 'endtime') row.push(booking.endTime || booking.endtime || "");
        else if (h === 'subject') row.push(bSubject);
        else if (h === 'purpose') row.push(bPurpose);
        else if (h === 'bookername' || h === 'reservedby') row.push(bName);
        else if (h === 'department') row.push(booking.department || "");
        else if (h === 'phone') row.push(bPhone);
        else if (h === 'status') row.push(bStatus);
        else if (h === 'createdat') row.push(booking.createdAt);
        else row.push(booking[headers[j]] || "");
      }
      sheet.appendRow(row);
    } else {
      sheet.appendRow([
        booking.id,
        booking.roomId || booking.roomid || "",
        booking.roomName || booking.roomname || "",
        booking.date || "",
        booking.startTime || booking.starttime || "",
        booking.endTime || booking.endtime || "",
        bSubject,
        bName,
        booking.department || "",
        bPurpose,
        bStatus,
        booking.createdAt
      ]);
    }

    return { success: true, booking: booking, message: "บันทึกการจองห้องสำเร็จ" };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * ยกเลิกการจองห้อง
 */
function apiCancelBooking(bookingId) {
  try {
    const ss = getDb();
    let deleted = false;

    // Delete from Bookings sheet
    const bkSheet = ss.getSheetByName(SHEET_BOOKINGS);
    if (bkSheet) {
      const data = bkSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] == bookingId) {
          bkSheet.deleteRow(i + 1);
          deleted = true;
          break;
        }
      }
    }

    // Also delete from Maintenance sheet if this was a dual-synced ticket
    const mntSheet = ss.getSheetByName(SHEET_MAINTENANCE);
    if (mntSheet) {
      const mntData = mntSheet.getDataRange().getValues();
      for (let j = 1; j < mntData.length; j++) {
        if (mntData[j][0] == bookingId) {
          mntSheet.deleteRow(j + 1);
          deleted = true;
          break;
        }
      }
    }

    return { success: true, deleted: deleted, message: "ลบรายการจองสำเร็จ" };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * อนุมัติการจอง
 */
function apiApproveBooking(bookingId) {
  try {
    const ss = getDb();
    const sheet = ss.getSheetByName(SHEET_BOOKINGS);
    if (!sheet) return { success: false, message: "Sheet not found" };
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: false, message: "No data" };

    let statusCol = 11;
    for (let c = 0; c < data[0].length; c++) {
      if (String(data[0][c]).trim().toLowerCase() === 'status') {
        statusCol = c + 1;
        break;
      }
    }

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == bookingId) {
        sheet.getRange(i + 1, statusCol).setValue("approved");
        return { success: true, message: "อนุมัติการจองเรียบร้อยแล้ว" };
      }
    }
    return { success: false, message: "ไม่พบรหัสการจอง: " + bookingId };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * แจ้งซ่อมอุปกรณ์
 */
function apiAddMaintenance(ticket) {
  try {
    const ss = getDb();
    let sheet = ss.getSheetByName(SHEET_MAINTENANCE);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_MAINTENANCE);
      sheet.appendRow(["id", "roomId", "roomName", "reportedDate", "title", "details", "reporter", "priority", "status"]);
    }

    if (!ticket.id) {
      ticket.id = "MNT-" + Math.floor(100 + Math.random() * 900);
    }
    if (!ticket.reportedDate) {
      ticket.reportedDate = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
    }

    sheet.appendRow([
      ticket.id,
      ticket.roomId,
      ticket.roomName,
      ticket.reportedDate,
      ticket.title,
      ticket.details || "",
      ticket.reporter || "",
      ticket.priority || "medium",
      ticket.status || "open"
    ]);

    // Also update Bookings sheet if dual-channel fallback is used
    const bkSheet = ss.getSheetByName(SHEET_BOOKINGS);
    if (bkSheet) {
      const bkData = bkSheet.getDataRange().getValues();
      let foundInBk = false;
      for (let j = 1; j < bkData.length; j++) {
        if (bkData[j][0] == ticket.id) {
          foundInBk = true;
          break;
        }
      }
      if (!foundInBk) {
        bkSheet.appendRow([
          ticket.id,
          ticket.roomId,
          ticket.roomName,
          ticket.reportedDate,
          ticket.priority || "medium",
          ticket.status || "open",
          "[MNT] " + ticket.title,
          ticket.reporter || "ผู้แจ้งซ่อม",
          "แจ้งซ่อม (" + (ticket.priority || "medium") + ")",
          ticket.status || "open"
        ]);
      }
    }

    return { success: true, ticket: ticket, message: "บันทึกแจ้งซ่อมสำเร็จ" };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * ปิดงานซ่อม (เสร็จสิ้น)
 */
function apiResolveMaintenance(ticketId) {
  try {
    const ss = getDb();
    let resolved = false;
    const sheet = ss.getSheetByName(SHEET_MAINTENANCE);
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] == ticketId) {
          sheet.getRange(i + 1, 9).setValue("completed");
          resolved = true;
          break;
        }
      }
    }

    // Also resolve in Bookings sheet if dual-synced
    const bkSheet = ss.getSheetByName(SHEET_BOOKINGS);
    if (bkSheet) {
      const bkData = bkSheet.getDataRange().getValues();
      for (let j = 1; j < bkData.length; j++) {
        if (bkData[j][0] == ticketId) {
          bkSheet.getRange(j + 1, 9).setValue("completed");
          resolved = true;
          break;
        }
      }
    }

    return { success: true, resolved: resolved, message: "อัปเดตสถานะการซ่อมสำเร็จ" };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * เพิ่มห้องเรียนใหม่
 */
function apiAddRoom(room) {
  try {
    const ss = getDb();
    const sheet = ss.getSheetByName(SHEET_ROOMS);
    if (!sheet) return { success: false, message: "Sheet not found" };

    sheet.appendRow([
      room.id,
      room.name,
      room.type,
      room.categoryName,
      room.building,
      room.floor,
      room.capacity,
      room.pcCount || 0,
      room.status || "available",
      JSON.stringify(room.facilities || []),
      room.description || "",
      room.image || "",
      JSON.stringify(room.specs || {}),
      JSON.stringify(room.software || []),
      JSON.stringify(room.currentClass || null)
    ]);

    return { success: true, room: room, message: "เพิ่มห้องเรียนสำเร็จ" };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * อัปเดตสถานะห้องเรียน
 */
function apiUpdateRoomStatus(roomId, status, currentClass) {
  try {
    const ss = getDb();
    const sheet = ss.getSheetByName(SHEET_ROOMS);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == roomId) {
        sheet.getRange(i + 1, 9).setValue(status);
        if (currentClass !== undefined) {
          sheet.getRange(i + 1, 15).setValue(currentClass ? JSON.stringify(currentClass) : "");
        }
        return { success: true, message: "อัปเดตสถานะห้องสำเร็จ" };
      }
    }
    return { success: false, message: "ไม่พบรหัสห้อง: " + roomId };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * =========================================================================
 * Database Setup & Initialization (สร้างฐานข้อมูลเริ่มต้นใน Google Sheets)
 * =========================================================================
 */

/**
 * ลบรายการแจ้งซ่อม
 */
function apiDeleteMaintenance(ticketId) {
  try {
    const ss = getDb();
    let deleted = false;

    // Delete from Maintenance sheet
    const mntSheet = ss.getSheetByName(SHEET_MAINTENANCE);
    if (mntSheet) {
      const data = mntSheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] == ticketId) {
          mntSheet.deleteRow(i + 1);
          deleted = true;
          break;
        }
      }
    }

    // Also delete from Bookings sheet if it was dual-synced under [MNT]
    const bkSheet = ss.getSheetByName(SHEET_BOOKINGS);
    if (bkSheet) {
      const bkData = bkSheet.getDataRange().getValues();
      for (let j = 1; j < bkData.length; j++) {
        if (bkData[j][0] == ticketId) {
          bkSheet.deleteRow(j + 1);
          deleted = true;
          break;
        }
      }
    }

    return { success: true, deleted: deleted, message: "ลบรายการแจ้งซ่อมเรียบร้อยแล้ว" };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * แก้ไขข้อมูลและสเปกห้องเรียน
 */
function apiUpdateRoom(room) {
  try {
    const ss = getDb();
    const sheet = ss.getSheetByName(SHEET_ROOMS);
    if (!sheet) return { success: false, message: "Sheet not found" };
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == room.id) {
        const rowIdx = i + 1;
        if (room.name !== undefined) sheet.getRange(rowIdx, 2).setValue(room.name);
        if (room.type !== undefined) sheet.getRange(rowIdx, 3).setValue(room.type);
        if (room.categoryName !== undefined) sheet.getRange(rowIdx, 4).setValue(room.categoryName);
        if (room.building !== undefined) sheet.getRange(rowIdx, 5).setValue(room.building);
        if (room.floor !== undefined) sheet.getRange(rowIdx, 6).setValue(room.floor);
        if (room.capacity !== undefined) sheet.getRange(rowIdx, 7).setValue(room.capacity);
        if (room.pcCount !== undefined) sheet.getRange(rowIdx, 8).setValue(room.pcCount || 0);
        if (room.status !== undefined) sheet.getRange(rowIdx, 9).setValue(room.status);
        if (room.facilities !== undefined) sheet.getRange(rowIdx, 10).setValue(typeof room.facilities === 'string' ? room.facilities : JSON.stringify(room.facilities));
        if (room.description !== undefined) sheet.getRange(rowIdx, 11).setValue(room.description);
        if (room.image !== undefined) sheet.getRange(rowIdx, 12).setValue(room.image);
        if (room.specs !== undefined) sheet.getRange(rowIdx, 13).setValue(typeof room.specs === 'string' ? room.specs : JSON.stringify(room.specs));
        if (room.software !== undefined) sheet.getRange(rowIdx, 14).setValue(typeof room.software === 'string' ? room.software : JSON.stringify(room.software));
        if (room.currentClass !== undefined) sheet.getRange(rowIdx, 15).setValue(room.currentClass ? JSON.stringify(room.currentClass) : "");
        return { success: true, room: room, message: "แก้ไขข้อมูลห้องสำเร็จ" };
      }
    }
    return { success: false, message: "ไม่พบรหัสห้อง: " + room.id };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * ลบห้องเรียน
 */
function apiDeleteRoom(roomId) {
  try {
    const ss = getDb();
    const sheet = ss.getSheetByName(SHEET_ROOMS);
    if (!sheet) return { success: false, message: "Sheet not found" };
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == roomId) {
        sheet.deleteRow(i + 1);
        return { success: true, message: "ลบห้องเรียนเรียบร้อยแล้ว" };
      }
    }
    return { success: false, message: "ไม่พบรหัสห้อง: " + roomId };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * เพิ่มคาบเรียนในตารางเรียน
 */
function apiAddTimetable(item) {
  try {
    const ss = getDb();
    const sheet = ss.getSheetByName(SHEET_TIMETABLE);
    if (!sheet) return { success: false, message: "Sheet not found" };

    if (!item.id) {
      item.id = "TT-" + Math.floor(1000 + Math.random() * 9000);
    }

    sheet.appendRow([
      item.id,
      item.roomId,
      item.day || "",
      item.dayIndex !== undefined ? item.dayIndex : 1,
      item.startTime || "08:20",
      item.endTime || "12:20",
      item.subject || "",
      item.code || "",
      item.instructor || "",
      item.group || "",
      item.color || "blue"
    ]);

    return { success: true, item: item, message: "เพิ่มคาบเรียนสำเร็จ" };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * แก้ไขคาบเรียนในตารางเรียน
 */
function apiUpdateTimetable(item) {
  try {
    const ss = getDb();
    const sheet = ss.getSheetByName(SHEET_TIMETABLE);
    if (!sheet) return { success: false, message: "Sheet not found" };
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == item.id) {
        const rowIdx = i + 1;
        if (item.roomId !== undefined) sheet.getRange(rowIdx, 2).setValue(item.roomId);
        if (item.day !== undefined) sheet.getRange(rowIdx, 3).setValue(item.day);
        if (item.dayIndex !== undefined) sheet.getRange(rowIdx, 4).setValue(item.dayIndex);
        if (item.startTime !== undefined) sheet.getRange(rowIdx, 5).setValue(item.startTime);
        if (item.endTime !== undefined) sheet.getRange(rowIdx, 6).setValue(item.endTime);
        if (item.subject !== undefined) sheet.getRange(rowIdx, 7).setValue(item.subject);
        if (item.code !== undefined) sheet.getRange(rowIdx, 8).setValue(item.code);
        if (item.instructor !== undefined) sheet.getRange(rowIdx, 9).setValue(item.instructor);
        if (item.group !== undefined) sheet.getRange(rowIdx, 10).setValue(item.group);
        if (item.color !== undefined) sheet.getRange(rowIdx, 11).setValue(item.color);
        return { success: true, item: item, message: "แก้ไขคาบเรียนสำเร็จ" };
      }
    }
    return { success: false, message: "ไม่พบรหัสคาบเรียน: " + item.id };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

/**
 * ลบคาบเรียนในตารางเรียน
 */
function apiDeleteTimetable(id) {
  try {
    const ss = getDb();
    const sheet = ss.getSheetByName(SHEET_TIMETABLE);
    if (!sheet) return { success: false, message: "Sheet not found" };
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == id) {
        sheet.deleteRow(i + 1);
        return { success: true, message: "ลบคาบเรียนเรียบร้อยแล้ว" };
      }
    }
    return { success: false, message: "ไม่พบรหัสคาบเรียน: " + id };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}

function setupDatabase() {
  const ss = getDb();
  
  // 1. สร้าง/ตั้งค่า Sheet "Rooms"
  let roomsSheet = ss.getSheetByName(SHEET_ROOMS);
  if (!roomsSheet) {
    roomsSheet = ss.insertSheet(SHEET_ROOMS);
  } else {
    roomsSheet.clear();
  }
  
  const roomsHeaders = ["id", "name", "type", "categoryName", "building", "floor", "capacity", "pcCount", "status", "facilities", "description", "image", "specs", "software", "currentClass"];
  roomsSheet.appendRow(roomsHeaders);
  formatHeaderRow(roomsSheet, "#1e3a8a");

  // ข้อมูลห้องเรียนตามที่ระบุ: 302, 303, 305, 306, 307, 308, 401, 402, 403, 404, 405, 406 และห้องปฏิบัติการคอม 1 - 4
  const defaultRooms = [["R-302", "FMS302 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 3", 45, 0, "available", "[\"เครื่องโปรเจกเตอร์ (Projector)\", \"เครื่องปรับอากาศ x2\", \"กระดาน Whiteboard\", \"ระบบเครื่องเสียง & ไมค์\"]", "ห้องเรียนทฤษฎี FMS302 (เครื่องโปรเจกเตอร์) ชั้น ชั้น 3 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600", "{}", "[]", ""], ["R-303", "FMS303 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 3", 45, 0, "available", "[\"Smart TV (ทีวี 65 นิ้ว)\", \"เครื่องปรับอากาศ x2\", \"กระดาน Whiteboard\", \"ระบบเสียง\"]", "ห้องเรียนทฤษฎี FMS303 (ทีวี) ชั้น ชั้น 3 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600", "{}", "[]", ""], ["R-305", "FMS305 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 3", 45, 0, "available", "[\"Smart TV (ทีวี 65 นิ้ว)\", \"เครื่องปรับอากาศ x2\", \"กระดาน Whiteboard\"]", "ห้องเรียนทฤษฎี FMS305 (ทีวี) ชั้น ชั้น 3 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600", "{}", "[]", ""], ["R-306", "FMS306 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 3", 50, 0, "available", "[\"เครื่องโปรเจกเตอร์ (Projector)\", \"เครื่องปรับอากาศ x3\", \"กระดานกระจก\", \"ระบบ Video Conference\"]", "ห้องเรียนทฤษฎี FMS306 (เครื่องโปรเจกเตอร์) ชั้น ชั้น 3 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1562774053-701939374585?w=600", "{}", "[]", ""], ["R-307", "FMS307 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 3", 45, 0, "available", "[\"เครื่องโปรเจกเตอร์ (Projector)\", \"เครื่องปรับอากาศ x2\", \"กระดานกระจกขนาดใหญ่\", \"ไมค์ลอย\"]", "ห้องเรียนทฤษฎี FMS307 (เครื่องโปรเจกเตอร์) ชั้น ชั้น 3 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600", "{}", "[]", ""], ["R-308", "FMS308 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 3", 50, 0, "available", "[\"เครื่องโปรเจกเตอร์ (Projector)\", \"เครื่องปรับอากาศ x3\", \"กระดาน Whiteboard x2\", \"ไมค์ลอยคู่\"]", "ห้องเรียนทฤษฎี FMS308 (เครื่องโปรเจกเตอร์) ชั้น ชั้น 3 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1562774053-701939374585?w=600", "{}", "[]", ""], ["R-401", "FMS401 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 4", 50, 0, "available", "[\"Smart TV (ทีวี 65 นิ้ว)\", \"เครื่องปรับอากาศ x2\", \"กระดาน Whiteboard\", \"ระบบเสียงดิจิทัล\"]", "ห้องเรียนทฤษฎี FMS401 (ทีวี) ชั้น ชั้น 4 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600", "{}", "[]", ""], ["R-402", "FMS402 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 4", 45, 0, "available", "[\"Smart TV (ทีวี 65 นิ้ว)\", \"เครื่องปรับอากาศ x2\", \"กระดาน Whiteboard\", \"ลำโพงบลูทูธ\"]", "ห้องเรียนทฤษฎี FMS402 (ทีวี) ชั้น ชั้น 4 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600", "{}", "[]", ""], ["R-403", "FMS403 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 4", 50, 0, "available", "[\"เครื่องโปรเจกเตอร์ (Projector)\", \"เครื่องปรับอากาศ x3\", \"กระดาน Whiteboard\", \"ระบบไมค์ 4 ตัว\"]", "ห้องเรียนทฤษฎี FMS403 (เครื่องโปรเจกเตอร์) ชั้น ชั้น 4 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600", "{}", "[]", ""], ["R-404", "FMS404 - ห้องเรียน", "general", "ห้องเรียน", "อาคารคณะวิทยาการจัดการ", "ชั้น 4", 45, 0, "available", "[\"เครื่องโปรเจกเตอร์ (Projector)\", \"เครื่องปรับอากาศ x2\", \"กระดาน Whiteboard\", \"ไมค์ไร้สาย\"]", "ห้องเรียนทฤษฎี FMS404 (เครื่องโปรเจกเตอร์) ชั้น ชั้น 4 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=600", "{}", "[]", ""], ["R-405", "FMS405 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 4", 55, 0, "available", "[\"เครื่องโปรเจกเตอร์ (Projector)\", \"เครื่องปรับอากาศ x3\", \"เวทียกพื้น\", \"ไมค์สัมมนา\"]", "ห้องเรียนทฤษฎี FMS405 (เครื่องโปรเจกเตอร์) ชั้น ชั้น 4 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1562774053-701939374585?w=600", "{}", "[]", ""], ["R-406", "FMS406 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 4", 45, 0, "available", "[\"เครื่องโปรเจกเตอร์ (Projector)\", \"เครื่องปรับอากาศ x2\", \"กระดาน Whiteboard\", \"ระบบเสียงสเตอริโอ\"]", "ห้องเรียนทฤษฎี FMS406 (เครื่องโปรเจกเตอร์) ชั้น ชั้น 4 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600", "{}", "[]", ""], ["LAB-1", "FMS201 - ห้องปฏิบัติการคอมพิวเตอร์ 1", "computer_lab", "ห้องปฏิบัติการคอมพิวเตอร์", "อาคารคณะวิทยาการจัดการ", "ชั้น 2", 50, 50, "available", "[\"PC สำหรับนักศึกษา 50 เครื่อง\", \"PC อาจารย์ 1 เครื่อง\", \"Projector ความสว่างสูง\", \"ระบบควบคุมจอ NetSupport\", \"เครื่องปรับอากาศ x4\"]", "ห้องปฏิบัติการคอมพิวเตอร์ 1 (FMS201) ชั้น 2 คณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600", "{\"cpu\": \"Intel Core i5-13400 (10 Cores, 16 Threads)\", \"ram\": \"16 GB DDR4 3200MHz\", \"storage\": \"512 GB NVMe SSD\", \"gpu\": \"Intel UHD Graphics 730\", \"monitor\": \"24\\" Full HD IPS 75Hz\", \"os\": \"Windows 11 Pro 64-bit\", \"network\": \"LAN Gigabit 1000 Mbps\"}", "[\"Microsoft Office 365\", \"SPSS\", \"โปรแกรมสำเร็จรูปเพื่องานบัญชี\", \"Web Browser Suite\"]", ""], ["LAB-2", "FMS508 - ห้องปฏิบัติการคอมพิวเตอร์ 2", "computer_lab", "ห้องปฏิบัติการคอมพิวเตอร์", "อาคารคณะวิทยาการจัดการ", "ชั้น 5", 45, 45, "available", "[\"PC ประสิทธิภาพสูง 45 เครื่อง\", \"Smart Board 86 นิ้ว\", \"ระบบเครื่องเสียงห้องแล็บ\", \"เครื่องปรับอากาศ x4\"]", "ห้องปฏิบัติการคอมพิวเตอร์ 2 (FMS508) ชั้น 5 คณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600", "{\"cpu\": \"Intel Core i7-13700 (16 Cores, 24 Threads)\", \"ram\": \"32 GB DDR5 5600MHz\", \"storage\": \"1 TB NVMe Gen4 SSD\", \"gpu\": \"NVIDIA GeForce RTX 3060 12GB\", \"monitor\": \"27\\" 2K QHD IPS\", \"os\": \"Windows 11 Pro\", \"network\": \"LAN Gigabit 1000 Mbps\"}", "[\"Adobe Creative Cloud\", \"AI Multimedia Suite\", \"โปรแกรมระบบสารสนเทศทางการบัญชี\", \"VS Code & Python\"]", ""], ["LAB-3", "FMS504 - ห้องปฏิบัติการคอมพิวเตอร์ 3", "computer_lab", "ห้องปฏิบัติการคอมพิวเตอร์", "อาคารคณะวิทยาการจัดการ", "ชั้น 5", 45, 45, "available", "[\"PC เวิร์กสเตชัน 45 เครื่อง\", \"Projector Laser จอใหญ่\", \"ระบบ NetSupport School\", \"เครื่องปรับอากาศ x4\"]", "ห้องปฏิบัติการคอมพิวเตอร์ 3 (FMS504) ชั้น 5 คณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600", "{\"cpu\": \"Intel Core i7-13700\", \"ram\": \"32 GB DDR5\", \"storage\": \"1 TB NVMe SSD\", \"gpu\": \"NVIDIA GeForce RTX 4060\", \"monitor\": \"27\\" 2K QHD\", \"os\": \"Windows 11 Pro\", \"network\": \"LAN Gigabit\"}", "[\"Power BI\", \"IoT Development Tools\", \"ระบบธุรกิจอัจฉริยะ (BI Tools)\", \"Multimedia Design Suite\"]", ""], ["LAB-4", "FMS503 - ห้องปฏิบัติการคอมพิวเตอร์ 4", "computer_lab", "ห้องปฏิบัติการคอมพิวเตอร์", "อาคารคณะวิทยาการจัดการ", "ชั้น 5", 40, 40, "available", "[\"PC สำหรับเขียนโปรแกรม 40 เครื่อง\", \"Projector 4500 ANSI\", \"เครื่องปรับอากาศ x4\"]", "ห้องปฏิบัติการคอมพิวเตอร์ 4 (FMS503) ชั้น 5 คณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600", "{\"cpu\": \"Intel Core i5-13400\", \"ram\": \"16 GB DDR4\", \"storage\": \"512 GB SSD\", \"gpu\": \"Intel UHD 730\", \"monitor\": \"24\\" Full HD\", \"os\": \"Windows 11 Pro\", \"network\": \"LAN Gigabit\"}", "[\"Python 3.12\", \"VS Code\", \"Cloud Development Tools\", \"Adobe Multimedia\", \"SPSS Statistics\"]", ""], ["MIL-1", "ห้องปฏิบัติการนวัตกรรมการจัดการ (Management Innovation Lab)", "meeting_room", "ห้องปฏิบัติการนวัตกรรม & ประชุม", "อาคารคณะวิทยาการจัดการ", "ชั้น 2", 40, 0, "available", "[\"Smart Board 86 นิ้ว\", \"ระบบ Video Conference บันทึกการสอน\", \"เก้าอี้ Ergonomic\", \"เครื่องปรับอากาศ x2\"]", "ห้องปฏิบัติการนวัตกรรมการจัดการ (Management Innovation Lab) สำหรับระดับบัณฑิตศึกษาและวิชาการจัดการขั้นสูง", "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600", "{}", "[]", ""], ["CONF-1", "ห้องประชุมพฤกษาพรรณชมพู", "meeting_room", "ห้องประชุม / สัมมนา", "อาคารคณะวิทยาการจัดการ", "ชั้น 1", 20, 0, "available", "[\"ระบบเสียงไมโครโฟนรอบทิศทาง\", \"Dual Projector\", \"เวทีบรรยาย\", \"ระบบถ่ายทอดสด Live Streaming\", \"เครื่องปรับอากาศ x4\"]", "ห้องประชุมพฤกษาพรรณชมพู ชั้น 1 อาคารคณะวิทยาการจัดการ มหาวิทยาลัยนราธิวาสราชนครินทร์ ความจุ 20 ที่นั่ง รองรับการประชุม สัมมนา และการเรียนการสอนกลุ่มย่อย", "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600", "{}", "[]", ""], ["CONF-2", "ห้องประชุมวิภา วังศิริกุล", "meeting_room", "ห้องประชุม / สัมมนา", "อาคารคณะวิทยาการจัดการ", "ชั้น 2", 200, 0, "available", "[\"เครื่องโปรเจกเตอร์ (Projector)\", \"ระบบเครื่องเสียงห้องประชุม\", \"ไมโครโฟนไร้สาย & ไมค์บรรยาย\", \"เครื่องปรับอากาศ\"]", "ห้องประชุมวิภา วังศิริกุล อาคารคณะวิทยาการจัดการ ความจุ 200 คน พร้อมเครื่องโปรเจกเตอร์และระบบเครื่องเสียง รองรับการประชุมใหญ่ สัมมนาวิชาการ และกิจกรรมคณะ", "https://images.unsplash.com/photo-1431540015161-0bf8663c16ba?w=600&auto=format&fit=crop&q=60", "{}", "[\"Zoom Rooms\", \"Microsoft Teams\", \"Wireless Presentation\"]", ""], ["CONF-3", "ห้องประชุมอินทนิลโสภา", "meeting_room", "ห้องประชุม / สัมมนา", "อาคารคณะวิทยาการจัดการ", "ชั้น 5", 60, 0, "available", "[\"ทีวี 3 จอ (Smart TV จอแสดงผล 3 เครื่อง)\", \"เครื่องโปรเจกเตอร์ 1 จอ (Projector)\", \"ระบบเครื่องเสียงประชุมตั้งโต๊ะ (ไมค์ประชุมรายบุคคล)\", \"เครื่องปรับอากาศ\", \"ระบบ Video Conference\"]", "ห้องประชุมอินทนิลโสภา ชั้น 5 อาคารคณะวิทยาการจัดการ ความจุ 60 ที่นั่ง พร้อมทีวี 3 จอ โปรเจกเตอร์ 1 จอ และระบบเครื่องเสียงประชุมตั้งโต๊ะ", "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=600&auto=format&fit=crop&q=60", "{}", "[\"Zoom Rooms\", \"Microsoft Teams\", \"Wireless Screen Sharing\"]", ""]];
  roomsSheet.getRange(2, 1, defaultRooms.length, defaultRooms[0].length).setValues(defaultRooms);

  // 2. สร้าง Sheet "Timetable"
  let ttSheet = ss.getSheetByName(SHEET_TIMETABLE);
  if (!ttSheet) {
    ttSheet = ss.insertSheet(SHEET_TIMETABLE);
  } else {
    ttSheet.clear();
  }
  const ttHeaders = ["id", "roomId", "day", "dayIndex", "startTime", "endTime", "subject", "code", "instructor", "group", "color"];
  ttSheet.appendRow(ttHeaders);
  formatHeaderRow(ttSheet, "#4338ca");

  const defaultTimetable = [["TT-01", "LAB-1", "จันทร์", 1, "08:20", "10:20", "07-064-261 โปรแกรมสำเร็จรูปในงานอาชีพ (ทฤษฎี)", "07-064-261", "อ.พระรักษ์ อมรศักดิ์", "กลุ่ม 01 (ชั้นปี 1, 3)", "blue"], ["TT-02", "LAB-1", "จันทร์", 1, "10:20", "12:20", "07-064-261 โปรแกรมสำเร็จรูปในงานอาชีพ (ปฏิบัติ)", "07-064-261", "อ.พระรักษ์ อมรศักดิ์", "กลุ่ม 01 (ชั้นปี 1, 3)", "blue"], ["TT-03", "LAB-1", "จันทร์", 1, "13:20", "15:20", "07-044-224 การภาษีอากร 2 (ทฤษฎี)", "07-044-224", "อาจารย์ ดร.พูนพิศ ธิตินันทน์", "กลุ่ม 01 (ชั้นปี 3 บัญชี)", "emerald"], ["TT-04", "LAB-1", "จันทร์", 1, "15:20", "17:20", "07-044-224 การภาษีอากร 2 (ปฏิบัติ)", "07-044-224", "อาจารย์ ดร.พูนพิศ ธิตินันทน์", "กลุ่ม 01 (ชั้นปี 3 บัญชี)", "emerald"], ["TT-05", "LAB-1", "อังคาร", 2, "13:20", "15:20", "07-064-268 ระบบสารสนเทศเพื่อการจัดการภาครัฐ (ทฤษฎี)", "07-064-268", "ผศ.ศิริลักษณ์ อินทสโร", "กลุ่ม 02 (ชั้นปี 3 รปศ.)", "purple"], ["TT-06", "LAB-1", "อังคาร", 2, "15:20", "17:20", "07-064-268 ระบบสารสนเทศเพื่อการจัดการภาครัฐ (ปฏิบัติ)", "07-064-268", "ผศ.ศิริลักษณ์ อินทสโร", "กลุ่ม 02 (ชั้นปี 3 รปศ.)", "purple"], ["TT-07", "LAB-1", "พุธ", 3, "08:20", "10:20", "07-044-251 การประยุกต์โปรแกรมตารางงานเพื่องานบัญชี (ทฤษฎี)", "07-044-251", "อ.นิฟาตีฮะ ปัตนวงศ์", "กลุ่ม 01 (ชั้นปี 2 บัญชี)", "teal"], ["TT-08", "LAB-1", "พุธ", 3, "10:20", "12:20", "07-044-251 การประยุกต์โปรแกรมตารางงานเพื่องานบัญชี (ปฏิบัติ)", "07-044-251", "อ.นิฟาตีฮะ ปัตนวงศ์", "กลุ่ม 01 (ชั้นปี 2 บัญชี)", "teal"], ["TT-09", "LAB-1", "พฤหัสบดี", 4, "08:20", "10:20", "07-064-268 ระบบสารสนเทศเพื่อการจัดการภาครัฐ (ทฤษฎี)", "07-064-268", "ผศ.ศิริลักษณ์ อินทสโร", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "purple"], ["TT-10", "LAB-1", "พฤหัสบดี", 4, "10:20", "12:20", "07-064-268 ระบบสารสนเทศเพื่อการจัดการภาครัฐ (ปฏิบัติ)", "07-064-268", "ผศ.ศิริลักษณ์ อินทสโร", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "purple"], ["TT-11", "LAB-1", "พฤหัสบดี", 4, "13:20", "15:20", "07-034-218 โปรแกรมสำเร็จรูปในสำนักงาน (ทฤษฎี)", "07-034-218", "อ.เจ๊ะอีลย๊าส โตะตาหยง", "กลุ่ม 02 (ชั้นปี 4 รปศ.)", "indigo"], ["TT-12", "LAB-1", "พฤหัสบดี", 4, "15:20", "17:20", "07-034-218 โปรแกรมสำเร็จรูปในสำนักงาน (ปฏิบัติ)", "07-034-218", "อ.เจ๊ะอีลย๊าส โตะตาหยง", "กลุ่ม 02 (ชั้นปี 4 รปศ.)", "indigo"], ["TT-13", "LAB-1", "ศุกร์", 5, "08:20", "10:20", "07-064-261 โปรแกรมสำเร็จรูปในงานอาชีพ (ทฤษฎี)", "07-064-261", "อ.พระรักษ์ อมรศักดิ์", "กลุ่ม 03 (ชั้นปี 1, 5, 3 รปศ.)", "blue"], ["TT-14", "LAB-1", "ศุกร์", 5, "10:20", "12:20", "07-064-261 โปรแกรมสำเร็จรูปในงานอาชีพ (ปฏิบัติ)", "07-064-261", "อ.พระรักษ์ อมรศักดิ์", "กลุ่ม 03 (ชั้นปี 1, 5, 3 รปศ.)", "blue"], ["TT-15", "LAB-1", "อาทิตย์", 0, "13:00", "16:00", "07-086-311 ระบบสารสนเทศเพื่อการจัดการภาครัฐและภาคเอกชน", "07-086-311", "ผศ.ดร.เกศแก้ว ประดิษฐ์", "กลุ่ม 01 (ชั้นปี 2)", "amber"], ["TT-16", "R-302", "จันทร์", 1, "13:20", "16:20", "07-014-212 การจัดการโลจิสติกส์และห่วงโซ่อุปทาน", "07-014-212", "ผศ.มัณฑนา กระโหมวงศ์", "กลุ่ม 01 (ชั้นปี 2, 1, 3 เกินเกณฑ์)", "orange"], ["TT-17", "R-302", "อังคาร", 2, "08:20", "11:20", "07-004-204 การจัดการเชิงกลยุทธ์", "07-004-204", "อาจารย์ ดร.กชพรพรรณ พงค์ทองเมือง", "กลุ่ม 01 (ชั้นปี 3 การจัดการ)", "rose"], ["TT-18", "R-302", "อังคาร", 2, "13:20", "15:20", "07-014-213 การเตรียมความพร้อมสหกิจศึกษาและฝึกประสบการณ์ วิชาชีพการจัดการ", "07-014-213", "อ.โซเฟีย สามะอาลี", "กลุ่ม 01 (ชั้นปี 4)", "emerald"], ["TT-19", "R-302", "พุธ", 3, "08:20", "10:20", "07-044-210 รายงานทางการเงินและการวิเคราะห์งบการเงิน (ทฤษฎี)", "07-044-210", "อ.เนตรวดี เพชรประดับ", "กลุ่ม 01 (ชั้นปี 4 บัญชี)", "indigo"], ["TT-20", "R-302", "พุธ", 3, "10:20", "12:20", "07-044-210 รายงานทางการเงินและการวิเคราะห์งบการเงิน (ปฏิบัติ)", "07-044-210", "อ.เนตรวดี เพชรประดับ", "กลุ่ม 01 (ชั้นปี 4 บัญชี)", "indigo"], ["TT-21", "R-302", "พฤหัสบดี", 4, "08:20", "10:20", "07-014-232 การเป็นผู้ประกอบการ (ทฤษฎี)", "07-014-232", "อ.โซเฟีย สามะอาลี", "กลุ่ม 01 (ชั้นปี 3, 2 การจัดการ/บัญชี)", "teal"], ["TT-22", "R-302", "พฤหัสบดี", 4, "10:20", "12:20", "07-014-232 การเป็นผู้ประกอบการ (ปฏิบัติ)", "07-014-232", "อ.โซเฟีย สามะอาลี", "กลุ่ม 01 (ชั้นปี 3, 2 การจัดการ/บัญชี)", "teal"], ["TT-23", "R-302", "พฤหัสบดี", 4, "13:20", "16:20", "07-004-237 การจัดการทางการเงิน (หลักสูตรปรับปรุง 2568)", "07-004-237", "อ.เนตรวดี เพชรประดับ", "กลุ่ม 01 (ชั้นปี 2 บัญชี)", "blue"], ["TT-24", "R-302", "ศุกร์", 5, "08:20", "11:20", "07-004-237 การจัดการทางการเงิน (หลักสูตรปรับปรุง 2568)", "07-004-237", "อ.เนตรวดี เพชรประดับ", "กลุ่ม 02 (ชั้นปี 1 IT)", "blue"], ["TT-25", "R-303", "จันทร์", 1, "08:20", "10:20", "07-044-241 การบัญชีต้นทุน (ทฤษฎี)", "07-044-241", "อ.นันทพร โกสิยาภรณ์", "กลุ่ม 01 (ชั้นปี 2 บัญชี)", "cyan"], ["TT-26", "R-303", "จันทร์", 1, "10:20", "12:20", "07-044-241 การบัญชีต้นทุน (ปฏิบัติ)", "07-044-241", "อ.นันทพร โกสิยาภรณ์", "กลุ่ม 01 (ชั้นปี 2 บัญชี)", "cyan"], ["TT-27", "R-303", "อังคาร", 2, "08:20", "10:20", "07-024-212 กลยุทธ์การตลาดและการประยุกต์ศิลปะการรบ (ทฤษฎี)", "07-024-212", "อาจารย์ ดร.รุ่งศิริ ผดุงรัตน์", "กลุ่ม 01 (ชั้นปี 3 การตลาดดิจิทัล)", "pink"], ["TT-28", "R-303", "อังคาร", 2, "10:20", "12:20", "07-024-212 กลยุทธ์การตลาดและการประยุกต์ศิลปะการรบ (ปฏิบัติ)", "07-024-212", "อาจารย์ ดร.รุ่งศิริ ผดุงรัตน์", "กลุ่ม 01 (ชั้นปี 3 การตลาดดิจิทัล)", "pink"], ["TT-29", "R-303", "อังคาร", 2, "13:20", "15:20", "07-044-225 การเตรียมความพร้อมสหกิจศึกษาและการฝึกประสบการณ์วิชาชีพบัญชี", "07-044-225", "อ.นันทพร โกสิยาภรณ์", "กลุ่ม 01 (ชั้นปี 4 บัญชี)", "emerald"], ["TT-30", "R-303", "พุธ", 3, "08:20", "10:20", "07-014-237 การจัดการธุรกิจชุมชน (ทฤษฎี)", "07-014-237", "อาจารย์ ดร.กฤษณา พรหมชาติ", "กลุ่ม 01 (ชั้นปี 4 การจัดการ)", "amber"], ["TT-31", "R-303", "พุธ", 3, "10:20", "12:20", "07-014-237 การจัดการธุรกิจชุมชน (ปฏิบัติ)", "07-014-237", "อาจารย์ ดร.กฤษณา พรหมชาติ", "กลุ่ม 01 (ชั้นปี 4 การจัดการ)", "amber"], ["TT-32", "R-303", "พฤหัสบดี", 4, "08:20", "11:20", "07-004-205 หลักการตลาด", "07-004-205", "อาจารย์ ดร.สุมาลี กรดกางกั้น", "กลุ่ม 01 (ชั้นปี 1, 4)", "orange"], ["TT-33", "R-303", "พฤหัสบดี", 4, "13:20", "15:20", "07-044-226 สัมมนาการบัญชีการเงิน (ทฤษฎี)", "07-044-226", "อ.ทิพวรรณ รัตนพรหม", "กลุ่ม 01 (ชั้นปี 4 บัญชี)", "blue"], ["TT-34", "R-303", "พฤหัสบดี", 4, "15:20", "17:20", "07-044-226 สัมมนาการบัญชีการเงิน (ปฏิบัติ)", "07-044-226", "อ.ทิพวรรณ รัตนพรหม", "กลุ่ม 01 (ชั้นปี 4 บัญชี)", "blue"], ["TT-35", "R-303", "ศุกร์", 5, "08:20", "11:20", "07-004-214 กฎหมายธุรกิจ", "07-004-214", "อ.ศรัณ เนื้อน้อย", "กลุ่ม 01 (ชั้นปี 2 การจัดการ)", "red"], ["TT-36", "R-305", "จันทร์", 1, "08:20", "10:20", "07-054-101 ธุรกิจและการเป็นผู้ประกอบการ (ทฤษฎี)", "07-054-101", "อ.มธุรส ทอ. , อ.วีรศักดิ์ โศ.", "กลุ่ม 01 (ชั้นปี 1 ไฟฟ้า/IT)", "cyan"], ["TT-37", "R-305", "จันทร์", 1, "10:20", "12:20", "07-054-101 ธุรกิจและการเป็นผู้ประกอบการ (ปฏิบัติ)", "07-054-101", "อ.มธุรส ทอ. , อ.วีรศักดิ์ โศ.", "กลุ่ม 01 (ชั้นปี 1 ไฟฟ้า/IT)", "cyan"], ["TT-38", "R-305", "อังคาร", 2, "08:20", "10:20", "07-014-216 การสัมมนาการจัดการ (ทฤษฎี)", "07-014-216", "อ.รอยฮาน สะอารี", "กลุ่ม 01 (ชั้นปี 4)", "rose"], ["TT-39", "R-305", "อังคาร", 2, "10:20", "12:20", "07-014-216 การสัมมนาการจัดการ (ปฏิบัติ)", "07-014-216", "อ.รอยฮาน สะอารี", "กลุ่ม 01 (ชั้นปี 4)", "rose"], ["TT-40", "R-305", "อังคาร", 2, "13:20", "16:20", "07-004-210 การภาษีอากร", "07-004-210", "อ.นิฟาตีฮะ ปัตนวงศ์", "กลุ่ม 01 (ชั้นปี 3 การจัดการ)", "teal"], ["TT-41", "R-305", "พุธ", 3, "08:20", "10:20", "07-004-223 หลักการจัดการธุรกิจและการเขียนแผนธุรกิจ (ทฤษฎี)", "07-004-223", "อ.รอยฮาน สะอารี", "กลุ่ม 01 (ชั้นปี 3, 2)", "amber"], ["TT-42", "R-305", "พุธ", 3, "10:20", "12:20", "07-004-223 หลักการจัดการธุรกิจและการเขียนแผนธุรกิจ (ปฏิบัติ)", "07-004-223", "อ.รอยฮาน สะอารี", "กลุ่ม 01 (ชั้นปี 3, 2)", "amber"], ["TT-43", "R-305", "พฤหัสบดี", 4, "08:20", "11:20", "07-004-204 การจัดการเชิงกลยุทธ์ (สาขาวิชาการบัญชี)", "07-004-204", "ผศ.ดร.บงกช กมลเปรม", "กลุ่ม 01 (ชั้นปี 4, 2)", "indigo"], ["TT-44", "R-305", "ศุกร์", 5, "08:20", "11:20", "07-014-215 การจัดการธุรกิจระหว่างประเทศ", "07-014-215", "อ.วีรศักดิ์ โศจิพันธุ์", "กลุ่ม 01 (ชั้นปี 3, 1)", "purple"], ["TT-45", "R-306", "จันทร์", 1, "08:20", "10:20", "07-004-209 หลักการบัญชี (ทฤษฎี)", "07-004-209", "อ.ทิพวรรณ รัตนพรหม", "กลุ่ม 01 (ชั้นปี 2, 1, 4)", "blue"], ["TT-46", "R-306", "จันทร์", 1, "10:20", "12:20", "07-004-209 หลักการบัญชี (ปฏิบัติ)", "07-004-209", "อ.ทิพวรรณ รัตนพรหม", "กลุ่ม 01 (ชั้นปี 2, 1, 4)", "blue"], ["TT-47", "R-306", "อังคาร", 2, "13:20", "15:20", "07-034-252 การเตรียมความพร้อมสหกิจศึกษาและฝึกประสบการณ์วิชาชีพ", "07-034-252", "อ.ผการัตน์ ทองจันทร์", "กลุ่ม 01 (ชั้นปี 4 IT)", "emerald"], ["TT-48", "R-306", "พุธ", 3, "08:20", "11:20", "07-014-244 พฤติกรรมองค์การและภาวะผู้นำ", "07-014-244", "อาจารย์ ดร.สรัญณี อุเส็นยาง", "กลุ่ม 01 (ชั้นปี 2, 5, 4)", "orange"], ["TT-49", "R-306", "พฤหัสบดี", 4, "08:20", "11:20", "07-014-258 การบริหารความเสี่ยงและการเปลี่ยนแปลง", "07-014-258", "อาจารย์ ดร.อัฟซา อาแว", "กลุ่ม 01 (ชั้นปี 4)", "purple"], ["TT-50", "R-306", "ศุกร์", 5, "08:20", "10:20", "07-014-256 นวัตกรรมและการตลาดเชิงสร้างสรรค์ (ทฤษฎี)", "07-014-256", "อาจารย์ ดร.สรัญณี อุเส็นยาง", "กลุ่ม 01 (ชั้นปี 4)", "teal"], ["TT-51", "R-306", "ศุกร์", 5, "10:20", "12:20", "07-014-256 นวัตกรรมและการตลาดเชิงสร้างสรรค์ (ปฏิบัติ)", "07-014-256", "อาจารย์ ดร.สรัญณี อุเส็นยาง", "กลุ่ม 01 (ชั้นปี 4)", "teal"], ["TT-52", "R-306", "ศุกร์", 5, "13:20", "15:20", "07-004-221 สถิติธุรกิจ (ทฤษฎี)", "07-004-221", "อาจารย์ ดร.อัฟซา อา. , อ.วีรศักดิ์ โศ.", "กลุ่ม 01 (ชั้นปี 3)", "indigo"], ["TT-53", "R-306", "ศุกร์", 5, "15:20", "17:20", "07-004-221 สถิติธุรกิจ (ปฏิบัติ)", "07-004-221", "อาจารย์ ดร.อัฟซา อา. , อ.วีรศักดิ์ โศ.", "กลุ่ม 01 (ชั้นปี 3)", "indigo"], ["TT-54", "R-307", "จันทร์", 1, "08:20", "10:20", "07-024-214 ผู้ประกอบการพาณิชย์อิเล็กทรอนิกส์ (ทฤษฎี)", "07-024-214", "อ.ชลกาญจน์ สถะบดี", "กลุ่ม 01 (ชั้นปี 3)", "orange"], ["TT-55", "R-307", "จันทร์", 1, "10:20", "12:20", "07-024-214 ผู้ประกอบการพาณิชย์อิเล็กทรอนิกส์ (ปฏิบัติ)", "07-024-214", "อ.ชลกาญจน์ สถะบดี", "กลุ่ม 01 (ชั้นปี 3)", "orange"], ["TT-56", "R-307", "อังคาร", 2, "08:20", "11:20", "07-044-229 ภาวะผู้นำและจริยธรรมวิชาชีพบัญชี", "07-044-229", "อาจารย์ ดร.พูนพิศ ธิ. , อาจารย์ ดร.สรัญณี อุ.", "กลุ่ม 01 (ชั้นปี 4 บัญชี)", "blue"], ["TT-57", "R-307", "อังคาร", 2, "13:20", "15:20", "07-024-217 การเตรียมความพร้อมสหกิจศึกษาและฝึกประสบการณ์วิชาชีพ", "07-024-217", "อาจารย์ ดร.รุ่งศิริ ผดุงรัตน์", "กลุ่ม 01 (ชั้นปี 4)", "emerald"], ["TT-58", "R-307", "พุธ", 3, "08:20", "11:20", "07-004-201 องค์การและการจัดการ (สาขาวิชาการบัญชี)", "07-004-201", "ผศ.มัณฑนา กร. , ผศ.ดร.ธมยันตี ปร.", "กลุ่ม 02 (ชั้นปี 1 บัญชี)", "cyan"], ["TT-59", "R-307", "พฤหัสบดี", 4, "08:20", "10:20", "07-024-233 การนำเสนอและโน้มน้าวทางธุรกิจ (ทฤษฎี)", "07-024-233", "อ.ชลกาญจน์ สถะบดี", "กลุ่ม 01 (ชั้นปี 4)", "pink"], ["TT-60", "R-307", "พฤหัสบดี", 4, "10:20", "12:20", "07-024-233 การนำเสนอและโน้มน้าวทางธุรกิจ (ปฏิบัติ)", "07-024-233", "อ.ชลกาญจน์ สถะบดี", "กลุ่ม 01 (ชั้นปี 4)", "pink"], ["TT-61", "R-308", "จันทร์", 1, "08:20", "11:20", "07-064-243 เทคนิคการบริหาร", "07-064-243", "อ.คมสัน หลงละเลิง", "กลุ่ม 01 (ชั้นปี 4 รปศ.)", "indigo"], ["TT-62", "R-308", "จันทร์", 1, "13:20", "15:20", "07-064-273 นวัตกรรมการจัดการท้องถิ่น (ทฤษฎี)", "07-064-273", "อาจารย์ ดร.พรทิพย์ มานพคำ", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "teal"], ["TT-63", "R-308", "จันทร์", 1, "15:20", "17:20", "07-064-273 นวัตกรรมการจัดการท้องถิ่น (ปฏิบัติ)", "07-064-273", "อาจารย์ ดร.พรทิพย์ มานพคำ", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "teal"], ["TT-64", "R-308", "อังคาร", 2, "08:20", "11:20", "07-064-260 หลักรัฐศาสตร์", "07-064-260", "ผศ.พัชนี ตูเล๊ะ", "กลุ่ม 02 (ชั้นปี 1, 4 รปศ.)", "rose"], ["TT-65", "R-308", "พุธ", 3, "08:20", "10:20", "07-064-270 สถิติสำหรับนักบริหาร (ทฤษฎี)", "07-064-270", "อาจารย์ ดร.ชนาธิป หว. , อาจารย์ ดร.อัฟซา อา.", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "purple"], ["TT-66", "R-308", "พุธ", 3, "10:20", "12:20", "07-064-270 สถิติสำหรับนักบริหาร (ปฏิบัติ)", "07-064-270", "อาจารย์ ดร.ชนาธิป หว. , อาจารย์ ดร.อัฟซา อา.", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "purple"], ["TT-67", "R-308", "พฤหัสบดี", 4, "08:20", "11:20", "07-064-262 เศรษฐศาสตร์และการคลังสาธารณะสำหรับนักบริหาร", "07-064-262", "อาจารย์ ดร.ชนาธิป หวังวรวงศ์", "กลุ่ม 02 (ชั้นปี 1, 2, 3)", "amber"], ["TT-68", "R-308", "ศุกร์", 5, "08:20", "10:20", "07-044-237 การบัญชีชั้นกลาง 1 (ทฤษฎี)", "07-044-237", "อ.นิฟาตีฮะ ปัตนวงศ์", "กลุ่ม 01 (ชั้นปี 2 บัญชี)", "blue"], ["TT-69", "R-308", "ศุกร์", 5, "10:20", "12:20", "07-044-237 การบัญชีชั้นกลาง 1 (ปฏิบัติ)", "07-044-237", "อ.นิฟาตีฮะ ปัตนวงศ์", "กลุ่ม 01 (ชั้นปี 2 บัญชี)", "blue"], ["TT-70", "R-401", "จันทร์", 1, "08:20", "11:20", "07-064-209 กฎหมายปกครอง", "07-064-209", "อ.ศรัณ เนื้อน้อย", "กลุ่ม 01 (ชั้นปี 2 รปศ.)", "red"], ["TT-71", "R-401", "จันทร์", 1, "13:20", "16:20", "07-064-262 เศรษฐศาสตร์และการคลังสาธารณะสำหรับนักบริหาร", "07-064-262", "อาจารย์ ดร.ชนาธิป หวังวรวงศ์", "กลุ่ม 01 (ชั้นปี 1, 3 รปศ.)", "amber"], ["TT-72", "R-401", "อังคาร", 2, "08:20", "10:20", "07-054-101 ธุรกิจและการเป็นผู้ประกอบการ (ทฤษฎี)", "07-054-101", "อ.มธุรส ทอ. , อ.วีรศักดิ์ โศ.", "กลุ่ม 02 (ชั้นปี 2 ภาษาอังกฤษ/บริการ)", "cyan"], ["TT-73", "R-401", "อังคาร", 2, "10:20", "12:20", "07-054-101 ธุรกิจและการเป็นผู้ประกอบการ (ปฏิบัติ)", "07-054-101", "อ.มธุรส ทอ. , อ.วีรศักดิ์ โศ.", "กลุ่ม 02 (ชั้นปี 2 ภาษาอังกฤษ/บริการ)", "cyan"], ["TT-74", "R-401", "อังคาร", 2, "13:20", "15:20", "07-064-227 การเตรียมความพร้อมสหกิจศึกษาและฝึกประสบการณ์ วิชาชีพรัฐประศาสนศาสตร์", "07-064-227", "อาจารย์ ดร.พรทิพย์ มานพคำ", "กลุ่ม 01 (ชั้นปี 4 รปศ.)", "emerald"], ["TT-75", "R-401", "พฤหัสบดี", 4, "08:20", "11:20", "07-064-260 หลักรัฐศาสตร์", "07-064-260", "ผศ.พัชนี ตูเล๊ะ", "กลุ่ม 01 (ชั้นปี 1, 4, 2 รปศ.)", "rose"], ["TT-76", "R-401", "พฤหัสบดี", 4, "13:20", "15:20", "07-064-278 นวัตกรรมการจัดการภาครัฐและภาคเอกชน (ทฤษฎี)", "07-064-278", "อาจารย์ ดร.อิบรอฮิม สา. , อ.บารมี หลังยาหน่าย", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "teal"], ["TT-77", "R-401", "พฤหัสบดี", 4, "15:20", "17:20", "07-064-278 นวัตกรรมการจัดการภาครัฐและภาคเอกชน (ปฏิบัติ)", "07-064-278", "อาจารย์ ดร.อิบรอฮิม สา. , อ.บารมี หลังยาหน่าย", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "teal"], ["TT-78", "R-401", "ศุกร์", 5, "08:20", "11:20", "07-004-201 องค์การและการจัดการ", "07-004-201", "ผศ.มัณฑนา กระโหมวงศ์", "กลุ่ม 01 (ชั้นปี 1 การจัดการ)", "blue"], ["TT-79", "R-401", "ศุกร์", 5, "13:20", "16:20", "07-064-231 กฎหมายอาญา 2", "07-064-231", "ผศ.สัญญา วัชราทักษิณ", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "red"], ["TT-80", "R-402", "จันทร์", 1, "08:20", "11:20", "07-064-233 กฎหมายลักษณะพยาน", "07-064-233", "ผศ.สัญญา วัชราทักษิณ", "กลุ่ม 01 (ชั้นปี 4 รปศ.)", "purple"], ["TT-81", "R-402", "จันทร์", 1, "13:20", "15:20", "07-064-281 นวัตกรรมกับการเป็นผู้ประกอบการ (ทฤษฎี)", "07-064-281", "อาจารย์ ดร.อิบรอฮิม สารีมาแซ", "กลุ่ม 01 (ชั้นปี 4 รปศ.)", "emerald"], ["TT-82", "R-402", "จันทร์", 1, "15:20", "17:20", "07-064-281 นวัตกรรมกับการเป็นผู้ประกอบการ (ปฏิบัติ)", "07-064-281", "อาจารย์ ดร.อิบรอฮิม สารีมาแซ", "กลุ่ม 01 (ชั้นปี 4 รปศ.)", "emerald"], ["TT-83", "R-402", "อังคาร", 2, "08:20", "11:20", "07-004-235 เศรษฐศาสตร์ยุคดิจิทัล", "07-004-235", "อ.โซเฟีย สามะอาลี", "กลุ่ม 01 (ชั้นปี 1, 5 IT/บัญชี)", "cyan"], ["TT-84", "R-402", "อังคาร", 2, "13:20", "16:20", "07-004-231 การเงินธุรกิจยุคดิจิทัล / การเงินธุรกิจ", "07-004-231", "อ.เนตรวดี เพชรประดับ", "กลุ่ม 01 (ชั้นปี 2, 3 การตลาด/IT)", "blue"], ["TT-85", "R-402", "พุธ", 3, "08:20", "11:20", "07-024-202 การจัดการการตั้งราคาและงบประมาณ", "07-024-202", "อาจารย์ ดร.สุมาลี กรดกางกั้น", "กลุ่ม 01 (ชั้นปี 2 การตลาดดิจิทัล)", "orange"], ["TT-86", "R-402", "พฤหัสบดี", 4, "08:20", "10:20", "07-044-235 หลักการบัญชี 1 (ทฤษฎี)", "07-044-235", "อาจารย์ ดร.พูนพิศ ธิตินันทน์", "กลุ่ม 01 (ชั้นปี 1 บัญชี)", "teal"], ["TT-87", "R-402", "พฤหัสบดี", 4, "10:20", "12:20", "07-044-235 หลักการบัญชี 1 (ปฏิบัติ)", "07-044-235", "อาจารย์ ดร.พูนพิศ ธิตินันทน์", "กลุ่ม 01 (ชั้นปี 1 บัญชี)", "teal"], ["TT-88", "R-402", "ศุกร์", 5, "08:20", "11:20", "07-024-210 การตลาดระหว่างประเทศ", "07-024-210", "อาจารย์ ดร.รุ่งศิริ ผดุงรัตน์", "กลุ่ม 01 (ชั้นปี 4 การตลาดดิจิทัล)", "pink"], ["TT-89", "R-402", "อาทิตย์", 0, "08:00", "10:00", "07-064-276 การจัดการเศรษฐกิจท้องถิ่น (ทฤษฎี)", "07-064-276", "อ.บารมี หลังยาหน่าย", "กลุ่ม 01-s (ชั้นปี 4 รปศ.)", "amber"], ["TT-90", "R-402", "อาทิตย์", 0, "10:00", "12:00", "07-064-276 การจัดการเศรษฐกิจท้องถิ่น (ปฏิบัติ)", "07-064-276", "อ.บารมี หลังยาหน่าย", "กลุ่ม 01-s (ชั้นปี 4 รปศ.)", "amber"], ["TT-91", "R-402", "อาทิตย์", 0, "13:00", "16:00", "07-064-243 เทคนิคการบริหาร", "07-064-243", "อ.คมสัน หลงละเลิง", "กลุ่ม 01-s (ชั้นปี 4 รปศ.)", "indigo"], ["TT-92", "R-402", "อาทิตย์", 0, "16:00", "18:00", "07-064-277 สัมมนานวัตกรรมการจัดการท้องถิ่น (ทฤษฎี)", "07-064-277", "อ.เปาซี วานอง", "กลุ่ม 01-s (ชั้นปี 4)", "rose"], ["TT-93", "R-402", "อาทิตย์", 0, "18:00", "20:00", "07-064-277 สัมมนานวัตกรรมการจัดการท้องถิ่น (ปฏิบัติ)", "07-064-277", "อ.เปาซี วานอง", "กลุ่ม 01-s (ชั้นปี 4)", "rose"], ["TT-94", "R-403", "จันทร์", 1, "13:20", "15:20", "07-064-276 การจัดการเศรษฐกิจท้องถิ่น (ทฤษฎี)", "07-064-276", "อ.บารมี หลังยาหน่าย", "กลุ่ม 01 (ชั้นปี 4 รปศ.)", "amber"], ["TT-95", "R-403", "จันทร์", 1, "15:20", "17:20", "07-064-276 การจัดการเศรษฐกิจท้องถิ่น (ปฏิบัติ)", "07-064-276", "อ.บารมี หลังยาหน่าย", "กลุ่ม 01 (ชั้นปี 4 รปศ.)", "amber"], ["TT-96", "R-403", "อังคาร", 2, "08:20", "11:20", "07-064-264 การจัดการทรัพยากรมนุษย์เชิงกลยุทธ์", "07-064-264", "อาจารย์ ดร.พรทิพย์ มานพคำ", "กลุ่ม 02 (ชั้นปี 2 รปศ.)", "purple"], ["TT-97", "R-403", "พุธ", 3, "08:20", "10:20", "07-064-265 ธรรมาภิบาลและจิตสาธารณะเพื่อการพัฒนา (ทฤษฎี)", "07-064-265", "อ.บูชิตา อารียาภรณ์", "กลุ่ม 01 (ชั้นปี 2 รปศ.)", "teal"], ["TT-98", "R-403", "พุธ", 3, "10:20", "12:20", "07-064-265 ธรรมาภิบาลและจิตสาธารณะเพื่อการพัฒนา (ปฏิบัติ)", "07-064-265", "อ.บูชิตา อารียาภรณ์", "กลุ่ม 01 (ชั้นปี 2 รปศ.)", "teal"], ["TT-99", "R-403", "พฤหัสบดี", 4, "08:20", "10:20", "07-024-207 สื่อสร้างสรรค์ดิจิทัล (ทฤษฎี)", "07-024-207", "อ.มธุรส ทองอินทราช", "กลุ่ม 01 (ชั้นปี 2 บัญชี)", "cyan"], ["TT-100", "R-403", "พฤหัสบดี", 4, "10:20", "12:20", "07-024-207 สื่อสร้างสรรค์ดิจิทัล (ปฏิบัติ)", "07-024-207", "อ.มธุรส ทองอินทราช", "กลุ่ม 01 (ชั้นปี 2 บัญชี)", "cyan"], ["TT-101", "R-403", "พฤหัสบดี", 4, "13:20", "15:20", "07-004-242 กลยุทธ์การตลาดเชิงปฏิบัติ (ทฤษฎี)", "07-004-242", "อ.มธุรส ทองอินทราช", "กลุ่ม 01 (ชั้นปี 1 IT)", "orange"], ["TT-102", "R-403", "พฤหัสบดี", 4, "15:20", "17:20", "07-004-242 กลยุทธ์การตลาดเชิงปฏิบัติ (ปฏิบัติ)", "07-004-242", "อ.มธุรส ทองอินทราช", "กลุ่ม 01 (ชั้นปี 1 IT)", "orange"], ["TT-103", "R-403", "ศุกร์", 5, "08:20", "11:20", "07-004-228 หลักการตลาดยุคดิจิทัล", "07-004-228", "อ.มธุรส ทองอินทราช", "กลุ่ม 01 (ชั้นปี 1 บัญชี)", "blue"], ["TT-104", "R-404", "จันทร์", 1, "08:20", "10:20", "07-024-208 การสร้างตราสินค้ายุคเศรษฐกิจดิจิทัล (ทฤษฎี)", "07-024-208", "อาจารย์ ดร.รุ่งศิริ ผดุงรัตน์", "กลุ่ม 01 (ชั้นปี 2 การตลาดดิจิทัล)", "pink"], ["TT-105", "R-404", "จันทร์", 1, "10:20", "12:20", "07-024-208 การสร้างตราสินค้ายุคเศรษฐกิจดิจิทัล (ปฏิบัติ)", "07-024-208", "อาจารย์ ดร.รุ่งศิริ ผดุงรัตน์", "กลุ่ม 01 (ชั้นปี 2 การตลาดดิจิทัล)", "pink"], ["TT-106", "R-404", "อังคาร", 2, "08:20", "11:20", "07-064-208 องค์การและการจัดการสมัยใหม่", "07-064-208", "อ.เปาซี วา. , อ.คมสัน หล.", "กลุ่ม 01 (ชั้นปี 2 รปศ.)", "indigo"], ["TT-107", "R-404", "อังคาร", 2, "13:20", "15:20", "07-064-269 การบริหารและประเมินผลโครงการ (ทฤษฎี)", "07-064-269", "ผศ.พัชนี ตู. , อาจารย์ ดร.อิบรอฮิม สา.", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "emerald"], ["TT-108", "R-404", "อังคาร", 2, "15:20", "17:20", "07-064-269 การบริหารและประเมินผลโครงการ (ปฏิบัติ)", "07-064-269", "ผศ.พัชนี ตู. , อาจารย์ ดร.อิบรอฮิม สา.", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "emerald"], ["TT-109", "R-404", "พุธ", 3, "08:20", "10:20", "07-064-277 สัมมนานวัตกรรมการจัดการท้องถิ่น (ทฤษฎี)", "07-064-277", "อ.เปาซี วานอง", "กลุ่ม 01 (ชั้นปี 4 รปศ.)", "rose"], ["TT-110", "R-404", "พุธ", 3, "10:20", "12:20", "07-064-277 สัมมนานวัตกรรมการจัดการท้องถิ่น (ปฏิบัติ)", "07-064-277", "อ.เปาซี วานอง", "กลุ่ม 01 (ชั้นปี 4 รปศ.)", "rose"], ["TT-111", "R-404", "พฤหัสบดี", 4, "08:20", "11:20", "07-014-248 การจัดการการค้าชายแดน", "07-014-248", "อ.รอยฮาน สะอารี", "กลุ่ม 01 (ชั้นปี 2 บัญชี)", "amber"], ["TT-112", "R-404", "ศุกร์", 5, "08:20", "10:20", "07-064-269 การบริหารและประเมินผลโครงการ (ทฤษฎี)", "07-064-269", "ผศ.พัชนี ตู. , อาจารย์ ดร.อิบรอฮิม สา.", "กลุ่ม 02 (ชั้นปี 3 รปศ.)", "emerald"], ["TT-113", "R-404", "ศุกร์", 5, "10:20", "12:20", "07-064-269 การบริหารและประเมินผลโครงการ (ปฏิบัติ)", "07-064-269", "ผศ.พัชนี ตู. , อาจารย์ ดร.อิบรอฮิม สา.", "กลุ่ม 02 (ชั้นปี 3 รปศ.)", "emerald"], ["TT-114", "R-405", "จันทร์", 1, "13:20", "16:20", "07-024-234 การส่งเสริมการตลาดและการบริหารสื่อใหม่", "07-024-234", "อาจารย์ ดร.กชพรพรรณ พงค์ทองเมือง", "กลุ่ม 01 (ชั้นปี 4 การตลาด/การจัดการ)", "orange"], ["TT-115", "R-405", "อังคาร", 2, "08:20", "10:20", "07-044-230 การบัญชีเพื่อการจัดการธุรกิจชุมชน (ทฤษฎี)", "07-044-230", "อ.นันทพร โกสิยาภรณ์", "กลุ่ม 01 (ชั้นปี 3, 4 บัญชี)", "blue"], ["TT-116", "R-405", "อังคาร", 2, "10:20", "12:20", "07-044-230 การบัญชีเพื่อการจัดการธุรกิจชุมชน (ปฏิบัติ)", "07-044-230", "อ.นันทพร โกสิยาภรณ์", "กลุ่ม 01 (ชั้นปี 3, 4 บัญชี)", "blue"], ["TT-117", "R-405", "พุธ", 3, "08:20", "10:20", "07-044-231 การบริหารความเสี่ยงและการควบคุมภายใน (ทฤษฎี)", "07-044-231", "อ.ทิพวรรณ รัตนพรหม", "กลุ่ม 01 (ชั้นปี 3 บัญชี)", "teal"], ["TT-118", "R-405", "พุธ", 3, "10:20", "12:20", "07-044-231 การบริหารความเสี่ยงและการควบคุมภายใน (ปฏิบัติ)", "07-044-231", "อ.ทิพวรรณ รัตนพรหม", "กลุ่ม 01 (ชั้นปี 3 บัญชี)", "teal"], ["TT-119", "R-405", "พฤหัสบดี", 4, "08:20", "10:20", "07-064-282 สัมมนานวัตกรรมการจัดการภาครัฐและภาคเอกชน (ทฤษฎี)", "07-064-282", "อ.เปาซี วานอง", "กลุ่ม 01 (ชั้นปี 4 รปศ.)", "purple"], ["TT-120", "R-405", "พฤหัสบดี", 4, "10:20", "12:20", "07-064-282 สัมมนานวัตกรรมการจัดการภาครัฐและภาคเอกชน (ปฏิบัติ)", "07-064-282", "อ.เปาซี วานอง", "กลุ่ม 01 (ชั้นปี 4 รปศ.)", "purple"], ["TT-121", "R-405", "พฤหัสบดี", 4, "13:20", "15:20", "07-064-265 ธรรมาภิบาลและจิตสาธารณะเพื่อการพัฒนา (ทฤษฎี)", "07-064-265", "อ.บูชิตา อารียาภรณ์", "กลุ่ม 02 (ชั้นปี 2 รปศ.)", "emerald"], ["TT-122", "R-405", "พฤหัสบดี", 4, "15:20", "17:20", "07-064-265 ธรรมาภิบาลและจิตสาธารณะเพื่อการพัฒนา (ปฏิบัติ)", "07-064-265", "อ.บูชิตา อารียาภรณ์", "กลุ่ม 02 (ชั้นปี 2 รปศ.)", "emerald"], ["TT-123", "R-405", "ศุกร์", 5, "08:20", "11:20", "07-064-264 การจัดการทรัพยากรมนุษย์เชิงกลยุทธ์", "07-064-264", "อาจารย์ ดร.พรทิพย์ มานพคำ", "กลุ่ม 01 (ชั้นปี 2 รปศ.)", "rose"], ["TT-124", "R-405", "ศุกร์", 5, "13:20", "15:20", "07-024-206 การออกแบบเนื้อหาบนตลาดดิจิทัล (ทฤษฎี)", "07-024-206", "อ.ชลกาญจน์ สถ. , อ.มธุรส ทอ.", "กลุ่ม 01 (ชั้นปี 2, 4)", "cyan"], ["TT-125", "R-405", "ศุกร์", 5, "15:20", "17:20", "07-024-206 การออกแบบเนื้อหาบนตลาดดิจิทัล (ปฏิบัติ)", "07-024-206", "อ.ชลกาญจน์ สถ. , อ.มธุรส ทอ.", "กลุ่ม 01 (ชั้นปี 2, 4)", "cyan"], ["TT-126", "R-406", "จันทร์", 1, "08:20", "11:20", "07-044-218 การบัญชีเฉพาะกิจการ", "07-044-218", "อ.นิฟาตีฮะ ปัตนวงศ์", "กลุ่ม 01 (ชั้นปี 4 บัญชี)", "blue"], ["TT-127", "R-406", "อังคาร", 2, "08:20", "10:20", "07-024-209 เครื่องมือและแอปพลิเคชันสำหรับผู้ประกอบการ (ทฤษฎี)", "07-024-209", "อ.ชลกาญจน์ สถะบดี", "กลุ่ม 01 (ชั้นปี 4 การตลาดดิจิทัล)", "indigo"], ["TT-128", "R-406", "อังคาร", 2, "10:20", "12:20", "07-024-209 เครื่องมือและแอปพลิเคชันสำหรับผู้ประกอบการ (ปฏิบัติ)", "07-024-209", "อ.ชลกาญจน์ สถะบดี", "กลุ่ม 01 (ชั้นปี 4 การตลาดดิจิทัล)", "indigo"], ["TT-129", "R-406", "อังคาร", 2, "13:20", "16:20", "07-064-208 องค์การและการจัดการสมัยใหม่", "07-064-208", "อ.เปาซี วา. , อ.คมสัน หล.", "กลุ่ม 02 (ชั้นปี 2 รปศ.)", "purple"], ["TT-130", "R-406", "พุธ", 3, "08:20", "10:20", "07-024-213 แผนธุรกิจ (ทฤษฎี)", "07-024-213", "อ.มธุรส ทอ. , อาจารย์ ดร.กชพรพรรณ พง.", "กลุ่ม 01 (ชั้นปี 3, 4)", "amber"], ["TT-131", "R-406", "พุธ", 3, "10:20", "12:20", "07-024-213 แผนธุรกิจ (ปฏิบัติ)", "07-024-213", "อ.มธุรส ทอ. , อาจารย์ ดร.กชพรพรรณ พง.", "กลุ่ม 01 (ชั้นปี 3, 4)", "amber"], ["TT-132", "R-406", "พฤหัสบดี", 4, "13:20", "16:20", "07-004-233 กฎหมายธุรกิจและกฎหมายอิเล็กทรอนิกส์", "07-004-233", "อ.ศรัณ เนื้อน้อย", "กลุ่ม 01 (ชั้นปี 3 การตลาด)", "red"], ["TT-133", "R-406", "ศุกร์", 5, "08:20", "11:20", "07-044-204 การบัญชีชั้นสูง 1", "07-044-204", "อ.ไฮดา สุดินปรีดา", "กลุ่ม 01 (ชั้นปี 3, 4 บัญชี)", "teal"], ["TT-134", "LAB-4", "จันทร์", 1, "08:20", "10:20", "07-014-245 สถิติเพื่อการวิจัย (ทฤษฎี)", "07-014-245", "อาจารย์ ดร.กฤษณา พรหมชาติ", "กลุ่ม 01 (ชั้นปี 3 การจัดการ)", "teal"], ["TT-135", "LAB-4", "จันทร์", 1, "10:20", "12:20", "07-014-245 สถิติเพื่อการวิจัย (ปฏิบัติ)", "07-014-245", "อาจารย์ ดร.กฤษณา พรหมชาติ", "กลุ่ม 01 (ชั้นปี 3 การจัดการ)", "teal"], ["TT-136", "LAB-4", "จันทร์", 1, "13:20", "15:20", "07-034-245 การออกแบบมัลติมีเดียสำหรับงานธุรกิจ (ทฤษฎี)", "07-034-245", "อ.ผการัตน์ ทองจันทร์", "กลุ่ม 01 (ชั้นปี 2 IT)", "orange"], ["TT-137", "LAB-4", "จันทร์", 1, "15:20", "17:20", "07-034-245 การออกแบบมัลติมีเดียสำหรับงานธุรกิจ (ปฏิบัติ)", "07-034-245", "อ.ผการัตน์ ทองจันทร์", "กลุ่ม 01 (ชั้นปี 2 IT)", "orange"], ["TT-138", "LAB-4", "อังคาร", 2, "08:20", "10:20", "07-034-205 หลักการเขียนโปรแกรมคอมพิวเตอร์ (ทฤษฎี)", "07-034-205", "อาจารย์ ดร.สุรเชษฐ์ สังขพันธ์", "กลุ่ม 01 (ชั้นปี 2 IT)", "blue"], ["TT-139", "LAB-4", "อังคาร", 2, "10:20", "12:20", "07-034-205 หลักการเขียนโปรแกรมคอมพิวเตอร์ (ปฏิบัติ)", "07-034-205", "อาจารย์ ดร.สุรเชษฐ์ สังขพันธ์", "กลุ่ม 01 (ชั้นปี 2 IT)", "blue"], ["TT-140", "LAB-4", "ศุกร์", 5, "08:20", "10:20", "07-034-244 การวิเคราะห์และออกแบบระบบธุรกิจดิจิทัล (ทฤษฎี)", "07-034-244", "ผศ.ศิริลักษณ์ อินทสโร", "กลุ่ม 01 (ชั้นปี 2 IT)", "purple"], ["TT-141", "LAB-4", "ศุกร์", 5, "10:20", "12:20", "07-034-244 การวิเคราะห์และออกแบบระบบธุรกิจดิจิทัล (ปฏิบัติ)", "07-034-244", "ผศ.ศิริลักษณ์ อินทสโร", "กลุ่ม 01 (ชั้นปี 2 IT)", "purple"], ["TT-142", "LAB-4", "ศุกร์", 5, "13:20", "15:20", "07-034-257 โปรแกรมประยุกต์บนคลาวด์ (ทฤษฎี)", "07-034-257", "ผศ.ศิริลักษณ์ อินทสโร", "กลุ่ม 01 (ชั้นปี 4 IT)", "indigo"], ["TT-143", "LAB-4", "ศุกร์", 5, "15:20", "17:20", "07-034-257 โปรแกรมประยุกต์บนคลาวด์ (ปฏิบัติ)", "07-034-257", "ผศ.ศิริลักษณ์ อินทสโร", "กลุ่ม 01 (ชั้นปี 4 IT)", "indigo"], ["TT-144", "LAB-3", "จันทร์", 1, "08:20", "10:20", "07-014-214 ระบบสารสนเทศเพื่อการจัดการ (ทฤษฎี)", "07-014-214", "ผศ.ดร.เกศแก้ว ประดิษฐ์", "กลุ่ม 01 (ชั้นปี 4 การจัดการ)", "purple"], ["TT-145", "LAB-3", "จันทร์", 1, "10:20", "12:20", "07-014-214 ระบบสารสนเทศเพื่อการจัดการ (ปฏิบัติ)", "07-014-214", "ผศ.ดร.เกศแก้ว ประดิษฐ์", "กลุ่ม 01 (ชั้นปี 4 การจัดการ)", "purple"], ["TT-146", "LAB-3", "จันทร์", 1, "13:20", "15:20", "07-034-260 อินเทอร์เน็ตผสานสรรพสิ่ง (ทฤษฎี)", "07-034-260", "อาจารย์ ดร.สุรเชษฐ์ สังขพันธ์", "กลุ่ม 01 (ชั้นปี 4 IT)", "emerald"], ["TT-147", "LAB-3", "จันทร์", 1, "15:20", "17:20", "07-034-260 อินเทอร์เน็ตผสานสรรพสิ่ง (ปฏิบัติ)", "07-034-260", "อาจารย์ ดร.สุรเชษฐ์ สังขพันธ์", "กลุ่ม 01 (ชั้นปี 4 IT)", "emerald"], ["TT-148", "LAB-3", "อังคาร", 2, "08:20", "10:20", "07-004-234 เทคโนโลยีดิจิทัลเพื่อการจัดการธุรกิจ (ทฤษฎี)", "07-004-234", "ผศ.ดร.เกศแก้ว ประดิษฐ์", "กลุ่ม 01 (ชั้นปี 1 การจัดการ)", "blue"], ["TT-149", "LAB-3", "อังคาร", 2, "10:20", "12:20", "07-004-234 เทคโนโลยีดิจิทัลเพื่อการจัดการธุรกิจ (ปฏิบัติ)", "07-004-234", "ผศ.ดร.เกศแก้ว ประดิษฐ์", "กลุ่ม 01 (ชั้นปี 1 การจัดการ)", "blue"], ["TT-150", "LAB-3", "พุธ", 3, "08:20", "10:20", "07-034-266 การสร้างธุรกิจเริ่มต้นด้วยนวัตกรรมและเทคโนโลยี (ทฤษฎี)", "07-034-266", "อาจารย์ ดร.สุรเชษฐ์ สังขพันธ์", "กลุ่ม 01 (ชั้นปี 1 IT)", "orange"], ["TT-151", "LAB-3", "พุธ", 3, "10:20", "12:20", "07-034-266 การสร้างธุรกิจเริ่มต้นด้วยนวัตกรรมและเทคโนโลยี (ปฏิบัติ)", "07-034-266", "อาจารย์ ดร.สุรเชษฐ์ สังขพันธ์", "กลุ่ม 01 (ชั้นปี 1 IT)", "orange"], ["TT-152", "LAB-3", "พฤหัสบดี", 4, "08:20", "10:20", "07-034-275 การเขียนงานทางวิชาการด้านเทคโนโลยีดิจิทัล (ทฤษฎี)", "07-034-275", "ผศ.ดร.เกศแก้ว ประดิษฐ์", "กลุ่ม 01 (ชั้นปี 1 IT)", "teal"], ["TT-153", "LAB-3", "พฤหัสบดี", 4, "10:20", "12:20", "07-034-275 การเขียนงานทางวิชาการด้านเทคโนโลยีดิจิทัล (ปฏิบัติ)", "07-034-275", "ผศ.ดร.เกศแก้ว ประดิษฐ์", "กลุ่ม 01 (ชั้นปี 1 IT)", "teal"], ["TT-154", "LAB-3", "ศุกร์", 5, "08:20", "10:20", "07-034-261 การนำสนอข้อมูลด้วยระบบธุรกิจอัจฉริยะ (ทฤษฎี)", "07-034-261", "ผศ.ดร.เกศแก้ว ประดิษฐ์", "กลุ่ม 01 (ชั้นปี 2 ภาษาต่างประเทศ)", "indigo"], ["TT-155", "LAB-3", "ศุกร์", 5, "10:20", "12:20", "07-034-261 การนำสนอข้อมูลด้วยระบบธุรกิจอัจฉริยะ (ปฏิบัติ)", "07-034-261", "ผศ.ดร.เกศแก้ว ประดิษฐ์", "กลุ่ม 01 (ชั้นปี 2 ภาษาต่างประเทศ)", "indigo"], ["TT-156", "LAB-3", "ศุกร์", 5, "13:20", "15:20", "07-034-267 หลักการออกแบบสื่อมัลติมีเดียเชิงสร้างสรรค์ (ทฤษฎี)", "07-034-267", "อ.ผการัตน์ ทองจันทร์", "กลุ่ม 01 (ชั้นปี 1 IT)", "pink"], ["TT-157", "LAB-3", "ศุกร์", 5, "15:20", "17:20", "07-034-267 หลักการออกแบบสื่อมัลติมีเดียเชิงสร้างสรรค์ (ปฏิบัติ)", "07-034-267", "อ.ผการัตน์ ทองจันทร์", "กลุ่ม 01 (ชั้นปี 1 IT)", "pink"], ["TT-158", "LAB-2", "จันทร์", 1, "08:20", "10:20", "07-034-287 การประยุกต์ใช้ปัญญาประดิษฐ์ในงานมัลติมีเดีย (ทฤษฎี)", "07-034-287", "อ.ผการัตน์ ทอ. , อ.เจ๊ะอีลย๊าส โตะตาหยง", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "cyan"], ["TT-159", "LAB-2", "จันทร์", 1, "10:20", "12:20", "07-034-287 การประยุกต์ใช้ปัญญาประดิษฐ์ในงานมัลติมีเดีย (ปฏิบัติ)", "07-034-287", "อ.ผการัตน์ ทอ. , อ.เจ๊ะอีลย๊าส โตะตาหยง", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "cyan"], ["TT-160", "LAB-2", "จันทร์", 1, "13:20", "15:20", "07-044-217 โปรแกรมสำเร็จรูปเพื่องานบัญชี (ทฤษฎี)", "07-044-217", "อ.ไฮดา สุดินปรีดา", "กลุ่ม 01 (ชั้นปี 4 บัญชี)", "blue"], ["TT-161", "LAB-2", "จันทร์", 1, "15:20", "17:20", "07-044-217 โปรแกรมสำเร็จรูปเพื่องานบัญชี (ปฏิบัติ)", "07-044-217", "อ.ไฮดา สุดินปรีดา", "กลุ่ม 01 (ชั้นปี 4 บัญชี)", "blue"], ["TT-162", "LAB-2", "อังคาร", 2, "08:20", "10:20", "07-044-245 ระบบสารสนเทศทางการบัญชี (ทฤษฎี)", "07-044-245", "อ.ไฮดา สุดินปรีดา", "กลุ่ม 01 (ชั้นปี 2 บัญชี)", "teal"], ["TT-163", "LAB-2", "อังคาร", 2, "10:20", "12:20", "07-044-245 ระบบสารสนเทศทางการบัญชี (ปฏิบัติ)", "07-044-245", "อ.ไฮดา สุดินปรีดา", "กลุ่ม 01 (ชั้นปี 2 บัญชี)", "teal"], ["TT-164", "LAB-2", "พุธ", 3, "08:20", "10:20", "07-064-261 โปรแกรมสำเร็จรูปในงานอาชีพ (ทฤษฎี)", "07-064-261", "อ.พระรักษ์ อมรศักดิ์", "กลุ่ม 02 (ชั้นปี 1 รปศ.)", "indigo"], ["TT-165", "LAB-2", "พุธ", 3, "10:20", "12:20", "07-064-261 โปรแกรมสำเร็จรูปในงานอาชีพ (ปฏิบัติ)", "07-064-261", "อ.พระรักษ์ อมรศักดิ์", "กลุ่ม 02 (ชั้นปี 1 รปศ.)", "indigo"], ["TT-166", "LAB-2", "พฤหัสบดี", 4, "08:20", "10:20", "07-034-287 การประยุกต์ใช้ปัญญาประดิษฐ์ในงานมัลติมีเดีย (ทฤษฎี)", "07-034-287", "อ.ผการัตน์ ทอ. , อ.เจ๊ะอีลย๊าส โตะตาหยง", "กลุ่ม 02 (ชั้นปี 3 รปศ.)", "cyan"], ["TT-167", "LAB-2", "พฤหัสบดี", 4, "10:20", "12:20", "07-034-287 การประยุกต์ใช้ปัญญาประดิษฐ์ในงานมัลติมีเดีย (ปฏิบัติ)", "07-034-287", "อ.ผการัตน์ ทอ. , อ.เจ๊ะอีลย๊าส โตะตาหยง", "กลุ่ม 02 (ชั้นปี 3 รปศ.)", "cyan"], ["TT-168", "LAB-2", "ศุกร์", 5, "08:20", "10:20", "07-034-218 โปรแกรมสำเร็จรูปในสำนักงาน (ทฤษฎี)", "07-034-218", "อ.เจ๊ะอีลย๊าส โตะตาหยง", "กลุ่ม 01 (ชั้นปี 4 รปศ.)", "orange"], ["TT-169", "LAB-2", "ศุกร์", 5, "10:20", "12:20", "07-034-218 โปรแกรมสำเร็จรูปในสำนักงาน (ปฏิบัติ)", "07-034-218", "อ.เจ๊ะอีลย๊าส โตะตาหยง", "กลุ่ม 01 (ชั้นปี 4 รปศ.)", "orange"], ["TT-170", "MIL-1", "เสาร์", 6, "08:00", "09:00", "07-066-102 ภาษาอังกฤษสำหรับบัณฑิตศึกษา", "07-066-102", "อาจารย์ ดร.มุสลิม รอกา", "กลุ่ม 01 (ชั้นปี 1)", "blue"], ["TT-171", "MIL-1", "เสาร์", 6, "08:00", "09:00", "07-086-103 ภาษาอังกฤษสำหรับนักบริหาร", "07-086-103", "อาจารย์ ดร.มุสลิม รอกา", "กลุ่ม 01 (ชั้นปี 1)", "blue"], ["TT-172", "MIL-1", "เสาร์", 6, "09:00", "12:00", "07-066-202 การจัดการทรัพยากรมนุษย์เชิงกลยุทธ์", "07-066-202", "อาจารย์ ดร.พรทิพย์ มานพคำ", "กลุ่ม 01 (ชั้นปี 1)", "purple"], ["TT-173", "MIL-1", "เสาร์", 6, "13:00", "15:00", "07-066-203 การวิเคราะห์นโยบายและการประเมินนโยบายขั้นสูง (ทฤษฎี)", "07-066-203", "อาจารย์ ดร.ชนาธิป หวังวรวงศ์", "กลุ่ม 01 (ชั้นปี 1)", "teal"], ["TT-174", "MIL-1", "เสาร์", 6, "15:00", "17:00", "07-066-203 การวิเคราะห์นโยบายและการประเมินนโยบายขั้นสูง (ปฏิบัติ)", "07-066-203", "อาจารย์ ดร.ชนาธิป หวังวรวงศ์", "กลุ่ม 01 (ชั้นปี 1)", "teal"], ["TT-175", "MIL-1", "อาทิตย์", 0, "08:00", "09:00", "07-066-101 หลักรัฐประศาสนศาสตร์", "07-066-101", "อาจารย์ ดร.อิบรอฮิม สารีมาแซ", "กลุ่ม 01 (ชั้นปี 1)", "amber"], ["TT-176", "MIL-1", "อาทิตย์", 0, "09:00", "12:00", "07-066-201 ทฤษฎีรัฐประศาสนศาสตร์และการจัดการภาครัฐยุค AI", "07-066-201", "อาจารย์ ดร.อิบรอฮิม สารีมาแซ", "กลุ่ม 01 (ชั้นปี 1)", "emerald"], ["TT-177", "CONF-1", "พฤหัสบดี", 4, "09:00", "11:00", "07-086-208 การเปลี่ยนแปลงองค์การสู่ดิจิทัลและนวัตกรรม (ทฤษฎี)", "07-086-208", "อาจารย์ ดร.กฤษณา พรหมชาติ", "กลุ่ม 01 (ชั้นปี 1 นวัตกรรม)", "orange"], ["TT-178", "CONF-1", "พฤหัสบดี", 4, "11:00", "13:00", "07-086-208 การเปลี่ยนแปลงองค์การสู่ดิจิทัลและนวัตกรรม (ปฏิบัติ)", "07-086-208", "อาจารย์ ดร.กฤษณา พรหมชาติ", "กลุ่ม 01 (ชั้นปี 1 นวัตกรรม)", "orange"], ["TT-179", "CONF-1", "ศุกร์", 5, "09:00", "11:00", "07-086-207 นวัตกรรมการจัดการเชิงกลยุทธ์ (ทฤษฎี)", "07-086-207", "ผศ.ดร.ธมยันตี ประยูรพันธ์", "กลุ่ม 01 (ชั้นปี 1 นวัตกรรม)", "pink"], ["TT-180", "CONF-1", "ศุกร์", 5, "11:00", "13:00", "07-086-207 นวัตกรรมการจัดการเชิงกลยุทธ์ (ปฏิบัติ)", "07-086-207", "ผศ.ดร.ธมยันตี ประยูรพันธ์", "กลุ่ม 01 (ชั้นปี 1 นวัตกรรม)", "pink"], ["TT-181", "CONF-1", "ศุกร์", 5, "14:00", "15:00", "07-086-102 การจัดการองค์การสมัยใหม่", "07-086-102", "อาจารย์ ดร.สรัญณี อุ. , อาจารย์ ดร.กฤษณา พร.", "กลุ่ม 01 (ชั้นปี 1 นวัตกรรม)", "teal"], ["TT-182", "CONF-1", "ศุกร์", 5, "15:00", "17:00", "07-086-206 ภาวะผู้นำและการบริหารทรัพยากรมนุษย์ในยุคดิจิทัล (ทฤษฎี)", "07-086-206", "อาจารย์ ดร.สรัญณี อุ. , อาจารย์ ดร.สุมาลี กร.", "กลุ่ม 01 (ชั้นปี 1 นวัตกรรม)", "indigo"], ["TT-183", "CONF-1", "ศุกร์", 5, "17:00", "19:00", "07-086-206 ภาวะผู้นำและการบริหารทรัพยากรมนุษย์ในยุคดิจิทัล (ปฏิบัติ)", "07-086-206", "อาจารย์ ดร.สรัญณี อุ. , อาจารย์ ดร.สุมาลี กร.", "กลุ่ม 01 (ชั้นปี 1 นวัตกรรม)", "indigo"], ["TT-184", "CONF-1", "อาทิตย์", 0, "09:00", "12:00", "07-086-304 การจัดการทรัพยากรมนุษย์เชิงกลยุทธ์", "07-086-304", "อาจารย์ ดร.สรัญณี อุ. , อาจารย์ ดร.สุมาลี กร.", "กลุ่ม 01 (ชั้นปี 2 นวัตกรรม)", "purple"]];
  ttSheet.getRange(2, 1, defaultTimetable.length, defaultTimetable[0].length).setValues(defaultTimetable);

  // 3. สร้าง Sheet "Bookings"
  let bkSheet = ss.getSheetByName(SHEET_BOOKINGS);
  if (!bkSheet) {
    bkSheet = ss.insertSheet(SHEET_BOOKINGS);
  } else {
    bkSheet.clear();
  }
  const bkHeaders = ["id", "roomId", "roomName", "date", "startTime", "endTime", "subject", "bookerName", "department", "purpose", "status", "createdAt"];
  bkSheet.appendRow(bkHeaders);
  formatHeaderRow(bkSheet, "#059669");

  const defaultBookings = [];
  if (defaultBookings.length > 0) {
    bkSheet.getRange(2, 1, defaultBookings.length, defaultBookings[0].length).setValues(defaultBookings);
  }

  // 4. สร้าง Sheet "Maintenance"
  let mntSheet = ss.getSheetByName(SHEET_MAINTENANCE);
  if (!mntSheet) {
    mntSheet = ss.insertSheet(SHEET_MAINTENANCE);
  } else {
    mntSheet.clear();
  }
  const mntHeaders = ["id", "roomId", "roomName", "reportedDate", "title", "details", "reporter", "priority", "status"];
  mntSheet.appendRow(mntHeaders);
  formatHeaderRow(mntSheet, "#dc2626");

  const defaultMnt = [];
  if (defaultMnt.length > 0) {
    mntSheet.getRange(2, 1, defaultMnt.length, defaultMnt[0].length).setValues(defaultMnt);
  }

  return { success: true, message: "สร้างฐานข้อมูล Google Sheets 4 แผ่นงานเรียบร้อยแล้ว!" };
}

/**
 * ฟังก์ชันช่วยแปลงข้อมูลแถวใน Google Sheet เป็น Array of Objects
 */
function getSheetObjects(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  const headers = data[0];
  const objects = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      let val = row[j];
      // Format Date / Time values if needed
      if (val instanceof Date) {
        if (val.getFullYear() <= 1900) {
          val = Utilities.formatDate(val, "GMT+7", "HH:mm");
        } else {
          val = Utilities.formatDate(val, "GMT+7", "yyyy-MM-dd");
        }
      }
      obj[headers[j]] = val;
    }
    objects.push(obj);
  }
  return objects;
}

/**
 * จัดรูปแบบแถวหัวตาราง (Header)
 */
function formatHeaderRow(sheet, bgColor) {
  const range = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  range.setBackground(bgColor);
  range.setFontColor("#ffffff");
  range.setFontWeight("bold");
  range.setHorizontalAlignment("center");
  sheet.setFrozenRows(1);
}

/**
 * ปฏิเสธการจอง
 */
function apiRejectBooking(bookingId) {
  try {
    const ss = getDb();
    const sheet = ss.getSheetByName(SHEET_BOOKINGS);
    if (!sheet) return { success: false, message: "Sheet not found" };
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: false, message: "No data" };

    let statusCol = 11;
    for (let c = 0; c < data[0].length; c++) {
      if (String(data[0][c]).trim().toLowerCase() === 'status') {
        statusCol = c + 1;
        break;
      }
    }

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == bookingId) {
        sheet.getRange(i + 1, statusCol).setValue("rejected");
        return { success: true, message: "ปฏิเสธคำขอจองห้องเรียบร้อยแล้ว" };
      }
    }
    return { success: false, message: "ไม่พบรหัสการจอง: " + bookingId };
  } catch (e) {
    return { success: false, message: e.toString() };
  }
}
