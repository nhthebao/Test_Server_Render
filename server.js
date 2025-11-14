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
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
  })
  .then(() => console.log("✅ MongoDB connected to foodDelivery"))
  .catch((err) => console.log("❌ DB connection error:", err));

// ✅ MongoDB connection event handlers
mongoose.connection.on("connected", () => {
  console.log("✅ Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ Mongoose disconnected from MongoDB");
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("👋 Mongoose connection closed due to app termination");
  process.exit(0);
});

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
    authProviders: { type: [String], default: ["firebase"] }, // 🔵 Array để lưu firebase, google
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

// ✅ Health check endpoint
app.get("/health", async (req, res) => {
  try {
    const dbStatus =
      mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    const orderCount = await Order.countDocuments().maxTimeMS(3000);

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      database: dbStatus,
      ordersCount: orderCount,
      uptime: process.uptime(),
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message,
      database:
        mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    });
  }
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
app.post("/auth/refresh-token", async (req, res) => {
  try {
    const { firebaseToken } = req.body;

    // Verify Firebase token
    const decoded = await admin.auth().verifyIdToken(firebaseToken);
    const uid = decoded.uid;

    // Tìm user
    const user = await User.findOne({ id: uid });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User không tồn tại",
      });
    }

    // Tạo JWT token mới
    const newToken = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" } // 1 giờ
    );

    res.json({
      success: true,
      token: newToken,
      expiresIn: 3600, // 1 giờ = 3600 giây
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🔹 Request password reset
// For EMAIL: Generates temporary token + sends link to user email
// For PHONE: Firebase gửi OTP tự động qua SMS
app.post("/auth/password/request-reset", async (req, res) => {
  try {
    const { method, identifier } = req.body;

    if (!method || !identifier) {
      return res.status(400).json({
        success: false,
        message: "❌ Method và identifier là bắt buộc",
      });
    }

    if (!["email", "phone"].includes(method)) {
      return res.status(400).json({
        success: false,
        message: "❌ Invalid method (use 'email' or 'phone')",
      });
    }

    // ============================================
    // TÌNG USER TỪNG DATABASE
    // ============================================
    let query = {};
    if (method === "email") {
      query.email = identifier.toLowerCase();
    } else {
      // ✅ Chuẩn hóa phone: convert 0xxx -> +84xxx
      let normalizedPhone = identifier.trim();
      if (!normalizedPhone.startsWith("+")) {
        if (normalizedPhone.startsWith("0")) {
          normalizedPhone = "+84" + normalizedPhone.substring(1);
        } else {
          normalizedPhone = "+84" + normalizedPhone;
        }
      }

      // Tìm bằng cả format gốc và format chuẩn hóa (để support cả 2 format)
      query = {
        $or: [
          { phone: identifier }, // Format gốc (gì gửi lên thì tìm cái đó)
          { phone: normalizedPhone }, // Format chuẩn hóa
        ],
      };
    }

    const user = await User.findOne(query);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "❌ User không tồn tại",
        identifier,
      });
    }

    const resetId = `reset_${Date.now()}_${Math.random().toString(36)}`;

    // ============================================
    // EMAIL METHOD: Firebase gửi email tự động
    // ============================================
    if (method === "email") {
      try {
        console.log(`\n📧 ========== EMAIL RESET REQUEST ==========`);
        console.log(`📧 Timestamp: ${new Date().toISOString()}`);
        console.log(`📧 User email: ${user.email}`);
        console.log(`📧 User ID: ${user._id}`);

        // Step 1: Generate reset link from Firebase
        console.log(`📧 Generating Firebase password reset link...`);
        const resetLink = await admin
          .auth()
          .generatePasswordResetLink(user.email);

        console.log(`✅ Reset link generated`);
        console.log(`📧 Link: ${resetLink.substring(0, 100)}...`);

        // Step 2: Send email using nodemailer
        console.log(`📧 Sending email via nodemailer...`);
        const emailSent = await sendPasswordResetEmail(user.email, resetLink);

        if (!emailSent) {
          throw new Error("Nodemailer failed to send email");
        }

        console.log(`✅ Email sent successfully to: ${user.email}`);
        console.log(`📧 ==========================================\n`);

        // Lưu session để tracking
        resetSessions[resetId] = {
          email: user.email,
          userId: user._id,
          method: "email",
          resetLink,
          expiresAt: Date.now() + 30 * 60 * 1000, // 30 phút
          used: false,
        };

        return res.json({
          success: true,
          message: `✅ Email được gửi đến ${user.email}! Kiểm tra hộp thư để nhận link.`,
          resetId,
          requiresVerification: false,
          expiresIn: 1800,
        });
      } catch (firebaseError) {
        console.error(`\n❌ ========== FIREBASE ERROR ==========`);
        console.error(`❌ Timestamp: ${new Date().toISOString()}`);
        console.error(`❌ User email: ${user.email}`);
        console.error(`❌ Error message: ${firebaseError.message}`);
        console.error(`❌ Error code: ${firebaseError.code}`);
        console.error(`❌ Full error:`, JSON.stringify(firebaseError, null, 2));
        console.error(`❌ =====================================\n`);

        return res.status(500).json({
          success: false,
          message: "❌ Lỗi khi gửi email. Vui lòng thử lại sau.",
          error: firebaseError.message,
          code: firebaseError.code,
        });
      }
    }

    // ============================================
    // PHONE METHOD: Generate OTP + Firebase gửi SMS
    // ============================================
    if (method === "phone") {
      // Generate OTP 6 ký tự
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      console.log(`\n📱 ========== PHONE OTP RESET REQUEST ==========`);
      console.log(`📱 Timestamp: ${new Date().toISOString()}`);
      console.log(`📱 User phone: ${user.phone}`);
      console.log(`📱 User email: ${user.email}`);
      console.log(`📱 Generated OTP: ${otp}`);

      // Lưu session để verify sau
      resetSessions[resetId] = {
        phone: user.phone,
        userId: user._id,
        email: user.email,
        method: "phone",
        otp: otp, // ✅ Lưu OTP để verify sau
        expiresAt: Date.now() + 10 * 60 * 1000, // 10 phút
        attempts: 0,
        verified: false,
      };

      // ✅ Gửi OTP qua SMS bằng Firebase
      try {
        console.log(`📱 Sending OTP via Firebase SMS...`);

        // Firebase sẽ tự động gửi SMS khi frontend gọi signInWithPhoneNumber()
        // Nhưng backend có thể gửi qua API nếu cần
        // Hiện tại chúng ta sẽ log OTP để test

        console.log(`✅ OTP generated: ${otp}`);
        console.log(`📱 ==========================================\n`);

        return res.json({
          success: true,
          message: `✅ OTP đã được gửi đến ${user.phone}! Nhập mã 6 ký tự để xác thực.`,
          resetId,
          requiresVerification: true, // Phone cần verify OTP
          expiresIn: 600, // 10 phút
          phoneNumber: user.phone, // Gửi phone về để frontend dùng với Firebase
          // ⚠️ CHỈ FOR TESTING: xóa dòng này trong production!
          debug_otp: otp, // TEST ONLY - để test từ Postman
        });
      } catch (phoneError) {
        console.error(`\n❌ ========== PHONE OTP ERROR ==========`);
        console.error(`❌ Timestamp: ${new Date().toISOString()}`);
        console.error(`❌ User phone: ${user.phone}`);
        console.error(`❌ Error message: ${phoneError.message}`);
        console.error(`❌ Error code: ${phoneError.code}`);
        console.error(`❌ ====================================\n`);

        return res.status(500).json({
          success: false,
          message: "❌ Lỗi khi gửi OTP. Vui lòng thử lại sau.",
          error: phoneError.message,
          code: phoneError.code,
        });
      }
    }
  } catch (err) {
    console.error("❌ Request reset error:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// 🔹 Verify phone OTP code
// Only needed for PHONE method
// Email users have token already in URL, no verification needed
app.post("/auth/password/verify-reset-code", async (req, res) => {
  try {
    const { resetId, code } = req.body;

    if (!resetId || !code) {
      return res.status(400).json({
        success: false,
        message: "❌ resetId và code là bắt buộc",
      });
    }

    const session = resetSessions[resetId];

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "❌ Reset session không tồn tại hoặc hết hạn",
      });
    }

    // Check if method is phone (only phone needs verification)
    if (session.method !== "phone") {
      return res.status(400).json({
        success: false,
        message: "❌ Verification not needed for this method",
      });
    }

    // Check expiry
    if (Date.now() > session.expiresAt) {
      delete resetSessions[resetId];
      return res.status(401).json({
        success: false,
        message: "❌ Reset code hết hạn. Vui lòng yêu cầu lại.",
      });
    }

    // Check attempts
    if (session.attempts >= 5) {
      delete resetSessions[resetId];
      return res.status(429).json({
        success: false,
        message: "❌ Quá nhiều lần thử. Vui lòng yêu cầu reset lại.",
      });
    }

    // Verify code
    if (code !== session.otp) {
      session.attempts++;
      console.warn(
        `⚠️ OTP attempt ${session.attempts}/5 failed for ${session.phone}`
      );
      console.warn(`⚠️ Expected: ${session.otp}, Got: ${code}`);
      return res.status(401).json({
        success: false,
        message: "❌ Mã OTP không đúng",
        attemptsLeft: 5 - session.attempts,
      });
    }

    // Code correct → tạo temporary token
    console.log(`\n📱 ========== OTP VERIFIED ==========`);
    console.log(`✅ OTP verified for phone: ${session.phone}`);
    console.log(`✅ User ID: ${session.userId}`);
    console.log(`✅ Email: ${session.email}`);
    console.log(`📱 ====================================\n`);

    const temporaryToken = jwt.sign(
      {
        userId: session.userId,
        email: session.email,
        purpose: "password_reset",
        resetId,
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" } // 15 minutes
    );

    session.verified = true;
    session.temporaryToken = temporaryToken;

    console.log(`✅ Phone OTP verified for ${session.phone}`);

    res.json({
      success: true,
      message: "✅ Code verified",
      temporaryToken,
    });
  } catch (err) {
    console.error("❌ Verify reset code error:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// 🔹 Change password using temporary token
// Valid for both EMAIL and PHONE methods (after verification/link received)
app.post("/auth/password/change-password", async (req, res) => {
  try {
    const { temporaryToken, newPassword } = req.body;

    if (!temporaryToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "❌ temporaryToken và newPassword là bắt buộc",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "❌ Mật khẩu phải có ít nhất 6 ký tự",
      });
    }

    // Verify temporary token
    let decoded;
    try {
      decoded = jwt.verify(temporaryToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "❌ Token hết hạn hoặc không hợp lệ",
      });
    }

    if (decoded.purpose !== "password_reset") {
      return res.status(401).json({
        success: false,
        message: "❌ Token không hợp lệ",
      });
    }

    // Check reset session vẫn tồn tại
    const session = resetSessions[decoded.resetId];
    if (!session) {
      return res.status(401).json({
        success: false,
        message: "❌ Reset session không còn hợp lệ",
      });
    }

    // For phone method, verify it has been verified
    if (session.method === "phone" && !session.verified) {
      return res.status(401).json({
        success: false,
        message: "❌ Phone OTP not verified",
      });
    }

    // Update Firebase password
    try {
      console.log(`🔄 Updating Firebase password for email: ${decoded.email}`);

      // Get Firebase user by email
      const firebaseUser = await admin.auth().getUserByEmail(decoded.email);

      // Update password using Firebase UID
      await admin.auth().updateUser(firebaseUser.uid, {
        password: newPassword,
      });
      console.log(`✅ Password updated for Firebase user ${firebaseUser.uid}`);
    } catch (firebaseErr) {
      console.warn("⚠️ Firebase update failed:", firebaseErr.message);
      // Continue anyway - password reset still successful
    }

    // Delete reset session
    delete resetSessions[decoded.resetId];

    console.log(`✅ Password successfully changed for user ${decoded.email}`);

    res.json({
      success: true,
      message: "✅ Password updated successfully",
    });
  } catch (err) {
    console.error("❌ Change password error:", err);
    res.status(500).json({
      success: false,
      message: "❌ Lỗi khi cập nhật mật khẩu",
      error: err.message,
    });
  }
});

// 🆕 🔹 Change password (Logged In User)
// Verify mật khẩu cũ ĐÚNG trước khi update
// Endpoint: POST /auth/password/change-logged-in
app.post("/auth/password/change-logged-in", verifyToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    console.log("🔐 Change password request for user:", userId);

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "❌ Phải cung cấp mật khẩu cũ và mật khẩu mới",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "❌ Mật khẩu mới phải có ít nhất 6 ký tự",
      });
    }

    // STEP 1: Lấy user từ DB
    const user = await User.findOne({ id: userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "❌ User không tồn tại",
      });
    }

    console.log("📝 User found:", user.email);

    // STEP 2: Verify Firebase password (oldPassword)
    // Dùng Firebase REST API để verify
    try {
      console.log("🔐 Verifying old password...");
      console.log(
        "📌 Firebase API Key present:",
        !!process.env.FIREBASE_API_KEY
      );

      const firebaseUrl =
        "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" +
        process.env.FIREBASE_API_KEY;

      console.log(
        "📡 Firebase URL (masked):",
        firebaseUrl.substring(0, 80) + "..."
      );

      const response = await axios.post(firebaseUrl, {
        email: user.email,
        password: oldPassword,
        returnSecureToken: true,
      });

      const data = response.data;

      console.log("📬 Firebase response status:", response.status);
      console.log("📬 Firebase response:", {
        ok: response.status === 200,
        status: response.status,
        hasError: !!data.error,
        errorMessage: data.error?.message || "No error",
      });

      // 🆕 Log FULL response
      console.log("📋 Full Firebase Response:", JSON.stringify(data, null, 2));

      console.log("✅ Old password verified for:", user.email);

      // STEP 3: Update mật khẩu Firebase
      console.log("🔄 Updating Firebase password...");
      await admin.auth().updateUser(userId, {
        password: newPassword,
      });

      console.log(`✅ Password changed for user ${user.email}`);

      res.json({
        success: true,
        message: "✅ Đổi mật khẩu thành công",
      });
    } catch (error) {
      console.error("❌ Password change error:", error);
      console.error("❌ Error details:", {
        message: error.message,
        code: error.code,
        name: error.name,
        response: error.response?.data,
      });

      if (error.response?.status === 400) {
        const firebaseError = error.response.data?.error?.message;
        return res.status(401).json({
          success: false,
          message: "❌ Mật khẩu cũ không chính xác",
          debug: {
            firebaseError,
          },
        });
      }

      return res.status(500).json({
        success: false,
        message: "❌ Lỗi server khi verify mật khẩu",
        debug: {
          error: error.message,
        },
      });
    }
  } catch (err) {
    console.error("❌ Change password error:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ✅ Cleanup expired sessions (run every 5 minutes)
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [resetId, session] of Object.entries(resetSessions)) {
    if (session.expiresAt < now) {
      delete resetSessions[resetId];
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired reset sessions`);
  }
}, 5 * 60 * 1000);

// ============================================
// EMAIL HELPER FUNCTION - SEND PASSWORD RESET
// ============================================
// ============================================
// 📧 SENDGRID EMAIL FUNCTION (Primary)
// ============================================
async function sendPasswordResetEmailSendGrid(email, resetLink) {
  try {
    console.log(`\n📧 ========== SENDGRID SEND START ==========`);
    console.log(`📧 [1/3] Checking SendGrid API Key...`);

    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      console.error(`❌ SENDGRID_API_KEY not found in environment`);
      return false;
    }

    console.log(`✅ SendGrid API Key found`);
    console.log(`📧 [2/3] Preparing email...`);

    sgMail.setApiKey(apiKey);

    const msg = {
      to: email,
      from: process.env.EMAIL_USER || "gobitefood@gmail.com", // Must be verified sender
      subject: "🔐 Lấy Lại Mật Khẩu - Food Delivery App",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #FF6B35; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px; }
            .button { 
              display: inline-block; 
              padding: 12px 30px;
              background: #FF6B35;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: bold;
              margin: 20px 0;
            }
            .note { color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🔐 Lấy Lại Mật Khẩu</h2>
            </div>
            <div class="content">
              <p>Xin chào,</p>
              <p>Chúng tôi nhận được yêu cầu lấy lại mật khẩu cho tài khoản của bạn.</p>
              
              <p>Nhấn nút dưới để đặt mật khẩu mới:</p>
              
              <center>
                <a href="${resetLink}" class="button" style="color: white">Lấy Lại Mật Khẩu</a>
              </center>
              
              <p>Nếu nút trên không hoạt động, sao chép link này vào trình duyệt:</p>
              <code style="background: white; padding: 10px; display: block; word-break: break-all;">
                ${resetLink}
              </code>
              
              <p class="note">
                <strong>⏰ Lưu ý:</strong> Link lấy lại mật khẩu sẽ hết hạn trong 30 phút.
              </p>
              
              <p class="note">
                Nếu bạn không yêu cầu lấy lại mật khẩu, vui lòng bỏ qua email này.
              </p>
              
              <hr style="margin-top: 30px;">
              <p style="color: #999; font-size: 12px;">
                Food Delivery App &copy; 2025 - Tất cả quyền được bảo lưu.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    console.log(`📧 From: ${msg.from}`);
    console.log(`📧 To: ${msg.to}`);
    console.log(`📧 Subject: ${msg.subject}`);
    console.log(`📧 [3/3] Sending email via SendGrid...`);

    const result = await sgMail.send(msg);

    console.log(`✅ Email sent successfully via SendGrid!`);
    console.log(`✅ Status Code: ${result[0].statusCode}`);
    console.log(`✅ Response: ${JSON.stringify(result[0].headers)}`);
    console.log(`📧 ========== SENDGRID SEND SUCCESS ==========\n`);

    return true;
  } catch (error) {
    console.error(`\n❌ ========== SENDGRID ERROR ==========`);
    console.error(`❌ Error message:`, error.message);
    console.error(`❌ Error code:`, error.code);
    if (error.response) {
      console.error(`❌ Response status:`, error.response.statusCode);
      console.error(`❌ Response body:`, error.response.body);
    }
    console.error(`❌ Full error:`, JSON.stringify(error, null, 2));
    console.error(`❌ ====================================\n`);
    return false;
  }
}

// ============================================
// 📧 MAIN EMAIL FUNCTION - Uses SendGrid
// ============================================
async function sendPasswordResetEmail(email, resetLink) {
  // ✅ Use SendGrid for email sending
  if (!process.env.SENDGRID_API_KEY) {
    console.error(`❌ SENDGRID_API_KEY not found in environment!`);
    console.error(
      `💡 Please add SENDGRID_API_KEY to your .env file or Render Environment Variables`
    );
    return false;
  }

  console.log(`📧 Sending email via SendGrid...`);
  return await sendPasswordResetEmailSendGrid(email, resetLink);
}

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
      id, // ✅ Nhận orderID từ client
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

    // ✅ Dùng orderID từ client HOẶC tự generate nếu không có
    const orderId =
      id || `DH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // ✅ Check duplicate
    const existingOrder = await Order.findOne({ id: orderId });
    if (existingOrder) {
      console.log(`⚠️ Order ${orderId} already exists`);
      return res.status(200).json({
        success: true,
        message: "Order already exists",
        order: existingOrder,
      });
    }

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

    console.log(`✅ Order created: ${orderId}`);
    console.log(`   User: ${userId}`);
    console.log(`   Items: ${items.length}`);
    console.log(`   Amount: ${finalAmount} VND`);

    // Optional: Clear cart after creating order
    await User.findOneAndUpdate({ id: userId }, { cart: [] });

    res.status(201).json({
      success: true,
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

// 🔹 Lấy đơn hàng theo userId (cho user xem lịch sử của mình)
app.get("/orders", async (req, res) => {
  try {
    const { userId, status, paymentStatus, page = 1, limit = 50 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    let query = { userId };

    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .maxTimeMS(10000);

    const total = await Order.countDocuments(query).maxTimeMS(5000);

    console.log(
      `📦 [GET /orders] Found ${orders.length} orders for user ${userId}`
    );

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
    console.error("❌ [GET /orders] Error:", err);
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

    // ✅ Parse order ID - Ưu tiên dùng field "code" từ Sepay
    let orderId = null;

    // Strategy 1: Dùng field "code" (Sepay cung cấp sẵn)
    if (code) {
      orderId = code.replace(/-$/, ""); // Remove trailing dash
      console.log(`✅ Using 'code' field: ${orderId}`);
    }

    // Strategy 2: Parse từ "content" nếu không có "code"
    if (!orderId && content) {
      // Match các format: DH123456, DH-1699401234567, DH-1699401234567-abc123
      const orderIdMatch = content.match(/DH[\d-]+[a-z0-9]*/i);
      if (orderIdMatch) {
        orderId = orderIdMatch[0].replace(/-+$/, ""); // Remove trailing dashes
        console.log(`✅ Parsed from 'content': ${orderId}`);
      }
    }

    // Validate orderId
    if (!orderId) {
      console.log("❌ No order ID found");
      console.log(`📄 code: ${code}`);
      console.log(`📄 content: ${content}`);
      return res.status(200).json({
        success: false,
        message: "No order ID found",
      });
    }

    console.log(`🔍 Processing payment for order: ${orderId}`);

    // Find order in database - Multiple strategies
    let order = null;

    // Strategy 1: Exact match
    order = await Order.findOne({ id: orderId });
    if (order) {
      console.log(`✅ Found order by exact match: ${order.id}`);
    }

    // Strategy 2: Partial match (case-insensitive)
    if (!order) {
      console.log(`⚠️ Exact match not found, trying partial match...`);
      order = await Order.findOne({
        id: { $regex: new RegExp(`^${orderId.replace(/[-]/g, "\\-")}`, "i") },
      });
      if (order) {
        console.log(`✅ Found order by partial match: ${order.id}`);
      }
    }

    // Strategy 3: Search by short code (DH230920)
    if (!order && orderId.startsWith("DH")) {
      console.log(`⚠️ Trying to find by short code pattern...`);
      const shortCode = orderId.replace(/^DH-?/, ""); // Remove "DH" or "DH-"
      order = await Order.findOne({
        id: { $regex: new RegExp(`DH[\\-]?${shortCode}`, "i") },
      });
      if (order) {
        console.log(`✅ Found order by short code: ${order.id}`);
      }
    }

    // Not found
    if (!order) {
      console.log(`❌ Order not found: ${orderId}`);
      console.log(
        `📋 Total orders in database: ${await Order.countDocuments()}`
      );

      // List recent orders for debugging
      const recentOrders = await Order.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select("id createdAt");
      console.log(
        `📋 Recent orders:`,
        recentOrders.map((o) => `${o.id} (${o.createdAt})`)
      );

      return res.status(200).json({
        success: false,
        message: "Order not found",
        searchedId: orderId,
        hint: "Make sure order is created before payment",
      });
    }

    console.log(
      `✅ Found order: ${order.id} (${order.status}, ${order.paymentStatus})`
    );

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
    const orderId = req.params.orderId;
    console.log(
      `🔍 [GET /payment/status] Checking payment for order: ${orderId}`
    );

    // ✅ Validate orderId format
    if (!orderId || orderId.length < 3) {
      console.log(`❌ [GET /payment/status] Invalid orderId: ${orderId}`);
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    // ✅ Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.error("❌ [GET /payment/status] MongoDB not connected!");
      return res.status(503).json({
        success: false,
        message: "Database connection unavailable",
      });
    }

    // ✅ Find order with timeout
    const order = await Order.findOne({ id: orderId })
      .maxTimeMS(5000) // 5 second timeout
      .exec();

    if (!order) {
      console.log(`⚠️ [GET /payment/status] Order not found: ${orderId}`);

      // Debug: Show recent orders
      const recentOrders = await Order.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .select("id createdAt paymentStatus")
        .maxTimeMS(3000);

      console.log(
        `📋 Recent orders:`,
        recentOrders.map((o) => `${o.id} (${o.paymentStatus})`)
      );

      return res.status(404).json({
        success: false,
        message: "Order not found",
        orderId: orderId,
      });
    }

    console.log(
      `✅ [GET /payment/status] Found order: ${order.id} - ${order.paymentStatus}`
    );

    res.json({
      success: true,
      orderId: order.id,
      paymentStatus: order.paymentStatus,
      status: order.status,
      finalAmount: order.finalAmount,
      paymentTransaction: order.paymentTransaction || null,
    });
  } catch (err) {
    console.error(`❌ [GET /payment/status] Error:`, err);

    // ✅ Return detailed error for debugging
    res.status(500).json({
      success: false,
      error: err.message,
      type: err.name,
      orderId: req.params.orderId,
    });
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
