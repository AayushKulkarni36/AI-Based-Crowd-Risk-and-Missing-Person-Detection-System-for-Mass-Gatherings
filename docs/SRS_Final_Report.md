# 4 Software Requirement Specification (SRS)

## Project: AI-Based Crowd Risk and Missing Person Detection System for Mass Gatherings

**Project Name:** CrowdNexis AI  
**Version:** 1.0  
**Document Type:** Software Requirements Specification (Chapter 4 for Final Year Report)

---

## 4.1 Introduction

This SRS defines the software requirements for an AI-driven surveillance support system that analyzes uploaded crowd videos to:

1. detect crowd density and classify risk levels, and  
2. identify potential missing persons using face matching.

The system is implemented as a full-stack application with:
- React frontend dashboard,
- Node.js/Express backend APIs and queue workers,
- Python AI modules for detection and recognition,
- PostgreSQL database (with `pgvector`) and Redis queue support.

The document is intended for project evaluators, development team members, and academic report review.

---

## 4.2 Overall Description

### 4.2.1 Product Perspective

The system is a standalone web application for safety monitoring in mass gatherings. It processes uploaded videos (batch mode), performs AI inference, stores results, and presents alerts/statistics in a dashboard.

### 4.2.2 Product Functions

1. User login/signup with JWT-based authentication.
2. Role-protected APIs (ADMIN/OPERATOR).
3. Video upload and job creation (`video_jobs`).
4. Queue-based background processing (BullMQ + Redis).
5. Person detection and crowd risk classification (YOLO-based).
6. Missing person profile registration with photo upload.
7. Face enrollment and vector matching (InsightFace + pgvector).
8. Real-time event push using Socket.io (`job_update`, `alert`, `missing_person_found`).
9. Alerts management and analytics/statistics endpoints.

### 4.2.3 User Classes

| User Class | Description | Major Access |
|---|---|---|
| ADMIN | System administrator/senior operator | Full access including admin-only match actions and person status management |
| OPERATOR | Monitoring operator | Upload videos, view results/alerts, register missing persons, dashboard usage |

### 4.2.4 Operating Environment

- **Frontend:** React + TypeScript (Vite), runs on port 5173 (dev).
- **Backend:** Node.js + Express + Socket.io, runs on port 5000.
- **AI Layer:** Python modules (YOLO/InsightFace/OpenCV), FastAPI service for face API (port 5001).
- **Database:** PostgreSQL with `pgvector`.
- **Queue:** Redis + BullMQ worker.
- **OS Support:** Windows/Linux development and deployment environments.

### 4.2.5 Constraints and Assumptions

1. Current pipeline is upload-based, not live CCTV stream ingestion.
2. Detection accuracy depends on video quality, lighting, and camera angle.
3. Face matching confidence threshold is configurable and impacts false positives/negatives.
4. GPU acceleration is recommended for practical processing speed.
5. Internet is not required for runtime inference, but needed for setup/dependency installation.

---

## 4.3 Functional Requirements

### 4.3.1 Authentication and Access Control

| ID | Requirement |
|---|---|
| FR-AUTH-01 | The system shall provide user signup (`POST /api/auth/signup`). |
| FR-AUTH-02 | The system shall provide login using email/password (`POST /api/auth/login`). |
| FR-AUTH-03 | The system shall issue JWT tokens after successful authentication. |
| FR-AUTH-04 | The system shall protect secured APIs using token validation middleware. |
| FR-AUTH-05 | The system shall provide role-restricted routes for admin-only operations. |
| FR-AUTH-06 | The system shall provide `GET /api/auth/me` to fetch authenticated user profile. |
| FR-AUTH-07 | The system shall support password change and token refresh routes. |

### 4.3.2 Video Processing Pipeline

| ID | Requirement |
|---|---|
| FR-VID-01 | The system shall allow authenticated users to upload video files (`POST /api/video/upload`). |
| FR-VID-02 | The system shall create a `video_jobs` record with status flow: `UPLOADED -> QUEUED -> PROCESSING -> COMPLETED/FAILED`. |
| FR-VID-03 | The system shall enqueue jobs for background processing using BullMQ. |
| FR-VID-04 | The worker shall invoke Python processing scripts and capture output results. |
| FR-VID-05 | The system shall expose processing trigger and status/result APIs (`/process/:videoId`, `/results/:videoId`, `/list`). |
| FR-VID-06 | The system shall store processed metrics and result JSON in database fields. |
| FR-VID-07 | The system shall serve annotated output videos for playback through backend endpoints. |

### 4.3.3 Crowd Risk Detection

| ID | Requirement |
|---|---|
| FR-CRD-01 | The system shall detect persons frame-wise using YOLO-based detection models. |
| FR-CRD-02 | The system shall compute crowd statistics (total/max/average people count). |
| FR-CRD-03 | The system shall classify risk into `SAFE`, `MODERATE`, `RISKY`, `CRITICAL` (or `UNKNOWN` where applicable). |
| FR-CRD-04 | The system shall generate alert entries for high-risk scenarios (Risky/Critical). |

### 4.3.4 Missing Person Management and Face Matching

| ID | Requirement |
|---|---|
| FR-MIS-01 | The system shall allow authenticated users to register missing persons with photo (`POST /api/persons`). |
| FR-MIS-02 | The system shall store person details and case status in `missing_persons`. |
| FR-MIS-03 | The system shall provide update/delete actions with role restrictions as implemented. |
| FR-MIS-04 | The system shall provide face-match execution and result endpoints (`/api/facematch/*`). |
| FR-MIS-05 | The system shall store face matching outcomes in `face_matches` with confidence values. |
| FR-MIS-06 | The system shall support match confirmation/dismissal actions for admin review. |

### 4.3.5 Real-Time Dashboard and Alerts

| ID | Requirement |
|---|---|
| FR-RT-01 | The system shall push real-time processing updates via Socket.io events. |
| FR-RT-02 | The system shall push real-time alert events for crowd risk and potential matches. |
| FR-RT-03 | The system shall provide statistics APIs (`/api/stats/overview`, `/api/stats/alerts`, `/api/stats/detections-all-time`). |
| FR-RT-04 | The dashboard shall display current KPIs, alerts, and job state summaries. |

---

## 4.4 Non-Functional Requirements

### 4.4.1 Performance

1. Video processing should complete within practical operational limits based on video length and hardware.
2. API response time for standard read operations should remain low under normal concurrent usage.
3. Queue-based processing should prevent API blocking during long-running AI jobs.

### 4.4.2 Security

1. Passwords shall be securely hashed before storage.
2. JWT-based authentication shall be enforced for protected APIs.
3. Security middleware (e.g., helmet and rate limiting) shall be enabled in backend.
4. CORS policy shall restrict API consumption to authorized frontend origins.
5. Sensitive secrets (DB credentials, JWT secrets, SMTP config) shall remain in environment variables.

### 4.4.3 Reliability and Availability

1. Failed jobs shall be marked as `FAILED` with error details persisted.
2. Server errors shall return structured responses through global error handling.
3. Database and queue failures shall be logged for troubleshooting.
4. Graceful shutdown behavior shall avoid corrupted in-flight operations where possible.

### 4.4.4 Maintainability

1. Backend shall follow route-controller-middleware separation.
2. Frontend API interactions shall stay centralized in service layers.
3. Modular Python files shall keep crowd and face components separable.
4. Database schema shall be maintained via migration SQL scripts.

### 4.4.5 Scalability

1. Worker-based architecture shall support adding more processing workers.
2. Vector search through `pgvector` shall support growth of enrolled face records.
3. Service-wise separation (frontend/backend/python) shall enable containerized scaling.

---

## 4.5 System Interfaces

### 4.5.1 User Interface

- Web-based responsive dashboard with role-based protected routes.
- Key pages: Dashboard, Crowd Detection, Missing Persons, Alerts, Login/Signup.
- File upload interfaces for videos and person photos.
- Real-time status/alert visualization using Socket.io updates.
- Notifications and status indicators for long-running processes.

### 4.5.2 Hardware Interface

- Recommended NVIDIA GPU (CUDA-capable) for faster AI inference.
- CPU-only mode remains functionally possible with reduced speed.
- Local storage is used for uploaded videos/photos and processed outputs.
- Standard workstation/server hardware with adequate RAM and disk space is required.

### 4.5.3 Software Interface

| Interface | Description |
|---|---|
| Frontend <-> Backend | HTTP REST + Socket.io communication |
| Backend <-> PostgreSQL | SQL operations through Node DB client |
| Backend <-> Redis | Queue scheduling and worker coordination |
| Backend <-> Python AI | Child process invocation and/or HTTP calls to face microservice |
| Python <-> PostgreSQL | Face vector storage and similarity search with `pgvector` |
| Backend <-> SMTP (optional) | Email notification dispatch for configured alert scenarios |

---

## 4.6 Use Case Description

### UC-01: User Login

| Field | Description |
|---|---|
| Primary Actor | ADMIN / OPERATOR |
| Precondition | User account exists in database |
| Trigger | User submits login form |
| Main Success Scenario | Credentials validated -> JWT issued -> user redirected to dashboard |
| Alternate Scenario | Invalid credentials -> authentication error message |
| Postcondition | Authenticated session established |

### UC-02: Upload and Process Video

| Field | Description |
|---|---|
| Primary Actor | OPERATOR / ADMIN |
| Precondition | Authenticated user, valid video file |
| Trigger | User uploads video and starts processing |
| Main Success Scenario | Video stored -> job queued -> worker processes -> results saved -> UI updated |
| Alternate Scenario | Processing failure -> job marked FAILED with reason |
| Postcondition | Job result persisted and visible in dashboard |

### UC-03: Register Missing Person

| Field | Description |
|---|---|
| Primary Actor | OPERATOR / ADMIN |
| Precondition | Authenticated user |
| Trigger | User submits missing person form with photo |
| Main Success Scenario | Record created -> photo stored -> enrollment/matching pipeline ready |
| Alternate Scenario | Incomplete/invalid input -> validation errors shown |
| Postcondition | Missing person record available for future matching |

### UC-04: Run Face Match and Review Result

| Field | Description |
|---|---|
| Primary Actor | ADMIN |
| Precondition | Completed video job and enrolled person records exist |
| Trigger | Admin runs face match from facematch endpoints |
| Main Success Scenario | Matches detected -> stored with confidence -> admin confirms/dismisses |
| Alternate Scenario | No match above threshold -> no confirmed person found |
| Postcondition | Match decision reflected in system records/status |

### UC-05: Monitor Alerts and Statistics

| Field | Description |
|---|---|
| Primary Actor | OPERATOR / ADMIN |
| Precondition | System has processed at least one job |
| Trigger | User opens dashboard/alerts page |
| Main Success Scenario | Overview metrics and alerts fetched and displayed; live updates received |
| Alternate Scenario | Temporary backend failure -> retry/error state shown |
| Postcondition | User is informed of latest crowd risk and potential person detections |

---

**End of Chapter 4 - Software Requirement Specification**
