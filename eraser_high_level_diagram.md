```eraser
direction right
colorMode outline
styleMode shadow
title High-Level System Architecture: Crowd Risk & Missing Person Detection

InputLayer [label: "Input Sources", color: blue] {
  Cameras [icon: video, label: "Video Streams / MP4 Uploads"]
  Users [icon: users, label: "User Queries & Missing Person Data"]
}

AIEngine [label: "AI Processing Engine", color: purple] {
  RiskDetection [icon: alert-triangle, label: "Crowd Risk Prediction (YOLOv8)"]
  FaceMatching [icon: crosshair, label: "Missing Person Detection (MTCNN)"]
}

BackendSystem [label: "Backend & Storage", color: red] {
  APIServer [icon: server, label: "Node.js / Express API"]
  Database [icon: database, label: "PostgreSQL Database"]
}

OutputLayer [label: "Deployment & Output", color: orange] {
  WebPortal [icon: monitor, label: "React Dashboard UI"]
  NotificationGen [icon: bell, label: "Alerts System (Socket.io/SMS)"]
}

// Data Flow
Cameras > AIEngine [label: "Sends Video Frames"]
Users > BackendSystem [label: "Submits Forms/Queries"]

AIEngine <> BackendSystem [label: "Inference Results & IPC"]
BackendSystem <> Database [label: "Data Persistence"]

BackendSystem > WebPortal [label: "Serves Analytics & Video"]
BackendSystem > NotificationGen [label: "Triggers Alerts"]
```
