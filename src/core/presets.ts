import { buildDefaultAiActControls } from './noticeAndLiteracy.ts';
import type { AiDiscloseDossier, ControlStatus } from './types.ts';

export type AiDisclosePresetId =
  | 'saas-copilot-compliant'
  | 'media-newsroom-gaps'
  | 'hr-emotion-biometric-drill';

export interface AiDisclosePresetMeta {
  id: AiDisclosePresetId;
  titleEn: string;
  titleAr: string;
  subtitleEn: string;
  subtitleAr: string;
}

export const AIDISCLOSE_PRESETS: readonly AiDisclosePresetMeta[] = [
  {
    id: 'saas-copilot-compliant',
    titleEn: 'SaaS AI Copilot — 100/100 Ready (EN/EU)',
    titleAr: 'مساعد SaaS متوافق — جاهزية 100/100',
    subtitleEn: 'Full Art. 50(1) chat banner, C2PA provenance on synthetic images, and 100% Art. 4 literacy',
    subtitleAr: 'إشعار المادة 50(1)، وسم C2PA للصور التركيبية، وتدريب المادة 4 بنسبة 100%',
  },
  {
    id: 'media-newsroom-gaps',
    titleEn: 'Media Newsroom Gaps: Deepfake & Public Text',
    titleAr: 'ثغرات غرفة أخبار: تزييف عميق ونصوص الشأن العام',
    subtitleEn: 'Missing deepfake label, unverified public-interest text, no C2PA marking & <80% Art. 4 training',
    subtitleAr: 'نقص وسم التزييف العميق ونص الشأن العام وغياب الوسم الآلي وتدريب المادة 4 دون 80%',
  },
  {
    id: 'hr-emotion-biometric-drill',
    titleEn: 'Workplace Interview Coach — Art. 50(3) Notice Drill',
    titleAr: 'مدرب مقابلات العمل — تمرين إخطار المادة 50(3)',
    subtitleEn: 'Prior emotion/attention categorization notice under Art. 50(3) & DPO GDPR review check',
    subtitleAr: 'إشعار مسبق لأنظمة المشاعر/التصنيف مع مراجعة حماية البيانات GDPR',
  },
];

function formatDossierNumber(referenceDateIso: string, indexNum: number = 1): string {
  const parsed = Date.parse(referenceDateIso);
  const year = Number.isNaN(parsed) ? new Date().getUTCFullYear() : new Date(parsed).getUTCFullYear();
  return `AID-${year}-${String(indexNum).padStart(4, '0')}`;
}

/** Creates a deep-cloned EU AI Act Article 4 & 50 readiness dossier from a built-in preset. */
export function createDossierFromPreset(
  presetId: AiDisclosePresetId,
  referenceDateIso: string = new Date().toISOString(),
): AiDiscloseDossier {
  if (presetId === 'saas-copilot-compliant') {
    const allPass: Record<string, { status: ControlStatus; evidenceNote: string }> = {
      'ai-art4-staff-curriculum': { status: 'pass', evidenceNote: 'Engineering & CS curriculum live in LMS.' },
      'ai-art4-oversight-pii': { status: 'pass', evidenceNote: 'PII redaction & hallucination checks completed.' },
      'ai-art4-completion-log': { status: 'pass', evidenceNote: '24/24 staff certified for 2026 cohort.' },
      'ai-art50-1-chat-notice': { status: 'pass', evidenceNote: 'Persistent header banner above chat prompt.' },
      'ai-art50-2-machine-marking': { status: 'pass', evidenceNote: 'C2PA Content Credentials embedded on export.' },
      'ai-art50-3-biometric-emotion': { status: 'pass', evidenceNote: 'Not in scope — N/A verified.' },
      'ai-art50-4-deepfake-label': { status: 'pass', evidenceNote: 'Synthetic badges enabled across media tools.' },
      'ai-art50-4-editorial-log': { status: 'pass', evidenceNote: 'Blog editorial workflow human-reviewed.' },
      'ai-art50-5-accessibility': { status: 'pass', evidenceNote: 'WCAG 2.2 AA contrast & ARIA role="note" passed.' },
      'ai-gov-procurement-bundle': { status: 'pass', evidenceNote: 'Ready for enterprise security reviews.' },
    };

    return {
      id: 'preset-saas-copilot-compliant',
      dossierNumber: formatDossierNumber(referenceDateIso, 1),
      status: 'draft',
      createdAt: referenceDateIso,
      updatedAt: referenceDateIso,
      scopeDigestHex: '',
      organization: {
        legalName: 'ClearDesk Cloud B.V.',
        contactEmail: 'ai-governance@cleardesk-example.eu',
        countryCode: 'NL',
        operatorRole: 'both',
        dpoOrGovLead: 'Anouk van Dijk (Head of Compliance)',
        governancePolicyUrl: 'https://cleardesk-example.eu/ai-transparency',
      },
      features: [
        {
          id: 'FEAT-CHAT-01',
          featureName: 'SupportDesk AI Assistant',
          surface: 'interactive_chatbot',
          providerName: 'ClearDesk Internal',
          modelName: 'CD-Support-v3',
          userFacingUrl: 'https://cleardesk-example.eu/app/assistant',
          publicFacingSinceIso: '2026-03-01',
          disclosureBannerVisible: true,
          disclosureWordingEn:
            'You are chatting with an AI assistant. Responses are verified against help docs and can be escalated to an agent at any time.',
          disclosureWordingAr:
            'أنت تتحدث الآن مع مساعد ذكاء اصطناعي؛ يمكنك التحويل إلى موظف مختص في أي وقت.',
          machineReadableMarking: 'html_meta_tag',
          wcagAccessibleNotice: true,
          interactiveObviousException: false,
          humanEditorialResponsibilityVerified: false,
        },
        {
          id: 'FEAT-IMG-02',
          featureName: 'Social Banner Synthetic Illustrator',
          surface: 'synthetic_media_image_video_audio',
          providerName: 'ClearDesk Media Studio',
          modelName: 'ImageGen-2.1',
          userFacingUrl: 'https://cleardesk-example.eu/studio',
          publicFacingSinceIso: '2026-07-15',
          disclosureBannerVisible: true,
          disclosureWordingEn: 'Generated with synthetic AI imagery; export retains C2PA Content Credentials.',
          disclosureWordingAr: 'صورة مولّدة بالذكاء الاصطناعي وتحتفظ ببيانات مصدر C2PA.',
          machineReadableMarking: 'c2pa_provenance',
          wcagAccessibleNotice: true,
          interactiveObviousException: false,
          humanEditorialResponsibilityVerified: false,
        },
      ],
      trainingRecords: [
        {
          id: 'TRN-ENG-01',
          teamOrRole: 'Product & Engineering',
          staffCount: 14,
          completedCount: 14,
          curriculumTopics: ['EU AI Act Art. 4/50', 'Prompt Security & PII Hygiene', 'Output Verification'],
          lastSessionDateIso: '2026-10-15',
          owner: 'Anouk van Dijk',
        },
        {
          id: 'TRN-CS-02',
          teamOrRole: 'Customer Operations & Sales',
          staffCount: 10,
          completedCount: 10,
          curriculumTopics: ['AI Limitations & Escalation', 'Customer Disclosure Handling'],
          lastSessionDateIso: '2026-10-20',
          owner: 'Anouk van Dijk',
        },
      ],
      controls: buildDefaultAiActControls(allPass),
    };
  }

  if (presetId === 'media-newsroom-gaps') {
    const gapControls: Record<string, { status: ControlStatus; evidenceNote: string }> = {
      'ai-art4-staff-curriculum': { status: 'in_progress', evidenceNote: 'Draft slides under review.' },
      'ai-art4-oversight-pii': { status: 'fail', evidenceNote: 'No documented fact-check rubric yet.' },
      'ai-art4-completion-log': { status: 'fail', evidenceNote: 'Only 5/12 journalists completed training.' },
      'ai-art50-1-chat-notice': { status: 'pass', evidenceNote: 'No chatbot deployed.' },
      'ai-art50-2-machine-marking': { status: 'fail', evidenceNote: 'Metadata stripped on CDN resize.' },
      'ai-art50-3-biometric-emotion': { status: 'pass', evidenceNote: 'N/A.' },
      'ai-art50-4-deepfake-label': { status: 'fail', evidenceNote: 'Missing visible AI video label.' },
      'ai-art50-4-editorial-log': { status: 'fail', evidenceNote: 'Auto-summaries lack named human editor.' },
      'ai-art50-5-accessibility': { status: 'not_started', evidenceNote: '' },
      'ai-gov-procurement-bundle': { status: 'not_started', evidenceNote: '' },
    };

    return {
      id: 'preset-media-newsroom-gaps',
      dossierNumber: formatDossierNumber(referenceDateIso, 2),
      status: 'draft',
      createdAt: referenceDateIso,
      updatedAt: referenceDateIso,
      scopeDigestHex: '',
      organization: {
        legalName: 'Nordic Pulse Media SAS',
        contactEmail: 'editorial@nordicpulse-example.fr',
        countryCode: 'FR',
        operatorRole: 'deployer',
        dpoOrGovLead: 'Camille Laurent',
      },
      features: [
        {
          id: 'FEAT-DEEP-01',
          featureName: 'Campaign Video Voice Dubbing & Lip Sync',
          surface: 'deepfake_media',
          providerName: 'External Dubbing API',
          modelName: 'VoiceClone-HD',
          publicFacingSinceIso: '2026-09-01',
          disclosureBannerVisible: false,
          disclosureWordingEn: '',
          disclosureWordingAr: '',
          machineReadableMarking: 'none',
          wcagAccessibleNotice: false,
          interactiveObviousException: false,
          humanEditorialResponsibilityVerified: false,
        },
        {
          id: 'FEAT-PUBTXT-02',
          featureName: 'Municipal Budget Instant Briefs',
          surface: 'public_interest_text',
          providerName: 'Newsroom AutoDraft',
          modelName: 'NewsLLM-4',
          publicFacingSinceIso: '2026-08-18',
          disclosureBannerVisible: false,
          disclosureWordingEn: '',
          disclosureWordingAr: '',
          machineReadableMarking: 'none',
          wcagAccessibleNotice: false,
          interactiveObviousException: false,
          humanEditorialResponsibilityVerified: false,
          editorialOwnerName: '',
        },
      ],
      trainingRecords: [
        {
          id: 'TRN-NEWS-01',
          teamOrRole: 'Editorial & Video Producers',
          staffCount: 12,
          completedCount: 5,
          curriculumTopics: ['Generative Video Policy'],
          lastSessionDateIso: '2026-09-10',
          owner: 'Camille Laurent',
        },
      ],
      controls: buildDefaultAiActControls(gapControls),
    };
  }

  // hr-emotion-biometric-drill
  const drillControls: Record<string, { status: ControlStatus; evidenceNote: string }> = {
    'ai-art4-staff-curriculum': { status: 'pass', evidenceNote: 'HR recruiters trained on Art. 4 & fairness.' },
    'ai-art4-oversight-pii': { status: 'pass', evidenceNote: 'DPIA & candidate opt-out playbook active.' },
    'ai-art4-completion-log': { status: 'pass', evidenceNote: '8/8 HR coaches certified.' },
    'ai-art50-1-chat-notice': { status: 'pass', evidenceNote: 'Practice coach bot disclosed in UI.' },
    'ai-art50-2-machine-marking': { status: 'pass', evidenceNote: 'Metadata header attached.' },
    'ai-art50-3-biometric-emotion': { status: 'in_progress', evidenceNote: 'Verifying candidate notice placement in Germany/Spain.' },
    'ai-art50-4-deepfake-label': { status: 'pass', evidenceNote: 'N/A.' },
    'ai-art50-4-editorial-log': { status: 'pass', evidenceNote: 'N/A.' },
    'ai-art50-5-accessibility': { status: 'pass', evidenceNote: 'ARIA live region verified.' },
    'ai-gov-procurement-bundle': { status: 'in_progress', evidenceNote: 'Awaiting final GDPR DPO sign-off.' },
  };

  return {
    id: 'preset-hr-emotion-biometric-drill',
    dossierNumber: formatDossierNumber(referenceDateIso, 3),
    status: 'draft',
    createdAt: referenceDateIso,
    updatedAt: referenceDateIso,
    scopeDigestHex: '',
    organization: {
      legalName: 'TalentBridge DE GmbH',
      contactEmail: 'dpo@talentbridge-example.de',
      countryCode: 'DE',
      operatorRole: 'deployer',
      dpoOrGovLead: 'Jonas Weber (DPO)',
    },
    features: [
      {
        id: 'FEAT-EMO-01',
        featureName: 'Mock Interview Vocal Pace & Sentiment Aid (Opt-In Training Only)',
        surface: 'emotion_biometric',
        providerName: 'TalentBridge Audio',
        modelName: 'SpeechCue-1.4',
        publicFacingSinceIso: '2026-08-05',
        disclosureBannerVisible: true,
        disclosureWordingEn:
          'This optional practice tool analyzes vocal pacing & tonal cues using AI for coaching feedback only and does not rank hiring eligibility.',
        disclosureWordingAr:
          'أداة تدريب اختيارية تحلل نبرة الصوت بالذكاء الاصطناعي للتدريب فقط ولا تُستخدم في قرارات التوظيف.',
        machineReadableMarking: 'html_meta_tag',
        wcagAccessibleNotice: true,
        interactiveObviousException: false,
        humanEditorialResponsibilityVerified: false,
      },
    ],
    trainingRecords: [
      {
        id: 'TRN-HR-01',
        teamOrRole: 'Talent Coaching & Operations',
        staffCount: 8,
        completedCount: 8,
        curriculumTopics: ['Art. 4 AI Literacy', 'EU AI Act Art. 50(3) Candidate Notice', 'GDPR Boundaries'],
        lastSessionDateIso: '2026-11-01',
        owner: 'Jonas Weber',
      },
    ],
    controls: buildDefaultAiActControls(drillControls),
  };
}
