import React, { useState, useEffect } from 'react';

const PredictionCountdown = ({ kickoffTime }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const kickoff = new Date(kickoffTime).getTime();
      const now = new Date().getTime();
      const difference = kickoff - now;

      if (difference <= 0) {
        setIsExpired(true);
        setTimeLeft('Prediction locked');
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

      setTimeLeft(`${hours}h ${minutes}m remaining`);
    };

    const timer = setInterval(calculateTimeLeft, 60000);
    calculateTimeLeft();

    return () => clearInterval(timer);
  }, [kickoffTime]);

  return (
    <div className={`text-sm ${isExpired ? 'text-red-600' : 'text-blue-600'}`}>
      {timeLeft}
    </div>
  );
};

export default PredictionCountdown;