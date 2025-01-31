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
  TextLabel
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

// Create the Section shape util
export class SectionShapeUtil extends ShapeUtil<ICustomShape> {
  static type = 'section' as const
  
  static override props: RecordProps<ICustomShape> = {
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
      bg: 'rgba(255,255,255,0.5)',
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

  override onResize(shape: ICustomShape, info: TLResizeInfo) {
    // Only allow vertical resizing
    const newHeight = Math.max(50, shape.props.h * info.scaleY)
    const newShape = {
      ...shape,
      props: {
        ...shape.props,
        h: newHeight,
        w: shape.props.w, // Keep original width
      },
    }

    // Immediately update container height
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
    if (!shapes.every((child) => child.parentId === shape.id)) {
      this.editor.reparentShapes(shapes, shape.id)
    }
  }

  override onDragShapesOut(_shape: ICustomShape, shapes: TLShape[]) {
    // When shapes are dragged out, reparent them back to the page
    this.editor.reparentShapes(shapes, this.editor.getCurrentPageId())
  }

  component(shape: ICustomShape) {
    const { w, h, text, bg, textStyle } = shape.props
    const isEditing = this.isEditing(shape)
    
    const textStyles = {
      heading: { fontSize: '24px', fontWeight: 'bold' },
      subheading: { fontSize: '18px', fontWeight: 'semibold' },
      body: { fontSize: '14px', fontWeight: 'normal' },
    }

    return (
      <HTMLContainer 
        style={{ 
          width: w,
          height: h,
          backgroundColor: bg,
          border: '2px dashed #666',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#333',
          position: 'relative'
        }}
      >
        <div style={{ 
          position: 'absolute', 
          top: '8px', 
          left: '8px',
          ...textStyles[textStyle],
        }}>
          {isEditing ? (
            <TextLabel
              id={shape.id}
              type="text"
              text={text}
              size={textStyles[textStyle].fontSize}
              font="draw"
              isEditing={isEditing}
              onChange={(text) => {
                this.editor.updateShape({
                  id: shape.id,
                  type: 'section',
                  props: {
                    ...shape.props,
                    text,
                  },
                })
              }}
              onBlur={() => {
                this.editor.setEditingShape(null)
              }}
            />
          ) : (
            <div 
              onDoubleClick={() => {
                this.editor.setEditingShape(shape.id)
              }}
              style={{ pointerEvents: 'all', cursor: 'text' }}
            >
              {text}
            </div>
          )}
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

  getBindingIndexForPosition(shape: ICustomShape, container: any, pageAnchor: Vec) {
    const allBindings = this.editor
      .getBindingsFromShape(container, 'layout')
      .sort((a, b) => (a.props.index > b.props.index ? 1 : -1))

    const siblings = allBindings.filter((b) => b.toId !== shape.id)
    // Calculate order based on vertical position instead of horizontal
    const order = Math.round((pageAnchor.y - container.y) / shape.props.h)

    const belowSib = allBindings[order - 1]
    const aboveSib = allBindings[order]
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

      // Immediately clamp position to container bounds
      if (!targetContainer) {
        const originalBinding = this.editor.getBindingsToShape(shape, 'layout')[0]
        if (originalBinding) {
          const container = this.editor.getShape(originalBinding.fromId)
          if (container) {
            // Force position update during drag
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




  override onAfterHistoryChange = () => {
    // Refresh all container layouts when history changes
    this.editor.batch(() => {
      // First update all bindings to trigger layout recalculation
      const containers = this.editor.getShapesByType('page')
      containers.forEach(container => {
        const bindings = this.editor.getBindingsFromShape(container, 'layout')
        bindings.forEach(binding => {
          this.editor.updateBinding(binding)
        })
        
        // Then update container to refresh layout
        this.editor.updateShape({
          id: container.id,
          type: 'page',
          x: container.x,
          y: container.y,
        })
      })
    })
  }

  override isEditing(shape: ICustomShape) {
    return this.editor.getEditingShape() === shape.id
  }

  override onDoubleClick = (shape: ICustomShape) => {
    this.editor.setEditingShape(shape.id)
  }

  // Add this override for duplication
  override onDuplicate = (shape: ICustomShape, offset: Vec) => {
    const binding = this.editor.getBindingsToShape(shape, 'layout')[0]
    if (!binding) return

    const container = this.editor.getShape(binding.fromId)
    if (!container) return

    // Get all existing bindings to find the last index
    const bindings = this.editor.getBindingsFromShape(container, 'layout')
      .sort((a, b) => (a.props.index > b.props.index ? 1 : -1))

    // Get the last binding
    const lastBinding = bindings[bindings.length - 1]
    const lastIndex = lastBinding?.props?.index

    // Create new index after the last one
    const newIndex = getIndexBetween(lastIndex, null)

    // Create the duplicated shape at the container's position
    const duplicatedShape = {
      ...shape,
      id: createShapeId(),
      x: container.x, // Position at container's x
      y: container.y, // Position at container's y - will be adjusted by layout
      props: {
        ...shape.props,
        text: `${shape.props.text} (copy)` // Add (copy) to the text
      }
    }

    // Create binding for the duplicated shape
    this.editor.batch(() => {
      // Create the duplicated shape first
      const newShape = this.editor.createShape(duplicatedShape)

      // Create binding to the same container
      this.editor.createBinding({
        id: createBindingId(),
        type: 'layout',
        fromId: container.id,
        toId: newShape.id,
        props: {
          index: newIndex,
          placeholder: false,
        },
      })

      // Reparent the duplicated shape to the same container
      this.editor.reparentShapes([newShape.id], container.id)

      // Force container layout refresh
      this.editor.updateShape({
        id: container.id,
        type: container.type,
        x: container.x,
        y: container.y,
      })
    })

    return duplicatedShape
  }
}

// Create the Section tool
export class SectionTool extends StateNode {
  static id = 'section'

  onEnter = () => {
    this.editor.setCursor({ type: 'cross', rotation: 0 })
  }

  onPointerDown = () => {
    const { currentPagePoint } = this.editor.inputs
    
    // First check if we're creating over a page
    const container = this.editor.getShapeAtPoint(currentPagePoint, {
      hitInside: true,
      filter: (shape) => shape.type === 'page',
    })

    if (!container) return

    const id = createShapeId()
    
    this.editor.batch(() => {
      this.editor.createShape({
        id,
        type: 'section',
        x: currentPagePoint.x - 100,
        y: currentPagePoint.y - 50,
        props: {
          text: '123'
        },
      })

      if (container) {
        // Get existing bindings sorted by index
        const bindings = this.editor.getBindingsFromShape(container, 'layout')
          .sort((a, b) => (a.props.index > b.props.index ? 1 : -1))

        // Calculate position relative to container
        const pageAnchor = currentPagePoint
        const containerTransform = this.editor.getShapePageTransform(container)!
        const localAnchor = containerTransform.clone().invert().applyToPoint(pageAnchor)
        
        // Find insertion index based on vertical position
        let accumulatedHeight = 0
        let insertIndex = 0
        let belowIndex: string | undefined
        let aboveIndex: string | undefined

        for (const binding of bindings) {
          const section = this.editor.getShape(binding.toId)
          if (!section) continue
          
          // Check if we should insert before this section
          if (localAnchor.y < accumulatedHeight + section.props.h/2) {
            aboveIndex = binding.props.index
            break
          }
          
          belowIndex = binding.props.index
          accumulatedHeight += section.props.h
          insertIndex++
        }

        // Determine the new index
        const newIndex = getIndexBetween(belowIndex, aboveIndex)

        // Create binding at calculated position
        this.editor.createBinding({
          id: createBindingId(),
          type: 'layout',
          fromId: container.id,
          toId: id,
          props: {
            index: newIndex,
            placeholder: false,
          },
        })

        // Reparent the section to the container
        this.editor.reparentShapes([id], container.id)
      }
    })
  }
} 