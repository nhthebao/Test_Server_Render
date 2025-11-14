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
        "https://firebasestorage.googleapis.com/v0/b/fooddelivery-15d47.firebasestorage.app/o/03ebd625cc0b9d636256ecc44c0ea324.jpg?alt=media&token=1632c189-ec3d-447b-8f3c-28048ae9812a",
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
    paymentTransaction: {
      transactionId: { type: String },
      gateway: { type: String },
      transactionDate: { type: String },
      amount: { type: Number },
      referenceNumber: { type: String },
      bankBrand: { type: String },
      content: { type: String },
      description: { type: String },
      subAccount: { type: String },
    },
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

    // ✅ Normalize email và username để query case-insensitive
    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      query.email = normalizedEmail;
      console.log(`🔍 [GET /users] Query by email: "${normalizedEmail}"`);
    }
    if (username) {
      const normalizedUsername = username.toLowerCase().trim();
      query.username = normalizedUsername;
      console.log(`🔍 [GET /users] Query by username: "${normalizedUsername}"`);
    }

    const users = await User.find(query);
    console.log(`📊 [GET /users] Found ${users.length} user(s)`);

    // ✅ Log thông tin user tìm thấy để debug
    if (users.length > 0) {
      users.forEach((u, idx) => {
        console.log(
          `  ${idx + 1}. username: "${u.username}", email: "${
            u.email
          }", phone: "${u.phone}"`
        );
      });
    }

    // ⚠️ Cảnh báo nếu tìm thấy nhiều users (không nên xảy ra do unique constraint)
    if (users.length > 1) {
      console.warn(
        `⚠️ WARNING: Found ${users.length} users with same query! This should not happen!`
      );
    }

    res.json(users);
  } catch (err) {
    console.error(`❌ [GET /users] Error:`, err.message);
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

// 🔹 LOGIN or REGISTER (Firebase token)
app.post("/auth/login", async (req, res) => {
  try {
    const { firebaseToken, username, fullName, phone, address } = req.body;
    if (!firebaseToken)
      return res.status(400).json({ message: "❌ Missing Firebase token" });

    const decoded = await admin.auth().verifyIdToken(firebaseToken);
    const { uid, email, picture, phone_number } = decoded;

    console.log("🔍 Auth decoded:", {
      uid,
      email,
      username,
      fullName,
      phone,
      address,
    });

    let user = await User.findOne({ id: uid });

    if (!user) {
      console.log("📝 Creating new user");

      const normalizedUsername = username
        ? username.toLowerCase()
        : email?.split("@")[0].toLowerCase();
      const normalizedEmail = email.toLowerCase();

      // Check duplicates
      const existingUsername = await User.findOne({
        username: normalizedUsername,
      });
      if (existingUsername) {
        return res.status(409).json({
          message: "❌ Username đã tồn tại",
          code: "USERNAME_CONFLICT",
        });
      }

      const existingEmail = await User.findOne({ email: normalizedEmail });
      if (existingEmail) {
        return res.status(409).json({
          message: "❌ Email đã tồn tại",
          code: "EMAIL_CONFLICT",
        });
      }

      const finalFullName =
        fullName && fullName.trim() ? fullName.trim() : "No name";
      const finalPhone =
        phone && phone.trim() ? phone.trim() : phone_number || "";

      user = new User({
        id: uid,
        fullName: finalFullName,
        username: normalizedUsername,
        email: normalizedEmail,
        phone: finalPhone,
        address: address || "",
        authProvider: "firebase",
        paymentMethod: "momo",
        image: picture || undefined,
        favorite: [],
        cart: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await user.save();
      console.log("✅ New user created:", user.username);
    } else {
      console.log("✅ Existing user found:", user.username);
    }

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
    console.error("❌ Auth error:", err);
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
app.post("/orders", async (req, res) => {
  try {
    const {
      userId,
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
    if (!userId) {
      return res.status(400).json({ message: "❌ User ID is required" });
    }
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

    // Generate unique order ID (format: DH-timestamp-random)
    const orderId = `DH-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const newOrder = new Order({
      id: orderId,
      userId: userId,
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
    await User.findOneAndUpdate({ id: userId }, { cart: [] });

    res.status(201).json({
      message: "✅ Order created successfully",
      order: newOrder,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Lấy tất cả đơn hàng (Admin) hoặc của user hiện tại
app.get("/orders", async (req, res) => {
  try {
    const { userId, status, paymentStatus, page = 1, limit = 10 } = req.query;

    let query = {};

    // Filter by userId if provided
    if (userId) query.userId = userId;

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
app.get("/orders/:id", async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Cập nhật trạng thái đơn hàng (Admin/User)
app.patch("/orders/:id/status", async (req, res) => {
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
app.patch("/orders/:id/payment", async (req, res) => {
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
app.put("/orders/:id", async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
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
app.delete("/orders/:id", async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.id });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
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
app.get("/users/:userId/orders", async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.userId }).sort({
      createdAt: -1,
    });

    res.json({ orders, total: orders.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Thống kê đơn hàng theo trạng thái
app.get("/orders/stats/summary", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "❌ User ID is required" });
    }

    const stats = await Order.aggregate([
      { $match: { userId: userId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$finalAmount" },
        },
      },
    ]);

    const summary = {
      totalOrders: await Order.countDocuments({ userId: userId }),
      totalSpent: await Order.aggregate([
        { $match: { userId: userId, paymentStatus: "paid" } },
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
// PAYMENT WEBHOOK (SEPAY)
// =============================

// Middleware để xác thực API Key từ Sepay
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers["authorization"];
  const expectedApiKey = process.env.SEPAY_API_KEY || "thanhToanTrucTuyen";

  // Sepay gửi với format: "Apikey YOUR_API_KEY"
  if (!apiKey || !apiKey.includes(expectedApiKey)) {
    console.log("❌ Invalid API Key:", apiKey);
    return res.status(401).json({
      success: false,
      message: "❌ Unauthorized: Invalid API Key",
    });
  }

  next();
};

// 🔹 Webhook nhận thông báo thanh toán từ Sepay
app.post("/webhook/sepay", verifyApiKey, async (req, res) => {
  try {
    console.log("📥 ========== SEPAY WEBHOOK RECEIVED ==========");
    console.log("⏰ Time:", new Date().toISOString());
    console.log("📋 Headers:", JSON.stringify(req.headers, null, 2));
    console.log("📦 Body:", JSON.stringify(req.body, null, 2));

    const {
      id,
      gateway,
      transactionDate,
      accountNumber,
      subAccount,
      code,
      content,
      transferType,
      transferAmount,
      accumulated,
      referenceCode,
      description,
    } = req.body;

    // Validate webhook data
    if (!id || !content) {
      console.log("❌ Missing required fields");
      return res.status(400).json({
        success: false,
        message: "❌ Invalid webhook data",
      });
    }

    // ✅ Chỉ xử lý giao dịch tiền vào (transferType = "in")
    if (transferType !== "in") {
      console.log(`⚠️ Ignoring transaction type: ${transferType}`);
      return res.status(200).json({
        success: true,
        message: "Transaction type not 'in'",
      });
    }

    // ✅ Validate virtual account (nếu có cấu hình)
    const expectedVirtualAccount = process.env.BANK_ACCOUNT || "VQRQAFFXT3481";
    if (subAccount && subAccount !== expectedVirtualAccount) {
      console.log(
        `⚠️ Virtual account mismatch. Expected: ${expectedVirtualAccount}, Received: ${subAccount}`
      );
      return res.status(200).json({
        success: true,
        message: "Virtual account not matched",
      });
    }

    console.log(`✅ Virtual Account: ${subAccount || accountNumber}`);
    console.log(`💰 Transfer Amount: ${transferAmount} VND`);
    console.log(`📝 Content: ${content}`);

    // Parse order ID from transaction content
    // Format có thể là: "DH249290", "DH-1699401234567", "DH-1699401234567-abc123" hoặc "DH249290-"
    // Regex này sẽ match: DH + số (bắt buộc) + tùy chọn (-chữ/số)
    const orderIdMatch = content.match(/DH\d+(-[a-z0-9]+)?/i);

    if (!orderIdMatch) {
      console.log("⚠️ No order ID found in transaction content");
      console.log(`📄 Content received: ${content}`);
      return res.status(200).json({
        success: true,
        message: "No order ID found",
      });
    }

    const orderId = orderIdMatch[0].replace(/-$/, ""); // Remove trailing dash if exists
    console.log(`🔍 Processing payment for order: ${orderId}`);

    // Find order in database - try exact match first, then regex match
    let order = await Order.findOne({ id: orderId });

    // If not found, try to find by partial match (in case format differs)
    if (!order) {
      console.log(`⚠️ Exact match not found, trying partial match...`);
      order = await Order.findOne({
        id: { $regex: new RegExp(`^${orderId.replace(/[-]/g, "\\-")}`, "i") },
      });
    }

    if (!order) {
      console.log(`❌ Order not found: ${orderId}`);
      console.log(`📋 Available orders: ${await Order.countDocuments()}`);
      return res.status(200).json({
        success: false,
        message: "Order not found",
        searchedId: orderId,
      });
    }

    console.log(`✅ Found order: ${order.id}`);

    // Check if already paid
    if (order.paymentStatus === "paid") {
      console.log(`⚠️ Order already paid: ${orderId}`);
      return res.status(200).json({
        success: true,
        message: "Order already paid",
        orderId: orderId,
      });
    }

    // Check if payment amount matches
    const expectedAmount = order.finalAmount;
    const receivedAmount = transferAmount || 0;

    if (receivedAmount < expectedAmount) {
      console.log(
        `⚠️ Payment amount mismatch. Expected: ${expectedAmount}, Received: ${receivedAmount}`
      );
      return res.status(200).json({
        success: true,
        message: "Payment amount insufficient",
        orderId: orderId,
        expected: expectedAmount,
        received: receivedAmount,
      });
    }

    // Update order payment status
    order.paymentStatus = "paid";
    order.status = order.status === "pending" ? "confirmed" : order.status;
    order.updatedAt = new Date().toISOString();

    // Add payment transaction info to order
    order.paymentTransaction = {
      transactionId: id.toString(),
      gateway: gateway,
      transactionDate: transactionDate,
      amount: transferAmount,
      referenceNumber: referenceCode,
      bankBrand: gateway,
      content: content,
      description: description,
      subAccount: subAccount,
    };

    await order.save();

    console.log(`✅ Payment confirmed for order: ${orderId}`);
    console.log(`💵 Amount: ${transferAmount} VND`);
    console.log(`🏦 Gateway: ${gateway}`);
    console.log(`📋 Reference: ${referenceCode}`);

    // Return success response to Sepay
    res.status(200).json({
      success: true,
      message: "✅ Payment processed successfully",
      orderId: orderId,
      transactionId: id,
      amount: transferAmount,
    });
  } catch (err) {
    console.error("❌ Webhook error:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// 🔹 Kiểm tra trạng thái thanh toán của đơn hàng
app.get("/payment/status/:orderId", async (req, res) => {
  try {
    const order = await Order.findOne({ id: req.params.orderId });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json({
      orderId: order.id,
      paymentStatus: order.paymentStatus,
      status: order.status,
      finalAmount: order.finalAmount,
      paymentTransaction: order.paymentTransaction || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Tạo thông tin thanh toán (QR Code content)
app.post("/payment/create", async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "❌ Order ID is required" });
    }

    const order = await Order.findOne({ id: orderId });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.paymentStatus === "paid") {
      return res.status(400).json({ message: "❌ Order already paid" });
    }

    // Tạo nội dung chuyển khoản cho QR Code
    // Format: Mã đơn hàng để Sepay webhook có thể nhận dạng
    const transferContent = `${order.id}`;

    // Thông tin tài khoản ngân hàng ảo (Virtual Account từ Sepay)
    const bankInfo = {
      bankName: process.env.BANK_NAME || "MBBank",
      accountNumber: process.env.BANK_ACCOUNT || "VQRQAFFXT3481",
      accountName: process.env.BANK_ACCOUNT_NAME || "THANH TOAN TRUC TUYEN",
      virtualAccount: process.env.BANK_ACCOUNT || "VQRQAFFXT3481", // Tài khoản ảo
      amount: order.finalAmount,
      content: transferContent,
      orderId: order.id,
    };

    res.json({
      success: true,
      message: "✅ Payment info created",
      paymentInfo: bankInfo,
      qrContent: `${bankInfo.virtualAccount}|${bankInfo.amount}|${transferContent}`,
    });
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
