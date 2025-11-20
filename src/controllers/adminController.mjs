import Teacher from '../models/Teacher.mjs';
import User from '../models/User.mjs';
import Fee from '../models/Fee.mjs';
import mongoose from 'mongoose';

// GET /api/admin/top-teacher
export const getTopTeacher = async (req, res) => {
  try {
    // Find a teacher and populate user profile. Prefer one with subjects.
    let teacher = await Teacher.findOne().populate('user').lean();
    if (!teacher) {
      return res.json({ name: 'Ms. Ama Mensah', email: 'ama.mensah@school.edu', phone: null, subject: 'Mathematics', classes: [] });
    }
    const result = {
      name: teacher.user?.name || teacher.user?.email || 'Teacher',
      email: teacher.user?.email,
      phone: teacher.user?.phone || null,
      subject: (teacher.subjects && teacher.subjects[0]) || null,
      classes: [],
      avatar: teacher.user?.avatar || null,
    };
    return res.json(result);
  } catch (err) {
    console.error('getTopTeacher err', err);
    res.status(500).json({ message: 'Failed to fetch top teacher' });
  }
};

// GET /api/admin/pending-tasks
export const getPendingTasks = async (req, res) => {
  try {
    // Use Fee model as source of pending/overdue tasks
    const fees = await Fee.find({ status: { $in: ['pending', 'overdue'] } }).limit(10).populate({ path: 'student', populate: { path: 'user' } }).lean();
    const tasks = fees.map((f) => ({
      id: f._id,
      title: `Pending fee: ${f.feeType}`,
      summary: `${f.student?.user?.name || 'Student'} · ${f.student?.className || ''} · ₵${f.amount}`,
      link: `/fees/${f._id}`,
      type: 'fee',
      createdAt: f.createdAt,
    }));

    // If there are few tasks, add a couple of placeholder admin tasks
    if (tasks.length < 5) {
      tasks.push({ title: 'Approve Announcement', summary: 'Pending site announcement approval', link: '/announcements', type: 'approval' });
    }

    return res.json(tasks);
  } catch (err) {
    console.error('getPendingTasks err', err);
    res.status(500).json({ message: 'Failed to fetch pending tasks' });
  }
};

// GET /api/admin/health
export const getSystemHealth = async (req, res) => {
  try {
    const readyState = mongoose.connection.readyState; // 1 == connected
    const dbConnected = readyState === 1;
    const uptimeSeconds = process.uptime();
    const uptime = `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`;
    return res.json({ status: dbConnected ? 'ok' : 'degraded', dbConnected, uptime });
  } catch (err) {
    console.error('getSystemHealth err', err);
    res.status(500).json({ status: 'error' });
  }
};

export default {
  getTopTeacher,
  getPendingTasks,
  getSystemHealth,
};
