"use client";

import Link from "next/link";

export default function FooterDisclaimer() {
  return (
    <div style={{
      width: '100%',
      borderTop: '1px solid #e7e5e4',
      backgroundColor: '#fafaf9',
      paddingTop: '2rem',
      paddingBottom: '2rem',
      marginTop: '4rem'
    }}>
      <div style={{
        maxWidth: '1152px',
        margin: '0 auto',
        padding: '0 1.5rem'
      }}>
        <div style={{
          textAlign: 'center'
        }}>
          <p style={{
            fontSize: '0.875rem',
            color: '#57534e',
            marginBottom: '1rem',
            lineHeight: '1.5'
          }}>
            <strong style={{ fontWeight: 'bold' }}>Disclaimer:</strong> BBMI Hoops provides sports analytics for entertainment and educational 
            purposes only. This is not financial, investment, or gambling advice. Sports betting involves risk 
            and you can lose money. Must be 21+. Gamble responsibly.
          </p>
          
          <p style={{
            fontSize: '0.875rem',
            color: '#57534e',
            marginBottom: '1rem',
            lineHeight: '1.5'
          }}>
            Problem Gambling? <strong style={{ fontWeight: 'bold', color: '#1c1917' }}>1-800-522-4700</strong> |{" "}
            <a 
              href="https://www.ncpgambling.org" 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                color: '#2563eb',
                textDecoration: 'none'
              }}
              onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
              onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
            >
              ncpgambling.org
            </a>
          </p>
          
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '1.5rem',
            fontSize: '0.75rem',
            color: '#78716c',
            marginBottom: '1rem'
          }}>
            <Link 
              href="/terms"
              style={{
                color: '#78716c',
                textDecoration: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#1c1917';
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#78716c';
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              Terms of Service
            </Link>
            <Link 
              href="/privacy"
              style={{
                color: '#78716c',
                textDecoration: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#1c1917';
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#78716c';
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              Privacy Policy
            </Link>
            <Link 
              href="/about"
              style={{
                color: '#78716c',
                textDecoration: 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#1c1917';
                e.currentTarget.style.textDecoration = 'underline';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#78716c';
                e.currentTarget.style.textDecoration = 'none';
              }}
            >
              About
            </Link>
          </div>
          
          <p style={{
            fontSize: '0.75rem',
            color: '#78716c',
            paddingTop: '1rem',
            margin: 0
          }}>
            © {new Date().getFullYear()} BBMI Hoops. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
