import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolvePythonPath() {
  if (process.env.PYTHON_PATH) {
    return process.env.PYTHON_PATH;
  }
  return path.join(__dirname, '../../venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
}

export function runYOLODetection(videoPath, outputPath) {
  return new Promise((resolve, reject) => {
    const pythonPath = path.join(__dirname, '../../venv/Scripts/python.exe');
    const scriptPath = path.join(__dirname, '../../src/crowd_detection/testSimple.py');

    const args = ['--video', videoPath, '--output', outputPath, '--json'];
    const python = spawn(pythonPath, [scriptPath, ...args]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log(`Python: ${data}`);
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error(`Python error: ${data}`);
    });

    python.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python exited with code ${code}: ${stderr}`));
      } else {
        try {
          // Extract JSON from stdout (filter out PRO TIP and other messages)
          const jsonMatch = stdout.match(/\{[^{}]*"totalPeople"[^{}]*\}/);

          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            resolve(result);
          } else {
            console.error('No JSON found in output:', stdout);
            // Fallback
            resolve({
              totalPeople: 0,
              avgPeoplePerFrame: 0,
              totalFrames: 0,
              maxPeople: 0,
              riskLevel: 'UNKNOWN'
            });
          }
        } catch (e) {
          console.error('Failed to parse JSON output from Python:', e);
          // Fallback
          resolve({
            totalPeople: 0,
            avgPeoplePerFrame: 0,
            totalFrames: 0,
            maxPeople: 0,
            riskLevel: 'UNKNOWN'
          });
        }
      }
    });
  });
}
