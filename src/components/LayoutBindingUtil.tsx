import { BindingUtil, TLBaseBinding, Vec, TLShape, TLBinding } from 'tldraw'

// Define interfaces for the shapes we're working with
interface PageShape extends TLShape {
  type: 'page'
  props: {
    width: number
    height: number
  }
}

interface SectionShape extends TLShape {
  type: 'section'
  props: {
    w: number
    h: number
  }
}

type LayoutBinding = TLBaseBinding<
  'layout',
  {
    index: string
    placeholder: boolean
  }
>

export class LayoutBindingUtil extends BindingUtil<LayoutBinding> {
  static type = 'layout' as const

  getDefaultProps() {
    return {
      index: 'a1',
      placeholder: true,
    }
  }

  onAfterCreate({ binding }: { binding: LayoutBinding }) {
    this.updateElementsForContainer(binding)
  }

  onAfterChange({ bindingAfter }: { bindingAfter: LayoutBinding }) {
    this.updateElementsForContainer(bindingAfter)
  }

  onAfterChangeFromShape({ binding }: { binding: LayoutBinding }) {
    this.updateElementsForContainer(binding)
  }

  onAfterDelete({ binding }: { binding: LayoutBinding }) {
    this.updateElementsForContainer(binding)
  }

  private updateElementsForContainer({ 
    props: { placeholder }, 
    fromId: containerId, 
    toId 
  }: LayoutBinding) {
    const container = this.editor.getShape(containerId) as PageShape
    if (!container) return

    const bindings = this.editor.getBindingsFromShape(container, 'layout')
      .sort((a, b) => ((a.props as any).index > (b.props as any).index ? 1 : -1))
    
    if (bindings.length === 0) return

    let currentY = 0

    // Update positions for all sections, including placeholders
    for (let i = 0; i < bindings.length; i++) {
      const binding = bindings[i]
      const shape = this.editor.getShape(binding.toId) as SectionShape
      if (!shape) continue

      if (binding.toId === toId && placeholder) {
        currentY += shape.props.h
        continue
      }

      const offset = new Vec(0, currentY)

      const point = this.editor.getPointInParentSpace(
        shape,
        this.editor.getShapePageTransform(container)!.applyToPoint(offset)
      )

      if (shape.x !== point.x || shape.y !== point.y) {
        this.editor.updateShape({
          id: binding.toId,
          type: 'section',
          x: point.x,
          y: point.y,
          props: {
            ...shape.props,
            w: container.props.width,
          }
        })
      }

      currentY += shape.props.h
    }

    // Update container height without padding
    const totalHeight = currentY
    if (totalHeight !== container.props.height) {
      this.editor.updateShape({
        id: container.id,
        type: 'page',
        props: { 
          ...container.props,
          height: Math.max(totalHeight, 0)
        },
      })
    }
  }

  afterCreateBinding(binding: LayoutBinding): void {
    const container = this.editor.getShape(binding.fromId) as PageShape
    const section = this.editor.getShape(binding.toId) as SectionShape
    
    if (container && section) {
      // Immediately update section position to container's layout
      this.editor.updateShape({
        ...section,
        x: container.x,
        y: container.y,
      })
    }
  }
} 