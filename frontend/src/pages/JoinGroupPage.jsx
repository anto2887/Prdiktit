// src/pages/JoinGroupPage.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

// Components
import JoinGroup from '../components/groups/JoinGroup';
import OnboardingGuide, { HelpTooltip } from '../components/onboarding/OnboardingGuide';

const JoinGroupPage = () => {
  // Guide state
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Join a League</h1>
        <div className="flex items-center gap-4">
          <Link
            to="/groups"
            className="text-blue-600 hover:text-blue-800"
          >
            ← Back to Leagues
          </Link>
          <HelpTooltip content="Start the guided tour to learn about joining leagues">
            <button
              onClick={() => setShowGuide(true)}
              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </HelpTooltip>
        </div>
      </div>
      
      <JoinGroup />
      
      {/* Guide/Help System */}
      <OnboardingGuide
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        onComplete={() => setShowGuide(false)}
        step={guideStep}
        totalSteps={3}
        steps={[
          {
            title: "Join a League",
            content: "Join an existing league using an invite code provided by the league admin.",
            action: "Next",
            highlight: null
          },
          {
            title: "Enter Invite Code",
            content: "Enter the 8-character invite code exactly as provided. The code is case-insensitive.",
            action: "Next",
            highlight: null
          },
          {
            title: "Start Competing",
            content: "Once joined, you'll be able to make predictions and compete with other league members!",
            action: "Got it!",
            highlight: null
          }
        ]}
      />
    </div>
  );
};

export default JoinGroupPage;