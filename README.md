<div align="center">
    
# Food Delivery Mobile App

## Nhóm 6 

| STT | Họ tên | MSSV | Công việc |
|-----|--------|------|-----------|
| 1 | Nguyễn Huỳnh Thế Bảo | 22690761 |  |
| 2 | Nguyễn Tấn Nghị | 22685461 |  |
| 3 | Nguyễn Hoài Nhân | 22689531 |  |

---

</div>

## Giới thiệu dự án

Food Delivery Mobile App là một ứng dụng đặt đồ ăn trực tuyến được phát triển bằng **React Native** với **Expo**, kết hợp backend **Node.js/Express** và cơ sở dữ liệu **MongoDB Atlas**. Ứng dụng mang đến trải nghiệm mua sắm đồ ăn hoàn chỉnh và tiện lợi cho người dùng di động.

---

## Tính năng chính

### Xác thực và Quản lý người dùng
- Đăng nhập/Đăng ký qua Firebase Authentication
- Quên mật khẩu với xác thực OTP qua email
- Quản lý thông tin cá nhân (tên, email, số điện thoại, địa chỉ)
- Upload và cập nhật ảnh đại diện

### Mua sắm
- Duyệt danh sách món ăn với hình ảnh, mô tả chi tiết và giá cả
- Tìm kiếm và lọc món ăn theo danh mục
- Quản lý giỏ hàng (thêm, xóa, điều chỉnh số lượng)
- Danh sách yêu thích (Favorites) để tiện lựa chọn lần sau

### Thanh toán
- Tích hợp thanh toán qua Sepay (chuyển khoản ngân hàng)
- Hỗ trợ thanh toán trực tiếp
- Webhook tự động cập nhật trạng thái thanh toán
- Quản lý phương thức thanh toán

### Quản lý đơn hàng
- Theo dõi trạng thái đơn hàng real-time
- Lịch sử đơn hàng chi tiết
- Cập nhật trạng thái sau khi thanh toán thành công
- *Lưu ý: Phần tracking vị trí đơn hàng trên bản đồ sẽ được phát triển trong các phiên bản tiếp theo*

### AI Assistant
- Chatbot hỗ trợ khách hàng tích hợp AI
- Gợi ý món ăn thông minh dựa trên sở thích người dùng

---

## Kiến trúc hệ thống

### Frontend (Mobile App)
- **Framework**: React Native với Expo SDK
- **Navigation**: Expo Router (file-based routing)
- **State Management**: React Context API
- **Local Storage**: SQLite
- **Authentication**: Firebase Admin SDK
- **HTTP Client**: Axios
- **Language**: TypeScript

### Backend (Server)
- **Runtime**: Node.js v20.x
- **Framework**: Express.js
- **Database**: MongoDB Atlas
- **ORM/ODM**: Mongoose
- **Authentication**: JWT + Firebase Admin
- **Email Service**: SendGrid & Nodemailer
- **Payment Gateway**: Sepay API

---

## Cấu trúc thư mục

```
TeamProject/
│
├── foodDelivery-mobile-app/        # Ứng dụng di động
│   ├── app/                        # Screens & Navigation
│   │   ├── (tabs)/                 # Tab-based navigation
│   │   ├── login-signUp/           # Xác thực người dùng
│   │   ├── forgot-password/        # Khôi phục mật khẩu
│   │   ├── order-process/          # Xử lý đơn hàng
│   │   ├── payment/                # Thanh toán
│   │   └── profile/                # Hồ sơ người dùng
│   │
│   ├── components/                 # Các component tái sử dụng
│   ├── context/                    # React Context (quản lý state)
│   ├── services/                   # API & Firebase services
│   ├── constants/                  # Theme & hằng số
│   ├── hooks/                      # Custom React hooks
│   └── assets/                     # Hình ảnh, icon, font
│
└── Test_Server_Render/             # Backend Server
    ├── routes/                     # API routes
    │   ├── auth.routes.js          # Xác thực
    │   ├── user.routes.js          # Quản lý người dùng & giỏ hàng
    │   ├── dessert.routes.js       # Quản lý sản phẩm
    │   ├── order.routes.js         # Quản lý đơn hàng
    │   └── payment.routes.js       # Thanh toán & webhook
    │
    ├── services/                   # Business logic
    │   └── email.service.js        # Dịch vụ gửi email
    │
    ├── middlewares/                # Express middlewares
    │   └── auth.js                 # Xác thực JWT
    │
    ├── firebase.js                 # Cấu hình Firebase Admin
    └── server.js                   # Entry point
```

---

## Cài đặt và chạy dự án

### Yêu cầu hệ thống
- Node.js v20.x trở lên
- npm hoặc yarn
- Expo CLI
- Android Studio hoặc Xcode (để chạy emulator)
- MongoDB Atlas account

### Bước 1: Clone repository
```bash
git clone https://github.com/nhthebao/foodDelivery-mobile-app.git
cd TeamProject
```

### Bước 2: Cài đặt Backend
```bash
cd Test_Server_Render
npm install
```

Tạo file `.env`:
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

### Bước 3: Cài đặt Mobile App
```bash
cd foodDelivery-mobile-app
npm install
```

Tạo file `.env`:
```env
EXPO_PUBLIC_API_URL=http://your-server-url:10000
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
```

Chạy ứng dụng:
```bash
npx expo start
```

---

## Công nghệ sử dụng

### Mobile App
| Công nghệ | Mục đích |
|-----------|---------|
| React Native | Framework phát triển mobile |
| Expo | SDK & toolchain |
| Expo Router | Điều hướng dựa trên tệp |
| Firebase | Xác thực người dùng |
| SQLite | Cơ sở dữ liệu cục bộ |
| Axios | HTTP client |
| TypeScript | Type safety |

### Backend
| Công nghệ | Mục đích |
|-----------|---------|
| Express.js | Web framework |
| MongoDB | NoSQL database |
| Mongoose | ODM |
| JWT | Token authentication |
| Firebase Admin | Quản lý người dùng |
| SendGrid | Email service |
| Sepay | Payment gateway |

---

## Database Schema

### Users Collection
- `id`, `fullName`, `username`, `email`, `phone`, `address`
- `authProviders[]`, `paymentMethod`, `image`
- `favorite[]`, `cart[]`
- `createdAt`, `updatedAt`

### Desserts Collection
- `id`, `name`, `rating`, `price`, `category`
- `discount`, `deliveryTime`
- `image`, `description`, `freeDelivery`
- `review[]` (idUser, content, rating, date)

### Orders Collection
- `id`, `userId`, `items[]`
- `totalAmount`, `discount`, `deliveryFee`, `finalAmount`
- `status`, `paymentMethod`, `paymentStatus`
- `deliveryAddress` {fullAddress, phone, note}
- `paymentTransaction{}`
- `estimatedDeliveryTime`
- `createdAt`, `updatedAt`

---

## API Endpoints

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
- `GET /desserts` - Danh sách món ăn
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

## Các tính năng sẽ phát triển
- Push notifications cho cập nhật đơn hàng
- Tối ưu hóa hiệu suất cho danh sách lớn
- Hệ thống đánh giá và bình luận chi tiết
- Hỗ trợ đa ngôn ngữ
- Dark mode
- Tích hợp Google Maps để tracking vị trí giao hàng

---

## Liên hệ
- **Email**: gobitefood@gmail.com
- **GitHub Fontend**: [nhthebao/foodDelivery-mobile-app](https://github.com/nhthebao/foodDelivery-mobile-app)
- **GitHub Backend**: [nhthebao/Test_Server_Render](https://github.com/nhthebao/Test_Server_Render)

---

## Lời cảm ơn
Cảm ơn Firebase, MongoDB Atlas, Expo, SendGrid và Sepay vì đã cung cấp các dịch vụ tuyệt vời để xây dựng dự án này.

---

**Phát triển bởi Nhóm 6**
