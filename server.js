const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// 👉 Kết nối MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
  // useNewUrlParser: true,
  // useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected to foodDelivery'))
.catch(err => console.log('❌ DB connection error:', err));

// 👉 Định nghĩa Schema & Model cho từng collection
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String
}, { collection: 'user' });

const DessertSchema = new mongoose.Schema({
  name: String,
  price: Number,
  image: String
}, { collection: 'dessert' });

const User = mongoose.model('User', UserSchema);
const Dessert = mongoose.model('Dessert', DessertSchema);

// 👉 Các route API
app.get('/', (req, res) => {
  res.send('🚀 Backend is running!');
});

app.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/desserts', async (req, res) => {
  try {
    const desserts = await Dessert.find();
    res.json(desserts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 👉 Chạy server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
