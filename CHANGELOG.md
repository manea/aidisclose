# سجل التغييرات — «AIDisclose»

يُوثَّق في هذا الملف كل تغيير برمجي أو معماري في مشروع **«AIDisclose»** (`projects/aidisclose/`).

---

## [0.5.0] — 2026-11-24 — الإطلاق الإنتاجي المفتوح المصدر (`v0.5.0`)

### الإنجاز
- ترقية [`package.json`](package.json) إلى الإصدار الإنتاجي `0.5.0`.
- إضافة رخصة المصدر المفتوح [`LICENSE`](LICENSE) (`MIT`) وسير عمل التحقق التلقائي [`.github/workflows/ci.yml`](.github/workflows/ci.yml) (`Node 22` — `typecheck`, `test`, `build`)، وأرشفة `6` لقطات واجهة مصدّقة في [`docs/screenshots/`](docs/screenshots/)، وإنشاء سكربت التصدير المنقّى [`deploy/export-public-github.sh`](deploy/export-public-github.sh) بضمان عدم تسرب أي معرف خاص (`EXPORT_CLEAN_OK`).
- إطلاق المستودع العام المفتوح المصدر على GitHub برخصة `MIT` عبر **`https://github.com/manea/aidisclose`** مع إصدار `v0.5.0` و**12** وسماً لاكتشاف المستودع والتحقق من خضرة `GitHub Actions CI`.

### التحقق
- `bash -n deploy/*.sh` + فحص الخصوصية `EXPORT_CLEAN_OK`.
- `npm run typecheck` (`0`)، `npm test` (`14/14`)، `npm run build`، و`npm run test:e2e` (`3/3`).

---

## [0.4.0] — 2026-11-24 — المرحلة 4: اختبارات Playwright E2E على :4198 والمراجعة البصرية وحزمة النشر $0

### الإنجاز
- إضافة حزمة اختبارات المتصفح الحقيقي [`tests/e2e/aidisclose.spec.ts`](tests/e2e/aidisclose.spec.ts) على المنفذ `:4198` وتنفيذ **3** اختبارات شاملة عبر سطح المكتب (`1280x800`) والجوال (`390x844`):
  1. افتراض الإنجليزية `EN LTR` بمظهر `Veridian Atelier`، التبديل إلى `AR RTL` بمظهر `Carbon Violet` وحفظ الإعداد بعد إعادة التحميل.
  2. معالجة سيناريو `media-newsroom-gaps` (تفعيل الإفصاح ووسم `C2PA` للتزييف العميق، وتوثيق استثناء التحرير البشري للمادة 50-4 باسم `Camille Laurent`، ورفع تغطية تدريب المادة 4 إلى `100%`، وتدقيق `CSV` وتنزيل `UTF-8 BOM CSV`، وإكمال الضوابط العشرة لبلوغ `100/100`) ثم الختم `AID-YYYY-0001` ببصمة `SHA-256` وفتح مسار المشاركة `/r/AID-YYYY-0001` والتأكد من استمرار التحميل.
  3. التحقق من خلو التخطيط من التمرير الأفقي الزائد وأخطاء وحدة التحكم في `390x844` عبر كل التبويبات وبالعربية `RTL`.
- المراجعة البصرية عبر `6` لقطات `Chrome` حية مع إصلاحات تلميع شملت منع التفاف شارة معرف الميزة (`whitespace-nowrap shrink-0`) على شاشات الجوال، وضبط اتجاه `dir="ltr"` لشارة `0E / 0W`، وإظهار شارة `Art. 50(4) Editorial Review` بوضوح في جدول تقرير الأنظمة، وتوحيد منطق `interactiveObviousException` في عميل CSV مع الخادم.

### التحقق
- `bash -n deploy/*.sh`: نجاح (`0`).
- `npm run typecheck`: `tsc --noEmit` بنجاح (`0` أخطاء).
- `npm test`: اجتياز **14/14** اختبار `Vitest` خلال `395ms`.
- `npm run build`: بناء الإنتاج `2143 modules` في `605ms`.
- `npm run test:e2e`: اجتياز **3/3** اختبارات `Playwright` (`Chrome` حي على `:4198`) خلال `6.6s`.

---

## [0.3.0] — 2026-11-24 — المرحلة 3: واجهة Veridian Atelier & Carbon Violet (EN/AR) ومولد المادة 50 وسجل المادة 4

### الإنجاز
- بناء الواجهة الثنائية اللغة بمظهري **Veridian Atelier & Iris** (`#F8FAFC` + `#4338CA` افتراضياً بالإنجليزية `EN LTR`) و**Carbon Violet** (`#09090F` + `#818CF8` ودعم العربية `AR RTL`) في [`index.html`](index.html) و[`public/favicon.svg`](public/favicon.svg) و[`src/index.css`](src/index.css) و[`src/main.tsx`](src/main.tsx) مع تنسيق الطباعة `A4 PDF`.
- بناء طبقة المساعدات الهجينة في `src/lib/`: [`basePath.ts`](src/lib/basePath.ts) (`window.__AIDISCLOSE_BASE__`), [`i18n.ts`](src/lib/i18n.ts), و[`api.ts`](src/lib/api.ts) للعمل المتزامن مع خادم `Node 22 + SQLite WAL` أو تلقائياً بدون خادم (`$0` عبر `localStorage`) مع التطابق الكامل لختم `AID-YYYY-0001` وبصمة `SHA-256`.
- بناء المكونات التفاعلية في `src/components/` و[`src/App.tsx`](src/App.tsx):
  - [`OrganizationAndFeaturesPanel.tsx`](src/components/OrganizationAndFeaturesPanel.tsx): هوية المؤسسة والملفات المحفوظة، محرر ميزات المادة 50 مع دعم استثناء المسؤولية التحريرية البشرية `Art. 50(4)`، نتائج التدقيق الحية، ومولّد مقتطف `Article 50 HTML + JSON-LD`.
  - [`LiteracyAndBatchPanel.tsx`](src/components/LiteracyAndBatchPanel.tsx): سجل تدريب الموظفين للمادة 4 (`2025-02-02`)، مصفوفة الضوابط العشرة التفاعلية، ومدقق جرد ميزات AI الدفعي (`CSV`) مع تصدير `UTF-8 BOM`.
  - [`DossierPreviewAndPrint.tsx`](src/components/DossierPreviewAndPrint.tsx): بطاقات الجاهزية، الختم المشفر `AID-YYYY-0001 + SHA-256`، النسخ إلى مسودة، تنزيل `article50.html` / `literacy.md` / `export.csv`، بوابة المشاركة `/r/:slugOrNumber`، وتنبيه الإخلاء القانوني الإلزامي.

### التحقق
- `npm run typecheck`: `tsc --noEmit` بنجاح (`0` أخطاء).
- `npm test`: اجتياز **14/14** اختبار `Vitest` خلال `548ms`.
- `npm run build`: بناء الإنتاج `2143 modules` في `687ms`.
- فحص SPA الحي (`PORT=4199 BASE_PATH=/aidisclose`): `UI_SMOKE_OK 0.3.0 /aidisclose SPA=200`.

---

## [0.2.0] — 2026-11-24 — المرحلة 2: الخادم الاختياري Node 22 + SQLite WAL (:4197) وواجهات API وتقارير AID-YYYY-0001

### الإنجاز
- بناء قاعدة البيانات المحلية [`server/db.mjs`](server/db.mjs) باستخدام `node:sqlite` (`WAL`, `synchronous = FULL`, `busy_timeout = 5000`, `foreign_keys = ON`) مع جداول `dossiers` و`org_profiles` و`dossier_counters` و`dossier_events` للترقيم التسلسلي الذري `AID-YYYY-0001` (`BEGIN IMMEDIATE ... COMMIT`) والقفل المشفر `SHA-256` ومنع التعديل/الحذف بعد الاعتماد (`409 DOSSIER_LOCKED` / `ALREADY_LOCKED`).
- بناء خادم Node 22 HTTP وواجهات API في [`server/app.mjs`](server/app.mjs) و[`server/app.d.mts`](server/app.d.mts) و[`server/index.mjs`](server/index.mjs) على المنفذ الافتراضي `:4197`:
  - فحص الصحة والنماذج: `GET /api/health`، `GET /api/presets`.
  - المدققان عديمَا الحالة: `POST /api/audit-transparency` (يرجع تقرير التدقيق وملخص الجاهزية ومقتطف `Article 50 HTML + JSON-LD` وسجل `Article 4 Markdown`) و`POST /api/inventory-audit` (مع ربط `AiDiscloseCoreError` بحالة HTTP `400`).
  - ملفات المؤسسات/الحوكمة القابلة لإعادة الاستخدام: `GET/POST /api/profiles` و`PATCH/DELETE /api/profiles/:id`.
  - دورة حياة الملفات: `GET/POST/PATCH/DELETE /api/dossiers`، `POST /api/dossiers/:id/duplicate`، `POST /api/dossiers/:id/finalize` / `/lock`، والتصدير (`article50.html`, `literacy.md`, `UTF-8 BOM export.csv`, `summary`)، وبوابة المشاركة العامة `GET /api/public/reports/:slugOrNumber` مع عداد المشاهدات.
  - دعم `BASE_PATH` (حقن `window.__AIDISCLOSE_BASE__`) وترويسات الأمان (`nosniff`, `same-origin`, `SAMEORIGIN`).
- إضافة **6** اختبارات تكامل خادم شاملة في [`tests/unit/aidiscloseServer.test.ts`](tests/unit/aidiscloseServer.test.ts) وترقية [`package.json`](package.json) إلى `0.2.0`.

### التحقق
- `npm run typecheck`: `tsc --noEmit` بنجاح دون أخطاء (`0`).
- `npm test`: اجتياز **14/14** اختبار `Vitest` (`8` نواة + `6` تكامل خادم) خلال `566ms`.
- فحص التشغيل الحي لخادم `Node 22` (`PORT=4199 BASE_PATH=/aidisclose`): `SERVER_SMOKE_OK 0.2.0 /aidisclose presets=3`.

---

## [0.1.0] — 2026-11-24 — المرحلة 1: التوثيق وهيكلة المشروع والمحرك الأساسي EU AI Act Art. 4 & 50

### الإنجاز
- توثيق المواصفة المرجعية والبنية التقنية لقانون الذكاء الاصطناعي الأوروبي **`Regulation (EU) 2024/1689`** (المادة **4** السارية منذ `2025-02-02` والمادة **50** السارية منذ `2026-08-02`) في [`research/13-aidisclose-spec-and-architecture.md`](../../research/13-aidisclose-spec-and-architecture.md) مع الإخلاء القانوني الإلزامي (أداة جاهزية هندسية وسجل حوكمة ومولّد إشعارات — وليست استشارة قانونية أو هيئة تقييم مطابقة معتمدة، ولا تمنح شهادة `Annex III` عالية المخاطر، ولا تحقن تواقيع `C2PA` داخل الملفات الثنائية الحية).
- تأسيس الحزمة المستقلة `projects/aidisclose/` على المنفذين `:4197` (الخادم/التطبيق) و`:4198` (`Playwright E2E`) وتثبيت `61` حزمة اعتمادية عبر `npm install --no-audit --no-fund`.
- بناء وحدات النواة الصفرية الاعتماديات المتطابقة بين `Node 22` والمتصفح في `src/core/`:
  - [`src/core/types.ts`](src/core/types.ts): نماذج المؤسسة، جرد ميزات الذكاء الاصطناعي، سجلات تدريب المادة 4، ضوابط اللائحة العشرة، وملف الجاهزية `AID-YYYY-0001`.
  - [`src/core/aiActRules.ts`](src/core/aiActRules.ts): ثوابت اللائحة (`2025-02-02` و`2026-08-02`)، مصفوفة الأسطح الخمسة للمادة 50، طرق الوسم المقروء آلياً، ودوال الزمن والتواصل.
  - [`src/core/disclosureAuditor.ts`](src/core/disclosureAuditor.ts): مدقق الشفافية ومحو الأمية (`auditAiTransparencyAndLiteracy` مع دعم استثناء المسؤولية التحريرية البشرية في المادة 50-4)، ومدقق جرد `CSV` (`auditAiInventoryCsv`)، وحماية حقن الصيغ `sanitizeCsvCell`، وتصدير `UTF-8 BOM + CRLF` (`exportAiInventoryCsv`)، وأخطاء `AiDiscloseCoreError`.
  - [`src/core/noticeAndLiteracy.ts`](src/core/noticeAndLiteracy.ts): الضوابط العشرة `buildDefaultAiActControls`، وملخص الجاهزية `computeAiDiscloseSummary`، ومولّد كتلة `HTML + JSON-LD` الآمنة للمادة 50 (`buildArticle50NoticeHtmlSnippet`)، وسجل المادة 4 (`buildArticle4LiteracyRegisterMarkdown`).
  - [`src/core/dossierDigest.ts`](src/core/dossierDigest.ts): البناء القانوني الحتمي وبصمة `SHA-256` عبر `Web Crypto` (`computeDossierDigestHex`, `sealAiDiscloseDossier`, `verifyDossierIntegrity`, `buildExecutiveSummaryText`).
  - [`src/core/presets.ts`](src/core/presets.ts): 3 سيناريوهات جاهزة (`saas-copilot-compliant`, `media-newsroom-gaps`, `hr-emotion-biometric-drill`).
- كتابة **8** اختبارات وحدة شاملة في [`tests/unit/aidiscloseCore.test.ts`](tests/unit/aidiscloseCore.test.ts).

### التحقق
- `npm run typecheck`: `tsc --noEmit` بنجاح دون أخطاء (`0`).
- `npm test`: اجتياز **8/8** اختبارات `Vitest` خلال `394ms`.
- `Node 22` direct import: نجاح استيراد `./src/core/presets.ts` مباشرة (`NODE22_CORE_PRESETS=3`).
