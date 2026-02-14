export const metadata = {
  title: "Terms of Service - BBMI Hoops",
  description: "Terms of Service and User Agreement for BBMI Hoops basketball analytics platform",
};

export default function TermsOfServicePage() {
  return (
    <div className="section-wrapper">
      <div style={{ 
        width: '100%', 
        maxWidth: '56rem', 
        margin: '0 auto', 
        padding: '3rem 1.5rem' 
      }}>
        <h1 style={{ 
          fontSize: '1.875rem', 
          fontWeight: 'bold', 
          marginBottom: '2rem',
          color: '#1c1917'
        }}>
          Terms of Service
        </h1>
        
        <div style={{ color: '#44403c', lineHeight: '1.75', textAlign: 'left' }}>
          <p style={{ 
            fontSize: '0.875rem', 
            color: '#78716c', 
            marginBottom: '2rem' 
          }}>
            Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: '1rem',
              color: '#292524'
            }}>
              1. Acceptance of Terms
            </h2>
            <p style={{ marginBottom: '1rem' }}>
              By accessing or using BBMI Hoops ("Service"), you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, do not use the Service.
            </p>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: '1rem',
              color: '#292524'
            }}>
              2. Description of Service
            </h2>
            <p style={{ marginBottom: '1rem' }}>
              BBMI Hoops provides sports analytics, statistical models, and predictive insights for NCAA and 
              WIAA basketball. The Service includes rankings, game predictions, and bracket forecasts based on 
              the Brantner Basketball Model Index (BBMI).
            </p>
          </section>

          <section style={{ 
            marginBottom: '2rem', 
            backgroundColor: '#fef2f2', 
            borderLeft: '4px solid #dc2626', 
            padding: '1.5rem' 
          }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: '1rem',
              color: '#7f1d1d'
            }}>
              3. IMPORTANT DISCLAIMERS
            </h2>
            
            <h3 style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              marginBottom: '0.75rem',
              color: '#991b1b'
            }}>
              3.1 Not Financial or Gambling Advice
            </h3>
            <p style={{ marginBottom: '1rem' }}>
              <strong>THE SERVICE IS FOR ENTERTAINMENT AND INFORMATIONAL PURPOSES ONLY.</strong> Nothing on this 
              site constitutes financial, investment, or gambling advice. We are not licensed financial advisors, 
              investment advisors, or gambling counselors. All content is provided "as is" without any warranties.
            </p>

            <h3 style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              marginBottom: '0.75rem',
              color: '#991b1b'
            }}>
              3.2 No Guarantees or Warranties
            </h3>
            <p style={{ marginBottom: '1rem' }}>
              We make <strong>NO GUARANTEES</strong> about the accuracy, completeness, or reliability of any 
              predictions, analytics, or picks. Past performance does not indicate future results. Sports outcomes 
              are inherently unpredictable and all predictions may be incorrect.
            </p>

            <h3 style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              marginBottom: '0.75rem',
              color: '#991b1b'
            }}>
              3.3 Gambling Risks
            </h3>
            <p style={{ marginBottom: '1rem' }}>
              Sports betting and gambling carry <strong>SUBSTANTIAL FINANCIAL RISK</strong>. You can and likely 
              will lose money. Never wager more than you can afford to lose. Gambling can be addictive. If you 
              or someone you know has a gambling problem, call the National Problem Gambling Helpline at
              <strong> 1-800-522-4700</strong> or visit{" "}
              <a 
                href="https://www.ncpgambling.org" 
                style={{ color: '#2563eb', textDecoration: 'underline' }}
              >
                ncpgambling.org
              </a>.
            </p>

            <h3 style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              marginBottom: '0.75rem',
              color: '#991b1b'
            }}>
              3.4 Use at Your Own Risk
            </h3>
            <p style={{ marginBottom: 0 }}>
              You acknowledge that use of the Service and any decisions based on information provided are made
              <strong> AT YOUR OWN RISK</strong>. BBMI Hoops and its operators assume no liability for any losses, 
              damages, or consequences resulting from use of the Service.
            </p>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: '1rem',
              color: '#292524'
            }}>
              4. Age and Legal Requirements
            </h2>
            <p style={{ marginBottom: '1rem' }}>
              You must be <strong>at least 21 years old</strong> to use this Service, particularly for any 
              premium features related to betting picks or predictions.
            </p>
            <p style={{ marginBottom: '1rem' }}>
              Sports betting may be illegal in your jurisdiction. It is <strong>YOUR RESPONSIBILITY</strong> to 
              ensure compliance with all applicable federal, state, and local laws. By using this Service, you 
              represent that you are in compliance with all applicable gambling laws.
            </p>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: '1rem',
              color: '#292524'
            }}>
              5. Premium Subscription Terms
            </h2>
            
            <h3 style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              marginBottom: '0.75rem',
              color: '#292524'
            }}>
              5.1 Payment
            </h3>
            <p style={{ marginBottom: '1rem' }}>
              Premium subscriptions are billed at $49/month or $15 for a 7-day trial via Stripe. Monthly payments 
              are required in advance and will automatically renew each month unless cancelled. The 7-day trial is 
              a one-time payment with no auto-renewal.
            </p>

            <h3 style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              marginBottom: '0.75rem',
              color: '#292524'
            }}>
              5.2 Auto-Renewal (Monthly Subscription Only)
            </h3>
            <p style={{ marginBottom: '1rem' }}>
              Monthly subscriptions will automatically renew at the end of each billing period unless you cancel 
              before the renewal date. You can cancel at any time from your account settings. The 7-day trial does 
              not auto-renew.
            </p>

            <h3 style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              marginBottom: '0.75rem',
              color: '#292524'
            }}>
              5.3 Cancellation
            </h3>
            <p style={{ marginBottom: '1rem' }}>
              You may cancel your monthly subscription at any time. Cancellation will take effect at the end of your 
              current billing period. You will retain access to premium features until that date.
            </p>

            <h3 style={{ 
              fontSize: '1.25rem', 
              fontWeight: '600', 
              marginBottom: '0.75rem',
              color: '#292524'
            }}>
              5.4 No Refunds
            </h3>
            <p style={{ marginBottom: '1rem' }}>
              <strong>ALL SALES ARE FINAL.</strong> Due to the nature of digital content and sports predictions, 
              we do not offer refunds for any subscription payments, including partial month refunds or trial payments. 
              By subscribing, you acknowledge this no-refund policy.
            </p>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: '1rem',
              color: '#292524'
            }}>
              6. User Conduct
            </h2>
            <p style={{ marginBottom: '1rem' }}>You agree NOT to:</p>
            <ul style={{ 
              listStyleType: 'disc', 
              paddingLeft: '1.5rem', 
              marginBottom: '1rem' 
            }}>
              <li style={{ marginBottom: '0.5rem' }}>Share your premium account access with others</li>
              <li style={{ marginBottom: '0.5rem' }}>Scrape, copy, or redistribute premium content</li>
              <li style={{ marginBottom: '0.5rem' }}>Use the Service for any illegal purpose</li>
              <li style={{ marginBottom: '0.5rem' }}>Attempt to reverse engineer or hack the Service</li>
              <li style={{ marginBottom: '0.5rem' }}>Resell or commercially exploit any content from the Service</li>
            </ul>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: '1rem',
              color: '#292524'
            }}>
              7. Intellectual Property
            </h2>
            <p style={{ marginBottom: '1rem' }}>
              All content, analytics, predictions, and methodologies on BBMI Hoops are proprietary and protected 
              by copyright. The BBMI model and all associated content are owned by BBMI Hoops. You may not reproduce, 
              distribute, or create derivative works without express written permission.
            </p>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: '1rem',
              color: '#292524'
            }}>
              8. Limitation of Liability
            </h2>
            <p style={{ marginBottom: '1rem' }}>
              <strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</strong>
            </p>
            <ul style={{ 
              listStyleType: 'disc', 
              paddingLeft: '1.5rem', 
              marginBottom: '1rem' 
            }}>
              <li style={{ marginBottom: '0.5rem' }}>
                BBMI Hoops and its operators are NOT LIABLE for any direct, indirect, incidental, consequential, 
                or punitive damages
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                This includes damages for lost profits, lost data, or gambling losses
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                Our total liability shall not exceed the amount you paid for the Service in the past 12 months
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                Some jurisdictions do not allow limitation of liability, so these limitations may not apply to you
              </li>
            </ul>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: '1rem',
              color: '#292524'
            }}>
              9. Indemnification
            </h2>
            <p style={{ marginBottom: '1rem' }}>
              You agree to indemnify and hold harmless BBMI Hoops, its operators, and affiliates from any claims, 
              damages, losses, or expenses (including legal fees) arising from your use of the Service or violation 
              of these Terms.
            </p>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: '1rem',
              color: '#292524'
            }}>
              10. Changes to Terms
            </h2>
            <p style={{ marginBottom: '1rem' }}>
              We reserve the right to modify these Terms at any time. Changes will be posted on this page with 
              an updated "Last Updated" date. Continued use of the Service after changes constitutes acceptance 
              of the modified Terms.
            </p>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: '1rem',
              color: '#292524'
            }}>
              11. Termination
            </h2>
            <p style={{ marginBottom: '1rem' }}>
              We reserve the right to suspend or terminate your access to the Service at any time, for any reason, 
              including violation of these Terms. Upon termination, your right to use the Service immediately ceases.
            </p>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: '1rem',
              color: '#292524'
            }}>
              12. Governing Law
            </h2>
            <p style={{ marginBottom: '1rem' }}>
              These Terms are governed by the laws of the State of Wisconsin, United States, without regard to 
              conflict of law principles. Any disputes shall be resolved in the courts of Wisconsin.
            </p>
          </section>

          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              marginBottom: '1rem',
              color: '#292524'
            }}>
              13. Contact Information
            </h2>
            <p style={{ marginBottom: '1rem' }}>
              For questions about these Terms, please contact us through the feedback form on our website.
            </p>
          </section>

          <div style={{ 
            marginTop: '3rem', 
            padding: '1.5rem', 
            backgroundColor: '#fefce8', 
            border: '1px solid #fde047', 
            borderRadius: '0.5rem' 
          }}>
            <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
              Problem Gambling Resources:
            </p>
            <ul style={{ fontSize: '0.875rem', listStyleType: 'none', padding: 0, margin: 0 }}>
              <li style={{ marginBottom: '0.25rem' }}>
                National Problem Gambling Helpline: <strong>1-800-522-4700</strong>
              </li>
              <li style={{ marginBottom: '0.25rem' }}>
                National Council on Problem Gambling:{" "}
                <a 
                  href="https://www.ncpgambling.org" 
                  style={{ color: '#2563eb', textDecoration: 'underline' }}
                >
                  ncpgambling.org
                </a>
              </li>
              <li style={{ marginBottom: 0 }}>
                Gamblers Anonymous:{" "}
                <a 
                  href="https://www.gamblersanonymous.org" 
                  style={{ color: '#2563eb', textDecoration: 'underline' }}
                >
                  gamblersanonymous.org
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
