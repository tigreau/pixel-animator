import React, { useRef, useEffect, useState } from 'react';
import { useEditor } from '../../contexts/editorContextShared';
import { PRESET_COLORS } from '../../types';

const MAX_RECENT = 8;

export const TopBar: React.FC = () => {
    const {
        currentTool,
        setTool,
        undo,
        redo,
        clearCanvas,
        canUndo,
        canRedo,
        canClear,
        selectedPixels,
        clearSelection,
        brushSize,
        setBrushSize,
        currentColor,
        setCurrentColor,
        recentColors,
        flipSelectionHorizontal,
        flipSelectionVertical,
        rotateSelectionLeft,
        rotateSelectionRight,
        stamp,
        isStamping,
    } = useEditor();

    const topBarRef = useRef<HTMLDivElement>(null);
    const [hasRevealedTools, setHasRevealedTools] = useState(recentColors.length > 0);
    const animationAbortedRef = useRef(false);

    useEffect(() => {
        const hintScroll = async () => {
            if (!topBarRef.current || animationAbortedRef.current) return;
            try {
                topBarRef.current.scrollTo({ left: 120, behavior: 'smooth' });
                await new Promise(r => setTimeout(r, 450));
                if (animationAbortedRef.current) return;
                topBarRef.current.scrollTo({ left: 0, behavior: 'smooth' });
                await new Promise(r => setTimeout(r, 450));
                if (animationAbortedRef.current) return;
                topBarRef.current.scrollTo({ left: 120, behavior: 'smooth' });
                await new Promise(r => setTimeout(r, 450));
                if (animationAbortedRef.current) return;
                topBarRef.current.scrollTo({ left: 0, behavior: 'smooth' });
            } catch (e) {
                // Ignore fallback issues
            }
        };
        hintScroll();
    }, []);

    useEffect(() => {
        if (recentColors.length > 0 && !hasRevealedTools) {
            setHasRevealedTools(true);
            if (topBarRef.current) {
                requestAnimationFrame(() => {
                    topBarRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
                });
            }
        }
    }, [recentColors.length, hasRevealedTools]);

    const displaySlots = recentColors.length >= 4 ? MAX_RECENT : 4;
    const recentSlots = Array.from({ length: displaySlots });

    const handleInteraction = () => {
        animationAbortedRef.current = true;
    };

    return (
        <div
            className="top-bar"
            ref={topBarRef}
            onPointerDown={handleInteraction}
            onWheel={handleInteraction}
            onTouchStart={handleInteraction}
        >
            {recentColors.length > 0 && (
                <div className="top-bar-group">
                    <button
                        className={`top-bar-btn ${currentTool === 'fill' ? 'active' : ''}`}
                        onClick={() => setTool(currentTool === 'fill' ? 'brush' : 'fill')}
                    >
                        Fill
                    </button>
                    <button
                        className={`top-bar-btn ${currentTool === 'select' || selectedPixels.size > 0 ? 'active' : ''}`}
                        onClick={() => {
                            if (selectedPixels.size > 0) {
                                clearSelection();
                            } else {
                                setTool(currentTool === 'select' ? 'brush' : 'select');
                            }
                        }}
                    >
                        {selectedPixels.size > 0 ? 'Deselect' : 'Select'}
                    </button>
                </div>
            )}

            {/* Brush Size */}
            {recentColors.length > 0 && (currentTool === 'brush' || currentTool === 'eraser') && (
                <div className="top-bar-group">
                    <button
                        className={`top-bar-btn ${brushSize === 1 ? 'active' : ''}`}
                        onClick={() => setBrushSize(1)}
                    >
                        1×
                    </button>
                    <button
                        className={`top-bar-btn ${brushSize === 2 ? 'active' : ''}`}
                        onClick={() => setBrushSize(2)}
                    >
                        2×
                    </button>
                </div>
            )}

            {/* Actions */}
            {(canUndo || canRedo || canClear) && (
                <div className="top-bar-group">
                    <button className="top-bar-btn" disabled={!canUndo} onClick={undo} style={{ opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'default' }}>Undo</button>
                    <button className="top-bar-btn" disabled={!canRedo} onClick={redo} style={{ opacity: canRedo ? 1 : 0.4, cursor: canRedo ? 'pointer' : 'default' }}>Redo</button>
                    <button className="top-bar-btn" disabled={!canClear} onClick={clearCanvas} style={{ opacity: canClear ? 1 : 0.4, cursor: canClear ? 'pointer' : 'default' }}>Clear</button>
                </div>
            )}

            {/* Selection Tools */}
            {selectedPixels.size > 0 && (
                <div className="top-bar-group">
                    <button className="top-bar-btn" title="Flip Horizontal (H)" onClick={flipSelectionHorizontal}>Flip H</button>
                    <button className="top-bar-btn" title="Flip Vertical (V)" onClick={flipSelectionVertical}>Flip V</button>
                    <button className="top-bar-btn" title="Rotate Left (Q)" onClick={rotateSelectionLeft}>Rot L</button>
                    <button className="top-bar-btn" title="Rotate Right (E)" onClick={rotateSelectionRight}>Rot R</button>
                    <button
                        className={`top-bar-btn ${isStamping ? 'active' : ''}`}
                        title="Stamp (Enter)"
                        onClick={stamp}
                    >
                        Stamp
                    </button>
                </div>
            )}

            {recentColors.length > 0 && (
                <>
                    {/* Divider */}
                    <div className="top-bar-divider" />

                    {/* Recent Colors */}
                    <div className="top-bar-colors">
                        {recentSlots.map((_, index) => {
                            if (index === 0) {
                                return (
                                    <div
                                        key="clear"
                                        className={`top-bar-swatch clear-swatch ${currentTool === 'eraser' || (currentTool === 'fill' && currentColor === null) ? 'active' : ''}`}
                                        onClick={() => {
                                            if (currentTool === 'fill') {
                                                setCurrentColor(null);
                                            } else {
                                                setTool('eraser');
                                            }
                                        }}
                                        title="Transparent / Eraser"
                                    />
                                );
                            }
                            const color = recentColors[index - 1];
                            if (color) {
                                return (
                                    <div
                                        key={color}
                                        className={`top-bar-swatch ${color === currentColor && currentTool !== 'eraser' && currentTool !== 'select' ? 'active' : ''}`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setCurrentColor(color)}
                                        title={color}
                                    />
                                );
                            }
                            return <div key={`empty-${index}`} className="top-bar-swatch empty" style={{ opacity: 0.1, background: '#333' }} />;
                        })}
                    </div>
                </>
            )}

            {/* Divider */}
            <div className="top-bar-divider" />

            {/* Palette Colors */}
            <div className="top-bar-colors">
                {PRESET_COLORS.map((color) => (
                    <div
                        key={color}
                        className={`top-bar-swatch ${color === currentColor && currentTool !== 'eraser' && currentTool !== 'select' ? 'active' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setCurrentColor(color)}
                        title={color}
                    />
                ))}
            </div>
        </div>
    );
};
