import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { RangeSetBuilder } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate, keymap, placeholder as cmPlaceholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { StepParameter, UiLanguage } from '../../types';
import {
  STEP_PARAMETER_REFERENCE_PATTERN,
  extractStepParameterReferences,
} from '../../services/stepParameterService';

interface PromptCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  parameters?: StepParameter[];
  language: UiLanguage;
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

interface PromptEditorHandle {
  focus: () => void;
  selectionStart: number;
  setSelectionRange: (anchor: number, head: number) => void;
}

const GLOBAL_VARIABLE_REFERENCE_PATTERN = /--([^-]*)--/g;
const LEGACY_VARIABLE_REFERENCE_PATTERN = /\{\{([^}]*)\}\}/g;

const buildDecorations = (view: EditorView, parameters: StepParameter[]): DecorationSet => {
  const parameterTypes = new Map(parameters.map((parameter) => [parameter.name, parameter.type]));
  const builder = new RangeSetBuilder<Decoration>();
  const text = view.state.doc.toString();
  const matches = [
    ...Array.from(text.matchAll(STEP_PARAMETER_REFERENCE_PATTERN)).map((match) => ({
      match,
      kind: 'parameter' as const,
    })),
    ...Array.from(text.matchAll(GLOBAL_VARIABLE_REFERENCE_PATTERN)).map((match) => ({
      match,
      kind: 'global' as const,
    })),
    ...Array.from(text.matchAll(LEGACY_VARIABLE_REFERENCE_PATTERN)).map((match) => ({
      match,
      kind: 'legacy' as const,
    })),
  ].sort((a, b) => (a.match.index ?? 0) - (b.match.index ?? 0));

  let cursor = 0;
  matches.forEach(({ match, kind }) => {
    const from = match.index ?? 0;
    const value = match[0];
    const to = from + value.length;
    if (from < cursor) return;
    cursor = to;

    if (kind === 'legacy') {
      builder.add(from, to, Decoration.mark({ class: 'cm-promptLegacyReference' }));
      return;
    }

    if (kind === 'global') {
      const isValid = Boolean(String(match[1] || '').trim());
      builder.add(
        from,
        to,
        Decoration.mark({ class: isValid ? 'cm-promptGlobalReference' : 'cm-promptInvalidReference' })
      );
      return;
    }

    const reference = extractStepParameterReferences(value)[0];
    const parameterType = reference?.valid ? parameterTypes.get(reference.name) || 'text' : 'text';
    const className = !reference?.valid
      ? 'cm-promptInvalidReference'
      : parameterType === 'table'
        ? 'cm-promptTableParameter'
        : 'cm-promptTextParameter';
    builder.add(from, to, Decoration.mark({ class: className }));
  });

  return builder.finish();
};

const createPromptHighlightPlugin = (parametersRef: React.MutableRefObject<StepParameter[]>) =>
  ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, parametersRef.current);
      }

      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged || update.transactions.length > 0) {
          this.decorations = buildDecorations(update.view, parametersRef.current);
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
    }
  );

const makeRefAdapter = (view: EditorView | null): HTMLTextAreaElement | null => {
  if (!view) return null;
  const handle: PromptEditorHandle = {
    focus: () => view.focus(),
    get selectionStart() {
      return view.state.selection.main.head;
    },
    setSelectionRange: (anchor: number, head: number) => {
      const docLength = view.state.doc.length;
      const safeAnchor = Math.max(0, Math.min(anchor, docLength));
      const safeHead = Math.max(0, Math.min(head, docLength));
      view.dispatch({
        selection: { anchor: safeAnchor, head: safeHead },
        scrollIntoView: true,
      });
      view.focus();
    },
  };
  return handle as unknown as HTMLTextAreaElement;
};

export const PromptCodeEditor: React.FC<PromptCodeEditorProps> = ({
  value,
  onChange,
  parameters = [],
  language,
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
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const parametersRef = useRef<StepParameter[]>(parameters);
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef(value);
  const onFocusRef = useRef(onFocus);
  const onBlurRef = useRef(onBlur);
  const onKeyDownRef = useRef(onKeyDown);
  const onClickRef = useRef(onClick);
  const onSelectRef = useRef(onSelect);
  const isSyncingExternalValueRef = useRef(false);

  parametersRef.current = parameters;
  onChangeRef.current = onChange;
  onFocusRef.current = onFocus;
  onBlurRef.current = onBlur;
  onKeyDownRef.current = onKeyDown;
  onClickRef.current = onClick;
  onSelectRef.current = onSelect;

  const promptTheme = useMemo(
    () =>
      EditorView.theme({
        '&': {
          minHeight: minHeight ? `${minHeight}px` : undefined,
          maxHeight: maxHeight ? `${maxHeight}px` : undefined,
          resize: allowManualResize ? 'vertical' : undefined,
          overflow: allowManualResize ? 'auto' : undefined,
        },
        '.cm-scroller': {
          minHeight: minHeight ? `${minHeight}px` : undefined,
          maxHeight: maxHeight ? `${maxHeight}px` : undefined,
          overflow: maxHeight ? 'auto' : 'hidden',
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: '0.875rem',
          lineHeight: '1.625',
        },
        '.cm-content': {
          padding: '0',
          color: '#e2e8f0',
          caretColor: '#67e8f9',
          minHeight: minHeight ? `${minHeight}px` : undefined,
          whiteSpace: 'pre-wrap',
        },
        '.cm-line': {
          padding: '0',
        },
        '.cm-focused': {
          outline: 'none',
        },
        '.cm-cursor': {
          borderLeftColor: '#67e8f9',
        },
        '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
          backgroundColor: 'rgba(6, 182, 212, 0.28)',
        },
        '.cm-placeholder': {
          color: '#475569',
        },
        '.cm-promptTextParameter': {
          color: '#a5f3fc',
          backgroundColor: 'rgba(6, 182, 212, 0.14)',
          border: '1px solid rgba(6, 182, 212, 0.35)',
          borderRadius: '4px',
        },
        '.cm-promptTableParameter': {
          color: '#f5d0fe',
          backgroundColor: 'rgba(217, 70, 239, 0.14)',
          border: '1px solid rgba(217, 70, 239, 0.35)',
          borderRadius: '4px',
        },
        '.cm-promptGlobalReference': {
          color: '#bbf7d0',
          backgroundColor: 'rgba(34, 197, 94, 0.12)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '4px',
        },
        '.cm-promptInvalidReference': {
          color: '#fecaca',
          backgroundColor: 'rgba(239, 68, 68, 0.14)',
          textDecoration: 'underline wavy #f87171',
          textUnderlineOffset: '3px',
          borderRadius: '4px',
        },
        '.cm-promptLegacyReference': {
          color: '#fde68a',
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          border: '1px dashed rgba(245, 158, 11, 0.4)',
          borderRadius: '4px',
        },
      }),
    [allowManualResize, maxHeight, minHeight]
  );

  const assignExternalRef = useCallback(
    (view: EditorView | null) => {
      if (!externalRef) return;
      const adapter = makeRefAdapter(view);
      if (typeof externalRef === 'function') {
        externalRef(adapter);
        return;
      }
      (externalRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = adapter;
    },
    [externalRef]
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const view = new EditorView({
      parent: host,
      doc: initialValueRef.current,
      extensions: [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.lineWrapping,
        EditorView.editable.of(!readOnly),
        EditorView.contentAttributes.of({
          'aria-label': language === 'zh-CN' ? '函数体编辑器' : 'Function body editor',
          spellcheck: 'false',
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isSyncingExternalValueRef.current) {
            onChangeRef.current(update.state.doc.toString());
          }
          if (update.selectionSet) {
            onSelectRef.current?.({} as React.SyntheticEvent<HTMLTextAreaElement>);
          }
        }),
        EditorView.domEventHandlers({
          focus: () => {
            onFocusRef.current?.({} as React.FocusEvent<HTMLTextAreaElement>);
          },
          blur: () => {
            onBlurRef.current?.();
          },
          keydown: (event) => {
            onKeyDownRef.current?.(event as unknown as React.KeyboardEvent<HTMLTextAreaElement>);
          },
          click: (event) => {
            onClickRef.current?.(event as unknown as React.MouseEvent<HTMLTextAreaElement>);
          },
        }),
        createPromptHighlightPlugin(parametersRef),
        promptTheme,
        placeholder ? cmPlaceholder(placeholder) : [],
      ],
    });

    viewRef.current = view;
    assignExternalRef(view);
    if (autoFocus) {
      requestAnimationFrame(() => {
        view.focus();
        view.dispatch({
          selection: { anchor: view.state.doc.length },
          scrollIntoView: true,
        });
      });
    }

    return () => {
      assignExternalRef(null);
      view.destroy();
      viewRef.current = null;
    };
  }, [assignExternalRef, autoFocus, language, placeholder, promptTheme, readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    isSyncingExternalValueRef.current = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
    isSyncingExternalValueRef.current = false;
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({});
  }, [parameters]);

  return (
    <div
      ref={hostRef}
      className={`relative w-full ${className || ''}`}
    />
  );
};
