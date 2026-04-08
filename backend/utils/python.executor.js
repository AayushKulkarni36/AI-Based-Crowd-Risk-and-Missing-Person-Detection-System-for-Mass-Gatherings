import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Spawn Python process for video analysis
 * @param {string} videoPath - Path to video file
 * @param {Function} onProgress - Callback(percent) for PROGRESS:N lines
 * @returns {Promise<Object>} Parsed JSON results
 */
export function spawnPythonProcess(videoPath, onProgress = null) {
  return new Promise((resolve, reject) => {
    // Resolve Python executable
    const pythonPath = process.env.PYTHON_EXEC ||
      path.join(__dirname, '../../venv/Scripts/python.exe');

    const scriptPath = path.join(__dirname, '../../src/crowd_detection/testSimple.py');

    // Build arguments
    const args = [
      scriptPath,
      '--video', path.resolve(videoPath),
      '--json',
      '--skip', process.env.SKIP_FRAMES_CROWD || process.env.SKIP_FRAMES || '3',
      '--face-skip', process.env.SKIP_FRAMES_FACE || '3',
      '--face-threshold', process.env.MISSING_PERSON_THRESHOLD || '0.60',
      '--face-cooldown', process.env.MISSING_PERSON_COOLDOWN_SECONDS || '5'
    ];

    console.log(`[Python] Spawning: ${pythonPath} ${args.join(' ')}`);

    const proc = spawn(pythonPath, args, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let lastJson = null;
    let stderr = '';
    let timedOut = false;

    // Read stdout line-by-line
    const rl = readline.createInterface({
      input: proc.stdout,
      crlfDelay: Infinity
    });

    rl.on('line', (line) => {
      line = line.trim();
      if (!line) return;

      // Handle PROGRESS lines
      if (line.startsWith('PROGRESS:')) {
        const pct = parseInt(line.split(':')[1], 10) || 0;
        if (onProgress && !isNaN(pct)) {
          onProgress(pct);
        }
        return;
      }

      // Handle JSON lines
      if (line.startsWith('{')) {
        try {
          lastJson = JSON.parse(line);
          console.log('[Python] Received JSON:', lastJson);
        } catch (e) {
          console.warn('[Python] Invalid JSON:', e.message);
        }
      }
    });

    proc.stderr.on('data', (data) => {
      const msg = data.toString();
      stderr += msg;
      // Log Python stderr (model loading, etc.) but don't fail on it
      console.error('[Python stderr]', msg.trim());
    });

    // Timeout: 15 minutes
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
    }, 15 * 60 * 1000);

    proc.on('close', (code) => {
      clearTimeout(timer);

      // If already handled by timeout, don't process again
      if (timedOut) {
        return reject(new Error('Processing timeout (15 minutes)'));
      }

      // Check exit code
      if (code !== 0) {
        const msg = stderr.slice(-500) || `Python exited with code ${code}`;
        return reject(new Error(msg));
      }

      // Check for JSON result
      if (!lastJson) {
        return reject(new Error('Python completed but no JSON output'));
      }

      // Check for error in JSON
      if (lastJson.error) {
        return reject(new Error(lastJson.error));
      }

      // Success
      resolve(lastJson);
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(
        `Failed to start Python: ${err.message}. ` +
        `Check PYTHON_EXEC=${pythonPath} in .env`
      ));
    });
  });
}

export default { spawnPythonProcess };
