const BOT_TOKEN = "9023565157:AAF-iDx4vljv9BreU10jrf0WEZnkvp_6dVc";

// ⚠️ ဒီနေရာမှာ @userinfobot ကရတဲ့ မင်းရဲ့ Admin ID ဂဏန်းကို ပြောင်းထည့်ပါ
const ADMIN_ID = "YOUR_ADMIN_ID_HERE"; 

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot is running!");
  }

  try {
    const body = req.body;

    if (body.message && body.message.text) {
      const chatId = body.message.chat.id;
      const text = body.message.text.trim();
      const user = body.message.from;

      // /start command ကို စစ်ဆေးခြင်း
      if (text.startsWith("/start")) {
        const parts = text.split(" ");
        const refCode = parts.length > 1 ? parts[1] : null; // ?start= နောက်က စာသား

        const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
        const username = user.username ? `@${user.username}` : "Username မရှိပါ";

        if (refCode) {
          // ၁။ လင့်ကနေ ဝင်လာရင် Admin ဆီ ပို့မယ့်စာ
          const adminMsg =
            `🚨 <b>လင့်ကနေ လူသစ်ဝင်လာပါပြီ!</b>\n\n` +
            `🔗 <b>Link Code:</b> <code>${refCode}</code>\n` +
            `👤 <b>နာမည်:</b> ${fullName}\n` +
            `🆔 <b>User ID:</b> <code>${user.id}</code>\n` +
            `📛 <b>Username:</b> ${username}`;

          await sendMessage(ADMIN_ID, adminMsg);
          await sendMessage(chatId, `မင်္ဂလာပါ ${fullName}! ဖိတ်ခေါ်လင့် (<b>${refCode}</b>) ကနေ ကြိုဆိုပါတယ်။`);
        } else {
          // ၂။ ရိုးရိုး /start နှိပ်ဝင်လာရင် Admin ဆီ ပို့မယ့်စာ
          const adminMsg =
            `👤 <b>ရိုးရိုး /start နှိပ်ပြီး ဝင်လာသူ</b>\n\n` +
            `👤 <b>နာမည်:</b> ${fullName}\n` +
            `🆔 <b>User ID:</b> <code>${user.id}</code>\n` +
            `📛 <b>Username:</b> ${username}`;

          await sendMessage(ADMIN_ID, adminMsg);
          await sendMessage(chatId, `မင်္ဂလာပါ ${fullName}! Bot မှ ကြိုဆိုပါတယ်။`);
        }
      }
    }
  } catch (error) {
    console.error("Error:", error);
  }

  return res.status(200).json({ ok: true });
}

async function sendMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: "HTML",
    }),
  });
}
