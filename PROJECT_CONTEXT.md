# PROJECT CONTEXT — AI-Based Crowd Risk & Missing Person Detection System

> This file is a complete technical context document for this project.
> Read this before making any changes, asking questions, or writing code for this project.

---

## 1. What This Project Does

This is a **Final Year Engineering (BE) project** that processes video footage from mass gatherings (like festivals, events) to:
1. **Detect crowd density** and classify the crowd as Safe / Moderate / Risky using AI.
2. **Detect missing persons** by matching faces in the video against an enrolled database of missing people.
3. **Display results** on a real-time web dashboard with alerts.

It is a **realistic academic project**, not a production enterprise system. Some features are implemented, some are partially done, and some are planned.

---

## 2. Technology Stack (What Is Actually Used)

### Python — AI / ML Layer
| Library | Purpose |
|---|---|
| `ultralytics` (YOLOv8 / YOLOv5) | Person detection in video frames |
| `opencv-python` | Video reading, frame extraction, annotation |
| `facenet-pytorch` (MTCNN + InceptionResnetV1) | Legacy face detection + embedding pipeline |
| `insightface` (buffalo_l model) | Active face detection + ArcFace embedding (newer pipeline) |
| `faiss-cpu` | Vector similarity search (earlier version) |
| `pgvector` | Face vector storage and cosine similarity search in PostgreSQL |
| `FastAPI` + `uvicorn` | Python microservice for face enrollment and search (`face_api.py`) |
| `Flask` | Legacy Python web server (kept for compatibility) |
| `psycopg2`, `asyncpg`, `SQLAlchemy` | PostgreSQL database access from Python |
| `torch`, `torchvision` | Deep learning backend (CUDA supported on RTX 3050 Ti) |
| `pyttsx3`, `SpeechRecognition` | Basic voice input / output |

### Node.js — Main Backend
| Library | Purpose |
|---|---|
| `express` | REST API framework |
| `socket.io` | Real-time event push to frontend (alerts, job updates) |
| `pg` | PostgreSQL client for Node.js |
| `multer` | File upload handling (video, photos) |
| `bullmq` + `ioredis` | Background job queue for video processing |
| `jsonwebtoken` + `bcrypt` | Auth (JWT-based login) |
| `nodemailer` | Email alert sending |
| `helmet`, `express-rate-limit` | Security middleware |
| `winston` | Logging |

### React — Frontend
| Library | Purpose |
|---|---|
| `react` + `vite` + `typescript` | Core frontend framework |
| `react-router-dom` | Page routing |
| `@tanstack/react-query` | API data fetching and caching |
| `socket.io-client` | Receives real-time alerts from backend |
| `recharts` | Charts and analytics graphs |
| `framer-motion` | Animations |
| `@radix-ui` | UI component primitives |
| `tailwindcss` | Styling |
| `sonner` | Toast notifications |
| `axios` | HTTP API calls |

### Database
| Component | Details |
|---|---|
| **PostgreSQL** | Primary database for all data |
| **pgvector** extension | Stores 512-dim face embeddings as vectors for cosine similarity matching |

---

## 3. Project Folder Structure

```
FinalYearProject/
│
├── backend/                        # Node.js Express backend
│   ├── server.js                   # Entry point — sets up Express + Socket.io + routes
│   ├── socket.js                   # Socket.io configuration and event namespaces
│   ├── migrate.sql                 # PostgreSQL schema (all table definitions)
│   ├── routes/                     # Route definitions
│   │   ├── auth.routes.js          # /api/auth — login, signup, logout
│   │   ├── video.routes.js         # /api/video — upload, process, status
│   │   ├── person.routes.js        # /api/persons — CRUD for missing persons
│   │   ├── stats.routes.js         # /api/stats — dashboard statistics
│   │   └── facematch.routes.js     # /api/facematch — face enrollment and matching
│   ├── controllers/                # Business logic
│   │   ├── auth.controller.js      # Handles login, signup, JWT generation
│   │   ├── video.controller.js     # Handles video upload, triggers Python inference
│   │   ├── person.controller.js    # CRUD for missing persons
│   │   ├── stats.controller.js     # Returns dashboard statistics from DB
│   │   └── facematch.controller.js # Calls Python face_api.py for enrollment/search
│   ├── workers/
│   │   └── video.worker.js         # BullMQ background worker — processes video jobs
│   ├── middleware/
│   │   ├── upload.js               # Multer config for file uploads
│   │   └── error.js                # Global error handler
│   └── queues/                     # BullMQ queue definitions
│
├── src/                            # Python AI modules
│   ├── crowd_detection/
│   │   ├── person_detector.py      # YOLOv5/v8 person detection class
│   │   ├── risk_classifier.py      # Thresholds density → Safe/Moderate/Risky
│   │   ├── crowd_monitor.py        # Orchestrates detection pipeline
│   │   ├── alert_system.py         # Generates alert payloads
│   │   └── testSimple.py           # Full pipeline test script
│   ├── face_recognition/
│   │   ├── face_processor.py       # MTCNN + FaceNet pipeline (legacy)
│   │   ├── face_api.py             # InsightFace FastAPI microservice (active)
│   │   ├── enroll.py               # CLI script to enroll a person's face
│   │   ├── match_video.py          # Runs face matching on a video file
│   │   ├── database.py             # PostgreSQL DB access layer for face data
│   │   └── main.py                 # Entry point for face recognition pipeline
│   └── utils/                      # Shared utilities
│
├── frontend_v2/                    # React + Vite frontend
│   └── src/
│       ├── App.tsx                 # Routes: /dashboard, /crowd, /missing-persons, /alerts
│       ├── pages/
│       │   ├── Dashboard.tsx       # Overview stats, recent alerts
│       │   ├── CrowdDetection.tsx  # Upload video, view processing status, annotated output
│       │   ├── MissingPersons.tsx  # Enroll persons, view matches
│       │   ├── Alerts.tsx          # View all generated alerts
│       │   └── auth/               # Login, Signup, Admin Login pages
│       ├── context/
│       │   ├── AuthContext.tsx     # JWT auth state (login/logout)
│       │   ├── AppContext.tsx      # Global app state
│       │   └── TranslationContext.tsx # Basic multilingual UI support
│       └── services/
│           └── api.ts              # All Axios API call functions
│
└── data/                           # Runtime data (gitignored)
    ├── uploads/videos/             # Uploaded video files
    ├── uploads/photos/             # Enrolled person photos
    └── results/                    # Annotated output videos
```

---

## 4. Database Schema (PostgreSQL)

### `users`
Stores operator and admin accounts. Has `email`, `password_hash`, `role` (ADMIN / OPERATOR), `full_name`.

### `video_jobs`
Tracks every uploaded video. Key columns:
- `status`: UPLOADED → QUEUED → PROCESSING → COMPLETED / FAILED
- `risk_level`: SAFE / MODERATE / RISKY / CRITICAL
- `face_matches_count`: how many missing persons were detected
- `results_json`: full JSON output from Python inference

### `missing_persons`
Enrolled missing person records. Key columns:
- `face_vector`: 512-dim face embedding stored as pgvector
- `status`: ACTIVE / FOUND / INACTIVE / POSSIBLE_MATCH
- `photo_path`: path to the enrolled photo

### `alert_logs`
Generated alerts from detection. Contains `risk_level`, `message`, `location`, `acknowledged`.

### `face_matches`
Records each face match event between a video job and a missing person. Has `confidence` score and `status` (POSSIBLE_MATCH / CONFIRMED / FALSE_POSITIVE).

### `detections`
Per-frame detection records linking to missing persons.

### `camera_locations`
Camera metadata (name, lat/long, stream URL) — table exists but not heavily used yet.

---

## 5. How the Main Flows Work

### Flow A — Crowd Risk Detection
```
User uploads video (.mp4)
  → Node.js saves file to /data/uploads/videos/
  → Creates a video_jobs record in PostgreSQL (status: UPLOADED)
  → Pushes job to BullMQ queue
  → BullMQ Worker picks it up
  → Spawns Python child process (testSimple.py or crowd_monitor.py)
  → Python: OpenCV reads video, extracts frames
  → Python: YOLOv5/v8 detects persons per frame
  → Python: risk_classifier assigns Safe/Moderate/Risky based on count thresholds
  → Python: draws bounding boxes, saves annotated .mp4 to /data/results/
  → Python: writes JSON results to stdout
  → Node.js reads stdout, updates video_jobs record (status: COMPLETED, risk_level, results)
  → Socket.io emits 'job_update' event to frontend
  → Frontend shows annotated video and risk badge
```

### Flow B — Missing Person Enrollment
```
User fills form (name, age, photo)
  → React frontend POSTs to /api/persons
  → Node.js saves photo to /data/uploads/photos/
  → Node.js creates missing_persons record
  → Node.js calls face enrollment:
      → Either: calls Python face_api.py FastAPI service (POST /face/enroll)
      → Or: spawns Python child process (enroll.py)
  → Python: InsightFace detects face in photo
  → Python: generates 512-dim ArcFace embedding
  → Python: stores embedding in missing_persons.face_vector (pgvector)
```

### Flow C — Missing Person Detection in Video
```
(Runs alongside Crowd Risk during video processing)
  → Python: For each frame, extract face crops
  → Python: InsightFace generates embedding for each detected face
  → Python: Query PostgreSQL pgvector for cosine similarity match
      SELECT ... ORDER BY face_vector <=> $embedding LIMIT 3
  → If similarity >= 0.60 → match found
  → Python: creates face_matches record
  → Python: updates missing_persons.status to POSSIBLE_MATCH or FOUND
  → Node.js: Socket.io emits 'missing_person_found' event to frontend
  → Frontend: shows alert with match confidence
```

### Flow D — Real-time Alerts
```
Python inference → JSON output → Node.js reads it
  → Node.js checks risk_level
  → If RISKY or CRITICAL: creates alert_logs record
  → Socket.io emits 'alert' event to all connected frontend clients
  → Frontend Alerts page shows the new alert in real-time
  → Optionally: Nodemailer sends email notification
```

---

## 6. API Endpoints Reference

### Auth — `/api/auth`
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Login with email + password, returns JWT |
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/logout` | Logout (client-side token clear) |

### Video — `/api/video`
| Method | Path | Description |
|---|---|---|
| POST | `/api/video/upload` | Upload video file |
| GET | `/api/video/status/:id` | Get processing status of a job |
| GET | `/api/video/list` | List all video jobs |

### Missing Persons — `/api/persons`
| Method | Path | Description |
|---|---|---|
| GET | `/api/persons` | List all missing persons |
| POST | `/api/persons` | Add new missing person with photo |
| PATCH | `/api/persons/:id` | Update person details |
| DELETE | `/api/persons/:id` | Remove person |

### Stats — `/api/stats`
| Method | Path | Description |
|---|---|---|
| GET | `/api/stats` | Dashboard summary (total persons, alerts, risk counts) |

### Face Match — `/api/facematch`
| Method | Path | Description |
|---|---|---|
| POST | `/api/facematch/enroll/:id` | Enroll face for person ID |
| POST | `/api/facematch/search` | Search face against enrolled DB |

---

## 7. Face Recognition — Two Pipelines (Important)

There are **two face recognition pipelines** in the codebase. This is a known transition:

### Legacy Pipeline (`face_processor.py`)
- Uses `facenet-pytorch`: MTCNN for detection + InceptionResnetV1 (FaceNet) for embeddings
- Stores embeddings as binary bytes in PostgreSQL
- Matching done in Python memory using cosine similarity
- Status: **Kept but being phased out**

### Active Pipeline (`face_api.py`)
- Uses `insightface` (buffalo_l model): combined detection + ArcFace embeddings
- Stores 512-dim vectors in PostgreSQL using `pgvector` extension
- Matching done via SQL: `ORDER BY face_vector <=> $embedding` (cosine distance)
- Exposed as a **FastAPI microservice on port 5001**
- Status: **This is the current production pipeline**

---

## 8. Frontend Pages

| Page | Route | What It Does |
|---|---|---|
| Dashboard | `/dashboard` | Shows total stats, recent alerts, recent video jobs |
| Crowd Detection | `/crowd` | Upload video, see job status, view annotated output video |
| Missing Persons | `/missing-persons` | Enroll new persons, view enrolled list, see match results |
| Alerts | `/alerts` | View all generated crowd risk and face match alerts |

All pages are behind a **JWT-protected route**. User must log in first.
Auth state is stored in `AuthContext.tsx`.

---

## 9. Ports and Services

| Service | Port | Notes |
|---|---|---|
| Node.js Backend | `5000` | Main REST API + Socket.io |
| React Frontend | `5173` | Vite dev server |
| Python Face API | `5001` | FastAPI microservice (`face_api.py`) |
| PostgreSQL | `5432` | Main database |
| Redis | `6379` | Required by BullMQ for job queuing |

---

## 10. Known Limitations (Academic Project)

- **Face recognition is limited-dataset based** — works well for small enrolled sets, not production-scale
- **Video processing is batch-based**, not true real-time streaming — user uploads a pre-recorded video
- **NLP Chatbot is minimal** — basic keyword/rule matching only, no LLM integration
- **No WhatsApp or SMS** — only Email (Nodemailer) is wired up; SMS/WhatsApp is planned
- **No live CCTV streaming** — simulated via uploaded video files
- **Zone heatmap not implemented** — recharts analytics used instead of geographic maps
- **Two face pipelines exist** — InsightFace (active) and FaceNet (legacy), causing some code duplication

---

## 11. Key Files to Know First

If you are making changes, always look at these files first:

1. `backend/server.js` — All routes registered here
2. `backend/migrate.sql` — Database schema
3. `backend/workers/video.worker.js` — Video processing job logic
4. `backend/controllers/video.controller.js` — Video upload and Python spawn logic
5. `backend/controllers/facematch.controller.js` — Face enrollment/search logic
6. `src/face_recognition/face_api.py` — Active face recognition microservice
7. `src/crowd_detection/person_detector.py` — YOLOv5/v8 detection
8. `frontend_v2/src/App.tsx` — All frontend routes
9. `frontend_v2/src/services/api.ts` — All API call functions
10. `frontend_v2/src/context/AuthContext.tsx` — Auth state management
