import { useEffect } from 'react'

interface SEOOptions {
  title: string
  description: string
  canonical?: string
  ogImage?: string
}

const BASE_TITLE = 'OpenIV'
const CANONICAL_BASE = 'https://openiv.ng'

export function useSEO({ title, description, canonical, ogImage }: SEOOptions) {
  useEffect(() => {
    const fullTitle = `${title} | ${BASE_TITLE}`
    document.title = fullTitle

    setMeta('name', 'description', description)
    setMeta('property', 'og:title', fullTitle)
    setMeta('property', 'og:description', description)
    setMeta('name', 'twitter:title', fullTitle)
    setMeta('name', 'twitter:description', description)

    if (canonical) {
      setLink('canonical', `${CANONICAL_BASE}${canonical}`)
      setMeta('property', 'og:url', `${CANONICAL_BASE}${canonical}`)
    }

    if (ogImage) {
      setMeta('property', 'og:image', ogImage)
      setMeta('name', 'twitter:image', ogImage)
    }

    return () => {
      document.title = `${BASE_TITLE} | AML Surveillance, KYC & Fraud Detection Platform`
    }
  }, [title, description, canonical, ogImage])
}

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', value)
}

function setLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}
