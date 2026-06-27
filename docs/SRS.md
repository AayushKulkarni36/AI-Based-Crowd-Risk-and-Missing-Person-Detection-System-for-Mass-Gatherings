# Software Requirements Specification (SRS)

## AI-Based Crowd Risk and Missing Person Detection System for Mass Gatherings

**System Name:** CrowdNexis AI  
**Version:** 2.0  
**Document Status:** Final  
**Prepared By:** Aayush Kulkarni  
**Institution:** [Your College Name]  
**Department:** Computer Engineering  
**Academic Year:** 2025–2026

---

## Table of Contents

1. [Introduction](#1-introduction)
   - 1.1 Purpose
   - 1.2 Scope
   - 1.3 Definitions, Acronyms, and Abbreviations
   - 1.4 References
   - 1.5 Document Overview
2. [Overall Description](#2-overall-description)
   - 2.1 Product Perspective
   - 2.2 Product Functions
   - 2.3 User Classes and Characteristics
   - 2.4 Operating Environment
   - 2.5 Design and Implementation Constraints
   - 2.6 Assumptions and Dependencies
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [System Interfaces](#5-system-interfaces)
   - 5.1 User Interface
   - 5.2 Hardware Interface
   - 5.3 Software Interface
6. [Use Case Description](#6-use-case-description)

---

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) document defines the complete functional and non-functional requirements for **CrowdNexis AI** — an AI-based system for real-time crowd risk assessment and missing person detection at mass gatherings. It is intended for use by the development team, project evaluators, and academic examiners.

### 1.2 Scope

**CrowdNexis AI** is a full-stack web application that analyses uploaded CCTV video footage from crowded venues to:

- Detect and count persons using the YOLOv8n deep-learning model.
- Classify crowd density into risk levels: **Safe**, **Moderate**, **Risky**, and **Critical**.
- Identify missing persons by matching detected faces against an enrolled database using InsightFace ArcFace embeddings stored in PostgreSQL (`pgvector`).
- Display real-time results on a web dashboard via WebSocket (Socket.io).
- Generate and dispatch automated alerts when crowd risk exceeds safe thresholds.

The system targets event security operators, law enforcement personnel, and event management organisations responsible for crowd safety at festivals, religious gatherings, political rallies, and stadium events.

**Out of Scope:**
- Live RTSP camera stream processing (current implementation uses uploaded video files).
- Mobile application.
- WhatsApp / SMS gateway integration.

### 1.3 Definitions, Acronyms, and Abbreviations

| Term | Definition |
|---|---|
| AI | Artificial Intelligence |
| API | Application Programming Interface |
| ArcFace | Angular-margin-based face recognition loss used by InsightFace |
| BullMQ | A Node.js message queue library backed by Redis |
| CCTV | Closed-Circuit Television |
| CORS | Cross-Origin Resource Sharing |
| JWT | JSON Web Token — used for stateless authentication |
| MTCNN | Multi-Task Cascaded Convolutional Networks — face detection model |
| pgvector | PostgreSQL extension for vector similarity search |
| RBAC | Role-Based Access Control |
| REST | Representational State Transfer |
| RTSP | Real-Time Streaming Protocol |
| SRS | Software Requirements Specification |
| UI | User Interface |
| YOLO | You Only Look Once — real-time object detection model family |
| YOLOv8n | Nano variant of YOLO version 8 by Ultralytics |

### 1.4 References

1. IEEE Std 830-1998 — IEEE Recommended Practice for Software Requirements Specifications.
2. Ultralytics YOLOv8 Documentation — https://docs.ultralytics.com
3. InsightFace Project — https://github.com/deepinsight/insightface
4. pgvector Extension — https://github.com/pgvector/pgvector
5. PostgreSQL 15 Documentation — https://www.postgresql.org/docs/15/
6. Socket.io Documentation — https://socket.io/docs/v4/
7. BullMQ Documentation — https://docs.bullmq.io/

### 1.5 Document Overview

- **Section 2** provides an overall description of the product, its context, users, and constraints.
- **Section 3** details all functional requirements organised by module.
- **Section 4** defines non-functional requirements covering performance, security, reliability, and scalability.
- **Section 5** specifies system interfaces — UI, hardware, and software.
- **Section 6** presents key use case descriptions with actors, flows, and postconditions.

---

## 2. Overall Description

### 2.1 Product Perspective

CrowdNexis AI is a standalone web-based system developed as a final-year engineering project. It integrates three independent subsystems:

```
┌──────────────────────────────┐
│   React Frontend (Port 5173) │
│   Dashboard / Crowd / Alerts │
└──────────────┬───────────────┘
               │ HTTP + WebSocket
               ▼
┌──────────────────────────────┐
│  Node.js Backend (Port 5000) │
│  REST API + BullMQ + Socket  │
└────────┬─────────────────────┘
         │              │
         ▼              ▼
  ┌────────────┐  ┌───────────┐
  │ PostgreSQL │  │  Redis 7  │
  │ + pgvector │  │  (Queue)  │
  └────────────┘  └───────────┘
         ▲
         │
┌──────────────────────────────┐
│  Python AI Engine (Port 5001)│
│  YOLOv8n + InsightFace       │
│  FastAPI Microservice        │
└──────────────────────────────┘
```

The system is not a SAAS product; it is designed to run on-premise on a workstation or server equipped with a GPU.

### 2.2 Product Functions

The major functions of the system are:

| # | Function |
|---|---|
| F1 | User authentication and role-based access control |
| F2 | CCTV video upload and queue-based processing |
| F3 | Crowd person detection and density calculation per frame |
| F4 | Crowd risk level classification (Safe / Moderate / Risky / Critical) |
| F5 | Missing person registration with reference photo upload |
| F6 | AI face enrollment — ArcFace 512-dim embedding generation |
| F7 | Face matching in video with cosine similarity threshold |
| F8 | Deduplicated match result display with detection snapshots |
| F9 | Real-time dashboard with WebSocket-driven live updates |
| F10 | Alert generation, logging, and email notification |
| F11 | Annotated output video generation with bounding boxes |
| F12 | Dashboard analytics and statistics |

### 2.3 User Classes and Characteristics

| User Class | Description | Permissions |
|---|---|---|
| **Administrator** | Technical operator with full system access | All operations: add/delete persons, mark found, manage alerts, view all results |
| **Operator** | Security personnel on duty | Add missing persons, upload videos, view results and alerts |
| **Viewer** | Read-only access | View dashboard, alerts, person list — no modifications |

### 2.4 Operating Environment

| Component | Requirement |
|---|---|
| **Server OS** | Windows 10/11 or Ubuntu 20.04+ |
| **Python** | 3.11+ |
| **Node.js** | v18+ (v22 recommended) |
| **PostgreSQL** | 15+ with `pgvector` extension |
| **Redis** | 7+ |
| **GPU** | NVIDIA GPU with CUDA 11.8+ recommended (e.g., RTX 3050 Ti) |
| **RAM** | Minimum 8 GB; 16 GB recommended |
| **Client Browser** | Chrome 110+, Firefox 110+, Edge 110+ |
| **Network** | Local network or localhost for development |

### 2.5 Design and Implementation Constraints

1. **Academic Scope:** Face recognition accuracy is optimised for small enrolled datasets (tens to hundreds of persons), not production-scale millions.
2. **Batch Processing:** Video analysis is performed on uploaded files; live RTSP streaming is not supported in v2.0.
3. **GPU Dependency:** InsightFace and YOLOv8 are significantly faster with a CUDA-compatible GPU. CPU-only operation is supported but slower.
4. **Single Database:** All data is stored in a single PostgreSQL instance. No sharding or replication is implemented.
5. **Browser Video Compatibility:** Annotated output must be encoded with H.264 (`mp4v`/`avc1`) for in-browser playback.
6. **Two Face Pipelines Coexist:** The legacy FaceNet pipeline (`face_processor.py`) remains in the codebase alongside the active InsightFace pipeline to preserve academic development history.

### 2.6 Assumptions and Dependencies

1. The deployment machine has PostgreSQL 15 installed with the `pgvector` extension enabled.
2. Redis 7 is available locally or via Docker for BullMQ job queueing.
3. The Python virtual environment has all packages from `requirements.txt` installed.
4. Uploaded videos are in `.mp4` or `.avi` format and do not exceed 500 MB.
5. Reference photos for missing persons contain a single, clearly visible frontal face.
6. An active internet connection is required only for npm/pip package installation; runtime operation is fully offline.

---

## 3. Functional Requirements

### 3.1 User Authentication Module

| ID | Requirement |
|---|---|
| FR-AUTH-01 | The system shall allow users to register with a full name, email address, and password. |
| FR-AUTH-02 | The system shall authenticate users via email and password. |
| FR-AUTH-03 | On successful login, the system shall issue a signed JWT token with a configurable expiry (default: 24 hours). |
| FR-AUTH-04 | All API routes except `/api/auth/login` and `/api/auth/signup` shall require a valid JWT token in the `Authorization: Bearer <token>` header. |
| FR-AUTH-05 | The system shall enforce Role-Based Access Control (RBAC) with roles: ADMIN, OPERATOR. |
| FR-AUTH-06 | Passwords shall be hashed using bcrypt before storage. |
| FR-AUTH-07 | The system shall provide a `/api/auth/me` endpoint returning the authenticated user's profile. |

### 3.2 Video Upload and Processing Module

| ID | Requirement |
|---|---|
| FR-VID-01 | The system shall accept video file uploads (`.mp4`, `.avi`) up to 500 MB via the frontend drag-and-drop upload card. |
| FR-VID-02 | On upload, the system shall create a `video_jobs` record with status `UPLOADED` and push the job to a BullMQ queue. |
| FR-VID-03 | The BullMQ worker shall pick up queued jobs and invoke the Python AI pipeline as a child process. |
| FR-VID-04 | The system shall update the job status in real-time: `UPLOADED` → `QUEUED` → `PROCESSING` → `COMPLETED` / `FAILED`. |
| FR-VID-05 | The system shall emit a `job_update` Socket.io event to all connected clients on each status change. |
| FR-VID-06 | On completion, the system shall store the risk level, total persons detected, face match count, and full results JSON in the database. |
| FR-VID-07 | The system shall generate an annotated output video with bounding boxes drawn on detected persons, encoded in H.264 format. |
| FR-VID-08 | The API shall expose `GET /api/video/results/:id` to query job status and retrieve results. |

### 3.3 Crowd Detection Module

| ID | Requirement |
|---|---|
| FR-CROWD-01 | The Python AI engine shall use YOLOv8n to detect persons in each video frame. |
| FR-CROWD-02 | The system shall process frames at a configurable skip rate (default: every N-th frame) for performance. |
| FR-CROWD-03 | The system shall calculate crowd density as the total person count per processed frame. |
| FR-CROWD-04 | The system shall classify crowd density using configurable thresholds into four risk levels: Safe, Moderate, Risky, Critical. |
| FR-CROWD-05 | The system shall record per-frame statistics (min, max, average person count) in the results JSON. |
| FR-CROWD-06 | The system shall draw bounding boxes around each detected person on the annotated output video. |

### 3.4 Missing Person Registration Module

| ID | Requirement |
|---|---|
| FR-PERSON-01 | The system shall allow authorised users to register a missing person with: full name, age, gender, description, and a reference photo. |
| FR-PERSON-02 | The system shall save the reference photo to disk (`/data/uploads/photos/`) and store the file path in the database. |
| FR-PERSON-03 | On registration, the system shall automatically invoke the face enrollment pipeline (FR-FACE-01). |
| FR-PERSON-04 | The system shall display an AI enrollment badge on each person card indicating whether a face embedding exists. |
| FR-PERSON-05 | The system shall allow ADMIN users to mark a person as FOUND, updating their status and recording a `found_timestamp`. |
| FR-PERSON-06 | The system shall allow ADMIN users to soft-delete a person record (set `deleted_at`); deleted records are excluded from all list queries. |
| FR-PERSON-07 | The frontend shall display a real-time count of: Active Cases, AI Face Enrolled, and Found persons. |
| FR-PERSON-08 | The system shall support filtering persons by status (All / Active / Found / Possible Match) and searching by name. |

### 3.5 Face Recognition Module

| ID | Requirement |
|---|---|
| FR-FACE-01 | The Python FastAPI microservice (`face_api.py`) on port 5001 shall accept a reference photo, detect the face using InsightFace (buffalo_l model), generate a 512-dimensional ArcFace embedding, and store it in the `missing_persons.face_vector` column using `pgvector`. |
| FR-FACE-02 | The system shall perform cosine similarity search in PostgreSQL using the `<=>` operator to compare detected face embeddings against all enrolled embeddings. |
| FR-FACE-03 | A face match shall be recorded when cosine similarity ≥ 0.60. |
| FR-FACE-04 | The system shall save a snapshot image of the detection frame for each match event. |
| FR-FACE-05 | The system shall create a `face_matches` record for each match, storing person_id, video_job_id, confidence score, and snapshot_path. |
| FR-FACE-06 | The system shall update the matched person's status to `POSSIBLE_MATCH`; if confidence exceeds an upper threshold, status shall auto-advance to `FOUND`. |
| FR-FACE-07 | The Node.js backend shall emit a `missing_person_found` Socket.io event to all connected clients upon a confirmed match. |
| FR-FACE-08 | The frontend shall deduplicate match results — displaying a single card per matched person showing the highest-confidence match and the detection snapshot. |

### 3.6 Alert System Module

| ID | Requirement |
|---|---|
| FR-ALERT-01 | The system shall create an `alert_logs` record when crowd risk level reaches Risky or Critical. |
| FR-ALERT-02 | The system shall create an `alert_logs` record when a missing person face match is confirmed. |
| FR-ALERT-03 | The system shall emit an `alert` Socket.io event to all connected frontend clients in real-time. |
| FR-ALERT-04 | Alerts shall be displayable on the Alerts page with timestamp, risk level, message, and location. |
| FR-ALERT-05 | The system shall send an email notification via Nodemailer for Critical risk-level alerts (configurable SMTP). |
| FR-ALERT-06 | The system shall support acknowledging alerts (marking as read). |

### 3.7 Dashboard and Analytics Module

| ID | Requirement |
|---|---|
| FR-DASH-01 | The dashboard shall display live KPI cards: total active missing persons, total videos analysed, total people detected, critical alerts today, found persons, and total face matches. |
| FR-DASH-02 | The `GET /api/stats/overview` endpoint shall return all KPI counts from the database. |
| FR-DASH-03 | The dashboard shall display recent video jobs with their status and risk level. |
| FR-DASH-04 | The dashboard shall display recent alerts from the alert log. |
| FR-DASH-05 | The system shall provide analytics charts (using Recharts) showing risk level distribution over time. |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement |
|---|---|
| NFR-PERF-01 | The YOLOv8n model shall process a minimum of 15 frames per second on a machine with an NVIDIA GPU (RTX 3050 Ti or equivalent). |
| NFR-PERF-02 | Face embedding generation for a single reference photo shall complete within 3 seconds. |
| NFR-PERF-03 | The pgvector cosine similarity search over an enrolled database of 1,000 persons shall return results in under 200 ms. |
| NFR-PERF-04 | REST API responses for read-only endpoints shall complete within 500 ms under normal load. |
| NFR-PERF-05 | The frontend dashboard shall load and render within 3 seconds on a standard broadband connection. |

### 4.2 Security

| ID | Requirement |
|---|---|
| NFR-SEC-01 | All API endpoints (except auth) shall be protected by JWT validation middleware. |
| NFR-SEC-02 | Passwords shall never be stored in plaintext; bcrypt with a minimum cost factor of 10 shall be used. |
| NFR-SEC-03 | The backend shall use `helmet` to set secure HTTP headers (X-Content-Type-Options, X-Frame-Options, etc.). |
| NFR-SEC-04 | The backend shall apply `express-rate-limit` to prevent brute-force attacks on the login endpoint. |
| NFR-SEC-05 | CORS shall be restricted to the frontend origin (`http://localhost:5173`) in production configuration. |
| NFR-SEC-06 | Environment variables (DB credentials, JWT secret) shall never be committed to version control. |

### 4.3 Reliability

| ID | Requirement |
|---|---|
| NFR-REL-01 | If a video processing job fails (Python error), the job status shall be set to `FAILED` with an error message stored; the system shall not crash. |
| NFR-REL-02 | If the face enrollment API is unavailable, the person record shall still be created with `face_enrolled: false`; the error shall be returned to the UI without blocking registration. |
| NFR-REL-03 | The Node.js backend shall use `winston` for structured logging to assist in post-failure debugging. |
| NFR-REL-04 | The PostgreSQL connection pool (psycopg2, pg) shall gracefully handle connection drops and retry. |

### 4.4 Usability

| ID | Requirement |
|---|---|
| NFR-USE-01 | The web UI shall be fully responsive and usable on screens ≥ 1024px width. |
| NFR-USE-02 | All modal dialogs shall have a sticky action footer (Cancel / Submit) that remains visible regardless of content height. |
| NFR-USE-03 | The system shall display clear toast notifications for all user actions (success, warning, error). |
| NFR-USE-04 | Page loading states shall be communicated using skeleton placeholders, not blank screens. |
| NFR-USE-05 | The system shall support a multilingual UI via a `TranslationContext` (English default). |

### 4.5 Maintainability

| ID | Requirement |
|---|---|
| NFR-MAINT-01 | Backend business logic shall be separated into controllers, routes, workers, and middleware — no logic in route files. |
| NFR-MAINT-02 | Frontend API calls shall be centralised in `services/api.ts`. |
| NFR-MAINT-03 | Database schema changes shall be managed via versioned SQL migration files. |
| NFR-MAINT-04 | The Python AI engine shall be exposed as a standalone FastAPI microservice, allowing independent restart and update. |

### 4.6 Scalability

| ID | Requirement |
|---|---|
| NFR-SCALE-01 | The BullMQ job queue architecture shall allow multiple video processing workers to run concurrently on the same or different machines. |
| NFR-SCALE-02 | The pgvector IVFFlat index on `face_vector` shall support efficient ANN search as the enrolled database grows. |
| NFR-SCALE-03 | The system architecture shall be containerisable via Docker Compose for horizontal scaling. |

---

## 5. System Interfaces

### 5.1 User Interface

The frontend is a **React 18 single-page application** served on port 5173 (Vite dev server). It features:

| Page | Route | Description |
|---|---|---|
| Login | `/login` | Email + password form; JWT stored in browser context |
| Dashboard | `/dashboard` | KPI stat cards, recent video jobs, recent alerts |
| Crowd Detection | `/crowd` | Video upload (drag-and-drop), job status tracker, annotated video player, risk badge |
| Missing Persons | `/missing-persons` | Person grid with photo/AI-enrolled badge, Add Person modal with sticky footer, match cards with snapshot and confidence score |
| Alerts | `/alerts` | Chronological alert table with risk level colour coding |

**UI Design Principles:**
- Dark theme with slate/blue/emerald colour palette.
- Framer Motion micro-animations on cards and page transitions.
- Radix UI accessible primitives for dropdowns, modals, and form elements.
- Sonner toast notifications for all feedback.

### 5.2 Hardware Interface

| Interface | Details |
|---|---|
| **GPU** | NVIDIA CUDA-compatible GPU; used by YOLOv8n (PyTorch) and InsightFace (ONNX Runtime with CUDA EP) for inference acceleration |
| **Storage** | Local disk for uploaded video files (`/data/uploads/`) and annotated output videos (`/data/results/`) |
| **Network Adapter** | Standard Ethernet / Wi-Fi; system operates on localhost; no external network required for runtime |
| **Camera / CCTV** | Not directly interfaced in v2.0; footage is uploaded manually as video files |

### 5.3 Software Interface

#### Node.js Backend ↔ PostgreSQL
- **Driver:** `pg` (node-postgres) with connection pooling.
- **Protocol:** TCP on port 5432.
- **Extension:** `pgvector` — provides the `vector` data type and `<=>` cosine distance operator.

#### Node.js Backend ↔ Redis
- **Driver:** `ioredis`.
- **Protocol:** Redis protocol on port 6379.
- **Purpose:** BullMQ job queues for video processing.

#### Node.js Backend ↔ Python AI Engine
- **Primary:** HTTP REST calls to FastAPI microservice on port 5001 (`/face/enroll`, `/face/search`).
- **Secondary:** `child_process.spawn` to run `testSimple.py` for crowd detection; results communicated via stdout (JSON).

#### Python AI Engine ↔ PostgreSQL
- **Driver:** `psycopg2` (synchronous) + `asyncpg` (async).
- **Protocol:** TCP on port 5432.
- **Operations:** Read enrolled face vectors; write match records and status updates.

#### Frontend ↔ Node.js Backend
- **HTTP REST:** Axios over HTTP/1.1 to `http://localhost:5000/api/*`.
- **WebSocket:** Socket.io client subscribing to `/events` namespace for real-time events (`job_update`, `missing_person_found`, `alert`).

#### External Email Service (Nodemailer)
- **Protocol:** SMTP (configurable host, port, TLS).
- **Trigger:** Critical crowd alerts; configured via `.env` SMTP variables.

---

## 6. Use Case Description

### UC-01: Upload and Analyse CCTV Video

| Field | Detail |
|---|---|
| **Use Case ID** | UC-01 |
| **Name** | Upload and Analyse CCTV Video |
| **Actor** | Operator / Administrator |
| **Precondition** | User is authenticated (valid JWT). Video file is in `.mp4` or `.avi` format. |
| **Trigger** | User selects or drags a video file onto the Upload Card and clicks "Start Analysis". |

**Main Flow:**
1. User navigates to the Crowd Detection page.
2. User drops a video file into the drag-and-drop zone.
3. Frontend calls `POST /api/video/upload` with the file as multipart/form-data.
4. Backend saves the file, creates a `video_jobs` record (status: UPLOADED), and pushes the job to BullMQ.
5. Backend emits `job_update` (status: QUEUED) via Socket.io.
6. BullMQ worker picks up the job, spawns the Python AI pipeline.
7. Python processes each frame: YOLOv8n detects persons, risk classifier labels risk level, InsightFace searches for missing persons.
8. Python outputs JSON results to stdout; worker reads and updates the database (status: COMPLETED).
9. Backend emits `job_update` (status: COMPLETED) via Socket.io.
10. Frontend receives the event, fetches results, displays the annotated video and risk badge.

**Alternate Flow (A1 — Processing Error):**
- If Python exits with error code, worker sets status to FAILED and stores the error message.
- Frontend displays a FAILED badge; error details are logged via Winston.

**Postcondition:** `video_jobs` record updated with risk_level, results_json, annotated video path, and face match count.

---

### UC-02: Register a Missing Person

| Field | Detail |
|---|---|
| **Use Case ID** | UC-02 |
| **Name** | Register a Missing Person |
| **Actor** | Operator / Administrator |
| **Precondition** | User is authenticated. |
| **Trigger** | User clicks "Add Person" on the Missing Persons page. |

**Main Flow:**
1. User opens the "Add Missing Person" modal.
2. User enters: Full Name, Age, Gender, Description; uploads a reference photo.
3. User clicks "Create Profile".
4. Frontend submits multipart form to `POST /api/persons`.
5. Backend saves photo to disk, creates `missing_persons` record (status: ACTIVE).
6. Backend calls Python face API `POST /face/enroll` with the photo path.
7. InsightFace detects the face, generates a 512-dim ArcFace embedding.
8. Embedding stored in `missing_persons.face_vector`; `face_enrolled` set to `true`.
9. Backend returns `{ faceEnrolled: true }` to frontend.
10. Frontend shows success toast; new person card appears with "AI Enrolled" badge.

**Alternate Flow (A1 — Face Not Detected in Photo):**
- Face API returns an error if no clear face is found.
- Person record is still created; `face_enrolled` remains `false`.
- Frontend shows a warning toast: "Profile created — face enrollment failed: [reason]".

**Postcondition:** Person registered in DB; face vector stored (or `face_enrolled: false` if photo was unusable).

---

### UC-03: Detect Missing Person in Video

| Field | Detail |
|---|---|
| **Use Case ID** | UC-03 |
| **Name** | Detect Missing Person in Video |
| **Actor** | System (automated, triggered during UC-01) |
| **Precondition** | At least one person is registered with a face embedding. A video processing job is running. |
| **Trigger** | BullMQ worker begins processing a video job. |

**Main Flow:**
1. Python AI engine processes each video frame.
2. InsightFace detects face regions in the frame.
3. For each detected face, a 512-dim embedding is generated.
4. System queries PostgreSQL: `SELECT ... ORDER BY face_vector <=> $embedding LIMIT 3`.
5. If cosine similarity ≥ 0.60, a match is recorded.
6. System saves a snapshot image of the detection frame.
7. A `face_matches` record is created (person_id, job_id, confidence, snapshot_path).
8. `missing_persons.status` updated to `POSSIBLE_MATCH` (or `FOUND` if confidence is very high).
9. Node.js backend emits `missing_person_found` Socket.io event.
10. Frontend receives event; match card appears showing person name, confidence %, and snapshot image.
11. UI deduplicates results — one card per person, highest confidence match shown.

**Postcondition:** `face_matches` records created; person status updated; frontend displays match cards.

---

### UC-04: View and Acknowledge Alerts

| Field | Detail |
|---|---|
| **Use Case ID** | UC-04 |
| **Name** | View and Acknowledge Alerts |
| **Actor** | Operator / Administrator |
| **Precondition** | User is authenticated. At least one alert has been generated. |
| **Trigger** | User navigates to the Alerts page, or a real-time alert arrives via Socket.io. |

**Main Flow:**
1. User navigates to the Alerts page.
2. Frontend calls `GET /api/stats/alerts` to fetch the alert list.
3. Alerts displayed in reverse-chronological order with risk level colour coding.
4. New alerts arriving via `alert` Socket.io event are prepended to the list with a toast notification.
5. User can acknowledge an alert (mark as read); status updates via API.
6. For Critical-level alerts, an email notification has already been sent to configured recipients.

**Postcondition:** Alert log updated with acknowledged status.

---

### UC-05: Login and Logout

| Field | Detail |
|---|---|
| **Use Case ID** | UC-05 |
| **Name** | Login and Logout |
| **Actor** | Any user |
| **Precondition** | User account exists in the `users` table. |
| **Trigger** | User opens the login page and submits credentials. |

**Main Flow:**
1. User enters email and password on the login page.
2. Frontend posts to `POST /api/auth/login`.
3. Backend validates credentials; bcrypt compares password hash.
4. On success, backend returns a signed JWT and user profile.
5. `AuthContext` stores the token; user is redirected to `/dashboard`.
6. All subsequent API calls include `Authorization: Bearer <token>`.
7. On logout, token is cleared from context; user is redirected to `/login`.

**Alternate Flow (A1 — Invalid Credentials):**
- Backend returns HTTP 401.
- Frontend shows error toast: "Invalid email or password".

**Postcondition:** User session established (login) or terminated (logout).

---

*End of Software Requirements Specification*
