import pool from '../config/db.js';

export async function getAllPersons(_req, res, next) {
  try {
    const result = await pool.query('SELECT * FROM missing_persons ORDER BY reported_date DESC');
    return res.json(result.rows);
  } catch (error) {
    return next(error);
  }
}

export async function addPerson(req, res, next) {
  try {
    const { name, age, gender, description, last_seen_location, contact_info } = req.body;

    const result = await pool.query(
      `INSERT INTO missing_persons (name, age, gender, description, last_seen_location, contact_info, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
       RETURNING *`,
      [name, age, gender, description, last_seen_location, contact_info]
    );

    return res.status(201).json({ success: true, person: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function updatePerson(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      'UPDATE missing_persons SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Person not found' });
    }

    return res.json({ success: true, person: result.rows[0] });
  } catch (error) {
    return next(error);
  }
}

export async function deletePerson(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM missing_persons WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'Person not found' });
    }

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
}
