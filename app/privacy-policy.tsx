import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface Section {
  heading: string;
  content: string;
}

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('content_pages')
        .select('content')
        .eq('page_type', 'privacy_policy')
        .maybeSingle();

      if (error) throw error;

      if (data?.content) {
        setLastUpdated(data.content.lastUpdated || '');
        setSections(data.content.sections || []);
      }
    } catch (error) {
      console.error('Error fetching privacy policy content:', error);
    } finally {
      setLoading(false);
    }
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
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {lastUpdated && (
            <Text style={styles.lastUpdated}>Last Updated: {lastUpdated}</Text>
          )}

          {sections.map((section, index) => (
            <View key={index} style={styles.section}>
              <Text style={styles.heading}>{section.heading}</Text>
              <Text style={styles.paragraph}>{section.content}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#ff8c00',
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  lastUpdated: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 24,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 12,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 22,
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 22,
    marginBottom: 8,
    paddingLeft: 12,
  },
  contactInfo: {
    fontSize: 14,
    color: '#ff8c00',
    lineHeight: 22,
    fontWeight: '500',
  },
});
