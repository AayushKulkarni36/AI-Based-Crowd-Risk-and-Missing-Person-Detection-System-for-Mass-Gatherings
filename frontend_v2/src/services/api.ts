// ============================================================================
// API Service — points to the Node/Express backend on :5000
// ============================================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ── Types ────────────────────────────────────────────────────────────────────

export interface VideoJobStatus {
  success: boolean;
  status: 'UPLOADED' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress: number;
  results?: {
    totalPeople?: number;
    avgPeoplePerFrame?: number;
    riskLevel?: string;
    faceMatches?: any[];
    outputVideoPath?: string;
    video_url?: string;
    processingTimeSeconds?: number;
    totalFrames?: number;
    maxPeople?: number;
    crowdHeatmapGrid?: any[];
  };
  uploadedAt?: string;
  processingStartedAt?: string;
  processingCompletedAt?: string;
  error?: string;
}

export interface MissingPerson {
  id: number;
  name: string;
  age: number;
  gender: string;
  description?: string;
  photo_path?: string;
  status: 'ACTIVE' | 'FOUND' | 'INACTIVE' | 'POSSIBLE_MATCH';
  reported_date: string;
  found_timestamp?: string;
  last_seen_location?: string;
  contact_info?: string;
  face_enrolled?: boolean; // true when a 512-dim embedding is stored in DB
}

export interface StatsOverview {
  activePersons: number;
  totalVideos: number;
  completedVideos: number;
  totalPeopleDetected: number;
  criticalAlertsToday: number;
  foundPersons: number;
  totalFaceMatches: number;
}

export interface AlertLog {
  id: number;
  created_at: string;
  alert_type: string;
  risk_level: string;
  person_count?: number;
  message?: string;
  location?: string;
  image_path?: string;
}

export interface DetectionPoint {
  time: string;
  value: number;
}

export interface VideoListJob {
  id: number | string;
  filename?: string;
  status: 'UPLOADED' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress?: number;
  uploaded_at?: string;
}

// Helper: get auth header
function authHeader(): Record<string, string> {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Video API ────────────────────────────────────────────────────────────────

export const api = {
  /**
   * Upload a video file. Returns videoJobId.
   * IMPORTANT: Do NOT set Content-Type for multipart — browser sets boundary automatically.
   */
  uploadVideo: async (file: File): Promise<{ videoJobId: number }> => {
    const formData = new FormData();
    formData.append('video', file); // Multer field name is 'video'

    const res = await fetch(`${API_BASE}/video/upload`, {
      method: 'POST',
      headers: authHeader(), // No Content-Type here — browser handles multipart boundary
      body: formData,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
    // Backend returns `videoId`; alias it as `videoJobId` for consistency
    return { videoJobId: data.videoId ?? data.videoJobId };
  },

  /**
   * Start processing a video by its job ID.
   */
  processVideo: async (videoJobId: number | string): Promise<{ jobId: string; status: string }> => {
    const res = await fetch(`${API_BASE}/video/process/${videoJobId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Process failed (${res.status})`);
    return data;
  },

  /**
   * Poll results for a video job.
   */
  getVideoResults: async (videoJobId: number | string): Promise<VideoJobStatus> => {
    const res = await fetch(`${API_BASE}/video/results/${videoJobId}`, {
      headers: authHeader(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to get results (${res.status})`);
    }
    return await res.json();
  },

  listVideos: async (): Promise<{ success: boolean; jobs: VideoListJob[]; total: number }> => {
    const res = await fetch(`${API_BASE}/video/list`, { headers: authHeader() });
    if (!res.ok) throw new Error('Failed to fetch video jobs');
    return await res.json();
  },

  // ── Stats API ──────────────────────────────────────────────────────────────

  getStatsOverview: async (): Promise<StatsOverview> => {
    const res = await fetch(`${API_BASE}/stats/overview`, { headers: authHeader() });
    if (!res.ok) throw new Error('Failed to fetch stats');
    return await res.json();
  },

  getAlerts: async (): Promise<{ alerts: AlertLog[] }> => {
    const res = await fetch(`${API_BASE}/stats/alerts`, { headers: authHeader() });
    if (!res.ok) throw new Error('Failed to fetch alerts');
    return await res.json();
  },

  getDetectionsAllTime: async (): Promise<{ success: boolean; points: DetectionPoint[] }> => {
    const res = await fetch(`${API_BASE}/stats/detections-all-time`, { headers: authHeader() });
    if (!res.ok) throw new Error('Failed to fetch detections timeline');
    return await res.json();
  },

  // ── Persons API ────────────────────────────────────────────────────────────

  getMissingPersons: async (): Promise<{ persons: MissingPerson[] }> => {
    const res = await fetch(`${API_BASE}/persons`, { headers: authHeader() });
    if (!res.ok) throw new Error('Failed to fetch persons');
    return await res.json();
  },

  registerMissingPerson: async (formData: FormData): Promise<{ success: boolean; person: MissingPerson; faceEnrolled: boolean; faceError?: string | null }> => {
    const res = await fetch(`${API_BASE}/persons/register-missing-person`, {
      method: 'POST',
      headers: authHeader(), // No Content-Type — browser handles multipart
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Registration failed (${res.status})`);
    return data;
  },

  updatePersonStatus: async (id: number, status: string): Promise<{ success: boolean; person: MissingPerson }> => {
    const res = await fetch(`${API_BASE}/persons/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Update failed (${res.status})`);
    return data;
  },

  deletePerson: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/persons/${id}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Delete failed (${res.status})`);
    }
  },

  // ── Face Matching API ──────────────────────────────────────────────────────

  runFaceMatch: async (jobId: number): Promise<{ success: boolean; matches: any[]; totalMatches: number }> => {
    const res = await fetch(`${API_BASE}/facematch/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ jobId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Face matching failed (${res.status})`);
    return data;
  },

  getMatchResults: async (jobId: number): Promise<{ success: boolean; matches: any[] }> => {
    const res = await fetch(`${API_BASE}/facematch/${jobId}`, { headers: authHeader() });
    if (!res.ok) throw new Error('Failed to fetch match results');
    return await res.json();
  },

  confirmMatch: async (matchId: number): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_BASE}/facematch/${matchId}/confirm`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to confirm match');
    return data;
  },

  dismissMatch: async (matchId: number): Promise<{ success: boolean }> => {
    const res = await fetch(`${API_BASE}/facematch/${matchId}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to dismiss match');
    return data;
  },

  // Convenience: build photo URL from photo_path stored in DB
  getPhotoUrl: (photoPath: string | null | undefined): string | null => {
    if (!photoPath) return null;
    // photo_path is stored as absolute path; serve via /uploads
    const filename = photoPath.replace(/\\/g, '/').split('/data/uploads/').pop();
    return filename ? `http://localhost:5000/uploads/${filename}` : null;
  }
};

// Legacy – kept for AppContext compatibility
export type VideoStatus = VideoJobStatus;
