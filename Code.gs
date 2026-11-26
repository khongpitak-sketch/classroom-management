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
      case 'ping':
        result = { success: true, timestamp: new Date().toISOString() };
        break;
      case 'addBooking':
        result = apiAddBooking(requestData.booking);
        break;
      case 'cancelBooking':
      case 'deleteBooking':
        result = apiCancelBooking(requestData.id);
        break;
      case 'approveBooking':
        result = apiApproveBooking(requestData.id, requestData.status || 'approved');
        break;
      case 'completeBooking':
        result = apiApproveBooking(requestData.id, 'completed');
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

    if (action === 'ping') {
      responseData = { success: true, timestamp: new Date().toISOString() };
    } else if (action === 'getData' || action === 'getAll') {
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
      responseData = apiApproveBooking(params.id, params.status || 'approved');
      if (responseData.success) {
        responseData.data = apiGetData();
      }
    } else if (action === 'completeBooking') {
      responseData = apiApproveBooking(params.id, 'completed');
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
    } else if (action === 'updateRoomStatus') {
      responseData = apiUpdateRoomStatus(params.id, params.status, params.currentClass);
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

  // ตรวจสอบและเพิ่มห้องประชุม Co-working Space (CONF-4 และ CONF-5) หากยังไม่มีในชีต Rooms
  const hasConf4 = rooms.some(r => r.id === 'CONF-4');
  const hasConf5 = rooms.some(r => r.id === 'CONF-5');
  if (!hasConf4 || !hasConf5) {
    const rSheet = ss.getSheetByName(SHEET_ROOMS);
    if (!hasConf4 && rSheet) {
      rSheet.appendRow(["CONF-4", "ห้องประชุม Co-working Space (1)", "meeting_room", "ห้องประชุม / สัมมนา", "อาคารคณะวิทยาการจัดการ", "ชั้น 1", 15, 0, "available", JSON.stringify(["Smart TV (ทีวี 65 นิ้ว) 1 เครื่อง", "เครื่องปรับอากาศ 1 ตัว", "โต๊ะประชุมกลุ่ม Co-working", "กระดาน Whiteboard", "ปลั๊กไฟ & Wi-Fi ความเร็วสูง"]), "ห้องประชุม Co-working Space (1) (Co-workig Space 1) อาคารคณะวิทยาการจัดการ พร้อมทีวี 65 นิ้ว 1 เครื่อง และเครื่องปรับอากาศ 1 ตัว", "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=600", "{}", JSON.stringify(["Smart TV Screen Sharing", "Zoom Rooms", "Microsoft Teams"]), ""]);
      rooms.push({
        id: "CONF-4",
        name: "ห้องประชุม Co-working Space (1)",
        type: "meeting_room",
        categoryName: "ห้องประชุม / สัมมนา",
        building: "อาคารคณะวิทยาการจัดการ",
        floor: "ชั้น 1",
        capacity: 15,
        pcCount: 0,
        status: "available",
        facilities: ["Smart TV (ทีวี 65 นิ้ว) 1 เครื่อง", "เครื่องปรับอากาศ 1 ตัว", "โต๊ะประชุมกลุ่ม Co-working", "กระดาน Whiteboard", "ปลั๊กไฟ & Wi-Fi ความเร็วสูง"],
        description: "ห้องประชุม Co-working Space (1) (Co-workig Space 1) อาคารคณะวิทยาการจัดการ พร้อมทีวี 65 นิ้ว 1 เครื่อง และเครื่องปรับอากาศ 1 ตัว",
        image: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=600",
        specs: {},
        software: ["Smart TV Screen Sharing", "Zoom Rooms", "Microsoft Teams"],
        currentClass: null
      });
    }
    if (!hasConf5 && rSheet) {
      rSheet.appendRow(["CONF-5", "ห้องประชุม Co-working Space (2) (รับรอง)", "meeting_room", "ห้องประชุม / สัมมนา", "อาคารคณะวิทยาการจัดการ", "ชั้น 1", 15, 0, "available", JSON.stringify(["ชุดโซฟารับรอง / โต๊ะประชุมรับรอง", "Smart TV (ทีวี)", "เครื่องปรับอากาศ 1 ตัว", "ปลั๊กไฟ & Wi-Fi ความเร็วสูง"]), "ห้องประชุม Co-working Space (2) (รับรอง) (Co-workig Space 2) อาคารคณะวิทยาการจัดการ สำหรับการประชุมรับรองและกลุ่มย่อย", "https://images.unsplash.com/photo-1527192491265-7e15c55b1ed2?w=600", "{}", JSON.stringify(["Smart TV Screen Sharing", "Zoom Rooms", "Microsoft Teams"]), ""]);
      rooms.push({
        id: "CONF-5",
        name: "ห้องประชุม Co-working Space (2) (รับรอง)",
        type: "meeting_room",
        categoryName: "ห้องประชุม / สัมมนา",
        building: "อาคารคณะวิทยาการจัดการ",
        floor: "ชั้น 1",
        capacity: 15,
        pcCount: 0,
        status: "available",
        facilities: ["ชุดโซฟารับรอง / โต๊ะประชุมรับรอง", "Smart TV (ทีวี)", "เครื่องปรับอากาศ 1 ตัว", "ปลั๊กไฟ & Wi-Fi ความเร็วสูง"],
        description: "ห้องประชุม Co-working Space (2) (รับรอง) (Co-workig Space 2) อาคารคณะวิทยาการจัดการ สำหรับการประชุมรับรองและกลุ่มย่อย",
        image: "https://images.unsplash.com/photo-1527192491265-7e15c55b1ed2?w=600",
        specs: {},
        software: ["Smart TV Screen Sharing", "Zoom Rooms", "Microsoft Teams"],
        currentClass: null
      });
    }
  }

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
      const now = new Date();
      const thaiYear = now.getFullYear() + 543;
      const dStr = Utilities.formatDate(now, "GMT+7", "MMdd-HHmm");
      const rand = Math.floor(10 + Math.random() * 90);
      booking.id = "BK-" + thaiYear + dStr + rand;
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
function apiDeleteBooking(bookingId) {
  return apiCancelBooking(bookingId);
}

function apiCancelBooking(bookingId) {
  try {
    const ss = getDb();
    let deleted = false;
    const cleanId = String(bookingId || '').trim().toLowerCase();
    if (!cleanId) return { success: false, message: "No bookingId provided" };

    // Delete from Bookings sheet (loop backwards to handle duplicates & avoid index shifting)
    const bkSheet = ss.getSheetByName(SHEET_BOOKINGS);
    if (bkSheet) {
      const data = bkSheet.getDataRange().getValues();
      for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][0]).trim().toLowerCase() === cleanId) {
          bkSheet.deleteRow(i + 1);
          deleted = true;
        }
      }
    }

    // Also delete from Maintenance sheet if this was a dual-synced ticket
    const mntSheet = ss.getSheetByName(SHEET_MAINTENANCE);
    if (mntSheet) {
      const mntData = mntSheet.getDataRange().getValues();
      for (let j = mntData.length - 1; j >= 1; j--) {
        if (String(mntData[j][0]).trim().toLowerCase() === cleanId) {
          mntSheet.deleteRow(j + 1);
          deleted = true;
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
function apiApproveBooking(bookingId, targetStatus) {
  try {
    const newStatus = targetStatus || "approved";
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

    const cleanId = String(bookingId || '').trim().toLowerCase();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0] || '').trim().toLowerCase() === cleanId) {
        sheet.getRange(i + 1, statusCol).setValue(newStatus);
        return { success: true, message: newStatus === 'completed' ? "บันทึกสิ้นสุดการจองเรียบร้อยแล้ว" : "อนุมัติการจองเรียบร้อยแล้ว" };
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
    let targetRoomId = null;
    const cleanId = String(ticketId || '').trim().toLowerCase();

    // 1. Resolve in Maintenance sheet
    const sheet = ss.getSheetByName(SHEET_MAINTENANCE);
    if (sheet) {
      const data = sheet.getDataRange().getValues();
      if (data.length > 1) {
        let statusCol = 9;
        let resolvedDateCol = -1;
        for (let c = 0; c < data[0].length; c++) {
          const h = String(data[0][c] || '').trim().toLowerCase();
          if (h === 'status') statusCol = c + 1;
          if (h === 'resolveddate' || h === 'resolved_date' || h === 'resolved') resolvedDateCol = c + 1;
        }
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0] || '').trim().toLowerCase() === cleanId) {
            sheet.getRange(i + 1, statusCol).setValue("completed");
            if (resolvedDateCol > 0) {
              sheet.getRange(i + 1, resolvedDateCol).setValue(Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd"));
            }
            targetRoomId = String(data[i][1] || '').trim();
            resolved = true;
            break;
          }
        }
      }
    }

    // 2. Also resolve in Bookings sheet if dual-synced
    const bkSheet = ss.getSheetByName(SHEET_BOOKINGS);
    if (bkSheet) {
      const bkData = bkSheet.getDataRange().getValues();
      if (bkData.length > 1) {
        let bkStatusCol = 11;
        for (let c = 0; c < bkData[0].length; c++) {
          if (String(bkData[0][c] || '').trim().toLowerCase() === 'status') {
            bkStatusCol = c + 1;
            break;
          }
        }
        for (let j = 1; j < bkData.length; j++) {
          if (String(bkData[j][0] || '').trim().toLowerCase() === cleanId) {
            bkSheet.getRange(j + 1, bkStatusCol).setValue("completed");
            if (!targetRoomId) targetRoomId = String(bkData[j][1] || '').trim();
            resolved = true;
            break;
          }
        }
      }
    }

    // 3. Update Room status to available if no other active maintenance tickets exist
    if (targetRoomId) {
      let hasOtherOpen = false;
      if (sheet) {
        const mntData = sheet.getDataRange().getValues();
        if (mntData.length > 1) {
          let mntStCol = 8;
          for (let c = 0; c < mntData[0].length; c++) {
            if (String(mntData[0][c] || '').trim().toLowerCase() === 'status') {
              mntStCol = c;
              break;
            }
          }
          for (let i = 1; i < mntData.length; i++) {
            const rId = String(mntData[i][1] || '').trim().toLowerCase();
            const tId = String(mntData[i][0] || '').trim().toLowerCase();
            const st = String(mntData[i][mntStCol] || '').trim().toLowerCase();
            if (tId !== cleanId && (rId === targetRoomId.toLowerCase() || rId.includes(targetRoomId.toLowerCase())) && st !== "completed") {
              hasOtherOpen = true;
              break;
            }
          }
        }
      }
      if (!hasOtherOpen && bkSheet) {
        const bkData = bkSheet.getDataRange().getValues();
        if (bkData.length > 1) {
          let bkStCol = 10;
          for (let c = 0; c < bkData[0].length; c++) {
            if (String(bkData[0][c] || '').trim().toLowerCase() === 'status') {
              bkStCol = c;
              break;
            }
          }
          for (let j = 1; j < bkData.length; j++) {
            const rId = String(bkData[j][1] || '').trim().toLowerCase();
            const tId = String(bkData[j][0] || '').trim().toLowerCase();
            const st = String(bkData[j][bkStCol] || '').trim().toLowerCase();
            if (tId !== cleanId && tId.startsWith('mnt-') && (rId === targetRoomId.toLowerCase() || rId.includes(targetRoomId.toLowerCase())) && st !== "completed") {
              hasOtherOpen = true;
              break;
            }
          }
        }
      }
      if (!hasOtherOpen) {
        apiUpdateRoomStatus(targetRoomId, "available", null);
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
    if (!sheet) return { success: false, message: "Sheet not found" };
    const data = sheet.getDataRange().getValues();
    const target = String(roomId || '').trim().toLowerCase();

    for (let i = 1; i < data.length; i++) {
      const rId = String(data[i][0] || '').trim().toLowerCase();
      const rName = String(data[i][1] || '').trim().toLowerCase();
      if (rId == target || rName == target || rName.indexOf(target) !== -1 || (target && target.indexOf(rId) !== -1)) {
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
    const cleanId = String(ticketId || '').trim().toLowerCase();
    if (!cleanId) return { success: false, message: "No ticketId provided" };

    // Delete from Maintenance sheet (loop backwards to handle duplicates & avoid index shifting)
    const mntSheet = ss.getSheetByName(SHEET_MAINTENANCE);
    if (mntSheet) {
      const data = mntSheet.getDataRange().getValues();
      for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][0]).trim().toLowerCase() === cleanId) {
          mntSheet.deleteRow(i + 1);
          deleted = true;
        }
      }
    }

    // Also delete from Bookings sheet if it was dual-synced under [MNT]
    const bkSheet = ss.getSheetByName(SHEET_BOOKINGS);
    if (bkSheet) {
      const bkData = bkSheet.getDataRange().getValues();
      for (let j = bkData.length - 1; j >= 1; j--) {
        if (String(bkData[j][0]).trim().toLowerCase() === cleanId) {
          bkSheet.deleteRow(j + 1);
          deleted = true;
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
  const defaultRooms = [["R-302", "FMS302 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 3", 45, 0, "available", "[\"เครื่องโปรเจกเตอร์ (Projector)\", \"เครื่องปรับอากาศ x2\", \"กระดาน Whiteboard\", \"ระบบเครื่องเสียง & ไมค์\"]", "ห้องเรียนทฤษฎี FMS302 (เครื่องโปรเจกเตอร์) ชั้น ชั้น 3 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600", "{}", "[]", ""], ["R-303", "FMS303 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 3", 45, 0, "available", "[\"Smart TV (ทีวี 65 นิ้ว)\", \"เครื่องปรับอากาศ x2\", \"กระดาน Whiteboard\", \"ระบบเสียง\"]", "ห้องเรียนทฤษฎี FMS303 (ทีวี) ชั้น ชั้น 3 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600", "{}", "[]", ""], ["R-305", "FMS305 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 3", 45, 0, "available", "[\"Smart TV (ทีวี 65 นิ้ว)\", \"เครื่องปรับอากาศ x2\", \"กระดาน Whiteboard\"]", "ห้องเรียนทฤษฎี FMS305 (ทีวี) ชั้น ชั้น 3 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600", "{}", "[]", ""], ["R-306", "FMS306 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 3", 50, 0, "available", "[\"เครื่องโปรเจกเตอร์ (Projector)\", \"เครื่องปรับอากาศ x3\", \"กระดานกระจก\", \"ระบบ Video Conference\"]", "ห้องเรียนทฤษฎี FMS306 (เครื่องโปรเจกเตอร์) ชั้น ชั้น 3 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1562774053-701939374585?w=600", "{}", "[]", ""], ["R-307", "FMS307 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 3", 45, 0, "available", "[\"เครื่องโปรเจกเตอร์ (Projector)\", \"เครื่องปรับอากาศ x2\", \"กระดานกระจกขนาดใหญ่\", \"ไมค์ลอย\"]", "ห้องเรียนทฤษฎี FMS307 (เครื่องโปรเจกเตอร์) ชั้น ชั้น 3 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600", "{}", "[]", ""], ["R-308", "FMS308 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 3", 50, 0, "available", "[\"เครื่องโปรเจกเตอร์ (Projector)\", \"เครื่องปรับอากาศ x3\", \"กระดาน Whiteboard x2\", \"ไมค์ลอยคู่\"]", "ห้องเรียนทฤษฎี FMS308 (เครื่องโปรเจกเตอร์) ชั้น ชั้น 3 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1562774053-701939374585?w=600", "{}", "[]", ""], ["R-401", "FMS401 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 4", 50, 0, "available", "[\"Smart TV (ทีวี 65 นิ้ว)\", \"เครื่องปรับอากาศ x2\", \"กระดาน Whiteboard\", \"ระบบเสียงดิจิทัล\"]", "ห้องเรียนทฤษฎี FMS401 (ทีวี) ชั้น ชั้น 4 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600", "{}", "[]", ""], ["R-402", "FMS402 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 4", 45, 0, "available", "[\"Smart TV (ทีวี 65 นิ้ว)\", \"เครื่องปรับอากาศ x2\", \"กระดาน Whiteboard\", \"ลำโพงบลูทูธ\"]", "ห้องเรียนทฤษฎี FMS402 (ทีวี) ชั้น ชั้น 4 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600", "{}", "[]", ""], ["R-403", "FMS403 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 4", 50, 0, "available", "[\"เครื่องโปรเจกเตอร์ (Projector)\", \"เครื่องปรับอากาศ x3\", \"กระดาน Whiteboard\", \"ระบบไมค์ 4 ตัว\"]", "ห้องเรียนทฤษฎี FMS403 (เครื่องโปรเจกเตอร์) ชั้น ชั้น 4 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600", "{}", "[]", ""], ["R-404", "FMS404 - ห้องเรียน", "general", "ห้องเรียน", "อาคารคณะวิทยาการจัดการ", "ชั้น 4", 45, 0, "available", "[\"เครื่องโปรเจกเตอร์ (Projector)\", \"เครื่องปรับอากาศ x2\", \"กระดาน Whiteboard\", \"ไมค์ไร้สาย\"]", "ห้องเรียนทฤษฎี FMS404 (เครื่องโปรเจกเตอร์) ชั้น ชั้น 4 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=600", "{}", "[]", ""], ["R-405", "FMS405 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 4", 55, 0, "available", "[\"เครื่องโปรเจกเตอร์ (Projector)\", \"เครื่องปรับอากาศ x3\", \"เวทียกพื้น\", \"ไมค์สัมมนา\"]", "ห้องเรียนทฤษฎี FMS405 (เครื่องโปรเจกเตอร์) ชั้น ชั้น 4 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1562774053-701939374585?w=600", "{}", "[]", ""], ["R-406", "FMS406 - ห้องทฤษฎี", "general", "ห้องเรียนทฤษฎี", "อาคารคณะวิทยาการจัดการ", "ชั้น 4", 45, 0, "available", "[\"เครื่องโปรเจกเตอร์ (Projector)\", \"เครื่องปรับอากาศ x2\", \"กระดาน Whiteboard\", \"ระบบเสียงสเตอริโอ\"]", "ห้องเรียนทฤษฎี FMS406 (เครื่องโปรเจกเตอร์) ชั้น ชั้น 4 อาคารคณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600", "{}", "[]", ""], ["LAB-1", "FMS201 - ห้องปฏิบัติการคอมพิวเตอร์ 1", "computer_lab", "ห้องปฏิบัติการคอมพิวเตอร์", "อาคารคณะวิทยาการจัดการ", "ชั้น 2", 50, 50, "available", "[\"PC สำหรับนักศึกษา 50 เครื่อง\", \"PC อาจารย์ 1 เครื่อง\", \"Projector ความสว่างสูง\", \"ระบบควบคุมจอ NetSupport\", \"เครื่องปรับอากาศ x4\"]", "ห้องปฏิบัติการคอมพิวเตอร์ 1 (FMS201) ชั้น 2 คณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600", "{\"cpu\": \"Intel Core i5-13400 (10 Cores, 16 Threads)\", \"ram\": \"16 GB DDR4 3200MHz\", \"storage\": \"512 GB NVMe SSD\", \"gpu\": \"Intel UHD Graphics 730\", \"monitor\": \"24\\" Full HD IPS 75Hz\", \"os\": \"Windows 11 Pro 64-bit\", \"network\": \"LAN Gigabit 1000 Mbps\"}", "[\"Microsoft Office 365\", \"SPSS\", \"โปรแกรมสำเร็จรูปเพื่องานบัญชี\", \"Web Browser Suite\"]", ""], ["LAB-2", "FMS508 - ห้องปฏิบัติการคอมพิวเตอร์ 2", "computer_lab", "ห้องปฏิบัติการคอมพิวเตอร์", "อาคารคณะวิทยาการจัดการ", "ชั้น 5", 45, 45, "available", "[\"PC ประสิทธิภาพสูง 45 เครื่อง\", \"Smart Board 86 นิ้ว\", \"ระบบเครื่องเสียงห้องแล็บ\", \"เครื่องปรับอากาศ x4\"]", "ห้องปฏิบัติการคอมพิวเตอร์ 2 (FMS508) ชั้น 5 คณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600", "{\"cpu\": \"Intel Core i7-13700 (16 Cores, 24 Threads)\", \"ram\": \"32 GB DDR5 5600MHz\", \"storage\": \"1 TB NVMe Gen4 SSD\", \"gpu\": \"NVIDIA GeForce RTX 3060 12GB\", \"monitor\": \"27\\" 2K QHD IPS\", \"os\": \"Windows 11 Pro\", \"network\": \"LAN Gigabit 1000 Mbps\"}", "[\"Adobe Creative Cloud\", \"AI Multimedia Suite\", \"โปรแกรมระบบสารสนเทศทางการบัญชี\", \"VS Code & Python\"]", ""], ["LAB-3", "FMS504 - ห้องปฏิบัติการคอมพิวเตอร์ 3", "computer_lab", "ห้องปฏิบัติการคอมพิวเตอร์", "อาคารคณะวิทยาการจัดการ", "ชั้น 5", 45, 45, "available", "[\"PC เวิร์กสเตชัน 45 เครื่อง\", \"Projector Laser จอใหญ่\", \"ระบบ NetSupport School\", \"เครื่องปรับอากาศ x4\"]", "ห้องปฏิบัติการคอมพิวเตอร์ 3 (FMS504) ชั้น 5 คณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600", "{\"cpu\": \"Intel Core i7-13700\", \"ram\": \"32 GB DDR5\", \"storage\": \"1 TB NVMe SSD\", \"gpu\": \"NVIDIA GeForce RTX 4060\", \"monitor\": \"27\\" 2K QHD\", \"os\": \"Windows 11 Pro\", \"network\": \"LAN Gigabit\"}", "[\"Power BI\", \"IoT Development Tools\", \"ระบบธุรกิจอัจฉริยะ (BI Tools)\", \"Multimedia Design Suite\"]", ""], ["LAB-4", "FMS503 - ห้องปฏิบัติการคอมพิวเตอร์ 4", "computer_lab", "ห้องปฏิบัติการคอมพิวเตอร์", "อาคารคณะวิทยาการจัดการ", "ชั้น 5", 40, 40, "available", "[\"PC สำหรับเขียนโปรแกรม 40 เครื่อง\", \"Projector 4500 ANSI\", \"เครื่องปรับอากาศ x4\"]", "ห้องปฏิบัติการคอมพิวเตอร์ 4 (FMS503) ชั้น 5 คณะวิทยาการจัดการ", "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600", "{\"cpu\": \"Intel Core i5-13400\", \"ram\": \"16 GB DDR4\", \"storage\": \"512 GB SSD\", \"gpu\": \"Intel UHD 730\", \"monitor\": \"24\\" Full HD\", \"os\": \"Windows 11 Pro\", \"network\": \"LAN Gigabit\"}", "[\"Python 3.12\", \"VS Code\", \"Cloud Development Tools\", \"Adobe Multimedia\", \"SPSS Statistics\"]", ""], ["MIL-1", "ห้องปฏิบัติการนวัตกรรมการจัดการ (Management Innovation Lab)", "meeting_room", "ห้องปฏิบัติการนวัตกรรม & ประชุม", "อาคารคณะวิทยาการจัดการ", "ชั้น 2", 40, 0, "available", "[\"Smart Board 86 นิ้ว\", \"ระบบ Video Conference บันทึกการสอน\", \"เก้าอี้ Ergonomic\", \"เครื่องปรับอากาศ x2\"]", "ห้องปฏิบัติการนวัตกรรมการจัดการ (Management Innovation Lab) สำหรับระดับบัณฑิตศึกษาและวิชาการจัดการขั้นสูง", "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600", "{}", "[]", ""], ["CONF-1", "ห้องประชุมพฤกษาพรรณชมพู", "meeting_room", "ห้องประชุม / สัมมนา", "อาคารคณะวิทยาการจัดการ", "ชั้น 1", 20, 0, "available", "[\"ระบบเสียงไมโครโฟนรอบทิศทาง\", \"Dual Projector\", \"เวทีบรรยาย\", \"ระบบถ่ายทอดสด Live Streaming\", \"เครื่องปรับอากาศ x4\"]", "ห้องประชุมพฤกษาพรรณชมพู ชั้น 1 อาคารคณะวิทยาการจัดการ มหาวิทยาลัยนราธิวาสราชนครินทร์ ความจุ 20 ที่นั่ง รองรับการประชุม สัมมนา และการเรียนการสอนกลุ่มย่อย", "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=600", "{}", "[]", ""], ["CONF-2", "ห้องประชุมวิภา วังศิริกุล", "meeting_room", "ห้องประชุม / สัมมนา", "อาคารคณะวิทยาการจัดการ", "ชั้น 2", 200, 0, "available", "[\"เครื่องโปรเจกเตอร์ (Projector)\", \"ระบบเครื่องเสียงห้องประชุม\", \"ไมโครโฟนไร้สาย & ไมค์บรรยาย\", \"เครื่องปรับอากาศ\"]", "ห้องประชุมวิภา วังศิริกุล อาคารคณะวิทยาการจัดการ ความจุ 200 คน พร้อมเครื่องโปรเจกเตอร์และระบบเครื่องเสียง รองรับการประชุมใหญ่ สัมมนาวิชาการ และกิจกรรมคณะ", "https://images.unsplash.com/photo-1431540015161-0bf8663c16ba?w=600&auto=format&fit=crop&q=60", "{}", "[\"Zoom Rooms\", \"Microsoft Teams\", \"Wireless Presentation\"]", ""], ["CONF-3", "ห้องประชุมอินทนิลโสภา", "meeting_room", "ห้องประชุม / สัมมนา", "อาคารคณะวิทยาการจัดการ", "ชั้น 5", 60, 0, "available", "[\"ทีวี 3 จอ (Smart TV จอแสดงผล 3 เครื่อง)\", \"เครื่องโปรเจกเตอร์ 1 จอ (Projector)\", \"ระบบเครื่องเสียงประชุมตั้งโต๊ะ (ไมค์ประชุมรายบุคคล)\", \"เครื่องปรับอากาศ\", \"ระบบ Video Conference\"]", "ห้องประชุมอินทนิลโสภา ชั้น 5 อาคารคณะวิทยาการจัดการ ความจุ 60 ที่นั่ง พร้อมทีวี 3 จอ โปรเจกเตอร์ 1 จอ และระบบเครื่องเสียงประชุมตั้งโต๊ะ", "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=600&auto=format&fit=crop&q=60", "{}", "[\"Zoom Rooms\", \"Microsoft Teams\", \"Wireless Screen Sharing\"]", ""], ["CONF-4", "ห้องประชุม Co-working Space (1)", "meeting_room", "ห้องประชุม / สัมมนา", "อาคารคณะวิทยาการจัดการ", "ชั้น 1", 15, 0, "available", "[\"Smart TV (ทีวี 65 นิ้ว) 1 เครื่อง\", \"เครื่องปรับอากาศ 1 ตัว\", \"โต๊ะประชุมกลุ่ม Co-working\", \"กระดาน Whiteboard\", \"ปลั๊กไฟ & Wi-Fi ความเร็วสูง\"]", "ห้องประชุม Co-working Space (1) (Co-workig Space 1) อาคารคณะวิทยาการจัดการ พร้อมทีวี 65 นิ้ว 1 เครื่อง และเครื่องปรับอากาศ 1 ตัว", "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=600", "{}", "[\"Smart TV Screen Sharing\", \"Zoom Rooms\", \"Microsoft Teams\"]", ""], ["CONF-5", "ห้องประชุม Co-working Space (2) (รับรอง)", "meeting_room", "ห้องประชุม / สัมมนา", "อาคารคณะวิทยาการจัดการ", "ชั้น 1", 15, 0, "available", "[\"ชุดโซฟารับรอง / โต๊ะประชุมรับรอง\", \"Smart TV (ทีวี)\", \"เครื่องปรับอากาศ 1 ตัว\", \"ปลั๊กไฟ & Wi-Fi ความเร็วสูง\"]", "ห้องประชุม Co-working Space (2) (รับรอง) (Co-workig Space 2) อาคารคณะวิทยาการจัดการ สำหรับการประชุมรับรองและกลุ่มย่อย", "https://images.unsplash.com/photo-1527192491265-7e15c55b1ed2?w=600", "{}", "[\"Smart TV Screen Sharing\", \"Zoom Rooms\", \"Microsoft Teams\"]", ""]];
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

  const defaultTimetable = [["TT-01", "LAB-1", "พุธ", 3, "08:20", "10:20", "07-004-234 เทคโนโลยีดิจิทัลเพื่อการจัดการธุรกิจ (ทฤษฎี)", "07-004-234", "อ.พระรักษ์ อมรศักดิ์", "กลุ่ม 01 (ชั้นปี 1 บัญชี)", "blue"], ["TT-02", "LAB-1", "พุธ", 3, "10:20", "12:20", "07-004-234 เทคโนโลยีดิจิทัลเพื่อการจัดการธุรกิจ (ปฏิบัติ)", "07-004-234", "อ.พระรักษ์ อมรศักดิ์", "กลุ่ม 01 (ชั้นปี 1 บัญชี)", "blue"], ["TT-03", "LAB-1", "พฤหัสบดี", 4, "13:20", "15:20", "07-044-206 การสอบบัญชี (ทฤษฎี)", "07-044-206", "อาจารย์ ดร.พูนพิศ ธิตินันทน์", "กลุ่ม 01 (ชั้นปี 3 บัญชี)", "indigo"], ["TT-04", "LAB-1", "พฤหัสบดี", 4, "15:20", "17:20", "07-044-206 การสอบบัญชี (ปฏิบัติ)", "07-044-206", "อาจารย์ ดร.พูนพิศ ธิตินันทน์", "กลุ่ม 01 (ชั้นปี 3 บัญชี)", "indigo"], ["TT-05", "LAB-1", "ศุกร์", 5, "08:20", "10:20", "07-064-279 การจัดการฐานข้อมูล (ทฤษฎี)", "07-064-279", "ผศ.ศิริลักษณ์ อินทสโร", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "emerald"], ["TT-06", "LAB-1", "ศุกร์", 5, "10:20", "12:20", "07-064-279 การจัดการฐานข้อมูล (ปฏิบัติ)", "07-064-279", "ผศ.ศิริลักษณ์ อินทสโร", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "emerald"], ["TT-07", "R-302", "จันทร์", 1, "13:20", "16:20", "07-024-231 การตลาดบริการยุคดิจิทัล (ทฤษฎี)", "07-024-231", "อ.มธุรส ทองอินทราช", "กลุ่ม 01 (ชั้นปี 3 การตลาดดิจิทัล)", "amber"], ["TT-08", "R-302", "อังคาร", 2, "08:20", "11:20", "07-004-232 จริยธรรมและจรรยาบรรณเพื่อการตลาดดิจิทัล (ทฤษฎี)", "07-004-232", "อาจารย์ ดร.สุมาลี กรดกางกั้น, อ.ชลกาญจน์ สถะบดี", "กลุ่ม 01 (ชั้นปี 3 การตลาดดิจิทัล)", "purple"], ["TT-09", "R-302", "อังคาร", 2, "13:20", "16:20", "07-024-240 การตลาดเพื่อสังคมและสิ่งแวดล้อม (ทฤษฎี)", "07-024-240", "อ.ชลกาญจน์ สถะบดี", "กลุ่ม 01 (ชั้นปี 3 การตลาดดิจิทัล)", "teal"], ["TT-10", "R-302", "พุธ", 3, "08:20", "11:20", "07-044-243 การภาษีอากร 1 (หลักสูตรปรับปรุง 2568) (ทฤษฎี)", "07-044-243", "อาจารย์ ดร.พูนพิศ ธิตินันทน์, อ.นิฟาตีฮะ ปัตนวงศ์", "กลุ่ม 01 (ชั้นปี 2 บัญชี)", "rose"], ["TT-11", "R-303", "จันทร์", 1, "08:20", "11:20", "07-014-237 การจัดการธุรกิจชุมชน (ทฤษฎี)", "07-014-237", "อาจารย์ ดร.กฤษณา พรหมชาติ", "กลุ่ม 01 (ชั้นปี 3 การจัดการ)", "blue"], ["TT-12", "R-303", "อังคาร", 2, "13:20", "16:20", "07-004-225 จริยธรรมทางธุรกิจและความรับผิดชอบต่อสังคม (ทฤษฎี)", "07-004-225", "อาจารย์ ดร.สรัญณี อุเส็นยาง", "กลุ่ม 01 (ชั้นปี 1 การจัดการ)", "indigo"], ["TT-13", "R-303", "พฤหัสบดี", 4, "08:20", "11:20", "07-044-207 การบัญชีบริหาร (ทฤษฎี)", "07-044-207", "ผศ.ดร.บงกช กมลเปรม, อ.นันทพร โกสิยาภรณ์", "กลุ่ม 01 (ชั้นปี 3 บัญชี)", "purple"], ["TT-14", "R-303", "พฤหัสบดี", 4, "13:20", "16:20", "07-024-235 การตลาดบริการและการจัดการลูกค้าสัมพันธ์ (ทฤษฎี)", "07-024-235", "อ.มธุรส ทองอินทราช", "กลุ่ม 01 (ชั้นปี 1 ภาษาต่างประเทศธุรกิจบริการ)", "teal"], ["TT-15", "R-303", "ศุกร์", 5, "08:20", "10:20", "07-004-222 การวิจัยธุรกิจ (ทฤษฎี)", "07-004-222", "อาจารย์ ดร.อัฟซา อาแว", "กลุ่ม 01 (ชั้นปี 3, 4 การจัดการ)", "emerald"], ["TT-16", "R-303", "ศุกร์", 5, "10:20", "12:20", "07-004-222 การวิจัยธุรกิจ (ปฏิบัติ)", "07-004-222", "อาจารย์ ดร.อัฟซา อาแว", "กลุ่ม 01 (ชั้นปี 3, 4 การจัดการ)", "emerald"], ["TT-17", "R-305", "พุธ", 3, "08:20", "10:20", "07-004-240 หลักการจัดการธุรกิจและการวางแผนธุรกิจ (ทฤษฎี)", "07-004-240", "อ.รอยฮาน สะอารี", "กลุ่ม 01 (ชั้นปี 1 IT)", "blue"], ["TT-18", "R-305", "พุธ", 3, "10:20", "12:20", "07-004-240 หลักการจัดการธุรกิจและการวางแผนธุรกิจ (ปฏิบัติ)", "07-004-240", "อ.รอยฮาน สะอารี", "กลุ่ม 01 (ชั้นปี 1 IT)", "blue"], ["TT-19", "R-305", "พฤหัสบดี", 4, "13:20", "15:20", "07-004-241 บัญชีพื้นฐานสำหรับผู้ประกอบการ (ทฤษฎี)", "07-004-241", "อ.เนตรวดี เพชรประดับ", "กลุ่ม 01 (ชั้นปี 1 IT)", "amber"], ["TT-20", "R-305", "พฤหัสบดี", 4, "15:20", "17:20", "07-004-241 บัญชีพื้นฐานสำหรับผู้ประกอบการ (ปฏิบัติ)", "07-004-241", "อ.เนตรวดี เพชรประดับ", "กลุ่ม 01 (ชั้นปี 1 IT)", "amber"], ["TT-21", "R-306", "จันทร์", 1, "08:20", "10:20", "07-024-204 การสื่อสารทางการตลาดยุคดิจิทัลแบบบูรณาการ (ทฤษฎี)", "07-024-204", "อ.ชลกาญจน์ สถะบดี", "กลุ่ม 01 (ชั้นปี 2 การตลาดดิจิทัล)", "blue"], ["TT-22", "R-306", "จันทร์", 1, "10:20", "12:20", "07-024-204 การสื่อสารทางการตลาดยุคดิจิทัลแบบบูรณาการ (ปฏิบัติ)", "07-024-204", "อ.ชลกาญจน์ สถะบดี", "กลุ่ม 01 (ชั้นปี 2 การตลาดดิจิทัล)", "blue"], ["TT-23", "R-306", "อังคาร", 2, "13:20", "15:20", "07-044-249 โครงงานทางการบัญชีเพื่อความยั่งยืนของชุมชน (ปฏิบัติ)", "07-044-249", "อ.ไฮดา สุดินปรีดา", "กลุ่ม 01 (ชั้นปี 2 บัญชี)", "emerald"], ["TT-24", "R-306", "พุธ", 3, "08:20", "10:20", "07-024-215 วิจัยการตลาด (ทฤษฎี)", "07-024-215", "อาจารย์ ดร.รุ่งศิริ ผดุงรัตน์", "กลุ่ม 01 (ชั้นปี 3 การตลาดดิจิทัล)", "purple"], ["TT-25", "R-306", "พุธ", 3, "10:20", "12:20", "07-024-215 วิจัยการตลาด (ปฏิบัติ)", "07-024-215", "อาจารย์ ดร.รุ่งศิริ ผดุงรัตน์", "กลุ่ม 01 (ชั้นปี 3 การตลาดดิจิทัล)", "purple"], ["TT-26", "R-306", "พฤหัสบดี", 4, "08:20", "10:20", "07-024-238 การสื่อสารอย่างมีประสิทธิภาพทางการตลาด (ทฤษฎี)", "07-024-238", "อาจารย์ ดร.รุ่งศิริ ผดุงรัตน์", "กลุ่ม 01 (ชั้นปี 3 การตลาดดิจิทัล)", "indigo"], ["TT-27", "R-306", "พฤหัสบดี", 4, "10:20", "12:20", "07-024-238 การสื่อสารอย่างมีประสิทธิภาพทางการตลาด (ปฏิบัติ)", "07-024-238", "อาจารย์ ดร.รุ่งศิริ ผดุงรัตน์", "กลุ่ม 01 (ชั้นปี 3 การตลาดดิจิทัล)", "indigo"], ["TT-28", "R-306", "พฤหัสบดี", 4, "13:20", "15:20", "07-024-203 การกระจายสินค้าและช่องทางการตลาดดิจิทัล (ทฤษฎี)", "07-024-203", "อ.ชลกาญจน์ สถะบดี", "กลุ่ม 01 (ชั้นปี 2 การตลาดดิจิทัล)", "amber"], ["TT-29", "R-306", "พฤหัสบดี", 4, "15:20", "17:20", "07-024-203 การกระจายสินค้าและช่องทางการตลาดดิจิทัล (ปฏิบัติ)", "07-024-203", "อ.ชลกาญจน์ สถะบดี", "กลุ่ม 01 (ชั้นปี 2 การตลาดดิจิทัล)", "amber"], ["TT-30", "R-306", "ศุกร์", 5, "08:20", "10:20", "07-024-207 สื่อสร้างสรรค์ดิจิทัล (ทฤษฎี)", "07-024-207", "อ.มธุรส ทองอินทราช", "กลุ่ม 01 (ชั้นปี 2 การตลาดดิจิทัล)", "teal"], ["TT-31", "R-306", "ศุกร์", 5, "10:20", "12:20", "07-024-207 สื่อสร้างสรรค์ดิจิทัล (ปฏิบัติ)", "07-024-207", "อ.มธุรส ทองอินทราช", "กลุ่ม 01 (ชั้นปี 2 การตลาดดิจิทัล)", "teal"], ["TT-32", "R-307", "จันทร์", 1, "08:20", "11:20", "07-024-211 โลจิสติกส์และโซ่อุปทาน (ทฤษฎี)", "07-024-211", "ผศ.มัณฑนา กระโหมวงศ์", "กลุ่ม 01 (ชั้นปี 3 การตลาดดิจิทัล)", "blue"], ["TT-33", "R-307", "จันทร์", 1, "13:20", "16:20", "07-004-210 การภาษีอากร (ทฤษฎี)", "07-004-210", "อ.นิฟาตีฮะ ปัตนวงศ์", "กลุ่ม 01 (ชั้นปี 2 ตลาดดิจิทัล, IT)", "indigo"], ["TT-34", "R-307", "พุธ", 3, "08:20", "11:20", "07-044-205 การบัญชีชั้นสูง 2 (ทฤษฎี)", "07-044-205", "อ.เนตรวดี เพชรประดับ, อ.ทิพวรรณ รัตนพรหม", "กลุ่ม 01 (ชั้นปี 3 บัญชี)", "purple"], ["TT-35", "R-307", "พฤหัสบดี", 4, "08:20", "11:20", "07-004-236 การจัดการการดำเนินงาน (ทฤษฎี)", "07-004-236", "ผศ.ดร.ธมยันตี ประยูรพันธ์, อาจารย์ ดร.กชพรพรรณ พงค์ทองเมือง", "กลุ่ม 01 (ชั้นปี 3 การจัดการ)", "emerald"], ["TT-36", "R-307", "ศุกร์", 5, "08:20", "11:20", "07-004-203 การบริหารทรัพยากรมนุษย์ (ทฤษฎี)", "07-004-203", "ผศ.มัณฑนา กระโหมวงศ์", "กลุ่ม 01 (ชั้นปี 1 การจัดการ)", "amber"], ["TT-37", "R-308", "จันทร์", 1, "08:20", "10:20", "07-054-101 ธุรกิจและการเป็นผู้ประกอบการ (ทฤษฎี)", "07-054-101", "อ.โซเฟีย สามะอาลี, อ.รอยฮาน สะอารี", "กลุ่ม 01 (ชั้นปี 2 บัญชี, วิทย์)", "blue"], ["TT-38", "R-308", "จันทร์", 1, "10:20", "12:20", "07-054-101 ธุรกิจและการเป็นผู้ประกอบการ (ปฏิบัติ)", "07-054-101", "อ.โซเฟีย สามะอาลี, อ.รอยฮาน สะอารี", "กลุ่ม 01 (ชั้นปี 2 บัญชี, วิทย์)", "blue"], ["TT-39", "R-308", "จันทร์", 1, "13:20", "16:20", "07-064-232 กฎหมายวิธีพิจารณาความอาญา (ทฤษฎี)", "07-064-232", "ผศ.สัญญา วัชราทักษิณ", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "rose"], ["TT-40", "R-308", "อังคาร", 2, "08:20", "10:20", "07-044-236 หลักการบัญชี 2 (หลักสูตรปรับปรุง 2568) (ทฤษฎี)", "07-044-236", "อาจารย์ ดร.พูนพิศ ธิตินันทน์", "กลุ่ม 01 (ชั้นปี 1 บัญชี)", "purple"], ["TT-41", "R-308", "อังคาร", 2, "10:20", "12:20", "07-044-236 หลักการบัญชี 2 (หลักสูตรปรับปรุง 2568) (ปฏิบัติ)", "07-044-236", "อาจารย์ ดร.พูนพิศ ธิตินันทน์", "กลุ่ม 01 (ชั้นปี 1 บัญชี)", "purple"], ["TT-42", "R-308", "พฤหัสบดี", 4, "08:20", "10:20", "07-044-238 การบัญชีชั้นกลาง 2 (ปรับปรุง 2568) (ทฤษฎี)", "07-044-238", "อ.นิฟาตีฮะ ปัตนวงศ์", "กลุ่ม 01 (ชั้นปี 2 บัญชี)", "indigo"], ["TT-43", "R-308", "พฤหัสบดี", 4, "10:20", "12:20", "07-044-238 การบัญชีชั้นกลาง 2 (ปรับปรุง 2568) (ปฏิบัติ)", "07-044-238", "อ.นิฟาตีฮะ ปัตนวงศ์", "กลุ่ม 01 (ชั้นปี 2 บัญชี)", "indigo"], ["TT-44", "R-308", "ศุกร์", 5, "08:20", "10:20", "07-044-247 กฎหมายวิชาชีพบัญชีและกฎหมายธุรกิจ (หลักสูตรปรับปรุง 2568) (ทฤษฎี)", "07-044-247", "อ.ศรัณ เนื้อน้อย, อ.ทิพวรรณ รัตนพรหม", "กลุ่ม 01 (ชั้นปี 1 บัญชี)", "emerald"], ["TT-45", "R-308", "ศุกร์", 5, "10:20", "12:20", "07-044-247 กฎหมายวิชาชีพบัญชีและกฎหมายธุรกิจ (หลักสูตรปรับปรุง 2568) (ปฏิบัติ)", "07-044-247", "อ.ศรัณ เนื้อน้อย, อ.ทิพวรรณ รัตนพรหม", "กลุ่ม 01 (ชั้นปี 1 บัญชี)", "emerald"], ["TT-46", "R-308", "ศุกร์", 5, "13:20", "15:20", "07-054-101 ธุรกิจและการเป็นผู้ประกอบการ (ทฤษฎี)", "07-054-101", "อ.โซเฟีย สามะอาลี, อ.รอยฮาน สะอารี", "กลุ่ม 02 (ชั้นปี 2 วิศวะคอม, ไฟฟ้า)", "amber"], ["TT-47", "R-308", "ศุกร์", 5, "15:20", "17:20", "07-054-101 ธุรกิจและการเป็นผู้ประกอบการ (ปฏิบัติ)", "07-054-101", "อ.โซเฟีย สามะอาลี, อ.รอยฮาน สะอารี", "กลุ่ม 02 (ชั้นปี 2 วิศวะคอม, ไฟฟ้า)", "amber"], ["TT-48", "R-401", "จันทร์", 1, "08:20", "11:20", "07-064-272 การจัดการภาวะวิกฤตในภาครัฐ (ทฤษฎี)", "07-064-272", "อาจารย์ ดร.พรทิพย์ มานพคำ, อ.บารมี หลังยาหน่าย", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "blue"], ["TT-49", "R-401", "จันทร์", 1, "13:20", "15:20", "07-054-101 ธุรกิจและการเป็นผู้ประกอบการ (ทฤษฎี)", "07-054-101", "อ.โซเฟีย สามะอาลี, อ.รอยฮาน สะอารี", "กลุ่ม 03 (ชั้นปี 1 พยาบาล)", "teal"], ["TT-50", "R-401", "จันทร์", 1, "15:20", "17:20", "07-054-101 ธุรกิจและการเป็นผู้ประกอบการ (ปฏิบัติ)", "07-054-101", "อ.โซเฟีย สามะอาลี, อ.รอยฮาน สะอารี", "กลุ่ม 03 (ชั้นปี 1 พยาบาล)", "teal"], ["TT-51", "R-401", "อังคาร", 2, "08:20", "11:20", "07-064-213 ความรู้เบื้องต้นเกี่ยวกับกฎหมายและรัฐธรรมนูญไทย (ทฤษฎี)", "07-064-213", "อ.ศรัณ เนื้อน้อย", "กลุ่ม 01 (ชั้นปี 1 รปศ.)", "indigo"], ["TT-52", "R-401", "พฤหัสบดี", 4, "08:20", "10:20", "07-064-267 นวัตกรรมและเครื่องมือการจัดการ (ทฤษฎี)", "07-064-267", "อาจารย์ ดร.ชนาธิป หวังวรวงศ์", "กลุ่ม 01 (ชั้นปี 2 รปศ.)", "purple"], ["TT-53", "R-401", "พฤหัสบดี", 4, "10:20", "12:20", "07-064-267 นวัตกรรมและเครื่องมือการจัดการ (ปฏิบัติ)", "07-064-267", "อาจารย์ ดร.ชนาธิป หวังวรวงศ์", "กลุ่ม 01 (ชั้นปี 2 รปศ.)", "purple"], ["TT-54", "R-401", "ศุกร์", 5, "08:20", "11:20", "07-064-230 กฎหมายอาญา 1 (ทฤษฎี)", "07-064-230", "ผศ.สัญญา วัชราทักษิณ", "กลุ่ม 01 (ชั้นปี 2 รปศ.)", "rose"], ["TT-55", "R-402", "จันทร์", 1, "08:20", "11:20", "07-064-215 นโยบายสาธารณะและการวางแผน (ทฤษฎี)", "07-064-215", "อ.เปาซี วานอง", "กลุ่ม 01 (ชั้นปี 2 รปศ.)", "blue"], ["TT-56", "R-402", "จันทร์", 1, "13:20", "15:20", "07-044-246 การบริหารความเสี่ยงและการควบคุมภายใน (หลักสูตรปรับปรุง 2568) (ทฤษฎี)", "07-044-246", "อ.ทิพวรรณ รัตนพรหม", "กลุ่ม 01 (ชั้นปี 2 บัญชี)", "amber"], ["TT-57", "R-402", "จันทร์", 1, "15:20", "17:20", "07-044-246 การบริหารความเสี่ยงและการควบคุมภายใน (หลักสูตรปรับปรุง 2568) (ปฏิบัติ)", "07-044-246", "อ.ทิพวรรณ รัตนพรหม", "กลุ่ม 01 (ชั้นปี 2 บัญชี)", "amber"], ["TT-58", "R-402", "อังคาร", 2, "08:20", "11:20", "07-064-215 นโยบายสาธารณะและการวางแผน (ทฤษฎี)", "07-064-215", "อ.เปาซี วานอง", "กลุ่ม 02 (ชั้นปี 2 รปศ.)", "indigo"], ["TT-59", "R-402", "พฤหัสบดี", 4, "13:20", "15:20", "07-014-246 การจัดการสำนักงานสมัยใหม่และเทคนิคการนำเสนอ (ทฤษฎี)", "07-014-246", "อาจารย์ ดร.กชพรพรรณ พงค์ทองเมือง", "กลุ่ม 01 (ชั้นปี 1 การจัดการ)", "purple"], ["TT-60", "R-402", "พฤหัสบดี", 4, "15:20", "17:20", "07-014-246 การจัดการสำนักงานสมัยใหม่และเทคนิคการนำเสนอ (ปฏิบัติ)", "07-014-246", "อาจารย์ ดร.กชพรพรรณ พงค์ทองเมือง", "กลุ่ม 01 (ชั้นปี 1 การจัดการ)", "purple"], ["TT-61", "R-403", "จันทร์", 1, "08:20", "10:20", "07-064-288 ภาวะผู้นำและจริยธรรมในการบริหาร (ทฤษฎี)", "07-064-288", "อ.คมสัน หลงละเลิง", "กลุ่ม 02 (ชั้นปี 2 รปศ.)", "blue"], ["TT-62", "R-403", "จันทร์", 1, "10:20", "12:20", "07-064-288 ภาวะผู้นำและจริยธรรมในการบริหาร (ปฏิบัติ)", "07-064-288", "อ.คมสัน หลงละเลิง", "กลุ่ม 02 (ชั้นปี 2 รปศ.)", "blue"], ["TT-63", "R-403", "อังคาร", 2, "08:20", "10:20", "07-064-219 ระเบียบวิธีวิจัยทางรัฐประศาสนศาสตร์ (หลักสูตรปรับปรุง 2565) (ทฤษฎี)", "07-064-219", "ผศ.พัชนี ตูเล๊ะ", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "purple"], ["TT-64", "R-403", "อังคาร", 2, "10:20", "12:20", "07-064-219 ระเบียบวิธีวิจัยทางรัฐประศาสนศาสตร์ (หลักสูตรปรับปรุง 2565) (ปฏิบัติ)", "07-064-219", "ผศ.พัชนี ตูเล๊ะ", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "purple"], ["TT-65", "R-403", "พุธ", 3, "08:20", "11:20", "07-004-235 เศรษฐศาสตร์ยุคดิจิทัล (ทฤษฎี)", "07-004-235", "อาจารย์ ดร.อัฟซา อาแว", "กลุ่ม 01 (ชั้นปี 1 การจัดการ)", "teal"], ["TT-66", "R-403", "พฤหัสบดี", 4, "08:20", "10:20", "07-064-219 ระเบียบวิธีวิจัยทางรัฐประศาสนศาสตร์ (หลักสูตรปรับปรุง 2565) (ทฤษฎี)", "07-064-219", "ผศ.พัชนี ตูเล๊ะ", "กลุ่ม 02 (ชั้นปี 3 รปศ.)", "indigo"], ["TT-67", "R-403", "พฤหัสบดี", 4, "10:20", "12:20", "07-064-219 ระเบียบวิธีวิจัยทางรัฐประศาสนศาสตร์ (หลักสูตรปรับปรุง 2565) (ปฏิบัติ)", "07-064-219", "ผศ.พัชนี ตูเล๊ะ", "กลุ่ม 02 (ชั้นปี 3 รปศ.)", "indigo"], ["TT-68", "R-403", "พฤหัสบดี", 4, "13:20", "15:20", "07-064-288 ภาวะผู้นำและจริยธรรมในการบริหาร (ทฤษฎี)", "07-064-288", "อ.คมสัน หลงละเลิง", "กลุ่ม 01 (ชั้นปี 2 รปศ.)", "amber"], ["TT-69", "R-403", "พฤหัสบดี", 4, "15:20", "17:20", "07-064-288 ภาวะผู้นำและจริยธรรมในการบริหาร (ปฏิบัติ)", "07-064-288", "อ.คมสัน หลงละเลิง", "กลุ่ม 01 (ชั้นปี 2 รปศ.)", "amber"], ["TT-70", "R-404", "จันทร์", 1, "08:20", "11:20", "07-064-263 หลักรัฐประศาสนศาสตร์ (ทฤษฎี)", "07-064-263", "อาจารย์ ดร.อิบรอฮิม สารีมาแซ", "กลุ่ม 01 (ชั้นปี 1 รปศ.)", "blue"], ["TT-71", "R-404", "จันทร์", 1, "13:20", "16:20", "07-064-266 ระบบราชการไทยและองค์การสาธารณะ (ทฤษฎี)", "07-064-266", "อ.บูชิตา อารียาภรณ์", "กลุ่ม 02 (ชั้นปี 1 รปศ.)", "indigo"], ["TT-72", "R-404", "อังคาร", 2, "13:20", "16:20", "07-064-263 หลักรัฐประศาสนศาสตร์ (ทฤษฎี)", "07-064-263", "อาจารย์ ดร.อิบรอฮิม สารีมาแซ", "กลุ่ม 02 (ชั้นปี 1 รปศ.)", "purple"], ["TT-73", "R-404", "พุธ", 3, "08:20", "10:20", "07-014-257 การสร้างสรรค์ผลิตภัณฑ์และบริการ (ทฤษฎี)", "07-014-257", "อาจารย์ ดร.สรัญณี อุเส็นยาง", "กลุ่ม 01 (ชั้นปี 3, 4 การจัดการ)", "teal"], ["TT-74", "R-404", "พุธ", 3, "10:20", "12:20", "07-014-257 การสร้างสรรค์ผลิตภัณฑ์และบริการ (ปฏิบัติ)", "07-014-257", "อาจารย์ ดร.สรัญณี อุเส็นยาง", "กลุ่ม 01 (ชั้นปี 3, 4 การจัดการ)", "teal"], ["TT-75", "R-404", "พฤหัสบดี", 4, "08:20", "11:20", "07-064-266 ระบบราชการไทยและองค์การสาธารณะ (ทฤษฎี)", "07-064-266", "อ.บูชิตา อารียาภรณ์", "กลุ่ม 01 (ชั้นปี 1 รปศ.)", "amber"], ["TT-76", "R-404", "พฤหัสบดี", 4, "13:20", "15:20", "07-064-274 การจัดบริการสาธารณะ (ทฤษฎี)", "07-064-274", "อ.เปาซี วานอง, อ.บูชิตา อารียาภรณ์", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "amber"], ["TT-77", "R-404", "พฤหัสบดี", 4, "15:20", "17:20", "07-064-274 การจัดบริการสาธารณะ (ปฏิบัติ)", "07-064-274", "อ.เปาซี วานอง, อ.บูชิตา อารียาภรณ์", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "emerald"], ["TT-78", "R-405", "จันทร์", 1, "08:20", "10:20", "07-044-228 การวิจัยทางบัญชี (ทฤษฎี)", "07-044-228", "อ.ไฮดา สุดินปรีดา", "กลุ่ม 01 (ชั้นปี 3 บัญชี)", "blue"], ["TT-79", "R-405", "จันทร์", 1, "10:20", "12:20", "07-044-228 การวิจัยทางบัญชี (ปฏิบัติ)", "07-044-228", "อ.ไฮดา สุดินปรีดา", "กลุ่ม 01 (ชั้นปี 3 บัญชี)", "blue"], ["TT-80", "R-405", "อังคาร", 2, "08:20", "11:20", "07-014-204 การบัญชีเพื่อการจัดการ (ทฤษฎี)", "07-014-204", "อ.นันทพร โกสิยาภรณ์", "กลุ่ม 01 (ชั้นปี 2, 3 การจัดการ)", "indigo"], ["TT-81", "R-405", "พุธ", 3, "08:20", "10:20", "07-064-280 เศรษฐกิจสร้างสรรค์ (ทฤษฎี)", "07-064-280", "อ.ศรัณ เนื้อน้อย", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "purple"], ["TT-82", "R-405", "พุธ", 3, "10:20", "12:20", "07-064-280 เศรษฐกิจสร้างสรรค์ (ปฏิบัติ)", "07-064-280", "อ.ศรัณ เนื้อน้อย", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "purple"], ["TT-83", "R-405", "พฤหัสบดี", 4, "13:20", "16:20", "07-014-261 นักลงทุนอิสระ (ทฤษฎี)", "07-014-261", "อ.โซเฟีย สามะอาลี", "กลุ่ม 01 (ชั้นปี 1 บัญชี)", "amber"], ["TT-84", "R-405", "ศุกร์", 5, "08:20", "11:20", "07-004-211 การเงินธุรกิจ (ทฤษฎี)", "07-004-211", "อาจารย์ ดร.วีรศักดิ์ โศจิพันธุ์", "กลุ่ม 01 (ชั้นปี 2 การจัดการ)", "emerald"], ["TT-85", "R-406", "จันทร์", 1, "08:20", "10:20", "07-014-236 ความคิดสร้างสรรค์และการจัดการนวัตกรรม (หลักสูตรปรับปรุง 2565) (ทฤษฎี)", "07-014-236", "อาจารย์ ดร.กชพรพรรณ พงค์ทองเมือง", "กลุ่ม 01 (ชั้นปี 2 การจัดการ)", "blue"], ["TT-86", "R-406", "จันทร์", 1, "10:20", "12:20", "07-014-236 ความคิดสร้างสรรค์และการจัดการนวัตกรรม (หลักสูตรปรับปรุง 2565) (ปฏิบัติ)", "07-014-236", "อาจารย์ ดร.กชพรพรรณ พงค์ทองเมือง", "กลุ่ม 01 (ชั้นปี 2 การจัดการ)", "blue"], ["TT-87", "R-406", "อังคาร", 2, "08:20", "10:20", "07-064-271 การสื่อสารและการบริการที่เป็นเลิศ (ทฤษฎี)", "07-064-271", "อ.บารมี หลังยาหน่าย", "กลุ่ม 01 (ชั้นปี 2 รปศ.)", "purple"], ["TT-88", "R-406", "อังคาร", 2, "10:20", "12:20", "07-064-271 การสื่อสารและการบริการที่เป็นเลิศ (ปฏิบัติ)", "07-064-271", "อ.บารมี หลังยาหน่าย", "กลุ่ม 01 (ชั้นปี 2 รปศ.)", "purple"], ["TT-89", "R-406", "พุธ", 3, "08:20", "10:20", "07-064-275 อัตลักษณ์และกลยุทธ์การจัดการท้องถิ่น (ทฤษฎี)", "07-064-275", "อาจารย์ ดร.พรทิพย์ มานพคำ", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "teal"], ["TT-90", "R-406", "พุธ", 3, "10:20", "12:20", "07-064-275 อัตลักษณ์และกลยุทธ์การจัดการท้องถิ่น (ปฏิบัติ)", "07-064-275", "อาจารย์ ดร.พรทิพย์ มานพคำ", "กลุ่ม 01 (ชั้นปี 3 รปศ.)", "teal"], ["TT-91", "R-406", "พฤหัสบดี", 4, "13:20", "15:20", "07-064-271 การสื่อสารและการบริการที่เป็นเลิศ (ทฤษฎี)", "07-064-271", "อ.บารมี หลังยาหน่าย", "กลุ่ม 02 (ชั้นปี 2 รปศ.)", "amber"], ["TT-92", "R-406", "พฤหัสบดี", 4, "15:20", "17:20", "07-064-271 การสื่อสารและการบริการที่เป็นเลิศ (ปฏิบัติ)", "07-064-271", "อ.บารมี หลังยาหน่าย", "กลุ่ม 02 (ชั้นปี 2 รปศ.)", "amber"], ["TT-93", "R-406", "ศุกร์", 5, "08:20", "11:20", "07-044-242 การบัญชีบริหาร (หลักสูตรปรับปรุง 2568) (ทฤษฎี)", "07-044-242", "ผศ.ดร.บงกช กมลเปรม, อ.นันทพร โกสิยาภรณ์", "กลุ่ม 01 (ชั้นปี 2 บัญชี)", "emerald"], ["TT-94", "LAB-4", "จันทร์", 1, "08:20", "10:20", "07-004-234 เทคโนโลยีดิจิทัลเพื่อการจัดการธุรกิจ (ทฤษฎี)", "07-004-234", "อ.พระรักษ์ อมรศักดิ์", "กลุ่ม 01 (ชั้นปี 1 IT)", "blue"], ["TT-95", "LAB-4", "จันทร์", 1, "10:20", "12:20", "07-004-234 เทคโนโลยีดิจิทัลเพื่อการจัดการธุรกิจ (ปฏิบัติ)", "07-004-234", "อ.พระรักษ์ อมรศักดิ์", "กลุ่ม 01 (ชั้นปี 1 IT)", "blue"], ["TT-96", "LAB-4", "พฤหัสบดี", 4, "08:20", "10:20", "07-034-269 การตัดต่อวิดีโอด้วยปัญญาประดิษฐ์ (ทฤษฎี)", "07-034-269", "อ.เจ๊ะอีลย๊าส โตะตาหยง", "กลุ่ม 01 (ชั้นปี 1 IT)", "indigo"], ["TT-97", "LAB-4", "พฤหัสบดี", 4, "10:20", "12:20", "07-034-269 การตัดต่อวิดีโอด้วยปัญญาประดิษฐ์ (ปฏิบัติ)", "07-034-269", "อ.เจ๊ะอีลย๊าส โตะตาหยง", "กลุ่ม 01 (ชั้นปี 1 IT)", "indigo"], ["TT-98", "LAB-4", "ศุกร์", 5, "08:20", "10:20", "07-034-268 การสร้างเนื้อหาด้วยปัญญาประดิษฐ์สำหรับงานมัลติมีเดีย (ทฤษฎี)", "07-034-268", "อ.ผการัตน์ ทองจันทร์", "กลุ่ม 01 (ชั้นปี 1 IT)", "purple"], ["TT-99", "LAB-4", "ศุกร์", 5, "10:20", "12:20", "07-034-268 การสร้างเนื้อหาด้วยปัญญาประดิษฐ์สำหรับงานมัลติมีเดีย (ปฏิบัติ)", "07-034-268", "อ.ผการัตน์ ทองจันทร์", "กลุ่ม 01 (ชั้นปี 1 IT)", "purple"], ["TT-100", "LAB-3", "จันทร์", 1, "08:20", "10:20", "07-034-246 การพัฒนาสื่อดิจิทัลเพื่อธุรกิจ (ทฤษฎี)", "07-034-246", "ผศ.ศิริลักษณ์ อินทสโร", "กลุ่ม 01 (ชั้นปี 2 IT)", "blue"], ["TT-101", "LAB-3", "จันทร์", 1, "10:20", "12:20", "07-034-246 การพัฒนาสื่อดิจิทัลเพื่อธุรกิจ (ปฏิบัติ)", "07-034-246", "ผศ.ศิริลักษณ์ อินทสโร", "กลุ่ม 01 (ชั้นปี 2 IT)", "blue"], ["TT-102", "LAB-3", "จันทร์", 1, "13:20", "15:20", "07-004-226 การรู้ข้อมูลและการนำเสนอข้อมูล (ทฤษฎี)", "07-004-226", "อ.ผการัตน์ ทองจันทร์, อ.เนตรวดี เพชรประดับ", "กลุ่ม 01 (ชั้นปี 1 บัญชี)", "amber"], ["TT-103", "LAB-3", "จันทร์", 1, "15:20", "17:20", "07-004-226 การรู้ข้อมูลและการนำเสนอข้อมูล (ปฏิบัติ)", "07-004-226", "อ.ผการัตน์ ทองจันทร์, อ.เนตรวดี เพชรประดับ", "กลุ่ม 01 (ชั้นปี 1 บัญชี)", "amber"], ["TT-104", "LAB-3", "อังคาร", 2, "08:20", "10:20", "07-034-207 ระบบฐานข้อมูล (ทฤษฎี)", "07-034-207", "ผศ.ดร.เกศแก้ว ประดิษฐ์", "กลุ่ม 01 (ชั้นปี 2 IT)", "purple"], ["TT-105", "LAB-3", "อังคาร", 2, "10:20", "12:20", "07-034-207 ระบบฐานข้อมูล (ปฏิบัติ)", "07-034-207", "ผศ.ดร.เกศแก้ว ประดิษฐ์", "กลุ่ม 01 (ชั้นปี 2 IT)", "purple"], ["TT-106", "LAB-3", "พุธ", 3, "08:20", "10:20", "07-034-206 การเขียนโปรแกรมเชิงวัตถุ (ทฤษฎี)", "07-034-206", "อาจารย์ ดร.สุรเชษฐ์ สังขพันธ์", "กลุ่ม 01 (ชั้นปี 2 IT)", "teal"], ["TT-107", "LAB-3", "พุธ", 3, "10:20", "12:20", "07-034-206 การเขียนโปรแกรมเชิงวัตถุ (ปฏิบัติ)", "07-034-206", "อาจารย์ ดร.สุรเชษฐ์ สังขพันธ์", "กลุ่ม 01 (ชั้นปี 2 IT)", "teal"], ["TT-108", "LAB-3", "ศุกร์", 5, "08:20", "10:20", "07-034-210 การเขียนโปรแกรมบนเว็บ (ทฤษฎี)", "07-034-210", "อาจารย์ ดร.สุรเชษฐ์ สังขพันธ์", "กลุ่ม 01 (ชั้นปี 2 IT)", "emerald"], ["TT-109", "LAB-3", "ศุกร์", 5, "10:20", "12:20", "07-034-210 การเขียนโปรแกรมบนเว็บ (ปฏิบัติ)", "07-034-210", "อาจารย์ ดร.สุรเชษฐ์ สังขพันธ์", "กลุ่ม 01 (ชั้นปี 2 IT)", "emerald"], ["TT-110", "LAB-2", "จันทร์", 1, "13:20", "15:20", "07-034-218 โปรแกรมสำเร็จรูปในสำนักงาน (ทฤษฎี)", "07-034-218", "อ.เจ๊ะอีลย๊าส โตะตาหยง", "กลุ่ม 01 (ชั้นปี 3 บัญชี)", "blue"], ["TT-111", "LAB-2", "จันทร์", 1, "15:20", "17:20", "07-034-218 โปรแกรมสำเร็จรูปในสำนักงาน (ปฏิบัติ)", "07-034-218", "อ.เจ๊ะอีลย๊าส โตะตาหยง", "กลุ่ม 01 (ชั้นปี 3 บัญชี)", "blue"], ["TT-112", "MIL-1", "เสาร์", 6, "08:00", "10:00", "07-066-204 การบริหารงบประมาณภาครัฐขั้นสูง (ทฤษฎี)", "07-066-204", "อาจารย์ ดร.ชนาธิป หวังวรวงศ์", "กลุ่ม 01 (ชั้นปี 1 รปศ.)", "blue"], ["TT-113", "MIL-1", "เสาร์", 6, "10:00", "12:00", "07-066-204 การบริหารงบประมาณภาครัฐขั้นสูง (ปฏิบัติ)", "07-066-204", "อาจารย์ ดร.ชนาธิป หวังวรวงศ์", "กลุ่ม 01 (ชั้นปี 1 รปศ.)", "blue"], ["TT-114", "MIL-1", "เสาร์", 6, "13:00", "15:00", "07-066-303 การบริหารและการพัฒนาท้องถิ่น (ทฤษฎี)", "07-066-303", "อาจารย์ ดร.พรทิพย์ มานพคำ", "กลุ่ม 01 (ชั้นปี 1 รปศ.)", "indigo"], ["TT-115", "MIL-1", "เสาร์", 6, "15:00", "17:00", "07-066-303 การบริหารและการพัฒนาท้องถิ่น (ปฏิบัติ)", "07-066-303", "อาจารย์ ดร.พรทิพย์ มานพคำ", "กลุ่ม 01 (ชั้นปี 1 รปศ.)", "indigo"], ["TT-116", "MIL-1", "อาทิตย์", 0, "08:00", "10:00", "07-066-205 ระเบียบวิธีวิจัยทางรัฐประศาสนศาสตร์ (ทฤษฎี)", "07-066-205", "อาจารย์ ดร.อิบรอฮิม สารีมาแซ", "กลุ่ม 01 (ชั้นปี 1 รปศ.)", "purple"], ["TT-117", "MIL-1", "อาทิตย์", 0, "10:00", "12:00", "07-066-205 ระเบียบวิธีวิจัยทางรัฐประศาสนศาสตร์ (ปฏิบัติ)", "07-066-205", "อาจารย์ ดร.อิบรอฮิม สารีมาแซ", "กลุ่ม 01 (ชั้นปี 1 รปศ.)", "purple"], ["TT-118", "MIL-1", "อาทิตย์", 0, "13:00", "15:00", "07-066-301 สัมมนาทางรัฐประศาสนศาสตร์ (ทฤษฎี)", "07-066-301", "อาจารย์ ดร.อิบรอฮิม สารีมาแซ", "กลุ่ม 01 (ชั้นปี 1 รปศ.)", "teal"], ["TT-119", "MIL-1", "อาทิตย์", 0, "15:00", "17:00", "07-066-301 สัมมนาทางรัฐประศาสนศาสตร์ (ปฏิบัติ)", "07-066-301", "อาจารย์ ดร.อิบรอฮิม สารีมาแซ", "กลุ่ม 01 (ชั้นปี 1 รปศ.)", "teal"], ["TT-120", "MIL-1", "พฤหัสบดี", 4, "09:00", "11:00", "07-086-204 ระเบียบวิธีวิจัยทางการจัดการ (หลักสูตรปรับปรุง พ.ศ.2569) (ทฤษฎี)", "07-086-204", "อาจารย์ ดร.กฤษณา พรหมชาติ", "กลุ่ม 01 (ชั้นปี 1 นวัตกรรมการจัดการ)", "rose"], ["TT-121", "MIL-1", "พฤหัสบดี", 4, "11:00", "13:00", "07-086-204 ระเบียบวิธีวิจัยทางการจัดการ (หลักสูตรปรับปรุง พ.ศ.2569) (ปฏิบัติ)", "07-086-204", "อาจารย์ ดร.กฤษณา พรหมชาติ", "กลุ่ม 01 (ชั้นปี 1 นวัตกรรมการจัดการ)", "rose"], ["TT-122", "MIL-1", "พฤหัสบดี", 4, "14:00", "16:00", "07-086-302 สถิติสำหรับการวิจัยทางการจัดการ (หลักสูตรปรับปรุง พ.ศ.2569) (ทฤษฎี)", "07-086-302", "อาจารย์ ดร.กฤษณา พรหมชาติ", "กลุ่ม 01 (ชั้นปี 1 นวัตกรรมการจัดการ)", "amber"], ["TT-123", "MIL-1", "พฤหัสบดี", 4, "16:00", "18:00", "07-086-302 สถิติสำหรับการวิจัยทางการจัดการ (หลักสูตรปรับปรุง พ.ศ.2569) (ปฏิบัติ)", "07-086-302", "อาจารย์ ดร.กฤษณา พรหมชาติ", "กลุ่ม 01 (ชั้นปี 1 นวัตกรรมการจัดการ)", "amber"], ["TT-124", "MIL-1", "ศุกร์", 5, "09:00", "11:00", "07-086-209 สัมมนานวัตกรรมการจัดการ (หลักสูตรปรับปรุง พ.ศ.2569) (ทฤษฎี)", "07-086-209", "อาจารย์ ดร.สรัญณี อุเส็นยาง", "กลุ่ม 01 (ชั้นปี 1 นวัตกรรมการจัดการ)", "emerald"], ["TT-125", "MIL-1", "ศุกร์", 5, "11:00", "13:00", "07-086-209 สัมมนานวัตกรรมการจัดการ (หลักสูตรปรับปรุง พ.ศ.2569) (ปฏิบัติ)", "07-086-209", "อาจารย์ ดร.สรัญณี อุเส็นยาง", "กลุ่ม 01 (ชั้นปี 1 นวัตกรรมการจัดการ)", "emerald"], ["TT-126", "MIL-1", "ศุกร์", 5, "14:00", "17:00", "07-086-315 จริยธรรมและความรับผิดชอบต่อสังคมในองค์การ (หลักสูตรปรับปรุง พ.ศ.2569) (ทฤษฎี)", "07-086-315", "อ.คมสัน หลงละเลิง", "กลุ่ม 01 (ชั้นปี 1 นวัตกรรมการจัดการ)", "teal"], ["TT-127", "CONF-1", "อาทิตย์", 0, "09:00", "12:00", "07-086-306 การจัดการความเสี่ยงและภาวะวิกฤติ (ทฤษฎี)", "07-086-306", "อาจารย์ ดร.รุ่งศิริ ผดุงรัตน์", "กลุ่ม 01 (ชั้นปี 2 นวัตกรรมการจัดการภาครัฐและเอกชน)", "purple"], ["TT-128", "CONF-1", "อาทิตย์", 0, "13:00", "16:00", "07-086-309 นวัตกรรมการจัดการความรู้เพื่อการพัฒนา (ทฤษฎี)", "07-086-309", "อาจารย์ ดร.สรัญณี อุเส็นยาง", "กลุ่ม 01 (ชั้นปี 2 นวัตกรรมการจัดการภาครัฐและเอกชน)", "teal"]];
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
