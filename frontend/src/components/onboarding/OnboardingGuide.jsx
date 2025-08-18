// frontend/src/components/onboarding/OnboardingGuide.jsx
import React, { useState, useEffect } from 'react';

// Simple HelpTooltip component
export const HelpTooltip = ({ content, position = 'top', children }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [tooltipPlacement, setTooltipPlacement] = useState(position);
  const [timeoutId, setTimeoutId] = useState(null);

  if (!content) {
    return children || null;
  }

  const handleMouseEnter = (e) => {
    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // Add a small delay before showing the tooltip
    const newTimeoutId = setTimeout(() => {
      const rect = e.currentTarget.getBoundingClientRect();
      const tooltipWidth = 250;
      const tooltipHeight = 80;
      
      let placement = position;
      let x = rect.left + rect.width / 2;
      let y = rect.top + rect.height / 2;
      
      // Calculate optimal position to stay within viewport and avoid covering the trigger element
      if (placement === 'top') {
        y = rect.top - 15; // Increased offset to avoid covering
        if (y < tooltipHeight + 20) { // Extra buffer
          placement = 'bottom';
          y = rect.bottom + 15;
        }
      } else if (placement === 'bottom') {
        y = rect.bottom + 15;
        if (y + tooltipHeight > window.innerHeight - 20) {
          placement = 'top';
          y = rect.top - 15;
        }
      } else if (placement === 'left') {
        x = rect.left - 15;
        if (x < tooltipWidth + 20) {
          placement = 'right';
          x = rect.right + 15;
        }
      } else if (placement === 'right') {
        x = rect.right + 15;
        if (x + tooltipWidth > window.innerWidth - 20) {
          placement = 'left';
          x = rect.left - 15;
        }
      }
      
      // Ensure tooltip stays within viewport bounds with extra padding
      x = Math.max(tooltipWidth / 2 + 20, Math.min(x, window.innerWidth - tooltipWidth / 2 - 20));
      y = Math.max(tooltipHeight / 2 + 20, Math.min(y, window.innerHeight - tooltipHeight / 2 - 20));
      
      // Additional check: ensure tooltip doesn't cover the trigger element
      const tooltipLeft = x - tooltipWidth / 2;
      const tooltipRight = x + tooltipWidth / 2;
      const tooltipTop = y - tooltipHeight / 2;
      const tooltipBottom = y + tooltipHeight / 2;
      
      // If tooltip would cover the trigger element, adjust position
      if (tooltipLeft < rect.right && tooltipRight > rect.left && 
          tooltipTop < rect.bottom && tooltipBottom > rect.top) {
        // Move tooltip further away
        if (placement === 'top') {
          y = rect.top - tooltipHeight - 25;
        } else if (placement === 'bottom') {
          y = rect.bottom + tooltipHeight + 25;
        } else if (placement === 'left') {
          x = rect.left - tooltipWidth - 25;
        } else if (placement === 'right') {
          x = rect.right + tooltipWidth + 25;
        }
      }
      
      setTooltipPosition({ x, y });
      setTooltipPlacement(placement);
      setIsVisible(true);
    }, 300); // 300ms delay

    setTimeoutId(newTimeoutId);
  };

  const handleMouseLeave = () => {
    // Clear any existing timeout
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    setIsVisible(false);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return (
    <>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="cursor-help inline-block"
      >
        {children || (
          <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>

      {isVisible && (
        <div 
          className="fixed z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg max-w-xs"
          style={{
            left: tooltipPosition.x,
            top: tooltipPosition.y,
            transform: 'translate(-50%, -50%)',
            maxWidth: '250px',
            wordWrap: 'break-word',
            whiteSpace: 'normal',
            pointerEvents: 'none'
          }}
        >
          {content}
          {/* Arrow removed - no more black dot */}
        </div>
      )}
    </>
  );
};

// Simple FeatureHighlight component
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

  return (
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
        <p className="text-gray-600 text-sm mb-3">{description}</p>
        <button
          onClick={onComplete}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Got it!
        </button>
      </div>
    </div>
  );
};

// Main OnboardingGuide component
const OnboardingGuide = ({ 
  isOpen, 
  onClose, 
  onComplete,
  step = 0,
  totalSteps = 5,
  steps = null
}) => {
  const [currentStep, setCurrentStep] = useState(step);

  useEffect(() => {
    setCurrentStep(step);
  }, [step]);

  const handleComplete = () => {
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

  if (!isOpen) return null;

  // Use custom steps if provided, otherwise use default steps
  const defaultSteps = [
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

  const stepData = steps || defaultSteps;
  const currentStepData = stepData[currentStep];

  if (!currentStepData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={handleSkip} />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">{currentStepData.title}</h2>
          <button
            onClick={handleSkip}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <p className="text-gray-600 mb-6">{currentStepData.content}</p>
        
        {/* Progress */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex space-x-2">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  i <= currentStep ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
          <span className="text-sm text-gray-500">
            {currentStep + 1} of {totalSteps}
          </span>
        </div>
        
        {/* Actions */}
        <div className="flex justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className={`px-4 py-2 rounded-lg transition-colors ${
              currentStep === 0
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Previous
          </button>
          
          <div className="flex space-x-2">
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {currentStep === totalSteps - 1 ? 'Finish' : currentStepData.action}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingGuide;