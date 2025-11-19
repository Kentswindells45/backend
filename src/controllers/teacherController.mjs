import Joi from 'joi';
import Teacher from '../models/Teacher.mjs';
import User from '../models/User.mjs';
import bcrypt from 'bcryptjs';

export const createTeacher = async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    staffId: Joi.string().required(),
    subjects: Joi.array().items(Joi.string()).optional(),
    qualification: Joi.string().optional(),
    experience: Joi.number().optional(),
    department: Joi.string().optional()
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  
  const { name, email, password, staffId, subjects, qualification, experience, department } = value;
  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ message: 'Email already in use' });
  
  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hash, role: 'teacher' });
  const teacher = await Teacher.create({ 
    user: user._id, 
    staffId, 
    subjects: subjects || [],
    qualification,
    experience,
    department
  });
  
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
    department: t.department
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
    department: teacher.department
  });
};

export const updateTeacher = async (req, res) => {
  const { id } = req.params;
  const schema = Joi.object({
    subjects: Joi.array().items(Joi.string()).optional(),
    qualification: Joi.string().optional(),
    experience: Joi.number().optional(),
    department: Joi.string().optional()
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  
  const teacher = await Teacher.findByIdAndUpdate(id, value, { new: true }).populate('user', 'name email avatar phone');
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
  
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
  if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
  
  // Optionally delete the associated user as well
  await User.findByIdAndDelete(teacher.user);
  
  res.json({ message: 'Teacher deleted successfully' });
};
