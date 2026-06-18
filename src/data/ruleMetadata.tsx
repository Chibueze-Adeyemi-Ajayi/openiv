/**
 * ruleMetadata.tsx
 *
 * All static display metadata for detection rules.
 * Extracted from ThresholdsPage.tsx — was bloating the page component with
 * ~370 lines of strings/config that never change at runtime.
 *
 * Only import what you need; tree-shaking will drop the rest.
 */

import React from 'react'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import SmartphoneOutlinedIcon from '@mui/icons-material/SmartphoneOutlined'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import { colorPalette } from '@/theme'
import type { ThresholdRule } from '@/api/thresholds'

// ── Tag colours for AML / Fraud / KYC chips ──────────────────────────────────

export const tagColors: Record<string, string> = {
  AML:   colorPalette.primary,
  Fraud: '#dc2626',
  KYC:   '#f59e0b',
}

// ── Threshold value formatter ─────────────────────────────────────────────────

export function fmtThreshold(rule: ThresholdRule, value: number): string {
  if (rule.unit === '₦') {
    return value >= 1_000_000
      ? `₦${(value / 1_000_000).toFixed(1)}M`
      : `₦${(value / 1_000).toFixed(0)}k`
  }
  if (rule.ruleId === 'velocity-spike') return `+${value - 100}% vs yesterday`
  return String(value)
}

// ── Behavioural rule sub-category config (icon + colour) ─────────────────────

export const categoryConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  Geo:      { color: '#7c3aed', icon: <LocationOnOutlinedIcon sx={{ fontSize: '1rem' }} /> },
  Device:   { color: '#0891b2', icon: <SmartphoneOutlinedIcon sx={{ fontSize: '1rem' }} /> },
  Velocity: { color: '#ea580c', icon: <ScheduleRoundedIcon    sx={{ fontSize: '1rem' }} /> },
  Network:  { color: '#dc2626', icon: <GroupsOutlinedIcon     sx={{ fontSize: '1rem' }} /> },
  Temporal: { color: colorPalette.primary, icon: <ScheduleRoundedIcon sx={{ fontSize: '1rem' }} /> },
}

export const severityConfig: Record<string, { bg: string; color: string }> = {
  critical: { bg: '#fef2f2', color: '#dc2626' },
  high:     { bg: '#fffbeb', color: '#f59e0b' },
  medium:   { bg: `${colorPalette.primary}10`, color: colorPalette.primary },
}

// ── Behavioural pattern plain-English copy ────────────────────────────────────

export const patternLanguage: Record<string, {
  tagline: string
  whyItMatters: string
  recommendation: string
}> = {
  'pat-1': {
    tagline: 'Catches multiple unrelated accounts all controlled from the same internet address — the hallmark of a money mule network.',
    whyItMatters: 'Money mule networks are groups of people (often recruited unknowingly) who receive stolen funds and forward them to criminals. The organiser controls many accounts but initiates transfers from one location. When several unrelated accounts all wire money from the same IP block within minutes of each other, that is almost certainly a coordinated mule operation — not a coincidence.',
    recommendation: 'Four accounts within 18 minutes is a tight, conservative starting point. If you serve business centres, coworking spaces, or markets where many customers share the same internet, raise the account count to 6–8 to avoid false positives. The timeframe matters more than the count — keep it under 30 minutes.',
  },
  'pat-2': {
    tagline: 'Flags logins from two locations so far apart that no human could have travelled between them in the time elapsed.',
    whyItMatters: 'If a customer logs in from Kano at 9:00 AM and then from Lagos at 10:30 AM — a journey that takes over 9 hours by road — someone else is using the account. Account takeover attacks happen immediately after credentials are stolen. This rule catches real-time compromise by checking physics: if the distance is impossible to cover in the elapsed time, the account has been taken over.',
    recommendation: '500 km within 2 hours is the recommended starting point for Nigeria, comfortably catching road travel while flagging suspicious remote logins. If your customers frequently travel by air, note that a Lagos–Kano flight covers over 1,000 km in 1.5 hours. Consider raising the distance threshold to 900 km if domestic air travel is common among your customer base.',
  },
  'pat-3': {
    tagline: 'Detects a single device logging into many different customer accounts — a direct indicator of credential stuffing or account takeover.',
    whyItMatters: 'When criminals obtain stolen login credentials, they test them in bulk from the same device or script. If one device fingerprint authenticates as 7 different customers within 24 hours, someone is systematically compromising accounts. No legitimate customer uses one device to log into 7 different people\'s bank accounts. This is almost always automated fraud.',
    recommendation: 'Seven unique accounts on one device in 24 hours is already conservative. A shared family device might legitimately have 2–3 accounts, never 7. You can lower this to 5 for earlier detection. Avoid going below 3, as some customers do manage accounts for elderly relatives.',
  },
  'pat-4': {
    tagline: 'Catches groups of customers all transacting heavily outside their usual hours — often a coordinated attack timed for when monitoring is weakest.',
    whyItMatters: 'Fraudsters know that compliance teams are smallest at night. Coordinated attacks are deliberately launched between 2 AM and 4 AM because staff are asleep, automated alerts may go unreviewed, and banks respond more slowly. When multiple customers all become suddenly active outside their personal baseline at the same time, it signals a coordinated attack — not independent night-owl behaviour.',
    recommendation: '02:00–04:00 UTC (3am–5am Nigeria time) is the highest-risk window per CBN W-22 data. The minimum customer threshold prevents false positives from legitimate shift workers. If your bank serves nurses, security personnel, or factory workers who naturally transact at night, raise the minimum customer count to 8–10 to reduce noise.',
  },
  'pat-5': {
    tagline: 'Identifies when many different senders all funnel money to the same wallet in a short window — the textbook pattern of layering and smurfing.',
    whyItMatters: 'In a smurfing scheme, a criminal recruits or coerces many people to each send a small amount to one central account, which then moves the pooled money onward — making the origin hard to trace. Fourteen different senders to the same wallet in four hours has no innocent explanation. A legitimate bill split involves 3–5 people, not 14, and not timed within a 4-hour burst.',
    recommendation: 'Fourteen senders within 4 hours is the NFIU SST-07 recommended threshold. Tighten to 10 senders for higher sensitivity. Avoid going below 7, as group savings schemes (ajo, esusu) involve multiple transfers to one organiser account. If you serve cooperative societies, verify and whitelist those accounts first.',
  },
}

// ── Transaction rule plain-English copy (card taglines + LearnMore dialog) ────

export const ruleLanguage: Record<string, {
  friendlyName: string
  tagline: string
  whatItChecks: string
  whyItMatters: string
  getScenario: (v: number) => { normalAmt: number; flaggedAmt: number; normalLabel: string; flaggedLabel: string }
  recommendation: string
  howItWorksOverride?: string
  skipScenarios?: boolean
  scenarioText?: string
}> = {
  'high-value-wire': {
    friendlyName: 'Large Transfer Alert',
    tagline: 'Pauses any wire transfer bigger than your set limit so your team can confirm it is safe before the money moves.',
    whatItChecks: 'the amount of money being transferred in a single wire payment.',
    whyItMatters: 'Criminals regularly try to move stolen or laundered money by wiring large sums quickly — before your team notices. This rule acts as a gate. Any wire above your limit is held for human review first. If it is legitimate, your team approves it. If not, they block it before any money leaves.',
    getScenario: (v) => ({
      normalAmt:    Math.floor(v * 0.6),
      flaggedAmt:   Math.floor(v * 1.6),
      normalLabel:  'A regular salary or supplier payment — no issue here.',
      flaggedLabel: 'An unusually large transfer to an unknown account at an unusual time.',
    }),
    recommendation: 'Set this at 1.5 to 2 times your typical largest transaction. For example, if your biggest daily wires are usually around ₦3M, set the limit at ₦5M. This means genuine business payments pass through, while anything unexpected gets reviewed.',
  },
  'velocity-cluster': {
    friendlyName: 'Too Many Transactions Alert',
    tagline: 'Flags a customer who sends an unusually high number of transfers in a single day — a pattern commonly used by money launderers.',
    whatItChecks: 'how many separate transactions one customer makes within a 24-hour window.',
    whyItMatters: 'A common fraud technique called "structuring" or "smurfing" involves breaking one large suspicious payment into many smaller ones to avoid detection. For example, instead of sending ₦20M at once, a criminal sends ₦500k forty times to different accounts. This rule catches that pattern by looking at the count, not just the size.',
    getScenario: (v) => ({
      normalAmt:    Math.floor(v * 0.6),
      flaggedAmt:   Math.floor(v * 2.1),
      normalLabel:  'A small business owner making a few daily supplier payments.',
      flaggedLabel: 'Dozens of small transfers sent rapidly to multiple unrelated accounts.',
    }),
    recommendation: 'Find out how many transfers your busiest legitimate customers do per day — for example, a trader or small business owner. Set the limit about 30% above that number. If your busiest customer sends 8 transfers daily, set the limit at about 11.',
  },
  'late-night-large': {
    friendlyName: 'Late Night Large Payment Alert',
    tagline: 'Catches large transfers that happen in the middle of the night when legitimate businesses are normally closed.',
    whatItChecks: 'both the size of the payment AND the time it was made. Both must exceed your limits for the alert to trigger.',
    whyItMatters: 'Most genuine business payments happen during business hours. A ₦5M wire transfer at 2:30 AM is almost always suspicious — it is either an account that has been hacked and taken over, or someone testing whether your systems will catch them while staff are asleep. Night-time fraud is common because fraudsters believe fewer people are watching.',
    getScenario: (v) => ({
      normalAmt:    Math.floor(v * 0.5),
      flaggedAmt:   Math.floor(v * 1.7),
      normalLabel:  'Small bill payment at night — amount is well below your limit.',
      flaggedLabel: 'Very large transfer initiated at 2:15 AM to a new beneficiary.',
    }),
    recommendation: 'Think about your actual night-time business. If you have international clients in different time zones, you may need a higher limit. If your operations are mostly local and daytime, set it low. A good starting point is 50% of your daytime large-transfer limit.',
  },
  'cross-border-bdc': {
    friendlyName: 'International & Foreign Exchange Alert',
    tagline: 'Monitors large cross-border wires and Bureau de Change (BDC) transactions for amounts that are unusually high.',
    whatItChecks: 'the amount being sent internationally or exchanged as foreign currency through a BDC.',
    whyItMatters: 'International transfers are one of the most common routes for moving illicit money because once money crosses a border, recovering it becomes very difficult. BDC transactions are also frequently used to convert cash into foreign currency and move it out of the country undetected. Monitoring large amounts gives your compliance team the opportunity to verify purpose and documentation before funds leave Nigerian jurisdiction.',
    getScenario: (v) => ({
      normalAmt:    Math.floor(v * 0.55),
      flaggedAmt:   Math.floor(v * 1.65),
      normalLabel:  'A routine import payment for goods — documented and verified.',
      flaggedLabel: 'Large offshore transfer with no supporting invoice or contract.',
    }),
    recommendation: 'Start at your typical BDC deal size or the most common international transfer size for your institution. Always require documentation (invoice, shipping contract, import licence) for any transfer above this threshold. The CBN expects financial institutions to be able to explain the purpose of every large international transaction.',
  },
  'velocity-spike': {
    friendlyName: 'Sudden Transaction Surge Alert',
    tagline: 'Raises an alert when your bank\'s total number of transactions today is significantly higher than yesterday — a key warning sign of a coordinated fraud attack happening across multiple accounts at once.',
    whatItChecks: 'the total number of transactions being processed across your entire institution today, compared to the same figure from yesterday.',
    whyItMatters: 'When criminals coordinate an attack — a network of money mules all moving funds at the same time, a mass account takeover campaign, or a smurfing ring breaking large amounts into many small transfers — their collective activity causes your institution\'s overall transaction count to spike suddenly. This rule watches the big picture rather than individual customers. A normal Monday might bring 500 transactions. If a Monday suddenly brings 700, that 40% jump is a warning sign that something coordinated may be happening — even if no single account looks obviously suspicious on its own.',
    getScenario: (_v) => ({ normalAmt: 0, flaggedAmt: 0, normalLabel: '', flaggedLabel: '' }),
    howItWorksOverride: 'Instead of watching individual customers, this rule watches your entire institution at once. Every transaction that arrives adds to a running total for today. If that total climbs well above what you processed yesterday, the system raises an alert. The number you set is the percentage increase that should concern you — shown as "+30% vs yesterday" or "+50% vs yesterday". For example, "+30% vs yesterday" means: "alert me when today\'s volume is at least 30% higher than yesterday\'s." A larger number means a bigger surge is needed before an alert fires.',
    skipScenarios: true,
    scenarioText: 'Your institution processed 400 transactions yesterday (Monday). By midday on the following Monday it has already reached 520 transactions — and the day is only half over. At that pace, today will end at around 1,040 transactions, which is 160% of yesterday\'s total. Your Sudden Transaction Surge Alert fires and notifies your compliance team. They investigate and discover that 280 of those transactions belong to a cluster of recently opened accounts all receiving deposits and immediately sending them to other accounts — a textbook money mule network in operation.',
    recommendation: '"+30% vs yesterday" is a sensible starting point. If your institution regularly sees large swings near salary payment dates, month-ends, or public holidays, raise it to "+50%" or "+60%" to avoid false alarms during those known busy periods. Avoid going below "+15%": anything lower will fire so often during normal busy days that your team will start ignoring the alerts, which defeats the purpose entirely.',
  },
}

// ── Shorter card-level descriptions (recommendation box on each rule card) ────
// Kept separate from ruleLanguage because the card wording is shorter / simpler
// than the full dialog copy. Merging would force one or the other to be cut.

export const plainEnglishDescriptions: Record<string, {
  simple: string
  whyItMatters: string
  howItWorks: string
  example: string
  recommendation: string
}> = {
  'high-value-wire': {
    simple: 'Catches unusually large wire transfers that might be risky.',
    whyItMatters: 'Criminals often try to move large sums of money quickly. By monitoring wire transfers above a certain amount, you can catch suspicious activity early.',
    howItWorks: 'When a customer sends a wire transfer, our system checks the amount. If it exceeds your threshold, we automatically flag it for your review team. They can then investigate and approve or block it.',
    example: 'Scenario: Your bank typically processes wire transfers of ₦1M to ₦3M daily. You set the threshold to ₦5M. When a customer suddenly wants to wire ₦8M to an unknown beneficiary, our system flags it. Your team investigates, realizes the customer is actually a real estate developer making a legitimate purchase, and approves it. But if it looked suspicious, you could block it.',
    recommendation: 'Set this to 1.5–2x your typical large transaction size. This catches unusual activity while not drowning your team in alerts. If you process a lot of large deals daily, you may need to set it higher.',
  },
  'velocity-cluster': {
    simple: 'Detects when a single customer makes too many transactions in a short time.',
    whyItMatters: 'Money launderers often split large amounts into many small transactions ("structuring") to avoid detection. This rule catches that pattern.',
    howItWorks: 'Our system tracks how many transactions each customer makes in a 24-hour period. If they exceed your threshold, the system flags the account. Your compliance team can then review the pattern and decide if it\'s legitimate (e.g., a business owner processing daily sales) or suspicious.',
    example: 'Scenario: You set the threshold to 6 transactions per 24 hours. A regular customer (a small shop owner) typically makes 3–4 daily transfers. A fraudster opens an account and immediately makes 15 transfers in 2 hours, sending small amounts to different accounts. Our system catches this and alerts your team to investigate.',
    recommendation: 'Look at your busiest customers (e.g., payment aggregators, traders) and see how many transactions they do daily. Set the threshold 20–30% higher than their average. This prevents false alarms while catching real suspicious clusters.',
  },
  'late-night-large': {
    simple: 'Flags large transactions that happen outside normal business hours.',
    whyItMatters: 'Legitimate businesses operate during business hours. Large transactions at 2 AM or 3 AM are unusual and may indicate account takeover or fraud.',
    howItWorks: 'Our system checks both the transaction amount AND the time it was initiated. If a large transaction happens between 11 PM and 5 AM and exceeds your threshold, it\'s flagged. Your team reviews it to confirm it\'s legitimate (e.g., international customer in a different time zone) or suspicious.',
    example: 'Scenario: You set the threshold to ₦2M. A customer\'s account is compromised at 2:30 AM. The fraudster tries to transfer ₦3M to an unknown beneficiary. Our system catches this because it\'s a large amount at an unusual time. Your security team gets an alert and can freeze the account before the money leaves.',
    recommendation: 'Consider your business operations. If you serve international clients across different time zones, you may need to adjust. If you\'re mostly a daytime operation, set a lower threshold. Start with ₦1M–₦5M depending on your typical transaction size.',
  },
  'cross-border-bdc': {
    simple: 'Monitors large money transfers for foreign exchange (BDC) transactions.',
    whyItMatters: 'Cross-border transfers and forex deals are high-risk for money laundering because they move money across jurisdictions. Larger amounts carry more risk.',
    howItWorks: 'When a customer initiates a cross-border or BDC transaction (identified by transaction type or counterparty), our system checks the amount. If it exceeds your threshold, it\'s flagged for manual review. Your team can verify the legitimacy of the transaction, check the beneficiary, and ensure compliance with CBN regulations.',
    example: 'Scenario: You set the threshold to ₦15M. A small business customer usually does BDC transactions under ₦5M. They submit a request for ₦20M USD conversion. Our system flags it. Your team calls the customer, confirms it\'s for machinery import, verifies the documentation, and approves it. Later, another request comes in from a new customer for ₦50M to an offshore account with no supporting documents. You block it.',
    recommendation: 'Set this based on your typical BDC transaction sizes. Most institutions can start at ₦10M–₦20M. As your cross-border business grows, you may adjust upward. Always require supporting documentation (invoices, contracts) for amounts above this threshold.',
  },
  'velocity-spike': {
    simple: 'Watches your entire bank\'s transaction activity and raises an alert when today\'s total volume is suddenly much higher than yesterday\'s — a sign that a coordinated fraud attack may be underway.',
    whyItMatters: 'Individual fraud rules watch one customer at a time. This rule watches everybody at once. A sudden surge across the whole institution often means criminals are operating in a coordinated group — and no single-customer rule would catch that pattern on its own.',
    howItWorks: 'OpenIV counts every transaction your institution processes each day. At the end of the day (or in real time as transactions arrive), it compares today\'s count to yesterday\'s. If today\'s count exceeds yesterday\'s by more than your configured percentage, an alert is raised for your compliance team to investigate.',
    example: 'Your institution normally processes around 400 transactions on a Monday. One Monday it processes 600 — a 50% jump. The surge alert fires. Your team investigates and finds that 150 of those extra transactions came from newly opened accounts all forwarding funds to the same beneficiary group. That is a coordinated mule network, and this rule is what caught it.',
    recommendation: 'Set the threshold to "+30% vs yesterday" as a starting point. If your institution regularly experiences high-volume days around salary cycles or month-ends, raise it to "+50%" or "+60%" to avoid unnecessary alerts on those known busy days.',
  },
}
