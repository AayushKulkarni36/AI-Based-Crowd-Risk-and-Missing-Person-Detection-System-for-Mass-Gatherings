async function registerMissingPerson(event) {
  event.preventDefault();
  const form = document.getElementById("registerForm");
  const status = document.getElementById("register-status");
  status.textContent = "Registering (face similarity embedding)...";

  const formData = new FormData(form);

  try {
    const resp = await fetch("/register_missing_person", {
      method: "POST",
      body: formData,
    });
    const data = await resp.json();
    if (data.success) {
      status.textContent =
        "Registered. Person ID: " +
        data.person_id +
        ". Face similarity embedding stored in PostgreSQL.";
      status.className = "status success";
      form.reset();
    } else {
      status.textContent = "Error: " + (data.error || "Unknown error");
      status.className = "status error";
    }
  } catch (err) {
    status.textContent = "Error: " + err;
    status.className = "status error";
  }
}

function pollProcessingStatus(videoId) {
  const video = document.getElementById("resultVideo");
  const downloadBtn = document.getElementById("downloadBtn");
  const statusText = document.getElementById("statusText");

  const interval = setInterval(async () => {
    try {
      const res = await fetch(`/status/${videoId}`);
      const data = await res.json();

      if (data.ready) {
        clearInterval(interval);

        video.src = data.download_url;
        video.load();

        if (downloadBtn) {
          downloadBtn.href = data.download_url;
          downloadBtn.style.display = "inline-block";
        }

        if (statusText) {
          statusText.innerText =
            "Processing complete. Download of annotated CCTV video is available.";
        }
      }
    } catch (e) {
      // Keep polling on transient errors
    }
  }, 3000);
}

async function uploadVideo(event) {
  event.preventDefault();
  const form = document.getElementById("video-form");
  const status = document.getElementById("video-status");
  const videoOutput = document.getElementById("video-output");
  const videoEl = document.getElementById("processed-video");

  status.textContent = "Uploading and processing video...";
  videoOutput.classList.add("hidden");

  const formData = new FormData(form);

  try {
    const resp = await fetch("/upload_video", {
      method: "POST",
      body: formData,
    });
    const data = await resp.json();
    if (data.success) {
      status.textContent =
        "Video processing started via crowd + face similarity pipeline. Waiting for result...";
      status.className = "status success";
      videoOutput.classList.remove("hidden");

      const statusText = document.getElementById("statusText");
      if (statusText) {
        statusText.innerText = "Processing started. Monitoring for matches...";
      }

      // Poll until the processed video is ready for download
      pollProcessingStatus(data.video_id);
    } else {
      status.textContent = "Error: " + (data.error || "Unknown error");
      status.className = "status error";
    }
  } catch (err) {
    status.textContent = "Error: " + err;
    status.className = "status error";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("registerForm")
    .addEventListener("submit", registerMissingPerson);
  document
    .getElementById("video-form")
    .addEventListener("submit", uploadVideo);
});

