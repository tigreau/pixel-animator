import React, { useRef, useEffect, useState } from 'react';
import { useEditor } from '../../contexts/editorContextShared';
import { calculateLassoSelection } from '../../utils/lasso';
import { getLinePixels } from '../../utils/draw';
import { MagnifyingGlass } from '../MagnifyingGlass';
import { GRID_SIZE } from '../../types';

interface PointerCoords {
    clientX: number;
    clientY: number;
}

interface PixelProps {
    index: number;
    color: string | null;
    isSelected: boolean;
    isFloating: boolean;
    isStamping: boolean;
    isNudging: boolean;
}

const EMPTY_SPRITE = {
    pixelData: new Array(GRID_SIZE * GRID_SIZE).fill(null) as (string | null)[],
    overlayPixelData: new Array(GRID_SIZE * GRID_SIZE).fill(null) as (string | null)[]
};

const MemoizedPixel: React.FC<PixelProps> = React.memo(({
    index,
    color,
    isSelected,
    isFloating,
    isStamping,
    isNudging
}) => (
    <div
        data-pixel-index={index}
        className={`pixel ${color ? 'has-color' : ''} ${isSelected ? 'is-selected' : ''} ${isFloating ? 'is-floating' : ''} ${isStamping && isFloating && !isNudging ? 'stamping' : ''}`}
        style={color ? { backgroundColor: color, '--pixel-color': color } as React.CSSProperties : undefined}
    />
));

export const Editor: React.FC = () => {
    const EYEDROPPER_HOLD_MS = 2000;
    const MIN_VIEW_ZOOM = 0.5;
    const MAX_VIEW_ZOOM = 4;
    const editorContainerRef = useRef<HTMLDivElement>(null);
    // Track if drag started inside or outside selection to mask cursor visibility
    const [dragOrigin, setDragOrigin] = React.useState<'inside' | 'outside' | null>(null);
    const dragOriginRef = useRef<'inside' | 'outside' | null>(null);

    const {
        activeSprite,
        updatePixel,
        isDrawing,
        setIsDrawing,
        currentTool,
        fill,
        selectedPixels,
        addToSelection,
        setSelectedPixels,
        clearSelection,
        liftSelection,
        floatingLayer,
        isPlaying,
        isOnionSkinning,
        sprites,
        activeSpriteId,
        currentColor,
        setCurrentColor,
        isStamping,
        brushSize,
        addSelectionBatch,
        cancelStroke,
        setTool,
        activeLayer,
        setActiveLayer,
        isOverlayStacked,
        setIsOverlayStacked,
        recentColors,
        activeActions
    } = useEditor();

    const activeSpriteIndex = sprites.findIndex(s => s.id === activeSpriteId);
    const prevSprite = activeSpriteIndex > 0 ? sprites[activeSpriteIndex - 1] : null;

    // Use a ref to track if we stamped/ lasso-ed on this specific interaction
    const isLassoingRef = useRef(false);
    // Track last pixel for interpolation
    const lastPixelIndexRef = useRef<number | null>(null);
    const strokeStartIndexRef = useRef<number | null>(null);
    const strokeEndIndexRef = useRef<number | null>(null);
    const hasMovedInStrokeRef = useRef(false);
    const hasLeftCircleDetonatorRef = useRef(false);
    const isLineModeActiveRef = useRef(false);
    const isCircleModeActiveRef = useRef(false);
    const isAltPressedRef = useRef(false);

    // Nudge Selection Keyboard Listener REMOVED (Moved to Global Hook)
    // useEffect(() => {
    //     // ... logic moved to useKeyboardShortcuts
    // }, []);

    // Track zoom state for 1x brush
    const isZoomed = false;
    const zoomFocusRef = useRef<{ x: number, y: number } | null>(null);

    // Eyedropper State
    const [isEyedropperActive, setIsEyedropperActive] = useState(false);
    const [pointerPos, setPointerPos] = useState<{ x: number, y: number } | null>(null);
    const [eyedropperTargetIndex, setEyedropperTargetIndex] = useState<number | null>(null);
    const eyedropperTargetIndexRef = useRef<number | null>(null);
    const [linePreviewPixels, setLinePreviewPixels] = useState<number[]>([]);
    const [circlePreviewPixels, setCirclePreviewPixels] = useState<number[]>([]);
    const [showDropperHint, setShowDropperHint] = useState(false);
    const [shapeHintMode, setShapeHintMode] = useState<'line' | 'circle' | null>(null);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [viewZoom, setViewZoom] = useState(1);
    const [showBounce, setShowBounce] = useState(false);
    const [hasPickedColor, setHasPickedColor] = useState(recentColors.length > 0);

    useEffect(() => {
        if (recentColors.length > 0 && !hasPickedColor) {
            setHasPickedColor(true);
            setShowBounce(true);
        }
    }, [recentColors.length, hasPickedColor]);
    const [dropperHoldOverlay, setDropperHoldOverlay] = useState<
        | { kind: 'cells'; indices: number[]; baseColors: Record<number, string | null>; progress: number }
        | { kind: 'block'; x: number; y: number; w: number; h: number; baseColor: string | null; progress: number }
        | null
    >(null);

    // Refs for Long Press Logic
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pointerStartPosRef = useRef<{ x: number, y: number } | null>(null);
    const isPointerDownRef = useRef(false);
    const activePointerIdRef = useRef<number | null>(null);
    const activeTouchPointerIdsRef = useRef<Set<number>>(new Set());
    const activeTouchPointsRef = useRef<Map<number, { x: number; y: number }>>(new Map());
    const isGestureZoomingRef = useRef(false);
    const gestureTransformRef = useRef<{
        startDistance: number;
        startCenter: { x: number; y: number };
        startPan: { x: number; y: number };
        startZoom: number;
    } | null>(null);
    const activeTargetIndexRef = useRef<number | null>(null);
    const mouseHoverIndexRef = useRef<number | null>(null);
    const pendingFillPixelRef = useRef<number | null>(null);
    const isPanningRef = useRef(false);
    const panStartRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
    const shapeHintModeRef = useRef<'line' | 'circle' | null>(null);
    const workspaceRef = useRef<HTMLDivElement>(null);
    const stackButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (isOverlayStacked && activeLayer !== 'top') {
            setActiveLayer('top');
        }
    }, [isOverlayStacked, activeLayer, setActiveLayer]);

    // Handle Scroll on Zoom
    const containerRef = useRef<HTMLDivElement>(null);
    const panOffsetRef = useRef(panOffset);
    const viewZoomRef = useRef(viewZoom);

    useEffect(() => {
        panOffsetRef.current = panOffset;
    }, [panOffset]);

    useEffect(() => {
        viewZoomRef.current = viewZoom;
    }, [viewZoom]);

    const clampPanOffset = (nextX: number, nextY: number) => {
        const container = containerRef.current;
        const workspace = workspaceRef.current;
        if (!container || !workspace) {
            return { x: nextX, y: nextY };
        }

        const minVisible = 48;
        const containerW = container.clientWidth;
        const containerH = container.clientHeight;
        const workspaceW = workspace.offsetWidth;
        let workspaceH = workspace.offsetHeight;

        if (stackButtonRef.current) {
            const btnParent = stackButtonRef.current.offsetParent as HTMLElement | null;
            if (btnParent) {
                const protrusion = Math.max(
                    0,
                    stackButtonRef.current.offsetTop + stackButtonRef.current.offsetHeight - btnParent.offsetHeight
                );
                workspaceH += protrusion;
            }
        }

        const maxX = (containerW + workspaceW) / 2 - minVisible;
        const minX = -(containerW + workspaceW) / 2 + minVisible;
        const maxY = (containerH + workspaceH) / 2 - minVisible;
        const minY = -(containerH + workspaceH) / 2 + minVisible;

        return {
            x: Math.max(minX, Math.min(maxX, nextX)),
            y: Math.max(minY, Math.min(maxY, nextY))
        };
    };

    const getTouchGestureMetrics = () => {
        const points = Array.from(activeTouchPointsRef.current.values());
        if (points.length < 2) return null;

        const [first, second] = points;
        return {
            center: {
                x: (first.x + second.x) / 2,
                y: (first.y + second.y) / 2
            },
            distance: Math.hypot(second.x - first.x, second.y - first.y)
        };
    };

    const startTouchGestureTransform = () => {
        const metrics = getTouchGestureMetrics();
        if (!metrics) return;

        gestureTransformRef.current = {
            startDistance: Math.max(metrics.distance, 1),
            startCenter: metrics.center,
            startPan: panOffsetRef.current,
            startZoom: viewZoomRef.current
        };
    };

    React.useLayoutEffect(() => {
        if (isZoomed && zoomFocusRef.current && containerRef.current) {
            const { x, y } = zoomFocusRef.current;
            const container = containerRef.current;

            // Editor is now 926px wide.
            // 32 units. Each unit is ~28.9px
            const pixelSize = (463 * 2) / 32;

            // Calculate center scroll
            const scrollLeft = (x * pixelSize) - (container.clientWidth / 2) + (pixelSize / 2);
            const scrollTop = (y * pixelSize) - (container.clientHeight / 2) + (pixelSize / 2);

            container.scrollTo({
                left: scrollLeft,
                top: scrollTop,
                behavior: 'smooth'
            });
        }
    }, [isZoomed]);

    const highlightRef = useRef<HTMLDivElement>(null);

    const styles = React.useMemo(() => {
        // Precise Pixel Calculation
        // Editor Base Width: 463px
        // Grid Size: 32
        const BASE_PIXEL = 463 / 32; // ~14.46875px

        // Target Container Size (The actual visual footprint)
        // 1x Unzoomed: 1 cell (~14.47px)
        // 1x Zoomed / 2x: 2 cells worth (~28.94px) - representing 1 scaled pixel or 2x2 real pixels
        const containerSize = (brushSize === 1 && !isZoomed) ? BASE_PIXEL : (BASE_PIXEL * 2);

        // Inner drawing size (smaller than pixel as requested)
        // Previous pad was 1 (border). New pad:
        // Try to make it ~10-15% smaller visually.
        // For ~14px, pad 3px -> 8px box.
        // For ~29px, pad 6px -> 17px box.
        const pad = (brushSize === 1 && !isZoomed) ? 3 : 6;
        const drawSize = containerSize - (pad * 2);

        if (currentTool === 'brush') {
            const half = containerSize / 2;
            const hotspotX = brushSize === 2 ? 0 : half;
            const hotspotY = brushSize === 2 ? 0 : half;

            const svg = `
                <svg width="${containerSize}" height="${containerSize}" viewBox="0 0 ${containerSize} ${containerSize}" xmlns="http://www.w3.org/2000/svg">
                    <rect x="${pad}" y="${pad}" width="${drawSize}" height="${drawSize}" fill="${currentColor}" stroke="white" stroke-width="1" />
                </svg>
            `;
            // Faint cursor for mask
            const faintSvg = `
                <svg width="${containerSize}" height="${containerSize}" viewBox="0 0 ${containerSize} ${containerSize}" xmlns="http://www.w3.org/2000/svg">
                    <rect x="${pad}" y="${pad}" width="${drawSize}" height="${drawSize}" fill="${currentColor}" stroke="white" stroke-width="1" opacity="0.3" />
                </svg>
            `;
            // Keep selection cursor standard (or maybe remove it if we have highlight?)
            // Let's keep distinct 'glow' for selection
            const glowSvg = `
                <svg width="${containerSize}" height="${containerSize}" viewBox="0 0 ${containerSize} ${containerSize}" xmlns="http://www.w3.org/2000/svg">
                     <defs>
                        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>
                    <rect x="${pad}" y="${pad}" width="${drawSize}" height="${drawSize}" fill="${currentColor || 'none'}" stroke="white" stroke-width="2" filter="url(#glow)" />
                </svg>
            `;

            return {
                cursorStyle: { cursor: `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') ${hotspotX} ${hotspotY}, auto` },
                faintCursorStyle: `url('data:image/svg+xml;utf8,${encodeURIComponent(faintSvg)}') ${hotspotX} ${hotspotY}, auto`,
                selectionCursorStyle: { cursor: `url('data:image/svg+xml;utf8,${encodeURIComponent(glowSvg)}') ${hotspotX} ${hotspotY}, auto` }
            };
        }

        // ... (Keep other tools same, maybe adjust padding too if needed, but primarily brush was requested)
        // Logic for others remains similar to previous step, keeping brevity here for replacement
        if (currentTool === 'eraser') {
            const half = containerSize / 2;
            const hotspotX = brushSize === 2 ? 0 : half;
            const hotspotY = brushSize === 2 ? 0 : half;
            const svg = `
                <svg width="${containerSize}" height="${containerSize}" viewBox="0 0 ${containerSize} ${containerSize}" xmlns="http://www.w3.org/2000/svg">
                    <rect x="${pad}" y="${pad}" width="${drawSize}" height="${drawSize}" fill="#2d2d2d" stroke="#3e3e3e" stroke-width="1" />
                    <line x1="${containerSize - pad}" y1="${pad}" x2="${pad}" y2="${containerSize - pad}" stroke="#ff3333" stroke-width="2" />
                </svg>
            `;
            const faintSvg = `
                <svg width="${containerSize}" height="${containerSize}" viewBox="0 0 ${containerSize} ${containerSize}" xmlns="http://www.w3.org/2000/svg">
                     <g opacity="0.3">
                        <rect x="${pad}" y="${pad}" width="${drawSize}" height="${drawSize}" fill="#2d2d2d" stroke="#3e3e3e" stroke-width="1" />
                        <line x1="${containerSize - pad}" y1="${pad}" x2="${pad}" y2="${containerSize - pad}" stroke="#ff3333" stroke-width="2" />
                    </g>
                </svg>
            `;
            return {
                cursorStyle: { cursor: `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') ${hotspotX} ${hotspotY}, auto` },
                faintCursorStyle: `url('data:image/svg+xml;utf8,${encodeURIComponent(faintSvg)}') ${hotspotX} ${hotspotY}, auto`,
                selectionCursorStyle: { cursor: 'default' }
            };
        }

        // Keep Select/Fill logic standard but refreshed with new params
        if (currentTool === 'select') {
            const svgSize = BASE_PIXEL; // Always 1x
            const half = svgSize / 2;
            const svg = `
                <svg width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}" xmlns="http://www.w3.org/2000/svg">
                   <defs>
                        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>
                    <rect x="2" y="2" width="${svgSize - 4}" height="${svgSize - 4}" fill="none" stroke="white" stroke-width="2" filter="url(#glow)" />
                </svg>
            `;
            return { cursorStyle: { cursor: `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') ${half} ${half}, auto` }, faintCursorStyle: 'default', selectionCursorStyle: { cursor: 'default' } };
        }
        if (currentTool === 'fill') {
            // Fill should also feel like "1px" precision
            const iconSize = BASE_PIXEL * 2; // Container needs to be big enough to rotate
            const baseSide = BASE_PIXEL; // The bucket itself matches the grid cell size (~14.5px)

            const center = iconSize / 2;
            const offset = (iconSize - baseSide) / 2;

            const svg = `
                <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 ${iconSize} ${iconSize}" xmlns="http://www.w3.org/2000/svg">
                    <rect x="${offset}" y="${offset}" width="${baseSide}" height="${baseSide}" fill="${currentColor || 'none'}" stroke="white" stroke-width="1" transform="rotate(45, ${center}, ${center})" />
                </svg>
            `;
            const glowSvg = `
                <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 ${iconSize} ${iconSize}" xmlns="http://www.w3.org/2000/svg">
                     <defs>
                        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>
                    <rect x="${offset + 2}" y="${offset + 2}" width="${baseSide - 4}" height="${baseSide - 4}" fill="${currentColor || 'none'}" stroke="white" stroke-width="2" filter="url(#glow)" transform="rotate(45, ${center}, ${center})" />
                </svg>
            `;
            return {
                cursorStyle: { cursor: `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') ${center} ${center}, auto` },
                faintCursorStyle: `url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}') ${center} ${center}, auto`,
                selectionCursorStyle: { cursor: `url('data:image/svg+xml;utf8,${encodeURIComponent(glowSvg)}') ${center} ${center}, auto` }
            };
        }
        return { cursorStyle: { cursor: 'default' }, faintCursorStyle: 'default', selectionCursorStyle: { cursor: 'default' } };
    }, [currentTool, currentColor, brushSize, isZoomed]);

    // Deconstruct styles
    const { cursorStyle, faintCursorStyle, selectionCursorStyle } = styles;

    const workingSprite = React.useMemo(
        () => activeSprite ?? sprites[0] ?? EMPTY_SPRITE,
        [activeSprite, sprites]
    );
    const editingLayer: 'base' | 'top' = isOverlayStacked ? 'top' : activeLayer;
    const activeLayerPixels = editingLayer === 'base' ? workingSprite.pixelData : workingSprite.overlayPixelData;
    const inactiveLayerPixels = editingLayer === 'base' ? workingSprite.overlayPixelData : workingSprite.pixelData;
    const showTopOnlyWhileSelecting = isOverlayStacked && currentTool === 'select' && isDrawing;
    const displayPixels = isOverlayStacked
        ? (showTopOnlyWhileSelecting
            ? workingSprite.overlayPixelData
            : workingSprite.pixelData.map((base, i) => workingSprite.overlayPixelData[i] ?? base))
        : activeLayerPixels;

    const getCirclePixelsFromDiameter = (startIndex: number, endIndex: number): number[] => {
        const sx = startIndex % GRID_SIZE;
        const sy = Math.floor(startIndex / GRID_SIZE);
        const ex = endIndex % GRID_SIZE;
        const ey = Math.floor(endIndex / GRID_SIZE);

        // Start and current point are opposite points on the circumference (diameter endpoints).
        const cx = (sx + ex) / 2;
        const cy = (sy + ey) / 2;
        const radius = Math.hypot(ex - sx, ey - sy) / 2;

        if (radius <= 0) return [startIndex];

        const points = new Set<number>();
        const ringThickness = 0.6; // Pixel-friendly ring threshold

        for (let py = 0; py < GRID_SIZE; py++) {
            for (let px = 0; px < GRID_SIZE; px++) {
                const d = Math.hypot(px - cx, py - cy);
                if (Math.abs(d - radius) <= ringThickness) {
                    points.add(py * GRID_SIZE + px);
                }
            }
        }

        points.add(startIndex);
        points.add(endIndex);
        return Array.from(points);
    };

    const getBrushFootprint = (index: number): number[] => {
        const x = index % GRID_SIZE;
        const y = Math.floor(index / GRID_SIZE);
        const points = [index];
        if (brushSize === 2 && (currentTool === 'brush' || currentTool === 'eraser')) {
            if (x + 1 < GRID_SIZE) points.push(index + 1);
            if (y + 1 < GRID_SIZE) points.push(index + GRID_SIZE);
            if (x + 1 < GRID_SIZE && y + 1 < GRID_SIZE) points.push(index + GRID_SIZE + 1);
        }
        return points;
    };

    const isWithinCircleDetonator = (startIndex: number, currentIndex: number): boolean => {
        const sx = startIndex % GRID_SIZE;
        const sy = Math.floor(startIndex / GRID_SIZE);
        const cx = currentIndex % GRID_SIZE;
        const cy = Math.floor(currentIndex / GRID_SIZE);
        // 5x5 activation zone around start pixel.
        return Math.abs(cx - sx) <= 2 && Math.abs(cy - sy) <= 2;
    };

    const getPixelElementFromPoint = (clientX: number, clientY: number): HTMLDivElement | null => {
        const hit = document.elementFromPoint(clientX, clientY);
        if (!(hit instanceof HTMLElement)) return null;

        const pixel = hit.closest('[data-pixel-index]');
        if (!(pixel instanceof HTMLDivElement)) return null;
        if (!editorContainerRef.current?.contains(pixel)) return null;

        return pixel;
    };

    const getGridIndexFromClientPoint = (clientX: number, clientY: number): number | null => {
        const directHit = getPixelElementFromPoint(clientX, clientY);
        if (directHit) {
            const parsed = Number(directHit.dataset.pixelIndex);
            if (Number.isInteger(parsed)) {
                return parsed;
            }
        }

        const editor = editorContainerRef.current;
        if (!editor) return null;

        const rect = editor.getBoundingClientRect();
        const styles = window.getComputedStyle(editor);
        const offsetWidth = editor.offsetWidth;
        const offsetHeight = editor.offsetHeight;
        const scaleX = offsetWidth > 0 ? rect.width / offsetWidth : 1;
        const scaleY = offsetHeight > 0 ? rect.height / offsetHeight : 1;
        const borderLeft = (Number.parseFloat(styles.borderLeftWidth) || 0) * scaleX;
        const borderTop = (Number.parseFloat(styles.borderTopWidth) || 0) * scaleY;
        const paddingLeft = (Number.parseFloat(styles.paddingLeft) || 0) * scaleX;
        const paddingTop = (Number.parseFloat(styles.paddingTop) || 0) * scaleY;
        const contentWidth = (Number.parseFloat(styles.width) || editor.clientWidth - (editor.clientLeft * 2)) * scaleX;
        const contentHeight = (Number.parseFloat(styles.height) || editor.clientHeight - (editor.clientTop * 2)) * scaleY;
        const gridLeft = rect.left + borderLeft + paddingLeft;
        const gridTop = rect.top + borderTop + paddingTop;
        const gridWidth = Math.max(0, contentWidth);
        const gridHeight = Math.max(0, contentHeight);

        if (gridWidth <= 0 || gridHeight <= 0) return null;
        if (clientX < gridLeft || clientX >= gridLeft + gridWidth || clientY < gridTop || clientY >= gridTop + gridHeight) {
            return null;
        }

        const col = Math.min(GRID_SIZE - 1, Math.floor(((clientX - gridLeft) / gridWidth) * GRID_SIZE));
        const row = Math.min(GRID_SIZE - 1, Math.floor(((clientY - gridTop) / gridHeight) * GRID_SIZE));
        return row * GRID_SIZE + col;
    };

    const updateHighlight = (index: number, pixelElement: HTMLDivElement | null = null) => {
        const highlight = highlightRef.current;
        const editor = editorContainerRef.current;
        if (!highlight || !editor) return;

        const pixel = pixelElement ?? editor.querySelector(`[data-pixel-index="${index}"]`);
        if (!(pixel instanceof HTMLDivElement)) {
            highlight.style.display = 'none';
            return;
        }

        const row = Math.floor(index / GRID_SIZE);
        const col = index % GRID_SIZE;
        const isLarge = brushSize === 2 && (currentTool === 'brush' || currentTool === 'eraser');
        const widthCells = isLarge && col + 1 < GRID_SIZE ? 2 : 1;
        const heightCells = isLarge && row + 1 < GRID_SIZE ? 2 : 1;
        const styles = window.getComputedStyle(editor);
        const columnGap = Number.parseFloat(styles.columnGap || styles.gap || '0') || 0;
        const rowGap = Number.parseFloat(styles.rowGap || styles.gap || '0') || 0;

        highlight.style.left = `${pixel.offsetLeft}px`;
        highlight.style.top = `${pixel.offsetTop}px`;
        highlight.style.width = `${pixel.offsetWidth * widthCells + columnGap * (widthCells - 1)}px`;
        highlight.style.height = `${pixel.offsetHeight * heightCells + rowGap * (heightCells - 1)}px`;
        highlight.style.borderColor = 'rgba(255, 255, 255, 0.5)';
        highlight.style.display = 'block';
    };

    const setEyedropperTarget = (index: number | null) => {
        eyedropperTargetIndexRef.current = index;
        setEyedropperTargetIndex(index);
    };

    const setMouseHoverTarget = (index: number | null, pixelElement: HTMLDivElement | null = null) => {
        mouseHoverIndexRef.current = index;
        if (index === null) {
            hideHighlightOverlay();
            return;
        }

        updateHighlight(index, pixelElement);
    };

    const clearMouseHoverState = () => {
        setMouseHoverTarget(null);
    };

    const beginResolvedPointerInteraction = (
        index: number,
        point: PointerCoords,
        pixelElement: HTMLDivElement | null,
        pointerType: 'mouse' | 'touch' | 'pen'
    ) => {
        activeTargetIndexRef.current = index;
        if (pointerType === 'mouse') {
            setMouseHoverTarget(index, pixelElement);
        } else {
            clearMouseHoverState();
        }

        if (isEyedropperActive) return;

        isPointerDownRef.current = true;
        pointerStartPosRef.current = { x: point.clientX, y: point.clientY };
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        const supportsHoldEyedropper = pointerType !== 'touch';
        if (supportsHoldEyedropper && (currentTool === 'brush' || currentTool === 'fill' || currentTool === 'eraser')) {
            setShowDropperHint(true);
            if (brushSize === 2 && (currentTool === 'brush' || currentTool === 'eraser')) {
                const x = index % GRID_SIZE;
                const y = Math.floor(index / GRID_SIZE);
                setDropperHoldOverlay({
                    kind: 'block',
                    x,
                    y,
                    w: x + 1 < GRID_SIZE ? 2 : 1,
                    h: y + 1 < GRID_SIZE ? 2 : 1,
                    baseColor: activeLayerPixels[index],
                    progress: 0
                });
            } else {
                const holdIndices = getBrushFootprint(index);
                const baseColors: Record<number, string | null> = {};
                holdIndices.forEach((idx) => {
                    baseColors[idx] = currentTool === 'fill'
                        ? (currentColor ?? activeLayerPixels[idx])
                        : activeLayerPixels[idx];
                });
                setDropperHoldOverlay({ kind: 'cells', indices: holdIndices, baseColors, progress: 0 });
            }
            requestAnimationFrame(() => {
                setDropperHoldOverlay(prev => prev ? { ...prev, progress: 1 } : prev);
            });
            longPressTimerRef.current = setTimeout(() => {
                if (isPointerDownRef.current) {
                    if (currentTool !== 'fill') {
                        cancelStroke();
                    }

                    setIsEyedropperActive(true);
                    setIsDrawing(false);
                    if (editorContainerRef.current) editorContainerRef.current.classList.add('hide-cursor');
                    setPointerPos({ x: point.clientX, y: point.clientY });
                    setEyedropperTarget(index);
                    setShowDropperHint(false);
                    setDropperHoldOverlay(null);
                }
            }, EYEDROPPER_HOLD_MS);
        }

        isLineModeActiveRef.current = false;
        isCircleModeActiveRef.current = false;
        setLinePreviewPixels([]);
        setCirclePreviewPixels([]);
        setShapeHintMode(null);
        shapeHintModeRef.current = null;
        strokeStartIndexRef.current = index;
        strokeEndIndexRef.current = index;
        hasMovedInStrokeRef.current = false;
        hasLeftCircleDetonatorRef.current = false;

        // Reset last pixel on new stroke
        lastPixelIndexRef.current = index;

        // Check where drag started (Masking only for Brush/Eraser to Faint, not Select or Fill)
        if (currentTool === 'brush' || currentTool === 'eraser') {
            const region = selectedPixels.has(index) ? 'inside' : 'outside';
            setDragOrigin(region);
            dragOriginRef.current = region;
        }

        if (currentTool === 'fill') {
            pendingFillPixelRef.current = index;
            // fill(index); // Deferred until Pointer Up (Safety Catch)
            return;
        }

        if (currentTool === 'select') {
            if (!selectedPixels.has(index)) {
                if (selectedPixels.size > 0) {
                    clearSelection();
                }
                isLassoingRef.current = true;
                setIsDrawing(true);
                addToSelection(index);
            }
            return;
        }

        setIsDrawing(true);
        updatePixel(index, dragOriginRef.current);
    };

    const handleResolvedPointerTargetChange = (
        index: number,
        pixelElement: HTMLDivElement | null,
        pointerType: 'mouse' | 'touch' | 'pen'
    ) => {
        activeTargetIndexRef.current = index;
        if (pointerType === 'mouse') {
            setMouseHoverTarget(index, pixelElement);
        } else {
            clearMouseHoverState();
        }

        if (isEyedropperActive) {
            setEyedropperTarget(index);
            return;
        }

        if (isCircleModeActiveRef.current) {
            if (strokeEndIndexRef.current !== index) {
                strokeEndIndexRef.current = index;
                const circleStart = strokeStartIndexRef.current;
                if (circleStart !== null) {
                    const circlePixels = getCirclePixelsFromDiameter(circleStart, index).filter((idx) => {
                        if (dragOriginRef.current === 'inside') return selectedPixels.has(idx);
                        if (dragOriginRef.current === 'outside') return !selectedPixels.has(idx);
                        return true;
                    });
                    setCirclePreviewPixels(circlePixels);
                }
            }
            return;
        }

        if (isLineModeActiveRef.current) {
            if (strokeEndIndexRef.current !== index) {
                strokeEndIndexRef.current = index;
                const lineStart = strokeStartIndexRef.current;
                if (lineStart !== null) {
                    const linePixels = getLinePixels(lineStart, index).filter((idx) => {
                        if (dragOriginRef.current === 'inside') return selectedPixels.has(idx);
                        if (dragOriginRef.current === 'outside') return !selectedPixels.has(idx);
                        return true;
                    });
                    setLinePreviewPixels(linePixels);
                }
            }
            return;
        }

        if (isDrawing) {
            if (currentTool === 'brush' || currentTool === 'eraser') {
                if (strokeEndIndexRef.current !== null && strokeEndIndexRef.current !== index) {
                    hasMovedInStrokeRef.current = true;
                    setShowDropperHint(false);
                    if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current);
                        longPressTimerRef.current = null;
                    }
                    setDropperHoldOverlay(null);
                }
                strokeEndIndexRef.current = index;
                const strokeStart = strokeStartIndexRef.current;
                if (strokeStart !== null && !isWithinCircleDetonator(strokeStart, index)) {
                    hasLeftCircleDetonatorRef.current = true;
                }
                if (currentTool === 'brush' && hasMovedInStrokeRef.current && strokeStart !== null) {
                    const mode: 'line' | 'circle' =
                        hasLeftCircleDetonatorRef.current && isWithinCircleDetonator(strokeStart, index)
                            ? 'circle'
                            : 'line';
                    if (shapeHintModeRef.current !== mode) {
                        shapeHintModeRef.current = mode;
                        setShapeHintMode(mode);
                    }
                }

                if (isAltPressedRef.current && hasMovedInStrokeRef.current && currentTool === 'brush') {
                    if (!isLineModeActiveRef.current && !isCircleModeActiveRef.current) {
                        cancelStroke();
                    }
                    if (strokeStart !== null && hasLeftCircleDetonatorRef.current && isWithinCircleDetonator(strokeStart, index)) {
                        isLineModeActiveRef.current = false;
                        isCircleModeActiveRef.current = true;
                        setLinePreviewPixels([]);
                        const circlePixels = getCirclePixelsFromDiameter(strokeStart, index).filter((idx) => {
                            if (dragOriginRef.current === 'inside') return selectedPixels.has(idx);
                            if (dragOriginRef.current === 'outside') return !selectedPixels.has(idx);
                            return true;
                        });
                        setCirclePreviewPixels(circlePixels);
                        return;
                    }

                    if (strokeStart !== null) {
                        isCircleModeActiveRef.current = false;
                        isLineModeActiveRef.current = true;
                        setCirclePreviewPixels([]);
                        const linePixels = getLinePixels(strokeStart, index).filter((idx) => {
                            if (dragOriginRef.current === 'inside') return selectedPixels.has(idx);
                            if (dragOriginRef.current === 'outside') return !selectedPixels.has(idx);
                            return true;
                        });
                        setLinePreviewPixels(linePixels);
                        return;
                    }
                }
            }

            // Optimization & Constraint:
            // If masked (drag started 'inside' but now 'outside', or vice-versa),
            // update cursor visuals.
            const isMasked = (dragOrigin === 'inside' && !selectedPixels.has(index)) ||
                (dragOrigin === 'outside' && selectedPixels.has(index));

            if (isMasked) {
                if (editorContainerRef.current) editorContainerRef.current.classList.add('cursor-masked');
            } else {
                if (editorContainerRef.current) editorContainerRef.current.classList.remove('cursor-masked');
            }

            // Helper to check if a specific pixel can be painted based on start origin
            const canPaint = (idx: number) => {
                if (dragOriginRef.current === 'inside') return selectedPixels.has(idx);
                if (dragOriginRef.current === 'outside') return !selectedPixels.has(idx);
                return true;
            };

            if (currentTool === 'select') {
                if (lastPixelIndexRef.current !== null && lastPixelIndexRef.current !== index) {
                    const pixels = getLinePixels(lastPixelIndexRef.current, index);
                    // Batch update for performance
                    addSelectionBatch(pixels);
                } else {
                    addSelectionBatch([index]);
                }
                lastPixelIndexRef.current = index;
                return;
            }

            // Interpolate line from last pixel to current
            if (lastPixelIndexRef.current !== null && lastPixelIndexRef.current !== index) {
                const pixels = getLinePixels(lastPixelIndexRef.current, index);
                pixels.forEach(idx => {
                    if (canPaint(idx)) updatePixel(idx, dragOriginRef.current);
                });
            } else {
                if (canPaint(index)) updatePixel(index, dragOriginRef.current);
            }

            // Always update last position so the line 'follows' even through masks
            // This prevents "slashing" artifacts if you exit and re-enter a valid zone
            lastPixelIndexRef.current = index;
        }
    };

    const handleMouseUp = () => {
        activePointerIdRef.current = null;
        activeTargetIndexRef.current = null;
        isPointerDownRef.current = false;
        pointerStartPosRef.current = null;
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        if (isLineModeActiveRef.current && (currentTool === 'brush' || currentTool === 'eraser')) {
            const lineStart = strokeStartIndexRef.current;
            const lineEnd = strokeEndIndexRef.current;
            if (lineStart !== null && lineEnd !== null) {
                const linePixels = getLinePixels(lineStart, lineEnd).filter((idx) => {
                    if (dragOriginRef.current === 'inside') return selectedPixels.has(idx);
                    if (dragOriginRef.current === 'outside') return !selectedPixels.has(idx);
                    return true;
                });
                linePixels.forEach((idx) => {
                    updatePixel(idx, dragOriginRef.current);
                });
            }
            isLineModeActiveRef.current = false;
            setLinePreviewPixels([]);
            setTool('brush');
            setShowDropperHint(false);
            setDropperHoldOverlay(null);
            setShapeHintMode(null);
            shapeHintModeRef.current = null;
        }
        if (isCircleModeActiveRef.current && (currentTool === 'brush' || currentTool === 'eraser')) {
            const circleStart = strokeStartIndexRef.current;
            const circleEnd = strokeEndIndexRef.current;
            if (circleStart !== null && circleEnd !== null) {
                const circlePixels = getCirclePixelsFromDiameter(circleStart, circleEnd).filter((idx) => {
                    if (dragOriginRef.current === 'inside') return selectedPixels.has(idx);
                    if (dragOriginRef.current === 'outside') return !selectedPixels.has(idx);
                    return true;
                });
                circlePixels.forEach((idx) => {
                    updatePixel(idx, dragOriginRef.current);
                });
            }
            isCircleModeActiveRef.current = false;
            setCirclePreviewPixels([]);
            setTool('brush');
            setShowDropperHint(false);
            setDropperHoldOverlay(null);
            setShapeHintMode(null);
            shapeHintModeRef.current = null;
        }

        if (currentTool === 'select' && isLassoingRef.current) {
            // Lasso Release Logic
            const fullSelection = calculateLassoSelection(selectedPixels);

            // Auto-Trim: Filter selection to only pixels that have content
            const trimmedSelection = new Set<number>();
            fullSelection.forEach(idx => {
                if (activeLayerPixels[idx]) {
                    trimmedSelection.add(idx);
                }
            });

            // Use trimmed selection if it has content, otherwise (e.g. selecting empty space) keep the full shape
            let finalSelection = fullSelection;
            if (trimmedSelection.size > 0) {
                finalSelection = trimmedSelection;
            }

            setSelectedPixels(finalSelection);
            liftSelection(finalSelection);

            isLassoingRef.current = false;
        }

        setIsDrawing(false);
        lastPixelIndexRef.current = null;
        strokeStartIndexRef.current = null;
        strokeEndIndexRef.current = null;
        hasMovedInStrokeRef.current = false;
        hasLeftCircleDetonatorRef.current = false;
        setShowDropperHint(false);
        setDropperHoldOverlay(null);
        setShapeHintMode(null);
        shapeHintModeRef.current = null;
        setDragOrigin(null);
        if (editorContainerRef.current) editorContainerRef.current.classList.remove('cursor-masked');
    };

    const resetEditorInteractionState = () => {
        activePointerIdRef.current = null;
        activeTargetIndexRef.current = null;
        isPointerDownRef.current = false;
        pointerStartPosRef.current = null;
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
        isLineModeActiveRef.current = false;
        isCircleModeActiveRef.current = false;
        setLinePreviewPixels([]);
        setCirclePreviewPixels([]);
        setShowDropperHint(false);
        setDropperHoldOverlay(null);
        setShapeHintMode(null);
        shapeHintModeRef.current = null;

        clearMouseHoverState();
        // ... rest of logic
        setIsDrawing(false);
        isLassoingRef.current = false;
        lastPixelIndexRef.current = null;
        strokeStartIndexRef.current = null;
        strokeEndIndexRef.current = null;
        hasMovedInStrokeRef.current = false;
        hasLeftCircleDetonatorRef.current = false;
        setDragOrigin(null);
        if (editorContainerRef.current) editorContainerRef.current.classList.remove('cursor-masked');
    };

    const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
        if (e.pointerType !== 'mouse') return;
        activeTargetIndexRef.current = null;
        clearMouseHoverState();
    };

    const hideHighlightOverlay = () => {
        if (highlightRef.current) {
            highlightRef.current.style.display = 'none';
        }
    };

    const clearTransientPointerState = () => {
        activeTargetIndexRef.current = null;
        setEyedropperTarget(null);
        setPointerPos(null);
        clearMouseHoverState();
    };

    const cancelActiveInteraction = () => {
        activePointerIdRef.current = null;
        activeTargetIndexRef.current = null;
        pendingFillPixelRef.current = null;
        pointerStartPosRef.current = null;

        if (isPanningRef.current) {
            isPanningRef.current = false;
            panStartRef.current = null;
            if (containerRef.current) containerRef.current.style.cursor = 'default';
        }

        if (isEyedropperActive) {
            setIsEyedropperActive(false);
            clearTransientPointerState();
            if (editorContainerRef.current) editorContainerRef.current.classList.remove('hide-cursor');
        }

        resetEditorInteractionState();
    };

    // Canvas Playback Logic
    // We can move the ref inside the component scope properly
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!isPlaying || !canvasRef.current) return;

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        // Use standard pixel size of 1 unit on a 32x32 canvas
        ctx.clearRect(0, 0, 32, 32);

        const playbackPixels = isOverlayStacked
            ? workingSprite.pixelData.map((base, i) => workingSprite.overlayPixelData[i] ?? base)
            : (editingLayer === 'base' ? workingSprite.pixelData : workingSprite.overlayPixelData);
        playbackPixels.forEach((color, i) => {
            if (color) {
                const x = i % 32;
                const y = Math.floor(i / 32);
                ctx.fillStyle = color;
                ctx.fillRect(x, y, 1, 1);
            }
        });
    }, [isPlaying, workingSprite, isOverlayStacked, editingLayer]); // Re-draw when frame/layer mode changes

    // Scale editor based on brushSize (1x = 'Zoomed' 2x Scale, 2x = Normal 1x Scale)
    // Only apply scale if we are in the zoomed state
    // Pointer Events for Long Press (Container Level)
    const handlePointerDown = (e: React.PointerEvent) => {
        const pointerType = e.pointerType as 'mouse' | 'touch' | 'pen';
        if (pointerType === 'touch') {
            hideHighlightOverlay();
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            activeTouchPointerIdsRef.current.add(e.pointerId);
            activeTouchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (activeTouchPointerIdsRef.current.size > 1) {
                isGestureZoomingRef.current = true;
                cancelActiveInteraction();
                startTouchGestureTransform();
                return;
            }
            if (isGestureZoomingRef.current) return;
        }

        if (e.button !== 0 || !e.isPrimary) return;
        const target = e.target as HTMLElement;
        const hitEditor = !!editorContainerRef.current && editorContainerRef.current.contains(target);
        const hitButton = !!target.closest('button');
        if (!hitEditor) {
            if (!hitButton) {
                activePointerIdRef.current = e.pointerId;
                e.currentTarget.setPointerCapture(e.pointerId);
                isPanningRef.current = true;
                panStartRef.current = {
                    x: e.clientX,
                    y: e.clientY,
                    offsetX: panOffset.x,
                    offsetY: panOffset.y
                };
                if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
            }
            return;
        }
        if (target.closest('.layer-preview')) return;

        const index = getGridIndexFromClientPoint(e.clientX, e.clientY);
        if (index === null) return;

        activePointerIdRef.current = e.pointerId;
        activeTargetIndexRef.current = index;
        e.currentTarget.setPointerCapture(e.pointerId);
        beginResolvedPointerInteraction(
            index,
            { clientX: e.clientX, clientY: e.clientY },
            getPixelElementFromPoint(e.clientX, e.clientY),
            pointerType
        );
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        const pointerType = e.pointerType as 'mouse' | 'touch' | 'pen';
        if (pointerType === 'touch') {
            if (activeTouchPointerIdsRef.current.has(e.pointerId)) {
                activeTouchPointsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            }

            if (isGestureZoomingRef.current) {
                const metrics = getTouchGestureMetrics();
                const gesture = gestureTransformRef.current;
                if (metrics && gesture) {
                    const nextZoom = Math.max(
                        MIN_VIEW_ZOOM,
                        Math.min(MAX_VIEW_ZOOM, gesture.startZoom * (metrics.distance / gesture.startDistance))
                    );
                    setViewZoom(nextZoom);
                    setPanOffset(clampPanOffset(
                        gesture.startPan.x + (metrics.center.x - gesture.startCenter.x),
                        gesture.startPan.y + (metrics.center.y - gesture.startCenter.y)
                    ));
                }
                return;
            }
        }
        if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;

        if (isPanningRef.current && panStartRef.current && containerRef.current) {
            const dx = e.clientX - panStartRef.current.x;
            const dy = e.clientY - panStartRef.current.y;
            setPanOffset(clampPanOffset(
                panStartRef.current.offsetX + dx,
                panStartRef.current.offsetY + dy
            ));
            return;
        }

        if (isEyedropperActive) {
            setPointerPos({ x: e.clientX, y: e.clientY });
        }

        const pixelElement = getPixelElementFromPoint(e.clientX, e.clientY);
        const directIndex = pixelElement ? Number(pixelElement.dataset.pixelIndex) : NaN;
        const index = Number.isInteger(directIndex)
            ? directIndex
            : getGridIndexFromClientPoint(e.clientX, e.clientY);

        if (index === null) {
            activeTargetIndexRef.current = null;
            if (pointerType === 'mouse') {
                clearMouseHoverState();
            }
            if (isEyedropperActive) {
                setEyedropperTarget(null);
            }
        } else {
            const needsTargetUpdate =
                activeTargetIndexRef.current !== index ||
                (pointerType === 'mouse' && mouseHoverIndexRef.current !== index) ||
                (isEyedropperActive && eyedropperTargetIndexRef.current !== index);

            if (needsTargetUpdate) {
                handleResolvedPointerTargetChange(index, pixelElement, pointerType);
            }
        }

        if (!isPointerDownRef.current || isEyedropperActive) return;

        // Optimization: If timer is already cleared (started drawing), skip distance check
        if (!longPressTimerRef.current) return;

        if (pointerStartPosRef.current) {
            const dist = Math.hypot(e.clientX - pointerStartPosRef.current.x, e.clientY - pointerStartPosRef.current.y);
            if (dist > 5) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
                setShowDropperHint(false);
                setDropperHoldOverlay(null);
                setShapeHintMode(null);
                shapeHintModeRef.current = null;
            }
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        const pointerType = e.pointerType as 'mouse' | 'touch' | 'pen';
        if (pointerType === 'touch') {
            activeTouchPointerIdsRef.current.delete(e.pointerId);
            activeTouchPointsRef.current.delete(e.pointerId);
            if (isGestureZoomingRef.current) {
                if (activeTouchPointerIdsRef.current.size < 2) {
                    gestureTransformRef.current = null;
                }
                if (activeTouchPointerIdsRef.current.size === 0) {
                    isGestureZoomingRef.current = false;
                    clearTransientPointerState();
                }
                return;
            }
        }

        if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return;

        if (isPanningRef.current) {
            isPanningRef.current = false;
            panStartRef.current = null;
            activePointerIdRef.current = null;
            activeTargetIndexRef.current = null;
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
            if (containerRef.current) containerRef.current.style.cursor = 'default';
            return;
        }

        activePointerIdRef.current = null;
        activeTargetIndexRef.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        isPointerDownRef.current = false;
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }

        if (isEyedropperActive) {
            const pickedIndex = eyedropperTargetIndexRef.current;
            if (pickedIndex !== null && pickedIndex >= 0 && pickedIndex < GRID_SIZE * GRID_SIZE) {
                const color = floatingLayer.has(pickedIndex)
                    ? floatingLayer.get(pickedIndex)
                    : activeLayerPixels[pickedIndex];

                if (color) {
                    setCurrentColor(color);
                    if (currentTool === 'eraser') setTool('brush');
                } else {
                    setTool('eraser');
                }
            }

            setIsEyedropperActive(false);
            clearTransientPointerState();
            if (editorContainerRef.current) editorContainerRef.current.classList.remove('hide-cursor');
            setIsDrawing(false);
            setDragOrigin(null);
            pendingFillPixelRef.current = null; // Discard any pending fill
            isLineModeActiveRef.current = false;
            isCircleModeActiveRef.current = false;
            setLinePreviewPixels([]);
            setCirclePreviewPixels([]);
            setShowDropperHint(false);
            setDropperHoldOverlay(null);
            setShapeHintMode(null);
            shapeHintModeRef.current = null;
        } else {
            // Normal Release
            // Check for pending fill execution (Safety Catch: User released quickly)
            if (currentTool === 'fill' && pendingFillPixelRef.current !== null) {
                fill(pendingFillPixelRef.current);
                pendingFillPixelRef.current = null;
            }
            setShowDropperHint(false);
            setDropperHoldOverlay(null);
            setShapeHintMode(null);
            shapeHintModeRef.current = null;
        }

        handleMouseUp();
        if (pointerType !== 'mouse') {
            clearTransientPointerState();
        }
    };

    const handlePointerCancel = (e: React.PointerEvent) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        if (e.pointerType === 'touch') {
            activeTouchPointerIdsRef.current.delete(e.pointerId);
            activeTouchPointsRef.current.delete(e.pointerId);
            if (activeTouchPointerIdsRef.current.size < 2) {
                gestureTransformRef.current = null;
            }
            if (activeTouchPointerIdsRef.current.size === 0) {
                isGestureZoomingRef.current = false;
                clearTransientPointerState();
            }
        }

        cancelActiveInteraction();
    };

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            // Ctrl+wheel is trackpad pinch on Chromium; plain wheel/touchpad should also zoom.
            const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0025));
            setViewZoom(prev => Math.max(MIN_VIEW_ZOOM, Math.min(MAX_VIEW_ZOOM, prev * factor)));
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            container.removeEventListener('wheel', onWheel);
        };
    }, []);

    useEffect(() => {
        let lastScale = 1;
        const onGestureStart = (event: Event) => {
            event.preventDefault();
            lastScale = 1;
            isGestureZoomingRef.current = true;
            cancelActiveInteraction();
        };
        const onGestureChange = (event: Event) => {
            event.preventDefault();
            if (gestureTransformRef.current) return;
            const e = event as Event & { scale?: number };
            const scale = typeof e.scale === 'number' ? e.scale : 1;
            const delta = scale / Math.max(lastScale, 0.0001);
            lastScale = scale;
            setViewZoom(prev => Math.max(MIN_VIEW_ZOOM, Math.min(MAX_VIEW_ZOOM, prev * delta)));
        };
        const onGestureEnd = (event: Event) => {
            event.preventDefault();
            lastScale = 1;
            gestureTransformRef.current = null;
            if (activeTouchPointerIdsRef.current.size === 0) {
                isGestureZoomingRef.current = false;
            }
        };

        // Safari gesture events (pinch). Attach broadly to block page zoom and route to workspace zoom.
        document.addEventListener('gesturestart', onGestureStart as EventListener, { passive: false });
        document.addEventListener('gesturechange', onGestureChange as EventListener, { passive: false });
        document.addEventListener('gestureend', onGestureEnd as EventListener, { passive: false });

        return () => {
            document.removeEventListener('gesturestart', onGestureStart as EventListener);
            document.removeEventListener('gesturechange', onGestureChange as EventListener);
            document.removeEventListener('gestureend', onGestureEnd as EventListener);
        };
    }, []);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Alt') return;
            isAltPressedRef.current = true;

            if (!isPointerDownRef.current || !isDrawing || isEyedropperActive || currentTool !== 'brush') return;
            const strokeStart = strokeStartIndexRef.current;
            const strokeEnd = strokeEndIndexRef.current;
            if (strokeStart === null || strokeEnd === null || !hasMovedInStrokeRef.current) return;

            if (!isLineModeActiveRef.current && !isCircleModeActiveRef.current) {
                cancelStroke();
            }

            if (hasLeftCircleDetonatorRef.current && isWithinCircleDetonator(strokeStart, strokeEnd)) {
                isLineModeActiveRef.current = false;
                isCircleModeActiveRef.current = true;
                setLinePreviewPixels([]);
                const circlePixels = getCirclePixelsFromDiameter(strokeStart, strokeEnd).filter((idx) => {
                    if (dragOriginRef.current === 'inside') return selectedPixels.has(idx);
                    if (dragOriginRef.current === 'outside') return !selectedPixels.has(idx);
                    return true;
                });
                setCirclePreviewPixels(circlePixels);
                return;
            }

            isCircleModeActiveRef.current = false;
            isLineModeActiveRef.current = true;
            setCirclePreviewPixels([]);
            const linePixels = getLinePixels(strokeStart, strokeEnd).filter((idx) => {
                if (dragOriginRef.current === 'inside') return selectedPixels.has(idx);
                if (dragOriginRef.current === 'outside') return !selectedPixels.has(idx);
                return true;
            });
            setLinePreviewPixels(linePixels);
        };

        const onKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Alt') isAltPressedRef.current = false;
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [cancelStroke, currentTool, isDrawing, isEyedropperActive, selectedPixels]);

    const editorSizeCss = `min(620px, 50vw, 70vh)`;

    const eyedropperColor = (isEyedropperActive && eyedropperTargetIndex !== null)
        ? (floatingLayer.has(eyedropperTargetIndex) ? floatingLayer.get(eyedropperTargetIndex)! : activeLayerPixels[eyedropperTargetIndex])
        : null;
    const linePreviewSet = React.useMemo(() => {
        const preview = new Set<number>();
        linePreviewPixels.forEach((idx) => {
            const x = idx % GRID_SIZE;
            const y = Math.floor(idx / GRID_SIZE);
            preview.add(idx);

            if (brushSize === 2 && (currentTool === 'brush' || currentTool === 'eraser')) {
                if (x + 1 < GRID_SIZE) preview.add(idx + 1);
                if (y + 1 < GRID_SIZE) preview.add(idx + GRID_SIZE);
                if (x + 1 < GRID_SIZE && y + 1 < GRID_SIZE) preview.add(idx + GRID_SIZE + 1);
            }
        });
        return preview;
    }, [linePreviewPixels, brushSize, currentTool]);
    const circlePreviewSet = React.useMemo(() => {
        const preview = new Set<number>();
        circlePreviewPixels.forEach((idx) => {
            const x = idx % GRID_SIZE;
            const y = Math.floor(idx / GRID_SIZE);
            preview.add(idx);

            if (brushSize === 2 && (currentTool === 'brush' || currentTool === 'eraser')) {
                if (x + 1 < GRID_SIZE) preview.add(idx + 1);
                if (y + 1 < GRID_SIZE) preview.add(idx + GRID_SIZE);
                if (x + 1 < GRID_SIZE && y + 1 < GRID_SIZE) preview.add(idx + GRID_SIZE + 1);
            }
        });
        return preview;
    }, [circlePreviewPixels, brushSize, currentTool]);
    const shapeModifierLabel = React.useMemo(() => {
        if (typeof navigator === 'undefined') return 'ALT';
        const platform = navigator.platform || '';
        const ua = navigator.userAgent || '';
        const isApple = /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac|iPhone|iPad|iPod/i.test(ua);
        return isApple ? 'OPTION' : 'ALT';
    }, []);
    const topStatusText = React.useMemo(() => {
        if (isEyedropperActive) return 'DROPPER TOOL';
        if (showDropperHint) return 'KEEP HOLDING STILL';

        if (currentTool === 'select' && isDrawing) {
            return 'SELECTION MASK TOOL: RELEASE TO CREATE A FLOATING STAMP';
        }
        if (currentTool === 'select' && selectedPixels.size === 0) {
            return 'SELECTION MASK TOOL';
        }
        if (currentTool === 'select' && selectedPixels.size > 0 && !isDrawing) {
            return 'PRESS ENTER TO STAMP OR HOLD ENTER THEN ARROW KEYS TO SMUDGE';
        }

        const hasStampMask = selectedPixels.size > 0;
        const isPaintLikeTool = currentTool === 'brush' || currentTool === 'eraser' || currentTool === 'fill';
        if (hasStampMask && isPaintLikeTool) {
            if (isDrawing && dragOrigin === 'inside') {
                return 'DRAWING ON STAMP MASK: ONLY THE STAMP IS EDITED';
            }
            if (isDrawing && dragOrigin === 'outside') {
                return 'DRAWING OUTSIDE MASK: STAMP STAYS UNCHANGED';
            }
            return 'STAMP MASK ACTIVE: DRAW ON THE STAMP TO EDIT IT';
        }

        if (shapeHintMode) {
            return `PRESS ${shapeModifierLabel} TO SWITCH TO ${shapeHintMode.toUpperCase()}`;
        }
        if (brushSize === 1) return 'MOUSE WHEEL TO ZOOM';
        return isOverlayStacked ? 'CURRENTLY DRAWING ON TOP LAYER' : (editingLayer === 'base' ? 'BASE' : 'TOP');
    }, [
        isEyedropperActive,
        showDropperHint,
        currentTool,
        isDrawing,
        selectedPixels.size,
        dragOrigin,
        shapeHintMode,
        shapeModifierLabel,
        brushSize,
        isOverlayStacked,
        editingLayer
    ]);

    return (
        <div
            ref={containerRef}
            className="main-editor-container"
            onPointerLeave={handlePointerLeave}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            style={{
                display: 'flex',
                overflow: 'auto',
                flex: 1,
                width: '100%',
                justifyContent: 'center',
                alignItems: 'center',
                touchAction: 'none',
                position: 'relative',
                cursor: 'default'
            }}
        >
            {isEyedropperActive && pointerPos && eyedropperTargetIndex !== null && (
                <MagnifyingGlass
                    screenX={pointerPos.x}
                    screenY={pointerPos.y}
                    gridX={eyedropperTargetIndex % 32}
                    gridY={Math.floor(eyedropperTargetIndex / 32)}
                    pixelData={activeLayerPixels}
                    floatingLayer={floatingLayer}
                    targetColor={eyedropperColor || null}
                />
            )}
            {!hasPickedColor && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'var(--text-muted)',
                    fontSize: '1.2rem',
                    fontWeight: 600,
                    opacity: 0.5,
                    pointerEvents: 'none',
                    textAlign: 'center'
                }}>
                    Select a color from the palette to begin
                </div>
            )}
            <div
                ref={workspaceRef}
                style={{
                    display: hasPickedColor ? 'flex' : 'none',
                    alignItems: 'flex-start',
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${viewZoom})`,
                    transformOrigin: 'center center'
                }}
            >
                {editingLayer === 'top' && !isOverlayStacked && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginRight: '16px', flexShrink: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', transform: `scale(${1 / viewZoom})`, transformOrigin: 'center bottom' }}>BASE</div>
                        <div
                            className="main-sprite-editor layer-preview"
                            onPointerDown={(e) => { e.stopPropagation(); setActiveLayer('base'); }}
                            style={{
                                width: editorSizeCss,
                                height: editorSizeCss,
                                opacity: 0.68,
                                flexShrink: 0
                            }}
                        >
                            {inactiveLayerPixels.map((color, index) => (
                                <div key={`inactive-left-${index}`} className={`pixel ${color ? 'has-color' : ''}`} style={color ? { backgroundColor: color } : undefined} />
                            ))}
                        </div>
                    </div>
                )}
                <div className={showBounce ? 'editor-bounce-in' : ''} onAnimationEnd={() => setShowBounce(false)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', position: 'relative', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-color)', transform: `scale(${1 / viewZoom})`, transformOrigin: 'center bottom', whiteSpace: 'nowrap' }}>
                        {topStatusText}
                    </div>
                    <div
                        ref={editorContainerRef}
                        className={`main-sprite-editor tool-${currentTool} ${selectedPixels.size > 0 ? 'has-selection' : ''} ${isPlaying ? 'playing' : ''} ${isOnionSkinning ? 'onion-on' : ''} ${isDrawing ? 'is-drawing' : ''} ${isDrawing && dragOrigin ? `drag-start-${dragOrigin}` : ''}`}
                        style={{
                            ...cursorStyle,
                            '--cursor-normal': cursorStyle.cursor,
                            '--cursor-faint': faintCursorStyle,
                            '--selection-cursor': selectionCursorStyle.cursor,
                            width: editorSizeCss,
                            height: editorSizeCss,
                            flexShrink: 0,
                        } as React.CSSProperties & Record<'--cursor-normal' | '--cursor-faint' | '--selection-cursor', string>}
                    >
                        {/* Highlight Overlay - Rendered First or Last? Last to be on top of pixels but below cursor */}
                        <div
                            ref={highlightRef}
                            className="pixel-highlight-guides"
                            style={{
                                position: 'absolute',
                                border: '1px solid rgba(255, 255, 255, 0.4)',
                                background: 'rgba(255, 255, 255, 0.1)',
                                pointerEvents: 'none',
                                display: 'none', // Hidden until mouse enter
                                zIndex: 20, // Above pixels (z1), above onion (z10)?
                                boxSizing: 'border-box'
                            }}
                        />

                        {dropperHoldOverlay && !isEyedropperActive && (
                            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 22 }}>
                                {dropperHoldOverlay.kind === 'cells' && dropperHoldOverlay.indices.map((idx) => (
                                    <div
                                        key={`dropper-hold-${idx}`}
                                        style={{
                                            position: 'absolute',
                                            left: `${(idx % GRID_SIZE) * (100 / GRID_SIZE)}%`,
                                            top: `${Math.floor(idx / GRID_SIZE) * (100 / GRID_SIZE)}%`,
                                            width: `${100 / GRID_SIZE}%`,
                                            height: `${100 / GRID_SIZE}%`,
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <div
                                            style={{
                                                position: 'absolute',
                                                left: 0,
                                                right: 0,
                                                top: 0,
                                                height: `${dropperHoldOverlay.progress * 100}%`,
                                                background: dropperHoldOverlay.baseColors[idx] ?? 'var(--grid-bg)',
                                                transition: `height ${EYEDROPPER_HOLD_MS}ms linear`
                                            }}
                                        />
                                    </div>
                                ))}
                                {dropperHoldOverlay.kind === 'block' && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            left: `${dropperHoldOverlay.x * (100 / GRID_SIZE)}%`,
                                            top: `${dropperHoldOverlay.y * (100 / GRID_SIZE)}%`,
                                            width: `${dropperHoldOverlay.w * (100 / GRID_SIZE)}%`,
                                            height: `${dropperHoldOverlay.h * (100 / GRID_SIZE)}%`,
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <div
                                            style={{
                                                position: 'absolute',
                                                left: 0,
                                                right: 0,
                                                top: 0,
                                                height: `${dropperHoldOverlay.progress * 100}%`,
                                                background: dropperHoldOverlay.baseColor ?? 'var(--grid-bg)',
                                                transition: `height ${EYEDROPPER_HOLD_MS}ms linear`
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {isPlaying && (
                            <canvas
                                ref={canvasRef}
                                width={32}
                                height={32}
                                className="playback-canvas"
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    imageRendering: 'pixelated',
                                    zIndex: 50, // Above everything
                                    pointerEvents: 'none'
                                }}
                            />
                        )}

                        {/* Main Sprite Layer */}
                        {!isPlaying && displayPixels.map((baseColor, index) => {
                            const color = floatingLayer.has(index) ? floatingLayer.get(index)! : baseColor;
                            const isFloating = floatingLayer.has(index);
                            const isNudging = activeActions.some(a => ['up', 'down', 'left', 'right'].includes(a));
                            return (
                                <MemoizedPixel
                                    key={index}
                                    index={index}
                                    color={color}
                                    isSelected={selectedPixels.has(index)}
                                    isFloating={isFloating}
                                    isStamping={isStamping}
                                    isNudging={isNudging}
                                />
                            );
                        })}

                        {/* Onion Skin Layer (Rendered after for overlay effect) */}
                        {isOnionSkinning && !isPlaying && prevSprite && (
                            <div className="onion-skin-layer" style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'grid',
                                gridTemplateColumns: 'repeat(var(--grid-size), 1fr)',
                                gridTemplateRows: 'repeat(var(--grid-size), 1fr)',
                                gap: '1px',
                                padding: '2px',
                                pointerEvents: 'none',
                                opacity: 0.25,
                                zIndex: 10
                            }}>
                                {prevSprite.pixelData.map((baseColor, index) => {
                                    const color = isOverlayStacked
                                        ? (prevSprite.overlayPixelData[index] ?? baseColor)
                                        : (editingLayer === 'base' ? baseColor : prevSprite.overlayPixelData[index]);
                                    return (
                                        <div
                                            key={`onion-${index}`}
                                            className="pixel-onion"
                                            style={color ? { backgroundColor: color, border: 'none' } : { border: 'none' }}
                                        />
                                    );
                                })}
                            </div>
                        )}

                        {linePreviewPixels.length > 0 && (
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'grid',
                                gridTemplateColumns: 'repeat(var(--grid-size), 1fr)',
                                gridTemplateRows: 'repeat(var(--grid-size), 1fr)',
                                gap: '1px',
                                padding: '2px',
                                pointerEvents: 'none',
                                zIndex: 40
                            }}>
                                {activeLayerPixels.map((_, index) => {
                                    const isPreviewPixel = linePreviewSet.has(index);
                                    if (!isPreviewPixel) return <div key={`line-preview-${index}`} />;

                                    if (currentTool === 'eraser') {
                                        return (
                                            <div
                                                key={`line-preview-${index}`}
                                                style={{
                                                    border: '1px solid #ff3333',
                                                    background: 'rgba(255, 51, 51, 0.15)'
                                                }}
                                            />
                                        );
                                    }

                                    return (
                                        <div
                                            key={`line-preview-${index}`}
                                            style={{
                                                background: currentColor || 'transparent',
                                                opacity: 0.7
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        )}

                        {circlePreviewPixels.length > 0 && (
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'grid',
                                gridTemplateColumns: 'repeat(var(--grid-size), 1fr)',
                                gridTemplateRows: 'repeat(var(--grid-size), 1fr)',
                                gap: '1px',
                                padding: '2px',
                                pointerEvents: 'none',
                                zIndex: 41
                            }}>
                                {activeLayerPixels.map((_, index) => {
                                    const isPreviewPixel = circlePreviewSet.has(index);
                                    if (!isPreviewPixel) return <div key={`circle-preview-${index}`} />;

                                    if (currentTool === 'eraser') {
                                        return (
                                            <div
                                                key={`circle-preview-${index}`}
                                                style={{
                                                    border: '1px solid #ff3333',
                                                    background: 'rgba(255, 51, 51, 0.15)'
                                                }}
                                            />
                                        );
                                    }

                                    return (
                                        <div
                                            key={`circle-preview-${index}`}
                                            style={{
                                                background: currentColor || 'transparent',
                                                opacity: 0.7
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    <button
                        ref={stackButtonRef}
                        className="secondary-btn-small"
                        onPointerDown={(e) => {
                            e.stopPropagation();
                            setIsOverlayStacked(!isOverlayStacked);
                        }}
                        style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            left: '50%',
                            transform: `translateX(-50%) scale(${1 / viewZoom})`,
                            transformOrigin: 'center top',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {isOverlayStacked ? 'Unstack Layers' : 'Stack Layers'}
                    </button>
                </div>
                {editingLayer === 'base' && !isOverlayStacked && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginLeft: '16px', flexShrink: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', transform: `scale(${1 / viewZoom})`, transformOrigin: 'center bottom' }}>TOP</div>
                        <div
                            className="main-sprite-editor layer-preview"
                            onPointerDown={(e) => { e.stopPropagation(); setActiveLayer('top'); }}
                            style={{
                                width: editorSizeCss,
                                height: editorSizeCss,
                                opacity: 0.68,
                                flexShrink: 0
                            }}
                        >
                            {inactiveLayerPixels.map((color, index) => (
                                <div key={`inactive-right-${index}`} className={`pixel ${color ? 'has-color' : ''}`} style={color ? { backgroundColor: color } : undefined} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
