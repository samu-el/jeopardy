# Ethiopian Budgeting App — Implementation Plan

> Scope note: this document is unrelated to the Jeopardy rebuild that occupies the rest of this
> repository. It lives here only because it was commissioned on this branch.

Working name: **Birr** (placeholder).

A local-first personal finance app for Ethiopia that auto-captures transactions from bank/wallet
SMS and Android notifications, asks the user only for the missing human context (the *reason*),
and tracks income, spending, and budgets across multiple accounts and currencies.

---

## 1. Read this first — four constraints that shape everything

These are not risks to manage later. They decide the architecture.

### 1.1 iOS cannot do automatic capture. At all.

There is no iOS API for reading SMS or another app's notifications. `ILMessageFilterExtension`
only sees messages from *unknown* senders, cannot hand content to your app, and has heavily
restricted network access. Shortcuts' communication triggers do not fire on inbound SMS in a way
that gets the body to a third-party app.

**Consequence:** do not promise "automatic tracking" on iOS. iOS ships later as a companion:
manual entry, share-sheet capture (user long-presses an SMS → Share → your app), CSV/statement
import, and sync from an Android device on the same account. Android is the product.

### 1.2 "Read the installed bank apps directly" is one legitimate technique and one that gets you banned

| Technique | Verdict |
|---|---|
| `NotificationListenerService` — read the notification the bank/wallet app posts | **Use this.** Not a Play "restricted permission"; needs user grant in a system settings screen + a justification in Data Safety. |
| `AccessibilityService` screen-scraping the bank app UI | **Do not.** Play policy limits `AccessibilityService` to accessibility purposes. Using it to harvest financial data is a removal-and-termination offence. |
| Reading the bank app's private storage / root / instrumentation | Not possible on unrooted Android; unshippable. |
| Scraping the bank's web portal with stored credentials | Violates every Ethiopian bank's T&Cs, and you'd be holding customer banking credentials. No. |

So: **SMS + notification listener. Nothing else.**

### 1.3 `READ_SMS` / `RECEIVE_SMS` is allowed for this use case, but approval is a launch gate

Google Play's SMS/Call Log policy has an explicit exception: **"SMS-based money management — for
example, apps that track and manage budget"**, eligible for `READ_SMS`, `RECEIVE_SMS`,
`RECEIVE_MMS`, `RECEIVE_WAP_PUSH`. The spyware policy adds the binding limit: *"personal loans or
budgeting apps may not exfiltrate or share non-financial or personal SMS history of a user."*

Approval requires a Permissions Declaration Form, a demo video of the flow, a prominent in-app
disclosure before the runtime prompt, and a matching Data Safety declaration. Reviewers reject
these routinely on first pass.

**Mitigations, all of which we do:**
- Parse **on-device**. Nothing message-shaped ever leaves the phone. This is also the cheapest
  path through Ethiopia's Personal Data Protection Proclamation 1321/2024 (cross-border transfer
  of personal data needs an adequacy finding, SCCs, or explicit informed consent).
- Prefer `RECEIVE_SMS` (new messages only). Request `READ_SMS` separately and optionally, purely
  for a one-time historical backfill the user explicitly triggers.
- Enforce a **sender allowlist at ingestion**: if the sender is not a known financial institution,
  the body is dropped before it is ever written to disk.
- Ship a **manual-only build** as the Play fallback, and plan for **direct APK distribution**
  (normal and widely accepted in Ethiopia) as the auto-capture channel if the declaration stalls.

### 1.4 Multi-currency in Ethiopia is not a traveller feature

Diaspora remittance, the gap between the NBE indicative rate and the street rate, and USD-priced
goods mean the "custom rate per transaction" requirement is the core of the product, not a
setting. The FX model in §5 is therefore first-class: every transaction freezes the rate it was
valued at, and the user's own rate always beats any API.

---

## 2. Product scope

### v1 (must ship)
- Multiple accounts: bank, mobile wallet, cash, credit/loan. Manual balance for cash.
- Automatic capture from SMS + notifications → **Inbox of pending transactions**. Nothing posts silently.
- One-tap confirm; prompt for reason/category only when it isn't already known.
- Manual transaction entry that is genuinely fast (≤3 taps for a repeat expense).
- Categories (tree, editable), notes, counterparty, attachments (photo of receipt).
- Transfer detection — moving CBE → telebirr must not read as income + expense.
- Budgets: per category and per account, monthly / weekly / custom period, rollover, alerts at 50/80/100%.
- Reports: cash-flow, category breakdown, account balances, month-over-month.
- Multi-currency per §5, including per-transaction and global manual rates.
- Offline-first. Every feature works with the radio off.
- Amharic + English. Gregorian **and** Ethiopian calendar (13-month budget cycles).
- Local encrypted backup + export (CSV, JSON).

### v1.1 – v2
- Cloud sync + multi-device, shared/household wallets.
- Recurring transaction & subscription detection.
- Balance reconciliation from SMS-reported balances (see §4.6) — a real differentiator.
- Savings goals, debt tracking (equb/iqqub and iddir/idir handling is worth a dedicated model).
- Statement import (CBE PDF/Excel statements), receipt OCR.
- iOS companion.

### Explicitly out
- Payments, transfers, or anything that moves money. This is read-only bookkeeping. Moving money
  means an NBE payment-instrument-issuer licence.
- Credit scoring or lending, now or later, off this data.

---

## 3. Technology choices

| Layer | Choice | Why |
|---|---|---|
| Android app | **Kotlin + Jetpack Compose**, native | Capture depends on `BroadcastReceiver`, `NotificationListenerService`, foreground services, Doze/OEM battery-killer survival. Native removes a whole class of plugin-bridge failures. Small APK matters on metered data. Target minSdk 24, tested on Android Go / Tecno / Infinix / Xiaomi. |
| Local DB | **Room + SQLCipher** | Encrypted at rest, key in Android Keystore. |
| Local money math | `Long` minor units + `BigDecimal` for FX only | Never `Double`. |
| Rule packs | Versioned JSON, bundled + remotely refreshable | Bank SMS wording changes without notice; a rule fix must not require a Play release. |
| Backend (phase 4) | Kotlin/Ktor or NestJS + **Postgres** | Sync, rule-pack CDN, FX cache proxy, entitlements. Nothing else. |
| FX | NBE indicative rate + a general FX API, both cached by date | See §5.4. |
| Analytics | Self-hosted (PostHog/Countly) with a hard scrubber | No third-party SDK is allowed to see transaction or message data. |
| iOS (phase 5) | SwiftUI, or Compose Multiplatform for shared domain | Decide at phase 5 with the domain layer already isolated. |

*Alternative considered:* Flutter with platform channels for capture. Viable, and gets iOS parity
sooner, at the cost of a bridge in the most failure-prone part of the system. Take it only if the
team is already Flutter-native.

---

## 4. The capture pipeline — the actual hard part

```
SmsReceiver (RECEIVE_SMS)  ─┐
NotificationListener       ─┤→ Ingest gate ─→ RawMessage ─→ Dedupe ─→ Parser ─→ Draft
Share-sheet / manual paste ─┤     (sender      (encrypted,   (SMS vs   (rule    (pending
Statement import           ─┘   allowlist)     TTL 30d)      notif)    pack)     txn)
                                                                                    │
                                          Inbox ←── Enrich (transfer pairing, ──────┘
                                            │        category memory, FX)
                                            ↓
                                    User confirms → posted Transaction
```

### 4.1 Ingest gate
A message is admitted only if the sender ID (SMS) or package name (notification) matches the
institution registry. Everything else is discarded in memory. This is the single most important
line of code for both Play review and user trust.

### 4.2 Deduplication
The same transaction typically arrives twice — once as an SMS from `CBE`, once as a push from the
CBE app. Dedupe key: `(normalized amount, direction, account, transaction reference)` within a
±10-minute window; fall back to a fuzzy hash of the normalized body when there is no reference
number. Prefer the source with the higher field yield.

### 4.3 Rule packs
One pack per institution, versioned, signed, hot-updatable:

```jsonc
{
  "institution": "cbe",
  "version": 14,
  "senders": ["CBE", "CBE-Ethiopia", "127"],
  "packages": ["com.combanketh.mobilebanking"],
  "rules": [
    {
      "id": "cbe.credit.transfer.v3",
      "direction": "credit",
      "pattern": "Dear \\S+ ?\\S* your Account (?<acct>\\d?\\*+\\d+) has been Credited with (?<cur>ETB|Br) (?<amt>[\\d,]+\\.\\d{2}) .*?from (?<counterparty>.+?)\\.? .*?Your Current Balance is (?<bal>[\\d,]+\\.\\d{2})",
      "postprocess": ["etAmount", "titleCase:counterparty"],
      "confidence": 0.95
    }
  ]
}
```

Post-processors must handle: `ETB` / `Br` / `ብር`, thousands separators, Amharic digits, both
`dd/MM/yyyy` and Ethiopian-calendar dates, service fees and 15% VAT stated on a separate line, and
masked account numbers.

### 4.4 Confidence & fallback
Every parse yields a confidence score. Below threshold, a generic "money-shaped message" heuristic
(currency token + amount + credit/debit verb) produces a low-confidence draft that is flagged in
the Inbox and, with consent, queued for the anonymised contribution flow (§4.7). Never guess
silently.

### 4.5 The "reason" prompt
This is the product's signature interaction, so it has to be cheap:

1. Known counterparty (confirmed ≥2 times) → auto-category applied, card shows **Confirm**. One tap.
2. New counterparty → card asks for category + optional note, with 3 suggested categories ranked
   by (merchant-name similarity, amount band, time of day) and a recents row.
3. Amount is a >2σ outlier for that category → always ask, even if the merchant is known.
4. Batch mode: select several inbox items → apply one category.
5. A "remember this" toggle writes an auto-categorization rule.

Notification action buttons let the user categorize straight from the shade without opening the app.

### 4.6 Balance reconciliation (differentiator)
Most Ethiopian bank SMS state the resulting balance. Store `balanceAfter` on every parsed
transaction. When the reported balance diverges from the app's computed balance, surface a
**"Br X unaccounted between 3:10pm and 6:40pm"** card and offer to insert an adjusting entry. This
catches ATM withdrawals, POS purchases that send no SMS, and messages that arrived while the
listener was dead. It converts the system's inevitable gaps into a visible, correctable state
instead of silent drift.

### 4.7 Rule-pack bootstrapping — a data problem, not a code problem
You cannot write these regexes from an office. Plan for it explicitly:
- Internal collection build installed on staff/friendly-tester phones across as many institutions
  as possible, exporting redacted corpora.
- In-app **opt-in** "help improve parsing" flow: shows the exact redacted text (account numbers,
  names, and optionally amounts masked) and requires per-message consent before upload.
- An internal rules authoring tool with a **golden corpus regression suite** — every fixed message
  becomes a permanent test case. Target: 100% pass on the golden corpus in CI before any pack ship.
- Budget one engineer roughly half-time on rule maintenance, indefinitely.

### 4.8 Reliability on cheap Android
Non-negotiable engineering tasks, each with its own QA pass:
- Foreground service with a persistent low-priority notification for the listener; `WorkManager`
  watchdog that restarts it and records gaps.
- Guided flow to disable battery optimization, plus OEM-specific autostart deep links (Xiaomi,
  Transsion/Tecno/Infinix, Oppo, Vivo, Huawei) — these OEMs dominate the Ethiopian market and kill
  background services aggressively.
- A visible **capture health indicator**: "last message seen 4h ago" with a repair action.
- On listener reconnect, backfill from SMS (if `READ_SMS` was granted) to close the gap.

### 4.9 Institution coverage
P0 (covers the large majority of users): **CBE, telebirr, CBE Birr, M-PESA Ethiopia, Awash,
Dashen (+Amole), Bank of Abyssinia, Cooperative Bank of Oromia (+Coopay/Ebirr)**.
P1: Wegagen, Nib, Zemen, Hibret/United, Oromia Bank, Enat, Abay, Berhan, Bunna, Siinqee, Ahadu,
Tsehay, Goh Betoch, ZamZam, Hijra, Shabelle, Gadaa, Amhara Bank, Sinqee, Global Bank.
Each institution needs credit, debit, transfer-out, transfer-in, ATM, POS, fee/charge, reversal,
and airtime/utility-payment variants.

---

## 5. Multi-currency & FX model

### 5.1 Storage rule
Every transaction persists **both** sides plus provenance, and they are **frozen at confirmation
time**:

```
amountMinor        1500_00      // native
currency           "USD"
baseAmountMinor    18750_000    // in the user's base currency at time of confirm
baseCurrency       "ETB"
fxRate             125.00
fxRateSource       MANUAL_TXN | MANUAL_GLOBAL | API_NBE | API_MARKET | INHERITED_ACCOUNT | FALLBACK_STALE
fxRateAsOf         2026-09-03
```

Historical reports must never change because a rate moved. Re-valuation is an explicit,
audit-logged user action ("re-value this month at today's rate"), never automatic.

### 5.2 Rate resolution order
1. Rate typed on the transaction itself.
2. User's global override for that pair, honouring effective-date ranges — this is exactly how you
   model a parallel-market rate that the user updates weekly.
3. Cached provider rate for the transaction's own date.
4. Nearest earlier cached rate → transaction is tagged `FALLBACK_STALE` and shown with a warning chip.
5. Nothing available → block confirmation and ask, rather than silently writing 1:1.

### 5.3 Global rate settings UI
- Base/reporting currency.
- Per-pair table: `USD→ETB`, `EUR→ETB`, `AED→ETB`, `SAR→ETB` (remittance corridors), each with
  "official", "my rate", effective-from date, and history.
- Reports can be toggled between official and user rates; the difference is itself a useful view.

### 5.4 Providers
- **NBE indicative daily rate** (weekdays only) — the official/compliance number. Scraped or via a
  mirror API; treat availability as unreliable and cache aggressively.
- A general FX API (`frankfurter.app`, `open.er-api.com`, or `exchangerate.host`) for cross rates
  and non-ETB pairs.
- Both proxied through our backend once it exists, so keys stay server-side and one daily fetch
  serves all users; the client falls back to direct calls plus its own cache.
- Rates stored date-keyed: `(base, quote, date, rate, source)`. The app is fully usable offline off
  this table.

### 5.5 Budgets under multi-currency
A budget is denominated in one currency. A transaction consumes budget using its **frozen** base
amount converted into the budget currency. Multi-currency budget periods display a small
"includes N foreign-currency transactions" note so the number is never mysterious.

---

## 6. Data model (core tables)

```
Institution(id, name, nameAm, type, senderIds[], packageNames[], logo, rulePackVersion)
Account(id, institutionId?, name, type{BANK,WALLET,CASH,CREDIT}, currency,
        openingBalanceMinor, currentBalanceMinor, lastReportedBalanceMinor, lastReportedAt,
        maskedNumber, matchHints, archived, sortOrder)
RawMessage(id, source{SMS,NOTIFICATION,SHARE,IMPORT}, senderOrPackage, bodyEnc, receivedAt,
           contentHash, parsedStatus, ruleId?, expiresAt)
Transaction(id, accountId, direction{DEBIT,CREDIT}, amountMinor, currency,
            baseAmountMinor, baseCurrency, fxRate, fxRateSource, fxRateAsOf,
            occurredAt, bookedAt, categoryId?, note, counterparty, referenceNo,
            feeMinor, vatMinor, balanceAfterMinor?, attachmentIds[],
            status{PENDING,CONFIRMED,IGNORED,ADJUSTMENT}, confidence,
            rawMessageId?, transferGroupId?, createdBy{AUTO,MANUAL,IMPORT}, updatedAt, deletedAt)
TransferGroup(id, fromTxnId, toTxnId, feeMinor, detectedAutomatically)
Category(id, parentId?, name, nameAm, icon, color, kind{EXPENSE,INCOME}, isSystem)
CategoryRule(id, matchType{COUNTERPARTY,REGEX,AMOUNT_RANGE,ACCOUNT}, matchValue, categoryId,
             confidence, hitCount)
Budget(id, name, scope{CATEGORY,ACCOUNT,ALL}, scopeId?, amountMinor, currency,
       period{WEEK,MONTH,ET_MONTH,CUSTOM}, startsOn, rollover, alertThresholds[])
FxRate(base, quote, date, rate, source)  -- PK (base, quote, date, source)
FxOverride(id, base, quote, rate, effectiveFrom, effectiveTo?, note)
```

Sync-ready from day one: every row carries `updatedAt` and soft-delete, IDs are client-generated
UUIDv7, and conflict resolution is last-writer-wins per field with a local change journal.

---

## 7. Privacy, security, compliance

- **On-device parsing only.** Message bodies never sync, never appear in logs, never reach crash
  or analytics SDKs. A build-time lint rule fails CI if a message field is passed to any logger.
- **Retention.** Raw bodies encrypted, default TTL 30 days, user-configurable down to "delete
  immediately after parse", with a one-tap purge.
- **Disclosure.** A full-screen prominent disclosure ahead of the runtime SMS prompt, exactly as
  Play requires: what is read, why, that non-financial SMS is discarded, that nothing is uploaded.
- **Data Safety form** must match reality field-for-field.
- **Ethiopian PDP Proclamation 1321/2024**: publish an Amharic + English privacy notice, name a
  DPO, register as a controller, obtain specific and unambiguous consent, define a breach process,
  and — if any server ever holds personal data outside Ethiopia — rely on explicit informed consent
  or SCCs. Local-first design keeps this small; keep it that way.
- **Device security:** SQLCipher, Keystore-held key, biometric app-lock, `FLAG_SECURE` on financial
  screens, no plaintext export without an explicit confirm.
- **Scope discipline:** no contacts, no location, no call log, no device identifiers beyond an
  install-scoped ID.

---

## 8. Delivery plan

Assumes 2 Android engineers, 1 designer, 1 part-time backend, 1 person on rule data/QA.

| Phase | Weeks | Deliverable | Exit criteria |
|---|---|---|---|
| **0 — Corpus & feasibility** | 1–3 | Message collection build; ≥500 real messages across the 8 P0 institutions; rule prototypes; Play declaration draft submitted early on a stub build to learn review latency | ≥90% parse accuracy on a held-out set for the P0 8 |
| **1 — Core ledger (manual only)** | 3–8 | Accounts, transactions, categories, budgets, reports, multi-currency §5 in full, Amharic + Ethiopian calendar, local encrypted DB, export | Shippable as a standalone manual budgeting app. Play-safe with zero SMS permissions. |
| **2 — Auto-capture** | 8–14 | SMS receiver, notification listener, ingest gate, dedupe, rule-pack engine + hot updates, Inbox, reason prompt, transfer pairing, category memory, capture-health + OEM battery flows | Closed beta: ≥85% of a tester's real transactions captured, <2% false positives, 7-day listener uptime >95% |
| **3 — Reconciliation & polish** | 14–18 | Balance reconciliation, recurring detection, statement import, onboarding, contribution flow, perf on Android Go | Public Play release (or APK channel if the declaration is still pending) |
| **4 — Backend & sync** | 18–26 | Postgres + sync engine, multi-device, shared wallets, rule-pack CDN, FX proxy, entitlements, subscription billing | Paid tier live |
| **5 — iOS companion** | 26–34 | SwiftUI app: manual, share-sheet capture, import, full sync | Feature parity minus auto-capture, stated plainly in the store listing |

Ongoing from phase 2: rule-pack maintenance, forever.

---

## 9. Monetization

Free: unlimited manual entry, 2 accounts of auto-capture, 3 budgets, core reports.
Premium (~ETB 150–250/month or a discounted year): unlimited accounts and budgets, sync,
shared wallets, unlimited history, export, custom FX table, receipt attachments.

**Billing is a real problem.** Google Play Billing is impractical for most Ethiopian users (card
penetration, FX controls). Plan for local rails — **telebirr, Chapa, ArifPay, or SantimPay** — via
a web checkout, with Play Billing offered where it works. Note that Play's payments policy requires
Play Billing for in-app digital goods in most markets; validate the Ethiopia carve-out and the
external-offer rules before building, and be prepared to sell the subscription only outside the app.

---

## 10. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Play rejects the SMS declaration | Kills the headline feature on Play | Submit in phase 0, not at launch. Manual-only Play build + APK distribution channel ready. Notification listener covers users with the bank apps installed even without SMS. |
| Banks change SMS wording | Silent capture failure | Hot-updatable rule packs, golden corpus CI, capture-health monitoring, in-app "this wasn't parsed" report |
| OEM battery killers stop the listener | Silent gaps | Foreground service + watchdog, OEM autostart guidance, gap detection, SMS backfill, balance reconciliation |
| Double-counting SMS + notification | Wrong balances, lost trust | Dedupe (§4.2) with an explicit test matrix per institution |
| Wrong auto-categorization | Users abandon | Nothing posts without confirmation; every automation is reversible and visible |
| A bank objects to the app | Legal noise | Read-only, on-device, user's own messages, no credentials, no scraping of bank systems. Prepare the position paper in advance. |
| Corpus collection stalls | Phase 2 slips | Start in week 1; incentivize testers; the contribution flow must ship with the beta |
| iOS users expect auto-capture | Bad reviews | Say it plainly in the listing and in onboarding |

---

## 11. Immediate next steps

1. Register the Play developer account and open the Permissions Declaration now — treat review
   latency as the project's critical path.
2. Build the throwaway message-collection app; get it onto 20–30 phones covering the P0 eight.
3. Lock the data model in §6 and the FX semantics in §5 — they are the expensive things to change later.
4. Design the Inbox + reason prompt first. If confirming a transaction is not effortless, none of
   the parsing work matters.
5. Decide Kotlin vs Flutter (§3) before writing any UI.
