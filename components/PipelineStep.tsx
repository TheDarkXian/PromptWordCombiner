import React, { useState } from 'react';
import { Button } from './Button';

interface PipelineStepProps {
  title: string;
  stepNumber: number;
  description?: string;
  children: React.ReactNode;
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export const PipelineStep: React.FC<PipelineStepProps> = ({
  title,
  stepNumber,
  description,
  children,
  isCollapsed = false,
  onToggle
}) => {
  return (
    <div className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden mb-6 shadow-sm">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer bg-slate-900 hover:bg-slate-800/80 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center space-x-4">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${isCollapsed ? 'bg-slate-700 text-slate-400' : 'bg-blue-600 text-white'}`}>
            {stepNumber}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
            {description && <p className="text-sm text-slate-400">{description}</p>}
          </div>
        </div>
        <div className="text-slate-500">
          {isCollapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          ) : (
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
          )}
        </div>
      </div>
      
      {!isCollapsed && (
        <div className="p-6 border-t border-slate-800">
          {children}
        </div>
      )}
    </div>
  );
};