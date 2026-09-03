# 🎓 ระบบจัดการห้องเรียนและห้องปฏิบัติการคอมพิวเตอร์ (Classroom Management System)

ระบบบริหารจัดการห้องเรียน (ชั้น 3 และ ชั้น 4) พร้อมห้องปฏิบัติการคอมพิวเตอร์ 1 - 4
รองรับการเปิดใช้งานบน **Web Browser**, อัปโหลดขึ้น **GitHub / GitHub Pages** และเชื่อมต่อฐานข้อมูล **Google Sheets ผ่าน Google Apps Script**

---

## 🏛️ โครงสร้างห้องเรียนในระบบ (16 ห้อง)

### 1. ห้องเรียนทั่วไป (12 ห้อง)
- **ชั้น 3**: 
  - **ห้อง 302** (ความจุ 40 ที่นั่ง, Smart TV 65", แอร์ x2, Whiteboard)
  - **ห้อง 303** (ความจุ 40 ที่นั่ง, Projector 4000 ANSI, แอร์ x2, Whiteboard)
  - **ห้อง 305** (ความจุ 35 ที่นั่ง, Smart TV 65", แอร์ x2, โต๊ะ Group Work)
  - **ห้อง 306** (ความจุ 45 ที่นั่ง, Smart Board 75", แอร์ x3, Video Conference)
  - **ห้อง 307** (ความจุ 40 ที่นั่ง, Projector 4000 ANSI, แอร์ x2, กระดานกระจก)
  - **ห้อง 308** (ความจุ 50 ที่นั่ง, Smart TV 75", แอร์ x3, ไมค์ลอยคู่)
- **ชั้น 4**: 
  - **ห้อง 401** (ความจุ 45 ที่นั่ง, Smart Board 75", แอร์ x2, ระบบเสียงดิจิทัล)
  - **ห้อง 402** (ความจุ 40 ที่นั่ง, Smart TV 65", แอร์ x2, Whiteboard)
  - **ห้อง 403** (ความจุ 50 ที่นั่ง, Dual Projector, แอร์ x3, Whiteboard)
  - **ห้อง 404** (ความจุ 40 ที่นั่ง, Smart TV 65", แอร์ x2, Whiteboard)
  - **ห้อง 405** (ความจุ 55 ที่นั่ง, Projector 5000 ANSI, แอร์ x3, เวทียกพื้น Slope)
  - **ห้อง 406** (ความจุ 40 ที่นั่ง, Smart TV 65", แอร์ x2, Whiteboard)

### 2. ห้องปฏิบัติการคอมพิวเตอร์ (4 ห้อง)
- **ห้องปฏิบัติการคอม 1**: 40 เครื่อง (Intel Core i5, RAM 16GB, SSD 512GB) สำหรับเขียนโปรแกรมเบื้องต้น
- **ห้องปฏิบัติการคอม 2**: 40 เครื่อง (Intel Core i7, RAM 32GB, RTX 3060) สำหรับ Mobile App, Docker, Unity
- **ห้องปฏิบัติการคอม 3**: 35 เครื่อง (Intel Core i9, RAM 64GB, RTX 4080 Super) สำหรับ AI, Deep Learning, 3D Multimedia
- **ห้องปฏิบัติการคอม 4**: 40 เครื่อง (AMD Ryzen 7, Dual Gigabit LAN, Kali Linux) สำหรับ Network & Security

---

## 📂 โครงสร้างไฟล์ในโปรเจกต์

```
classroom-management-system/
├── index.html                     # หน้าเว็บหลัก (สำหรับเปิดบนเบราว์เซอร์ และ GitHub Pages)
├── Code.gs                        # โค้ด Google Apps Script หลังบ้าน (เชื่อมต่อ Google Sheets)
├── HOW_TO_DEPLOY_GOOGLE_SHEETS.md # คู่มือการติดตั้ง Google Apps Script แบบละเอียด
├── google-apps-script/
│   ├── Code.gs                    # สำเนา Code.gs สำหรับนำไปวางใน script.google.com
│   └── Index.html                 # สำเนา Index.html สำหรับนำไปวางใน script.google.com
├── css/
│   └── custom.css                 # สไตล์ชีตตกแต่ง
├── js/
│   ├── data.js                    # ข้อมูลตั้งต้นห้องเรียนและตารางเรียน
│   └── app.js                     # ระบบตรรกะและการเชื่อมต่อ API
├── push_to_github.bat             # สคริปต์ช่วยส่งขึ้น GitHub แบบอัตโนมัติ
├── server.py                      # Local Web Server (Python)
├── run.bat                        # ดับเบิลคลิกเปิดโปรแกรมในเครื่องทันที
└── README.md                      # เอกสารคู่มือ
```

---

## 📊 การเชื่อมต่อฐานข้อมูล Google Sheets (Google Apps Script)

ระบบมีไฟล์ **`Code.gs`** และ **`Index.html`** ให้พร้อมนำไปใช้บน Google Apps Script โดยจะสร้างตารางฐานข้อมูลใน Google Sheets ให้ 4 แผ่นงานอัตโนมัติ:
1. **Rooms**: เก็บข้อมูลห้องเรียนและสเปกอุปกรณ์
2. **Timetable**: เก็บตารางเรียนประจำสัปดาห์
3. **Bookings**: เก็บรายการขอจองห้องเรียน
4. **Maintenance**: เก็บรายการแจ้งซ่อมอุปกรณ์

> 📖 ดูขั้นตอนการตั้งค่าอย่างละเอียดได้ที่ไฟล์ [HOW_TO_DEPLOY_GOOGLE_SHEETS.md](HOW_TO_DEPLOY_GOOGLE_SHEETS.md)

---

## 🐙 วิธีนำโปรเจกต์ขึ้น GitHub & เปิดใช้งาน GitHub Pages

### วิธีที่ 1: ใช้ไฟล์ช่วยอัปโหลดอัตโนมัติ
ดับเบิลคลิกที่ไฟล์ **`push_to_github.bat`** แล้วกรอก URL Repository ของคุณ เช่น `https://github.com/username/classroom-management.git`

### วิธีที่ 2: รันคำสั่ง Git ผ่าน Terminal
1. สร้าง Repository ใหม่บน [GitHub.com](https://github.com/new)
2. เปิด Command Prompt หรือ PowerShell ในโฟลเดอร์นี้ แล้วรัน:
```bash
git add .
git commit -m "Initial commit: Classroom Management System with Google Sheets integration"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY>.git
git push -u origin main
```

### 🌐 เปิดเว็บฟรีผ่าน GitHub Pages:
1. เข้าไปที่หน้า Repository บน GitHub
2. ไปที่เมนู **Settings** ➔ **Pages**
3. ที่หัวข้อ **Build and deployment** ➔ ส่วน **Branch** ให้เลือก **`main`** และโฟลเดอร์ **`/(root)`**
4. กด **Save**
5. รอ 1-2 นาที คุณจะได้ลิงก์เว็บไซต์ เช่น `https://<YOUR_USERNAME>.github.io/<YOUR_REPOSITORY>/` สามารถแชร์ให้ทุกคนเปิดใช้งานได้ทันที!
