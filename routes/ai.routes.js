const express = require("express");
const router = express.Router();

// 🤖 AI Chat endpoint
router.post("/chat", async (req, res) => {
  try {
    const { messages, menuData } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        message: "Messages array is required",
      });
    }

    const AI_KEY = process.env.AI_KEY;
    if (!AI_KEY) {
      console.error("❌ AI_KEY not found in environment variables");
      return res.status(500).json({
        success: false,
        message: "AI service not configured",
      });
    }

    // Build system prompt with menu data
    const menuList = menuData
      ? menuData
          .map(
            (item) =>
              `- ${item.name} (${item.category}): ${item.description} - Giá: $${item.price}, Rating: ${item.rating}/5, Thời gian giao: ${item.deliveryTime}`
          )
          .join("\n")
      : "";

    const systemPrompt = {
      role: "system",
      content: `Bạn là trợ lý AI của ứng dụng giao đồ ăn "Food Delivery". Nhiệm vụ của bạn là:

📋 DANH SÁCH MÓN ĂN CÓ SẴN:
${menuList}

🎯 QUY TẮC HOẠT ĐỘNG:
- CHỈ gợi ý các món ăn có trong danh sách trên
- Khi gợi ý món, hãy đề cập tên chính xác, giá, rating và thời gian giao hàng
- Giúp người dùng chọn món dựa trên: sở thích, ngân sách, loại món (Vietnamese, Fast Food, Japanese, v.v.)
- Trả lời bằng tiếng Việt một cách thân thiện và nhiệt tình
- Có thể so sánh các món, gợi ý combo, hoặc món phù hợp với thời tiết/tâm trạng

❌ KHÔNG ĐƯỢC:
- Gợi ý món ăn KHÔNG có trong danh sách
- Trả lời về chủ đề không liên quan (chính trị, toán học, khoa học, giải trí, v.v.)
- Nếu người dùng hỏi chủ đề khác, lịch sự từ chối: "Xin lỗi, tôi chỉ có thể giúp bạn gợi ý món ăn từ thực đơn của nhà hàng. Bạn muốn tôi gợi ý món gì không?"

💡 VÍ DỤ CÂU TRẢ LỜI TốT:
"Tôi gợi ý bạn món Phở Bò Hà Nội ($3.84) với rating 4.3/5, thời gian giao 20-30 phút. Món này có nước dùng thơm ngọt, rất phù hợp cho bữa sáng hoặc trưa!"`,
    };

    console.log(
      `🤖 [AI] Processing chat request with ${messages.length} messages`
    );

    // Call OpenAI API
    const fetch = (await import("node-fetch")).default;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [systemPrompt, ...messages],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("❌ OpenAI API error:", errorData);
      return res.status(response.status).json({
        success: false,
        message: "AI service error",
        error: errorData,
      });
    }

    const data = await response.json();
    const aiMessage = data?.choices?.[0]?.message?.content?.trim();

    if (!aiMessage) {
      return res.status(500).json({
        success: false,
        message: "No response from AI",
      });
    }

    console.log(`✅ [AI] Response generated successfully`);

    res.json({
      success: true,
      message: aiMessage,
    });
  } catch (error) {
    console.error("❌ [AI] Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

module.exports = router;
