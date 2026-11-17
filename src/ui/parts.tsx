import { ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { c, f } from '../theme';

export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [anim] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (visible) {
      anim.setValue(0);
      Animated.timing(anim, { toValue: 1, duration: 260, easing: Easing.out(Easing.exp), useNativeDriver: true }).start();
    }
  }, [visible, anim]);
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.scrim, opacity: anim }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Fermer" />
        </Animated.View>
        <Animated.View
          style={[
            s.sheet,
            { paddingBottom: 20 + insets.bottom },
            { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) }] },
          ]}
        >
          <View style={s.grab} />
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Chip({ label, sub, on, onPress }: { label: string; sub?: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [s.chip, on && s.chipOn, pressed && { opacity: 0.7 }]}
    >
      <Text style={[s.chipText, on && { color: c.accent }]}>
        {label}
        {sub ? <Text style={[s.chipSub, on && { color: c.accent }]}>{'  ' + sub}</Text> : null}
      </Text>
    </Pressable>
  );
}

export function Label({ children }: { children: string }) {
  return <Text style={s.label}>{children}</Text>;
}

export function PrimaryButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [s.primary, (pressed || disabled) && { opacity: 0.6 }]}
    >
      <Text style={s.primaryText}>{title}</Text>
    </Pressable>
  );
}

export function Check({ done, onPress, label }: { done: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={label}>
      <View style={[s.check, done && { backgroundColor: c.accent }]}>
        {done ? (
          <Svg width={12} height={12} viewBox="0 0 24 24">
            <Path d="M4 12.5l5 5L20 6.5" stroke={c.onAccent} strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        ) : null}
      </View>
    </Pressable>
  );
}

export const MicIcon = ({ color = c.onAccent }: { color?: string }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <Rect x={9} y={3} width={6} height={11} rx={3} />
    <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </Svg>
);

export const ClockIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c.muted} strokeWidth={2} strokeLinecap="round">
    <Circle cx={12} cy={12} r={9} />
    <Path d="M12 7v5l3 2" />
  </Svg>
);

export const BackIcon = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={c.fg} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M15 5l-7 7 7 7" />
  </Svg>
);

export const Chevron = ({ open }: { open: boolean }) => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={c.muted} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}>
    <Path d="M9 5l7 7-7 7" />
  </Svg>
);

export const s = StyleSheet.create({
  sheet: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, maxHeight: '92%' },
  grab: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.line, alignSelf: 'center', marginBottom: 14 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, backgroundColor: c.bg, borderWidth: 1, borderColor: c.line },
  chipOn: { backgroundColor: c.accentSoft, borderColor: c.accent },
  chipText: { fontFamily: f.medium, fontSize: 14, color: c.fg },
  chipSub: { fontFamily: f.body, fontSize: 13, color: c.muted, fontVariant: ['tabular-nums'] },
  label: { fontFamily: f.semi, fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase', color: c.muted, marginTop: 18, marginBottom: 8 },
  primary: { height: 52, borderRadius: 14, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  primaryText: { fontFamily: f.semi, fontSize: 16, color: c.onAccent },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: c.accent, alignItems: 'center', justifyContent: 'center' },
});
