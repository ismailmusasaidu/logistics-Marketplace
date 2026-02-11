import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Platform,
  Clipboard,
} from 'react-native';
import { Wallet, Plus, Minus, ArrowUpRight, ArrowDownRight, Clock, CreditCard, CheckCircle, Copy, Building2 } from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Fonts } from '@/constants/fonts';

interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
  status: string;
}

interface VirtualAccount {
  id: string;
  account_number: string;
  account_name: string;
  bank_name: string;
  bank_code: string;
  assigned: boolean;
  active: boolean;
}

export default function WalletManagement() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFundModal, setShowFundModal] = useState(false);
  const [fundAmount, setFundAmount] = useState('');
  const [funding, setFunding] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [showPaymentWebView, setShowPaymentWebView] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [initializingPayment, setInitializingPayment] = useState(false);
  const [virtualAccount, setVirtualAccount] = useState<VirtualAccount | null>(null);
  const [creatingVirtualAccount, setCreatingVirtualAccount] = useState(false);
  const [showVirtualAccountModal, setShowVirtualAccountModal] = useState(false);

  useEffect(() => {
    if (profile) {
      fetchWalletData();
    }
  }, [profile]);

  const fetchWalletData = async () => {
    try {
      setLoading(true);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('wallet_balance')
        .eq('id', profile?.id)
        .single();

      if (profileError) throw profileError;

      setWalletBalance(profileData?.wallet_balance || 0);

      const { data: transactionsData, error: transactionsError } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (transactionsError) throw transactionsError;

      setTransactions(transactionsData || []);

      // Fetch virtual account
      const { data: virtualAccountData } = await supabase
        .from('virtual_accounts')
        .select('*')
        .eq('user_id', profile?.id)
        .single();

      setVirtualAccount(virtualAccountData);
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      Alert.alert('Error', 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateVirtualAccount = async () => {
    if (!profile) return;

    try {
      setCreatingVirtualAccount(true);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        Alert.alert('Error', 'You must be logged in');
        return;
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-virtual-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create virtual account');
      }

      setVirtualAccount(result.data);
      showToast('Virtual account created successfully!', 'success');
    } catch (error) {
      console.error('Error creating virtual account:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showToast(errorMessage, 'error');
    } finally {
      setCreatingVirtualAccount(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    if (Platform.OS === 'web') {
      navigator.clipboard.writeText(text);
    } else {
      Clipboard.setString(text);
    }
    showToast(`${label} copied to clipboard!`, 'success');
  };

  const handleFundWallet = async () => {
    if (!profile) return;

    const amount = parseFloat(fundAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (amount < 100) {
      Alert.alert('Minimum Amount', 'Minimum funding amount is ₦100');
      return;
    }

    try {
      setFunding(true);

      const { data, error } = await supabase.rpc('credit_wallet', {
        p_user_id: profile.id,
        p_amount: amount,
        p_description: 'Wallet top-up',
        p_reference_type: 'topup',
      });

      if (error) throw error;

      if (data.success) {
        Alert.alert('Success', `₦${amount.toFixed(2)} has been added to your wallet`);
        setShowFundModal(false);
        setFundAmount('');
        await fetchWalletData();
      } else {
        throw new Error(data.error || 'Failed to fund wallet');
      }
    } catch (error) {
      console.error('Error funding wallet:', error);
      Alert.alert('Error', 'Failed to fund wallet. Please try again.');
    } finally {
      setFunding(false);
    }
  };

  const handlePayOnline = async () => {
    if (!profile) return;

    const amount = parseFloat(fundAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (amount < 100) {
      Alert.alert('Minimum Amount', 'Minimum funding amount is ₦100');
      return;
    }

    try {
      setInitializingPayment(true);

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        Alert.alert('Error', 'You must be logged in to make a payment');
        return;
      }

      const email = profile.email || session.user?.email;
      if (!email) {
        Alert.alert('Error', 'Email address is required for payment');
        return;
      }

      const { data: result, error: invokeError } = await supabase.functions.invoke('initialize-payment', {
        body: { amount, email },
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to initialize payment');
      }

      if (!result?.success) {
        const errorMsg = result?.error || 'Failed to initialize payment';
        if (errorMsg === 'Paystack secret key not configured') {
          Alert.alert(
            'Coming Soon',
            'Online payment integration will be available soon. Please use another payment method.',
            [{ text: 'OK' }]
          );
          return;
        }
        throw new Error(errorMsg);
      }

      setPaymentUrl(result.data.authorization_url);
      setPaymentReference(result.data.reference);
      setShowFundModal(false);

      if (Platform.OS === 'web') {
        window.open(result.data.authorization_url, '_blank');
      }

      setShowPaymentWebView(true);
    } catch (error) {
      console.error('Error initializing payment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('Paystack secret key not configured')) {
        Alert.alert(
          'Coming Soon',
          'Online payment integration will be available soon. Please use another payment method.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Payment Error', errorMessage || 'Failed to initialize payment. Please try again.');
      }
    } finally {
      setInitializingPayment(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!paymentReference) {
      Alert.alert('Error', 'Payment reference is missing');
      return;
    }

    try {
      setFunding(true);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Error', 'Session expired. Please try again.');
        return;
      }

      const verifyUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/verify-payment?reference=${paymentReference}`;

      console.log('Verifying payment with reference:', paymentReference);

      const response = await fetch(verifyUrl, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      console.log('Verify response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Verify response error:', errorText);
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      console.log('Verify result:', result);

      if (result.success) {
        setShowPaymentWebView(false);
        Alert.alert('Success', `Payment successful! ₦${result.amount.toFixed(2)} has been added to your wallet`);
        setFundAmount('');
        setPaymentUrl('');
        setPaymentReference('');
        await fetchWalletData();
      } else {
        console.error('Payment verification failed:', result.error);
        Alert.alert('Payment Failed', result.error || 'Payment verification failed. Please try again or contact support.');
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to verify payment: ${errorMessage}. Please contact support if amount was deducted.`);
    } finally {
      setFunding(false);
    }
  };

  const handlePaymentWebViewMessage = async (event: any) => {
    const url = event.nativeEvent.url;

    if (url.includes('/functions/v1/verify-payment') && url.includes('reference=')) {
      setShowPaymentWebView(false);

      try {
        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
          Alert.alert('Success', `Payment successful! ₦${result.amount.toFixed(2)} has been added to your wallet`);
          setFundAmount('');
          await fetchWalletData();
        } else {
          Alert.alert('Payment Failed', result.error || 'Payment verification failed');
        }
      } catch (error) {
        console.error('Error verifying payment:', error);
        Alert.alert('Error', 'Failed to verify payment. Please contact support if amount was deducted.');
      }
    }
  };

  const handleWithdrawFunds = async () => {
    if (!profile) return;

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (amount < 100) {
      Alert.alert('Minimum Amount', 'Minimum withdrawal amount is ₦100');
      return;
    }

    if (amount > walletBalance) {
      Alert.alert('Insufficient Balance', `You only have ₦${walletBalance.toFixed(2)} in your wallet`);
      return;
    }

    try {
      setWithdrawing(true);

      const { data, error } = await supabase.rpc('debit_wallet', {
        p_user_id: profile.id,
        p_amount: amount,
        p_description: 'Wallet withdrawal',
        p_reference_type: 'withdrawal',
      });

      if (error) throw error;

      if (data.success) {
        Alert.alert('Success', `₦${amount.toFixed(2)} has been withdrawn from your wallet`);
        setShowWithdrawModal(false);
        setWithdrawAmount('');
        await fetchWalletData();
      } else {
        throw new Error(data.error || 'Failed to withdraw funds');
      }
    } catch (error) {
      console.error('Error withdrawing funds:', error);
      Alert.alert('Error', 'Failed to withdraw funds. Please try again.');
    } finally {
      setWithdrawing(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.balanceCard}>
        <View style={styles.balanceHeader}>
          <View style={styles.walletIconContainer}>
            <Wallet size={32} color="#ff8c00" />
          </View>
          <Text style={styles.balanceLabel}>Wallet Balance</Text>
        </View>
        <Text style={styles.balanceAmount}>₦{walletBalance.toFixed(2)}</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.fundButton}
            onPress={() => setShowFundModal(true)}
          >
            <Plus size={20} color="#ffffff" />
            <Text style={styles.fundButtonText}>Fund</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.withdrawButton}
            onPress={() => setShowWithdrawModal(true)}
          >
            <Minus size={20} color="#ff8c00" />
            <Text style={styles.withdrawButtonText}>Withdraw</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.virtualAccountSection}>
        <Text style={styles.sectionTitle}>Fund via Bank Transfer</Text>

        {!virtualAccount ? (
          <View style={styles.noAccountCard}>
            <Building2 size={48} color="#ff8c00" />
            <Text style={styles.noAccountTitle}>Get Your Virtual Account</Text>
            <Text style={styles.noAccountText}>
              Create a dedicated bank account number to fund your wallet instantly via bank transfer.
            </Text>
            <TouchableOpacity
              style={[styles.createAccountButton, creatingVirtualAccount && styles.buttonDisabled]}
              onPress={handleCreateVirtualAccount}
              disabled={creatingVirtualAccount}
            >
              {creatingVirtualAccount ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Building2 size={20} color="#ffffff" />
                  <Text style={styles.createAccountButtonText}>Create Virtual Account</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.virtualAccountCard}
            onPress={() => setShowVirtualAccountModal(true)}
          >
            <View style={styles.accountHeader}>
              <View style={styles.bankIconContainer}>
                <Building2 size={24} color="#ff8c00" />
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.bankName}>{virtualAccount.bank_name}</Text>
                <Text style={styles.accountName}>{virtualAccount.account_name}</Text>
              </View>
            </View>
            <View style={styles.accountNumberContainer}>
              <Text style={styles.accountNumberLabel}>Account Number</Text>
              <View style={styles.accountNumberRow}>
                <Text style={styles.accountNumber}>{virtualAccount.account_number}</Text>
                <TouchableOpacity
                  style={styles.copyButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    copyToClipboard(virtualAccount.account_number, 'Account number');
                  }}
                >
                  <Copy size={18} color="#ff8c00" />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.tapToViewMore}>Tap to view details</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.transactionsSection}>
        <Text style={styles.sectionTitle}>Transaction History</Text>

        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Clock size={48} color="#d1d5db" />
            <Text style={styles.emptyStateText}>No transactions yet</Text>
          </View>
        ) : (
          <View style={styles.transactionsList}>
            {transactions.map((transaction) => (
              <View key={transaction.id} style={styles.transactionItem}>
                <View style={styles.transactionIcon}>
                  {transaction.type === 'credit' ? (
                    <ArrowDownRight size={24} color="#10b981" />
                  ) : (
                    <ArrowUpRight size={24} color="#ef4444" />
                  )}
                </View>
                <View style={styles.transactionDetails}>
                  <Text style={styles.transactionDescription}>
                    {transaction.description}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {formatDate(transaction.created_at)}
                  </Text>
                </View>
                <View style={styles.transactionAmount}>
                  <Text
                    style={[
                      styles.transactionAmountText,
                      transaction.type === 'credit'
                        ? styles.creditAmount
                        : styles.debitAmount,
                    ]}
                  >
                    {transaction.type === 'credit' ? '+' : '-'}₦
                    {transaction.amount.toFixed(2)}
                  </Text>
                  <Text style={styles.balanceAfter}>
                    Balance: ₦{transaction.balance_after.toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <Modal
        visible={showFundModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFundModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Fund Wallet</Text>

            <Text style={styles.inputLabel}>Enter Amount</Text>
            <TextInput
              style={styles.input}
              value={fundAmount}
              onChangeText={setFundAmount}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.modalNote}>Minimum funding amount: ₦100</Text>

            <Text style={styles.paymentMethodLabel}>Choose Payment Method:</Text>

            <TouchableOpacity
              style={[styles.payOnlineButton, initializingPayment && styles.buttonDisabled]}
              onPress={handlePayOnline}
              disabled={initializingPayment || funding}
            >
              {initializingPayment ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <CreditCard size={20} color="#ffffff" />
                  <Text style={styles.payOnlineButtonText}>Pay Online (Paystack)</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[styles.manualFundButton, funding && styles.buttonDisabled]}
              onPress={handleFundWallet}
              disabled={funding || initializingPayment}
            >
              {funding ? (
                <ActivityIndicator color="#ff8c00" />
              ) : (
                <>
                  <Plus size={20} color="#ff8c00" />
                  <Text style={styles.manualFundButtonText}>Manual Fund</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelModalButton}
              onPress={() => {
                setShowFundModal(false);
                setFundAmount('');
              }}
            >
              <Text style={styles.cancelModalButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showWithdrawModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowWithdrawModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Withdraw Funds</Text>

            <View style={styles.balanceInfo}>
              <Text style={styles.balanceInfoLabel}>Available Balance:</Text>
              <Text style={styles.balanceInfoValue}>₦{walletBalance.toFixed(2)}</Text>
            </View>

            <Text style={styles.inputLabel}>Enter Amount</Text>
            <TextInput
              style={styles.input}
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.modalNote}>Minimum withdrawal amount: ₦100</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowWithdrawModal(false);
                  setWithdrawAmount('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, withdrawing && styles.buttonDisabled]}
                onPress={handleWithdrawFunds}
                disabled={withdrawing}
              >
                {withdrawing ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Withdraw</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPaymentWebView}
        animationType="slide"
        onRequestClose={() => {
          setShowPaymentWebView(false);
          setPaymentUrl('');
          setPaymentReference('');
        }}
      >
        {Platform.OS === 'web' ? (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Complete Payment</Text>

              <View style={styles.paymentInstructionsCard}>
                <CheckCircle size={48} color="#10b981" />
                <Text style={styles.paymentInstructionsTitle}>
                  Payment Window Opened
                </Text>
                <Text style={styles.paymentInstructionsText}>
                  A new window has been opened for you to complete your payment on Paystack.
                </Text>
                <Text style={styles.paymentInstructionsText}>
                  After completing the payment, click the button below to verify and add funds to your wallet.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.confirmButton, funding && styles.buttonDisabled]}
                onPress={handleVerifyPayment}
                disabled={funding}
              >
                {funding ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.confirmButtonText}>I've Completed Payment</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.manualFundButton}
                onPress={() => {
                  if (paymentUrl) {
                    window.open(paymentUrl, '_blank');
                  }
                }}
              >
                <CreditCard size={20} color="#ff8c00" />
                <Text style={styles.manualFundButtonText}>Reopen Payment Window</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelModalButton}
                onPress={() => {
                  setShowPaymentWebView(false);
                  setPaymentUrl('');
                  setPaymentReference('');
                  setShowFundModal(true);
                }}
              >
                <Text style={styles.cancelModalButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.webViewContainer}>
            <View style={styles.webViewHeader}>
              <Text style={styles.webViewTitle}>Complete Payment</Text>
              <TouchableOpacity
                style={styles.closeWebViewButton}
                onPress={() => {
                  Alert.alert(
                    'Cancel Payment?',
                    'Are you sure you want to cancel this payment?',
                    [
                      { text: 'No', style: 'cancel' },
                      {
                        text: 'Yes',
                        onPress: () => {
                          setShowPaymentWebView(false);
                          setPaymentUrl('');
                          setPaymentReference('');
                        },
                      },
                    ]
                  );
                }}
              >
                <Text style={styles.closeWebViewButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.nativeOnlyMessage}>
              WebView is only available on mobile devices. Please use a mobile device or try another payment method.
            </Text>
          </View>
        )}
      </Modal>

      <Modal
        visible={showVirtualAccountModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVirtualAccountModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Virtual Account Details</Text>

            {virtualAccount && (
              <View style={styles.virtualAccountDetailsCard}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Bank Name</Text>
                  <View style={styles.detailValueRow}>
                    <Text style={styles.detailValue}>{virtualAccount.bank_name}</Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Account Number</Text>
                  <View style={styles.detailValueRow}>
                    <Text style={styles.detailValue}>{virtualAccount.account_number}</Text>
                    <TouchableOpacity
                      style={styles.copyIconButton}
                      onPress={() => copyToClipboard(virtualAccount.account_number, 'Account number')}
                    >
                      <Copy size={18} color="#ff8c00" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Account Name</Text>
                  <View style={styles.detailValueRow}>
                    <Text style={styles.detailValue}>{virtualAccount.account_name}</Text>
                    <TouchableOpacity
                      style={styles.copyIconButton}
                      onPress={() => copyToClipboard(virtualAccount.account_name, 'Account name')}
                    >
                      <Copy size={18} color="#ff8c00" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.instructionsCard}>
                  <Text style={styles.instructionsTitle}>How to Fund Your Wallet</Text>
                  <Text style={styles.instructionsText}>
                    1. Use mobile banking or internet banking{'\n'}
                    2. Transfer any amount to the account above{'\n'}
                    3. Your wallet will be credited automatically
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowVirtualAccountModal(false)}
            >
              <Text style={styles.closeModalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceCard: {
    backgroundColor: '#ffffff',
    margin: 20,
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  balanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  walletIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  balanceLabel: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: '#6b7280',
  },
  balanceAmount: {
    fontSize: 36,
    fontFamily: Fonts.headingBold,
    color: '#1f2937',
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  fundButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#ff8c00',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  fundButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  withdrawButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#ff8c00',
  },
  withdrawButtonText: {
    color: '#ff8c00',
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  transactionsSection: {
    flex: 1,
    marginHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#1f2937',
    marginBottom: 16,
  },
  transactionsList: {
    marginBottom: 20,
  },
  transactionItem: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  transactionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  transactionDescription: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#1f2937',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#9ca3af',
  },
  transactionAmount: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  transactionAmountText: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  creditAmount: {
    color: '#10b981',
  },
  debitAmount: {
    color: '#ef4444',
  },
  balanceAfter: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: '#6b7280',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: '#9ca3af',
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: '#1f2937',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    fontFamily: Fonts.semiBold,
    color: '#1f2937',
    marginBottom: 12,
  },
  modalNote: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    marginBottom: 24,
  },
  balanceInfo: {
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  balanceInfoLabel: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#166534',
  },
  balanceInfoValue: {
    fontSize: 18,
    fontFamily: Fonts.headingBold,
    color: '#166534',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#ff8c00',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  paymentMethodLabel: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#1f2937',
    marginBottom: 12,
    marginTop: 8,
  },
  payOnlineButton: {
    flexDirection: 'row',
    backgroundColor: '#16a34a',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  payOnlineButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#9ca3af',
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
  manualFundButton: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#ff8c00',
    marginBottom: 12,
  },
  manualFundButtonText: {
    color: '#ff8c00',
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  cancelModalButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelModalButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ff8c00',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  webViewTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#ffffff',
  },
  closeWebViewButton: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeWebViewButtonText: {
    color: '#ff8c00',
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  webView: {
    flex: 1,
  },
  paymentInstructionsCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#86efac',
  },
  paymentInstructionsTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#166534',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  paymentInstructionsText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#166534',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  nativeOnlyMessage: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    textAlign: 'center',
    padding: 40,
    lineHeight: 24,
  },
  virtualAccountSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  noAccountCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  noAccountTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  noAccountText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  createAccountButton: {
    flexDirection: 'row',
    backgroundColor: '#ff8c00',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 8,
  },
  createAccountButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  virtualAccountCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  bankIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff7ed',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  accountInfo: {
    flex: 1,
  },
  bankName: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#1f2937',
    marginBottom: 4,
  },
  accountName: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#6b7280',
  },
  accountNumberContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  accountNumberLabel: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    marginBottom: 6,
  },
  accountNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountNumber: {
    fontSize: 20,
    fontFamily: Fonts.headingBold,
    color: '#1f2937',
    letterSpacing: 1,
  },
  copyButton: {
    padding: 8,
    backgroundColor: '#fff7ed',
    borderRadius: 8,
  },
  tapToViewMore: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#ff8c00',
    textAlign: 'center',
  },
  virtualAccountDetailsCard: {
    marginBottom: 20,
  },
  detailRow: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    marginBottom: 8,
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
  },
  detailValue: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#1f2937',
    flex: 1,
  },
  copyIconButton: {
    padding: 8,
    backgroundColor: '#fff7ed',
    borderRadius: 8,
    marginLeft: 12,
  },
  instructionsCard: {
    backgroundColor: '#dbeafe',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  instructionsTitle: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#1e40af',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#1e40af',
    lineHeight: 20,
  },
  closeModalButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
});
