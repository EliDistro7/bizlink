const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not defined in environment variables');

  await mongoose.connect(uri, {
    connectTimeoutMS: 40000,
    socketTimeoutMS: 45000,
  });

  console.log(`MongoDB connected: ${mongoose.connection.host}`);
};

module.exports = connectDB;