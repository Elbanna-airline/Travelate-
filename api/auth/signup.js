import crypto from 'crypto';

// في بيئة production، استخدم قاعدة بيانات حقيقية (Supabase, Firebase, إلخ)
// للتطوير المحلي، نستخدم JSON storage بسيطة

const users = new Map(); // simulate database

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'البريد الإلكتروني غير صحيح' });
    }

    // Check if user already exists (في production، تحقق من DB)
    if (users.has(email)) {
      return res.status(409).json({ error: 'البريد الإلكتروني مسجل بالفعل' });
    }

    // في production، استخدم bcrypt أو argon2
    // للتطوير فقط:
    const passwordHash = crypto
      .createHash('sha256')
      .update(password + 'salt-key-change-in-production')
      .digest('hex');

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = {
      username,
      email,
      passwordHash,
      isVerified: false,
      verificationToken,
      verificationExpiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    };

    users.set(email, user);

    // في production: أرسل بريد تفعيل عبر SendGrid/Mailgun
    // للتطوير: أرجع التوكن للاختبار
    return res.status(201).json({
      success: true,
      message: 'تم التسجيل بنجاح! تحقق من بريدك الإلكتروني',
      verificationToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'خطأ في السيرفر' });
  }
}
