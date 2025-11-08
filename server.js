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

// Kiểm tra biến môi trường JWT_SECRET
if (!process.env.JWT_SECRET) {
  console.error("❌ FATAL ERROR: JWT_SECRET not defined in .env");
  process.exit(1);
}

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

// Order Schema
const OrderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    items: [
      {
        dessertId: { type: String, required: true },
        dessertName: { type: String },
        dessertImage: { type: String },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true },
        discount: { type: Number, default: 0 },
      },
    ],
    totalAmount: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    finalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "preparing",
        "delivering",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },
    paymentMethod: { type: String, default: "momo" },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refunded"],
      default: "unpaid",
    },
    deliveryAddress: {
      fullAddress: { type: String, required: true },
      phone: { type: String, required: true },
      note: { type: String },
    },
    estimatedDeliveryTime: { type: String },
    createdAt: { type: String, default: () => new Date().toISOString() },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { collection: "orders" }
);

const Order = mongoose.model("Order", OrderSchema);

// ============================================
// ROUTES
// ============================================

app.get("/", (req, res) => {
  res.send("🚀 Backend connected with Firebase Auth!");
});

// ============================================
// USER ROUTES (để đăng ký, đăng nhập qua Firebase tạm thời)
// ============================================

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

// 🔹 Lấy danh sách tất cả user (có thể lọc theo email / username)
app.get("/users", async (req, res) => {
  try {
    const { email, username } = req.query;
    let query = {};

    if (email) query.email = email;
    if (username) query.username = username;

    const users = await User.find(query);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Lấy user theo ID (MongoDB _id hoặc id)
app.get("/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id); // hoặc findOne({ id: req.params.id })
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Tạo user mới
app.post("/users", async (req, res) => {
  try {
    const newUser = new User(req.body);
    await newUser.save();
    res.status(201).json(newUser);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 🔹 Cập nhật thông tin user
app.put("/users/:id", async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true }
    );
    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// AUTH ROUTES
// ============================================

// 🔹 Resolve username/email/phone thành email (để client biết email nào để đăng nhập Firebase)
app.post("/auth/resolve-identifier", async (req, res) => {
  try {
    const { username, email, phone } = req.body;

    if (!username && !email && !phone) {
      return res.status(400).json({
        message: "❌ Phải cung cấp username, email hoặc phone",
      });
    }

    // Tìm user theo identifier
    let user = null;

    if (username) {
      user = await User.findOne({ username: username.toLowerCase() });
    } else if (email) {
      user = await User.findOne({ email: email.toLowerCase() });
    } else if (phone) {
      user = await User.findOne({ phone });
    }

    if (!user) {
      return res.status(404).json({
        message: "❌ User không tồn tại",
        identifier: username || email || phone,
      });
    }

    // Trả email để client dùng đăng nhập Firebase
    res.json({
      message: "✅ Identifier resolved",
      email: user.email,
      username: user.username,
      id: user.id,
    });
  } catch (err) {
    console.error("❌ Resolve identifier error:", err);
    res.status(500).json({ error: err.message });
  }
});

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
// ORDERS API
// =============================

// 🔹 Tạo đơn hàng mới
app.post("/orders", verifyToken, async (req, res) => {
  try {
    const {
      items,
      totalAmount,
      discount,
      deliveryFee,
      finalAmount,
      paymentMethod,
      deliveryAddress,
      estimatedDeliveryTime,
    } = req.body;

    // Validate required fields
    if (!items || items.length === 0) {
      return res.status(400).json({ message: "❌ Items are required" });
    }
    if (
      !deliveryAddress ||
      !deliveryAddress.fullAddress ||
      !deliveryAddress.phone
    ) {
      return res
        .status(400)
        .json({ message: "❌ Delivery address and phone are required" });
    }

    // Generate unique order ID
    const orderId = `ORD-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const newOrder = new Order({
      id: orderId,
      userId: req.user.id,
      items,
      totalAmount,
      discount: discount || 0,
      deliveryFee: deliveryFee || 0,
      finalAmount,
      paymentMethod: paymentMethod || "momo",
      deliveryAddress,
      estimatedDeliveryTime,
      status: "pending",
      paymentStatus: "unpaid",
    });

    await newOrder.save();

    // Optional: Clear cart after creating order
    await User.findOneAndUpdate({ id: req.user.id }, { cart: [] });

    res.status(201).json({
      message: "✅ Order created successfully",
      order: newOrder,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Lấy tất cả đơn hàng (Admin) hoặc của user hiện tại
app.get("/orders", verifyToken, async (req, res) => {
  try {
    const { status, paymentStatus, page = 1, limit = 10 } = req.query;

    let query = { userId: req.user.id };

    // Filter by status
    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Lấy tất cả đơn hàng của tất cả users (Admin only)
app.get("/orders/all", async (req, res) => {
  try {
    const { status, paymentStatus, userId, page = 1, limit = 10 } = req.query;

    let query = {};

    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (userId) query.userId = userId;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Lấy chi tiết đơn hàng theo ID
app.get("/orders/:id", verifyToken, async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if user owns this order
    if (order.userId !== req.user.id) {
      return res.status(403).json({ message: "❌ Access denied" });
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Cập nhật trạng thái đơn hàng (Admin/User)
app.patch("/orders/:id/status", verifyToken, async (req, res) => {
  try {
    const { status } = req.body;

    const validStatuses = [
      "pending",
      "confirmed",
      "preparing",
      "delivering",
      "delivered",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "❌ Invalid status" });
    }

    const order = await Order.findOne({ id: req.params.id });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // User can only cancel their own pending orders
    if (order.userId !== req.user.id && status === "cancelled") {
      if (order.status !== "pending") {
        return res
          .status(400)
          .json({ message: "❌ Can only cancel pending orders" });
      }
    }

    order.status = status;
    order.updatedAt = new Date().toISOString();
    await order.save();

    res.json({
      message: "✅ Order status updated",
      order,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Cập nhật trạng thái thanh toán
app.patch("/orders/:id/payment", verifyToken, async (req, res) => {
  try {
    const { paymentStatus } = req.body;

    const validPaymentStatuses = ["unpaid", "paid", "refunded"];
    if (!validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({ message: "❌ Invalid payment status" });
    }

    const order = await Order.findOne({ id: req.params.id });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    order.paymentStatus = paymentStatus;
    order.updatedAt = new Date().toISOString();
    await order.save();

    res.json({
      message: "✅ Payment status updated",
      order,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Cập nhật thông tin đơn hàng (địa chỉ, ghi chú)
app.put("/orders/:id", verifyToken, async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // User can only update their own orders
    if (order.userId !== req.user.id) {
      return res.status(403).json({ message: "❌ Access denied" });
    }

    // Can only update pending orders
    if (order.status !== "pending") {
      return res
        .status(400)
        .json({ message: "❌ Can only update pending orders" });
    }

    const { deliveryAddress, estimatedDeliveryTime } = req.body;

    if (deliveryAddress) order.deliveryAddress = deliveryAddress;
    if (estimatedDeliveryTime)
      order.estimatedDeliveryTime = estimatedDeliveryTime;

    order.updatedAt = new Date().toISOString();
    await order.save();

    res.json({
      message: "✅ Order updated successfully",
      order,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Hủy đơn hàng
app.delete("/orders/:id", verifyToken, async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // User can only cancel their own orders
    if (order.userId !== req.user.id) {
      return res.status(403).json({ message: "❌ Access denied" });
    }

    // Can only cancel pending orders
    if (order.status !== "pending") {
      return res
        .status(400)
        .json({ message: "❌ Can only cancel pending orders" });
    }

    order.status = "cancelled";
    order.updatedAt = new Date().toISOString();
    await order.save();

    res.json({
      message: "🗑️ Order cancelled successfully",
      order,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Lấy lịch sử đơn hàng của user
app.get("/users/:userId/orders", verifyToken, async (req, res) => {
  try {
    // User can only view their own orders
    if (req.params.userId !== req.user.id) {
      return res.status(403).json({ message: "❌ Access denied" });
    }

    const orders = await Order.find({ userId: req.params.userId }).sort({
      createdAt: -1,
    });

    res.json({ orders, total: orders.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Thống kê đơn hàng theo trạng thái
app.get("/orders/stats/summary", verifyToken, async (req, res) => {
  try {
    const stats = await Order.aggregate([
      { $match: { userId: req.user.id } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$finalAmount" },
        },
      },
    ]);

    const summary = {
      totalOrders: await Order.countDocuments({ userId: req.user.id }),
      totalSpent: await Order.aggregate([
        { $match: { userId: req.user.id, paymentStatus: "paid" } },
        { $group: { _id: null, total: { $sum: "$finalAmount" } } },
      ]).then((result) => result[0]?.total || 0),
      byStatus: stats,
    };

    res.json(summary);
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
