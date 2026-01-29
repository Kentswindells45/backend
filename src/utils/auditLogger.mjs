import AuditLog from "../models/AuditLog.mjs";
import User from "../models/User.mjs";

export const logAuditEvent = async (
  userId,
  action,
  resource,
  description,
  ipAddress,
  userAgent,
  status = "success",
  details = null
) => {
  try {
    const user = userId ? await User.findById(userId) : null;
    await AuditLog.create({
      userId,
      userEmail: user?.email,
      userName: user?.name,
      action,
      resource,
      description,
      ipAddress,
      userAgent,
      status,
      details,
    });
  } catch (err) {
    console.error("Failed to log audit event:", err);
  }
};
