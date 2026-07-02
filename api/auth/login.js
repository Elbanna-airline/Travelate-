import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Simulated database
const users = new Map();

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
    }

    // في production: احصل على المستخدم من DB
    const user = users.get(email);

    if (!user) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: 'يجب تفعيل بريدك الإلكتروني أولاً' });
    }

    // تحقق من كلمة المرور
    const passwordHash = crypto
      .createHash('sha256')
      .update(password + 'salt-key-change-in-production')
      .digest('hex');

    if (passwordHash !== user.passwordHash) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
    }

    // إنشاء JWT (استخدم environment variable للـ secret في production)
    const token = jwt.sign(
      { email: user.email, username: user.username },
      process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
      { expiresIn: '7d' }
    );

    // في production: استخدم HttpOnly cookie
    res.setHeader('Set-Cookie', `auth-token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800`);

    return res.status(200).json({
      success: true,
      token,
      user: { email: user.email, username: user.username },
      message: 'تم الدخول بنجاح',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'خطأ في السيرفر' });
  }
}
