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
  id: { type: String, required: true },
  fullName: { type: String, required: true },
  address: { type: String },
  phone: { type: String },
  cart: [
    {
      item: { type: String, required: true },   // id dessert
      quantity: { 
        type: Number, 
        required: true, 
        min: [1, 'Quantity must be at least 1'] 
      },
    },
  ],
  username: { type: String, required: true },
  password: { type: String, required: true },
  favorite: [{ type: String }],
  payment: { type: String }, 
  image: {type: String}
}, { collection: 'users' });

// 🍰 DESSERT SCHEMA
const ReviewSchema = new mongoose.Schema({
  idUser: String,
  content: String,
  rating: Number,
  date: String
});

const DessertSchema = new mongoose.Schema({
  id: { type: String, required: true },
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
  review: [ReviewSchema] 
}, { collection: 'desserts' });

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

// 📄 READ One User by id (U001, U007, …)
app.get('/users/:id', async (req, res) => {
  try {
    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✏️ UPDATE User by id
app.put('/users/:id', async (req, res) => {
  try {
    const updatedUser = await User.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true }
    );
    if (!updatedUser) return res.status(404).json({ message: 'User not found' });
    res.json({ message: '✅ User updated', user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ❌ DELETE User by id
app.delete('/users/:id', async (req, res) => {
  try {
    const deletedUser = await User.findOneAndDelete({ id: req.params.id });
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

// 📄 READ One Dessert by id (D001, D039, …)
app.get('/desserts/:id', async (req, res) => {
  try {
    const dessert = await Dessert.findOne({ id: req.params.id });
    if (!dessert) return res.status(404).json({ message: 'Dessert not found' });
    res.json(dessert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✏️ UPDATE Dessert by id
app.put('/desserts/:id', async (req, res) => {
  try {
    const updatedDessert = await Dessert.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true }
    );
    if (!updatedDessert) return res.status(404).json({ message: 'Dessert not found' });
    res.json({ message: '✅ Dessert updated', dessert: updatedDessert });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ❌ DELETE Dessert by id
app.delete('/desserts/:id', async (req, res) => {
  try {
    const deletedDessert = await Dessert.findOneAndDelete({ id: req.params.id });
    if (!deletedDessert) return res.status(404).json({ message: 'Dessert not found' });
    res.json({ message: '🗑️ Dessert deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================
// 🛒 CART CRUD
// =============================

// 📄 READ: Lấy giỏ hàng của user
app.get('/users/:id/cart', async (req, res) => {
  try {
    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ➕ CREATE / ADD: Thêm sản phẩm vào giỏ hàng
app.post('/users/:id/cart', async (req, res) => {
  try {
    const { item, quantity } = req.body;
    if (!item || !quantity) {
      return res.status(400).json({ message: 'Item and quantity are required' });
    }

    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const existingItem = user.cart.find(c => c.item === item);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      user.cart.push({ item, quantity });
    }

    await user.save();
    res.json({ message: '✅ Item added to cart', cart: user.cart });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ✏️ UPDATE: Cập nhật số lượng sản phẩm trong giỏ
app.put('/users/:id/cart/:itemId', async (req, res) => {
  try {
    const { quantity } = req.body;
    if (quantity < 0) {
      return res.status(400).json({ message: '❌ Quantity cannot be negative' });
    }

    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const cartItem = user.cart.find(c => c.item === req.params.itemId);
    if (!cartItem) return res.status(404).json({ message: 'Item not found in cart' });

    if (quantity === 0) {
      user.cart = user.cart.filter(c => c.item !== req.params.itemId);
    } else {
      cartItem.quantity = quantity;
    }

    await user.save();
    res.json({ message: '✅ Cart updated', cart: user.cart });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ❌ DELETE: Xóa sản phẩm khỏi giỏ hàng
app.delete('/users/:id/cart/:itemId', async (req, res) => {
  try {
    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.cart = user.cart.filter(c => c.item !== req.params.itemId);
    await user.save();

    res.json({ message: '🗑️ Item removed from cart', cart: user.cart });
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
