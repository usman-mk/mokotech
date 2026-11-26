# Equipment Inspection Deferral

ระบบขอเลื่อนกำหนดตรวจสอบอุปกรณ์: ยื่นคำขอ, อนุมัติ/ปฏิเสธ และบังคับใช้นโยบายหมวด 4.2

| ส่วน | เทคโนโลยี |
|---|---|
| Backend | NestJS 12 + TypeScript + TypeORM (`backend/`) |
| Database | PostgreSQL 16 ผ่าน Docker (`docker-compose.yml`, `seed.sql`) |
| Frontend | React 19 + Vite + shadcn/ui + Tailwind CSS v4 + lucide-react (`frontend/`) |
| Test | vitest — unit + HTTP test กับ PostgreSQL จริง (`backend/`) |

เหตุผลของการตัดสินใจและสมมติฐานต่าง ๆ อยู่ใน [`DECISIONS.docx`](DECISIONS.docx)

## สิ่งที่ต้องมี

- **Node.js 20.19+** (หรือ 22.12+) และ npm
- **Docker** (Docker Desktop) สำหรับ PostgreSQL

## วิธีรัน

รันจาก root ของ repo ตามลำดับ

### 1. ตั้งค่า environment

```bash
cp .env.example .env
```

`.env` ใช้ร่วมกันทั้ง docker-compose และ backend (ไฟล์นี้ไม่ถูก commit) แก้รหัสผ่านได้ แต่ `DATABASE_URL` ต้องตรงกับ `POSTGRES_*`

### 2. เปิดฐานข้อมูล

```bash
docker compose up -d
```

ครั้งแรก Postgres จะรัน `seed.sql` ให้เอง (ตาราง `app_user`, `equipment` + ข้อมูลตัวอย่าง)

### 3. Backend — http://localhost:3000

```bash
cd backend
npm ci
npm run start:dev
```

ตอน start แอปจะรัน **migration** ที่ยังไม่ได้รันให้อัตโนมัติ (สร้างตาราง `deferral_request`) — ไม่ต้องรันคำสั่งเพิ่ม

### 4. Frontend — http://localhost:5173

เปิด terminal ใหม่:

```bash
cd frontend
npm ci
npm run dev
```

เปิด http://localhost:5173 แล้วเลือกผู้ใช้จาก dropdown มุมขวาบน (แทนการ login)

## ผู้ใช้ตัวอย่าง (จาก `seed.sql`)

ระบบไม่มี login: ทุก request ส่ง header `X-User-Id` แล้ว backend อ่าน role จากตาราง `app_user`

| id | ผู้ใช้ | role | ทำอะไรได้ |
|---|---|---|---|
| 1 | Somchai Thongdee | requester | ยื่นคำขอ |
| 2 | Nattaya Pornsawan | requester | ยื่นคำขอ |
| 3 | Wichai Kaewsri | supervisor | ยื่นคำขอ, อนุมัติ/ปฏิเสธคำขอระดับหัวหน้างาน |
| 4 | Pensri Maneerat | supervisor | ยื่นคำขอ, อนุมัติ/ปฏิเสธคำขอระดับหัวหน้างาน |
| 5 | Anan Siriwat | department_manager | ยื่นคำขอ, อนุมัติ/ปฏิเสธได้ทุกคำขอ |

ห้ามอนุมัติหรือปฏิเสธคำขอของตัวเอง

## นโยบายหมวด 4.2 ในระบบนี้

อุปกรณ์ **Criticality A** ต้องให้**ผู้จัดการฝ่าย**อนุมัติแทนหัวหน้างาน เมื่อ

- วันที่ขอเลื่อน **เกิน 30 วันนับจากกำหนดเดิมของรอบ** (นับสะสม ไม่ใช่นับต่อครั้ง) หรือ
- เป็นการเลื่อน **ครั้งที่ 3 ขึ้นไป** ในรอบเดียวกัน (เลื่อนครั้งแรก + เลื่อนซ้ำได้ 1 ครั้ง)

คำขอที่เกินเงื่อนไขไม่ถูกปฏิเสธ แต่ถูกส่งต่อให้ผู้จัดการฝ่าย พร้อมเหตุผลใน `policyNote` · Criticality B/C หัวหน้างานอนุมัติได้เสมอ · ระบบตรวจนโยบายอีกครั้งตอนอนุมัติ

โค้ดอยู่ที่ [`backend/src/deferral/deferral-policy.ts`](backend/src/deferral/deferral-policy.ts) (pure functions)

## Test

ต้องเปิดฐานข้อมูลไว้ก่อน (`docker compose up -d`)

```bash
cd backend
npm run test
```

- Test ใช้ฐานข้อมูลแยก **`inspection_test`** (สร้างให้อัตโนมัติ) — ไม่แตะข้อมูลใน `inspection` ที่ใช้พัฒนา
- Unit test ของนโยบาย 4.2: `backend/src/deferral/deferral-policy.spec.ts`
- HTTP test (ยื่น/อนุมัติ/ปฏิเสธ, 4.2 end-to-end, สิทธิ์, ทำงานพร้อมกัน): `backend/test/deferral.http.spec.ts`

คำสั่งเดียวกับ CI:

```bash
cd backend  && npm ci && npm run lint && npm run build && npm run test
cd frontend && npm ci && npm run lint && npm run build
```

## Schema และ migration

สร้าง schema ด้วย **TypeORM migration** (`backend/src/database/migrations/`)

| Migration | ทำอะไร |
|---|---|
| `InitSeed` | สร้าง `app_user`, `equipment` + ข้อมูลตาม `seed.sql` แบบ idempotent — บน DB ที่ docker seed แล้วจะไม่เปลี่ยนอะไร, บน DB ว่าง (เช่นใน CI) จะได้ข้อมูลตั้งต้น |
| `CreateDeferralRequest` | ตาราง `deferral_request` + constraint + index |

คำสั่ง (รันใน `backend/`):

```bash
npm run migration:show     # ดูสถานะ
npm run migration:run      # รันที่ค้าง (ปกติแอปรันให้ตอน start อยู่แล้ว)
npm run migration:revert   # ย้อน 1 migration
```

## API

ทุก endpoint ต้องมี header `X-User-Id` ยกเว้น `GET /users`

| Method | Path | ใคร | ผล |
|---|---|---|---|
| GET | `/users` | ทุกคน (ไม่ต้องมี header) | รายชื่อผู้ใช้ |
| GET | `/me` | ทุก role | ผู้ใช้ปัจจุบัน |
| GET | `/equipment` | ทุก role | รายการอุปกรณ์ (ใกล้/เลยกำหนดก่อน) |
| GET | `/equipment/:id` | ทุก role | อุปกรณ์ 1 ตัว |
| POST | `/deferral-requests` | ทุก role | ยื่นคำขอ `{ equipmentId, requestedDueDate: "YYYY-MM-DD", reason }` |
| GET | `/deferral-requests` | ทุก role | คำขอทั้งหมด (ใหม่สุดก่อน) |
| GET | `/deferral-requests/pending-approvals` | supervisor, manager | คำขอที่ผู้ใช้นี้ตัดสินได้ |
| GET | `/deferral-requests/:id` | ทุก role | คำขอ 1 รายการ |
| POST | `/deferral-requests/:id/approve` | supervisor, manager | อนุมัติ `{ note? }` → อัปเดตกำหนดตรวจของอุปกรณ์ |
| POST | `/deferral-requests/:id/reject` | supervisor, manager | ปฏิเสธ `{ note }` (บังคับใส่เหตุผล) |

ตัวอย่าง:

```bash
curl -X POST http://localhost:3000/deferral-requests \
  -H "X-User-Id: 1" -H "Content-Type: application/json" \
  -d '{"equipmentId": 3, "requestedDueDate": "2099-01-01", "reason": "รออะไหล่"}'
```

Status code: `400` ข้อมูลไม่ถูกต้อง · `401` ไม่มี/ไม่รู้จัก `X-User-Id` · `403` ไม่มีสิทธิ์ · `404` ไม่พบ · `409` มีคำขอค้างอยู่แล้ว / ถูกตัดสินไปแล้ว / กำหนดตรวจเปลี่ยนหลังยื่น

## โครงสร้าง

```
backend/
  src/auth/          X-User-Id guard, @Roles, @Public, @CurrentUser
  src/deferral/      คำขอเลื่อน: policy 4.2, service, controller, DTO
  src/equipment/     อุปกรณ์
  src/users/         ผู้ใช้
  src/database/      data source + migrations
  test/              HTTP test (+ setup ที่สร้าง DB inspection_test)
frontend/
  src/pages/         หน้ารายการอุปกรณ์, รออนุมัติ, คำขอทั้งหมด
  src/components/app ฟอร์มยื่นคำขอ, dialog อนุมัติ/ปฏิเสธ, user switcher
  src/components/ui  component ของ shadcn/ui (ติดตั้งด้วย npx shadcn@latest add)
  src/lib/           API client, format, hook โหลดข้อมูล
```

## แก้ปัญหา

| อาการ | วิธีแก้ |
|---|---|
| `DATABASE_URL is not set` | ยังไม่ได้ `cp .env.example .env` ที่ root ของ repo |
| `password authentication failed` | เปลี่ยนรหัสใน `.env` หลังสร้าง volume ไปแล้ว — Postgres ตั้งรหัสตอนสร้าง volume ครั้งแรกเท่านั้น: `docker compose down -v && docker compose up -d` (ข้อมูลจะถูกล้างและ seed ใหม่) |
| port 5432 ถูกใช้อยู่ | ตั้ง `POSTGRES_PORT` ใน `.env` และแก้ port ใน `DATABASE_URL` ให้ตรงกัน |
| หน้าเว็บขึ้น "เชื่อมต่อ API ไม่ได้" | backend ยังไม่รัน หรือรันคนละ port — ตั้ง `VITE_API_URL` ใน `frontend/.env` |
| แก้ `seed.sql` แล้วไม่มีผล | seed รันตอนสร้าง volume ครั้งแรกเท่านั้น: `docker compose down -v && docker compose up -d` |
