"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, ArrowLeft, Mail } from "lucide-react";
import BBMILogo from "./BBMILogo";

const navItems = [
  { name: "Home", href: "/" },
  { name: "NCAA Rankings", href: "/ncaa-rankings" },
  { name: "NCAA Today's Games", href: "/ncaa-todays-picks" },
  { name: "NCAA Bracket Pulse", href: "/ncaa-bracket-pulse" },
  { name: "NCAA Model Accuracy", href: "/ncaa-model-picks-history" },
  { name: "WIAA Rankings", href: "/wiaa-rankings" },
  { name: "WIAA Today's Games", href: "/wiaa-todays-picks" },
 /* { name: "WIAA Bracket Pulse", href: "/wiaa-bracket-pulse" },*/
  { name: "WIAA Teams", href: "/wiaa-teams" },
  { name: "About", href: "/about" },
  { name: "Feedback", href: "/feedback" },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav style={{ 
      backgroundColor: '#f5f5f5',
      borderBottom: '1px solid #e0e0e0',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      <div style={{ 
        maxWidth: '1600px',
        margin: '0 auto',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative'
      }}>
        {/* Left: Menu Button + Back */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Desktop: Grid Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-md hover:bg-stone-200 transition-colors"
            style={{ 
              border: '1px solid #a0a0a0',
              backgroundColor: isOpen ? '#e0e0e0' : '#f5f5f5',
              color: '#333'
            }}
          >
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '3px',
              width: '18px',
              height: '18px'
            }}>
              {[...Array(9)].map((_, i) => (
                <div 
                  key={i} 
                  style={{ 
                    width: '4px',
                    height: '4px',
                    backgroundColor: '#333',
                    borderRadius: '1px'
                  }}
                />
              ))}
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Menu</span>
          </button>

          {/* Mobile: Hamburger */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2"
            aria-label="Toggle menu"
          >
            {isOpen ? (
              <X size={24} color="#333" />
            ) : (
              <Menu size={24} color="#333" />
            )}
          </button>

          {/* Back Button */}
          <button
            onClick={() => window.history.back()}
            className="p-2 rounded-md hover:bg-stone-200 transition-colors"
            style={{ 
              border: '1px solid #a0a0a0',
              backgroundColor: '#f5f5f5',
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            aria-label="Go back"
          >
            <ArrowLeft size={29} />
          </button>
        </div>

        {/* Center: Logo (Half Size) */}
        <div style={{ 
          position: 'absolute', 
          left: '50%', 
          transform: 'translateX(-50%) scale(0.6)',
          pointerEvents: 'auto',
          transformOrigin: 'center'
        }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
            <BBMILogo />
          </Link>
        </div>

        {/* Right: Contact Button */}
        <div>
          <Link
            href="/feedback"
            className="p-2 rounded-md hover:bg-stone-200 transition-colors"
            style={{ 
              border: '1px solid #a0a0a0',
              backgroundColor: '#f5f5f5',
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="Contact"
          >
            <Mail size={33} />
          </Link>
        </div>
      </div>

      {/* Dropdown Grid Menu - Desktop */}
      {isOpen && (
        <div 
          className="hidden md:block"
          style={{
            position: 'fixed',
            top: '60px',
            left: '24px',
            backgroundColor: '#ffffff',
            border: '1px solid #d0d0d0',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            padding: '24px',
            width: '400px',
            zIndex: 1000
          }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px'
          }}>
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px',
                  backgroundColor: '#f9f9f9',
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  minHeight: '100px',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f0f0';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9f9f9';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '8px',
                  backgroundColor: '#0a1a2f',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '8px',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: '#ffffff'
                }}>
                  {item.name.charAt(0)}
                </div>
                <span style={{
                  fontSize: '1px',
                  fontWeight: '500',
                  color: '#333',
                  textAlign: 'center',
                  lineHeight: '1.2'
                }}>
                  {item.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Mobile: Simple List */}
      {isOpen && (
        <div className="md:hidden" style={{
          backgroundColor: '#f5f5f5',
          borderTop: '2px solid #e0e0e0',
          padding: '0.1rem'
        }}>
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setIsOpen(false)}
              style={{
                display: 'block',
                padding: '0.2rem 1rem',
                color: '#333',
                textDecoration: 'none',
                borderRadius: '0.375rem',
                marginBottom: '0.125rem',
                fontSize: '1.2rem'
              }}
              className="hover:bg-stone-200"
            >
              {item.name}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
