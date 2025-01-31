import {
  TLBaseShape,
  ShapeUtil,
  HTMLContainer,
  T,
  Rectangle2d,
  Vec,
  createShapeId,
  TLTool,
  StateNode,
} from 'tldraw'

type PageShape = TLBaseShape<
  'page',
  {
    width: number
    height: number
  }
>

export class PageShapeUtil extends ShapeUtil<PageShape> {
  static type = 'page' as const
  static override props = {
    width: T.number,
    height: T.number,
  }

  getDefaultProps(): PageShape['props'] {
    return {
      width: 1200,
      height: 600,
    }
  }

  canBind({ 
    fromShapeType,
    toShapeType, 
    bindingType 
  }: { 
    fromShapeType: string, 
    toShapeType: string, 
    bindingType: string 
  }) {
    return fromShapeType === 'page' && toShapeType === 'section' && bindingType === 'layout'
  }

  canMove() {
    return false
  }

  canEdit() {
    return false
  }

  canResize() {
    return false
  }

  hideRotateHandle() {
    return true
  }

  isAspectRatioLocked() {
    return true
  }

  getGeometry(shape: PageShape) {
    return new Rectangle2d({
      width: shape.props.width,
      height: shape.props.height,
      isFilled: true,
    })
  }

  component(shape: PageShape) {
    const isDraggingOver = shape.meta?.isDraggingOver

    return (
      <HTMLContainer
        style={{
          width: shape.props.width,
          height: shape.props.height,
          backgroundColor: '#ffffff',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          transition: 'background-color 0.2s ease',
          backgroundColor: isDraggingOver ? '#f0f9ff' : '#ffffff',
        }}
      />
    )
  }

  indicator(shape: PageShape) {
    return <rect width={shape.props.width} height={shape.props.height} />
  }

  onTranslate = (shape: PageShape) => {
    return {
      ...shape,
      x: 0,
      y: 0,
    }
  }
}

export class PageTool extends StateNode implements TLTool {
  static id = 'page'
  static initial = 'idle'
  shapeType = 'page'

  onEnter = () => {
    this.editor.setCursor({ type: 'cross' })
  }

  onExit = () => {
    this.editor.setCursor({ type: 'default' })
  }

  onPointerDown = () => {
    const id = createShapeId()
    
    this.editor.createShape({
      id,
      type: 'page',
      x: 0,
      y: 0,
      props: {
        width: 1200,
        height: 600,
      },
    })

    this.editor.complete()
    
  }
} 