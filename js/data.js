/**
 * Classroom Management System - Updated Seed Data (v2)
 * ห้องเรียน: 302, 303, 305, 306, 307, 308 (ชั้น 3)
 * ห้องเรียน: 401, 402, 403, 404, 405, 406 (ชั้น 4)
 * ห้องปฏิบัติการคอมพิวเตอร์: ห้องปฏิบัติการคอม 1, ห้องปฏิบัติการคอม 2, ห้องปฏิบัติการคอม 3, ห้องปฏิบัติการคอม 4
 */

const DATA_VERSION = "v2_updated_rooms_list";

const DEFAULT_ROOMS = [
    // ----------------------------------------------------
    // ห้องเรียนชั้น 3 (Floor 3)
    // ----------------------------------------------------
    {
        id: "R-302",
        name: "ห้อง 302",
        type: "general",
        categoryName: "ห้องเรียนทั่วไป",
        building: "อาคารเรียนรวม (ชั้น 3)",
        floor: "ชั้น 3",
        capacity: 40,
        status: "available",
        currentClass: null,
        facilities: ["Smart TV 65 นิ้ว", "เครื่องปรับอากาศ x2", "กระดาน Whiteboard", "ระบบเครื่องเสียง & ไมค์ลอย"],
        description: "ห้องเรียนบรรยายชั้น 3 บรรยากาศโปร่งสบาย เหมาะสำหรับวิชาบรรยายและสัมมนากลุ่ม",
        image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600&auto=format&fit=crop&q=60"
    },
    {
        id: "R-303",
        name: "ห้อง 303",
        type: "general",
        categoryName: "ห้องเรียนทั่วไป",
        building: "อาคารเรียนรวม (ชั้น 3)",
        floor: "ชั้น 3",
        capacity: 40,
        status: "occupied",
        currentClass: {
            subject: "TH101 ภาษาไทยเพื่อการสื่อสาร",
            instructor: "อ.ดร.พรพิมล รัตนโชติ",
            time: "09:00 - 12:00",
            studentCount: 35
        },
        facilities: ["Projector 4000 ANSI", "เครื่องปรับอากาศ x2", "กระดาน Whiteboard", "ไมโครโฟนสาย"],
        description: "ห้องเรียนบรรยายมาตรฐาน ติดตั้งโปรเจกเตอร์ความสว่างสูง",
        image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&auto=format&fit=crop&q=60"
    },
    {
        id: "R-305",
        name: "ห้อง 305",
        type: "general",
        categoryName: "ห้องเรียนทั่วไป",
        building: "อาคารเรียนรวม (ชั้น 3)",
        floor: "ชั้น 3",
        capacity: 35,
        status: "available",
        currentClass: null,
        facilities: ["Smart TV 65 นิ้ว", "เครื่องปรับอากาศ x2", "กระดาน Whiteboard", "ระบบเสียงสเตอริโอ"],
        description: "ห้องเรียนขนาด 35 ที่นั่ง โต๊ะเรียนแบบเคลื่อนย้ายสะดวกสำหรับ Group Work",
        image: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600&auto=format&fit=crop&q=60"
    },
    {
        id: "R-306",
        name: "ห้อง 306",
        type: "general",
        categoryName: "ห้องเรียนทั่วไป",
        building: "อาคารเรียนรวม (ชั้น 3)",
        floor: "ชั้น 3",
        capacity: 45,
        status: "reserved",
        currentClass: {
            subject: "ประชุมวิชาการประจำสาขา",
            instructor: "ผศ.ดร.สมชาย ใจดี",
            time: "13:00 - 16:00",
            studentCount: 40
        },
        facilities: ["Smart Board 75 นิ้ว", "เครื่องปรับอากาศ x3", "กระดานกระจก", "ระบบ Video Conference"],
        description: "ห้องเรียนอัจฉริยะ Smart Classroom พร้อมจอสัมผัสและกล้องบันทึกการสอน",
        image: "https://images.unsplash.com/photo-1562774053-701939374585?w=600&auto=format&fit=crop&q=60"
    },
    {
        id: "R-307",
        name: "ห้อง 307",
        type: "general",
        categoryName: "ห้องเรียนทั่วไป",
        building: "อาคารเรียนรวม (ชั้น 3)",
        floor: "ชั้น 3",
        capacity: 40,
        status: "occupied",
        currentClass: {
            subject: "MA102 แคลคูลัสสำหรับวิทยาศาสตร์",
            instructor: "รศ.ดร.เกียรติศักดิ์ ศรีสุข",
            time: "10:00 - 12:00",
            studentCount: 38
        },
        facilities: ["Projector 4000 ANSI", "เครื่องปรับอากาศ x2", "กระดานกระจกขนาดใหญ่", "ไมค์ลอย"],
        description: "ห้องเรียนบรรยายพร้อมกระดานกว้างพิเศษสำหรับวิชาคำนวณ",
        image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&auto=format&fit=crop&q=60"
    },
    {
        id: "R-308",
        name: "ห้อง 308",
        type: "general",
        categoryName: "ห้องเรียนทั่วไป",
        building: "อาคารเรียนรวม (ชั้น 3)",
        floor: "ชั้น 3",
        capacity: 50,
        status: "available",
        currentClass: null,
        facilities: ["Smart TV 75 นิ้ว", "เครื่องปรับอากาศ x3", "กระดาน Whiteboard x2", "ไมค์ลอยคู่"],
        description: "ห้องเรียนขนาดใหญ่ ชั้น 3 รองรับนักศึกษาได้ถึง 50 คน",
        image: "https://images.unsplash.com/photo-1562774053-701939374585?w=600&auto=format&fit=crop&q=60"
    },

    // ----------------------------------------------------
    // ห้องเรียนชั้น 4 (Floor 4)
    // ----------------------------------------------------
    {
        id: "R-401",
        name: "ห้อง 401",
        type: "general",
        categoryName: "ห้องเรียนทั่วไป",
        building: "อาคารเรียนรวม (ชั้น 4)",
        floor: "ชั้น 4",
        capacity: 45,
        status: "available",
        currentClass: null,
        facilities: ["Smart Board 75 นิ้ว", "เครื่องปรับอากาศ x2", "กระดาน Whiteboard", "ระบบเสียงดิจิทัล"],
        description: "ห้องเรียนชั้น 4 บรรยากาศทันสมัย เก้าอี้แบบมีล้อเลื่อนปรับรูปแบบได้",
        image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600&auto=format&fit=crop&q=60"
    },
    {
        id: "R-402",
        name: "ห้อง 402",
        type: "general",
        categoryName: "ห้องเรียนทั่วไป",
        building: "อาคารเรียนรวม (ชั้น 4)",
        floor: "ชั้น 4",
        capacity: 40,
        status: "occupied",
        currentClass: {
            subject: "EN201 ภาษาอังกฤษเชิงวิชาการ",
            instructor: "Aj. Michael Anderson",
            time: "09:00 - 12:00",
            studentCount: 35
        },
        facilities: ["Smart TV 65 นิ้ว", "เครื่องปรับอากาศ x2", "กระดาน Whiteboard", "ลำโพงบลูทูธ"],
        description: "ห้องเรียนบรรยายพร้อมอุปกรณ์มัลติมีเดียสำหรับฝึกทักษะภาษา",
        image: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&auto=format&fit=crop&q=60"
    },
    {
        id: "R-403",
        name: "ห้อง 403",
        type: "general",
        categoryName: "ห้องเรียนทั่วไป",
        building: "อาคารเรียนรวม (ชั้น 4)",
        floor: "ชั้น 4",
        capacity: 50,
        status: "available",
        currentClass: null,
        facilities: ["Dual Projector", "เครื่องปรับอากาศ x3", "กระดาน Whiteboard", "ระบบไมค์ 4 ตัว"],
        description: "ห้องเรียนขนาดใหญ่ จอภาพคู่สำหรับบรรยายวิชาทฤษฎี",
        image: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=600&auto=format&fit=crop&q=60"
    },
    {
        id: "R-404",
        name: "ห้อง 404",
        type: "general",
        categoryName: "ห้องเรียนทั่วไป",
        building: "อาคารเรียนรวม (ชั้น 4)",
        floor: "ชั้น 4",
        capacity: 40,
        status: "available",
        currentClass: null,
        facilities: ["Smart TV 65 นิ้ว", "เครื่องปรับอากาศ x2", "กระดาน Whiteboard", "ไมค์ไร้สาย"],
        description: "ห้องเรียนมาตรฐาน ชั้น 4 สะอาด สงบ แสงธรรมชาติส่องทั่วถึง",
        image: "https://images.unsplash.com/photo-1577896851231-70ef18881754?w=600&auto=format&fit=crop&q=60"
    },
    {
        id: "R-405",
        name: "ห้อง 405",
        type: "general",
        categoryName: "ห้องเรียนทั่วไป",
        building: "อาคารเรียนรวม (ชั้น 4)",
        floor: "ชั้น 4",
        capacity: 55,
        status: "reserved",
        currentClass: {
            subject: "สัมมนาเทคโนโลยีสารสนเทศ",
            instructor: "ผศ.วิภาดา ลิขิตธรรม",
            time: "13:30 - 16:30",
            studentCount: 50
        },
        facilities: ["Projector 5000 ANSI", "เครื่องปรับอากาศ x3", "เวทียกพื้น", "ไมค์สัมมนา"],
        description: "ห้องเรียนขนาดใหญ่แบบ Slope รองรับการบรรยายกลุ่มใหญ่",
        image: "https://images.unsplash.com/photo-1562774053-701939374585?w=600&auto=format&fit=crop&q=60"
    },
    {
        id: "R-406",
        name: "ห้อง 406",
        type: "general",
        categoryName: "ห้องเรียนทั่วไป",
        building: "อาคารเรียนรวม (ชั้น 4)",
        floor: "ชั้น 4",
        capacity: 40,
        status: "available",
        currentClass: null,
        facilities: ["Smart TV 65 นิ้ว", "เครื่องปรับอากาศ x2", "กระดาน Whiteboard", "ระบบเสียงสเตอริโอ"],
        description: "ห้องเรียนชั้น 4 วิวโปร่งสบาย อุปกรณ์ครบครัน",
        image: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600&auto=format&fit=crop&q=60"
    },

    // ----------------------------------------------------
    // ห้องปฏิบัติการคอมพิวเตอร์ 1 - 4 (Computer Labs 1 - 4)
    // ----------------------------------------------------
    {
        id: "LAB-1",
        name: "ห้องปฏิบัติการคอม 1",
        type: "computer_lab",
        categoryName: "ห้องปฏิบัติการคอมพิวเตอร์",
        building: "ศูนย์คอมพิวเตอร์และเทคโนโลยี",
        floor: "ชั้น 3",
        capacity: 40,
        pcCount: 40,
        status: "occupied",
        currentClass: {
            subject: "CS101 การเขียนโปรแกรมคอมพิวเตอร์เบื้องต้น",
            instructor: "ผศ.ดร.ธีรภัทร ชาญวิทย์",
            time: "09:00 - 12:00",
            studentCount: 38
        },
        specs: {
            cpu: "Intel Core i5-13400 (10 Cores, 16 Threads)",
            ram: "16 GB DDR4 3200MHz",
            storage: "512 GB NVMe M.2 SSD",
            gpu: "Intel UHD Graphics 730",
            monitor: "24\" Full HD IPS 75Hz",
            os: "Windows 11 Pro 64-bit",
            network: "LAN Gigabit 1000 Mbps"
        },
        software: ["VS Code", "Python 3.12", "Node.js & Git", "Microsoft Office 365", "Dev-C++", "MySQL Workbench"],
        facilities: ["PC สำหรับนักศึกษา 40 เครื่อง", "PC เครื่องแม่ข่ายอาจารย์ 1 เครื่อง", "Projector 5000 ANSI จอใหญ่", "ระบบกระจายภาพหน้าจอ NetSupport", "แอร์ 4 เครื่อง", "UPS สำรองไฟ"],
        description: "ห้องปฏิบัติการคอมพิวเตอร์ 1 เหมาะสำหรับการเขียนโปรแกรมและฝึกอบรมการใช้งานซอฟต์แวร์",
        image: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=60"
    },
    {
        id: "LAB-2",
        name: "ห้องปฏิบัติการคอม 2",
        type: "computer_lab",
        categoryName: "ห้องปฏิบัติการคอมพิวเตอร์",
        building: "ศูนย์คอมพิวเตอร์และเทคโนโลยี",
        floor: "ชั้น 3",
        capacity: 40,
        pcCount: 40,
        status: "available",
        currentClass: null,
        specs: {
            cpu: "Intel Core i7-13700 (16 Cores, 24 Threads)",
            ram: "32 GB DDR5 5600MHz",
            storage: "1 TB NVMe Gen4 SSD",
            gpu: "NVIDIA GeForce RTX 3060 12GB",
            monitor: "27\" 2K QHD IPS 144Hz",
            os: "Windows 11 Pro / Ubuntu Dual Boot",
            network: "LAN Gigabit 1000 Mbps"
        },
        software: ["IntelliJ IDEA Ultimate", "Android Studio", "Docker Desktop", "VS Code", "PostgreSQL", "Flutter SDK", "Unity 3D"],
        facilities: ["PC สเปกสูง 40 เครื่อง", "Smart Board 86 นิ้ว", "ระบบเครื่องเสียงห้องแล็บ", "ระบบ NetSupport School", "เครื่องปรับอากาศ x4", "UPS กลาง"],
        description: "ห้องปฏิบัติการคอมพิวเตอร์ 2 รองรับการรัน Docker, Virtualization และ Mobile Development",
        image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&auto=format&fit=crop&q=60"
    },
    {
        id: "LAB-3",
        name: "ห้องปฏิบัติการคอม 3",
        type: "computer_lab",
        categoryName: "ห้องปฏิบัติการคอมพิวเตอร์",
        building: "ศูนย์คอมพิวเตอร์และเทคโนโลยี",
        floor: "ชั้น 4",
        capacity: 35,
        pcCount: 35,
        status: "reserved",
        currentClass: {
            subject: "AI & Deep Learning Workshop",
            instructor: "ดร.กิตติคุณ ศิริวงศ์",
            time: "13:00 - 17:00",
            studentCount: 32
        },
        specs: {
            cpu: "Intel Core i9-14900K (24 Cores, 32 Threads)",
            ram: "64 GB DDR5 6000MHz",
            storage: "2 TB NVMe Gen4 SSD High Speed",
            gpu: "NVIDIA GeForce RTX 4080 Super 16GB VRAM (CUDA Capable)",
            monitor: "27\" 4K UHD Color Calibrated 100% sRGB",
            os: "Ubuntu 22.04 LTS / Windows 11 Pro",
            network: "LAN 2.5 Gbps High Bandwidth"
        },
        software: ["PyTorch & TensorFlow (CUDA)", "JupyterLab / Anaconda", "Adobe Creative Cloud 2024", "Blender 4.0", "Unreal Engine 5", "AutoCAD 3D"],
        facilities: ["PC ระดับ High-End Workstation 35 เครื่อง", "Dual Laser Projector", "เครื่องปรับอากาศควบคุมอุณหภูมิ 22°C x4", "เก้าอี้ Ergonomic", "UPS ประจำทุกเครื่อง"],
        description: "ห้องปฏิบัติการคอมพิวเตอร์ 3 สำหรับปัญญาประดิษฐ์ (AI), กราฟิก 3D, โมเดล Deep Learning และมัลติมีเดียขั้นสูง",
        image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=60"
    },
    {
        id: "LAB-4",
        name: "ห้องปฏิบัติการคอม 4",
        type: "computer_lab",
        categoryName: "ห้องปฏิบัติการคอมพิวเตอร์",
        building: "ศูนย์คอมพิวเตอร์และเทคโนโลยี",
        floor: "ชั้น 4",
        capacity: 40,
        pcCount: 40,
        status: "available",
        currentClass: null,
        specs: {
            cpu: "AMD Ryzen 7 7700X (8 Cores, 16 Threads)",
            ram: "32 GB DDR5 5200MHz",
            storage: "1 TB NVMe SSD + Dual LAN Card",
            gpu: "AMD Radeon RX 7600 8GB",
            monitor: "24\" Full HD IPS 100Hz",
            os: "Kali Linux / Windows Server / Windows 11 Pro",
            network: "Isolated Managed Switch VLAN + Cisco Packet Tracer Lab"
        },
        software: ["Wireshark", "Cisco Packet Tracer", "GNS3", "VirtualBox & VMware Workstation", "Metasploit", "Nmap & Security Suite"],
        facilities: ["PC เครือข่าย 40 เครื่อง", "ตู้ Rack Switch & Router ฝึกทดลอง", "Projector 4500 ANSI", "ระบบ Isolated Sandbox Network", "เครื่องปรับอากาศ x4"],
        description: "ห้องปฏิบัติการคอมพิวเตอร์ 4 ความมั่นคงปลอดภัยไซเบอร์และระบบเครือข่าย พร้อมอุปกรณ์ Rack Switch",
        image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&auto=format&fit=crop&q=60"
    }
];

// ข้อมูลตารางการใช้งานประจำสัปดาห์
const DEFAULT_TIMETABLE = [
    // จันทร์ (Monday)
    { id: "S-1", roomId: "R-303", day: "จันทร์", dayIndex: 1, startTime: "09:00", endTime: "12:00", subject: "TH101 ภาษาไทยเพื่อการสื่อสาร", code: "TH101", instructor: "อ.ดร.พรพิมล รัตนโชติ", group: "Sec 1", color: "blue" },
    { id: "S-2", roomId: "R-402", day: "จันทร์", dayIndex: 1, startTime: "09:00", endTime: "12:00", subject: "EN201 ภาษาอังกฤษเชิงวิชาการ", code: "EN201", instructor: "Aj. Michael Anderson", group: "Sec 2", color: "purple" },
    { id: "S-3", roomId: "LAB-1", day: "จันทร์", dayIndex: 1, startTime: "09:00", endTime: "12:00", subject: "CS101 การเขียนโปรแกรมเบื้องต้น", code: "CS101", instructor: "ผศ.ดร.ธีรภัทร ชาญวิทย์", group: "กลุ่ม 1", color: "indigo" },
    { id: "S-4", roomId: "R-306", day: "จันทร์", dayIndex: 1, startTime: "13:00", endTime: "16:00", subject: "ประชุมวิชาการประจำสาขา", code: "CONF-01", instructor: "ผศ.ดร.สมชาย ใจดี", group: "คณาจารย์", color: "amber" },
    { id: "S-5", roomId: "LAB-3", day: "จันทร์", dayIndex: 1, startTime: "13:00", endTime: "17:00", subject: "AI & Deep Learning Workshop", code: "AI-401", instructor: "ดร.กิตติคุณ ศิริวงศ์", group: "ปี 4 IT", color: "emerald" },

    // อังคาร (Tuesday)
    { id: "S-6", roomId: "R-302", day: "อังคาร", dayIndex: 2, startTime: "09:00", endTime: "12:00", subject: "GE101 การคิดเชิงวิพากษ์", code: "GE101", instructor: "อ.ปิยพร แก้วมณี", group: "Sec 3", color: "cyan" },
    { id: "S-7", roomId: "R-401", day: "อังคาร", dayIndex: 2, startTime: "09:00", endTime: "12:00", subject: "BA201 หลักการตลาดดิจิทัล", code: "BA201", instructor: "ดร.กานดา สุวรรณ", group: "Sec 1", color: "pink" },
    { id: "S-8", roomId: "LAB-2", day: "อังคาร", dayIndex: 2, startTime: "13:00", endTime: "16:00", subject: "CS302 Mobile App Development", code: "CS302", instructor: "อ.วรพงษ์ ทัศนีย์", group: "กลุ่ม 2", color: "orange" },
    { id: "S-9", roomId: "LAB-4", day: "อังคาร", dayIndex: 2, startTime: "09:00", endTime: "12:00", subject: "NET201 Network Defense & Security", code: "NET201", instructor: "อ.ภาณุมาศ รัตนกุล", group: "ปี 3", color: "red" },
    { id: "S-10", roomId: "R-308", day: "อังคาร", dayIndex: 2, startTime: "13:00", endTime: "16:00", subject: "ST201 สถิติประยุกต์สำหรับงานวิจัย", code: "ST201", instructor: "ผศ.ดร.วิชัย รุ่งเรือง", group: "Sec 1", color: "teal" },

    // พุธ (Wednesday)
    { id: "S-11", roomId: "LAB-1", day: "พุธ", dayIndex: 3, startTime: "13:00", endTime: "16:00", subject: "DB201 ระบบฐานข้อมูลเชิงสัมพันธ์", code: "DB201", instructor: "อ.พิมพ์ใจ ทิพยวานิช", group: "กลุ่ม 1", color: "indigo" },
    { id: "S-12", roomId: "R-307", day: "พุธ", dayIndex: 3, startTime: "10:00", endTime: "12:00", subject: "MA102 แคลคูลัสสำหรับวิทยาศาสตร์", code: "MA102", instructor: "รศ.ดร.เกียรติศักดิ์ ศรีสุข", group: "Sec 2", color: "blue" },
    { id: "S-13", roomId: "R-403", day: "พุธ", dayIndex: 3, startTime: "08:30", endTime: "11:30", subject: "PY101 ฟิสิกส์พื้นฐาน", code: "PY101", instructor: "ดร.นพดล วรศิลป์", group: "Sec 4", color: "violet" },
    { id: "S-14", roomId: "LAB-3", day: "พุธ", dayIndex: 3, startTime: "09:00", endTime: "12:00", subject: "CG301 Computer Graphics & Animation", code: "CG301", instructor: "อ.ชาญวิทย์ วงศ์สว่าง", group: "ปี 3 มัลติ", color: "emerald" },

    // พฤหัสบดี (Thursday)
    { id: "S-15", roomId: "LAB-2", day: "พฤหัสบดี", dayIndex: 4, startTime: "09:00", endTime: "12:00", subject: "SE301 Software Engineering Workshop", code: "SE301", instructor: "ผศ.มนตรี พิทักษ์พงษ์", group: "กลุ่ม 1", color: "orange" },
    { id: "S-16", roomId: "R-405", day: "พฤหัสบดี", dayIndex: 4, startTime: "13:30", endTime: "16:30", subject: "สัมมนาเทคโนโลยีสารสนเทศ", code: "IT499", instructor: "ผศ.วิภาดา ลิขิตธรรม", group: "ปี 4 รวม", color: "rose" },
    { id: "S-17", roomId: "LAB-4", day: "พฤหัสบดี", dayIndex: 4, startTime: "13:00", endTime: "16:00", subject: "SEC402 Ethical Hacking & Pentest", code: "SEC402", instructor: "อ.ภาณุมาศ รัตนกุล", group: "กลุ่ม 1", color: "red" },

    // ศุกร์ (Friday)
    { id: "S-18", roomId: "R-305", day: "ศุกร์", dayIndex: 5, startTime: "09:00", endTime: "12:00", subject: "SC101 สิ่งแวดล้อมกับการพัฒนาที่ยั่งยืน", code: "SC101", instructor: "ผศ.ดร.จิรวรรณ ทองดี", group: "Sec 1", color: "green" },
    { id: "S-19", roomId: "LAB-1", day: "ศุกร์", dayIndex: 5, startTime: "13:00", endTime: "16:00", subject: "WEB201 Web Frontend Architecture", code: "WEB201", instructor: "อ.ธนากร วัฒนศิลป์", group: "กลุ่ม 2", color: "indigo" },
    { id: "S-20", roomId: "R-406", day: "ศุกร์", dayIndex: 5, startTime: "13:00", endTime: "16:00", subject: "AC101 บัญชีเบื้องต้นสำหรับผู้บริหาร", code: "AC101", instructor: "ดร.สุภาพร เลิศรัตน์", group: "Sec 2", color: "amber" }
];

// ข้อมูลการจองห้องเรียน
const DEFAULT_BOOKINGS = [
    {
        id: "BK-1001",
        roomId: "R-306",
        roomName: "ห้อง 306",
        date: "2026-09-01",
        startTime: "13:00",
        endTime: "16:00",
        subject: "ประชุมวิชาการประจำสาขา",
        bookerName: "ผศ.ดร.สมชาย ใจดี",
        department: "ภาควิชาวิทยาการคอมพิวเตอร์",
        purpose: "การประชุมเตรียมความพร้อมหลักสูตรใหม่",
        status: "approved",
        createdAt: "2026-08-28 09:30"
    },
    {
        id: "BK-1002",
        roomId: "LAB-3",
        roomName: "ห้องปฏิบัติการคอม 3",
        date: "2026-09-01",
        startTime: "13:00",
        endTime: "17:00",
        subject: "AI & Deep Learning Workshop",
        bookerName: "ดร.กิตติคุณ ศิริวงศ์",
        department: "ศูนย์นวัตกรรม AI",
        purpose: "อบรมเชิงปฏิบัติการ Generative AI และ PyTorch",
        status: "approved",
        createdAt: "2026-08-29 14:15"
    },
    {
        id: "BK-1003",
        roomId: "R-405",
        roomName: "ห้อง 405",
        date: "2026-09-01",
        startTime: "13:30",
        endTime: "16:30",
        subject: "สัมมนาเทคโนโลยีสารสนเทศ",
        bookerName: "ผศ.วิภาดา ลิขิตธรรม",
        department: "คณะวิทยาการจัดการ",
        purpose: "บรรยายพิเศษจากผู้เชี่ยวชาญภายนอก",
        status: "approved",
        createdAt: "2026-08-30 11:00"
    },
    {
        id: "BK-1004",
        roomId: "LAB-2",
        roomName: "ห้องปฏิบัติการคอม 2",
        date: "2026-09-02",
        startTime: "13:00",
        endTime: "16:00",
        subject: "แข่งขันเขียนโปรแกรมระดับมหาวิทยาลัย",
        bookerName: "อ.วรพงษ์ ทัศนีย์",
        department: "สโมสรนักศึกษา IT",
        purpose: "ทดสอบระบบและซักซ้อมก่อนแข่งรอบชิง",
        status: "pending",
        createdAt: "2026-08-31 16:40"
    }
];

// รายการแจ้งซ่อม
const DEFAULT_MAINTENANCE = [
    {
        id: "MNT-001",
        roomId: "R-305",
        roomName: "ห้อง 305",
        reportedDate: "2026-08-31",
        title: "รีโมทแอร์ไม่ตอบสนอง / แอร์มีน้ำหยด",
        details: "ปรับอุณหภูมิไม่ได้ ต้องการให้ช่างเข้าล้างแอร์",
        reporter: "อ.ดร.พรพิมล รัตนโชติ",
        status: "in_progress",
        priority: "medium"
    },
    {
        id: "MNT-002",
        roomId: "LAB-1",
        roomName: "ห้องปฏิบัติการคอม 1",
        reportedDate: "2026-08-30",
        title: "PC เครื่องที่ 12 เมาส์คลิกซ้ายไม่ตอบสนอง",
        details: "สาย USB ขาดใน ต้องการเปลี่ยนเมาส์ตัวใหม่",
        reporter: "ผศ.ดร.ธีรภัทร ชาญวิทย์",
        status: "completed",
        priority: "low"
    }
];
