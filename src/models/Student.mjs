import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  admissionNumber: { type: String, unique: true, sparse: true },
  studentCode: { type: String, required: true, unique: true, index: true, sparse: true },
  dob: Date,
  parentContact: String,
  classAssigned: { type: mongoose.Schema.Types.ObjectId, ref: "Class" },
  className: String,
  section: String,
  guardianName: String,
  guardianPhone: String,
  address: String,
  rollNumber: String,
  enrollmentDate: Date,
}, { timestamps: true });

const Student = mongoose.model("Student", studentSchema);
export default Student;
