import express from "express";
import cors from "cors";
import morgan from "morgan";
import "express-async-errors";
import path from "path";

import authRoutes from "./routes/auth.mjs";
import studentRoutes from "./routes/students.mjs";
import teacherRoutes from "./routes/teachers.mjs";
import feeRoutes from "./routes/fees.mjs";
import aiRoutes from "./routes/ai.mjs";
import adminRoutes from "./routes/admin.mjs";
import errorHandler from "./middleware/errorHandler.mjs";

const app = express();

// Configure CORS to allow cross-origin requests for avatar images
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*", // Allow all origins in development
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
// Increase JSON body size limit to allow base64 avatar uploads (adjust as needed)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(morgan("dev"));

// Serve uploaded files from backend/public/uploads at /uploads
// Add proper headers for image caching and delivery
const publicDir = path.resolve("public");
app.use(
  "/uploads",
  (req, res, next) => {
    // Set proper cache headers for images
    res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
    res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  },
  express.static(path.join(publicDir, "uploads"))
);

app.get("/", (req, res) =>
  res.json({ ok: true, name: "School Management API" })
);

app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/fees", feeRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/admin", adminRoutes);

app.use((req, res) => res.status(404).json({ message: "Endpoint not found" }));
app.use(errorHandler);

export default app;
