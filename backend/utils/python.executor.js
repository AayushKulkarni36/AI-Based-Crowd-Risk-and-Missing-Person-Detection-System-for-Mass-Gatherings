import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolvePythonPath() {
  if (process.env.PYTHON_PATH) {
    return process.env.PYTHON_PATH;
  }
  return path.join(__dirname, '../../venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
}

/**
 * Run YOLOv8 crowd detection on video
 * @param {string} videoPath - Path to input video
 * @param {string} outputPath - Path to save annotated output (optional)
 * @param {Function} onProgress - Callback for progress updates (percent: 0-100)
 * @returns {Promise<Object>} Results JSON from Python
 */
export function runYOLODetection(videoPath, outputPath = null, onProgress = null) {
  return new Promise((resolve, reject) => {
    const pythonPath = process.env.PYTHON_PATH ||
      path.join(__dirname, '../../venv/Scripts/python.exe');
    const scriptPath = path.join(__dirname, '../../src/crowd_detection/testSimple.py');

    // Build arguments
    const args = [scriptPath, '--video', videoPath];
    if (outputPath) {
      args.push('--output', outputPath);
    }
    args.push('--json');

    const python = spawn(pythonPath, args, {
      cwd: path.dirname(scriptPath),
      stdio: ['inherit', 'pipe', 'pipe']
    });

    let jsonBuffer = '';
    let stderr = '';
    let lastJsonLine = '';

    // Setup readline for line-by-line stdout processing
    const rl = readline.createInterface({
      input: python.stdout,
      crlfDelay: Infinity
    });

    // Process each line from Python
    rl.on('line', (line) => {
      // Check for PROGRESS lines
      if (line.startsWith('PROGRESS:')) {
        const percent = parseInt(line.split(':')[1], 10);
        if (!isNaN(percent) && onProgress) {
          onProgress(percent);
        }
      }
      // Check for JSON in line
      else if (line.trim().startsWith('{')) {
        lastJsonLine = line;
        jsonBuffer = line;
      }
    });

    rl.on('close', () => {
      // Cleanup
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Timeout after 15 minutes
    const timeout = setTimeout(() => {
      python.kill('SIGTERM');
      reject(new Error('Python processing timeout after 15 minutes'));
    }, 15 * 60 * 1000);

    python.on('close', (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        reject(new Error(`Python exited with code ${code}: ${stderr}`));
        return;
      }

      // Parse JSON from buffer
      if (jsonBuffer) {
        try {
          const result = JSON.parse(jsonBuffer);
          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse JSON from Python: ${e.message}`));
        }
      } else if (lastJsonLine) {
        try {
          const result = JSON.parse(lastJsonLine);
          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse last JSON line: ${e.message}`));
        }
      } else {
        reject(new Error('No JSON output from Python script'));
      }
    });

    python.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });
  });
}
