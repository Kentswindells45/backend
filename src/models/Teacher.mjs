import mongoose from 'mongoose';

const teacherSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  staffId: { type: String, unique: true },
  subjects: [String]
  ,
  featured: { type: Boolean, default: false }
});

const Teacher = mongoose.model('Teacher', teacherSchema);
export default Teacher;