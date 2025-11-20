const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// ============================================
// PAYMENT ROUTES
// ============================================

// Middleware để xác thực API Key từ Sepay
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers["authorization"];
  const expectedApiKey = process.env.SEPAY_API_KEY || "thanhToanTrucTuyen";

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
router.post("/webhook/sepay", verifyApiKey, async (req, res) => {
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

    if (!id || !content) {
      console.log("❌ Missing required fields");
      return res.status(400).json({
        success: false,
        message: "❌ Invalid webhook data",
      });
    }

    if (transferType !== "in") {
      console.log(`⚠️ Ignoring transaction type: ${transferType}`);
      return res.status(200).json({
        success: true,
        message: "Transaction type not 'in'",
      });
    }

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

    let orderId = null;

    if (code) {
      orderId = code.replace(/-$/, "");
      console.log(`✅ Using 'code' field: ${orderId}`);
    }

    if (!orderId && content) {
      const orderIdMatch = content.match(/DH[\d-]+[a-z0-9]*/i);
      if (orderIdMatch) {
        orderId = orderIdMatch[0];
        console.log(`✅ Extracted order ID from content: ${orderId}`);
      }
    }

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

    const Order = require("../server").Order;
    let order = null;

    order = await Order.findOne({ id: orderId });
    if (order) {
      console.log(`✅ Found order by exact match: ${order.id}`);
    }

    if (!order) {
      console.log(`⚠️ Exact match not found, trying partial match...`);
      order = await Order.findOne({
        id: { $regex: new RegExp(`^${orderId.replace(/[-]/g, "\\-")}`, "i") },
      });
      if (order) {
        console.log(`✅ Found order by partial match: ${order.id}`);
      }
    }

    if (!order && orderId.startsWith("DH")) {
      console.log(`⚠️ Trying to find by short code pattern...`);
      const shortCode = orderId.replace(/^DH-?/, "");
      order = await Order.findOne({
        id: { $regex: new RegExp(`DH[\\-]?${shortCode}`, "i") },
      });
      if (order) {
        console.log(`✅ Found order by short code: ${order.id}`);
      }
    }

    if (!order) {
      console.log(`❌ Order not found: ${orderId}`);
      console.log(
        `📋 Total orders in database: ${await Order.countDocuments()}`
      );

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

    if (order.paymentStatus === "paid") {
      console.log(`⚠️ Order already paid: ${orderId}`);
      return res.status(200).json({
        success: true,
        message: "Order already paid",
        orderId: orderId,
      });
    }

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

    order.paymentStatus = "paid";
    order.status = order.status === "pending" ? "confirmed" : order.status;
    order.updatedAt = new Date().toISOString();

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
router.get("/status/:orderId", async (req, res) => {
  try {
    const orderId = req.params.orderId;
    console.log(
      `🔍 [GET /payment/status] Checking payment for order: ${orderId}`
    );

    if (!orderId || orderId.length < 3) {
      console.log(`❌ [GET /payment/status] Invalid orderId: ${orderId}`);
      return res.status(400).json({
        success: false,
        message: "Invalid order ID format",
      });
    }

    if (mongoose.connection.readyState !== 1) {
      console.error("❌ [GET /payment/status] MongoDB not connected!");
      return res.status(503).json({
        success: false,
        message: "Database connection unavailable",
      });
    }

    const Order = require("../server").Order;
    const order = await Order.findOne({ id: orderId }).maxTimeMS(5000).exec();

    if (!order) {
      console.log(`⚠️ [GET /payment/status] Order not found: ${orderId}`);

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

    res.status(500).json({
      success: false,
      error: err.message,
      type: err.name,
      orderId: req.params.orderId,
    });
  }
});

// 🔹 Tạo thông tin thanh toán (QR Code content)
router.post("/create", async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "❌ Order ID is required" });
    }

    const Order = require("../server").Order;
    const order = await Order.findOne({ id: orderId });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.paymentStatus === "paid") {
      return res.status(400).json({ message: "❌ Order already paid" });
    }

    const transferContent = `${order.id}`;

    const bankInfo = {
      bankName: process.env.BANK_NAME || "MBBank",
      accountNumber: process.env.BANK_ACCOUNT || "VQRQAFFXT3481",
      accountName: process.env.BANK_ACCOUNT_NAME || "THANH TOAN TRUC TUYEN",
      virtualAccount: process.env.BANK_ACCOUNT || "VQRQAFFXT3481",
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

module.exports = router;
