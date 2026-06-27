# 6 Project Requirement Specification

## 6.1 Hardware Requirements

- **Processor:** Intel i5 / Ryzen 5 or higher (multi-core recommended).
- **RAM:** Minimum 8 GB (16 GB recommended for smooth AI processing).
- **Storage:** Minimum 256 GB SSD for codebase, uploaded videos, and results.
- **GPU (Recommended):** NVIDIA CUDA-capable GPU (e.g., RTX 3050 Ti or above) for faster YOLO/face inference.
- **Network:** Stable LAN/Internet for multi-user dashboard access and dependency setup.
- **Peripheral Input:** CCTV/exported video files in supported format (`.mp4`, `.avi`) for analysis.

## 6.2 Software Requirements

- **Operating System:** Windows 10/11 or Linux.
- **Frontend:** React + TypeScript (Vite), Tailwind CSS.
- **Backend:** Node.js (Express), Socket.io, BullMQ.
- **Python AI Stack:** Python 3.10+ with OpenCV, Ultralytics YOLO, InsightFace, PyTorch.
- **Database:** PostgreSQL 15+ with `pgvector` extension.
- **Queue/Cache:** Redis 7+.
- **API/Service Layer:** FastAPI (face enrollment/search microservice), REST APIs from backend.
- **Browser Support:** Latest Chrome, Edge, or Firefox.
- **Package Tools:** npm and pip with virtual environment support.

## 6.3 Functional Requirements (Detailed)

1. System shall support user signup and login with JWT token generation.
2. System shall enforce role-based access (ADMIN and OPERATOR) for protected actions.
3. System shall allow authenticated users to upload videos for analysis.
4. System shall create and track video jobs with status flow: `UPLOADED -> QUEUED -> PROCESSING -> COMPLETED/FAILED`.
5. System shall process queued videos using Python AI pipeline through backend worker integration.
6. System shall detect persons frame-wise and compute crowd metrics (total, min, max, average count).
7. System shall classify crowd risk level into `SAFE`, `MODERATE`, `RISKY`, and `CRITICAL`.
8. System shall generate alerts for high-risk crowd conditions and store them in alert logs.
9. System shall allow registration, update, and managed lifecycle of missing person records.
10. System shall support face enrollment from uploaded photos and store embeddings in database.
11. System shall run face matching against enrolled records and persist match confidence/results.
12. System shall push real-time updates (`job_update`, `alert`, `missing_person_found`) to dashboard clients.
13. System shall provide statistics endpoints for dashboard KPIs and historical detections.
14. System shall expose result endpoints for processed videos and metadata retrieval.

## 6.4 Security Requirements

- Passwords shall be securely hashed using bcrypt before database storage.
- JWT-based authentication shall protect all secured API routes.
- Role-based authorization middleware shall restrict admin-only actions.
- Backend shall use Helmet for secure HTTP headers.
- Backend shall apply rate limiting to reduce brute-force and abuse attempts.
- CORS policy shall restrict API access to approved frontend origins.
- Input validation and controlled file upload handling shall be enforced for API safety.
- Error handling and logging shall capture suspicious/failed operations for auditability.

## 6.5 Performance Requirements

- System shall support concurrent dashboard users without blocking core API operations.
- Video analysis shall run asynchronously through queue workers to keep API response quick.
- Job progress/status updates shall be available in near real-time on frontend.
- System shall support scaling to large historical datasets of jobs, detections, and alerts.
- Face matching queries shall remain efficient using indexed/vector-enabled database operations.
- End-to-end analysis time shall remain operationally acceptable based on video length and hardware profile.

## 6.6 Database Requirements

**Tables/Collections:**

- `users` (authentication, role, account status)
- `camera_locations` (optional camera metadata)
- `video_jobs` (video processing lifecycle, results, risk level, errors)
- `missing_persons` (person profile, status, photo, face vector)
- `alert_logs` (crowd/face related alerts and acknowledgement state)
- `detections` (frame-level/person-level detection records)
- `face_matches` (match confidence, frame number, review status)

**Database Rules and Constraints:**

- Primary keys and foreign keys shall maintain referential integrity.
- Status fields shall use controlled value sets (CHECK constraints).
- Indexed columns shall support fast filtering by status/job/person/time.
- Face similarity storage/search shall use PostgreSQL `pgvector` where enabled.
- Records shall include timestamps for traceability and analytics.

## 6.7 Feasibility Analysis

### Technical Feasibility

The project is technically feasible because it uses mature, widely adopted technologies (React, Node.js, PostgreSQL, Redis, YOLO, InsightFace). The architecture is modular, with clear separation between frontend, backend, worker, and AI layers. Required libraries and community support are strong, and implementation components are already integrated in the current codebase.

### Economic Feasibility

The project is economically feasible for an academic and pilot deployment context. It relies primarily on open-source frameworks and can run on existing lab/department infrastructure. Cost is mainly tied to hardware capability (especially GPU), while software licensing cost is minimal.

### Operational Feasibility

The system is operationally feasible for security/control-room style workflows. Operators can upload videos, monitor progress, and review alerts through a single dashboard. Role-based access and structured logs support practical daily usage.

### Schedule Feasibility

Given the current implementation state and available stack, completing report, testing, and demonstration scope within final-year project timelines is feasible with focused integration and validation.

