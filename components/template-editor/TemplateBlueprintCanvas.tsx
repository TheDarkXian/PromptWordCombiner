import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildStepGraph, extractTemplateVariableKeys } from '../../services/stepGraphService';
import { t } from '../../services/i18n';
import { Template, UiLanguage } from '../../types';

interface ConnectRequest {
  fromStepId: string;
  toStepId: string;
  toVariableKey: string;
}

interface DebugState {
  currentStepId?: string;
  successStepIds?: string[];
  errorStepIds?: string[];
  blockedStepIds?: string[];
  recentPathEdgeKeys?: string[];
}

interface TemplateBlueprintCanvasProps {
  language: UiLanguage;
  template: Template;
  selectedStepIds: string[];
  onSelectSteps: (stepIds: string[]) => void;
  onMoveNodes: (stepIds: string[], dx: number, dy: number) => void;
  onConnect: (input: ConnectRequest) => void;
  onRemoveEdge: (fromStepId: string, toStepId: string, variableKey: string) => void;
  onViewportChange: (x: number, y: number, zoom: number) => void;
  onTidyLayout: () => void;
  onResetLayout: () => void;
  onCreateStepRequest: () => void;
  debugState?: DebugState;
  activeTool?: BlueprintActiveTool;
  onActiveToolChange?: (tool: BlueprintActiveTool) => void;
  minimapCollapsed?: boolean;
  onMinimapCollapsedChange?: (collapsed: boolean) => void;
}

const NODE_W = 260;
const NODE_H = 130;
const MINIMAP_W = 200;
const MINIMAP_H = 132;
const MINIMAP_COMPACT_W = 152;
const MINIMAP_COMPACT_H = 104;
const MINIMAP_PADDING = 10;

type Mode = 'idle' | 'panning' | 'dragging_nodes' | 'linking_pin' | 'marquee_select' | 'editing_comment';
export type BlueprintActiveTool = 'pan' | 'move';

const isEditableEventTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
};

export const TemplateBlueprintCanvas: React.FC<TemplateBlueprintCanvasProps> = ({
  language,
  template,
  selectedStepIds,
  onSelectSteps,
  onMoveNodes,
  onConnect,
  onRemoveEdge,
  onViewportChange,
  onTidyLayout,
  onResetLayout,
  onCreateStepRequest,
  debugState,
  activeTool: controlledActiveTool,
  onActiveToolChange,
  minimapCollapsed,
  onMinimapCollapsedChange,
}) => {
  const graph = useMemo(() => buildStepGraph(template), [template]);
  const viewport = template.blueprint?.viewport || { x: 0, y: 0, zoom: 1 };
  const nodes = useMemo(() => template.blueprint?.nodes || {}, [template.blueprint?.nodes]);
  const [mode, setMode] = useState<Mode>('idle');
  const [localActiveTool, setLocalActiveTool] = useState<BlueprintActiveTool>('move');
  const [spacePressed, setSpacePressed] = useState(false);
  const [linkingFromStepId, setLinkingFromStepId] = useState<string | null>(null);
  const [selectedEdgeKey, setSelectedEdgeKey] = useState<string | null>(null);
  const [hoverConnectTarget, setHoverConnectTarget] = useState<{ stepId: string; variableKey?: string } | null>(null);
  const [mousePoint, setMousePoint] = useState<{ x: number; y: number } | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const [localMinimapCollapsed, setLocalMinimapCollapsed] = useState(false);
  const [isMinimapDragging, setIsMinimapDragging] = useState(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartWorldRef = useRef<{ x: number; y: number } | null>(null);
  const draggingNodeIdsRef = useRef<string[]>([]);
  const marqueeShiftRef = useRef(false);
  const canvasPointerStartRef = useRef<{ x: number; y: number; target: 'canvas' | 'other' } | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const activeTool = controlledActiveTool || localActiveTool;
  const isMinimapCollapsed = minimapCollapsed ?? localMinimapCollapsed;
  const setActiveTool = (tool: BlueprintActiveTool) => {
    setLocalActiveTool(tool);
    onActiveToolChange?.(tool);
  };
  const setIsMinimapCollapsed = (collapsed: boolean) => {
    setLocalMinimapCollapsed(collapsed);
    onMinimapCollapsedChange?.(collapsed);
  };

  const graphBounds = useMemo(() => {
    const pts = template.steps.map((step) => nodes[step.id]).filter(Boolean) as { x: number; y: number }[];
    if (pts.length === 0) return { minX: 0, minY: 0, maxX: NODE_W, maxY: NODE_H };
    const margin = 160;
    return {
      minX: Math.min(...pts.map((p) => p.x)) - margin,
      minY: Math.min(...pts.map((p) => p.y)) - margin,
      maxX: Math.max(...pts.map((p) => p.x + NODE_W)) + margin,
      maxY: Math.max(...pts.map((p) => p.y + NODE_H)) + margin,
    };
  }, [nodes, template.steps]);

  const minimapSize = canvasSize.width < 640 || canvasSize.height < 460
    ? { width: MINIMAP_COMPACT_W, height: MINIMAP_COMPACT_H }
    : { width: MINIMAP_W, height: MINIMAP_H };

  const minimapMetrics = useMemo(() => {
    const graphWidth = Math.max(1, graphBounds.maxX - graphBounds.minX);
    const graphHeight = Math.max(1, graphBounds.maxY - graphBounds.minY);
    const drawableWidth = Math.max(1, minimapSize.width - MINIMAP_PADDING * 2);
    const drawableHeight = Math.max(1, minimapSize.height - MINIMAP_PADDING * 2);
    const scale = Math.min(drawableWidth / graphWidth, drawableHeight / graphHeight);
    const offsetX = (minimapSize.width - graphWidth * scale) / 2;
    const offsetY = (minimapSize.height - graphHeight * scale) / 2;
    return { graphWidth, graphHeight, scale, offsetX, offsetY };
  }, [graphBounds, minimapSize.height, minimapSize.width]);

  const toWorld = (x: number, y: number, rect: DOMRect) => ({
    x: (x - rect.left - viewport.x) / viewport.zoom,
    y: (y - rect.top - viewport.y) / viewport.zoom,
  });

  const worldToMinimap = (x: number, y: number) => ({
    x: minimapMetrics.offsetX + (x - graphBounds.minX) * minimapMetrics.scale,
    y: minimapMetrics.offsetY + (y - graphBounds.minY) * minimapMetrics.scale,
  });

  const minimapToWorld = (x: number, y: number) => ({
    x: graphBounds.minX + (x - minimapMetrics.offsetX) / minimapMetrics.scale,
    y: graphBounds.minY + (y - minimapMetrics.offsetY) / minimapMetrics.scale,
  });

  const centerViewportOnWorld = (x: number, y: number) => {
    onViewportChange(
      canvasSize.width / 2 - x * viewport.zoom,
      canvasSize.height / 2 - y * viewport.zoom,
      viewport.zoom
    );
  };

  const fitGraphToView = () => {
    const graphWidth = Math.max(1, graphBounds.maxX - graphBounds.minX);
    const graphHeight = Math.max(1, graphBounds.maxY - graphBounds.minY);
    const padding = 72;
    const nextZoom = Math.min(
      1.4,
      Math.max(
        0.35,
        Math.min(
          (canvasSize.width - padding * 2) / graphWidth,
          (canvasSize.height - padding * 2) / graphHeight
        )
      )
    );
    const centerX = graphBounds.minX + graphWidth / 2;
    const centerY = graphBounds.minY + graphHeight / 2;
    onViewportChange(
      canvasSize.width / 2 - centerX * nextZoom,
      canvasSize.height / 2 - centerY * nextZoom,
      nextZoom
    );
  };

  const focusSelectedNode = () => {
    const stepId = selectedStepIds[0];
    if (!stepId) return;
    const pos = nodes[stepId];
    if (!pos) return;
    centerViewportOnWorld(pos.x + NODE_W / 2, pos.y + NODE_H / 2);
  };

  const centerViewportFromMinimapEvent = (
    event: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const miniX = event.clientX - rect.left;
    const miniY = event.clientY - rect.top;
    const world = minimapToWorld(miniX, miniY);
    centerViewportOnWorld(world.x, world.y);
  };

  const visibleWorldRect = {
    x: -viewport.x / viewport.zoom,
    y: -viewport.y / viewport.zoom,
    width: canvasSize.width / viewport.zoom,
    height: canvasSize.height / viewport.zoom,
  };

  const visibleMinimapRect = {
    x: worldToMinimap(visibleWorldRect.x, visibleWorldRect.y).x,
    y: worldToMinimap(visibleWorldRect.x, visibleWorldRect.y).y,
    width: visibleWorldRect.width * minimapMetrics.scale,
    height: visibleWorldRect.height * minimapMetrics.scale,
  };
  const canvasCursorClass =
    mode === 'panning'
      ? 'cursor-grabbing'
      : activeTool === 'pan' || spacePressed
        ? 'cursor-grab'
        : mode === 'marquee_select'
          ? 'cursor-crosshair'
          : 'cursor-default';

  useEffect(() => {
    const node = wrapperRef.current;
    if (!node) return undefined;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setCanvasSize({
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEventTarget(event.target)) return;
      if (event.code === 'Space') setSpacePressed(true);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        // handled by parent shortcuts
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === '0') {
        onViewportChange(0, 0, 1);
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        onCreateStepRequest();
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedEdgeKey) {
        const [fromStepId, toStepId, variableKey] = selectedEdgeKey.split('__');
        onRemoveEdge(fromStepId, toStepId, variableKey);
        setSelectedEdgeKey(null);
      }
      if (event.key === 'Escape' && mode === 'marquee_select') {
        setMode('idle');
        setMarqueeRect(null);
        pointerStartRef.current = null;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        onSelectSteps(template.steps.map((step) => step.id));
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (isEditableEventTarget(event.target)) return;
      if (event.code === 'Space') setSpacePressed(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [mode, onCreateStepRequest, onRemoveEdge, onSelectSteps, onViewportChange, selectedEdgeKey, template.steps]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-slate-800 bg-slate-950/40 p-2">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>
            Blueprint - {t(language, 'templateEditor.blueprintZoom', { value: Math.round(viewport.zoom * 100) })}
            {mode === 'marquee_select' ? ' - Marquee' : ''}
          </span>
          <span className="hidden text-[10px] text-slate-500 xl:inline">
            {language === 'zh-CN'
              ? activeTool === 'pan'
                ? '当前：拖动画布 / 滚轮缩放'
                : '当前：拖动节点 / Shift 框选 / 空白处拖动画布'
              : activeTool === 'pan'
                ? 'Current: drag canvas / wheel to zoom'
                : 'Current: move nodes / Shift-select / drag blank canvas'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-slate-700 bg-slate-950">
            <button
              type="button"
              onClick={() => setActiveTool('pan')}
              className={`px-2 py-1 text-xs font-bold transition-colors ${
                activeTool === 'pan'
                  ? 'bg-cyan-500/20 text-cyan-200'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
              title={language === 'zh-CN' ? '拖动画布' : 'Pan canvas'}
            >
              {language === 'zh-CN' ? '拖动画布' : 'Pan'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTool('move')}
              className={`border-l border-slate-700 px-2 py-1 text-xs font-bold transition-colors ${
                activeTool === 'move'
                  ? 'bg-cyan-500/20 text-cyan-200'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
              title={language === 'zh-CN' ? '拖动节点' : 'Move nodes'}
            >
              {language === 'zh-CN' ? '拖动节点' : 'Move'}
            </button>
          </div>
          <button onClick={onCreateStepRequest} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200">
            + Node (Tab)
          </button>
          <button onClick={onTidyLayout} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200">
            {language === 'zh-CN' ? '整理布局' : 'Tidy'}
          </button>
          <button onClick={onResetLayout} className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
            {language === 'zh-CN' ? '重置布局' : 'Reset'}
          </button>
          <button
            type="button"
            onClick={fitGraphToView}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 transition-colors hover:border-cyan-500 hover:text-white"
          >
            {language === 'zh-CN' ? '适配视图' : 'Fit'}
          </button>
          <button
            type="button"
            onClick={focusSelectedNode}
            disabled={!selectedStepIds[0]}
            className={`rounded-md border px-2 py-1 text-xs transition-colors ${
              selectedStepIds[0]
                ? 'border-slate-700 bg-slate-900 text-slate-200 hover:border-cyan-500 hover:text-white'
                : 'cursor-not-allowed border-slate-800 bg-slate-950 text-slate-600'
            }`}
          >
            {language === 'zh-CN' ? '定位节点' : 'Focus'}
          </button>
        </div>
      </div>

      <div
        ref={wrapperRef}
        tabIndex={0}
        className={`relative min-h-[360px] flex-1 select-none overflow-hidden rounded-md border border-slate-800 bg-slate-900 ${canvasCursorClass}`}
        onContextMenu={(event) => event.preventDefault()}
        onMouseDown={(event) => {
          const target = event.target as HTMLElement;
          const interactiveTarget = target.closest(
            '[data-blueprint-interactive="true"], button, input, textarea, select'
          );
          const panBlockedTarget = target.closest(
            '[data-blueprint-pan-blocker="true"], button, input, textarea, select'
          );
          const isCanvasTarget = !interactiveTarget;
          setSelectedEdgeKey(null);
          canvasPointerStartRef.current = {
            x: event.clientX,
            y: event.clientY,
            target: isCanvasTarget ? 'canvas' : 'other',
          };
          if (activeTool === 'pan' && !panBlockedTarget && (event.button === 0 || event.button === 1 || event.button === 2)) {
            event.preventDefault();
            setMode('panning');
            pointerStartRef.current = { x: event.clientX, y: event.clientY };
            return;
          }
          if (activeTool === 'move' && event.shiftKey && isCanvasTarget && event.button === 0) {
            event.preventDefault();
            marqueeShiftRef.current = event.ctrlKey || event.metaKey;
            setMode('marquee_select');
            const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            setMarqueeRect({ x, y, w: 0, h: 0 });
            pointerStartRef.current = { x: event.clientX, y: event.clientY };
            return;
          }
          if (activeTool === 'move' && isCanvasTarget && (spacePressed || event.button === 0 || event.button === 1 || event.button === 2)) {
            event.preventDefault();
            setMode('panning');
            pointerStartRef.current = { x: event.clientX, y: event.clientY };
          }
        }}
        onMouseMove={(event) => {
          const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
          setMousePoint({ x: event.clientX - rect.left, y: event.clientY - rect.top });
          if (mode === 'panning' && pointerStartRef.current) {
            onViewportChange(
              viewport.x + (event.clientX - pointerStartRef.current.x),
              viewport.y + (event.clientY - pointerStartRef.current.y),
              viewport.zoom
            );
            pointerStartRef.current = { x: event.clientX, y: event.clientY };
          } else if (mode === 'dragging_nodes' && dragStartWorldRef.current) {
            const world = toWorld(event.clientX, event.clientY, rect);
            const dx = Math.round(world.x - dragStartWorldRef.current.x);
            const dy = Math.round(world.y - dragStartWorldRef.current.y);
            if (dx !== 0 || dy !== 0) {
              onMoveNodes(draggingNodeIdsRef.current, dx, dy);
              dragStartWorldRef.current = world;
            }
          } else if (mode === 'marquee_select' && marqueeRect && pointerStartRef.current) {
            const sx = pointerStartRef.current.x - rect.left;
            const sy = pointerStartRef.current.y - rect.top;
            const ex = event.clientX - rect.left;
            const ey = event.clientY - rect.top;
            const x = Math.min(sx, ex);
            const y = Math.min(sy, ey);
            const w = Math.abs(ex - sx);
            const h = Math.abs(ey - sy);
            setMarqueeRect({ x, y, w, h });
          }
        }}
        onMouseUp={(event) => {
          if (mode === 'marquee_select' && marqueeRect && (marqueeRect.w > 3 || marqueeRect.h > 3)) {
            const selected = template.steps
              .filter((step) => {
                const pos = nodes[step.id] || { x: 0, y: 0 };
                const left = pos.x * viewport.zoom + viewport.x;
                const top = pos.y * viewport.zoom + viewport.y;
                const right = left + NODE_W * viewport.zoom;
                const bottom = top + NODE_H * viewport.zoom;
                return right >= marqueeRect.x && left <= marqueeRect.x + marqueeRect.w && bottom >= marqueeRect.y && top <= marqueeRect.y + marqueeRect.h;
              })
              .map((step) => step.id);
            if (marqueeShiftRef.current) {
              onSelectSteps([...new Set([...selectedStepIds, ...selected])]);
            } else {
              onSelectSteps(selected);
            }
          } else if (mode === 'panning' && canvasPointerStartRef.current?.target === 'canvas') {
            const moved =
              Math.abs(event.clientX - canvasPointerStartRef.current.x) > 3 ||
              Math.abs(event.clientY - canvasPointerStartRef.current.y) > 3;
            if (!moved) {
              onSelectSteps([]);
            }
          }
          if (mode === 'linking_pin' && linkingFromStepId && hoverConnectTarget && linkingFromStepId !== hoverConnectTarget.stepId) {
            const fromStep = template.steps.find((item) => item.id === linkingFromStepId);
            const fallbackVariableKey = fromStep?.outputBinding?.variableKey?.trim() || '';
            onConnect({
              fromStepId: linkingFromStepId,
              toStepId: hoverConnectTarget.stepId,
              toVariableKey: hoverConnectTarget.variableKey || fallbackVariableKey,
            });
          }
          setMode('idle');
          setMarqueeRect(null);
          pointerStartRef.current = null;
          dragStartWorldRef.current = null;
          draggingNodeIdsRef.current = [];
          canvasPointerStartRef.current = null;
          setLinkingFromStepId(null);
          setHoverConnectTarget(null);
        }}
        onMouseLeave={() => {
          if (mode === 'marquee_select' && marqueeRect && (marqueeRect.w > 3 || marqueeRect.h > 3)) {
            const selected = template.steps
              .filter((step) => {
                const pos = nodes[step.id] || { x: 0, y: 0 };
                const left = pos.x * viewport.zoom + viewport.x;
                const top = pos.y * viewport.zoom + viewport.y;
                const right = left + NODE_W * viewport.zoom;
                const bottom = top + NODE_H * viewport.zoom;
                return right >= marqueeRect.x && left <= marqueeRect.x + marqueeRect.w && bottom >= marqueeRect.y && top <= marqueeRect.y + marqueeRect.h;
              })
              .map((step) => step.id);
            if (marqueeShiftRef.current) {
              onSelectSteps([...new Set([...selectedStepIds, ...selected])]);
            } else {
              onSelectSteps(selected);
            }
          }
          setMode('idle');
          setMarqueeRect(null);
          pointerStartRef.current = null;
          dragStartWorldRef.current = null;
          draggingNodeIdsRef.current = [];
          canvasPointerStartRef.current = null;
          setMousePoint(null);
          setHoverConnectTarget(null);
          setLinkingFromStepId(null);
        }}
        onWheel={(event) => {
          event.preventDefault();
          const nextZoom = Math.min(2, Math.max(0.5, viewport.zoom + (event.deltaY < 0 ? 0.05 : -0.05)));
          onViewportChange(viewport.x, viewport.y, nextZoom);
        }}
      >
        <div
          data-role="canvas"
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.2) 1px, transparent 0)',
            backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`,
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          }}
        />

        <svg className="absolute inset-0 h-full w-full">
          {graph.edges.map((edge) => {
            const from = nodes[edge.fromStepId];
            const to = nodes[edge.toStepId];
            if (!from || !to) return null;
            const inputKeys = extractTemplateVariableKeys(template.steps.find((step) => step.id === edge.toStepId)?.content || '');
            const idx = Math.max(0, inputKeys.indexOf(edge.variableKey));
            const yOffset = 32 + idx * 16;
            const x1 = from.x * viewport.zoom + viewport.x + NODE_W * viewport.zoom;
            const y1 = from.y * viewport.zoom + viewport.y + (NODE_H / 2) * viewport.zoom;
            const x2 = to.x * viewport.zoom + viewport.x;
            const y2 = to.y * viewport.zoom + viewport.y + yOffset * viewport.zoom;
            const cx1 = x1 + 48 * viewport.zoom;
            const cx2 = x2 - 48 * viewport.zoom;
            const d = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
            const edgeKey = `${edge.fromStepId}__${edge.toStepId}__${edge.variableKey}`;
            const selected = selectedEdgeKey === edgeKey;
            const inRecentPath = debugState?.recentPathEdgeKeys?.includes(edgeKey);
            return (
              <g key={edgeKey}>
                <path
                  d={d}
                  stroke={selected ? 'rgba(251,191,36,1)' : inRecentPath ? 'rgba(34,197,94,0.95)' : 'rgba(56,189,248,0.85)'}
                  strokeWidth={selected ? 3 : 2}
                  fill="none"
                  pointerEvents="none"
                />
                <path
                  data-blueprint-interactive="true"
                  d={d}
                  stroke="transparent"
                  strokeWidth={14}
                  fill="none"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedEdgeKey(edgeKey);
                  }}
                />
              </g>
            );
          })}
          {linkingFromStepId && mousePoint && (() => {
            const from = nodes[linkingFromStepId];
            if (!from) return null;
            const x1 = from.x * viewport.zoom + viewport.x + NODE_W * viewport.zoom;
            const y1 = from.y * viewport.zoom + viewport.y + (NODE_H / 2) * viewport.zoom;
            const x2 = mousePoint.x;
            const y2 = mousePoint.y;
            const d = `M ${x1} ${y1} C ${x1 + 48 * viewport.zoom} ${y1}, ${x2 - 48 * viewport.zoom} ${y2}, ${x2} ${y2}`;
            return <path d={d} stroke="rgba(251,191,36,0.95)" strokeWidth={2} strokeDasharray="6 4" fill="none" />;
          })()}
        </svg>

        {template.steps.map((step) => {
          const pos = nodes[step.id] || { x: 0, y: 0 };
          const inputKeys = extractTemplateVariableKeys(step.content || '');
          const selected = selectedStepIds.includes(step.id);
          const isCurrent = debugState?.currentStepId === step.id;
          const isError = debugState?.errorStepIds?.includes(step.id);
          const isBlocked = debugState?.blockedStepIds?.includes(step.id);
          const isSuccess = debugState?.successStepIds?.includes(step.id);
          return (
            <div
              data-blueprint-interactive="true"
              key={step.id}
              className={`absolute ${activeTool === 'pan' ? 'cursor-grab' : 'cursor-move'} rounded-lg border p-3 shadow ${
                isError
                  ? 'border-red-400 bg-red-950/20'
                  : isBlocked
                    ? 'border-amber-400 bg-amber-950/20'
                    : isSuccess
                      ? 'border-emerald-400 bg-emerald-950/20'
                      : selected
                        ? 'border-cyan-400 bg-slate-800'
                        : 'border-slate-700 bg-slate-900'
              } ${isCurrent ? 'ring-2 ring-cyan-400/70' : ''}`}
              style={{
                left: pos.x * viewport.zoom + viewport.x,
                top: pos.y * viewport.zoom + viewport.y,
                width: NODE_W * viewport.zoom,
                minHeight: NODE_H * viewport.zoom,
              }}
              onMouseDown={(event) => {
                const shouldAppend = event.shiftKey;
                const nextSelection = shouldAppend
                  ? selected
                    ? selectedStepIds.filter((id) => id !== step.id)
                    : [...selectedStepIds, step.id]
                  : selected
                    ? selectedStepIds
                    : [step.id];
                onSelectSteps(nextSelection);

                if (activeTool === 'pan') {
                  return;
                }
                if (spacePressed) return;
                event.preventDefault();
                event.stopPropagation();
                draggingNodeIdsRef.current = nextSelection;
                setMode('dragging_nodes');
                const rect = wrapperRef.current?.getBoundingClientRect();
                if (!rect) return;
                dragStartWorldRef.current = toWorld(event.clientX, event.clientY, rect);
              }}
              onMouseEnter={() => {
                if (linkingFromStepId && linkingFromStepId !== step.id) {
                  setHoverConnectTarget({ stepId: step.id, variableKey: inputKeys[0] });
                }
              }}
              onMouseLeave={() => {
                setHoverConnectTarget((prev) => (prev?.stepId === step.id ? null : prev));
              }}
            >
              <div className="truncate text-sm font-semibold text-white">{step.name}</div>
              <div className="mt-1 truncate text-xs text-slate-400">{step.stepType || 'manual'}</div>
              <div className="mt-2 truncate text-[11px] text-cyan-300">
                out: {step.outputBinding?.variableKey?.trim() ? `{{${step.outputBinding?.variableKey?.trim()}}}` : '(none)'}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">in pins: {inputKeys.length}</div>

              {inputKeys.length > 0 &&
                inputKeys.map((key, index) => (
                <button
                  key={`${step.id}_${key}`}
                  className="absolute -left-2 h-3 rounded-full border border-slate-500 bg-slate-800 px-1 text-[9px] text-slate-300"
                  style={{ top: `${34 + index * 16}px` }}
                  onMouseEnter={() => setHoverConnectTarget({ stepId: step.id, variableKey: key })}
                  onMouseLeave={() =>
                    setHoverConnectTarget((prev) =>
                      prev?.stepId === step.id && prev.variableKey === key ? null : prev
                    )
                  }
                  title={key}
                  data-blueprint-pan-blocker="true"
                >
                  {key}
                </button>
              ))}
              {step.outputBinding?.variableKey?.trim() ? (
                <button
                  className="absolute -right-2 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-cyan-400 bg-cyan-500/40"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setLinkingFromStepId(step.id);
                    setMode('linking_pin');
                  }}
                  title="output"
                  data-blueprint-pan-blocker="true"
                />
              ) : null}
            </div>
          );
        })}

        {marqueeRect && (
          <div
            className="pointer-events-none absolute border border-cyan-400 bg-cyan-500/10"
            style={{ left: marqueeRect.x, top: marqueeRect.y, width: marqueeRect.w, height: marqueeRect.h }}
          />
        )}

        <div
          data-blueprint-interactive="true"
          data-blueprint-pan-blocker="true"
          className="absolute bottom-2 right-2 rounded border border-slate-700 bg-slate-950/90 p-1 shadow-xl shadow-black/30"
        >
          {isMinimapCollapsed ? (
            <button
              className="rounded bg-slate-900 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300 hover:text-white"
              onClick={() => setIsMinimapCollapsed(false)}
            >
              Map
            </button>
          ) : (
            <>
              <div className="mb-1 flex items-center justify-between gap-3 px-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                <span>MiniMap</span>
                <button
                  className="text-slate-500 hover:text-white"
                  onClick={() => setIsMinimapCollapsed(true)}
                  title="Collapse minimap"
                >
                  x
                </button>
              </div>
              <svg
                width={minimapSize.width}
                height={minimapSize.height}
                className="cursor-crosshair"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setIsMinimapDragging(true);
                  centerViewportFromMinimapEvent(event);
                }}
                onPointerMove={(event) => {
                  if (!isMinimapDragging) return;
                  event.preventDefault();
                  centerViewportFromMinimapEvent(event);
                }}
                onPointerUp={(event) => {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                  setIsMinimapDragging(false);
                }}
                onPointerCancel={() => setIsMinimapDragging(false)}
              >
                <rect x={0} y={0} width={minimapSize.width} height={minimapSize.height} fill="#0f172a" />
                {graph.edges.map((edge) => {
                  const from = nodes[edge.fromStepId];
                  const to = nodes[edge.toStepId];
                  if (!from || !to) return null;
                  const fromPoint = worldToMinimap(from.x + NODE_W, from.y + NODE_H / 2);
                  const toPoint = worldToMinimap(to.x, to.y + NODE_H / 2);
                  const edgeKey = `${edge.fromStepId}__${edge.toStepId}__${edge.variableKey}`;
                  const inRecentPath = debugState?.recentPathEdgeKeys?.includes(edgeKey);
                  return (
                    <line
                      key={`mini_edge_${edgeKey}`}
                      x1={fromPoint.x}
                      y1={fromPoint.y}
                      x2={toPoint.x}
                      y2={toPoint.y}
                      stroke={inRecentPath ? '#22c55e' : '#334155'}
                      strokeWidth={inRecentPath ? 1.4 : 0.8}
                    />
                  );
                })}
                {template.steps.map((step) => {
                  const p = nodes[step.id] || { x: 0, y: 0 };
                  const topLeft = worldToMinimap(p.x, p.y);
                  const width = Math.max(5, NODE_W * minimapMetrics.scale);
                  const height = Math.max(4, NODE_H * minimapMetrics.scale);
                  const isCurrent = debugState?.currentStepId === step.id;
                  const isError = debugState?.errorStepIds?.includes(step.id);
                  const isBlocked = debugState?.blockedStepIds?.includes(step.id);
                  const isSuccess = debugState?.successStepIds?.includes(step.id);
                  const fill = isError
                    ? '#f87171'
                    : isBlocked
                      ? '#f59e0b'
                      : isCurrent
                        ? '#a78bfa'
                        : isSuccess
                          ? '#34d399'
                          : selectedStepIds.includes(step.id)
                            ? '#22d3ee'
                            : '#64748b';
                  return (
                    <rect
                      key={`mini_${step.id}`}
                      x={topLeft.x}
                      y={topLeft.y}
                      width={width}
                      height={height}
                      rx={2}
                      fill={fill}
                    >
                      <title>{step.name}</title>
                    </rect>
                  );
                })}
                <rect
                  x={MINIMAP_PADDING / 2}
                  y={MINIMAP_PADDING / 2}
                  width={minimapSize.width - MINIMAP_PADDING}
                  height={minimapSize.height - MINIMAP_PADDING}
                  fill="none"
                  stroke="rgba(148,163,184,0.28)"
                />
                <rect
                  x={visibleMinimapRect.x}
                  y={visibleMinimapRect.y}
                  width={Math.max(8, visibleMinimapRect.width)}
                  height={Math.max(8, visibleMinimapRect.height)}
                  fill="rgba(56,189,248,0.12)"
                  stroke="rgba(56,189,248,0.9)"
                  strokeWidth={1.5}
                />
              </svg>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
