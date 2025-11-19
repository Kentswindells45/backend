import express from 'express';
import { createFee, listFees, getFee, updateFee, deleteFee, getStudentFeeSummary } from '../controllers/feeController.mjs';
import { authorize, requireRole } from '../middleware/auth.mjs';

const router = express.Router();

// All fee routes require authentication and admin role
router.get('/', authorize, requireRole(['admin']), listFees);
router.post('/', authorize, requireRole(['admin']), createFee);
router.get('/student/:studentId/summary', authorize, requireRole(['admin', 'teacher']), getStudentFeeSummary);
router.get('/:id', authorize, requireRole(['admin']), getFee);
router.put('/:id', authorize, requireRole(['admin']), updateFee);
router.delete('/:id', authorize, requireRole(['admin']), deleteFee);

export default router;
