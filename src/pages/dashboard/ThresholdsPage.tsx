import { useState, useEffect, useCallback, useRef } from 'react'
import { isBuildOne } from '@/utils/build'
import { Box, Typography, Stack, TextField, Slider, Switch, Chip, Button, Dialog, DialogContent, DialogActions, DialogTitle, Grid, Tabs, Tab, Tooltip } from '@mui/material'
import { useRbac } from '@/contexts/RbacContext'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import { colorPalette } from '@/theme'
import ComingSoonOverlay from '@/components/dashboard/ComingSoonOverlay'
import TOTPConfirmation from '@/components/dashboard/TOTPConfirmation'
import { thresholdApi, type ThresholdRule, type ThresholdMetrics, type KycTierRecord, type ThresholdChange } from '@/api/thresholds'
import { behavioralRuleApi, type BehavioralRule } from '@/api/behavioralRules'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import SmartphoneOutlinedIcon from '@mui/icons-material/SmartphoneOutlined'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded'
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined'
import { amlApi, type AmlSettings } from '@/api/aml'
import RiskSeekbar from '@/components/dashboard/RiskSeekbar'

const tagColors: Record<string, string> = {
  AML: colorPalette.primary,
  Fraud: '#dc2626',
  KYC: '#f59e0b',
}

function fmtThreshold(rule: ThresholdRule, value: number): string {
  if (rule.unit === '₦') {
    return value >= 1_000_000
      ? `₦${(value / 1_000_000).toFixed(1)}M`
      : `₦${(value / 1_000).toFixed(0)}k`
  }
  if (rule.ruleId === 'velocity-spike') return `+${value - 100}% vs yesterday`
  return String(value)
}

const categoryConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  Geo: { color: '#7c3aed', icon: <LocationOnOutlinedIcon sx={{ fontSize: '1rem' }} /> },
  Device: { color: '#0891b2', icon: <SmartphoneOutlinedIcon sx={{ fontSize: '1rem' }} /> },
  Velocity: { color: '#ea580c', icon: <ScheduleRoundedIcon sx={{ fontSize: '1rem' }} /> },
  Network: { color: '#dc2626', icon: <GroupsOutlinedIcon sx={{ fontSize: '1rem' }} /> },
  Temporal: { color: colorPalette.primary, icon: <ScheduleRoundedIcon sx={{ fontSize: '1rem' }} /> },
}

const severityConfig: Record<string, { bg: string; color: string }> = {
  critical: { bg: '#fef2f2', color: '#dc2626' },
  high: { bg: '#fffbeb', color: '#f59e0b' },
  medium: { bg: `${colorPalette.primary}10`, color: colorPalette.primary },
}

// Plain-English context for each behavioral pattern rule
const patternLanguage: Record<string, { tagline: string; whyItMatters: string; recommendation: string }> = {
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

// User-friendly language for each rule — what shows on the card and in the dialog
const ruleLanguage: Record<string, {
  friendlyName: string
  tagline: string
  whatItChecks: string
  whyItMatters: string
  getScenario: (v: number) => { normalAmt: number; flaggedAmt: number; normalLabel: string; flaggedLabel: string }
  recommendation: string
  // Optional overrides for rules that don't follow the standard amount-based pattern
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
      normalAmt: Math.floor(v * 0.6),
      flaggedAmt: Math.floor(v * 1.6),
      normalLabel: 'A regular salary or supplier payment — no issue here.',
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
      normalAmt: Math.floor(v * 0.6),
      flaggedAmt: Math.floor(v * 2.1),
      normalLabel: 'A small business owner making a few daily supplier payments.',
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
      normalAmt: Math.floor(v * 0.5),
      flaggedAmt: Math.floor(v * 1.7),
      normalLabel: 'Small bill payment at night — amount is well below your limit.',
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
      normalAmt: Math.floor(v * 0.55),
      flaggedAmt: Math.floor(v * 1.65),
      normalLabel: 'A routine import payment for goods — documented and verified.',
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

// Learn More Dialog — detailed, educational
function LearnMoreDialog({ state, open, onClose }: { state: { rule: ThresholdRule } | null; open: boolean; onClose: () => void }) {
  if (!state) return null
  const { rule } = state
  const lang = ruleLanguage[rule.ruleId]
  const desc = plainEnglishDescriptions[rule.ruleId]

  const isMonetary = rule.unit === '₦'
  const fmt = (v: number) => isMonetary
    ? (v >= 1_000_000 ? `₦${(v / 1_000_000).toFixed(1)}M` : `₦${(v / 1_000).toFixed(0)}k`)
    : `${v} ${rule.unit || ''}`

  // Use outward threshold for examples, fall back to inward, then base value
  const exampleValue = rule.thresholdOutward ?? rule.thresholdInward ?? rule.thresholdValue

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth slotProps={{ paper: { sx: { borderRadius: 0 } } }}>
      {/* Header */}
      <Box sx={{ px: 3, pt: 3, pb: 2, borderBottom: '1px solid var(--border-col)' }}>
        <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: colorPalette.primary, textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.5 }}>
          Detection Rule
        </Typography>
        <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--heading-color)', fontFamily: 'Jost', mb: 0.5 }}>
          {lang?.friendlyName ?? rule.name}
        </Typography>
        <Typography sx={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>
          {lang?.tagline ?? desc?.simple ?? rule.description}
        </Typography>
        {/* Per-direction limits */}
        <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          {[
            { label: 'Outward (money sent)', value: rule.thresholdOutward },
            { label: 'Inward (money received)', value: rule.thresholdInward },
          ].map(({ label, value: v }) => (
            <Box key={label} sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.5, bgcolor: v !== null ? `${colorPalette.primary}0d` : 'var(--section-bg)', border: `1px solid ${v !== null ? colorPalette.primary + '30' : 'var(--border-col)'}` }}>
              <Typography sx={{ fontSize: '0.6875rem', color: '#64748b' }}>{label}:</Typography>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 800, color: v !== null ? colorPalette.primary : '#cbd5e1', fontFamily: 'SF Mono, Monaco, monospace' }}>
                {v !== null ? fmt(v) : 'Not monitored'}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <DialogContent sx={{ pt: 3 }}>
        <Stack gap={3}>
          {/* How the rule works */}
          {lang && (
            <Box>
              <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.8 }}>
                {lang.howItWorksOverride
                  ? lang.howItWorksOverride
                  : <>When your customer transfers any amount above <strong>{fmt(exampleValue)}</strong>, our system receives it based on the rule you set — then we flag it. Your rule is the source of truth for the decision our AML engine makes.</>
                }
              </Typography>
              {!lang.howItWorksOverride && (
                <Box sx={{ mt: 1.5, p: 2, bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)', borderRadius: '6px' }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.75 }}>
                    Example
                  </Typography>
                  <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.75 }}>
                    A customer <strong>Adaeze</strong> transfers <strong>{fmt(Math.floor(exampleValue * 1.55))}</strong> which is above your system's limit of <strong>{fmt(exampleValue)}</strong>. Our AML engine would flag the transaction on your behalf.
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Why it matters */}
          {lang?.whyItMatters && (
            <Box sx={{ p: 2, bgcolor: '#fffbeb', border: '1px solid #fcd34d' }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
                Why this rule exists
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#78350f', lineHeight: 1.75 }}>
                {lang.whyItMatters}
              </Typography>
            </Box>
          )}

          {/* Detailed Real-world scenarios */}
          {lang && !lang.skipScenarios && (
            <Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5 }}>
                Real-world scenarios at your limit of {fmt(exampleValue)}
              </Typography>

              {/* Scenario 1: Transaction that PASSES */}
              <Box sx={{ p: 2.5, mb: 2, bgcolor: '#f0fdf4', border: '2px solid #bbf7d0', borderRadius: '6px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Box sx={{ width: 6, height: 20, bgcolor: '#10b981', borderRadius: '2px' }} />
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Transaction A — Approved Instantly
                  </Typography>
                </Box>
                <Box sx={{ fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.75rem', color: 'var(--on-surface-variant)', lineHeight: 1.8, bgcolor: 'var(--card-bg)', p: 1.5, border: '1px solid #dbeafe', borderRadius: '4px', mb: 1.5 }}>
                  <div><strong>Customer:</strong> Aminu Bakara</div>
                  <div><strong>Transaction Type:</strong> Wire Transfer</div>
                  <div><strong>Amount:</strong> {fmt(Math.floor(exampleValue * 0.65))}</div>
                  <div><strong>Destination:</strong> Kano Agricultural Suppliers Ltd</div>
                  <div><strong>Time:</strong> Tuesday, 9:15 AM</div>
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: '#166534', lineHeight: 1.7, mb: 1 }}>
                  <strong>What OpenIV checks:</strong> Amount {fmt(Math.floor(exampleValue * 0.65))} is below your limit of {fmt(exampleValue)}. Time is during business hours. Destination is a known vendor.
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#166534', lineHeight: 1.7 }}>
                  <strong>Decision:</strong> ✓ APPROVED • Payment processed immediately • No compliance team intervention needed.
                </Typography>
              </Box>

              {/* Scenario 2: Transaction that GETS FLAGGED */}
              <Box sx={{ p: 2.5, bgcolor: '#fef2f2', border: '2px solid #fecaca', borderRadius: '6px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Box sx={{ width: 6, height: 20, bgcolor: '#dc2626', borderRadius: '2px' }} />
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Transaction B — Flagged for Review
                  </Typography>
                </Box>
                <Box sx={{ fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.75rem', color: 'var(--on-surface-variant)', lineHeight: 1.8, bgcolor: 'var(--card-bg)', p: 1.5, border: '1px solid #fecaca', borderRadius: '4px', mb: 1.5 }}>
                  <div><strong>Customer:</strong> Chioma Okonkwo</div>
                  <div><strong>Transaction Type:</strong> Wire Transfer</div>
                  <div><strong>Amount:</strong> {fmt(Math.floor(exampleValue * 1.55))}</div>
                  <div><strong>Destination:</strong> Unknown International Account</div>
                  <div><strong>Time:</strong> Tuesday, 11:47 PM</div>
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: '#991b1b', lineHeight: 1.7, mb: 1 }}>
                  <strong>What OpenIV checks:</strong> Amount {fmt(Math.floor(exampleValue * 1.55))} EXCEEDS your limit of {fmt(exampleValue)}. This triggers an automatic flag.
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#991b1b', lineHeight: 1.7, mb: 1 }}>
                  <strong>Decision:</strong> ⚠ FLAGGED • Transaction put on hold • Your compliance team receives an alert.
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#991b1b', lineHeight: 1.7 }}>
                  <strong>Next step:</strong> Your team reviews the customer's identity, checks if the account is new, verifies the destination, and may contact the customer for clarification before releasing the funds.
                </Typography>
              </Box>
            </Box>
          )}

          {/* Scenario text for non-amount-based rules */}
          {lang?.skipScenarios && lang.scenarioText && (
            <Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1.5 }}>
                Real-world example
              </Typography>
              <Box sx={{ p: 2.5, bgcolor: '#fef9ee', border: '2px solid #fcd34d', borderRadius: '6px' }}>
                <Typography sx={{ fontSize: '0.8125rem', color: '#78350f', lineHeight: 1.8 }}>
                  {lang.scenarioText}
                </Typography>
              </Box>
            </Box>
          )}

          {/* How to set it */}
          {lang?.recommendation && (
            <Box sx={{ p: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 1 }}>
                How to choose the right number
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#166534', lineHeight: 1.75 }}>
                {lang.recommendation}
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2.5, borderTop: '1px solid var(--border-col)' }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', fontFamily: 'Jost', fontSize: '0.875rem', fontWeight: 600, color: colorPalette.primary, bgcolor: `${colorPalette.primary}10`, px: 2.5, borderRadius: 0, '&:hover': { bgcolor: `${colorPalette.primary}18` } }}>
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function MadLibInput({ value, onChange, width = 60, type = 'number', readOnly = false }: { value: any, onChange: (val: any) => void, width?: number, type?: string, readOnly?: boolean }) {
  return (
    <Box sx={{ display: 'inline-block', mx: 0.75, verticalAlign: 'middle' }}>
      <TextField
        value={value}
        onChange={(e) => !readOnly && onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        type={type}
        variant="standard"
        slotProps={{ input: { disableUnderline: true, readOnly } }}
        sx={{
          bgcolor: `${colorPalette.primary}15`,
          border: `1px solid ${colorPalette.primary}30`,
          borderRadius: 0,
          width,
          '& input': {
            textAlign: 'center',
            p: 0.5,
            fontSize: '0.875rem',
            fontWeight: 700,
            color: colorPalette.primary,
            fontFamily: 'SF Mono, Monaco, monospace',
          },
          '&:hover': { bgcolor: `${colorPalette.primary}20` },
          '&:focus-within': { borderColor: colorPalette.primary, bgcolor: 'var(--card-bg)', boxShadow: `0 0 0 2px ${colorPalette.primary}20` },
        }}
      />
    </Box>
  )
}

const plainEnglishDescriptions: Record<string, {
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

export default function ThresholdsPage() {
  const { can } = useRbac()
  const canModify = can('rules.modify')

  // Thresholds state
  const [rules, setRules] = useState<ThresholdRule[]>([])
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<ThresholdMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [outwardDrafts, setOutwardDrafts] = useState<Record<number, number>>({})
  const [inwardDrafts, setInwardDrafts] = useState<Record<number, number>>({})
  const [saving, setSaving] = useState(false)
  const [learnMoreState, setLearnMoreState] = useState<{ rule: ThresholdRule } | null>(null)

  const [pendingSave, setPendingSave] = useState<{ rule: ThresholdRule; direction: 'outward' | 'inward'; newValue: number | null } | null>(null)
  const [pendingToggle, setPendingToggle] = useState<{ rule: ThresholdRule; newActive: boolean } | null>(null)

  const [auditOpen, setAuditOpen] = useState(false)
  const [auditChanges, setAuditChanges] = useState<ThresholdChange[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditFilter, setAuditFilter] = useState('')
  const [auditDateFrom, setAuditDateFrom] = useState('')
  const [auditDateTo, setAuditDateTo] = useState('')
  const [auditPage, setAuditPage] = useState(0)

  const openAuditLog = async () => {
    setAuditOpen(true)
    setAuditLoading(true)
    setAuditFilter('')
    setAuditDateFrom('')
    setAuditDateTo('')
    setAuditPage(0)
    try {
      const res = await thresholdApi.allHistory()
      setAuditChanges(res.changes)
    } finally {
      setAuditLoading(false)
    }
  }

  const [activeTab, setActiveTab] = useState(0)
  const [amlSettings, setAmlSettings] = useState<AmlSettings | null>(null)
  const [dailyTxnDraft, setDailyTxnDraft] = useState<number>(10)
  const [dailyTxnSaving, setDailyTxnSaving] = useState(false)
  const [expectedTxnDraft, setExpectedTxnDraft] = useState<number>(1000)
  const [expectedTxnSaving, setExpectedTxnSaving] = useState(false)
  const [amlDrafts, setAmlDrafts] = useState<{ riskScoreFlagThreshold?: number, riskScoreCaseThreshold?: number, behRiskScoreFlagThreshold?: number, behRiskScoreCaseThreshold?: number, riskScoreNormalThreshold?: number, behRiskScoreNormalThreshold?: number, kycRiskNormalThreshold?: number, kycRiskCaseThreshold?: number }>({})
  const [amlPendingSave, setAmlPendingSave] = useState<{ riskScoreFlagThreshold?: number, riskScoreCaseThreshold?: number, behRiskScoreFlagThreshold?: number, behRiskScoreCaseThreshold?: number, riskScoreNormalThreshold?: number, behRiskScoreNormalThreshold?: number, kycRiskNormalThreshold?: number, kycRiskCaseThreshold?: number } | null>(null)

  // Behavioral Rules state
  const [behRules, setBehRules] = useState<BehavioralRule[]>([])
  const [behLoading, setBehLoading] = useState(true)
  const [behDrafts, setBehDrafts] = useState<Record<number, Record<string, any>>>({})
  const [behPendingSave, setBehPendingSave] = useState<{ rule: BehavioralRule; newParams?: Record<string, any>, newActive?: boolean } | null>(null)

  const [kycTiers, setKycTiers] = useState<KycTierRecord[]>([])

  const kycRef = useRef<HTMLDivElement>(null)


  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [r, m, p, t, a] = await Promise.all([
        thresholdApi.list(),
        thresholdApi.metrics(),
        behavioralRuleApi.list(),
        thresholdApi.listKycTiers(),
        amlApi.getSettings(),
      ])
      setRules(r.rules)
      setMetrics(m)
      setBehRules(p.rules)
      setKycTiers(t.tiers)
      setAmlSettings(a.settings)
      setDailyTxnDraft(a.settings?.dailyTxnLimit ?? 10)
      setExpectedTxnDraft(a.settings?.expectedDailyTxnCount ?? 1000)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setMetricsLoading(false)
      setBehLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleOutwardSlider = (id: number, value: number) => setOutwardDrafts(prev => ({ ...prev, [id]: value }))
  const handleInwardSlider  = (id: number, value: number) => setInwardDrafts(prev => ({ ...prev, [id]: value }))

  const handleSaveConfirm = useCallback(async () => {
    if (!pendingSave || saving) return
    setSaving(true)
    try {
      const payload = pendingSave.direction === 'outward'
        ? { outwardThreshold: pendingSave.newValue }
        : { inwardThreshold: pendingSave.newValue }
      await thresholdApi.update(pendingSave.rule.id, payload)
      if (pendingSave.direction === 'outward') {
        setOutwardDrafts(prev => { const n = { ...prev }; delete n[pendingSave.rule.id]; return n })
      } else {
        setInwardDrafts(prev => { const n = { ...prev }; delete n[pendingSave.rule.id]; return n })
      }
      await loadData()
    } finally { setSaving(false); setPendingSave(null) }
  }, [pendingSave, saving, loadData])

  const handleUpdateTierRule = async (tier: number, field: string, value: number) => {
    try {
      await thresholdApi.updateKycTier(tier, field, value)
      const stateKey = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase()) as keyof KycTierRecord
      setKycTiers(prev => prev.map(t => t.kycTier === tier ? { ...t, [stateKey]: value } : t))
    } catch (e) {
      console.error('Tier update failed', e)
    }
  }



  const handleToggleConfirm = useCallback(async () => {
    if (!pendingToggle || saving) return
    setSaving(true)
    try {
      await thresholdApi.update(pendingToggle.rule.id, { isActive: pendingToggle.newActive })
      await loadData()
    } finally { setSaving(false); setPendingToggle(null) }
  }, [pendingToggle, saving, loadData])

  const handleBehParamChange = (id: number, paramKey: string, val: any) => {
    setBehDrafts(prev => {
      const currentDraft = prev[id] || {}
      return { ...prev, [id]: { ...currentDraft, [paramKey]: val } }
    })
  }


  const handleAmlSaveConfirm = async () => {
    if (!amlPendingSave || saving || !amlSettings) return
    setSaving(true)
    try {
      const payload = {
        autoOpenCase: amlSettings.autoOpenCase ?? false,
        riskScoreNormalThreshold: amlPendingSave.riskScoreNormalThreshold ?? amlSettings.riskScoreNormalThreshold ?? 45,
        riskScoreFlagThreshold: amlPendingSave.riskScoreFlagThreshold ?? amlSettings.riskScoreFlagThreshold ?? 45,
        riskScoreCaseThreshold: amlPendingSave.riskScoreCaseThreshold ?? amlSettings.riskScoreCaseThreshold ?? 85,
        behRiskScoreNormalThreshold: amlPendingSave.behRiskScoreNormalThreshold ?? amlSettings.behRiskScoreNormalThreshold ?? 45,
        behRiskScoreFlagThreshold: amlPendingSave.behRiskScoreFlagThreshold ?? amlSettings.behRiskScoreFlagThreshold ?? 45,
        behRiskScoreCaseThreshold: amlPendingSave.behRiskScoreCaseThreshold ?? amlSettings.behRiskScoreCaseThreshold ?? 85,
        kycRiskNormalThreshold: amlPendingSave.kycRiskNormalThreshold ?? amlSettings.kycRiskNormalThreshold ?? 40,
        kycRiskCaseThreshold: amlPendingSave.kycRiskCaseThreshold ?? amlSettings.kycRiskCaseThreshold ?? 75,
      }
      console.log('[AML Save] Payload:', payload)
      const res = await amlApi.updateSettings(payload)
      console.log('[AML Save] Response:', res)
      setAmlDrafts({})
      await loadData()
    } catch (err) {
      console.error('[AML Save] Error:', err)
      alert('Failed to save risk thresholds. Check console for details.')
    } finally {
      setSaving(false)
      setAmlPendingSave(null)
    }
  }

  const handleBehSaveConfirm = async () => {
    if (!behPendingSave || saving) return
    setSaving(true)
    try {
      const { rule, newParams, newActive } = behPendingSave
      await behavioralRuleApi.update(rule.id, {
        params: newParams,
        isActive: newActive
      })
      if (newParams) {
        setBehDrafts(prev => {
          const n = { ...prev }
          delete n[rule.id]
          return n
        })
      }
      await loadData()
    } finally {
      setSaving(false)
      setBehPendingSave(null)
    }
  }

  const renderMadLibs = (rule: BehavioralRule) => {
    const params = behDrafts[rule.id] ? { ...rule.params, ...behDrafts[rule.id] } : rule.params
    const ro = !canModify

    switch (rule.ruleId) {
      case 'pat-1':
        return (
          <Typography sx={{ fontSize: '0.9375rem', color: 'var(--on-surface-variant)', lineHeight: 2 }}>
            Flag when <MadLibInput value={params.ip_count} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'ip_count', v)} /> customer accounts — none with prior relationship — all initiate wire transfers from the same IP block within <MadLibInput value={params.timeframe_minutes} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'timeframe_minutes', v)} /> minutes of each other.
          </Typography>
        )
      case 'pat-2':
        return (
          <Typography sx={{ fontSize: '0.9375rem', color: 'var(--on-surface-variant)', lineHeight: 2 }}>
            Flag when a customer logs in from distant locations physically impossible without supersonic travel, separated by at least <MadLibInput value={params.distance_km} width={80} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'distance_km', v)} /> km within <MadLibInput value={params.timeframe_hours} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'timeframe_hours', v)} /> hours.
          </Typography>
        )
      case 'pat-3':
        return (
          <Typography sx={{ fontSize: '0.9375rem', color: 'var(--on-surface-variant)', lineHeight: 2 }}>
            Flag when a single device fingerprint is authenticated as <MadLibInput value={params.user_count} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'user_count', v)} /> different customers in the past <MadLibInput value={params.timeframe_hours} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'timeframe_hours', v)} /> hours.
          </Typography>
        )
      case 'pat-4':
        return (
          <Typography sx={{ fontSize: '0.9375rem', color: 'var(--on-surface-variant)', lineHeight: 2 }}>
            Flag when more than <MadLibInput value={params.min_customers} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'min_customers', v)} /> customers transact outside their personal baseline of activity between <MadLibInput type="text" width={80} value={params.time_start} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'time_start', v)} /> and <MadLibInput type="text" width={80} value={params.time_end} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'time_end', v)} />.
          </Typography>
        )
      case 'pat-5':
        return (
          <Typography sx={{ fontSize: '0.9375rem', color: 'var(--on-surface-variant)', lineHeight: 2 }}>
            Flag when <MadLibInput value={params.customer_count} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'customer_count', v)} /> different customers send funds to the same wallet within <MadLibInput value={params.timeframe_hours} readOnly={ro} onChange={v => handleBehParamChange(rule.id, 'timeframe_hours', v)} /> hours.
          </Typography>
        )
      default:
        return <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>{rule.description}</Typography>
    }
  }

  const metricCards = [
    { label: 'Active rules', value: metrics?.activeCount ?? null, sub: `${metrics?.pausedCount ?? '—'} paused` },
    { label: 'Alerts fired', value: metrics?.totalFired ?? null, sub: 'cumulative rule hits' },
    { label: 'Rules paused', value: metrics?.pausedCount ?? null, sub: 'not scoring transactions' },
  ]

  const AUDIT_PAGE_SIZE = 20
  const filteredAuditChanges = auditChanges.filter(c => {
    const matchesFilter = !auditFilter ||
      (c.ruleName ?? '').toLowerCase().includes(auditFilter.toLowerCase()) ||
      c.field.toLowerCase().includes(auditFilter.toLowerCase())
    const matchesFrom = !auditDateFrom || new Date(c.createdAt) >= new Date(auditDateFrom)
    const matchesTo = !auditDateTo || new Date(c.createdAt) <= new Date(auditDateTo + 'T23:59:59')
    return matchesFilter && matchesFrom && matchesTo
  })
  const pagedAuditChanges = filteredAuditChanges.slice(auditPage * AUDIT_PAGE_SIZE, (auditPage + 1) * AUDIT_PAGE_SIZE)

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        {/* Page header */}
        <Box>
          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: colorPalette.primary, letterSpacing: '0.14em', textTransform: 'uppercase', mb: 0.75 }}>
            Configure
          </Typography>
          <Typography sx={{ fontSize: '1.625rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', letterSpacing: '-0.015em', mb: 0.5 }}>
            Detection Thresholds
          </Typography>
          <Typography sx={{ fontSize: '0.9375rem', color: '#64748b' }}>
            Tune the rules that flag suspicious activity across transaction detection, behavioral patterns, and risk scoring
          </Typography>
        </Box>
      </Box>


      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{
          borderBottom: '1px solid var(--border-col)', mb: 3, minHeight: 36,
          '& .MuiTabs-indicator': { bgcolor: colorPalette.primary, height: 2 },
          '& .MuiTab-root': {
            fontFamily: 'Jost', fontSize: '0.75rem', fontWeight: 600,
            textTransform: 'none', minHeight: 36, py: 0, px: 2.5,
            color: '#94a3b8',
            '&.Mui-selected': { color: colorPalette.primary },
          },
        }}
      >
        <Tab label="Transaction Rules" />
        {!isBuildOne && <Tab label="Behavioural Pattern Rules" />}
        <Tab label="Risk Score Configuration" />
      </Tabs>

      {!canModify && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.5, mb: 2, bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)' }}>
          <LockOutlinedIcon sx={{ fontSize: '1rem', color: '#94a3b8' }} />
          <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', fontWeight: 500 }}>
            You have <strong>view-only</strong> access to this page. Contact an admin or CCO to modify detection rules.
          </Typography>
        </Box>
      )}

      <Stack gap={3}>

          {activeTab === 0 && (
          <>
          {/* Metric cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
            {metricCards.map(s => (
              <Box
                key={s.label}
                data-ai-analyzable="true"
                data-ai-description={`Rule Performance Metric: ${s.label}. value: ${s.value ?? 'N/A'}. status: ${s.sub}.`}
                sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', p: 2 }}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', mb: 0.75 }}>
                  {s.label}
                </Typography>
                {metricsLoading ? (
                  <Box sx={{ height: 28, width: 56, bgcolor: 'var(--section-bg)', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
                ) : (
                  <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost', lineHeight: 1.1 }}>
                    {s.value ?? '—'}
                  </Typography>
                )}
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.5 }}>{s.sub}</Typography>
              </Box>
            ))}
          </Box>

          {/* Transaction Detection Rules — section header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                Transaction Detection Rules
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                Drag the slider to adjust a threshold, then save to apply
              </Typography>
            </Box>
            <Box onClick={openAuditLog} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.75, py: 0.875, border: '1px solid var(--border-col)', cursor: 'pointer', '&:hover': { bgcolor: 'var(--section-bg)' } }}>
              <HistoryRoundedIcon sx={{ fontSize: '1rem', color: 'var(--on-surface-variant)' }} />
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--on-surface-variant)', fontFamily: 'Jost' }}>Audit Log</Typography>
            </Box>
          </Box>

          {/* Skeleton */}
          {loading && (
            <Stack gap={2}>
              {[...Array(5)].map((_, i) => (
                <Box key={i} sx={{ height: 160, bgcolor: 'var(--section-bg)', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } }, animationDelay: `${i * 60}ms` }} />
              ))}
            </Stack>
          )}

          {/* Individual rule cards */}
          {!loading && rules.map((rule) => {
            const tagColor = tagColors[rule.tag] ?? '#64748b'
            const desc = plainEnglishDescriptions[rule.ruleId]
            const lang = ruleLanguage[rule.ruleId]
            return (
              <Box
                key={rule.id}
                data-ai-analyzable="true"
                data-ai-description={`Detection Rule: ${rule.name}. category: ${rule.tag}. current threshold: ${fmtThreshold(rule, rule.thresholdValue)}. fired: ${rule.firedCount} times. status: ${rule.isActive ? 'Active' : 'Paused'}.`}
                sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', borderRadius: 0, opacity: rule.isActive ? 1 : 0.55, transition: 'opacity 0.18s' }}>

                {/* Card header */}
                <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.625 }}>
                      <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                        {lang?.friendlyName ?? rule.name}
                      </Typography>
                      <Box sx={{ px: 0.75, py: 0.25, bgcolor: `${tagColor}10`, borderRadius: 0 }}>
                        <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: tagColor, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                          {rule.tag}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8' }}>
                        · {rule.firedCount} alerts fired
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', mb: 1.125, lineHeight: 1.65 }}>
                      {lang?.tagline ?? desc?.simple ?? rule.description}
                    </Typography>
                    <Button
                      startIcon={<HelpOutlineRoundedIcon sx={{ fontSize: '0.875rem' }} />}
                      onClick={() => setLearnMoreState({ rule })}
                      sx={{ fontSize: '0.75rem', fontWeight: 600, color: colorPalette.primary, textTransform: 'none', fontFamily: 'Jost', p: 0, '&:hover': { bgcolor: 'transparent', opacity: 0.75 } }}
                    >
                      Learn more
                    </Button>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Tooltip title={!canModify ? 'Requires rules.modify permission' : ''} placement="left">
                      <span>
                        <Switch
                          checked={rule.isActive}
                          disabled={!canModify}
                          onChange={() => canModify && setPendingToggle({ rule, newActive: !rule.isActive })}
                          size="small"
                          sx={{
                            '& .MuiSwitch-track': { borderRadius: 8 },
                            '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${colorPalette.primary} !important`, opacity: '1 !important' },
                          }}
                        />
                      </span>
                    </Tooltip>
                  </Box>
                </Box>

                {/* Card body — sliders + recommendation */}
                <Box sx={{ px: 3, py: 2.5 }}>
                  {/* Per-direction threshold controls */}
                  {(
                    rule.ruleId === 'velocity-spike'
                      ? [{ dir: 'outward' as const, label: 'Surge threshold', sub: 'today vs yesterday', threshold: rule.thresholdOutward, draft: outwardDrafts[rule.id], setDraft: handleOutwardSlider }]
                      : [
                          { dir: 'outward' as const, label: 'Outward', sub: 'money sent', threshold: rule.thresholdOutward, draft: outwardDrafts[rule.id], setDraft: handleOutwardSlider },
                          { dir: 'inward'  as const, label: 'Inward',  sub: 'money received', threshold: rule.thresholdInward, draft: inwardDrafts[rule.id], setDraft: handleInwardSlider },
                        ]
                  ).map(({ dir, label, sub, threshold, draft, setDraft }) => {
                    const displayVal = draft ?? (threshold ?? rule.minValue)
                    const hasDraft = draft !== undefined && draft !== threshold
                    const disabled = threshold === null
                    return (
                      <Box key={dir} sx={{ mt: dir === 'outward' ? 0 : 1.5, display: 'flex', alignItems: 'center', gap: 2 }}>
                        {/* Direction label */}
                        <Box sx={{ minWidth: 120 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                            <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: disabled ? '#cbd5e1' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                              {label}
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>· {sub}</Typography>
                          </Box>
                          {disabled ? (
                            <Typography sx={{ fontSize: '0.75rem', color: '#cbd5e1', fontStyle: 'italic' }}>Not monitored</Typography>
                          ) : (
                            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'SF Mono, Monaco, monospace' }}>
                              {fmtThreshold(rule, displayVal)}
                            </Typography>
                          )}
                        </Box>

                        {/* Slider */}
                        <Box sx={{ flex: 1, px: 1, opacity: disabled ? 0.3 : 1 }}>
                          <Slider
                            value={displayVal}
                            onChange={(_, v) => { if (!disabled && canModify) setDraft(rule.id, v as number) }}
                            min={rule.minValue}
                            max={rule.maxValue}
                            step={rule.stepValue}
                            disabled={!rule.isActive || disabled || !canModify}
                            sx={{
                              color: colorPalette.primary,
                              '& .MuiSlider-track': { height: 4, border: 'none' },
                              '& .MuiSlider-rail': { height: 4, color: '#e5e7eb', opacity: 1 },
                              '& .MuiSlider-thumb': {
                                width: 14, height: 14,
                                bgcolor: 'var(--card-bg)', border: `2px solid ${colorPalette.primary}`,
                                '&:hover, &.Mui-focusVisible': { boxShadow: `0 0 0 6px ${colorPalette.primary}20` },
                              },
                            }}
                          />
                        </Box>

                        {/* Action buttons — only shown when user can modify rules */}
                        {canModify && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120, justifyContent: 'flex-end' }}>
                            {hasDraft && !disabled && (
                              <Box
                                onClick={() => setPendingSave({ rule, direction: dir, newValue: displayVal })}
                                sx={{ px: 1.5, py: 0.5, bgcolor: colorPalette.primary, color: '#ffffff', fontSize: '0.6875rem', fontWeight: 700, fontFamily: 'Jost', cursor: 'pointer', borderRadius: 0, '&:hover': { opacity: 0.88 } }}
                              >
                                Save
                              </Box>
                            )}
                            {disabled ? (
                              <Box
                                onClick={() => setPendingSave({ rule, direction: dir, newValue: rule.thresholdValue })}
                                sx={{ px: 1.5, py: 0.5, border: `1px solid ${colorPalette.primary}`, color: colorPalette.primary, fontSize: '0.6875rem', fontWeight: 700, fontFamily: 'Jost', cursor: 'pointer', borderRadius: 0, '&:hover': { bgcolor: `${colorPalette.primary}08` } }}
                              >
                                Enable
                              </Box>
                            ) : (
                              <Box
                                onClick={() => setPendingSave({ rule, direction: dir, newValue: null })}
                                sx={{ px: 1.5, py: 0.5, border: '1px solid var(--border-col)', color: '#94a3b8', fontSize: '0.6875rem', fontWeight: 600, fontFamily: 'Jost', cursor: 'pointer', borderRadius: 0, '&:hover': { borderColor: '#fca5a5', color: '#dc2626' } }}
                              >
                                Disable
                              </Box>
                            )}
                          </Box>
                        )}
                      </Box>
                    )
                  })}

                  {/* Recommendation */}
                  {desc && (
                    <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: 0 }}>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', mb: 0.5 }}>
                        💡 Recommendation
                      </Typography>
                      <Typography sx={{ fontSize: '0.8125rem', color: '#0c4a6e', lineHeight: 1.5 }}>
                        {desc.recommendation}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            )
          })}

          {/* Learn More Dialog */}
          <LearnMoreDialog state={learnMoreState} open={!!learnMoreState} onClose={() => setLearnMoreState(null)} />

          {/* Daily Transaction Limit */}
          <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', borderRadius: 0 }}>
            <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                  Daily Transaction Limit
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                  Maximum number of transactions a customer may perform in 24 hours before a frequency alert fires
                </Typography>
              </Box>
              {amlSettings && dailyTxnDraft !== amlSettings.dailyTxnLimit && (
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setDailyTxnDraft(amlSettings.dailyTxnLimit)}
                  sx={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'none', fontWeight: 600 }}
                >
                  Reset
                </Button>
              )}
            </Box>
            <Box sx={{ px: 3, py: 3, display: 'flex', alignItems: 'flex-start', gap: 4, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Transactions per day
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <TextField
                    type="number"
                    size="small"
                    value={dailyTxnDraft}
                    disabled={!canModify}
                    onChange={e => canModify && setDailyTxnDraft(Math.max(1, Math.min(10000, Number(e.target.value) || 1)))}
                    slotProps={{ htmlInput: { min: 1, max: 10000 } }}
                    sx={{
                      width: 110,
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'var(--input-bg)',
                        borderRadius: 0,
                        '& fieldset': { borderColor: 'var(--border-col)' },
                        '&:hover fieldset': { borderColor: colorPalette.primary },
                        '&.Mui-focused fieldset': { borderColor: colorPalette.primary, borderWidth: '1px' },
                      },
                      '& .MuiOutlinedInput-input': { fontSize: '0.875rem', fontFamily: 'Jost', py: '10px', px: '12px', color: 'var(--heading-color)' },
                    }}
                  />
                  <Chip
                    label={dailyTxnDraft === 10 ? 'Default' : dailyTxnDraft < 10 ? 'Stricter' : 'Permissive'}
                    size="small"
                    sx={{
                      borderRadius: 0,
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      bgcolor: dailyTxnDraft === 10 ? '#f0fdf4' : dailyTxnDraft < 10 ? '#fef2f2' : '#fffbeb',
                      color:  dailyTxnDraft === 10 ? '#10b981' : dailyTxnDraft < 10 ? '#dc2626' : '#d97706',
                    }}
                  />
                </Box>
              </Box>
              <Box sx={{ flex: 1, minWidth: 220, bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)', px: 2.5, py: 2 }}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                  How this rule works
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.6 }}>
                  When a customer exceeds <strong>{dailyTxnDraft}</strong> transaction{dailyTxnDraft !== 1 ? 's' : ''} within 24 hours, the engine raises a <strong>pat-5</strong> frequency alert and adds it to the transaction risk score. Raise this for high-frequency customers (merchants, agents); lower it for stricter monitoring.
                </Typography>
              </Box>
              {canModify && amlSettings && dailyTxnDraft !== amlSettings.dailyTxnLimit && (
                <Box sx={{ display: 'flex', alignItems: 'flex-end', pb: 0.25 }}>
                  <Button
                    variant="contained"
                    size="small"
                    disabled={dailyTxnSaving}
                    onClick={async () => {
                      setDailyTxnSaving(true)
                      try {
                        const res = await amlApi.updateDailyTxnLimit(dailyTxnDraft)
                        setAmlSettings(res.settings)
                        setDailyTxnDraft(res.settings.dailyTxnLimit)
                      } catch { /* keep draft */ }
                      finally { setDailyTxnSaving(false) }
                    }}
                    sx={{ bgcolor: colorPalette.primary, color: '#fff', fontWeight: 700, fontSize: '0.8rem', px: 3, borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: '#1539a8' } }}
                  >
                    {dailyTxnSaving ? 'Saving…' : 'Save'}
                  </Button>
                </Box>
              )}
            </Box>
          </Box>

          {/* Expected Daily Transaction Volume — baseline for the Surge Alert */}
          <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', borderRadius: 0 }}>
            <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)' }}>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                Expected Daily Transaction Volume
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                Your institution's normal number of transactions per day — used as the baseline for the Sudden Transaction Surge Alert
              </Typography>
            </Box>
            <Box sx={{ px: 3, py: 3, display: 'flex', alignItems: 'flex-start', gap: 4, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Transactions per day
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <TextField
                    type="number"
                    size="small"
                    value={expectedTxnDraft}
                    disabled={!canModify}
                    onChange={e => canModify && setExpectedTxnDraft(Math.max(1, Math.min(10_000_000, Number(e.target.value) || 1)))}
                    slotProps={{ htmlInput: { min: 1, max: 10000000 } }}
                    sx={{
                      width: 130,
                      '& .MuiOutlinedInput-root': {
                        bgcolor: 'var(--input-bg)', borderRadius: 0,
                        '& fieldset': { borderColor: 'var(--border-col)' },
                        '&:hover fieldset': { borderColor: colorPalette.primary },
                        '&.Mui-focused fieldset': { borderColor: colorPalette.primary, borderWidth: '1px' },
                      },
                      '& .MuiOutlinedInput-input': { fontSize: '0.875rem', fontFamily: 'Jost', py: '10px', px: '12px', color: 'var(--heading-color)' },
                    }}
                  />
                  {canModify && amlSettings && expectedTxnDraft !== amlSettings.expectedDailyTxnCount && (
                    <Button
                      variant="contained"
                      size="small"
                      disabled={expectedTxnSaving}
                      onClick={async () => {
                        setExpectedTxnSaving(true)
                        try {
                          const res = await amlApi.updateExpectedDailyTxnCount(expectedTxnDraft)
                          setAmlSettings(res.settings)
                          setExpectedTxnDraft(res.settings.expectedDailyTxnCount)
                        } catch { /* keep draft */ }
                        finally { setExpectedTxnSaving(false) }
                      }}
                      sx={{ bgcolor: colorPalette.primary, color: '#fff', fontWeight: 700, fontSize: '0.8rem', px: 3, borderRadius: 0, textTransform: 'none', '&:hover': { bgcolor: '#1539a8' } }}
                    >
                      {expectedTxnSaving ? 'Saving…' : 'Save'}
                    </Button>
                  )}
                </Box>
              </Box>
              <Box sx={{ flex: 1, minWidth: 220, bgcolor: 'var(--section-bg)', border: '1px solid var(--border-col)', px: 2.5, py: 2 }}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                  How this is used
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.6 }}>
                  When today's transaction count exceeds <strong>{expectedTxnDraft.toLocaleString()}</strong> by your configured surge threshold (e.g. +30%), the system creates a platform-wide alert and notifies your compliance team to investigate. Set this to your typical busiest-day volume so the alert only fires on genuine anomalies.
                </Typography>
              </Box>
            </Box>
          </Box>

          </>
          )}

          {(activeTab === 1 && !isBuildOne) && (
          <Box sx={{ position: 'relative' }}>
          <ComingSoonOverlay title="Behavioral Pattern Rules" />
          {/* Behavioral Pattern Rules Config Card */}
          <Box sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--border-col)', borderRadius: 0 }}>
            <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                  Behavioral Pattern Rules
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.25 }}>
                  Configure parameters for detecting complex fraud topologies
                </Typography>
              </Box>
            </Box>

            {behLoading && (
              <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[...Array(3)].map((_, i) => (
                  <Box key={i} sx={{ height: 100, bgcolor: 'var(--section-bg)', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } }, animationDelay: `${i * 60}ms` }} />
                ))}
              </Box>
            )}

            <Stack gap={0}>
              {!behLoading && behRules.map((p) => {
                const cat = categoryConfig[p.category] || categoryConfig['Temporal']
                const sev = severityConfig[p.severity] || severityConfig['medium']
                const hasDraft = behDrafts[p.id] !== undefined && Object.keys(behDrafts[p.id]).length > 0
                const plang = patternLanguage[p.ruleId]

                return (
                  <Box
                    key={p.id}
                    data-ai-analyzable="true"
                    data-ai-description={`Behavioral Pattern Config: "${p.name}". Severity: ${p.severity}. Matched Typology: ${p.matchedTypology}. Active: ${p.isActive}.`}
                    sx={{
                      borderBottom: '1px solid var(--border-col)',
                      overflow: 'hidden',
                      opacity: p.isActive ? 1 : 0.6,
                      '&:last-child': { borderBottom: 'none' }
                    }}
                  >
                    {/* Header */}
                    <Box sx={{ px: 3, py: 2.25, borderBottom: '1px solid var(--border-col)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: 1, mr: 2 }}>
                        <Box sx={{ width: 36, height: 36, borderRadius: 0, bgcolor: `${cat.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cat.color, flexShrink: 0, mt: 0.25 }}>
                          {cat.icon}
                        </Box>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.375 }}>
                            <Typography sx={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                              {p.name}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                {p.category}
                              </Typography>
                              <Box sx={{ width: 3, height: 3, bgcolor: '#cbd5e1' }} />
                              <Typography sx={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 500 }}>
                                {p.matchedTypology}
                              </Typography>
                            </Box>
                          </Box>
                          {plang && (
                            <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.65, maxWidth: 560 }}>
                              {plang.tagline}
                            </Typography>
                          )}
                        </Box>
                      </Box>

                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                        <Chip
                          label={p.severity.toUpperCase()}
                          size="small"
                          sx={{ bgcolor: sev.bg, color: sev.color, fontWeight: 700, fontSize: '0.6875rem', letterSpacing: '0.1em', borderRadius: 0, height: 24 }}
                        />
                        <Tooltip title={!canModify ? 'Requires rules.modify permission' : ''} placement="left">
                          <span>
                            <Switch
                              checked={p.isActive}
                              disabled={!canModify}
                              onChange={(e) => canModify && setBehPendingSave({ rule: p, newActive: e.target.checked })}
                              sx={{
                                '& .MuiSwitch-track': { borderRadius: 8 },
                                '& .Mui-checked + .MuiSwitch-track': { bgcolor: `${colorPalette.primary} !important`, opacity: '1 !important' },
                              }}
                            />
                          </span>
                        </Tooltip>
                      </Box>
                    </Box>

                    {/* Why this pattern exists */}
                    {plang && (
                      <Box sx={{ px: 3, py: 2, borderBottom: '1px solid var(--border-col)', bgcolor: '#fffbeb', display: 'flex', gap: 1.5 }}>
                        <Box sx={{ width: 3, flexShrink: 0, bgcolor: '#f59e0b', borderRadius: '2px', alignSelf: 'stretch' }} />
                        <Box>
                          <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.625 }}>
                            Why this rule exists
                          </Typography>
                          <Typography sx={{ fontSize: '0.8125rem', color: '#78350f', lineHeight: 1.75 }}>
                            {plang.whyItMatters}
                          </Typography>
                        </Box>
                      </Box>
                    )}

                    {/* Mad Libs Builder */}
                    <Box sx={{ px: 3, pt: 2.5, pb: 2, bgcolor: '#fbfcfd' }}>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mb: 1.25 }}>
                        Configure trigger conditions
                      </Typography>
                      {renderMadLibs(p)}

                      {hasDraft && canModify && (
                        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
                          <Button
                            variant="outlined"
                            onClick={() => {
                              setBehDrafts(prev => {
                                const n = { ...prev }
                                delete n[p.id]
                                return n
                              })
                            }}
                            sx={{ color: 'var(--on-surface-variant)', borderColor: '#cbd5e1', textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', borderRadius: 0 }}
                          >
                            Discard
                          </Button>
                          <Button
                            variant="contained"
                            onClick={() => setBehPendingSave({ rule: p, newParams: { ...p.params, ...behDrafts[p.id] } })}
                            sx={{ bgcolor: colorPalette.primary, color: '#ffffff', textTransform: 'none', fontWeight: 600, fontFamily: 'Jost', boxShadow: 'none', borderRadius: 0 }}
                          >
                            Save Configuration
                          </Button>
                        </Box>
                      )}
                    </Box>

                    {/* Example + Recommendation */}
                    <Box sx={{ borderTop: '1px solid var(--border-col)' }}>
                      <Box sx={{ px: 3, py: 2, display: 'flex', gap: 1.5, borderBottom: plang ? '1px solid var(--border-col)' : 'none' }}>
                        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', mt: 0.25, width: 70, flexShrink: 0 }}>
                          Example
                        </Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', fontFamily: 'SF Mono, Monaco, monospace', lineHeight: 1.65 }}>
                          {p.example}
                        </Typography>
                      </Box>

                      {plang && (
                        <Box sx={{ px: 3, py: 2, bgcolor: '#f0fdf4', display: 'flex', gap: 1.5 }}>
                          <Box sx={{ width: 3, flexShrink: 0, bgcolor: '#10b981', borderRadius: '2px', alignSelf: 'stretch' }} />
                          <Box>
                            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.08em', mb: 0.625 }}>
                              💡 How to tune this rule
                            </Typography>
                            <Typography sx={{ fontSize: '0.8125rem', color: '#166534', lineHeight: 1.75 }}>
                              {plang.recommendation}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Box>
                )
              })}
            </Stack>
          </Box>
          </Box>
          )}

          {((activeTab === 1 && isBuildOne) || (activeTab === 2 && !isBuildOne)) && (
            <Box sx={{ mt: 3 }}>
              {!amlSettings ? (
                <Box sx={{ height: 200, bgcolor: 'var(--section-bg)', animation: 'pulse 1.5s ease-in-out infinite', borderRadius: '8px' }} />
              ) : (
                <Stack gap={5}>
                  
                  {/* Transaction Scoring Thresholds */}
                  <Box>
                    <Typography sx={{ fontSize: '1.125rem', fontWeight: 500, color: 'var(--heading-color)', fontFamily: 'Jost', mb: 3, pb: 1, borderBottom: '1px solid var(--border-col)' }}>
                      Transaction Scoring
                    </Typography>
                    <Stack gap={3}>
                      <Typography sx={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6 }}>
                        Drag the boundary handles to set risk zones. Transactions are scored 0–100 — configure exactly where automated flagging and case creation activate.
                      </Typography>
                      <RiskSeekbar
                        values={[
                          amlDrafts.riskScoreNormalThreshold ?? amlSettings.riskScoreNormalThreshold ?? 45,
                          amlDrafts.riskScoreCaseThreshold ?? amlSettings.riskScoreCaseThreshold ?? 85,
                        ]}
                        onChange={canModify ? ([v0, v1]) =>
                          setAmlDrafts(prev => ({
                            ...prev,
                            riskScoreNormalThreshold: v0,
                            riskScoreFlagThreshold: v0,
                            riskScoreCaseThreshold: v1,
                          })) : () => {}}
                      />
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
                        {[
                          {
                            label: 'Normal',
                            range: `0 – ${(amlDrafts.riskScoreNormalThreshold ?? amlSettings.riskScoreNormalThreshold ?? 45) - 1}`,
                            note: 'Processed automatically without scrutiny.',
                            bg: '#f0fdf4', border: '#bbf7d0', title: '#15803d', sub: '#166534',
                          },
                          {
                            label: 'Flagged',
                            range: `${amlDrafts.riskScoreNormalThreshold ?? amlSettings.riskScoreNormalThreshold ?? 45} – ${(amlDrafts.riskScoreCaseThreshold ?? amlSettings.riskScoreCaseThreshold ?? 85) - 1}`,
                            note: 'Queued for analyst review.',
                            bg: '#fffbeb', border: '#fde68a', title: '#d97706', sub: '#92400e',
                          },
                          {
                            label: 'Case',
                            range: `${amlDrafts.riskScoreCaseThreshold ?? amlSettings.riskScoreCaseThreshold ?? 85} – 100`,
                            note: 'Investigation case auto-opened.',
                            bg: '#fff1f2', border: '#fecdd3', title: '#b91c1c', sub: '#7f1d1d',
                          },
                        ].map(({ label, range, note, bg, border, title, sub }) => (
                          <Box key={label} sx={{ p: 2, bgcolor: bg, borderRadius: 0, border: `1px solid ${border}` }}>
                            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 800, color: title, fontFamily: 'Jost', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                              {label}
                            </Typography>
                            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: title, fontFamily: 'SF Mono, Monaco, monospace', mb: 0.25 }}>
                              {range}
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: sub, lineHeight: 1.45 }}>
                              {note}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Stack>
                  </Box>

                  {/* Behavioral Scoring Thresholds */}
                  {!isBuildOne && (
                    <Box sx={{ mt: 2 }}>
                      <Typography sx={{ fontSize: '1.125rem', fontWeight: 500, color: 'var(--heading-color)', fontFamily: 'Jost', mb: 3, pb: 1, borderBottom: '1px solid var(--border-col)' }}>
                        Behavioral Analysis Scoring
                      </Typography>
                      <Stack gap={3}>
                        <Typography sx={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6 }}>
                          Behavioral pattern scores are generated by the topology engine. Set zone boundaries to control when a pattern match triggers a review flag or opens an investigation case.
                        </Typography>
                        <RiskSeekbar
                          values={[
                            amlDrafts.behRiskScoreNormalThreshold ?? amlSettings.behRiskScoreNormalThreshold ?? 45,
                            amlDrafts.behRiskScoreCaseThreshold ?? amlSettings.behRiskScoreCaseThreshold ?? 85,
                          ]}
                          zoneLabels={['Normal', 'Suspicious', 'Case']}
                          onChange={canModify ? ([v0, v1]) =>
                            setAmlDrafts(prev => ({
                              ...prev,
                              behRiskScoreNormalThreshold: v0,
                              behRiskScoreFlagThreshold: v0,
                              behRiskScoreCaseThreshold: v1,
                            })) : () => {}}
                        />
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
                          {[
                            {
                              label: 'Normal',
                              range: `0 – ${(amlDrafts.behRiskScoreNormalThreshold ?? amlSettings.behRiskScoreNormalThreshold ?? 45) - 1}`,
                              note: 'Pattern within expected bounds.',
                              bg: '#f0fdf4', border: '#bbf7d0', title: '#15803d', sub: '#166534',
                            },
                            {
                              label: 'Suspicious',
                              range: `${amlDrafts.behRiskScoreNormalThreshold ?? amlSettings.behRiskScoreNormalThreshold ?? 45} – ${(amlDrafts.behRiskScoreCaseThreshold ?? amlSettings.behRiskScoreCaseThreshold ?? 85) - 1}`,
                              note: 'Anomalous pattern flagged for review.',
                              bg: '#fffbeb', border: '#fde68a', title: '#d97706', sub: '#92400e',
                            },
                            {
                              label: 'Case',
                              range: `${amlDrafts.behRiskScoreCaseThreshold ?? amlSettings.behRiskScoreCaseThreshold ?? 85} – 100`,
                              note: 'Severe anomaly — case auto-opened.',
                              bg: '#fff1f2', border: '#fecdd3', title: '#b91c1c', sub: '#7f1d1d',
                            },
                          ].map(({ label, range, note, bg, border, title, sub }) => (
                            <Box key={label} sx={{ p: 2, bgcolor: bg, borderRadius: 0, border: `1px solid ${border}` }}>
                              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 800, color: title, fontFamily: 'Jost', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                                {label}
                              </Typography>
                              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: title, fontFamily: 'SF Mono, Monaco, monospace', mb: 0.25 }}>
                                {range}
                              </Typography>
                              <Typography sx={{ fontSize: '0.75rem', color: sub, lineHeight: 1.45 }}>
                                {note}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </Stack>
                    </Box>
                  )}

                  {/* KYC Risk Profile Score */}
                  <Box>
                    <Typography sx={{ fontSize: '1.125rem', fontWeight: 500, color: 'var(--heading-color)', fontFamily: 'Jost', mb: 3, pb: 1, borderBottom: '1px solid var(--border-col)' }}>
                      Risk Profile Score
                    </Typography>
                    <Stack gap={3}>
                      <Typography sx={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.6 }}>
                        KYC pipeline results are scored 0–100 and mapped to a customer risk profile. Configure the boundaries that determine whether a customer is cleared, flagged for review, or escalated to an open case.
                      </Typography>
                      <RiskSeekbar
                        values={[
                          amlDrafts.kycRiskNormalThreshold ?? amlSettings!.kycRiskNormalThreshold ?? 40,
                          amlDrafts.kycRiskCaseThreshold ?? amlSettings!.kycRiskCaseThreshold ?? 75,
                        ]}
                        zoneLabels={['Normal', 'Flagged', 'Open Case']}
                        onChange={canModify ? ([v0, v1]) =>
                          setAmlDrafts(prev => ({
                            ...prev,
                            kycRiskNormalThreshold: v0,
                            kycRiskCaseThreshold: v1,
                          })) : () => {}}
                      />
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
                        {[
                          {
                            label: 'Normal',
                            range: `0 – ${(amlDrafts.kycRiskNormalThreshold ?? amlSettings!.kycRiskNormalThreshold ?? 40) - 1}`,
                            note: 'Customer KYC cleared — no action required.',
                            bg: '#f0fdf4', border: '#bbf7d0', title: '#15803d', sub: '#166534',
                          },
                          {
                            label: 'Flagged',
                            range: `${amlDrafts.kycRiskNormalThreshold ?? amlSettings!.kycRiskNormalThreshold ?? 40} – ${(amlDrafts.kycRiskCaseThreshold ?? amlSettings!.kycRiskCaseThreshold ?? 75) - 1}`,
                            note: 'KYC incomplete or mismatched — queued for review.',
                            bg: '#fffbeb', border: '#fde68a', title: '#d97706', sub: '#92400e',
                          },
                          {
                            label: 'Open Case',
                            range: `${amlDrafts.kycRiskCaseThreshold ?? amlSettings!.kycRiskCaseThreshold ?? 75} – 100`,
                            note: 'High-risk profile — investigation case opened.',
                            bg: '#fff1f2', border: '#fecdd3', title: '#b91c1c', sub: '#7f1d1d',
                          },
                        ].map(({ label, range, note, bg, border, title, sub }) => (
                          <Box key={label} sx={{ p: 2, bgcolor: bg, borderRadius: 0, border: `1px solid ${border}` }}>
                            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 800, color: title, fontFamily: 'Jost', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                              {label}
                            </Typography>
                            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: title, fontFamily: 'SF Mono, Monaco, monospace', mb: 0.25 }}>
                              {range}
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: sub, lineHeight: 1.45 }}>
                              {note}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Stack>
                  </Box>

                  {(Object.keys(amlDrafts).length > 0) && canModify && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, pt: 4, mt: 2, borderTop: '1px solid var(--border-col)' }}>
                      <Button onClick={() => setAmlDrafts({})} sx={{ textTransform: 'none', color: 'var(--on-surface-variant)', fontSize: '0.9375rem', fontWeight: 600 }}>
                        Discard Changes
                      </Button>
                      <Button
                        variant="contained"
                        onClick={() => setAmlPendingSave(amlDrafts)}
                        sx={{ textTransform: 'none', bgcolor: 'var(--heading-color)', color: '#ffffff', fontSize: '0.9375rem', fontWeight: 600, px: 4, py: 1, borderRadius: 0, boxShadow: 'none', '&:hover': { bgcolor: 'var(--on-surface)' } }}
                      >
                        Apply Thresholds
                      </Button>
                    </Box>
                  )}
                </Stack>
              )}
            </Box>
          )}
      </Stack>

      {activeTab === 0 && (
      <Box>
      {/* KYC Tier Rules Section */}
      <Box ref={kycRef} sx={{ mt: 8, mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <VerifiedOutlinedIcon sx={{ color: colorPalette.primary, fontSize: '1.5rem' }} />
          <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
            KYC Tier-Based Limits
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '0.875rem', color: '#64748b', mb: 4 }}>
          Define different transaction thresholds based on your customer's verification level.
        </Typography>

        {/* Tier cards */}
        <Box sx={{ position: 'relative' }}>
          <Box>
        <Grid container spacing={3}>
          {kycTiers.map((tier) => (
            <Grid key={tier.kycTier} size={{ xs: 12, md: 6 }}>
              <Box sx={{ p: 2.5, border: '1px solid var(--border-col)', bgcolor: 'var(--card-bg)', height: '100%' }}>
                {/* Card header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography sx={{ fontSize: '0.5625rem', fontWeight: 700, color: colorPalette.primary, textTransform: 'uppercase', letterSpacing: '0.1em', mb: 0.25 }}>
                      Tier {tier.kycTier}
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--heading-color)', fontFamily: 'Jost' }}>
                      {tier.kycTier === 0 ? 'Unverified' : tier.kycTier === 1 ? 'Basic' : tier.kycTier === 2 ? 'Intermediate' : 'Full KYC'}
                    </Typography>
                  </Box>
                  <Chip
                    label={tier.riskScoreBoost > 0 ? `+${tier.riskScoreBoost} Risk Boost` : 'Standard Risk'}
                    size="small"
                    sx={{ borderRadius: 0, fontSize: '0.625rem', fontWeight: 700, bgcolor: tier.riskScoreBoost > 0 ? '#fef2f2' : '#f0fdf4', color: tier.riskScoreBoost > 0 ? '#dc2626' : '#10b981' }}
                  />
                </Box>

                {/* Daily limits table */}
                <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.75 }}>
                  Daily Limits (₦)
                </Typography>
                {/* Column headers */}
                <Box sx={{ display: 'grid', gridTemplateColumns: '72px 1fr 1fr', gap: 0.5, mb: 0.5 }}>
                  <Box />
                  <Typography sx={{ fontSize: '0.5625rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Inward ↓</Typography>
                  <Typography sx={{ fontSize: '0.5625rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' }}>Outward ↑</Typography>
                </Box>
                <Stack gap={0.5}>
                  {([
                    { label: 'Wire',   inField: 'daily_limit_wire_inward',    outField: 'daily_limit_wire_outward',    inVal: tier.dailyLimitWireInward   ?? tier.dailyLimitWire,   outVal: tier.dailyLimitWireOutward   ?? 0 },
                    { label: 'Mobile', inField: 'daily_limit_mobile_inward',  outField: 'daily_limit_mobile_outward',  inVal: tier.dailyLimitMobileInward  ?? tier.dailyLimitMobile, outVal: tier.dailyLimitMobileOutward  ?? 0 },
                    { label: 'USSD',   inField: 'daily_limit_ussd_inward',    outField: 'daily_limit_ussd_outward',    inVal: tier.dailyLimitUssdInward    ?? tier.dailyLimitUssd,   outVal: tier.dailyLimitUssdOutward    ?? 0 },
                    { label: 'BDC',    inField: 'daily_limit_bdc_inward',     outField: 'daily_limit_bdc_outward',     inVal: tier.dailyLimitBdcInward     ?? tier.dailyLimitBdc,    outVal: tier.dailyLimitBdcOutward     ?? 0 },
                    { label: 'Other',  inField: 'daily_limit_other_inward',   outField: 'daily_limit_other_outward',   inVal: tier.dailyLimitOtherInward   ?? tier.dailyLimitOther,  outVal: tier.dailyLimitOtherOutward   ?? 0 },
                  ] as const).map(({ label, inField, outField, inVal, outVal }) => (
                    <Box key={label} sx={{ display: 'grid', gridTemplateColumns: '72px 1fr 1fr', gap: 0.5, alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--on-surface-variant)' }}>{label}</Typography>
                      {([{ field: inField, val: inVal }, { field: outField, val: outVal }] as const).map(({ field, val }) => (
                        <Box key={field} sx={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-col)', bgcolor: 'var(--input-bg)', '&:focus-within': { borderColor: colorPalette.primary, bgcolor: 'var(--card-bg)' } }}>
                          <Typography sx={{ px: 0.75, fontSize: '0.625rem', color: '#94a3b8', borderRight: '1px solid var(--border-col)', flexShrink: 0, lineHeight: '26px' }}>₦</Typography>
                          <Box
                            component="input"
                            type="number"
                            value={val}
                            disabled={!canModify}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              canModify && handleUpdateTierRule(tier.kycTier, field, parseInt(e.target.value) || 0)
                            }
                            sx={{
                              flex: 1, border: 'none', outline: 'none', px: 0.75, py: 0.375,
                              fontSize: '0.6875rem', fontFamily: 'SF Mono, Monaco, monospace',
                              color: 'var(--heading-color)', bgcolor: 'transparent', width: 0,
                              opacity: canModify ? 1 : 0.6,
                              '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': { WebkitAppearance: 'none' },
                            }}
                          />
                        </Box>
                      ))}
                    </Box>
                  ))}
                </Stack>

                {/* Risk Score Boost */}
                <Box sx={{ mt: 2 }}>
                  <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.07em', mb: 0.75 }}>Risk Score Boost</Typography>
                  <Slider
                    value={tier.riskScoreBoost}
                    disabled={!canModify}
                    onChange={(_, v) => canModify && handleUpdateTierRule(tier.kycTier, 'risk_score_boost', v as number)}
                    min={0}
                    max={50}
                    step={5}
                    valueLabelDisplay="auto"
                    sx={{ color: colorPalette.primary, py: 0.75 }}
                  />
                  <Typography sx={{ fontSize: '0.625rem', color: '#94a3b8' }}>
                    Adds {tier.riskScoreBoost} points to risk score for every transaction from this tier.
                  </Typography>
                </Box>
              </Box>
            </Grid>
          ))}
        </Grid>
          </Box>{/* /opacity wrapper */}
        </Box>{/* /relative wrapper */}
      </Box>

      </Box>
      )}

      {/* TOTP — save threshold value */}
      <TOTPConfirmation
        open={!!pendingSave}
        onClose={() => setPendingSave(null)}
        onConfirm={handleSaveConfirm}
        operation="update"
        title={pendingSave?.newValue === null ? `Disable ${pendingSave?.direction} threshold` : 'Update detection threshold'}
        description={
          pendingSave?.newValue === null
            ? `This rule will no longer fire for ${pendingSave?.direction} transactions.`
            : "You're updating an active rule that affects how transactions are flagged for review. Confirm with your authenticator code to proceed."
        }
        resourceType="Rule"
        resourceName={pendingSave?.rule.name ?? ''}
        changes={pendingSave ? [{
          field: pendingSave.direction === 'outward' ? 'Outward threshold' : 'Inward threshold',
          from: (() => {
            const cur = pendingSave.direction === 'outward' ? pendingSave.rule.thresholdOutward : pendingSave.rule.thresholdInward
            return cur !== null ? fmtThreshold(pendingSave.rule, cur!) : 'Disabled'
          })(),
          to: pendingSave.newValue !== null ? fmtThreshold(pendingSave.rule, pendingSave.newValue) : 'Disabled',
        }] : []}
      />

      {/* TOTP — toggle active/paused */}
      <TOTPConfirmation
        open={!!pendingToggle}
        onClose={() => setPendingToggle(null)}
        onConfirm={handleToggleConfirm}
        operation="update"
        title={pendingToggle?.newActive ? 'Activate this rule' : 'Pause this rule'}
        description={
          pendingToggle?.newActive
            ? 'Activating this rule will immediately start scoring transactions against it.'
            : 'Pausing this rule will stop new alerts from firing. Existing cases remain open.'
        }
        resourceType="Rule"
        resourceName={pendingToggle?.rule.name ?? ''}
        changes={pendingToggle ? [{
          field: 'Status',
          from: pendingToggle.rule.isActive ? 'Active' : 'Paused',
          to: pendingToggle.newActive ? 'Active' : 'Paused',
        }] : []}
      />

      {/* TOTP — behavioral rules */}
      <TOTPConfirmation
        open={!!behPendingSave}
        onClose={() => setBehPendingSave(null)}
        onConfirm={handleBehSaveConfirm}
        operation="update"
        title={behPendingSave?.newActive !== undefined ? (behPendingSave.newActive ? 'Activate this rule' : 'Pause this rule') : 'Update Rule Configuration'}
        description={
          behPendingSave?.newActive !== undefined
            ? (behPendingSave.newActive ? 'Activating this rule will immediately start hunting for this pattern.' : 'Pausing this rule will stop new alerts from firing.')
            : 'You are modifying the detection thresholds for this pattern. Confirm with your authenticator code to apply the new rules.'
        }
        resourceType="Pattern"
        resourceName={behPendingSave?.rule.name ?? ''}
        changes={behPendingSave?.newParams ? Object.entries(behPendingSave.newParams).map(([k, v]) => ({
          field: k,
          from: String(behPendingSave.rule.params[k]),
          to: String(v)
        })) : behPendingSave?.newActive !== undefined ? [{
          field: 'Status',
          from: behPendingSave.rule.isActive ? 'Active' : 'Paused',
          to: behPendingSave.newActive ? 'Active' : 'Paused'
        }] : []}
      />


      {/* TOTP — aml settings */}
      <TOTPConfirmation
        open={!!amlPendingSave}
        onClose={() => setAmlPendingSave(null)}
        onConfirm={handleAmlSaveConfirm}
        operation="update"
        title="Update Risk Score Configuration"
        description="You are modifying the risk score thresholds for automatic flagging and case creation. Confirm with your authenticator code to apply."
        resourceType="Risk Score Thresholds"
        resourceName="Global Settings"
        changes={amlPendingSave ? [
          ...(amlPendingSave.riskScoreNormalThreshold !== undefined ? [{
            field: 'Transaction Flag Boundary',
            from: amlSettings?.riskScoreNormalThreshold !== undefined ? String(amlSettings.riskScoreNormalThreshold) : '—',
            to: String(amlPendingSave.riskScoreNormalThreshold)
          }] : []),
          ...(amlPendingSave.riskScoreCaseThreshold !== undefined ? [{
            field: 'Transaction Case Threshold',
            from: amlSettings?.riskScoreCaseThreshold !== undefined ? String(amlSettings.riskScoreCaseThreshold) : '—',
            to: String(amlPendingSave.riskScoreCaseThreshold)
          }] : []),
          ...(amlPendingSave.behRiskScoreNormalThreshold !== undefined ? [{
            field: 'Behavioral Flag Boundary',
            from: amlSettings?.behRiskScoreNormalThreshold !== undefined ? String(amlSettings.behRiskScoreNormalThreshold) : '—',
            to: String(amlPendingSave.behRiskScoreNormalThreshold)
          }] : []),
          ...(amlPendingSave.behRiskScoreCaseThreshold !== undefined ? [{
            field: 'Behavioral Case Threshold',
            from: amlSettings?.behRiskScoreCaseThreshold !== undefined ? String(amlSettings.behRiskScoreCaseThreshold) : '—',
            to: String(amlPendingSave.behRiskScoreCaseThreshold)
          }] : [])
        ] : []}
      />

      {/* Audit Log Dialog */}
      <Dialog open={auditOpen} onClose={() => setAuditOpen(false)} maxWidth="lg" fullWidth slotProps={{ paper: { sx: { borderRadius: 0, height: '80vh', display: 'flex', flexDirection: 'column' } } }}>
        <DialogTitle sx={{ fontFamily: 'Jost', fontWeight: 800, fontSize: '1.125rem', color: 'var(--heading-color)', borderBottom: '1px solid var(--border-col)', pb: 2, flexShrink: 0 }}>
          Threshold Change Log
        </DialogTitle>

        {/* Filter toolbar */}
        <Box sx={{ px: 3, py: 1.75, borderBottom: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', bgcolor: 'var(--card-bg)', flexShrink: 0 }}>
          <TextField
            size="small"
            placeholder="Filter by rule or field…"
            value={auditFilter}
            onChange={e => { setAuditFilter(e.target.value); setAuditPage(0) }}
            sx={{ flex: 1, minWidth: 200, '& .MuiOutlinedInput-root': { borderRadius: 0, fontSize: '0.8125rem' } }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', flexShrink: 0 }}>From</Typography>
            <TextField
              type="date"
              size="small"
              value={auditDateFrom}
              onChange={e => { setAuditDateFrom(e.target.value); setAuditPage(0) }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0, fontSize: '0.8125rem' } }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', flexShrink: 0 }}>To</Typography>
            <TextField
              type="date"
              size="small"
              value={auditDateTo}
              onChange={e => { setAuditDateTo(e.target.value); setAuditPage(0) }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0, fontSize: '0.8125rem' } }}
            />
          </Box>
          <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', flexShrink: 0 }}>
            {filteredAuditChanges.length} result{filteredAuditChanges.length !== 1 ? 's' : ''}
          </Typography>
        </Box>

        <DialogContent sx={{ p: 0, overflow: 'auto', flex: 1 }}>
          {auditLoading ? (
            <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {[...Array(5)].map((_, i) => (
                <Box key={i} sx={{ height: 48, bgcolor: 'var(--section-bg)', animation: 'pulse 1.5s ease-in-out infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } } }} />
              ))}
            </Box>
          ) : filteredAuditChanges.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                {auditChanges.length === 0 ? 'No changes recorded yet.' : 'No changes match your filters.'}
              </Typography>
            </Box>
          ) : (
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <Box component="thead" sx={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <Box component="tr" sx={{ bgcolor: 'var(--card-bg)' }}>
                  {['Rule', 'Field', 'From', 'To', 'Changed by', 'When'].map(h => (
                    <Box component="th" key={h} sx={{ px: 2, py: 1.25, textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border-col)' }}>
                      {h}
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {pagedAuditChanges.map(c => (
                  <Box component="tr" key={c.id} sx={{ borderBottom: '1px solid var(--border-col)', '&:last-child': { borderBottom: 'none' }, '&:hover': { bgcolor: 'var(--section-bg)' } }}>
                    <Box component="td" sx={{ px: 2, py: 1.25, fontWeight: 600, color: 'var(--heading-color)' }}>{c.ruleName ?? '—'}</Box>
                    <Box component="td" sx={{ px: 2, py: 1.25, color: 'var(--on-surface-variant)', fontFamily: 'SF Mono, Monaco, monospace', fontSize: '0.75rem' }}>{c.field}</Box>
                    <Box component="td" sx={{ px: 2, py: 1.25, color: '#64748b' }}>{c.oldValue ?? '—'}</Box>
                    <Box component="td" sx={{ px: 2, py: 1.25, color: '#10b981', fontWeight: 600 }}>{c.newValue}</Box>
                    <Box component="td" sx={{ px: 2, py: 1.25, color: 'var(--on-surface-variant)' }}>{c.changedByName}</Box>
                    <Box component="td" sx={{ px: 2, py: 1.25, color: '#94a3b8', whiteSpace: 'nowrap' }}>{new Date(c.createdAt).toLocaleString()}</Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </DialogContent>

        {/* Pagination */}
        {!auditLoading && filteredAuditChanges.length > AUDIT_PAGE_SIZE && (
          <Box sx={{ px: 3, py: 1.5, borderTop: '1px solid var(--border-col)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
              Showing {auditPage * AUDIT_PAGE_SIZE + 1}–{Math.min((auditPage + 1) * AUDIT_PAGE_SIZE, filteredAuditChanges.length)} of {filteredAuditChanges.length}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box
                onClick={() => { if (auditPage > 0) setAuditPage(p => p - 1) }}
                sx={{ px: 1.5, py: 0.5, border: '1px solid var(--border-col)', fontSize: '0.75rem', fontWeight: 600, color: auditPage === 0 ? '#cbd5e1' : '#475569', cursor: auditPage === 0 ? 'default' : 'pointer', borderRadius: 0, '&:hover': auditPage === 0 ? {} : { bgcolor: 'var(--section-bg)' } }}
              >
                Previous
              </Box>
              <Box
                onClick={() => { if ((auditPage + 1) * AUDIT_PAGE_SIZE < filteredAuditChanges.length) setAuditPage(p => p + 1) }}
                sx={{ px: 1.5, py: 0.5, border: '1px solid var(--border-col)', fontSize: '0.75rem', fontWeight: 600, color: (auditPage + 1) * AUDIT_PAGE_SIZE >= filteredAuditChanges.length ? '#cbd5e1' : '#475569', cursor: (auditPage + 1) * AUDIT_PAGE_SIZE >= filteredAuditChanges.length ? 'default' : 'pointer', borderRadius: 0, '&:hover': (auditPage + 1) * AUDIT_PAGE_SIZE >= filteredAuditChanges.length ? {} : { bgcolor: 'var(--section-bg)' } }}
              >
                Next
              </Box>
            </Box>
          </Box>
        )}
      </Dialog>

    </Box>)
}
