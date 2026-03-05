// frontend/src/pages/PrivacyPage.jsx
import React from 'react';

const PrivacyPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
          </div>
          <a
            href="/dashboard"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            ← Back to Dashboard
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8 text-sm text-gray-800">
        <section>
          <h2 className="text-lg font-semibold mb-2">1. Introduction</h2>
          <p className="mb-2">
            This Privacy Policy explains how Prdiktit (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) collects,
            uses, and protects your information when you use our website and services, including{' '}
            <code>https://prdiktit.com</code> (the &ldquo;Service&rdquo;).
          </p>
          <p>
            By using the Service, you agree to the collection and use of information in accordance with this Policy.
          </p>
          <p className="mt-2">
            Prdiktit is operated from the United States. When you use the Service, your information is processed and
            stored in the United States, primarily in Colorado and in the regions used by our hosting providers.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">2. Information We Collect</h2>

          <h3 className="font-semibold mt-2 mb-1">2.1 Account Information</h3>
          <ul className="list-disc ml-5 space-y-1">
            <li>Email address and username when you register.</li>
            <li>Password (stored as a hashed value, not in plain text) for non-OAuth accounts.</li>
            <li>
              For Google OAuth sign-in, we may receive your Google account ID, email address, and basic profile
              information from Google. We do <strong>not</strong> receive your Google password.
            </li>
          </ul>

          <h3 className="font-semibold mt-3 mb-1">2.2 Usage &amp; Gameplay Data</h3>
          <ul className="list-disc ml-5 space-y-1">
            <li>Predictions you submit (fixture IDs, predicted scores, timestamps, season, week, points earned).</li>
            <li>Group membership and roles (groups you create or join, admin/member status).</li>
            <li>Leaderboards, user stats, and other aggregations derived from your predictions.</li>
          </ul>

          <h3 className="font-semibold mt-3 mb-1">2.3 Technical &amp; Log Data</h3>
          <ul className="list-disc ml-5 space-y-1">
            <li>
              Session information stored in your browser&rsquo;s <code>sessionStorage</code> (a session ID) and sent to
              the backend via the <code>X-Session-ID</code> header to keep you logged in.
            </li>
            <li>
              Server logs that may include IP address, request URLs, timestamps, error messages, and basic environment
              information. These logs are used for debugging, security, and performance monitoring.
            </li>
            <li>
              Information related to rate limiting and abuse detection (e.g., IP-based request counts, paths accessed).
            </li>
          </ul>

          <h3 className="font-semibold mt-3 mb-1">2.4 Third-Party Data</h3>
          <p className="mb-2">
            We obtain match fixtures, teams, and scores from third-party football data providers. This data is about
            matches and teams, not about individual users, but your predictions and points are calculated using this
            information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. How We Use Your Information</h2>
          <ul className="list-disc ml-5 space-y-1">
            <li>To create and manage your account and authentication sessions.</li>
            <li>To process and display your predictions, scores, and group leaderboards.</li>
            <li>To provide and improve the Service, including debugging issues and monitoring performance.</li>
            <li>To detect, prevent, and address security or abuse incidents.</li>
            <li>To communicate with you about your account, service updates, or important notices.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. Legal Bases (where applicable)</h2>
          <p className="mb-2">
            Where data protection laws (such as GDPR) apply, we rely on the following legal bases:
          </p>
          <ul className="list-disc ml-5 space-y-1">
            <li>Performance of a contract: to provide the Service and maintain your account.</li>
            <li>Legitimate interests: to secure, operate, and improve the Service.</li>
            <li>Consent: where we rely on your consent, such as for certain optional communications or cookies.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. How We Share Your Information</h2>
          <p className="mb-2">
            We do not sell your personal data, including as &ldquo;sell&rdquo; is defined under US state privacy laws
            such as the Colorado Privacy Act.
          </p>
          <p className="mb-2">We may share your information with:</p>
          <ul className="list-disc ml-5 space-y-1">
            <li>
              Hosting and infrastructure providers (e.g., Railway for application hosting, Postgres, Redis) that store
              and process data on our behalf.
            </li>
            <li>
              Service providers that help us operate the Service (e.g., logging, monitoring, error tracking, email).
            </li>
            <li>
              Third parties when required by law, regulation, or legal process, or to protect our rights or the safety
              of users.
            </li>
          </ul>
          <p className="mt-2">
            We may display your username, predictions, and points in public or group leaderboards and stats as part of
            the core functionality of Prdiktit.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. Data Retention</h2>
          <p className="mb-2">
            We retain your personal data for as long as necessary to provide the Service and for legitimate business
            purposes, such as maintaining leaderboards and historical stats, complying with legal obligations, and
            resolving disputes.
          </p>
          <ul className="list-disc ml-5 space-y-1">
            <li>
              Session records typically expire after a limited period (for example, 7 days) in line with our session
              management logic.
            </li>
            <li>
              Logs may be retained for a reasonable period for security and debugging, then deleted or anonymized.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Cookies &amp; Local Storage</h2>
          <p className="mb-2">
            Prdiktit primarily uses browser <code>sessionStorage</code> to store a session ID, which is required to
            keep you logged in and to authenticate API requests via the <code>X-Session-ID</code> header.
          </p>
          <p className="mb-2">
            We may also rely on essential cookies set by our hosting provider or infrastructure (for example, for load
            balancing or security). These are used only to provide and protect the Service.
          </p>
          <p>
            You can clear your browser storage or use private browsing modes, but doing so may log you out or affect
            the functionality of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">8. Data Security</h2>
          <p className="mb-2">
            We use reasonable technical and organizational measures to protect your information, such as:
          </p>
          <ul className="list-disc ml-5 space-y-1">
            <li>Storing passwords using hashing algorithms rather than plain text.</li>
            <li>Using randomized session IDs for authentication.</li>
            <li>Restricting database access to authorized infrastructure.</li>
          </ul>
          <p className="mt-2">
            However, no method of transmission or storage is 100% secure. We cannot guarantee absolute security, but we
            work to protect your data and respond to issues promptly.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">9. Your Rights &amp; Choices</h2>
          <p className="mb-2">Depending on your location, you may have rights including:</p>
          <ul className="list-disc ml-5 space-y-1">
            <li>Accessing the personal data we hold about you.</li>
            <li>Requesting correction of inaccurate or incomplete data.</li>
            <li>Requesting deletion of your account and personal data.</li>
            <li>Objecting to or restricting certain types of processing.</li>
          </ul>
          <p className="mt-2">
            To exercise these rights, please contact us at the email address below. We may need to verify your identity
            before fulfilling your request.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">10. International Transfers</h2>
          <p>
            Depending on your location and where our infrastructure is hosted, your information may be processed in
            countries that may not have the same level of data protection as your home jurisdiction. We take steps to
            ensure that appropriate safeguards are in place when required by law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">11. Changes to This Policy</h2>
          <p className="mb-2">
            We may update this Privacy Policy from time to time. When we do, we will update the &ldquo;Last
            updated&rdquo; date at the top of this page. For material changes, we may provide additional notice (such
            as a banner in the app or email notification).
          </p>
          <p>
            Your continued use of the Service after changes become effective constitutes your acceptance of the updated
            Policy.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">12. Contact Us</h2>
          <p>
            If you have questions or requests regarding this Privacy Policy or our data practices, you can contact us
            at:
            <br />
            <span className="font-mono">[your-contact-email@example.com]</span>
          </p>
        </section>
      </main>
    </div>
  );
};

export default PrivacyPage;

