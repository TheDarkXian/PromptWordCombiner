
import React, { useState, useEffect } from 'react';

interface HighlightEffectProps {
  children: React.ReactNode;
  isActive: boolean;
  duration?: number;
}

export const HighlightEffect: React.FC<HighlightEffectProps> = ({ 
  children, 
  isActive, 
  duration = 2000 
}) => {
  const [show, setShow] = useState(isActive);

  useEffect(() => {
    if (isActive) {
      setShow(true);
      const timer = setTimeout(() => setShow(false), duration);
      return () => clearTimeout(timer);
    }
  }, [isActive, duration]);

  return (
    <div className="relative group/highlight">
      {show && (
        <>
          {/* 外围呼吸光圈 */}
          <div className="absolute -inset-1 bg-blue-500/50 rounded-2xl blur-md animate-pulse z-0 pointer-events-none"></div>
          {/* 边框高亮 */}
          <div className="absolute inset-0 border-2 border-blue-400 rounded-xl z-10 pointer-events-none animate-in fade-in duration-500"></div>
          {/* "NEW" 悬浮标签 */}
          <div className="absolute -top-3 -right-2 z-20 animate-bounce">
            <span className="bg-blue-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg border border-blue-300/50 uppercase tracking-tighter">
              NEW
            </span>
          </div>
        </>
      )}
      <div className={`relative z-10 transition-transform duration-500 ${show ? 'scale-[1.02]' : 'scale-100'}`}>
        {children}
      </div>
    </div>
  );
};
