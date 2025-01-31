import React, { useState } from 'react';
import { monitorForElements } from '@atlassian/pragmatic-drag-and-drop/element/adapter';
import { Section, DeviceType, BuilderState } from '../../types/builder';
import { BuilderToolbar } from './BuilderToolbar';
import { DeviceFrame } from './DeviceFrame';
import { defaultSections } from './defaultData';
import styled from 'styled-components';

const BuilderContainer = styled.div`
  display: flex;
  gap: 24px;
  padding: 24px;
  background: #f5f5f5;
  height: 100vh;
`;

const FramesContainer = styled.div`
  display: flex;
  gap: 24px;
  flex: 1;
  overflow: auto;
`;

export function BuilderEditor() {
  const [state, setState] = useState<BuilderState>({
    sections: defaultSections,
    activeDevice: 'desktop',
    draggedBlock: null,
  });

  const updateSection = (sectionId: string, updates: Partial<Section>) => {
    setState(prev => ({
      ...prev,
      sections: prev.sections.map(section => 
        section.id === sectionId ? { ...section, ...updates } : section
      ),
    }));
  };

  const resetMobileStyles = (sectionId: string, blockId: string) => {
    setState(prev => ({
      ...prev,
      sections: prev.sections.map(section => {
        if (section.id === sectionId) {
          return {
            ...section,
            blocks: section.blocks.map(block => {
              if (block.id === blockId) {
                return {
                  ...block,
                  styles: {
                    ...block.styles,
                    mobile: { ...block.styles.desktop },
                  },
                  mobileOverride: false,
                };
              }
              return block;
            }),
          };
        }
        return section;
      }),
    }));
  };

  return (
    <BuilderContainer>
      <BuilderToolbar />
      <FramesContainer>
        <DeviceFrame
          device="desktop"
          sections={state.sections}
          isActive={state.activeDevice === 'desktop'}
          onUpdateSection={updateSection}
          onResetMobileStyles={resetMobileStyles}
        />
        <DeviceFrame
          device="mobile"
          sections={state.sections}
          isActive={state.activeDevice === 'mobile'}
          onUpdateSection={updateSection}
          onResetMobileStyles={resetMobileStyles}
        />
      </FramesContainer>
    </BuilderContainer>
  );
} 