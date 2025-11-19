import express from 'express';
import { register, login, getCurrentUser, updateProfile } from '../controllers/authController.mjs';
import { authorize } from '../middleware/auth.mjs';

const router = express.Router();
router.post('/register', register);
router.post('/login', login);
router.get('/me', authorize, getCurrentUser);
router.patch('/profile', authorize, updateProfile);
export default router;