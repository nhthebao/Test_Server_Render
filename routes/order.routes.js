const express = require("express");
const router = express.Router();

// ============================================
// ORDERS API
// ============================================

// 🔹 Create new order
router.post("/", async (req, res) => {
  try {
    const {
      id,
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

    const Order = require("../server").Order;
    const orderId =
      id || `DH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
    console.log(`   User ID: ${userId} (type: ${typeof userId})`);
    console.log(`   Items: ${items.length}`);
    console.log(`   Amount: ${finalAmount} VND`);
    console.log(`   Payment Method: ${paymentMethod}`);

    const User = require("../server").User;
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

// 🔹 Get all orders with filters
router.get("/", async (req, res) => {
  try {
    const { userId, status, paymentStatus, page = 1, limit = 50 } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    let query = { userId };

    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;

    const Order = require("../server").Order;
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

// 🔹 Get all orders (Admin only)
router.get("/all", async (req, res) => {
  try {
    const { status, paymentStatus, userId, page = 1, limit = 10 } = req.query;

    let query = {};

    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (userId) query.userId = userId;

    const Order = require("../server").Order;
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

// 🔹 Get order by ID
router.get("/:id", async (req, res) => {
  try {
    const Order = require("../server").Order;
    const order = await Order.findOne({ id: req.params.id });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Update order status
router.patch("/:id/status", async (req, res) => {
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

    const Order = require("../server").Order;
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

// 🔹 Update payment status
router.patch("/:id/payment", async (req, res) => {
  try {
    const { paymentStatus } = req.body;

    const validPaymentStatuses = ["unpaid", "paid", "refunded"];
    if (!validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({ message: "❌ Invalid payment status" });
    }

    const Order = require("../server").Order;
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

// 🔹 Update order info (address, notes)
router.put("/:id", async (req, res) => {
  try {
    const Order = require("../server").Order;
    const order = await Order.findOne({ id: req.params.id });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

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

// 🔹 Cancel order
router.delete("/:id", async (req, res) => {
  try {
    const Order = require("../server").Order;
    const order = await Order.findOne({ id: req.params.id });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

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

// 🔹 Get user's order history
router.get("/user/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(
      `📦 [GET /orders/user/:userId] Fetching orders for user: ${userId}`
    );
    console.log(`   userId length: ${userId.length}, type: ${typeof userId}`);

    const Order = require("../server").Order;
    const orders = await Order.find({ userId: userId })
      .sort({ createdAt: -1 })
      .maxTimeMS(10000);

    console.log(
      `📥 [GET /orders/user/:userId] Found ${orders.length} orders for user ${userId}`
    );

    if (orders.length > 0) {
      console.log("📋 First 3 orders:");
      orders.slice(0, 3).forEach((order, idx) => {
        console.log(
          `  ${idx + 1}. ${order.id} - ${order.status} - ${order.paymentStatus}`
        );
      });
    } else {
      const totalOrders = await Order.countDocuments();
      console.log(`⚠️ No orders found for userId: "${userId}"`);
      console.log(`📊 Total orders in database: ${totalOrders}`);

      if (totalOrders > 0) {
        const sampleOrders = await Order.find({})
          .limit(5)
          .select("id userId")
          .lean();
        console.log(`📋 Sample orders (first 5):`);
        sampleOrders.forEach((o, idx) => {
          console.log(
            `  ${idx + 1}. Order ID: ${o.id}, User ID: "${o.userId}" (length: ${
              o.userId?.length
            })`
          );
        });
      }
    }

    res.json({ orders, total: orders.length });
  } catch (err) {
    console.error("❌ [GET /orders/user/:userId] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Get order statistics
router.get("/stats/summary", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "❌ User ID is required" });
    }

    const Order = require("../server").Order;
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

module.exports = router;
