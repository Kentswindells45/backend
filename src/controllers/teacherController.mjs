import Joi from 'joi';
import { logAuditEvent } from "../utils/auditLogger.mjs";
import Teacher from '../models/Teacher.mjs';
import User from '../models/User.mjs';
import bcrypt from 'bcryptjs';

export const createTeacher = async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    avatar: Joi.string().optional(),
    password: Joi.string().min(6).optional(),
    staffId: Joi.string().optional(),
    subjects: Joi.array().items(Joi.string()).optional(),
    qualification: Joi.string().optional(),
    experience: Joi.number().optional(),
    department: Joi.string().optional(),
    salary: Joi.number().optional(),
    classes: Joi.array().items(Joi.string()).optional(),
    phone: Joi.string().optional(),
    address: Joi.string().optional(),
    gender: Joi.string().optional(),
    dateOfBirth: Joi.date().optional()
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  
  let { name, email, password, staffId, subjects, qualification, experience, department, salary, classes } = value;
  const exists = await User.findOne({ email });
  if (exists) {
    await logAuditEvent(
      req.user?.id,
      "CREATE_TEACHER",
      "Teacher",
      `Attempted to create teacher with email ${email} (already exists)`,
      req.ip || req.connection?.remoteAddress,
      req.get && req.get("user-agent"),
      "failed",
      { email }
    );
    return res.status(409).json({ message: 'Email already in use' });
  }
  
  // generate a password if not provided
  if (!password) password = Math.random().toString(36).slice(-8);
  const hash = await bcrypt.hash(password, 10);

  // generate sequential staffId if not provided (format T001)
  if (!staffId) {
    // use an atomic counter in a 'counters' collection
    const db = Teacher.collection.conn.db;
    const res = await db.collection('counters').findOneAndUpdate(
      { _id: 'teacher' },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: 'after' }
    );
    const seq = (res.value && res.value.seq) || 1;
    staffId = `T${String(seq).padStart(3, '0')}`;
  }

  const user = await User.create({ name, email, password: hash, role: 'teacher', phone: value.phone, address: value.address });

  // If avatar provided as data URL, save it to public/uploads and set user.avatar
  if (value.avatar && typeof value.avatar === 'string' && value.avatar.startsWith('data:')) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const matches = value.avatar.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        const mime = matches[1];
        const ext = mime.split('/').pop() || 'png';
        const buffer = Buffer.from(matches[2], 'base64');
        const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
        if (buffer.length <= MAX_BYTES) {
          const uploadsDir = path.resolve('public', 'uploads');
          if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
          const filename = `teacher-${user._id}.${ext}`;
          const filePath = path.join(uploadsDir, filename);
          fs.writeFileSync(filePath, buffer);
          const publicUrl = `${req.protocol}://${req.get('host')}/uploads/${filename}`;
          user.avatar = publicUrl;
          await user.save();
        }
      }
    } catch (err) {
      console.warn('Failed to save teacher avatar:', err);
    }
  } else if (value.avatar) {
    // If avatar is a regular URL, save it directly
    user.avatar = value.avatar;
    await user.save();
  }
  const teacher = await Teacher.create({ 
    user: user._id, 
    staffId, 
    subjects: subjects || [],
    qualification,
    experience,
    department,
    salary,
    classes: classes || [],
    gender: value.gender,
    dateOfBirth: value.dateOfBirth,
    address: value.address
  });
  await logAuditEvent(
    req.user?.id,
    "CREATE_TEACHER",
    "Teacher",
    `Created teacher ${name} (${email})`,
    req.ip || req.connection?.remoteAddress,
    req.get && req.get("user-agent"),
    "success",
    { teacherId: teacher._id, userId: user._id, name, email }
  );
  res.status(201).json({ teacherId: teacher._id, userId: user._id, user, teacher });
};

export const listTeachers = async (req, res) => {
  const teachers = await Teacher.find().populate('user', 'name email avatar phone address');
  const formattedTeachers = teachers.map(t => ({
    _id: t._id,
    name: t.user.name,
    email: t.user.email,
    avatar: t.user.avatar,
    phone: t.user.phone,
    address: t.user.address,
    staffId: t.staffId,
    subjects: t.subjects,
    qualification: t.qualification,
    experience: t.experience,
    department: t.department,
    salary: t.salary,
    classes: t.classes || []
  }));
  res.json(formattedTeachers);
};

export const getTeacher = async (req, res) => {
  const { id } = req.params;
  const teacher = await Teacher.findById(id).populate('user', 'name email avatar phone address');
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
  
  res.json({
    _id: teacher._id,
    name: teacher.user.name,
    email: teacher.user.email,
    avatar: teacher.user.avatar,
    phone: teacher.user.phone,
    address: teacher.user.address,
    staffId: teacher.staffId,
    subjects: teacher.subjects,
    qualification: teacher.qualification,
    experience: teacher.experience,
    department: teacher.department,
    salary: teacher.salary,
    classes: teacher.classes || []
  });
};

export const updateTeacher = async (req, res) => {
  const { id } = req.params;
  const schema = Joi.object({
    subjects: Joi.array().items(Joi.string()).optional(),
    qualification: Joi.string().optional(),
    experience: Joi.number().optional(),
    department: Joi.string().optional(),
    salary: Joi.number().optional(),
    classes: Joi.array().items(Joi.string()).optional()
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  
  const teacher = await Teacher.findByIdAndUpdate(id, value, { new: true }).populate('user', 'name email avatar phone');
  if (!teacher) {
    await logAuditEvent(
      req.user?.id,
      "UPDATE_TEACHER",
      "Teacher",
      `Attempted to update teacher ${id} (not found)`,
      req.ip || req.connection?.remoteAddress,
      req.get && req.get("user-agent"),
      "failed",
      { teacherId: id }
    );
    return res.status(404).json({ message: 'Teacher not found' });
  }
  await logAuditEvent(
    req.user?.id,
    "UPDATE_TEACHER",
    "Teacher",
    `Updated teacher ${teacher.user.name} (${teacher.user.email})`,
    req.ip || req.connection?.remoteAddress,
    req.get && req.get("user-agent"),
    "success",
    { teacherId: teacher._id, name: teacher.user.name, email: teacher.user.email }
  );
  res.json({
    _id: teacher._id,
    name: teacher.user.name,
    email: teacher.user.email,
    avatar: teacher.user.avatar,
    phone: teacher.user.phone,
    staffId: teacher.staffId,
    subjects: teacher.subjects,
    qualification: teacher.qualification,
    experience: teacher.experience,
    department: teacher.department
  });
};

export const deleteTeacher = async (req, res) => {
  const { id } = req.params;
  const teacher = await Teacher.findByIdAndDelete(id);
  if (!teacher) {
    await logAuditEvent(
      req.user?.id,
      "DELETE_TEACHER",
      "Teacher",
      `Attempted to delete teacher ${id} (not found)`,
      req.ip || req.connection?.remoteAddress,
      req.get && req.get("user-agent"),
      "failed",
      { teacherId: id }
    );
    return res.status(404).json({ message: 'Teacher not found' });
  }
  // Optionally delete the associated user as well
  await User.findByIdAndDelete(teacher.user);
  await logAuditEvent(
    req.user?.id,
    "DELETE_TEACHER",
    "Teacher",
    `Deleted teacher ${teacher.user}`,
    req.ip || req.connection?.remoteAddress,
    req.get && req.get("user-agent"),
    "success",
    { teacherId: teacher._id, userId: teacher.user }
  );
  res.json({ message: 'Teacher deleted successfully' });
};
