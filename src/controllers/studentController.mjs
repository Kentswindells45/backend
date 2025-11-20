import Joi from "joi";
import Student from "../models/Student.mjs";
import User from "../models/User.mjs";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { generateUniqueStudentCode } from "../utils/codeGenerator.mjs";

export const createStudent = async (req, res) => {
  console.log("Received request body:", JSON.stringify(req.body, null, 2));
  const schema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    admissionNumber: Joi.string().required(),
    studentCode: Joi.string().optional(),
    avatar: Joi.string().optional(),
    dob: Joi.date().optional(),
    dateOfBirth: Joi.date().optional(),
    parentContact: Joi.string().optional(),
    className: Joi.string().optional(),
    classId: Joi.string().optional(),
    section: Joi.string().optional(),
    guardianName: Joi.string().optional(),
    guardianPhone: Joi.string().optional(),
    address: Joi.string().optional(),
    rollNumber: Joi.string().optional(),
    enrollmentDate: Joi.date().optional(),
  }).unknown(true); // Allow unknown fields for forward compatibility
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  const {
    name,
    email,
    password,
    admissionNumber,
    studentCode,
    avatar,
    dob,
    dateOfBirth,
    parentContact,
    className,
    classId,
    section,
    guardianName,
    guardianPhone,
    address,
    rollNumber,
    enrollmentDate,
  } = value;
  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ message: "Email already in use" });
  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hash,
    role: "student",
  });

  // If avatar provided as data URL, save it to public/uploads and set user.avatar
  if (avatar && typeof avatar === "string" && avatar.startsWith("data:")) {
    try {
      const matches = avatar.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        const mime = matches[1];
        const ext = mime.split("/").pop() || "png";
        const buffer = Buffer.from(matches[2], "base64");
        const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
        if (buffer.length > MAX_BYTES) {
          // Remove created user to avoid orphaned records
          try {
            await User.findByIdAndDelete(user._id);
          } catch (e) {
            console.warn("Failed to cleanup user after oversize avatar", e);
          }
          return res.status(413).json({ message: "Avatar too large" });
        }
        const uploadsDir = path.resolve("public", "uploads");
        if (!fs.existsSync(uploadsDir))
          fs.mkdirSync(uploadsDir, { recursive: true });
        const filename = `student-${user._id}.${ext}`;
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, buffer);
        const publicUrl = `${req.protocol}://${req.get(
          "host"
        )}/uploads/${filename}`;
        user.avatar = publicUrl;
        await user.save();
      }
    } catch (err) {
      console.warn("Failed to save avatar:", err);
    }
  }
  const studentPayload = {
    user: user._id,
    admissionNumber,
    dob: dob || dateOfBirth,
    parentContact,
    className: className || classId || "Not Assigned",
    section,
    guardianName,
    guardianPhone,
  };
  // Auto-generate unique student code if not provided
  const finalStudentCode = studentCode || await generateUniqueStudentCode((code) => Student.findOne({ studentCode: code }));
  studentPayload.studentCode = finalStudentCode;
  const student = await Student.create(studentPayload);
  res
    .status(201)
    .json({ studentId: student._id, userId: user._id, user, student });
};

export const listStudents = async (req, res) => {
  const students = await Student.find()
    .populate("user", "name email avatar phone")
    .populate("classAssigned");
  const formattedStudents = students.map((s) => ({
    _id: s._id,
    id: s._id,
    studentCode: s.studentCode,
    name: s.user.name,
    email: s.user.email,
    avatar: s.user.avatar,
    phone: s.user.phone,
    admissionNumber: s.admissionNumber,
    className: s.className,
    section: s.section,
    status: s.status,
    dob: s.dob,
    dateOfBirth: s.dob,
    parentContact: s.parentContact,
    guardianName: s.guardianName,
    guardianPhone: s.guardianPhone,
    address: s.address,
    rollNumber: s.rollNumber,
  }));
  res.json(formattedStudents);
};

export const getStudentByCode = async (req, res) => {
  const { code } = req.params;
  if (!code) return res.status(400).json({ message: "Student code is required" });
  const student = await Student.findOne({ studentCode: code })
    .populate("user", "name email avatar phone")
    .populate("classAssigned");
  if (!student) return res.status(404).json({ message: "Student not found" });
  res.json({
    _id: student._id,
    id: student._id,
    studentCode: student.studentCode,
    name: student.user.name,
    email: student.user.email,
    avatar: student.user.avatar,
    phone: student.user.phone,
    admissionNumber: student.admissionNumber,
    className: student.className,
    section: student.section,
    status: student.status,
    dob: student.dob,
    dateOfBirth: student.dob,
    parentContact: student.parentContact,
    guardianName: student.guardianName,
    guardianPhone: student.guardianPhone,
    address: student.address,
    rollNumber: student.rollNumber,
  });
};

export const getStudent = async (req, res) => {
  const { id } = req.params;
  const student = await Student.findById(id)
    .populate("user", "name email avatar phone")
    .populate("classAssigned");
  if (!student) return res.status(404).json({ message: "Student not found" });
  res.json({
    _id: student._id,
    id: student._id,
    studentCode: student.studentCode,
    name: student.user.name,
    email: student.user.email,
    avatar: student.user.avatar,
    phone: student.user.phone,
    admissionNumber: student.admissionNumber,
    className: student.className,
    section: student.section,
    status: student.status,
    dob: student.dob,
    dateOfBirth: student.dob,
    parentContact: student.parentContact,
    guardianName: student.guardianName,
    guardianPhone: student.guardianPhone,
    address: student.address,
    rollNumber: student.rollNumber,
  });
};

export const updateStudent = async (req, res) => {
  const { id } = req.params;
  const schema = Joi.object({
    className: Joi.string().optional(),
    section: Joi.string().optional(),
    guardianName: Joi.string().optional(),
    guardianPhone: Joi.string().optional(),
    parentContact: Joi.string().optional(),
    address: Joi.string().optional(),
    rollNumber: Joi.string().optional(),
    status: Joi.string().valid("active", "inactive", "graduated").optional(),
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  const student = await Student.findByIdAndUpdate(id, value, {
    new: true,
  }).populate("user", "name email avatar phone");
  if (!student) return res.status(404).json({ message: "Student not found" });

  res.json({
    _id: student._id,
    id: student._id,
    studentCode: student.studentCode,
    name: student.user.name,
    email: student.user.email,
    avatar: student.user.avatar,
    phone: student.user.phone,
    admissionNumber: student.admissionNumber,
    className: student.className,
    section: student.section,
    status: student.status,
    dob: student.dob,
    dateOfBirth: student.dob,
    parentContact: student.parentContact,
    guardianName: student.guardianName,
    guardianPhone: student.guardianPhone,
    address: student.address,
    rollNumber: student.rollNumber,
  });
};

export const deleteStudent = async (req, res) => {
  const { id } = req.params;
  const student = await Student.findByIdAndDelete(id);
  if (!student) return res.status(404).json({ message: "Student not found" });

  // Optionally delete the associated user as well
  await User.findByIdAndDelete(student.user);

  res.json({ message: "Student deleted successfully" });
};
