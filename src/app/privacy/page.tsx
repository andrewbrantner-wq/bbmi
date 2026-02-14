export const metadata = {
  title: "Privacy Policy - BBMI Hoops",
  description: "Privacy Policy for BBMI Hoops basketball analytics platform",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="section-wrapper">
      <div className="w-full max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="prose prose-stone max-w-none">
          <p className="text-sm text-stone-500 mb-8">
            Last Updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p>
              BBMI Hoops ("we," "us," or "our") respects your privacy. This Privacy Policy explains how we 
              collect, use, disclose, and safeguard your information when you use our website and services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
            
            <h3 className="text-xl font-semibold mb-3">2.1 Information You Provide</h3>
            <p className="mb-4">We collect information you voluntarily provide when using our services:</p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li><strong>Email Address:</strong> When you subscribe to premium services or submit feedback</li>
              <li><strong>Payment Information:</strong> Processed securely through Stripe (we do not store credit card details)</li>
              <li><strong>Feedback and Communications:</strong> When you contact us or submit feedback through our forms</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">2.2 Automatically Collected Information</h3>
            <p className="mb-4">When you visit our website, we automatically collect:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Usage Data:</strong> Pages visited, time spent, clicks, and interactions</li>
              <li><strong>Device Information:</strong> Browser type, operating system, device type</li>
              <li><strong>IP Address:</strong> For analytics and security purposes</li>
              <li><strong>Cookies:</strong> Small data files stored on your device (see Cookies section)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p className="mb-4">We use collected information for:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Providing and maintaining our services</li>
              <li>Processing premium subscriptions and payments</li>
              <li>Sending service-related communications</li>
              <li>Analyzing usage patterns to improve our services</li>
              <li>Detecting and preventing fraud or abuse</li>
              <li>Complying with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Data Sharing and Disclosure</h2>
            
            <h3 className="text-xl font-semibold mb-3">4.1 Third-Party Service Providers</h3>
            <p className="mb-4">We share information with trusted third-party providers:</p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li><strong>Stripe:</strong> Payment processing (subject to Stripe's privacy policy)</li>
              <li><strong>Vercel:</strong> Website hosting and analytics</li>
              <li><strong>Vercel Postgres:</strong> Database storage</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">4.2 Legal Requirements</h3>
            <p className="mb-4">We may disclose information when required by law or to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Comply with legal process or government requests</li>
              <li>Enforce our Terms of Service</li>
              <li>Protect our rights, property, or safety</li>
              <li>Prevent fraud or abuse</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">4.3 We Do Not Sell Your Data</h3>
            <p>
              We <strong>do not sell, rent, or trade</strong> your personal information to third parties 
              for marketing purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Cookies and Tracking Technologies</h2>
            <p className="mb-4">
              We use cookies and similar technologies to enhance your experience. Cookies are small text 
              files stored on your device.
            </p>
            
            <h3 className="text-xl font-semibold mb-3">Types of Cookies We Use:</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li><strong>Essential Cookies:</strong> Required for website functionality</li>
              <li><strong>Analytics Cookies:</strong> Help us understand how visitors use our site (Vercel Analytics)</li>
              <li><strong>Performance Cookies:</strong> Monitor site speed and performance (Vercel Speed Insights)</li>
            </ul>

            <p className="mb-4">
              You can control cookies through your browser settings. However, disabling cookies may limit 
              functionality.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Data Security</h2>
            <p className="mb-4">
              We implement reasonable security measures to protect your information, including:
            </p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>HTTPS encryption for data transmission</li>
              <li>Secure database storage with Vercel Postgres</li>
              <li>Payment processing through PCI-compliant Stripe</li>
              <li>Regular security assessments</li>
            </ul>
            <p>
              However, no internet transmission is 100% secure. We cannot guarantee absolute security 
              of your information.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Data Retention</h2>
            <p>
              We retain your information for as long as necessary to provide our services and comply with 
              legal obligations:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account Data:</strong> Retained while your subscription is active</li>
              <li><strong>Payment Records:</strong> Retained for 7 years for tax and legal compliance</li>
              <li><strong>Analytics Data:</strong> Retained for 90 days</li>
              <li><strong>Feedback:</strong> Retained indefinitely unless you request deletion</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Your Privacy Rights</h2>
            <p className="mb-4">Depending on your location, you may have the following rights:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Access:</strong> Request a copy of your personal information</li>
              <li><strong>Correction:</strong> Request corrections to inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
              <li><strong>Data Portability:</strong> Request your data in a portable format</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, please contact us through the feedback form on our website.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. Children's Privacy</h2>
            <p>
              Our services are not intended for individuals under 21 years of age. We do not knowingly 
              collect information from anyone under 21. If you believe we have collected information from 
              someone under 21, please contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. California Privacy Rights (CCPA)</h2>
            <p className="mb-4">
              If you are a California resident, you have additional rights under the California Consumer 
              Privacy Act (CCPA):
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Right to know what personal information is collected</li>
              <li>Right to know if personal information is sold or disclosed</li>
              <li>Right to opt-out of the sale of personal information (we don't sell data)</li>
              <li>Right to deletion of personal information</li>
              <li>Right to non-discrimination for exercising CCPA rights</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. European Privacy Rights (GDPR)</h2>
            <p className="mb-4">
              If you are in the European Economic Area (EEA), you have rights under the General Data 
              Protection Regulation (GDPR):
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Right of access to your personal data</li>
              <li>Right to rectification of inaccurate data</li>
              <li>Right to erasure ("right to be forgotten")</li>
              <li>Right to restrict processing</li>
              <li>Right to data portability</li>
              <li>Right to object to processing</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be posted on this page 
              with an updated "Last Updated" date. We encourage you to review this policy periodically. 
              Continued use of our services after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">13. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or wish to exercise your privacy rights, 
              please contact us through the feedback form on our website.
            </p>
          </section>

          <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Summary:</strong> We collect minimal information necessary to provide our services. 
              We do not sell your data. You have control over your information and can request access, 
              correction, or deletion at any time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
