// src/pages/CreateGroupPage.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';

// Components
import GroupForm from '../components/groups/GroupForm';
import OnboardingGuide, { HelpTooltip } from '../components/onboarding/OnboardingGuide';

const CreateGroupPage = () => {
  // Guide state
  const [showGuide, setShowGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create New League</h1>
        <div className="flex items-center gap-4">
          <Link
            to="/groups"
            className="text-blue-600 hover:text-blue-800"
          >
            ← Back to Leagues
          </Link>
          <HelpTooltip content="Start the guided tour to learn about creating leagues">
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
      
      <GroupForm />
      
      {/* Guide/Help System */}
      <OnboardingGuide
        isOpen={showGuide}
        onClose={() => setShowGuide(false)}
        onComplete={() => setShowGuide(false)}
        step={guideStep}
        totalSteps={4}
        steps={[
          {
            title: "Create Your League",
            content: "Create a private league where you can compete with friends and family in football predictions.",
            action: "Next",
            highlight: null
          },
          {
            title: "Choose League Name",
            content: "Give your league a unique name that reflects your group. This will be visible to all members.",
            action: "Next",
            highlight: null
          },
          {
            title: "Select League Type",
            content: "Choose which football league to follow. Different leagues have different seasons and match schedules.",
            action: "Next",
            highlight: null
          },
          {
            title: "Invite Friends",
            content: "Once created, you'll get an invite code to share with friends. They can join using this code!",
            action: "Got it!",
            highlight: null
          }
        ]}
      />
    </div>
  );
};

export default CreateGroupPage;