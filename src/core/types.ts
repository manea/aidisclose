export type Locale = 'en' | 'ar';

export type AiOperatorRole = 'provider' | 'deployer' | 'both';

export type AiSystemSurface =
  | 'interactive_chatbot'
  | 'synthetic_media_image_video_audio'
  | 'deepfake_media'
  | 'public_interest_text'
  | 'emotion_biometric';

export type MarkingStandard =
  | 'c2pa_provenance'
  | 'iptc_digital_source'
  | 'html_meta_tag'
  | 'audio_watermark'
  | 'none';

export type ControlStatus = 'pass' | 'fail' | 'in_progress' | 'not_started';

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface OrganizationAiProfile {
  legalName: string;
  contactEmail: string;
  countryCode: string;
  operatorRole: AiOperatorRole;
  dpoOrGovLead: string;
  governancePolicyUrl?: string;
}

export interface AiFeatureInventoryItem {
  id: string;
  featureName: string;
  surface: AiSystemSurface;
  providerName: string;
  modelName: string;
  userFacingUrl?: string;
  publicFacingSinceIso: string;
  disclosureBannerVisible: boolean;
  disclosureWordingEn: string;
  disclosureWordingAr: string;
  machineReadableMarking: MarkingStandard;
  wcagAccessibleNotice: boolean;
  interactiveObviousException: boolean;
  humanEditorialResponsibilityVerified: boolean;
  editorialOwnerName?: string;
}

export interface AiLiteracyTrainingRecord {
  id: string;
  teamOrRole: string;
  staffCount: number;
  completedCount: number;
  curriculumTopics: string[];
  lastSessionDateIso: string;
  owner: string;
}

export interface AiDiscloseCheckItem {
  id: string;
  articleRef: string;
  titleEn: string;
  titleAr: string;
  status: ControlStatus;
  evidenceNote: string;
  owner: string;
}

export interface TransparencyIssue {
  code: string;
  articleRef: string;
  featureId?: string;
  severity: IssueSeverity;
  messageEn: string;
  messageAr: string;
}

export interface TransparencyAuditReport {
  disclosureScore: number;
  literacyScore: number;
  machineReadableScore: number;
  literacyCompletionPct: number;
  editorialExemptionsUsed: number;
  errorsCount: number;
  warningsCount: number;
  issues: TransparencyIssue[];
}

export interface InventoryCsvRowResult {
  rowNumber: number;
  featureId: string;
  featureName: string;
  surface: string;
  disclosureBanner: boolean;
  machineReadable: MarkingStandard;
  wcagAccessible: boolean;
  editorialExemption: boolean;
  status: 'pass' | 'fail';
  score: number;
  issues: TransparencyIssue[];
}

export interface InventoryCsvAuditReport {
  totalRows: number;
  passedRows: number;
  failedRows: number;
  averageScore: number;
  rows: InventoryCsvRowResult[];
}

export interface AiDiscloseSummary {
  overallScore: number;
  controlsPassed: number;
  controlsFailed: number;
  controlsPending: number;
  totalControls: number;
  readinessTier: 'ready' | 'needs_remediation' | 'blocked';
  art4EffectiveSince: string;
  art50EffectiveSince: string;
  isArt4Enforced: boolean;
  isArt50Enforced: boolean;
  blockingGapsCount: number;
}

export interface AiDiscloseDossier {
  id: string;
  slug?: string;
  dossierNumber: string;
  status: 'draft' | 'locked';
  defaultLocale?: Locale;
  referenceDate?: string;
  createdAt: string;
  updatedAt: string;
  lockedAt?: string;
  scopeDigestHex: string;
  organization: OrganizationAiProfile;
  features: AiFeatureInventoryItem[];
  trainingRecords: AiLiteracyTrainingRecord[];
  controls: AiDiscloseCheckItem[];
  auditReport?: TransparencyAuditReport;
  readinessSummary?: AiDiscloseSummary;
}
