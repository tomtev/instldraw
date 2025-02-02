'use client'

import "tldraw/tldraw.css";
import { 
  Tldraw, 
  useEditor, 
  TLUiOverrides,
  DefaultToolbar,
  DefaultToolbarContent,
  TldrawUiMenuItem,
  useTools,
  useIsToolSelected,
  TLComponents,
  TLUiAssetUrlOverrides,
  TLCameraOptions,
  stopEventPropagation,
} from "tldraw";
import { useInstantPresence } from "@/lib/useInstantPresence";
import { FrameTool, FrameShapeUtil, FrameLayoutBindingUtil } from './FrameTool'
import { useCallback, useEffect, useState } from 'react'
import { Editor, TLEventMapHandler } from 'tldraw'

// Component that will be rendered on the canvas
function OnCanvasComponent() {
  const [count, setCount] = useState(0)

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 200,
        padding: 12,
        borderRadius: 8,
        backgroundColor: 'white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        zIndex: 0,
        userSelect: 'none',
      }}
      onPointerDown={stopEventPropagation}
      onPointerMove={stopEventPropagation}
    >
      <p style={{ marginBottom: 8 }}>Count: {count}</p>
      <button 
        onClick={() => setCount(c => c + 1)}
        style={{
          padding: '4px 8px',
          borderRadius: 4,
          border: '1px solid #ddd',
          background: '#fff',
          cursor: 'pointer',
        }}
      >
        Increment
      </button>
    </div>
  )
}

const components: TLComponents = {
  Toolbar: (props) => {
    const tools = useTools()
    const isFrameSelected = useIsToolSelected(tools['custom-frame'])
    
    return (
      <DefaultToolbar {...props}>
        <TldrawUiMenuItem {...tools['custom-frame']} isSelected={isFrameSelected} />
        <DefaultToolbarContent />
      </DefaultToolbar>
    )
  },
  OnTheCanvas: OnCanvasComponent,
}

const customAssetUrls: TLUiAssetUrlOverrides = {
  icons: {
    'frame-icon': '/frame-icon.svg',  // You'll need to add this icon
  },
}

const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools['custom-frame'] = {
      id: 'custom-frame',
      label: 'Frame',
      icon: 'frame-icon',
      onSelect: () => {
        editor.setCurrentTool('custom-frame')
      },
      kbd: 'f',
    }
    return tools
  },
}

const CAMERA_OPTIONS: TLCameraOptions = {
  isLocked: false,
  wheelBehavior: 'pan',
  panSpeed: 1,
  zoomSpeed: 1,
  zoomSteps: [0.5, 1, 1.5, 2],
  constraints: {
    initialZoom: 'fit-x',
    baseZoom: 'fit-x',
    bounds: { x: 0, y: 0, w: 1200, h: 3000 },
    behavior: { x: 'contain', y: 'free' },
    padding: { x: 10, y: 10 },
    origin: { x: 0.5, y: 0.5 },
  },
}

export function TLDrawEditor({
  store,
  drawingId,
  user,
}: {
  store: any;
  drawingId: string;
  user: { id: string; color: string; name: string };
}) {
  const [editor, setEditor] = useState<Editor>()

  const handleMount = useCallback((editor: Editor) => {
    setEditor(editor)
    // Force snap mode on
    editor.user.updateUserPreferences({
      isSnapMode: true
    })
  }, [])

  useEffect(() => {
    if (!editor) return

    // Force snap mode back on if user tries to disable it
    const unsubscribe = editor.store.listen('change', {
      source: 'user',
      scope: 'user_preferences',
    }, () => {
      const prefs = editor.user.getUserPreferences()
      if (!prefs.isSnapMode) {
        editor.user.updateUserPreferences({
          isSnapMode: true
        })
      }
    })

    return () => {
      unsubscribe()
    }
  }, [editor])

  // Set whether verbose logging is enabled via an environment variable.
  const isDebugEnabled = process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true';

  useEffect(() => {
    if (!editor) return;

    // Wrap change logging with a debug flag to reduce overhead during drag events.
    const handleChangeEvent: TLEventMapHandler<'change'> = (change) => {
      if (!isDebugEnabled) return; // Skip logging if debugging isn't enabled
      
      // Log created shapes
      for (const record of Object.values(change.changes.added)) {
        if (record.typeName === 'shape') {
          console.log(`Created: ${record.type} shape`, {
            id: record.id,
            type: record.type,
            x: record.x,
            y: record.y,
            props: record.props,
            parentId: record.parentId,
            index: record.index,
          });
        }
      }

      // Log updated shapes
      for (const [from, to] of Object.values(change.changes.updated)) {
        if (
          from.typeName === 'instance' &&
          to.typeName === 'instance' &&
          from.currentPageId !== to.currentPageId
        ) {
          console.log(`Changed page: ${from.currentPageId} → ${to.currentPageId}`);
        } else if (from.typeName === 'shape' && to.typeName === 'shape') {
          console.log(`Updated: ${to.type} shape`, {
            id: to.id,
            type: to.type,
            from: {
              x: from.x,
              y: from.y,
              props: from.props,
            },
            to: {
              x: to.x,
              y: to.y,
              props: to.props,
            },
            parentId: to.parentId,
            index: to.index,
          });
        }
      }

      // Log deleted shapes
      for (const record of Object.values(change.changes.removed)) {
        if (record.typeName === 'shape') {
          console.log(`Deleted: ${record.type} shape`, {
            id: record.id,
            type: record.type,
            x: record.x,
            y: record.y,
            props: record.props,
            parentId: record.parentId,
            index: record.index,
          });
        }
      }
    };

    const cleanup = editor.store.listen(handleChangeEvent, {
      source: 'user',
      scope: 'all',
    });

    return () => {
      cleanup();
    };
  }, [editor, isDebugEnabled]);

  return (
    <div className="w-full h-full bg-gray-100">
      <Tldraw
        autoFocus
        store={store}
        overrides={uiOverrides}
        assetUrls={customAssetUrls}
        shapeUtils={[FrameShapeUtil]}
        bindingUtils={[FrameLayoutBindingUtil]}
        tools={[FrameTool]}
        components={components}
        options={{ maxPages: 1 }}
        cameraOptions={CAMERA_OPTIONS}
        className="bg-transparent"
        onMount={handleMount}
      >
        {drawingId ? (
          <InstantTldrawCursors
            drawingId={drawingId}
            user={user}
          />
        ) : null}
      </Tldraw>
    </div>
  );
}

function InstantTldrawCursors({
  drawingId,
  user,
}: {
  drawingId: string;
  user: { id: string; color: string; name: string };
}) {
  const editor = useEditor();

  useInstantPresence({
    editor,
    drawingId,
    user,
  });

  return null;
} 