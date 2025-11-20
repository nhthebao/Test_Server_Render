const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

const resetSessions = {}; // Store temporary reset sessions

// ============================================
// NOTE: This file has been refactored!
// Routes have been moved to separate files in ./routes/
// Email service has been moved to ./services/email.service.js
// ============================================

// ============================================
// KẾT NỐI MONGODB ATLAS
// ============================================
mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
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
    authProviders: { type: [String], default: ["firebase"] },
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

const User = mongoose.model("User", UserSchema);
const Dessert = mongoose.model("Dessert", DessertSchema);
const Order = mongoose.model("Order", OrderSchema);

// Export models for use in route files
module.exports.User = User;
module.exports.Dessert = Dessert;
module.exports.Order = Order;

// ============================================
// IMPORT ROUTES
// ============================================
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const dessertRoutes = require("./routes/dessert.routes");
const orderRoutes = require("./routes/order.routes");
const paymentRoutes = require("./routes/payment.routes");

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
// USE ROUTES
// ============================================
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/desserts", dessertRoutes);
app.use("/orders", orderRoutes);
app.use("/payment", paymentRoutes);

// ============================================
// RUN SERVER
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`Server running on port ${PORT}`)
);
