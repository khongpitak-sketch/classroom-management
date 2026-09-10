// ----------------------------------------------------
// REAL-TIME INTER-TAB & MULTI-DEVICE SYNC ENGINE
// ----------------------------------------------------
function playNotificationSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const audioCtx = new AudioContext();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
    } catch(e) {}
}

/**
 * แปลงเวลาจาก Google Sheets (ซึ่งอาจอยู่ในรูป 1899-12-30T... หรือ HH:mm) เป็น HH:mm ที่ถูกต้อง
 */
function parseGasTime(timeVal) {
    if (!timeVal) return '';
    const str = String(timeVal).trim();
    if (!str.includes('T')) return str;
    try {
        const d = new Date(str);
        if (d.getUTCFullYear() <= 1900) {
            const utcSeconds = d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds();
            let bkkSeconds = (utcSeconds + 24124) % 86400;
            let totalMins = Math.round(bkkSeconds / 60);
            const rem = totalMins % 5;
            if (rem === 1 || rem === 2) totalMins -= rem;
            else if (rem === 3 || rem === 4) totalMins += (5 - rem);
            const hh = ('0' + Math.floor(totalMins / 60)).slice(-2);
            const mm = ('0' + (totalMins % 60)).slice(-2);
            return `${hh}:${mm}`;
        }
        return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    } catch(e) {
        return str;
    }
}

/**
 * แปลงวันที่จาก Google Sheets (ซึ่งอาจอยู่ในรูป ISO UTC) เป็น YYYY-MM-DD ท้องถิ่นโดยไม่ถอยหลัง 1 วัน
 */
function parseGasDate(dateVal) {
    if (!dateVal) return '';
    const str = String(dateVal).trim();
    if (!str.includes('T')) return str.slice(0, 10);
    try {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = ('0' + (d.getMonth() + 1)).slice(-2);
            const day = ('0' + d.getDate()).slice(-2);
            return `${year}-${month}-${day}`;
        }
    } catch(e) {}
    return str.split('T')[0];
}

function getDeletedMaintenanceIds() {
    try {
        const raw = localStorage.getItem('CMS_DELETED_MAINTENANCE_IDS');
        return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch(e) {
        return new Set();
    }
}

function addDeletedMaintenanceId(id) {
    if (!id) return;
    const set = getDeletedMaintenanceIds();
    set.add(String(id).trim());
    try {
        localStorage.setItem('CMS_DELETED_MAINTENANCE_IDS', JSON.stringify(Array.from(set)));
    } catch(e) {}
}

const syncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('CMS_REALTIME_SYNC') : null;

function broadcastDataChange(type, data = {}) {
    if (syncChannel) {
        try {
            syncChannel.postMessage({ type, data, timestamp: Date.now() });
        } catch(e) {}
    }
}

if (syncChannel) {
    syncChannel.onmessage = (event) => {
        const { type, data } = event.data || {};
        if (!type) return;

        switch (type) {
            case 'DELETE_BOOKING':
                AppState.bookings = AppState.bookings.filter(b => b.id !== data.id);
                saveData();
                updateAdminPendingBadge();
                renderCurrentTab();
                break;
            case 'APPROVE_BOOKING':
                const ab = AppState.bookings.find(b => b.id === data.id);
                if (ab) {
                    ab.status = 'approved';
                    saveData();
                    updateAdminPendingBadge();
                    renderCurrentTab();
                }
                break;
            case 'REJECT_BOOKING':
                const rb = AppState.bookings.find(b => b.id === data.id);
                if (rb) {
                    rb.status = 'rejected';
                    saveData();
                    updateAdminPendingBadge();
                    renderCurrentTab();
                }
                break;
            case 'ADD_BOOKING':
                if (data.booking) {
                    const existingIdx = AppState.bookings.findIndex(b => b.id === data.booking.id);
                    if (existingIdx === -1) {
                        AppState.bookings.unshift(data.booking);
                    } else {
                        AppState.bookings[existingIdx] = data.booking;
                    }
                    saveData();
                    updateAdminPendingBadge();
                    renderCurrentTab();
                    if (AppState.isAdmin) {
                        playNotificationSound();
                        showToast(`🔔 มีคำขอจองห้องใหม่เข้ามาทันที: <b>${data.booking.roomName || ''}</b> โดย <b>${data.booking.bookerName || ''}</b>`, 'warning', 7500);
                    }
                }
                break;
            case 'DELETE_MAINTENANCE':
                if (data.id) addDeletedMaintenanceId(data.id);
                AppState.maintenance = AppState.maintenance.filter(m => m.id !== data.id);
                if (data.roomId) {
                    const room = AppState.rooms.find(r => r.id === data.roomId);
                    if (room && room.status === 'maintenance') {
                        const hasOther = AppState.maintenance.some(m => m.roomId === data.roomId && m.status !== 'completed');
                        if (!hasOther) room.status = 'available';
                    }
                }
                saveData();
                updateAdminMaintenanceBadge();
                renderCurrentTab();
                if (!AppState.isAdmin) {
                    showToast(`🗑️ รายการแจ้งซ่อม ${data.id} ถูกลบโดยผู้ดูแลระบบแล้ว`, 'info', 4000);
                }
                break;
            case 'RESOLVE_MAINTENANCE':
                const rm = AppState.maintenance.find(m => m.id === data.id);
                if (rm) {
                    rm.status = 'completed';
                    if (data.roomId) {
                        const room = AppState.rooms.find(r => r.id === data.roomId);
                        if (room && room.status === 'maintenance') {
                            const hasOther = AppState.maintenance.some(m => m.roomId === data.roomId && m.status !== 'completed');
                            if (!hasOther) room.status = 'available';
                        }
                    }
                    saveData();
                    updateAdminMaintenanceBadge();
                    renderCurrentTab();
                    if (!AppState.isAdmin) {
                        showToast(`🔧 รายการแจ้งซ่อม ${rm.id} (${rm.roomName || ''}) ได้รับการซ่อมเสร็จสิ้นแล้ว!`, 'success', 6000);
                    }
                }
                break;
            case 'ADD_MAINTENANCE':
                if (data.ticket) {
                    const exIdx = AppState.maintenance.findIndex(m => m.id === data.ticket.id);
                    if (exIdx === -1) {
                        AppState.maintenance.unshift(data.ticket);
                    } else {
                        AppState.maintenance[exIdx] = data.ticket;
                    }
                    saveData();
                    updateAdminMaintenanceBadge();
                    renderCurrentTab();
                    if (AppState.isAdmin) {
                        playNotificationSound();
                        showToast(`🔧 มีรายการแจ้งซ่อมใหม่เข้ามาทันที: <b>${data.ticket.roomName || ''}</b> (${data.ticket.title || ''}) โดย <b>${data.ticket.reporter || ''}</b>`, 'warning', 8000);
                    }
                }
                break;
            case 'DELETE_ROOM':
                AppState.rooms = AppState.rooms.filter(r => r.id !== data.id);
                saveData();
                renderCurrentTab();
                break;
            case 'UPDATE_ROOM':
                if (data.room) {
                    const uidx = AppState.rooms.findIndex(r => r.id === data.room.id);
                    if (uidx !== -1) AppState.rooms[uidx] = data.room;
                    else AppState.rooms.push(data.room);
                    saveData();
                    renderCurrentTab();
                }
                break;
            case 'DELETE_TIMETABLE':
                AppState.timetable = AppState.timetable.filter(t => t.id !== data.id);
                saveData();
                renderCurrentTab();
                break;
        }
    };
}

// Storage event listener: sync changes instantly across browser tabs
window.addEventListener('storage', (e) => {
    try {
        if (e.key === 'CMS_BOOKINGS' && e.newValue) {
            AppState.bookings = JSON.parse(e.newValue);
            updateAdminPendingBadge();
            renderCurrentTab();
        } else if (e.key === 'CMS_MAINTENANCE' && e.newValue) {
            AppState.maintenance = JSON.parse(e.newValue);
            updateAdminMaintenanceBadge();
            renderCurrentTab();
        } else if (e.key === 'CMS_ROOMS' && e.newValue) {
            AppState.rooms = JSON.parse(e.newValue);
            renderCurrentTab();
        } else if (e.key === 'CMS_TIMETABLE' && e.newValue) {
            AppState.timetable = JSON.parse(e.newValue);
            renderCurrentTab();
        }
    } catch(err) {}
});


/**
 * Classroom Management System - Core Application Logic
 * Supports: 302, 303, 305, 306, 307, 308, 401, 402, 403, 404, 405, 406
 * Computer Labs 1, 2, 3, 4 + Google Sheets API & Google Apps Script
 */

// State Management
const AppState = {
    rooms: [],
    timetable: [],
    bookings: [],
    maintenance: [],
    currentTab: 'dashboard',
    selectedRoomType: 'all', // 'all', 'general', 'computer_lab'
    searchQuery: '',
    statusFilter: 'all',
    buildingFilter: 'all',
    selectedRoomForSchedule: 'ALL',
    selectedInstructorForSchedule: 'ALL',
    reportTimeframe: 'all', // 'all', 'month', 'week', 'semester'
    simulatedTime: null, // null = live real-time, or 'HH:MM'
    simulatedDayIndex: null, // 0 = Sunday, 1 = Monday, ...
    simulatedDayName: null,
    selectedDayIndex: 1, // 1 = Monday
    googleScriptUrl: '', // Google Apps Script Web App URL
    isGoogleConnected: false,
    isAdmin: sessionStorage.getItem('CMS_IS_ADMIN') === 'true',
    bookingFilterStatus: 'all'
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadData();
    initUI();
    setupEventListeners();
    updateClock();
    setInterval(updateClock, 1000);
    // Background real-time auto-sync with Google Sheets every 5 seconds
    setInterval(() => {
        if (AppState.googleScriptUrl) {
            fetchDataFromGoogleSheets(true);
        }
    }, 5000);

    // Instant sync when tab gains focus or user returns to tab
    window.addEventListener('focus', () => {
        if (AppState.googleScriptUrl) fetchDataFromGoogleSheets(true);
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && AppState.googleScriptUrl) {
            fetchDataFromGoogleSheets(true);
        }
    });

    renderCurrentTab();

    // Auto-sync with Google Apps Script if configured
    if (isGoogleAppsScriptEnvironment()) {
        syncFromGoogleAppsScript();
    } else if (AppState.googleScriptUrl) {
        fetchDataFromGoogleSheets(true);
    }
});

// Check if running directly inside Google Apps Script Web App
function isGoogleAppsScriptEnvironment() {
    return typeof google !== 'undefined' && google.script && google.script.run;
}

// Load Settings from LocalStorage
function loadSettings() {
    try {
        const savedUrl = localStorage.getItem('CMS_GAS_URL');
        // ต้องเป็น URL ของ Google Apps Script Web App เท่านั้น (ไม่ใช่ลิงก์ GitHub Pages หรือ Vercel)
        if (savedUrl && savedUrl.includes('script.google.com/macros/s/')) {
            AppState.googleScriptUrl = savedUrl;
        } else if (typeof DEFAULT_GAS_URL !== 'undefined' && DEFAULT_GAS_URL) {
            AppState.googleScriptUrl = DEFAULT_GAS_URL;
            localStorage.setItem('CMS_GAS_URL', DEFAULT_GAS_URL);
        }
    } catch (e) {
        console.error("Error loading settings:", e);
    }
}

// Save Settings to LocalStorage
function saveSettings() {
    try {
        localStorage.setItem('CMS_GAS_URL', AppState.googleScriptUrl || '');
    } catch (e) {
        console.error("Error saving settings:", e);
    }
}

// Load Data from LocalStorage or Seed Data (with Version Checking)
function loadData() {
    try {
        const savedVersion = localStorage.getItem('CMS_VERSION');
        const savedRooms = localStorage.getItem('CMS_ROOMS');
        const savedTimetable = localStorage.getItem('CMS_TIMETABLE');
        const savedBookings = localStorage.getItem('CMS_BOOKINGS');
        const savedMaintenance = localStorage.getItem('CMS_MAINTENANCE');

        // Check if version changed -> auto migrate to new room names and reset timetable
        if (savedVersion !== DATA_VERSION || !savedRooms) {
            AppState.rooms = DEFAULT_ROOMS;
            AppState.timetable = DEFAULT_TIMETABLE;
            AppState.bookings = DEFAULT_BOOKINGS;
            AppState.maintenance = DEFAULT_MAINTENANCE;
            saveData();
            localStorage.setItem('CMS_VERSION', DATA_VERSION);
        } else {
            AppState.rooms = JSON.parse(savedRooms);
            let parsedTt = null;
            try { parsedTt = savedTimetable ? JSON.parse(savedTimetable) : null; } catch(e) {}
            AppState.timetable = (parsedTt && Array.isArray(parsedTt) && parsedTt.length > 0) ? parsedTt : DEFAULT_TIMETABLE;
            AppState.bookings = savedBookings ? JSON.parse(savedBookings) : DEFAULT_BOOKINGS;
            AppState.maintenance = savedMaintenance ? JSON.parse(savedMaintenance) : DEFAULT_MAINTENANCE;
        }

        // ล้างข้อมูล mock / รายการจำลองเก่าที่อาจค้างอยู่ใน LocalStorage
        if (Array.isArray(AppState.bookings)) {
            AppState.bookings = AppState.bookings.filter(b => b.id !== 'BK-1001' && b.id !== 'BK-1002' && b.id !== 'BK-1003' && b.status !== 'cancelled');
            AppState.bookings.sort((a, b) => {
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (a.status !== 'pending' && b.status === 'pending') return 1;
                const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                if (timeA && timeB && timeA !== timeB) return timeB - timeA;
                return (b.date || '').localeCompare(a.date || '');
            });
        }
        if (Array.isArray(AppState.maintenance)) {
            AppState.maintenance = AppState.maintenance.filter(m => m.id !== 'MNT-001' && m.id !== 'MNT-002');
        }

        // รีเซ็ตสถานะห้องที่อาจติดสถานะ maintenance จากข้อมูลจำลอง
        if (AppState.rooms && Array.isArray(AppState.rooms)) {
            AppState.rooms.forEach(r => {
                if (r.status === 'maintenance') {
                    const hasActiveMnt = AppState.maintenance.some(m => m.roomId === r.id && m.status !== 'completed');
                    if (!hasActiveMnt) {
                        r.status = 'available';
                    }
                }
            });
        }

        // Safety guarantee: Timetable must always contain the 184 semester classes
        if (!AppState.timetable || !Array.isArray(AppState.timetable) || AppState.timetable.length === 0) {
            AppState.timetable = DEFAULT_TIMETABLE;
            saveData();
        }
    } catch (e) {
        console.error("Error loading data from localStorage:", e);
        AppState.rooms = DEFAULT_ROOMS;
        AppState.timetable = DEFAULT_TIMETABLE;
        AppState.bookings = DEFAULT_BOOKINGS;
        AppState.maintenance = DEFAULT_MAINTENANCE;
    }
}

// Save Data to LocalStorage
function saveData() {
    try {
        localStorage.setItem('CMS_VERSION', DATA_VERSION);
        localStorage.setItem('CMS_ROOMS', JSON.stringify(AppState.rooms));
        localStorage.setItem('CMS_TIMETABLE', JSON.stringify(AppState.timetable));
        localStorage.setItem('CMS_BOOKINGS', JSON.stringify(AppState.bookings));
        localStorage.setItem('CMS_MAINTENANCE', JSON.stringify(AppState.maintenance));
    } catch (e) {
        console.error("Failed to save data:", e);
    }
}

// Reset Data to Defaults
function resetData() {
    if (confirm('คุณต้องการรีเซ็ตข้อมูลห้องเรียนทั้งหมดกลับเป็นค่าเริ่มต้นใช่หรือไม่?')) {
        localStorage.removeItem('CMS_VERSION');
        localStorage.removeItem('CMS_ROOMS');
        localStorage.removeItem('CMS_TIMETABLE');
        localStorage.removeItem('CMS_BOOKINGS');
        localStorage.removeItem('CMS_MAINTENANCE');
        loadData();
        renderCurrentTab();
        showToast('รีเซ็ตข้อมูลห้องเรียนเรียบร้อยแล้ว', 'success');
    }
}

// Navigation & Tab Switching
function switchTab(tabId) {
    if (tabId === 'settings' && !AppState.isAdmin) {
        showToast('🔒 สิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น ไม่อนุญาตให้ผู้ใช้ทั่วไปเข้าถึง', 'warning');
        switchTab('dashboard');
        return;
    }
    AppState.currentTab = tabId;
    
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.dataset.tab === tabId) {
            link.classList.add('bg-blue-700', 'text-white', 'font-medium', 'shadow-sm');
            link.classList.remove('text-slate-200', 'hover:bg-slate-800');
        } else {
            link.classList.remove('bg-blue-700', 'text-white', 'font-medium', 'shadow-sm');
            link.classList.add('text-slate-200', 'hover:bg-slate-800');
        }
    });

    document.querySelectorAll('.mobile-nav-link').forEach(link => {
        if (link.dataset.tab === tabId) {
            link.classList.add('text-blue-600', 'font-bold');
            link.classList.remove('text-slate-500');
        } else {
            link.classList.remove('text-blue-600', 'font-bold');
            link.classList.add('text-slate-500');
        }
    });

    document.querySelectorAll('.view-section').forEach(section => {
        section.classList.add('hidden');
    });

    const targetSection = document.getElementById(`view-${tabId}`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }

    if (tabId === 'bookings' || tabId === 'maintenance' || tabId === 'dashboard' || tabId === 'reports' || AppState.isAdmin) {
        if (AppState.googleScriptUrl) {
            fetchDataFromGoogleSheets(true);
        }
    }

    renderCurrentTab();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderCurrentTab() {
    updateAdminPendingBadge();
    updateAdminMaintenanceBadge();
    lucide.createIcons();
    switch (AppState.currentTab) {
        case 'dashboard':
            renderDashboard();
            break;
        case 'rooms':
            renderRooms();
            break;
        case 'timetable':
            renderTimetable();
            break;
        case 'bookings':
            renderBookings();
            break;
        case 'maintenance':
            renderMaintenance();
            break;
        case 'reports':
            renderReportsView();
            break;
        case 'settings':
            renderSettings();
            break;
    }
    lucide.createIcons();
}

/**
 * แปลงวันที่เป็นรูปแบบ วัน เดือน ปี (พ.ศ.)
 * @param {string|Date} dateInput วันที่ เช่น "2026-09-09"
 * @param {boolean} includeDayName ใส่ชื่อวันด้วยหรือไม่ เช่น "วันพุธที่ 9 ก.ย. 2569"
 * @returns {string} เช่น "9 ก.ย. 2569" หรือ "วันพุธที่ 9 ก.ย. 2569"
 */
function formatThaiDate(dateInput, includeDayName = false) {
    if (!dateInput) return '-';
    try {
        let dateStr = String(dateInput).slice(0, 10);
        let year, month, day;
        if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            year = parseInt(parts[0]);
            month = parseInt(parts[1]) - 1;
            day = parseInt(parts[2]);
        } else if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            day = parseInt(parts[0]);
            month = parseInt(parts[1]) - 1;
            year = parseInt(parts[2]);
        } else {
            return dateStr;
        }

        if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;

        const d = new Date(year, month, day);
        const thaiYear = year > 2400 ? year : year + 543;
        const thaiMonthsShort = [
            'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
            'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
        ];
        const thaiDays = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

        const monthName = thaiMonthsShort[month] || '';
        const baseFormatted = `${day} ${monthName} ${thaiYear}`;

        if (includeDayName && !isNaN(d.getDay())) {
            return `วัน${thaiDays[d.getDay()]}ที่ ${baseFormatted}`;
        }
        return baseFormatted;
    } catch(e) {
        return String(dateInput);
    }
}

// Digital Clock & Date
function updateClock() {
    syncRoomStatusWithTimetable();
    const now = new Date();
    const timeElem = document.getElementById('current-time-display');
    const dateElem = document.getElementById('current-date-display');
    
    if (timeElem) {
        timeElem.textContent = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    if (dateElem) {
        const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        dateElem.textContent = `วัน${days[now.getDay()]}ที่ ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear() + 543}`;
    }
}

// ----------------------------------------------------
// 1. DASHBOARD VIEW
// ----------------------------------------------------
function renderDashboard() {
    const totalRooms = AppState.rooms.length;
    const generalRooms = AppState.rooms.filter(r => r.type === 'general');
    const comLabs = AppState.rooms.filter(r => r.type === 'computer_lab');
    const meetingRooms = AppState.rooms.filter(r => r.type === 'meeting_room');

    const availableCount = AppState.rooms.filter(r => r.status === 'available').length;
    const occupiedCount = AppState.rooms.filter(r => r.status === 'occupied').length;
    const reservedCount = AppState.rooms.filter(r => r.status === 'reserved').length;
    const maintenanceCount = AppState.rooms.filter(r => r.status === 'maintenance').length;

    document.querySelectorAll('.total-rooms-count').forEach(el => el.textContent = totalRooms);
    document.getElementById('dash-general-count').textContent = `${generalRooms.length} ห้อง`;
    document.getElementById('dash-lab-count').textContent = `${comLabs.length} ห้อง`;
    const meetingCountElem = document.getElementById('dash-meeting-count');
    if (meetingCountElem) meetingCountElem.textContent = `${meetingRooms.length} ห้อง`;
    
    document.getElementById('dash-available-count').textContent = availableCount;
    document.getElementById('dash-occupied-count').textContent = occupiedCount;
    document.getElementById('dash-reserved-count').textContent = reservedCount;
    document.getElementById('dash-maintenance-count').textContent = maintenanceCount;

    const utilizationRate = totalRooms > 0 ? Math.round(((occupiedCount + reservedCount) / totalRooms) * 100) : 0;
    document.getElementById('dash-utilization-rate').textContent = `${utilizationRate}%`;
    document.getElementById('dash-utilization-bar').style.width = `${utilizationRate}%`;

    const labGrid = document.getElementById('dash-lab-grid');
    if (labGrid) {
        labGrid.innerHTML = comLabs.map(lab => `
            <div class="bg-white rounded-xl p-4 border border-slate-200 hover:border-blue-400 transition-all shadow-sm">
                <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center gap-2">
                        <div class="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <i data-lucide="cpu" class="w-5 h-5"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-slate-800 text-sm leading-tight">${lab.name}</h4>
                            <p class="text-xs text-slate-500">${lab.floor || 'ศูนย์คอมพิวเตอร์'} • ${lab.pcCount} PCs</p>
                        </div>
                    </div>
                    ${getStatusBadge(lab.status)}
                </div>
                
                <div class="text-xs text-slate-600 space-y-1 my-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div class="flex justify-between">
                        <span class="text-slate-500">จำนวนเครื่อง PC:</span>
                        <span class="font-semibold text-slate-800">${lab.pcCount} เครื่อง</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-slate-500">สเปกหลัก:</span>
                        <span class="font-medium text-slate-700 truncate max-w-[150px]">${lab.specs ? `${(lab.specs.cpu || '').split(' ')[0]} ${(lab.specs.cpu || '').split(' ')[1] || ''} / ${lab.specs.ram || ''}` : 'สเปกมาตรฐาน'}</span>
                    </div>
                    ${lab.currentClass ? `
                    <div class="pt-1.5 mt-1.5 border-t border-slate-200 text-blue-700 font-medium">
                        <i data-lucide="book-open" class="w-3.5 h-3.5 inline mr-1"></i> ${lab.currentClass.subject}
                    </div>
                    ` : `
                    <div class="pt-1.5 mt-1.5 border-t border-slate-200 text-emerald-600 font-medium">
                        <i data-lucide="check-circle" class="w-3.5 h-3.5 inline mr-1"></i> พร้อมเปิดใช้งาน
                    </div>
                    `}
                </div>

                <div class="flex gap-1.5 mt-2">
                    <button onclick="openRoomDetailModal('${lab.id}')" class="flex-1 text-xs py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-center transition">
                        รายละเอียด
                    </button>
                    <button onclick="viewRoomTimetable('${lab.id}')" class="text-xs py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded-lg transition" title="ดูตารางการใช้ห้อง">
                        ตารางห้อง
                    </button>
                    <button onclick="openBookingModalForRoom('${lab.id}')" class="text-xs py-1.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition">
                        จอง
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderTodayActivity();
}

function renderTodayActivity() {
    const activityContainer = document.getElementById('dash-today-activity');
    if (!activityContainer) return;

    const activeRooms = AppState.rooms.filter(r => r.currentClass !== null);
    
    if (activeRooms.length === 0) {
        activityContainer.innerHTML = `
            <div class="text-center py-8 text-slate-400">
                <i data-lucide="coffee" class="w-10 h-10 mx-auto mb-2 opacity-50"></i>
                <p>ขณะนี้ยังไม่มีห้องเรียนที่กำลังใช้งาน</p>
            </div>
        `;
        return;
    }

    activityContainer.innerHTML = activeRooms.map(room => `
        <div class="flex items-start gap-4 p-3 bg-slate-50 hover:bg-blue-50/50 rounded-xl transition border border-slate-100">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xs ${room.type === 'computer_lab' ? 'bg-indigo-600 text-white' : 'bg-blue-600 text-white'} shadow-md shrink-0">
                ${room.name.replace('ห้องเรียน ', '').replace('ห้องปฏิบัติการ', 'LAB ')}
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2">
                    <h5 class="font-semibold text-slate-800 text-sm truncate">${room.currentClass.subject}</h5>
                    <span class="text-xs px-2 py-0.5 rounded-full font-medium ${room.status === 'occupied' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'}">
                        ${room.status === 'occupied' ? 'กำลังเรียน' : 'จองใช้งาน'}
                    </span>
                </div>
                <p class="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <i data-lucide="user" class="w-3.5 h-3.5"></i> ${room.currentClass.instructor}
                </p>
                <div class="flex items-center justify-between text-xs text-slate-500 mt-2 pt-2 border-t border-slate-200/60">
                    <span onclick="viewRoomTimetable('${room.id}')" class="flex items-center gap-1 font-medium text-slate-700 hover:text-blue-600 cursor-pointer transition" title="คลิกเพื่อดูตารางห้องนี้">
                        <i data-lucide="map-pin" class="w-3.5 h-3.5 text-blue-500"></i> ${room.name} (${room.floor || room.building}) ↗
                    </span>
                    <span class="flex items-center gap-1 text-blue-600 font-semibold bg-white px-2 py-0.5 rounded border border-slate-200">
                        <i data-lucide="clock" class="w-3.5 h-3.5"></i> ${room.currentClass.time}
                    </span>
                </div>
            </div>
        </div>
    `).join('');
}

// ----------------------------------------------------
// 2. ROOMS EXPLORER & FILTERING
// ----------------------------------------------------
function renderRooms() {
    const grid = document.getElementById('rooms-card-grid');
    if (!grid) return;

    let filtered = AppState.rooms.filter(room => {
        if (AppState.selectedRoomType !== 'all' && room.type !== AppState.selectedRoomType) {
            return false;
        }
        if (AppState.statusFilter !== 'all' && room.status !== AppState.statusFilter) {
            return false;
        }
        if (AppState.buildingFilter !== 'all') {
            const matchFloor = room.floor && room.floor.includes(AppState.buildingFilter);
            const matchBuilding = room.building && room.building.includes(AppState.buildingFilter);
            if (!matchFloor && !matchBuilding) return false;
        }
        if (AppState.searchQuery) {
            const query = AppState.searchQuery.toLowerCase();
            const matchName = room.name.toLowerCase().includes(query);
            const matchId = room.id.toLowerCase().includes(query);
            const matchDesc = room.description ? room.description.toLowerCase().includes(query) : false;
            const matchFacilities = room.facilities ? room.facilities.some(f => f.toLowerCase().includes(query)) : false;
            const matchSubject = room.currentClass && (room.currentClass.subject.toLowerCase().includes(query) || room.currentClass.instructor.toLowerCase().includes(query));
            return matchName || matchId || matchDesc || matchFacilities || matchSubject;
        }
        return true;
    });

    const countBadge = document.getElementById('filtered-room-count');
    if (countBadge) {
        countBadge.textContent = `พบ ${filtered.length} จากทั้งหมด ${AppState.rooms.length} ห้อง`;
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
                <i data-lucide="search-x" class="w-16 h-16 mx-auto text-slate-300 mb-3"></i>
                <h3 class="text-lg font-bold text-slate-700">ไม่พบห้องเรียนที่ตรงกับเงื่อนไข</h3>
                <p class="text-slate-500 text-sm mt-1">ลองเปลี่ยนคำค้นหา หรือรีเซ็ตตัวกรองด้านบน</p>
                <button onclick="resetFilters()" class="mt-4 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-semibold transition">
                    ล้างตัวกรองทั้งหมด
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(room => {
        const isLab = room.type === 'computer_lab';
        return `
            <div class="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm card-hover flex flex-col justify-between">
                <div>
                    <div class="relative h-32 bg-slate-800 overflow-hidden">
                        <img src="${room.image || 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600&auto=format&fit=crop&q=60'}" alt="${room.name}" class="w-full h-full object-cover opacity-60 hover:scale-105 transition-all duration-500">
                        <div class="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/30 to-transparent"></div>
                        
                        <div class="absolute top-3 left-3 flex gap-1.5 flex-wrap">
                            <span class="px-2.5 py-0.5 rounded-md text-xs font-semibold ${isLab ? 'bg-indigo-600 text-white' : room.type === 'meeting_room' ? 'bg-amber-600 text-white' : 'bg-slate-700/80 text-white backdrop-blur'}">
                                ${isLab ? '💻 ห้องแล็บคอมพิวเตอร์' : room.type === 'meeting_room' ? '🏛️ ห้องประชุม' : '📖 ห้องเรียน'}
                            </span>
                        </div>
                        <div class="absolute top-3 right-3">
                            ${getStatusBadge(room.status)}
                        </div>

                        <div class="absolute bottom-3 left-3 right-3 text-white">
                            <h3 class="text-lg font-bold drop-shadow-sm flex items-center justify-between">
                                <span>${room.name}</span>
                                <span class="text-xs font-normal bg-black/40 px-2 py-0.5 rounded backdrop-blur">${room.floor}</span>
                            </h3>
                            <p class="text-xs text-slate-300 flex items-center gap-1">
                                <i data-lucide="building" class="w-3.5 h-3.5"></i> ${room.building}
                            </p>
                        </div>
                    </div>

                    <div class="p-4 space-y-3">
                        <div class="grid grid-cols-2 gap-2 text-xs">
                            <div class="bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center gap-2">
                                <i data-lucide="users" class="w-4 h-4 text-blue-500"></i>
                                <div>
                                    <div class="text-slate-400">ความจุ</div>
                                    <div class="font-bold text-slate-700">${room.capacity} ที่นั่ง</div>
                                </div>
                            </div>
                            <div class="bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center gap-2">
                                <i data-lucide="${isLab ? 'monitor' : 'tv'}" class="w-4 h-4 ${isLab ? 'text-indigo-500' : 'text-amber-500'}"></i>
                                <div>
                                    <div class="text-slate-400">${isLab ? 'จำนวนเครื่อง PC' : 'อุปกรณ์เด่น'}</div>
                                    <div class="font-bold text-slate-700">${isLab ? `${room.pcCount} เครื่อง` : (room.facilities ? room.facilities[0] : 'มาตรฐาน')}</div>
                                </div>
                            </div>
                        </div>

                        ${room.currentClass ? `
                            <div onclick="viewRoomTimetable('${room.id}')" class="p-2.5 rounded-xl bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200/70 text-xs cursor-pointer transition" title="คลิกเพื่อดูตารางห้องนี้">
                                <div class="font-semibold text-amber-900 flex items-center justify-between">
                                    <span class="flex items-center gap-1"><i data-lucide="clock" class="w-3.5 h-3.5 text-amber-600"></i> ${room.currentClass.time}</span>
                                    <span class="text-[10px] bg-amber-200/80 text-amber-900 font-bold px-1.5 py-0.5 rounded">กำลังเรียน (ดูตาราง ↗)</span>
                                </div>
                                <div class="font-medium text-slate-800 mt-1 truncate">${room.currentClass.subject}</div>
                                <div class="text-slate-500 text-[11px] mt-0.5">${room.currentClass.instructor}</div>
                            </div>
                        ` : room.status === 'maintenance' ? `
                            <div class="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                                <div class="font-bold flex items-center gap-1">
                                    <i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> กำลังปรับปรุงอุปกรณ์
                                </div>
                                <div class="text-[11px] mt-0.5 text-red-600 truncate">${room.description || 'อยู่ระหว่างซ่อมบำรุง'}</div>
                            </div>
                        ` : `
                            <div class="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/70 text-xs text-emerald-800 space-y-1">
                                <div class="flex items-center justify-between">
                                    <span class="flex items-center gap-1.5 font-bold">
                                        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> ห้องว่าง พร้อมใช้งาน
                                    </span>
                                    <button onclick="openBookingModalForRoom('${room.id}')" class="text-[11px] px-2 py-0.5 bg-emerald-600 text-white rounded font-semibold hover:bg-emerald-700 transition">
                                        จองห้องนี้
                                    </button>
                                </div>
                                ${room.nextClass ? `
                                    <div class="text-[11px] text-emerald-700/90 pt-1 border-t border-emerald-200 flex items-center gap-1 truncate">
                                        <i data-lucide="clock" class="w-3 h-3 shrink-0"></i> คาบถัดไป: <b>${room.nextClass.time}</b> (${room.nextClass.subject.split(' ')[0]})
                                    </div>
                                ` : `
                                    <div class="text-[10px] text-emerald-600/80 pt-1 border-t border-emerald-200">
                                        ไม่มีคาบเรียนอื่นในวันนี้
                                    </div>
                                `}
                            </div>
                        `}

                        <div class="flex flex-wrap gap-1 pt-1">
                            ${room.facilities ? room.facilities.slice(0, 3).map(f => `
                                <span class="text-[11px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-medium">
                                    ${f}
                                </span>
                            `).join('') : ''}
                        </div>
                    </div>
                </div>

                <div class="p-4 pt-0 border-t border-slate-100 mt-2 flex flex-wrap gap-1.5">
                    <button onclick="openRoomDetailModal('${room.id}')" class="flex-1 py-2 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs flex items-center justify-center gap-1 transition">
                        <i data-lucide="info" class="w-3.5 h-3.5"></i> รายละเอียด
                    </button>
                    <button onclick="viewRoomTimetable('${room.id}')" class="py-2 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded-xl text-xs flex items-center justify-center gap-1 border border-indigo-200 transition" title="ดูตารางเรียน / การใช้ห้อง">
                        <i data-lucide="calendar" class="w-3.5 h-3.5"></i> ตาราง
                    </button>
                    <button onclick="openBookingModalForRoom('${room.id}')" class="py-2 px-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-1 shadow-sm shadow-blue-200 transition">
                        <i data-lucide="calendar-plus" class="w-3.5 h-3.5"></i> จอง
                    </button>
                    ${AppState.isAdmin ? `
                        <button onclick="openEditRoomModal('${room.id}')" class="p-2 bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium rounded-xl text-xs flex items-center justify-center border border-amber-200 transition" title="แก้ไขสเปกและข้อมูลห้อง (Admin)">
                            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                        </button>
                        <button onclick="deleteRoom('${room.id}')" class="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium rounded-xl text-xs flex items-center justify-center border border-rose-200 transition" title="ลบห้องนี้ (Admin)">
                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// ----------------------------------------------------
// 3. WEEKLY TIMETABLE MATRIX
// ----------------------------------------------------
function renderTimetable() {
    const roomSelect = document.getElementById('timetable-room-selector');
    if (roomSelect) {
        populateRoomOptions(roomSelect, true);
        roomSelect.value = AppState.selectedRoomForSchedule;
    }

    const instSelect = document.getElementById('timetable-instructor-selector');
    if (instSelect) {
        populateInstructorOptions(instSelect);
        instSelect.value = AppState.selectedInstructorForSchedule;
    }

    const container = document.getElementById('timetable-content-view');
    if (!container) return;

    // If an instructor is selected, render instructor schedule
    if (AppState.selectedInstructorForSchedule && AppState.selectedInstructorForSchedule !== 'ALL') {
        container.innerHTML = renderInstructorSchedule(AppState.selectedInstructorForSchedule);
        lucide.createIcons();
        return;
    }

    const days = [
        { name: 'จันทร์', index: 1 },
        { name: 'อังคาร', index: 2 },
        { name: 'พุธ', index: 3 },
        { name: 'พฤหัสบดี', index: 4 },
        { name: 'ศุกร์', index: 5 },
        { name: 'เสาร์', index: 6 },
        { name: 'อาทิตย์', index: 0 }
    ];

    if (AppState.selectedRoomForSchedule === 'ALL') {
        container.innerHTML = `
            <div class="space-y-6">
                <div class="flex gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
                    ${days.map(d => `
                        <button onclick="setScheduleDay(${d.index})" class="px-5 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition ${AppState.selectedDayIndex === d.index ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}">
                            วัน${d.name}
                        </button>
                    `).join('')}
                </div>

                <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div class="flex items-center justify-between mb-4">
                        <h4 class="font-bold text-slate-800 text-base flex items-center gap-2">
                            <i data-lucide="calendar" class="w-5 h-5 text-blue-600"></i>
                            ตารางการใช้ห้องเรียนประจำวัน${days.find(d => d.index === AppState.selectedDayIndex)?.name} (ภาคการศึกษา 1/2569)
                        </h4>
                        <span class="text-xs text-slate-500">แสดงรายการวิชาและอาจารย์ผู้สอนทั้งหมด</span>
                    </div>

                    ${renderScheduleListForDay(AppState.selectedDayIndex)}
                </div>
            </div>
        `;
    } else {
        const room = AppState.rooms.find(r => r.id === AppState.selectedRoomForSchedule);
        if (!room) return;

        const roomSchedules = AppState.timetable.filter(s => s.roomId === room.id);

        container.innerHTML = `
            <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
                    <div class="flex items-center gap-3">
                        <div class="p-3 rounded-2xl ${room.type === 'computer_lab' ? 'bg-indigo-600 text-white' : 'bg-blue-600 text-white'} font-bold">
                            ${room.name}
                        </div>
                        <div>
                            <h3 class="text-lg font-bold text-slate-800">${room.name}</h3>
                            <p class="text-xs text-slate-500">${room.categoryName} • ${room.floor || room.building} • ความจุ ${room.capacity} ที่นั่ง</p>
                        </div>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                        ${AppState.isAdmin ? `
                            <button onclick="openAddTimetableModal('${room.id}', '', '08:20', '12:20')" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition">
                                <i data-lucide="plus-circle" class="w-4 h-4"></i> เพิ่มคาบเรียน
                            </button>
                        ` : ''}
                        <button onclick="openRoomDetailModal('${room.id}')" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition">
                            <i data-lucide="info" class="w-4 h-4"></i> รายละเอียดห้อง
                        </button>
                        <button onclick="window.print()" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition">
                            <i data-lucide="printer" class="w-4 h-4"></i> พิมพ์ตารางเรียน
                        </button>
                        <button onclick="openBookingModalForRoom('${room.id}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition">
                            <i data-lucide="calendar-plus" class="w-4 h-4"></i> จองห้องนี้
                        </button>
                    </div>
                </div>

                <div class="overflow-x-auto mt-6">
                    <table class="w-full border-collapse text-xs">
                        <thead>
                            <tr class="bg-slate-800 text-white">
                                <th class="p-3 border border-slate-700 w-28 text-center">วัน / เวลา</th>
                                <th class="p-3 border border-slate-700 text-center min-w-[220px]">ช่วงเช้า (08:20 - 12:20)</th>
                                <th class="p-3 border border-slate-700 text-center bg-slate-900/50 w-24">พักกลางวัน<br>(12:20-13:20)</th>
                                <th class="p-3 border border-slate-700 text-center min-w-[220px]">ช่วงบ่าย (13:20 - 17:20)</th>
                                <th class="p-3 border border-slate-700 text-center min-w-[180px]">ช่วงเย็น / นอกเวลา (17:20 - 21:00)</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${days.map(day => {
                                const dayItems = roomSchedules.filter(s => s.dayIndex === day.index);
                                const morningItems = dayItems.filter(s => {
                                    const hour = parseInt(s.startTime.split(':')[0]);
                                    return hour < 12;
                                });
                                const afternoonItems = dayItems.filter(s => {
                                    const hour = parseInt(s.startTime.split(':')[0]);
                                    return hour >= 12 && hour < 17;
                                });
                                const eveningItems = dayItems.filter(s => {
                                    const hour = parseInt(s.startTime.split(':')[0]);
                                    return hour >= 17;
                                });

                                return `
                                    <tr class="hover:bg-slate-50">
                                        <td class="p-3 border border-slate-200 font-bold bg-slate-50 text-slate-700 text-center">
                                            วัน${day.name}
                                        </td>
                                        <td class="p-2 border border-slate-200 align-top">
                                            ${morningItems.length > 0 ? `
                                                <div class="space-y-2">
                                                    ${morningItems.map(item => `
                                                        <div class="p-2.5 rounded-xl tag-${item.color || 'blue'} shadow-sm relative group transition hover:shadow-md">
    <div class="flex items-start justify-between gap-1">
        <div class="font-bold text-xs flex-1">${item.subject}</div>
        ${AppState.isAdmin ? `
            <div class="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition shrink-0">
                <button onclick="event.stopPropagation(); openEditTimetableModal('${item.id}')" class="p-1 hover:bg-white/60 rounded text-slate-700 transition" title="แก้ไขคาบเรียน">
                    <i data-lucide="edit-2" class="w-3 h-3"></i>
                </button>
                <button onclick="event.stopPropagation(); deleteTimetable('${item.id}')" class="p-1 hover:bg-rose-100 rounded text-rose-600 transition" title="ลบคาบเรียน">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>
        ` : ''}
    </div>
    <div class="text-[11px] opacity-90 mt-1">${item.instructor}</div>
    <div class="text-[10px] opacity-75">${item.group || ''}</div>
    <div class="text-[10px] font-semibold mt-1 flex items-center gap-1">
        <i data-lucide="clock" class="w-3 h-3"></i> ${item.startTime} - ${item.endTime} น.
    </div>
</div>
                                                    `).join('')}
                                                </div>
                                            ` : `
                                                <div class="p-3 text-center text-slate-400 font-medium border border-dashed border-slate-200 rounded-xl hover:border-blue-400 cursor-pointer text-[11px]" onclick="openBookingModalWithPrefill('${room.id}', '${day.name}', '08:20', '12:20')">
                                                    + ว่าง (คลิกเพื่อจอง)
                                                </div>
                                            `}
                                        </td>
                                        <td class="p-2 border border-slate-200 text-center text-slate-400 bg-slate-100/50 text-[11px] align-middle">
                                            พักเที่ยง
                                        </td>
                                        <td class="p-2 border border-slate-200 align-top">
                                            ${afternoonItems.length > 0 ? `
                                                <div class="space-y-2">
                                                    ${afternoonItems.map(item => `
                                                        <div class="p-2.5 rounded-xl tag-${item.color || 'blue'} shadow-sm relative group transition hover:shadow-md">
    <div class="flex items-start justify-between gap-1">
        <div class="font-bold text-xs flex-1">${item.subject}</div>
        ${AppState.isAdmin ? `
            <div class="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition shrink-0">
                <button onclick="event.stopPropagation(); openEditTimetableModal('${item.id}')" class="p-1 hover:bg-white/60 rounded text-slate-700 transition" title="แก้ไขคาบเรียน">
                    <i data-lucide="edit-2" class="w-3 h-3"></i>
                </button>
                <button onclick="event.stopPropagation(); deleteTimetable('${item.id}')" class="p-1 hover:bg-rose-100 rounded text-rose-600 transition" title="ลบคาบเรียน">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>
        ` : ''}
    </div>
    <div class="text-[11px] opacity-90 mt-1">${item.instructor}</div>
    <div class="text-[10px] opacity-75">${item.group || ''}</div>
    <div class="text-[10px] font-semibold mt-1 flex items-center gap-1">
        <i data-lucide="clock" class="w-3 h-3"></i> ${item.startTime} - ${item.endTime} น.
    </div>
</div>
                                                    `).join('')}
                                                </div>
                                            ` : `
                                                <div class="p-3 text-center text-slate-400 font-medium border border-dashed border-slate-200 rounded-xl hover:border-blue-400 cursor-pointer text-[11px]" onclick="openBookingModalWithPrefill('${room.id}', '${day.name}', '13:20', '17:20')">
                                                    + ว่าง (คลิกเพื่อจอง)
                                                </div>
                                            `}
                                        </td>
                                        <td class="p-2 border border-slate-200 align-top">
                                            ${eveningItems.length > 0 ? `
                                                <div class="space-y-2">
                                                    ${eveningItems.map(item => `
                                                        <div class="p-2.5 rounded-xl tag-${item.color || 'blue'} shadow-sm relative group transition hover:shadow-md">
    <div class="flex items-start justify-between gap-1">
        <div class="font-bold text-xs flex-1">${item.subject}</div>
        ${AppState.isAdmin ? `
            <div class="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition shrink-0">
                <button onclick="event.stopPropagation(); openEditTimetableModal('${item.id}')" class="p-1 hover:bg-white/60 rounded text-slate-700 transition" title="แก้ไขคาบเรียน">
                    <i data-lucide="edit-2" class="w-3 h-3"></i>
                </button>
                <button onclick="event.stopPropagation(); deleteTimetable('${item.id}')" class="p-1 hover:bg-rose-100 rounded text-rose-600 transition" title="ลบคาบเรียน">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>
        ` : ''}
    </div>
    <div class="text-[11px] opacity-90 mt-1">${item.instructor}</div>
    <div class="text-[10px] opacity-75">${item.group || ''}</div>
    <div class="text-[10px] font-semibold mt-1 flex items-center gap-1">
        <i data-lucide="clock" class="w-3 h-3"></i> ${item.startTime} - ${item.endTime} น.
    </div>
</div>
                                                    `).join('')}
                                                </div>
                                            ` : `
                                                <div class="p-3 text-center text-slate-300 font-medium border border-dashed border-slate-100 rounded-xl hover:border-blue-400 cursor-pointer text-[10px]" onclick="openBookingModalWithPrefill('${room.id}', '${day.name}', '17:20', '20:00')">
                                                    + ว่าง
                                                </div>
                                            `}
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
}

function renderScheduleListForDay(dayIndex) {
    const daySchedules = AppState.timetable.filter(s => s.dayIndex === dayIndex);
    
    if (daySchedules.length === 0) {
        return `
            <div class="text-center py-10 text-slate-400">
                <i data-lucide="calendar-x" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
                <p>ไม่มีตารางการใช้ห้องในวันนี้</p>
            </div>
        `;
    }

    return `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${daySchedules.map(item => {
                const room = AppState.rooms.find(r => r.id === item.roomId) || { name: item.roomId, building: '', type: 'general' };
                const isLab = room.type === 'computer_lab';

                return `
                    <div class="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-400 transition-all shadow-sm flex items-start gap-3">
                        <div class="p-2.5 rounded-xl ${isLab ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'} shrink-0">
                            <i data-lucide="${isLab ? 'cpu' : 'book-open'}" class="w-6 h-6"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center justify-between gap-2">
                                <button onclick="viewRoomTimetable('${room.id}')" class="text-xs font-bold ${isLab ? 'text-indigo-600 hover:text-indigo-800' : 'text-blue-600 hover:text-blue-800'} bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded cursor-pointer transition flex items-center gap-0.5" title="ดูตารางสัปดาห์ของห้องนี้">
                                    ${room.name} ↗
                                </button>
                                <span class="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                                    ${item.startTime} - ${item.endTime} น.
                                </span>
                            </div>
                            <h5 class="font-bold text-slate-800 text-sm mt-1.5 truncate">${item.subject}</h5>
                            <p class="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                <i data-lucide="user" class="w-3.5 h-3.5"></i> ${item.instructor}
                            </p>
                            <div class="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
                                <span>${room.floor || room.building}</span>
                                <span>${item.group || 'ภาคปกติ'}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function setScheduleDay(dayIndex) {
    AppState.selectedDayIndex = dayIndex;
    renderTimetable();
}

// ----------------------------------------------------
// 4. BOOKINGS MANAGEMENT & CONFLICT CHECKER
// ----------------------------------------------------
function renderBookings() {
    const listContainer = document.getElementById('bookings-table-body');
    if (!listContainer) return;

    // Update Stats
    const totalCount = AppState.bookings.length;
    const approvedCount = AppState.bookings.filter(b => b.status === 'approved').length;
    const pendingCount = AppState.bookings.filter(b => b.status === 'pending').length;

    
    // Update Cloud Sync Banner in Bookings View
    const cloudBanner = document.getElementById('bookings-cloud-sync-banner');
    if (cloudBanner) {
        if (AppState.isGoogleConnected || AppState.googleScriptUrl) {
            cloudBanner.innerHTML = `
                <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
                    <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span><b>ระบบเชื่อมต่อ Google Sheets ส่วนกลางแล้ว:</b> ข้อมูลการจองจากทุกคนจะซิงก์เข้าสู่ระบบเรียลไทม์ และ Admin จะเห็นข้อมูลทันที</span>
                    </div>
                    <button onclick="fetchDataFromGoogleSheets(false)" class="px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded font-semibold text-emerald-700 transition">
                        ดึงข้อมูลล่าสุด
                    </button>
                </div>
            `;
        } else {
            cloudBanner.innerHTML = `
                <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
                    <div class="flex items-center gap-2">
                        <i data-lucide="alert-circle" class="w-4 h-4 text-amber-600 shrink-0"></i>
                        <span><b>เหตุผลที่ Admin ยังไม่เห็นข้อมูลจากเครื่องอื่น:</b> ระบบยังไม่ได้ใส่ URL เว็บแอป Google Sheets ทำให้ข้อมูลการจองถูกบันทึกค้างไว้เฉพาะในเครื่องของคนจอง (LocalStorage)</span>
                    </div>
                    <button onclick="switchTab('settings')" class="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition shrink-0">
                        ใส่ URL เชื่อมต่อคลาวด์
                    </button>
                </div>
            `;
        }
    }

    const totalElem = document.getElementById('bookings-stat-total');
    if (totalElem) totalElem.textContent = totalCount;
    const appElem = document.getElementById('bookings-stat-approved');
    if (appElem) appElem.textContent = approvedCount;
    const penElem = document.getElementById('bookings-stat-pending');
    if (penElem) penElem.textContent = pendingCount;

    // Update Pending Badge in Admin Header
    const adminPendingBadge = document.getElementById('admin-pending-count-badge');
    if (adminPendingBadge) {
        if (pendingCount > 0) {
            adminPendingBadge.textContent = pendingCount;
            adminPendingBadge.classList.remove('hidden');
        } else {
            adminPendingBadge.classList.add('hidden');
        }
    }

    let displayedBookings = (AppState.bookings || []).filter(b => b.id && b.date && b.startTime);
    if (AppState.bookingFilterStatus === 'approved') {
        displayedBookings = displayedBookings.filter(b => b.status === 'approved');
    } else if (AppState.bookingFilterStatus === 'pending') {
        displayedBookings = displayedBookings.filter(b => b.status === 'pending');
    } else if (AppState.bookingFilterStatus === 'cancelled') {
        displayedBookings = displayedBookings.filter(b => b.status === 'cancelled');
    } else {
        // ค่าเริ่มต้น 'all' จะแสดงรายการที่ใช้งานอยู่ (รออนุมัติ + อนุมัติแล้ว) โดยนำรายการรออนุมัติไว้บนสุดเสมอ
        displayedBookings = displayedBookings.filter(b => b.status !== 'cancelled');
    }

    // จัดเรียงข้อมูล: ปักหมุดคำขอรออนุมัติ (pending) ไว้ด้านบนสุดเสมอ ตามด้วยรายการจองล่าสุด
    displayedBookings.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA && timeB && timeA !== timeB) return timeB - timeA;
        return (b.date || '').localeCompare(a.date || '');
    });

    if (displayedBookings.length === 0) {
        listContainer.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-12 text-slate-400">
                    <i data-lucide="calendar-x" class="w-12 h-12 mx-auto mb-2 opacity-40"></i>
                    <p class="font-medium">ไม่พบรายการจองห้องในหมวดหมู่นี้</p>
                    <p class="text-[11px] text-slate-400 mt-1">ทุกคนสามารถกดปุ่ม "+ จองห้องเรียน" ด้านบนเพื่อขอใช้ห้องได้ทันที</p>
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }

    listContainer.innerHTML = displayedBookings.map(bk => {
        const strRoomId = String(bk.roomId || '');
        const dotColor = strRoomId.startsWith('LAB') ? 'bg-indigo-500' : strRoomId.startsWith('CONF') ? 'bg-amber-500' : 'bg-blue-500';
        return `
        <tr class="border-b border-slate-100 hover:bg-slate-50/80 text-xs transition">
            <td class="p-3 font-semibold text-slate-500">${bk.id}</td>
            <td class="p-3 font-bold text-slate-800">
                <div class="flex items-center gap-1.5">
                    <span class="w-2.5 h-2.5 rounded-full ${dotColor}"></span>
                    <span>${bk.roomName}</span>
                </div>
            </td>
            <td class="p-3">
                <div class="font-bold text-slate-800 flex items-center gap-1.5">
                    <i data-lucide="calendar" class="w-3.5 h-3.5 text-blue-500"></i>
                    <span>${formatThaiDate(bk.date, true)}</span>
                </div>
                <div class="text-blue-600 font-semibold text-[11px] flex items-center gap-1 mt-0.5 ml-5">
                    <i data-lucide="clock" class="w-3 h-3"></i> ${bk.startTime} - ${bk.endTime} น.
                </div>
            </td>
            <td class="p-3 font-medium text-slate-800 max-w-[200px]">
                <div class="truncate font-semibold">${bk.subject}</div>
                <div class="text-slate-400 text-[11px] truncate">${bk.purpose || '-'}</div>
            </td>
            <td class="p-3">
                <div class="font-semibold text-slate-800 flex items-center gap-1">
                    <i data-lucide="user" class="w-3 h-3 text-slate-400"></i> ${bk.bookerName}
                </div>
                <div class="text-slate-500 text-[11px] mt-0.5">${bk.department}</div>
            </td>
            <td class="p-3">
                ${getBookingStatusBadge(bk.status)}
            </td>
            <td class="p-3 text-right">
                <div class="flex items-center justify-end gap-1.5">
                    ${AppState.isAdmin ? `
                        ${bk.status === 'pending' ? `
                            <button onclick="approveBooking('${bk.id}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-xs transition" title="อนุมัติการจอง">
                                <i data-lucide="check" class="w-3.5 h-3.5"></i> อนุมัติ
                            </button>
                            <button onclick="rejectBooking('${bk.id}')" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition" title="ไม่อนุมัติ">
                                <i data-lucide="x" class="w-3.5 h-3.5"></i> ปฏิเสธ
                            </button>
                        ` : ''}
                        <button onclick="cancelBooking('${bk.id}')" title="ลบรายการจอง" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    ` : `
                        <span class="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                            ${bk.status === 'approved' ? 'จองสำเร็จ' : 'รอตรวจสอบ'}
                        </span>
                    `}
                </div>
            </td>
        </tr>
        `;
    }).join('');
    lucide.createIcons();
}

function checkBookingConflict(roomId, dateStr, startTime, endTime, excludeBookingId = null) {
    const conflictingBooking = AppState.bookings.find(b => {
        if (excludeBookingId && b.id === excludeBookingId) return false;
        if (b.status === 'cancelled') return false;
        if (b.roomId !== roomId || b.date !== dateStr) return false;
        return (startTime < b.endTime) && (endTime > b.startTime);
    });

    if (conflictingBooking) {
        return {
            hasConflict: true,
            reason: `ห้องนี้ถูกจองแล้วในวันที่ ${formatThaiDate(dateStr, true)} เวลา ${conflictingBooking.startTime} - ${conflictingBooking.endTime} น. โดย ${conflictingBooking.bookerName} (${conflictingBooking.subject})`
        };
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    const bookingDate = new Date(year, month - 1, day);
    const dayIndex = bookingDate.getDay();

    const conflictingTimetable = AppState.timetable.find(s => {
        if (s.roomId !== roomId || s.dayIndex !== dayIndex) return false;
        return (startTime < s.endTime) && (endTime > s.startTime);
    });

    if (conflictingTimetable) {
        return {
            hasConflict: true,
            reason: `มีตารางเรียนประจำในวันดังกล่าว: วิชา "${conflictingTimetable.subject}" เวลา ${conflictingTimetable.startTime} - ${conflictingTimetable.endTime} น. (ผู้สอน: ${conflictingTimetable.instructor})`
        };
    }

    const room = AppState.rooms.find(r => r.id === roomId);
    if (room && room.status === 'maintenance') {
        return {
            hasConflict: true,
            reason: `ห้อง ${room.name} อยู่ระหว่างปิดปรับปรุง / ซ่อมแซม ไม่สามารถจองใช้งานได้ในขณะนี้`
        };
    }

    return { hasConflict: false };
}

async function handleBookingSubmit(event) {
    event.preventDefault();
    const form = event.target;

    const roomId = form.roomId.value;
    const dateStr = form.date.value;
    const startTime = form.startTime.value;
    const endTime = form.endTime.value;
    const subject = form.subject.value.trim();
    const bookerName = form.bookerName.value.trim();
    const department = form.department ? form.department.value.trim() : 'ทั่วไป';
    const phone = form.phone ? form.phone.value.trim() : '';
    const purpose = form.purpose ? form.purpose.value.trim() : '';

    if (startTime >= endTime) {
        showToast('เวลาเริ่มต้นต้องน้อยกว่าเวลาสิ้นสุด', 'error');
        return;
    }

    const conflictResult = checkBookingConflict(roomId, dateStr, startTime, endTime);
    if (conflictResult.hasConflict) {
        showToast(`❌ ไม่สามารถจองห้องได้เนื่องจากเวลาชนกัน: ${conflictResult.reason}`, 'error', 6000);
        return;
    }

    const room = AppState.rooms.find(r => r.id === roomId);
    // Booking Status: Defaults to 'pending' so Admin always sees incoming requests to review.
    // If Admin explicitly checked 'autoApprove' in modal, then set to 'approved'.
    let initialStatus = 'pending';
    if (AppState.isAdmin && event.target.autoApprove && event.target.autoApprove.checked) {
        initialStatus = 'approved';
    }

    const fullDept = department + (phone ? ` (โทร. ${phone})` : '');
    const cleanSubject = (subject || purpose || 'ขอใช้ห้องเรียน/ห้องปฏิบัติการ').trim();
    const cleanPurpose = (purpose || subject || '').trim();
    const newBooking = {
        id: `BK-${Math.floor(1000 + Math.random() * 9000)}`,
        roomId: roomId,
        roomName: room ? room.name : roomId,
        date: dateStr,
        startTime: startTime,
        endTime: endTime,
        subject: cleanSubject,
        purpose: cleanPurpose,
        bookerName: bookerName,
        reservedBy: bookerName,
        reservedby: bookerName,
        department: fullDept,
        phone: phone,
        status: initialStatus,
        createdAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
    };

    AppState.bookings.unshift(newBooking);
    
    const todayStr = new Date().toISOString().slice(0, 10);
    if (initialStatus === 'approved' && dateStr === todayStr && room) {
        room.status = 'reserved';
        room.currentClass = {
            subject: subject,
            instructor: bookerName,
            time: `${startTime} - ${endTime} น.`,
            group: fullDept
        };
    }

    saveData();
    closeModal('modal-booking');
    renderCurrentTab();
    broadcastDataChange('ADD_BOOKING', { booking: newBooking });

    // Instant on-screen confirmation for user
    if (initialStatus === 'approved') {
        showToast(`✅ บันทึกการจองห้อง ${room ? room.name : ''} (อนุมัติทันที) เรียบร้อยแล้ว!`, 'success', 5000);
    } else {
        showToast(`✅ ส่งคำขอจองห้องเรียบร้อยแล้ว!<br><span class="text-[11px] text-slate-300">รหัสจอง: <b>${newBooking.id}</b> • ห้อง: <b>${room ? room.name : roomId}</b> (${formatThaiDate(dateStr, true)} เวลา ${startTime}-${endTime} น.)<br>สถานะ: 🟡 รอ Admin ตรวจสอบอนุมัติ (บันทึกเข้าระบบทันทีแล้ว)</span>`, 'success', 5500);
    }

    // Sync to Google Sheets central backend
    sendActionToGoogleBackend('addBooking', { booking: newBooking });
}

function approveBooking(bookingId) {
    if (!AppState.isAdmin) {
        showToast('สิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น', 'warning');
        return;
    }
    const booking = AppState.bookings.find(b => b.id === bookingId);
    if (booking) {
        booking.status = 'approved';
        saveData();
        updateAdminPendingBadge();
        renderBookings();
        showToast(`อนุมัติคำขอจอง ${bookingId} เรียบร้อยแล้ว`, 'success');
        broadcastDataChange('APPROVE_BOOKING', { id: bookingId });
        sendActionToGoogleBackend('approveBooking', { id: bookingId });
    }
}

function cancelBooking(bookingId) {
    if (!AppState.isAdmin) {
        showToast('สิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น', 'warning');
        return;
    }
    if (confirm(`คุณต้องการลบรายการจอง ${bookingId} ใช่หรือไม่?\n(ข้อมูลจะถูกลบออกจากทั้งฝั่ง Admin และฝั่งผู้ใช้งานทันที)`)) {
        AppState.bookings = AppState.bookings.filter(b => b.id !== bookingId);
        saveData();
        updateAdminPendingBadge();
        renderBookings();
        showToast('ลบรายการจองสำเร็จ (ข้อมูลฝั่งผู้ใช้ถูกอัปเดตแล้ว)', 'success');
        broadcastDataChange('DELETE_BOOKING', { id: bookingId });
        sendActionToGoogleBackend('cancelBooking', { id: bookingId });
    }
}

// ----------------------------------------------------
// 5. MAINTENANCE SYSTEM & EQUIPMENT CATEGORIES
// ----------------------------------------------------
const MAINTENANCE_CATEGORIES = {
    projector: { name: 'เครื่องโปรเจกเตอร์', icon: 'projector', emoji: '📽️', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
    air: { name: 'เครื่องปรับอากาศ', icon: 'wind', emoji: '❄️', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' },
    computer: { name: 'เครื่องคอมพิวเตอร์ / PC', icon: 'monitor', emoji: '🖥️', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    peripheral: { name: 'เมาส์ / คีย์บอร์ด', icon: 'mouse', emoji: '🖱️', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
    audio: { name: 'ระบบเสียงและไมค์', icon: 'volume-2', emoji: '🔊', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200' },
    network: { name: 'เน็ต / LAN / Wi-Fi', icon: 'wifi', emoji: '🌐', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
    electricity: { name: 'ปลั๊กไฟ / ไฟฟ้า', icon: 'zap', emoji: '🔌', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
    furniture: { name: 'โต๊ะ / เก้าอี้', icon: 'armchair', emoji: '🪑', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    other: { name: 'ปัญหาอื่นๆ', icon: 'wrench', emoji: '❓', badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' }
};

const COMMON_ISSUES_BY_CATEGORY = {
    projector: ['โปรเจกเตอร์เปิดไม่ติด', 'หลอดภาพกระพริบ / สีเพี้ยน', 'ภาพเบลอ / ปรับโฟกัสไม่ได้', 'รีโมตโปรเจกเตอร์เสีย', 'สาย HDMI / VGA ชำรุด'],
    air: ['เครื่องปรับอากาศไม่เย็น / มีแต่ลมร้อน', 'แอร์มีน้ำหยด / รั่วซึม', 'แอร์มีเสียงดังผิดปกติ', 'รีโมตแอร์เสีย / ปรับอุณหภูมิไม่ได้', 'แอร์มีกลิ่นอับ'],
    computer: ['เครื่องคอมพิวเตอร์เปิดไม่ติด', 'จอฟ้า / Windows ค้างบ่อย', 'หน้าจอไม่แสดงผล / จอดำ', 'พัดลมเคสดังผิดปกติ', 'เครื่องบูตช้า / ติดไวรัส'],
    peripheral: ['เมาส์คลิกไม่ติด / เคอร์เซอร์ไม่ขยับ', 'คีย์บอร์ดพิมพ์ไม่ติด / ปุ่มหลุด', 'สายเชื่อมต่อขาดหรือหลวม', 'เมาส์ไม่มีแสง'],
    audio: ['ไมโครโฟนไม่มีเสียง / สัญญาณหลุด', 'ลำโพงเสียงแตก / มีเสียงหวีดหอน', 'แอมป์เปิดไม่ติด / ปรับเสียงไม่ได้', 'ไมค์ลอยถ่านหมดเร็ว'],
    network: ['สัญญาณ Wi-Fi หลุดบ่อย / ต่อไม่ติด', 'สาย LAN ชำรุด / ไม่มีสัญญาณเน็ต', 'ความเร็วเน็ตช้ามากผิดปกติ'],
    electricity: ['ปลั๊กไฟที่โต๊ะไม่มีไฟ', 'เต้ารับหลวม / เกิดประกายไฟ', 'สวิตช์ไฟ / หลอดไฟห้องเรียนกะพริบ'],
    furniture: ['เก้าอี้ชำรุด / พนักพิงหัก', 'โต๊ะเรียนชำรุด / โยกคลอน', 'ประตู / หน้าต่าง / มู่ลี่ชำรุด'],
    other: ['อุปกรณ์ชำรุด กรุณาตรวจสอบ']
};

function detectMaintenanceCategory(ticket) {
    if (!ticket) return 'other';
    if (ticket.category && MAINTENANCE_CATEGORIES[ticket.category]) {
        return ticket.category;
    }
    const text = `${ticket.title || ''} ${ticket.details || ''} ${ticket.subject || ''} ${ticket.categoryName || ''} ${ticket.item || ''}`.toLowerCase();
    if (text.includes('โปรเจก') || text.includes('projector')) return 'projector';
    if (text.includes('แอร์') || text.includes('ปรับอากาศ') || text.includes('ไม่เย็น') || text.includes('น้ำหยด')) return 'air';
    if (text.includes('คอม') || text.includes('pc') || text.includes('วินโด') || text.includes('windows') || text.includes('จอฟ้า') || text.includes('เคส')) return 'computer';
    if (text.includes('เมาส์') || text.includes('mouse') || text.includes('คีย์บอร์ด') || text.includes('keyboard')) return 'peripheral';
    if (text.includes('เสียง') || text.includes('ไมค์') || text.includes('ลำโพง') || text.includes('audio') || text.includes('หวีด')) return 'audio';
    if (text.includes('เน็ต') || text.includes('wifi') || text.includes('wi-fi') || text.includes('lan') || text.includes('เครือข่าย')) return 'network';
    if (text.includes('ไฟ') || text.includes('ปลั๊ก') || text.includes('เต้ารับ') || text.includes('ช็อต')) return 'electricity';
    if (text.includes('โต๊ะ') || text.includes('เก้าอี้') || text.includes('พนักพิง') || text.includes('บานพับ')) return 'furniture';
    return 'other';
}

function selectMaintenanceCategory(catKey) {
    const input = document.getElementById('maintenance-category-input');
    if (input) input.value = catKey;

    // Update buttons style
    document.querySelectorAll('.mnt-cat-btn').forEach(btn => {
        if (btn.getAttribute('data-cat') === catKey) {
            btn.className = 'mnt-cat-btn p-2 rounded-xl border border-rose-400 bg-rose-50/80 text-rose-900 text-left transition flex flex-col items-center justify-center text-center shadow-xs';
        } else {
            btn.className = 'mnt-cat-btn p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-left transition flex flex-col items-center justify-center text-center';
        }
    });

    // Populate common issue preset chips
    const chipsContainer = document.getElementById('maintenance-preset-chips');
    if (chipsContainer) {
        const issues = COMMON_ISSUES_BY_CATEGORY[catKey] || COMMON_ISSUES_BY_CATEGORY.other;
        chipsContainer.innerHTML = issues.map(issue => `
            <button type="button" onclick="applyMaintenanceIssuePreset('${issue.replace(/'/g, "\\'")}')" class="px-2.5 py-1 rounded-lg text-xs font-medium bg-white hover:bg-rose-500 hover:text-white text-slate-700 border border-rose-200/80 shadow-2xs transition flex items-center gap-1">
                <span>+</span> <span>${issue}</span>
            </button>
        `).join('');
    }
}

function applyMaintenanceIssuePreset(issueText) {
    const titleInput = document.getElementById('maintenance-title-input');
    if (titleInput) {
        titleInput.value = issueText;
        titleInput.focus();
    }
}

function filterMaintenanceByCategory(catKey) {
    AppState.maintenanceCategoryFilter = catKey;
    document.querySelectorAll('.mnt-filter-btn').forEach(btn => {
        const isCurrent = btn.id === `mnt-filter-${catKey}`;
        if (isCurrent) {
            btn.className = 'mnt-filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white shadow-xs transition';
        } else {
            btn.className = 'mnt-filter-btn px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-600 hover:bg-slate-100 transition border border-slate-200';
        }
    });
    renderMaintenance();
}

function renderMaintenance() {
    const tableBody = document.getElementById('maintenance-table-body');
    if (!tableBody) return;

    // Filter by selected category if not 'all'
    const filterCat = AppState.maintenanceCategoryFilter || 'all';
    const list = filterCat === 'all' 
        ? AppState.maintenance 
        : AppState.maintenance.filter(m => detectMaintenanceCategory(m) === filterCat);

    if (list.length === 0) {
        const catInfo = MAINTENANCE_CATEGORIES[filterCat];
        const msg = filterCat === 'all' 
            ? 'ไม่มีรายการแจ้งซ่อม ทุกห้องอยู่ในสภาพพร้อมใช้งาน 100%' 
            : `ไม่มีรายการแจ้งซ่อมสำหรับหมวดหมู่ "${catInfo ? catInfo.name : filterCat}"`;
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-10 text-slate-400">
                    <i data-lucide="check-check" class="w-12 h-12 mx-auto mb-2 opacity-50 text-emerald-500"></i>
                    <div>${msg}</div>
                </td>
            </tr>
        `;
        lucide.createIcons();
        return;
    }

    tableBody.innerHTML = list.map(m => {
        const catKey = detectMaintenanceCategory(m);
        const catInfo = MAINTENANCE_CATEGORIES[catKey] || MAINTENANCE_CATEGORIES.other;
        return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 text-xs transition">
            <td class="p-3 font-semibold text-slate-500">${m.id}</td>
            <td class="p-3 font-bold text-slate-800">${m.roomName}</td>
            <td class="p-3">
                <div class="flex items-center gap-1.5 mb-1">
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold border ${catInfo.badgeClass}">
                        <span>${catInfo.emoji}</span>
                        <span>${catInfo.name}</span>
                    </span>
                </div>
                <div class="font-bold text-slate-800 text-xs">${m.title}</div>
                <div class="text-slate-500 text-[11px] mt-0.5">${m.details || '-'}</div>
            </td>
            <td class="p-3 text-slate-600">
                <div class="font-medium text-slate-800">${m.reporter}</div>
                <div class="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                    <i data-lucide="calendar" class="w-3 h-3 text-slate-400"></i>
                    <span>${formatThaiDate(m.reportedDate)}</span>
                </div>
            </td>
            <td class="p-3">
                ${getMaintenancePriorityBadge(m.priority)}
            </td>
            <td class="p-3">
                ${getMaintenanceStatusBadge(m.status)}
            </td>
            <td class="p-3 text-right">
                <div class="flex items-center justify-end gap-1.5">
                    ${AppState.isAdmin ? `
                        ${m.status !== 'completed' ? `
                            <button onclick="resolveMaintenance('${m.id}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-xs transition flex items-center gap-1 shadow-2xs" title="บันทึกว่าซ่อมเสร็จแล้ว">
                                <i data-lucide="check" class="w-3.5 h-3.5"></i> ซ่อมเสร็จ
                            </button>
                        ` : `
                            <span class="text-emerald-600 font-semibold flex items-center gap-1 text-[11px] bg-emerald-50 px-2 py-0.5 rounded">
                                <i data-lucide="check" class="w-3.5 h-3.5"></i> เรียบร้อย
                            </span>
                        `}
                        <button onclick="deleteMaintenance('${m.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" title="ลบรายการแจ้งซ่อม (เฉพาะ Admin)">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    ` : `
                        <span class="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            ${m.status === 'completed' ? 'ซ่อมเสร็จสิ้น' : 'รอดำเนินการ'}
                        </span>
                    `}
                </div>
            </td>
        </tr>
    `}).join('');
    lucide.createIcons();
}

function deleteMaintenance(ticketId) {
    if (!AppState.isAdmin) {
        showToast('สิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น', 'warning');
        return;
    }
    if (confirm(`คุณต้องการลบรายการแจ้งซ่อม ${ticketId} หรือไม่?\n(ข้อมูลจะถูกลบออกจากทั้งฝั่ง Admin และฝั่งผู้ใช้งานทันที)`)) {
        addDeletedMaintenanceId(ticketId);
        const ticket = AppState.maintenance.find(m => m.id === ticketId);
        const roomId = ticket ? ticket.roomId : null;
        AppState.maintenance = AppState.maintenance.filter(m => m.id !== ticketId);
        if (roomId) {
            const room = AppState.rooms.find(r => r.id === roomId);
            if (room && room.status === 'maintenance') {
                const hasOther = AppState.maintenance.some(m => m.roomId === roomId && m.status !== 'completed');
                if (!hasOther) room.status = 'available';
            }
        }
        saveData();
        renderMaintenance();
        renderRooms();
        updateAdminMaintenanceBadge();
        showToast(`ลบรายการแจ้งซ่อม ${ticketId} เรียบร้อยแล้ว (ข้อมูลฝั่งผู้ใช้ถูกอัปเดตแล้ว)`, 'success');
        broadcastDataChange('DELETE_MAINTENANCE', { id: ticketId, roomId: roomId });
        sendActionToGoogleBackend('deleteMaintenance', { id: ticketId });
        sendActionToGoogleBackend('cancelBooking', { id: ticketId });
    }
}

function handleMaintenanceSubmit(event) {
    event.preventDefault();
    const form = event.target;

    const roomId = form.roomId.value;
    const category = (form.category && form.category.value) ? form.category.value : 'other';
    const catInfo = MAINTENANCE_CATEGORIES[category] || MAINTENANCE_CATEGORIES.other;
    const title = form.title.value.trim();
    const details = form.details.value.trim();
    const priority = form.priority.value;
    const reporter = form.reporter.value.trim();
    const setRoomMaintenance = form.setMaintenance.checked;

    const room = AppState.rooms.find(r => r.id === roomId);

    const newTicket = {
        id: `MNT-${Math.floor(100 + Math.random() * 900)}`,
        roomId: roomId,
        roomName: room ? room.name : roomId,
        reportedDate: new Date().toISOString().slice(0, 10),
        category: category,
        categoryName: catInfo.name,
        title: title,
        details: details,
        reporter: reporter,
        status: 'open',
        priority: priority,
        _localCreatedAt: Date.now()
    };

    AppState.maintenance.unshift(newTicket);

    if (setRoomMaintenance && room) {
        room.status = 'maintenance';
        sendActionToGoogleBackend('updateRoomStatus', { id: roomId, status: 'maintenance' });
    }

    saveData();
    closeModal('modal-maintenance');
    updateAdminMaintenanceBadge();
    renderCurrentTab();
    broadcastDataChange('ADD_MAINTENANCE', { ticket: newTicket });
    
    // Instant on-screen confirmation for user (no blocking alert/OK button)
    showToast(`✅ แจ้งซ่อมอุปกรณ์เรียบร้อยแล้ว!<br><span class="text-[11px] text-slate-300">หมวดหมู่: <b>${catInfo.emoji} ${catInfo.name}</b> • รหัส: <b>${newTicket.id}</b><br>ห้อง: <b>${room ? room.name : roomId}</b> • ปัญหา: <b>${title}</b><br>สถานะ: 🔴 รอดำเนินการ (ส่งข้อมูลถึง Admin ทันทีแล้ว)</span>`, 'success', 5500);

    // Sync to Google Sheets
    sendActionToGoogleBackend('addMaintenance', { ticket: newTicket });
}

function resolveMaintenance(ticketId) {
    if (!AppState.isAdmin) {
        showToast('สิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น', 'warning');
        return;
    }
    const ticket = AppState.maintenance.find(m => m.id === ticketId);
    if (ticket) {
        ticket.status = 'completed';
        const room = AppState.rooms.find(r => r.id === ticket.roomId);
        if (room && room.status === 'maintenance') {
            const hasOtherActive = AppState.maintenance.some(m => m.roomId === ticket.roomId && m.id !== ticketId && m.status !== 'completed');
            if (!hasOtherActive) {
                room.status = 'available';
                sendActionToGoogleBackend('updateRoomStatus', { id: room.id, status: 'available' });
            }
        }

        saveData();
        updateAdminMaintenanceBadge();
        renderCurrentTab();
        showToast(`✅ ยืนยันการซ่อมรหัส ${ticketId} เสร็จสิ้นเรียบร้อย (อัปเดตสถานะห้องพร้อมใช้งานและแจ้งผู้ใช้ทันที)`, 'success', 5000);
        broadcastDataChange('RESOLVE_MAINTENANCE', { id: ticketId, roomId: ticket ? ticket.roomId : null });

        // Sync to Google Sheets (Central Cloud Database)
        sendActionToGoogleBackend('resolveMaintenance', { id: ticketId, status: 'completed' });
    }
}

// ----------------------------------------------------
// 6. ADD CUSTOM ROOM FEATURE
// ----------------------------------------------------
function handleAddRoomSubmit(event) {
    event.preventDefault();
    if (!AppState.isAdmin) {
        showToast('สิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น', 'warning');
        return;
    }
    const form = event.target;

    const roomName = form.roomName.value.trim();
    const roomType = form.roomType.value;
    const floor = form.floor.value.trim();
    const building = form.building.value.trim();
    const capacity = parseInt(form.capacity.value) || 40;
    const pcCount = roomType === 'computer_lab' ? (parseInt(form.pcCount.value) || 40) : 0;
    const facilities = form.facilities.value.split(',').map(f => f.trim()).filter(f => f.length > 0);

    const newId = roomType === 'computer_lab' ? `LAB-${AppState.rooms.filter(r => r.type === 'computer_lab').length + 1}` : `R-${roomName.replace(/\D/g, '') || Math.floor(100 + Math.random() * 900)}`;

    const newRoom = {
        id: newId,
        name: roomName,
        type: roomType,
        categoryName: roomType === 'computer_lab' ? "ห้องปฏิบัติการคอมพิวเตอร์" : "ห้องเรียนทั่วไป",
        building: building || "อาคารเรียนรวม",
        floor: floor || "ชั้น 3",
        capacity: capacity,
        pcCount: pcCount,
        status: "available",
        currentClass: null,
        facilities: facilities.length > 0 ? facilities : (roomType === 'computer_lab' ? ["PC ครบชุด", "Projector", "เครื่องปรับอากาศ x4"] : ["Smart TV 65 นิ้ว", "เครื่องปรับอากาศ x2", "กระดาน Whiteboard"]),
        description: `ห้อง ${roomName} ${floor} ${building}`,
        image: roomType === 'computer_lab' ? "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=60" : "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600&auto=format&fit=crop&q=60"
    };

    AppState.rooms.push(newRoom);
    saveData();
    closeModal('modal-add-room');
    renderCurrentTab();
    showToast(`เพิ่มห้อง ${roomName} เข้าสู่ระบบสำเร็จแล้ว!`, 'success');

    // Sync to Google Sheets
    sendActionToGoogleBackend('addRoom', { room: newRoom });
}

// ----------------------------------------------------
// 7. GOOGLE APPS SCRIPT & GOOGLE SHEETS INTEGRATION
// ----------------------------------------------------

/**
 * ส่งคำขอ Action ไปยัง Google Apps Script (รองรับทั้ง google.script.run และ REST API)
 */
function sendActionToGoogleBackend(action, payload) {
    if (isGoogleAppsScriptEnvironment()) {
        try {
            switch(action) {
                case 'addBooking':
                    google.script.run.withSuccessHandler(res => console.log('GAS Add Booking:', res)).apiAddBooking(payload.booking);
                    break;
                case 'cancelBooking':
                    google.script.run.withSuccessHandler(res => console.log('GAS Cancel Booking:', res)).apiCancelBooking(payload.id);
                    break;
                case 'approveBooking':
                    google.script.run.withSuccessHandler(res => console.log('GAS Approve Booking:', res)).apiApproveBooking(payload.id);
                    break;
                case 'rejectBooking':
                    google.script.run.withSuccessHandler(res => console.log('GAS Reject Booking:', res)).apiRejectBooking(payload.id);
                    break;
                case 'addMaintenance':
                    google.script.run.withSuccessHandler(res => console.log('GAS Add MNT:', res)).apiAddMaintenance(payload.ticket);
                    break;
                case 'resolveMaintenance':
                    google.script.run.withSuccessHandler(res => console.log('GAS Resolve MNT:', res)).apiResolveMaintenance(payload.id);
                    break;
                case 'deleteMaintenance':
                    google.script.run.withSuccessHandler(res => console.log('GAS Delete MNT:', res)).apiDeleteMaintenance(payload.id);
                    break;
                case 'addRoom':
                    google.script.run.withSuccessHandler(res => console.log('GAS Add Room:', res)).apiAddRoom(payload.room);
                    break;
                case 'updateRoom':
                    google.script.run.withSuccessHandler(res => console.log('GAS Update Room:', res)).apiUpdateRoom(payload.room);
                    break;
                case 'deleteRoom':
                    google.script.run.withSuccessHandler(res => console.log('GAS Delete Room:', res)).apiDeleteRoom(payload.id);
                    break;
                case 'updateRoomStatus':
                    google.script.run.withSuccessHandler(res => console.log('GAS Update Room:', res)).apiUpdateRoomStatus(payload.id, payload.status, payload.currentClass);
                    break;
                case 'addTimetable':
                    google.script.run.withSuccessHandler(res => console.log('GAS Add Timetable:', res)).apiAddTimetable(payload.item);
                    break;
                case 'updateTimetable':
                    google.script.run.withSuccessHandler(res => console.log('GAS Update Timetable:', res)).apiUpdateTimetable(payload.item);
                    break;
                case 'deleteTimetable':
                    google.script.run.withSuccessHandler(res => console.log('GAS Delete Timetable:', res)).apiDeleteTimetable(payload.id);
                    break;
            }
        } catch(e) {
            console.warn("GAS execution failed:", e);
        }
        return;
    }

    if (!AppState.googleScriptUrl) return;

    try {
        const urlObj = new URL(AppState.googleScriptUrl);
        urlObj.searchParams.set('action', action);
        if (payload.id) urlObj.searchParams.set('id', payload.id);
        if (payload.status) urlObj.searchParams.set('status', payload.status);

        if (payload.booking) {
            urlObj.searchParams.set('booking', JSON.stringify(payload.booking));
            const bk = payload.booking;
            urlObj.searchParams.set('roomId', bk.roomId || bk.roomid || '');
            urlObj.searchParams.set('roomName', bk.roomName || bk.roomname || '');
            urlObj.searchParams.set('date', bk.date || '');
            urlObj.searchParams.set('startTime', bk.startTime || bk.starttime || '');
            urlObj.searchParams.set('endTime', bk.endTime || bk.endtime || '');
            urlObj.searchParams.set('subject', bk.subject || bk.purpose || '');
            urlObj.searchParams.set('purpose', bk.purpose || bk.subject || '');
            urlObj.searchParams.set('bookerName', bk.bookerName || bk.reservedBy || '');
            urlObj.searchParams.set('reservedBy', bk.reservedBy || bk.bookerName || '');
            urlObj.searchParams.set('department', bk.department || '');
            urlObj.searchParams.set('phone', bk.phone || '');
            urlObj.searchParams.set('status', bk.status || 'pending');
        }
        if (payload.ticket) urlObj.searchParams.set('ticket', JSON.stringify(payload.ticket));

        // Dual-channel fallback for maintenance: ensure ticket is stored in Bookings sheet if backend lacks maintenance sheet
        if (action === 'addMaintenance' && payload.ticket) {
            const tk = payload.ticket;
            const catInfo = (typeof MAINTENANCE_CATEGORIES !== 'undefined' && MAINTENANCE_CATEGORIES[tk.category]) ? MAINTENANCE_CATEGORIES[tk.category] : { name: 'ทั่วไป' };
            const mntBooking = {
                id: tk.id,
                roomId: tk.roomId,
                roomName: tk.roomName,
                date: tk.reportedDate,
                startTime: tk.priority || 'medium',
                endTime: tk.status || 'open',
                subject: `[MNT:${catInfo.name}] ${tk.title}`,
                purpose: `[MNT:${catInfo.name}] ${tk.title}${tk.details ? ' (' + tk.details + ')' : ''}`,
                bookerName: tk.reporter || 'ผู้แจ้งซ่อม',
                reservedBy: tk.reporter || 'ผู้แจ้งซ่อม',
                department: `แจ้งซ่อม (${catInfo.name} - ${tk.priority || 'medium'})`,
                phone: '',
                status: tk.status || 'open'
            };
            const mntUrl = new URL(AppState.googleScriptUrl);
            mntUrl.searchParams.set('action', 'addBooking');
            mntUrl.searchParams.set('booking', JSON.stringify(mntBooking));
            mntUrl.searchParams.set('id', mntBooking.id);
            mntUrl.searchParams.set('roomId', mntBooking.roomId);
            mntUrl.searchParams.set('roomName', mntBooking.roomName);
            mntUrl.searchParams.set('date', mntBooking.date);
            mntUrl.searchParams.set('subject', mntBooking.subject);
            mntUrl.searchParams.set('purpose', mntBooking.purpose);
            mntUrl.searchParams.set('bookerName', mntBooking.bookerName);
            mntUrl.searchParams.set('reservedBy', mntBooking.reservedBy);
            mntUrl.searchParams.set('department', mntBooking.department);
            mntUrl.searchParams.set('status', mntBooking.status);
            fetch(mntUrl.toString(), { method: 'GET', mode: 'cors' }).catch(() => {});
        } else if (action === 'resolveMaintenance' && payload.id) {
            const appUrl = new URL(AppState.googleScriptUrl);
            appUrl.searchParams.set('action', 'approveBooking');
            appUrl.searchParams.set('id', payload.id);
            appUrl.searchParams.set('status', 'completed');
            fetch(appUrl.toString(), { method: 'GET', mode: 'cors' }).catch(() => {});
        } else if (action === 'deleteMaintenance' && payload.id) {
            const delUrl = new URL(AppState.googleScriptUrl);
            delUrl.searchParams.set('action', 'cancelBooking');
            delUrl.searchParams.set('id', payload.id);
            fetch(delUrl.toString(), { method: 'GET', mode: 'cors' }).catch(() => {});
        }
        if (payload.room) urlObj.searchParams.set('room', JSON.stringify(payload.room));
        if (payload.item) urlObj.searchParams.set('item', JSON.stringify(payload.item));
        if (payload.timetable) urlObj.searchParams.set('timetable', JSON.stringify(payload.timetable));

        // Send via GET request
        fetch(urlObj.toString(), { method: 'GET', mode: 'cors' })
            .then(r => r.json())
            .then(res => {
                console.log('Google Sheets Sync (GET):', res);
                if (res.success && res.data) {
                    if (res.data.bookings || res.data.maintenance) {
                        mapAndApplyCloudBookings(res.data.bookings || [], res.data.maintenance || []);
                    }
                }
            })
            .catch(err => {
                console.warn('GET sync failed, trying POST:', err);
                fetch(AppState.googleScriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: action, ...payload })
                }).then(r => r.json()).catch(e => console.warn('POST sync:', e));
            });

        // Trigger delayed background pull to ensure cloud state consistency
        setTimeout(() => {
            fetchDataFromGoogleSheets(true);
        }, 1500);

    } catch(e) {
        console.warn('Sync URL error:', e);
    }
}

/**
 * ดึงข้อมูลจาก Google Apps Script (เมื่อเปิดใน Apps Script โดยตรง)
 */
function syncFromGoogleAppsScript() {
    if (!isGoogleAppsScriptEnvironment()) return;
    google.script.run
        .withSuccessHandler(response => {
            if (response && response.rooms && response.rooms.length > 0) {
                AppState.rooms = response.rooms;
                if (response.timetable && Array.isArray(response.timetable) && response.timetable.length > 0) {
                    AppState.timetable = response.timetable;
                } else if (!AppState.timetable || AppState.timetable.length === 0) {
                    AppState.timetable = DEFAULT_TIMETABLE;
                }
                if (response.bookings || response.maintenance) {
                    mapAndApplyCloudBookings(response.bookings || [], response.maintenance || []);
                }
                AppState.isGoogleConnected = true;
                saveData();
                renderCurrentTab();
                showToast('ดึงข้อมูลจาก Google Sheets สำเร็จ!', 'success');
            }
        })
        .withFailureHandler(err => {
            console.error('GAS Error:', err);
        })
        .apiGetData();
}

/**
 * ดึงข้อมูลจาก Google Sheets ผ่าน URL API (เมื่อรันบน GitHub Pages / Web)
 */
async function fetchDataFromGoogleSheets(silent = false) {
    if (!AppState.googleScriptUrl) {
        if (!silent) showToast('กรุณาระบุ Google Apps Script Web App URL ก่อน', 'warning');
        return;
    }

    try {
        if (!silent) showToast('กำลังดึงข้อมูลจาก Google Sheets...', 'info');
        const url = AppState.googleScriptUrl + (AppState.googleScriptUrl.includes('?') ? '&' : '?') + 'action=getAll';
        const res = await fetch(url);
        const json = await res.json();

        if (json.success && json.data) {
            if (json.data.rooms && Array.isArray(json.data.rooms) && json.data.rooms.length > 0) {
                AppState.rooms = json.data.rooms;
            }
            if (json.data.timetable && Array.isArray(json.data.timetable) && json.data.timetable.length > 0) {
                AppState.timetable = json.data.timetable;
            } else {
                // If cloud sheet has no timetable entries yet, NEVER wipe out the 184 timetable classes!
                if (!AppState.timetable || AppState.timetable.length === 0) {
                    AppState.timetable = DEFAULT_TIMETABLE;
                }
            }
            if (json.data.bookings || json.data.maintenance) {
                const cleanCloudBk = (json.data.bookings && Array.isArray(json.data.bookings))
                    ? json.data.bookings.filter(b => b.id !== 'BK-1001' && b.id !== 'BK-1002' && b.id !== 'BK-1003')
                    : [];
                mapAndApplyCloudBookings(cleanCloudBk, json.data.maintenance);
            }

            AppState.isGoogleConnected = true;
            saveData();
            renderCurrentTab();
            updateGoogleStatusUI();
            if (!silent) showToast('ดึงข้อมูลล่าสุดจาก Google Sheets สำเร็จเรียบร้อย!', 'success');
        } else {
            if (!silent) showToast('ไม่สามารถอ่านข้อมูลจาก Google Sheets ได้', 'error');
        }
    } catch (e) {
        console.error('Fetch Google Sheets error:', e);
        AppState.isGoogleConnected = false;
        updateGoogleStatusUI();
        if (!silent) showToast('เกิดข้อผิดพลาดในการเชื่อมต่อ Google Sheets: ' + e.message, 'error');
    }
}

/**
 * ทดสอบการเชื่อมต่อ Google Apps Script Web App URL
 */
async function testGoogleSheetsConnection() {
    const urlInput = document.getElementById('gas-url-input');
    if (!urlInput || !urlInput.value.trim()) {
        showToast('กรุณากรอก Google Apps Script Web App URL', 'warning');
        return;
    }

    const enteredUrl = urlInput.value.trim();
    if (!enteredUrl.includes('script.google.com/macros/s/')) {
        showToast('❌ URL ไม่ถูกต้อง! ช่องนี้ต้องใส่ Google Apps Script Web App URL (ขึ้นต้นด้วย https://script.google.com/macros/s/...)<br><span class="text-[11px] text-amber-200">ไม่ใช่ลิงก์เว็บไซต์ GitHub Pages หรือ Vercel</span>', 'error', 9000);
        return;
    }

    AppState.googleScriptUrl = enteredUrl;
    saveSettings();
    await fetchDataFromGoogleSheets(false);
}

/**
 * รีเซ็ต URL กลับเป็น URL กลางของ Google Apps Script ทันที
 */
function resetToDefaultGasUrl() {
    if (typeof DEFAULT_GAS_URL !== 'undefined' && DEFAULT_GAS_URL) {
        AppState.googleScriptUrl = DEFAULT_GAS_URL;
        saveSettings();
        const gasInput = document.getElementById('gas-url-input');
        if (gasInput) gasInput.value = DEFAULT_GAS_URL;
        updateGoogleStatusUI();
        fetchDataFromGoogleSheets(false);
        showToast('คืนค่า URL ฐานข้อมูล Google Sheets ส่วนกลางเรียบร้อยแล้ว!', 'success');
    }
}

function updateGoogleStatusUI() {
    const statusBadge = document.getElementById('gas-status-badge');
    if (statusBadge) {
        if (AppState.isGoogleConnected || isGoogleAppsScriptEnvironment()) {
            statusBadge.innerHTML = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> เชื่อมต่อ Google Sheets แล้ว</span>`;
        } else if (AppState.googleScriptUrl) {
            statusBadge.innerHTML = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-amber-500"></span> รอการเชื่อมต่อ</span>`;
        } else {
            statusBadge.innerHTML = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 flex items-center gap-1.5">โหมดออฟไลน์ (LocalStorage)</span>`;
        }
    }
}

// ----------------------------------------------------
// 8. MODALS & POPUPS
// ----------------------------------------------------
function openRoomDetailModal(roomId) {
    const room = AppState.rooms.find(r => r.id === roomId);
    if (!room) return;

    const isLab = room.type === 'computer_lab';
    const container = document.getElementById('room-detail-body');

    container.innerHTML = `
        <div class="space-y-6">
            <div class="relative h-48 rounded-2xl overflow-hidden bg-slate-900">
                <img src="${room.image || 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600&auto=format&fit=crop&q=60'}" alt="${room.name}" class="w-full h-full object-cover opacity-70">
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent"></div>
                <div class="absolute top-4 left-4 flex gap-2">
                    <span class="px-3 py-1 rounded-lg text-xs font-bold ${isLab ? 'bg-indigo-600 text-white' : 'bg-blue-600 text-white'} shadow-md">
                        ${isLab ? '💻 ห้องปฏิบัติการคอมพิวเตอร์' : '📖 ห้องเรียนทั่วไป'}
                    </span>
                    ${getStatusBadge(room.status)}
                </div>
                <div class="absolute bottom-4 left-4 right-4 text-white">
                    <h3 class="text-2xl font-extrabold drop-shadow">${room.name}</h3>
                    <p class="text-xs text-slate-300 flex items-center gap-2 mt-1">
                        <span><i data-lucide="building" class="w-3.5 h-3.5 inline"></i> ${room.building}</span>
                        <span>•</span>
                        <span><i data-lucide="layers" class="w-3.5 h-3.5 inline"></i> ${room.floor}</span>
                        <span>•</span>
                        <span><i data-lucide="users" class="w-3.5 h-3.5 inline"></i> ความจุ ${room.capacity} ที่นั่ง</span>
                    </p>
                </div>
            </div>

            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h5 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">คำอธิบายห้องเรียน</h5>
                <p class="text-sm text-slate-700">${room.description || 'ห้องเรียนมาตรฐาน'}</p>
            </div>

            ${isLab && room.specs ? `
                <div class="bg-indigo-50/70 p-5 rounded-2xl border border-indigo-200">
                    <h4 class="font-bold text-indigo-950 text-sm flex items-center gap-2 mb-3">
                        <i data-lucide="cpu" class="w-5 h-5 text-indigo-600"></i>
                        สเปกเครื่องคอมพิวเตอร์ (จำนวน ${room.pcCount} เครื่อง)
                    </h4>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div class="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                            <span class="text-slate-400">หน่วยประมวลผล (CPU):</span>
                            <div class="font-bold text-slate-800 mt-0.5">${room.specs.cpu || 'Intel Core i5/i7'}</div>
                        </div>
                        <div class="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                            <span class="text-slate-400">หน่วยความจำ (RAM):</span>
                            <div class="font-bold text-slate-800 mt-0.5">${room.specs.ram || '16-32 GB'}</div>
                        </div>
                        <div class="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                            <span class="text-slate-400">การ์ดจอ (GPU):</span>
                            <div class="font-bold text-slate-800 mt-0.5">${room.specs.gpu || 'Discrete GPU'}</div>
                        </div>
                        <div class="bg-white p-3 rounded-xl border border-indigo-100 shadow-sm">
                            <span class="text-slate-400">พื้นที่จัดเก็บ (Storage):</span>
                            <div class="font-bold text-slate-800 mt-0.5">${room.specs.storage || 'SSD NVMe'}</div>
                        </div>
                    </div>

                    <div class="mt-4">
                        <h5 class="text-xs font-bold text-indigo-900 mb-2">โปรแกรมที่ติดตั้งพร้อมใช้งาน:</h5>
                        <div class="flex flex-wrap gap-1.5">
                            ${room.software ? room.software.map(s => `
                                <span class="px-2.5 py-1 bg-white text-indigo-700 font-semibold rounded-lg border border-indigo-200 text-xs shadow-2xs">
                                    ${s}
                                </span>
                            `).join('') : ''}
                        </div>
                    </div>
                </div>
            ` : ''}

            <div>
                <h5 class="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
                    <i data-lucide="check-circle-2" class="w-4 h-4 text-blue-600"></i> อุปกรณ์และสิ่งอำนวยความสะดวกในห้อง
                </h5>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    ${room.facilities ? room.facilities.map(f => `
                        <div class="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700">
                            <i data-lucide="check" class="w-4 h-4 text-emerald-600"></i>
                            <span>${f}</span>
                        </div>
                    `).join('') : ''}
                </div>
            </div>

            <div class="pt-4 border-t border-slate-200 flex flex-wrap gap-2">
                <button onclick="viewRoomTimetable('${room.id}');" class="flex-1 py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-indigo-200 transition">
                    <i data-lucide="calendar" class="w-4 h-4"></i> ดูตารางการใช้ห้องนี้
                </button>
                <button onclick="closeModal('modal-room-detail'); openBookingModalForRoom('${room.id}');" class="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition">
                    <i data-lucide="calendar-plus" class="w-4 h-4"></i> จองห้องนี้
                </button>
                <button onclick="closeModal('modal-room-detail'); openMaintenanceModalForRoom('${room.id}');" class="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 border border-rose-200 transition">
                    <i data-lucide="wrench" class="w-4 h-4"></i> แจ้งซ่อม
                </button>
                ${AppState.isAdmin ? `
                    <div class="w-full pt-2 mt-1 border-t border-slate-100 flex gap-2">
                        <button onclick="openEditRoomModal('${room.id}');" class="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition">
                            <i data-lucide="edit-3" class="w-4 h-4"></i> แก้ไขสเปกห้องนี้ (Admin)
                        </button>
                        <button onclick="deleteRoom('${room.id}');" class="py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs transition">
                            <i data-lucide="trash-2" class="w-4 h-4"></i> ลบห้อง
                        </button>
                    </div>
                ` : ''}
            </div>
        </div>
    `;

    openModal('modal-room-detail');
    lucide.createIcons();
}

function getNextDateForDayName(dayName) {
    const daysMap = { 'อาทิตย์': 0, 'จันทร์': 1, 'อังคาร': 2, 'พุธ': 3, 'พฤหัสบดี': 4, 'ศุกร์': 5, 'เสาร์': 6 };
    const targetDay = daysMap[dayName];
    const d = new Date();
    if (targetDay === undefined) return d.toISOString().slice(0, 10);
    const currentDay = d.getDay();
    let diff = targetDay - currentDay;
    if (diff < 0) diff += 7;
    d.setDate(d.getDate() + diff);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function setSelectValueOrAdd(selectElem, val) {
    if (!selectElem || !val) return;
    let found = false;
    for (let i = 0; i < selectElem.options.length; i++) {
        if (selectElem.options[i].value === val) {
            found = true;
            break;
        }
    }
    if (!found) {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = `${val} น.`;
        selectElem.appendChild(opt);
    }
    selectElem.value = val;
}

function viewRoomTimetable(roomId) {
    AppState.selectedRoomForSchedule = roomId;
    AppState.selectedInstructorForSchedule = 'ALL';
    closeModal('modal-room-detail');
    switchTab('timetable');
    const roomSelect = document.getElementById('timetable-room-selector');
    if (roomSelect) {
        roomSelect.value = roomId;
    }
    const instSelect = document.getElementById('timetable-instructor-selector');
    if (instSelect) {
        instSelect.value = 'ALL';
    }
    renderTimetable();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openBookingModalForRoom(roomId) {
    const roomSelect = document.getElementById('booking-room-select');
    if (roomSelect) {
        populateRoomOptions(roomSelect);
        if (roomId) roomSelect.value = roomId;
    }

    const dateInput = document.getElementById('booking-date-input');
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().slice(0, 10);
    }

    // Control admin-only auto-approve toggle box
    const adminToggleBox = document.getElementById('booking-admin-toggle-box');
    if (adminToggleBox) {
        adminToggleBox.classList.toggle('hidden', !AppState.isAdmin);
    }
    const autoApproveToggle = document.getElementById('booking-auto-approve-toggle');
    if (autoApproveToggle) {
        autoApproveToggle.checked = false;
    }

    openModal('modal-booking');
}

function openBookingModalWithPrefill(roomId, dayName, startTime, endTime) {
    openBookingModalForRoom(roomId);
    const dateInput = document.getElementById('booking-date-input');
    if (dateInput && dayName) {
        dateInput.value = getNextDateForDayName(dayName);
    }
    const startSelect = document.getElementById('booking-start-time');
    const endSelect = document.getElementById('booking-end-time');
    if (startSelect && startTime) setSelectValueOrAdd(startSelect, startTime);
    if (endSelect && endTime) setSelectValueOrAdd(endSelect, endTime);
    
    if (typeof showToast === 'function') {
        const dayLabel = dayName ? `วัน${dayName}` : '';
        const timeLabel = (startTime && endTime) ? ` เวลา ${startTime} - ${endTime} น.` : '';
        showToast(`เลือก ${dayLabel}${timeLabel} สำหรับการจองแล้ว`, 'info');
    }
}

function openMaintenanceModalForRoom(roomId) {
    const roomSelect = document.getElementById('maintenance-room-select');
    if (roomSelect) {
        populateRoomOptions(roomSelect);
        if (roomId) roomSelect.value = roomId;
    }
    selectMaintenanceCategory('projector');
    const titleInput = document.getElementById('maintenance-title-input');
    if (titleInput) titleInput.value = '';
    const detailsInput = document.querySelector('#modal-maintenance textarea[name="details"]');
    if (detailsInput) detailsInput.value = '';

    openModal('modal-maintenance');
    lucide.createIcons();
}

function populateRoomOptions(selectElem, includeAll = false) {
    let html = '';
    if (includeAll) {
        html += `<option value="ALL">📌 ภาพรวมทุกห้อง (${AppState.rooms.length} ห้อง)</option>`;
    }

    const labs = AppState.rooms.filter(r => r.type === 'computer_lab');
    const floor3 = AppState.rooms.filter(r => r.floor && r.floor.includes('3') && r.type !== 'computer_lab');
    const floor4 = AppState.rooms.filter(r => r.floor && r.floor.includes('4') && r.type !== 'computer_lab');
    const others = AppState.rooms.filter(r => !labs.includes(r) && !floor3.includes(r) && !floor4.includes(r));

    if (labs.length > 0) {
        html += `<optgroup label="ห้องปฏิบัติการคอมพิวเตอร์ (${labs.length} ห้อง)">`;
        html += labs.map(r => `<option value="${r.id}">💻 ${r.name} (${r.pcCount} PCs)</option>`).join('');
        html += `</optgroup>`;
    }

    if (floor3.length > 0) {
        html += `<optgroup label="ห้องเรียนชั้น 3 (${floor3.length} ห้อง)">`;
        html += floor3.map(r => `<option value="${r.id}">📖 ${r.name} (${r.capacity} ที่นั่ง)</option>`).join('');
        html += `</optgroup>`;
    }

    if (floor4.length > 0) {
        html += `<optgroup label="ห้องเรียนชั้น 4 (${floor4.length} ห้อง)">`;
        html += floor4.map(r => `<option value="${r.id}">📖 ${r.name} (${r.capacity} ที่นั่ง)</option>`).join('');
        html += `</optgroup>`;
    }

    const meetings = AppState.rooms.filter(r => r.type === 'meeting_room');
    const remaining = AppState.rooms.filter(r => !labs.includes(r) && !floor3.includes(r) && !floor4.includes(r) && !meetings.includes(r));

    if (meetings.length > 0) {
        html += `<optgroup label="ห้องประชุม (${meetings.length} ห้อง)">`;
        html += meetings.map(r => `<option value="${r.id}">🏛️ ${r.name} (${r.capacity} ที่นั่ง)</option>`).join('');
        html += `</optgroup>`;
    }

    if (remaining.length > 0) {
        html += `<optgroup label="ห้องเรียนอื่นๆ (${remaining.length} ห้อง)">`;
        html += remaining.map(r => `<option value="${r.id}">📖 ${r.name} (${r.capacity} ที่นั่ง)</option>`).join('');
        html += `</optgroup>`;
    }

    selectElem.innerHTML = html;
}

function quickToggleOccupied(roomId) {
    const room = AppState.rooms.find(r => r.id === roomId);
    if (!room) return;

    const teacher = prompt('ระบุชื่อผู้สอน / หัวหน้าห้อง:', 'อาจารย์ประจำวิชา');
    if (!teacher) return;
    const subject = prompt('ระบุชื่อวิชา / กิจกรรม:', 'การบรรยายพิเศษ');
    if (!subject) return;

    room.status = 'occupied';
    room.currentClass = {
        subject: subject,
        instructor: teacher,
        time: 'ขณะนี้ (Live Check-in)',
        studentCount: room.capacity
    };

    saveData();
    renderCurrentTab();
    showToast(`เช็คอินเข้าใช้ห้อง ${room.name} เรียบร้อยแล้ว`, 'success');

    // Sync to Google Sheets
    sendActionToGoogleBackend('updateRoomStatus', { id: room.id, status: 'occupied', currentClass: room.currentClass });
}

// ----------------------------------------------------
// 9. SETTINGS & EXPORT / IMPORT
// ----------------------------------------------------
function renderSettings() {
    document.getElementById('settings-total-rooms').textContent = `${AppState.rooms.length} ห้อง`;
    document.getElementById('settings-total-bookings').textContent = `${AppState.bookings.length} รายการ`;
    document.getElementById('settings-total-schedules').textContent = `${AppState.timetable.length} คาบ`;

    const gasInput = document.getElementById('gas-url-input');
    if (gasInput && AppState.googleScriptUrl) {
        gasInput.value = AppState.googleScriptUrl;
    }
    updateGoogleStatusUI();
}

function exportDataJSON() {
    const data = {
        version: DATA_VERSION,
        rooms: AppState.rooms,
        timetable: AppState.timetable,
        bookings: AppState.bookings,
        maintenance: AppState.maintenance,
        exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `classroom_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('ส่งออกข้อมูลสำรอง (JSON) สำเร็จ', 'success');
}

function exportBookingsCSV() {
    if (AppState.bookings.length === 0) {
        showToast('ไม่มีข้อมูลการจองสำหรับส่งออก', 'warning');
        return;
    }

    let csvContent = "\uFEFFรหัสการจอง,ห้องเรียน,วันที่,เวลาเริ่ม,เวลาสิ้นสุด,วิชา/กิจกรรม,ผู้จอง,หน่วยงาน,สถานะ\n";
    AppState.bookings.forEach(b => {
        csvContent += `"${b.id}","${b.roomName}","${b.date}","${b.startTime}","${b.endTime}","${b.subject}","${b.bookerName}","${b.department}","${b.status}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `classroom_bookings_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('ส่งออกรายงานการจอง (CSV) สำเร็จ', 'success');
}

function importDataJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.rooms && Array.isArray(data.rooms)) {
                AppState.rooms = data.rooms;
                if (data.timetable) AppState.timetable = data.timetable;
                if (data.bookings) AppState.bookings = data.bookings;
                if (data.maintenance) AppState.maintenance = data.maintenance;
                saveData();
                renderCurrentTab();
                showToast('นำเข้าข้อมูลระบบสำเร็จเรียบร้อยแล้ว!', 'success');
            } else {
                showToast('ไฟล์ JSON ไม่ถูกต้องตามรูปแบบข้อมูลระบบ', 'error');
            }
        } catch (err) {
            showToast('เกิดข้อผิดพลาดในการอ่านไฟล์ JSON', 'error');
        }
    };
    reader.readAsText(file);
}

// ----------------------------------------------------
// UI UTILITIES & EVENT LISTENERS
// ----------------------------------------------------
function initUI() {
    updateAdminHeaderUI();
    switchTab('dashboard');
}

function setupEventListeners() {
    document.querySelectorAll('.filter-type-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-type-btn').forEach(b => {
                b.classList.remove('bg-blue-600', 'text-white');
                b.classList.add('bg-white', 'text-slate-600');
            });
            btn.classList.add('bg-blue-600', 'text-white');
            btn.classList.remove('bg-white', 'text-slate-600');
            AppState.selectedRoomType = btn.dataset.type;
            renderRooms();
        });
    });

    const searchInput = document.getElementById('room-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            AppState.searchQuery = e.target.value;
            renderRooms();
        });
    }

    const statusSelect = document.getElementById('room-status-filter');
    if (statusSelect) {
        statusSelect.addEventListener('change', (e) => {
            AppState.statusFilter = e.target.value;
            renderRooms();
        });
    }

    const buildingSelect = document.getElementById('room-building-filter');
    if (buildingSelect) {
        buildingSelect.addEventListener('change', (e) => {
            AppState.buildingFilter = e.target.value;
            renderRooms();
        });
    }

    const scheduleRoomSelect = document.getElementById('timetable-room-selector');
    if (scheduleRoomSelect) {
        scheduleRoomSelect.addEventListener('change', (e) => {
            AppState.selectedRoomForSchedule = e.target.value;
            AppState.selectedInstructorForSchedule = 'ALL';
            renderTimetable();
        });
    }

    const scheduleInstructorSelect = document.getElementById('timetable-instructor-selector');
    if (scheduleInstructorSelect) {
        scheduleInstructorSelect.addEventListener('change', (e) => {
            AppState.selectedInstructorForSchedule = e.target.value;
            if (e.target.value !== 'ALL') {
                AppState.selectedRoomForSchedule = 'ALL';
            }
            renderTimetable();
        });
    }
}

function resetFilters() {
    AppState.searchQuery = '';
    AppState.statusFilter = 'all';
    AppState.buildingFilter = 'all';
    AppState.selectedRoomType = 'all';

    const searchInput = document.getElementById('room-search-input');
    if (searchInput) searchInput.value = '';
    const statusSelect = document.getElementById('room-status-filter');
    if (statusSelect) statusSelect.value = 'all';
    const buildingSelect = document.getElementById('room-building-filter');
    if (buildingSelect) buildingSelect.value = 'all';

    document.querySelectorAll('.filter-type-btn').forEach(btn => {
        if (btn.dataset.type === 'all') {
            btn.classList.add('bg-blue-600', 'text-white');
            btn.classList.remove('bg-white', 'text-slate-600');
        } else {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-white', 'text-slate-600');
        }
    });

    renderRooms();
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        lucide.createIcons();
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function getStatusBadge(status) {
    switch (status) {
        case 'available':
            return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 status-pulse"></span> ว่าง
            </span>`;
        case 'occupied':
            return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> กำลังใช้งาน
            </span>`;
        case 'reserved':
            return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span> จองแล้ว
            </span>`;
        case 'maintenance':
            return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> ปิดปรับปรุง
            </span>`;
        default:
            return `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">${status}</span>`;
    }
}

function getBookingStatusBadge(status) {
    switch (status) {
        case 'approved':
            return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">อนุมัติแล้ว</span>`;
        case 'pending':
            return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">รออนุมัติ</span>`;
        case 'cancelled':
            return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">ยกเลิกแล้ว</span>`;
        default:
            return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">${status}</span>`;
    }
}

function getMaintenancePriorityBadge(priority) {
    switch (priority) {
        case 'high':
            return `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-700">ด่วนมาก</span>`;
        case 'medium':
            return `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-700">ปานกลาง</span>`;
        case 'low':
            return `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">ทั่วไป</span>`;
        default:
            return `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">${priority}</span>`;
    }
}

function getMaintenanceStatusBadge(status) {
    switch (status) {
        case 'completed':
            return `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">ซ่อมเสร็จแล้ว</span>`;
        case 'in_progress':
            return `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">กำลังดำเนินการ</span>`;
        case 'open':
            return `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700">รอดำเนินการ</span>`;
        default:
            return `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">${status}</span>`;
    }
}

// Toast Notification
function showToast(message, type = 'info', durationMs = 4500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `flex items-start gap-3 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold transition-all transform duration-300 translate-y-2 opacity-0 text-white ${
        type === 'success' ? 'bg-slate-900/95 border-l-4 border-emerald-500 shadow-emerald-500/20' :
        type === 'error' ? 'bg-slate-900/95 border-l-4 border-rose-500 shadow-rose-500/20' :
        type === 'warning' ? 'bg-slate-900/95 border-l-4 border-amber-500 shadow-amber-500/20' :
        'bg-slate-900/95 border-l-4 border-blue-500 shadow-blue-500/20'
    } backdrop-blur-md`;

    const icon = type === 'success' ? 'check-circle' :
                 type === 'error' ? 'alert-circle' :
                 type === 'warning' ? 'alert-triangle' : 'info';

    toast.innerHTML = `
        <i data-lucide="${icon}" class="w-5 h-5 mt-0.5 shrink-0 ${
            type === 'success' ? 'text-emerald-400' :
            type === 'error' ? 'text-rose-400' :
            type === 'warning' ? 'text-amber-400' : 'text-blue-400'
        }"></i>
        <div class="flex-1 leading-relaxed">${message}</div>
    `;

    container.appendChild(toast);
    if (window.lucide) lucide.createIcons();

    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 50);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, durationMs);
}

function populateInstructorOptions(selectElem) {
    if (!selectElem) return;
    
    // Extract unique instructors
    const instructorsSet = new Set();
    AppState.timetable.forEach(t => {
        if (t.instructor) {
            // Split multi-instructors if comma separated
            t.instructor.split(',').forEach(inst => {
                const clean = inst.trim();
                if (clean) instructorsSet.add(clean);
            });
        }
    });

    const sortedInstructors = Array.from(instructorsSet).sort((a, b) => a.localeCompare(b, 'th'));

    let html = `<option value="ALL">👨‍🏫 อาจารย์ผู้สอนทั้งหมด (${sortedInstructors.length} ท่าน)</option>`;
    html += sortedInstructors.map(inst => `<option value="${inst}">👤 ${inst}</option>`).join('');
    
    selectElem.innerHTML = html;
}

function renderInstructorSchedule(instructorName) {
    const instSchedules = AppState.timetable.filter(s => s.instructor && s.instructor.includes(instructorName));
    
    const days = [
        { name: 'จันทร์', index: 1 },
        { name: 'อังคาร', index: 2 },
        { name: 'พุธ', index: 3 },
        { name: 'พฤหัสบดี', index: 4 },
        { name: 'ศุกร์', index: 5 },
        { name: 'เสาร์', index: 6 },
        { name: 'อาทิตย์', index: 0 }
    ];

    // Unique subjects taught
    const subjects = Array.from(new Set(instSchedules.map(s => s.subject)));
    // Unique rooms used
    const roomIds = Array.from(new Set(instSchedules.map(s => s.roomId)));
    const roomNames = roomIds.map(rid => {
        const r = AppState.rooms.find(rm => rm.id === rid);
        return r ? r.name : rid;
    });

    return `
        <div class="space-y-6">
            <!-- Lecturer Profile Header Banner -->
            <div class="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-blue-800">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div class="flex items-center gap-4">
                        <div class="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-2xl font-bold text-blue-200 shadow-inner">
                            👨‍🏫
                        </div>
                        <div>
                            <div class="inline-block px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[11px] font-semibold mb-1">
                                คณาจารย์ประจำ คณะวิทยาการจัดการ มรน.
                            </div>
                            <h3 class="text-xl font-bold text-white">${instructorName}</h3>
                            <p class="text-xs text-slate-300 mt-1">
                                ภาคการศึกษา 1 / ปีการศึกษา 2569 • ภาระงานสอน ${instSchedules.length} คาบ (${subjects.length} รายวิชา)
                            </p>
                        </div>
                    </div>

                    <div class="flex items-center gap-2">
                        <button onclick="window.print()" class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-white/20">
                            <i data-lucide="printer" class="w-4 h-4"></i> พิมพ์ตารางสอน
                        </button>
                        <button onclick="AppState.selectedInstructorForSchedule = 'ALL'; renderTimetable();" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-sm">
                            <i data-lucide="arrow-left" class="w-4 h-4"></i> ดูทุกท่าน
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-white/10 text-xs">
                    <div>
                        <span class="text-slate-400 block text-[11px]">จำนวนคาบสอนรวม</span>
                        <span class="font-bold text-lg text-emerald-400">${instSchedules.length} คาบ</span>
                    </div>
                    <div>
                        <span class="text-slate-400 block text-[11px]">รายวิชาที่รับผิดชอบ</span>
                        <span class="font-bold text-lg text-blue-300">${subjects.length} วิชา</span>
                    </div>
                    <div class="col-span-2">
                        <span class="text-slate-400 block text-[11px]">ห้องเรียนที่ใช้สอน</span>
                        <span class="font-medium text-xs text-white truncate block">${roomNames.join(', ')}</span>
                    </div>
                </div>
            </div>

            <!-- Weekly Teaching Grid for Instructor -->
            <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h4 class="font-bold text-slate-800 text-base mb-4 flex items-center gap-2">
                    <i data-lucide="calendar" class="w-5 h-5 text-blue-600"></i>
                    ตารางสอนประจำสัปดาห์ของ ${instructorName}
                </h4>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    ${days.map(d => {
                        const dayClasses = instSchedules.filter(s => s.dayIndex === d.index).sort((a, b) => a.startTime.localeCompare(b.startTime));
                        if (dayClasses.length === 0) return '';

                        return `
                            <div class="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                                <div class="flex items-center justify-between pb-2 border-b border-slate-200">
                                    <span class="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                                        <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span> วัน${d.name}
                                    </span>
                                    <span class="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">${dayClasses.length} คาบ</span>
                                </div>
                                <div class="space-y-2">
                                    ${dayClasses.map(c => {
                                        const room = AppState.rooms.find(rm => rm.id === c.roomId) || { name: c.roomId };
                                        return `
                                            <div class="p-3 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-blue-300 transition">
                                                <div class="flex items-center justify-between text-xs mb-1">
                                                    <button onclick="viewRoomTimetable('${room.id}')" class="font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded transition flex items-center gap-0.5" title="คลิกเพื่อดูตารางห้องนี้">${room.name} ↗</button>
                                                    <span class="font-semibold text-slate-600 flex items-center gap-1"><i data-lucide="clock" class="w-3 h-3"></i> ${c.startTime} - ${c.endTime}</span>
                                                </div>
                                                <div class="font-bold text-xs text-slate-800">${c.subject}</div>
                                                <div class="text-[11px] text-slate-500 mt-1">${c.group || 'กลุ่มเรียน'}</div>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}


// ----------------------------------------------------
// DYNAMIC ROOM STATUS SYNC WITH TIMETABLE & BOOKINGS
// ----------------------------------------------------
function syncRoomStatusWithTimetable() {
    const now = new Date();
    
    let dayIndex;
    let timeStr;
    let dayName;

    if (AppState.simulatedTime) {
        dayIndex = AppState.simulatedDayIndex;
        timeStr = AppState.simulatedTime;
        dayName = AppState.simulatedDayName;
    } else {
        dayIndex = now.getDay(); // 0 = Sun, 1 = Mon, ...
        const days = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
        dayName = days[dayIndex];
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        timeStr = `${hours}:${minutes}`;
    }

    const dateStr = now.toISOString().split('T')[0];

    // Find rooms with active maintenance
    const activeMaintenanceRoomIds = new Set(
        (AppState.maintenance || [])
            .filter(m => m.status === 'open' || m.status === 'in_progress')
            .map(m => m.roomId)
    );

    AppState.rooms.forEach(room => {
        // Priority 1: Maintenance
        if (activeMaintenanceRoomIds.has(room.id)) {
            room.status = 'maintenance';
            room.currentClass = null;
            return;
        }

        // Priority 2: Approved booking right now
        const activeBooking = (AppState.bookings || []).find(b => 
            b.roomId === room.id &&
            b.status === 'approved' &&
            b.date === dateStr &&
            timeStr >= b.startTime && timeStr < b.endTime
        );

        if (activeBooking) {
            room.status = 'reserved';
            room.currentClass = {
                subject: activeBooking.subject,
                instructor: activeBooking.bookerName,
                time: `${activeBooking.startTime} - ${activeBooking.endTime} น.`,
                group: activeBooking.department || 'รายการจองใช้งาน',
                type: 'booking'
            };
            return;
        }

        // Priority 3: Scheduled class in timetable for this day & time
        const activeClass = (AppState.timetable || []).find(t => 
            t.roomId === room.id &&
            t.dayIndex === dayIndex &&
            timeStr >= t.startTime && timeStr < t.endTime
        );

        if (activeClass) {
            room.status = 'occupied';
            room.currentClass = {
                subject: activeClass.subject,
                instructor: activeClass.instructor,
                time: `${activeClass.startTime} - ${activeClass.endTime} น.`,
                group: activeClass.group || 'ภาคปกติ',
                type: 'class'
            };
            return;
        }

        // Priority 4: Room is available!
        room.status = 'available';
        room.currentClass = null;

        // Upcoming class today (if any)
        const upcomingClasses = (AppState.timetable || [])
            .filter(t => t.roomId === room.id && t.dayIndex === dayIndex && t.startTime > timeStr)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));
            
        if (upcomingClasses.length > 0) {
            room.nextClass = {
                subject: upcomingClasses[0].subject,
                instructor: upcomingClasses[0].instructor,
                time: `${upcomingClasses[0].startTime} - ${upcomingClasses[0].endTime} น.`
            };
        } else {
            room.nextClass = null;
        }
    });

    // Update simulation status indicator in UI if exists
    updateSimulationBadge(dayName, timeStr);
}

function updateSimulationBadge(dayName, timeStr) {
    const badge = document.getElementById('time-sync-badge');
    if (!badge) return;

    if (AppState.simulatedTime) {
        badge.innerHTML = `
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                จำลองเวลา: วัน${dayName} ${timeStr} น.
            </span>
        `;
    } else {
        badge.innerHTML = `
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                เวลาจริง: วัน${dayName} ${timeStr} น.
            </span>
        `;
    }
}

function setSimulatedTime(dayIndex, dayName, timeStr) {
    AppState.simulatedDayIndex = dayIndex;
    AppState.simulatedDayName = dayName;
    AppState.simulatedTime = timeStr;
    syncRoomStatusWithTimetable();
    renderCurrentTab();
    showToast(`จำลองเวลาเป็น: วัน${dayName} เวลา ${timeStr} น. สถานะห้องถูกอัปเดตสัมพันธ์กับตารางเรียนแล้ว`, 'info');
}

function resetToRealTime() {
    AppState.simulatedDayIndex = null;
    AppState.simulatedDayName = null;
    AppState.simulatedTime = null;
    syncRoomStatusWithTimetable();
    renderCurrentTab();
    showToast('กลับสู่โหมดเวลาจริงของระบบแล้ว', 'success');
}


// ----------------------------------------------------
// ADMIN AUTHENTICATION & MANAGEMENT
// ----------------------------------------------------
function openAdminLoginModal() {
    openModal('modal-admin-login');
}

function handleAdminLogin(event) {
    event.preventDefault();
    const pin = event.target.adminPin.value;
    if (pin === 'Khong2739') {
        AppState.isAdmin = true;
        sessionStorage.setItem('CMS_IS_ADMIN', 'true');
        closeModal('modal-admin-login');
        event.target.reset();
        updateAdminHeaderUI();
        updateAdminPendingBadge();
        updateAdminMaintenanceBadge();
        renderCurrentTab();
        showToast('เข้าสู่ระบบผู้ดูแล (Admin Mode) สำเร็จ!', 'success');
        if (AppState.googleScriptUrl) {
            fetchDataFromGoogleSheets(false);
        }
    } else {
        showToast('รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง', 'error');
    }
}

function logoutAdmin() {
    AppState.isAdmin = false;
    sessionStorage.removeItem('CMS_IS_ADMIN');
    updateAdminHeaderUI();
    if (AppState.currentTab === 'settings') {
        switchTab('dashboard');
    } else {
        renderCurrentTab();
    }
    showToast('ออกจากระบบผู้ดูแลแล้ว (กลับสู่โหมดผู้ใช้งานทั่วไป)', 'info');
}

function updateAdminHeaderUI() {
    const adminContainer = document.getElementById('admin-header-status');
    if (adminContainer) {
        if (AppState.isAdmin) {
            adminContainer.innerHTML = `
                <div class="flex items-center gap-2 bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 rounded-xl shadow-xs">
                    <span class="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <i data-lucide="shield-check" class="w-4 h-4 text-amber-400"></i>
                        <span>Admin Mode</span>
                    </span>
                    <span id="admin-pending-count-badge" class="px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-[10px] font-extrabold hidden">0</span>
                    <button onclick="logoutAdmin()" class="text-[11px] text-slate-300 hover:text-white underline ml-1">
                        ออก
                    </button>
                </div>
            `;
        } else {
            adminContainer.innerHTML = `
                <button onclick="openAdminLoginModal()" class="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700">
                    <i data-lucide="shield" class="w-3.5 h-3.5 text-blue-400"></i>
                    <span>สำหรับ Admin</span>
                </button>
            `;
        }
    }

    // Toggle visibility for all admin-only elements across navbar and views
    document.querySelectorAll('.admin-only-nav').forEach(el => {
        el.classList.toggle('hidden', !AppState.isAdmin);
    });
    document.querySelectorAll('.admin-only-action').forEach(el => {
        el.classList.toggle('hidden', !AppState.isAdmin);
    });

    updateAdminPendingBadge();
    updateAdminMaintenanceBadge();
    lucide.createIcons();
}

function rejectBooking(bookingId) {
    if (!AppState.isAdmin) {
        showToast('สิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น', 'warning');
        return;
    }
    const booking = AppState.bookings.find(b => b.id === bookingId);
    if (booking) {
        booking.status = 'rejected';
        saveData();
        updateAdminPendingBadge();
        renderBookings();
        showToast(`ปฏิเสธคำขอจอง ${bookingId} เรียบร้อยแล้ว`, 'info');
        broadcastDataChange('REJECT_BOOKING', { id: bookingId });
        sendActionToGoogleBackend('rejectBooking', { id: bookingId });
    }
}

function filterBookingsByStatus(status) {
    AppState.bookingFilterStatus = status;
    document.querySelectorAll('.booking-filter-btn').forEach(btn => {
        if (btn.dataset.status === status) {
            btn.classList.add('bg-blue-600', 'text-white', 'shadow-xs');
            btn.classList.remove('bg-white', 'text-slate-600');
        } else {
            btn.classList.remove('bg-blue-600', 'text-white', 'shadow-xs');
            btn.classList.add('bg-white', 'text-slate-600');
        }
    });
    renderBookings();
}

function forceReloadMasterTimetable() {
    AppState.timetable = DEFAULT_TIMETABLE;
    AppState.rooms = DEFAULT_ROOMS;
    saveData();
    renderCurrentTab();
    if (typeof showToast === 'function') {
        showToast('โหลดตารางเรียน 184 คาบเรียนเรียบร้อยแล้ว!', 'success');
    }
}

/**
 * แปลงและปรับปรุงข้อมูลการจองที่ได้รับจากคลาวด์ Google Sheets
 */
function mapAndApplyCloudBookings(rawBookings, rawMaintenance = null) {
    if (!Array.isArray(rawBookings)) rawBookings = [];
    const prevPendingCount = AppState.bookings.filter(b => b.status === 'pending').length;
    const deletedMntIds = getDeletedMaintenanceIds();

    const isMaintenanceRecord = (b) => {
        const strId = String(b.id || '').trim().toUpperCase();
        const strSubj = String(b.subject || b.purpose || '');
        const strDept = String(b.department || '');
        return strId.startsWith('MNT-') || strSubj.includes('[MNT') || strDept.includes('แจ้งซ่อม');
    };

    // 1. Separate maintenance records that were synced through the cloud bookings channel
    const mntRows = rawBookings.filter(isMaintenanceRecord);

    const extractedFromBookings = mntRows.filter(b => {
        const strId = String(b.id || '').trim();
        if (deletedMntIds.has(strId)) return false;
        const st = String(b.status || '').toLowerCase().trim();
        return st !== 'cancelled' && st !== 'deleted';
    }).map(b => {
        const repDate = parseGasDate(b.date);
        const rawSubj = String(b.subject || b.purpose || 'แจ้งปัญหาอุปกรณ์');
        const catMatch = rawSubj.match(/\[MNT:?([^\]]*)\]/i);
        let catName = catMatch && catMatch[1] ? catMatch[1].trim() : '';
        if (!catName && b.department) {
            const deptMatch = String(b.department).match(/แจ้งซ่อม\s*\(([^-\)]+)/i);
            if (deptMatch && deptMatch[1]) catName = deptMatch[1].trim();
        }
        const cleanTitle = rawSubj.replace(/\[MNT[^\]]*\]\s*/i, '').trim() || 'แจ้งปัญหาอุปกรณ์';
        const rawStatus = String(b.status || 'open').toLowerCase().trim();
        const mStatus = (rawStatus === 'approved' || rawStatus === 'completed') ? 'completed' : 'open';
        const mPriority = (String(b.department || '').toLowerCase().includes('high') || String(b.startTime || '').toLowerCase().includes('high')) ? 'high' : 'medium';
        const roomId = String(b.roomId || b.roomid || '');
        const roomObj = AppState.rooms.find(r => r.id === roomId);
        const roomName = String(b.roomName || b.roomname || (roomObj ? roomObj.name : roomId));
        const dummyTicket = { title: cleanTitle, details: String(b.purpose || ''), categoryName: catName };
        const detectedCat = detectMaintenanceCategory(dummyTicket);
        return {
            id: String(b.id),
            roomId: roomId,
            roomName: roomName,
            reportedDate: repDate || new Date().toISOString().slice(0, 10),
            category: detectedCat,
            categoryName: (MAINTENANCE_CATEGORIES[detectedCat] || MAINTENANCE_CATEGORIES.other).name,
            title: cleanTitle,
            details: String(b.purpose || ''),
            reporter: String(b.bookerName || b.reservedBy || b.reservedby || 'ผู้ใช้งาน'),
            status: mStatus,
            priority: mPriority
        };
    });

    let extractedFromSheet = [];
    if (Array.isArray(rawMaintenance) && rawMaintenance.length > 0) {
        extractedFromSheet = rawMaintenance.filter(m => {
            const mId = String(m.id || m.ID || '').trim();
            if (deletedMntIds.has(mId)) return false;
            const st = String(m.status || '').toLowerCase().trim();
            return mId !== 'MNT-001' && mId !== 'MNT-002' && st !== 'cancelled' && st !== 'deleted';
        }).map(m => {
            const repDate = parseGasDate(m.reportedDate || m.reporteddate || m.date || '');
            const rId = String(m.roomId || m.roomid || '');
            const rObj = AppState.rooms.find(r => r.id === rId);
            const rName = String(m.roomName || m.roomname || (rObj ? rObj.name : rId));
            const dummyTicket = { title: m.title || m.item || '', details: m.details || m.description || '', category: m.category || '', categoryName: m.categoryName || '' };
            const detectedCat = detectMaintenanceCategory(dummyTicket);
            return {
                id: String(m.id || m.ID || ('MNT-' + Math.floor(100 + Math.random() * 900))),
                roomId: rId,
                roomName: rName,
                reportedDate: repDate || new Date().toISOString().slice(0, 10),
                category: detectedCat,
                categoryName: (MAINTENANCE_CATEGORIES[detectedCat] || MAINTENANCE_CATEGORIES.other).name,
                title: String(m.title || m.item || 'แจ้งปัญหาอุปกรณ์'),
                details: String(m.details || m.description || ''),
                reporter: String(m.reporter || m.reportedBy || m.reportedby || 'ผู้ใช้งาน'),
                status: String(m.status || 'open').toLowerCase().trim(),
                priority: String(m.priority || 'medium').toLowerCase().trim()
            };
        });
    }

    // สร้าง Map รายการแจ้งซ่อมที่ถูกต้องจาก Cloud จริง
    const cloudMntMap = new Map();
    extractedFromBookings.forEach(m => cloudMntMap.set(m.id, m));
    extractedFromSheet.forEach(m => cloudMntMap.set(m.id, m));

    // แจ้งเตือนผู้ใช้หากมีรายการซ่อมที่ได้รับการยืนยันว่าซ่อมเสร็จแล้ว
    cloudMntMap.forEach(cloudTicket => {
        const existing = AppState.maintenance.find(cur => cur.id === cloudTicket.id);
        if (existing && existing.status !== 'completed' && cloudTicket.status === 'completed') {
            showToast(`🔧 รายการแจ้งซ่อม ${cloudTicket.id} (${cloudTicket.roomName || ''}) ได้รับการซ่อมเสร็จสิ้นแล้ว!`, 'success', 6000);
        }
    });

    // รักษาเฉพาะรายการที่เพิ่งสร้างในเครื่องปัจจุบันไม่เกิน 60 วินาทีที่ยังรอ Cloud บันทึก
    AppState.maintenance.forEach(m => {
        if (m._localCreatedAt && (Date.now() - m._localCreatedAt < 60000) && !deletedMntIds.has(m.id) && !cloudMntMap.has(m.id)) {
            cloudMntMap.set(m.id, m);
        }
    });

    // ซิงก์ข้อมูลตามคลาวด์: รวมรายการที่ได้รับจากคลาวด์และรายการที่เพิ่งสร้างในเครื่อง
    const nextMaintenance = Array.from(cloudMntMap.values());

    // จัดเรียงรายการแจ้งซ่อม: รายการที่ยังไม่เสร็จ (open, in_progress) อยู่บนสุดเสมอ ตามด้วยวันที่ล่าสุด
    nextMaintenance.sort((a, b) => {
        const aOpen = (a.status === 'open' || a.status === 'in_progress');
        const bOpen = (b.status === 'open' || b.status === 'in_progress');
        if (aOpen && !bOpen) return -1;
        if (!aOpen && bOpen) return 1;
        return (b.reportedDate || '').localeCompare(a.reportedDate || '');
    });

    // ตรวจสอบว่ามีการเปลี่ยนแปลงจริงหรือไม่ก่อนสั่ง redraw เพื่อแก้ปัญหาตารางเด้งเข้าเด้งออกและกระพริบ
    const currentMntSig = (AppState.maintenance || []).map(m => `${m.id}:${m.status}:${m.category}`).join('|');
    const nextMntSig = nextMaintenance.map(m => `${m.id}:${m.status}:${m.category}`).join('|');
    const mntChanged = (currentMntSig !== nextMntSig);

    // ตรวจสอบรายการใหม่ที่ยังไม่เคยมีมาก่อน (สำหรับแจ้งเตือน Admin อย่างถูกต้อง ไม่เตือนซ้ำ)
    if (!AppState._knownMaintenanceIds) {
        AppState._knownMaintenanceIds = new Set((AppState.maintenance || []).map(m => m.id));
    }
    const trulyNewTickets = nextMaintenance.filter(m => (m.status === 'open' || m.status === 'in_progress') && !AppState._knownMaintenanceIds.has(m.id));
    trulyNewTickets.forEach(m => AppState._knownMaintenanceIds.add(m.id));

    if (mntChanged) {
        AppState.maintenance = nextMaintenance;
        updateAdminMaintenanceBadge();

        // Check if any rooms were in maintenance but all tickets are now completed or deleted
        AppState.rooms.forEach(r => {
            if (r.status === 'maintenance') {
                const hasOpen = AppState.maintenance.some(m => m.roomId === r.id && m.status !== 'completed');
                if (!hasOpen) {
                    r.status = 'available';
                }
            }
        });

        saveData();
        if (AppState.currentTab === 'maintenance' || AppState.currentTab === 'dashboard') {
            renderCurrentTab();
        }
    }

    if (AppState.isAdmin && trulyNewTickets.length > 0) {
        playNotificationSound();
        showToast(`🔧 มีรายการแจ้งซ่อมใหม่เข้ามา! (${trulyNewTickets.length} รายการใหม่) กรุณาตรวจสอบ`, 'warning', 8000);
    }

    // 2. Pure classroom bookings (excluding MNT records and empty items)
    const pureBookings = rawBookings.filter(b => {
        const hasInfo = Boolean(b.roomId || b.roomid || b.date || b.subject || b.purpose || b.reservedBy || b.reservedby);
        return !isMaintenanceRecord(b) && hasInfo;
    });

    const parsedBookings = pureBookings.map(b => {
        const dateStr = parseGasDate(b.date);
        const sTime = parseGasTime(b.startTime || b.starttime || '');
        const eTime = parseGasTime(b.endTime || b.endtime || '');

        const bName = (b.bookerName || b.bookername || b.reservedBy || b.reservedby || '').trim();
        const bSubject = (b.subject || b.purpose || 'ขอใช้ห้องเรียน/ห้องปฏิบัติการ').trim();
        const bPurpose = (b.purpose || b.subject || '').trim();
        const bDept = (b.department || '').trim();
        const bPhone = (b.phone ? String(b.phone) : '').trim();
        const bStatus = (b.status || 'pending').toLowerCase().trim();

        const roomId = String(b.roomId || b.roomid || '');
        const roomObj = AppState.rooms.find(r => r.id === roomId);
        const roomName = String(b.roomName || b.roomname || (roomObj ? roomObj.name : roomId));

        return {
            id: String(b.id || b.ID || ('BK-' + Math.floor(1000 + Math.random() * 9000))),
            roomId: roomId,
            roomName: roomName,
            date: dateStr,
            startTime: sTime,
            endTime: eTime,
            subject: bSubject,
            purpose: bPurpose,
            bookerName: bName || 'ผู้ขอจองทั่วไป',
            reservedBy: bName || 'ผู้ขอจองทั่วไป',
            reservedby: bName || 'ผู้ขอจองทั่วไป',
            department: bDept,
            phone: bPhone,
            status: bStatus,
            createdAt: String(b.createdAt || b.createdat || '')
        };
    });

    // ปักหมุดรายการรออนุมัติ (pending) ไว้บนสุดเสมอ ตามด้วยรายการจองล่าสุด (newest first)
    parsedBookings.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA && timeB && timeA !== timeB) return timeB - timeA;
        return (b.date || '').localeCompare(a.date || '');
    });

    AppState.bookings = parsedBookings;

    saveData();
    updateAdminPendingBadge();
    if (AppState.currentTab === 'bookings' || AppState.currentTab === 'dashboard') {
        renderCurrentTab();
    }

    const newPendingCount = AppState.bookings.filter(b => b.status === 'pending').length;
    if (AppState.isAdmin && newPendingCount > prevPendingCount) {
        playNotificationSound();
        showToast(`🔔 มีคำขอจองห้องเรียนใหม่เข้ามา! (${newPendingCount} รายการรออนุมัติ) กรุณาตรวจสอบและอนุมัติ`, 'warning', 8000);
    }
}

/**
 * อัปเดตป้ายแจ้งเตือนคำขอจองห้องที่รอการอนุมัติ (Pending Badge) ทุกจุดในระบบ
 */
function updateAdminPendingBadge() {
    const pendingCount = AppState.bookings.filter(b => b.status === 'pending').length;

    // Header badge
    const adminPendingBadge = document.getElementById('admin-pending-count-badge');
    if (adminPendingBadge) {
        if (pendingCount > 0) {
            adminPendingBadge.textContent = pendingCount;
            adminPendingBadge.classList.remove('hidden');
        } else {
            adminPendingBadge.classList.add('hidden');
        }
    }

    // Sidebar & Mobile Nav badges
    document.querySelectorAll('.booking-pending-badge').forEach(badge => {
        if (pendingCount > 0) {
            badge.textContent = pendingCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });

    // Dashboard Pending Alert
    updateDashboardPendingAlert(pendingCount);
}

/**
 * แสดงกล่องแจ้งเตือนคำขอจองห้องเรียนที่รออนุมัติในหน้า Dashboard
 */
function updateDashboardPendingAlert(pendingCount) {
    const container = document.getElementById('dash-pending-alert-container');
    if (!container) return;

    if (AppState.isAdmin && pendingCount > 0) {
        container.innerHTML = `
            <div class="mb-5 p-4 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-orange-500/15 border-2 border-amber-400/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
                        <i data-lucide="bell-ring" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-amber-950 text-sm flex items-center gap-2">
                            <span>มีคำขอจองห้องเรียนใหม่รอการตรวจสอบและอนุมัติ</span>
                            <span class="px-2 py-0.5 bg-rose-500 text-white rounded-full text-[11px] font-extrabold">${pendingCount} รายการ</span>
                        </h4>
                        <p class="text-xs text-amber-800 mt-0.5">มีผู้ใช้งานส่งคำขอจองห้องเข้ามา กรุณาตรวจสอบและอนุมัติเพื่อให้ห้องขึ้นสถานะจองในระบบ</p>
                    </div>
                </div>
                <button onclick="switchTab('bookings')" class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-sm shrink-0">
                    <i data-lucide="calendar-check" class="w-4 h-4"></i> ตรวจสอบคำขอจองห้อง (${pendingCount})
                </button>
            </div>
        `;
        lucide.createIcons();
    } else {
        container.innerHTML = '';
    }
}

/**
 * อัปเดตป้ายแจ้งเตือนงานแจ้งซ่อมที่รอดำเนินการ (Maintenance Badge)
 */
function updateAdminMaintenanceBadge() {
    const openCount = AppState.maintenance.filter(m => m.status === 'open' || m.status === 'in_progress').length;

    document.querySelectorAll('.maintenance-pending-badge').forEach(badge => {
        if (openCount > 0) {
            badge.textContent = openCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });

    updateDashboardMaintenanceAlert(openCount);
}

/**
 * แสดงกล่องแจ้งเตือนรายการแจ้งซ่อมที่รอดำเนินการบนหน้า Dashboard สำหรับ Admin
 */
function updateDashboardMaintenanceAlert(openCount) {
    const container = document.getElementById('dash-maintenance-alert-container');
    if (!container) return;

    if (AppState.isAdmin && openCount > 0) {
        container.innerHTML = `
            <div class="mb-4 p-4 bg-gradient-to-r from-rose-500/15 via-rose-400/10 to-amber-500/15 border-2 border-rose-400/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
                        <i data-lucide="wrench" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-rose-950 text-sm flex items-center gap-2">
                            <span>มีรายการแจ้งซ่อมอุปกรณ์ที่รอดำเนินการ</span>
                            <span class="px-2 py-0.5 bg-rose-600 text-white rounded-full text-[11px] font-extrabold">${openCount} รายการ</span>
                        </h4>
                        <p class="text-xs text-rose-900 mt-0.5">มีผู้ใช้งานรายงานอุปกรณ์ชำรุดเข้ามาในระบบ กรุณาตรวจสอบเพื่อประสานงานช่างเข้าแก้ไข</p>
                    </div>
                </div>
                <button onclick="switchTab('maintenance')" class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition shadow-sm shrink-0">
                    <i data-lucide="wrench" class="w-4 h-4"></i> จัดการรายการแจ้งซ่อม (${openCount})
                </button>
            </div>
        `;
        lucide.createIcons();
    } else {
        container.innerHTML = '';
    }
}


// ====================================================
// ROOMS & TIMETABLE CRUD CONTROLLER FUNCTIONS (ADMIN ONLY)
// ====================================================

function openEditRoomModal(roomId) {
    if (!AppState.isAdmin) {
        showToast('สิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น', 'warning');
        return;
    }
    const room = AppState.rooms.find(r => r.id === roomId);
    if (!room) return;

    closeModal('modal-room-detail');

    const form = document.getElementById('form-edit-room');
    if (!form) return;

    form.roomId.value = room.id;
    form.roomName.value = room.name || '';
    form.roomType.value = room.type || 'general';
    form.categoryName.value = room.categoryName || '';
    form.floor.value = room.floor || '';
    form.building.value = room.building || '';
    form.capacity.value = room.capacity || 40;
    form.pcCount.value = room.pcCount || 0;
    form.status.value = room.status || 'available';
    form.description.value = room.description || '';
    form.image.value = room.image || '';
    form.facilities.value = Array.isArray(room.facilities) ? room.facilities.join(', ') : (room.facilities || '');

    if (form.cpu) form.cpu.value = (room.specs && room.specs.cpu) ? room.specs.cpu : '';
    if (form.ram) form.ram.value = (room.specs && room.specs.ram) ? room.specs.ram : '';
    if (form.gpu) form.gpu.value = (room.specs && room.specs.gpu) ? room.specs.gpu : '';
    if (form.storage) form.storage.value = (room.specs && room.specs.storage) ? room.specs.storage : '';
    if (form.software) form.software.value = Array.isArray(room.software) ? room.software.join(', ') : (room.software || '');

    toggleEditLabFieldsVisibility(room.type);
    openModal('modal-edit-room');
}

function toggleEditLabFieldsVisibility(type) {
    const labSec = document.getElementById('edit-room-lab-specs');
    if (labSec) {
        if (type === 'computer_lab') {
            labSec.classList.remove('hidden');
        } else {
            labSec.classList.add('hidden');
        }
    }
}

function handleEditRoomSubmit(event) {
    event.preventDefault();
    if (!AppState.isAdmin) {
        showToast('สิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น', 'warning');
        return;
    }
    const form = event.target;
    const roomId = form.roomId.value;
    const room = AppState.rooms.find(r => r.id === roomId);
    if (!room) return;

    const facilitiesArr = form.facilities.value.split(',').map(s => s.trim()).filter(Boolean);
    const softwareArr = form.software ? form.software.value.split(',').map(s => s.trim()).filter(Boolean) : [];

    room.name = form.roomName.value.trim();
    room.type = form.roomType.value;
    room.categoryName = form.categoryName.value.trim() || (room.type === 'computer_lab' ? 'ห้องปฏิบัติการคอมพิวเตอร์' : (room.type === 'meeting_room' ? 'ห้องประชุม / สัมมนา' : 'ห้องเรียนทฤษฎี'));
    room.floor = form.floor.value.trim();
    room.building = form.building.value.trim();
    room.capacity = parseInt(form.capacity.value) || 40;
    room.pcCount = parseInt(form.pcCount.value) || 0;
    room.status = form.status.value;
    room.description = form.description.value.trim();
    room.image = form.image.value.trim() || room.image;
    room.facilities = facilitiesArr;

    if (room.type === 'computer_lab') {
        room.specs = {
            cpu: form.cpu ? form.cpu.value.trim() : (room.specs?.cpu || ''),
            ram: form.ram ? form.ram.value.trim() : (room.specs?.ram || ''),
            gpu: form.gpu ? form.gpu.value.trim() : (room.specs?.gpu || ''),
            storage: form.storage ? form.storage.value.trim() : (room.specs?.storage || '')
        };
        room.software = softwareArr;
    }

    saveData();
    closeModal('modal-edit-room');
    renderRooms();
    showToast(`อัปเดตข้อมูล ${room.name} สำเร็จ!`, 'success');
    sendActionToGoogleBackend('updateRoom', { room: room });
}

function deleteRoom(roomId) {
    if (!AppState.isAdmin) {
        showToast('สิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น', 'warning');
        return;
    }
    const room = AppState.rooms.find(r => r.id === roomId);
    if (!room) return;

    if (confirm(`⚠️ ยืนยันการลบห้อง "${room.name}" (${roomId}) ออกจากระบบหรือไม่?\n\nการลบห้องจะส่งผลต่อการจองและตารางเรียนที่เกี่ยวข้องกับห้องนี้`)) {
        AppState.rooms = AppState.rooms.filter(r => r.id !== roomId);
        saveData();
        closeModal('modal-room-detail');
        renderRooms();
        showToast(`ลบห้อง ${room.name} ออกจากระบบเรียบร้อยแล้ว`, 'success');
        broadcastDataChange('DELETE_ROOM', { id: roomId });
        sendActionToGoogleBackend('deleteRoom', { id: roomId });
    }
}

// ----------------------------------------------------
// TIMETABLE CRUD FUNCTIONS (ADMIN ONLY)
// ----------------------------------------------------

function openAddTimetableModal(prefillRoomId = '', prefillDayName = '', prefillStartTime = '08:20', prefillEndTime = '12:20') {
    if (!AppState.isAdmin) {
        showToast('สิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น', 'warning');
        return;
    }
    const form = document.getElementById('form-timetable');
    if (!form) return;

    form.reset();
    form.timetableId.value = '';
    const titleElem = document.getElementById('modal-timetable-title');
    if (titleElem) titleElem.innerText = 'เพิ่มคาบเรียนประจำสัปดาห์';

    const roomSelect = form.roomId;
    if (roomSelect) {
        populateRoomOptions(roomSelect, false);
        if (prefillRoomId && prefillRoomId !== 'ALL') {
            roomSelect.value = prefillRoomId;
        }
    }

    if (prefillDayName) {
        const daysMap = { 'จันทร์': 1, 'อังคาร': 2, 'พุธ': 3, 'พฤหัสบดี': 4, 'ศุกร์': 5, 'เสาร์': 6, 'อาทิตย์': 0 };
        if (daysMap[prefillDayName] !== undefined) form.dayIndex.value = daysMap[prefillDayName];
    }

    if (prefillStartTime) setSelectValueOrAdd(form.startTime, prefillStartTime);
    if (prefillEndTime) setSelectValueOrAdd(form.endTime, prefillEndTime);

    openModal('modal-timetable-form');
}

function openEditTimetableModal(timetableId) {
    if (!AppState.isAdmin) {
        showToast('สิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น', 'warning');
        return;
    }
    const item = AppState.timetable.find(s => s.id === timetableId);
    if (!item) return;

    const form = document.getElementById('form-timetable');
    if (!form) return;

    form.timetableId.value = item.id;
    const titleElem = document.getElementById('modal-timetable-title');
    if (titleElem) titleElem.innerText = `แก้ไขคาบเรียน: ${item.code || item.subject.split(' ')[0]}`;

    const roomSelect = form.roomId;
    if (roomSelect) {
        populateRoomOptions(roomSelect, false);
        roomSelect.value = item.roomId;
    }

    form.dayIndex.value = item.dayIndex;
    setSelectValueOrAdd(form.startTime, item.startTime);
    setSelectValueOrAdd(form.endTime, item.endTime);
    form.code.value = item.code || '';
    form.subject.value = item.subject || '';
    form.instructor.value = item.instructor || '';
    form.group.value = item.group || '';
    form.color.value = item.color || 'blue';

    openModal('modal-timetable-form');
}

function handleTimetableFormSubmit(event) {
    event.preventDefault();
    if (!AppState.isAdmin) {
        showToast('สิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น', 'warning');
        return;
    }
    const form = event.target;
    const timetableId = form.timetableId.value;
    const roomId = form.roomId.value;
    const dayIndex = parseInt(form.dayIndex.value);
    const daysNames = { 1: 'จันทร์', 2: 'อังคาร', 3: 'พุธ', 4: 'พฤหัสบดี', 5: 'ศุกร์', 6: 'เสาร์', 0: 'อาทิตย์' };
    const dayName = daysNames[dayIndex] || 'จันทร์';
    const startTime = form.startTime.value;
    const endTime = form.endTime.value;
    const code = form.code.value.trim();
    const subject = form.subject.value.trim();
    const instructor = form.instructor.value.trim();
    const group = form.group.value.trim();
    const color = form.color.value;

    if (startTime >= endTime) {
        showToast('เวลาเริ่มต้นต้องน้อยกว่าเวลาสิ้นสุด', 'error');
        return;
    }

    if (timetableId) {
        // Edit existing
        const item = AppState.timetable.find(s => s.id === timetableId);
        if (!item) return;
        item.roomId = roomId;
        item.day = dayName;
        item.dayIndex = dayIndex;
        item.startTime = startTime;
        item.endTime = endTime;
        item.code = code;
        item.subject = subject;
        item.instructor = instructor;
        item.group = group;
        item.color = color;

        saveData();
        closeModal('modal-timetable-form');
        renderTimetable();
        showToast(`แก้ไขคาบเรียน ${code || subject} สำเร็จ!`, 'success');
        sendActionToGoogleBackend('updateTimetable', { item: item });
    } else {
        // Create new
        const newId = 'TT-' + Date.now().toString().slice(-4);
        const newItem = {
            id: newId,
            roomId: roomId,
            day: dayName,
            dayIndex: dayIndex,
            startTime: startTime,
            endTime: endTime,
            code: code,
            subject: subject,
            instructor: instructor,
            group: group,
            color: color
        };
        AppState.timetable.push(newItem);
        saveData();
        closeModal('modal-timetable-form');
        renderTimetable();
        showToast(`เพิ่มคาบเรียน ${code || subject} สำเร็จ!`, 'success');
        sendActionToGoogleBackend('addTimetable', { item: newItem });
    }
}

function deleteTimetable(timetableId) {
    if (!AppState.isAdmin) {
        showToast('สิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น', 'warning');
        return;
    }
    const item = AppState.timetable.find(s => s.id === timetableId);
    if (!item) return;

    if (confirm(`🗑️ ยืนยันการลบคาบเรียน "${item.subject}" (วัน${item.day} ${item.startTime}-${item.endTime} น.) ออกจากตารางเรียนใช่หรือไม่?`)) {
        AppState.timetable = AppState.timetable.filter(s => s.id !== timetableId);
        saveData();
        renderTimetable();
        showToast(`ลบคาบเรียน ${item.subject.split(' ')[0]} เรียบร้อยแล้ว`, 'success');
        broadcastDataChange('DELETE_TIMETABLE', { id: timetableId });
        sendActionToGoogleBackend('deleteTimetable', { id: timetableId });
    }
}


/**
 * =========================================================================
 * EXECUTIVE ANALYTICS & REPORTING SYSTEM (Chart.js Suite)
 * ระบบรายงานสถิติและแดชบอร์ดสรุปผลสำหรับผู้บริหาร
 * =========================================================================
 */
let reportChartInstances = {};

function destroyReportChart(chartId) {
    if (reportChartInstances[chartId]) {
        try {
            reportChartInstances[chartId].destroy();
        } catch (e) {
            console.warn(`Error destroying chart ${chartId}:`, e);
        }
        delete reportChartInstances[chartId];
    }
}

function toggleReportExportMenu() {
    const dropdown = document.getElementById('report-export-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
}

// Close export dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('report-export-dropdown');
    if (dropdown && !dropdown.classList.contains('hidden')) {
        if (!e.target.closest('#report-export-dropdown') && !e.target.closest('button[onclick*="toggleReportExportMenu"]')) {
            dropdown.classList.add('hidden');
        }
    }
});

function setReportTimeframe(tf) {
    AppState.reportTimeframe = tf || 'all';
    document.querySelectorAll('.report-tf-btn').forEach(btn => {
        if (btn.dataset.tf === AppState.reportTimeframe) {
            btn.classList.add('bg-blue-600', 'text-white', 'shadow-xs');
            btn.classList.remove('text-slate-300', 'hover:text-white');
        } else {
            btn.classList.remove('bg-blue-600', 'text-white', 'shadow-xs');
            btn.classList.add('text-slate-300', 'hover:text-white');
        }
    });
    renderReportsView();
}

function printExecutiveReport() {
    const printDateEl = document.getElementById('report-print-date');
    if (printDateEl) {
        printDateEl.textContent = formatThaiDate(new Date(), true) + ' เวลา ' + new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
    }
    const printTfEl = document.getElementById('report-print-timeframe');
    if (printTfEl) {
        const tfNames = {
            'all': 'ข้อมูลสะสมทั้งหมด',
            'month': 'ประจำเดือนปัจจุบัน (' + new Date().toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }) + ')',
            'week': 'ข้อมูลย้อนหลัง 7 วันล่าสุด',
            'semester': 'ภาคการศึกษาที่ 1/2569'
        };
        printTfEl.textContent = tfNames[AppState.reportTimeframe] || 'ข้อมูลสะสมทั้งหมด';
    }
    const printUserEl = document.getElementById('report-print-user');
    if (printUserEl) {
        printUserEl.textContent = AppState.isAdmin ? 'ผู้ดูแลระบบ (Admin) - งานบริการการศึกษา' : 'ผู้ใช้งานระบบ (User)';
    }

    setTimeout(() => {
        window.print();
    }, 250);
}

function exportReportCSV(type) {
    const tf = AppState.reportTimeframe || 'all';
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);

    if (type === 'bookings') {
        const bookings = getFilteredReportBookings(tf);
        if (bookings.length === 0) {
            showToast('ไม่มีข้อมูลการจองในช่วงเวลานี้สำหรับส่งออก', 'warning');
            return;
        }
        let csv = "\uFEFFลำดับ,รหัสการจอง,ห้องเรียน,วันที่,เวลาเริ่มต้น,เวลาสิ้นสุด,หัวข้อ/วิชา,วัตถุประสงค์,ผู้ขอจอง,หน่วยงาน/สาขา,เบอร์โทร,สถานะ\n";
        bookings.forEach((b, idx) => {
            const statusTh = b.status === 'approved' ? 'อนุมัติแล้ว' : (b.status === 'rejected' ? 'ไม่อนุมัติ' : (b.status === 'cancelled' ? 'ยกเลิก' : 'รออนุมัติ'));
            csv += `"${idx + 1}","${b.id || ''}","${b.roomName || b.roomId || ''}","${formatThaiDate(b.date)}","${b.startTime || ''}","${b.endTime || ''}","${(b.subject || '').replace(/"/g, '""')}","${(b.purpose || '').replace(/"/g, '""')}","${(b.bookerName || '').replace(/"/g, '""')}","${(b.department || '').replace(/"/g, '""')}","${b.phone || ''}","${statusTh}"\n`;
        });
        downloadCSVFile(csv, `Executive_Bookings_Report_${tf}_${dateStr}.csv`);
        showToast(`ส่งออกสถิติการจอง (${bookings.length} รายการ) เป็นไฟล์ CSV เรียบร้อยแล้ว`, 'success');
    } else if (type === 'maintenance') {
        const tickets = getFilteredReportMaintenance(tf);
        if (tickets.length === 0) {
            showToast('ไม่มีข้อมูลแจ้งซ่อมในช่วงเวลานี้สำหรับส่งออก', 'warning');
            return;
        }
        let csv = "\uFEFFลำดับ,รหัสแจ้งซ่อม,ห้องเรียน,วันที่แจ้ง,หมวดหมู่อุปกรณ์,หัวข้อปัญหา,รายละเอียด,ผู้แจ้ง,ระดับความด่วน,สถานะ\n";
        tickets.forEach((m, idx) => {
            const statusTh = m.status === 'completed' ? 'ซ่อมเสร็จสิ้น' : (m.status === 'in_progress' ? 'กำลังซ่อม' : 'รอดำเนินการ');
            const catName = (typeof MAINTENANCE_CATEGORIES !== 'undefined' && MAINTENANCE_CATEGORIES[m.category]) ? MAINTENANCE_CATEGORIES[m.category].name : (m.categoryName || 'ทั่วไป');
            csv += `"${idx + 1}","${m.id || ''}","${m.roomName || m.roomId || ''}","${formatThaiDate(m.reportedDate)}","${catName}","${(m.title || '').replace(/"/g, '""')}","${(m.details || '').replace(/"/g, '""')}","${(m.reporter || '').replace(/"/g, '""')}","${m.priority || 'medium'}","${statusTh}"\n`;
        });
        downloadCSVFile(csv, `Executive_Maintenance_Report_${tf}_${dateStr}.csv`);
        showToast(`ส่งออกสถิติแจ้งซ่อม (${tickets.length} รายการ) เป็นไฟล์ CSV เรียบร้อยแล้ว`, 'success');
    }
}

function downloadCSVFile(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function getFilteredReportBookings(tf) {
    const bookings = Array.isArray(AppState.bookings) ? AppState.bookings : [];
    if (tf === 'all') return bookings;

    const now = new Date();
    const currentMonthPrefix = now.toISOString().slice(0, 7); // YYYY-MM
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return bookings.filter(b => {
        if (!b.date) return false;
        const d = new Date(b.date);
        if (tf === 'month') {
            return String(b.date).startsWith(currentMonthPrefix);
        } else if (tf === 'week') {
            return d >= sevenDaysAgo && d <= now;
        } else if (tf === 'semester') {
            const month = d.getMonth() + 1;
            return month >= 6 && month <= 10;
        }
        return true;
    });
}

function getFilteredReportMaintenance(tf) {
    const tickets = Array.isArray(AppState.maintenance) ? AppState.maintenance : [];
    if (tf === 'all') return tickets;

    const now = new Date();
    const currentMonthPrefix = now.toISOString().slice(0, 7);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    return tickets.filter(m => {
        if (!m.reportedDate) return false;
        const d = new Date(m.reportedDate);
        if (tf === 'month') {
            return String(m.reportedDate).startsWith(currentMonthPrefix);
        } else if (tf === 'week') {
            return d >= sevenDaysAgo && d <= now;
        } else if (tf === 'semester') {
            const month = d.getMonth() + 1;
            return month >= 6 && month <= 10;
        }
        return true;
    });
}

function renderReportsView() {
    const tf = AppState.reportTimeframe || 'all';
    const tfLabels = {
        'all': 'ข้อมูลสะสมทั้งหมด',
        'month': 'ข้อมูลประจำเดือนปัจจุบัน',
        'week': 'ข้อมูล 7 วันล่าสุด',
        'semester': 'ภาคการศึกษาที่ 1/2569'
    };
    const tagEl = document.getElementById('report-active-timeframe-tag');
    if (tagEl) tagEl.textContent = tfLabels[tf] || 'ข้อมูลสะสมทั้งหมด';

    const bookings = getFilteredReportBookings(tf);
    const maintenance = getFilteredReportMaintenance(tf);

    // 1. Calculate Booking Metrics
    const totalBookings = bookings.length;
    const approvedBookings = bookings.filter(b => b.status === 'approved' || b.status === 'completed');
    const pendingBookings = bookings.filter(b => b.status === 'pending');
    const rejectedBookings = bookings.filter(b => b.status === 'rejected');
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled');

    const consideredCount = approvedBookings.length + rejectedBookings.length;
    const approvalRate = consideredCount > 0 ? Math.round((approvedBookings.length / consideredCount) * 100) : (totalBookings > 0 ? 100 : 0);

    // Calculate total hours
    let totalHours = 0;
    approvedBookings.forEach(b => {
        if (b.startTime && b.endTime) {
            const sParts = b.startTime.split(':').map(Number);
            const eParts = b.endTime.split(':').map(Number);
            if (sParts.length === 2 && eParts.length === 2) {
                const startM = sParts[0] * 60 + sParts[1];
                const endM = eParts[0] * 60 + eParts[1];
                if (endM > startM) {
                    totalHours += (endM - startM) / 60;
                } else {
                    totalHours += 2;
                }
            } else {
                totalHours += 2;
            }
        } else {
            totalHours += 2;
        }
    });
    totalHours = Math.round(totalHours * 10) / 10;
    const avgHoursPerBooking = approvedBookings.length > 0 ? (totalHours / approvedBookings.length).toFixed(1) : 0;

    const uniqueUsersSet = new Set(bookings.map(b => (b.bookerName || b.reservedBy || '').trim()).filter(Boolean));
    const uniqueUsersCount = uniqueUsersSet.size;

    // Update Booking KPI DOM
    const kpiTotalBk = document.getElementById('kpi-total-bookings');
    if (kpiTotalBk) kpiTotalBk.textContent = totalBookings.toLocaleString();
    const kpiBkDetail = document.getElementById('kpi-bookings-status-detail');
    if (kpiBkDetail) kpiBkDetail.textContent = `อนุมัติ ${approvedBookings.length} • รอ ${pendingBookings.length} • ปฏิเสธ ${rejectedBookings.length}`;

    const kpiAppRate = document.getElementById('kpi-approval-rate');
    if (kpiAppRate) kpiAppRate.textContent = `${approvalRate}%`;
    const kpiAppDetail = document.getElementById('kpi-approval-detail');
    if (kpiAppDetail) kpiAppDetail.textContent = `อนุมัติ ${approvedBookings.length} จาก ${consideredCount || totalBookings} รายการ`;

    const kpiHours = document.getElementById('kpi-total-hours');
    if (kpiHours) kpiHours.textContent = `${totalHours} ชม.`;
    const kpiHoursDetail = document.getElementById('kpi-hours-detail');
    if (kpiHoursDetail) kpiHoursDetail.textContent = `เฉลี่ย ${avgHoursPerBooking} ชม./ครั้งที่อนุมัติ`;

    const kpiUsers = document.getElementById('kpi-unique-users');
    if (kpiUsers) kpiUsers.textContent = `${uniqueUsersCount} คน`;
    const kpiUsersDetail = document.getElementById('kpi-users-detail');
    if (kpiUsersDetail) kpiUsersDetail.textContent = `บุคลากร ${uniqueUsersCount} คนมีคำขอใช้งาน`;

    // 2. Calculate Maintenance Metrics
    const totalMnt = maintenance.length;
    const completedMnt = maintenance.filter(m => m.status === 'completed');
    const inProgressMnt = maintenance.filter(m => m.status === 'in_progress');
    const openMnt = maintenance.filter(m => m.status === 'open' || !m.status);
    const highPriorityMnt = maintenance.filter(m => (m.priority || '').toLowerCase() === 'high');
    const medPriorityMnt = maintenance.filter(m => (m.priority || '').toLowerCase() === 'medium');
    const lowPriorityMnt = maintenance.filter(m => (m.priority || '').toLowerCase() === 'low');

    const resolutionRate = totalMnt > 0 ? Math.round((completedMnt.length / totalMnt) * 100) : 100;
    const activeBacklog = openMnt.length + inProgressMnt.length;

    // Calculate room readiness index (out of 16 rooms)
    const activeIssueRoomIds = new Set(maintenance.filter(m => m.status !== 'completed').map(m => m.roomId));
    const totalRoomsCount = (AppState.rooms && AppState.rooms.length > 0) ? AppState.rooms.length : 16;
    const readyRoomsCount = Math.max(0, totalRoomsCount - activeIssueRoomIds.size);
    const readinessRate = Math.round((readyRoomsCount / totalRoomsCount) * 1000) / 10;

    // Update Maintenance KPI DOM
    const kpiTotalMnt = document.getElementById('kpi-total-mnt');
    if (kpiTotalMnt) kpiTotalMnt.textContent = totalMnt.toLocaleString();
    const kpiMntDetail = document.getElementById('kpi-mnt-status-detail');
    if (kpiMntDetail) kpiMntDetail.textContent = `ด่วนสูง ${highPriorityMnt.length} • ปานกลาง ${medPriorityMnt.length} • ทั่วไป ${lowPriorityMnt.length}`;

    const kpiResRate = document.getElementById('kpi-resolution-rate');
    if (kpiResRate) kpiResRate.textContent = `${resolutionRate}%`;
    const kpiResDetail = document.getElementById('kpi-resolution-detail');
    if (kpiResDetail) kpiResDetail.textContent = `แก้ไขเสร็จแล้ว ${completedMnt.length} จาก ${totalMnt} รายการ`;

    const kpiReadiness = document.getElementById('kpi-readiness-rate');
    if (kpiReadiness) kpiReadiness.textContent = `${readinessRate}%`;
    const kpiReadDetail = document.getElementById('kpi-readiness-detail');
    if (kpiReadDetail) kpiReadDetail.textContent = `พร้อมใช้งาน ${readyRoomsCount} จาก ${totalRoomsCount} ห้อง`;

    const kpiBacklog = document.getElementById('kpi-active-backlog');
    if (kpiBacklog) kpiBacklog.textContent = `${activeBacklog} รายการ`;
    const kpiBackDetail = document.getElementById('kpi-backlog-detail');
    if (kpiBackDetail) kpiBackDetail.textContent = `รอดำเนินการ ${openMnt.length} • กำลังซ่อม ${inProgressMnt.length}`;

    // 3. Generate Executive Briefing Insights Text
    generateExecutiveInsights(bookings, maintenance, totalHours, approvalRate, resolutionRate, readinessRate, activeBacklog);

    // 4. Render All 6 Chart.js Charts
    renderReportCharts(bookings, maintenance);

    // 5. Populate Recent Activity Tables
    renderReportRecentTables(bookings, maintenance);

    lucide.createIcons();
}

function generateExecutiveInsights(bookings, maintenance, totalHours, approvalRate, resolutionRate, readinessRate, activeBacklog) {
    const container = document.getElementById('report-executive-insights');
    if (!container) return;

    // Identify top utilized room
    const roomCounts = {};
    bookings.forEach(b => {
        const name = b.roomName || b.roomId || 'ไม่ระบุห้อง';
        roomCounts[name] = (roomCounts[name] || 0) + 1;
    });
    const sortedRooms = Object.entries(roomCounts).sort((a, b) => b[1] - a[1]);
    const topRoomName = sortedRooms.length > 0 ? sortedRooms[0][0] : 'ห้องปฏิบัติการคอมพิวเตอร์ 1';
    const topRoomCount = sortedRooms.length > 0 ? sortedRooms[0][1] : 0;
    const topRoomPct = bookings.length > 0 ? Math.round((topRoomCount / bookings.length) * 100) : 0;

    // Identify top maintenance category
    const catCounts = {};
    maintenance.forEach(m => {
        const catKey = m.category || 'other';
        const catInfo = (typeof MAINTENANCE_CATEGORIES !== 'undefined' && MAINTENANCE_CATEGORIES[catKey]) ? MAINTENANCE_CATEGORIES[catKey] : { name: 'อุปกรณ์ทั่วไป', emoji: '📦' };
        const label = `${catInfo.emoji} ${catInfo.name}`;
        catCounts[label] = (catCounts[label] || 0) + 1;
    });
    const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    const topCatName = sortedCats.length > 0 ? sortedCats[0][0] : '📽️ โปรเจกเตอร์ / จอภาพ';
    const topCatCount = sortedCats.length > 0 ? sortedCats[0][1] : 0;
    const topCatPct = maintenance.length > 0 ? Math.round((topCatCount / maintenance.length) * 100) : 0;

    let html = `
        <div class="flex items-start gap-2">
            <span class="text-blue-600 font-bold shrink-0">1.</span>
            <p><b>ภาพรวมการใช้ห้องเรียน:</b> มีการยื่นขอใช้ห้องสะสม <b>${bookings.length} รายการ</b> รวมการใช้งานจริงกว่า <b>${totalHours} ชั่วโมง</b> โดย <b>${topRoomName}</b> ได้รับความนิยมสูงสุด คิดเป็น <b>${topRoomPct}%</b> ของการจองทั้งหมด และมีอัตราการอนุมัติอยู่ที่ <b>${approvalRate}%</b></p>
        </div>
        <div class="flex items-start gap-2">
            <span class="text-rose-600 font-bold shrink-0">2.</span>
            <p><b>งานซ่อมบำรุงและสภาพความพร้อม:</b> พบปัญหาอุปกรณ์ชำรุด <b>${maintenance.length} รายการ</b> หมวดหมู่ที่พบมากที่สุดคือ <b>${topCatName} (${topCatPct}%)</b> ทั้งนี้งานซ่อมสำเร็จแล้วเสร็จคิดเป็น <b>${resolutionRate}%</b> คงเหลือรอดำเนินการ <b>${activeBacklog} รายการ</b> โดยดัชนีความพร้อมของห้องเรียนอยู่ที่ระดับ <b>${readinessRate}%</b></p>
        </div>
        <div class="flex items-start gap-2">
            <span class="text-emerald-600 font-bold shrink-0">3.</span>
            <p><b>ข้อเสนอแนะเชิงบริหาร (Actionable Recommendation):</b> ฝ่ายอาคารและศูนย์เทคโนโลยีควรจัดเตรียมอะไหล่สำรองสำหรับ <b>${topCatName}</b> และจัดตารางตรวจเช็กเชิงป้องกัน (Preventive Maintenance) ใน <b>${topRoomName}</b> เพื่อรองรับช่วงสอบและกิจกรรมการเรียนการสอนอย่างต่อเนื่อง</p>
        </div>
    `;
    container.innerHTML = html;
}

function renderReportCharts(bookings, maintenance) {
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js library is not loaded yet.');
        return;
    }

    // Configure Chart.js global typography
    Chart.defaults.font.family = "'Prompt', sans-serif";
    Chart.defaults.color = '#475569';

    // -------------------------------------------------------------
    // CHART 1: Booking Trends Over Time (Bar / Line)
    // -------------------------------------------------------------
    const ctxTrends = document.getElementById('chart-booking-trends');
    if (ctxTrends) {
        destroyReportChart('trends');
        
        // Group bookings by date (or day of week if small)
        const dateMap = {};
        bookings.forEach(b => {
            const d = b.date ? b.date.slice(5) : 'ไม่ระบุ'; // MM-DD
            dateMap[d] = (dateMap[d] || 0) + 1;
        });
        
        let labels = Object.keys(dateMap).sort().slice(-10);
        let values = labels.map(k => dateMap[k]);

        if (labels.length === 0) {
            labels = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
            values = [0, 0, 0, 0, 0, 0, 0];
        }

        reportChartInstances['trends'] = new Chart(ctxTrends, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'จำนวนการจอง (ครั้ง)',
                    data: values,
                    backgroundColor: 'rgba(37, 99, 235, 0.75)',
                    hoverBackgroundColor: 'rgba(29, 78, 216, 0.95)',
                    borderRadius: 8,
                    borderWidth: 0,
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        padding: 10,
                        titleFont: { family: "'Prompt', sans-serif", size: 12 },
                        bodyFont: { family: "'Prompt', sans-serif", size: 11 }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, precision: 0 },
                        grid: { color: '#f1f5f9' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // -------------------------------------------------------------
    // CHART 2: Top 5 Most Utilized Rooms (Horizontal Bar)
    // -------------------------------------------------------------
    const ctxUtil = document.getElementById('chart-room-utilization');
    if (ctxUtil) {
        destroyReportChart('utilization');

        const roomCounts = {};
        bookings.forEach(b => {
            const name = b.roomName || b.roomId || 'ไม่ระบุห้อง';
            roomCounts[name] = (roomCounts[name] || 0) + 1;
        });

        const sorted = Object.entries(roomCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const labels = sorted.map(item => item[0].length > 18 ? item[0].slice(0, 18) + '...' : item[0]);
        const values = sorted.map(item => item[1]);

        reportChartInstances['utilization'] = new Chart(ctxUtil, {
            type: 'bar',
            data: {
                labels: labels.length > 0 ? labels : ['ไม่มีข้อมูลการจอง'],
                datasets: [{
                    axis: 'y',
                    label: 'จำนวนการใช้งาน',
                    data: values.length > 0 ? values : [0],
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.85)',
                        'rgba(99, 102, 241, 0.85)',
                        'rgba(168, 85, 247, 0.85)',
                        'rgba(236, 72, 153, 0.85)',
                        'rgba(245, 158, 11, 0.85)'
                    ],
                    borderRadius: 8,
                    barPercentage: 0.65
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        padding: 10
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, precision: 0 },
                        grid: { color: '#f1f5f9' }
                    },
                    y: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    // -------------------------------------------------------------
    // CHART 3: Booking Purposes Breakdown (Doughnut)
    // -------------------------------------------------------------
    const ctxPurp = document.getElementById('chart-booking-purposes');
    if (ctxPurp) {
        destroyReportChart('purposes');

        const purposeCategories = {
            'การเรียนการสอน / สอนชดเชย': 0,
            'การสอบวัดระดับ / สอบข้อเขียน': 0,
            'อบรม / สัมมนาเชิงปฏิบัติการ': 0,
            'ประชุมคณะ / งานบริหาร': 0,
            'กิจกรรมนักศึกษา / อื่นๆ': 0
        };

        bookings.forEach(b => {
            const txt = `${b.subject || ''} ${b.purpose || ''}`.toLowerCase();
            if (txt.includes('สอน') || txt.includes('ชดเชย') || txt.includes('เรียน') || txt.includes('แล็บ')) {
                purposeCategories['การเรียนการสอน / สอนชดเชย']++;
            } else if (txt.includes('สอบ') || txt.includes('exam')) {
                purposeCategories['การสอบวัดระดับ / สอบข้อเขียน']++;
            } else if (txt.includes('อบรม') || txt.includes('สัมมนา') || txt.includes('workshop')) {
                purposeCategories['อบรม / สัมมนาเชิงปฏิบัติการ']++;
            } else if (txt.includes('ประชุม') || txt.includes('meeting')) {
                purposeCategories['ประชุมคณะ / งานบริหาร']++;
            } else {
                purposeCategories['กิจกรรมนักศึกษา / อื่นๆ']++;
            }
        });

        reportChartInstances['purposes'] = new Chart(ctxPurp, {
            type: 'doughnut',
            data: {
                labels: Object.keys(purposeCategories),
                datasets: [{
                    data: Object.values(purposeCategories),
                    backgroundColor: [
                        '#3b82f6',
                        '#10b981',
                        '#8b5cf6',
                        '#f59e0b',
                        '#94a3b8'
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, font: { size: 10.5 } }
                    }
                },
                cutout: '65%'
            }
        });
    }

    // -------------------------------------------------------------
    // CHART 4: Maintenance Equipment Categories (PolarArea / Doughnut)
    // -------------------------------------------------------------
    const ctxMntCat = document.getElementById('chart-maintenance-categories');
    if (ctxMntCat) {
        destroyReportChart('mntCat');

        const catKeys = ['projector', 'ac', 'pc', 'input', 'audio', 'network', 'electricity', 'furniture', 'other'];
        const catLabels = [];
        const catValues = [];
        const catColors = [
            '#3b82f6', // projector
            '#06b6d4', // ac
            '#6366f1', // pc
            '#ec4899', // input
            '#8b5cf6', // audio
            '#10b981', // network
            '#f59e0b', // power
            '#d97706', // furniture
            '#64748b'  // other
        ];

        catKeys.forEach(k => {
            const catInfo = (typeof MAINTENANCE_CATEGORIES !== 'undefined' && MAINTENANCE_CATEGORIES[k]) ? MAINTENANCE_CATEGORIES[k] : { name: k };
            catLabels.push(catInfo.name);
            const count = maintenance.filter(m => (m.category === k || detectMaintenanceCategory(m) === k)).length;
            catValues.push(count);
        });

        reportChartInstances['mntCat'] = new Chart(ctxMntCat, {
            type: 'doughnut',
            data: {
                labels: catLabels,
                datasets: [{
                    data: catValues,
                    backgroundColor: catColors,
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 11, font: { size: 10 } }
                    }
                },
                cutout: '60%'
            }
        });
    }

    // -------------------------------------------------------------
    // CHART 5: Maintenance Resolution Funnel (Doughnut)
    // -------------------------------------------------------------
    const ctxMntStatus = document.getElementById('chart-maintenance-status');
    if (ctxMntStatus) {
        destroyReportChart('mntStatus');

        const completed = maintenance.filter(m => m.status === 'completed').length;
        const inProgress = maintenance.filter(m => m.status === 'in_progress').length;
        const open = maintenance.filter(m => m.status === 'open' || !m.status).length;

        reportChartInstances['mntStatus'] = new Chart(ctxMntStatus, {
            type: 'doughnut',
            data: {
                labels: ['ซ่อมเสร็จสิ้น (🟢)', 'กำลังดำเนินการ (🟡)', 'รอดำเนินการ (🔴)'],
                datasets: [{
                    data: [completed, inProgress, open],
                    backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                    borderWidth: 3,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, font: { size: 11 } }
                    }
                },
                cutout: '70%'
            }
        });
    }

    // -------------------------------------------------------------
    // CHART 6: Rooms with Most Issues (Bar)
    // -------------------------------------------------------------
    const ctxRoomIssues = document.getElementById('chart-room-issues');
    if (ctxRoomIssues) {
        destroyReportChart('roomIssues');

        const roomIssueCounts = {};
        maintenance.forEach(m => {
            const name = m.roomName || m.roomId || 'ไม่ระบุห้อง';
            roomIssueCounts[name] = (roomIssueCounts[name] || 0) + 1;
        });

        const sorted = Object.entries(roomIssueCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
        const labels = sorted.map(item => item[0].length > 16 ? item[0].slice(0, 16) + '...' : item[0]);
        const values = sorted.map(item => item[1]);

        reportChartInstances['roomIssues'] = new Chart(ctxRoomIssues, {
            type: 'bar',
            data: {
                labels: labels.length > 0 ? labels : ['ไม่มีรายการแจ้งซ่อม'],
                datasets: [{
                    label: 'จำนวนปัญหาที่พบ',
                    data: values.length > 0 ? values : [0],
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderRadius: 8,
                    barPercentage: 0.6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        padding: 10
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1, precision: 0 },
                        grid: { color: '#f1f5f9' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }
}

function renderReportRecentTables(bookings, maintenance) {
    // Recent Bookings Snapshot
    const bkBody = document.getElementById('report-recent-bookings-tbody');
    if (bkBody) {
        const recentBk = bookings.slice(0, 5);
        if (recentBk.length === 0) {
            bkBody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-400">ไม่มีรายการจองในช่วงเวลานี้</td></tr>`;
        } else {
            bkBody.innerHTML = recentBk.map(b => {
                let badge = '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700">รออนุมัติ</span>';
                if (b.status === 'approved') badge = '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">อนุมัติแล้ว</span>';
                else if (b.status === 'rejected') badge = '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-700">ไม่อนุมัติ</span>';
                return `
                    <tr class="hover:bg-slate-50">
                        <td class="py-2.5 font-bold text-slate-800">${b.roomName || b.roomId || '-'}</td>
                        <td class="py-2.5 text-slate-600">${formatThaiDate(b.date)} <span class="text-[10px] text-slate-400">(${b.startTime || ''}-${b.endTime || ''})</span></td>
                        <td class="py-2.5 text-slate-700">${b.bookerName || b.reservedBy || '-'}</td>
                        <td class="py-2.5 text-right">${badge}</td>
                    </tr>
                `;
            }).join('');
        }
    }

    // Recent Maintenance Snapshot
    const mntBody = document.getElementById('report-recent-maintenance-tbody');
    if (mntBody) {
        const recentMnt = maintenance.slice(0, 5);
        if (recentMnt.length === 0) {
            mntBody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-400">ไม่มีรายการแจ้งซ่อมในช่วงเวลานี้</td></tr>`;
        } else {
            mntBody.innerHTML = recentMnt.map(m => {
                const catKey = m.category || detectMaintenanceCategory(m);
                const catInfo = (typeof MAINTENANCE_CATEGORIES !== 'undefined' && MAINTENANCE_CATEGORIES[catKey]) ? MAINTENANCE_CATEGORIES[catKey] : { name: 'ทั่วไป', emoji: '📦', badgeClass: 'bg-slate-100 text-slate-700' };
                let stBadge = '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-700">รอดำเนินการ</span>';
                if (m.status === 'completed') stBadge = '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">ซ่อมเสร็จสิ้น</span>';
                else if (m.status === 'in_progress') stBadge = '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700">กำลังซ่อม</span>';
                return `
                    <tr class="hover:bg-slate-50">
                        <td class="py-2.5">
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9.5px] font-bold ${catInfo.badgeClass}">
                                <span>${catInfo.emoji}</span> ${catInfo.name}
                            </span>
                        </td>
                        <td class="py-2.5">
                            <div class="font-bold text-slate-800">${m.roomName || m.roomId || '-'}</div>
                            <div class="text-[10px] text-slate-500 truncate max-w-[140px]">${m.title || ''}</div>
                        </td>
                        <td class="py-2.5 text-slate-600">${formatThaiDate(m.reportedDate)}</td>
                        <td class="py-2.5 text-right">${stBadge}</td>
                    </tr>
                `;
            }).join('');
        }
    }
}
