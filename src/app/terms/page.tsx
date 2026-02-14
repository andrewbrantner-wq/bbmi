export const metadata = {
  title: "Terms of Service - BBMI Hoops",
  description: "Terms of Service and User Agreement for BBMI Hoops basketball analytics platform",
};

export default function TermsOfServicePage() {
  return (
    <div className="section-wrapper">
      <div className="w-full max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>
        
        <div className="prose prose-stone max-w-none">
          <p className="text-sm text-stone-500 mb-8">
            Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using BBMI Hoops ("Service"), you agree to be bound by these Terms of Service. 
              If you do not agree to these terms, do not use the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p>
              BBMI Hoops provides sports analytics, statistical models, and predictive insights for NCAA and 
              WIAA basketball. The Service includes rankings, game predictions, and bracket forecasts based on 
              the Brantner Basketball Model Index (BBMI).
            </p>
          </section>

          <section className="mb-8 bg-red-50 border-l-4 border-red-600 p-6">
            <h2 className="text-2xl font-semibold mb-4 text-red-900">3. IMPORTANT DISCLAIMERS</h2>
            
            <h3 className="text-xl font-semibold mb-3 text-red-800">3.1 Not Financial or Gambling Advice</h3>
            <p className="mb-4">
              <strong>THE SERVICE IS FOR ENTERTAINMENT AND INFORMATIONAL PURPOSES ONLY.</strong> Nothing on this 
              site constitutes financial, investment, or gambling advice. We are not licensed financial advisors, 
              investment advisors, or gambling counselors. All content is provided "as is" without any warranties.
            </p>

            <h3 className="text-xl font-semibold mb-3 text-red-800">3.2 No Guarantees or Warranties</h3>
            <p className="mb-4">
              We make <strong>NO GUARANTEES</strong> about the accuracy, completeness, or reliability of any 
              predictions, analytics, or picks. Past performance does not indicate future results. Sports outcomes 
              are inherently unpredictable and all predictions may be incorrect.
            </p>

            <h3 className="text-xl font-semibold mb-3 text-red-800">3.3 Gambling Risks</h3>
            <p className="mb-4">
              Sports betting and gambling carry <strong>SUBSTANTIAL FINANCIAL RISK</strong>. You can and likely 
              will lose money. Never wager more than you can afford to lose. Gambling can be addictive. If you 
              or someone you know has a gambling problem, call the National Problem Gambling Helpline at 
              <strong> 1-800-522-4700</strong> or visit <a href="https://www.ncpgambling.org" className="text-blue-600 hover:underline">ncpgambling.org</a>.
            </p>

            <h3 className="text-xl font-semibold mb-3 text-red-800">3.4 Use at Your Own Risk</h3>
            <p>
              You acknowledge that use of the Service and any decisions based on information provided are made 
              <strong> AT YOUR OWN RISK</strong>. BBMI Hoops and its operators assume no liability for any losses, 
              damages, or consequences resulting from use of the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Age and Legal Requirements</h2>
            <p className="mb-4">
              You must be <strong>at least 21 years old</strong> to use this Service, particularly for any 
              premium features related to betting picks or predictions.
            </p>
            <p>
              Sports betting may be illegal in your jurisdiction. It is <strong>YOUR RESPONSIBILITY</strong> to 
              ensure compliance with all applicable federal, state, and local laws. By using this Service, you 
              represent that you are in compliance with all applicable gambling laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Premium Subscription Terms</h2>
            
            <h3 className="text-xl font-semibold mb-3">5.1 Payment</h3>
            <p className="mb-4">
              Premium subscriptions are billed monthly at $49/month via Stripe. Payment is required in advance 
              and will automatically renew each month unless cancelled.
            </p>

            <h3 className="text-xl font-semibold mb-3">5.2 Auto-Renewal</h3>
            <p className="mb-4">
              Your subscription will automatically renew at the end of each billing period unless you cancel 
              before the renewal date. You can cancel at any time from your account settings.
            </p>

            <h3 className="text-xl font-semibold mb-3">5.3 Cancellation</h3>
            <p className="mb-4">
              You may cancel your subscription at any time. Cancellation will take effect at the end of your 
              current billing period. You will retain access to premium features until that date.
            </p>

            <h3 className="text-xl font-semibold mb-3">5.4 No Refunds</h3>
            <p className="mb-4">
              <strong>ALL SALES ARE FINAL.</strong> Due to the nature of digital content and sports predictions, 
              we do not offer refunds for any subscription payments, including partial month refunds. By subscribing, 
              you acknowledge this no-refund policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. User Conduct</h2>
            <p className="mb-4">You agree NOT to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Share your premium account access with others</li>
              <li>Scrape, copy, or redistribute premium content</li>
              <li>Use the Service for any illegal purpose</li>
              <li>Attempt to reverse engineer or hack the Service</li>
              <li>Resell or commercially exploit any content from the Service</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Intellectual Property</h2>
            <p>
              All content, analytics, predictions, and methodologies on BBMI Hoops are proprietary and protected 
              by copyright. The BBMI model and all associated content are owned by BBMI Hoops. You may not reproduce, 
              distribute, or create derivative works without express written permission.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
            <p className="mb-4">
              <strong>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</strong>
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>BBMI Hoops and its operators are NOT LIABLE for any direct, indirect, incidental, consequential, 
              or punitive damages</li>
              <li>This includes damages for lost profits, lost data, or gambling losses</li>
              <li>Our total liability shall not exceed the amount you paid for the Service in the past 12 months</li>
              <li>Some jurisdictions do not allow limitation of liability, so these limitations may not apply to you</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Indemnification</h2>
            <p>
              You agree to indemnify and hold harmless BBMI Hoops, its operators, and affiliates from any claims, 
              damages, losses, or expenses (including legal fees) arising from your use of the Service or violation 
              of these Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. Changes will be posted on this page with 
              an updated "Last Updated" date. Continued use of the Service after changes constitutes acceptance 
              of the modified Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your access to the Service at any time, for any reason, 
              including violation of these Terms. Upon termination, your right to use the Service immediately ceases.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the State of Wisconsin, United States, without regard to 
              conflict of law principles. Any disputes shall be resolved in the courts of Wisconsin.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">13. Contact Information</h2>
            <p>
              For questions about these Terms, please contact us through the feedback form on our website.
            </p>
          </section>

          <div className="mt-12 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="font-semibold mb-2">Problem Gambling Resources:</p>
            <ul className="space-y-1 text-sm">
              <li>National Problem Gambling Helpline: <strong>1-800-522-4700</strong></li>
              <li>National Council on Problem Gambling: <a href="https://www.ncpgambling.org" className="text-blue-600 hover:underline">ncpgambling.org</a></li>
              <li>Gamblers Anonymous: <a href="https://www.gamblersanonymous.org" className="text-blue-600 hover:underline">gamblersanonymous.org</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
