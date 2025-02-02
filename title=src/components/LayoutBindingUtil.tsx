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

    // Get all bindings and sort them by index
    const bindings = this.editor.getBindingsFromShape(container, 'layout')
      .sort((a, b) => ((a.props as any).index > (b.props as any).index ? 1 : -1))
    
    if (bindings.length === 0) return

    // Batch all updates together
    this.editor.batch(() => {
      let currentY = 0

      // Update positions for all sections
      for (const binding of bindings) {
        const shape = this.editor.getShape(binding.toId) as SectionShape
        if (!shape) continue

        // Skip placeholder bindings during dragging
        if (binding.toId === toId && placeholder) {
          currentY += shape.props.h
          continue
        }

        // If the section is actively being dragged or hovered,
        // "lock" its position by skipping any update (but add its height to currentY)
        if (shape.meta?.isDraggingOver || shape.meta?.isDragging) {
          currentY += shape.props.h
          continue
        }

        // Calculate the new position
        const newY = currentY
        currentY += shape.props.h

        // Only update if the position is actually different
        if (shape.x !== container.x || shape.y !== container.y + newY) {
          this.editor.updateShape({
            id: binding.toId,
            type: 'section',
            x: container.x,
            y: container.y + newY,
            props: {
              ...shape.props,
              w: container.props.width,
            },
            // Preserve any temporary meta (like isDraggingOver)
            meta: { ...shape.meta }
          })
        }
      }

      // Update container height if needed
      if (currentY !== container.props.height) {
        this.editor.updateShape({
          id: container.id,
          type: 'page',
          props: { 
            ...container.props,
            height: Math.max(currentY, 0)
          },
          meta: { ...container.meta }
        })
      }
    })
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

  override onAfterUpdate({ binding }: { binding: LayoutBinding }) {
    // Skip updates for placeholder bindings during dragging
    if (binding.props.placeholder) return
    
    this.updateElementsForContainer(binding)
  }
} 