import mongoose from 'mongoose';

const connectDB = async (uri) => {
  if (!uri) throw new Error('MONGO_URI not provided');
  mongoose.set('strictQuery', false);
  await mongoose.connect(uri);
  console.log('MongoDB connected');
};

export default connectDB;