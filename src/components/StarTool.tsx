import { StateNode, createShapeId, TLShape } from "tldraw"

// Create the Star tool
export class StarTool extends StateNode {
  static id = 'star'

  onEnter = () => {
    this.editor.setCursor({ type: 'cross', rotation: 0 })
  }

  onPointerDown = () => {
    const { currentPagePoint } = this.editor.inputs
    const id = createShapeId()

    // Create the star shape
    this.editor.createShape({
      id,
      type: 'geo',
      x: currentPagePoint.x - 50,
      y: currentPagePoint.y - 50,
      props: {
        w: 100,
        h: 100,
        geo: 'star',
      },
    })

    // Check if we're creating the star over a section
    const sectionAtPoint = this.editor.getShapeAtPoint(currentPagePoint, {
      hitInside: true,
      filter: (shape) => shape.type === 'section',
    })

    // If we are, parent the star to that section
    if (sectionAtPoint) {
      this.editor.reparentShapes([id], sectionAtPoint.id)
    }
  }
} 