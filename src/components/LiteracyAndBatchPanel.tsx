import { useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  AiDiscloseCheckItem,
  AiDiscloseDossier,
  AiLiteracyTrainingRecord,
  ControlStatus,
  InventoryCsvAuditReport,
  Locale,
  TransparencyAuditReport,
} from '../core/types.ts';
import { auditInventoryCsvApi } from '../lib/api.ts';
import type { UiCopy } from '../lib/i18n.ts';

interface LiteracyAndBatchPanelProps {
  dossier: AiDiscloseDossier;
  audit: TransparencyAuditReport;
  locale: Locale;
  copy: UiCopy;
  disabled: boolean;
  onChange: (next: AiDiscloseDossier) => void;
}

const SAMPLE_INVENTORY_CSV = [
  'feature_id,feature_name,surface,disclosure_banner,machine_readable,wcag_accessible,editorial_review_owner',
  'BOT-01,Support Widget,interactive_chatbot,true,html_meta_tag,true,',
  'IMG-02,Promo Synthetic Reel,deepfake_media,false,none,false,',
  'NEWS-03,Policy Wire Brief,public_interest_text,false,none,true,Managing Desk Editor',
].join('\n');

function downloadCsvFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function LiteracyAndBatchPanel({
  dossier,
  audit,
  locale,
  copy,
  disabled,
  onChange,
}: LiteracyAndBatchPanelProps) {
  const [csvText, setCsvText] = useState(SAMPLE_INVENTORY_CSV);
  const [csvResult, setCsvResult] = useState<{
    report: InventoryCsvAuditReport;
    csvExport: string;
  } | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [auditingCsv, setAuditingCsv] = useState(false);

  function updateCohort(index: number, patch: Partial<AiLiteracyTrainingRecord>) {
    const next = dossier.trainingRecords.map((rec, idx) =>
      idx === index ? { ...rec, ...patch } : rec,
    );
    onChange({
      ...dossier,
      trainingRecords: next,
    });
  }

  function handleAddCohort() {
    const num = dossier.trainingRecords.length + 1;
    const newCohort: AiLiteracyTrainingRecord = {
      id: `TRN-${String(num).padStart(2, '0')}`,
      teamOrRole: locale === 'ar' ? `فريق التشغيل ${num}` : `Operations Team ${num}`,
      staffCount: 10,
      completedCount: 10,
      curriculumTopics: ['Art. 4 AI Literacy', 'Prompt & PII Hygiene', 'Human Oversight'],
      lastSessionDateIso: new Date().toISOString().slice(0, 10),
      owner: dossier.organization.dpoOrGovLead || 'People Operations',
    };
    onChange({
      ...dossier,
      trainingRecords: [...dossier.trainingRecords, newCohort],
    });
  }

  function handleRemoveCohort(index: number) {
    onChange({
      ...dossier,
      trainingRecords: dossier.trainingRecords.filter((_, idx) => idx !== index),
    });
  }

  function updateControl(index: number, patch: Partial<AiDiscloseCheckItem>) {
    const next = dossier.controls.map((ctrl, idx) =>
      idx === index ? { ...ctrl, ...patch } : ctrl,
    );
    onChange({
      ...dossier,
      controls: next,
    });
  }

  async function handleRunCsvAudit(inputCsv: string = csvText) {
    setAuditingCsv(true);
    setCsvError(null);
    try {
      const res = await auditInventoryCsvApi(inputCsv, locale);
      setCsvResult(res);
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : 'Failed to audit inventory CSV');
      setCsvResult(null);
    } finally {
      setAuditingCsv(false);
    }
  }

  function handleCsvFileUpload(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setCsvText(text);
      void handleRunCsvAudit(text);
    };
    reader.readAsText(file, 'utf8');
  }

  return (
    <div className="space-y-6">
      {/* Article 4 AI Literacy Staff Training Register */}
      <section className="aid-card rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-bold aid-display flex items-center gap-2">
              <BookOpenCheck className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
              <span>{copy.literacySection.title}</span>
            </h2>
            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {copy.literacySection.completionLabel}:{' '}
              <strong
                className="aid-mono num-tabular"
                style={{
                  color:
                    audit.literacyCompletionPct >= 80 ? 'var(--accent-emerald)' : 'var(--accent-crimson)',
                }}
              >
                {audit.literacyCompletionPct}%
              </strong>
            </p>
          </div>

          <button
            type="button"
            data-testid="add-cohort-btn"
            disabled={disabled}
            onClick={handleAddCohort}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
          >
            <Plus className="w-4 h-4" />
            <span className="whitespace-nowrap">{copy.literacySection.addCohort}</span>
          </button>
        </div>

        <div className="space-y-4">
          {dossier.trainingRecords.map((cohort, idx) => {
            const pct =
              cohort.staffCount > 0
                ? Math.min(100, Math.round((cohort.completedCount / cohort.staffCount) * 100))
                : 0;
            return (
              <div
                key={`${cohort.id}-${idx}`}
                data-testid={`cohort-card-${idx}`}
                className="rounded-xl border p-4 space-y-3"
                style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-canvas)' }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="aid-mono text-xs font-semibold px-2 py-0.5 rounded"
                      style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--accent-primary)' }}
                      dir="ltr"
                    >
                      {cohort.id}
                    </span>
                    <span
                      className="aid-mono text-xs font-bold px-2.5 py-0.5 rounded-full num-tabular whitespace-nowrap"
                      style={{
                        backgroundColor:
                          pct >= 80 ? 'var(--accent-emerald-soft)' : 'var(--accent-amber-soft)',
                        color: pct >= 80 ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                      }}
                    >
                      {pct}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid={`cohort-mark-full-${idx}`}
                      disabled={disabled || pct === 100}
                      onClick={() => updateCohort(idx, { completedCount: cohort.staffCount })}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-40"
                      style={{
                        backgroundColor: 'var(--accent-emerald-soft)',
                        color: 'var(--accent-emerald)',
                      }}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>{copy.literacySection.markFull}</span>
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleRemoveCohort(idx)}
                      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-40"
                      style={{
                        backgroundColor: 'var(--accent-crimson-soft)',
                        color: 'var(--accent-crimson)',
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{copy.literacySection.removeCohort}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                      {copy.literacySection.teamOrRole}
                    </label>
                    <input
                      type="text"
                      dir="auto"
                      disabled={disabled}
                      value={cohort.teamOrRole}
                      onChange={(e) => updateCohort(idx, { teamOrRole: e.target.value })}
                      className="aid-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                      {copy.literacySection.staffCount}
                    </label>
                    <input
                      type="number"
                      min={0}
                      dir="ltr"
                      disabled={disabled}
                      value={cohort.staffCount}
                      onChange={(e) =>
                        updateCohort(idx, { staffCount: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="aid-input aid-mono num-tabular"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                      {copy.literacySection.completedCount}
                    </label>
                    <input
                      type="number"
                      min={0}
                      dir="ltr"
                      disabled={disabled}
                      value={cohort.completedCount}
                      onChange={(e) =>
                        updateCohort(idx, {
                          completedCount: Math.max(0, Number(e.target.value) || 0),
                        })
                      }
                      className="aid-input aid-mono num-tabular"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                      {copy.literacySection.lastSessionDate}
                    </label>
                    <input
                      type="date"
                      dir="ltr"
                      disabled={disabled}
                      value={cohort.lastSessionDateIso}
                      onChange={(e) => updateCohort(idx, { lastSessionDateIso: e.target.value })}
                      className="aid-input aid-mono text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                      {copy.literacySection.curriculumTopics}
                    </label>
                    <input
                      type="text"
                      dir="auto"
                      data-testid={`cohort-topics-input-${idx}`}
                      disabled={disabled}
                      value={cohort.curriculumTopics.join(', ')}
                      onChange={(e) =>
                        updateCohort(idx, {
                          curriculumTopics: e.target.value
                            .split(',')
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                      className="aid-input text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
                      {copy.literacySection.owner}
                    </label>
                    <input
                      type="text"
                      dir="auto"
                      disabled={disabled}
                      value={cohort.owner}
                      onChange={(e) => updateCohort(idx, { owner: e.target.value })}
                      className="aid-input text-xs"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 10-Control Article 4 & 50 Readiness Matrix */}
      <section className="aid-card rounded-2xl p-5 sm:p-6">
        <h2 className="text-base sm:text-lg font-bold aid-display flex items-center gap-2 mb-4">
          <ClipboardList className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
          <span>{copy.controlsSection.title}</span>
        </h2>

        <div className="space-y-2.5">
          {dossier.controls.map((ctrl, idx) => (
            <div
              key={ctrl.id}
              className="rounded-xl border p-3.5 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center"
              style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-canvas)' }}
            >
              <div className="lg:col-span-5 space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className="aid-mono text-[11px] font-bold px-2 py-0.5 rounded whitespace-nowrap"
                    style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--accent-primary)' }}
                    dir="ltr"
                  >
                    {ctrl.articleRef}
                  </span>
                  <span className="text-xs font-semibold" dir="auto">
                    {locale === 'ar' ? ctrl.titleAr : ctrl.titleEn}
                  </span>
                </div>
              </div>

              <div className="lg:col-span-2">
                <select
                  data-testid={`control-select-${ctrl.id}`}
                  disabled={disabled}
                  value={ctrl.status}
                  onChange={(e) => updateControl(idx, { status: e.target.value as ControlStatus })}
                  className="aid-input text-xs font-semibold"
                >
                  {(['pass', 'in_progress', 'fail', 'not_started'] as const).map((st) => (
                    <option key={st} value={st}>
                      {copy.controlsSection.statusOptions[st]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-3">
                <input
                  type="text"
                  dir="auto"
                  disabled={disabled}
                  value={ctrl.evidenceNote}
                  placeholder={copy.controlsSection.evidencePlaceholder}
                  onChange={(e) => updateControl(idx, { evidenceNote: e.target.value })}
                  className="aid-input text-xs"
                />
              </div>

              <div className="lg:col-span-2">
                <input
                  type="text"
                  dir="auto"
                  disabled={disabled}
                  value={ctrl.owner}
                  placeholder={copy.controlsSection.ownerPlaceholder}
                  onChange={(e) => updateControl(idx, { owner: e.target.value })}
                  className="aid-input text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bulk AI Feature Inventory CSV Auditor */}
      <section className="aid-card rounded-2xl p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="space-y-1 max-w-2xl">
            <h2 className="text-base sm:text-lg font-bold aid-display flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" style={{ color: 'var(--accent-primary)' }} />
              <span>{copy.csvSection.title}</span>
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {copy.csvSection.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setCsvText(SAMPLE_INVENTORY_CSV);
                void handleRunCsvAudit(SAMPLE_INVENTORY_CSV);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer"
              style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-elevated)' }}
            >
              {copy.csvSection.loadSample}
            </button>

            <label
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer"
              style={{ borderColor: 'var(--border-strong)', backgroundColor: 'var(--bg-elevated)' }}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{copy.csvSection.uploadFile}</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => handleCsvFileUpload(e.target.files?.[0])}
              />
            </label>

            <button
              type="button"
              data-testid="run-csv-audit-btn"
              disabled={auditingCsv}
              onClick={() => void handleRunCsvAudit(csvText)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-primary)', color: 'var(--accent-primary-fg)' }}
            >
              {copy.csvSection.runAudit}
            </button>

            {csvResult && (
              <button
                type="button"
                data-testid="download-csv-audit-btn"
                onClick={() =>
                  downloadCsvFile(`aidisclose-inventory-audit-${locale}.csv`, csvResult.csvExport)
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
                style={{
                  backgroundColor: 'var(--accent-emerald-soft)',
                  color: 'var(--accent-emerald)',
                }}
              >
                <Download className="w-3.5 h-3.5" />
                <span>{copy.csvSection.downloadCsv}</span>
              </button>
            )}
          </div>
        </div>

        <textarea
          rows={4}
          dir="ltr"
          data-testid="csv-audit-textarea"
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={copy.csvSection.placeholder}
          className="aid-input aid-mono text-xs mb-4"
        />

        {csvError && (
          <div
            className="rounded-xl p-3 text-xs font-semibold mb-4"
            style={{ backgroundColor: 'var(--accent-crimson-soft)', color: 'var(--accent-crimson)' }}
          >
            {csvError}
          </div>
        )}

        {csvResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl p-3 border" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {copy.csvSection.totalRows}
                </div>
                <div className="text-lg font-bold aid-mono num-tabular">{csvResult.report.totalRows}</div>
              </div>
              <div className="rounded-xl p-3 border" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {copy.csvSection.passedRows}
                </div>
                <div
                  className="text-lg font-bold aid-mono num-tabular"
                  style={{ color: 'var(--accent-emerald)' }}
                >
                  {csvResult.report.passedRows}
                </div>
              </div>
              <div className="rounded-xl p-3 border" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {copy.csvSection.failedRows}
                </div>
                <div
                  className="text-lg font-bold aid-mono num-tabular"
                  style={{ color: 'var(--accent-crimson)' }}
                >
                  {csvResult.report.failedRows}
                </div>
              </div>
              <div className="rounded-xl p-3 border" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                  {copy.csvSection.avgScore}
                </div>
                <div className="text-lg font-bold aid-mono num-tabular">{csvResult.report.averageScore}/100</div>
              </div>
            </div>

            <div
              data-testid="csv-results-table"
              className="overflow-x-auto rounded-xl border"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <table className="w-full min-w-[660px] text-xs">
                <thead style={{ backgroundColor: 'var(--bg-elevated)' }}>
                  <tr className={locale === 'ar' ? 'text-right' : 'text-left'}>
                    <th className="px-3 py-2.5 font-bold">{copy.csvSection.colFeature}</th>
                    <th className="px-3 py-2.5 font-bold">{copy.csvSection.colSurface}</th>
                    <th className="px-3 py-2.5 font-bold">{copy.csvSection.colMarking}</th>
                    <th className="px-3 py-2.5 font-bold">{copy.csvSection.colExemption}</th>
                    <th className="px-3 py-2.5 font-bold">{copy.csvSection.colStatus}</th>
                    <th className="px-3 py-2.5 font-bold">{copy.csvSection.colScore}</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {csvResult.report.rows.map((row) => (
                    <tr key={`${row.rowNumber}-${row.featureId}`}>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold" dir="auto">
                          {row.featureName}
                        </div>
                        <div className="aid-mono text-[11px]" style={{ color: 'var(--text-secondary)' }} dir="ltr">
                          {row.featureId}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 aid-mono" dir="ltr">
                        {row.surface}
                      </td>
                      <td className="px-3 py-2.5 aid-mono" dir="ltr">
                        {row.machineReadable}
                      </td>
                      <td className="px-3 py-2.5">
                        {row.editorialExemption ? copy.csvSection.yesLabel : copy.csvSection.noLabel}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className="aid-mono font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{
                            backgroundColor:
                              row.status === 'pass'
                                ? 'var(--accent-emerald-soft)'
                                : 'var(--accent-crimson-soft)',
                            color: row.status === 'pass' ? 'var(--accent-emerald)' : 'var(--accent-crimson)',
                          }}
                        >
                          {row.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 aid-mono font-bold num-tabular" dir="ltr">
                        {row.score}/100
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
