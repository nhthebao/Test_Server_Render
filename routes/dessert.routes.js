const express = require("express");
const router = express.Router();

// ============================================
// DESSERTS CRUD
// ============================================

// 🔹 Get all desserts
router.get("/", async (req, res) => {
  try {
    const Dessert = require("../server").Dessert;
    const desserts = await Dessert.find();
    res.json(desserts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Get dessert by ID
router.get("/:id", async (req, res) => {
  try {
    const Dessert = require("../server").Dessert;
    const dessert = await Dessert.findOne({ id: req.params.id });
    if (!dessert) return res.status(404).json({ message: "Dessert not found" });
    res.json(dessert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔹 Create new dessert
router.post("/", async (req, res) => {
  try {
    const Dessert = require("../server").Dessert;
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

// 🔹 Update dessert
router.put("/:id", async (req, res) => {
  try {
    const Dessert = require("../server").Dessert;
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

// 🔹 Delete dessert
router.delete("/:id", async (req, res) => {
  try {
    const Dessert = require("../server").Dessert;
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

module.exports = router;
