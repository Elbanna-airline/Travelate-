# 🔐 نظام المصادقة - TravELate

## نظرة عامة

تم إضافة نظام مصادقة حديث وآمن إلى تطبيق TravELate يسمح للمستخدمين بـ:
- ✅ التسجيل (Signup) برقم مستخدم وبريد إلكتروني وكلمة مرور آمنة
- ✅ تفعيل البريد الإلكتروني (Email Verification)
- ✅ تسجيل الدخول (Login) مع JWT tokens
- ✅ استعادة كلمة المرور (Password Reset)

## المزايا الأمنية

- 🔒 **Password Hashing**: استخدام SHA-256 (في production استخدم bcrypt/argon2)
- 🔑 **JWT Tokens**: توكنات آمنة مع انتهاء صلاحية
- 📧 **Email Verification**: التحقق من البريد قبل استخدام الحساب
- ⏰ **Token Expiration**: صلاحية محدودة للتوكنات (24 ساعة للتحقق، ساعة واحدة لإعادة التعيين)
- 🛡️ **Input Validation**: التحقق من صحة جميع المدخلات
- 🚫 **Rate Limiting**: يجب إضافة rate limiting في production

---

## البيئات المطلوبة (Environment Variables)

أنشئ ملف `.env` أو أضف هذه المتغيرات إلى بيئتك:

```env
# JWT Secret - استخدم مفتاح قوي عشوائي في production
JWT_SECRET=your-super-secret-key-change-in-production

# Gemini API Key (موجود بالفعل)
GEMINI_API_KEY=your-gemini-api-key

# SMTP Configuration (للبريد الإلكتروني)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@travelate.com

# قاعدة البيانات (اختياري - حالياً نستخدم simulation)
DATABASE_URL=postgresql://user:password@localhost:5432/travelate

# بيئة التطوير
NODE_ENV=development
```

---

## نقاط الاتصال (API Endpoints)

### 1. التسجيل - Signup
**POST** `/api/auth/signup`

**Body:**
```json
{
  "username": "mahmoud",
  "email": "mahmoud@example.com",
  "password": "SecurePass123"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "تم التسجيل بنجاح! تحقق من بريدك الإلكتروني",
  "verificationToken": "abc123..." (في development فقط)
}
```

---

### 2. تفعيل البريد - Verify Email
**GET** `/api/auth/verify?token=abc123`

أو **POST** `/api/auth/verify`
```json
{
  "token": "abc123..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "تم تفعيل الحساب بنجاح!"
}
```

---

### 3. تسجيل الدخول - Login
**POST** `/api/auth/login`

**Body:**
```json
{
  "email": "mahmoud@example.com",
  "password": "SecurePass123"
}
```

**Response (200):**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "email": "mahmoud@example.com",
    "username": "mahmoud"
  },
  "message": "تم الدخول بنجاح"
}
```

**Cookie:**
```
Set-Cookie: auth-token=eyJhbGc...; HttpOnly; Secure; SameSite=Strict; Max-Age=604800
```

---

### 4. طلب إعادة تعيين كلمة المرور - Reset Request
**POST** `/api/auth/reset-request`

**Body:**
```json
{
  "email": "mahmoud@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "إذا كان البريد موجوداً، ستصل رسالة إعادة تعيين",
  "resetLink": "https://yourapp.com/reset?token=xyz789..." (في development فقط)
}
```

---

### 5. إعادة تعيين كلمة المرور - Reset
**POST** `/api/auth/reset`

**Body:**
```json
{
  "token": "xyz789...",
  "newPassword": "NewSecurePass456"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "تم تحديث كلمة المرور بنجاح"
}
```

---

## الملفات المضافة

```
api/auth/
├── signup.js          # تسجيل مستخدم جديد
├── login.js           # تسجيل الدخول
├── verify.js          # تفعيل البريد الإلكتروني
├── reset-request.js   # طلب إعادة تعيين كلمة المرور
└── reset.js           # تنفيذ إعادة تعيين كلمة المرور

.env.example          # مثال متغيرات البيئة
README-AUTH.md        # هذا الملف
```

---

## الخطوات التالية

### 1. إضافة قاعدة بيانات حقيقية (Supabase/Firebase)

حالياً، نستخدم simulation في الذاكرة. استبدلها بـ:

```javascript
// مثال مع Supabase
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// في signup:
const { data, error } = await supabase
  .from('users')
  .insert([{ username, email, password_hash: passwordHash, is_verified: false }]);
```

### 2. إضافة إرسال البريد الإلكتروني

استخدم SendGrid أو Mailgun:

```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

await sgMail.send({
  to: email,
  from: process.env.SMTP_FROM,
  subject: 'تفعيل حسابك في TravELate',
  html: `
    <h1>مرحباً بك في TravELate</h1>
    <p><a href="https://yourapp.com/verify?token=${verificationToken}">اضغط هنا لتفعيل حسابك</a></p>
  `,
});
```

### 3. تحديث الواجهة الأمامية (index.html)

استبدل نظام الـ login الحالي بـ:

```javascript
async function signup() {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: document.getElementById('username').value,
      email: document.getElementById('email').value,
      password: document.getElementById('password').value
    })
  });
  const data = await res.json();
  if (data.success) {
    showToast('✅ تم التسجيل! تحقق من بريدك');
  }
}

async function login() {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: document.getElementById('email').value,
      password: document.getElementById('password').value
    })
  });
  const data = await res.json();
  if (data.success) {
    localStorage.setItem('auth-token', data.token);
    window.location.href = '/';
  }
}
```

### 4. استخدام bcrypt بدل SHA-256

في production، استخدم مكتبة bcrypt الآمنة:

```bash
npm install bcrypt
```

```javascript
import bcrypt from 'bcrypt';

// في signup:
const passwordHash = await bcrypt.hash(password, 10);

// في login:
const isValidPassword = await bcrypt.compare(password, user.passwordHash);
```

---

## قائمة مراجعة الأمان 🔒

- ✅ Validation لجميع المدخلات
- ✅ Password hashing (upgrade to bcrypt في production)
- ✅ Email verification قبل استخدام الحساب
- ✅ Token expiration محدود
- ✅ HttpOnly cookies للـ JWT
- ⚠️ **TODO**: HTTPS إجباري في production
- ⚠️ **TODO**: Rate limiting على endpoints
- ⚠️ **TODO**: CORS configuration
- ⚠️ **TODO**: SQL injection prevention (استخدام parameterized queries)
- ⚠️ **TODO**: 2FA (Two-Factor Authentication)
- ⚠️ **TODO**: Account lockout بعد محاولات فاشلة

---

## الاختبار المحلي

```bash
# 1. تثبيت المتطلبات
npm install jsonwebtoken

# 2. شغّل Netlify CLI
netlify dev

# 3. اختبر endpoints باستخدام curl أو Postman

# Signup
curl -X POST http://localhost:8888/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@example.com","password":"TestPass123"}'

# Verify
curl -X GET "http://localhost:8888/api/auth/verify?token=YOUR_TOKEN"

# Login
curl -X POST http://localhost:8888/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPass123"}'
```

---

## ملاحظات مهمة ⚠️

1. **نستخدم حالياً simulation** في الذاكرة - البيانات تُفقد عند إعادة تشغيل السيرفر
2. **Salt للـ hash قاسي** - استخدم crypto أو bcrypt في production
3. **JWT Secret ضعيف** - غيّر المتغيرات البيئية
4. **لا يوجد rate limiting** - أضف في production لمنع brute force
5. **CORS لم يتم تكوينه** - أضف في production

---

## المساعدة والدعم

للمزيد من التفاصيل عن:
- JWT: https://jwt.io
- bcrypt: https://www.npmjs.com/package/bcrypt
- Supabase: https://supabase.com
- SendGrid: https://sendgrid.com

---

**آخر تحديث**: 2026-07-02
**الحالة**: ✅ جاهز للتطوير | ⚠️ يحتاج تحديثات أمنية لـ production
