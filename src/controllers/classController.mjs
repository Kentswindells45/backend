import Joi from 'joi';
import { logAuditEvent } from "../utils/auditLogger.mjs";
import ClassModel from '../models/Class.mjs';
import Teacher from '../models/Teacher.mjs';
import Student from '../models/Student.mjs';

export const createClass = async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().required(),
    code: Joi.string().required(),
    grade: Joi.string().required(),
    subject: Joi.string().required(),
    teacherId: Joi.string().optional(),
    capacity: Joi.number().min(1).default(30),
    schedule: Joi.array().items(Joi.object({
      day: Joi.string().required(),
      startTime: Joi.string().required(),
      endTime: Joi.string().required()
    })).optional(),
    location: Joi.string().optional()
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  const { name, code, grade, subject, teacherId, capacity, schedule, location } = value;

  // Check if teacher exists if provided
  if (teacherId) {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      await logAuditEvent(
        req.user?.id,
        "CREATE_CLASS",
        "Class",
        `Attempted to create class with teacher ${teacherId} (not found)`,
        req.ip || req.connection?.remoteAddress,
        req.get && req.get("user-agent"),
        "failed",
        { teacherId }
      );
      return res.status(404).json({ message: 'Teacher not found' });
    }
  }

  // Check if code is unique
  const existingClass = await ClassModel.findOne({ code });
  if (existingClass) {
    await logAuditEvent(
      req.user?.id,
      "CREATE_CLASS",
      "Class",
      `Attempted to create class with code ${code} (already exists)`,
      req.ip || req.connection?.remoteAddress,
      req.get && req.get("user-agent"),
      "failed",
      { code }
    );
    return res.status(409).json({ message: 'Class code already exists' });
  }

  const newClass = await ClassModel.create({
    name,
    code,
    grade,
    subject,
    teacher: teacherId || null,
    capacity,
    schedule: schedule || [],
    location
  });

  await logAuditEvent(
    req.user?.id,
    "CREATE_CLASS",
    "Class",
    `Created class ${name} (${code}) for grade ${grade}`,
    req.ip || req.connection?.remoteAddress,
    req.get && req.get("user-agent"),
    "success",
    { classId: newClass._id, name, code, grade }
  );
  res.status(201).json(newClass);
};

export const listClasses = async (req, res) => {
  const { status = 'active', grade, subject, teacherId } = req.query;

  let query = {};
  if (status !== 'all') query.status = status;
  if (grade) query.grade = grade;
  if (subject) query.subject = subject;
  if (teacherId) query.teacher = teacherId;

  const classes = await ClassModel.find(query).populate('teacher', 'user').populate({
    path: 'teacher',
    populate: {
      path: 'user',
      select: 'name email'
    }
  });

  const classesWithCount = await Promise.all(classes.map(async (cls) => {
    const studentCount = await Student.countDocuments({ classAssigned: cls._id });
    return {
      _id: cls._id,
      name: cls.name,
      code: cls.code,
      grade: cls.grade,
      subject: cls.subject,
      teacher: cls.teacher ? {
        _id: cls.teacher._id,
        name: cls.teacher.user.name,
        email: cls.teacher.user.email
      } : null,
      capacity: cls.capacity,
      studentCount,
      schedule: cls.schedule,
      location: cls.location,
      status: cls.status,
      createdAt: cls.createdAt,
      updatedAt: cls.updatedAt
    };
  }));

  res.json(classesWithCount);
};

export const getClass = async (req, res) => {
  const { id } = req.params;
  const cls = await ClassModel.findById(id).populate('teacher', 'user').populate({
    path: 'teacher',
    populate: {
      path: 'user',
      select: 'name email'
    }
  });

  if (!cls) return res.status(404).json({ message: 'Class not found' });

  const studentCount = await Student.countDocuments({ classAssigned: cls._id });

  const formattedClass = {
    _id: cls._id,
    name: cls.name,
    code: cls.code,
    grade: cls.grade,
    subject: cls.subject,
    teacher: cls.teacher ? {
      _id: cls.teacher._id,
      name: cls.teacher.user.name,
      email: cls.teacher.user.email
    } : null,
    capacity: cls.capacity,
    studentCount,
    schedule: cls.schedule,
    location: cls.location,
    status: cls.status,
    createdAt: cls.createdAt,
    updatedAt: cls.updatedAt
  };

  res.json(formattedClass);
};

export const updateClass = async (req, res) => {
  const { id } = req.params;
  const schema = Joi.object({
    name: Joi.string().optional(),
    code: Joi.string().optional(),
    grade: Joi.string().optional(),
    subject: Joi.string().optional(),
    teacherId: Joi.string().optional().allow(null),
    capacity: Joi.number().min(1).optional(),
    schedule: Joi.array().items(Joi.object({
      day: Joi.string().required(),
      startTime: Joi.string().required(),
      endTime: Joi.string().required()
    })).optional(),
    location: Joi.string().optional().allow(''),
    status: Joi.string().valid('active', 'archived').optional()
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  const { name, code, grade, subject, teacherId, capacity, schedule, location, status } = value;

  // Check if teacher exists if provided
  if (teacherId) {
    const teacher = await Teacher.findById(teacherId);
    if (!teacher) {
      await logAuditEvent(
        req.user?.id,
        "UPDATE_CLASS",
        "Class",
        `Attempted to update class with teacher ${teacherId} (not found)`,
        req.ip || req.connection?.remoteAddress,
        req.get && req.get("user-agent"),
        "failed",
        { teacherId }
      );
      return res.status(404).json({ message: 'Teacher not found' });
    }
  }

  // Check if code is unique (excluding current class)
  if (code) {
    const existingClass = await ClassModel.findOne({ code, _id: { $ne: id } });
    if (existingClass) {
      await logAuditEvent(
        req.user?.id,
        "UPDATE_CLASS",
        "Class",
        `Attempted to update class to code ${code} (already exists)`,
        req.ip || req.connection?.remoteAddress,
        req.get && req.get("user-agent"),
        "failed",
        { code }
      );
      return res.status(409).json({ message: 'Class code already exists' });
    }
  }

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (code !== undefined) updateData.code = code;
  if (grade !== undefined) updateData.grade = grade;
  if (subject !== undefined) updateData.subject = subject;
  if (teacherId !== undefined) updateData.teacher = teacherId || null;
  if (capacity !== undefined) updateData.capacity = capacity;
  if (schedule !== undefined) updateData.schedule = schedule;
  if (location !== undefined) updateData.location = location;
  if (status !== undefined) updateData.status = status;

  const updatedClass = await ClassModel.findByIdAndUpdate(id, updateData, { new: true })
    .populate('teacher', 'user')
    .populate({
      path: 'teacher',
      populate: {
        path: 'user',
        select: 'name email'
      }
    });

  if (!updatedClass) {
    await logAuditEvent(
      req.user?.id,
      "UPDATE_CLASS",
      "Class",
      `Attempted to update class ${id} (not found)` ,
      req.ip || req.connection?.remoteAddress,
      req.get && req.get("user-agent"),
      "failed",
      { classId: id }
    );
    return res.status(404).json({ message: 'Class not found' });
  }

  const studentCount = await Student.countDocuments({ classAssigned: updatedClass._id });

  await logAuditEvent(
    req.user?.id,
    "UPDATE_CLASS",
    "Class",
    `Updated class ${updatedClass.name} (${updatedClass.code})` ,
    req.ip || req.connection?.remoteAddress,
    req.get && req.get("user-agent"),
    "success",
    { classId: updatedClass._id, name: updatedClass.name, code: updatedClass.code }
  );

  const formattedClass = {
    _id: updatedClass._id,
    name: updatedClass.name,
    code: updatedClass.code,
    grade: updatedClass.grade,
    subject: updatedClass.subject,
    teacher: updatedClass.teacher ? {
      _id: updatedClass.teacher._id,
      name: updatedClass.teacher.user.name,
      email: updatedClass.teacher.user.email
    } : null,
    capacity: updatedClass.capacity,
    studentCount,
    schedule: updatedClass.schedule,
    location: updatedClass.location,
    status: updatedClass.status,
    createdAt: updatedClass.createdAt,
    updatedAt: updatedClass.updatedAt
  };

  res.json(formattedClass);
};

export const deleteClass = async (req, res) => {
  const { id } = req.params;
  const deletedClass = await ClassModel.findByIdAndDelete(id);
  if (!deletedClass) {
    await logAuditEvent(
      req.user?.id,
      "DELETE_CLASS",
      "Class",
      `Attempted to delete class ${id} (not found)` ,
      req.ip || req.connection?.remoteAddress,
      req.get && req.get("user-agent"),
      "failed",
      { classId: id }
    );
    return res.status(404).json({ message: 'Class not found' });
  }
  await logAuditEvent(
    req.user?.id,
    "DELETE_CLASS",
    "Class",
    `Deleted class ${deletedClass.name} (${deletedClass.code})` ,
    req.ip || req.connection?.remoteAddress,
    req.get && req.get("user-agent"),
    "success",
    { classId: deletedClass._id, name: deletedClass.name, code: deletedClass.code }
  );
  res.json({ message: 'Class deleted successfully' });
};