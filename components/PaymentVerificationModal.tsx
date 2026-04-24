import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, TextInput, Alert, ScrollView, AppState, AppStateStatus } from 'react-native';
import { X, CircleCheck as CheckCircle, Upload, CircleAlert as AlertCircle } from 'lucide-react-native';
import { PaymentMethod } from '@/lib/wallet';
import { coreBackend } from '@/lib/coreBackend';

type PaymentVerificationModalProps = {
  visible: boolean;
  onClose: () => void;
  onVerify: (reference?: string) => Promise<void>;
  paymentMethod: 'online' | 'transfer';
  paystackReference?: string;
  orderId?: string;
};

export function PaymentVerificationModal({
  visible,
  onClose,
  onVerify,
  paymentMethod,
  paystackReference,
  orderId,
}: PaymentVerificationModalProps) {
  const [loading, setLoading] = useState(false);
  const [transferReference, setTransferReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const verifyingRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const checkAndAutoVerify = async () => {
    if (!paystackReference || verifyingRef.current) return;
    try {
      const { data } = await coreBackend
        .from('pending_orders')
        .select('status')
        .eq('paystack_reference', paystackReference)
        .maybeSingle();

      if (data?.status === 'completed') {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        verifyingRef.current = true;
        setLoading(true);
        await onVerify(undefined);
      }
    } catch {
      // Non-fatal
    }
  };

  // Poll every 3 seconds and also check immediately when app comes back to foreground
  useEffect(() => {
    if (!visible || paymentMethod !== 'online' || !paystackReference) return;

    verifyingRef.current = false;

    // Start polling
    pollIntervalRef.current = setInterval(checkAndAutoVerify, 3000);

    // Native: listen for app returning to foreground after Paystack browser
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        checkAndAutoVerify();
      }
      appStateRef.current = nextState;
    });

    // Web: listen for tab regaining focus (user returns from Paystack tab)
    const handleWindowFocus = () => checkAndAutoVerify();
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleWindowFocus);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkAndAutoVerify();
      });
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      subscription.remove();
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleWindowFocus);
      }
    };
  }, [visible, paymentMethod, paystackReference]);

  const handleVerify = async () => {
    setError(null);

    if (paymentMethod === 'transfer' && !transferReference.trim()) {
      setError('Please enter your transfer reference number');
      return;
    }

    setLoading(true);
    try {
      await onVerify(paymentMethod === 'transfer' ? transferReference : undefined);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) {
      return;
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Verify Payment</Text>
            <TouchableOpacity onPress={handleClose} disabled={loading}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
            {paymentMethod === 'online' ? (
              <>
                <View style={styles.iconContainer}>
                  {loading ? (
                    <ActivityIndicator size="large" color="#10b981" />
                  ) : (
                    <CheckCircle size={64} color="#10b981" />
                  )}
                </View>
                <Text style={styles.message}>
                  {loading
                    ? 'Confirming your payment and creating your order...'
                    : 'Complete your payment on the Paystack page. Your order will be created automatically once payment is confirmed.'}
                </Text>
                {!loading && (
                  <View style={styles.infoBox}>
                    <AlertCircle size={16} color="#f97316" />
                    <Text style={styles.infoText}>
                      After paying, come back to this screen — your order will be confirmed automatically. This usually takes a few seconds.
                    </Text>
                  </View>
                )}
                {!loading && paystackReference && (
                  <View style={styles.referenceBox}>
                    <Text style={styles.referenceLabel}>Payment Reference:</Text>
                    <Text style={styles.referenceValue}>{paystackReference}</Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <View style={styles.iconContainer}>
                  <Upload size={64} color="#f97316" />
                </View>
                <Text style={styles.message}>
                  Transfer the exact amount to the bank account provided. Enter your transfer reference below.
                </Text>
                {orderId && (
                  <View style={styles.orderIdBox}>
                    <Text style={styles.orderIdLabel}>Include this in transfer notes:</Text>
                    <Text style={styles.orderIdValue}>{orderId}</Text>
                  </View>
                )}
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Transfer Reference Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your transfer reference"
                    value={transferReference}
                    onChangeText={setTransferReference}
                    autoCapitalize="characters"
                    editable={!loading}
                  />
                  <Text style={styles.inputHint}>
                    This is the reference number from your bank transfer receipt.
                  </Text>
                </View>
              </>
            )}

            {error && (
              <View style={styles.errorContainer}>
                <View style={styles.errorHeader}>
                  <AlertCircle size={20} color="#dc2626" />
                  <Text style={styles.errorTitle}>Payment Failed</Text>
                </View>
                <Text style={styles.errorText}>{error}</Text>
                <Text style={styles.errorHint}>
                  You can close this window and try again with a different payment method.
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {error ? (
              <>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    setError(null);
                    if (paymentMethod === 'online') {
                      onClose();
                    }
                  }}>
                  <Text style={styles.retryButtonText}>
                    {paymentMethod === 'online' ? 'Try Different Card' : 'Try Again'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleClose}>
                  <Text style={styles.cancelButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            ) : loading ? (
              <TouchableOpacity style={[styles.verifyButton, styles.verifyButtonDisabled]} disabled>
                <ActivityIndicator size="small" color="#ffffff" />
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.verifyButton}
                  onPress={handleVerify}>
                  <Text style={styles.verifyButtonText}>
                    {paymentMethod === 'online' ? 'I Already Paid — Check Now' : 'Submit & Place Order'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleClose}>
                  <Text style={styles.cancelButtonText}>I'll come back later</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  scrollView: {
    flexGrow: 0,
    flexShrink: 1,
  },
  content: {
    padding: 24,
    gap: 16,
  },
  iconContainer: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 22,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
  },
  referenceBox: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  referenceLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  referenceValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  orderIdBox: {
    backgroundColor: '#dbeafe',
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  orderIdLabel: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '500',
  },
  orderIdValue: {
    fontSize: 16,
    color: '#1e40af',
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  inputContainer: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  inputHint: {
    fontSize: 12,
    color: '#6b7280',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 8,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#dc2626',
  },
  errorText: {
    fontSize: 14,
    color: '#991b1b',
    lineHeight: 20,
  },
  errorHint: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
    marginTop: 4,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 10,
  },
  verifyButton: {
    backgroundColor: '#f97316',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  retryButton: {
    backgroundColor: '#f97316',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
});
