import type { AiOperatorRole, ControlStatus, Locale } from '../core/types.ts';

export type ThemeId = 'veridian' | 'carbon-violet';

export interface UiCopy {
  brandName: string;
  tagline: string;
  regulationBadge: string;
  modeServer: string;
  modeBrowser: string;
  themeVeridian: string;
  themeCarbon: string;
  langSwitch: string;
  presetsTitle: string;
  dossiersTitle: string;
  noDossiersYet: string;
  draftStatus: string;
  lockedStatus: string;
  createFromPreset: string;
  viewsLabel: string;
  tabs: {
    surfaces: string;
    literacyAndCsv: string;
    dossierAndPrint: string;
  };
  timeline: {
    art4Title: string;
    art50Title: string;
    enforcedTag: string;
    upcomingTag: string;
  };
  kpis: {
    overall: string;
    disclosure: string;
    literacy: string;
    machineMarking: string;
    blockingGaps: string;
    editorialExemptions: string;
  };
  tierLabels: {
    ready: string;
    needs_remediation: string;
    blocked: string;
  };
  orgSection: {
    title: string;
    savedProfiles: string;
    saveProfileBtn: string;
    applyProfile: string;
    deleteProfile: string;
    legalName: string;
    contactEmail: string;
    countryCode: string;
    operatorRole: string;
    dpoOrGovLead: string;
    governancePolicyUrl: string;
    roleOptions: Record<AiOperatorRole, string>;
  };
  featuresSection: {
    title: string;
    addFeature: string;
    deleteFeature: string;
    featureName: string;
    surface: string;
    providerName: string;
    modelName: string;
    userFacingUrl: string;
    publicFacingSince: string;
    machineReadableMarking: string;
    disclosureBannerVisible: string;
    wcagAccessibleNotice: string;
    interactiveObviousException: string;
    humanEditorialVerified: string;
    editorialOwnerName: string;
    disclosureWordingEn: string;
    disclosureWordingAr: string;
    snippetTitle: string;
    copySnippet: string;
    copied: string;
    downloadHtml: string;
    issuesTitle: string;
    noIssues: string;
  };
  literacySection: {
    title: string;
    completionLabel: string;
    addCohort: string;
    removeCohort: string;
    markFull: string;
    teamOrRole: string;
    staffCount: string;
    completedCount: string;
    curriculumTopics: string;
    lastSessionDate: string;
    owner: string;
  };
  controlsSection: {
    title: string;
    statusOptions: Record<ControlStatus, string>;
    evidencePlaceholder: string;
    ownerPlaceholder: string;
  };
  csvSection: {
    title: string;
    subtitle: string;
    loadSample: string;
    uploadFile: string;
    runAudit: string;
    downloadCsv: string;
    placeholder: string;
    totalRows: string;
    passedRows: string;
    failedRows: string;
    avgScore: string;
    colFeature: string;
    colSurface: string;
    colMarking: string;
    colExemption: string;
    colStatus: string;
    colScore: string;
    yesLabel: string;
    noLabel: string;
  };
  actions: {
    saveDraft: string;
    saving: string;
    finalizeSeal: string;
    sealing: string;
    duplicateDraft: string;
    deleteDraft: string;
    printPdf: string;
    copyShareLink: string;
    openPublicReport: string;
    downloadMarkdown: string;
    downloadHtml: string;
    downloadCsv: string;
    backToWorkspace: string;
  };
  reportSection: {
    title: string;
    readOnlyLockedNotice: string;
    publicSharedBanner: string;
    integrityVerified: string;
    integrityDraft: string;
    shaDigestLabel: string;
    dossierNumberLabel: string;
    orgHeader: string;
    art4TableTitle: string;
    art50TableTitle: string;
    controlsTableTitle: string;
    disclaimerTitle: string;
    publicNotFound: string;
  };
  notices: {
    draftSaved: string;
    dossierSealed: string;
    profileSaved: string;
    linkCopied: string;
  };
}

const EN_COPY: UiCopy = {
  brandName: 'AIDisclose',
  tagline: 'EU AI Act Art. 4 AI Literacy & Art. 50 Transparency Studio',
  regulationBadge: 'Regulation (EU) 2024/1689',
  modeServer: 'SQLite WAL + Node 22',
  modeBrowser: '$0 Browser Offline Mode',
  themeVeridian: 'Atelier Light',
  themeCarbon: 'Carbon Violet',
  langSwitch: 'العربية RTL',
  presetsTitle: 'Start from Regulation Scenario',
  dossiersTitle: 'Saved Governance Dossiers',
  noDossiersYet: 'Create your first EU AI Act Art. 4 & 50 readiness dossier from a scenario above.',
  draftStatus: 'Draft',
  lockedStatus: 'Sealed',
  createFromPreset: 'Launch',
  viewsLabel: 'Views',
  tabs: {
    surfaces: '1. AI Surfaces & Art. 50 Builder',
    literacyAndCsv: '2. Art. 4 Literacy & Inventory CSV',
    dossierAndPrint: '3. Governance Dossier & A4 PDF',
  },
  timeline: {
    art4Title: 'Art. 4 AI Literacy (2025-02-02)',
    art50Title: 'Art. 50 Transparency (2026-08-02)',
    enforcedTag: 'Enforced',
    upcomingTag: 'Upcoming',
  },
  kpis: {
    overall: 'Overall Readiness',
    disclosure: 'Art. 50 Disclosure',
    literacy: 'Art. 4 Literacy',
    machineMarking: 'Machine Marking',
    blockingGaps: 'Blocking Gaps',
    editorialExemptions: 'Editorial Exemptions',
  },
  tierLabels: {
    ready: 'Ready',
    needs_remediation: 'Needs Remediation',
    blocked: 'Blocked',
  },
  orgSection: {
    title: 'Organization & Accountable AI Governance Identity',
    savedProfiles: 'Reusable Organization Profiles',
    saveProfileBtn: 'Save Org Profile',
    applyProfile: 'Apply',
    deleteProfile: 'Remove',
    legalName: 'Legal Organization Name',
    contactEmail: 'Governance / DPO Contact Email',
    countryCode: 'Country Code (EU / EEA)',
    operatorRole: 'EU AI Act Role',
    dpoOrGovLead: 'Accountable AI Governance Lead / DPO',
    governancePolicyUrl: 'Public AI Transparency Policy URL (optional)',
    roleOptions: {
      provider: 'Provider (Builds / Supplies AI)',
      deployer: 'Deployer (Operates AI in Product / Org)',
      both: 'Both Provider & Deployer',
    },
  },
  featuresSection: {
    title: 'AI Feature & Interaction Surface Inventory (Article 50)',
    addFeature: 'Add AI Feature',
    deleteFeature: 'Remove',
    featureName: 'Feature / System Name',
    surface: 'Article 50 Surface Category',
    providerName: 'Model / AI Provider',
    modelName: 'Model Name / Version',
    userFacingUrl: 'User-Facing URL (optional)',
    publicFacingSince: 'Public-Facing Since (ISO Date)',
    machineReadableMarking: 'Machine-Readable Provenance (Art. 50-2)',
    disclosureBannerVisible: 'Visible transparency notice shown to exposed natural persons',
    wcagAccessibleNotice: 'Notice meets WCAG 2.2 AA & ARIA perceivability (Art. 50-5)',
    interactiveObviousException: 'Art. 50(1) exception: AI interaction is already obvious from context',
    humanEditorialVerified: 'Art. 50(4) exemption: human review & editorial responsibility verified',
    editorialOwnerName: 'Named Human Editorial Owner',
    disclosureWordingEn: 'User-Facing Disclosure Wording (English)',
    disclosureWordingAr: 'User-Facing Disclosure Wording (Arabic)',
    snippetTitle: 'Embeddable Article 50 HTML + JSON-LD Notice Snippet',
    copySnippet: 'Copy Snippet',
    copied: 'Copied',
    downloadHtml: 'Download article50.html',
    issuesTitle: 'Live Article 4 & 50 Findings',
    noIssues: 'Zero Article 4 or Article 50 compliance issues detected.',
  },
  literacySection: {
    title: 'Article 4 AI Literacy Staff Training Register (Active since 2025-02-02)',
    completionLabel: 'Staff Completion Coverage',
    addCohort: 'Add Training Cohort',
    removeCohort: 'Remove',
    markFull: 'Mark 100%',
    teamOrRole: 'Team / Role Cohort',
    staffCount: 'Total Staff',
    completedCount: 'Completed',
    curriculumTopics: 'Curriculum Topics (comma-separated)',
    lastSessionDate: 'Last Session Date',
    owner: 'Cohort Owner',
  },
  controlsSection: {
    title: '10-Control Article 4 & Article 50 Readiness Matrix',
    statusOptions: {
      pass: 'Pass',
      in_progress: 'In Progress',
      fail: 'Fail',
      not_started: 'Not Started',
    },
    evidencePlaceholder: 'Reference LMS link, PR, or disclosure screenshot...',
    ownerPlaceholder: 'Control owner',
  },
  csvSection: {
    title: 'Bulk AI Feature Inventory CSV Auditor',
    subtitle: 'Evaluate multi-product AI inventories against Art. 50 disclosure, C2PA/IPTC marking & Art. 50(4) editorial ownership without uploading data externally.',
    loadSample: 'Load Sample Inventory CSV',
    uploadFile: 'Upload CSV',
    runAudit: 'Audit Inventory CSV',
    downloadCsv: 'Export Sanitized BOM CSV',
    placeholder: 'feature_id,feature_name,surface,disclosure_banner,machine_readable,wcag_accessible,editorial_review_owner\nBOT-01,Support Widget,interactive_chatbot,true,html_meta_tag,true,',
    totalRows: 'Rows',
    passedRows: 'Passed',
    failedRows: 'Failed',
    avgScore: 'Average Score',
    colFeature: 'Feature',
    colSurface: 'Surface',
    colMarking: 'Marking',
    colExemption: 'Editorial Exemption',
    colStatus: 'Status',
    colScore: 'Score',
    yesLabel: 'Yes',
    noLabel: 'No',
  },
  actions: {
    saveDraft: 'Save Draft',
    saving: 'Saving...',
    finalizeSeal: 'Seal & Assign AID-YYYY-NNNN',
    sealing: 'Sealing...',
    duplicateDraft: 'Duplicate to New Draft',
    deleteDraft: 'Delete Draft',
    printPdf: 'Print / Save A4 PDF',
    copyShareLink: 'Copy Share Link',
    openPublicReport: 'Open Public Report',
    downloadMarkdown: 'Download Art. 4 Markdown',
    downloadHtml: 'Download Art. 50 HTML',
    downloadCsv: 'Download Inventory CSV',
    backToWorkspace: 'Open Full Studio',
  },
  reportSection: {
    title: 'EU AI Act Article 4 & Article 50 Readiness Dossier',
    readOnlyLockedNotice: 'This readiness dossier is cryptographically sealed against modification. Duplicate it to prepare a new revision.',
    publicSharedBanner: 'Public Read-Only Verification View (/r/...)',
    integrityVerified: 'SHA-256 Canonical Scope Integrity Verified',
    integrityDraft: 'Draft preview — seal dossier to issue an immutable AID-YYYY-NNNN fingerprint',
    shaDigestLabel: 'SHA-256 Digest',
    dossierNumberLabel: 'Dossier Ref',
    orgHeader: 'Organization & Governance Lead',
    art4TableTitle: 'Article 4 AI Literacy Cohorts',
    art50TableTitle: 'Article 50 AI System Surfaces & Markings',
    controlsTableTitle: '10-Control Verification Matrix',
    disclaimerTitle: 'Mandatory Scope & Non-Certification Notice',
    publicNotFound: 'No AIDisclose readiness dossier matched this reference or slug.',
  },
  notices: {
    draftSaved: 'Dossier draft evaluated and saved.',
    dossierSealed: 'Dossier cryptographically sealed with SHA-256 fingerprint.',
    profileSaved: 'Organization governance profile saved.',
    linkCopied: 'Copied to clipboard.',
  },
};

const AR_COPY: UiCopy = {
  brandName: 'AIDisclose',
  tagline: 'أستوديو شفافية الذكاء الاصطناعي ومحو الأمية — المادتان 4 و50',
  regulationBadge: 'Regulation (EU) 2024/1689',
  modeServer: 'خادم Node 22 + SQLite WAL',
  modeBrowser: 'وضع المتصفح المجاني $0',
  themeVeridian: 'Atelier فاتح',
  themeCarbon: 'Carbon داكن',
  langSwitch: 'English LTR',
  presetsTitle: 'ابدأ من سيناريو تنظيمي جاهز',
  dossiersTitle: 'ملفات الحوكمة المحفوظة',
  noDossiersYet: 'أنشئ أول ملف جاهزية للمادتين 4 و50 من أحد السيناريوهات أعلاه.',
  draftStatus: 'مسودة',
  lockedStatus: 'مختوم',
  createFromPreset: 'فتح',
  viewsLabel: 'مشاهدات',
  tabs: {
    surfaces: '1. ميزات AI وباني المادة 50',
    literacyAndCsv: '2. تدريب المادة 4 وجرد CSV',
    dossierAndPrint: '3. ملف الجاهزية والطباعة PDF',
  },
  timeline: {
    art4Title: 'المادة 4 محو أمية AI (2025-02-02)',
    art50Title: 'المادة 50 الشفافية (2026-08-02)',
    enforcedTag: 'نافذة',
    upcomingTag: 'قادمة',
  },
  kpis: {
    overall: 'الجاهزية الكلية',
    disclosure: 'إفصاح المادة 50',
    literacy: 'تدريب المادة 4',
    machineMarking: 'الوسم الآلي',
    blockingGaps: 'فجوات معطلة',
    editorialExemptions: 'استثناء تحريري',
  },
  tierLabels: {
    ready: 'جاهز',
    needs_remediation: 'يتطلب معالجة',
    blocked: 'موقوف لفجوات',
  },
  orgSection: {
    title: 'هوية المؤسسة ومسؤول حوكمة الذكاء الاصطناعي',
    savedProfiles: 'ملفات المؤسسات المحفوظة',
    saveProfileBtn: 'حفظ ملف المؤسسة',
    applyProfile: 'تطبيق',
    deleteProfile: 'حذف',
    legalName: 'الاسم القانوني للمؤسسة',
    contactEmail: 'بريد الحوكمة / مسؤول حماية البيانات',
    countryCode: 'رمز الدولة (EU / EEA)',
    operatorRole: 'الصفة التنظيمية في اللائحة',
    dpoOrGovLead: 'اسم مسؤول حوكمة الذكاء الاصطناعي',
    governancePolicyUrl: 'رابط سياسة شفافية الذكاء الاصطناعي (اختياري)',
    roleOptions: {
      provider: 'مزوّد (Provider — يطور أو يطرح النموذج)',
      deployer: 'منفّذ (Deployer — يشغل النظام ضمن منتجه)',
      both: 'مزوّد ومنفّذ معاً (Provider & Deployer)',
    },
  },
  featuresSection: {
    title: 'جرد ميزات وأسطح الذكاء الاصطناعي — المادة 50',
    addFeature: 'إضافة ميزة AI',
    deleteFeature: 'حذف',
    featureName: 'اسم الميزة أو النظام',
    surface: 'فئة السطح التنظيمي (المادة 50)',
    providerName: 'مزوّد النموذج',
    modelName: 'اسم / إصدار النموذج',
    userFacingUrl: 'رابط الميزة العام (اختياري)',
    publicFacingSince: 'تاريخ الإتاحة للجمهور (ISO)',
    machineReadableMarking: 'الوسم المقروء آلياً — المادة 50(2)',
    disclosureBannerVisible: 'إظهار إشعار شفافية واضح للمستخدمين عند التفاعل أو العرض',
    wcagAccessibleNotice: 'توافق الإشعار مع قارئات الشاشة ومعايير الوصول WCAG 2.2 AA',
    interactiveObviousException: 'استثناء المادة 50(1): كون التفاعل بالذكاء الاصطناعي واضحاً بذاته من السياق',
    humanEditorialVerified: 'استثناء المادة 50(4): مراجعة وتحرير بشري موثق بمسؤولية تحريرية',
    editorialOwnerName: 'اسم المسؤول التحريري البشري',
    disclosureWordingEn: 'نص الإفصاح للمستخدم (بالإنجليزية)',
    disclosureWordingAr: 'نص الإفصاح للمستخدم (بالعربية)',
    snippetTitle: 'مقتطف HTML + JSON-LD الجاهز للمادة 50',
    copySnippet: 'نسخ الكود',
    copied: 'تم النسخ',
    downloadHtml: 'تنزيل article50.html',
    issuesTitle: 'نتائج التدقيق الحي للمادتين 4 و50',
    noIssues: 'لا توجد أي فجوات أو ملاحظات في المادتين 4 و50.',
  },
  literacySection: {
    title: 'سجل تدريب الموظفين ومحو أمية AI — المادة 4 (نافذة منذ 2025-02-02)',
    completionLabel: 'نسبة تغطية تدريب الموظفين',
    addCohort: 'إضافة دفعة تدريب',
    removeCohort: 'حذف',
    markFull: 'اعتماد 100%',
    teamOrRole: 'الفريق أو الدور الوظيفي',
    staffCount: 'إجمالي الموظفين',
    completedCount: 'المنجزون للتدريب',
    curriculumTopics: 'محاور المنهج التدريبي (مفصولة بفاصلة)',
    lastSessionDate: 'تاريخ آخر جلسة',
    owner: 'مسؤول التدريب',
  },
  controlsSection: {
    title: 'مصفوفة الضوابط العشرة للمادتين 4 و50',
    statusOptions: {
      pass: 'مكتمل',
      in_progress: 'قيد التنفيذ',
      fail: 'فجوة',
      not_started: 'لم يبدأ',
    },
    evidencePlaceholder: 'مرجع سجل التدريب، رابط الميزة، أو لقطة الشاشة...',
    ownerPlaceholder: 'المسؤول',
  },
  csvSection: {
    title: 'مدقق جرد ميزات الذكاء الاصطناعي الدفعي (CSV)',
    subtitle: 'افحص جداول أنظمة المؤسسة للتحقق من إشعار المادة 50 والوسم الآلي واستثناء التحرير البشري محلياً بالكامل.',
    loadSample: 'تحميل عينة CSV جاهزة',
    uploadFile: 'رفع ملف CSV',
    runAudit: 'تدقيق جدول CSV',
    downloadCsv: 'تصدير CSV نظيف (UTF-8 BOM)',
    placeholder: 'feature_id,feature_name,surface,disclosure_banner,machine_readable,wcag_accessible,editorial_review_owner\nBOT-01,Support Widget,interactive_chatbot,true,html_meta_tag,true,',
    totalRows: 'الصفوف',
    passedRows: 'ناجحة',
    failedRows: 'بفجوات',
    avgScore: 'متوسط الدرجة',
    colFeature: 'الميزة',
    colSurface: 'السطح',
    colMarking: 'الوسم الآلي',
    colExemption: 'استثناء تحريري',
    colStatus: 'الحالة',
    colScore: 'الدرجة',
    yesLabel: 'نعم',
    noLabel: 'لا',
  },
  actions: {
    saveDraft: 'حفظ المسودة',
    saving: 'جارٍ الحفظ...',
    finalizeSeal: 'ختم الملف وإصدار AID-YYYY-NNNN',
    sealing: 'جارٍ الختم...',
    duplicateDraft: 'نسخ إلى مسودة جديدة',
    deleteDraft: 'حذف المسودة',
    printPdf: 'طباعة / حفظ A4 PDF',
    copyShareLink: 'نسخ رابط المشاركة',
    openPublicReport: 'عرض التقرير العام',
    downloadMarkdown: 'تنزيل سجل المادة 4 (.md)',
    downloadHtml: 'تنزيل إشعار المادة 50 (.html)',
    downloadCsv: 'تصدير CSV',
    backToWorkspace: 'العودة للاستوديو الكامل',
  },
  reportSection: {
    title: 'ملف الجاهزية الموقّع — EU AI Act (المادتان 4 و50)',
    readOnlyLockedNotice: 'هذا الملف مختوم ببصمة SHA-256 غير قابلة للتعديل؛ انسخه إلى مسودة جديدة لإصدار مراجعة محدثة.',
    publicSharedBanner: 'عرض تحقق عام للقراءة فقط (/r/...)',
    integrityVerified: 'تم التحقق من مطابقة بصمة SHA-256 للنطاق الرسمي',
    integrityDraft: 'معاينة مسودة — اختم الملف لإصدار رقم AID-YYYY-0001 وبصمة غير قابلة للتلاعب',
    shaDigestLabel: 'بصمة SHA-256',
    dossierNumberLabel: 'رقم الملف',
    orgHeader: 'المؤسسة ومسؤول الحوكمة',
    art4TableTitle: 'سجل تدريب المادة 4 (AI Literacy)',
    art50TableTitle: 'أسطح الذكاء الاصطناعي والوسوم الآلية (المادة 50)',
    controlsTableTitle: 'مصفوفة التحقق من الضوابط العشرة',
    disclaimerTitle: 'تنبيه النطاق القانوني الإلزامي',
    publicNotFound: 'لم يتم العثور على ملف جاهزية AIDisclose بهذا المعرف أو الرابط.',
  },
  notices: {
    draftSaved: 'تم تدقيق المسودة وحفظها.',
    dossierSealed: 'تم ختم الملف ببصمة SHA-256 المشفرة بنجاح.',
    profileSaved: 'تم حفظ ملف المؤسسة للوصول السريع.',
    linkCopied: 'تم النسخ إلى الحافظة.',
  },
};

export function getUiCopy(locale: Locale): UiCopy {
  return locale === 'ar' ? AR_COPY : EN_COPY;
}
