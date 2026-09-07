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
    // Background auto-sync with Google Sheets every 25 seconds
    setInterval(() => {
        if (AppState.googleScriptUrl) {
            fetchDataFromGoogleSheets(true);
        }
    }, 25000);
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
        if (savedUrl) {
            AppState.googleScriptUrl = savedUrl;
        } else if (typeof DEFAULT_GAS_URL !== 'undefined' && DEFAULT_GAS_URL) {
            AppState.googleScriptUrl = DEFAULT_GAS_URL;
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

        // Check if version changed -> auto migrate to new room names
        if (savedVersion !== DATA_VERSION || !savedRooms) {
            AppState.rooms = DEFAULT_ROOMS;
            AppState.timetable = DEFAULT_TIMETABLE;
            AppState.bookings = DEFAULT_BOOKINGS;
            AppState.maintenance = DEFAULT_MAINTENANCE;
            saveData();
            localStorage.setItem('CMS_VERSION', DATA_VERSION);
        } else {
            AppState.rooms = JSON.parse(savedRooms);
            AppState.timetable = savedTimetable ? JSON.parse(savedTimetable) : DEFAULT_TIMETABLE;
            AppState.bookings = savedBookings ? JSON.parse(savedBookings) : DEFAULT_BOOKINGS;
            AppState.maintenance = savedMaintenance ? JSON.parse(savedMaintenance) : DEFAULT_MAINTENANCE;
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

    renderCurrentTab();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderCurrentTab() {
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
        case 'settings':
            renderSettings();
            break;
    }
    lucide.createIcons();
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

                <div class="flex gap-2 mt-2">
                    <button onclick="openRoomDetailModal('${lab.id}')" class="flex-1 text-xs py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-center transition">
                        ดูรายละเอียด
                    </button>
                    <button onclick="openBookingModalForRoom('${lab.id}')" class="text-xs py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition">
                        จองห้อง
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
                    <span class="flex items-center gap-1 font-medium text-slate-700">
                        <i data-lucide="map-pin" class="w-3.5 h-3.5 text-blue-500"></i> ${room.name} (${room.floor || room.building})
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
                            <div class="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/70 text-xs">
                                <div class="font-semibold text-amber-900 flex items-center gap-1">
                                    <i data-lucide="clock" class="w-3.5 h-3.5 text-amber-600"></i>
                                    <span>${room.currentClass.time}</span>
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

                <div class="p-4 pt-0 border-t border-slate-100 mt-2 flex gap-2">
                    <button onclick="openRoomDetailModal('${room.id}')" class="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl text-xs flex items-center justify-center gap-1.5 transition">
                        <i data-lucide="info" class="w-3.5 h-3.5"></i> รายละเอียด
                    </button>
                    <button onclick="openBookingModalForRoom('${room.id}')" class="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-blue-200 transition">
                        <i data-lucide="calendar-plus" class="w-3.5 h-3.5"></i> จองห้อง
                    </button>
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

                    <div class="flex items-center gap-2">
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
                                                        <div class="p-2.5 rounded-xl tag-${item.color || 'blue'} shadow-sm">
                                                            <div class="font-bold text-xs">${item.subject}</div>
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
                                                        <div class="p-2.5 rounded-xl tag-${item.color || 'indigo'} shadow-sm">
                                                            <div class="font-bold text-xs">${item.subject}</div>
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
                                                        <div class="p-2.5 rounded-xl tag-${item.color || 'purple'} shadow-sm">
                                                            <div class="font-bold text-xs">${item.subject}</div>
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
                                <span class="text-xs font-bold ${isLab ? 'text-indigo-600' : 'text-blue-600'} bg-slate-100 px-2 py-0.5 rounded">
                                    ${room.name}
                                </span>
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

    let displayedBookings = AppState.bookings;
    if (AppState.bookingFilterStatus && AppState.bookingFilterStatus !== 'all') {
        displayedBookings = displayedBookings.filter(b => b.status === AppState.bookingFilterStatus);
    }

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

    listContainer.innerHTML = displayedBookings.map(bk => `
        <tr class="border-b border-slate-100 hover:bg-slate-50/80 text-xs transition">
            <td class="p-3 font-semibold text-slate-500">${bk.id}</td>
            <td class="p-3 font-bold text-slate-800">
                <div class="flex items-center gap-1.5">
                    <span class="w-2.5 h-2.5 rounded-full ${bk.roomId.startsWith('LAB') ? 'bg-indigo-500' : bk.roomId.startsWith('CONF') ? 'bg-amber-500' : 'bg-blue-500'}"></span>
                    <span>${bk.roomName}</span>
                </div>
            </td>
            <td class="p-3">
                <div class="font-bold text-slate-800">${bk.date}</div>
                <div class="text-blue-600 font-semibold text-[11px] flex items-center gap-1 mt-0.5">
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
    `).join('');
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
            reason: `ห้องนี้ถูกจองแล้วในวันที่ ${dateStr} เวลา ${conflictingBooking.startTime} - ${conflictingBooking.endTime} น. โดย ${conflictingBooking.bookerName} (${conflictingBooking.subject})`
        };
    }

    const bookingDate = new Date(dateStr);
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
        alert(`❌ ไม่สามารถจองห้องได้เนื่องจากเวลาชนกัน:\n\n${conflictResult.reason}`);
        return;
    }

    const room = AppState.rooms.find(r => r.id === roomId);
    // If Admin is submitting, auto-approve; if general visitor, set to 'pending'
    const initialStatus = AppState.isAdmin ? 'approved' : 'pending';

    const fullDept = department + (phone ? ` (โทร. ${phone})` : '');
    const newBooking = {
        id: `BK-${Math.floor(1000 + Math.random() * 9000)}`,
        roomId: roomId,
        roomName: room ? room.name : roomId,
        date: dateStr,
        startTime: startTime,
        endTime: endTime,
        subject: subject,
        bookerName: bookerName,
        department: fullDept,
        phone: phone,
        purpose: purpose,
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

    // Show popup
    if (AppState.isAdmin) {
        showToast(`บันทึกการจองห้อง ${room ? room.name : ''} (อนุมัติทันที) เรียบร้อยแล้ว!`, 'success');
    } else {
        alert(`✅ ส่งคำขอจองห้องเรียบร้อยแล้ว!\n\nรหัสการจอง: ${newBooking.id}\nห้องเรียน: ${room ? room.name : roomId}\nวันที่: ${dateStr} (${startTime} - ${endTime} น.)\nผู้ขอจอง: ${bookerName} ${phone ? 'โทร: ' + phone : ''}\n\nสถานะ: 🟡 รอผู้ดูแลระบบ (Admin) ตรวจสอบและอนุมัติ\n(ข้อมูลนี้ถูกบันทึกขึ้นระบบส่วนกลาง เพื่อให้ทุกคนที่เข้าเว็บเห็นตารางจองนี้เรียบร้อยแล้วครับ)`);
    }

    // Sync to Google Sheets central backend
    sendActionToGoogleBackend('addBooking', { booking: newBooking });
}

function approveBooking(bookingId) {
    const booking = AppState.bookings.find(b => b.id === bookingId);
    if (booking) {
        booking.status = 'approved';
        saveData();
        renderBookings();
        showToast(`อนุมัติคำขอจอง ${bookingId} เรียบร้อยแล้ว`, 'success');

        // Sync to Google Sheets
        sendActionToGoogleBackend('approveBooking', { id: bookingId });
    }
}

function cancelBooking(bookingId) {
    if (confirm(`คุณต้องการยกเลิกรายการจอง ${bookingId} ใช่หรือไม่?`)) {
        AppState.bookings = AppState.bookings.filter(b => b.id !== bookingId);
        saveData();
        renderBookings();
        showToast('ยกเลิกรายการจองสำเร็จ', 'success');

        // Sync to Google Sheets
        sendActionToGoogleBackend('cancelBooking', { id: bookingId });
    }
}

// ----------------------------------------------------
// 5. MAINTENANCE SYSTEM
// ----------------------------------------------------
function renderMaintenance() {
    const tableBody = document.getElementById('maintenance-table-body');
    if (!tableBody) return;

    if (AppState.maintenance.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-10 text-slate-400">
                    <i data-lucide="check-check" class="w-12 h-12 mx-auto mb-2 opacity-50 text-emerald-500"></i>
                    ไม่มีรายการแจ้งซ่อม ทุกห้องอยู่ในสภาพพร้อมใช้งาน 100%
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = AppState.maintenance.map(m => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 text-xs">
            <td class="p-3 font-semibold text-slate-500">${m.id}</td>
            <td class="p-3 font-bold text-slate-800">${m.roomName}</td>
            <td class="p-3">
                <div class="font-bold text-slate-800">${m.title}</div>
                <div class="text-slate-500 text-[11px]">${m.details}</div>
            </td>
            <td class="p-3 text-slate-600">
                <div>${m.reporter}</div>
                <div class="text-slate-400 text-[11px]">${m.reportedDate}</div>
            </td>
            <td class="p-3">
                ${getMaintenancePriorityBadge(m.priority)}
            </td>
            <td class="p-3">
                ${getMaintenanceStatusBadge(m.status)}
            </td>
            <td class="p-3 text-right">
                ${m.status !== 'completed' ? `
                    <button onclick="resolveMaintenance('${m.id}')" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-xs transition">
                        ซ่อมเสร็จแล้ว
                    </button>
                ` : `
                    <span class="text-emerald-600 font-semibold flex items-center justify-end gap-1">
                        <i data-lucide="check" class="w-4 h-4"></i> เรียบร้อย
                    </span>
                `}
            </td>
        </tr>
    `).join('');
}

function handleMaintenanceSubmit(event) {
    event.preventDefault();
    const form = event.target;

    const roomId = form.roomId.value;
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
        title: title,
        details: details,
        reporter: reporter,
        status: 'open',
        priority: priority
    };

    AppState.maintenance.unshift(newTicket);

    if (setRoomMaintenance && room) {
        room.status = 'maintenance';
        sendActionToGoogleBackend('updateRoomStatus', { id: roomId, status: 'maintenance' });
    }

    saveData();
    closeModal('modal-maintenance');
    renderCurrentTab();
    showToast(`บันทึกแจ้งซ่อม ${room ? room.name : ''} เรียบร้อยแล้ว`, 'success');

    // Sync to Google Sheets
    sendActionToGoogleBackend('addMaintenance', { ticket: newTicket });
}

function resolveMaintenance(ticketId) {
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
        renderMaintenance();
        showToast('อัปเดตสถานะการซ่อมเป็น "เสร็จสิ้น" เรียบร้อยแล้ว', 'success');

        // Sync to Google Sheets
        sendActionToGoogleBackend('resolveMaintenance', { id: ticketId });
    }
}

// ----------------------------------------------------
// 6. ADD CUSTOM ROOM FEATURE
// ----------------------------------------------------
function handleAddRoomSubmit(event) {
    event.preventDefault();
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
                case 'addMaintenance':
                    google.script.run.withSuccessHandler(res => console.log('GAS Add MNT:', res)).apiAddMaintenance(payload.ticket);
                    break;
                case 'resolveMaintenance':
                    google.script.run.withSuccessHandler(res => console.log('GAS Resolve MNT:', res)).apiResolveMaintenance(payload.id);
                    break;
                case 'addRoom':
                    google.script.run.withSuccessHandler(res => console.log('GAS Add Room:', res)).apiAddRoom(payload.room);
                    break;
                case 'updateRoomStatus':
                    google.script.run.withSuccessHandler(res => console.log('GAS Update Room:', res)).apiUpdateRoomStatus(payload.id, payload.status, payload.currentClass);
                    break;
            }
        } catch(e) {
            console.warn("GAS execution failed:", e);
        }
        return;
    }

    if (!AppState.googleScriptUrl) return;

    // Send via GET parameter (immune to CORS preflight on mobile & desktop)
    try {
        const urlObj = new URL(AppState.googleScriptUrl);
        urlObj.searchParams.set('action', action);
        if (payload.booking) urlObj.searchParams.set('booking', JSON.stringify(payload.booking));
        if (payload.id) urlObj.searchParams.set('id', payload.id);
        if (payload.ticket) urlObj.searchParams.set('ticket', JSON.stringify(payload.ticket));

        fetch(urlObj.toString(), { method: 'GET', mode: 'cors' })
            .then(r => r.json())
            .then(res => {
                console.log('Google Sheets Sync (GET):', res);
                if (res.success && res.data && res.data.bookings) {
                    AppState.bookings = res.data.bookings;
                    saveData();
                    renderBookings();
                }
            })
            .catch(err => {
                console.warn('GET sync fallback to POST:', err);
                fetch(AppState.googleScriptUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: action, ...payload })
                }).then(r => r.json()).catch(e => console.warn('POST sync:', e));
            });
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
                if (response.timetable) AppState.timetable = response.timetable;
                if (response.bookings) AppState.bookings = response.bookings;
                if (response.maintenance) AppState.maintenance = response.maintenance;
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
            if (json.data.rooms && json.data.rooms.length > 0) AppState.rooms = json.data.rooms;
            if (json.data.timetable) AppState.timetable = json.data.timetable;
            if (json.data.bookings && Array.isArray(json.data.bookings)) {
                AppState.bookings = json.data.bookings.map(b => {
                    // Normalize date format
                    let dateStr = b.date || '';
                    if (dateStr && dateStr.includes('T')) dateStr = dateStr.split('T')[0];
                    // Normalize time format if it came from sheet date object
                    let sTime = b.startTime || b.starttime || '';
                    if (sTime && sTime.includes('T')) {
                        const d = new Date(sTime);
                        sTime = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
                    }
                    let eTime = b.endTime || b.endtime || '';
                    if (eTime && eTime.includes('T')) {
                        const d = new Date(eTime);
                        eTime = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
                    }
                    return {
                        id: b.id || b.ID || ('BK-' + Math.floor(1000 + Math.random() * 9000)),
                        roomId: b.roomId || b.roomid || '',
                        roomName: b.roomName || b.roomname || '',
                        date: dateStr,
                        startTime: sTime,
                        endTime: eTime,
                        subject: b.subject || b.purpose || 'ขอใช้ห้องเรียน/ห้องปฏิบัติการ',
                        purpose: b.purpose || b.subject || '',
                        bookerName: b.bookerName || b.reservedBy || b.reservedby || 'ไม่ระบุชื่อ',
                        department: b.department || '',
                        phone: b.phone ? String(b.phone) : '',
                        status: (b.status || 'pending').toLowerCase(),
                        createdAt: b.createdAt || b.createdat || ''
                    };
                });
            }
            if (json.data.maintenance) AppState.maintenance = json.data.maintenance;

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

    AppState.googleScriptUrl = urlInput.value.trim();
    saveSettings();
    await fetchDataFromGoogleSheets(false);
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

            <div class="pt-4 border-t border-slate-200 flex flex-wrap gap-3">
                <button onclick="closeModal('modal-room-detail'); openBookingModalForRoom('${room.id}');" class="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition">
                    <i data-lucide="calendar-plus" class="w-4 h-4"></i> จองห้องนี้
                </button>
                <button onclick="closeModal('modal-room-detail'); openMaintenanceModalForRoom('${room.id}');" class="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-2 border border-rose-200 transition">
                    <i data-lucide="wrench" class="w-4 h-4"></i> แจ้งซ่อมอุปกรณ์
                </button>
            </div>
        </div>
    `;

    openModal('modal-room-detail');
    lucide.createIcons();
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

    openModal('modal-booking');
}

function openBookingModalWithPrefill(roomId, dayName, startTime, endTime) {
    openBookingModalForRoom(roomId);
    const startSelect = document.getElementById('booking-start-time');
    const endSelect = document.getElementById('booking-end-time');
    if (startSelect) startSelect.value = startTime;
    if (endSelect) endSelect.value = endTime;
}

function openMaintenanceModalForRoom(roomId) {
    const roomSelect = document.getElementById('maintenance-room-select');
    if (roomSelect) {
        populateRoomOptions(roomSelect);
        if (roomId) roomSelect.value = roomId;
    }
    openModal('modal-maintenance');
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
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold transition-all transform duration-300 translate-y-2 opacity-0 text-white ${
        type === 'success' ? 'bg-slate-900 border-l-4 border-emerald-500' :
        type === 'error' ? 'bg-slate-900 border-l-4 border-rose-500' :
        type === 'warning' ? 'bg-slate-900 border-l-4 border-amber-500' :
        'bg-slate-900 border-l-4 border-blue-500'
    }`;

    const icon = type === 'success' ? 'check-circle' :
                 type === 'error' ? 'alert-circle' :
                 type === 'warning' ? 'alert-triangle' : 'info';

    toast.innerHTML = `
        <i data-lucide="${icon}" class="w-4 h-4 ${
            type === 'success' ? 'text-emerald-400' :
            type === 'error' ? 'text-rose-400' :
            type === 'warning' ? 'text-amber-400' : 'text-blue-400'
        }"></i>
        <span class="flex-1">${message}</span>
    `;

    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    }, 50);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
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
                                                    <span class="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">${room.name}</span>
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
    // Default PIN: 1234
    if (pin === '1234') {
        AppState.isAdmin = true;
        sessionStorage.setItem('CMS_IS_ADMIN', 'true');
        closeModal('modal-admin-login');
        event.target.reset();
        updateAdminHeaderUI();
        renderCurrentTab();
        showToast('เข้าสู่ระบบผู้ดูแล (Admin Mode) สำเร็จ!', 'success');
    } else {
        showToast('รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง (รหัสเริ่มต้น: 1234)', 'error');
    }
}

function logoutAdmin() {
    AppState.isAdmin = false;
    sessionStorage.removeItem('CMS_IS_ADMIN');
    updateAdminHeaderUI();
    renderCurrentTab();
    showToast('ออกจากระบบผู้ดูแลแล้ว (กลับสู่โหมดผู้ใช้งานทั่วไป)', 'info');
}

function updateAdminHeaderUI() {
    const adminContainer = document.getElementById('admin-header-status');
    if (!adminContainer) return;

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
        renderBookings();
        showToast(`ปฏิเสธคำขอจอง ${bookingId} เรียบร้อยแล้ว`, 'info');
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
