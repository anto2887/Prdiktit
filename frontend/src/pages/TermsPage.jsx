// frontend/src/pages/TermsPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const TermsPage = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Terms of Service</h1>
          <p className="mt-1 text-sm text-gray-500">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8 text-sm text-gray-800">
        <section>
          <h2 className="text-lg font-semibold mb-2">1. Introduction</h2>
          <p className="mb-2">
            Welcome to Prdiktit (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). These Terms of Service
            (&ldquo;Terms&rdquo;) govern your access to and use of the Prdiktit website and services (collectively,
            the &ldquo;Service&rdquo;), including <code>https://prdiktit.com</code>.
          </p>
          <p>
            By creating an account or using the Service, you agree to be bound by these Terms. If you do not agree, do
            not use Prdiktit.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">2. Eligibility &amp; Accounts</h2>
          <ul className="list-disc ml-5 space-y-1">
            <li>You must be at least 13 years old (or the minimum age in your jurisdiction) to use Prdiktit.</li>
            <li>
              You are responsible for maintaining the confidentiality of your login credentials and for all activity
              under your account.
            </li>
            <li>
              You agree that the information you provide to us (such as email, username) is accurate and kept up to
              date.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. Nature of the Service (No Real-Money Gambling)</h2>
          <p className="mb-2">
            Prdiktit is a football match prediction game. Users can make predictions on match scores, earn points, and
            compare results in groups and leaderboards.
          </p>
          <p>
            Prdiktit does <strong>not</strong> involve real-money betting or gambling. No real-money wagers, payouts,
            or prizes are provided through the Service. You are solely responsible for complying with any local laws
            that may apply to your use of prediction or fantasy-style services.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. Acceptable Use</h2>
          <p className="mb-2">You agree not to use the Service to:</p>
          <ul className="list-disc ml-5 space-y-1">
            <li>Harass, threaten, or abuse other users.</li>
            <li>Post or use offensive, hateful, or illegal content (including usernames and group names).</li>
            <li>Attempt to hack, disrupt, or overload the Service or its infrastructure.</li>
            <li>Scrape data or reverse engineer the Service except as allowed by applicable law.</li>
            <li>Manipulate scores, predictions, or leaderboards in bad faith (e.g., automated bots, exploits).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. User Content &amp; Groups</h2>
          <p className="mb-2">
            You may create or join groups, set group names and descriptions, and submit predictions. You retain
            ownership of your content, but you grant us a non-exclusive, worldwide, royalty-free license to use,
            display, and distribute that content within the Service (for example in group pages, leaderboards, and user
            stats).
          </p>
          <p>
            We may remove or restrict content or groups at our discretion if we believe they violate these Terms or
            applicable law.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. Third-Party Data &amp; Services</h2>
          <p className="mb-2">
            Prdiktit uses third-party football data providers (e.g., match fixtures, teams, scores) and hosting
            providers (such as Railway for application hosting, databases, and caching).
          </p>
          <p>
            Match information (including status, kickoff times, and scores) is provided &ldquo;as is&rdquo; from these
            providers. We do not guarantee that such information is always accurate, complete, or up to date, and we
            are not responsible for any errors or delays in third-party data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Availability &amp; Changes to the Service</h2>
          <p className="mb-2">
            We may modify, suspend, or discontinue any part of the Service at any time, including leagues, scoring
            rules, or group features, with or without notice.
          </p>
          <p>
            We do not guarantee that the Service will be available at all times or free from interruptions, bugs, or
            security vulnerabilities.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">8. Disclaimers</h2>
          <p className="mb-2">
            The Service is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. To the maximum
            extent permitted by law, we disclaim all warranties, express or implied, including implied warranties of
            merchantability, fitness for a particular purpose, and non-infringement.
          </p>
          <p>
            We make no warranty regarding the accuracy of match data, predictions, scores, or leaderboards, or that the
            Service will meet your requirements or be uninterrupted, secure, or error-free.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">9. Limitation of Liability</h2>
          <p className="mb-2">
            To the maximum extent permitted by law, Prdiktit and its operators will not be liable for any indirect,
            incidental, special, consequential, or punitive damages, or for any loss of profits or data, arising out of
            or in connection with your use of the Service.
          </p>
          <p>
            Our total aggregate liability for any claims relating to the Service will be limited to the amount you have
            paid us, if any, in the twelve (12) months prior to the claim.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">10. Termination</h2>
          <p className="mb-2">
            We may suspend or terminate your access to the Service at any time if we believe you have violated these
            Terms, misused the Service, or created risk or possible legal exposure for us or other users.
          </p>
          <p>
            You may stop using the Service at any time. You may also request that we delete your account as described
            in our{' '}
            <Link to="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">11. Governing Law</h2>
          <p>
            These Terms are governed by the laws of the jurisdiction where Prdiktit is operated, without regard to its
            conflict of law principles. Any disputes will be resolved in the courts of that jurisdiction, unless
            applicable law requires otherwise.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">12. Changes to These Terms</h2>
          <p className="mb-2">
            We may update these Terms from time to time. When we do, we will update the &ldquo;Last updated&rdquo; date
            at the top of this page. For material changes, we may provide additional notice (such as a banner in the
            app or email notification).
          </p>
          <p>Your continued use of the Service after changes become effective constitutes your acceptance.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">13. Contact Us</h2>
          <p>
            If you have questions about these Terms, you can contact us at:
            <br />
            <span className="font-mono">[your-contact-email@example.com]</span>
          </p>
        </section>
      </main>
    </div>
  );
};

export default TermsPage;

