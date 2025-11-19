import express from 'express';
import { createStudent, listStudents, getStudent, updateStudent, deleteStudent } from '../controllers/studentController.mjs';
import { authorize, requireRole } from '../middleware/auth.mjs';

const router = express.Router();
router.get('/', authorize, requireRole(['admin', 'teacher']), listStudents);
router.post('/', authorize, requireRole(['admin', 'teacher']), createStudent);
router.get('/:id', authorize, requireRole(['admin', 'teacher', 'student']), getStudent);
router.put('/:id', authorize, requireRole(['admin', 'teacher']), updateStudent);
router.delete('/:id', authorize, requireRole(['admin', 'teacher']), deleteStudent);
export default router;