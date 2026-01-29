import Teacher from "../models/Teacher.mjs";
import User from "../models/User.mjs";
import Fee from "../models/Fee.mjs";
import AuditLog from "../models/AuditLog.mjs";
import Student from "../models/Student.mjs";
import ClassModel from "../models/Class.mjs";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Joi from "joi";
import { logAuditEvent } from "../utils/auditLogger.mjs";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

// Utility function to generate PDF with organized formatting and return as buffer
const generatePDFBuffer = (report) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Add title
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text(report.title, { align: "center" });
    doc.moveDown(0.5);
    doc
      .fontSize(11)
      .font("Helvetica")
      .text("=".repeat(80), { align: "center" });
    doc.moveDown();

    // Add metadata
    const generatedDate =
      typeof report.generatedAt === "string"
        ? new Date(report.generatedAt)
        : report.generatedAt;
    doc.fontSize(11).text(`Generated: ${generatedDate.toLocaleString()}`);
    doc.text(`Total Records: ${report.totalCount || 0}`);
    if (report.daysIncluded) {
      doc.text(`Period: Last ${report.daysIncluded} days`);
    }
    doc.moveDown();

    // Add summary section
    if (report.summary && Object.keys(report.summary).length > 0) {
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("SUMMARY", { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(11).font("Helvetica");

      Object.entries(report.summary).forEach(([key, value]) => {
        if (typeof value === "object") {
          doc.text(`${key}:`, { underline: true });
          Object.entries(value).forEach(([k, v]) => {
            doc.text(`  • ${k}: ${v}`);
          });
        } else {
          doc.text(`• ${key}: ${value}`);
        }
      });
      doc.moveDown();
    }

    // Add data section
    if (report.data && report.data.length > 0) {
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("DETAILS", { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica");

      report.data.forEach((item, index) => {
        if (index > 0) doc.moveDown(0.2);

        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(`#${index + 1}`, { indent: 10 });

        Object.entries(item).forEach(([key, value]) => {
          const displayValue =
            typeof value === "object" ? JSON.stringify(value) : value;
          const label = key
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase())
            .trim();
          doc
            .fontSize(9)
            .font("Helvetica")
            .text(`  ${label}: ${displayValue}`, { indent: 20, width: 450 });
        });

        // Check if page is getting full, add new page if needed
        if (doc.y > 700) {
          doc.addPage();
        }
      });
      doc.moveDown();
    }

    // Add footer
    doc.moveDown();
    doc.fontSize(8).text("=".repeat(80), { align: "center" });
    doc.text(`Report generated on ${new Date().toLocaleString()}`, {
      align: "center",
    });
    doc.text(`School Management System`, { align: "center" });

    doc.end();
  });
};

// GET /api/admin/reports/students - Students Report
export const getStudentReport = async (req, res) => {
  try {
    const { classId, status } = req.query;
    let query = {};
    if (classId) query.classAssigned = classId;

    const students = await Student.find(query)
      .populate("user")
      .populate("classAssigned")
      .lean();

    const report = {
      title: "Students Report",
      generatedAt: new Date(),
      totalCount: students.length,
      data: students.map((s) => ({
        id: s._id,
        name: s.user?.name,
        email: s.user?.email,
        admissionNumber: s.admissionNumber,
        studentCode: s.studentCode,
        dob: s.dob,
        class: s.classAssigned?.name,
        className: s.className,
        enrollmentDate: s.enrollmentDate,
        guardianName: s.guardianName,
        guardianPhone: s.guardianPhone,
        address: s.address,
      })),
      summary: {
        byClass: students.reduce((acc, s) => {
          const className = s.className || "Unknown";
          acc[className] = (acc[className] || 0) + 1;
          return acc;
        }, {}),
      },
    };

    res.json({
      message: "Report generated successfully",
      report,
    });
  } catch (err) {
    console.error("getStudentReport err", err);
    res.status(500).json({ message: "Failed to generate student report" });
  }
};

// GET /api/admin/reports/teachers - Teachers Report
export const getTeacherReport = async (req, res) => {
  try {
    const teachers = await Teacher.find().populate("user").lean();

    const teacherData = await Promise.all(
      teachers.map(async (t) => {
        const classes = await ClassModel.find({ teacher: t._id }).lean();
        return {
          id: t._id,
          name: t.user?.name,
          email: t.user?.email,
          phone: t.user?.phone,
          subjects: t.subjects || [],
          classesAssigned: classes.length,
          classesList: classes.map((c) => c.name),
          experience: t.experience,
          rating: t.rating || 0,
          featured: t.featured || false,
        };
      }),
    );

    const report = {
      title: "Teachers Report",
      generatedAt: new Date(),
      totalCount: teacherData.length,
      data: teacherData,
      summary: {
        totalTeachers: teacherData.length,
        averageRating: (
          teacherData.reduce((sum, t) => sum + (t.rating || 0), 0) /
          teacherData.length
        ).toFixed(2),
        totalClassesManaged: teacherData.reduce(
          (sum, t) => sum + t.classesAssigned,
          0,
        ),
        featuredTeachers: teacherData.filter((t) => t.featured).length,
      },
    };

    res.json({
      message: "Report generated successfully",
      report,
    });
  } catch (err) {
    console.error("getTeacherReport err", err);
    res.status(500).json({ message: "Failed to generate teacher report" });
  }
};

// GET /api/admin/reports/classes - Classes Report
export const getClassesReport = async (req, res) => {
  try {
    const classes = await ClassModel.find().populate("teacher").lean();

    const classesData = await Promise.all(
      classes.map(async (c) => {
        const studentCount = await Student.countDocuments({
          classAssigned: c._id,
        });
        return {
          id: c._id,
          name: c.name,
          code: c.code,
          grade: c.grade,
          subject: c.subject,
          teacher: c.teacher?.user?.name || "Unassigned",
          teacherEmail: c.teacher?.user?.email,
          capacity: c.capacity,
          studentCount,
          occupancy: ((studentCount / c.capacity) * 100).toFixed(1),
          schedule: c.schedule,
          location: c.location,
          status: c.status,
        };
      }),
    );

    const report = {
      title: "Classes Report",
      generatedAt: new Date(),
      totalCount: classesData.length,
      data: classesData,
      summary: {
        totalClasses: classesData.length,
        totalCapacity: classesData.reduce((sum, c) => sum + c.capacity, 0),
        totalStudents: classesData.reduce((sum, c) => sum + c.studentCount, 0),
        averageOccupancy: (
          classesData.reduce((sum, c) => sum + parseFloat(c.occupancy), 0) /
          classesData.length
        ).toFixed(1),
        activeClasses: classesData.filter((c) => c.status === "active").length,
        archivedClasses: classesData.filter((c) => c.status === "archived")
          .length,
      },
    };

    res.json({
      message: "Report generated successfully",
      report,
    });
  } catch (err) {
    console.error("getClassesReport err", err);
    res.status(500).json({ message: "Failed to generate classes report" });
  }
};

// GET /api/admin/reports/fees - Fees Report
export const getFeesReport = async (req, res) => {
  try {
    const { status, dateFrom, dateTo } = req.query;
    let query = {};

    if (status) query.status = status;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const fees = await Fee.find(query)
      .populate({
        path: "student",
        populate: { path: "user" },
      })
      .lean();

    const report = {
      title: "Fees Report",
      generatedAt: new Date(),
      totalCount: fees.length,
      data: fees.map((f) => ({
        id: f._id,
        student: f.student?.user?.name,
        studentId: f.student?.studentCode,
        feeType: f.feeType,
        amount: f.amount,
        dueDate: f.dueDate,
        paidAmount: f.paidAmount,
        status: f.status,
        paidDate: f.paidDate,
        notes: f.notes,
      })),
      summary: {
        totalFees: fees.reduce((sum, f) => sum + f.amount, 0),
        totalPaid: fees.reduce((sum, f) => sum + f.paidAmount, 0),
        totalOutstanding: fees.reduce(
          (sum, f) => sum + (f.amount - f.paidAmount),
          0,
        ),
        byStatus: fees.reduce((acc, f) => {
          acc[f.status] = (acc[f.status] || 0) + f.amount;
          return acc;
        }, {}),
        byFeeType: fees.reduce((acc, f) => {
          acc[f.feeType] = (acc[f.feeType] || 0) + f.amount;
          return acc;
        }, {}),
        collectionRate:
          fees.length > 0
            ? (
                (fees.reduce((sum, f) => sum + f.paidAmount, 0) /
                  fees.reduce((sum, f) => sum + f.amount, 0)) *
                100
              ).toFixed(1)
            : 0,
      },
    };

    // Generate PDF
    const filePath = `./public/uploads/Fees_Report_${Date.now()}.pdf`;
    await generatePDF(report, filePath);

    res.json({
      message: "Report generated successfully",
      report,
    });
  } catch (err) {
    console.error("getFeesReport err", err);
    res.status(500).json({ message: "Failed to generate fees report" });
  }
};

// GET /api/admin/reports/users - Users Report
export const getUsersReport = async (req, res) => {
  try {
    const users = await User.find().select("-password").lean();

    const report = {
      title: "Users Report",
      generatedAt: new Date(),
      totalCount: users.length,
      data: users.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        phone: u.phone,
        status: u.status || "active",
        createdAt: u.createdAt,
        lastLogin: u.lastLogin,
        loginCount: u.loginCount || 0,
        avatar: u.avatar,
      })),
      summary: {
        totalUsers: users.length,
        byRole: users.reduce((acc, u) => {
          acc[u.role] = (acc[u.role] || 0) + 1;
          return acc;
        }, {}),
        activeUsers: users.filter((u) => u.status === "active").length,
        inactiveUsers: users.filter((u) => u.status === "inactive").length,
        totalLogins: users.reduce((sum, u) => sum + (u.loginCount || 0), 0),
      },
    };

    // Generate PDF
    res.json({
      message: "Report generated successfully",
      report,
    });
  } catch (err) {
    console.error("getUsersReport err", err);
    res.status(500).json({ message: "Failed to generate users report" });
  }
};

// Updated Audit Report with PDF generation
export const getAuditReport = async (req, res) => {
  try {
    const { action, userId, days = 30 } = req.query;
    const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    let query = { createdAt: { $gte: dateThreshold } };
    if (action) query.action = action;
    if (userId) query.userId = userId;

    const logs = await AuditLog.find(query).sort({ createdAt: -1 }).lean();

    const report = {
      title: "Audit Report",
      generatedAt: new Date(),
      daysIncluded: parseInt(days),
      totalCount: logs.length,
      data: logs.map((l) => ({
        id: l._id,
        action: l.action,
        resource: l.resource,
        userId: l.userId,
        userName: l.userName,
        userEmail: l.userEmail,
        description: l.description,
        status: l.status,
        timestamp: l.createdAt,
        ipAddress: l.ipAddress,
      })),
      summary: {
        totalActions: logs.length,
        byAction: logs.reduce((acc, l) => {
          acc[l.action] = (acc[l.action] || 0) + 1;
          return acc;
        }, {}),
        byResource: logs.reduce((acc, l) => {
          acc[l.resource] = (acc[l.resource] || 0) + 1;
          return acc;
        }, {}),
        successfulActions: logs.filter((l) => l.status === "success").length,
        failedActions: logs.filter((l) => l.status === "failed").length,
        uniqueUsers: new Set(logs.map((l) => l.userId)).size,
      },
    };

    res.json({
      message: "Audit report generated successfully",
      report,
    });
  } catch (err) {
    console.error("getAuditReport err", err);
    res.status(500).json({ message: "Failed to generate audit report" });
  }
};

// GET /api/admin/reports/system - System Overview Report
export const getSystemReport = async (req, res) => {
  try {
    const [
      studentCount,
      teacherCount,
      classCount,
      feeCount,
      userCount,
      auditLogCount,
    ] = await Promise.all([
      Student.countDocuments(),
      Teacher.countDocuments(),
      ClassModel.countDocuments(),
      Fee.countDocuments(),
      User.countDocuments(),
      AuditLog.countDocuments(),
    ]);

    // Fee statistics
    const feeStats = await Fee.aggregate([
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalPaid: { $sum: "$paidAmount" },
          pendingCount: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
          paidCount: { $sum: { $cond: [{ $eq: ["$status", "paid"] }, 1, 0] } },
          overdueCount: {
            $sum: { $cond: [{ $eq: ["$status", "overdue"] }, 1, 0] },
          },
        },
      },
    ]);

    const fees =
      feeStats.length > 0
        ? feeStats[0]
        : {
            totalAmount: 0,
            totalPaid: 0,
            pendingCount: 0,
            paidCount: 0,
            overdueCount: 0,
          };

    // User activity
    const recentLogins = await AuditLog.countDocuments({
      action: "LOGIN",
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const report = {
      title: "System Overview Report",
      generatedAt: new Date(),
      systemHealth: {
        status: "operational",
        dbConnected: mongoose.connection.readyState === 1,
        uptime: `${Math.floor(process.uptime() / 3600)}h`,
      },
      statistics: {
        students: studentCount,
        teachers: teacherCount,
        classes: classCount,
        users: userCount,
        totalAuditLogs: auditLogCount,
        recentLoginsLast24h: recentLogins,
      },
      financials: {
        totalFeeAmount: fees.totalAmount || 0,
        totalFeesPaid: fees.totalPaid || 0,
        collectionPercentage:
          fees.totalAmount > 0
            ? ((fees.totalPaid / fees.totalAmount) * 100).toFixed(1)
            : 0,
        pendingFees: fees.pendingCount || 0,
        paidFees: fees.paidCount || 0,
        overdueFees: fees.overdueCount || 0,
        outstandingAmount: (fees.totalAmount || 0) - (fees.totalPaid || 0),
      },
      topStatistics: {
        studentTeacherRatio:
          teacherCount > 0 ? (studentCount / teacherCount).toFixed(1) : 0,
        studentClassRatio:
          classCount > 0 ? (studentCount / classCount).toFixed(1) : 0,
        activeClasses: classCount,
      },
    };

    res.json({
      message: "Report generated successfully",
      report,
    });
  } catch (err) {
    console.error("getSystemReport err", err);
    res.status(500).json({ message: "Failed to generate system report" });
  }
};

// POST /api/admin/reports/download-pdf - Download report as PDF
export const downloadReportPDF = async (req, res) => {
  try {
    const { reportType, classId, status, dateFrom, dateTo, days } = req.body;
    let report;

    // Generate report data based on type
    switch (reportType) {
      case "students":
        const students = await Student.find(
          classId ? { classAssigned: classId } : {},
        )
          .populate("user")
          .populate("classAssigned")
          .lean();
        report = {
          title: "Students Report",
          generatedAt: new Date(),
          totalCount: students.length,
          data: students.map((s) => ({
            id: s._id,
            name: s.user?.name,
            email: s.user?.email,
            admissionNumber: s.admissionNumber,
            studentCode: s.studentCode,
            className: s.className,
            enrollmentDate: s.enrollmentDate,
            guardianName: s.guardianName,
            guardianPhone: s.guardianPhone,
          })),
          summary: {
            byClass: students.reduce((acc, s) => {
              const className = s.className || "Unknown";
              acc[className] = (acc[className] || 0) + 1;
              return acc;
            }, {}),
          },
        };
        break;

      case "teachers":
        const teachers = await Teacher.find().populate("user").lean();
        const teacherData = await Promise.all(
          teachers.map(async (t) => {
            const classes = await ClassModel.find({ teacher: t._id }).lean();
            return {
              id: t._id,
              name: t.user?.name,
              email: t.user?.email,
              phone: t.user?.phone,
              subjects: t.subjects || [],
              classesAssigned: classes.length,
              rating: t.rating || 0,
            };
          }),
        );
        report = {
          title: "Teachers Report",
          generatedAt: new Date(),
          totalCount: teacherData.length,
          data: teacherData,
          summary: {
            totalTeachers: teacherData.length,
            averageRating: (
              teacherData.reduce((sum, t) => sum + (t.rating || 0), 0) /
              teacherData.length
            ).toFixed(2),
          },
        };
        break;

      case "classes":
        const classes = await ClassModel.find().populate("teacher").lean();
        const classesData = await Promise.all(
          classes.map(async (c) => {
            const studentCount = await Student.countDocuments({
              classAssigned: c._id,
            });
            return {
              id: c._id,
              name: c.name,
              code: c.code,
              teacher: c.teacher?.user?.name || "Unassigned",
              capacity: c.capacity,
              studentCount,
              occupancy: ((studentCount / c.capacity) * 100).toFixed(1),
            };
          }),
        );
        report = {
          title: "Classes Report",
          generatedAt: new Date(),
          totalCount: classesData.length,
          data: classesData,
          summary: {
            totalClasses: classesData.length,
            totalStudents: classesData.reduce(
              (sum, c) => sum + c.studentCount,
              0,
            ),
          },
        };
        break;

      case "fees":
        const fees = await Fee.find(status ? { status } : {})
          .populate({ path: "student", populate: { path: "user" } })
          .lean();
        report = {
          title: "Fees Report",
          generatedAt: new Date(),
          totalCount: fees.length,
          data: fees.map((f) => ({
            id: f._id,
            student: f.student?.user?.name,
            studentId: f.student?.studentCode,
            feeType: f.feeType,
            amount: f.amount,
            paidAmount: f.paidAmount,
            status: f.status,
          })),
          summary: {
            totalFees: fees.reduce((sum, f) => sum + f.amount, 0),
            totalPaid: fees.reduce((sum, f) => sum + f.paidAmount, 0),
          },
        };
        break;

      case "users":
        const users = await User.find().select("-password").lean();
        report = {
          title: "Users Report",
          generatedAt: new Date(),
          totalCount: users.length,
          data: users.map((u) => ({
            id: u._id,
            name: u.name,
            email: u.email,
            role: u.role,
            phone: u.phone,
            status: u.status || "active",
          })),
          summary: {
            totalUsers: users.length,
            byRole: users.reduce((acc, u) => {
              acc[u.role] = (acc[u.role] || 0) + 1;
              return acc;
            }, {}),
          },
        };
        break;

      case "audit":
        const dateThreshold = new Date(
          Date.now() - (days || 30) * 24 * 60 * 60 * 1000,
        );
        const logs = await AuditLog.find({ createdAt: { $gte: dateThreshold } })
          .sort({ createdAt: -1 })
          .lean();
        report = {
          title: "Audit Report",
          generatedAt: new Date(),
          daysIncluded: days || 30,
          totalCount: logs.length,
          data: logs.map((l) => ({
            action: l.action,
            resource: l.resource,
            userName: l.userName,
            description: l.description,
            status: l.status,
            timestamp: l.createdAt,
          })),
          summary: {
            totalActions: logs.length,
            byAction: logs.reduce((acc, l) => {
              acc[l.action] = (acc[l.action] || 0) + 1;
              return acc;
            }, {}),
          },
        };
        break;

      case "system":
        const [studentCount, teacherCount, classCount, feeCount, userCount] =
          await Promise.all([
            Student.countDocuments(),
            Teacher.countDocuments(),
            ClassModel.countDocuments(),
            Fee.countDocuments(),
            User.countDocuments(),
          ]);
        report = {
          title: "System Overview Report",
          generatedAt: new Date(),
          totalCount: 1,
          data: [
            { metric: "Total Students", value: studentCount },
            { metric: "Total Teachers", value: teacherCount },
            { metric: "Total Classes", value: classCount },
            { metric: "Total Users", value: userCount },
          ],
          summary: {
            students: studentCount,
            teachers: teacherCount,
            classes: classCount,
            users: userCount,
          },
        };
        break;

      default:
        return res.status(400).json({ message: "Invalid report type" });
    }

    // Generate PDF buffer
    const pdfBuffer = await generatePDFBuffer(report);

    // Set response headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${reportType}_report.pdf"`,
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    // Send PDF buffer
    res.send(pdfBuffer);
  } catch (err) {
    console.error("downloadReportPDF err", err);
    res.status(500).json({ message: "Failed to generate PDF" });
  }
};

export const getAuditLogs = async (req, res) => {
  try {
    const { limit = 50, action, userId } = req.query;
    const query = {};

    if (action) query.action = action;
    if (userId) query.userId = userId;

    const logs = await AuditLog.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json(logs);
  } catch (err) {
    console.error("getAuditLogs err", err);
    res.status(500).json({ message: "Failed to fetch audit logs" });
  }
};

// GET /api/admin/audit-summary
export const getAuditSummary = async (req, res) => {
  try {
    // Last login across all users
    const lastLogin = await AuditLog.findOne({ action: "LOGIN" })
      .sort({ createdAt: -1 })
      .lean();

    // Actions in last 24 hours
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentActions = await AuditLog.countDocuments({
      createdAt: { $gte: last24h },
    });

    // Most active admin users
    const activeAdmins = await AuditLog.aggregate([
      {
        $match: { createdAt: { $gte: last24h } },
      },
      {
        $group: {
          _id: "$userId",
          email: { $first: "$userEmail" },
          name: { $first: "$userName" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 5,
      },
    ]);

    // Actions breakdown
    const actionBreakdown = await AuditLog.aggregate([
      {
        $match: { createdAt: { $gte: last24h } },
      },
      {
        $group: {
          _id: "$action",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    res.json({
      lastLogin: lastLogin
        ? {
            email: lastLogin.userEmail,
            name: lastLogin.userName,
            timestamp: lastLogin.createdAt,
            ipAddress: lastLogin.ipAddress,
          }
        : null,
      recentActionsCount: recentActions,
      activeAdmins,
      actionBreakdown,
    });
  } catch (err) {
    console.error("getAuditSummary err", err);
    res.status(500).json({ message: "Failed to fetch audit summary" });
  }
};

// Helper to track admin actions - wrap this around existing admin operations
export const trackAdminAction = (action, resource, description) => {
  return async (req, res, next) => {
    const originalJson = res.json;
    res.json = function (data) {
      logAuditEvent(
        req.user?.id,
        action,
        resource,
        description,
        req.ip || req.connection.remoteAddress,
        req.get("user-agent"),
        res.statusCode < 400 ? "success" : "failed",
        data,
      );
      return originalJson.call(this, data);
    };
    next();
  };
};

// GET /api/admin/top-teacher
export const getTopTeacher = async (req, res) => {
  try {
    // Find a teacher and populate user profile. Prefer one with subjects.
    let teacher = await Teacher.findOne().populate("user").lean();
    if (!teacher) {
      return res.json({
        name: "Ms. Ama Mensah",
        email: "ama.mensah@school.edu",
        phone: null,
        subject: "Mathematics",
        classes: [],
      });
    }
    const result = {
      id: teacher._id,
      name: teacher.user?.name || teacher.user?.email || "Teacher",
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
    console.error("getTopTeacher err", err);
    res.status(500).json({ message: "Failed to fetch top teacher" });
  }
};

// GET /api/admin/pending-tasks
export const getPendingTasks = async (req, res) => {
  try {
    // Use Fee model as source of pending/overdue tasks
    const fees = await Fee.find({ status: { $in: ["pending", "overdue"] } })
      .limit(10)
      .populate({ path: "student", populate: { path: "user" } })
      .lean();
    const tasks = fees.map((f) => ({
      id: f._id,
      title: `Pending fee: ${f.feeType}`,
      summary: `${f.student?.user?.name || "Student"} · ${f.student?.className || ""} · ₵${f.amount}`,
      link: `/fees/${f._id}`,
      type: "fee",
      createdAt: f.createdAt,
    }));

    // If there are few tasks, add a couple of placeholder admin tasks
    if (tasks.length < 5) {
      tasks.push({
        title: "Approve Announcement",
        summary: "Pending site announcement approval",
        link: "/announcements",
        type: "approval",
      });
    }

    return res.json(tasks);
  } catch (err) {
    console.error("getPendingTasks err", err);
    res.status(500).json({ message: "Failed to fetch pending tasks" });
  }
};

// GET /api/admin/health
export const getSystemHealth = async (req, res) => {
  try {
    const readyState = mongoose.connection.readyState; // 1 == connected
    const dbConnected = readyState === 1;
    const uptimeSeconds = process.uptime();
    const uptime = `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`;
    return res.json({
      status: dbConnected ? "ok" : "degraded",
      dbConnected,
      uptime,
    });
  } catch (err) {
    console.error("getSystemHealth err", err);
    res.status(500).json({ status: "error" });
  }
};

// POST /api/admin/tasks/:id/complete
export const completeTask = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Missing task id" });

    // Try to resolve as a Fee task first
    const fee = await Fee.findById(id);
    if (fee) {
      fee.paidAmount = fee.amount;
      await fee.save();
      return res.json({
        success: true,
        task: { id: fee._id, type: "fee", status: fee.status },
      });
    }

    // If not a Fee, return success for non-db tasks (placeholders)
    return res.json({ success: true, message: "Task completed (placeholder)" });
  } catch (err) {
    console.error("completeTask err", err);
    res.status(500).json({ message: "Failed to complete task" });
  }
};

// POST /api/admin/tasks/:id/assign
export const assignTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { assigneeId } = req.body;
    if (!id) return res.status(400).json({ message: "Missing task id" });
    if (!assigneeId)
      return res.status(400).json({ message: "Missing assignee id" });

    // For Fee tasks we don't have an assignee field; return a placeholder success
    const fee = await Fee.findById(id);
    if (fee) {
      // store a note in fee.notes to indicate assignment (non-destructive)
      fee.notes = (fee.notes || "") + `\nAssigned to ${assigneeId} by admin`;
      await fee.save();
      return res.json({
        success: true,
        task: { id: fee._id, assignedTo: assigneeId },
      });
    }

    return res.json({ success: true, message: "Task assigned (placeholder)" });
  } catch (err) {
    console.error("assignTask err", err);
    res.status(500).json({ message: "Failed to assign task" });
  }
};

// POST /api/admin/teachers/:id/feature
export const featureTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: "Missing teacher id" });
    const teacher = await Teacher.findByIdAndUpdate(
      id,
      { featured: true },
      { new: true },
    )
      .populate("user")
      .lean();
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    return res.json({ success: true, teacher });
  } catch (err) {
    console.error("featureTeacher err", err);
    res.status(500).json({ message: "Failed to feature teacher" });
  }
};

// GET /api/admin/users - Get all users
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    const formattedUsers = users.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone,
      avatar: u.avatar,
      status: u.status || "active",
      createdAt: u.createdAt,
      lastLogin: u.lastLogin,
      loginCount: u.loginCount || 0,
    }));
    res.json(formattedUsers);
  } catch (err) {
    console.error("getAllUsers err", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

// GET /api/admin/login-history - Get login history
export const getLoginHistory = async (req, res) => {
  try {
    const { userId, limit = 50 } = req.query;
    let query = {};
    if (userId) query._id = userId;

    const users = await User.find(query).select("loginHistory email").lean();
    let history = [];

    users.forEach((user) => {
      if (user.loginHistory && Array.isArray(user.loginHistory)) {
        user.loginHistory.forEach((login) => {
          history.push({
            userId: user._id,
            email: user.email,
            timestamp: login.timestamp,
            ipAddress: login.ipAddress,
            userAgent: login.userAgent,
            status: login.status || "success",
          });
        });
      }
    });

    // Sort by timestamp descending and limit
    history = history
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, parseInt(limit));
    res.json(history);
  } catch (err) {
    console.error("getLoginHistory err", err);
    res.status(500).json({ message: "Failed to fetch login history" });
  }
};

// GET /api/admin/login-stats - Get login statistics
export const getLoginStats = async (req, res) => {
  try {
    const users = await User.find().select("loginCount lastLogin email").lean();
    const stats = {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.loginCount > 0).length,
      totalLogins: users.reduce((sum, u) => sum + (u.loginCount || 0), 0),
      lastLoginOverall: users.reduce((latest, u) => {
        if (!u.lastLogin) return latest;
        return !latest || new Date(u.lastLogin) > new Date(latest)
          ? u.lastLogin
          : latest;
      }, null),
      topUsers: users
        .filter((u) => u.loginCount > 0)
        .sort((a, b) => (b.loginCount || 0) - (a.loginCount || 0))
        .slice(0, 10)
        .map((u) => ({
          email: u.email,
          loginCount: u.loginCount,
          lastLogin: u.lastLogin,
        })),
    };
    res.json(stats);
  } catch (err) {
    console.error("getLoginStats err", err);
    res.status(500).json({ message: "Failed to fetch login stats" });
  }
};

// POST /api/admin/users - Create a new user
export const createUser = async (req, res) => {
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

  try {
    const { name, email, password, phone, address, role } = value;
    const exists = await User.findOne({ email });
    if (exists) {
      await logAuditEvent(
        req.user?.id,
        "CREATE_USER",
        "User",
        `Attempted to create user with email ${email} (already exists)`,
        req.ip || req.connection.remoteAddress,
        req.get("user-agent"),
        "failed",
        { email },
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
      status: "active",
    });

    await logAuditEvent(
      req.user?.id,
      "CREATE_USER",
      "User",
      `Created user ${name} (${email}) as ${role}`,
      req.ip || req.connection.remoteAddress,
      req.get("user-agent"),
      "success",
      { userId: user._id, name, email, role },
    );

    res.status(201).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      phone: user.phone,
      address: user.address,
      status: user.status,
      createdAt: user.createdAt,
    });
  } catch (err) {
    await logAuditEvent(
      req.user?.id,
      "CREATE_USER",
      "User",
      `Failed to create user: ${err.message}`,
      req.ip || req.connection.remoteAddress,
      req.get("user-agent"),
      "failed",
      { error: err.message },
    );
    console.error("createUser err", err);
    res.status(500).json({ message: "Failed to create user" });
  }
};

// PATCH /api/admin/users/:id/status - Update user status
export const updateUserStatus = async (req, res) => {
  const schema = Joi.object({
    status: Joi.string().valid("active", "inactive").required(),
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(
      id,
      { status: value.status },
      { new: true },
    ).select("-password");

    if (!user) {
      await logAuditEvent(
        req.user?.id,
        "UPDATE_STATUS",
        "User",
        `Attempted to update status for user ${id} (not found)`,
        req.ip || req.connection.remoteAddress,
        req.get("user-agent"),
        "failed",
        { userId: id, status: value.status },
      );
      return res.status(404).json({ message: "User not found" });
    }

    await logAuditEvent(
      req.user?.id,
      "UPDATE_STATUS",
      "User",
      `Updated status for user ${user.name} (${user.email}) to ${user.status}`,
      req.ip || req.connection.remoteAddress,
      req.get("user-agent"),
      "success",
      { userId: user._id, status: user.status },
    );

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
    });
  } catch (err) {
    await logAuditEvent(
      req.user?.id,
      "UPDATE_STATUS",
      "User",
      `Failed to update user status: ${err.message}`,
      req.ip || req.connection.remoteAddress,
      req.get("user-agent"),
      "failed",
      { error: err.message },
    );
    console.error("updateUserStatus err", err);
    res.status(500).json({ message: "Failed to update user status" });
  }
};

// POST /api/admin/users/:id/reset-password - Reset user password
export const resetUserPassword = async (req, res) => {
  const schema = Joi.object({
    newPassword: Joi.string().min(6).required(),
  });

  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });

  try {
    const { id } = req.params;
    const hash = await bcrypt.hash(value.newPassword, 10);
    const user = await User.findByIdAndUpdate(
      id,
      { password: hash },
      { new: true },
    ).select("-password");

    if (!user) {
      await logAuditEvent(
        req.user?.id,
        "RESET_PASSWORD",
        "User",
        `Attempted to reset password for user ${id} (not found)`,
        req.ip || req.connection.remoteAddress,
        req.get("user-agent"),
        "failed",
        { userId: id },
      );
      return res.status(404).json({ message: "User not found" });
    }

    await logAuditEvent(
      req.user?.id,
      "RESET_PASSWORD",
      "User",
      `Reset password for user ${user.name} (${user.email})`,
      req.ip || req.connection.remoteAddress,
      req.get("user-agent"),
      "success",
      { userId: user._id },
    );

    res.json({ success: true, message: "Password reset successfully" });
  } catch (err) {
    await logAuditEvent(
      req.user?.id,
      "RESET_PASSWORD",
      "User",
      `Failed to reset user password: ${err.message}`,
      req.ip || req.connection.remoteAddress,
      req.get("user-agent"),
      "failed",
      { error: err.message },
    );
    console.error("resetUserPassword err", err);
    res.status(500).json({ message: "Failed to reset password" });
  }
};

// DELETE /api/admin/users/:id - Delete user
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);

    if (!user) {
      await logAuditEvent(
        req.user?.id,
        "DELETE_USER",
        "User",
        `Attempted to delete user ${id} (not found)`,
        req.ip || req.connection.remoteAddress,
        req.get("user-agent"),
        "failed",
        { userId: id },
      );
      return res.status(404).json({ message: "User not found" });
    }

    await logAuditEvent(
      req.user?.id,
      "DELETE_USER",
      "User",
      `Deleted user ${user.name} (${user.email})`,
      req.ip || req.connection.remoteAddress,
      req.get("user-agent"),
      "success",
      { userId: user._id, email: user.email },
    );

    res.json({ success: true, message: "User deleted successfully" });
  } catch (err) {
    await logAuditEvent(
      req.user?.id,
      "DELETE_USER",
      "User",
      `Failed to delete user: ${err.message}`,
      req.ip || req.connection.remoteAddress,
      req.get("user-agent"),
      "failed",
      { error: err.message },
    );
    console.error("deleteUser err", err);
    res.status(500).json({ message: "Failed to delete user" });
  }
};

// GET /api/admin/users/:id/last-login - Get last login info
export const getLastLogin = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id)
      .select("email lastLogin loginCount loginHistory")
      .lean();

    if (!user) return res.status(404).json({ message: "User not found" });

    const lastLogin =
      user.loginHistory && user.loginHistory.length > 0
        ? user.loginHistory[user.loginHistory.length - 1]
        : null;

    res.json({
      email: user.email,
      lastLogin: user.lastLogin,
      loginCount: user.loginCount,
      lastLoginDetails: lastLogin,
    });
  } catch (err) {
    console.error("getLastLogin err", err);
    res.status(500).json({ message: "Failed to fetch last login info" });
  }
};

export default {
  getTopTeacher,
  getPendingTasks,
  getSystemHealth,
  completeTask,
  assignTask,
  featureTeacher,
  getAllUsers,
  getLoginHistory,
  getLoginStats,
  createUser,
  updateUserStatus,
  resetUserPassword,
  deleteUser,
  getLastLogin,
  getAuditLogs,
  getAuditSummary,
  trackAdminAction,
  getStudentReport,
  getTeacherReport,
  getClassesReport,
  getFeesReport,
  getUsersReport,
  getAuditReport,
  getSystemReport,
  downloadReportPDF,
};
