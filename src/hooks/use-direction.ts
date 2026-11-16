import { I18nManager } from 'react-native';

export function useDirection() {
  const isRTL = I18nManager.isRTL;
  return {
    isRTL,
    writingDirection: (isRTL ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
    textAlign: (isRTL ? 'right' : 'left') as 'right' | 'left',
  };
}
