import React from 'react';
import './LandingPage.css';

// WhatsApp Configuration
const ADMIN_WHATSAPP_NUMBER = '963981571936';
const ADMIN_WHATSAPP_DISPLAY = '+963 981 571 936';
const VERIFY_MSG = encodeURIComponent('مرحباً، أود تفعيل حسابي في تطبيق فَوْراً');
const APK_DOWNLOAD_URL = '/forerun.apk';

const WHATSAPP_VERIFY_URL = `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${VERIFY_MSG}`;

export const LandingPage: React.FC = () => {
  const handleScrollTo = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="landing-wrapper" dir="rtl">
      {/* 1. STICKY TOP HEADER */}
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="landing-logo-group">
            <img
              src="/logo.webp"
              alt="فَوْراً - FORERUN"
              className="landing-logo-img"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.dataset.fallback) {
                  target.dataset.fallback = 'true';
                  target.src = '/app-icon.png';
                }
              }}
            />
            <span className="landing-logo-text">فَوْراً</span>
          </div>

          <div className="landing-header-actions">
            <span className="badge-location">القنجرة 📍</span>
            <a href="#download" onClick={handleScrollTo('download')} className="btn-header-cta">
              <svg className="btn-icon-svg" style={{ width: 14, height: 14 }} viewBox="0 0 24 24">
                <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993 0 .5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9994.4482.9994.9993 0 .5511-.4483.9997-.9994.9997m11.4045-6.02l1.996-3.4572c.1054-.1824.043-.4158-.1394-.5211-.1823-.1054-.4157-.043-.5211.1394l-2.025 3.5074C15.5414 8.2144 13.8344 7.778 12 7.778s-3.5414.4364-5.1915 1.21L4.7835 5.4805c-.1054-.1824-.3388-.2448-.5211-.1394-.1824.1053-.2448.3387-.1394.5211l1.996 3.4572C2.6886 11.2335.3478 14.8087 0 19.0006h24c-.3478-4.1919-2.6886-7.7671-6.1185-9.6792" />
              </svg>
              <span>تحميل APK</span>
            </a>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="landing-hero">
        <div className="landing-container">
          <div className="hero-pill-badge">
            <span>⚡ توصيل فوري — اطلب في ثواني</span>
          </div>

          <h1 className="hero-title">
            شو محتاج اليوم؟
            <br />
            طلبك لعندك… <span className="hero-title-highlight">فَوْراً</span>
          </h1>

          <p className="hero-desc">
            تصفّح بقاليات ومحلات منطقتك بالقنجرة، اطلب كل اللي ناقصك للبيت بسهولة وسرعة، يشتريها مندوب فَوْراً ويوصلها لباب بيتك، والدفع كاش عند الاستلام.
          </p>

          {/* Courier Card with Real Delivery Graphic */}
          <div className="hero-visual-card">
            <img
              src="/delivery.jpg"
              alt="مندوب فَوْراً ينطلق لتوصيل الطلب في القنجرة"
              className="hero-visual-img"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="hero-live-status">
              <div className="courier-info-group">
                <div className="courier-avatar">🛵</div>
                <div className="courier-texts">
                  <span className="courier-status-text">
                    في طريق التوصيل إليك
                    <span className="pulse-dot"></span>
                  </span>
                  <span className="courier-subtext">الكابتن مقترب من منطقتك بالقنجرة</span>
                </div>
              </div>
              <span className="badge-location" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                طلب نشط
              </span>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="hero-cta-group">
            <a href="#download" onClick={handleScrollTo('download')} className="btn-main-download">
              <div className="btn-main-left">
                <svg className="btn-icon-svg" viewBox="0 0 24 24">
                  <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993 0 .5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9994.4482.9994.9993 0 .5511-.4483.9997-.9994.9997m11.4045-6.02l1.996-3.4572c.1054-.1824.043-.4158-.1394-.5211-.1823-.1054-.4157-.043-.5211.1394l-2.025 3.5074C15.5414 8.2144 13.8344 7.778 12 7.778s-3.5414.4364-5.1915 1.21L4.7835 5.4805c-.1054-.1824-.3388-.2448-.5211-.1394-.1824.1053-.2448.3387-.1394.5211l1.996 3.4572C2.6886 11.2335.3478 14.8087 0 19.0006h24c-.3478-4.1919-2.6886-7.7671-6.1185-9.6792" />
                </svg>
                <div className="btn-main-texts">
                  <span className="btn-main-title">تحميل تطبيق فَوْراً للأندرويد</span>
                  <span className="btn-main-sub">ملف موقّع وآمن 100% · الإصدار المعتمد</span>
                </div>
              </div>
              <span className="btn-main-badge">
                <span>تنزيل APK</span>
                <svg style={{ width: 14, height: 14, fill: 'currentColor' }} viewBox="0 0 24 24">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
                </svg>
              </span>
            </a>

            <a href="#how-it-works" onClick={handleScrollTo('how-it-works')} className="btn-how-it-works">
              <span>كيف يعمل التطبيق؟</span>
              <svg style={{ width: 14, height: 14, fill: 'currentColor' }} viewBox="0 0 24 24">
                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
              </svg>
            </a>
          </div>

          {/* Highlights 3 Pills */}
          <div className="hero-highlights-grid">
            <div className="highlight-box">
              <span className="highlight-emoji">⚡</span>
              <span className="highlight-text">توصيل فوري</span>
            </div>
            <div className="highlight-box">
              <span className="highlight-emoji">💵</span>
              <span className="highlight-text">دفع كاش</span>
            </div>
            <div className="highlight-box">
              <span className="highlight-emoji">📍</span>
              <span className="highlight-text">القنجرة ومحيطها</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS (4 STEPS) */}
      <section className="landing-section landing-section-alt" id="how-it-works">
        <div className="landing-container">
          <div className="section-header">
            <span className="section-tag">بسيطة وسلسة</span>
            <h2 className="section-title">كيف يعمل تطبيق فَوْراً؟</h2>
            <p className="section-subtitle">
              أربع خطوات سهلة تبدأ من هاتفك وتنتهي بدق الباب وتسليم طلبك باليد
            </p>
          </div>

          <div className="steps-list">
            {/* Step 1 */}
            <div className="step-card">
              <div className="step-header">
                <div className="step-number">١</div>
                <svg className="step-icon" viewBox="0 0 24 24">
                  <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z" />
                </svg>
              </div>
              <h3 className="step-title">حمّل وسجّل حسابك</h3>
              <p className="step-desc">
                أنشئ حسابك برقم الواتساب السوري الخاص بك <strong dir="ltr">(09xxxxxxxx)</strong> وحدد تفاصيل عنوانك بالقنجرة بدقة.
              </p>
              <div className="step-footer-pill">التسجيل خلال دقيقة واحدة فقط ✓</div>
            </div>

            {/* Step 2 (Mandatory WhatsApp) */}
            <div className="step-card step-card-mandatory">
              <span className="step-mandatory-tag">خطوة إلزامية</span>
              <div className="step-header">
                <div className="step-number step-number-orange">٢</div>
                <svg className="step-icon" style={{ fill: '#FF751F' }} viewBox="0 0 24 24">
                  <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
                </svg>
              </div>
              <h3 className="step-title">تفعيل الحساب عبر واتساب</h3>
              <p className="step-desc">
                أرسل رسالة التفعيل المباشرة لإدارة فَوْراً ليتم اعتماد وتوثيق حسابك فوراً والبدء بالطلب دون أي تأخير.
              </p>
              <div className="step-footer-pill step-footer-orange">
                تأكيد الموثوقية والأمان للجميع ⚡
              </div>
            </div>

            {/* Step 3 */}
            <div className="step-card">
              <div className="step-header">
                <div className="step-number">٣</div>
                <svg className="step-icon" viewBox="0 0 24 24">
                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                </svg>
              </div>
              <h3 className="step-title">اكتب طلبك بحرية</h3>
              <p className="step-desc">
                اكتب حاجياتك وبقاليتك بالطريقة التي تناسبك، من أي بقالية أو متجر تختاره داخل القنجرة بدون قيود.
              </p>
              <div className="step-footer-pill">قائمة مخصصة ومرنة بالكامل ✓</div>
            </div>

            {/* Step 4 */}
            <div className="step-card">
              <div className="step-header">
                <div className="step-number step-number-green">٤</div>
                <svg className="step-icon" style={{ fill: '#059669' }} viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              </div>
              <h3 className="step-title">المندوب يشتري ويوصل</h3>
              <p className="step-desc">
                يتولى المندوب تأمين كل الأغراض والانطلاق فوراً لباب منزلك، والدفع كاش عند الاستلام بكل راحة.
              </p>
              <div className="step-footer-pill step-footer-green">
                استلم على باب البيت وادفع كاش ✓
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. CRITICAL WHATSAPP VERIFICATION BOX */}
      <section className="landing-section">
        <div className="landing-container">
          <div className="whatsapp-notice-card">
            <div className="whatsapp-notice-top">
              <div className="warning-icon-box">
                <svg style={{ width: 26, height: 26, fill: 'currentColor' }} viewBox="0 0 24 24">
                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                </svg>
              </div>
              <div>
                <span className="notice-badge">إشعار هام لجميع المستخدمين</span>
                <h3 className="notice-title">
                  شرط إلزامي: تفعيل الحساب عبر واتساب قبل أول طلب
                </h3>
              </div>
            </div>

            <p className="notice-desc">
              شكراً لتسجيلك في فَوْراً! حفاظاً على سرعة وموثوقية التوصيل، يُرجى العلم أن إرسال رسالة التفعيل عبر واتساب إلى إدارة فَوْراً هو شرط إلزامي لإتمام تفعيل الحساب والبدء بالطلب فوراً.
            </p>

            <div className="msg-preview-box">
              <span className="msg-preview-label">نص رسالة التفعيل التلقائي في واتساب:</span>
              <span className="msg-preview-snippet">«مرحباً، أود تفعيل حسابي في تطبيق فَوْراً»</span>
            </div>

            <a
              href={WHATSAPP_VERIFY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-whatsapp-action"
            >
              <svg className="whatsapp-svg-icon" viewBox="0 0 24 24">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.299.144.347.491 1.2.534 1.287.043.087.072.188.014.303-.058.116-.087.188-.173.289l-.26.303c-.087.087-.177.181-.076.355.101.174.449.741.964 1.201.662.591 1.221.774 1.394.861.174.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.392-12.416c-5.514 0-10 4.486-10 10 0 1.761.458 3.415 1.258 4.86l-1.336 4.884 5.011-1.314c1.4.757 2.998 1.19 4.694 1.19 5.514 0 10-4.486 10-10s-4.486-10-10-10z" />
              </svg>
              <span>تواصل لتفعيل حسابك ({ADMIN_WHATSAPP_DISPLAY})</span>
            </a>
          </div>
        </div>
      </section>

      {/* 5. CORE FEATURES */}
      <section className="landing-section landing-section-alt">
        <div className="landing-container">
          <div className="section-header">
            <h2 className="section-title">لماذا تختار تطبيق فَوْراً؟</h2>
            <p className="section-subtitle">
              صُمم ليكون الحل الأكثر راحة وسرعة لأهل القنجرة وجوارها
            </p>
          </div>

          <div className="features-grid">
            {/* Feature 1 */}
            <div className="feature-item-card">
              <div className="feature-icon-wrapper icon-orange-bg">
                <svg style={{ width: 24, height: 24, fill: '#FF751F' }} viewBox="0 0 24 24">
                  <path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                </svg>
              </div>
              <div className="feature-texts">
                <h3 className="feature-name">دفع نقدًا عند الاستلام</h3>
                <p className="feature-details">
                  وفّر مشاويرك وتعبك، استلم أغراضك عند باب بيتك وادفع كاش بكل أمان وشفافية بدون أي تعقيد.
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="feature-item-card">
              <div className="feature-icon-wrapper icon-mint-bg">
                <svg style={{ width: 24, height: 24, fill: '#2EA59D' }} viewBox="0 0 24 24">
                  <path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z" />
                </svg>
              </div>
              <div className="feature-texts">
                <h3 className="feature-name">شراء حقيقي من محلات القنجرة</h3>
                <p className="feature-details">
                  نوفر كل أغراضك واحتياجاتك اليومية من أي بقالية، خضري، أو متجر تختاره داخل القنجرة.
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="feature-item-card">
              <div className="feature-icon-wrapper icon-orange-bg">
                <svg style={{ width: 24, height: 24, fill: '#FF751F' }} viewBox="0 0 24 24">
                  <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z" />
                </svg>
              </div>
              <div className="feature-texts">
                <h3 className="feature-name">متابعة وتتبع الطلب بدقة</h3>
                <p className="feature-details">
                  إشعارات وتتبع خطوة بخطوة لمراحل طلبك من المراجعة والشراء وحتى الوصول لباب بيتك مباشرة.
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="feature-item-card">
              <div className="feature-icon-wrapper icon-mint-bg">
                <svg style={{ width: 24, height: 24, fill: '#2EA59D' }} viewBox="0 0 24 24">
                  <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56-.35-.12-.74-.03-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z" />
                </svg>
              </div>
              <div className="feature-texts">
                <h3 className="feature-name">تواصل مباشر مع المندوب والإدارة</h3>
                <p className="feature-details">
                  تواصل مباشر بضغطة زر واحدة عبر الاتصال الهاتفي أو الواتساب مع المندوب المسؤول لتنسيق الطلب.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. HOW TO INSTALL APK IN 3 EASY STEPS */}
      <section className="landing-section">
        <div className="landing-container">
          <div className="section-header">
            <span className="section-tag" style={{ background: '#FFF2E8', color: '#FF751F' }}>
              دليل التثبيت السريع
            </span>
            <h2 className="section-title">طريقة تثبيت التطبيق بـ 3 خطوات</h2>
            <p className="section-subtitle">تثبيت آمن ومباشر لهواتف الأندرويد في ثوانٍ معدودة</p>
          </div>

          <div className="install-steps-wrapper">
            <div className="install-step-card">
              <div className="install-step-num">1</div>
              <div>
                <h4 className="install-step-title">اضغط على ملف الـ APK المحمّل</h4>
                <p className="install-step-desc">
                  بعد اكتمال التحميل، اضغط على الملف مباشرة من شريط الإشعارات العلوي أو من مجلد التنزيلات (Downloads).
                </p>
              </div>
            </div>

            <div className="install-step-card">
              <div className="install-step-num num-orange">2</div>
              <div>
                <h4 className="install-step-title">اسمح بالتثبيت من هذا المصدر</h4>
                <p className="install-step-desc">
                  إذا ظهرت رسالة الأمان في هاتفك، فعّل خيار <strong dir="ltr">"Allow from this source"</strong> للمتابعة، الملف آمن ومفحوص تماماً.
                </p>
              </div>
            </div>

            <div className="install-step-card">
              <div className="install-step-num num-green">3</div>
              <div>
                <h4 className="install-step-title">افتح التطبيق وابدأ طلبك</h4>
                <p className="install-step-desc">
                  افتح تطبيق فَوْراً، أدخل رقم هاتفك وعنوانك بالقنجرة، وفعل حسابك لتنطلق بأول طلب لك لعند باب بيتك!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. TRANSPARENCY & WORKING HOURS */}
      <section className="landing-section landing-section-alt">
        <div className="landing-container">
          {/* Working Hours */}
          <div className="info-card">
            <div className="info-card-header">
              <div className="info-icon-badge icon-mint-bg">
                <svg style={{ width: 18, height: 18, fill: '#2EA59D' }} viewBox="0 0 24 24">
                  <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2C11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                </svg>
              </div>
              <h3 className="info-card-title">ساعات العمل والجاهزية</h3>
            </div>
            <p className="info-card-desc">
              فريق فَوْراً والمندوبون متواجدون لخدمتكم يومياً من الساعة <strong>8:00 صباحاً</strong> وحتى <strong>12:00 منتصف الليل</strong> طيلة أيام الأسبوع.
            </p>
            <div className="info-footer-status">
              <span className="pulse-dot"></span>
              <span>جاهزون لتلقي وتوصيل طلباتكم اليوم</span>
            </div>
          </div>

          {/* Pricing Clarity */}
          <div className="info-card">
            <div className="info-card-header">
              <div className="info-icon-badge icon-orange-bg">
                <svg style={{ width: 18, height: 18, fill: '#FF751F' }} viewBox="0 0 24 24">
                  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2zm0-4H7V7h10v2z" />
                </svg>
              </div>
              <h3 className="info-card-title">وضوح الرسوم والشفافية</h3>
            </div>
            <p className="info-card-desc">
              رسوم توصيل شفافة وثابتة، تظهر لك تفاصيل الرسوم بدقة قبل تأكيد طلبك، مع إمكانية إلغاء الطلب مجاناً قبل بدء عملية الشراء من قبل المندوب.
            </p>
          </div>
        </div>
      </section>

      {/* 8. FINAL DOWNLOAD CARD (ID="DOWNLOAD") */}
      <section className="landing-section" id="download">
        <div className="landing-container">
          <div className="final-download-card">
            <div className="ambient-glow-1"></div>
            <div className="ambient-glow-2"></div>

            <div className="final-badge-pill">
              <span>تطبيق التوصيل الأول بالقنجرة</span>
            </div>

            <h2 className="final-card-title">
              جاهز لطلب كل ما يلزمك للبيت <span className="final-title-mint">فَوْراً</span>؟
            </h2>

            <p className="final-card-desc">
              حمّل التطبيق الآن، سجّل رقمك، وخلّي مشاوير البقالية والطلبات اليومية علينا. متواجدون دائماً لخدمتك.
            </p>

            <a
              href={APK_DOWNLOAD_URL}
              download="forerun.apk"
              className="final-btn-apk"
            >
              <svg className="btn-icon-svg" viewBox="0 0 24 24">
                <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993 0 .5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9994.4482.9994.9993 0 .5511-.4483.9997-.9994.9997m11.4045-6.02l1.996-3.4572c.1054-.1824.043-.4158-.1394-.5211-.1823-.1054-.4157-.043-.5211.1394l-2.025 3.5074C15.5414 8.2144 13.8344 7.778 12 7.778s-3.5414.4364-5.1915 1.21L4.7835 5.4805c-.1054-.1824-.3388-.2448-.5211-.1394-.1824.1053-.2448.3387-.1394.5211l1.996 3.4572C2.6886 11.2335.3478 14.8087 0 19.0006h24c-.3478-4.1919-2.6886-7.7671-6.1185-9.6792" />
              </svg>
              <span>تحميل تطبيق الأندرويد الآن (APK)</span>
            </a>

            <div className="tech-specs-bar">
              <span>✓ أندرويد 8.0+</span>
              <span>•</span>
              <span>⚡ حجم خفيف وسريع</span>
              <span>•</span>
              <span>🔒 آمن ومفحوص 100%</span>
            </div>

            <div className="final-help-line">
              <span>واجهت أي صعوبة في التحميل أو التفعيل؟</span>
              <a
                href={WHATSAPP_VERIFY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="help-whatsapp-link"
              >
                تواصل مباشرة عبر واتساب الإدارة ({ADMIN_WHATSAPP_DISPLAY})
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 9. CLEAN MOBILE FOOTER */}
      <footer className="landing-footer">
        <div className="landing-container">
          <img
            src="/logo.webp"
            alt="فَوْراً - FORERUN"
            className="footer-logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <p className="footer-summary">
            خدمة التوصيل السريع والطلبات اليومية في القنجرة ومحيطها.
          </p>

          <a
            href={WHATSAPP_VERIFY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-support-btn"
          >
            <svg className="whatsapp-svg-icon" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.299.144.347.491 1.2.534 1.287.043.087.072.188.014.303-.058.116-.087.188-.173.289l-.26.303c-.087.087-.177.181-.076.355.101.174.449.741.964 1.201.662.591 1.221.774 1.394.861.174.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.392-12.416c-5.514 0-10 4.486-10 10 0 1.761.458 3.415 1.258 4.86l-1.336 4.884 5.011-1.314c1.4.757 2.998 1.19 4.694 1.19 5.514 0 10-4.486 10-10s-4.486-10-10-10z" />
            </svg>
            <span>واتساب الدعم المعتمد: {ADMIN_WHATSAPP_DISPLAY}</span>
          </a>

          <div className="footer-copyright">
            <p>© 2026 FORERUN (فَوْراً) — جميع الحقوق محفوظة</p>
            <p style={{ marginTop: 2, color: '#94A3B8', fontSize: '0.65rem' }}>القنجرة ومحيطها، سوريا</p>
          </div>
        </div>
      </footer>

      {/* 10. STICKY FLOATING BOTTOM BAR (ONE-CLICK CONVERSION) */}
      <div className="sticky-bottom-bar">
        <div className="sticky-bottom-inner">
          <a
            href="#download"
            onClick={handleScrollTo('download')}
            className="btn-sticky-download"
          >
            <div className="sticky-dl-content">
              <svg className="btn-icon-svg" style={{ width: 22, height: 22 }} viewBox="0 0 24 24">
                <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.551 0 .9993.4482.9993.9993 0 .5511-.4483.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9994.4482.9994.9993 0 .5511-.4483.9997-.9994.9997m11.4045-6.02l1.996-3.4572c.1054-.1824.043-.4158-.1394-.5211-.1823-.1054-.4157-.043-.5211.1394l-2.025 3.5074C15.5414 8.2144 13.8344 7.778 12 7.778s-3.5414.4364-5.1915 1.21L4.7835 5.4805c-.1054-.1824-.3388-.2448-.5211-.1394-.1824.1053-.2448.3387-.1394.5211l1.996 3.4572C2.6886 11.2335.3478 14.8087 0 19.0006h24c-.3478-4.1919-2.6886-7.7671-6.1185-9.6792" />
              </svg>
              <div className="sticky-dl-text-group">
                <span className="sticky-dl-title">تحميل تطبيق فَوْراً (APK)</span>
                <span className="sticky-dl-sub">تثبيت فوري ومجاني للأندرويد</span>
              </div>
            </div>
            <span className="sticky-dl-pill">
              <span>مباشر</span>
              <svg style={{ width: 12, height: 12, fill: 'currentColor' }} viewBox="0 0 24 24">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
              </svg>
            </span>
          </a>

          <a
            href={WHATSAPP_VERIFY_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="تواصل مع إدارة فَوْراً على واتساب"
            className="btn-sticky-whatsapp"
          >
            <svg className="whatsapp-svg-icon" style={{ width: 22, height: 22 }} viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.299.144.347.491 1.2.534 1.287.043.087.072.188.014.303-.058.116-.087.188-.173.289l-.26.303c-.087.087-.177.181-.076.355.101.174.449.741.964 1.201.662.591 1.221.774 1.394.861.174.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.392-12.416c-5.514 0-10 4.486-10 10 0 1.761.458 3.415 1.258 4.86l-1.336 4.884 5.011-1.314c1.4.757 2.998 1.19 4.694 1.19 5.514 0 10-4.486 10-10s-4.486-10-10-10z" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
};
