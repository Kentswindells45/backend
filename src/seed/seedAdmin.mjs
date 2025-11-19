import dotenv from 'dotenv';
dotenv.config();
import connectDB from '../config/db.mjs';
import User from '../models/User.mjs';
import bcrypt from 'bcryptjs';

const demoUsers = [
  { name: 'Admin User', email: 'admin@school.com', password: 'admin123', role: 'admin', phone: '+1234567890', address: '123 Admin St, School City' },
  { name: 'Sarah Williams', email: 'teacher@school.com', password: 'teacher123', role: 'teacher', phone: '+1234567891', address: '456 Teacher Ave, School City' },
  { name: 'Alice Johnson', email: 'student@school.com', password: 'student123', role: 'student', phone: '+1234567892', address: '789 Student Rd, School City' },
  { name: 'Robert Johnson', email: 'parent@school.com', password: 'parent123', role: 'parent', phone: '+1234567893', address: '789 Student Rd, School City' },
];

const seed = async () => {
  try {
    await connectDB(process.env.MONGO_URI);
    
    for (const user of demoUsers) {
      const exists = await User.findOne({ email: user.email });
      if (exists) {
        console.log(`User ${user.email} already exists`);
        continue;
      }
      
      const hash = await bcrypt.hash(user.password, 10);
      const createdUser = await User.create({ ...user, password: hash });
      console.log(`${user.role.charAt(0).toUpperCase() + user.role.slice(1)} created:`, createdUser.email);
    }
    
    console.log('Seeding completed!');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
};

seed();