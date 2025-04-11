import React from 'react';
import { Rating } from '@/types';

interface RatingInputProps {
  value: Rating | undefined;
  onChange: (value: Rating) => void;
  label: string;
}

const ratingLabels = {
  1: 'Bad',
  2: 'Poor',
  3: 'Mediocre',
  4: 'Good',
  5: 'Great'
};

export default function RatingInput({ value, onChange, label }: RatingInputProps) {
  return (
    <div className="w-full max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4 text-center">{label}</h2>
      
      <div className="flex justify-between gap-2">
        {[1, 2, 3, 4, 5].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(rating as Rating)}
            className={`flex-1 py-3 px-1 sm:px-3 rounded-lg transition-all
              ${value === rating 
                ? 'bg-indigo-600 text-white ring-2 ring-indigo-300 shadow-lg scale-105' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
          >
            <div className="flex flex-col items-center">
              <span className="text-xl mb-1">
                {rating === 1 ? '😞' : 
                 rating === 2 ? '😕' : 
                 rating === 3 ? '😐' : 
                 rating === 4 ? '🙂' : '😁'}
              </span>
              <span className="text-sm font-medium">{ratingLabels[rating as Rating]}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}