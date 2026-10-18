/**
 * سكربت تجربة إرسال خطأ اختباري مباشر إلى Sentry
 * تشغيل: node scripts/test-sentry.js
 */
const path = require('path');
const Sentry = require(path.join(__dirname, '../apps/api/node_modules/@sentry/nestjs'));

const DSN = 'https://804e5e3654a2c676be9ceba2e51b6019@o4512276489175040.ingest.us.sentry.io/4512276513292288';

Sentry.init({
  dsn: DSN,
  environment: 'production',
});

console.log('جاري إرسال استثناء اختباري إلى Sentry...');

const timeStr = new Date().toLocaleTimeString('ar-SY');
const eventId = Sentry.captureException(
  new Error(`تجربة الربط الحي مع تلغرام - فحص الويب هوك (${timeStr})`)
);

Sentry.flush(3000)
  .then(() => {
    console.log('----------------------------------------------------');
    console.log('✅ تم إرسال الخطأ بنجاح!');
    console.log(`معرّف الحدث (Event ID): ${eventId}`);
    console.log('افتح صفحة المشاكل في Sentry لرؤيته فوراً:');
    console.log('https://fawrun-api.sentry.io/issues/');
    console.log('----------------------------------------------------');
    process.exit(0);
  })
  .catch((err) => {
    console.error('فشل الإرسال:', err);
    process.exit(1);
  });
