import crypto from 'crypto';

// Simulated database
const users = new Map();
const resetTokens = new Map();

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'التوكن وكلمة المرور الجديدة مطلوبان' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' });
    }

    // تحقق من التوكن
    const resetData = resetTokens.get(token);

    if (!resetData) {
      return res.status(404).json({ error: 'التوكن غير صحيح' });
    }

    // تحقق من الصلاحية
    if (new Date() > new Date(resetData.expiresAt)) {
      resetTokens.delete(token);
      return res.status(410).json({ error: 'انتهت صلاحية التوكن' });
    }

    // احصل على المستخدم
    const user = users.get(resetData.email);

    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }

    // حدّث كلمة المرور
    const newPasswordHash = crypto
      .createHash('sha256')
      .update(newPassword + 'salt-key-change-in-production')
      .digest('hex');

    user.passwordHash = newPasswordHash;

    // احذف التوكن
    resetTokens.delete(token);

    return res.status(200).json({
      success: true,
      message: 'تم تحديث كلمة المرور بنجاح',
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'خطأ في السيرفر' });
  }
}
