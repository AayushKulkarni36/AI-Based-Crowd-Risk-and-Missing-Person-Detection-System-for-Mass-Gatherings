export interface VideoStatus {
    ready: boolean;
    status: 'processing' | 'done' | 'failed' | 'processing_or_empty';
    video_id: string;
    found_persons: Array<{ name: string }>;
    download_url: string | null;
    error?: string;
}

export interface MissingPerson {
    id: number;
    name: string;
    age: number;
    gender: string;
    description: string;
    photo_path: string;
    status: 'ACTIVE' | 'FOUND';
    reported_date: string;
    found_timestamp?: string;
}

const API_BASE = 'http://localhost:8000';

export const api = {
    uploadVideo: async (file: File): Promise<{ video_id: string }> => {
        const formData = new FormData();
        formData.append('video', file);
        const res = await fetch(`${API_BASE}/upload_video`, {
            method: 'POST',
            body: formData,
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Upload failed');
        }
        const data = await res.json();
        return { video_id: data.video_id };
    },

    registerMissingPerson: async (data: FormData): Promise<{ person_id: number }> => {
        const res = await fetch(`${API_BASE}/register_missing_person`, {
            method: 'POST',
            body: data,
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Registration failed');
        }
        return await res.json();
    },

    getStatus: async (videoId: string): Promise<VideoStatus> => {
        const res = await fetch(`${API_BASE}/status/${videoId}`);
        if (!res.ok) throw new Error('Failed to check status');
        return await res.json();
    },

    getMissingPersons: async (): Promise<MissingPerson[]> => {
        const res = await fetch(`${API_BASE}/missing_persons`);
        if (!res.ok) throw new Error('Failed to fetch persons');
        return await res.json();
    },

    getProcessedVideoUrl: (videoId: string) => `${API_BASE}/processed/${videoId}`
};
