"use client";

export default function FeedbackPage() {
  return (
    <div className="section-wrapper">
      <div style={{ 
        width: '100%', 
        maxWidth: '42rem', 
        margin: '0 auto', 
        padding: '3rem 1.5rem' 
      }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ 
            fontSize: '2rem', 
            fontWeight: 'bold', 
            marginBottom: '1rem',
            color: '#1c1917'
          }}>
            Feedback
          </h1>
          <p style={{ 
            fontSize: '1rem', 
            color: '#57534e', 
            lineHeight: '1.75',
            marginBottom: '2rem'
          }}>
            Help us improve BBMI Hoops by sharing your thoughts, reporting bugs, or suggesting features!
          </p>
        </div>

        <div style={{ 
          backgroundColor: 'white', 
          borderRadius: '0.75rem', 
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', 
          padding: '3rem',
          textAlign: 'center'
        }}>
          <p style={{ 
            fontSize: '1.125rem', 
            color: '#292524', 
            marginBottom: '1.5rem',
            fontWeight: '500'
          }}>
            Send us an email:
          </p>
          
          <a 
            href="mailto:support@bbmihoops.com"
            style={{
              display: 'inline-block',
              fontSize: '1.5rem',
              fontWeight: '600',
              color: '#2563eb',
              textDecoration: 'none',
              padding: '1rem 2rem',
              backgroundColor: '#eff6ff',
              borderRadius: '0.5rem',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#dbeafe';
              e.currentTarget.style.textDecoration = 'underline';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#eff6ff';
              e.currentTarget.style.textDecoration = 'none';
            }}
          >
            support@bbmihoops.com
          </a>

          <div style={{ 
            marginTop: '2rem', 
            paddingTop: '2rem', 
            borderTop: '1px solid #e7e5e4' 
          }}>
            <p style={{ 
              fontSize: '0.875rem', 
              color: '#78716c',
              lineHeight: '1.5'
            }}>
              We appreciate your feedback and will respond as soon as possible!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
