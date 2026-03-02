import React from 'react';
import { useEditor } from '../../contexts/editorContextShared';

export const EditorControls: React.FC = () => {
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
        recentColors
    } = useEditor();

    return (
        <>
            {recentColors.length > 0 && (
                <div className="tool-group">
                    <button
                        className={`tool-btn ${currentTool === 'fill' ? 'active' : ''}`}
                        onClick={() => setTool(currentTool === 'fill' ? 'brush' : 'fill')}
                    >
                        Fill
                    </button>
                    <button
                        className={`tool-btn ${currentTool === 'select' || selectedPixels.size > 0 ? 'active' : ''}`}
                        onClick={() => {
                            if (selectedPixels.size > 0) {
                                // If we have a selection, this button acts as Deselect
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

            {/* Brush Size Controls */}
            {recentColors.length > 0 && (currentTool === 'brush' || currentTool === 'eraser') && (
                <div className="tool-group" style={{ flexDirection: 'row', gap: '4px' }}>
                    <button
                        className={`tool-btn ${brushSize === 1 ? 'active' : ''}`}
                        onClick={() => setBrushSize(1)}
                        style={{ fontSize: '0.8rem' }}
                    >
                        1x
                    </button>
                    <button
                        className={`tool-btn ${brushSize === 2 ? 'active' : ''}`}
                        onClick={() => setBrushSize(2)}
                        style={{ fontSize: '0.8rem' }}
                    >
                        2x
                    </button>
                </div>
            )}

            {(canUndo || canRedo || canClear) && (
                <div className="action-group">
                    <button className="action-btn" disabled={!canUndo} onClick={undo} style={{ opacity: canUndo ? 1 : 0.4, cursor: canUndo ? 'pointer' : 'default' }}>Undo</button>
                    <button className="action-btn" disabled={!canRedo} onClick={redo} style={{ opacity: canRedo ? 1 : 0.4, cursor: canRedo ? 'pointer' : 'default' }}>Redo</button>
                    <button className="action-btn" disabled={!canClear} onClick={clearCanvas} style={{ opacity: canClear ? 1 : 0.4, cursor: canClear ? 'pointer' : 'default' }}>Clear</button>
                </div>
            )}
        </>
    );
};
