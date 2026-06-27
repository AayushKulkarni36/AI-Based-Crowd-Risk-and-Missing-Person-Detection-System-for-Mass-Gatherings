import pool from '../config/db.js';
import logger from '../utils/logger.js';

export async function getOverview(_req, res, next) {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM missing_persons WHERE status = 'ACTIVE') AS active_persons,
        (SELECT COUNT(*)::int FROM video_jobs) AS total_videos,
        (SELECT COUNT(*)::int FROM video_jobs WHERE status = 'COMPLETED') AS completed_videos,
        (SELECT COALESCE(SUM(total_people), 0)::int FROM video_jobs WHERE status = 'COMPLETED') AS total_people_detected,
        (SELECT COUNT(*)::int FROM alert_logs WHERE risk_level = 'CRITICAL' AND timestamp > NOW() - INTERVAL '24 hours') AS critical_alerts_today,
        (SELECT COUNT(*)::int FROM missing_persons WHERE status = 'FOUND') AS found_persons,
        (SELECT COUNT(*)::int FROM face_matches) AS total_face_matches
    `);
    const row = result.rows[0] || {};

    return res.json({
      activePersons: row.active_persons ?? 0,
      totalVideos: row.total_videos ?? 0,
      completedVideos: row.completed_videos ?? 0,
      totalPeopleDetected: row.total_people_detected ?? 0,
      criticalAlertsToday: row.critical_alerts_today ?? 0,
      foundPersons: row.found_persons ?? 0,
      totalFaceMatches: row.total_face_matches ?? 0
    });
  } catch (error) {
    logger.error('getOverview failed:', error.message);
    return next(error);
  }
}

export async function getAlerts(_req, res, next) {
  try {
    // Return recent alert_log rows with full detail for the Alerts page
    const result = await pool.query(
      `SELECT
        id,
        timestamp AS created_at,
        alert_type,
        risk_level,
        person_count,
        message,
        location,
        image_path
       FROM alert_logs
       ORDER BY timestamp DESC
       LIMIT 50`
    );
    return res.json({ success: true, alerts: result.rows });
  } catch (error) {
    logger.error('getAlerts failed:', error.message);
    return next(error);
  }
}

export async function getDetectionsAllTime(_req, res, next) {
  try {
    // ── Strategy: aggregate from ALL available data sources ───────────────
    // 1. alert_logs — logs every detection event with person_count & timestamp
    // 2. video_jobs — stores total_people per completed job with uploaded_at
    // We UNION both sources to get the fullest possible picture.

    const result = await pool.query(
      `SELECT date, SUM(count)::int AS count
       FROM (
         -- Source 1: alert_logs (person_count per event, grouped by day)
         SELECT
           to_char(timestamp, 'YYYY-MM-DD') AS date,
           COALESCE(person_count, 1)::int AS count
         FROM alert_logs
         WHERE person_count IS NOT NULL AND person_count > 0

         UNION ALL

         -- Source 2: video_jobs completed (total_people per job, grouped by day)
         SELECT
           to_char(uploaded_at, 'YYYY-MM-DD') AS date,
           total_people::int AS count
         FROM video_jobs
         WHERE status = 'COMPLETED'
           AND total_people IS NOT NULL
           AND total_people > 0
       ) AS combined
       GROUP BY date
       ORDER BY date ASC`
    );

    const pointsMap = new Map();
    let minDateStr = null;
    let maxDateStr = null;

    result.rows.forEach(r => {
      pointsMap.set(r.date, r.count);
      if (!minDateStr || r.date < minDateStr) minDateStr = r.date;
      if (!maxDateStr || r.date > maxDateStr) maxDateStr = r.date;
    });

    const points = [];
    if (minDateStr && maxDateStr) {
      let currentDate = new Date(minDateStr + 'T00:00:00Z');
      const endDate = new Date(maxDateStr + 'T00:00:00Z');
      
      // Pad single-date responses by adding the day before
      if (minDateStr === maxDateStr) {
        currentDate.setUTCDate(currentDate.getUTCDate() - 1);
      }

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        points.push({
          time: dateStr,
          value: pointsMap.get(dateStr) || 0
        });
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
      }
    }

    logger.info(`[DetectionsAllTime] Returning ${points.length} data points (padded): ${JSON.stringify(points)}`);

    return res.json({
      success: true,
      points
    });
  } catch (error) {
    logger.error('getDetectionsAllTime failed:', error.message);
    return next(error);
  }
}
