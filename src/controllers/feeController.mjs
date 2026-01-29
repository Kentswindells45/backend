import Joi from 'joi';
import { logAuditEvent } from "../utils/auditLogger.mjs";
import Fee from '../models/Fee.mjs';
import Student from '../models/Student.mjs';

export const createFee = async (req, res) => {
  const schema = Joi.object({
    student: Joi.string().required(),
    feeType: Joi.string().valid('tuition', 'transport', 'uniform', 'books', 'activities', 'hostel', 'other').required(),
    amount: Joi.number().positive().required(),
    dueDate: Joi.date().required(),
    notes: Joi.string().optional(),
  }).unknown(false);

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  try {
    const student = await Student.findById(value.student);
    if (!student) {
      await logAuditEvent(
        req.user?.id,
        "CREATE_FEE",
        "Fee",
        `Attempted to create fee for student ${value.student} (not found)`,
        req.ip || req.connection?.remoteAddress,
        req.get && req.get("user-agent"),
        "failed",
        { studentId: value.student }
      );
      return res.status(404).json({ message: 'Student not found' });
    }

    const fee = await Fee.create({
      student: value.student,
      feeType: value.feeType,
      amount: value.amount,
      dueDate: value.dueDate,
      notes: value.notes,
    });

    await logAuditEvent(
      req.user?.id,
      "CREATE_FEE",
      "Fee",
      `Created fee for student ${student._id} (${student.user})`,
      req.ip || req.connection?.remoteAddress,
      req.get && req.get("user-agent"),
      "success",
      { feeId: fee._id, studentId: student._id }
    );

    res.status(201).json(fee);
  } catch (err) {
    await logAuditEvent(
      req.user?.id,
      "CREATE_FEE",
      "Fee",
      `Failed to create fee: ${err.message}`,
      req.ip || req.connection?.remoteAddress,
      req.get && req.get("user-agent"),
      "failed",
      { error: err.message }
    );
    res.status(400).json({ message: err.message });
  }
};

export const listFees = async (req, res) => {
  const { studentId, status } = req.query;
  const filter = {};
  if (studentId) filter.student = studentId;
  if (status) filter.status = status;

  try {
    const fees = await Fee.find(filter)
      .populate('student', 'user')
      .sort({ dueDate: -1 });

    const formatted = fees.map(f => ({
      _id: f._id,
      studentId: f.student._id,
      studentName: f.student.user?.name || 'N/A',
      feeType: f.feeType,
      amount: f.amount,
      dueDate: f.dueDate,
      status: f.status,
      paidAmount: f.paidAmount,
      paidDate: f.paidDate,
      notes: f.notes,
    }));

    res.json(formatted);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const getFee = async (req, res) => {
  const { id } = req.params;

  try {
    const fee = await Fee.findById(id).populate('student');
    if (!fee) return res.status(404).json({ message: 'Fee not found' });
    res.json(fee);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const updateFee = async (req, res) => {
  const { id } = req.params;
  const schema = Joi.object({
    feeType: Joi.string().valid('tuition', 'transport', 'uniform', 'books', 'activities', 'hostel', 'other').optional(),
    amount: Joi.number().positive().optional(),
    dueDate: Joi.date().optional(),
    paidAmount: Joi.number().min(0).optional(),
    status: Joi.string().valid('pending', 'paid', 'overdue', 'partial').optional(),
    notes: Joi.string().optional(),
  }).unknown(false);

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  try {
    const fee = await Fee.findByIdAndUpdate(id, value, { new: true });
    if (!fee) {
      await logAuditEvent(
        req.user?.id,
        "UPDATE_FEE",
        "Fee",
        `Attempted to update fee ${id} (not found)`,
        req.ip || req.connection?.remoteAddress,
        req.get && req.get("user-agent"),
        "failed",
        { feeId: id }
      );
      return res.status(404).json({ message: 'Fee not found' });
    }
    await logAuditEvent(
      req.user?.id,
      "UPDATE_FEE",
      "Fee",
      `Updated fee ${fee._id}`,
      req.ip || req.connection?.remoteAddress,
      req.get && req.get("user-agent"),
      "success",
      { feeId: fee._id }
    );
    res.json(fee);
  } catch (err) {
    await logAuditEvent(
      req.user?.id,
      "UPDATE_FEE",
      "Fee",
      `Failed to update fee: ${err.message}`,
      req.ip || req.connection?.remoteAddress,
      req.get && req.get("user-agent"),
      "failed",
      { error: err.message }
    );
    res.status(400).json({ message: err.message });
  }
};

export const deleteFee = async (req, res) => {
  const { id } = req.params;

  try {
    const fee = await Fee.findByIdAndDelete(id);
    if (!fee) {
      await logAuditEvent(
        req.user?.id,
        "DELETE_FEE",
        "Fee",
        `Attempted to delete fee ${id} (not found)`,
        req.ip || req.connection?.remoteAddress,
        req.get && req.get("user-agent"),
        "failed",
        { feeId: id }
      );
      return res.status(404).json({ message: 'Fee not found' });
    }
    await logAuditEvent(
      req.user?.id,
      "DELETE_FEE",
      "Fee",
      `Deleted fee ${fee._id}`,
      req.ip || req.connection?.remoteAddress,
      req.get && req.get("user-agent"),
      "success",
      { feeId: fee._id }
    );
    res.json({ message: 'Fee deleted successfully' });
  } catch (err) {
    await logAuditEvent(
      req.user?.id,
      "DELETE_FEE",
      "Fee",
      `Failed to delete fee: ${err.message}`,
      req.ip || req.connection?.remoteAddress,
      req.get && req.get("user-agent"),
      "failed",
      { error: err.message }
    );
    res.status(400).json({ message: err.message });
  }
};

// Get fee summary for a student
export const getStudentFeeSummary = async (req, res) => {
  const { studentId } = req.params;

  try {
    const fees = await Fee.find({ student: studentId });
    const summary = {
      total: fees.reduce((sum, f) => sum + f.amount, 0),
      paid: fees.reduce((sum, f) => sum + f.paidAmount, 0),
      pending: fees.filter(f => f.status === 'pending').reduce((sum, f) => sum + (f.amount - f.paidAmount), 0),
      overdue: fees.filter(f => f.status === 'overdue').reduce((sum, f) => sum + (f.amount - f.paidAmount), 0),
    };
    res.json(summary);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
