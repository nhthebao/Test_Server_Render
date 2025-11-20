const sgMail = require("@sendgrid/mail");
const nodemailer = require("nodemailer");

// ============================================
// 📧 SENDGRID EMAIL FUNCTION (Primary)
// ============================================
async function sendPasswordResetEmailSendGrid(email, resetLink) {
  try {
    console.log(`\n📧 ========== SENDGRID SEND START ==========`);
    console.log(`📧 [1/3] Checking SendGrid API Key...`);

    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      console.error(`❌ SENDGRID_API_KEY not found in environment`);
      return false;
    }

    console.log(`✅ SendGrid API Key found`);
    console.log(`📧 [2/3] Preparing email...`);

    sgMail.setApiKey(apiKey);

    const msg = {
      to: email,
      from: process.env.EMAIL_USER || "gobitefood@gmail.com",
      subject: "🔐 Lấy Lại Mật Khẩu - Food Delivery App",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #FF6B35; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px; }
            .button { 
              display: inline-block; 
              padding: 12px 30px;
              background: #FF6B35;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: bold;
              margin: 20px 0;
            }
            .note { color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🔐 Lấy Lại Mật Khẩu</h2>
            </div>
            <div class="content">
              <p>Xin chào,</p>
              <p>Chúng tôi nhận được yêu cầu lấy lại mật khẩu cho tài khoản của bạn.</p>
              
              <p>Nhấn nút dưới để đặt mật khẩu mới:</p>
              
              <center>
                <a href="${resetLink}" class="button" style="color: white">Lấy Lại Mật Khẩu</a>
              </center>
              
              <p>Nếu nút trên không hoạt động, sao chép link này vào trình duyệt:</p>
              <code style="background: white; padding: 10px; display: block; word-break: break-all;">
                ${resetLink}
              </code>
              
              <p class="note">
                <strong>⏰ Lưu ý:</strong> Link lấy lại mật khẩu sẽ hết hạn trong 30 phút.
              </p>
              
              <p class="note">
                Nếu bạn không yêu cầu lấy lại mật khẩu, vui lòng bỏ qua email này.
              </p>
              
              <hr style="margin-top: 30px;">
              <p style="color: #999; font-size: 12px;">
                Food Delivery App &copy; 2025 - Tất cả quyền được bảo lưu.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    console.log(`📧 From: ${msg.from}`);
    console.log(`📧 To: ${msg.to}`);
    console.log(`📧 Subject: ${msg.subject}`);
    console.log(`📧 [3/3] Sending email via SendGrid...`);

    const result = await sgMail.send(msg);

    console.log(`✅ Email sent successfully via SendGrid!`);
    console.log(`✅ Status Code: ${result[0].statusCode}`);
    console.log(`✅ Response: ${JSON.stringify(result[0].headers)}`);
    console.log(`📧 ========== SENDGRID SEND SUCCESS ==========\n`);

    return true;
  } catch (error) {
    console.error(`\n❌ ========== SENDGRID ERROR ==========`);
    console.error(`❌ Error message:`, error.message);
    console.error(`❌ Error code:`, error.code);
    if (error.response) {
      console.error(`❌ Response status:`, error.response.statusCode);
      console.error(`❌ Response body:`, error.response.body);
    }
    console.error(`❌ Full error:`, JSON.stringify(error, null, 2));
    console.error(`❌ ====================================\n`);
    return false;
  }
}

// ============================================
// 📧 GMAIL SMTP EMAIL FUNCTION
// ============================================
async function sendPasswordResetEmailGmail(email, resetLink) {
  try {
    console.log(`\n📧 ========== GMAIL SMTP SEND START ==========`);
    console.log(`📧 [1/3] Setting up Gmail SMTP...`);

    // Create Gmail transporter with app password
    const transporter = nodemailer.createTransporter({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    console.log(`✅ Gmail transporter created with app password`);
    console.log(`📧 [2/3] Preparing email...`);

    const mailOptions = {
      from: `"Food Delivery App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🔐 Lấy Lại Mật Khẩu - Food Delivery App",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #FF6B35; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px; }
            .button { 
              display: inline-block; 
              padding: 12px 30px;
              background: #FF6B35;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: bold;
              margin: 20px 0;
            }
            .note { color: #666; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>🔐 Lấy Lại Mật Khẩu</h2>
            </div>
            <div class="content">
              <p>Xin chào,</p>
              <p>Chúng tôi nhận được yêu cầu lấy lại mật khẩu cho tài khoản của bạn.</p>
              
              <p>Nhấn nút dưới để đặt mật khẩu mới:</p>
              
              <center>
                <a href="${resetLink}" class="button" style="color: white">Lấy Lại Mật Khẩu</a>
              </center>
              
              <p>Nếu nút trên không hoạt động, sao chép link này vào trình duyệt:</p>
              <code style="background: white; padding: 10px; display: block; word-break: break-all;">
                ${resetLink}
              </code>
              
              <p class="note">
                <strong>⏰ Lưu ý:</strong> Link lấy lại mật khẩu sẽ hết hạn trong 30 phút.
              </p>
              
              <p class="note">
                Nếu bạn không yêu cầu lấy lại mật khẩu, vui lòng bỏ qua email này.
              </p>
              
              <hr style="margin-top: 30px;">
              <p style="color: #999; font-size: 12px;">
                Food Delivery App &copy; 2025 - Tất cả quyền được bảo lưu.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    console.log(`📧 From: ${mailOptions.from}`);
    console.log(`📧 To: ${mailOptions.to}`);
    console.log(`📧 Subject: ${mailOptions.subject}`);
    console.log(`📧 [3/3] Sending email via Gmail SMTP...`);

    const result = await transporter.sendMail(mailOptions);

    console.log(`✅ Email sent successfully via Gmail SMTP!`);
    console.log(`✅ Message ID: ${result.messageId}`);
    console.log(`✅ Response: ${result.response}`);
    console.log(`📧 ========== GMAIL SMTP SEND SUCCESS ==========\n`);

    return true;
  } catch (error) {
    console.error(`\n❌ ========== GMAIL SMTP ERROR ==========`);
    console.error(`❌ Error message:`, error.message);
    console.error(`❌ Error code:`, error.code);
    console.error(`❌ Full error:`, JSON.stringify(error, null, 2));
    console.error(`❌ ====================================\n`);

    // Fallback to SendGrid if Gmail fails
    console.log(`🔄 Gmail failed, trying SendGrid fallback...`);
    if (process.env.SENDGRID_API_KEY) {
      return await sendPasswordResetEmailSendGrid(email, resetLink);
    }
    return false;
  }
}

// ============================================
// 📧 MAIN EMAIL FUNCTION - Uses Gmail SMTP or SendGrid
// ============================================
async function sendPasswordResetEmail(email, resetLink) {
  // ✅ Try Gmail SMTP first if EMAIL_PASSWORD exists (app password)
  if (process.env.EMAIL_PASSWORD && process.env.EMAIL_USER) {
    console.log(`📧 Using Gmail SMTP with app password...`);
    return await sendPasswordResetEmailGmail(email, resetLink);
  }

  // ✅ Fallback to SendGrid
  if (!process.env.SENDGRID_API_KEY) {
    console.error(
      `❌ Neither EMAIL_PASSWORD nor SENDGRID_API_KEY found in environment!`
    );
    console.error(
      `💡 Please add EMAIL_PASSWORD (Gmail) or SENDGRID_API_KEY to your .env file`
    );
    return false;
  }

  console.log(`📧 Using SendGrid as fallback...`);
  return await sendPasswordResetEmailSendGrid(email, resetLink);
}

module.exports = {
  sendPasswordResetEmail,
  sendPasswordResetEmailSendGrid,
  sendPasswordResetEmailGmail,
};
