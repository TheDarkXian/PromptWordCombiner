
import React, { useState } from 'react';
import { Button } from './Button';

interface PromptBoxProps {
  label: string;
  prefix?: string;
  variable: string;
  suffix?: string;
}

export const PromptBox: React.FC<PromptBoxProps> = ({
  label,
  prefix = '',
  variable,
  suffix = ''
}) => {
  const [copied, setCopied] = useState(false);

  const fullPrompt = `${prefix}\n<\n${variable}\n>\n${suffix}`.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(fullPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant={copied ? "success" : "secondary"} 
            onClick={handleCopy}
            disabled={!variable}
          >
            {copied ? 'Copied!' : 'Copy Prompt'}
          </Button>
        </div>
      </div>

      <div className="font-mono text-sm bg-slate-900 p-3 rounded overflow-x-auto whitespace-pre-wrap max-h-60 text-slate-300 border border-slate-800/50">
        {prefix && <span className="text-slate-500 block mb-1">{prefix}</span>}
        <span className="text-emerald-400 block my-1 font-bold">{`< ${variable || '(Waiting for input...)'} >`}</span>
        {suffix && <span className="text-slate-500 block mt-1">{suffix}</span>}
      </div>
    </div>
  );
};
