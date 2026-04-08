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

export async function getDetectionsToday(_req, res, next) {
  try {
    const result = await pool.query(
      `SELECT
         to_char(timestamp, 'HH24:00') AS time,
         COUNT(*)::int AS value
       FROM alert_logs
       WHERE timestamp::date = CURRENT_DATE
       GROUP BY to_char(timestamp, 'HH24:00')
       ORDER BY to_char(timestamp, 'HH24:00')`
    );

    return res.json({
      success: true,
      points: result.rows
    });
  } catch (error) {
    logger.error('getDetectionsToday failed:', error.message);
    return next(error);
  }
}
