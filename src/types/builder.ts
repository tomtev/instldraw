export type DeviceType = 'desktop' | 'mobile';

export type BlockType = 'heading' | 'text' | 'button' | 'image' | 'spacer';

export interface BlockStyles {
  width: string;
  height: string;
  padding?: string;
  margin?: string;
  backgroundColor?: string;
  color?: string;
  fontSize?: string;
  borderRadius?: string;
  border?: string;
  gridColumn?: string;
  gridRow?: string;
}

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  styles: {
    desktop: BlockStyles;
    mobile: BlockStyles;
  };
  mobileOverride: boolean;
}

export interface Section {
  id: string;
  blocks: Block[];
  styles: {
    desktop: {
      columns: number;
      gap: number;
      padding: string;
    };
    mobile: {
      columns: number;
      gap: number;
      padding: string;
    };
  };
}

export interface BuilderState {
  sections: Section[];
  activeDevice: DeviceType;
  draggedBlock: Block | null;
} 