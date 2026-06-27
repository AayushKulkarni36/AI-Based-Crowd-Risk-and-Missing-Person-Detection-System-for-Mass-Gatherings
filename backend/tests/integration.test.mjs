// Backend Integration Tests
// Run with: node --experimental-vm-modules node_modules/.bin/jest
// Or: npm test (after adding jest config)

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_BASE = 'http://localhost:5000/api';
let authToken = '';
let testPersonId = null;
let testVideoJobId = null;

// ── Auth ─────────────────────────────────────────────────────────────────────

describe('Auth API', () => {
  it('POST /auth/login — should return a JWT token', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@crowdnexis.ai', password: 'admin@123' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('token');
    authToken = data.token;
  });

  it('GET /auth/me — should return authenticated user', async () => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('email', 'admin@crowdnexis.ai');
    expect(data).toHaveProperty('role', 'ADMIN');
  });

  it('GET /auth/me — should return 401 with no token', async () => {
    const res = await fetch(`${API_BASE}/auth/me`);
    expect(res.status).toBe(401);
  });
});

// ── Stats ─────────────────────────────────────────────────────────────────────

describe('Stats API', () => {
  it('GET /stats/overview — should return dashboard stats', async () => {
    const res = await fetch(`${API_BASE}/stats/overview`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('activePersons');
    expect(data).toHaveProperty('totalVideos');
    expect(data).toHaveProperty('completedVideos');
    expect(data).toHaveProperty('totalPeopleDetected');
    expect(data).toHaveProperty('criticalAlertsToday');
    expect(data).toHaveProperty('foundPersons');
    expect(data).toHaveProperty('totalFaceMatches');
    // All should be numbers
    Object.values(data).forEach(v => expect(typeof v).toBe('number'));
  });

  it('GET /stats/alerts — should return alerts array', async () => {
    const res = await fetch(`${API_BASE}/stats/alerts`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('alerts');
    expect(Array.isArray(data.alerts)).toBe(true);
  });
});

// ── Persons API ───────────────────────────────────────────────────────────────

describe('Persons API', () => {
  it('GET /persons — should return persons list', async () => {
    const res = await fetch(`${API_BASE}/persons`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('persons');
    expect(Array.isArray(data.persons)).toBe(true);
  });

  it('POST /persons — should create a new person without photo', async () => {
    const form = new FormData();
    form.append('name', 'Test Person');
    form.append('age', '30');
    form.append('gender', 'Male');
    form.append('description', 'Integration test person');

    const res = await fetch(`${API_BASE}/persons`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}`, ...form.getHeaders() },
      body: form,
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toHaveProperty('success', true);
    expect(data.person).toHaveProperty('name', 'Test Person');
    expect(data.person).toHaveProperty('status', 'ACTIVE');
    testPersonId = data.person.id;
  });

  it('PUT /persons/:id — should update status to FOUND', async () => {
    const res = await fetch(`${API_BASE}/persons/${testPersonId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ status: 'FOUND' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.person).toHaveProperty('status', 'FOUND');
    expect(data.person).toHaveProperty('found_timestamp');
  });

  it('PUT /persons/:id — should reject invalid status', async () => {
    const res = await fetch(`${API_BASE}/persons/${testPersonId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ status: 'INVALID_STATUS' }),
    });
    expect(res.status).toBe(400);
  });

  it('DELETE /persons/:id — should soft-delete the person', async () => {
    const res = await fetch(`${API_BASE}/persons/${testPersonId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('success', true);
  });

  it('GET /persons — should not include soft-deleted person', async () => {
    const res = await fetch(`${API_BASE}/persons`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const data = await res.json();
    const found = data.persons.find((p) => p.id === testPersonId);
    expect(found).toBeUndefined();
  });
});

// ── Video API ─────────────────────────────────────────────────────────────────

describe('Video API', () => {
  it('GET /video/list — should return video list', async () => {
    const res = await fetch(`${API_BASE}/video/list`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('success', true);
    expect(Array.isArray(data.videos)).toBe(true);
  });

  it('POST /video/upload — should upload a video file', async () => {
    // Create a small test video placeholder
    const testVideoPath = path.join(__dirname, 'test_video.mp4');
    fs.writeFileSync(testVideoPath, 'fake-mp4-data-for-testing');

    const form = new FormData();
    form.append('video', fs.createReadStream(testVideoPath), {
      filename: 'test_video.mp4',
      contentType: 'video/mp4',
    });

    const res = await fetch(`${API_BASE}/video/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}`, ...form.getHeaders() },
      body: form,
    });

    // Clean up test file
    fs.unlinkSync(testVideoPath);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('videoJobId');
    testVideoJobId = data.videoJobId;
  });

  it('GET /video/results/:id — should return job status', async () => {
    if (!testVideoJobId) return;
    const res = await fetch(`${API_BASE}/video/results/${testVideoJobId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('success', true);
    expect(data).toHaveProperty('status');
    expect(['UPLOADED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED']).toContain(data.status);
  });

  it('GET /video/results/999999 — should return 404', async () => {
    const res = await fetch(`${API_BASE}/video/results/999999`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(res.status).toBe(404);
  });
});

// ── CORS ──────────────────────────────────────────────────────────────────────

describe('CORS', () => {
  it('OPTIONS /api/stats/overview — should return CORS headers for localhost:5173', async () => {
    const res = await fetch(`${API_BASE}/stats/overview`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'GET' },
    });
    const corsHeader = res.headers.get('access-control-allow-origin');
    expect(corsHeader).toBe('http://localhost:5173');
  });
});
