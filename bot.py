import asyncio
import logging
from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart, CommandObject

# ၁။ ဒီနေရာမှာ ကိုယ့်ရဲ့ Bot Token နဲ့ Admin ID ထည့်ပါ
BOT_TOKEN = "YOUR_BOT_TOKEN_HERE"
ADMIN_ID = 123456789  # @userinfobot ကရတဲ့ ကိုယ့်ရဲ့ Telegram ID

logging.basicConfig(level=logging.INFO)
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

@dp.message(CommandStart())
async def cmd_start(message: types.Message, command: CommandObject):
    user = message.from_user
    # Link နောက်ကပါလာတဲ့ စာသား (Payload) ကို ဖမ်းယူခြင်း (ဥပမာ - ?start=abc ဆိုရင် abc ကိုရမယ်)
    ref_code = command.args 
    
    # User ရဲ့ အချက်အလက်တွေ စုစည်းခြင်း
    user_name = user.full_name
    username = f"@{user.username}" if user.username else "Username မရှိပါ"
    user_id = user.id

    # ၂။ လင့်ကနေ ဝင်လာတာ ဟုတ်/မဟုတ် စစ်ဆေးပြီး Admin ဆီ စာပို့ခြင်း
    if ref_code:
        admin_text = (
            f"🚨 **လင့်ကနေ လူသစ်ဝင်လာပါပြီ!**\n\n"
            f"🔗 **ဝင်လာတဲ့ Link Code:** `{ref_code}`\n"
            f"👤 **နာမည်:** {user_name}\n"
            f"🆔 **User ID:** `{user_id}`\n"
            f"📛 **Username:** {username}"
        )
        # User ဘက်ကို ပြန်ပြမယ့်စာ
        await message.answer(f"မင်္ဂလာပါ {user_name}! ဖိတ်ခေါ်လင့် ({ref_code}) ကနေ ကြိုဆိုပါတယ်။")
    else:
        admin_text = (
            f"👤 **ရိုးရိုး /start နှိပ်ပြီး ဝင်လာသူ**\n\n"
            f"👤 **နာမည်:** {user_name}\n"
            f"🆔 **User ID:** `{user_id}`\n"
            f"📛 **Username:** {username}"
        )
        await message.answer(f"မင်္ဂလာပါ {user_name}! Bot မှ ကြိုဆိုပါတယ်။")

    # Admin (မင်းရဲ့ Telegram) ဆီကို Notification လှမ်းပို့ခြင်း
    try:
        await bot.send_message(chat_id=ADMIN_ID, text=admin_text, parse_mode="Markdown")
    except Exception as e:
        logging.error(f"Admin ဆီ စာပို့မရပါ (Bot ကို အရင် /start နှိပ်ထားပါ): {e}")

async def main():
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
