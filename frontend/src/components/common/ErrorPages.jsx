import React from 'react';
import { Link } from 'react-router-dom';

export const Error400 = ({ error }) => (
  <div className="error-container">
    <h1>Bad Request</h1>
    <p>{error?.description}</p>
    <Link to="/" className="btn">Return to Home</Link>
  </div>
);

export const Error403 = () => (
  <div className="error-container">
    <h1>Access Denied</h1>
    <p>You don't have permission to access this resource.</p>
    <Link to="/" className="btn">Return to Home</Link>
  </div>
);

export const Error404 = () => (
  <div className="error-container">
    <h1>Page Not Found</h1>
    <p>The page you're looking for doesn't exist.</p>
    <Link to="/" className="btn">Return to Home</Link>
  </div>
);

export const Error500 = () => (
  <div className="error-container">
    <h1>Internal Server Error</h1>
    <p>Something went wrong on our end. Please try again later.</p>
    <Link to="/" className="btn">Return to Home</Link>
  </div>
);