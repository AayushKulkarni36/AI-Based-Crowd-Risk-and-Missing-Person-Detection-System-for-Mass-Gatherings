# AI Surveillance System - Frontend V2

This is the modern React-based frontend for the Crowd Risk and Missing Person Detection System.

## Tech Stack
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Framer Motion

## Prerequisites
- Node.js (v18 or higher recommended)
- The Python Backend running on `http://localhost:8000`

## Installation

1. Navigate to this folder:
   ```bash
   cd frontend_v2
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open your browser at `http://localhost:5173`

## Features

- **Dashboard**: Overview of system capabilities.
- **Crowd Analysis**: Upload CCTV footage to get crowd density and risk overlays.
- **Missing Person Search**: Register missing people and scan videos for matches.
- **Real-time Status**: Polls the backend for processing updates.

## Notes
- Ensure the backend (`src/face_recognition/face_api.py`) is running before starting the frontend.
- API requests are proxied via Vite config or directly to localhost:8000.
