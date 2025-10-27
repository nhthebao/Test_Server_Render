const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// ============================================
// 🔗 Kết nối MongoDB Atlas
// ============================================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected to foodDelivery'))
  .catch(err => console.log('❌ DB connection error:', err));

// ============================================
// 🧩 Định nghĩa Schema & Model
// ============================================

// 👤 USER SCHEMA
const UserSchema = new mongoose.Schema({
  id: { type: String, required: true }, // Mã người dùng (vd: U001)
  fullName: { type: String, required: true },
  address: { type: String },
  phone: { type: String },
  cart: [{ type: String }], // Danh sách ID món ăn
  username: { type: String, required: true },
  password: { type: String, required: true },
  favorite: [{ type: String }], // Danh sách ID dessert yêu thích
  payment: { type: String } // momo, cash, etc.
}, { collection: 'user' });

// 🍰 DESSERT SCHEMA
const ReviewSchema = new mongoose.Schema({
  idUser: String,
  content: String,
  rating: Number,
  date: String
});

const DessertSchema = new mongoose.Schema({
  id: { type: String, required: true }, // Mã món (vd: D001)
  name: { type: String, required: true },
  rating: { type: Number, default: 0 },
  price: { type: Number, required: true },
  category: { type: String },
  discount: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },
  deliveryTime: { type: String },
  image: { type: String },
  description: { type: String },
  freeDelivery: { type: Boolean, default: false },
  review: [ReviewSchema] // Danh sách review chi tiết
}, { collection: 'dessert' });

const User = mongoose.model('User', UserSchema);
const Dessert = mongoose.model('Dessert', DessertSchema);

// ============================================
// 🌐 ROUTES
// ============================================

// 🏠 Kiểm tra server
app.get('/', (req, res) => {
  res.send('🚀 Backend is running!');
});


// =============================
// 👤 USERS CRUD
// =============================

// ➕ CREATE User
app.post('/users', async (req, res) => {
  try {
    const newUser = new User(req.body);
    await newUser.save();
    res.status(201).json({ message: '✅ User created successfully', user: newUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📄 READ All Users
app.get('/users', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✏️ UPDATE User by ID (MongoDB _id)
app.put('/users/:id', async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedUser) return res.status(404).json({ message: 'User not found' });
    res.json({ message: '✅ User updated', user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ❌ DELETE User by ID
app.delete('/users/:id', async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);
    if (!deletedUser) return res.status(404).json({ message: 'User not found' });
    res.json({ message: '🗑️ User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// =============================
// 🍰 DESSERTS CRUD
// =============================

// ➕ CREATE Dessert
app.post('/desserts', async (req, res) => {
  try {
    const newDessert = new Dessert(req.body);
    await newDessert.save();
    res.status(201).json({ message: '✅ Dessert created successfully', dessert: newDessert });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📄 READ All Desserts
app.get('/desserts', async (req, res) => {
  try {
    const desserts = await Dessert.find();
    res.json(desserts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✏️ UPDATE Dessert by ID
app.put('/desserts/:id', async (req, res) => {
  try {
    const updatedDessert = await Dessert.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedDessert) return res.status(404).json({ message: 'Dessert not found' });
    res.json({ message: '✅ Dessert updated', dessert: updatedDessert });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ❌ DELETE Dessert by ID
app.delete('/desserts/:id', async (req, res) => {
  try {
    const deletedDessert = await Dessert.findByIdAndDelete(req.params.id);
    if (!deletedDessert) return res.status(404).json({ message: 'Dessert not found' });
    res.json({ message: '🗑️ Dessert deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ============================================
// ⚙️ RUN SERVER
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
