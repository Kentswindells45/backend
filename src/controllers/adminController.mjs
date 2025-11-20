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
      id: teacher._id,
      name: teacher.user?.name || teacher.user?.email || 'Teacher',
      email: teacher.user?.email,
      phone: teacher.user?.phone || null,
      subject: (teacher.subjects && teacher.subjects[0]) || null,
      classes: [],
      avatar: teacher.user?.avatar || null,
      rating: teacher.rating || 4.6,
      featured: teacher.featured || false,
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

// POST /api/admin/tasks/:id/complete
export const completeTask = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Missing task id' });

    // Try to resolve as a Fee task first
    const fee = await Fee.findById(id);
    if (fee) {
      fee.paidAmount = fee.amount;
      await fee.save();
      return res.json({ success: true, task: { id: fee._id, type: 'fee', status: fee.status } });
    }

    // If not a Fee, return success for non-db tasks (placeholders)
    return res.json({ success: true, message: 'Task completed (placeholder)' });
  } catch (err) {
    console.error('completeTask err', err);
    res.status(500).json({ message: 'Failed to complete task' });
  }
};

// POST /api/admin/tasks/:id/assign
export const assignTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { assigneeId } = req.body;
    if (!id) return res.status(400).json({ message: 'Missing task id' });
    if (!assigneeId) return res.status(400).json({ message: 'Missing assignee id' });

    // For Fee tasks we don't have an assignee field; return a placeholder success
    const fee = await Fee.findById(id);
    if (fee) {
      // store a note in fee.notes to indicate assignment (non-destructive)
      fee.notes = (fee.notes || '') + `\nAssigned to ${assigneeId} by admin`;
      await fee.save();
      return res.json({ success: true, task: { id: fee._id, assignedTo: assigneeId } });
    }

    return res.json({ success: true, message: 'Task assigned (placeholder)' });
  } catch (err) {
    console.error('assignTask err', err);
    res.status(500).json({ message: 'Failed to assign task' });
  }
};

// POST /api/admin/teachers/:id/feature
export const featureTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'Missing teacher id' });
    const teacher = await Teacher.findByIdAndUpdate(id, { featured: true }, { new: true }).populate('user').lean();
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    return res.json({ success: true, teacher });
  } catch (err) {
    console.error('featureTeacher err', err);
    res.status(500).json({ message: 'Failed to feature teacher' });
  }
};

export default {
  getTopTeacher,
  getPendingTasks,
  getSystemHealth,
  completeTask,
  assignTask,
  featureTeacher,
};
