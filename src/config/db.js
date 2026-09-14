const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/document-automation');
    console.log(`\n📦 MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`\n❌ Error connecting to MongoDB: ${error.message}`);
    process.exit(1); // Exit process with failure
  }
};

module.exports = connectDB;
