const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = "mongodb+srv://letorres1554:Luis1554!123@cluster0.srch1ac.mongodb.net/hyrox?retryWrites=true&w=majority&appName=Cluster0";

    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Atlas conectado correctamente`);
  } catch (error) {
    console.error('❌ Error al conectar a MongoDB Atlas:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
