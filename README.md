# 🍰 Food Delivery Mobile App

## 👥 Nhóm 6

### Thành viên:

1. **Nguyễn Văn A** - MSSV: 21xxxxx
2. **Trần Thị B** - MSSV: 21xxxxx
3. **Lê Văn C** - MSSV: 21xxxxx

---

## 📱 Giới thiệu dự án

Food Delivery Mobile App là ứng dụng đặt đồ ăn trên di động được xây dựng bằng **React Native** và **Expo**, kết hợp với backend **Node.js/Express** và cơ sở dữ liệu **MongoDB Atlas**. Ứng dụng cung cấp trải nghiệm mua sắm đồ ăn trực tuyến hoàn chỉnh với các tính năng hiện đại.

---

## ✨ Tính năng chính

### 🔐 Xác thực & Quản lý người dùng

- Đăng nhập/Đăng ký qua Firebase Authentication
- Quên mật khẩu với xác thực OTP qua email
- Quản lý thông tin cá nhân (tên, email, số điện thoại, địa chỉ)
- Upload và cập nhật ảnh đại diện

### 🛒 Mua sắm

- Duyệt danh sách món ăn với hình ảnh và mô tả chi tiết
- Tìm kiếm và lọc món ăn theo danh mục
- Thêm/xóa món ăn vào giỏ hàng
- Quản lý số lượng sản phẩm trong giỏ
- Danh sách yêu thích (Favorites)

### 💳 Thanh toán

- Tích hợp thanh toán qua Sepay (chuyển khoản ngân hàng) và thanh toán trực tiếp
- Webhook tự động cập nhật trạng thái thanh toán
- Quản lý phương thức thanh toán

### 📦 Quản lý đơn hàng

- Theo dõi trạng thái đơn hàng real-time
- Lịch sử đơn hàng
- Thông báo cập nhật trạng thái đơn hàng
! Vì nhóm chúng em chưa làm được map nên phần đơn hàng chỉ làm tới bước thanh toán thành công và cập nhật trạng thái đơn hàng sau khi đã thanh toán.
### 🤖 AI Assistant

- Tích hợp AI chatbot hỗ trợ khách hàng
- Gợi ý món ăn thông minh

---

## 🏗️ Kiến trúc hệ thống

### Frontend (Mobile App)

- **Framework**: React Native với Expo SDK
- **Navigation**: Expo Router (file-based routing)
- **State Management**: React Context API
- **Database**: SQLite (offline storage)
- **Authentication**: Firebase Admin SDK
- **UI Components**: Custom components với React Native

### Backend (Server)

- **Runtime**: Node.js v20.x
- **Framework**: Express.js
- **Database**: MongoDB Atlas
- **ODM**: Mongoose
- **Authentication**: JWT + Firebase Admin
- **Email Service**: SendGrid & Nodemailer
- **Payment Gateway**: Sepay API

---

## 📂 Cấu trúc thư mục

```
TeamProject/
│
├── foodDelivery-mobile-app/          # Mobile App (React Native + Expo)
│   ├── app/                          # Screens & Navigation
│   │   ├── (tabs)/                   # Tab-based screens
│   │   ├── login-signUp/             # Authentication screens
│   │   ├── forgot-password/          # Password recovery flow
│   │   ├── order-process/            # Order tracking screens
│   │   ├── payment/                  # Payment screens
│   │   └── profile/                  # User profile screens
│   │
│   ├── components/                   # Reusable UI components
│   ├── context/                      # React Context (state management)
│   ├── services/                     # API & Firebase services
│   ├── constants/                    # Theme & constants
│   ├── hooks/                        # Custom React hooks
│   └── assets/                       # Images, icons, fonts
│
└── Test_Server_Render/               # Backend Server (Node.js + Express)
    ├── routes/                       # API routes (modular structure)
    │   ├── auth.routes.js            # Authentication endpoints
    │   ├── user.routes.js            # User CRUD & cart
    │   ├── dessert.routes.js         # Product/dessert management
    │   ├── order.routes.js           # Order management
    │   └── payment.routes.js         # Payment & webhook
    │
    ├── services/                     # Business logic services
    │   └── email.service.js          # Email sending service
    │
    ├── middlewares/                  # Express middlewares
    │   └── auth.js                   # JWT verification
    │
    ├── firebase.js                   # Firebase Admin config
    └── server.js                     # Main server entry point
```

---

## 🚀 Cài đặt và chạy dự án

### Yêu cầu hệ thống

- Node.js v20.x trở lên
- npm hoặc yarn
- Expo CLI
- Android Studio hoặc Xcode (để chạy emulator)
- MongoDB Atlas account

### 1️⃣ Clone repository

```bash
git clone https://github.com/nhthebao/foodDelivery-mobile-app.git
cd TeamProject
```

### 2️⃣ Cài đặt Backend

```bash
cd Test_Server_Render
npm install
```

Tạo file `.env` với nội dung:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
SENDGRID_API_KEY=your_sendgrid_api_key
GMAIL_USER=your_gmail_address
GMAIL_PASS=your_gmail_app_password
SEPAY_API_KEY=your_sepay_api_key
PORT=10000
```

Chạy server:

```bash
node server.js
```

### 3️⃣ Cài đặt Mobile App

```bash
cd foodDelivery-mobile-app
npm install
```

Tạo file `.env` trong thư mục `ENV/`:

```env
EXPO_PUBLIC_API_URL=http://your-server-url:10000
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
```

Chạy app:

```bash
npx expo start
```

---

## 🔧 Công nghệ sử dụng

### Mobile App

| Công nghệ    | Mục đích                    |
| ------------ | --------------------------- |
| React Native | Framework phát triển mobile |
| Expo         | Toolchain và SDK            |
| Expo Router  | File-based navigation       |
| Firebase     | Authentication              |
| SQLite       | Local database              |
| Axios        | HTTP client                 |
| TypeScript   | Type safety                 |

### Backend

| Công nghệ      | Mục đích                   |
| -------------- | -------------------------- |
| Express.js     | Web framework              |
| MongoDB        | NoSQL database             |
| Mongoose       | ODM cho MongoDB            |
| JWT            | Token-based authentication |
| Firebase Admin | User management            |
| SendGrid       | Email service              |
| Nodemailer     | SMTP email                 |
| Sepay          | Payment gateway            |

---

## 📊 Database Schema

### Users Collection

- id, fullName, username, email, phone, address
- authProviders[], paymentMethod, image
- favorite[], cart[]
- createdAt, updatedAt

### Desserts Collection

- id, name, rating, price, category
- discount, reviews, deliveryTime
- image, description, freeDelivery
- review[] (nested: idUser, content, rating, date)

### Orders Collection

- id, userId, items[]
- totalAmount, discount, deliveryFee, finalAmount
- status, paymentMethod, paymentStatus
- deliveryAddress {fullAddress, phone, note}
- paymentTransaction {}
- estimatedDeliveryTime
- createdAt, updatedAt

---

## 🔐 API Endpoints

### Authentication

- `POST /auth/login` - Đăng nhập với Firebase token
- `GET /auth/me` - Lấy thông tin user hiện tại
- `POST /auth/logout` - Đăng xuất
- `POST /auth/password/request-reset` - Yêu cầu reset mật khẩu
- `POST /auth/password/verify-reset-code` - Xác thực OTP
- `POST /auth/password/change-password` - Đổi mật khẩu

### Users

- `GET /users` - Lấy danh sách users
- `GET /users/:id` - Lấy thông tin user theo ID
- `GET /users/:id/cart` - Lấy giỏ hàng
- `POST /users/:id/cart` - Thêm món vào giỏ
- `PUT /users/:id/cart/:itemId` - Cập nhật số lượng
- `DELETE /users/:id/cart/:itemId` - Xóa món khỏi giỏ

### Desserts

- `GET /desserts` - Lấy danh sách món ăn
- `GET /desserts/:id` - Chi tiết món ăn
- `POST /desserts` - Tạo món ăn mới
- `PUT /desserts/:id` - Cập nhật món ăn
- `DELETE /desserts/:id` - Xóa món ăn

### Orders

- `POST /orders` - Tạo đơn hàng mới
- `GET /orders/user/:userId` - Lấy đơn hàng của user
- `GET /orders/:id` - Chi tiết đơn hàng
- `PATCH /orders/:id/status` - Cập nhật trạng thái
- `PATCH /orders/:id/payment` - Cập nhật thanh toán
- `GET /orders/stats/summary` - Thống kê đơn hàng

### Payment

- `POST /payment/webhook/sepay` - Webhook Sepay
- `GET /payment/status/:orderId` - Kiểm tra trạng thái thanh toán

---

## 🐛 Known Issues & Future Improvements

### Cần cải thiện:

- [ ] Thêm push notifications
- [ ] Tối ưu hóa performance cho danh sách lớn
- [ ] Thêm chức năng đánh giá món ăn
- [ ] Hỗ trợ đa ngôn ngữ (i18n)
- [ ] Dark mode
- [ ] Tích hợp Google Maps cho tracking

---

## 📞 Liên hệ

- **Email**: gobitefood@gmail.com
- **GitHub**: [nhthebao/foodDelivery-mobile-app](https://github.com/nhthebao/foodDelivery-mobile-app)

---

## 🙏 Acknowledgments

- Firebase cho authentication service
- MongoDB Atlas cho cloud database
- Expo team cho mobile development platform
- SendGrid cho email service
- Sepay cho payment gateway integration

---

**Developed with ❤️ by Nhóm 6**
