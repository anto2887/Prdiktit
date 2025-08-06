// frontend/src/components/onboarding/OnboardingGuide.jsx
import React, { useState, useEffect, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

const OnboardingGuide = ({ 
  isOpen, 
  onClose, 
  onComplete,
  targetElement = null,
  step = 0,
  totalSteps = 5
}) => {
  const [currentStep, setCurrentStep] = useState(step);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  useEffect(() => {
    // Check if user has completed onboarding
    const completed = localStorage.getItem('onboarding_completed');
    setHasSeenOnboarding(!!completed);
  }, []);

  useEffect(() => {
    setCurrentStep(step);
  }, [step]);

  const handleComplete = () => {
    localStorage.setItem('onboarding_completed', 'true');
    setHasSeenOnboarding(true);
    onComplete?.();
    onClose?.();
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isOpen || hasSeenOnboarding) return null;

  const steps = [
    {
      title: "Welcome to Football Predictions!",
      content: "Let's take a quick tour to get you started with making predictions and competing with friends.",
      action: "Get Started",
      highlight: null
    },
    {
      title: "Make Your Predictions",
      content: "Predict the exact scores of upcoming matches. You'll earn 3 points for perfect predictions and 1 point for correct results.",
      action: "Next",
      highlight: "prediction-form"
    },
    {
      title: "Join or Create Groups",
      content: "Create private leagues with friends or join existing ones using invite codes. Compete for the top spot!",
      action: "Next", 
      highlight: "groups-section"
    },
    {
      title: "Track Your Performance",
      content: "View detailed statistics about your predictions, including weekly performance and accuracy trends.",
      action: "Next",
      highlight: "analytics-section"
    },
    {
      title: "You're All Set!",
      content: "Start making predictions and climb the leaderboards. Good luck!",
      action: "Start Predicting",
      highlight: null
    }
  ];

  const currentStepData = steps[currentStep];

  return createPortal(
    <OnboardingOverlay
      stepData={currentStepData}
      currentStep={currentStep}
      totalSteps={totalSteps}
      onNext={handleNext}
      onPrevious={handlePrevious}
      onSkip={handleSkip}
      onClose={onClose}
      targetElement={targetElement}
    />,
    document.body
  );
};

// Overlay component with backdrop
const OnboardingOverlay = ({
  stepData,
  currentStep,
  totalSteps,
  onNext,
  onPrevious,
  onSkip,
  onClose,
  targetElement
}) => {
  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50" />
      
      {/* Spotlight effect for highlighted elements */}
      {stepData.highlight && (
        <HighlightSpotlight targetId={stepData.highlight} />
      )}
      
      {/* Guide content */}
      <div className="relative z-10 h-full flex items-center justify-center p-4">
        <OnboardingCard
          stepData={stepData}
          currentStep={currentStep}
          totalSteps={totalSteps}
          onNext={onNext}
          onPrevious={onPrevious}
          onSkip={onSkip}
          onClose={onClose}
        />
      </div>
    </div>
  );
};

// Highlight spotlight for targeted elements
const HighlightSpotlight = ({ targetId }) => {
  const [targetRect, setTargetRect] = useState(null);

  useEffect(() => {
    const element = document.getElementById(targetId);
    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect(rect);
      
      // Add highlight class to element
      element.classList.add('onboarding-highlight');
      
      return () => {
        element.classList.remove('onboarding-highlight');
      };
    }
  }, [targetId]);

  if (!targetRect) return null;

  return (
    <div
      className="absolute border-4 border-blue-500 rounded-lg shadow-lg animate-pulse"
      style={{
        top: targetRect.top - 8,
        left: targetRect.left - 8,
        width: targetRect.width + 16,
        height: targetRect.height + 16,
        pointerEvents: 'none'
      }}
    />
  );
};

// Main guide card component
const OnboardingCard = ({
  stepData,
  currentStep,
  totalSteps,
  onNext,
  onPrevious,
  onSkip,
  onClose
}) => {
  return (
    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 relative">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Content */}
      <div className="p-6">
        {/* Progress indicator */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-500">
              Step {currentStep + 1} of {totalSteps}
            </span>
            <button
              onClick={onSkip}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Skip tour
            </button>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            {stepData.title}
          </h2>
          <p className="text-gray-600 leading-relaxed">
            {stepData.content}
          </p>
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={onPrevious}
            disabled={currentStep === 0}
            className={`px-4 py-2 text-sm font-medium rounded-md ${
              currentStep === 0
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:text-gray-900'
            }`}
          >
            Previous
          </button>

          <button
            onClick={onNext}
            className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {stepData.action}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingGuide;

// ===== HELP TOOLTIP COMPONENT =====

export const HelpTooltip = ({ content, position = 'top', children }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children || (
          <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>

      {isVisible && (
        <div className={`absolute z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap ${
          position === 'top' ? 'bottom-full mb-2 left-1/2 transform -translate-x-1/2' :
          position === 'bottom' ? 'top-full mt-2 left-1/2 transform -translate-x-1/2' :
          position === 'left' ? 'right-full mr-2 top-1/2 transform -translate-y-1/2' :
          'left-full ml-2 top-1/2 transform -translate-y-1/2'
        }`}>
          {content}
          <div className={`absolute w-2 h-2 bg-gray-900 rotate-45 ${
            position === 'top' ? 'top-full left-1/2 transform -translate-x-1/2 -translate-y-1/2' :
            position === 'bottom' ? 'bottom-full left-1/2 transform -translate-x-1/2 translate-y-1/2' :
            position === 'left' ? 'left-full top-1/2 transform -translate-x-1/2 -translate-y-1/2' :
            'right-full top-1/2 transform translate-x-1/2 -translate-y-1/2'
          }`} />
        </div>
      )}
    </div>
  );
};

// ===== FEATURE HIGHLIGHT COMPONENT =====

export const FeatureHighlight = ({ 
  title, 
  description, 
  targetId, 
  isActive = false,
  onComplete,
  position = 'bottom'
}) => {
  const [targetRect, setTargetRect] = useState(null);

  useEffect(() => {
    if (isActive && targetId) {
      const element = document.getElementById(targetId);
      if (element) {
        const rect = element.getBoundingClientRect();
        setTargetRect(rect);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [isActive, targetId]);

  if (!isActive || !targetRect) return null;

  return createPortal(
    <div className="fixed inset-0 z-40">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-30" />
      
      {/* Highlight border */}
      <div
        className="absolute border-2 border-blue-500 rounded-lg animate-pulse"
        style={{
          top: targetRect.top - 4,
          left: targetRect.left - 4,
          width: targetRect.width + 8,
          height: targetRect.height + 8,
          pointerEvents: 'none'
        }}
      />
      
      {/* Feature description popup */}
      <div
        className={`absolute bg-white rounded-lg shadow-xl p-4 max-w-sm ${
          position === 'bottom' ? 'top-full mt-4' :
          position === 'top' ? 'bottom-full mb-4' :
          position === 'left' ? 'right-full mr-4 top-1/2 transform -translate-y-1/2' :
          'left-full ml-4 top-1/2 transform -translate-y-1/2'
        }`}
        style={{
          top: position === 'bottom' ? targetRect.bottom + 16 : 
               position === 'top' ? targetRect.top - 16 : targetRect.top + targetRect.height / 2,
          left: position === 'left' ? targetRect.left - 16 :
                position === 'right' ? targetRect.right + 16 : targetRect.left,
          transform: position === 'left' || position === 'right' ? 'translateY(-50%)' :
                    position === 'top' ? 'translateY(-100%)' : 'none'
        }}
      >
        <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-3">{description}</p>
        <button
          onClick={onComplete}
          className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
        >
          Got it!
        </button>
      </div>
    </div>,
    document.body
  );
};

// ===== GUIDE STEP COMPONENT =====

export const GuideStep = ({ 
  stepNumber, 
  title, 
  description, 
  completed = false,
  active = false,
  onClick 
}) => {
  return (
    <div 
      className={`flex items-start space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
        active ? 'bg-blue-50 border border-blue-200' : 
        completed ? 'bg-green-50' : 'hover:bg-gray-50'
      }`}
      onClick={onClick}
    >
      {/* Step indicator */}
      <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
        completed ? 'bg-green-500 text-white' :
        active ? 'bg-blue-500 text-white' :
        'bg-gray-300 text-gray-600'
      }`}>
        {completed ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        ) : (
          stepNumber
        )}
      </div>
      
      {/* Step content */}
      <div className="flex-1 min-w-0">
        <h4 className={`text-sm font-medium ${
          active ? 'text-blue-900' : completed ? 'text-green-900' : 'text-gray-900'
        }`}>
          {title}
        </h4>
        <p className={`text-xs mt-1 ${
          active ? 'text-blue-700' : completed ? 'text-green-700' : 'text-gray-500'
        }`}>
          {description}
        </p>
      </div>
    </div>
  );
};

// ===== ONBOARDING PROVIDER =====

export const OnboardingProvider = ({ children }) => {
  const [activeGuide, setActiveGuide] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  const startGuide = (guideType) => {
    setActiveGuide(guideType);
    setCurrentStep(0);
  };

  const nextStep = () => {
    setCurrentStep(prev => prev + 1);
  };

  const endGuide = () => {
    setActiveGuide(null);
    setCurrentStep(0);
  };

  const contextValue = {
    activeGuide,
    currentStep,
    startGuide,
    nextStep,
    endGuide
  };

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
};

// Context for onboarding state
const OnboardingContext = React.createContext();

export const useOnboarding = () => {
  const context = React.useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};

// CSS for highlight effects (add to your global CSS)
export const onboardingStyles = `
.onboarding-highlight {
  position: relative;
  z-index: 41;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 0 8px rgba(59, 130, 246, 0.2);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.onboarding-highlight::before {
  content: '';
  position: absolute;
  inset: -4px;
  border: 2px solid #3b82f6;
  border-radius: 8px;
  animation: onboarding-pulse 2s infinite;
}

@keyframes onboarding-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.02);
  }
}
`;