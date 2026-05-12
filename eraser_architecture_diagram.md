```eraser
direction right
colorMode outline
styleMode shadow
title AI-Based Crowd Risk & Missing Person Detection System (Realistic Implementation)

SystemConstraints [label: "System Limitations & Constraints", icon: alert-triangle, color: orange] {
  FaceRecConstraint [label: "Face Rec: Limited dataset matching (not enterprise-scale production ready)", icon: info]
  ProcessingConstraint [label: "Video Processing: Batch-based & Simulated real-time via recorded MP4 feeds", icon: info]
  NLPConstraint [label: "NLP Chatbot: Basic Rule-based/API-based implementation (Not Advanced GenAI)", icon: info]
}

InputLayer [label: "Input Layer", color: blue] {
  VideoFeeds [icon: video, label: "CCTV / Uploaded Videos (.mp4)", color: green]
  DataEntry [icon: file-text, label: "Missing Person Data & Photos", color: green]
  ChatInput [icon: message-square, label: "Text Queries (Basic Chat)", color: yellow]
}

ProcessingLayer [label: "Processing Layer (Python / AI)", color: purple] {
  VideoPipeline [icon: film, label: "Video Parsing Pipeline", color: green] {
    FrameExtractor [icon: image, label: "OpenCV Frame Extraction"]
  }

  CrowdRisk [icon: alert-triangle, label: "Crowd Risk (Implemented)", color: green] {
    Yolov8Detector [icon: eye, label: "YOLOv8 Object Detection"]
    DensityCalculator [icon: users, label: "Bounding Box Counting"]
    RiskClassifier [icon: activity, label: "Threshold Logic (Safe/Moderate/Risky)"]
  }

  MissingPerson [icon: user, label: "Missing Person (Partially Implemented)", color: yellow] {
    MTCNNDetector [icon: crosshair, label: "MTCNN Face Detection"]
    FaceNetEmbedder [icon: cpu, label: "DeepFace Feature Extraction"]
  }

  ChatbotEngine [icon: bot, label: "NLP Chatbot (Planned/Basic)", color: red] {
    RuleBasedMatcher [icon: code, label: "Regex & Rule-Based Matcher"]
  }
}

BackendLayer [label: "Backend Layer", color: red] {
  APIServer [icon: server, label: "Node.js Backend (Implemented)", color: green] {
    ExpressApp [icon: globe, label: "REST APIs (Node.js/Express)"]
    PythonWorkers [icon: terminal, label: "Child Processes for Inference"]
  }

  DataStorage [icon: database, label: "Database (Implemented)", color: green] {
    PostgreSQL [icon: database, label: "PostgreSQL DB"] {
      MissingPersonsDB [icon: user, label: "Enrolled Persons & Embeddings"]
      IncidentLogsDB [icon: file-text, label: "Detection Logs & Alerts"]
      VideoJobsDB [icon: video, label: "Video Processing Status"]
    }
  }
}

OutputLayer [label: "Output Layer", color: orange] {
  ClientUI [icon: monitor, label: "Web UI (Implemented)", color: green] {
    Dashboard [icon: layout, label: "React System Dashboard"]
    LiveAlerts [icon: bell, label: "Real-time Alerts (Socket.io)"]
    AnnotatedVideo [icon: play-circle, label: "Processed H.264 Video UI"]
  }

  ExternalNotifications [icon: send, label: "Notifications (Planned)", color: red] {
    EmailSMS [icon: mail, label: "Email / SMS Alerts (Twilio/Nodemailer)"]
  }
}

// Data Flow Connections

// Video & Crowd Flow
VideoFeeds > FrameExtractor [label: "Video Streams / Batch Files"]
FrameExtractor > Yolov8Detector [label: "Extracted Frames"]
Yolov8Detector > DensityCalculator [label: "Person Detections"]
DensityCalculator > RiskClassifier [label: "Density Score"]
RiskClassifier > PythonWorkers [label: "Risk Results"]

// Missing Person Flow
DataEntry > ExpressApp [label: "Submit Enrollment Data"]
ExpressApp > PythonWorkers [label: "Trigger Enrollment Script"]
PythonWorkers > MissingPersonsDB [label: "Store Vector Embeddings"]

FrameExtractor > MTCNNDetector [label: "Cropped Faces from Crowd"]
MTCNNDetector > FaceNetEmbedder
FaceNetEmbedder > PythonWorkers [label: "Match against Dataset"]

// Backend & DB
PythonWorkers <> ExpressApp [label: "IPC status & JSON Output"]
ExpressApp <> PostgreSQL [label: "SQL Read/Write Queries"]

// NLP Flow
ChatInput > ExpressApp
ExpressApp > RuleBasedMatcher
RuleBasedMatcher > ExpressApp [label: "Trigger Action/Static Resp"]

// Output Flow
ExpressApp > Dashboard [label: "REST Responses"]
ExpressApp > LiveAlerts [label: "WebSocket Events"]
ExpressApp > AnnotatedVideo [label: "Serve Annotated Output .mp4"]
ExpressApp > EmailSMS [label: "Trigger on High Risk/Match"]
```
