import express from 'express';
import { createTeacher, listTeachers, getTeacher, updateTeacher, deleteTeacher } from '../controllers/teacherController.mjs';
import { authorize, requireRole } from '../middleware/auth.mjs';

const router = express.Router();
router.get('/', authorize, requireRole(['admin', 'teacher']), listTeachers);
router.post('/', authorize, requireRole(['admin']), createTeacher);
router.get('/:id', authorize, requireRole(['admin', 'teacher']), getTeacher);
router.put('/:id', authorize, requireRole(['admin']), updateTeacher);
router.delete('/:id', authorize, requireRole(['admin']), deleteTeacher);
export default router;
