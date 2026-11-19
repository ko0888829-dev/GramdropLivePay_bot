const BOT_TOKEN = "9023565157:AAF-iDx4vljv9BreU10jrf0WEZnkvp_6dVc";
const ADMIN_ID = "5330848428";
const FIREBASE_URL = "https://adpro-bot-default-rtdb.firebaseio.com/usdt_drop_bot";

const PER_REFER = 0.01;
const MIN_WITHDRAW = 0.05;

// ⚠️ မင်း Join ခိုင်းချင်တဲ့ Sponsor Channel စာရင်း (Bot ကို Admin ပေးထားရပါမယ်)
const SPONSORS = [
  { chat_id: "@nexora_mining", url: "https://t.me/nexora_mining" },
  { chat_id: "@DargonGolden", url: "https://t.me/DargonGolden" }
];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("USDT Drop Bot is Active!");

  try {
    const update = req.body;

    // ==========================================
    // ၁။ BUTTON နှိပ်ခြင်းများ (CALLBACK QUERIES)
    // ==========================================
    if (update.callback_query) {
      const cb = update.callback_query;
      const cbId = cb.id;
      const userId = String(cb.from.id);
      const chatId = String(cb.message.chat.id);
      const msgId = cb.message.message_id;
      const firstName = cb.from.first_name || "User";
      const data = cb.data;

      // (က) ✅ DONE SPONSORS ခလုတ်နှိပ်ရင်
      if (data === "check_sponsors") {
        const unjoined = await getUnjoinedSponsors(userId);

        if (unjoined.length > 0) {
          await answerCallback(cbId, `❌ You still have ${unjoined.length} sponsors remaining!`, true);
          const { text, markup } = buildSponsorUI(firstName, unjoined);
          await editMessageText(chatId, msgId, text, markup);
          return res.status(200).json({ ok: true });
        }

        // Sponsor အကုန် Join ပြီးသွားရင် Referrer ကို 0.01 USDT + 1 Refer တိုးပေးမယ်
        const user = await firebaseRequest(`users/${userId}`);
        if (user && user.referred_by && !user.reward_credited) {
          const refId = String(user.referred_by);
          const refData = await firebaseRequest(`users/${refId}`);

          if (refData) {
            const newBal = Number((Number(refData.balance || 0) + PER_REFER).toFixed(4));
            const newRefs = Number(refData.refers || 0) + 1;

            await firebaseRequest(`users/${refId}`, "PATCH", {
              balance: newBal,
              refers: newRefs
            });
            await firebaseRequest(`users/${userId}`, "PATCH", {
              reward_credited: true
            });

            // ဖိတ်ခေါ်သူဆီ အသိပေးမယ်
            await sendMessage(
              refId,
              `🎊 <b>New Referral Verified!</b>\n\n` +
              `👤 Joined: <b>${firstName}</b>\n` +
              `💵 Earned: <b>+${PER_REFER} USDT</b>\n` +
              `👥 Total Invites: <b>${newRefs}</b>`
            );

            // Admin ဆီကိုပါ Notification ပို့မယ်
            await sendMessage(
              ADMIN_ID,
              `🚨 <b>Verified Referral!</b>\n` +
              `🔗 Inviter: <code>${refId}</code> (Total: <b>${newRefs}</b>)\n` +
              `👤 New User: ${firstName} (<code>${userId}</code>)`
            );
          }
        }

        await deleteMessage(chatId, msgId);
        await sendMessage(
          chatId,
          `🎉 <b>Verification Complete!</b>\n\n` +
          `💵 Per Refer: <b>${PER_REFER} USDT</b>\n` +
          `💳 Minimum Withdraw: <b>${MIN_WITHDRAW} USDT</b> (BEP20)`,
          mainMenuKeyboard()
        );
        return res.status(200).json({ ok: true });
      }

      // (ခ) ADMIN MARK PAID ခလုတ်နှိပ်ရင်
      if (data.startsWith("paid_") && userId === ADMIN_ID) {
        const [, uid, amount] = data.split("_");
        await editMessageText(chatId, msgId, cb.message.text + "\n\n✅ <b>PAID</b>");
        await sendMessage(
          uid,
          `🎉 <b>Payment Sent!</b>\nYou have received <b>+${amount} USDT</b> on your BEP20 wallet.`
        );
        await answerCallback(cbId, "Marked as Paid!");
        return res.status(200).json({ ok: true });
      }

      // (ဂ) ADMIN REJECT ခလုတ်နှိပ်ရင်
      if (data.startsWith("reject_") && userId === ADMIN_ID) {
        const [, uid, amount] = data.split("_");
        const targetUser = (await firebaseRequest(`users/${uid}`)) || {};
        const refund = Number((Number(targetUser.balance || 0) + Number(amount)).toFixed(4));
        await firebaseRequest(`users/${uid}`, "PATCH", { balance: refund });
        await editMessageText(chatId, msgId, cb.message.text + "\n\n❌ <b>REJECTED & REFUNDED</b>");
        await sendMessage(uid, `❌ Your withdrawal of <b>${amount} USDT</b> was rejected and refunded to your balance.`);
        await answerCallback(cbId, "Rejected & Refunded!");
        return res.status(200).json({ ok: true });
      }

      return res.status(200).json({ ok: true });
    }

    // ==========================================
    // ၂။ MESSAGE များ ကိုင်တွယ်ခြင်း
    // ==========================================
    const msg = update.message;
    if (!msg) return res.status(200).json({ ok: true });

    const chatId = String(msg.chat.id);
    const text = (msg.text || "").trim();
    const user = msg.from;
    const userId = String(user.id);
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
    const firstName = user.first_name || "User";
    const username = user.username ? `@${user.username}` : "No Username";

    // --- ADMIN COMMANDS (/share & /stats) ---
    if (userId === ADMIN_ID) {
      if (text.startsWith("/share") && msg.reply_to_message) {
        const targetMsgId = msg.reply_to_message.message_id;
        const extra = text.replace("/share", "").trim();

        let customButton = null;
        if (extra.includes("|")) {
          const [btnText, btnUrl] = extra.split("|");
          customButton = {
            inline_keyboard: [[{ text: btnText.trim(), url: btnUrl.trim() }]]
          };
        }

        await broadcastPost(chatId, chatId, targetMsgId, customButton);
        return res.status(200).json({ ok: true });
      }

      if (text === "/stats") {
        const usersObj = await firebaseRequest("users");
        const count = usersObj ? Object.keys(usersObj).length : 0;
        await sendMessage(chatId, `📊 Total Bot Users: <b>${count}</b>`);
        return res.status(200).json({ ok: true });
      }
    }

    // --- /start COMMAND ---
    if (text.startsWith("/start")) {
      const parts = text.split(" ");
      const refCode = parts.length > 1 && /^\d+$/.test(parts[1]) ? parts[1] : null;

      const existingUser = await firebaseRequest(`users/${userId}`);
      if (!existingUser) {
        const validRef = refCode && refCode !== userId ? refCode : null;
        await firebaseRequest(`users/${userId}`, "PUT", {
          user_id: userId,
          full_name: fullName,
          username: username,
          balance: 0.0,
          refers: 0,
          referred_by: validRef,
          reward_credited: false,
          step: "idle",
          joined_at: new Date().toISOString()
        });

        await sendMessage(
          ADMIN_ID,
          `👤 <b>New User Joined Bot</b>\nName: ${fullName} (<code>${userId}</code>)\nRef By: <code>${validRef || "Direct"}</code>`
        );
      }

      const unjoined = await getUnjoinedSponsors(userId);
      if (unjoined.length > 0) {
        const { text: spText, markup } = buildSponsorUI(firstName, unjoined);
        await sendMessage(chatId, spText, markup);
      } else {
        await sendMessage(
          chatId,
          `🎉 Welcome back, <b>${firstName}</b>!`,
          mainMenuKeyboard()
        );
      }
      return res.status(200).json({ ok: true });
    }

    // --- MENU BUTTONS ---
    if (text === "💰 Balance") {
      const u = (await firebaseRequest(`users/${userId}`)) || {};
      const bal = Number(u.balance || 0).toFixed(2);
      const refs = Number(u.refers || 0);
      await sendMessage(
        chatId,
        `👤 <b>User:</b> ${firstName}\n` +
        `💰 <b>Balance:</b> <code>${bal} USDT</code>\n` +
        `👥 <b>Total Invites:</b> ${refs} users`
      );
      return res.status(200).json({ ok: true });
    }

    if (text === "👥 Referral Link") {
      const botInfoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
      const botInfo = await botInfoRes.json();
      const refLink = `https://t.me/${botInfo.result.username}?start=${userId}`;

      const shareBtn = {
        inline_keyboard: [[
          {
            text: "📤 Share Invite Link",
            url: `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent("Join & Earn Free USDT!")}`
          }
        ]]
      };

      await sendMessage(
        chatId,
        `🔥 <b>Invite Friends & Earn Unlimited USDT!</b>\n\n` +
        `💵 <b>Per Refer:</b> ${PER_REFER} USDT\n` +
        `💳 <b>Minimum Withdraw:</b> ${MIN_WITHDRAW} USDT (5 Refers)\n\n` +
        `🔗 <b>Your Offer Link:</b>\n<code>${refLink}</code>`,
        shareBtn
      );
      return res.status(200).json({ ok: true });
    }

    if (text === "📊 Rules") {
      await sendMessage(
        chatId,
        `📌 <b>Bot Rules & Info</b>\n\n` +
        `• Per Refer: <b>${PER_REFER} USDT</b>\n` +
        `• Minimum Withdraw: <b>${MIN_WITHDRAW} USDT</b>\n` +
        `• 5 Refer And Withdraw Unlimited 🔥\n` +
        `• Payment Instant BEP20 Address\n` +
        `• Don't unsubscribe sponsors within 48 hours.`
      );
      return res.status(200).json({ ok: true });
    }

    if (text === "💸 Withdraw") {
      const u = (await firebaseRequest(`users/${userId}`)) || {};
      const bal = Number(u.balance || 0);

      if (bal < MIN_WITHDRAW) {
        await sendMessage(
          chatId,
          `❌ <b>Insufficient Balance!</b>\n` +
          `Minimum withdraw is <b>${MIN_WITHDRAW} USDT</b>.\n` +
          `Your balance: <code>${bal.toFixed(2)} USDT</code>`
        );
        return res.status(200).json({ ok: true });
      }

      await firebaseRequest(`users/${userId}`, "PATCH", { step: "awaiting_wallet" });
      await sendMessage(
        chatId,
        "💳 Please send your <b>USDT (BEP20) Wallet Address</b>:\n" +
        "<i>(Must start with 0x... and be 42 characters)</i>"
      );
      return res.status(200).json({ ok: true });
    }

    // --- BEP20 WALLET ADDRESS INPUT ---
    const currentUser = await firebaseRequest(`users/${userId}`);
    if (currentUser && currentUser.step === "awaiting_wallet") {
      if (!/^0x[a-fA-F0-9]{40}$/.test(text)) {
        await sendMessage(
          chatId,
          "⚠️ Invalid BEP20 address! Please enter a valid <code>0x...</code> address:"
        );
        return res.status(200).json({ ok: true });
      }

      const amount = Number(Number(currentUser.balance || 0).toFixed(4));
      await firebaseRequest(`users/${userId}`, "PATCH", {
        balance: 0.0,
        step: "idle",
        wallet: text
      });

      await sendMessage(
        chatId,
        `✅ <b>Withdrawal Request Submitted!</b>\n\n` +
        `💰 <b>Amount:</b> ${amount} USDT\n` +
        `🌐 <b>Network:</b> BEP20\n` +
        `💳 <b>Address:</b> <code>${text}</code>\n` +
        `⏳ Status: <b>Processing...</b>`
      );

      const adminKb = {
        inline_keyboard: [[
          { text: "✅ Mark Paid", callback_data: `paid_${userId}_${amount}` },
          { text: "❌ Reject", callback_data: `reject_${userId}_${amount}` }
        ]]
      };

      await sendMessage(
        ADMIN_ID,
        `🔔 <b>New Withdraw Request</b>\n\n` +
        `👤 User: ${fullName} (<code>${userId}</code>)\n` +
        `💰 Amount: <b>${amount} USDT</b>\n` +
        `💳 BEP20: <code>${text}</code>`,
        adminKb
      );
      return res.status(200).json({ ok: true });
    }
  } catch (err) {
    console.error("Bot Error:", err);
  }

  return res.status(200).json({ ok: true });
}

// --- SPONSOR HELPERS ---
async function getUnjoinedSponsors(userId) {
  const unjoined = [];
  const validStatuses = ["member", "administrator", "creator"];

  for (const sp of SPONSORS) {
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${encodeURIComponent(sp.chat_id)}&user_id=${userId}`
      );
      const data = await res.json();
      if (!data.ok || !validStatuses.includes(data.result.status)) {
        unjoined.push(sp);
      }
    } catch {
      unjoined.push(sp);
    }
  }
  return unjoined;
}

function buildSponsorUI(userName, unjoined) {
  const total = SPONSORS.length;
  const remaining = unjoined.length;
  const done = total - remaining;

  const text =
    `✅ <b>Welcome ${userName}</b> 👁\n\n` +
    `📢 To access the bot, subscribe to the following sponsors:\n\n` +
    `📊 Total sponsors: <b>${total}</b>\n` +
    `👤 You done: <b>${done} sponsors</b>\n` +
    `⏳ Remaining: <b>${remaining} sponsors</b>\n\n` +
    `⚠️ <i>Don't unsubscribe from sponsors within 48 hours, otherwise your account ` +
    `may be blocked and you won't receive your reward!</i>`;

  const keyboard = [];
  let row = [];
  for (const sp of unjoined) {
    row.push({ text: "☑️ SUBSCRIBE", url: sp.url });
    if (row.length === 2) {
      keyboard.push(row);
      row = [];
    }
  }
  if (row.length > 0) keyboard.push(row);

  keyboard.push([{ text: "✅ DONE SPONSORS", callback_data: "check_sponsors" }]);
  return { text, markup: { inline_keyboard: keyboard } };
}

function mainMenuKeyboard() {
  return {
    keyboard: [
      [{ text: "💰 Balance" }, { text: "👥 Referral Link" }],
      [{ text: "💸 Withdraw" }, { text: "📊 Rules" }]
    ],
    resize_keyboard: true
  };
}

// --- POST SHARE BROADCAST ---
async function broadcastPost(adminChatId, fromChatId, messageId, replyMarkup) {
  const usersObj = await firebaseRequest("users");
  if (!usersObj) return sendMessage(adminChatId, "No users found.");

  const userIds = Object.keys(usersObj);
  await sendMessage(adminChatId, `⏳ Sharing post to (${userIds.length}) users...`);

  let successCount = 0;
  let failCount = 0;

  for (const uid of userIds) {
    const bodyData = { chat_id: uid, from_chat_id: fromChatId, message_id: messageId };
    if (replyMarkup) bodyData.reply_markup = replyMarkup;

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/copyMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyData)
    });
    const data = await res.json();
    if (data.ok) successCount++;
    else failCount++;
  }

  await sendMessage(
    adminChatId,
    `✅ <b>Post Shared!</b>\n📨 Success: <b>${successCount}</b>\n❌ Failed: <b>${failCount}</b>`
  );
}

// --- TELEGRAM & FIREBASE HELPERS ---
async function firebaseRequest(path, method = "GET", body = null) {
  const options = { method, headers: { "Content-Type": "application/json" } };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${FIREBASE_URL}/${path}.json`, options);
  return res.ok ? await res.json() : null;
}

async function sendMessage(chatId, text, replyMarkup = null) {
  const payload = { chat_id: chatId, text, parse_mode: "HTML" };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  return data.ok === true;
}

async function editMessageText(chatId, messageId, text, replyMarkup = null) {
  const payload = { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML" };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

async function deleteMessage(chatId, messageId) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId })
  });
}

async function answerCallback(callbackQueryId, text, showAlert = false) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: showAlert })
  });
}
