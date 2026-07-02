import crypto from 'crypto';

// Simulated database
const users = new Map();
const resetTokens = new Map();

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'البريد الإلكتروني مطلوب' });
    }

    // في production: احصل من DB
    const user = users.get(email);

    if (!user) {
      // للأمان: لا تخبر المستخدم ما إذا كان البريد موجوداً أم لا
      return res.status(200).json({
        success: true,
        message: 'إذا كان البريد موجوداً، ستصل رسالة إعادة تعيين',
      });
    }

    // إنشاء توكن إعادة تعيين
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // ساعة واحدة

    resetTokens.set(resetToken, {
      email,
      expiresAt: expiresAt.toISOString(),
    });

    // في production: أرسل بريد عبر SendGrid
    // الرابط: https://yourapp.com/reset?token=resetToken
    const resetLink = `https://yourapp.com/reset?token=${resetToken}`;

    return res.status(200).json({
      success: true,
      message: 'تم إرسال رابط إعادة التعيين إلى بريدك',
      resetLink: process.env.NODE_ENV === 'development' ? resetLink : undefined,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'خطأ في السيرفر' });
  }
}
