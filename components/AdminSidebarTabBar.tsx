import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '@/constants/fonts';

export function AdminSidebarTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.sidebar, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
      <View style={styles.brandMark}>
        <Text style={styles.brandText}>L</Text>
      </View>

      <View style={styles.navItems}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const isFocused = state.index === index;

          if (options.href === null) return null;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          const iconColor = isFocused ? '#f97316' : '#94a3b8';

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[styles.navItem, isFocused && styles.navItemActive]}
            >
              {isFocused && <View style={styles.activeIndicator} />}
              <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
                {options.tabBarIcon?.({ focused: isFocused, color: iconColor, size: 20 })}
              </View>
              <Text
                style={[styles.navLabel, isFocused && styles.navLabelActive]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 80,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandText: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#ffffff',
  },
  navItems: {
    flex: 1,
    width: '100%',
    gap: 2,
    alignItems: 'center',
  },
  navItem: {
    width: 68,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 12,
    alignItems: 'center',
    gap: 5,
    position: 'relative',
  },
  navItemActive: {
    backgroundColor: 'rgba(249,115,22,0.12)',
  },
  activeIndicator: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
    backgroundColor: '#f97316',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(249,115,22,0.15)',
  },
  navLabel: {
    fontSize: 9,
    fontFamily: Fonts.poppinsMedium,
    color: '#64748b',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  navLabelActive: {
    color: '#f97316',
    fontFamily: Fonts.poppinsSemiBold,
  },
});
