import { useEffect, useRef } from 'react';
import Mousetrap from 'mousetrap';
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
        clearCanvas,
        commitHistory
    } = useEditor();
    const activeActionsRef = useRef(new Set<string>());
    const lastTickRef = useRef<number>(0);
    const animationFrameRef = useRef<number | null>(null);

    // Refs for current state to avoid stale closures in the loop
    const stateRefs = useRef({
        selectedPixelsSize: selectedPixels.size,
        floatingLayerSize: floatingLayer.size,
        nudgeSelection,
        stamp,
        commitHistory
    });

    useEffect(() => {
        stateRefs.current = {
            selectedPixelsSize: selectedPixels.size,
            floatingLayerSize: floatingLayer.size,
            nudgeSelection,
            stamp,
            commitHistory
        };
    }, [selectedPixels.size, floatingLayer.size, nudgeSelection, stamp, commitHistory]);

    useEffect(() => {
        const TICK_RATE_MS = 80;

        const gameLoop = (timestamp: number) => {
            if (timestamp - lastTickRef.current >= TICK_RATE_MS) {
                lastTickRef.current = timestamp;

                const { selectedPixelsSize, floatingLayerSize, nudgeSelection, stamp } = stateRefs.current;
                const actions = activeActionsRef.current;

                if (selectedPixelsSize > 0) {
                    let dx = 0;
                    let dy = 0;
                    let nudged = false;

                    if (actions.has('left')) { dx -= 1; nudged = true; }
                    if (actions.has('right')) { dx += 1; nudged = true; }
                    if (actions.has('up')) { dy -= 1; nudged = true; }
                    if (actions.has('down')) { dy += 1; nudged = true; }

                    if (nudged) {
                        nudgeSelection(dx, dy);
                        // Auto-stamp if holding enter/stamp AND floating layer exists
                        if (actions.has('stamp') && floatingLayerSize > 0) {
                            stamp(false);
                        }
                    } else if (actions.has('stamp') && floatingLayerSize > 0) {
                        // Just stamping, no movement
                        stamp(false);
                    }
                }
            }
            animationFrameRef.current = requestAnimationFrame(gameLoop);
        };

        animationFrameRef.current = requestAnimationFrame(gameLoop);

        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, []);

    useEffect(() => {
        // Helper to safely bind/unbind continuous actions
        const notifyActionsChanged = () => {
            window.dispatchEvent(new CustomEvent('active-actions-changed', {
                detail: Array.from(activeActionsRef.current)
            }));
        };

        const bindAction = (key: string | string[], action: string) => {
            Mousetrap.bind(key, (e) => {
                e.preventDefault();
                if (!activeActionsRef.current.has(action)) {
                    activeActionsRef.current.add(action);
                    notifyActionsChanged();
                    // Force an immediate tick on first press for responsiveness
                    if (activeActionsRef.current.size === 1) lastTickRef.current = 0;
                }
            }, 'keydown');
            Mousetrap.bind(key, (e) => {
                e.preventDefault();
                if (activeActionsRef.current.has(action)) {
                    activeActionsRef.current.delete(action);
                    notifyActionsChanged();
                    if (action === 'stamp') {
                        stateRefs.current.commitHistory();
                    }
                }
            }, 'keyup');
        };

        const bindSingleUIAction = (key: string | string[], action: string, callback: (e: KeyboardEvent) => void) => {
            Mousetrap.bind(key, (e) => {
                if (!activeActionsRef.current.has(action)) {
                    activeActionsRef.current.add(action);
                    notifyActionsChanged();
                    callback(e);
                }
            }, 'keydown');
            Mousetrap.bind(key, () => {
                if (activeActionsRef.current.has(action)) {
                    activeActionsRef.current.delete(action);
                    notifyActionsChanged();
                }
            }, 'keyup');
        };

        // Continuous actions (Game Loop powered)
        bindAction('left', 'left');
        bindAction('right', 'right');
        bindAction('up', 'up');
        bindAction('down', 'down');
        bindAction('enter', 'stamp');

        // Note: Mousetrap automatically handles preventing defaults
        // and ignoring inputs inside of textareas/inputs by default!

        // Tools (Single Press)
        Mousetrap.bind('b', () => setTool('brush'));
        Mousetrap.bind('e', () => setTool('eraser'));
        Mousetrap.bind(['f', 'g'], () => setTool('fill'));
        Mousetrap.bind(['s', 'm'], () => setTool('select'));

        // Brush Size
        Mousetrap.bind('[', () => setBrushSize(1));
        Mousetrap.bind(']', () => setBrushSize(2));

        // Transport
        Mousetrap.bind('space', (e) => { e.preventDefault(); setIsPlaying(!isPlaying); });

        // Selection Actions
        Mousetrap.bind('esc', () => {
            if (selectedPixels.size > 0) clearSelection();
        });
        bindSingleUIAction('r', 'rotR', (e) => {
            if (selectedPixels.size > 0) {
                e.preventDefault();
                rotateSelectionRight();
                if (activeActionsRef.current.has('stamp')) stateRefs.current.stamp(false);
            }
        });
        bindSingleUIAction('shift+r', 'rotL', (e) => {
            if (selectedPixels.size > 0) {
                e.preventDefault();
                rotateSelectionLeft();
                if (activeActionsRef.current.has('stamp')) stateRefs.current.stamp(false);
            }
        });
        bindSingleUIAction('shift+h', 'flipH', (e) => {
            if (selectedPixels.size > 0) {
                e.preventDefault();
                flipSelectionHorizontal();
                if (activeActionsRef.current.has('stamp')) stateRefs.current.stamp(false);
            }
        });
        bindSingleUIAction('shift+v', 'flipV', (e) => {
            if (selectedPixels.size > 0) {
                e.preventDefault();
                flipSelectionVertical();
                if (activeActionsRef.current.has('stamp')) stateRefs.current.stamp(false);
            }
        });

        // Timeline Navigation
        Mousetrap.bind([',', '<'], (e) => {
            e.preventDefault();
            const idx = sprites.findIndex(s => s.id === activeSpriteId);
            if (idx !== -1) {
                const count = sprites.length;
                setActiveSpriteId(sprites[(idx - 1 + count) % count].id);
            }
        });
        Mousetrap.bind(['.', '>'], (e) => {
            e.preventDefault();
            const idx = sprites.findIndex(s => s.id === activeSpriteId);
            if (idx !== -1) {
                setActiveSpriteId(sprites[(idx + 1) % sprites.length].id);
            }
        });

        // Undo / Redo
        Mousetrap.bind('mod+z', (e) => { e.preventDefault(); undo(); });
        Mousetrap.bind('mod+shift+z', (e) => { e.preventDefault(); redo(); });
        Mousetrap.bind('mod+y', (e) => { e.preventDefault(); redo(); });

        // Deselect
        Mousetrap.bind('mod+d', (e) => {
            if (selectedPixels.size > 0) {
                e.preventDefault();
                clearSelection();
            }
        });

        // Delete
        Mousetrap.bind(['backspace', 'del'], () => clearCanvas());

        const handleWindowBlur = () => {
            if (activeActionsRef.current.size > 0) {
                activeActionsRef.current.clear();
                notifyActionsChanged();
            }
        };

        const handleVirtualKeyPress = (e: Event) => {
            const customEvent = e as CustomEvent<{ action: string, type: 'down' | 'up' }>;
            const { action, type } = customEvent.detail;

            if (type === 'down') {
                if (!activeActionsRef.current.has(action)) {
                    activeActionsRef.current.add(action);
                    notifyActionsChanged();
                    // Force tick on first press for instant feel
                    if (activeActionsRef.current.size === 1) lastTickRef.current = 0;
                }
            } else {
                if (activeActionsRef.current.has(action)) {
                    activeActionsRef.current.delete(action);
                    notifyActionsChanged();
                    if (action === 'stamp') {
                        stateRefs.current.commitHistory();
                    }
                }
            }
        };

        window.addEventListener('blur', handleWindowBlur);
        window.addEventListener('virtual-key', handleVirtualKeyPress);

        return () => {
            Mousetrap.reset();
            window.removeEventListener('blur', handleWindowBlur);
            window.removeEventListener('virtual-key', handleVirtualKeyPress);
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
