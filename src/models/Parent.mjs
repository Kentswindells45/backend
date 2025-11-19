import mongoose from 'mongoose';

const parentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  childIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  guardianType: { type: String, enum: ['mother', 'father', 'guardian'], default: 'guardian' },
  occupation: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const Parent = mongoose.model('Parent', parentSchema);
export default Parent;
