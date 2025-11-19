import mongoose from 'mongoose';

const classSchema = new mongoose.Schema({
  name: { type: String, required: true },
  level: String,
  teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' }
});

const ClassModel = mongoose.model('Class', classSchema);
export default ClassModel;