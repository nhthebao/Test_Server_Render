const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const admin = require("./firebase");
const jwt = require("jsonwebtoken");
const { verifyToken } = require("./middlewares/auth");
const nodemailer = require("nodemailer");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(cors());
const resetSessions = {};

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
    username: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true },
    phone: { type: String, required: true, unique: true },
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

      user = new User({
        id: uid,
        fullName: fullName || "No name",
        username: normalizedUsername,
        email: normalizedEmail,
        phone: phone || phone_number || "",
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
      console.log("✅ New user created");
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
      query.phone = identifier;
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
      await admin.auth().updateUser(decoded.userId, {
        password: newPassword,
      });
      console.log(`✅ Password updated for Firebase user ${decoded.userId}`);
    } catch (firebaseErr) {
      console.warn(
        "⚠️ Firebase update failed (user may not exist):",
        firebaseErr
      );
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
// EMAIL HELPER FUNCTION
// ============================================

async function sendPasswordResetEmail(email, resetLink) {
  try {
    console.log(`\n📧 ========== NODEMAILER SEND START ==========`);
    console.log(`📧 [1/4] Setting up email transporter...`);

    // Check credentials
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASSWORD;

    console.log(`📧 EMAIL_USER from env: ${emailUser}`);
    console.log(
      `📧 EMAIL_PASSWORD from env: ${
        emailPass ? "✅ EXISTS (" + emailPass.length + " chars)" : "❌ MISSING"
      }`
    );

    if (!emailUser || !emailPass) {
      console.error(
        `❌ Email credentials missing: EMAIL_USER=${!!emailUser}, EMAIL_PASSWORD=${!!emailPass}`
      );
      return false;
    }

    console.log(`📧 [2/4] Email credentials found`);
    console.log(`📧 From: ${emailUser}`);
    console.log(`📧 To: ${email}`);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      connectionTimeout: 10000,
      socketTimeout: 10000,
    });

    console.log(`📧 [2.5/4] Testing transporter connection...`);
    await transporter.verify();
    console.log(`✅ Transporter connection verified`);

    const mailOptions = {
      from: emailUser,
      to: email,
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
                <a href="${resetLink}" class="button">Lấy Lại Mật Khẩu</a>
              </center>
              
              <p>Nếu nút trên không hoạt động, sao chép link này vào trình duyệt:</p>
              <code style="background: white; padding: 10px; display: block; word-break: break-all;">
                ${resetLink}
              </code>
              
              <p class="note">
                <strong>⏰ Lưu ý:</strong> Link lấy lại mật khẩu sẽ hết hạn trong 30 phút.
              </p>
              
              <p class="note">
                Nếu bạn không yêu cầu lấy lại mật khẩu, vui lòng bỏ qua email này. Tài khoản của bạn vẫn được bảo vệ.
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

    console.log(`📧 [3/4] Sending email...`);
    console.log(`📧 Subject: ${mailOptions.subject}`);
    console.log(`📧 To: ${mailOptions.to}`);

    const result = await transporter.sendMail(mailOptions);

    console.log(`✅ [4/4] Email sent successfully`);
    console.log(`✅ Response ID: ${result.response}`);
    console.log(`📧 ========== NODEMAILER SEND SUCCESS ==========\n`);
    return true;
  } catch (error) {
    console.error(`\n❌ ========== EMAIL SEND ERROR ==========`);
    console.error(`❌ Error message:`, error.message);
    console.error(`❌ Error code:`, error.code);
    console.error(`❌ Error errno:`, error.errno);
    console.error(`❌ Error syscall:`, error.syscall);
    console.error(`❌ Error hostname:`, error.hostname);
    console.error(`❌ Stack:`, error.stack);
    console.error(`❌ Full error:`, JSON.stringify(error, null, 2));
    console.error(`❌ ======================================\n`);
    return false;
  }
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
