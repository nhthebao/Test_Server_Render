const express = require("express");
const router = express.Router();
const admin = require("../firebase");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const { verifyToken } = require("../middlewares/auth");
const { sendPasswordResetEmail } = require("../services/email.service");

// Global variable for reset sessions (shared across the app)
const resetSessions = {};

// ============================================
// AUTH ROUTES
// ============================================

// 🔹 LOGIN or REGISTER (Firebase token)
router.post("/login", async (req, res) => {
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

    const User = require("../server").User;
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

// 🔹 Get current user info
router.get("/me", verifyToken, async (req, res) => {
  try {
    const User = require("../server").User;
    const user = await User.findOne({ id: req.user.id });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 LOGOUT
router.post("/logout", verifyToken, async (req, res) => {
  try {
    res.json({ message: "✅ Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Update profile
router.put("/update-profile", verifyToken, async (req, res) => {
  try {
    const User = require("../server").User;
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

// 🔹 Delete account
router.delete("/delete", verifyToken, async (req, res) => {
  try {
    const User = require("../server").User;
    const user = await User.findOneAndDelete({ id: req.user.id });
    if (!user) return res.status(404).json({ message: "User not found" });

    await admin.auth().deleteUser(req.user.id);

    res.json({ message: "🗑️ Account deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Refresh JWT token
router.post("/refresh-token", async (req, res) => {
  try {
    const { firebaseToken } = req.body;

    const decoded = await admin.auth().verifyIdToken(firebaseToken);
    const uid = decoded.uid;

    const User = require("../server").User;
    const user = await User.findOne({ id: uid });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User không tồn tại",
      });
    }

    const newToken = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      success: true,
      token: newToken,
      expiresIn: 3600,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================
// PASSWORD RESET ROUTES
// ============================================

// 🔹 Request password reset
router.post("/password/request-reset", async (req, res) => {
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

    const User = require("../server").User;
    let query = {};
    if (method === "email") {
      query.email = identifier.toLowerCase();
    } else {
      let normalizedPhone = identifier.trim();
      if (!normalizedPhone.startsWith("+")) {
        if (normalizedPhone.startsWith("0")) {
          normalizedPhone = "+84" + normalizedPhone.substring(1);
        } else {
          normalizedPhone = "+84" + normalizedPhone;
        }
      }

      query = {
        $or: [{ phone: identifier }, { phone: normalizedPhone }],
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

    // EMAIL METHOD
    if (method === "email") {
      try {
        console.log(`\n📧 ========== EMAIL RESET REQUEST ==========`);
        console.log(`📧 Timestamp: ${new Date().toISOString()}`);
        console.log(`📧 User email: ${user.email}`);

        const temporaryToken = jwt.sign(
          {
            userId: user._id,
            email: user.email,
            purpose: "password_reset",
            resetId,
          },
          process.env.JWT_SECRET,
          { expiresIn: "30m" }
        );

        resetSessions[resetId] = {
          email: user.email,
          userId: user._id,
          method: "email",
          temporaryToken,
          expiresAt: Date.now() + 30 * 60 * 1000,
          verified: true,
        };

        const resetLink = `${
          process.env.APP_URL || "https://food-delivery-mobile-app.onrender.com"
        }/reset-password?token=${temporaryToken}`;

        console.log(`🔗 Reset link: ${resetLink}`);
        console.log(`⏰ Expires in: 30 minutes`);

        const emailSent = await sendPasswordResetEmail(user.email, resetLink);

        if (!emailSent) {
          delete resetSessions[resetId];
          return res.status(500).json({
            success: false,
            message: "❌ Không thể gửi email. Vui lòng thử lại sau.",
          });
        }

        console.log(`✅ Reset email sent to ${user.email}`);
        console.log(`📧 ========================================\n`);

        return res.json({
          success: true,
          message: "✅ Email reset đã được gửi",
          resetId,
        });
      } catch (firebaseError) {
        console.error("❌ Firebase email error:", firebaseError);
        delete resetSessions[resetId];
        return res.status(500).json({
          success: false,
          message: "❌ Lỗi khi gửi email reset",
          error: firebaseError.message,
        });
      }
    }

    // PHONE METHOD
    if (method === "phone") {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      console.log(`\n📱 ========== PHONE OTP RESET REQUEST ==========`);
      console.log(`📱 Timestamp: ${new Date().toISOString()}`);
      console.log(`📱 User phone: ${user.phone}`);
      console.log(`📱 User email: ${user.email}`);
      console.log(`📱 Generated OTP: ${otp}`);

      resetSessions[resetId] = {
        phone: user.phone,
        userId: user._id,
        email: user.email,
        method: "phone",
        otp: otp,
        expiresAt: Date.now() + 10 * 60 * 1000,
        attempts: 0,
        verified: false,
      };

      try {
        console.log(`📱 Sending OTP via SMS...`);
        console.log(`📱 Phone: ${user.phone}`);
        console.log(`📱 OTP: ${otp}`);
        console.log(`📱 ====================================\n`);

        return res.json({
          success: true,
          message: "✅ OTP đã được gửi qua SMS",
          resetId,
          debug: {
            phone: user.phone,
            otp: otp,
          },
        });
      } catch (phoneError) {
        console.error("❌ Phone SMS error:", phoneError);
        delete resetSessions[resetId];
        return res.status(500).json({
          success: false,
          message: "❌ Lỗi khi gửi OTP",
          error: phoneError.message,
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
router.post("/password/verify-reset-code", async (req, res) => {
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

    if (session.method !== "phone") {
      return res.status(400).json({
        success: false,
        message: "❌ Verification not needed for this method",
      });
    }

    if (Date.now() > session.expiresAt) {
      delete resetSessions[resetId];
      return res.status(401).json({
        success: false,
        message: "❌ Reset code hết hạn. Vui lòng yêu cầu lại.",
      });
    }

    if (session.attempts >= 5) {
      delete resetSessions[resetId];
      return res.status(429).json({
        success: false,
        message: "❌ Quá nhiều lần thử. Vui lòng yêu cầu reset lại.",
      });
    }

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
      { expiresIn: "15m" }
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
router.post("/password/change-password", async (req, res) => {
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

    const session = resetSessions[decoded.resetId];
    if (!session) {
      return res.status(401).json({
        success: false,
        message: "❌ Reset session không còn hợp lệ",
      });
    }

    if (session.method === "phone" && !session.verified) {
      return res.status(401).json({
        success: false,
        message: "❌ Phone OTP not verified",
      });
    }

    try {
      console.log(`🔄 Updating Firebase password for email: ${decoded.email}`);

      const firebaseUser = await admin.auth().getUserByEmail(decoded.email);

      await admin.auth().updateUser(firebaseUser.uid, {
        password: newPassword,
      });
      console.log(`✅ Password updated for Firebase user ${firebaseUser.uid}`);
    } catch (firebaseErr) {
      console.warn("⚠️ Firebase update failed:", firebaseErr.message);
    }

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

// 🔹 Change password (Logged In User)
router.post("/password/change-logged-in", verifyToken, async (req, res) => {
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

    const User = require("../server").User;
    const user = await User.findOne({ id: userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "❌ User không tồn tại",
      });
    }

    console.log("📝 User found:", user.email);

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

      console.log("📋 Full Firebase Response:", JSON.stringify(data, null, 2));

      console.log("✅ Old password verified for:", user.email);

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
        return res.status(401).json({
          success: false,
          message: "❌ Mật khẩu cũ không đúng",
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

module.exports = router;
