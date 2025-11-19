import mongoose from 'mongoose';

const feeSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  feeType: { 
    type: String, 
    enum: ['tuition', 'transport', 'uniform', 'books', 'activities', 'hostel', 'other'], 
    required: true 
  },
  amount: { type: Number, required: true, min: 0 },
  dueDate: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'paid', 'overdue', 'partial'], 
    default: 'pending' 
  },
  paidAmount: { type: Number, default: 0, min: 0 },
  paidDate: Date,
  notes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Auto-calculate status based on dueDate and paidAmount
feeSchema.pre('save', function(next) {
  if (this.paidAmount >= this.amount) {
    this.status = 'paid';
    this.paidDate = new Date();
  } else if (this.paidAmount > 0) {
    this.status = 'partial';
  } else if (new Date() > this.dueDate) {
    this.status = 'overdue';
  } else {
    this.status = 'pending';
  }
  this.updatedAt = new Date();
  next();
});

const Fee = mongoose.model('Fee', feeSchema);
export default Fee;
