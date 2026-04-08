import { useEffect, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
  Text,
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface Props {
  onFinish: () => void;
}

export default function AnimatedSplashScreen({ onFinish }: Props) {
  const bgScale = useRef(new Animated.Value(1.15)).current;
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoY = useRef(new Animated.Value(30)).current;
  const ringScale = useRef(new Animated.Value(0.4)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;
  const ring2Scale = useRef(new Animated.Value(0.4)).current;
  const ring2Opacity = useRef(new Animated.Value(0.4)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const taglineY = useRef(new Animated.Value(12)).current;
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const shimmerX = useRef(new Animated.Value(-width)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(100),

      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 60,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(logoY, {
          toValue: 0,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(bgScale, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),

      Animated.delay(100),

      Animated.parallel([
        Animated.timing(ringScale, {
          toValue: 2.2,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),

      Animated.parallel([
        Animated.timing(ring2Scale, {
          toValue: 2.8,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(ring2Opacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(taglineY, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),

      Animated.delay(300),

      Animated.loop(
        Animated.timing(shimmerX, {
          toValue: width * 2,
          duration: 1000,
          useNativeDriver: true,
        }),
        { iterations: 1 }
      ),

      Animated.delay(400),

      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onFinish();
    });
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: screenOpacity }]}>
      <Animated.View style={[styles.bgWrap, { transform: [{ scale: bgScale }] }]}>
        <View style={styles.bgGradientTop} />
        <View style={styles.bgGradientBottom} />
      </Animated.View>

      <View style={styles.decorDots}>
        {[...Array(6)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                width: 4 + (i % 3) * 3,
                height: 4 + (i % 3) * 3,
                borderRadius: 10,
                top: (i * 80) % height,
                left: i % 2 === 0 ? (i * 55) % (width * 0.3) : undefined,
                right: i % 2 !== 0 ? (i * 45) % (width * 0.3) : undefined,
                opacity: 0.18,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.center}>
        <View style={styles.ringWrap}>
          <Animated.View
            style={[
              styles.ring,
              {
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.ring,
              styles.ring2,
              {
                opacity: ring2Opacity,
                transform: [{ scale: ring2Scale }],
              },
            ]}
          />

          <Animated.View
            style={[
              styles.logoWrap,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }, { translateY: logoY }],
              },
            ]}
          >
            <View style={styles.logoShadow} />
            <View style={styles.logoCard}>
              <Image
                source={require('@/assets/images/danhausa.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Animated.View
                style={[
                  styles.shimmer,
                  { transform: [{ translateX: shimmerX }] },
                ]}
              />
            </View>
          </Animated.View>
        </View>

        <Animated.View
          style={[
            styles.textWrap,
            {
              opacity: taglineOpacity,
              transform: [{ translateY: taglineY }],
            },
          ]}
        >
          <Text style={styles.brandName}>Danhausa</Text>
          <View style={styles.taglineRow}>
            <View style={styles.taglineLine} />
            <Text style={styles.tagline}>Your world, delivered</Text>
            <View style={styles.taglineLine} />
          </View>
        </Animated.View>
      </View>

      <Animated.View
        style={[styles.bottomBar, { opacity: taglineOpacity }]}
      >
        <View style={styles.loadingDots}>
          {[0, 1, 2].map((i) => (
            <LoadingDot key={i} delay={i * 160} />
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function LoadingDot({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.3,
          duration: 380,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={[styles.loadingDot, { opacity: anim }]} />
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  bgWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  bgGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.5,
    backgroundColor: '#fff9f5',
  },
  bgGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.55,
    backgroundColor: '#f0faf4',
  },
  decorDots: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  dot: {
    position: 'absolute',
    backgroundColor: '#f97316',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 200,
    height: 200,
  },
  ring: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: '#f97316',
  },
  ring2: {
    width: 130,
    height: 130,
    borderRadius: 65,
    borderColor: '#1a6b3a',
    borderWidth: 1.5,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoShadow: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(249, 115, 22, 0.08)',
    bottom: -8,
  },
  logoCard: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#f97316',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(249,115,22,0.12)',
  },
  logo: {
    width: 120,
    height: 120,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.45)',
    transform: [{ skewX: '-20deg' }],
  },
  textWrap: {
    alignItems: 'center',
    marginTop: 28,
  },
  brandName: {
    fontSize: 36,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  taglineLine: {
    width: 28,
    height: 1.5,
    backgroundColor: '#f97316',
    borderRadius: 2,
  },
  tagline: {
    fontSize: 13,
    color: '#1a6b3a',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 8,
  },
  loadingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#f97316',
  },
});
