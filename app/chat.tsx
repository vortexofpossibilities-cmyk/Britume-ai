import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabase';

const bg = '#17191E', panel = '#252A33', white = '#F4F5F7', muted = '#A5ABB6', red = '#E05252', blue = '#4D91E8';
type Message = { id: string; role: 'user'|'assistant'; text: string };
type Conversation = { id: string; title: string; updated_at: string };

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const base = process.env.EXPO_PUBLIC_API_BASE_URL;

  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    if (!base) throw new Error('Connect the secure BRITUME backend first.');
    const { data: { session } } = await supabase!.auth.getSession();
    if (!session?.access_token) throw new Error('Your session expired. Please sign in again.');
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...(init.headers || {}) },
    });
    if (response.status === 204) return null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? `BRITUME service returned ${response.status}`);
    return data;
  }, [base]);

  const refreshConversations = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const data = await api('/conversations');
      setConversations(data?.conversations ?? []);
    } catch (e: any) {
      Alert.alert('History unavailable', e.message);
    } finally { setLoadingHistory(false); }
  }, [api]);

  useEffect(() => {
    if (!supabase) { router.replace('/auth'); return; }
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.replace('/auth'); return; }
      await refreshConversations();
    });
  }, [refreshConversations]);

  async function startNewConversation() {
    setConversationId(null); setMessages([]); setInput(''); setShowHistory(false);
  }

  async function openConversation(item: Conversation) {
    setShowHistory(false); setLoadingHistory(true);
    try {
      const data = await api(`/conversations/${item.id}/messages`);
      setConversationId(item.id);
      setMessages((data?.messages ?? []).map((m: any) => ({ id: m.id, role: m.role, text: m.content ?? m.text })));
    } catch (e: any) { Alert.alert('Could not open chat', e.message); }
    finally { setLoadingHistory(false); }
  }

  async function deleteConversation(item: Conversation) {
    const remove = async () => {
      try {
        await api(`/conversations/${item.id}`, { method: 'DELETE' });
        if (conversationId === item.id) { setConversationId(null); setMessages([]); }
        await refreshConversations();
      } catch (e: any) { Alert.alert('Could not delete chat', e.message); }
    };
    if (Platform.OS === 'web') {
      // Keep the action explicit without relying on a browser-only confirmation API.
      Alert.alert('Delete conversation', 'Delete this conversation and its messages?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: remove }]);
    } else {
      Alert.alert('Delete conversation', 'Delete this conversation and its messages?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: remove }]);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true); setInput('');
    const optimistic: Message[] = [...messages, { id: `local-${Date.now()}`, role: 'user', text }];
    setMessages(optimistic);
    try {
      let activeId = conversationId;
      if (!activeId) {
        const created = await api('/conversations', { method: 'POST', body: JSON.stringify({ title: text.slice(0, 60) }) });
        activeId = created.conversation.id;
        setConversationId(activeId);
      }
      const data = await api('/chat', {
        method: 'POST',
        body: JSON.stringify({ conversationId: activeId, messages: [...messages, { role: 'user', text }].map(({ role, text: content }) => ({ role, content })) }),
      });
      setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', text: data.reply ?? 'I could not read the response.' }]);
      await refreshConversations();
    } catch (e: any) {
      setMessages((current) => [...current, { id: `error-${Date.now()}`, role: 'assistant', text: `BRITUME setup: ${e.message}` }]);
    } finally { setSending(false); }
  }

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Permission needed', 'Allow photo access to attach an image.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .8 });
    if (!result.canceled) Alert.alert('Image selected', 'Image picker is ready. Secure image analysis is coming in a later milestone.');
  }
  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!result.canceled) Alert.alert('Document selected', `${result.assets[0].name} is selected. Secure document analysis is coming in a later milestone.`);
  }
  async function signOut() { await supabase?.auth.signOut(); router.replace('/auth'); }

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: bg }}>
    <View style={{ paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 22 : 58, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#303641', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 3, height: 25, backgroundColor: red, marginRight: 5 }} /><View style={{ width: 3, height: 25, backgroundColor: blue, marginRight: 10 }} />
        <Text style={{ color: white, fontWeight: '800', letterSpacing: 2, fontSize: 20 }}>BRITUME</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Pressable onPress={() => { setShowHistory(!showHistory); if (!showHistory) refreshConversations(); }}><Text style={{ color: blue, fontWeight: '600' }}>History</Text></Pressable>
        <Pressable onPress={startNewConversation}><Text style={{ color: white, fontWeight: '600' }}>＋ New</Text></Pressable>
        <Pressable onPress={signOut}><Text style={{ color: muted }}>Sign out</Text></Pressable>
      </View>
    </View>

    {showHistory ? <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ color: white, fontSize: 22, fontWeight: '700', marginBottom: 16 }}>Your conversations</Text>
      {loadingHistory ? <Text style={{ color: muted }}>Loading history…</Text> : conversations.length === 0 ? <Text style={{ color: muted }}>Your saved conversations will appear here.</Text> : <FlatList data={conversations} keyExtractor={item => item.id} renderItem={({ item }) =>
        <View style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#303641', paddingVertical: 14, gap: 12 }}>
          <Pressable onPress={() => openConversation(item)} style={{ flex: 1 }}><Text numberOfLines={1} style={{ color: white, fontSize: 15 }}>{item.title}</Text><Text style={{ color: muted, fontSize: 11, marginTop: 4 }}>{new Date(item.updated_at).toLocaleString()}</Text></Pressable>
          <Pressable onPress={() => deleteConversation(item)}><Text style={{ color: red, padding: 8 }}>Delete</Text></Pressable>
        </View>
      } />}
    </View> : messages.length === 0 ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 }}>
      <Text style={{ color: white, fontSize: 29, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>Hello, I'm BRITUME.</Text>
      <Text style={{ color: muted, fontSize: 16, textAlign: 'center', lineHeight: 25 }}>Brilliance of Possibilities.{'\n'}Your conversations are saved securely so you can return to them on your devices.</Text>
    </View> : <FlatList data={messages} keyExtractor={m => m.id} contentContainerStyle={{ padding: 18, gap: 16 }} renderItem={({ item }) =>
      <View style={{ alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', backgroundColor: item.role === 'user' ? '#303946' : '#20242B', borderRadius: 16, padding: 14, borderLeftWidth: item.role === 'assistant' ? 2 : 0, borderLeftColor: blue }}>
        <Text style={{ color: item.role === 'user' ? white : '#D7DCE4', lineHeight: 23 }}>{item.text}</Text>
      </View>
    } />}

    {!showHistory && <View style={{ padding: 14, paddingBottom: Platform.OS === 'web' ? 16 : 26 }}>
      <View style={{ backgroundColor: panel, borderRadius: 18, borderWidth: 1, borderColor: '#3A414D', padding: 12 }}>
        <TextInput value={input} onChangeText={setInput} placeholder="Ask BRITUME anything…" placeholderTextColor="#818A98" multiline style={{ color: white, minHeight: 42, maxHeight: 120, fontSize: 16, padding: 4 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <View style={{ flexDirection: 'row', gap: 18 }}>
            <Pressable onPress={pickImage}><Text style={{ color: muted, fontSize: 20 }}>▧</Text></Pressable>
            <Pressable onPress={pickDocument}><Text style={{ color: muted, fontSize: 20 }}>＋</Text></Pressable>
            <Pressable onPress={() => Alert.alert('Voice typing', 'Microphone transcription will be connected in a later build step.')}><Text style={{ color: red, fontSize: 19 }}>◉</Text></Pressable>
          </View>
          <Pressable onPress={send} disabled={sending || !input.trim()} style={{ backgroundColor: blue, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, opacity: sending || !input.trim() ? .45 : 1 }}>
            <Text style={{ color: 'white', fontWeight: '700' }}>{sending ? '…' : 'Send ↑'}</Text>
          </Pressable>
        </View>
      </View>
      <Text style={{ color: '#68717E', fontSize: 10, textAlign: 'center', marginTop: 9 }}>BRITUME can make mistakes. Check important information.</Text>
    </View>}
  </KeyboardAvoidingView>;
}
