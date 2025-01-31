import {
  BaseBoxShape,
  Geometry2d,
  HTMLContainer,
  RecordProps,
  Rectangle2d,
  ShapeUtil,
  T,
  StateNode,
  createShapeId,
} from "tldraw"

// Define the shape type
type BuilderShape = BaseBoxShape<
  'builder',
  {
    text: string
    isComplete: boolean
  }
>

// Create the Builder shape util
export class BuilderShapeUtil extends ShapeUtil<BuilderShape> {
  static type = 'builder' as const
  
  static props: RecordProps<BuilderShape> = {
    text: T.string,
    isComplete: T.boolean,
  }

  getDefaultProps(): BuilderShape['props'] {
    return {
      text: 'New todo',
      isComplete: false,
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

  getGeometry(shape: BuilderShape): Geometry2d {
    return new Rectangle2d({
      width: shape.w,
      height: shape.h,
      isFilled: true,
    })
  }

  component(shape: BuilderShape) {
    const { text, isComplete } = shape.props
    const isEditing = this.isEditing(shape)
    
    return (
      <HTMLContainer 
        style={{ 
          width: shape.w,
          height: shape.h,
          backgroundColor: 'white',
          border: '1px solid black',
          display: 'flex',
          alignItems: 'center',
          padding: '8px',
          gap: '8px',
        }}
      >
        <input
          type="checkbox"
          checked={isComplete}
          onChange={(e) => {
            e.stopPropagation()
            this.editor.updateShape({
              id: shape.id,
              type: 'builder',
              props: {
                ...shape.props,
                isComplete: !isComplete,
              },
            })
          }}
          style={{
            pointerEvents: 'all',
          }}
        />
        
        {isEditing ? (
          <input
            style={{
              outline: 'none',
              width: '100%',
              border: 'none',
              padding: '4px',
              textDecoration: isComplete ? 'line-through' : 'none',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                this.editor.setEditingShape(null)
              }
            }}
            defaultValue={text}
            onBlur={(e) => {
              this.editor.updateShape({
                id: shape.id,
                type: 'builder',
                props: {
                  ...shape.props,
                  text: e.currentTarget.value || 'New todo',
                },
              })
              this.editor.setEditingShape(null)
            }}
            autoFocus
          />
        ) : (
          <div 
            style={{ 
              width: '100%',
              textDecoration: isComplete ? 'line-through' : 'none',
            }}
            onDoubleClick={() => {
              this.editor.setEditingShape(shape.id)
            }}
          >
            {text}
          </div>
        )}
      </HTMLContainer>
    )
  }

  indicator(shape: BuilderShape) {
    return <rect width={shape.w} height={shape.h} />
  }

  isEditing(shape: BuilderShape) {
    return this.editor.getEditingShape()?.id === shape.id
  }
}

// Create the Builder tool
export class BuilderTool extends StateNode {
  static id = 'builder'
  static initial = 'idle'
  
  onEnter = () => {
    this.editor.setCursor({ type: 'cross', rotation: 0 })
  }

  onPointerDown = () => {
    const id = createShapeId()
    
    this.editor.createShape({
      id,
      type: 'builder',
      x: this.editor.inputs.currentPagePoint.x,
      y: this.editor.inputs.currentPagePoint.y,
      w: 200,
      h: 50,
      props: {
        text: 'New todo',
        isComplete: false,
      },
    })
  }
} 