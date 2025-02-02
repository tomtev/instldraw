import {
  BaseBoxShapeUtil,
  HTMLContainer,
  TLBaseShape,
  BaseBoxShapeTool,
  createShapeId,
  T,
  DefaultColorStyle,
  TLShape,
  Box,
  Editor,
  canonicalizeRotation,
  toDomPrecision,
  useEditor,
  TLShapeId,
  TLResizeInfo,
} from "tldraw"

// Define the shape type similar to TLFrameShape
type IFrameShape = TLBaseShape<
  'custom-frame',
  {
    w: number
    h: number
    name: string // Changed from title to name to match tldraw
  }
>

// Create the Frame shape util
export class FrameShapeUtil extends BaseBoxShapeUtil<IFrameShape> {
  static type = 'custom-frame' as const
  
  static props = {
    w: T.number,
    h: T.number,
    name: T.string,
  }

  getDefaultProps(): IFrameShape['props'] {
    return {
      w: 160 * 2, // Match tldraw defaults
      h: 90 * 2,
      name: '',
    }
  }

  providesBackgroundForChildren(): boolean {
    return true
  }

  // Allow frames to be dropped into other frames
  canReceiveNewChildrenOfType(_shape: IFrameShape, _type: string): boolean {
    // Remove the frame type restriction to allow frame nesting
    return true
  }

  // Handle dropping shapes into frames
  override onDragShapesOver = (frame: IFrameShape, shapes: TLShape[]) => {
    // Don't allow dragging a parent into its child
    const frameAncestors = new Set(this.editor.getShapeAncestors(frame).map(s => s.id))
    const nonDescendants = shapes.filter(shape => !frameAncestors.has(shape.id))

    if (nonDescendants.length > 0) {
      this.editor.reparentShapes(
        nonDescendants.map(s => s.id),
        frame.id
      )
    }
  }

  override onDragShapesOut = (frame: IFrameShape, shapes: TLShape[]) => {
    const parentId = frame.parentId ?? this.editor.getCurrentPageId()
    this.editor.reparentShapes(shapes.map(s => s.id), parentId)
  }

  component(shape: IFrameShape) {
    const bounds = this.editor.getShapeGeometry(shape).bounds
    const isCreating = this.editor.isIn('creating')

    return (
      <>
        <HTMLContainer>
          <div 
            className={`tl-frame__body ${isCreating ? 'tl-frame__creating' : ''}`}
            style={{ 
              width: bounds.width,
              height: bounds.height,
              backgroundColor: 'var(--color-muted-1)',
              border: '1px solid var(--color-muted-2)',
            }}
          />
        </HTMLContainer>
        {!isCreating && (
          <FrameHeading
            id={shape.id}
            name={shape.props.name}
            width={bounds.width}
            height={bounds.height}
          />
        )}
      </>
    )
  }

  indicator(shape: IFrameShape) {
    const bounds = this.editor.getShapeGeometry(shape).bounds
    return (
      <rect
        width={toDomPrecision(bounds.width)}
        height={toDomPrecision(bounds.height)}
        className="tl-frame-indicator"
      />
    )
  }

  override onResize(shape: IFrameShape, info: TLResizeInfo) {
    const { scaleX, scaleY, initialShape } = info
    const { w, h } = initialShape.props
    
    // Calculate new dimensions
    const newWidth = Math.max(1, w * scaleX)
    const newHeight = Math.max(1, h * scaleY)
    
    // Get all children of the frame
    const children = this.editor.getSortedChildIdsForParent(shape.id)
      .map(id => this.editor.getShape(id)!)
      .filter(child => !child.isLocked)

    // Calculate scale factors relative to original size
    const scaleW = newWidth / w
    const scaleH = newHeight / h

    // Update children positions and sizes proportionally
    const updates = children.map(child => {
      const childGeometry = this.editor.getShapeGeometry(child)
      return {
        ...child,
        x: child.x * scaleW,
        y: child.y * scaleH,
        props: {
          ...child.props,
          // Scale width/height props if they exist
          ...('w' in child.props ? { w: child.props.w * scaleW } : {}),
          ...('h' in child.props ? { h: child.props.h * scaleH } : {}),
        },
      }
    })

    this.editor.updateShapes(updates)

    return {
      props: {
        w: newWidth,
        h: newHeight,
      },
    }
  }

  // Add this to allow free resizing (not locked to aspect ratio)
  override canResize(shape: IFrameShape) {
    return true
  }

  // Add these methods from the official implementation
  override canBind = () => false
  
  override canEdit = () => true
  
  override canUnmount = () => false
  
  override canReceiveNewParent = () => true
  
  override canDropShapes = () => true
  
  override onChildrenChange = (shape: IFrameShape) => {
    // Handle children changes
    const children = this.editor.getSortedChildIdsForParent(shape.id)
    if (children.length === 0) {
      this.editor.updateShape({
        id: shape.id,
        type: 'custom-frame',
        meta: { ...shape.meta, isEmpty: true },
      })
    }
  }

  // Add this to handle shape dragging
  override onResizeEnd = (shape: IFrameShape) => {
    const children = this.editor.getSortedChildIdsForParent(shape.id)
    if (children.length === 0) {
      this.editor.updateShape({
        id: shape.id,
        type: 'custom-frame',
        meta: { ...shape.meta, isEmpty: true },
      })
    }
  }
}

function FrameHeading({
  id,
  name,
  width,
  height,
}: {
  id: string
  name: string
  width: number
  height: number
}) {
  const editor = useEditor()
  const isEditing = editor.getEditingShapeId() === id
  
  return (
    <div
      className="tl-frame-heading"
      style={{
        position: 'absolute',
        top: -32,
        left: 0,
        width,
        height: 32,
        padding: '4px 8px',
        fontSize: 12,
        fontFamily: 'inherit',
        color: 'var(--color-text)',
        userSelect: 'none',
        pointerEvents: isEditing ? 'auto' : 'none',
      }}
    >
       HAHA
    </div>
  )
}

// Create the Frame tool
export class FrameTool extends BaseBoxShapeTool {
  static id = 'custom-frame'
  static initial = 'idle'
  shapeType = 'custom-frame'

  override onDoubleClick = (e: React.MouseEvent) => {
    // Handle double click to edit frame name
    const shape = this.editor.getShape(this.editor.getSelectedShapeIds()[0])
    if (shape && shape.type === 'custom-frame') {
      this.editor.setEditingShape(shape.id)
    }
  }

  override onCreate = (shape: IFrameShape | null) => {
    if (!shape) return

    const bounds = this.editor.getShapePageBounds(shape)!
    const shapesToAdd: TLShapeId[] = []
    const ancestorIds = this.editor.getShapeAncestors(shape).map((shape) => shape.id)

    // Find shapes that should be added to the frame
    this.editor.getSortedChildIdsForParent(shape.parentId).forEach((siblingId) => {
      const sibling = this.editor.getShape(siblingId)
      if (!sibling) return
      if (sibling.id === shape.id) return
      if (sibling.isLocked) return

      const siblingBounds = this.editor.getShapePageBounds(sibling)
      if (!siblingBounds) return

      // Add shapes that are fully contained by the frame
      if (bounds.contains(siblingBounds)) {
        if (!ancestorIds.includes(sibling.id)) {
          shapesToAdd.push(sibling.id)
        }
      }
    })

    // Add the shapes to the frame
    this.editor.reparentShapes(shapesToAdd, shape.id)

    // Set the tool based on whether it's locked
    if (this.editor.getInstanceState().isToolLocked) {
      this.editor.setCurrentTool('custom-frame')
    } else {
      this.editor.setCurrentTool('select.idle')
    }
  }

  // Allow free resizing by default (aspect ratio only when holding shift)
  override isAspectRatioLocked = false
} 