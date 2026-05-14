import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography, Stack } from '@mui/material'
import { useState, useRef, useEffect } from 'react'

interface TermsModalProps {
  open: boolean
  onClose: () => void
  type: 'security' | 'ip' | 'privacy'
}

const content = {
  security: {
    title: 'Institutional Security Protocols',
    sections: [
      {
        title: '1. Access Control & Authorization',
        text: 'Access to the OpenIV Terminal is strictly limited to authorized institutional personnel. Multi-factor authentication (MFA) and hardware-backed session tokens are mandatory for all administrative actions.'
      },
      {
        title: '2. Surveillance & Audit Logging',
        text: 'All activities within this terminal are logged in real-time. Our behavioral engine monitors session telemetry to detect credential sharing or unauthorized data exfiltration. Any anomaly triggers immediate institutional lockdown.'
      },
      {
        title: '3. Data Encryption',
        text: 'All data-in-transit is protected via TLS 1.3. Data-at-rest is encrypted using AES-256 with keys managed in hardware security modules (HSM) residing within local data residency boundaries.'
      },
      {
        title: '4. Regulatory Compliance',
        text: 'Users must adhere to the BOFIA 2020 and NDPR frameworks. Any misuse of customer PII is subject to local and international prosecution.'
      }
    ]
  },
  privacy: {
    title: 'Institutional Data Privacy Policy',
    sections: [
      {
        title: '1. NDPR & Global Compliance',
        text: 'OpenIV is fully compliant with the Nigeria Data Protection Regulation (NDPR). We adhere to "Privacy by Design" principles to ensure institutional data remains isolated and protected.'
      },
      {
        title: '2. PII Processing & Minimization',
        text: 'We only process Personally Identifiable Information (PII) necessary for AML/KYC orchestration. Data is pseudonymized at the point of ingestion before being processed by behavioral models.'
      },
      {
        title: '3. Data Residency & Sovereignty',
        text: 'In accordance with local regulations, all primary data stores reside within the specified geographic boundaries. We do not transfer institutional data derivatives across international borders without explicit regulatory approval.'
      }
    ]
  },
  ip: {
    title: 'Intellectual Property Terms',
    sections: [
      {
        title: '1. Proprietary Algorithms',
        text: 'The OpenIV orchestration engine, including the sub-14ms transaction analysis algorithms and behavioral fingerprinting models, are the sole intellectual property of OpenIV.'
      },
      {
        title: '2. License Limitations',
        text: 'Your institution is granted a non-exclusive, non-transferable license to utilize these tools for internal compliance and fraud prevention only. Reverse engineering is strictly prohibited.'
      },
      {
        title: '3. Data Derivatives',
        text: 'Aggregated, non-identifiable threat intelligence derived from network activity remains the property of the OpenIV Collaborative Network to improve security for all member institutions.'
      }
    ]
  }
}

export default function TermsModal({ open, onClose, type }: TermsModalProps) {
  const [canClose, setCanClose] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    // If they scrolled within 10px of the bottom
    if (scrollHeight - scrollTop <= clientHeight + 10) {
      setCanClose(true)
    }
  }

  useEffect(() => {
    if (open) {
      setCanClose(false)
    }
  }, [open])

  const activeContent = content[type]

  return (
    <Dialog 
      open={open} 
      onClose={canClose ? onClose : undefined}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 0, bgcolor: '#ffffff' }
      }}
    >
      <DialogTitle sx={{ fontFamily: 'Jost', fontWeight: 800, fontSize: '1.5rem', pb: 2, borderBottom: '1px solid #f1f5f9' }}>
        {activeContent.title}
      </DialogTitle>
      
      <DialogContent 
        onScroll={handleScroll}
        ref={scrollRef}
        sx={{ p: 4, maxHeight: '400px', overflowY: 'auto' }}
      >
        <Stack spacing={4}>
          {activeContent.sections.map((section, idx) => (
            <Box key={idx}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', mb: 1, color: '#00288e', fontFamily: 'Jost' }}>
                {section.title}
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.7 }}>
                {section.text}
              </Typography>
            </Box>
          ))}
          <Box sx={{ py: 2, borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
              End of Document. Please read through to acknowledge.
            </Typography>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: '1px solid #f1f5f9' }}>
        <Button 
          fullWidth
          disabled={!canClose}
          onClick={onClose}
          sx={{ 
            bgcolor: '#00288e', 
            color: '#ffffff', 
            borderRadius: 0, 
            py: 1.5,
            fontWeight: 700,
            fontFamily: 'Jost',
            textTransform: 'none',
            '&:hover': { bgcolor: '#1e293b' },
            '&:disabled': { bgcolor: '#f1f5f9', color: '#94a3b8' }
          }}
        >
          {canClose ? 'I Acknowledge and Agree' : 'Please scroll to the end to acknowledge'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
