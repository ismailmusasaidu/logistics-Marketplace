import { useRef, useEffect, useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  PanResponder,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ZoomableImageProps {
  uri: string;
  defaultUri?: string;
  onZoomChange?: (isZoomed: boolean) => void;
}

export default function ZoomableImage({ uri, defaultUri, onZoomChange }: ZoomableImageProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const [isZoomed, setIsZoomed] = useState(false);
  const lastTap = useRef<number | null>(null);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);

  useEffect(() => {
    scale.setValue(1);
    translateX.setValue(0);
    translateY.setValue(0);
    setIsZoomed(false);
    lastTranslateX.current = 0;
    lastTranslateY.current = 0;
    if (onZoomChange) {
      onZoomChange(false);
    }
  }, [uri, onZoomChange, scale, translateX, translateY]);

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (lastTap.current && now - lastTap.current < DOUBLE_TAP_DELAY) {
      lastTap.current = null;

      if (isZoomed) {
        Animated.parallel([
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }),
        ]).start();
        setIsZoomed(false);
        lastTranslateX.current = 0;
        lastTranslateY.current = 0;
        if (onZoomChange) {
          onZoomChange(false);
        }
      } else {
        Animated.spring(scale, {
          toValue: 2.5,
          useNativeDriver: true,
        }).start();
        setIsZoomed(true);
        if (onZoomChange) {
          onZoomChange(true);
        }
      }
    } else {
      lastTap.current = now;
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isZoomed,
      onMoveShouldSetPanResponder: () => isZoomed,
      onPanResponderGrant: () => {
        lastTranslateX.current = (translateX as any)._value;
        lastTranslateY.current = (translateY as any)._value;
      },
      onPanResponderMove: (event, gestureState) => {
        if (isZoomed) {
          const currentScale = 2.5;
          const maxTranslateX = ((SCREEN_WIDTH * currentScale) - SCREEN_WIDTH) / 2;
          const maxTranslateY = ((SCREEN_HEIGHT * currentScale) - SCREEN_HEIGHT) / 2;

          const newX = Math.max(
            -maxTranslateX,
            Math.min(maxTranslateX, lastTranslateX.current + gestureState.dx)
          );
          const newY = Math.max(
            -maxTranslateY,
            Math.min(maxTranslateY, lastTranslateY.current + gestureState.dy)
          );

          translateX.setValue(newX);
          translateY.setValue(newY);
        }
      },
      onPanResponderRelease: () => {
        lastTranslateX.current = (translateX as any)._value;
        lastTranslateY.current = (translateY as any)._value;
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      <TouchableWithoutFeedback onPress={handleDoubleTap}>
        <Animated.View
          style={[
            styles.imageContainer,
            {
              transform: [
                { translateX },
                { translateY },
                { scale },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <Image
            source={{ uri }}
            style={styles.image}
            resizeMode="contain"
            defaultSource={defaultUri ? { uri: defaultUri } : undefined}
          />
        </Animated.View>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
});
