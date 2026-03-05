import React from 'react';
import { useNavigate } from 'react-router-dom';

const BackButton = ({ to }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="mr-2 inline-flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-label="Go back"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 19l-7-7 7-7"
        />
      </svg>
    </button>
  );
};

const MobilePageHeader = ({ title, backPath, actions }) => {
  return (
    <div className="sticky top-0 z-40 bg-white border-b border-gray-200 md:hidden">
      <div className="flex items-center justify-between px-4 py-3 h-14">
        <div className="flex items-center min-w-0">
          {backPath && <BackButton to={backPath} />}
          <h1 className="text-base font-semibold truncate">{title}</h1>
        </div>
        {actions && actions.length > 0 && (
          <div className="flex items-center space-x-2">
            {actions.map((action, index) => (
              <div key={index}>{action}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobilePageHeader;

