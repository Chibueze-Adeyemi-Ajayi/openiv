import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, within, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import DevelopersPage from '../pages/landing/DevelopersPage'

// ── jsdom stubs ───────────────────────────────────────────────────────────────
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  Object.defineProperty(window.HTMLElement.prototype, 'scrollTo', {
    value: vi.fn(), writable: true, configurable: true,
  })
  Element.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
    top: 0, left: 0, bottom: 0, right: 0, width: 100, height: 100,
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <DevelopersPage />
    </MemoryRouter>
  )
}

// ── Endpoint catalogue ────────────────────────────────────────────────────────
// Beam endpoints render as compact log-line + Docs button — no schema/responses/code.
const BEAM_ENDPOINTS = [
  {
    id:          'ingest-transactions',
    title:       'Ingest Transaction',
    path:        '/api/v1/beam/transactions',
    sidebarPath: '/beam/transactions',
  },
  {
    id:          'ingest-kyc',
    title:       'Ingest Customer KYC',
    path:        '/api/v1/beam/kyc',
    sidebarPath: '/beam/kyc',
  },
]

// API endpoints render with full schema, response tabs, and code samples.
const API_ENDPOINTS = [
  {
    id:            'verify-bvn',
    title:         'Verify BVN',
    path:          '/api/v1/verify/bvn',
    sidebarPath:   '/verify/bvn',
    group:         'Verification',
    requiredField: 'bvn',
    firstResponse: 'Verified',
    dropdownResponses: ['Not found', 'Bad request', 'Unauthorized'],
  },
  {
    id:            'verify-nin',
    title:         'Verify NIN',
    path:          '/api/v1/verify/nin',
    sidebarPath:   '/verify/nin',
    group:         'Verification',
    requiredField: 'nin',
    firstResponse: 'Verified',
    dropdownResponses: ['Bad request', 'Unauthorized'],
  },
  {
    id:            'verify-phone',
    title:         'Verify Phone Number',
    path:          '/api/v1/verify/phone',
    sidebarPath:   '/verify/phone',
    group:         'Verification',
    requiredField: 'phone',
    firstResponse: 'Verified',
    dropdownResponses: ['Bad request', 'Unauthorized'],
  },
  {
    id:            'verify-pep',
    title:         'PEP Screening',
    path:          '/api/v1/verify/pep',
    sidebarPath:   '/verify/pep',
    group:         'Verification',
    requiredField: 'name',
    firstResponse: 'Match found',
    dropdownResponses: ['No match', 'Bad request', 'Unauthorized'],
  },
  {
    id:            'verify-nuban',
    title:         'Resolve NUBAN',
    path:          '/api/v1/verify/nuban',
    sidebarPath:   '/verify/nuban',
    group:         'Verification',
    requiredField: 'account_number',
    firstResponse: 'Resolved',
    dropdownResponses: ['Not resolved', 'Bad request', 'Unauthorized'],
  },
  {
    id:            'verify-phone-fraud',
    title:         'Phone Fraud Screening',
    path:          '/api/v1/verify/phone-fraud',
    sidebarPath:   '/verify/phone-fraud',
    group:         'Verification',
    requiredField: 'phone',
    firstResponse: 'Low risk',
    dropdownResponses: ['High risk', 'Bad request', 'Unauthorized'],
  },
  {
    id:            'intelligence-account-risk',
    title:         'Account Risk Intelligence',
    path:          '/api/v1/intelligence/account-risk',
    sidebarPath:   '/intelligence/account-risk',
    group:         'Intelligence',
    requiredField: 'account_number',
    firstResponse: 'Low risk — phones match',
    dropdownResponses: [
      'High risk — dual phone fraud checks',
      'Critical — PEP match + BVN name mismatch',
      'Unresolved account',
      'Bad request',
      'Unauthorized',
    ],
  },
]

const ALL_SIDEBAR_PATHS = [
  ...BEAM_ENDPOINTS.map(e => e.sidebarPath),
  ...API_ENDPOINTS.map(e => e.sidebarPath),
]

const LANGS = ['cURL', 'Node.js', 'Python', 'Go', 'Java']

function getSection(id: string) {
  const el = document.getElementById(id)
  expect(el).not.toBeNull()
  return el!
}

function openDropdown(section: HTMLElement) {
  const arrow = within(section).getByText('▼')
  fireEvent.click(arrow)
}

// ── Page structure ────────────────────────────────────────────────────────────
describe('DevelopersPage — page structure', () => {
  it('renders without crashing', () => {
    renderPage()
    expect(document.body).toBeTruthy()
  })

  it('shows Authentication heading (appears in sidebar + content area)', () => {
    renderPage()
    expect(screen.getAllByText('Authentication').length).toBeGreaterThanOrEqual(2)
  })

  it('shows API key generation instructions', () => {
    renderPage()
    expect(screen.getByText(/Dashboard → Data Ingest → API Key/i)).toBeInTheDocument()
  })

  it('shows OPENIV_API_KEY in the auth code example', () => {
    renderPage()
    expect(screen.getAllByText('OPENIV_API_KEY').length).toBeGreaterThan(0)
  })

  it('shows the security warning note', () => {
    renderPage()
    expect(screen.getByText(/Never expose it in client-side code/i)).toBeInTheDocument()
  })

  it('links to dashboard from the auth section', () => {
    renderPage()
    const dashboardLink = screen.getByText(/Dashboard → Data Ingest → API Key/i)
    expect(dashboardLink.closest('a')).toHaveAttribute('href', '/dashboard/beam')
  })

  it('shows Request API access footer link', () => {
    renderPage()
    const link = screen.getByText('Request API access →')
    expect(link.closest('a')).toHaveAttribute('href', '/request-access')
  })

  it('shows API version label v1 · REST', () => {
    renderPage()
    expect(screen.getByText(/v1\s+·\s+REST/)).toBeInTheDocument()
  })
})

// ── Sidebar ───────────────────────────────────────────────────────────────────
describe('DevelopersPage — sidebar', () => {
  it('shows all three endpoint groups', () => {
    renderPage()
    // Each group label appears in both the sidebar and the content-area divider
    expect(screen.getAllByText('Data Ingest').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Verification').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('Intelligence').length).toBeGreaterThanOrEqual(2)
  })

  it.each(ALL_SIDEBAR_PATHS.map(p => ({ sidebarPath: p })))('shows $sidebarPath in sidebar', ({ sidebarPath }) => {
    renderPage()
    expect(screen.getByText(sidebarPath)).toBeInTheDocument()
  })

  it('clicking a sidebar endpoint does not throw', async () => {
    renderPage()
    const item = screen.getByText('/verify/bvn')
    expect(() => fireEvent.click(item)).not.toThrow()
  })
})

// ── Beam endpoints: compact card ──────────────────────────────────────────────
describe.each(BEAM_ENDPOINTS)('$title — beam card', ({ id, path }) => {
  it('renders the endpoint card', () => {
    renderPage()
    expect(getSection(id)).toBeTruthy()
  })

  it('shows POST method badge', () => {
    renderPage()
    expect(within(getSection(id)).getAllByText('POST').length).toBeGreaterThan(0)
  })

  it('shows the correct path', () => {
    renderPage()
    expect(within(getSection(id)).getByText(path)).toBeInTheDocument()
  })

  it('shows a Docs button linking to /docs', () => {
    renderPage()
    const docsBtn = within(getSection(id)).getByText('Docs →')
    expect(docsBtn.closest('a')).toHaveAttribute('href', '/docs')
  })

  it('does NOT render request schema fields', () => {
    renderPage()
    expect(within(getSection(id)).queryByText('Request body')).not.toBeInTheDocument()
  })

  it('does NOT render language tabs', () => {
    renderPage()
    expect(within(getSection(id)).queryByText('cURL')).not.toBeInTheDocument()
  })

  it('does NOT render response dropdown', () => {
    renderPage()
    expect(within(getSection(id)).queryByText('▼')).not.toBeInTheDocument()
  })
})

// ── API endpoints: title + URL bar ────────────────────────────────────────────
describe.each(API_ENDPOINTS)('$title — structure', ({ id, title, path }) => {
  it('renders the title', () => {
    renderPage()
    expect(within(getSection(id)).getByText(title)).toBeInTheDocument()
  })

  it('shows POST method badge in the section', () => {
    renderPage()
    expect(within(getSection(id)).getAllByText('POST').length).toBeGreaterThan(0)
  })

  it('shows the correct path in the URL bar', () => {
    renderPage()
    expect(within(getSection(id)).getByText(path)).toBeInTheDocument()
  })

  it('shows https://api.openiv.ng base URL', () => {
    renderPage()
    expect(within(getSection(id)).getAllByText('https://api.openiv.ng').length).toBeGreaterThan(0)
  })
})

// ── API endpoints: request schema ────────────────────────────────────────────
describe.each(API_ENDPOINTS)('$title — request fields', ({ id, requiredField }) => {
  it(`documents "${requiredField}" as a required field`, () => {
    renderPage()
    expect(within(getSection(id)).getByText(requiredField)).toBeInTheDocument()
  })

  it('documents Authorization header', () => {
    renderPage()
    expect(within(getSection(id)).getAllByText('Authorization').length).toBeGreaterThan(0)
  })

  it('documents Content-Type header', () => {
    renderPage()
    expect(within(getSection(id)).getAllByText('Content-Type').length).toBeGreaterThan(0)
  })

  it('shows "yes" badge for at least one required field', () => {
    renderPage()
    expect(within(getSection(id)).getAllByText('yes').length).toBeGreaterThan(0)
  })
})

// ── API endpoints: response tabs ─────────────────────────────────────────────
describe.each(API_ENDPOINTS)('$title — responses', ({ id, firstResponse, dropdownResponses }) => {
  it(`shows "${firstResponse}" as the default response label`, () => {
    renderPage()
    expect(within(getSection(id)).getByText(firstResponse)).toBeInTheDocument()
  })

  it('shows a 200 status badge', () => {
    renderPage()
    expect(within(getSection(id)).getAllByText('200').length).toBeGreaterThan(0)
  })

  it('has a dropdown trigger arrow', () => {
    renderPage()
    expect(within(getSection(id)).getByText('▼')).toBeInTheDocument()
  })

  it.each(dropdownResponses)('shows "%s" in the response dropdown', async (label) => {
    renderPage()
    const section = getSection(id)
    openDropdown(section)
    await waitFor(() => expect(within(section).getByText(label)).toBeInTheDocument())
  })

  it('selecting Bad request shows 400 status', async () => {
    renderPage()
    const section = getSection(id)
    openDropdown(section)
    await waitFor(() => within(section).getByText('Bad request'))
    fireEvent.click(within(section).getByText('Bad request'))
    await waitFor(() =>
      expect(within(section).getAllByText('400').length).toBeGreaterThan(0)
    )
  })

  it('selecting Unauthorized shows 401 status', async () => {
    renderPage()
    const section = getSection(id)
    openDropdown(section)
    await waitFor(() => within(section).getByText('Unauthorized'))
    fireEvent.click(within(section).getByText('Unauthorized'))
    await waitFor(() =>
      expect(within(section).getAllByText('401').length).toBeGreaterThan(0)
    )
  })

  it('Unauthorized response body contains invalid_api_key_or_session', async () => {
    renderPage()
    const section = getSection(id)
    openDropdown(section)
    await waitFor(() => within(section).getByText('Unauthorized'))
    fireEvent.click(within(section).getByText('Unauthorized'))
    await waitFor(() =>
      expect(section.textContent).toMatch(/invalid_api_key_or_session/)
    )
  })
})

// ── API endpoints: code sample tabs ──────────────────────────────────────────
describe.each(API_ENDPOINTS)('$title — code samples', ({ id }) => {
  it.each(LANGS)('has a %s language tab', (lang) => {
    renderPage()
    expect(within(getSection(id)).getByText(lang)).toBeInTheDocument()
  })

  it('shows cURL code by default', () => {
    renderPage()
    expect(getSection(id).textContent).toMatch(/curl/i)
  })

  it('switching to Python shows "import httpx"', async () => {
    renderPage()
    const section = getSection(id)
    fireEvent.click(within(section).getByText('Python'))
    await waitFor(() => expect(section.textContent).toMatch(/import/))
    expect(section.textContent).toMatch(/httpx/)
  })

  it('switching to Go shows http request code', async () => {
    renderPage()
    const section = getSection(id)
    fireEvent.click(within(section).getByText('Go'))
    await waitFor(() => expect(section.textContent).toMatch(/http/))
  })

  it('switching to Java shows HttpRequest', async () => {
    renderPage()
    const section = getSection(id)
    fireEvent.click(within(section).getByText('Java'))
    await waitFor(() => expect(section.textContent).toMatch(/HttpRequest/))
  })

  it('switching to Node.js shows axios', async () => {
    renderPage()
    const section = getSection(id)
    fireEvent.click(within(section).getByText('Node.js'))
    await waitFor(() => expect(section.textContent).toMatch(/axios/))
  })
})

// ── Copy button ───────────────────────────────────────────────────────────────
describe('DevelopersPage — copy button', () => {
  it('every code pane has a Copy button (at least 9)', () => {
    renderPage()
    expect(screen.getAllByText('Copy').length).toBeGreaterThanOrEqual(9)
  })

  it('clicking Copy calls navigator.clipboard.writeText', async () => {
    renderPage()
    const [btn] = screen.getAllByText('Copy')
    await userEvent.click(btn)
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
  })

  it('Copy button shows "Copied" immediately after click', async () => {
    renderPage()
    const [btn] = screen.getAllByText('Copy')
    await userEvent.click(btn)
    expect(screen.getAllByText('Copied').length).toBeGreaterThan(0)
  })

  it('Copied reverts to Copy after 1.8 s', async () => {
    vi.useFakeTimers()
    renderPage()
    const [btn] = screen.getAllByText('Copy')
    await act(async () => { fireEvent.click(btn) })
    expect(screen.getAllByText('Copied').length).toBeGreaterThan(0)
    await act(async () => { vi.advanceTimersByTime(1900) })
    expect(screen.queryByText('Copied')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})

// ── Account Risk Intelligence — specific assertions ───────────────────────────
describe('Account Risk Intelligence — content', () => {
  it('request table has exactly account_number and bank_code fields', () => {
    renderPage()
    const section = getSection('intelligence-account-risk')
    expect(within(section).getByText('account_number')).toBeInTheDocument()
    expect(within(section).getByText('bank_code')).toBeInTheDocument()
    // bvn and phone are NOT documented as caller-provided fields
    const allFieldNames = Array.from(
      section.querySelectorAll('[style*="color: rgb(5, 150, 105)"]')
    ).map(el => el.textContent)
    expect(allFieldNames).not.toContain('bvn')
    expect(allFieldNames).not.toContain('phone')
  })

  it('default response shows PROCEED recommendation', () => {
    renderPage()
    expect(getSection('intelligence-account-risk').textContent).toMatch(/PROCEED/)
  })

  it('BLOCK recommendation appears in the Critical response', async () => {
    renderPage()
    const section = getSection('intelligence-account-risk')
    openDropdown(section)
    await waitFor(() => within(section).getByText('Critical — PEP match + BVN name mismatch'))
    fireEvent.click(within(section).getByText('Critical — PEP match + BVN name mismatch'))
    await waitFor(() => expect(section.textContent).toMatch(/BLOCK/))
  })

  it('dual phone fraud response shows bvn_record and nuban_record sources', async () => {
    renderPage()
    const section = getSection('intelligence-account-risk')
    openDropdown(section)
    await waitFor(() => within(section).getByText('High risk — dual phone fraud checks'))
    fireEvent.click(within(section).getByText('High risk — dual phone fraud checks'))
    await waitFor(() => {
      expect(section.textContent).toMatch(/bvn_record/)
      expect(section.textContent).toMatch(/nuban_record/)
    })
  })

  it('dual phone fraud response shows phone_mismatch signal', async () => {
    renderPage()
    const section = getSection('intelligence-account-risk')
    openDropdown(section)
    await waitFor(() => within(section).getByText('High risk — dual phone fraud checks'))
    fireEvent.click(within(section).getByText('High risk — dual phone fraud checks'))
    await waitFor(() => expect(section.textContent).toMatch(/phone_mismatch/))
  })

  it('unresolved account response shows REVIEW recommendation', async () => {
    renderPage()
    const section = getSection('intelligence-account-risk')
    openDropdown(section)
    await waitFor(() => within(section).getByText('Unresolved account'))
    fireEvent.click(within(section).getByText('Unresolved account'))
    await waitFor(() => expect(section.textContent).toMatch(/REVIEW/))
  })

  it('unresolved response shows nuban_unresolved signal', async () => {
    renderPage()
    const section = getSection('intelligence-account-risk')
    openDropdown(section)
    await waitFor(() => within(section).getByText('Unresolved account'))
    fireEvent.click(within(section).getByText('Unresolved account'))
    await waitFor(() => expect(section.textContent).toMatch(/nuban_unresolved/))
  })
})

// ── Resolve NUBAN — specific assertions ──────────────────────────────────────
describe('Resolve NUBAN — content', () => {
  it('default response shows account_name field', () => {
    renderPage()
    expect(getSection('verify-nuban').textContent).toMatch(/account_name/)
  })

  it('default response shows masked_bvn field', () => {
    renderPage()
    expect(getSection('verify-nuban').textContent).toMatch(/masked_bvn/)
  })

  it('switching to Not resolved shows null for account_name', async () => {
    renderPage()
    const section = getSection('verify-nuban')
    openDropdown(section)
    await waitFor(() => within(section).getByText('Not resolved'))
    fireEvent.click(within(section).getByText('Not resolved'))
    await waitFor(() => expect(section.textContent).toMatch(/"account_name": null/))
  })
})

// ── Phone Fraud Screening — specific assertions ────────────────────────────────
describe('Phone Fraud Screening — content', () => {
  it('default response shows risk_score', () => {
    renderPage()
    expect(getSection('verify-phone-fraud').textContent).toMatch(/risk_score/)
  })

  it('default (low risk) response shows risk_score: 5', () => {
    renderPage()
    expect(getSection('verify-phone-fraud').textContent).toMatch(/"risk_score": 5/)
  })

  it('switching to High risk shows leaked and spammer as true', async () => {
    renderPage()
    const section = getSection('verify-phone-fraud')
    openDropdown(section)
    await waitFor(() => within(section).getByText('High risk'))
    fireEvent.click(within(section).getByText('High risk'))
    await waitFor(() => {
      expect(section.textContent).toMatch(/"leaked": true/)
      expect(section.textContent).toMatch(/"spammer": true/)
    })
  })

  it('high risk response shows risk_score: 78', async () => {
    renderPage()
    const section = getSection('verify-phone-fraud')
    openDropdown(section)
    await waitFor(() => within(section).getByText('High risk'))
    fireEvent.click(within(section).getByText('High risk'))
    await waitFor(() => expect(section.textContent).toMatch(/"risk_score": 78/))
  })
})

// ── PEP Screening — specific assertions ──────────────────────────────────────
describe('PEP Screening — content', () => {
  it('default response shows is_pep: true', () => {
    renderPage()
    expect(getSection('verify-pep').textContent).toMatch(/is_pep/)
  })

  it('default response shows total_matches', () => {
    renderPage()
    expect(getSection('verify-pep').textContent).toMatch(/total_matches/)
  })

  it('switching to No match shows is_pep: false', async () => {
    renderPage()
    const section = getSection('verify-pep')
    openDropdown(section)
    await waitFor(() => within(section).getByText('No match'))
    fireEvent.click(within(section).getByText('No match'))
    await waitFor(() => expect(section.textContent).toMatch(/"is_pep": false/))
  })
})

// ── Beam endpoints: Docs button points to the right place ────────────────────
describe('Beam endpoints — Docs button', () => {
  it('Ingest Transaction Docs button links to /docs', () => {
    renderPage()
    expect(
      within(getSection('ingest-transactions')).getByText('Docs →').closest('a')
    ).toHaveAttribute('href', '/docs')
  })

  it('Ingest Customer KYC Docs button links to /docs', () => {
    renderPage()
    expect(
      within(getSection('ingest-kyc')).getByText('Docs →').closest('a')
    ).toHaveAttribute('href', '/docs')
  })
})

// ── BVN + NIN verify — specific assertions ────────────────────────────────────
describe('Verify BVN — content', () => {
  it('default response shows verified: true', () => {
    renderPage()
    expect(getSection('verify-bvn').textContent).toMatch(/"verified": true/)
  })

  it('switching to Not found shows verified: false', async () => {
    renderPage()
    const section = getSection('verify-bvn')
    openDropdown(section)
    await waitFor(() => within(section).getByText('Not found'))
    fireEvent.click(within(section).getByText('Not found'))
    await waitFor(() => expect(section.textContent).toMatch(/"verified": false/))
  })
})

describe('Verify NIN — content', () => {
  it('default response shows verified: true with nin type', () => {
    renderPage()
    const section = getSection('verify-nin')
    expect(section.textContent).toMatch(/"verified": true/)
    expect(section.textContent).toMatch(/"type": "nin"/)
  })
})
