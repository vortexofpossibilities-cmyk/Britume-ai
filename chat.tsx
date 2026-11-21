import { useEffect, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabase';

const bg = '#17191E', panel = '#252A33', white = '#F4F5F7', muted = '#A5ABB6', red = '#E05252', blue = '#4D91E8';
type Message = { id: string; role: 'user'|'assistant'; text: string };

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!supabase) { router.replace('/auth'); return; }
    supabase.auth.getSession().then(({ data }) => { if (!data.session) router.replace('/auth'); });
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const next: Message[] = [...messages, { id: String(Date.now()), role: 'user', text }];
    setMessages(next); setInput(''); setSending(true);
    const base = process.env.EXPO_PUBLIC_API_BASE_URL;
    try {
      if (!base) throw new Error('Connect the secure BRITUME backend to enable AI responses.');
      const { data: { session } } = await supabase!.auth.getSession();
      const response = await fetch(`${base}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ messages: next.map(({ role, text }) => ({ role, content: text })) })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? `AI service returned ${response.status}`);
      setMessages([...next, { id: String(Date.now()+1), role: 'assistant', text: data.reply ?? 'I could not read the response.' }]);
    } catch (e: any) {
      setMessages([...next, { id: String(Date.now()+1), role: 'assistant', text: `BRITUME setup: ${e.message}` }]);
    } finally { setSending(false); }
  }

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Permission needed', 'Allow photo access to attach an image.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .8 });
    if (!result.canceled) Alert.alert('Image selected', 'Image picker is ready. Connect the secure upload endpoint to analyse this image.');
  }
  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!result.canceled) Alert.alert('Document selected', `${result.assets[0].name} is selected. Connect secure file processing to analyse it.`);
  }
  async function signOut() { await supabase?.auth.signOut(); router.replace('/auth'); }

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: bg }}>
    <View style={{ paddingHorizontal: 20, paddingTop: Platform.OS === 'web' ? 22 : 58, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#303641', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 3, height: 25, backgroundColor: red, marginRight: 5 }} /><View style={{ width: 3, height: 25, backgroundColor: blue, marginRight: 10 }} />
        <Text style={{ color: white, fontWeight: '800', letterSpacing: 2, fontSize: 20 }}>BRITUME</Text>
      </View>
      <Pressable onPress={signOut}><Text style={{ color: muted }}>Sign out</Text></Pressable>
    </View>
    {messages.length === 0 ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 }}>
      <Text style={{ color: white, fontSize: 29, fontWeight: '700', textAlign: 'center', marginBottom: 12 }}>Hello, I'm BRITUME.</Text>
      <Text style={{ color: muted, fontSize: 16, textAlign: 'center', lineHeight: 25 }}>Brilliance of Possibilities.{'\n'}I'm here to help you learn, create, solve problems and explore ideas. What shall we do today?</Text>
    </View> : <FlatList data={messages} keyExtractor={m => m.id} contentContainerStyle={{ padding: 18, gap: 16 }} renderItem={({ item }) =>
      <View style={{ alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', backgroundColor: item.role === 'user' ? '#303946' : '#20242B', borderRadius: 16, padding: 14, borderLeftWidth: item.role === 'assistant' ? 2 : 0, borderLeftColor: blue }}>
        <Text style={{ color: item.role === 'user' ? white : '#D7DCE4', lineHeight: 23 }}>{item.text}</Text>
      </View>
    } />}
    <View style={{ padding: 14, paddingBottom: Platform.OS === 'web' ? 16 : 26 }}>
      <View style={{ backgroundColor: panel, borderRadius: 18, borderWidth: 1, borderColor: '#3A414D', padding: 12 }}>
        <TextInput value={input} onChangeText={setInput} placeholder="Ask BRITUME anything…" placeholderTextColor="#818A98" multiline style={{ color: white, minHeight: 42, maxHeight: 120, fontSize: 16, padding: 4 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <View style={{ flexDirection: 'row', gap: 18 }}>
            <Pressable onPress={pickImage}><Text style={{ color: muted, fontSize: 20 }}>▧</Text></Pressable>
            <Pressable onPress={pickDocument}><Text style={{ color: muted, fontSize: 20 }}>＋</Text></Pressable>
            <Pressable onPress={() => Alert.alert('Voice typing', 'Microphone transcription will be connected in the next build step.')}><Text style={{ color: red, fontSize: 19 }}>◉</Text></Pressable>
          </View>
          <Pressable onPress={send} disabled={sending || !input.trim()} style={{ backgroundColor: blue, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, opacity: sending || !input.trim() ? .45 : 1 }}>
            <Text style={{ color: 'white', fontWeight: '700' }}>{sending ? '…' : 'Send ↑'}</Text>
          </Pressable>
        </View>
      </View>
      <Text style={{ color: '#68717E', fontSize: 10, textAlign: 'center', marginTop: 9 }}>BRITUME can make mistakes. Check important information.</Text>
    </View>
  </KeyboardAvoidingView>;
}
