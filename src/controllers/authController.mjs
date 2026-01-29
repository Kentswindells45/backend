import Joi from "joi";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.mjs";
import { logAuditEvent } from "../utils/auditLogger.mjs";

export const register = async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().min(2).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    phone: Joi.string(),
    address: Joi.string(),
    role: Joi.string()
      .valid("admin", "teacher", "student", "parent")
      .default("student"),
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  const { name, email, password, phone, address, role } = value;
  const exists = await User.findOne({ email });
  if (exists) {
    await logAuditEvent(
      null,
      "REGISTER",
      "User",
      `Attempted to register with email ${email} (already exists)`,
      req.ip || req.connection?.remoteAddress,
      req.get && req.get("user-agent"),
      "failed",
      { email }
    );
    return res.status(409).json({ message: "Email already in use" });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hash,
    role,
    phone,
    address,
  });

  await logAuditEvent(
    user._id,
    "REGISTER",
    "User",
    `User ${name} (${email}) registered as ${role}`,
    req.ip || req.connection?.remoteAddress,
    req.get && req.get("user-agent"),
    "success",
    { userId: user._id, name, email, role }
  );

  res.status(201).json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    phone: user.phone,
    address: user.address,
  });
};

export const login = async (req, res) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  const { email, password } = value;
  const user = await User.findOne({ email });
  if (!user) {
    await logAuditEvent(
      null,
      "LOGIN",
      "User",
      `Failed login attempt with email ${email} (user not found)`,
      req.ip || req.connection?.remoteAddress,
      req.get && req.get("user-agent"),
      "failed",
      { email }
    );
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    await logAuditEvent(
      null,
      "LOGIN",
      "User",
      `Failed login attempt with email ${email} (invalid password)`,
      req.ip || req.connection?.remoteAddress,
      req.get && req.get("user-agent"),
      "failed",
      { email }
    );
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // Record login
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('user-agent') || '';
  user.recordLogin(ipAddress, userAgent);
  await user.save();

  await logAuditEvent(
    user._id,
    "LOGIN",
    "User",
    `User ${user.name} (${user.email}) logged in`,
    ipAddress,
    userAgent,
    "success",
    { userId: user._id, email: user.email, role: user.role }
  );

  const payload = { sub: user._id, role: user.role, email: user.email };
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

  res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      phone: user.phone,
      address: user.address,
    },
  });
};

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      phone: user.phone,
      address: user.address,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching user" });
  }
};

export const updateProfile = async (req, res) => {
  const schema = Joi.object({
    name: Joi.string().min(2),
    phone: Joi.string(),
    address: Joi.string(),
    avatar: Joi.string(),
  });
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  try {
    const user = await User.findByIdAndUpdate(req.user.id, value, {
      new: true,
    }).select("-password");
    
    await logAuditEvent(
      req.user.id,
      "UPDATE_PROFILE",
      "User",
      `User ${user.name} (${user.email}) updated profile`,
      req.ip || req.connection?.remoteAddress,
      req.get && req.get("user-agent"),
      "success",
      { userId: user._id }
    );
    
    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      phone: user.phone,
      address: user.address,
    });
  } catch (error) {
    await logAuditEvent(
      req.user.id,
      "UPDATE_PROFILE",
      "User",
      `Failed to update profile: ${error.message}`,
      req.ip || req.connection?.remoteAddress,
      req.get && req.get("user-agent"),
      "failed",
      { error: error.message }
    );
    res.status(500).json({ message: "Error updating profile" });
  }
};
