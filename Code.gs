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
      case 'addRoom':
        result = apiAddRoom(requestData.room);
        break;
      case 'updateRoomStatus':
        result = apiUpdateRoomStatus(requestData.id, requestData.status, requestData.currentClass);
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

    if (action === 'getData') {
      responseData = {
        success: true,
        data: apiGetData()
      };
    } else if (action === 'init') {
      responseData = setupDatabase();
    } else {
      responseData = { success: false, message: "Invalid action" };
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
  
  // ตรวจสอบว่ามีชีทครบหรือไม่ หากยังไม่มีให้สร้างอัตโนมัติ
  if (!ss.getSheetByName(SHEET_ROOMS)) {
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

    sheet.appendRow([
      booking.id,
      booking.roomId,
      booking.roomName,
      booking.date,
      booking.startTime,
      booking.endTime,
      booking.subject,
      booking.bookerName,
      booking.department || "",
      booking.purpose || "",
      booking.status || "approved",
      booking.createdAt
    ]);

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
    const sheet = ss.getSheetByName(SHEET_BOOKINGS);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == bookingId) {
        sheet.deleteRow(i + 1);
        return { success: true, message: "ยกเลิกการจองสำเร็จ" };
      }
    }
    return { success: false, message: "ไม่พบรหัสการจอง: " + bookingId };
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
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == bookingId) {
        sheet.getRange(i + 1, 11).setValue("approved");
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
    const sheet = ss.getSheetByName(SHEET_MAINTENANCE);
    if (!sheet) return { success: false, message: "Sheet not found" };

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
    const sheet = ss.getSheetByName(SHEET_MAINTENANCE);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == ticketId) {
        sheet.getRange(i + 1, 9).setValue("completed");
        return { success: true, message: "อัปเดตสถานะการซ่อมสำเร็จ" };
      }
    }
    return { success: false, message: "ไม่พบรหัสแจ้งซ่อม: " + ticketId };
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
  const defaultRooms = [
    ["R-302", "ห้อง 302", "general", "ห้องเรียนทั่วไป", "อาคารเรียนรวม", "ชั้น 3", 40, 0, "available", JSON.stringify(["Smart TV 65 นิ้ว", "เครื่องปรับอากาศ x2", "กระดาน Whiteboard", "ไมค์ลอย"]), "ห้องเรียนบรรยายชั้น 3", "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600", "{}", "[]", ""],
    ["R-303", "ห้อง 303", "general", "ห้องเรียนทั่วไป", "อาคารเรียนรวม", "ชั้น 3", 40, 0, "occupied", JSON.stringify(["Projector 4000 ANSI", "เครื่องปรับอากาศ x2", "กระดาน Whiteboard"]), "ห้องเรียนบรรยายมาตรฐาน", "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600", "{}", "[]", JSON.stringify({subject:"TH101 ภาษาไทยเพื่อการสื่อสาร",instructor:"อ.ดร.พรพิมล รัตนโชติ",time:"09:00 - 12:00",studentCount:35})],
    ["R-305", "ห้อง 305", "general", "ห้องเรียนทั่วไป", "อาคารเรียนรวม", "ชั้น 3", 35, 0, "available", JSON.stringify(["Smart TV 65 นิ้ว", "เครื่องปรับอากาศ x2", "โต๊ะ Group Work"]), "ห้องเรียนขนาดกลาง 35 ที่นั่ง", "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600", "{}", "[]", ""],
    ["R-306", "ห้อง 306", "general", "ห้องเรียนทั่วไป", "อาคารเรียนรวม", "ชั้น 3", 45, 0, "reserved", JSON.stringify(["Smart Board 75 นิ้ว", "แอร์ x3", "ระบบ Video Conference"]), "ห้องเรียนอัจฉริยะ Smart Classroom", "https://images.unsplash.com/photo-1562774053-701939374585?w=600", "{}", "[]", JSON.stringify({subject:"ประชุมวิชาการประจำสาขา",instructor:"ผศ.ดร.สมชาย ใจดี",time:"13:00 - 16:00",studentCount:40})],
    ["R-307", "ห้อง 307", "general", "ห้องเรียนทั่วไป", "อาคารเรียนรวม", "ชั้น 3", 40, 0, "occupied", JSON.stringify(["Projector 4000 ANSI", "แอร์ x2", "กระดานกระจก", "ไมค์ลอย"]), "ห้องเรียนพร้อมกระดานกว้างพิเศษ", "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600", "{}", "[]", JSON.stringify({subject:"MA102 แคลคูลัสสำหรับวิทยาศาสตร์",instructor:"รศ.ดร.เกียรติศักดิ์ ศรีสุข",time:"10:00 - 12:00",studentCount:38})],
    ["R-308", "ห้อง 308", "general", "ห้องเรียนทั่วไป", "อาคารเรียนรวม", "ชั้น 3", 50, 0, "available", JSON.stringify(["Smart TV 75 นิ้ว", "แอร์ x3", "กระดาน Whiteboard x2", "ไมค์ลอยคู่"]), "ห้องเรียนขนาดใหญ่ ชั้น 3 รองรับ 50 คน", "https://images.unsplash.com/photo-1562774053-701939374585?w=600", "{}", "[]", ""],

    ["R-401", "ห้อง 401", "general", "ห้องเรียนทั่วไป", "อาคารเรียนรวม", "ชั้น 4", 45, 0, "available", JSON.stringify(["Smart Board 75 นิ้ว", "แอร์ x2", "ระบบเสียงดิจิทัล"]), "ห้องเรียนทันสมัย เก้าอี้แบบมีล้อเลื่อน", "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600", "{}", "[]", ""],
    ["R-402", "ห้อง 402", "general", "ห้องเรียนทั่วไป", "อาคารเรียนรวม", "ชั้น 4", 40, 0, "occupied", JSON.stringify(["Smart TV 65 นิ้ว", "แอร์ x2", "กระดาน Whiteboard"]), "ห้องเรียนพร้อมสื่อมัลติมีเดียภาษา", "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600", "{}", "[]", JSON.stringify({subject:"EN201 ภาษาอังกฤษเชิงวิชาการ",instructor:"Aj. Michael Anderson",time:"09:00 - 12:00",studentCount:35})],
    ["R-403", "ห้อง 403", "general", "ห้องเรียนทั่วไป", "อาคารเรียนรวม", "ชั้น 4", 50, 0, "available", JSON.stringify(["Dual Projector", "แอร์ x3", "ระบบไมค์ 4 ตัว"]), "ห้องเรียนขนาดใหญ่ จอภาพคู่", "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600", "{}", "[]", ""],
    ["R-404", "ห้อง 404", "general", "ห้องเรียนทั่วไป", "อาคารเรียนรวม", "ชั้น 4", 40, 0, "available", JSON.stringify(["Smart TV 65 นิ้ว", "แอร์ x2", "กระดาน Whiteboard", "ไมค์ไร้สาย"]), "ห้องเรียนมาตรฐาน ชั้น 4 วิวโปร่งสบาย", "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=600", "{}", "[]", ""],
    ["R-405", "ห้อง 405", "general", "ห้องเรียนทั่วไป", "อาคารเรียนรวม", "ชั้น 4", 55, 0, "reserved", JSON.stringify(["Projector 5000 ANSI", "แอร์ x3", "เวทียกพื้น Slope"]), "ห้องเรียนขนาดใหญ่แบบ Slope", "https://images.unsplash.com/photo-1562774053-701939374585?w=600", "{}", "[]", JSON.stringify({subject:"สัมมนาเทคโนโลยีสารสนเทศ",instructor:"ผศ.วิภาดา ลิขิตธรรม",time:"13:30 - 16:30",studentCount:50})],
    ["R-406", "ห้อง 406", "general", "ห้องเรียนทั่วไป", "อาคารเรียนรวม", "ชั้น 4", 40, 0, "available", JSON.stringify(["Smart TV 65 นิ้ว", "แอร์ x2", "กระดาน Whiteboard"]), "ห้องเรียนบรรยายทั่วไป ชั้น 4", "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600", "{}", "[]", ""],

    ["LAB-1", "ห้องปฏิบัติการคอม 1", "computer_lab", "ห้องปฏิบัติการคอมพิวเตอร์", "ศูนย์คอมพิวเตอร์", "ชั้น 3", 40, 40, "occupied", JSON.stringify(["PC นักศึกษา 40 เครื่อง", "Projector 5000 ANSI", "ระบบ NetSupport", "แอร์ 4 ตัว"]), "ห้องปฏิบัติการเขียนโปรแกรมเบื้องต้น", "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600", JSON.stringify({cpu:"Intel Core i5-13400",ram:"16 GB DDR4",gpu:"Intel UHD 730",storage:"512 GB SSD"}), JSON.stringify(["VS Code", "Python 3.12", "Node.js", "Office 365"]), JSON.stringify({subject:"CS101 การเขียนโปรแกรมเบื้องต้น",instructor:"ผศ.ดร.ธีรภัทร ชาญวิทย์",time:"09:00 - 12:00",studentCount:38})],
    ["LAB-2", "ห้องปฏิบัติการคอม 2", "computer_lab", "ห้องปฏิบัติการคอมพิวเตอร์", "ศูนย์คอมพิวเตอร์", "ชั้น 3", 40, 40, "available", JSON.stringify(["PC สเปกสูง 40 เครื่อง", "Smart Board 86 นิ้ว", "ระบบ NetSupport School", "แอร์ 4 ตัว"]), "ห้องปฏิบัติการพัฒนาซอฟต์แวร์และแอปพลิเคชัน", "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600", JSON.stringify({cpu:"Intel Core i7-13700",ram:"32 GB DDR5",gpu:"NVIDIA RTX 3060 12GB",storage:"1 TB SSD"}), JSON.stringify(["IntelliJ IDEA", "Android Studio", "Docker", "Flutter SDK"]), ""],
    ["LAB-3", "ห้องปฏิบัติการคอม 3", "computer_lab", "ห้องปฏิบัติการคอมพิวเตอร์", "ศูนย์คอมพิวเตอร์", "ชั้น 4", 35, 35, "reserved", JSON.stringify(["PC High-End Workstation 35 เครื่อง", "Dual Laser Projector", "แอร์ควบคุมอุณหภูมิ 22°C"]), "ห้องแล็บคอมพิวเตอร์ระดับสูง AI & 3D Multimedia", "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600", JSON.stringify({cpu:"Intel Core i9-14900K",ram:"64 GB DDR5",gpu:"NVIDIA RTX 4080 Super 16GB",storage:"2 TB SSD"}), JSON.stringify(["PyTorch & TensorFlow (CUDA)", "Adobe CC 2024", "Blender 4.0", "Unreal Engine 5"]), JSON.stringify({subject:"AI & Deep Learning Workshop",instructor:"ดร.กิตติคุณ ศิริวงศ์",time:"13:00 - 17:00",studentCount:32})],
    ["LAB-4", "ห้องปฏิบัติการคอม 4", "computer_lab", "ห้องปฏิบัติการคอมพิวเตอร์", "ศูนย์คอมพิวเตอร์", "ชั้น 4", 40, 40, "available", JSON.stringify(["PC เครือข่าย 40 เครื่อง", "ตู้ Rack Switch & Router", "Projector 4500 ANSI"]), "ห้องปฏิบัติการความมั่นคงปลอดภัยไซเบอร์และระบบเครือข่าย", "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600", JSON.stringify({cpu:"AMD Ryzen 7 7700X",ram:"32 GB DDR5",gpu:"AMD Radeon RX 7600 8GB",storage:"1 TB SSD"}), JSON.stringify(["Wireshark", "Cisco Packet Tracer", "GNS3", "Kali Linux"]), ""]
  ];
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

  const defaultTimetable = [
    ["S-1", "R-303", "จันทร์", 1, "09:00", "12:00", "TH101 ภาษาไทยเพื่อการสื่อสาร", "TH101", "อ.ดร.พรพิมล รัตนโชติ", "Sec 1", "blue"],
    ["S-2", "R-402", "จันทร์", 1, "09:00", "12:00", "EN201 ภาษาอังกฤษเชิงวิชาการ", "EN201", "Aj. Michael Anderson", "Sec 2", "purple"],
    ["S-3", "LAB-1", "จันทร์", 1, "09:00", "12:00", "CS101 การเขียนโปรแกรมเบื้องต้น", "CS101", "ผศ.ดร.ธีรภัทร ชาญวิทย์", "กลุ่ม 1", "indigo"],
    ["S-4", "R-306", "จันทร์", 1, "13:00", "16:00", "ประชุมวิชาการประจำสาขา", "CONF-01", "ผศ.ดร.สมชาย ใจดี", "คณาจารย์", "amber"],
    ["S-5", "LAB-3", "จันทร์", 1, "13:00", "17:00", "AI & Deep Learning Workshop", "AI-401", "ดร.กิตติคุณ ศิริวงศ์", "ปี 4 IT", "emerald"],
    ["S-6", "R-302", "อังคาร", 2, "09:00", "12:00", "GE101 การคิดเชิงวิพากษ์", "GE101", "อ.ปิยพร แก้วมณี", "Sec 3", "cyan"],
    ["S-7", "R-401", "อังคาร", 2, "09:00", "12:00", "BA201 หลักการตลาดดิจิทัล", "BA201", "ดร.กานดา สุวรรณ", "Sec 1", "pink"],
    ["S-8", "LAB-2", "อังคาร", 2, "13:00", "16:00", "CS302 Mobile App Development", "CS302", "อ.วรพงษ์ ทัศนีย์", "กลุ่ม 2", "orange"],
    ["S-9", "LAB-4", "อังคาร", 2, "09:00", "12:00", "NET201 Network Security", "NET201", "อ.ภาณุมาศ รัตนกุล", "ปี 3", "red"],
    ["S-10", "R-308", "อังคาร", 2, "13:00", "16:00", "ST201 สถิติประยุกต์สำหรับงานวิจัย", "ST201", "ผศ.ดร.วิชัย รุ่งเรือง", "Sec 1", "teal"]
  ];
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

  const defaultBookings = [
    ["BK-1001", "R-306", "ห้อง 306", "2026-09-01", "13:00", "16:00", "ประชุมวิชาการประจำสาขา", "ผศ.ดร.สมชาย ใจดี", "ภาควิชาวิทยาการคอมพิวเตอร์", "การประชุมเตรียมความพร้อมหลักสูตร", "approved", "2026-08-28 09:30"],
    ["BK-1002", "LAB-3", "ห้องปฏิบัติการคอม 3", "2026-09-01", "13:00", "17:00", "AI & Deep Learning Workshop", "ดร.กิตติคุณ ศิริวงศ์", "ศูนย์นวัตกรรม AI", "อบรม Generative AI และ PyTorch", "approved", "2026-08-29 14:15"],
    ["BK-1003", "R-405", "ห้อง 405", "2026-09-01", "13:30", "16:30", "สัมมนาเทคโนโลยีสารสนเทศ", "ผศ.วิภาดา ลิขิตธรรม", "คณะวิทยาการจัดการ", "บรรยายพิเศษจากผู้เชี่ยวชาญภายนอก", "approved", "2026-08-30 11:00"]
  ];
  bkSheet.getRange(2, 1, defaultBookings.length, defaultBookings[0].length).setValues(defaultBookings);

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

  const defaultMnt = [
    ["MNT-001", "R-305", "ห้อง 305", "2026-08-31", "แอร์มีน้ำหยด / รีโมทไม่ตอบสนอง", "ต้องการให้ช่างเข้าตรวจสอบและล้างแอร์", "อ.ดร.พรพิมล รัตนโชติ", "medium", "in_progress"],
    ["MNT-002", "LAB-1", "ห้องปฏิบัติการคอม 1", "2026-08-30", "PC เครื่องที่ 12 เมาส์คลิกซ้ายไม่ตอบสนอง", "เปลี่ยนเมาส์ตัวใหม่", "ผศ.ดร.ธีรภัทร ชาญวิทย์", "low", "completed"]
  ];
  mntSheet.getRange(2, 1, defaultMnt.length, defaultMnt[0].length).setValues(defaultMnt);

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
      // Format Date values if needed
      if (val instanceof Date) {
        val = Utilities.formatDate(val, "GMT+7", "yyyy-MM-dd");
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
