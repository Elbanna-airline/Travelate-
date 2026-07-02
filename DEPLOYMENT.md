# 🚀 دليل الترجمة والنشر - TravELate Authentication System

## نظرة عامة سريعة

تم إضافة نظام مصادقة كامل مع الميزات التالية:
- ✅ نظام تسجيل (Signup) آمن
- ✅ تسجيل دخول (Login) مع JWT
- ✅ تفعيل البريد الإلكتروني (Email Verification)
- ✅ استعادة كلمة المرور (Password Reset)

---

## 🔧 الخطوات المطلوبة قبل النشر

### 1. استنساخ المستودع (Clone)

```bash
git clone https://github.com/Elbanna-airline/Travelate-.git
cd Travelate-
git checkout feature/auth-system
```

### 2. تثبيت المتطلبات (Dependencies)

```bash
npm install
# أو
yarn install
```

### 3. إعداد متغيرات البيئة (Environment Variables)

انسخ `.env.example` إلى `.env`:

```bash
cp .env.example .env
```

ثم عدّل `.env` وأضف قيمك الخاصة:

```env
JWT_SECRET=your-super-secret-key-here-min-32-chars
GEMINI_API_KEY=your-gemini-api-key
NODE_ENV=development
```

### 4. الاختبار المحلي (Local Testing)

```bash
npm run dev
# أو
netlify dev
```

ستجد التطبيق على: `http://localhost:8888`

---

## 📋 نقاط التحقق (Checklist)

قبل النشر على الإنتاج، تأكد من:

- ✅ تثبيت جميع المتطلبات
- ✅ تعيين جميع متغيرات البيئة
- ✅ اختبار جميع وظائف المصادقة محليًا
- ✅ تفعيل HTTPS
- ✅ إضافة rate limiting
- ✅ استخدام bcrypt بدل SHA-256
- ✅ تكوين CORS بشكل صحيح
- ✅ إعداد قاعدة بيانات حقيقية (Supabase/Firebase)
- ✅ إعداد خدمة البريد الإلكتروني
- ✅ اختبار في بيئة staging

---

## 🌐 النشر على Netlify

### الخطوة 1: ربط المستودع

```bash
netlify login
netlify link --id=your-netlify-site-id
```

### الخطوة 2: تعيين متغيرات البيئة

#### عبر سطر الأوامر:
```bash
netlify env:set JWT_SECRET "your-secret-key"
netlify env:set GEMINI_API_KEY "your-api-key"
netlify env:set DATABASE_URL "your-db-url"
netlify env:set SMTP_HOST "smtp.gmail.com"
netlify env:set SMTP_PORT "587"
netlify env:set SMTP_USER "your-email@gmail.com"
netlify env:set SMTP_PASSWORD "your-app-password"
```

#### أو عبر لوحة التحكم:
1. اذهب إلى https://app.netlify.com
2. اختر موقعك
3. Site Settings → Build & Deploy → Environment
4. أضف متغيرات البيئة

### الخطوة 3: النشر

```bash
# اختبر الفروع أولاً
netlify deploy --alias=preview

# ثم انشر على الإنتاج
git push origin feature/auth-system
# سيُنشر تلقائياً عند دمج PR
```

---

## 🔗 دمج الفرع (Merge Branch)

### الخطوة 1: إنشاء Pull Request

```bash
git push origin feature/auth-system
```

ثم:
1. اذهب إلى GitHub
2. اضغط "Compare & pull request"
3. أضف وصفًا مفصلاً
4. اطلب مراجعة (Review)

### الخطوة 2: مراجعة والدمج

```bash
# بعد الموافقة من المراجع
git checkout main
git pull origin main
git merge feature/auth-system
git push origin main
```

---

## 🗄️ إعداد قاعدة البيانات

### خيار 1: Supabase (موصى به)

```bash
npm install @supabase/supabase-js
```

**ملف إعداد supabase:**
```javascript
// lib/supabase.js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)
```

**تطبيق في signup:**
```javascript
const { data, error } = await supabase
  .from('users')
  .insert([{ 
    username, 
    email, 
    password_hash: passwordHash,
    is_verified: false 
  }])
```

### خيار 2: Firebase

```bash
npm install firebase-admin
```

**الإعداد:**
```javascript
import admin from 'firebase-admin'

admin.initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
})

const db = admin.firestore()
```

### خيار 3: MongoDB

```bash
npm install mongoose
```

**الإعداد:**
```javascript
import mongoose from 'mongoose'

await mongoose.connect(process.env.DATABASE_URL)

const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  passwordHash: String,
  isVerified: Boolean,
  createdAt: { type: Date, default: Date.now }
})

export const User = mongoose.model('User', userSchema)
```

---

## 📧 إعداد خدمة البريد الإلكتروني

### خيار 1: SendGrid (موصى به)

```bash
npm install @sendgrid/mail
```

**الاستخدام:**
```javascript
import sgMail from '@sendgrid/mail'

sgMail.setApiKey(process.env.SENDGRID_API_KEY)

await sgMail.send({
  to: email,
  from: 'noreply@travelate.com',
  subject: 'تفعيل حسابك في TravELate',
  html: `
    <h1>مرحباً بك</h1>
    <p><a href="${process.env.APP_URL}/verify?token=${token}">اضغط هنا</a></p>
  `
})
```

### خيار 2: Mailgun

```bash
npm install mailgun.js
```

### خيار 3: Gmail SMTP

```javascript
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD // App Password
  }
})

await transporter.sendMail({
  to: email,
  from: process.env.SMTP_FROM,
  subject: 'تفعيل حسابك',
  html: `...`
})
```

---

## 🔒 الأمان في الإنتاج

### 1. استخدام bcrypt

```bash
npm install bcrypt
```

**تحديث api/auth/signup.js:**
```javascript
import bcrypt from 'bcrypt'

const passwordHash = await bcrypt.hash(password, 10)
```

**تحديث api/auth/login.js:**
```javascript
const isValidPassword = await bcrypt.compare(password, user.passwordHash)
```

### 2. تفعيل HTTPS

تأكد من أن Netlify لديها HTTPS مفعّلة:
- Site Settings → Domain Management → HTTPS
- يجب أن يكون "Let's Encrypt" مفعّلاً

### 3. إضافة Rate Limiting

```bash
npm install express-rate-limit
```

```javascript
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 100 // 100 محاولة لكل IP
})

app.use('/api/auth/', limiter)
```

### 4. تكوين CORS

```javascript
import cors from 'cors'

app.use(cors({
  origin: process.env.CORS_ORIGIN.split(','),
  credentials: true
}))
```

### 5. استخدام 2FA

```bash
npm install speakeasy qrcode
```

---

## ✅ اختبار الميزات

### اختبار Signup
```bash
curl -X POST http://localhost:8888/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "TestPass123"
  }'
```

### اختبار Login
```bash
curl -X POST http://localhost:8888/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123"
  }'
```

### اختبار Verify
```bash
curl -X GET "http://localhost:8888/api/auth/verify?token=YOUR_TOKEN"
```

---

## 🐛 استكشاف الأخطاء

### المشكلة: "JWT_SECRET not found"
**الحل:** أضف `JWT_SECRET` إلى `.env`

### المشكلة: "Cannot find module 'jsonwebtoken'"
**الحل:** شغّل `npm install jsonwebtoken`

### المشكلة: "CORS error"
**الحل:** أضف `CORS_ORIGIN` إلى `netlify.toml` أو `.env`

### المشكلة: "Email not sending"
**الحل:** 
- تحقق من بيانات SMTP
- استخدم App Password بدل كلمة المرور العادية
- أضف رقم الهاتف للـ SendGrid

---

## 📚 الموارد الإضافية

- [JWT Documentation](https://jwt.io)
- [Netlify Functions](https://docs.netlify.com/functions/overview/)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [SendGrid Email API](https://sendgrid.com/docs/for-developers/)

---

## 📞 الدعم

للمساعدة:
1. افتح issue على GitHub
2. راجع README-AUTH.md
3. تحقق من logs في Netlify
4. استخدم DevTools في المتصفح

---

## ✨ الخطوات التالية

بعد النشر الناجح:
1. ✅ أضف اختبارات وحدة (Unit Tests)
2. ✅ أضف اختبارات تكامل (Integration Tests)
3. ✅ راقب الأخطاء عبر Sentry
4. ✅ أضف تحليلات Google
5. ✅ وثّق API endpoints بـ Swagger/OpenAPI
6. ✅ أضف تسجيل الدخول الاجتماعي (Google/GitHub/Facebook)
7. ✅ أضف 2FA
8. ✅ أضف OAuth 2.0

---

**آخر تحديث:** 2026-07-02  
**الحالة:** ✅ جاهز للنشر  
**المتطلبات:** Node.js 18+, Netlify CLI, Git
