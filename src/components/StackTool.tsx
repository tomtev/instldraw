import {
  BaseBoxShapeTool,
  TLBaseShape,
  ShapeUtil,
  HTMLContainer,
  T,
  Rectangle2d,
  TLResizeInfo,
  Vec,
  createShapeId,
  StateNode,
  TLShape,
  getIndexBetween,
  createBindingId,
  IndexKey
} from 'tldraw'

type StackShape = TLBaseShape<
  'stack',
  {
    width: number
    height: number
    gap: number
  }
>

export class StackShapeUtil extends ShapeUtil<StackShape> {
  static type = 'stack' as const
  static props = {
    width: T.number,
    height: T.number,
    gap: T.number,
  }

  getDefaultProps(): StackShape['props'] {
    return {
      width: 300,
      height: 400,
      gap: 8,
    }
  }

  canBind({ fromShapeType, toShapeType, bindingType }) {
    return (
      !['section', 'page', 'stack'].includes(fromShapeType) &&
      toShapeType === 'stack' && 
      bindingType === 'layout'
    )
  }

  getGeometry(shape: StackShape) {
    return new Rectangle2d({
      width: shape.props.width,
      height: shape.props.height,
      isFilled: true,
    })
  }

  private updateChildPositions(shape: StackShape) {
    const children = this.editor.getSortedChildIdsForParent(shape.id)
    let yPos = 0
    children.forEach(childId => {
      const child = this.editor.getShape(childId)
      if (child) {
        this.editor.updateShape({
          ...child,
          x: shape.props.gap,
          y: yPos,
          props: {
            ...child.props,
            w: shape.props.width - shape.props.gap * 2
          }
        })
        yPos += child.props.h + shape.props.gap
      }
    })
  }

  override onDragShapesOver(shape: StackShape, shapes: TLShape[]) {
    const disallowedTypes = ['section', 'page', 'stack']
    const validShapes = shapes.filter(s => !disallowedTypes.includes(s.type))
    
    this.editor.reparentShapes(validShapes, shape.id)
    this.updateChildPositions(shape)
  }

  override onResize(shape: StackShape, info: TLResizeInfo) {
    const newWidth = shape.props.width * info.scaleX
    const newGap = Math.max(2, shape.props.gap * info.scaleY)
    
    return {
      ...shape,
      props: {
        width: newWidth,
        height: shape.props.height * info.scaleY,
        gap: newGap,
      }
    }
  }

  override onResizeEnd(shape: StackShape) {
    this.updateChildPositions(shape)
  }

  override onChildrenChange(shape: StackShape) {
    this.updateChildPositions(shape)
  }

  component(shape: StackShape) {
    return (
      <HTMLContainer
        style={{
          width: shape.props.width,
          height: shape.props.height,
          backgroundColor: 'rgba(240, 240, 240, 0.8)',
          border: '1px solid #ddd',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: shape.props.gap,
          padding: shape.props.gap,
        }}
      />
    )
  }

  indicator(shape: StackShape) {
    return <rect width={shape.props.width} height={shape.props.height} />
  }

  override onDragShapesOut(_shape: StackShape, shapes: TLShape[]) {
    // When shapes are dragged out, reparent them back to the page
    this.editor.reparentShapes(shapes, this.editor.getCurrentPageId())
  }

  // Add binding management similar to SectionTool
  private getContainerBindings(shape: StackShape) {
    return this.editor.getBindingsToShape(shape, 'layout')
  }

  override onTranslateStart(shape: StackShape) {
    const bindings = this.getContainerBindings(shape)
    this.editor.updateBindings(
      bindings.map(binding => ({
        ...binding,
        props: { ...binding.props, placeholder: true }
      }))
    )
  }

  override onTranslate(shape: StackShape) {
    const pagePoint = this.editor.getShapePageTransform(shape)!.applyToPoint({
      x: shape.props.width / 2,
      y: shape.props.height / 2
    })

    const container = this.editor.getShapeAtPoint(pagePoint, {
      hitInside: true,
      filter: s => s.type === 'page'
    })

    if (container) {
      const bindings = this.editor.getBindingsFromShape(container, 'layout')
      const localY = this.editor.getPointInShapeSpace(container, pagePoint).y
      
      let accumulatedHeight = 0
      let index = 0
      for (const binding of bindings) {
        const sibling = this.editor.getShape(binding.toId)
        if (!sibling) continue
        
        if (localY > accumulatedHeight + sibling.props.h / 2) {
          accumulatedHeight += sibling.props.h + sibling.parent?.props.gap ?? 0
          index++
        } else {
          break
        }
      }

      const existingBinding = bindings.find(b => b.toId === shape.id)
      if (existingBinding) {
        this.editor.updateBinding({
          ...existingBinding,
          props: { index, placeholder: true }
        })
      } else {
        this.editor.createBinding({
          id: createBindingId(),
          type: 'layout',
          fromId: container.id,
          toId: shape.id,
          props: { index, placeholder: true }
        })
      }
    }
  }

  override onTranslateEnd(shape: StackShape) {
    const bindings = this.getContainerBindings(shape)
    this.editor.updateBindings(
      bindings.map(binding => ({
        ...binding,
        props: { ...binding.props, placeholder: false }
      }))
    )
  }

  override canDropShapes(shape: StackShape, shapes: TLShape[]) {
    // Don't allow sections or pages to be dropped into stacks
    return !shapes.some(shape => ['section', 'page', 'stack'].includes(shape.type))
  }
}

export class StackTool extends BaseBoxShapeTool {
  static id = 'stack'
  static initial = 'idle'
  shapeType = 'stack'
  private initialPoint?: Vec

  override onDragStart = () => {
    const { originPagePoint } = this.editor.inputs
    this.initialPoint = originPagePoint
    this.editor.createShape({
      id: createShapeId(),
      type: 'stack',
      x: originPagePoint.x,
      y: originPagePoint.y,
      props: {
        width: 300,
        height: 400,
        gap: 8,
      },
    })
  }

  override onDragMove = () => {
    const { currentPagePoint } = this.editor.inputs
    if (!this.initialPoint) return

    this.editor.updateShape({
      id: this.initialShape.id,
      type: 'stack',
      x: Math.min(this.initialPoint.x, currentPagePoint.x),
      y: Math.min(this.initialPoint.y, currentPagePoint.y),
      props: {
        width: Math.abs(currentPagePoint.x - this.initialPoint.x),
        height: Math.abs(currentPagePoint.y - this.initialPoint.y),
        gap: 8,
      },
    })
  }

  override onDragEnd = () => {
    this.initialPoint = undefined
  }
} 