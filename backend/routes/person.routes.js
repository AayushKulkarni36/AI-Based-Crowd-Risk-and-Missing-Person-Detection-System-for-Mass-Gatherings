import express from 'express';
import { getAllPersons, addPerson, updatePerson, deletePerson } from '../controllers/person.controller.js';

const router = express.Router();

router.get('/', getAllPersons);
router.post('/', addPerson);
router.put('/:id', updatePerson);
router.delete('/:id', deletePerson);

export default router;
