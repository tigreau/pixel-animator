import React, { useRef, useEffect } from 'react';
import { useEditor } from '../../contexts/editorContextShared';
import { RecentColors } from './RecentColors';
import { PaletteGrid } from './PaletteGrid';
import { SelectionTools } from './SelectionTools';
import { EditorControls } from './EditorControls';

export const Sidebar: React.FC = () => {
    const { selectedPixels } = useEditor();
    const paletteRef = useRef<HTMLDivElement>(null);
    const animationAbortedRef = useRef(false);

    useEffect(() => {
        const hintScroll = async () => {
            if (!paletteRef.current || animationAbortedRef.current) return;
            try {
                paletteRef.current.scrollTo({ top: 80, behavior: 'smooth' });
                await new Promise(r => setTimeout(r, 450));
                if (animationAbortedRef.current) return;
                paletteRef.current.scrollTo({ top: 0, behavior: 'smooth' });
                await new Promise(r => setTimeout(r, 450));
                if (animationAbortedRef.current) return;
                paletteRef.current.scrollTo({ top: 80, behavior: 'smooth' });
                await new Promise(r => setTimeout(r, 450));
                if (animationAbortedRef.current) return;
                paletteRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            } catch (e) {
                // Fallback for older browsers
            }
        };
        hintScroll();
    }, []);

    const handleInteraction = () => {
        animationAbortedRef.current = true;
    };

    return (
        <aside
            className="panel tools-panel"
            onPointerDown={handleInteraction}
            onWheel={handleInteraction}
            onTouchStart={handleInteraction}
        >
            <EditorControls />

            <div className="palette-sidebar" ref={paletteRef}>
                <RecentColors />
                {selectedPixels.size > 0 ? (
                    <SelectionTools />
                ) : (
                    <PaletteGrid />
                )}
            </div>
        </aside>
    );
};
