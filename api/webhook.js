const BOT_TOKEN = "9023565157:AAF-iDx4vljv9BreU10jrf0WEZnkvp_6dVc";
const ADMIN_ID = "5330848428";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot Server is Active!");
  }

  try {
    const update = req.body;

    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text.trim();
      const user = update.message.from;

      if (text.startsWith("/start")) {
        // Bot ရဲ့ Username ကို အလိုအလျောက် ဆွဲယူခြင်း
        const botInfoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
        const botInfo = await botInfoRes.json();
        const botUsername = botInfo.result.username;

        const parts = text.split(" ");
        const refCode = parts.length > 1 ? parts[1] : null;

        const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
        const username = user.username ? `@${user.username}` : "Username မရှိပါ";

        // လက်ရှိ ဝင်လာတဲ့ User အတွက် ကိုယ်ပိုင် Referral Link ထုတ်ပေးခြင်း
        const myRefLink = `https://t.me/${botUsername}?start=${user.id}`;

        const replyMarkup = {
          inline_keyboard: [
            [
              {
                text: "📤 သူငယ်ချင်းများကို ဖိတ်ခေါ်ရန် (Share Link)",
                url: `https://t.me/share/url?url=${encodeURIComponent(myRefLink)}&text=${encodeURIComponent("ဒီ Bot ထဲကို ဝင်ကြည့်လိုက်ပါဦး!")}`
              }
            ]
          ]
        };

        if (refCode) {
          // ၁။ Referral Link ကနေ ဝင်လာရင် Admin ဆီ ပို့မယ့်စာ
          const adminMsg =
            `🚨 <b>လင့်ကနေ လူသစ်ဝင်လာပါပြီ!</b>\n\n` +
            `🔗 <b>ဖိတ်ခေါ်သူ ID / Code:</b> <code>${refCode}</code>\n` +
            `👤 <b>ဝင်လာသူ နာမည်:</b> ${fullName}\n` +
            `🆔 <b>ဝင်လာသူ ID:</b> <code>${user.id}</code>\n` +
            `📛 <b>Username:</b> ${username}`;

          await sendMessage(ADMIN_ID, adminMsg);

          // ဖိတ်ခေါ်လိုက်တဲ့ လူဆီကိုပါ သူ့လင့်ကနေ လူဝင်လာကြောင်း လှမ်းအသိပေးခြင်း (ဂဏန်း ID ဖြစ်နေရင်)
          if (/^\d+$/.test(refCode) && refCode !== String(user.id)) {
            await sendMessage(
              refCode,
              `🎉 သင့်ဖိတ်ခေါ်လင့်ကနေ <b>${fullName}</b> (<code>${user.id}</code>) ဝင်ရောက်လာပါပြီ!`
            );
          }

          // ဝင်လာတဲ့ User ဘက်ကို ပြန်ပြမယ့်စာ + သူ့ရဲ့ ကိုယ်ပိုင် Referral Link
          const userWelcome =
            `မင်္ဂလာပါ <b>${fullName}</b>! ဖိတ်ခေါ်လင့် (<code>${refCode}</code>) ကနေ ကြိုဆိုပါတယ်။\n\n` +
            `🔗 <b>သင့်ရဲ့ ကိုယ်ပိုင်ဖိတ်ခေါ်လင့်:</b>\n<code>${myRefLink}</code>`;

          await sendMessage(chatId, userWelcome, replyMarkup);
        } else {
          // ၂။ ရိုးရိုး /start နှိပ်ဝင်လာရင် Admin ဆီ ပို့မယ့်စာ
          const adminMsg =
            `👤 <b>ရိုးရိုး /start နှိပ်ပြီး ဝင်လာသူ</b>\n\n` +
            `👤 <b>နာမည်:</b> ${fullName}\n` +
            `🆔 <b>User ID:</b> <code>${user.id}</code>\n` +
            `📛 <b>Username:</b> ${username}`;

          await sendMessage(ADMIN_ID, adminMsg);

          // User ဘက်ကို ပြန်ပြမယ့်စာ + သူ့ရဲ့ ကိုယ်ပိုင် Referral Link
          const userWelcome =
            `မင်္ဂလာပါ <b>${fullName}</b>! Bot မှ ကြိုဆိုပါတယ်။\n\n` +
            `🔗 <b>သင့်ရဲ့ ကိုယ်ပိုင်ဖိတ်ခေါ်လင့်:</b>\n<code>${myRefLink}</code>`;

          await sendMessage(chatId, userWelcome, replyMarkup);
        }
      }
    }
  } catch (err) {
    console.error("Webhook Error:", err);
  }

  return res.status(200).json({ ok: true });
}

async function sendMessage(chatId, text, replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML",
  };
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
