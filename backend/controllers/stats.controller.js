import pool from '../config/db.js';

export async function getOverview(_req, res, next) {
  try {
    const [activePersons, totalDetections, totalAlerts] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM missing_persons WHERE status = 'ACTIVE'"),
      pool.query('SELECT COUNT(*)::int AS count FROM detections'),
      pool.query('SELECT COUNT(*)::int AS count FROM alert_logs')
    ]);

    return res.json({
      activePersons: activePersons.rows[0]?.count || 0,
      totalDetections: totalDetections.rows[0]?.count || 0,
      totalAlerts: totalAlerts.rows[0]?.count || 0
    });
  } catch (error) {
    return next(error);
  }
}

export async function getAlerts(_req, res, next) {
  try {
    const result = await pool.query(
      'SELECT risk_level, COUNT(*)::int AS count FROM alert_logs GROUP BY risk_level'
    );
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
}
