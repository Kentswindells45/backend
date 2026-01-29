import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    userEmail: String,
    userName: String,
    action: {
      type: String,
      enum: [
        "LOGIN",
        "LOGOUT",
        "REGISTER",
        "UPDATE_PROFILE",
        "CREATE_USER",
        "UPDATE_USER",
        "DELETE_USER",
        "RESET_PASSWORD",
        "UPDATE_STATUS",
        "VIEW_USERS",
        "VIEW_LOGIN_HISTORY",
        "EXPORT_DATA",
        "CLEAR_CACHE",
        "CHANGE_SETTINGS",
        "VIEW_DASHBOARD",
        "CREATE_STUDENT",
        "UPDATE_STUDENT",
        "DELETE_STUDENT",
        "CREATE_TEACHER",
        "UPDATE_TEACHER",
        "DELETE_TEACHER",
        "CREATE_CLASS",
        "UPDATE_CLASS",
        "DELETE_CLASS",
        "CREATE_FEE",
        "UPDATE_FEE",
        "DELETE_FEE",
      ],
      required: true,
    },
    resource: String, // What was affected (e.g., user ID, resource name)
    description: String, // Detailed description
    ipAddress: String,
    userAgent: String,
    status: {
      type: String,
      enum: ["success", "failed"],
      default: "success",
    },
    details: mongoose.Schema.Types.Mixed, // Additional data
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
