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
import { StarTool } from './StarTool'
import { PageTool, PageShapeUtil } from './PageTool'
import { SectionTool, SectionShapeUtil } from './SectionTool'
import { LayoutBindingUtil } from './LayoutBindingUtil'
import { StackTool, StackShapeUtil } from './StackTool'

const components: TLComponents = {
  Toolbar: (props) => {
    const tools = useTools()
    const isStarSelected = useIsToolSelected(tools['star'])
    const isPageSelected = useIsToolSelected(tools['page'])
    const isSectionSelected = useIsToolSelected(tools['section'])
    const isStackSelected = useIsToolSelected(tools['stack'])
    
    return (
      <DefaultToolbar {...props}>
        <TldrawUiMenuItem {...tools['star']} isSelected={isStarSelected} />
        <TldrawUiMenuItem {...tools['page']} isSelected={isPageSelected} />
        <TldrawUiMenuItem {...tools['section']} isSelected={isSectionSelected} />
        <TldrawUiMenuItem {...tools['stack']} isSelected={isStackSelected} />
        <DefaultToolbarContent />
      </DefaultToolbar>
    )
  },
}

const customAssetUrls: TLUiAssetUrlOverrides = {
  icons: {
    'star-icon': '/star-icon.svg',  // Place your SVG file in the public folder
    'page-icon': '/container-icon.svg',  // You'll need to add these icons
    'section-icon': '/section-icon.svg',
    'stack-icon': '/stack-icon.svg',
  },
}

const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools.star = {
      id: 'star',
      label: 'Star',
      icon: 'star-icon',  // Reference the icon by its key
      onSelect: () => {
        editor.setCurrentTool('star')
      },
      kbd: 's',
    }
    tools.page = {
      id: 'page',
      label: 'Page',
      icon: 'page-icon',
      onSelect: () => {
        editor.setCurrentTool('page')
      },
      kbd: 'c',
    }
    tools.section = {
      id: 'section',
      label: 'Section',
      icon: 'section-icon',
      onSelect: () => {
        editor.setCurrentTool('section')
      },
      kbd: 'x',
    }
    tools.stack = {
      id: 'stack',
      label: 'Stack',
      icon: 'stack-icon',
      onSelect: () => {
        editor.setCurrentTool('stack')
      },
      kbd: 'k',
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
    padding: { x: 100, y: 100 },
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
        shapeUtils={[PageShapeUtil, SectionShapeUtil, StackShapeUtil]}
        bindingUtils={[LayoutBindingUtil]}
        tools={[StarTool, PageTool, SectionTool, StackTool]}
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