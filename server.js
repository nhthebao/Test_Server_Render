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

// 🔹 DEBUG: Lấy tất cả user và số phone của họ
app.get("/debug/users-phone", async (req, res) => {
  try {
    const users = await User.find().select("username email phone fullName");
    const formatted = users.map((u) => ({
      username: u.username,
      email: u.email,
      phone: u.phone,
      fullName: u.fullName,
    }));
    res.json({
      message: "📱 Danh sách tất cả user và phone",
      total: formatted.length,
      users: formatted,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 DEBUG: Tìm user duplicates và search by username
app.get("/debug/check-username/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const normalizedUsername = username.toLowerCase().trim();

    console.log(`\n🔍 ========== DEBUG CHECK USERNAME ==========`);
    console.log(`Input: "${username}"`);
    console.log(`Normalized: "${normalizedUsername}"`);

    // Tìm tất cả users có username giống nhau (case-insensitive)
    const users = await User.find().select("username email phone fullName id");
    const matchingUsers = users.filter(
      (u) => u.username.toLowerCase() === normalizedUsername
    );

    console.log(`Found ${matchingUsers.length} matching user(s)`);
    matchingUsers.forEach((u, idx) => {
      console.log(
        `  ${idx + 1}. username: "${u.username}", email: "${
          u.email
        }", phone: "${u.phone}"`
      );
    });
    console.log(`🔍 ==========================================\n`);

    res.json({
      message: `🔍 Check username: ${username}`,
      normalized: normalizedUsername,
      totalMatching: matchingUsers.length,
      users: matchingUsers.map((u) => ({
        username: u.username,
        email: u.email,
        phone: u.phone,
        fullName: u.fullName,
        id: u.id,
      })),
      allUsers: users.map((u) => ({
        username: u.username,
        email: u.email,
      })),
    });
  } catch (err) {
    console.error(`❌ Error checking username:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 DEBUG: Tìm và xóa các user duplicates
app.get("/debug/find-duplicates", async (req, res) => {
  try {
    console.log(`\n🔍 ========== FINDING DUPLICATES ==========`);

    const allUsers = await User.find().select(
      "username email phone fullName id"
    );

    // Tìm username duplicates
    const usernameMap = {};
    const emailMap = {};

    allUsers.forEach((u) => {
      const normalizedUsername = u.username.toLowerCase();
      const normalizedEmail = u.email.toLowerCase();

      if (!usernameMap[normalizedUsername]) {
        usernameMap[normalizedUsername] = [];
      }
      usernameMap[normalizedUsername].push(u);

      if (!emailMap[normalizedEmail]) {
        emailMap[normalizedEmail] = [];
      }
      emailMap[normalizedEmail].push(u);
    });

    // Tìm duplicates
    const usernameDuplicates = Object.entries(usernameMap).filter(
      ([_, users]) => users.length > 1
    );
    const emailDuplicates = Object.entries(emailMap).filter(
      ([_, users]) => users.length > 1
    );

    console.log(`Found ${usernameDuplicates.length} username duplicates`);
    console.log(`Found ${emailDuplicates.length} email duplicates`);
    console.log(`🔍 ==========================================\n`);

    res.json({
      message: "🔍 Duplicate check complete",
      totalUsers: allUsers.length,
      usernameDuplicates: usernameDuplicates.map(([username, users]) => ({
        username,
        count: users.length,
        users: users.map((u) => ({ email: u.email, phone: u.phone, id: u.id })),
      })),
      emailDuplicates: emailDuplicates.map(([email, users]) => ({
        email,
        count: users.length,
        users: users.map((u) => ({
          username: u.username,
          phone: u.phone,
          id: u.id,
        })),
      })),
    });
  } catch (err) {
    console.error(`❌ Error finding duplicates:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 DEBUG: Xóa user bằng username và email để xóa đúng user
app.delete("/debug/delete-user", async (req, res) => {
  try {
    const { username, email } = req.query;

    if (!username || !email) {
      return res.status(400).json({
        success: false,
        message: "❌ Cần cung cấp cả username và email để xóa",
      });
    }

    const normalizedUsername = username.toLowerCase().trim();
    const normalizedEmail = email.toLowerCase().trim();

    console.log(`\n🗑️ ========== DELETE USER ==========`);
    console.log(`Username: "${normalizedUsername}"`);
    console.log(`Email: "${normalizedEmail}"`);

    // Tìm user với cả username và email để đảm bảo xóa đúng
    const user = await User.findOne({
      username: normalizedUsername,
      email: normalizedEmail,
    });

    if (!user) {
      console.log(`❌ User không tồn tại`);
      console.log(`🗑️ ==================================\n`);
      return res.status(404).json({
        success: false,
        message: "❌ User không tồn tại",
      });
    }

    console.log(`Found user - id: ${user.id}, fullName: "${user.fullName}"`);

    // Xóa user khỏi MongoDB
    await User.deleteOne({ _id: user._id });
    console.log(`✅ User đã xóa khỏi MongoDB`);

    // ⚠️ Cố gắng xóa khỏi Firebase (nếu có)
    try {
      await admin.auth().deleteUser(user.id);
      console.log(`✅ User đã xóa khỏi Firebase`);
    } catch (firebaseErr) {
      console.warn(`⚠️ Không thể xóa khỏi Firebase:`, firebaseErr.message);
    }

    console.log(`🗑️ ==================================\n`);

    res.json({
      success: true,
      message: "✅ User đã được xóa",
      deletedUser: {
        username: user.username,
        email: user.email,
        fullName: user.fullName,
      },
    });
  } catch (err) {
    console.error(`❌ Error deleting user:`, err.message);
    res.status(500).json({ success: false, error: err.message });
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

      // ✅ Xử lý fullName và phone từ request body (đăng ký) hoặc Firebase
      const finalFullName =
        fullName && fullName.trim() ? fullName.trim() : "No name";
      const finalPhone =
        phone && phone.trim() ? phone.trim() : phone_number || "";

      console.log(`📝 Creating user with:`, {
        fullName: finalFullName,
        phone: finalPhone,
        username: normalizedUsername,
        email: normalizedEmail,
      });

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
      console.log("✅ New user created:", {
        username: user.username,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
      });
    } else {
      console.log("✅ Existing user found");
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
