import pool from '../config/db.js';
import logger from '../utils/logger.js';

export async function getOverview(_req, res, next) {
  try {
    const [
      activePersonsResult,
      totalVideosResult,
      completedVideosResult,
      totalPeopleResult,
      criticalAlertsResult,
      foundPersonsResult,
      faceMatchesResult
    ] = await Promise.all([
      pool.query(
        "SELECT COUNT(*)::int AS count FROM missing_persons WHERE status = 'ACTIVE'"
      ),
      pool.query(
        'SELECT COUNT(*)::int AS count FROM video_jobs'
      ),
      pool.query(
        "SELECT COUNT(*)::int AS count FROM video_jobs WHERE status = 'COMPLETED'"
      ),
      pool.query(
        "SELECT COALESCE(SUM(total_people), 0)::int AS count FROM video_jobs WHERE status = 'COMPLETED'"
      ),
      pool.query(
        "SELECT COUNT(*)::int AS count FROM alert_logs WHERE risk_level = 'CRITICAL' AND timestamp > NOW() - INTERVAL '24 hours'"
      ),
      pool.query(
        "SELECT COUNT(*)::int AS count FROM missing_persons WHERE status = 'FOUND'"
      ),
      pool.query(
        'SELECT COUNT(*)::int AS count FROM face_matches'
      )
    ]);

    return res.json({
      activePersons: activePersonsResult.rows[0]?.count ?? 0,
      totalVideos: totalVideosResult.rows[0]?.count ?? 0,
      completedVideos: completedVideosResult.rows[0]?.count ?? 0,
      totalPeopleDetected: totalPeopleResult.rows[0]?.count ?? 0,
      criticalAlertsToday: criticalAlertsResult.rows[0]?.count ?? 0,
      foundPersons: foundPersonsResult.rows[0]?.count ?? 0,
      totalFaceMatches: faceMatchesResult.rows[0]?.count ?? 0
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
