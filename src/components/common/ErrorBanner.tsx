import React from 'react';

interface ErrorBannerProps {
  message: string;
}

/**
 * A dismissible-like banner to display error messages prominently.
 */
export default function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mb-6" role="alert">
      <strong className="font-bold">Error: </strong>
      <span className="block sm:inline ml-2">{message}</span>
    </div>
  );
}
