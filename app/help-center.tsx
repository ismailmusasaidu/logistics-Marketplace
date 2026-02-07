import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, HelpCircle, MessageCircle, Mail, Phone } from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface FAQItem {
  question: string;
  answer: string;
}

interface ContactItem {
  type: string;
  label: string;
  value: string;
}

export default function HelpCenterScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('content_pages')
        .select('content')
        .eq('page_type', 'help_center')
        .maybeSingle();

      if (error) throw error;

      if (data?.content) {
        setFaqs(data.content.sections?.[0]?.items || []);
        setContacts(data.content.sections?.[1]?.items || []);
      }
    } catch (error) {
      console.error('Error fetching help center content:', error);
    } finally {
      setLoading(false);
    }
  };

  const getContactIcon = (type: string) => {
    switch (type) {
      case 'email':
        return Mail;
      case 'phone':
        return Phone;
      case 'chat':
        return MessageCircle;
      default:
        return Mail;
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
        <Text style={styles.headerTitle}>Help Center</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeCard}>
          <HelpCircle size={48} color="#ff8c00" />
          <Text style={styles.welcomeTitle}>How can we help you?</Text>
          <Text style={styles.welcomeText}>
            Find answers to frequently asked questions or contact our support team
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          {faqs.map((faq, index) => (
            <View key={index} style={styles.faqCard}>
              <Text style={styles.question}>{faq.question}</Text>
              <Text style={styles.answer}>{faq.answer}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Support</Text>
          {contacts.map((contact, index) => {
            const ContactIcon = getContactIcon(contact.type);
            return (
              <View key={index} style={styles.contactCard}>
                <View style={styles.contactIcon}>
                  <ContactIcon size={24} color="#ff8c00" />
                </View>
                <View style={styles.contactContent}>
                  <Text style={styles.contactLabel}>{contact.label}</Text>
                  <Text style={styles.contactValue}>{contact.value}</Text>
                </View>
              </View>
            );
          })}
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
  welcomeCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  welcomeText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 12,
  },
  faqCard: {
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
  question: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  answer: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  contactCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffedd5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactContent: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
});
