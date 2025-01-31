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
} from "tldraw";
import { useInstantPresence } from "@/lib/useInstantPresence";
import { BuilderTool, BuilderShapeUtil } from './BuilderTool'

const components: TLComponents = {
  Toolbar: (props) => {
    const tools = useTools()
    const isBuilderSelected = useIsToolSelected(tools['builder'])
    
    return (
      <DefaultToolbar {...props}>
        <TldrawUiMenuItem {...tools['builder']} isSelected={isBuilderSelected} />
        <DefaultToolbarContent />
      </DefaultToolbar>
    )
  },
}

const customAssetUrls: TLUiAssetUrlOverrides = {
  icons: {
    'builder-icon': '/builder-icon.svg',
  },
}

const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools.builder = {
      id: 'builder',
      label: 'Builder',
      icon: 'builder-icon',
      onSelect: () => {
        editor.setCurrentTool('builder')
      },
      kbd: 'b',
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
    bounds: { x: 0, y: 0, w: 1200, h: 1000 },
    behavior: { x: 'contain', y: 'free' },
    padding: { x: 50, y: 50 },
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
  return (
    <div className="w-full h-full bg-gray-100">
      <Tldraw
        autoFocus
        store={store}
        overrides={uiOverrides}
        assetUrls={customAssetUrls}
        shapeUtils={[BuilderShapeUtil]}
        tools={[BuilderTool]}
        components={{
          ...components,
          DebugMenu: null,
          DebugPanel: null,
          Minimap: null,
        }}
        options={{ maxPages: 1 }}
        cameraOptions={CAMERA_OPTIONS}
        className="bg-transparent"
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