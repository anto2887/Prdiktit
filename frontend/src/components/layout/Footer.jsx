import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-white dark:bg-gray-800 shadow mt-8">
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <p className="text-gray-600 dark:text-gray-400">
            © {new Date().getFullYear()} PrdiktIt. All rights reserved.
          </p>
          <div className="flex space-x-6">
            <a
              href="/terms"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
            >
              Terms
            </a>
            <a
              href="/privacy"
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
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