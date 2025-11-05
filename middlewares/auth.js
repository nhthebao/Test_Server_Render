// middlewares/auth.js
const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.header("Authorization");
    if (!authHeader)
      return res
        .status(401)
        .json({ message: "❌ Missing Authorization header" });

    const token = authHeader.split(" ")[1];
    if (!token)
      return res.status(401).json({ message: "❌ No token provided" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ message: "❌ Invalid or expired token", error: err.message });
  }
}

module.exports = { verifyToken }; // named export that server expects
module.exports.default = verifyToken; // also assign default if someone requires default
