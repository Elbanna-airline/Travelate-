// Simulated database
const users = new Map();

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const token = req.query.token || req.body.token;

    if (!token) {
      return res.status(400).json({ error: 'التوكن مطلوب' });
    }

    // البحث عن المستخدم بالـ token
    let user = null;
    for (const [email, userData] of users) {
      if (userData.verificationToken === token) {
        user = userData;
        break;
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'التوكن غير صحيح أو منتهي الصلاحية' });
    }

    // تحقق من انتهاء الصلاحية
    const expiresAt = new Date(user.verificationExpiresAt);
    if (new Date() > expiresAt) {
      return res.status(410).json({ error: 'انتهت صلاحية التوكن' });
    }

    // فعّل الحساب
    user.isVerified = true;
    user.verificationToken = null;
    user.verificationExpiresAt = null;

    return res.status(200).json({
      success: true,
      message: 'تم تفعيل الحساب بنجاح!',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'خطأ في السيرفر' });
  }
}
