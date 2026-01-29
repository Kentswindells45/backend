import express from "express";
import adminController from "../controllers/adminController.mjs";

const router = express.Router();

router.get("/top-teacher", adminController.getTopTeacher);
router.get("/pending-tasks", adminController.getPendingTasks);
router.get("/health", adminController.getSystemHealth);
router.post("/tasks/:id/complete", adminController.completeTask);
router.post("/tasks/:id/assign", adminController.assignTask);
router.post("/teachers/:id/feature", adminController.featureTeacher);

// User management routes
router.get("/users", adminController.getAllUsers);
router.post("/users", adminController.createUser);
router.get("/users/:id/last-login", adminController.getLastLogin);
router.patch("/users/:id/status", adminController.updateUserStatus);
router.post("/users/:id/reset-password", adminController.resetUserPassword);
router.delete("/users/:id", adminController.deleteUser);

// Login history routes
router.get("/login-history", adminController.getLoginHistory);
router.get("/login-stats", adminController.getLoginStats);

// Audit logging routes
router.get("/audit-logs", adminController.getAuditLogs);
router.get("/audit-summary", adminController.getAuditSummary);

// Report routes
router.get("/reports/students", adminController.getStudentReport);
router.get("/reports/teachers", adminController.getTeacherReport);
router.get("/reports/classes", adminController.getClassesReport);
router.get("/reports/fees", adminController.getFeesReport);
router.get("/reports/users", adminController.getUsersReport);
router.get("/reports/audit", adminController.getAuditReport);
router.get("/reports/system", adminController.getSystemReport);

// PDF download route
router.post("/reports/download-pdf", adminController.downloadReportPDF);

export default router;
