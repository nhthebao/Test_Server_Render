const admin = require("firebase-admin");

// tải file key JSON từ Firebase Console (Service Account)
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
