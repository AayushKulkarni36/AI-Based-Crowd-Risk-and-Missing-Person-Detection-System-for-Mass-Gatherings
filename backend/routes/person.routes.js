import express from 'express';
import { imageUpload } from '../middleware/upload.js';
import { getAllPersons, addPerson, updatePerson, deletePerson, registerMissingPerson } from '../controllers/person.controller.js';

const router = express.Router();

// GET /api/persons — list all (non-INACTIVE) persons
router.get('/', getAllPersons);

// POST /api/persons — register new person (with optional photo)
router.post('/', imageUpload.single('photo'), addPerson);

// POST /api/persons/register-missing-person — spec alias
router.post('/register-missing-person', imageUpload.single('photo'), registerMissingPerson);

// PUT /api/persons/:id — update status (e.g. FOUND, ACTIVE)
router.put('/:id', updatePerson);

// DELETE /api/persons/:id — soft delete (sets status=INACTIVE)
router.delete('/:id', deletePerson);

export default router;
