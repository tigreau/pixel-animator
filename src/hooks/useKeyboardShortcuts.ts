import { useEffect, useRef } from 'react';
import { useEditor } from '../contexts/editorContextShared';

export const useKeyboardShortcuts = () => {
    const {
        setTool,
        undo,
        redo,
        duplicateSprite,
        setBrushSize,
        brushSize,
        currentTool,
        isPlaying,
        setIsPlaying,
        stamp,
        activeSpriteId,
        setActiveSpriteId,
        sprites,
        selectedPixels,
        floatingLayer,
        clearSelection,
        nudgeSelection,
        flipSelectionHorizontal,
        flipSelectionVertical,
        rotateSelectionLeft,
        rotateSelectionRight,
        addSprite,
        clearCanvas
    } = useEditor();
    const isStampKeyHeldRef = useRef(false);

    useEffect(() => {
        const shouldAutoStamp = () => (
            selectedPixels.size > 0 &&
            floatingLayer.size > 0 &&
            isStampKeyHeldRef.current
        );

        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if input/textarea is active
            const activeElement = document.activeElement;
            const isInput = activeElement instanceof HTMLInputElement ||
                activeElement instanceof HTMLTextAreaElement ||
                activeElement?.hasAttribute('contenteditable');

            if (isInput) return;

            // Modifiers
            const isCmd = e.metaKey || e.ctrlKey;
            const isShift = e.shiftKey;

            // --- Tools ---
            if (!isCmd) {
                // Check modifiers for specific actions first
                if (isShift) {
                    switch (e.code) {
                        case 'KeyH':
                            e.preventDefault();
                            if (selectedPixels.size > 0) {
                                flipSelectionHorizontal();
                                if (shouldAutoStamp()) stamp();
                            }
                            break;
                        case 'KeyV':
                            e.preventDefault();
                            if (selectedPixels.size > 0) {
                                flipSelectionVertical();
                                if (shouldAutoStamp()) stamp();
                            }
                            break;
                        case 'KeyR':
                            e.preventDefault();
                            if (selectedPixels.size > 0) {
                                rotateSelectionLeft();
                                if (shouldAutoStamp()) stamp();
                            }
                            break;
                        // Shift+N moved to Timeline.tsx
                    }
                } else {
                    // No Shift
                    switch (e.code) {
                        case 'KeyB':
                            setTool('brush');
                            break;
                        case 'KeyE':
                            setTool('eraser');
                            break;
                        case 'KeyF':
                        case 'KeyG': // Aseprite/Adobe default
                            setTool('fill');
                            break;
                        case 'KeyS':
                        case 'KeyM': // Aseprite/Adobe default
                            setTool('select');
                            break;
                        case 'BracketLeft':
                            setBrushSize(1);
                            break;
                        case 'BracketRight':
                            setBrushSize(2);
                            break;
                        case 'Space':
                            e.preventDefault();
                            setIsPlaying(!isPlaying);
                            break;
                        case 'Enter':
                            e.preventDefault();
                            isStampKeyHeldRef.current = true;
                            if (!e.repeat) stamp();
                            break;
                        case 'Escape':
                            if (selectedPixels.size > 0) {
                                clearSelection();
                            }
                            break;
                        case 'KeyR': // Rotate Right (No Shift)
                            if (selectedPixels.size > 0) {
                                e.preventDefault();
                                rotateSelectionRight();
                                if (shouldAutoStamp()) stamp();
                            }
                            break;
                    }
                }
            }

            // --- Timeline Navigation ---
            if (!isCmd && !isShift) {
                if (e.key === ',' || e.key === '<') {
                    e.preventDefault();
                    // Previous Frame
                    const idx = sprites.findIndex(s => s.id === activeSpriteId);
                    if (idx !== -1) {
                        const count = sprites.length;
                        const prevIdx = (idx - 1 + count) % count;
                        setActiveSpriteId(sprites[prevIdx].id);
                    }
                }
                if (e.key === '.' || e.key === '>') {
                    // Next Frame
                    e.preventDefault();
                    const idx = sprites.findIndex(s => s.id === activeSpriteId);
                    if (idx !== -1) {
                        const count = sprites.length;
                        const nextIdx = (idx + 1) % count;
                        setActiveSpriteId(sprites[nextIdx].id);
                    }
                }
            }

            // --- Nudge Selection ---
            if (!isCmd && selectedPixels.size > 0) {
                let dx = 0;
                let dy = 0;
                let handled = false;

                switch (e.key) {
                    case 'ArrowLeft': dx = -1; handled = true; break;
                    case 'ArrowRight': dx = 1; handled = true; break;
                    case 'ArrowUp': dy = -1; handled = true; break;
                    case 'ArrowDown': dy = 1; handled = true; break;
                }

                if (handled) {
                    e.preventDefault();
                    nudgeSelection(dx, dy);
                    if (shouldAutoStamp()) stamp();
                    return;
                }
            }

            // --- Actions (Undo/Redo/Copy/etc) ---
            if (isCmd) {
                switch (e.code) {
                    case 'KeyZ':
                        e.preventDefault();
                        if (isShift) {
                            redo();
                        } else {
                            undo();
                        }
                        break;
                    case 'KeyY':
                        if (!isShift) {
                            e.preventDefault();
                            redo();
                        }
                        break;
                    case 'KeyD': // Deselect (Pixel)
                        e.preventDefault();
                        if (selectedPixels.size > 0) {
                            clearSelection();
                            e.stopImmediatePropagation(); // Prevent falling through to Timeline deselect if pixels matched
                        }
                        break;
                }
            }

            // Delete Operations
            // Shift+Delete is handled by Timeline (handleBulkDelete)
            if ((e.key === 'Backspace' || e.key === 'Delete') && !isShift) {
                clearCanvas();
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Enter') {
                isStampKeyHeldRef.current = false;
            }
        };

        const handleWindowBlur = () => {
            isStampKeyHeldRef.current = false;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleWindowBlur);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleWindowBlur);
        };
    }, [
        setTool,
        undo,
        redo,
        duplicateSprite,
        setBrushSize,
        brushSize,
        currentTool,
        isPlaying,
        setIsPlaying,
        stamp,
        activeSpriteId,
        setActiveSpriteId,
        sprites,
        selectedPixels,
        floatingLayer,
        clearSelection,
        nudgeSelection,
        flipSelectionHorizontal,
        flipSelectionVertical,
        rotateSelectionLeft,
        rotateSelectionRight,
        addSprite,
        clearCanvas
    ]);
};
