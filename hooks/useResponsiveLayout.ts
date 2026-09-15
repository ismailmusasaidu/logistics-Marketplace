import { useWindowDimensions } from 'react-native';

const MAX_CONTENT_WIDTH = 1100;

export function useResponsiveLayout() {
  const { width } = useWindowDimensions();

  const columns =
    width >= 1200 ? 5 : width >= 900 ? 4 : width >= 600 ? 3 : 2;

  return {
    width,
    columns,
    isDesktop: width >= 900,
    maxContentWidth: Math.min(width, MAX_CONTENT_WIDTH),
  };
}
