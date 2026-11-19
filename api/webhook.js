const BOT_TOKEN = "9023565157:AAF-iDx4vljv9BreU10jrf0WEZnkvp_6dVc";
const ADMIN_ID = "5330848428";

// မင်းရဲ့ Firebase Realtime Database URL (သီးသန့် node တစ်ခုခွဲသိမ်းထားပါတယ်)
const FIREBASE_URL = "https://adpro-bot-default-rtdb.firebaseio.com/test_ref_bot";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot Server is Active with Firebase!");
  }

  try {
    const update = req.body;

    if (update.message && update.message.text) {
      const chatId = String(update.message.chat.id);
      const text = update.message.text.trim();
      const user = update.message.from;
      const userId = String(user.id);
      const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
      const username = user.username ? `@${user.username}` : "Username မရှိပါ";

      // ==========================================
      // ၁။ ADMIN BROADCAST (/send စာသား)
      // ==========================================
      if (text.startsWith("/send") && userId === ADMIN_ID) {
        const broadcastMsg = text.replace("/send", "").trim();
        if (!broadcastMsg) {
          await sendMessage(chatId, "⚠️ ပို့ချင်တဲ့ စာသားကိုပါ ထည့်ရေးပါ။\nဥပမာ - <code>/send မင်္ဂလာပါ အားလုံးပဲ</code>");
          return res.status(200).json({ ok: true });
        }

        const usersObj = await firebaseRequest("users");
        if (!usersObj) {
          await sendMessage(chatId, "Bot ထဲမှာ User မရှိသေးပါ။");
          return res.status(200).json({ ok: true });
        }

        const userIds = Object.keys(usersObj);
        await sendMessage(chatId, `⏳ User စုစုပေါင်း (${userIds.length}) ယောက်ဆီ စာစတင်ပို့နေပါပြီ...`);

        let successCount = 0;
        let failCount = 0;

        for (const uid of userIds) {
          const ok = await sendMessage(uid, broadcastMsg);
          if (ok) successCount++;
          else failCount++;
        }

        await sendMessage(
          chatId,
          `✅ <b>Broadcast ပို့ပြီးပါပြီ!</b>\n\n` +
          `📨 အောင်မြင်: <b>${successCount}</b> ယောက်\n` +
          `❌ မအောင်မြင် (Block ထားသူ): <b>${failCount}</b> ယောက်`
        );
        return res.status(200).json({ ok: true });
      }

      // ==========================================
      // ၂။ ADMIN STATS (/stats - စုစုပေါင်း User ကြည့်ရန်)
      // ==========================================
      if (text === "/stats" && userId === ADMIN_ID) {
        const usersObj = await firebaseRequest("users");
        const count = usersObj ? Object.keys(usersObj).length : 0;
        await sendMessage(chatId, `📊 လက်ရှိ Bot User စုစုပေါင်း: <b>${count}</b> ယောက်`);
        return res.status(200).json({ ok: true });
      }

      // ==========================================
      // ၃။ /start နှင့် REFERRAL (1, 2, 3...) ရေတွက်ခြင်း
      // ==========================================
      if (text.startsWith("/start")) {
        const botInfoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
        const botInfo = await botInfoRes.json();
        const botUsername = botInfo.result.username;

        const parts = text.split(" ");
        const refCode = parts.length > 1 ? parts[1] : null;

        // Firebase ထဲမှာ ဒီ User ရှိပြီးသားလား အရင်စစ်မယ်
        const existingUser = await firebaseRequest(`users/${userId}`);
        const isNewUser = !existingUser;
        let currentRefCount = isNewUser ? 0 : (existingUser.ref_count || 0);

        if (isNewUser) {
          const validRef = refCode && refCode !== userId ? refCode : null;

          // User အသစ်ကို Firebase ထဲ သိမ်းမယ်
          await firebaseRequest(`users/${userId}`, "PUT", {
            user_id: userId,
            full_name: fullName,
            username: username,
            referred_by: validRef,
            ref_count: 0,
            joined_at: new Date().toISOString()
          });

          // Referral Link နဲ့ ဝင်လာတဲ့ လူသစ်ဖြစ်ရင် ဖိတ်ခေါ်သူရဲ့ Count ကို 1, 2, 3... တိုးပေးမယ်
          if (validRef) {
            const inviterData = await firebaseRequest(`users/${validRef}`);
            let newCount = 1;

            if (inviterData) {
              newCount = (inviterData.ref_count || 0) + 1;
              await firebaseRequest(`users/${validRef}`, "PATCH", {
                ref_count: newCount
              });
            }

            // ဖိတ်ခေါ်သူဆီ နံပါတ်တပ်ပြီး အသိပေးမယ်
            if (/^\d+$/.test(validRef)) {
              await sendMessage(
                validRef,
                `🎉 <b>ဖိတ်ခေါ်မှု အောင်မြင်ပါတယ်!</b>\n\n` +
                `👤 ဝင်လာသူ: <b>${fullName}</b>\n` +
                `🔢 သင်ဖိတ်ခေါ်ပြီးသူ စုစုပေါင်း: <b>${newCount}</b> ယောက်`
              );
            }

            // Admin ဆီကိုပါ အသိပေးမယ်
            await sendMessage(
              ADMIN_ID,
              `🚨 <b>လင့်ကနေ လူသစ်ဝင်လာပါပြီ!</b>\n\n` +
              `🔗 <b>ဖိတ်ခေါ်သူ:</b> <code>${validRef}</code> (စုစုပေါင်း: <b>${newCount}</b> ယောက်မြောက်)\n` +
              `👤 <b>ဝင်လာသူ:</b> ${fullName} (<code>${userId}</code>)\n` +
              `📛 <b>Username:</b> ${username}`
            );
          } else {
            // ရိုးရိုး လူသစ်ဝင်လာရင် Admin ဆီ ပို့မယ်
            await sendMessage(
              ADMIN_ID,
              `👤 <b>ရိုးရိုး /start လူသစ်ဝင်လာသူ</b>\n\n` +
              `👤 <b>နာမည်:</b> ${fullName} (<code>${userId}</code>)\n` +
              `📛 <b>Username:</b> ${username}`
            );
          }
        }

        // User ဆီ ကိုယ်ပိုင် Link နဲ့ လက်ရှိ ဖိတ်ခေါ်ထားသူ အရေအတွက် ပြပေးခြင်း
        const myRefLink = `https://t.me/${botUsername}?start=${userId}`;
        const replyMarkup = {
          inline_keyboard: [
            [
              {
                text: "📤 သူငယ်ချင်းများကို ဖိတ်ခေါ်ရန်",
                url: `https://t.me/share/url?url=${encodeURIComponent(myRefLink)}&text=${encodeURIComponent("ဒီ Bot ထဲကို ဝင်ကြည့်လိုက်ပါဦး!")}`
              }
            ]
          ]
        };

        const welcomeText =
          `မင်္ဂလာပါ <b>${fullName}</b>!\n\n` +
          `👥 <b>သင်ဖိတ်ခေါ်ထားသူ စုစုပေါင်း:</b> <b>${currentRefCount}</b> ယောက်\n` +
          `🔗 <b>သင့်ရဲ့ ကိုယ်ပိုင်ဖိတ်ခေါ်လင့်:</b>\n<code>${myRefLink}</code>`;

        await sendMessage(chatId, welcomeText, replyMarkup);
      }
    }
  } catch (err) {
    console.error("Error:", err);
  }

  return res.status(200).json({ ok: true });
}

// Firebase Helper Function
async function firebaseRequest(path, method = "GET", body = null) {
  const options = {
    method,
    headers: { "Content-Type": "application/json" }
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${FIREBASE_URL}/${path}.json`, options);
  if (!res.ok) return null;
  return await res.json();
}

// Telegram Send Message Helper
async function sendMessage(chatId, text, replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML"
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  return data.ok === true;
}
