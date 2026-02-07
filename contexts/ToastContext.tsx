import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { CheckCircle, XCircle, AlertCircle, Info } from 'lucide-react-native';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  opacity: Animated.Value;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [nextId, setNextId] = useState(0);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = nextId;
    setNextId(id + 1);

    const opacity = new Animated.Value(0);
    const newToast: Toast = { id, message, type, opacity };

    setToasts(prev => [...prev, newToast]);

    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(3000),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    });
  }, [nextId]);

  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return { backgroundColor: '#059669', Icon: CheckCircle };
      case 'error':
        return { backgroundColor: '#dc2626', Icon: XCircle };
      case 'warning':
        return { backgroundColor: '#f59e0b', Icon: AlertCircle };
      case 'info':
        return { backgroundColor: '#3b82f6', Icon: Info };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View style={styles.toastContainer}>
        {toasts.map(toast => {
          const { backgroundColor, Icon } = getToastStyles(toast.type);
          return (
            <Animated.View
              key={toast.id}
              style={[
                styles.toast,
                { backgroundColor, opacity: toast.opacity }
              ]}
            >
              <Icon size={20} color="#ffffff" />
              <Text style={styles.toastText}>{toast.message}</Text>
            </Animated.View>
          );
        })}
      </View>
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    pointerEvents: 'box-none',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    minWidth: 200,
    maxWidth: '90%',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});
