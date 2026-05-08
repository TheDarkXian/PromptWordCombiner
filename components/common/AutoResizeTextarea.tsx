import React, { useEffect, useLayoutEffect, useRef } from 'react';

interface AutoResizeTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
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
  readOnly = false,
  autoFocus = false,
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

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  };

  useLayoutEffect(() => {
    adjustHeight();
  }, [value]);

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      adjustHeight();
      if (autoFocus && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(value.length, value.length);
      }
    });
    return () => cancelAnimationFrame(handle);
  }, [autoFocus, value.length]);

  useEffect(() => {
    window.addEventListener('resize', adjustHeight);
    return () => window.removeEventListener('resize', adjustHeight);
  }, []);

  return (
      <textarea
      ref={assignRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      onClick={onClick}
      onSelect={onSelect}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`block w-full resize-none overflow-hidden bg-transparent outline-none focus:ring-0 p-0 m-0 ${className || ''}`}
      rows={1}
      spellCheck={false}
    />
  );
};
