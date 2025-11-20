import express from 'express';
import adminController from '../controllers/adminController.mjs';

const router = express.Router();

router.get('/top-teacher', adminController.getTopTeacher);
router.get('/pending-tasks', adminController.getPendingTasks);
router.get('/health', adminController.getSystemHealth);
router.post('/tasks/:id/complete', adminController.completeTask);
router.post('/tasks/:id/assign', adminController.assignTask);
router.post('/teachers/:id/feature', adminController.featureTeacher);

export default router;
