"use client";

const BADGES: Record<string, { name: string; gradient: string; desc: string; icon: string }> = {
  'Fortress': {
    name: "Fortress",
    gradient: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
    desc: "Elite point margin dominance",
    icon: "M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm0 2.18l6 2.25v4.66c0 4.15-2.7 8.01-6 9.11-3.3-1.1-6-4.96-6-9.11V6.43l6-2.25z M12 9a3 3 0 100 6 3 3 0 000-6z"
  },
  'Lockdown': {
    name: "Lockdown",
    gradient: "linear-gradient(135deg, #dc2626 0%, #f97316 100%)",
    desc: "Stifling field goal defense",
    icon: "M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 3.18l6 2.67v4.65c0 4.23-2.88 8.17-6 9.13-3.12-.96-6-4.9-6-9.13V6.85l6-2.67z M9 12l2 2 4-4"
  },
  'Arc Defenders': {
    name: "Arc Defenders",
    gradient: "linear-gradient(135deg, #047857 0%, #10b981 100%)",
    desc: "Elite three-point defense",
    icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z M12 6v12M6 12h12"
  },
  'Sharpshooters': {
    name: "Sharpshooters",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
    desc: "Deadly three-point shooting",
    icon: "M12 10a2 2 0 100 4 2 2 0 000-4z M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z M12 3v2M12 19v2M3 12h2M19 12h2"
  },
  'Marksmen': {
    name: "Marksmen",
    gradient: "linear-gradient(135deg, #be123c 0%, #e11d48 100%)",
    desc: "Overall field goal precision",
    icon: "M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7L12 2z M9 12l2 2 4-4"
  },
  'Scorchers': {
    name: "Scorchers",
    gradient: "linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)",
    desc: "High-octane scoring offense",
    icon: "M13 3L3 13l4 4 10-10-4-4zm7.5 5.5L22 10l-8 8-1.5-1.5 8-8zM2 20l2 2h16v-2H2z"
  },
  'Distributors': {
    name: "Distributors",
    gradient: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)",
    desc: "Exceptional ball movement",
    icon: "M3.5 6a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0z M15.5 6a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0z M9.5 12a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0z M3.5 18a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0z M15.5 18a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0z M6 6L12 12M18 6L12 12M12 12L6 18M12 12L18 18"
  },
  'Balanced': {
    name: "Balanced",
    gradient: "linear-gradient(135deg, #475569 0%, #64748b 100%)",
    desc: "Well-rounded excellence",
    icon: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z M8 12h8M12 8v8"
  },
  'Glass Cleaners': {
    name: "Glass Cleaners",
    gradient: "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)",
    desc: "Rebounding dominance",
    icon: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z M7 10h10v4H7z M9 7a1 1 0 100 2 1 1 0 000-2z M15 7a1 1 0 100 2 1 1 0 000-2z M8 15l2 2 2-2M14 15l2 2 2-2"
  },
  'Pickpockets': {
    name: "Pickpockets",
    gradient: "linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)",
    desc: "Turnover creation masters",
    icon: "M21 8c-1.45 0-2.26 1.44-1.93 2.51l-3.55 3.56c-.3-.09-.74-.09-1.04 0l-2.55-2.55C12.27 10.45 11.46 9 10 9c-1.45 0-2.27 1.44-1.93 2.52l-4.56 4.55C2.44 15.74 1 16.55 1 18c0 1.1.9 2 2 2 1.45 0 2.26-1.44 1.93-2.51l4.55-4.56c.3.09.74.09 1.04 0l2.55 2.55C12.73 16.55 13.54 18 15 18c1.45 0 2.27-1.44 1.93-2.52l3.56-3.55c1.07.33 2.51-.48 2.51-1.93 0-1.1-.9-2-2-2z"
  },
  'Giant Slayers': {
    name: "Giant Slayers",
    gradient: "linear-gradient(135deg, #ca8a04 0%, #eab308 100%)",
    desc: "Quality wins over top teams",
    icon: "M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
  },
  'Battle-Tested': {
    name: "Battle-Tested",
    gradient: "linear-gradient(135deg, #334155 0%, #475569 100%)",
    desc: "Toughest strength of schedule",
    icon: "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z M12 7l2.5 5h-5z M9.5 12h5v5h-5z"
  }
};

export function WIAATeamBadges({ primaryBadge, secondaryBadges = [] }: {
  primaryBadge: string;
  secondaryBadges?: string[];
}) {
  const primary = BADGES[primaryBadge];
  const secondaries = secondaryBadges.map(b => BADGES[b]).filter(Boolean);
  
  if (!primary) return null;
  
  return (
    <div className="rankings-table mb-10 overflow-hidden border border-stone-200 rounded-md shadow-sm">
      <div className="rankings-scroll" style={{ overflow: 'visible' }}>
        <table style={{ overflow: 'visible' }}>
          <thead>
            <tr>
              <th colSpan={2}>Team Classification</th>
            </tr>
          </thead>
          <tbody style={{ overflow: 'visible' }}>
            {/* Primary */}
            <tr className="bg-white">
              <td className="font-semibold text-gray-700" style={{ width: '100px', whiteSpace: 'nowrap' }}>Primary:</td>
              <td style={{ whiteSpace: 'normal' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div 
                    style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '50%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexShrink: 0,
                      background: primary.gradient,
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                    }}
                    title={primary.desc}
                  >
                    <svg viewBox="0 0 24 24" fill="white" style={{ width: '20px', height: '20px' }}>
                      <path d={primary.icon} stroke="white" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: '#1f2937' }}>{primary.name}</div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{primary.desc}</div>
                  </div>
                </div>
              </td>
            </tr>
            
            {/* Secondary */}
            {secondaries.length > 0 && (
              <tr style={{ background: 'rgba(245, 245, 244, 0.4)' }}>
                <td className="font-semibold text-gray-700" style={{ whiteSpace: 'nowrap' }}>Secondary:</td>
                <td style={{ whiteSpace: 'normal' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Badges */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '4px' }}>
                      {secondaries.map((badge, i) => (
                        <div 
                          key={i}
                          style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '50%', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            flexShrink: 0,
                            background: badge.gradient,
                            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                          }}
                          title={`${badge.name} - ${badge.desc}`}
                        >
                          <svg viewBox="0 0 24 24" fill="white" style={{ width: '16px', height: '16px' }}>
                            <path d={badge.icon} stroke="white" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      ))}
                    </div>
                    
                    {/* Legend - always show */}
                    <div style={{ fontSize: '11px', color: '#6b7280', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                      {secondaries.map((badge, i) => (
                        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'flex-start' }}>
                          <div 
                            style={{ 
                              width: '16px', 
                              height: '16px', 
                              borderRadius: '50%', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: '1px',
                              background: badge.gradient
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="white" style={{ width: '10px', height: '10px' }}>
                              <path d={badge.icon} stroke="white" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                          <span><strong>{badge.name}:</strong> {badge.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export enum Badge {}
