import mongoose from "mongoose";

const loginHistorySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  ipAddress: { type: String },
  userAgent: { type: String },
  status: { type: String, enum: ["success", "failed"], default: "success" },
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["admin", "teacher", "student", "parent"],
    default: "student",
  },
  avatar: { type: String },
  phone: { type: String },
  address: { type: String },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  loginHistory: [loginHistorySchema],
  lastLogin: { type: Date },
  loginCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Add method to record login
userSchema.methods.recordLogin = function(ipAddress, userAgent) {
  this.loginHistory.push({
    timestamp: new Date(),
    ipAddress,
    userAgent,
    status: "success",
  });
  this.lastLogin = new Date();
  this.loginCount = (this.loginCount || 0) + 1;
  // Keep only last 100 logins
  if (this.loginHistory.length > 100) {
    this.loginHistory = this.loginHistory.slice(-100);
  }
};

const User = mongoose.model("User", userSchema);
export default User;
