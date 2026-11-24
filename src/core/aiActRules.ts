import type { AiSystemSurface, MarkingStandard } from './types.ts';

/** Official EU Artificial Intelligence Act citation. */
export const EU_AI_ACT_CODE = 'Regulation (EU) 2024/1689';

/** Application date for Article 4 (AI Literacy) & Chapter I/II provisions. */
export const ART4_APPLICATION_DATE = '2025-02-02';

/** Full application date for Article 50 (Transparency Obligations). */
export const ART50_APPLICATION_DATE = '2026-08-02';

export const AIDISCLOSE_LEGAL_DISCLAIMER_EN =
  'AIDisclose is an engineering governance studio, Article 4 AI literacy register, and Article 50 transparency disclosure builder. It is NOT legal counsel or an EU AI Act Notified Body, does NOT certify Annex III high-risk AI conformity, and does NOT embed hardware-level cryptographic C2PA provenance into binary video or audio streams.';

export const AIDISCLOSE_LEGAL_DISCLAIMER_AR =
  'أداة AIDisclose مخصصة لتجهيز الحوكمة الهندسية وسجل تدريب المادة 4 وإفصاحات الشفافية للمادة 50 فقط. هي ليست استشارة قانونية أو هيئة تقييم مطابقة معتمدة، ولا تصادق على أنظمة المخاطر العالية (Annex III)، ولا تدمج تواقيع C2PA تشفيرية داخل ملفات الفيديو أو الصوت الثنائية الحية.';

export interface AiSurfaceMeta {
  id: AiSystemSurface;
  articleRef: string;
  labelEn: string;
  labelAr: string;
}

export const AI_SURFACE_META: ReadonlyArray<AiSurfaceMeta> = [
  {
    id: 'interactive_chatbot',
    articleRef: 'Art. 50(1)',
    labelEn: 'Interactive AI System / Chatbot',
    labelAr: 'نظام تفاعل ذكي / مساعد محادثة',
  },
  {
    id: 'synthetic_media_image_video_audio',
    articleRef: 'Art. 50(2)',
    labelEn: 'Generative Audio / Image / Video / Text Provider Output',
    labelAr: 'مخرجات تركيبية (صوت/صورة/فيديو/نص) لمزودي النماذج',
  },
  {
    id: 'deepfake_media',
    articleRef: 'Art. 50(4) Deepfake',
    labelEn: 'Deepfake Image / Audio / Video Deployment',
    labelAr: 'نشر تزييف عميق (صورة/صوت/فيديو)',
  },
  {
    id: 'public_interest_text',
    articleRef: 'Art. 50(4) Public Interest',
    labelEn: 'AI Text Published on Matters of Public Interest',
    labelAr: 'نصوص ذكاء اصطناعي منشورة حول الشأن العام',
  },
  {
    id: 'emotion_biometric',
    articleRef: 'Art. 50(3)',
    labelEn: 'Emotion Recognition / Biometric Categorisation',
    labelAr: 'التعرّف على المشاعر أو التصنيف البيومتري',
  },
];

const VALID_SURFACES: ReadonlySet<string> = new Set(AI_SURFACE_META.map((item) => item.id));

export const MARKING_STANDARD_LABELS: Record<MarkingStandard, { en: string; ar: string }> = {
  c2pa_provenance: { en: 'C2PA Content Credentials', ar: 'بيانات مصدر C2PA' },
  iptc_digital_source: { en: 'IPTC DigitalSourceType Metadata', ar: 'بيانات IPTC للمصدر الرقمي' },
  html_meta_tag: { en: 'HTML Meta / JSON-LD Provenance', ar: 'وسوم HTML Meta / JSON-LD' },
  audio_watermark: { en: 'Imperceptible Audio Watermark', ar: 'علامة مائية صوتية آلية' },
  none: { en: 'None (No Machine-Readable Marker)', ar: 'لا يوجد (بلا وسم مقروء آلياً)' },
};

export const VALID_MARKING_STANDARDS: ReadonlySet<string> = new Set(
  Object.keys(MARKING_STANDARD_LABELS),
);

export function isValidAiSurface(value: string): value is AiSystemSurface {
  return VALID_SURFACES.has(value.trim());
}

export function isValidMarkingStandard(value: string): value is MarkingStandard {
  return VALID_MARKING_STANDARDS.has(value.trim());
}

export function isValidContactEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export interface AiActTimelineStatus {
  art4EffectiveSince: string;
  art50EffectiveSince: string;
  isArt4Enforced: boolean;
  isArt50Enforced: boolean;
}

/** Evaluates enforcement status against Article 4 (2025-02-02) and Article 50 (2026-08-02). */
export function getAiActTimelineStatus(
  referenceDateIso: string = new Date().toISOString(),
): AiActTimelineStatus {
  const parsed = Date.parse(referenceDateIso);
  const refMs = Number.isNaN(parsed) ? Date.now() : parsed;
  const art4Ms = Date.parse(`${ART4_APPLICATION_DATE}T00:00:00.000Z`);
  const art50Ms = Date.parse(`${ART50_APPLICATION_DATE}T00:00:00.000Z`);

  return {
    art4EffectiveSince: ART4_APPLICATION_DATE,
    art50EffectiveSince: ART50_APPLICATION_DATE,
    isArt4Enforced: refMs >= art4Ms,
    isArt50Enforced: refMs >= art50Ms,
  };
}
