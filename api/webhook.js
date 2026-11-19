const BOT_TOKEN = "9023565157:AAF-iDx4vljv9BreU10jrf0WEZnkvp_6dVc";
const ADMIN_ID = "5330848428";
const FIREBASE_URL = "https://adpro-bot-default-rtdb.firebaseio.com/test_ref_bot";

// ⚠️ /share လို့ ရိုးရိုးရိုက်ရင် အလိုလိုတပ်ပေးမယ့် Default Button နဲ့ Link ကို ဒီမှာထည့်ပါ
const DEFAULT_BTN_TEXT = "🚀 Open NEXORA Mini App";
const DEFAULT_BTN_URL = "https://t.me/YourNexoraBot/app"; // မင်းရဲ့ Mini App Link အမှန်ပြောင်းထည့်ပါ

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Bot Server is Active!");
  }

  try {
    const update = req.body;
    const msg = update.message;

    if (!msg) {
      return res.status(200).json({ ok: true });
    }

    const chatId = String(msg.chat.id);
    const text = (msg.text || "").trim();
    const user = msg.from;
    const userId = String(user.id);
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
    const username = user.username ? `@${user.username}` : "Username မရှိပါ";

    // ==========================================
    // ၁။ POST SHARE WITH BUTTON (/share)
    // ==========================================
    if (userId === ADMIN_ID) {
      if (text.startsWith("/share") && msg.reply_to_message) {
        const targetMsgId = msg.reply_to_message.message_id;
        
        // /share နောက်မှာ "ခလုတ်နာမည် | Link" ပါမပါ စစ်ဆေးခြင်း
        const extra = text.replace("/share", "").trim();
        let btnText = DEFAULT_BTN_TEXT;
        let btnUrl = DEFAULT_BTN_URL;

        if (extra.includes("|")) {
          const splitParts = extra.split("|");
          btnText = splitParts[0].trim();
          btnUrl = splitParts[1].trim();
        }

        const customButton = {
          inline_keyboard: [[{ text: btnText, url: btnUrl }]]
        };

        await broadcastPost(chatId, chatId, targetMsgId, customButton);
        return res.status(200).json({ ok: true });
      }

      // စာသားချည်းပဲ အမြန်ပို့ချင်ရင် (/send စာသား)
      if (text.startsWith("/send")) {
        const broadcastMsg = text.replace("/send", "").trim();
        if (!broadcastMsg) {
          await sendMessage(
            chatId,
            "📌 <b>Button ပါတဲ့ Post Share လုပ်နည်း:</b>\n\n" +
            "၁။ Post ကို Bot ဆီ အရင်ပို့ပါ။\n" +
            "၂။ အဲဒီ Post ကို <b>Reply</b> ပြန်ပြီး <code>/share</code> လို့ ရိုက်လိုက်ပါ (Default Button အလိုလို တပ်ပေးပါမယ်)။\n\n" +
            "💡 <i>တခြား Link ပြောင်းတပ်ချင်ရင်:</i>\n" +
            "<code>/share ခလုတ်စာသား | https://t.me/link</code>"
          );
          return res.status(200).json({ ok: true });
        }

        const usersObj = await firebaseRequest("users");
        if (!usersObj) {
          await sendMessage(chatId, "Bot ထဲမှာ User မရှိသေးပါ။");
          return res.status(200).json({ ok: true });
        }

        const userIds = Object.keys(usersObj);
        await sendMessage(chatId, `⏳ User (${userIds.length}) ယောက်ဆီ စာစတင်ပို့နေပါပြီ...`);

        let successCount = 0;
        let failCount = 0;

        for (const uid of userIds) {
          const ok = await sendMessage(uid, broadcastMsg);
          if (ok) successCount++;
          else failCount++;
        }

        await sendMessage(
          chatId,
          `✅ <b>ပို့ပြီးပါပြီ!</b>\n📨 အောင်မြင်: <b>${successCount}</b> ယောက်\n❌ မအောင်မြင်: <b>${failCount}</b> ယောက်`
        );
        return res.status(200).json({ ok: true });
      }

      // User စုစုပေါင်း စစ်ရန် (/stats)
      if (text === "/stats") {
        const usersObj = await firebaseRequest("users");
        const count = usersObj ? Object.keys(usersObj).length : 0;
        await sendMessage(chatId, `📊 လက်ရှိ Bot User စုစုပေါင်း: <b>${count}</b> ယောက်`);
        return res.status(200).json({ ok: true });
      }
    }

    // ==========================================
    // ၂။ /start နှင့် REFERRAL (1, 2, 3...) ရေတွက်ခြင်း
    // ==========================================
    if (text.startsWith("/start")) {
      const botInfoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
      const botInfo = await botInfoRes.json();
      const botUsername = botInfo.result.username;

      const parts = text.split(" ");
      const refCode = parts.length > 1 ? parts[1] : null;

      const existingUser = await firebaseRequest(`users/${userId}`);
      const isNewUser = !existingUser;
      let currentRefCount = isNewUser ? 0 : (existingUser.ref_count || 0);

      if (isNewUser) {
        const validRef = refCode && refCode !== userId ? refCode : null;

        await firebaseRequest(`users/${userId}`, "PUT", {
          user_id: userId,
          full_name: fullName,
          username: username,
          referred_by: validRef,
          ref_count: 0,
          joined_at: new Date().toISOString()
        });

        if (validRef) {
          const inviterData = await firebaseRequest(`users/${validRef}`);
          let newCount = 1;

          if (inviterData) {
            newCount = (inviterData.ref_count || 0) + 1;
            await firebaseRequest(`users/${validRef}`, "PATCH", {
              ref_count: newCount
            });
          }

          if (/^\d+$/.test(validRef)) {
            await sendMessage(
              validRef,
              `🎉 <b>ဖိတ်ခေါ်မှု အောင်မြင်ပါတယ်!</b>\n\n` +
              `👤 ဝင်လာသူ: <b>${fullName}</b>\n` +
              `🔢 သင်ဖိတ်ခေါ်ပြီးသူ စုစုပေါင်း: <b>${newCount}</b> ယောက်`
            );
          }

          await sendMessage(
            ADMIN_ID,
            `🚨 <b>လင့်ကနေ လူသစ်ဝင်လာပါပြီ!</b>\n\n` +
            `🔗 <b>ဖိတ်ခေါ်သူ:</b> <code>${validRef}</code> (စုစုပေါင်း: <b>${newCount}</b> ယောက်မြောက်)\n` +
            `👤 <b>ဝင်လာသူ:</b> ${fullName} (<code>${userId}</code>)\n` +
            `📛 <b>Username:</b> ${username}`
          );
        } else {
          await sendMessage(
            ADMIN_ID,
            `👤 <b>ရိုးရိုး /start လူသစ်ဝင်လာသူ</b>\n\n` +
            `👤 <b>နာမည်:</b> ${fullName} (<code>${userId}</code>)\n` +
            `📛 <b>Username:</b> ${username}`
          );
        }
      }

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
  } catch (err) {
    console.error("Error:", err);
  }

  return res.status(200).json({ ok: true });
}

// Post + Button ကို User အားလုံးဆီ Copy လုပ်ပို့ပေးမယ့် Function
async function broadcastPost(adminChatId, fromChatId, messageId, replyMarkup) {
  const usersObj = await firebaseRequest("users");
  if (!usersObj) {
    await sendMessage(adminChatId, "Bot ထဲမှာ User မရှိသေးပါ။");
    return;
  }

  const userIds = Object.keys(usersObj);
  await sendMessage(adminChatId, `⏳ User (${userIds.length}) ယောက်ဆီ Button ပါတဲ့ Post စတင် Share နေပါပြီ...`);

  let successCount = 0;
  let failCount = 0;

  for (const uid of userIds) {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/copyMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: uid,
        from_chat_id: fromChatId,
        message_id: messageId,
        reply_markup: replyMarkup
      })
    });
    const data = await res.json();
    if (data.ok) successCount++;
    else failCount++;
  }

  await sendMessage(
    adminChatId,
    `✅ <b>Post Share ပြီးပါပြီ!</b>\n\n` +
    `📨 အောင်မြင်: <b>${successCount}</b> ယောက်\n` +
    `❌ မအောင်မြင်: <b>${failCount}</b> ယောက်`
  );
}

// Firebase Helper
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
