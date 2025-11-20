const express = require("express");
const router = express.Router();

// ============================================
// USER ROUTES
// ============================================

// 🔹 Get all users or filter by email/username
router.get("/", async (req, res) => {
  try {
    const { email, username } = req.query;
    let query = {};

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

    const User = require("../server").User;
    const users = await User.find(query);
    console.log(`📊 [GET /users] Found ${users.length} user(s)`);

    if (users.length > 0) {
      users.forEach((u, idx) => {
        console.log(
          `  ${idx + 1}. username: "${u.username}", email: "${
            u.email
          }", phone: "${u.phone}"`
        );
      });
    }

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

// 🔹 Get user by ID
router.get("/:id", async (req, res) => {
  try {
    const User = require("../server").User;
    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Create new user
router.post("/", async (req, res) => {
  try {
    const User = require("../server").User;
    const newUser = new User(req.body);
    await newUser.save();
    res.status(201).json(newUser);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 🔹 Update user info
router.put("/:id", async (req, res) => {
  try {
    const User = require("../server").User;
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
// CART ROUTES
// ============================================

// 🔹 Get user's cart
router.get("/:id/cart", async (req, res) => {
  try {
    const User = require("../server").User;
    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user.cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Add item to cart
router.post("/:id/cart", async (req, res) => {
  try {
    const { item, quantity } = req.body;
    if (!item || !quantity)
      return res
        .status(400)
        .json({ message: "Item and quantity are required" });

    const User = require("../server").User;
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

// 🔹 Update cart item quantity
router.put("/:id/cart/:itemId", async (req, res) => {
  try {
    const { quantity } = req.body;
    if (quantity < 0)
      return res
        .status(400)
        .json({ message: "❌ Quantity cannot be negative" });

    const User = require("../server").User;
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

// 🔹 Remove item from cart
router.delete("/:id/cart/:itemId", async (req, res) => {
  try {
    const User = require("../server").User;
    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.cart = user.cart.filter((c) => c.item !== req.params.itemId);
    await user.save();

    res.json({ message: "🗑️ Item removed from cart", cart: user.cart });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
