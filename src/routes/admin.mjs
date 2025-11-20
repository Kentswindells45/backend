import express from 'express';
import adminController from '../controllers/adminController.mjs';

const router = express.Router();

router.get('/top-teacher', adminController.getTopTeacher);
router.get('/pending-tasks', adminController.getPendingTasks);
router.get('/health', adminController.getSystemHealth);

export default router;
