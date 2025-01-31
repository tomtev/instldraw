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
    return (
      <HTMLContainer
        style={{
          width: shape.props.width,
          height: shape.props.height,
          backgroundColor: '#ffffff',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      />
    )
  }

  indicator(shape: PageShape) {
    return <rect width={shape.props.width} height={shape.props.height} />
  }
}

export class PageTool extends BaseBoxShapeTool {
  static id = 'page'
  static initial = 'idle'
  shapeType = 'page'
  
  private initialShapeId?: string

  onDragStart = () => {
    const { originPagePoint } = this.editor.inputs
    const id = createShapeId()
    this.initialShapeId = id
    
    this.editor.createShape({
      id,
      type: 'page',
      x: originPagePoint.x,
      y: originPagePoint.y,
      props: {
        width: 1200,
        height: 600,
      },
    })
  }

  onDragMove = () => {
    if (!this.initialShapeId) return
    
    const { originPagePoint, currentPagePoint } = this.editor.inputs
    const minWidth = 800
    const minHeight = 600
    
    this.editor.updateShape({
      id: this.initialShapeId,
      type: 'page',
      x: Math.min(originPagePoint.x, currentPagePoint.x),
      y: Math.min(originPagePoint.y, currentPagePoint.y),
      props: {
        width: Math.max(minWidth, Math.abs(currentPagePoint.x - originPagePoint.x)),
        height: Math.max(minHeight, Math.abs(currentPagePoint.y - originPagePoint.y)),
      },
    })
  }

  onDragEnd = () => {
    this.initialShapeId = undefined
  }
} 