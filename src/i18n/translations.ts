import type { Language } from '../types';

export const TRANSLATIONS: Record<
  Language,
  {
    brand: string;
    nav: {
      discover: string;
      library: string;
      wishlist: string;
      merchant: string;
      admin: string;
      signIn: string;
      account: string;
    };
    hero: {
      eyebrow: string;
      title: string;
      subtitle: string;
      searchPlaceholder: string;
      searchButton: string;
      browseCatalog: string;
      startSelling: string;
      deployGuide: string;
    };
    categories: {
      all: string;
      software: string;
      apk: string;
      tools: string;
      scripts: string;
      assets: string;
    };
    store: {
      featuredTitle: string;
      topSellersTitle: string;
      newReleasesTitle: string;
      allCatalogTitle: string;
      sortPopular: string;
      sortNewest: string;
      sortPriceLow: string;
      sortPriceHigh: string;
      noResults: string;
      resetFilters: string;
      byMerchant: string;
      sales: string;
    };
    product: {
      backToStore: string;
      buyNow: string;
      ownedInLibrary: string;
      addWishlist: string;
      inWishlist: string;
      thirdPartyWarningTitle: string;
      thirdPartyWarningBody: string;
      version: string;
      fileSize: string;
      platform: string;
      category: string;
      scanStatus: string;
      releaseHistory: string;
      reviewsTitle: string;
      writeReview: string;
      submitReview: string;
      purchaseToReview: string;
      reportProduct: string;
      submitReport: string;
    };
    checkout: {
      title: string;
      subtitle: string;
      selectMethod: string;
      globalNote: string;
      manualRefLabel: string;
      manualRefPlaceholder: string;
      confirmOrderBtn: string;
      openGatewayBtn: string;
      simulateWebhookBtn: string;
      orderSuccessTitle: string;
      awaitingAdminTitle: string;
      goToLibrary: string;
    };
    library: {
      title: string;
      subtitle: string;
      empty: string;
      downloadBtn: string;
      signedUrlNote: string;
      orderHistory: string;
      statusConfirmed: string;
      statusAwaiting: string;
      statusRefunded: string;
    };
    wishlist: {
      title: string;
      subtitle: string;
      empty: string;
    };
    merchant: {
      title: string;
      subtitle: string;
      availableBalance: string;
      pendingBalance: string;
      holdingNote: string;
      totalSales: string;
      uploadNewProduct: string;
      myProducts: string;
      requestPayout: string;
      payoutHistory: string;
      addNewVersion: string;
      deleteProduct: string;
      suspendedBanner: string;
    };
    admin: {
      title: string;
      subtitle: string;
      mfaRequiredTitle: string;
      mfaRequiredBody: string;
      verifyTotpBtn: string;
      platformWallet: string;
      commissionRate: string;
      holdingPeriod: string;
      backupReminder: string;
      exportJsonBtn: string;
      exportCsvBtn: string;
      tabQueue: string;
      tabOrders: string;
      tabWallet: string;
      tabUsers: string;
      tabReports: string;
      tabAudit: string;
      approve: string;
      reject: string;
      takedown: string;
      confirmMalicious: string;
      confirmPayment: string;
      refundOrder: string;
      markPaid: string;
      withdrawOwner: string;
    };
    auth: {
      signInTitle: string;
      signUpTitle: string;
      email: string;
      password: string;
      displayName: string;
      continueGoogle: string;
      chooseRoleTitle: string;
      chooseRoleSubtitle: string;
      roleBuyer: string;
      roleBuyerDesc: string;
      roleMerchant: string;
      roleMerchantDesc: string;
      confirmRole: string;
      previewQuickRoles: string;
    };
    footer: {
      tagline: string;
      terms: string;
      privacy: string;
      refund: string;
      contact: string;
      deployChecklist: string;
      rights: string;
    };
  }
> = {
  en: {
    brand: 'Shaheen Store',
    nav: {
      discover: 'Discover',
      library: 'Library',
      wishlist: 'Wishlist',
      merchant: 'Merchant',
      admin: 'Admin',
      signIn: 'Sign In',
      account: 'Account',
    },
    hero: {
      eyebrow: 'Global Digital Marketplace',
      title: 'Precision Software, APKs, Scripts & Digital Assets',
      subtitle:
        'Acquire verified developer utilities, Android APK builds, automation pipelines, and modular assets from independent creators worldwide.',
      searchPlaceholder: 'Search software, APKs, scripts, tools, or creators...',
      searchButton: 'Search',
      browseCatalog: 'Explore Catalog',
      startSelling: 'Become a Merchant',
      deployGuide: 'Deployment & Security Guide',
    },
    categories: {
      all: 'All Releases',
      software: 'Software',
      apk: 'Android APK',
      tools: 'Dev Tools',
      scripts: 'Scripts',
      assets: 'Digital Assets',
    },
    store: {
      featuredTitle: 'Featured Showcase',
      topSellersTitle: 'Top Sellers',
      newReleasesTitle: 'New Releases',
      allCatalogTitle: 'Full Storefront Catalog',
      sortPopular: 'Most Popular',
      sortNewest: 'Newest Releases',
      sortPriceLow: 'Price: Low to High',
      sortPriceHigh: 'Price: High to Low',
      noResults: 'No approved products match your current filter.',
      resetFilters: 'Reset Filters',
      byMerchant: 'by',
      sales: 'sales',
    },
    product: {
      backToStore: 'Back to Storefront',
      buyNow: 'Buy Now',
      ownedInLibrary: 'Owned — Open Library',
      addWishlist: 'Add to Wishlist',
      inWishlist: 'Saved in Wishlist',
      thirdPartyWarningTitle: 'Third-Party Merchant File Notice',
      thirdPartyWarningBody:
        'Files are provided directly by independent third-party merchants and stored as unexecuted binary blobs. Always verify checksums and scan executables in an isolated environment before running.',
      version: 'Version',
      fileSize: 'File Size',
      platform: 'Platform',
      category: 'Category',
      scanStatus: 'Security Scan',
      releaseHistory: 'Version History',
      reviewsTitle: 'Verified Buyer Reviews',
      writeReview: 'Share your technical review',
      submitReview: 'Publish Review',
      purchaseToReview: 'Confirmed purchase required to post a review.',
      reportProduct: 'Report This Product',
      submitReport: 'Submit Security Report',
    },
    checkout: {
      title: 'Global Checkout',
      subtitle: 'Worldwide access with zero country or payment restrictions.',
      selectMethod: 'Select Payment Method',
      globalNote:
        'Every transaction uses an idempotency key to prevent duplicate charges or confirmations.',
      manualRefLabel: 'Transaction Reference / Receipt ID',
      manualRefPlaceholder: 'e.g. PP-94827104 or TX-HASH',
      confirmOrderBtn: 'Submit Payment Reference',
      openGatewayBtn: 'Proceed to Payment Link',
      simulateWebhookBtn: 'Confirm Order (Preview Webhook)',
      orderSuccessTitle: 'Purchase Confirmed',
      awaitingAdminTitle: 'Submitted for Admin Verification',
      goToLibrary: 'Open Buyer Library',
    },
    library: {
      title: 'Buyer Library',
      subtitle: 'Access your confirmed digital purchases and generate expiring signed download links.',
      empty: 'You have no purchased items yet. Explore the storefront to acquire software and tools.',
      downloadBtn: 'Generate 60s Download Link',
      signedUrlNote:
        'Downloads are served from the isolated storage domain with Content-Disposition: attachment.',
      orderHistory: 'Order & Ledger History',
      statusConfirmed: 'Confirmed',
      statusAwaiting: 'Awaiting Admin Verification',
      statusRefunded: 'Refunded',
    },
    wishlist: {
      title: 'Saved Wishlist',
      subtitle: 'Track software, APKs, and assets before purchasing.',
      empty: 'Your wishlist is empty.',
    },
    merchant: {
      title: 'Merchant Studio',
      subtitle: 'Publish digital products, release version updates, and manage payouts.',
      availableBalance: 'Available to Withdraw',
      pendingBalance: 'In Holding Period',
      holdingNote: 'New earnings mature after the platform holding window to cover buyer refunds.',
      totalSales: 'Total Confirmed Sales',
      uploadNewProduct: 'Upload New Product',
      myProducts: 'Published & Pending Products',
      requestPayout: 'Request Payout',
      payoutHistory: 'Payout Requests',
      addNewVersion: 'Push New Version',
      deleteProduct: 'Delete',
      suspendedBanner:
        'Your merchant account is currently suspended due to policy or security violations.',
    },
    admin: {
      title: 'Owner Control Center',
      subtitle: 'Moderate submissions, verify manual orders, inspect immutable ledger entries, and export backups.',
      mfaRequiredTitle: 'TOTP Two-Factor Authentication Required',
      mfaRequiredBody:
        'Owner actions require an active AAL2 TOTP authenticator verification code.',
      verifyTotpBtn: 'Verify TOTP Code',
      platformWallet: 'Platform Wallet Balance',
      commissionRate: 'Platform Commission',
      holdingPeriod: 'Holding Period',
      backupReminder:
        'Free-plan reminder: Export full JSON/CSV database backups weekly and store them offline.',
      exportJsonBtn: 'Export Full JSON Backup',
      exportCsvBtn: 'Export Ledger CSV',
      tabQueue: 'Review Queue',
      tabOrders: 'Orders & Refunds',
      tabWallet: 'Wallet & Payouts',
      tabUsers: 'Users',
      tabReports: 'Reports',
      tabAudit: 'Audit & Ledger',
      approve: 'Approve',
      reject: 'Reject',
      takedown: 'Instant Takedown',
      confirmMalicious: 'Confirm Malicious & Suspend',
      confirmPayment: 'Confirm Payment',
      refundOrder: 'Refund Order',
      markPaid: 'Mark Paid',
      withdrawOwner: 'Withdraw Platform Wallet',
    },
    auth: {
      signInTitle: 'Sign In to Shaheen Store',
      signUpTitle: 'Create Your Account',
      email: 'Email Address',
      password: 'Password',
      displayName: 'Display Name',
      continueGoogle: 'Continue with Google',
      chooseRoleTitle: 'Select Your Account Role',
      chooseRoleSubtitle: 'Choose how you want to participate in Shaheen Store.',
      roleBuyer: 'Buyer Account',
      roleBuyerDesc: 'Purchase software, APKs, and tools with lifetime library access.',
      roleMerchant: 'Merchant Account',
      roleMerchantDesc: 'Upload products, release updates, and earn globally.',
      confirmRole: 'Complete Registration',
      previewQuickRoles: 'Preview Role Switcher (No API Keys Set)',
    },
    footer: {
      tagline: 'Built for independent creators and engineers worldwide.',
      terms: 'Terms of Service',
      privacy: 'Privacy Policy',
      refund: 'Refund Policy',
      contact: 'Contact',
      deployChecklist: 'Deployment & Security Guide',
      rights: 'Shaheen Store. All digital assets remain property of their respective merchants.',
    },
  },
  ar: {
    brand: 'متجر شاهين',
    nav: {
      discover: 'المتجر',
      library: 'مكتبتي',
      wishlist: 'المفضلة',
      merchant: 'لوحة التاجر',
      admin: 'الإدارة',
      signIn: 'تسجيل الدخول',
      account: 'الحساب',
    },
    hero: {
      eyebrow: 'سوق رقمي عالمي',
      title: 'برمجيات دقيقة، تطبيقات APK، سكربتات وأصول رقمية',
      subtitle:
        'احصل على أدوات المطورين، تطبيقات أندرويد، سكربتات الأتمتة، والأصول الرقمية من مطورين مستقلين حول العالم.',
      searchPlaceholder: 'ابحث عن برامج، تطبيقات APK، سكربتات أو مطورين...',
      searchButton: 'بحث',
      browseCatalog: 'تصفح المنتجات',
      startSelling: 'ابدأ البيع كتاجر',
      deployGuide: 'دليل النشر والأمان',
    },
    categories: {
      all: 'جميع الإصدارات',
      software: 'البرمجيات',
      apk: 'تطبيقات APK',
      tools: 'أدوات المطورين',
      scripts: 'السكربتات',
      assets: 'الأصول الرقمية',
    },
    store: {
      featuredTitle: 'المنتجات المميزة',
      topSellersTitle: 'الأكثر مبيعاً',
      newReleasesTitle: 'أحدث الإصدارات',
      allCatalogTitle: 'كتالوج المتجر الكامل',
      sortPopular: 'الأكثر مبيعاً',
      sortNewest: 'الأحدث',
      sortPriceLow: 'السعر: من الأقل للأعلى',
      sortPriceHigh: 'السعر: من الأعلى للأقل',
      noResults: 'لا توجد منتجات معتمدة تطابق البحث الحالي.',
      resetFilters: 'إعادة ضبط الفلاتر',
      byMerchant: 'بواسطة',
      sales: 'مبيعة',
    },
    product: {
      backToStore: 'العودة إلى المتجر',
      buyNow: 'اشترِ الآن',
      ownedInLibrary: 'مملوك — افتح المكتبة',
      addWishlist: 'أضف إلى المفضلة',
      inWishlist: 'محفوظ في المفضلة',
      thirdPartyWarningTitle: 'تنبيه ملفات الأطراف الثالثة',
      thirdPartyWarningBody:
        'يتم توفير الملفات مباشرة من تجار مستقلين وتُخزَّن كبيانات ثنائية غير منفذة. تحقّق دائماً من بصمة الملف وافحصه في بيئة معزولة قبل التشغيل.',
      version: 'الإصدار',
      fileSize: 'حجم الملف',
      platform: 'المنصة',
      category: 'التصنيف',
      scanStatus: 'الفحص الأمني',
      releaseHistory: 'سجل الإصدارات',
      reviewsTitle: 'تقييمات المشترين الموثقين',
      writeReview: 'أضف مراجعتك التقنية',
      submitReview: 'نشر التقييم',
      purchaseToReview: 'يجب تأكيد شراء المنتج لتتمكن من إضافة تقييم.',
      reportProduct: 'الإبلاغ عن هذا المنتج',
      submitReport: 'إرسال بلاغ أمني',
    },
    checkout: {
      title: 'الدفع العالمي',
      subtitle: 'متاح لجميع الدول بدون قيود جغرافية أو حظر لوسائل الدفع.',
      selectMethod: 'اختر وسيلة الدفع',
      globalNote: 'تستخدم كل عملية مفتاح تكرار (Idempotency) لمنع التأكيد المزدوج.',
      manualRefLabel: 'رقم مرجع العملية / الإيصال',
      manualRefPlaceholder: 'مثال: PP-94827104 أو TX-HASH',
      confirmOrderBtn: 'إرسال رقم التحويل',
      openGatewayBtn: 'الانتقال لرابط الدفع',
      simulateWebhookBtn: 'تأكيد الدفع (محاكاة Webhook)',
      orderSuccessTitle: 'تم تأكيد الشراء',
      awaitingAdminTitle: 'تم الإرسال لمراجعة الإدارة',
      goToLibrary: 'الذهاب إلى مكتبتي',
    },
    library: {
      title: 'مكتبة المشتريات',
      subtitle: 'الوصول إلى مشترياتك المؤكدة وإنشاء روابط تحميل موقّعة ومؤقتة.',
      empty: 'لا توجد مشتريات حتى الآن. تصفح المتجر لاقتناء الأدوات والبرمجيات.',
      downloadBtn: 'إنشاء رابط تحميل (60 ثانية)',
      signedUrlNote: 'تُقدَّم التحميلات من نطاق التخزين المعزول مع ترويسة التحميل الإلزامية.',
      orderHistory: 'سجل الطلبات',
      statusConfirmed: 'مؤكد',
      statusAwaiting: 'بانتظار تأكيد الإدارة',
      statusRefunded: 'مسترد',
    },
    wishlist: {
      title: 'قائمة المفضلة',
      subtitle: 'احفظ البرمجيات والتطبيقات لمتابعتها قبل الشراء.',
      empty: 'قائمة المفضلة فارغة.',
    },
    merchant: {
      title: 'استوديو التاجر',
      subtitle: 'ارفع منتجاتك الرقمية، أضف تحديثات الإصدارات، واطلب سحب أرباحك.',
      availableBalance: 'الرصيد المتاح للسحب',
      pendingBalance: 'في فترة الاحتجاز',
      holdingNote: 'تتحول الأرباح إلى متاحة بعد انتهاء مدة الاحتجاز المخصصة للاسترداد.',
      totalSales: 'إجمالي المبيعات المؤكدة',
      uploadNewProduct: 'رفع منتج جديد',
      myProducts: 'منتجاتي',
      requestPayout: 'طلب سحب أرباح',
      payoutHistory: 'سجل طلبات السحب',
      addNewVersion: 'إصدار جديد',
      deleteProduct: 'حذف',
      suspendedBanner: 'تم تعليق حساب التاجر الخاص بك بسبب مخالفات أمنية أو سياسات المنصة.',
    },
    admin: {
      title: 'لوحة تحكم المالك',
      subtitle: 'مراجعة المنتجات، تأكيد المدفوعات اليدوية، إدارة العمولات وسجل التدقيق.',
      mfaRequiredTitle: 'التحقق الثنائي TOTP إلزامي',
      mfaRequiredBody: 'تتطلب إجراءات المالك رمز تحقق ثنائي نشط (AAL2).',
      verifyTotpBtn: 'تأكيد رمز TOTP',
      platformWallet: 'محفظة المنصة',
      commissionRate: 'نسبة العمولة',
      holdingPeriod: 'مدة الاحتجاز',
      backupReminder: 'تذكير الخطة المجانية: صدّر نسخة احتياطية كاملة بصيغة JSON/CSV أسبوعياً.',
      exportJsonBtn: 'تصدير نسخة JSON كاملة',
      exportCsvBtn: 'تصدير سجل Ledger CSV',
      tabQueue: 'طابور المراجعة',
      tabOrders: 'الطلبات والاسترداد',
      tabWallet: 'المحفظة والسحوبات',
      tabUsers: 'المستخدمون',
      tabReports: 'البلاغات',
      tabAudit: 'التدقيق والسجل',
      approve: 'اعتماد',
      reject: 'رفض',
      takedown: 'إزالة فورية',
      confirmMalicious: 'تأكيد الخطر وتعليق التاجر',
      confirmPayment: 'تأكيد الدفع',
      refundOrder: 'استرداد الطلب',
      markPaid: 'تحديد كمدفوع',
      withdrawOwner: 'سحب من محفظة المالك',
    },
    auth: {
      signInTitle: 'تسجيل الدخول إلى متجر شاهين',
      signUpTitle: 'إنشاء حساب جديد',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      displayName: 'الاسم الظاهر',
      continueGoogle: 'المتابعة عبر Google',
      chooseRoleTitle: 'اختر نوع الحساب',
      chooseRoleSubtitle: 'حدد دورك في متجر شاهين.',
      roleBuyer: 'حساب مشتري',
      roleBuyerDesc: 'شراء البرمجيات والتطبيقات مع وصول دائم لمكتبتك.',
      roleMerchant: 'حساب تاجر',
      roleMerchantDesc: 'رفع المنتجات الرقمية وتلقي الأرباح عالمياً.',
      confirmRole: 'إكمال التسجيل',
      previewQuickRoles: 'تبديل الدور السريع (وضع المعاينة)',
    },
    footer: {
      tagline: 'مصمم للمطورين والمبدعين المستقلين حول العالم.',
      terms: 'شروط الاستخدام',
      privacy: 'سياسة الخصوصية',
      refund: 'سياسة الاسترداد',
      contact: 'اتصل بنا',
      deployChecklist: 'دليل النشر والأمان',
      rights: 'متجر شاهين. جميع المنتجات الرقمية ملك لأصحابها من التجار.',
    },
  },
};
