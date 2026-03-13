# Case Intelligence Suite

An accuracy-first, management-ready operational reporting dashboard for weekly logistics case data. Upload one Excel file — the app analyses every row and returns trustworthy, explainable output.

---

## What it does

The dashboard turns a weekly case export into structured operational insight:

- **Issue Intelligence** — top issue categories, preventable vs non-preventable split, trend over time, hours-lost estimate
- **Customer Burden** — workload per account, missing load-ref offenders, risk scoring, preventable-case rate
- **Transporter Performance** — delay counts, punctuality scores, escalation watchlist
- **Depot & Terminal** — case volume per inland depot and deepsea terminal
- **Area Hotspots** — ZIP-derived routing clusters (Mainz/Germersheim, Duisburg/Rhine-Ruhr)
- **Week-on-Week** — spike detection and trend direction per issue, customer, transporter, and area
- **Evidence Drilldown** — click any metric to see all underlying cases: Case Number, Issue State, Subject, Date, Customer, Transporter, Load Ref, Container, Confidence
- **Full Export** — download all matching cases for any category, customer, transporter, or area to Excel (.xlsx)

---

## Expected Excel fields

The app reads the following columns by name (case-insensitive, multiple aliases supported):

| Column | Aliases | Notes |
|--------|---------|-------|
| Case Number | Case No, Case ID, Ticket Number, Incident Number | Used as evidence key in drilldown |
| Account Name | Customer, Client, Klant, Debtor | Entity extraction source |
| Subject | Title, Case Subject | Primary issue signal (weight 0.88) |
| Description | Body, Case Description, Email Body, Comments | Strongest issue signal (weight 1.00) |
| ISR Details | ISR, Internal Details | Internal workflow indicator (weight 0.78) |
| Date/Time Opened | Created Date, Datum, Opened | Week-key computation |
| Closed Week | Closed Date | Optional — used for week-key if Date not present |
| Transporter | Haulier, Carrier, Transport Company | Entity extraction source |
| ZIP / Postcode | Post Code, Postal Code, Zipcode | Area routing |
| Area / Region | Zone, Hub | Overrides ZIP-derived area if present |
| Booking | Booking Ref, BKG, Reservation | Reference extraction |
| Category | Type, Case Type, Issue Type | Supporting issue signal (weight 0.70) |

Only **one file per upload** is required. No supplementary transporter, depot, or ZIP mapping files are needed.

---

## Classification model

Every row is classified in a fixed pipeline:

1. **Normalize** all text fields (whitespace, line endings, separators)
2. **Extract entities** — match Account Name, Transporter, Subject, Description against built-in dictionaries (transporters, depots, deepsea terminals, carriers)
3. **Infer customer** — only after blocking all operational entities
4. **Extract references** — load ref, booking ref, container number, customs/MRN/T1 refs, ZIP
5. **Map ZIP to area** — field-priority order: Subject → Description → ISR Details
6. **Classify issue** — Description is source of truth (weight 1.00); Subject is secondary signal (weight 0.88); ISR Details supporting (weight 0.78); Category (weight 0.70)
7. **Detect issue intent** — missing / provided / amended / delayed / escalated / informational — detected per topic in a 280-char context window around each keyword
8. **Contradiction check** — if Description provides a reference, it overrides any "missing" signal from Subject; if Description classifies a different topic from Subject at ≥ 0.55 confidence, Description wins
9. **Assign confidence** — strong signal ≥ 0.85, weak signal 0.55–0.70, intent bonus +0.10
10. **Recovery pass** — fallback rules and operational clue scan before assigning Other
11. **Aggregate** — clean entity gates applied before chart output; Case Number preserved as primary evidence key

### Issue families vs issue state

Every case carries both a **topic** (what the case is about) and a **state** (what is happening):

| State | Example |
|-------|---------|
| `missing` | "Please provide load ref" |
| `provided` | "Please see below load ref BKG123" |
| `amended` | "Please correct the booking address" |
| `delayed` | "Driver still not arrived" |
| `escalated` | "This is unacceptable, escalating to management" |
| `informational` | "Just to confirm — transport booked" |

Load reference examples:

| Email body | Final category |
|-----------|----------------|
| `"Please provide load ref"` | Missing Load Reference |
| `"Please see below load ref BKG123"` | Reference Update / Info Provided |
| `"Correct ref is BKG456"` | Reference Update / Info Provided |
| `"Please send us the transport order"` | Transport Order Request |

### Issue families

| ID | Label | Preventable |
|----|-------|-------------|
| `load_ref` | Missing Load Reference | Yes |
| `ref_provided` | Reference Update / Info Provided | No |
| `transport_order` | Transport Order Request | Yes |
| `customs` | Customs / Documentation | Yes |
| `portbase` | Portbase / Port Notification | Yes |
| `bl` | Bill of Lading (B/L) | No |
| `t1` | T1 / Transit Document | Yes |
| `delay` | Delay / Not On Time | No |
| `closing_time` | Closing Time / Cutoff | Yes |
| `amendment` | Amendment / Correction | Yes |
| `waiting_time` | Waiting Time / Demurrage | No |
| `rate` | Rate / Pricing / Invoice | No |
| `damage` | Damage / Loss / Claim | No |
| `equipment` | Container / Equipment | No |
| `equipment_release` | Equipment Release / Acceptance | No |
| `tracking` | Tracking / Visibility | Yes |
| `communication` | Communication / Escalation | Yes |
| `scheduling` | Scheduling / Closing / Allocation | Yes |
| `pickup_delivery` | Pickup / Delivery Planning | Yes |
| `capacity` | Capacity / Feasibility | No |
| `other` | Other / Unclassified | — |

`other` is a last-resort failure state. The engine runs a recovery pass before assigning it.

`transport_order` captures cases requesting or providing a transport instruction document (TRO) sent to the haulier. It is distinct from a missing load reference number — cases like "Please send us the transport order for BL MAEU262065895" belong here, not under `load_ref`.

---

## Customer vs transporter rules

The entity model enforces strict role separation. An entity may not appear in more than one reporting bucket based on its type.

### Entity type priority (highest wins)

1. `deepsea_terminal` — ECT Delta, APM Terminals, RWG, EUROMAX, MSC PSA, DP World Antwerp, etc.
2. `depot` — Germersheim DPW, HP Duisburg, Contargo, Mainz Frankenbach, HGK, etc.
3. `transporter` — approved inland hauliers (Optimodal, KIEM, DCH, H&S Andernach, etc.)
4. `carrier` — KNOWN_CARRIERS (DB Schenker, DHL, DSV, XPO, Geodis, etc.)
5. `customer` — inferred after all above are excluded

### Customer acceptance rules

A name appears in Customer Burden only if it passes ALL of:

1. **Not blocked** — not an operational entity, not a carrier, not an internal ISR label, not a junk placeholder, not an IBAN or alphanumeric reference code
2. **Positive gate** — looks like a real company name (has a recognised legal suffix, OR has at least one word that is not in the logistics junk vocabulary)

A final pre-render filter re-applies both gates before the Customer Burden chart is rendered. Use `auditCustomerAcceptance(name)` from `src/lib/validators.ts` to inspect why a specific name was accepted or excluded.

### Why a name might be excluded as unresolved

- The Account Name column contains a depot, terminal, transporter, or carrier name
- The Account Name matches an internal ISR / Maersk address-book pattern
- The name consists only of generic logistics vocabulary (e.g. "Logistics Service", "Transport GmbH" after stripping suffix)
- The name appears only once with low classification confidence and no company structure

Excluded cases are counted separately as "unresolved" and shown in the Customer Resolution Coverage panel. They can be investigated in the Case Explorer.

---

## ISR vs external logic

Cases are classified as **internal ISR** if either:

- The `ISR Details` field contains substantive content (> 5 characters), OR
- The Account Name matches a known Maersk internal address-book pattern (e.g. "Internal Global Address Book", "Global Address Book Europe", "MSL - Hamburg")

ISR cases are counted separately from external customer cases. They appear in the ISR vs External panel but are excluded from Customer Burden and Transporter Performance charts.

---

## Area hotspot model

Area assignment priority:

1. `Area` / `Region` column in the Excel (overrides everything)
2. ZIP extracted from **Subject** line
3. ZIP extracted from **Description** / body
4. ZIP extracted from **ISR Details**

ZIP codes are mapped to routing clusters using built-in DE/NL/BE rules. Only two operational inland clusters are shown in the Area Hotspot chart:

- **Mainz / Germersheim** — DE ZIPs 35xxx–39xxx, 55xxx, 60xxx–89xxx, 95xxx–97xxx
- **Duisburg / Rhine-Ruhr** — remaining DE ZIPs, Rhine-Ruhr corridor

Rotterdam and Antwerp are also retained for deepsea terminal context. All other geographic labels (NL/BE cities, Hamburg, Frankfurt, etc.) are suppressed from the chart.

---

## Evidence drilldown

Every aggregated count in the dashboard has a **View N** button that opens an evidence panel showing the underlying cases. Fields shown:

- Case Number (linked to the source row)
- Booking Reference
- Primary Issue
- Subject (truncated to 120 chars)
- Date
- Customer
- Transporter
- Load Reference
- Container Number
- Classification Confidence (colour-coded: green ≥ 70%, amber ≥ 50%, red < 50%)

Up to 10 cases are shown, sorted by confidence descending. Cases shown always match the exact filter of the group (same customer, or same transporter, or same issue).

---

## Tech stack

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS** for styling
- **Recharts** for charts
- **XLSX** (SheetJS) for Excel parsing
- All classification logic runs client-side — no server required

## Development

```bash
npm install
npm run dev      # development server
npm run build    # production build
npm run lint     # ESLint
```

## Key source files

| File | Purpose |
|------|---------|
| `src/config/referenceData.ts` | Entity dictionaries, customer gates, area allowlist, output validation |
| `src/config/zipAreaRules.ts` | ZIP → area mapping rules |
| `src/lib/classifyCase.ts` | Per-row classification pipeline; confidence scoring constants |
| `src/lib/issueRules.ts` | Intent-aware topic rules; confidence constants (STRONG_SIGNAL_CONFIDENCE etc.) |
| `src/lib/fallbackIssueRules.ts` | Recovery pass before Other |
| `src/lib/loadRefGuards.ts` | Shared provided-reference detection patterns (textProvidesRef, PROVIDED_REF_PATTERNS) |
| `src/lib/validators.ts` | Testable helpers: drilldown integrity, false-positive detection, customer audit |
| `src/lib/entityExtraction.ts` | Entity candidate extraction |
| `src/lib/textNormalization.ts` | Text cleaning, legal suffix stripping, company name structure check |
| `src/lib/analyzeData.ts` | Aggregation — all dashboard outputs |
| `src/lib/taxonomy.ts` | Issue taxonomy with hours and preventable flags |
| `src/lib/parseFile.ts` | Excel column mapping and normalisation |
| `src/components/ui/ExampleCasesPanel.tsx` | Evidence drilldown modal |

## Data integrity rules

### Week range
The reported period is derived **strictly from the uploaded Excel data**. Only weeks with at least 2 records contribute to the displayed range — single-row outliers from Excel date-parsing errors cannot extend the period. Charts use the last 16 weeks for display. The `weekCount` field in the summary reflects the number of data-dense weeks, not the raw ISO week span.

### Missing Load Reference precision
A case is classified as *Missing Load Reference* only if it passes a 5-step gate:

1. **Explicit missing phrase** in description/ISR (`"please provide load ref"`, `"load ref missing"`, etc.) → accept immediately
2. **Body intent** — if description is substantive and classifies as billing, planning, or routing → reject
3. **Planning blocklist** — demurrage, rate, feasibility, routing, capacity, etc. → reject
4. **Proximity check** — `"load ref"` near a missing/request signal within 5 tokens → accept
5. **Subject-level fallback** — subject contains missing indicator; subject has reduced weight (0.30 vs 0.88) → accept cautiously

If the gate rejects, `load_ref` is removed from **all** candidate issue lists — it cannot re-enter via fallback, description-override, or recovery pass. `missingLoadRef` counts in Customer Burden and Load Reference Intelligence use only `primaryIssue === 'load_ref'` rows (not secondary matches), keeping totals consistent.

### Customer Burden cleanliness
A name appears in Customer Burden only after passing three gates in sequence:

1. **Not a known operational entity** — transporter, depot, deepsea terminal, carrier, ocean carrier, or port operator (Hutchison Ports, APM Terminals, DP World, etc.)
2. **Not an internal/junk label** — ISR address-book patterns, service-role labels (`Service Representative Dry`, `Service Neuss`, `Service Intermodal Rotterdam`), single-word operational vocabulary, sentence fragments, generic placeholders
3. **Positive company name** — has a recognised legal suffix (GmbH, B.V., Ltd, etc.) or at least one non-junk word

The same dual gate is applied to the Load Reference Intelligence offender list and to issue drilldown customer breakdowns.

---

## Output validation

In development mode (`npm run dev`), the app runs structural checks after every analysis and logs any violations to the browser console.

### Row-level classification checks

| Rule | Description |
|------|-------------|
| `DATE_OUTLIER_WEEKS` | Weeks with < 2 records excluded from reported period (likely date-parsing errors) |
| `LOAD_REF_FALSE_POSITIVE` | Case classified as Missing Load Ref but description contains a provided-ref pattern |
| `TRANSPORT_ORDER_AS_LOAD_REF` | Case with "transport order" phrasing that landed in load_ref |
| `LOAD_REF_TOTAL_MISMATCH` | `loadRefIntelligence.totalMissing` does not equal `records.filter(r => r.primaryIssue === 'load_ref')` |
| `SERVICE_LABEL_IN_LOAD_REF_INTELLIGENCE` | Service/internal label in Load Ref top offenders list |
| `NO_CASE_NUMBERS_IN_DATASET` | No Case Number column found — drilldown links will show "—" |
| `LOW_CASE_NUMBER_COVERAGE` | Fewer than 50% of records have a Case Number |

### Aggregation output guards (`validateOutputGuards`)

| Rule | Severity | Description |
|------|----------|-------------|
| `OPERATIONAL_ENTITY_IN_CUSTOMER_BURDEN` | ERROR | Depot/terminal/approved haulier appeared in Customer Burden |
| `ISR_LABEL_IN_CUSTOMER_BURDEN` | ERROR | Internal ISR/Maersk address-book entry in Customer Burden |
| `CARRIER_IN_CUSTOMER_BURDEN` | ERROR | Recognised carrier (DB Schenker, DHL, etc.) in Customer Burden |
| `OCEAN_CARRIER_IN_CUSTOMER_BURDEN` | ERROR | Ocean carrier name (MSC, Maersk, etc.) in Customer Burden |
| `JUNK_LABEL_IN_CUSTOMER_BURDEN` | ERROR | Generic junk placeholder in Customer Burden |
| `NON_COMPANY_NAME_IN_CUSTOMER_BURDEN` | ERROR | Value failed positive company name gate |
| `NON_APPROVED_IN_TRANSPORTER` | ERROR | Unapproved entity in Transporter Performance |
| `DISALLOWED_AREA_IN_HOTSPOTS` | ERROR | Non-operational area label in Area Hotspot chart |
| `NAMED_ENTITY_IN_CUSTOMER_BURDEN` | ERROR | Hardcoded entity (Maersk, MSC, etc.) in Customer Burden |

### Testable helpers

`src/lib/validators.ts` exports pure functions for each key invariant:

```ts
isLoadRefFalsePositive(primaryIssue, issueState, description)
detectsTransportOrder(text)
validateDrilldownIntegrity(records, expectedCategory)
validateCaseNumberPreservation(records)
auditCustomerAcceptance(name)
auditHotspotLabels(labels)
```
