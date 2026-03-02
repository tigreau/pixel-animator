import { useState } from 'react';
import { useEditor } from './contexts/editorContextShared';
import { EditorProvider } from './contexts/EditorContext'
import { Sidebar } from './components/Sidebar/Sidebar'
import { TopBar } from './components/Mobile/TopBar'
import { Editor } from './components/Editor/Editor'
import { Timeline } from './components/Timeline/Timeline'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { ShortcutsPanel } from './components/ShortcutsPanel'
import { useIsMobile } from './hooks/useIsMobile'
import './index.css'

const AppContent = () => {
    useKeyboardShortcuts();
    const isMobile = useIsMobile();
    const [showSidebar, setShowSidebar] = useState(true);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [showTimeline, setShowTimeline] = useState(true);

    const { canUndo, canClear, sprites, isDrawing } = useEditor();
    const hasDrawn = canUndo || sprites.length > 1 || (canClear && !isDrawing);

    const toggleStyle = (active: boolean) => ({
        background: 'none',
        border: 'none',
        color: active ? '#ccc' : '#666',
        cursor: 'pointer' as const,
        fontFamily: 'inherit',
        fontSize: isMobile ? '0.7rem' : '0.8rem',
    });

    return (
        <div className="app-container">
            <div className="app-background">
                <div className="blob blob-1"></div>
                <div className="blob blob-2"></div>
                <div className="blob blob-3"></div>
            </div>

            <main className="editor-container">
                {/* View Controls — desktop only */}
                {hasDrawn && !isMobile && (
                    <div style={{
                        position: 'absolute',
                        top: '12px',
                        right: '20px',
                        zIndex: 100,
                        display: 'flex',
                        gap: '16px',
                        fontSize: '0.8rem',
                        color: '#888'
                    }}>
                        <button onClick={() => setShowSidebar(!showSidebar)} style={toggleStyle(showSidebar)}>
                            Toolbar
                        </button>
                        <button onClick={() => setShowShortcuts(!showShortcuts)} style={toggleStyle(showShortcuts)}>
                            Shortcuts
                        </button>
                        <button onClick={() => setShowTimeline(!showTimeline)} style={toggleStyle(showTimeline)}>
                            Timeline
                        </button>
                    </div>
                )}

                {/* Mobile: Top Bar + toggles */}
                {isMobile && showSidebar && <TopBar />}
                {hasDrawn && isMobile && (
                    <div className="mobile-toggles">
                        <button onClick={() => setShowSidebar(!showSidebar)} style={toggleStyle(showSidebar)}>
                            Toolbar
                        </button>
                        <button onClick={() => setShowTimeline(!showTimeline)} style={toggleStyle(showTimeline)}>
                            Timeline
                        </button>
                    </div>
                )}

                <div className="workspace">
                    {!isMobile && showSidebar && <Sidebar />}
                    {showShortcuts && <ShortcutsPanel />}

                    <div className="canvas-area">
                        <Editor />
                        {hasDrawn && showTimeline && <Timeline />}
                    </div>
                </div>
            </main>
        </div>
    );
};

export const App = () => {
    return (
        <EditorProvider>
            <AppContent />
        </EditorProvider>
    );
};

export default App;
