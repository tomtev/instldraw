import { Section } from '../../types/builder';

export const defaultSections: Section[] = [
  {
    id: 'hero',
    blocks: [
      {
        id: 'heading-1',
        type: 'heading',
        content: 'Welcome to Builder',
        styles: {
          desktop: {
            width: '100%',
            height: 'auto',
            gridColumn: '1 / -1',
            fontSize: '48px',
            textAlign: 'center',
            padding: '40px 20px',
          },
          mobile: {
            width: '100%',
            height: 'auto',
            gridColumn: '1 / -1',
            fontSize: '32px',
            textAlign: 'center',
            padding: '24px 16px',
          },
        },
        mobileOverride: false,
      },
      // Add more default blocks...
    ],
    styles: {
      desktop: {
        columns: 12,
        gap: 20,
        padding: '40px 20px',
      },
      mobile: {
        columns: 4,
        gap: 16,
        padding: '24px 16px',
      },
    },
  },
  // Add more default sections...
]; 