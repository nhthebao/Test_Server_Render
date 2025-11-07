const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const admin = require("./firebase");
const jwt = require("jsonwebtoken");
const { verifyToken } = require("./middlewares/auth");

const app = express();
app.use(express.json());
app.use(cors());

// ============================================
// KẾT NỐI MONGODB ATLAS
// ============================================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected to foodDelivery"))
  .catch((err) => console.log("❌ DB connection error:", err));

// ============================================
// SCHEMA & MODEL
// ============================================

const UserSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    fullName: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    phone: { type: String },
    address: { type: String },
    authProvider: { type: String, default: "firebase" },
    paymentMethod: { type: String, default: "momo" },
    image: {
      type: String,
      default:
        "https://res.cloudinary.com/dxx0dqmn8/image/upload/v1761622331/default_user_avatar.png",
    },
    favorite: [{ type: String }],
    cart: [
      {
        item: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    createdAt: { type: String },
    updatedAt: { type: String },
  },
  { collection: "users" }
);

const ReviewSchema = new mongoose.Schema({
  idUser: String,
  content: String,
  rating: Number,
  date: String,
});

const DessertSchema = new mongoose.Schema(
  {
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
    review: [ReviewSchema],
  },
  { collection: "desserts" }
);

const User = mongoose.model("User", UserSchema);
const Dessert = mongoose.model("Dessert", DessertSchema);

// ============================================
// ROUTES
// ============================================

app.get("/", (req, res) => {
  res.send("🚀 Backend connected with Firebase Auth!");
});

// ============================================
// AUTH ROUTES
// ============================================

// 🟢 LOGIN or REGISTER (qua Firebase)
app.post("/auth/login", async (req, res) => {
  try {
    const { firebaseToken } = req.body;
    if (!firebaseToken)
      return res.status(400).json({ message: "❌ Missing Firebase token" });

    // ✅ Xác minh token bằng Firebase Admin SDK
    const decoded = await admin.auth().verifyIdToken(firebaseToken);
    const { uid, email, name, picture, phone_number } = decoded;

    // 🔍 Tìm user trong MongoDB
    let user = await User.findOne({ id: uid });

    // 🟢 Nếu chưa có → tạo mới
    if (!user) {
      user = new User({
        id: uid,
        fullName: name || "No name",
        username: email?.split("@")[0] || uid,
        email: email || "noemail@firebase.com",
        phone: phone_number || "",
        image: picture || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await user.save();
    }

    // 🧾 Tạo JWT riêng cho backend (hạn 7 ngày)
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "✅ Firebase login success",
      token,
      user,
    });
  } catch (err) {
    console.error("Auth error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Lấy thông tin user hiện tại
app.get("/auth/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LOGOUT (tùy chọn)
app.post("/auth/logout", verifyToken, async (req, res) => {
  try {
    // Tùy chọn: bạn có thể lưu token đã bị revoke vào DB nếu cần
    res.json({ message: "✅ Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cập nhật profile user
app.put("/auth/update-profile", verifyToken, async (req, res) => {
  try {
    const updated = await User.findOneAndUpdate(
      { id: req.user.id },
      { ...req.body, updatedAt: new Date().toISOString() },
      { new: true }
    );
    res.json({ message: "✅ Profile updated", user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Xóa tài khoản
app.delete("/auth/delete", verifyToken, async (req, res) => {
  try {
    const user = await User.findOneAndDelete({ id: req.user.id });
    if (!user) return res.status(404).json({ message: "User not found" });

    // ❗ Xóa luôn trong Firebase
    await admin.auth().deleteUser(req.user.id);

    res.json({ message: "🗑️ Account deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Refresh JWT token
app.post("/auth/refresh-token", verifyToken, (req, res) => {
  const newToken = jwt.sign(
    { id: req.user.id, username: req.user.username },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  res.json({ token: newToken });
});

// Đặt lại mật khẩu (qua Firebase)
app.post("/auth/password/reset", async (req, res) => {
  const { firebaseToken, newPassword } = req.body;
  const decoded = await admin.auth().verifyIdToken(firebaseToken);
  const uid = decoded.uid;

  const hashed = await bcrypt.hash(newPassword, 10);
  await User.findOneAndUpdate({ id: uid }, { password: hashed });
  res.json({ message: "✅ Password updated" });
});

// =============================
// USER CRUD (để tạm thời quản lý user)
// =============================

app.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================
// DESSERTS CRUD
// =============================

app.post("/desserts", async (req, res) => {
  try {
    const newDessert = new Dessert(req.body);
    await newDessert.save();
    res.status(201).json({
      message: "✅ Dessert created successfully",
      dessert: newDessert,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/desserts", async (req, res) => {
  try {
    const desserts = await Dessert.find();
    res.json(desserts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/desserts/:id", async (req, res) => {
  try {
    const dessert = await Dessert.findOne({ id: req.params.id });
    if (!dessert) return res.status(404).json({ message: "Dessert not found" });
    res.json(dessert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/desserts/:id", async (req, res) => {
  try {
    const updatedDessert = await Dessert.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true }
    );
    if (!updatedDessert)
      return res.status(404).json({ message: "Dessert not found" });
    res.json({ message: "✅ Dessert updated", dessert: updatedDessert });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/desserts/:id", async (req, res) => {
  try {
    const deletedDessert = await Dessert.findOneAndDelete({
      id: req.params.id,
    });
    if (!deletedDessert)
      return res.status(404).json({ message: "Dessert not found" });
    res.json({ message: "🗑️ Dessert deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================
// CART CRUD
// =============================

app.get("/users/:id/cart", async (req, res) => {
  try {
    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user.cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/users/:id/cart", async (req, res) => {
  try {
    const { item, quantity } = req.body;
    if (!item || !quantity)
      return res
        .status(400)
        .json({ message: "Item and quantity are required" });

    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ message: "User not found" });

    const existingItem = user.cart.find((c) => c.item === item);
    if (existingItem) existingItem.quantity += quantity;
    else user.cart.push({ item, quantity });

    await user.save();
    res.json({ message: "✅ Item added to cart", cart: user.cart });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/users/:id/cart/:itemId", async (req, res) => {
  try {
    const { quantity } = req.body;
    if (quantity < 0)
      return res
        .status(400)
        .json({ message: "❌ Quantity cannot be negative" });

    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ message: "User not found" });

    const cartItem = user.cart.find((c) => c.item === req.params.itemId);
    if (!cartItem)
      return res.status(404).json({ message: "Item not found in cart" });

    if (quantity === 0)
      user.cart = user.cart.filter((c) => c.item !== req.params.itemId);
    else cartItem.quantity = quantity;

    await user.save();
    res.json({ message: "✅ Cart updated", cart: user.cart });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/users/:id/cart/:itemId", async (req, res) => {
  try {
    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.cart = user.cart.filter((c) => c.item !== req.params.itemId);
    await user.save();

    res.json({ message: "🗑️ Item removed from cart", cart: user.cart });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// RUN SERVER
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
