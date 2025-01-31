import {
  Geometry2d,
  HTMLContainer,
  RecordProps,
  Rectangle2d,
  ShapeUtil,
  T,
  TLBaseShape,
  TLResizeInfo,
  resizeBox,
  StateNode,
  createShapeId,
  Vec,
  getIndexBetween,
  createBindingId,
  IndexKey,
  TLShape,
  StyleProp,
  TextLabel,
  BaseBoxShapeTool,
  BaseBoxShapeUtil,
  DefaultColorStyle
} from "tldraw"

// Define the text style property
const sectionTextStyle = StyleProp.defineEnum('section:text-style', {
  defaultValue: 'heading',
  values: ['heading', 'subheading', 'body'],
})

// Get the type of the style
type SectionTextStyle = T.TypeOf<typeof sectionTextStyle>

// Define the shape type
type ICustomShape = TLBaseShape<
  'section',
  {
    w: number
    h: number
    text: string
    bg: string
    textStyle: SectionTextStyle
  }
>

// Add this helper function at the top level
function GhostSection({
  width,
  height,
  style
}: {
  width: number
  height: number
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        width,
        height,
        background: `repeating-linear-gradient(
          45deg,
          rgba(128, 128, 128, 0.1),
          rgba(128, 128, 128, 0.1) 4px,
          rgba(128, 128, 128, 0.2) 4px,
          rgba(128, 128, 128, 0.2) 8px
        )`,
        border: '2px dashed rgba(128, 128, 128, 0.4)',
        borderRadius: '4px',
        position: 'absolute',
        pointerEvents: 'none',
        ...style
      }}
    />
  )
}

// Create the Section shape util
export class SectionShapeUtil extends BaseBoxShapeUtil<ICustomShape> {
  static type = 'section' as const
  
  static props = {
    w: T.number,
    h: T.number,
    text: T.string,
    bg: T.string,
    textStyle: sectionTextStyle,
  }

  getDefaultProps(): ICustomShape['props'] {
    return {
      w: 1200,
      h: 500,
      text: 'Section',
      bg: 'rgba(255,255,255,1)',
      textStyle: 'heading',
    }
  }

  canEdit() {
    return true
  }
  
  canResize() {
    return true
  }

  isAspectRatioLocked() {
    return false
  }

  getGeometry(shape: ICustomShape): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    })
  }

  override onResize(shape: ICustomShape, info: TLResizeInfo<ICustomShape>) {
    // Only allow vertical resizing
    const newHeight = Math.max(50, shape.props.h * info.scaleY)
    
    // Get all child shapes
    const children = this.editor.getSortedChildIdsForParent(shape.id)
    const childShapes = children.map(id => this.editor.getShape(id))
    
    // Calculate the scale factor for height
    const heightScale = newHeight / shape.props.h
    
    // Update child positions
    this.editor.batch(() => {
      childShapes.forEach(child => {
        if (!child) return
        
        // Calculate relative position from section's top
        const relativeY = child.y - shape.y
        
        // Keep x position the same, only adjust y if needed
        this.editor.updateShape({
          id: child.id,
          type: child.type,
          x: child.x,
          y: shape.y + relativeY // Keep absolute position
        })
      })
    })

    const newShape = {
      ...shape,
      props: {
        ...shape.props,
        h: newHeight,
        w: shape.props.w, // Keep original width
      },
    }

    // Update container height if needed
    const binding = this.editor.getBindingsToShape(shape, 'layout')[0]
    if (binding) {
      const container = this.editor.getShape(binding.fromId)
      if (container) {
        // Calculate total height of all sections in container
        const bindings = this.editor.getBindingsFromShape(container, 'layout')
        let totalHeight = 0
        bindings.forEach(b => {
          const section = this.editor.getShape(b.toId)
          if (section) totalHeight += section.props.h
        })
        
        // Update container height
        this.editor.updateShape({
          id: container.id,
          type: 'container',
          props: {
            ...container.props,
            height: totalHeight,
          }
        })
      }
    }

    return newShape
  }

  override onResizeEnd(shape: ICustomShape) {
    // Find the container this section is bound to
    const binding = this.editor.getBindingsToShape(shape, 'layout')[0]
    if (binding) {
      // First update the binding to trigger container layout update
      this.editor.updateBinding(binding)
      
      // Get the container shape
      const container = this.editor.getShape(binding.fromId)
      if (container) {
        // Update the container's transform directly
        this.editor.updateShape({
          id: container.id,
          type: 'container',
          x: container.x,
          y: container.y,
        })
      }
    }
  }

  override canDropShapes(shape: ICustomShape, shapes: TLShape[]) {
    // Don't allow sections or containers to be dropped into sections
    return !shapes.some(shape => shape.type === 'section' || shape.type === 'container')
  }

  override onDragShapesOver(shape: ICustomShape, shapes: TLShape[]) {
    // Skip if any shape is a section or container
    if (shapes.some(shape => shape.type === 'section' || shape.type === 'container')) return

    // When shapes are dragged over, reparent them to this section
    // and maintain their absolute positions
    shapes.forEach(draggedShape => {
      if (draggedShape.parentId !== shape.id) {
        const currentPagePoint = this.editor.getShapePageTransform(draggedShape)!.point()
        
        this.editor.reparentShapes([draggedShape.id], shape.id)
        
        // Update position relative to new parent
        const newParentTransform = this.editor.getShapePageTransform(shape)!
        const newLocalPoint = newParentTransform.invert().applyToPoint(currentPagePoint)
        
        this.editor.updateShape({
          id: draggedShape.id,
          type: draggedShape.type,
          x: newLocalPoint.x,
          y: newLocalPoint.y
        })
      }
    })
  }

  override onDragShapesOut(_shape: ICustomShape, shapes: TLShape[]) {
    // When shapes are dragged out, reparent them back to the page
    this.editor.reparentShapes(shapes, this.editor.getCurrentPageId())
  }

  component(shape: ICustomShape) {
    const { w, h, bg, textStyle } = shape.props
    const isGhostPlaceholder = shape.meta?.isGhostPlaceholder
    const isDragging = shape.meta?.isDragging
    
    if (isGhostPlaceholder) {
      return (
        <HTMLContainer style={{ pointerEvents: 'none' }}>
          <GhostSection width={w} height={h} />
        </HTMLContainer>
      )
    }

    const textStyles = {
      heading: { fontSize: '24px', fontWeight: 'bold' },
      subheading: { fontSize: '18px', fontWeight: 'semibold' },
      body: { fontSize: '14px', fontWeight: 'normal' },
    }

    return (
      <HTMLContainer 
        style={{ 
          width: 1200,
          height: h,
          backgroundColor: bg, // Use the bg prop directly
          boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.5)' : 'none',
          scale: isDragging ? 0.95 : 1,
          position: 'relative',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ 
          position: 'absolute', 
          top: '8px', 
          left: '8px',
          ...textStyles[textStyle],
        }}>
          {shape.props.text}
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape: ICustomShape) {
    return <rect width={shape.props.w} height={shape.props.h} />
  }

  canBind({ fromShapeType, toShapeType, bindingType }) {
    return fromShapeType === 'page' && toShapeType === 'section' && bindingType === 'layout'
  }

  private getTargetContainer(shape: ICustomShape, pageAnchor: Vec) {
    return this.editor.getShapeAtPoint(pageAnchor, {
      hitInside: true,
      filter: (otherShape) =>
        this.editor.canBindShapes({ fromShape: otherShape, toShape: shape, binding: 'layout' }),
    })
  }

  getBindingIndexForPosition(shape: ICustomShape, container: any, pagePoint: Vec) {
    const allBindings = this.editor
      .getBindingsFromShape(container, 'layout')
      .sort((a, b) => (a.props.index > b.props.index ? 1 : -1))

    const siblings = allBindings.filter((b) => b.toId !== shape.id)
    
    // Find insertion point based on mouse position
    let belowSib = null
    let aboveSib = null

    for (let i = 0; i < siblings.length; i++) {
      const boundShape = this.editor.getShape(siblings[i].toId)
      if (!boundShape) continue

      const sectionMidY = boundShape.y + boundShape.props.h / 2
      if (pagePoint.y < sectionMidY) {
        aboveSib = siblings[i]
        belowSib = siblings[i - 1]
        break
      }
      belowSib = siblings[i]
    }

    let index: IndexKey

    if (belowSib?.toId === shape.id) {
      index = belowSib.props.index
    } else if (aboveSib?.toId === shape.id) {
      index = aboveSib.props.index
    } else {
      index = getIndexBetween(belowSib?.props.index, aboveSib?.props.index)
    }

    return index
  }

  override onTranslateStart(shape: ICustomShape) {
    this.editor.batch(() => {
      // Set isDragging meta
      this.editor.updateShape({
        id: shape.id,
        type: 'section',
        meta: {
          ...shape.meta,
          isDragging: true
        }
      })

      // Mark the binding as placeholder when starting to drag
      const bindings = this.editor.getBindingsToShape(shape, 'layout')
      this.editor.updateBindings(
        bindings.map((binding) => ({
          ...binding,
          props: { ...binding.props, placeholder: true },
        }))
      )
    })
  }

  override onTranslate(shape: ICustomShape, initialShape: ICustomShape) {
    this.editor.batch(() => {
      const pageAnchor = this.editor.getShapePageTransform(shape)!.applyToPoint({ 
        x: shape.props.w/2, 
        y: shape.props.h/2 
      })
      const targetContainer = this.getTargetContainer(shape, pageAnchor)

      // Remove any existing ghost sections
      const ghostShapes = Array.from(this.editor.getCurrentPageShapes())
        .filter(s => s.meta?.isGhostPlaceholder)
      
      ghostShapes.forEach(s => {
        this.editor.deleteShape(s.id)
      })

      // If we have a valid target container, create a ghost section
      if (targetContainer) {
        const mousePosition = this.editor.inputs.currentPagePoint
        const containerPoint = this.editor.getPointInParentSpace(targetContainer, mousePosition)
        const bindings = this.editor.getBindingsFromShape(targetContainer, 'layout')
          .sort((a, b) => (a.props.index > b.props.index ? 1 : -1))

        // Find the closest section based on mouse position
        let insertIndex = 0
        let insertY = targetContainer.y

        // Calculate insertion point based on existing sections
        for (let i = 0; i < bindings.length; i++) {
          const boundShape = this.editor.getShape(bindings[i].toId)
          if (!boundShape || boundShape.id === shape.id) continue

          const sectionMidY = boundShape.y + boundShape.props.h / 2
          if (mousePosition.y < sectionMidY) {
            break
          }
          insertIndex = i + 1
          insertY = boundShape.y + boundShape.props.h
        }

        // Create ghost section at fixed position
        this.editor.createShape({
          id: createShapeId(),
          type: 'section',
          x: targetContainer.x,
          y: insertY,
          props: {
            ...shape.props,
            text: '',
            w: targetContainer.props.width || shape.props.w, // Use container width
          },
          meta: {
            isGhostPlaceholder: true
          },
          parentId: targetContainer.id // Set parent to container
        })

        // Update binding index based on mouse position
        const index = this.getBindingIndexForPosition(shape, targetContainer, mousePosition)
        const existingBinding = this.editor.getBindingsFromShape(targetContainer, 'layout')
          .find((b) => b.toId === shape.id)

        if (existingBinding) {
          if (existingBinding.props.index === index) return
          this.editor.updateBinding({
            ...existingBinding,
            props: {
              ...existingBinding.props,
              placeholder: true,
              index,
            },
          })
        } else {
          this.editor.createBinding({
            id: createBindingId(),
            type: 'layout',
            fromId: targetContainer.id,
            toId: shape.id,
            props: {
              index,
              placeholder: true,
            },
          })
        }
      }

      // Continue with existing binding logic
      if (!targetContainer) {
        const originalBinding = this.editor.getBindingsToShape(shape, 'layout')[0]
        if (originalBinding) {
          const container = this.editor.getShape(originalBinding.fromId)
          if (container) {
            this.editor.updateShape({
              ...shape,
              x: container.x,
              y: container.y,
            })
          }
        }
        return
      }

      const index = this.getBindingIndexForPosition(shape, targetContainer, pageAnchor)
      const existingBinding = this.editor.getBindingsFromShape(targetContainer, 'layout')
        .find((b) => b.toId === shape.id)

      if (existingBinding) {
        if (existingBinding.props.index === index) return
        this.editor.updateBinding({
          ...existingBinding,
          props: {
            ...existingBinding.props,
            placeholder: true,
            index,
          },
        })
      } else {
        this.editor.createBinding({
          id: createBindingId(),
          type: 'layout',
          fromId: targetContainer.id,
          toId: shape.id,
          props: {
            index,
            placeholder: true,
          },
        })
      }
    })
  }

  override onTranslateEnd(shape: ICustomShape, initialShape: ICustomShape) {
    this.editor.batch(() => {
      // Reset isDragging meta
      this.editor.updateShape({
        id: shape.id,
        type: 'section',
        meta: {
          ...shape.meta,
          isDragging: false
        }
      })

      // Remove any ghost sections
      const ghostShapes = Array.from(this.editor.getCurrentPageShapes())
        .filter(s => s.meta?.isGhostPlaceholder)
      
      ghostShapes.forEach(s => {
        this.editor.deleteShape(s.id)
      })

      // Continue with existing translate end logic
      const pageAnchor = this.editor.getShapePageTransform(shape)!.applyToPoint({ 
        x: shape.props.w/2, 
        y: shape.props.h/2 
      })
      const targetContainer = this.getTargetContainer(shape, pageAnchor)

      if (!targetContainer) {
        // Final position correction
        const originalBinding = this.editor.getBindingsToShape(shape, 'layout')[0]
        if (originalBinding) {
          const container = this.editor.getShape(originalBinding.fromId)
          if (container) {
            this.editor.batch(() => {
              this.editor.updateShape({
                ...shape,
                x: container.x,
                y: container.y,
              })
              // Force layout refresh
              this.editor.updateBinding(originalBinding)
            })
          }
        }
        return
      }

      // Wrap final binding update in a transaction
      const index = this.getBindingIndexForPosition(shape, targetContainer, pageAnchor)
      this.editor.deleteBindings(this.editor.getBindingsToShape(shape, 'layout'))

      this.editor.createBinding({
        id: createBindingId(),
        type: 'layout',
        fromId: targetContainer.id,
        toId: shape.id,
        props: {
          index,
          placeholder: false,
        },
      })

      // Force container layout refresh
      this.editor.updateShape({
        id: targetContainer.id,
        type: targetContainer.type,
        x: targetContainer.x,
        y: targetContainer.y,
      })
    })
  }

  override isEditing(shape: ICustomShape) {
    return this.editor.getEditingShape() === shape.id
  }

  override onDoubleClick = (shape: ICustomShape) => {
    this.editor.setEditingShape(shape.id)
  }

  getCloneInfo(shape: ICustomShape) {
    const binding = this.editor.getBindingsToShape(shape, 'layout')[0]
    if (!binding) return

    const container = this.editor.getShape(binding.fromId)
    if (!container) return

    // Get existing bindings sorted by index
    const bindings = this.editor.getBindingsFromShape(container, 'layout')
      .sort((a, b) => (a.props.index > b.props.index ? 1 : -1))

    // Find the original shape's binding
    const originalBinding = bindings.find(b => b.toId === shape.id)
    if (!originalBinding) return

    // Calculate new index for duplicated shape (right after original)
    const originalIndex = originalBinding.props.index
    const nextBinding = bindings.find(b => b.props.index > originalIndex)
    const newIndex = getIndexBetween(originalIndex, nextBinding?.props.index)

    return {
      id: createShapeId(),
      parentId: container.id,
      meta: {
        bindingProps: {
          index: newIndex,
          placeholder: false,
        }
      }
    }
  }

  canReceiveNewChildrenOfType(shape: ICustomShape, type: string) {
    return type !== 'section' && type !== 'page'
  }

  providesBackgroundForChildren() {
    return true
  }

  override getStyleProps() {
    return {
      fill: DefaultColorStyle, // Use 'fill' instead of 'color'
    }
  }

  override onStyleChange = (shape: ICustomShape, style: string, value: string) => {
    if (style === 'fill') {
      return {
        ...shape,
        props: {
          ...shape.props,
          bg: value,
        },
      }
    }
    return shape
  }
}

// Create the Section tool extending BaseBoxShapeTool
export class SectionTool extends BaseBoxShapeTool {
  static id = 'section'
  static initial = 'idle'
  shapeType = 'section'

  override onCreate = (shape: ICustomShape): void | TLBaseShape<any, any> => {
    // Check if we're creating over a page
    const pageShape = this.editor.getShapeAtPoint(this.editor.inputs.currentPagePoint, {
      hitInside: true,
      filter: (shape) => shape.type === 'page',
    })

    if (!pageShape) return

    // Create the shape with the page as parent
    return {
      ...shape,
      parentId: pageShape.id,
      props: {
        ...shape.props,
        text: 'New Section'
      }
    }
  }
} 