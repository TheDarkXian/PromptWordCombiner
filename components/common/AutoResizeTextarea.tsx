import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

interface AutoResizeTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  maxHeight?: number;
  allowManualResize?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;
  onFocus?: React.FocusEventHandler<HTMLTextAreaElement>;
  onBlur?: () => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onClick?: React.MouseEventHandler<HTMLTextAreaElement>;
  onSelect?: React.ReactEventHandler<HTMLTextAreaElement>;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
}

export const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({
  value,
  onChange,
  placeholder,
  className,
  minHeight,
  maxHeight,
  allowManualResize = false,
  readOnly = false,
  autoFocus = false,
  onFocus,
  onBlur,
  onKeyDown,
  onClick,
  onSelect,
  textareaRef: externalRef,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const assignRef = (node: HTMLTextAreaElement | null) => {
    textareaRef.current = node;
    if (!externalRef) return;
    if (typeof externalRef === 'function') {
      externalRef(node);
      return;
    }
    (externalRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
  };

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    const contentHeight = Math.max(el.scrollHeight, minHeight || 0);
    const nextHeight = maxHeight ? Math.min(contentHeight, maxHeight) : contentHeight;
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = maxHeight && contentHeight > maxHeight ? 'auto' : 'hidden';
  }, [maxHeight, minHeight]);

  useLayoutEffect(() => {
    adjustHeight();
  }, [adjustHeight, value]);

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      adjustHeight();
      if (autoFocus && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(value.length, value.length);
      }
    });
    return () => cancelAnimationFrame(handle);
  }, [adjustHeight, autoFocus, value.length]);

  useEffect(() => {
    window.addEventListener('resize', adjustHeight);
    return () => window.removeEventListener('resize', adjustHeight);
  }, [adjustHeight]);

  const resizeClassName = allowManualResize ? 'resize-y' : 'resize-none';
  const overflowClassName = maxHeight ? 'overflow-y-auto' : 'overflow-hidden';

  return (
      <textarea
      ref={assignRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onClick={onClick}
      onSelect={onSelect}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`block w-full ${resizeClassName} ${overflowClassName} bg-transparent outline-none focus:ring-0 p-0 m-0 ${className || ''}`}
      style={{
        minHeight,
        maxHeight,
      }}
      rows={1}
      spellCheck={false}
    />
  );
};
