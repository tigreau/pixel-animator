import React from 'react';
import { useEditor } from '../../contexts/editorContextShared';
import { useIsMobile } from '../../hooks/useIsMobile';
import { RotateCcw, RotateCw, GripVertical, FlipHorizontal, FlipVertical } from 'lucide-react';

export const SelectionControls: React.FC = () => {
    const {
        selectedPixels,
        isPlaying,
        flipSelectionHorizontal,
        flipSelectionVertical,
        rotateSelectionLeft,
        rotateSelectionRight
    } = useEditor();

    const isMobile = useIsMobile();

    const dispatchVirtualKey = React.useCallback((action: string, type: 'down' | 'up') => {
        window.dispatchEvent(new CustomEvent('virtual-key', { detail: { action, type } }));
    }, []);

    const [activeActions, setActiveActions] = React.useState<string[]>([]);

    React.useEffect(() => {
        const handleActionsChanged = (e: Event) => {
            const customEvent = e as CustomEvent<string[]>;
            setActiveActions([...customEvent.detail]);
        };
        window.addEventListener('active-actions-changed', handleActionsChanged);
        return () => {
            window.removeEventListener('active-actions-changed', handleActionsChanged);
        };
    }, []);

    // Draggable state
    const [offset, setOffset] = React.useState({ x: 0, y: 0 });
    const isDraggingRef = React.useRef(false);
    const dragStartRef = React.useRef({ x: 0, y: 0 });

    const handlePointerDown = (e: React.PointerEvent) => {
        isDraggingRef.current = true;
        dragStartRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
        if (e.target instanceof Element) {
            e.target.setPointerCapture(e.pointerId);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDraggingRef.current) return;
        setOffset({
            x: e.clientX - dragStartRef.current.x,
            y: e.clientY - dragStartRef.current.y
        });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDraggingRef.current = false;
        if (e.target instanceof Element) {
            e.target.releasePointerCapture(e.pointerId);
        }
    };

    // Remove the old handleKeyDown/handleKeyUp tracking since active-actions-changed handles it robustly now

    if (selectedPixels.size === 0) return null;

    return (
        <div className="selection-controls" style={{
            position: 'absolute',
            bottom: '160px',
            left: '50%',
            transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)`,
            display: 'flex',
            justifyContent: 'center',
            gap: isMobile ? '8px' : '16px',
            alignItems: 'center',
            padding: isMobile ? '6px 8px' : '8px 16px',
            backgroundColor: 'rgba(30, 30, 30, 0.95)',
            border: '1px solid #333',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            pointerEvents: 'auto',
            zIndex: 50
        }}>
            <div
                className="drag-handle"
                style={{ cursor: 'grab', display: 'flex', alignItems: 'center', padding: isMobile ? '0 2px' : '0 4px', margin: isMobile ? '-6px 0 -6px -6px' : '-8px 0 -8px -12px', opacity: 0.5, touchAction: 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                <GripVertical size={isMobile ? 14 : 16} />
            </div>
            <div className="timeline-controls-left">
                <button
                    className={`control-btn-small ${activeActions.includes('stamp') ? 'active' : ''}`}
                    onPointerDown={(e) => {
                        e.preventDefault();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        dispatchVirtualKey('stamp', 'down');
                    }}
                    onPointerUp={(e) => {
                        e.currentTarget.releasePointerCapture(e.pointerId);
                        dispatchVirtualKey('stamp', 'up');
                    }}
                    onPointerCancel={() => dispatchVirtualKey('stamp', 'up')}
                    onContextMenu={(e) => e.preventDefault()}
                    style={{ fontWeight: 'bold', fontSize: isMobile ? '0.75rem' : undefined, padding: isMobile ? '2px 6px' : undefined, touchAction: 'none' }}
                >
                    Stamp (Enter)
                </button>
            </div>
            {!isPlaying && (
                <div className="file-controls" style={{ display: 'flex', gap: isMobile ? '2px' : '4px' }}>
                    {/* Transform Tools */}
                    <button className={`control-btn-small ${activeActions.includes('flipH') ? 'active' : ''}`} style={{ width: isMobile ? '22px' : '28px', height: isMobile ? '22px' : '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={flipSelectionHorizontal} title="Flip Horizontal (H)"><FlipHorizontal size={isMobile ? 12 : 14} strokeWidth={3} /></button>
                    <button className={`control-btn-small ${activeActions.includes('flipV') ? 'active' : ''}`} style={{ width: isMobile ? '22px' : '28px', height: isMobile ? '22px' : '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={flipSelectionVertical} title="Flip Vertical (V)"><FlipVertical size={isMobile ? 12 : 14} strokeWidth={3} /></button>
                    <button className={`control-btn-small ${activeActions.includes('rotL') ? 'active' : ''}`} style={{ width: isMobile ? '22px' : '28px', height: isMobile ? '22px' : '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={rotateSelectionLeft} title="Rotate Left (Q)"><RotateCcw size={isMobile ? 12 : 14} strokeWidth={3} /></button>
                    <button className={`control-btn-small ${activeActions.includes('rotR') ? 'active' : ''}`} style={{ width: isMobile ? '22px' : '28px', height: isMobile ? '22px' : '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={rotateSelectionRight} title="Rotate Right (E)"><RotateCw size={isMobile ? 12 : 14} strokeWidth={3} /></button>

                    {/* Divider */}
                    <div style={{ width: '1px', height: isMobile ? '12px' : '16px', backgroundColor: '#444', margin: '0 4px' }} />

                    <button
                        className={`control-btn-small ${activeActions.includes('left') ? 'active' : ''}`}
                        style={{ width: isMobile ? '22px' : '28px', height: isMobile ? '22px' : '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '0.8rem' : undefined, touchAction: 'none' }}
                        onMouseDown={(e) => e.preventDefault()}
                        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); dispatchVirtualKey('left', 'down'); }}
                        onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); dispatchVirtualKey('left', 'up'); }}
                        onPointerCancel={() => { dispatchVirtualKey('left', 'up'); }}
                        onContextMenu={(e) => e.preventDefault()}
                    ><span style={{ transform: 'rotate(90deg)', display: 'inline-block' }}>▾</span></button>
                    <button
                        className={`control-btn-small ${activeActions.includes('up') ? 'active' : ''}`}
                        style={{ width: isMobile ? '22px' : '28px', height: isMobile ? '22px' : '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '0.8rem' : undefined, touchAction: 'none' }}
                        onMouseDown={(e) => e.preventDefault()}
                        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); dispatchVirtualKey('up', 'down'); }}
                        onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); dispatchVirtualKey('up', 'up'); }}
                        onPointerCancel={() => { dispatchVirtualKey('up', 'up'); }}
                        onContextMenu={(e) => e.preventDefault()}
                    ><span style={{ transform: 'rotate(180deg)', display: 'inline-block' }}>▾</span></button>
                    <button
                        className={`control-btn-small ${activeActions.includes('down') ? 'active' : ''}`}
                        style={{ width: isMobile ? '22px' : '28px', height: isMobile ? '22px' : '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '0.8rem' : undefined, touchAction: 'none' }}
                        onMouseDown={(e) => e.preventDefault()}
                        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); dispatchVirtualKey('down', 'down'); }}
                        onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); dispatchVirtualKey('down', 'up'); }}
                        onPointerCancel={() => { dispatchVirtualKey('down', 'up'); }}
                        onContextMenu={(e) => e.preventDefault()}
                    ><span>▾</span></button>
                    <button
                        className={`control-btn-small ${activeActions.includes('right') ? 'active' : ''}`}
                        style={{ width: isMobile ? '22px' : '28px', height: isMobile ? '22px' : '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isMobile ? '0.8rem' : undefined, touchAction: 'none' }}
                        onMouseDown={(e) => e.preventDefault()}
                        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); dispatchVirtualKey('right', 'down'); }}
                        onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); dispatchVirtualKey('right', 'up'); }}
                        onPointerCancel={() => { dispatchVirtualKey('right', 'up'); }}
                        onContextMenu={(e) => e.preventDefault()}
                    ><span style={{ transform: 'rotate(-90deg)', display: 'inline-block' }}>▾</span></button>
                </div>
            )}
        </div>
    );
};
