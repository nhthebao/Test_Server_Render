<div align="center">

# 🍔 GoBite - Food Delivery Backend API

## Backend Repository

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=flat&logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat&logo=express)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat&logo=mongodb)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**RESTful API backend cho ứng dụng đặt đồ ăn GoBite**

[Frontend Repo](https://github.com/nhthebao/foodDelivery-mobile-app) • [API Docs](#-api-endpoints) • [Báo cáo lỗi](https://github.com/nhthebao/Test_Server_Render/issues)

---

</div>

## 📋 Mục lục

- [Giới thiệu](#-giới-thiệu)
- [Tính năng](#-tính-năng)
- [Công nghệ & Thư viện](#-công-nghệ--thư-viện)
- [Kiến trúc API](#-kiến-trúc-api)
- [Cài đặt](#-cài-đặt)
- [Cấu hình](#-cấu-hình)
- [Chạy server](#-chạy-server)
- [Database Schema](#-database-schema)
- [API Endpoints](#-api-endpoints)
- [Deployment](#-deployment)

---

## 📱 Giới thiệu

**GoBite Backend** là RESTful API server được xây dựng với **Node.js/Express**, kết hợp **MongoDB Atlas** làm database và **Firebase Admin** để quản lý authentication. Server cung cấp các API endpoints đầy đủ cho ứng dụng mobile GoBite.

### Đặc điểm nổi bật

- 🚀 RESTful API với Express.js
- 🔐 Authentication với Firebase Admin SDK + JWT
- 💾 MongoDB Atlas cloud database
- 📧 Email service với SendGrid & Nodemailer
- 💳 Payment integration với Sepay
- 🔔 Webhook handling cho payment updates
- 🌐 CORS enabled cho cross-origin requests
- 📝 Request logging với Morgan
- ⚡ Production-ready với PM2
- 🔄 Auto-deploy với Render.com

---

## ✨ Tính năng

### 🔐 Authentication & User Management

- Đăng nhập/Đăng ký với Firebase token
- Xác thực JWT tokens
- Quên mật khẩu với OTP qua email (6 số, hết hạn sau 10 phút)
- Quản lý thông tin người dùng (CRUD)
- Upload và cập nhật ảnh đại diện
- Lưu lịch sử authProviders

### 🛒 Product Management (Desserts)

- CRUD operations cho món ăn
- Tìm kiếm theo tên, danh mục
- Quản lý reviews và ratings
- Upload hình ảnh sản phẩm
- Thông tin chi tiết (giá, mô tả, thời gian giao, discount)

### 🛍️ Shopping Cart

- Thêm món vào giỏ hàng
- Cập nhật số lượng
- Xóa món khỏi giỏ
- Tính tổng tiền tự động
- Lưu giỏ hàng theo user

### 💳 Payment Processing

- Tích hợp Sepay payment gateway
- QR code generation cho MoMo
- Webhook handler tự động cập nhật trạng thái
- Lưu paymentTransaction details
- Hỗ trợ COD (Cash on Delivery)
- Polling payment status

### 📦 Order Management

- Tạo đơn hàng với thông tin đầy đủ
- Cập nhật trạng thái (pending → confirmed → preparing → delivering → delivered)
- Cập nhật paymentStatus (unpaid → paid)
- Lịch sử đơn hàng theo userId
- Chi tiết đơn hàng (items, address, payment info)
- Thống kê đơn hàng

### 📧 Email Service

- Gửi OTP cho reset password (SendGrid)
- Gmail backup với Nodemailer
- Email templates
- Rate limiting để tránh spam

---

## 🛠 Công nghệ & Thư viện

### Core Framework

| Công nghệ      | Version | Mục đích                       |
| -------------- | ------- | ------------------------------ |
| **Node.js**    | 20.x    | JavaScript runtime environment |
| **Express.js** | ~4.21.2 | Web application framework      |
| **JavaScript** | ES6+    | Programming language           |

### Database & ODM

| Thư viện     | Version | Mục đích                           |
| ------------ | ------- | ---------------------------------- |
| **mongodb**  | ^6.12.0 | MongoDB native driver              |
| **mongoose** | ^8.10.0 | MongoDB Object Data Modeling (ODM) |

### Authentication & Security

| Thư viện           | Version | Mục đích                                 |
| ------------------ | ------- | ---------------------------------------- |
| **firebase-admin** | ^13.2.0 | Firebase Authentication & Admin SDK      |
| **jsonwebtoken**   | ^9.0.2  | JWT token generation & verification      |
| **bcrypt**         | ^5.1.1  | Password hashing algorithm               |
| **dotenv**         | ^16.4.7 | Environment variables management         |
| **cors**           | ^2.8.5  | Cross-Origin Resource Sharing middleware |

### Email Services

| Thư viện           | Version | Mục đích                               |
| ------------------ | ------- | -------------------------------------- |
| **@sendgrid/mail** | ^8.1.4  | SendGrid email API client              |
| **nodemailer**     | ^6.9.17 | Email sending library (Gmail fallback) |

### HTTP & API

| Thư viện              | Version | Mục đích                              |
| --------------------- | ------- | ------------------------------------- |
| **axios**             | ^1.7.9  | HTTP client cho external APIs (Sepay) |
| **body-parser**       | ^1.20.3 | Parse incoming request bodies         |
| **express-validator** | ^7.2.1  | Request validation middleware         |

### Utilities & Helpers

| Thư viện     | Version | Mục đích                       |
| ------------ | ------- | ------------------------------ |
| **morgan**   | ^1.10.0 | HTTP request logger middleware |
| **uuid**     | ^11.0.5 | UUID generation cho order IDs  |
| **date-fns** | ^4.1.0  | Date manipulation utilities    |

### Development Tools

| Thư viện    | Version | Mục đích                              |
| ----------- | ------- | ------------------------------------- |
| **nodemon** | ^3.1.9  | Auto-restart server khi code thay đổi |

---

## 📁 Kiến trúc API

```
Test_Server_Render/
│
├── routes/                    # API Routes
│   ├── auth.routes.js         # Authentication endpoints
│   ├── user.routes.js         # User management & cart
│   ├── dessert.routes.js      # Product CRUD
│   ├── order.routes.js        # Order management
│   └── payment.routes.js      # Payment & webhook
│
├── services/                  # Business Logic
│   └── email.service.js       # Email sending service
│
├── middlewares/               # Express Middlewares
│   └── auth.js                # JWT authentication middleware
│
├── firebase.js                # Firebase Admin SDK config
├── server.js                  # Main entry point
├── package.json               # Dependencies
├── .env                       # Environment variables (not in repo)
├── serviceAccountKey.json     # Firebase service account (not in repo)
└── README.md                  # Documentation
```

### Mô hình kiến trúc

```
┌─────────────────────────────────────────────────────────┐
│                   Mobile App (React Native)              │
└────────────────────┬────────────────────────────────────┘
                     │ HTTPS/REST API
                     ↓
┌─────────────────────────────────────────────────────────┐
│              Express.js Server (Node.js)                 │
├─────────────────────────────────────────────────────────┤
│  Routes Layer                                            │
│    ├── /auth/*        → Authentication                   │
│    ├── /users/*       → User management                  │
│    ├── /desserts/*    → Product management               │
│    ├── /orders/*      → Order management                 │
│    └── /payment/*     → Payment processing               │
├─────────────────────────────────────────────────────────┤
│  Middleware Layer                                        │
│    ├── CORS           → Cross-origin requests            │
│    ├── Auth           → JWT verification                 │
│    ├── Morgan         → Request logging                  │
│    └── Body Parser    → Parse request body               │
├─────────────────────────────────────────────────────────┤
│  Service Layer                                           │
│    ├── Email Service  → SendGrid/Gmail                   │
│    └── Firebase Admin → User verification                │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        ↓                         ↓
┌──────────────────┐    ┌──────────────────┐
│  MongoDB Atlas   │    │  External APIs   │
│   (Database)     │    │  - Firebase Auth │
│   - Users        │    │  - SendGrid      │
│   - Desserts     │    │  - Sepay         │
│   - Orders       │    │                  │
└──────────────────┘    └──────────────────┘
```

---

## 🚀 Cài đặt

### Yêu cầu hệ thống

- **Node.js**: v20.x hoặc mới hơn
- **npm** hoặc **yarn**: Package manager
- **MongoDB Atlas**: Cloud database account
- **Firebase**: Firebase project với Authentication enabled
- **Git**: Version control

### Clone repository

```bash
git clone https://github.com/nhthebao/Test_Server_Render.git
cd Test_Server_Render
```

### Cài đặt dependencies

```bash
npm install
# hoặc
yarn install
```

---

## ⚙️ Cấu hình

### 1. Tạo file `.env`

Tạo file `.env` ở thư mục root:

```env
# Server Configuration
PORT=10000
NODE_ENV=production

# MongoDB Atlas
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name?retryWrites=true&w=majority

# JWT Secret
JWT_SECRET=your_jwt_secret_key_here_make_it_long_and_random

# SendGrid Email Service
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=gobitefood@gmail.com

# Gmail Backup (for Nodemailer)
GMAIL_USER=gobitefood@gmail.com
GMAIL_PASS=your_gmail_app_password

# Sepay Payment Gateway
SEPAY_API_KEY=your_sepay_api_key
SEPAY_ACCOUNT_NUMBER=your_bank_account_number
SEPAY_BANK_CODE=MB

# Firebase (optional, nếu cần)
FIREBASE_PROJECT_ID=your_firebase_project_id
```

### 2. Cấu hình Firebase Admin SDK

1. Vào [Firebase Console](https://console.firebase.google.com/)
2. Chọn project → **Project Settings** → **Service Accounts**
3. Click **Generate new private key**
4. Download file JSON và rename thành `serviceAccountKey.json`
5. Copy file vào thư mục root của project

**Lưu ý**: File `serviceAccountKey.json` chứa thông tin nhạy cảm, đã được thêm vào `.gitignore`.

### 3. Cấu hình MongoDB Atlas

1. Tạo cluster tại [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Tạo database user với quyền read/write
3. Whitelist IP address (hoặc `0.0.0.0/0` cho development)
4. Copy connection string vào `MONGO_URI` trong `.env`

### 4. Cấu hình SendGrid

1. Đăng ký tại [SendGrid](https://sendgrid.com/)
2. Tạo API key với **Mail Send** permissions
3. Verify sender email
4. Copy API key vào `.env`

---

## 🏃 Chạy server

### Development mode (với nodemon)

```bash
npm run dev
# hoặc
nodemon server.js
```

### Production mode

```bash
npm start
# hoặc
node server.js
```

### Chạy với PM2 (Production)

```bash
# Install PM2 globally
npm install -g pm2

# Start server
pm2 start server.js --name "gobite-api"

# View logs
pm2 logs gobite-api

# Monitor
pm2 monit

# Restart
pm2 restart gobite-api

# Stop
pm2 stop gobite-api
```

Server sẽ chạy tại: `http://localhost:10000`

---

## 💾 Database Schema

### Users Collection

```javascript
{
  id: String,              // Firebase UID (unique)
  fullName: String,        // Tên đầy đủ
  username: String,        // Tên đăng nhập
  email: String,           // Email (unique)
  phone: String,           // Số điện thoại
  address: String,         // Địa chỉ
  image: String,           // URL ảnh đại diện
  paymentMethod: String,   // "cod" hoặc "momo"
  authProviders: [String], // ["email", "google"]
  favorite: [String],      // Array of dessert IDs
  cart: [{
    item: String,          // Dessert ID
    quantity: Number       // Số lượng
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### Desserts Collection

```javascript
{
  id: String,              // Unique ID
  name: String,            // Tên món
  rating: Number,          // Đánh giá (0-5)
  price: Number,           // Giá (USD)
  category: String,        // Danh mục
  discount: Number,        // % giảm giá
  deliveryTime: String,    // Thời gian giao
  image: String,           // URL hình ảnh
  description: String,     // Mô tả chi tiết
  freeDelivery: Boolean,   // Miễn phí ship
  review: [{
    idUser: String,        // User ID
    content: String,       // Nội dung review
    rating: Number,        // Đánh giá (1-5)
    date: Date            // Ngày review
  }]
}
```

### Orders Collection

```javascript
{
  id: String,              // Order code (VD: DH102969)
  _id: ObjectId,           // MongoDB ID
  userId: String,          // Firebase UID
  items: [{
    dessertId: String,     // ID món ăn
    dessertName: String,   // Tên món
    price: Number,         // Giá
    quantity: Number       // Số lượng
  }],
  totalAmount: Number,     // Tổng tiền trước phí
  discount: Number,        // Giảm giá
  deliveryFee: Number,     // Phí ship
  finalAmount: Number,     // Tổng tiền cuối
  paymentMethod: String,   // "momo" hoặc "cod"
  deliveryAddress: {
    fullAddress: String,   // Địa chỉ đầy đủ
    phone: String,         // SĐT người nhận
    note: String          // Ghi chú (optional)
  },
  estimatedDeliveryTime: Date,
  status: String,          // "pending", "confirmed", "preparing",
                          // "delivering", "delivered", "cancelled"
  paymentStatus: String,   // "unpaid", "paid", "refunded"
  paymentTransaction: {
    transactionId: String,
    gateway: String,
    transactionDate: Date,
    amount: Number,
    referenceNumber: String,
    bankBrand: String,
    content: String,
    description: String,
    subAccount: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🔌 API Endpoints

### Base URL

```
Production: https://food-delivery-mobile-app.onrender.com
Development: http://localhost:10000
```

### Authentication Routes (`/auth`)

| Method | Endpoint                           | Description                  | Auth Required |
| ------ | ---------------------------------- | ---------------------------- | ------------- |
| POST   | `/auth/login`                      | Đăng nhập với Firebase token | ❌            |
| GET    | `/auth/me`                         | Lấy thông tin user hiện tại  | ✅            |
| POST   | `/auth/logout`                     | Đăng xuất                    | ✅            |
| POST   | `/auth/password/request-reset`     | Yêu cầu reset mật khẩu       | ❌            |
| POST   | `/auth/password/verify-reset-code` | Xác thực OTP                 | ❌            |
| POST   | `/auth/password/change-password`   | Đổi mật khẩu                 | ❌            |

#### POST `/auth/login`

**Request Body:**

```json
{
  "firebaseToken": "firebase_id_token_here"
}
```

**Response:**

```json
{
  "token": "jwt_token",
  "user": {
    "id": "firebase_uid",
    "email": "user@example.com",
    "fullName": "Nguyễn Văn A"
  }
}
```

#### POST `/auth/password/request-reset`

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "message": "OTP đã được gửi đến email của bạn",
  "expiresIn": "10 phút"
}
```

---

### User Routes (`/users`)

| Method | Endpoint                  | Description                | Auth Required |
| ------ | ------------------------- | -------------------------- | ------------- |
| GET    | `/users`                  | Lấy danh sách users        | ✅            |
| GET    | `/users/:id`              | Lấy thông tin user theo ID | ✅            |
| POST   | `/users`                  | Tạo user mới               | ❌            |
| PUT    | `/users/:id`              | Cập nhật thông tin user    | ✅            |
| DELETE | `/users/:id`              | Xóa user                   | ✅            |
| GET    | `/users/:id/cart`         | Lấy giỏ hàng               | ✅            |
| POST   | `/users/:id/cart`         | Thêm món vào giỏ           | ✅            |
| PUT    | `/users/:id/cart/:itemId` | Cập nhật số lượng          | ✅            |
| DELETE | `/users/:id/cart/:itemId` | Xóa món khỏi giỏ           | ✅            |

#### POST `/users/:id/cart`

**Request Body:**

```json
{
  "item": "dessert_id_here",
  "quantity": 2
}
```

---

### Dessert Routes (`/desserts`)

| Method | Endpoint        | Description      | Auth Required |
| ------ | --------------- | ---------------- | ------------- |
| GET    | `/desserts`     | Danh sách món ăn | ❌            |
| GET    | `/desserts/:id` | Chi tiết món ăn  | ❌            |
| POST   | `/desserts`     | Tạo món ăn mới   | ✅            |
| PUT    | `/desserts/:id` | Cập nhật món ăn  | ✅            |
| DELETE | `/desserts/:id` | Xóa món ăn       | ✅            |

---

### Order Routes (`/orders`)

| Method | Endpoint                | Description           | Auth Required |
| ------ | ----------------------- | --------------------- | ------------- |
| POST   | `/orders`               | Tạo đơn hàng mới      | ✅            |
| GET    | `/orders/user/:userId`  | Lấy đơn hàng của user | ✅            |
| GET    | `/orders/:id`           | Chi tiết đơn hàng     | ✅            |
| PATCH  | `/orders/:id/status`    | Cập nhật trạng thái   | ✅            |
| PATCH  | `/orders/:id/payment`   | Cập nhật thanh toán   | ✅            |
| GET    | `/orders/stats/summary` | Thống kê đơn hàng     | ✅            |

#### POST `/orders`

**Request Body:**

```json
{
  "id": "DH102969",
  "userId": "firebase_uid",
  "items": [
    {
      "dessertId": "D001",
      "dessertName": "Bánh Flan",
      "price": 5.99,
      "quantity": 2
    }
  ],
  "totalAmount": 11.98,
  "discount": 0,
  "deliveryFee": 0,
  "finalAmount": 11.98,
  "paymentMethod": "cod",
  "deliveryAddress": {
    "fullAddress": "123 Đường ABC, Quận 1, TP.HCM",
    "phone": "0123456789"
  }
}
```

---

### Payment Routes (`/payment`)

| Method | Endpoint                   | Description                    | Auth Required |
| ------ | -------------------------- | ------------------------------ | ------------- |
| POST   | `/payment/webhook/sepay`   | Webhook từ Sepay               | ❌            |
| GET    | `/payment/status/:orderId` | Kiểm tra trạng thái thanh toán | ✅            |

#### POST `/payment/webhook/sepay`

**Webhook payload từ Sepay:**

```json
{
  "gateway": "MB",
  "transactionDate": "2024-01-01 10:30:00",
  "accountNumber": "0123456789",
  "subAccount": "DH102969",
  "amountIn": 316800,
  "content": "DH102969 thanh toan don hang",
  "referenceNumber": "FT24001123456",
  "bankBrand": "MB"
}
```

---

## 🚀 Deployment

### Deploy lên Render.com

1. **Tạo tài khoản Render**: [render.com](https://render.com)

2. **Tạo Web Service mới**:

   - Click **New** → **Web Service**
   - Connect GitHub repository
   - Chọn branch `main`

3. **Cấu hình Build & Deploy**:

   ```
   Name: food-delivery-api
   Environment: Node
   Build Command: npm install
   Start Command: node server.js
   ```

4. **Thêm Environment Variables**:

   - Vào **Environment** tab
   - Thêm tất cả biến từ file `.env`

5. **Deploy**:

   - Click **Create Web Service**
   - Render sẽ tự động build và deploy

6. **Auto-deploy**:
   - Mỗi lần push code lên GitHub, Render tự động redeploy

---

## 📝 Notes & Best Practices

### Security

- ✅ JWT tokens expire sau 24h
- ✅ OTP expire sau 10 phút
- ✅ Passwords được hash với bcrypt
- ✅ Firebase tokens được verify trước khi tạo JWT
- ✅ CORS configured cho production domain
- ⚠️ File `serviceAccountKey.json` không được commit lên Git

### Performance

- ✅ MongoDB indexes trên `id`, `email`, `userId`
- ✅ Connection pooling cho MongoDB
- ✅ Request logging với Morgan
- ✅ Gzip compression enabled

### Error Handling

- ✅ Try-catch blocks trong tất cả async functions
- ✅ Consistent error responses
- ✅ HTTP status codes chuẩn
- ✅ Error logging

---

## 🤝 Đóng góp

Chúng tôi luôn chào đón mọi đóng góp! Vui lòng:

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Mở Pull Request

---

## 👥 Team

**Nhóm 6 - Backend Development**

| Họ tên               | MSSV     | Email                  |
| -------------------- | -------- | ---------------------- |
| Nguyễn Huỳnh Thế Bảo | 22690761 | 22690761@gm.uit.edu.vn |
| Nguyễn Tấn Nghị      | 22685461 | 22685461@gm.uit.edu.vn |
| Nguyễn Hoài Nhân     | 22689531 | 22689531@gm.uit.edu.vn |

---

## 📞 Liên hệ

- **Email**: gobitefood@gmail.com
- **Frontend**: [nhthebao/foodDelivery-mobile-app](https://github.com/nhthebao/foodDelivery-mobile-app)
- **Backend**: [nhthebao/Test_Server_Render](https://github.com/nhthebao/Test_Server_Render)

---

## 📄 License

MIT License - xem file [LICENSE](LICENSE) để biết thêm chi tiết.

---

## 🙏 Lời cảm ơn

- [Express.js](https://expressjs.com/) - Fast, unopinionated web framework
- [MongoDB Atlas](https://www.mongodb.com/atlas) - Cloud database service
- [Firebase](https://firebase.google.com/) - Authentication platform
- [SendGrid](https://sendgrid.com/) - Email delivery service
- [Render.com](https://render.com/) - Cloud hosting platform
- Tất cả các open-source contributors

---

<div align="center">

**Được phát triển với ❤️ bởi Nhóm 6**

⭐ Star repo này nếu bạn thấy hữu ích!

</div>
