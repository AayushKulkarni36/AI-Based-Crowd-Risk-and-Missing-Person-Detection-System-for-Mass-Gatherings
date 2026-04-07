import express from 'express';
import { imageUpload } from '../middleware/upload.js';
import { getAllPersons, addPerson, updatePerson, deletePerson, registerMissingPerson } from '../controllers/person.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/persons — list all (non-INACTIVE) persons
router.get('/', requireAuth, getAllPersons);

// POST /api/persons — register new person (with optional photo)
router.post('/', requireAdmin, imageUpload.single('photo'), addPerson);

// POST /api/persons/register-missing-person — spec alias
router.post('/register-missing-person', requireAdmin, imageUpload.single('photo'), registerMissingPerson);

// PUT /api/persons/:id — update status (e.g. FOUND, ACTIVE)
router.put('/:id', requireAdmin, updatePerson);

// DELETE /api/persons/:id — soft delete (sets status=INACTIVE)
router.delete('/:id', requireAdmin, deletePerson);

export default router;
