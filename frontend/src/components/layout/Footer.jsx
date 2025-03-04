import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-white shadow mt-8">
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <p className="text-gray-600">
            © {new Date().getFullYear()} PrdiktIt. All rights reserved.
          </p>
          <div className="flex space-x-6">
            <a
              href="/terms"
              className="text-gray-600 hover:text-gray-900"
            >
              Terms
            </a>
            <a
              href="/privacy"
              className="text-gray-600 hover:text-gray-900"
            >
              Privacy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;