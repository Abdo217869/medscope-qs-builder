// src/settings.schema.js - Complete typed settings schema, presets, palettes, validation, and CSS variable mapping

export const FONT_OPTIONS = [
  { id: 'Carlito, Calibri, sans-serif', label: 'Calibri / Carlito (الافتراضي)', generic: 'sans-serif' },
  { id: 'Inter, sans-serif', label: 'Inter (حديث وعصري)', generic: 'sans-serif' },
  { id: '"Source Serif 4", Georgia, serif', label: 'Source Serif (طبي كلاسيكي)', generic: 'serif' },
  { id: 'Merriweather, serif', label: 'Merriweather (واضح ومريح)', generic: 'serif' },
  { id: 'Roboto, sans-serif', label: 'Roboto (هندسي)', generic: 'sans-serif' },
  { id: '"Open Sans", sans-serif', label: 'Open Sans (مقروء)', generic: 'sans-serif' },
  { id: '"Atkinson Hyperlegible", sans-serif', label: 'Atkinson Hyperlegible (فائق الوضوح)', generic: 'sans-serif' },
  { id: '"Courier Prime", monospace', label: 'Monospace (آلة كاتبة)', generic: 'monospace' }
];

export const PALETTES = [
  {
    id: 'medscope-gold',
    name: 'ميدسكوب الكحلي والذهبي (الافتراضي)',
    accent: '#d4a343',
    qColor: '#122036',
    ansColor: '#c00000',
    stemColor: '#1c2430',
    optColor: '#2b3648',
    badgeBg: '#122036',
    badgeText: '#ffffff',
    bg: '#fffcf3'
  },
  {
    id: 'royal-slate',
    name: 'أزرق ملكي ورمادي',
    accent: '#2563eb',
    qColor: '#1e3a8a',
    ansColor: '#dc2626',
    stemColor: '#0f172a',
    optColor: '#334155',
    badgeBg: '#1e3a8a',
    badgeText: '#ffffff',
    bg: '#f8fafc'
  },
  {
    id: 'emerald-med',
    name: 'أخضر زمردي طبي',
    accent: '#059669',
    qColor: '#064e3b',
    ansColor: '#b91c1c',
    stemColor: '#132a22',
    optColor: '#294339',
    badgeBg: '#064e3b',
    badgeText: '#ffffff',
    bg: '#f4fbf7'
  },
  {
    id: 'burgundy-crimson',
    name: 'عنابي وقرمزي أكاديمي',
    accent: '#9f1239',
    qColor: '#4c0519',
    ansColor: '#be123c',
    stemColor: '#270811',
    optColor: '#431924',
    badgeBg: '#4c0519',
    badgeText: '#ffffff',
    bg: '#fff9fa'
  },
  {
    id: 'minimal-mono',
    name: 'أبيض وأسود موفر للحبر',
    accent: '#111111',
    qColor: '#000000',
    ansColor: '#c00000',
    stemColor: '#000000',
    optColor: '#1a1a1a',
    badgeBg: '#ffffff',
    badgeText: '#000000',
    bg: '#ffffff'
  },
  {
    id: 'warm-sepia',
    name: 'سيبيا دافئ للمطالعة',
    accent: '#b45309',
    qColor: '#451a03',
    ansColor: '#9a3412',
    stemColor: '#291408',
    optColor: '#442b1a',
    badgeBg: '#78350f',
    badgeText: '#ffffff',
    bg: '#faf6eb'
  }
];

export const PRESETS = {
  soft: {
    id: 'soft',
    name: 'Soft (مريح للعين - الافتراضي)',
    desc: 'ورقة دافئة متناسقة مع علامات ذهبية وبادجات دائرية',
    settings: {
      theme: 'soft',
      tint: true,
      bgColor: '#fffcf3',
      fontStem: 'Carlito, Calibri, sans-serif',
      fontOpt: 'Carlito, Calibri, sans-serif',
      fsStem: 15,
      fsOpt: 14.5,
      fsHead: 20,
      fsHdr: 11,
      lhStem: 1.45,
      lhOpt: 1.4,
      cols: 1,
      qBadgeStyle: 'circle-fill',
      optBadgeStyle: 'circle',
      optLayout: 'vertical',
      separator: 'dashed',
      wmType: 'image',
      wmImg: '/medscope-watermark-default.png',
      wmOp: 0.12,
      coverLogo: true,
      coverLayout: 'band'
    }
  },
  classic: {
    id: 'classic',
    name: 'Classic (النسخة الأكاديمية)',
    desc: 'تنسيق امتحانات الجامعات الرسمي بأعمدة منظمة وخط سيريف',
    settings: {
      theme: 'classic',
      tint: false,
      bgColor: '#ffffff',
      fontStem: '"Source Serif 4", Georgia, serif',
      fontOpt: 'Carlito, Calibri, sans-serif',
      fsStem: 14.5,
      fsOpt: 14,
      fsHead: 19,
      fsHdr: 10.5,
      lhStem: 1.4,
      lhOpt: 1.35,
      cols: 2,
      qBadgeStyle: 'plain',
      optBadgeStyle: 'plain',
      optLayout: 'vertical',
      separator: 'solid',
      wmType: 'image',
      wmImg: '/medscope-watermark-default.png',
      wmOp: 0.12,
      coverLogo: true,
      coverLayout: 'center'
    }
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal (أبيض وأسود موفّر)',
    desc: 'بدون ألوان أو خلفيات لتوفير حبر الطابعات العادية بنسبة 100%',
    settings: {
      theme: 'minimal',
      tint: false,
      bgColor: '#ffffff',
      qColor: '#000000',
      ansColor: '#c00000',
      stemColor: '#000000',
      optColor: '#1a1a1a',
      fontStem: 'Inter, sans-serif',
      fontOpt: 'Inter, sans-serif',
      fsStem: 14,
      fsOpt: 13.5,
      fsHead: 18,
      fsHdr: 10,
      lhStem: 1.35,
      lhOpt: 1.3,
      cols: 2,
      qBadgeStyle: 'plain',
      optBadgeStyle: 'plain',
      optLayout: 'vertical',
      separator: 'dotted',
      wmType: 'image',
      wmImg: '/medscope-watermark-default.png',
      wmOp: 0.10,
      coverLogo: true,
      coverLayout: 'minimal'
    }
  },
  modern: {
    id: 'modern',
    name: 'Modern (عصري جذاب)',
    desc: 'تصميم أنيق وبطاقات بخط Inter وألوان حيوية',
    settings: {
      theme: 'modern',
      tint: true,
      bgColor: '#f8fafc',
      fontStem: 'Inter, sans-serif',
      fontOpt: 'Inter, sans-serif',
      fsStem: 15,
      fsOpt: 14,
      fsHead: 21,
      fsHdr: 11,
      lhStem: 1.5,
      lhOpt: 1.45,
      cols: 1,
      qBadgeStyle: 'rounded-square',
      optBadgeStyle: 'square',
      optLayout: 'grid2',
      separator: 'diamond',
      wmType: 'image',
      wmImg: '/medscope-watermark-default.png',
      wmOp: 0.12,
      coverLogo: true,
      coverLayout: 'band'
    }
  },
  large: {
    id: 'large',
    name: 'كبير ومريح (للقراءة على الموبايل)',
    desc: 'خطوط كبيرة وواضحة لقراءة ملف الـ PDF بسهولة دون تكبير الشاشة',
    settings: {
      theme: 'soft',
      tint: true,
      bgColor: '#fffcf3',
      fontStem: 'Carlito, Calibri, sans-serif',
      fontOpt: 'Carlito, Calibri, sans-serif',
      fsStem: 18,
      fsOpt: 17,
      fsHead: 24,
      fsHdr: 13,
      lhStem: 1.6,
      lhOpt: 1.5,
      cols: 1,
      qBadgeStyle: 'circle-fill',
      optBadgeStyle: 'circle',
      optLayout: 'vertical',
      separator: 'dashed',
      wmType: 'image',
      wmImg: '/medscope-watermark-default.png',
      wmOp: 0.12,
      coverLogo: true,
      coverLayout: 'center'
    }
  }
};

/**
 * Complete typed settings schema definition
 */
export const SETTINGS_SCHEMA = [
  {
    group: 'presets',
    title: 'القوالب والشكل العام',
    icon: '🎨',
    fields: [
      {
        key: 'preset',
        label: 'اختر ستايل جاهز',
        type: 'preset-cards',
        options: Object.values(PRESETS)
      },
      {
        key: 'palette',
        label: 'بالتة الألوان السريعة',
        type: 'palette-grid',
        options: PALETTES
      }
    ]
  },
  {
    group: 'page',
    title: 'إعدادات الصفحة والهوامش',
    icon: '📄',
    fields: [
      {
        key: 'pageSize',
        label: 'حجم الصفحة',
        type: 'select',
        default: 'A4',
        options: [
          { val: 'A4', text: 'A4 (210 × 297 مم)' },
          { val: 'A5', text: 'A5 (148 × 210 مم)' },
          { val: 'Letter', text: 'US Letter (8.5 × 11 بوصة)' }
        ]
      },
      {
        key: 'orientation',
        label: 'اتجاه الورقة',
        type: 'select',
        default: 'portrait',
        options: [
          { val: 'portrait', text: 'طولي (Portrait)' },
          { val: 'landscape', text: 'عرضي (Landscape)' }
        ]
      },
      {
        key: 'cols',
        label: 'عدد الأعمدة',
        type: 'select',
        default: 1,
        options: [
          { val: 1, text: 'عمود واحد (1)' },
          { val: 2, text: 'عمودين (2)' },
          { val: 3, text: '3 أعمدة (3)' }
        ]
      },
      {
        key: 'colGap',
        label: 'المسافة بين الأعمدة (مم)',
        type: 'range',
        default: 10,
        min: 4,
        max: 30,
        step: 1,
        unit: 'مم'
      },
      {
        key: 'colDivider',
        label: 'خط فاصل بين الأعمدة',
        type: 'check',
        default: false
      },
      {
        key: 'marginTop',
        label: 'الهامش العلوي (مم)',
        type: 'range',
        default: 16,
        min: 6,
        max: 40,
        step: 1,
        unit: 'مم'
      },
      {
        key: 'marginBottom',
        label: 'الهامش السفلي (مم)',
        type: 'range',
        default: 16,
        min: 6,
        max: 40,
        step: 1,
        unit: 'مم'
      },
      {
        key: 'marginInside',
        label: 'الهامش الداخلي (مم)',
        type: 'range',
        default: 16,
        min: 6,
        max: 40,
        step: 1,
        unit: 'مم'
      },
      {
        key: 'marginOutside',
        label: 'الهامش الخارجي (مم)',
        type: 'range',
        default: 16,
        min: 6,
        max: 40,
        step: 1,
        unit: 'مم'
      },
      {
        key: 'tint',
        label: 'خلفية دافئة (#fffcf3)',
        type: 'check',
        default: true
      },
      {
        key: 'bgColor',
        label: 'لون الخلفية المخصص',
        type: 'color',
        default: '#fffcf3'
      },
      {
        key: 'pageFrame',
        label: 'إطار خارجي للصفحة',
        type: 'check',
        default: false
      },
      {
        key: 'frameRadius',
        label: 'استدارة زوايا الإطار (px)',
        type: 'range',
        default: 8,
        min: 0,
        max: 24,
        step: 1,
        unit: 'px'
      },
      {
        key: 'topBar',
        label: 'شريط تدرج علوي للورقة',
        type: 'check',
        default: true
      },
      {
        key: 'topBarH',
        label: 'ارتفاع الشريط العلوي (px)',
        type: 'range',
        default: 5,
        min: 2,
        max: 16,
        step: 1,
        unit: 'px'
      },
      {
        key: 'bgPattern',
        label: 'نقش خلفية خفيف',
        type: 'select',
        default: 'none',
        options: [
          { val: 'none', text: 'بدون نقش' },
          { val: 'dots', text: 'نقاط خفيفة' },
          { val: 'grid', text: 'شبكة مربعات ناعمة' }
        ]
      }
    ]
  },
  {
    group: 'typography',
    title: 'الخطوط والأحجام',
    icon: '🔤',
    fields: [
      {
        key: 'fontStem',
        label: 'خط رأس السؤال',
        type: 'select',
        default: 'Carlito, Calibri, sans-serif',
        options: FONT_OPTIONS.map(f => ({ val: f.id, text: f.label }))
      },
      {
        key: 'fontOpt',
        label: 'خط الخيارات (a, b, c)',
        type: 'select',
        default: 'Carlito, Calibri, sans-serif',
        options: FONT_OPTIONS.map(f => ({ val: f.id, text: f.label }))
      },
      {
        key: 'fsStem',
        label: 'حجم خط السؤال (pt)',
        type: 'range',
        default: 15,
        min: 9,
        max: 24,
        step: 0.5,
        unit: 'pt'
      },
      {
        key: 'fsOpt',
        label: 'حجم خط الخيارات (pt)',
        type: 'range',
        default: 14.5,
        min: 8.5,
        max: 22,
        step: 0.5,
        unit: 'pt'
      },
      {
        key: 'fsHead',
        label: 'حجم عناوين المواد (pt)',
        type: 'range',
        default: 20,
        min: 14,
        max: 32,
        step: 1,
        unit: 'pt'
      },
      {
        key: 'fsHdr',
        label: 'حجم الهيدر والفوتر (pt)',
        type: 'range',
        default: 11,
        min: 8,
        max: 16,
        step: 0.5,
        unit: 'pt'
      },
      {
        key: 'stemWeight',
        label: 'سُمك خط رأس السؤال',
        type: 'select',
        default: '700',
        options: [
          { val: '400', text: 'عادي (Regular)' },
          { val: '600', text: 'شبه عريض (Semi-Bold)' },
          { val: '700', text: 'عريض (Bold)' },
          { val: '800', text: 'سميك جدًا (Extra Bold)' }
        ]
      },
      {
        key: 'lhStem',
        label: 'تباعد أسطر السؤال (Line Height)',
        type: 'range',
        default: 1.45,
        min: 1.1,
        max: 2.0,
        step: 0.05,
        unit: ''
      },
      {
        key: 'lhOpt',
        label: 'تباعد أسطر الخيارات',
        type: 'range',
        default: 1.4,
        min: 1.1,
        max: 2.0,
        step: 0.05,
        unit: ''
      },
      {
        key: 'textAlign',
        label: 'محاذاة النص',
        type: 'select',
        default: 'left',
        options: [
          { val: 'left', text: 'يسار (Left)' },
          { val: 'justify', text: 'ضبط الطرفين (Justify)' }
        ]
      },
      {
        key: 'hyphenate',
        label: 'تفعيل الواصلة للكلمات الطويلة (Hyphenation)',
        type: 'check',
        default: true
      }
    ]
  },
  {
    group: 'questions',
    title: 'تنسيق الأسئلة والخيارات',
    icon: '🔢',
    fields: [
      {
        key: 'qBadgeStyle',
        label: 'شكل رقم السؤال',
        type: 'select',
        default: 'circle-fill',
        options: [
          { val: 'circle-fill', text: 'دائرة ممتلئة بلون داكن' },
          { val: 'circle-outline', text: 'دائرة محددة بخط' },
          { val: 'rounded-square', text: 'مربع منحني الزوايا' },
          { val: 'plain', text: 'نص عادي بدون بادج' },
          { val: 'none', text: 'بدون رقم' }
        ]
      },
      {
        key: 'numfmt',
        label: 'تنسيق صيغة الرقم',
        type: 'select',
        default: '1-',
        options: [
          { val: '1-', text: '1-' },
          { val: '1.', text: '1.' },
          { val: '1)', text: '1)' },
          { val: '1', text: '1 فقط' },
          { val: 'Q1.', text: 'Q1.' }
        ]
      },
      {
        key: 'optBadgeStyle',
        label: 'شكل حرف الخيار (a, b, c)',
        type: 'select',
        default: 'circle',
        options: [
          { val: 'circle', text: 'دائرة ناعمة (Circle)' },
          { val: 'square', text: 'مربع ناعم (Square)' },
          { val: 'plain', text: 'نص عادي a) A. (a)' }
        ]
      },
      {
        key: 'letter',
        label: 'نمط حرف الخيار',
        type: 'select',
        default: 'a)',
        options: [
          { val: 'a)', text: 'a) b) c)' },
          { val: 'A.', text: 'A. B. C.' },
          { val: '(a)', text: '(a) (b) (c)' },
          { val: 'A)', text: 'A) B) C)' }
        ]
      },
      {
        key: 'optLayout',
        label: 'توزيع الخيارات',
        type: 'select',
        default: 'vertical',
        options: [
          { val: 'vertical', text: 'عمودي (سطر لكل خيار)' },
          { val: 'grid2', text: 'عمودين للخيارات (2-Column Grid)' },
          { val: 'inline', text: 'أفقي بسطر واحد إذا كانت الخيارات قصيرة' },
          { val: 'auto', text: 'تلقائي حسب طول الخيارات' }
        ]
      },
      {
        key: 'qgap',
        label: 'المسافة بين الأسئلة (px)',
        type: 'range',
        default: 14,
        min: 4,
        max: 36,
        step: 1,
        unit: 'px'
      },
      {
        key: 'optGap',
        label: 'المسافة بين الخيارات (px)',
        type: 'range',
        default: 6,
        min: 2,
        max: 20,
        step: 1,
        unit: 'px'
      },
      {
        key: 'separator',
        label: 'الخط الفاصل بين الأسئلة',
        type: 'select',
        default: 'dashed',
        options: [
          { val: 'none', text: 'بدون خط فاصل' },
          { val: 'dashed', text: 'خط متقطع خفيف (Dashed)' },
          { val: 'solid', text: 'خط متصل (Solid)' },
          { val: 'dotted', text: 'نقاط (Dotted)' },
          { val: 'diamond', text: 'ماسة صغيرة في المنتصف (◆)' }
        ]
      },
      {
        key: 'keepTogether',
        label: 'منع قسم السؤال على صفحتين (Keep on one page)',
        type: 'check',
        default: true
      },
      {
        key: 'keepHeadWithFirst',
        label: 'إبقاء عنوان المادة مع أول سؤال دائمًا',
        type: 'check',
        default: true
      },
      {
        key: 'secPages',
        label: 'بدء كل مادة في صفحة جديدة',
        type: 'check',
        default: true
      },
      {
        key: 'qsPerPage',
        label: 'حد أقصى للأسئلة في الصفحة (0 = تلقائي)',
        type: 'number',
        default: 0,
        min: 0,
        max: 20
      }
    ]
  },
  {
    group: 'colors',
    title: 'تخصيص الألوان بالتفصيل',
    icon: '🎨',
    fields: [
      { key: 'qColor', label: 'لون أرقام الأسئلة والبادج', type: 'color', default: '#122036' },
      { key: 'stemColor', label: 'لون رأس السؤال', type: 'color', default: '#1c2430' },
      { key: 'optColor', label: 'لون نص الخيارات', type: 'color', default: '#2b3648' },
      { key: 'accent', label: 'لون التمييز (Gold / Accent)', type: 'color', default: '#d4a343' },
      { key: 'headColor', label: 'لون عناوين المواد', type: 'color', default: '#122036' },
      { key: 'hdrColor', label: 'لون الهيدر والفوتر', type: 'color', default: '#64748b' },
      { key: 'ansColor', label: 'لون الإجابة الصحيحة', type: 'color', default: '#c00000' },
      { key: 'highlightColor', label: 'لون التظليل الأصفر', type: 'color', default: '#fef08a' }
    ]
  },
  {
    group: 'answers',
    title: 'ورقة الإجابات ونموذج الحل',
    icon: '🔴',
    fields: [
      {
        key: 'markStyle',
        label: 'شكل تمييز الإجابة الصحيحة',
        type: 'select',
        default: 'circle-fill',
        options: [
          { val: 'circle-fill', text: 'دائرة حمراء ممتلئة (الافتراضي)' },
          { val: 'color', text: 'نص الخيار باللون الأحمر' },
          { val: 'tick', text: 'علامة صح بجانب الخيار (✓)' },
          { val: 'underline', text: 'خط أحمر عريض تحت الخيار' },
          { val: 'highlight', text: 'تظليل أصفر كالفوسفوري' },
          { val: 'combo', text: 'دائرة حمراء + نص أحمر' }
        ]
      },
      {
        key: 'showExpl',
        label: 'إظهار التفسيرات والشرح إن وُجدت',
        type: 'check',
        default: true
      },
      {
        key: 'keyPage',
        label: 'إدراج جدول مفتاح الإجابات (Answer Key Grid)',
        type: 'check',
        default: true
      },
      {
        key: 'keyCols',
        label: 'عدد أعمدة جدول مفتاح الإجابات',
        type: 'select',
        default: 5,
        options: [
          { val: 4, text: '4 أعمدة' },
          { val: 5, text: '5 أعمدة (الافتراضي)' },
          { val: 6, text: '6 أعمدة' }
        ]
      }
    ]
  },
  {
    group: 'watermark',
    title: 'العلامة المائية ولوجو ميدسكوب',
    icon: '🦅',
    fields: [
      {
        key: 'wmType',
        label: 'نوع العلامة المائية',
        type: 'select',
        default: 'image',
        options: [
          { val: 'image', text: 'لوجو صورة (لوجو ميدسكوب الافتراضي)' },
          { val: 'text', text: 'نص MEDSCOPE' },
          { val: 'none', text: 'بدون علامة مائية' }
        ]
      },
      {
        key: 'wmLogoUpload',
        label: 'لوجو الورقة (PNG / SVG / JPG)',
        type: 'logo-uploader'
      },
      {
        key: 'wmOp',
        label: 'شفافية العلامة المائية',
        type: 'range',
        default: 0.12,
        min: 0.02,
        max: 0.5,
        step: 0.01,
        unit: ''
      },
      {
        key: 'wmSize',
        label: 'حجم اللوجو (px)',
        type: 'range',
        default: 320,
        min: 120,
        max: 600,
        step: 10,
        unit: 'px'
      },
      {
        key: 'wmPos',
        label: 'موضع العلامة المائية',
        type: 'select',
        default: 'center',
        options: [
          { val: 'center', text: 'في المنتصف (Centered)' },
          { val: 'top', text: 'أعلى الورقة' },
          { val: 'bottom', text: 'أسفل الورقة' },
          { val: 'tile', text: 'نمط متكرر مائل (Tiled)' }
        ]
      },
      {
        key: 'wmRot',
        label: 'زاوية الدوران (درجات)',
        type: 'range',
        default: 0,
        min: -45,
        max: 45,
        step: 5,
        unit: '°'
      },
      {
        key: 'wmCover',
        label: 'ظهور العلامة المائية على صفحة الغلاف أيضًا',
        type: 'check',
        default: false
      }
    ]
  },
  {
    group: 'cover',
    title: 'صفحة الغلاف وصفحات المواد',
    icon: '📖',
    fields: [
      { key: 'cover', label: 'إدراج صفحة الغلاف', type: 'check', default: true },
      {
        key: 'coverLayout',
        label: 'تنسيق صفحة الغلاف',
        type: 'select',
        default: 'band',
        options: [
          { val: 'band', text: 'شريط عريض وشعار بارز (الافتراضي)' },
          { val: 'center', text: 'تنسيق متناسق في المنتصف' },
          { val: 'left', text: 'محاذاة لليسار أكاديمية' },
          { val: 'minimal', text: 'غلاف بسيط ومختصر' }
        ]
      },
      { key: 'coverLogo', label: 'ظهور اللوجو في الغلاف (100% وضوح)', type: 'check', default: true },
      {
        key: 'coverLogoSize',
        label: 'حجم لوجو الغلاف (px)',
        type: 'range',
        default: 140,
        min: 60,
        max: 260,
        step: 5,
        unit: 'px'
      },
      { key: 'title', label: 'العنوان الرئيسي', type: 'text', default: 'Foundation' },
      { key: 'subtitle', label: 'العنوان الفرعي', type: 'text', default: 'End Exam Qs 30' },
      { key: 'by', label: 'سطر الإعداد / الفريق', type: 'text', default: 'By: Medscope team' },
      { key: 'joinText', label: 'نص الانضمام والتواصل', type: 'text', default: 'Join us' },
      { key: 'secTitleCount', label: 'عرض عدد الأسئلة في عنوان المادة (مثلاً: 17 أسئلة)', type: 'check', default: true }
    ]
  },
  {
    group: 'headerFooter',
    title: 'الهيدر، الفوتر وترقيم الصفحات',
    icon: '📑',
    fields: [
      { key: 'header', label: 'نص الهيدر العلوي', type: 'text', default: 'Dr Omar Medhat - Medscope Meetings' },
      {
        key: 'headerAlign',
        label: 'محاذاة الهيدر',
        type: 'select',
        default: 'right',
        options: [
          { val: 'right', text: 'يمين' },
          { val: 'center', text: 'منتصف' },
          { val: 'left', text: 'يسار' }
        ]
      },
      { key: 'headerLogo', label: 'لوجو مصغر في الهيدر', type: 'check', default: false },
      { key: 'footer', label: 'نص الفوتر السفلي', type: 'text', default: 'Spread your wingS' },
      {
        key: 'footerAlign',
        label: 'محاذاة الفوتر',
        type: 'select',
        default: 'center',
        options: [
          { val: 'right', text: 'يمين' },
          { val: 'center', text: 'منتصف' },
          { val: 'left', text: 'يسار' }
        ]
      },
      { key: 'pageNums', label: 'إظهار ترقيم الصفحات', type: 'check', default: true },
      {
        key: 'pageNumFmt',
        label: 'صيغة الترقيم',
        type: 'select',
        default: '1',
        options: [
          { val: '1', text: '1, 2, 3...' },
          { val: 'Page 1', text: 'Page 1' },
          { val: '1 / 12', text: '1 / 12 (مع إجمالي الصفحات)' }
        ]
      },
      {
        key: 'pageNumPos',
        label: 'موضع رقم الصفحة',
        type: 'select',
        default: 'center',
        options: [
          { val: 'center', text: 'في المنتصف' },
          { val: 'right', text: 'على اليمين' },
          { val: 'left', text: 'على اليسار' }
        ]
      }
    ]
  }
];

/**
 * Builds default settings object from schema
 */
export function buildDefaultSettings() {
  const def = {};
  SETTINGS_SCHEMA.forEach(group => {
    group.fields.forEach(field => {
      if (field.default !== undefined) {
        def[field.key] = field.default;
      }
    });
  });
  return def;
}

