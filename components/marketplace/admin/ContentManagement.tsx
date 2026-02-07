import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import {
  ArrowLeft,
  FileText,
  Save,
  Plus,
  Trash2,
  HelpCircle,
  Shield,
  Scale,
  Mail,
  Phone,
  MessageCircle,
  Check,
  Calendar,
  ChevronDown,
  ChevronUp,
  BookOpen,
  AlertCircle,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/marketplace/supabase';
import { Fonts } from '@/constants/fonts';

interface ContentManagementProps {
  onBack?: () => void;
}

interface ContentPage {
  id: string;
  page_type: 'help_center' | 'terms_of_service' | 'privacy_policy';
  title: string;
  content: any;
  updated_at: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface ContactItem {
  type: string;
  label: string;
  value: string;
}

interface Section {
  heading: string;
  content: string;
}

type PageType = 'help_center' | 'terms_of_service' | 'privacy_policy';

const TABS: { key: PageType; label: string; icon: any }[] = [
  { key: 'help_center', label: 'Help', icon: HelpCircle },
  { key: 'terms_of_service', label: 'Terms', icon: Scale },
  { key: 'privacy_policy', label: 'Privacy', icon: Shield },
];

const CONTACT_TYPES: { key: string; label: string; icon: any }[] = [
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'phone', label: 'Phone', icon: Phone },
  { key: 'chat', label: 'Chat', icon: MessageCircle },
];

export default function ContentManagement({ onBack }: ContentManagementProps) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedPage, setSelectedPage] = useState<PageType>('help_center');
  const [contentPages, setContentPages] = useState<Record<string, ContentPage>>({});

  const [helpCenterFAQs, setHelpCenterFAQs] = useState<FAQItem[]>([]);
  const [helpCenterContacts, setHelpCenterContacts] = useState<ContactItem[]>([]);
  const [termsLastUpdated, setTermsLastUpdated] = useState('');
  const [termsSections, setTermsSections] = useState<Section[]>([]);
  const [privacyLastUpdated, setPrivacyLastUpdated] = useState('');
  const [privacySections, setPrivacySections] = useState<Section[]>([]);
  const [collapsedCards, setCollapsedCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchContentPages();
  }, []);

  const toggleCollapse = (key: string) => {
    setCollapsedCards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const fetchContentPages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('content_pages')
        .select('*')
        .order('page_type');
      if (error) throw error;
      const pagesMap: Record<string, ContentPage> = {};
      data?.forEach((page) => { pagesMap[page.page_type] = page; });
      setContentPages(pagesMap);
      loadPageData(pagesMap);
    } catch (error) {
      console.error('Error fetching content pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPageData = (pages: Record<string, ContentPage>) => {
    if (pages.help_center) {
      const content = pages.help_center.content;
      setHelpCenterFAQs(content.sections?.[0]?.items || []);
      setHelpCenterContacts(content.sections?.[1]?.items || []);
    }
    if (pages.terms_of_service) {
      const content = pages.terms_of_service.content;
      setTermsLastUpdated(content.lastUpdated || '');
      setTermsSections(content.sections || []);
    }
    if (pages.privacy_policy) {
      const content = pages.privacy_policy.content;
      setPrivacyLastUpdated(content.lastUpdated || '');
      setPrivacySections(content.sections || []);
    }
  };

  const saveContent = async () => {
    try {
      setSaving(true);
      let content: any = {};
      if (selectedPage === 'help_center') {
        content = {
          sections: [
            { title: 'Frequently Asked Questions', items: helpCenterFAQs },
            { title: 'Contact Support', items: helpCenterContacts },
          ],
        };
      } else if (selectedPage === 'terms_of_service') {
        content = { lastUpdated: termsLastUpdated, sections: termsSections };
      } else if (selectedPage === 'privacy_policy') {
        content = { lastUpdated: privacyLastUpdated, sections: privacySections };
      }
      const { error } = await supabase
        .from('content_pages')
        .update({
          content,
          last_updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('page_type', selectedPage);
      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await fetchContentPages();
    } catch (error: any) {
      console.error('Error saving content:', error);
      if (Platform.OS === 'web') {
        window.alert(error.message || 'Failed to save content');
      }
    } finally {
      setSaving(false);
    }
  };

  const addFAQ = () => setHelpCenterFAQs([...helpCenterFAQs, { question: '', answer: '' }]);
  const updateFAQ = (index: number, field: 'question' | 'answer', value: string) => {
    const updated = [...helpCenterFAQs];
    updated[index][field] = value;
    setHelpCenterFAQs(updated);
  };
  const removeFAQ = (index: number) => setHelpCenterFAQs(helpCenterFAQs.filter((_, i) => i !== index));

  const addContact = () => setHelpCenterContacts([...helpCenterContacts, { type: 'email', label: '', value: '' }]);
  const updateContact = (index: number, field: 'type' | 'label' | 'value', value: string) => {
    const updated = [...helpCenterContacts];
    updated[index][field] = value;
    setHelpCenterContacts(updated);
  };
  const removeContact = (index: number) => setHelpCenterContacts(helpCenterContacts.filter((_, i) => i !== index));

  const addSection = (type: 'terms' | 'privacy') => {
    const newSection = { heading: '', content: '' };
    if (type === 'terms') setTermsSections([...termsSections, newSection]);
    else setPrivacySections([...privacySections, newSection]);
  };
  const updateSection = (type: 'terms' | 'privacy', index: number, field: 'heading' | 'content', value: string) => {
    if (type === 'terms') {
      const updated = [...termsSections];
      updated[index][field] = value;
      setTermsSections(updated);
    } else {
      const updated = [...privacySections];
      updated[index][field] = value;
      setPrivacySections(updated);
    }
  };
  const removeSection = (type: 'terms' | 'privacy', index: number) => {
    if (type === 'terms') setTermsSections(termsSections.filter((_, i) => i !== index));
    else setPrivacySections(privacySections.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff8c00" />
      </View>
    );
  }

  const renderHelpCenter = () => (
    <View style={styles.section}>
      <SectionHeader
        title="FAQs"
        count={helpCenterFAQs.length}
        onAdd={addFAQ}
        addLabel="Add FAQ"
      />
      {helpCenterFAQs.length === 0 && (
        <EmptyCard text="No FAQs yet. Add your first FAQ above." />
      )}
      {helpCenterFAQs.map((faq, index) => {
        const key = `faq-${index}`;
        const isCollapsed = collapsedCards.has(key);
        return (
          <View key={index} style={styles.card}>
            <TouchableOpacity style={styles.cardHeader} onPress={() => toggleCollapse(key)}>
              <View style={styles.cardNumberWrap}>
                <Text style={styles.cardNumber}>{index + 1}</Text>
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {faq.question || `FAQ ${index + 1}`}
              </Text>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => removeFAQ(index)}>
                <Trash2 size={14} color="#ef4444" />
              </TouchableOpacity>
              {isCollapsed ? <ChevronDown size={16} color="#8b909a" /> : <ChevronUp size={16} color="#8b909a" />}
            </TouchableOpacity>
            {!isCollapsed && (
              <View style={styles.cardBody}>
                <FieldInput label="Question" placeholder="Enter question" value={faq.question} onChangeText={(t) => updateFAQ(index, 'question', t)} />
                <FieldInput label="Answer" placeholder="Enter answer" value={faq.answer} onChangeText={(t) => updateFAQ(index, 'answer', t)} multiline />
              </View>
            )}
          </View>
        );
      })}

      <View style={styles.divider} />

      <SectionHeader
        title="Contact Support"
        count={helpCenterContacts.length}
        onAdd={addContact}
        addLabel="Add Contact"
      />
      {helpCenterContacts.length === 0 && (
        <EmptyCard text="No contact info yet. Add a contact method above." />
      )}
      {helpCenterContacts.map((contact, index) => {
        const key = `contact-${index}`;
        const isCollapsed = collapsedCards.has(key);
        return (
          <View key={index} style={styles.card}>
            <TouchableOpacity style={styles.cardHeader} onPress={() => toggleCollapse(key)}>
              <View style={styles.cardNumberWrap}>
                <Text style={styles.cardNumber}>{index + 1}</Text>
              </View>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {contact.label || `Contact ${index + 1}`}
              </Text>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => removeContact(index)}>
                <Trash2 size={14} color="#ef4444" />
              </TouchableOpacity>
              {isCollapsed ? <ChevronDown size={16} color="#8b909a" /> : <ChevronUp size={16} color="#8b909a" />}
            </TouchableOpacity>
            {!isCollapsed && (
              <View style={styles.cardBody}>
                <Text style={styles.fieldLabel}>Type</Text>
                <View style={styles.typeRow}>
                  {CONTACT_TYPES.map((ct) => {
                    const isActive = contact.type === ct.key;
                    const Icon = ct.icon;
                    return (
                      <TouchableOpacity
                        key={ct.key}
                        style={[styles.typeOption, isActive && styles.typeOptionActive]}
                        onPress={() => updateContact(index, 'type', ct.key)}
                      >
                        <Icon size={14} color={isActive ? '#ffffff' : '#8b909a'} />
                        <Text style={[styles.typeText, isActive && styles.typeTextActive]}>{ct.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <FieldInput label="Label" placeholder="e.g., Email Support" value={contact.label} onChangeText={(t) => updateContact(index, 'label', t)} />
                <FieldInput label="Value" placeholder="e.g., support@example.com" value={contact.value} onChangeText={(t) => updateContact(index, 'value', t)} />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );

  const renderSectionsPage = (type: 'terms' | 'privacy') => {
    const sections = type === 'terms' ? termsSections : privacySections;
    const lastUpdated = type === 'terms' ? termsLastUpdated : privacyLastUpdated;
    const setLastUpdated = type === 'terms' ? setTermsLastUpdated : setPrivacyLastUpdated;

    return (
      <View style={styles.section}>
        <View style={styles.dateCard}>
          <View style={styles.dateCardLeft}>
            <Calendar size={16} color="#ff8c00" />
            <Text style={styles.dateCardLabel}>Last Updated</Text>
          </View>
          <TextInput
            style={styles.dateInput}
            value={lastUpdated}
            onChangeText={setLastUpdated}
            placeholder="e.g., February 7, 2026"
            placeholderTextColor="#b0b5bf"
          />
        </View>

        <SectionHeader
          title="Sections"
          count={sections.length}
          onAdd={() => addSection(type)}
          addLabel="Add Section"
        />
        {sections.length === 0 && (
          <EmptyCard text="No sections yet. Add your first section above." />
        )}
        {sections.map((section, index) => {
          const key = `${type}-${index}`;
          const isCollapsed = collapsedCards.has(key);
          return (
            <View key={index} style={styles.card}>
              <TouchableOpacity style={styles.cardHeader} onPress={() => toggleCollapse(key)}>
                <View style={styles.cardNumberWrap}>
                  <Text style={styles.cardNumber}>{index + 1}</Text>
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {section.heading || `Section ${index + 1}`}
                </Text>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => removeSection(type, index)}>
                  <Trash2 size={14} color="#ef4444" />
                </TouchableOpacity>
                {isCollapsed ? <ChevronDown size={16} color="#8b909a" /> : <ChevronUp size={16} color="#8b909a" />}
              </TouchableOpacity>
              {!isCollapsed && (
                <View style={styles.cardBody}>
                  <FieldInput label="Heading" placeholder="Enter heading" value={section.heading} onChangeText={(t) => updateSection(type, index, 'heading', t)} />
                  <FieldInput label="Content" placeholder="Enter content" value={section.content} onChangeText={(t) => updateSection(type, index, 'content', t)} multiline />
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          {onBack && (
            <TouchableOpacity style={styles.backBtn} onPress={onBack}>
              <ArrowLeft size={20} color="#ff8c00" />
            </TouchableOpacity>
          )}
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Content</Text>
            <Text style={styles.headerSubtitle}>Manage app content pages</Text>
          </View>
        </View>

        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const isActive = selectedPage === tab.key;
            const Icon = tab.icon;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
                onPress={() => setSelectedPage(tab.key)}
              >
                <Icon size={16} color={isActive ? '#1e293b' : 'rgba(255,255,255,0.4)'} />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {selectedPage === 'help_center' && renderHelpCenter()}
        {selectedPage === 'terms_of_service' && renderSectionsPage('terms')}
        {selectedPage === 'privacy_policy' && renderSectionsPage('privacy')}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled, saved && styles.saveBtnSuccess]}
          onPress={saveContent}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              {saved ? <Check size={18} color="#ffffff" /> : <Save size={18} color="#ffffff" />}
              <Text style={styles.saveBtnText}>{saved ? 'Saved!' : 'Save Changes'}</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function SectionHeader({ title, count, onAdd, addLabel }: {
  title: string; count: number; onAdd: () => void; addLabel: string;
}) {
  return (
    <View style={sectionHeaderStyles.container}>
      <View style={sectionHeaderStyles.titleRow}>
        <Text style={sectionHeaderStyles.title}>{title}</Text>
        <View style={sectionHeaderStyles.countBadge}>
          <Text style={sectionHeaderStyles.countText}>{count}</Text>
        </View>
      </View>
      <TouchableOpacity style={sectionHeaderStyles.addBtn} onPress={onAdd}>
        <Plus size={14} color="#ffffff" />
        <Text style={sectionHeaderStyles.addBtnText}>{addLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <View style={emptyStyles.container}>
      <AlertCircle size={20} color="#d1d5db" />
      <Text style={emptyStyles.text}>{text}</Text>
    </View>
  );
}

function FieldInput({ label, placeholder, value, onChangeText, multiline }: {
  label: string; placeholder: string; value: string; onChangeText: (t: string) => void; multiline?: boolean;
}) {
  return (
    <View style={inputStyles.field}>
      <Text style={inputStyles.label}>{label}</Text>
      <TextInput
        style={[inputStyles.input, multiline && inputStyles.multiline]}
        placeholder={placeholder}
        placeholderTextColor="#b0b5bf"
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

const sectionHeaderStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontFamily: Fonts.headingBold,
    color: '#1e293b',
  },
  countBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countText: {
    fontSize: 12,
    fontFamily: Fonts.groteskBold,
    color: '#8b909a',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ff8c00',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addBtnText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },
});

const emptyStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8f9fb',
    padding: 20,
    borderRadius: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#e8ecf1',
    borderStyle: 'dashed',
  },
  text: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#8b909a',
    flex: 1,
  },
});

const inputStyles = StyleSheet.create({
  field: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#1e293b',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f8f9fb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e8ecf1',
    outlineStyle: 'none',
  } as any,
  multiline: {
    minHeight: 90,
    paddingTop: 12,
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
  header: {
    backgroundColor: '#1a1d23',
    paddingHorizontal: 20,
    paddingBottom: 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 140, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: Fonts.headingBold,
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: -1,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  tabItemActive: {
    backgroundColor: '#f8f9fb',
  },
  tabLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.4)',
  },
  tabLabelActive: {
    color: '#1e293b',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#e8ecf1',
    marginVertical: 16,
  },
  dateCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  dateCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dateCardLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#1e293b',
  },
  dateInput: {
    backgroundColor: '#f8f9fb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e8ecf1',
    outlineStyle: 'none',
  } as any,
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cardNumberWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardNumber: {
    fontSize: 12,
    fontFamily: Fonts.groteskBold,
    color: '#ff8c00',
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#1e293b',
    flex: 1,
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#1e293b',
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f8f9fb',
    borderWidth: 1.5,
    borderColor: '#e8ecf1',
  },
  typeOptionActive: {
    backgroundColor: '#ff8c00',
    borderColor: '#ff8c00',
  },
  typeText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#8b909a',
  },
  typeTextActive: {
    color: '#ffffff',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ff8c00',
    marginHorizontal: 16,
    marginBottom: 32,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#ff8c00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnSuccess: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
  },
  saveBtnText: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },
});
