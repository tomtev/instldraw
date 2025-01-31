import React from 'react';
import { monitorForElements } from '@atlassian/pragmatic-drag-and-drop/element/adapter';
import { Section, DeviceType } from '../../types/builder';
import { BuilderSection } from './BuilderSection';
import styled from 'styled-components';

interface DeviceFrameProps {
  device: DeviceType;
  sections: Section[];
  isActive: boolean;
  onUpdateSection: (sectionId: string, updates: Partial<Section>) => void;
  onResetMobileStyles: (sectionId: string, blockId: string) => void;
}

const Frame = styled.div<{ device: DeviceType }>`
  width: ${props => props.device === 'desktop' ? '1200px' : '375px'};
  height: 800px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  overflow: auto;
`;

const FrameHeader = styled.div`
  padding: 12px;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export function DeviceFrame({
  device,
  sections,
  isActive,
  onUpdateSection,
  onResetMobileStyles,
}: DeviceFrameProps) {
  return (
    <Frame device={device}>
      <FrameHeader>
        <h3>{device === 'desktop' ? 'Desktop View' : 'Mobile View'}</h3>
      </FrameHeader>
      <div>
        {sections.map(section => (
          <BuilderSection
            key={section.id}
            section={section}
            device={device}
            onUpdate={(updates) => onUpdateSection(section.id, updates)}
            onResetMobileStyles={(blockId) => onResetMobileStyles(section.id, blockId)}
          />
        ))}
      </div>
    </Frame>
  );
} 