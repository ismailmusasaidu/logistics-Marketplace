import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import {
  MapPin,
  Calculator,
  Save,
  Settings,
  Tag,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Mail,
  Ruler,
  DollarSign,
  FileText,
} from 'lucide-react-native';
import { supabase } from '@/lib/marketplace/supabase';
import { Fonts } from '@/constants/fonts';

interface DeliveryLog {
  id: string;
  user_id: string;
  order_id: string | null;
  address_id: string | null;
  action: string;
  details: any;
  zone_id: string | null;
  distance_km: number | null;
  base_price: number | null;
  distance_price: number | null;
  promotion_discount: number | null;
  adjustment_amount: number | null;
  final_price: number | null;
  created_at: string;
  profiles?: {
    email: string;
  };
}

interface DeliveryLogsProps {
  onBack: () => void;
}

const ACTION_CONFIG: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  calculate: { color: '#3b82f6', bg: '#eef6ff', icon: Calculator, label: 'Calculate' },
  address_saved: { color: '#059669', bg: '#f0fdf4', icon: Save, label: 'Address Saved' },
  adjustment: { color: '#ff8c00', bg: '#fff7ed', icon: Settings, label: 'Adjustment' },
  promotion_applied: { color: '#e11d48', bg: '#fff1f2', icon: Tag, label: 'Promo Applied' },
};

const DEFAULT_ACTION = { color: '#8b909a', bg: '#f1f5f9', icon: FileText, label: 'Unknown' };

export default function DeliveryLogs({ onBack }: DeliveryLogsProps) {
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('delivery_logs')
        .select(`*, profiles:user_id (email)`)
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error && data) setLogs(data);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.logCount}>{logs.length} logs</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadLogs}>
          <RefreshCw size={16} color="#ff8c00" />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentPadding}>
        {logs.length === 0 ? (
          <View style={styles.emptyState}>
            <FileText size={40} color="#d1d5db" />
            <Text style={styles.emptyText}>No delivery logs found</Text>
          </View>
        ) : (
          logs.map((log) => {
            const config = ACTION_CONFIG[log.action] || DEFAULT_ACTION;
            const Icon = config.icon;
            const isExpanded = expandedLog === log.id;

            return (
              <TouchableOpacity
                key={log.id}
                style={styles.logCard}
                onPress={() => setExpandedLog(isExpanded ? null : log.id)}
                activeOpacity={0.7}
              >
                <View style={styles.logTop}>
                  <View style={[styles.actionIconWrap, { backgroundColor: config.bg }]}>
                    <Icon size={16} color={config.color} />
                  </View>
                  <View style={styles.logInfo}>
                    <View style={styles.logTitleRow}>
                      <Text style={styles.actionLabel}>{config.label}</Text>
                      <Text style={styles.timestamp}>{formatDate(log.created_at)}</Text>
                    </View>
                    <Text style={styles.userEmail} numberOfLines={1}>
                      {log.profiles?.email || 'Unknown user'}
                    </Text>
                  </View>
                  {isExpanded ? (
                    <ChevronUp size={16} color="#8b909a" />
                  ) : (
                    <ChevronDown size={16} color="#8b909a" />
                  )}
                </View>

                <View style={styles.logMetaRow}>
                  {log.distance_km !== null && (
                    <View style={styles.metaChip}>
                      <Ruler size={11} color="#3b82f6" />
                      <Text style={styles.metaChipText}>{log.distance_km.toFixed(2)} km</Text>
                    </View>
                  )}
                  {log.final_price !== null && (
                    <View style={[styles.metaChip, { backgroundColor: '#fff7ed' }]}>
                      <DollarSign size={11} color="#ff8c00" />
                      <Text style={[styles.metaChipText, { color: '#ff8c00' }]}>N{log.final_price.toFixed(0)}</Text>
                    </View>
                  )}
                </View>

                {isExpanded && (
                  <View style={styles.expandedSection}>
                    {log.base_price !== null && (
                      <ExpandedRow label="Base Price" value={`N${log.base_price.toFixed(2)}`} />
                    )}
                    {log.distance_price !== null && (
                      <ExpandedRow label="Distance Price" value={`N${log.distance_price.toFixed(2)}`} />
                    )}
                    {log.promotion_discount !== null && log.promotion_discount > 0 && (
                      <ExpandedRow label="Promo Discount" value={`-N${log.promotion_discount.toFixed(2)}`} valueColor="#059669" />
                    )}
                    {log.adjustment_amount !== null && log.adjustment_amount !== 0 && (
                      <ExpandedRow label="Adjustment" value={`${log.adjustment_amount > 0 ? '+' : ''}N${log.adjustment_amount.toFixed(2)}`} valueColor="#ff8c00" />
                    )}
                    {log.order_id && <ExpandedRow label="Order ID" value={log.order_id.slice(0, 8) + '...'} />}
                    {log.zone_id && <ExpandedRow label="Zone ID" value={log.zone_id.slice(0, 8) + '...'} />}

                    {log.details && (
                      <View style={styles.jsonWrap}>
                        <Text style={styles.jsonTitle}>Details</Text>
                        <Text style={styles.jsonText}>{JSON.stringify(log.details, null, 2)}</Text>
                      </View>
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function ExpandedRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={expandedStyles.row}>
      <Text style={expandedStyles.label}>{label}</Text>
      <Text style={[expandedStyles.value, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const expandedStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#8b909a',
  },
  value: {
    fontSize: 13,
    fontFamily: Fonts.groteskSemiBold,
    color: '#1e293b',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  logCount: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#8b909a',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
  },
  refreshText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#ff8c00',
  },
  content: {
    flex: 1,
  },
  contentPadding: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: '#8b909a',
  },
  logCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  logTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logInfo: {
    flex: 1,
  },
  logTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#1e293b',
  },
  timestamp: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: '#8b909a',
  },
  userEmail: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#8b909a',
    marginTop: 2,
  },
  logMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8f9fb',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  metaChipText: {
    fontSize: 12,
    fontFamily: Fonts.groteskMedium,
    color: '#1e293b',
  },
  expandedSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  jsonWrap: {
    marginTop: 10,
    backgroundColor: '#f8f9fb',
    borderRadius: 10,
    padding: 12,
  },
  jsonTitle: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#8b909a',
    marginBottom: 6,
  },
  jsonText: {
    fontSize: 11,
    fontFamily: Fonts.grotesk,
    color: '#64748b',
    lineHeight: 16,
  },
});
