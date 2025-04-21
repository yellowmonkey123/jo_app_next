// src/components/common/LoadingOverlay.tsx
import React from 'react';

export const LoadingOverlay: React.FC<{ overlay?: boolean }> = ({ overlay = false }) => {
  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-gray-500 bg-opacity-50 z-50 ${
        overlay ? 'absolute' : 'fixed'
      }`}
    >
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
    </div>
  );
};