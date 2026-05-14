/**
 * Eureka Intelligence Brain
 * Implements a rule-based fuzzy matching system with context-aware memory and follow-up suggestions.
 */

export interface Message {
  role: 'user' | 'eureka'
  text: string
}

interface ResponseTemplate {
  keywords: string[]
  responses: string[]
  followUps?: string[]
}

const KNOWLEDGE_BASE: ResponseTemplate[] = [
  {
    keywords: ['risk', 'score', 'high', 'anomaly', 'calculate', 'basis'],
    responses: [
      "Risk scores in OpenIV are calculated using a multi-dimensional topology engine. We look at transaction velocity, historical channel usage, and geographic consistency. A score above 75 typically triggers an automatic flag for your review.",
      "Our risk model assigns a value from 0 to 100 based on several behavioral indicators. If you're seeing high scores for a specific customer, check their 30-day baseline in the Behavioral Patterns module for context.",
    ],
    followUps: ["How can I lower these scores?", "What happens if a score is 100?", "Show me high-risk transactions"]
  },
  {
    keywords: ['cost', 'bill', 'wallet', 'money', 'topup', 'price', 'naira', '₦', 'paystack'],
    responses: [
      "OpenIV operates on a prepaid model. You can top up your institution's wallet via Paystack. Actions like Beam ingestion are ₦0.10, while regulatory filings and KYC lookups are ₦500 and ₦50 respectively.",
      "Billing is transparent. Each SAR filed costs ₦500, and identity verifications are ₦50 per lookup. Data ingestion via Beam is billed at ₦0.10 per record.",
    ],
    followUps: ["Top up my wallet", "Show my last invoice", "How do I save on costs?"]
  },
  {
    keywords: ['nfiu', 'cbn', 'report', 'filing', 'sar', 'regulation', 'compliance', 'deadline'],
    responses: [
      "For CBN and NFIU compliance, ensure your 'Reports & Filings' are up to date. The platform tracks your mandatory filing windows and alerts you before deadlines.",
      "Regulatory filings like SARs (Suspicious Activity Reports) should include a clear narrative. You can automate recurring reports on a daily or weekly schedule.",
    ],
    followUps: ["When is my next deadline?", "How do I automate SARs?", "What is my compliance score?"]
  },
  {
    keywords: ['otp', 'alert', 'velocity', 'abuse', 'simswap', 'anomaly'],
    responses: [
      "OTP Defense monitors for velocity abuse and geographic impossibility. If an alert is triggered, it's usually because of multiple failed attempts or requests from disparate locations.",
      "SIM-swap indicators often appear as a sudden shift in device metadata during an OTP request. Our engine flags these as high-severity anomalies.",
    ],
    followUps: ["Show recent OTP alerts", "How do I block a user?", "What is geographic impossibility?"]
  },
  {
    keywords: ['kyc', 'identity', 'verify', 'tier', 'lookup'],
    responses: [
      "KYC lookups verify customer data against your configured provider. Tiers range from 1 (Basic) to 4 (Enhanced).",
      "You can configure your KYC integration endpoint under Settings. Each successful lookup costs ₦50.",
    ],
    followUps: ["Configure KYC provider", "What are the tier differences?", "Show failed lookups"]
  },
  {
    keywords: ['beam', 'api', 'key', 'integration', 'ingest', 'stream'],
    responses: [
      "Beam is our high-speed ingestion gateway. Generate an API key in the Beam module to start streaming data. Store the key securely!",
      "Integration usually takes less than an hour. Use our REST API to push events as they happen.",
    ],
    followUps: ["Generate new API key", "Is my stream healthy?", "API Documentation"]
  },
  {
    keywords: ['team', 'role', 'permission', 'invite', 'analyst', 'admin'],
    responses: [
      "Roles are scoped: Admins manage the platform; CCOs handle regulatory filings; Analysts investigate flags.",
      "To invite a team member, use their institutional email in the Team & Roles module.",
    ],
    followUps: ["Invite new member", "Create custom role", "Show audit log"]
  },
  {
    keywords: ['geofence', 'location', 'ip', 'login', 'security', 'nigeria', 'lagos', 'abuja', 'hotspot'],
    responses: [
      "Geofencing restricts access to specific geographic polygons. If an analyst logs in from outside Lagos or Abuja perimeters, their access is blocked.",
      "We monitor for geographic clusters of fraud. If you're seeing a spike in a specific LGA, use the Heatmaps module.",
    ],
    followUps: ["Draw new geofence", "Show GeoAccess requests", "Hotspot analysis"]
  }
]

const CONVERSATIONAL_KNOWLEDGE: ResponseTemplate[] = [
  {
    keywords: ['hello', 'hi', 'hey', 'greetings', 'morning', 'afternoon', 'evening'],
    responses: [
      "Hello! I'm Eureka, your compliance copilot. How can I help you today?",
      "Hi there! Ready to dive into some data? What's on your mind?",
      "Greetings. I've been monitoring the streams — everything looks stable. How can I assist?",
    ],
    followUps: ["Show my dashboard", "Any urgent alerts?", "What's my compliance score?"]
  },
  {
    keywords: ['joke', 'laugh', 'funny', 'entertainment'],
    responses: [
      "Why did the fraudster get kicked out of the party? He had too many 'red flags'.",
      "A compliance officer walks into a bar... and immediately checks the liquor license expiration date.",
      "Why do compliance officers love nature? Because of all the 'logs'.",
    ],
    followUps: ["Tell me another", "That was terrible", "Back to work"]
  },
  {
    keywords: ['thanks', 'thank', 'appreciate', 'cool', 'awesome', 'great'],
    responses: [
      "You're very welcome! I'm always here to help keep your institution safe.",
      "Happy to help! Let me know if there's anything else you need.",
      "Anytime! Compliance is a team effort.",
    ],
    followUps: ["One more thing...", "I'm done for now", "Check my balance"]
  },
  {
    keywords: ['help', 'what', 'can', 'do', 'features', 'capabilities'],
    responses: [
      "I can help you monitor transactions, manage AML cases, track CBN compliance, and configure system security like geofencing.",
      "I'm trained on your platform's data — I can explain risk scores, help you file SARs, or diagnose Beam integration issues.",
      "Think of me as your compliance assistant. I can fetch balance info, explain regulatory requirements, or just tell a joke if the stress gets too high.",
    ],
    followUps: ["Show features", "Help with AML", "Help with Billing"]
  },
  {
    keywords: ['who', 'are', 'you', 'identity', 'eureka', 'creator'],
    responses: [
      "I am Eureka, an advanced intelligence layer designed specifically for the OpenIV platform. I was built to assist compliance officers in navigating complex financial data.",
      "I'm your digital compliance copilot. My primary directive is to help your institution maintain a perfect posture score through real-time intelligence.",
    ],
    followUps: ["What can you do?", "How do you work?", "Who built you?"]
  },
  {
    keywords: ['stress', 'tired', 'hard', 'work', 'difficult'],
    responses: [
      "Compliance can be a heavy lift. Take a breath! I'm here to handle the repetitive monitoring so you can focus on the critical decisions.",
      "I understand. The regulatory landscape is constantly shifting. Why don't we start with something simple, like checking your daily alerts?",
    ],
    followUps: ["Tell a joke", "Show urgent alerts", "Check my balance"]
  }
]

const FALLBACK_RESPONSES = [
  "I'm sorry, I couldn't find a specific answer for that in my knowledge base. Would you like to rephrase?",
  "That's a bit outside my current scope. I'm specifically trained on OpenIV's compliance and risk workflows.",
  "I'm not quite sure about that one. Try asking about risk scores, thresholds, or filings.",
]

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\w\s₦]/g, '').trim()
}

/**
 * Resolves context by looking at history for pronouns or underspecified queries.
 */
function resolveContext(input: string, history: Message[]): string {
  const pronouns = ['it', 'that', 'those', 'them', 'this', 'there', 'they']
  const words = input.toLowerCase().split(/\s+/)
  const hasPronoun = words.some(w => pronouns.includes(w))
  
  if (hasPronoun || words.length < 3) {
    // Look for the last user message with substantive keywords
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'user') {
        return input + " " + history[i].text
      }
    }
  }
  return input
}

export function getEurekaResponse(input: string, history: Message[] = []): { text: string; followUps: string[] } {
  const contextualInput = resolveContext(input, history)
  const normalizedInput = normalize(contextualInput)
  const inputWords = normalizedInput.split(/\s+/)
  
  let bestMatch: ResponseTemplate | null = null
  let highestScore = 0

  const ALL_KNOWLEDGE = [...CONVERSATIONAL_KNOWLEDGE, ...KNOWLEDGE_BASE]

  for (const item of ALL_KNOWLEDGE) {
    let currentScore = 0
    for (const word of inputWords) {
      if (item.keywords.includes(word)) {
        currentScore += 2
      } else {
        for (const kw of item.keywords) {
          if (kw.length >= 4 && (word.includes(kw) || kw.includes(word))) {
            currentScore += 1
          }
        }
      }
    }

    if (currentScore > highestScore) {
      highestScore = currentScore
      bestMatch = item
    }
  }

  if (bestMatch && highestScore >= 2) {
    const responses = bestMatch.responses
    return {
      text: responses[Math.floor(Math.random() * responses.length)],
      followUps: bestMatch.followUps || []
    }
  }

  return {
    text: FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)],
    followUps: ["What can you do?", "Check my status", "Contact support"]
  }
}

export function getGreeting(): string {
  const GREETINGS = CONVERSATIONAL_KNOWLEDGE[0].responses
  return GREETINGS[Math.floor(Math.random() * GREETINGS.length)]
}
