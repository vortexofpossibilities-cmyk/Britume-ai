
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, FlatList, Image, KeyboardAvoidingView, Modal,
  PanResponder, Platform, Pressable, Text, TextInput, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabase';

type Message = { id: string; role: 'user' | 'assistant'; text: string };
type Conversation = { id: string; title: string; updated_at: string };

type Palette = {
  bg: string; surface: string; raised: string; text: string; muted: string;
  border: string; line: string; input: string; bubbleUser: string;
  bubbleAI: string; shadow: string; highlight: string; red: string; blue: string;
};

const LIGHT: Palette = {
  bg: '#FAFAF7', surface: '#F7F7F4', raised: '#FFFFFF', text: '#17191D',
  muted: '#777D86', border: '#E7E8E5', line: '#E4E5E1', input: '#F5F5F2',
  bubbleUser: '#FFFFFF', bubbleAI: '#F5F5F2', shadow: '#BFC2C5',
  highlight: '#FFFFFF', red: '#F04455', blue: '#347BFF',
};

const DARK: Palette = {
  bg: '#000000', surface: '#050505', raised: '#0A0A0A', text: '#F7F8FA',
  muted: '#9298A2', border: '#191919', line: '#171717', input: '#050505',
  bubbleUser: '#101010', bubbleAI: '#080808', shadow: '#000000',
  highlight: '#292929', red: '#FF4058', blue: '#438BFF',
};

function raised(p: Palette, radius = 20) {
  return {
    backgroundColor: p.raised,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: p.border,
    shadowColor: p.shadow,
    shadowOffset: { width: 5, height: 6 },
    shadowOpacity: 0.48,
    shadowRadius: 10,
    elevation: 7,
  } as const;
}

function inset(p: Palette, radius = 16) {
  return {
    backgroundColor: p.input,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: p.border,
    shadowColor: p.shadow,
    shadowOffset: { width: -2, height: -2 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 2,
  } as const;
}

export default function Chat() {
  const [darkMode, setDarkMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [messageEffectsEnabled, setMessageEffectsEnabled] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [researchMode, setResearchMode] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);

  const p = darkMode ? DARK : LIGHT;
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;
  const drawerX = useRef(new Animated.Value(-310)).current;
  const base = process.env.EXPO_PUBLIC_API_BASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

  const flash = useCallback(() => {
    if (!messageEffectsEnabled) return;
    pulse.stopAnimation();
    pulse.setValue(0);
    Animated.sequence([
      Animated.timing(pulse, {
        toValue: 0.16, duration: 90, useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 0, duration: 360, useNativeDriver: true,
      }),
    ]).start();
  }, [pulse, messageEffectsEnabled]);

  const api = useCallback(async (path: string, init: RequestInit = {}) => {
    if (!base) throw new Error('Connect the secure BRITUME backend first.');
    if (!anonKey) {
      throw new Error('Supabase public API key is missing. Please check the website configuration.');
    }

    const { data: { session } } = await supabase!.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Your session expired. Please sign in again.');
    }

    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
        ...(init.headers || {}),
      },
    });

    if (response.status === 204) return null;

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error ?? `BRITUME service returned ${response.status}`);
    }

    return data;
  }, [base, anonKey]);

  const refreshConversations = useCallback(async (silent = false) => {
    setLoadingHistory(!silent);
    try {
      const data = await api('/conversations');
      setConversations(data?.conversations ?? []);
    } catch (e: any) {
      if (!silent) Alert.alert('History unavailable', e.message);
    } finally {
      if (!silent) setLoadingHistory(false);
    }
  }, [api]);

  function openHistory() {
    setShowHistory(true);
    void refreshConversations();
    Animated.spring(drawerX, {
      toValue: 0, useNativeDriver: true, tension: 65, friction: 12,
    }).start();
  }

  function closeHistory() {
    Animated.timing(drawerX, {
      toValue: -310, duration: 220, useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setShowHistory(false);
    });
  }

  const swipeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dx > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > 65 && gesture.x0 < 55) openHistory();
      },
    })
  ).current;

  useEffect(() => {
    if (!supabase) {
      router.replace('/auth');
      return;
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace('/auth');
        return;
      }
      await refreshConversations();
    });
  }, [refreshConversations]);

  function startNewConversation() {
    setConversationId(null);
    setMessages([]);
    setInput('');
    closeHistory();
    setShowSettings(false);
  }

  async function openConversation(item: Conversation) {
    closeHistory();
    setLoadingHistory(true);
    try {
      const data = await api(`/conversations/${item.id}/messages`);
      setConversationId(item.id);
      setMessages((data?.messages ?? []).map((m: any) => ({
        id: m.id,
        role: m.role,
        text: m.content ?? m.text,
      })));
    } catch (e: any) {
      Alert.alert('Could not open chat', e.message);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function deleteConversation(item: Conversation) {
    Alert.alert(
      'Delete conversation',
      'Delete this conversation and its messages?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api(`/conversations/${item.id}`, { method: 'DELETE' });
              if (conversationId === item.id) {
                setConversationId(null);
                setMessages([]);
              }
              await refreshConversations();
            } catch (e: any) {
              Alert.alert('Could not delete chat', e.message);
            }
          },
        },
      ]
    );
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput('');
    flash();

    setMessages(current => [
      ...current,
      { id: `local-${Date.now()}`, role: 'user', text },
    ]);

    try {
      let activeId = conversationId;

      if (!activeId) {
        const created = await api('/conversations', {
          method: 'POST',
          body: JSON.stringify({ title: text.slice(0, 60) }),
        });

        activeId =
          created?.conversation?.id ??
          created?.data?.conversation?.id ??
          created?.data?.id ??
          created?.id;

        if (!activeId) {
          throw new Error('Backend did not return a conversation ID. Please check Supabase.');
        }

        setConversationId(activeId);
      }

      const data = researchMode
        ? await api('/research', {
            method: 'POST',
            body: JSON.stringify({
              conversationId: activeId,
              question: text.replace(/https?:\/\/\S+/i, '').trim() ||
                'Summarize this webpage and identify its key points.',
              url: (text.match(/https?:\/\/\S+/i)?.[0] || '').replace(/[),.]+$/, ''),
            }),
          })
        : await api('/chat', {
            method: 'POST',
            body: JSON.stringify({
              conversationId: activeId,
              messages: [...messages, { role: 'user', text }].map(
                ({ role, text: content }) => ({ role, content })
              ),
            }),
          });

      setResearchMode(false);

      setMessages(current => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: data.reply ?? 'I could not read the response.',
        },
      ]);

      flash();
      void refreshConversations(true);
    } catch (e: any) {
      setMessages(current => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          text: `BRITUME setup: ${e.message}`,
        },
      ]);
      flash();
    } finally {
      setSending(false);
    }
  }

  async function toggleRecording() {
    if (transcribing) return;

    try {
      if (!recordingRef.current) {
        const permission = await Audio.requestPermissionsAsync();

        if (!permission.granted) {
          Alert.alert('Microphone permission', 'Allow microphone access to dictate a message.');
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
        });

        const created = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );

        recordingRef.current = created.recording;
        setRecording(true);
        return;
      }

      const current = recordingRef.current;
      setRecording(false);
      setTranscribing(true);

      await current.stopAndUnloadAsync();
      const uri = current.getURI();
      recordingRef.current = null;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (!uri) throw new Error('The recording could not be opened.');

      const { data: { session } } = await supabase!.auth.getSession();

      if (!session?.access_token || !base) {
        throw new Error('Sign in and connect the BRITUME backend first.');
      }

      if (Platform.OS === 'web') {
        const blob = await (await fetch(uri)).blob();
        const form = new FormData();
        form.append('file', blob, 'britume-voice.webm');

        const response = await fetch(`${base}/audio/transcriptions`, {
          method: 'POST',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: form,
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) throw new Error(data.error || 'Voice transcription failed.');

        setInput(old => old ? `${old} ${data.text || ''}` : (data.text || ''));
      } else {
        const upload = await FileSystem.uploadAsync(
          `${base}/audio/transcriptions`, uri, {
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.MULTIPART,
            fieldName: 'file',
            mimeType: 'audio/m4a',
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        const parsed = JSON.parse(upload.body || '{}');

        if (upload.status < 200 || upload.status >= 300) {
          throw new Error(parsed.error || 'Voice transcription failed.');
        }

        setInput(old => old ? `${old} ${parsed.text || ''}` : (parsed.text || ''));
      }
    } catch (e: any) {
      Alert.alert('Voice typing', e.message || 'Could not record audio.');
      recordingRef.current = null;
      setRecording(false);

      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
      } catch {}
    } finally {
      setTranscribing(false);
    }
  }

  async function generateImage() {
    const prompt = imagePrompt.trim();
    if (!prompt || generatingImage) return;

    setGeneratingImage(true);
    setGeneratedImage(null);

    try {
      const data = await api('/images/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      });

      if (!data?.image) throw new Error('No image was returned.');

      setGeneratedImage(`data:${data.mimeType || 'image/png'};base64,${data.image}`);
      setImageMode(false);
    } catch (e: any) {
      Alert.alert('Image generation', e.message || 'Could not generate the image.');
    } finally {
      setGeneratingImage(false);
    }
  }

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to attach an image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled) {
      Alert.alert(
        'Image selected',
        'Image picker is ready. Secure image analysis is coming in a later milestone.'
      );
    }
  }

  async function pickDocument() {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
    });

    if (!result.canceled) {
      Alert.alert(
        'Document selected',
        `${result.assets[0].name} is selected. Secure document analysis is coming in a later milestone.`
      );
    }
  }

  async function signOut() {
    setShowSettings(false);
    await supabase?.auth.signOut();
    router.replace('/auth');
  }

  const actionText = {
    color: p.text,
    fontSize: 12,
    fontWeight: '700' as const,
  };

  const actionStyle = {
    ...raised(p, 13),
    paddingHorizontal: 11,
    paddingVertical: 9,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  };

  return (
    <KeyboardAvoidingView
      {...swipeResponder.panHandlers}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: p.bg }}
    >
      <StatusBar style={darkMode ? 'light' : 'dark'} />

      <View style={{
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'web' ? 18 : 54,
        paddingBottom: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{
            width: 4, height: 25, borderRadius: 4,
            backgroundColor: p.red, marginRight: 4,
          }} />
          <View style={{
            width: 4, height: 25, borderRadius: 4,
            backgroundColor: p.blue, marginRight: 9,
          }} />
          <Text style={{
            color: p.text, fontWeight: '900',
            letterSpacing: 2.2, fontSize: 19,
          }}>
            BRITUME
          </Text>
        </View>

        <Pressable
          onPress={() => setShowSettings(true)}
          style={{ ...actionStyle, paddingHorizontal: 16, paddingVertical: 12 }}
        >
          <Text style={{ ...actionText, fontSize: 18 }}>⚙</Text>
        </Pressable>
      </View>

      <View style={{
        height: 1, backgroundColor: p.line, marginHorizontal: 16,
      }} />

      {messages.length === 0 ? (
        <View style={{
          flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28,
        }}>
          <View style={{
            ...raised(p, 30),
            paddingHorizontal: 28, paddingVertical: 30,
            alignItems: 'center', maxWidth: 340,
          }}>
            <View style={{
              width: 48, height: 5, borderRadius: 5,
              backgroundColor: p.red, marginBottom: 5, alignSelf: 'flex-start',
            }} />
            <View style={{
              width: 48, height: 5, borderRadius: 5,
              backgroundColor: p.blue, marginBottom: 22, alignSelf: 'flex-start',
            }} />
            <Text style={{
              color: p.text, fontSize: 28, fontWeight: '800',
              textAlign: 'center', marginBottom: 12,
            }}>
              Hello, I'm BRITUME.
            </Text>
            <Text style={{
              color: p.muted, fontSize: 15,
              textAlign: 'center', lineHeight: 24,
            }}>
              Brilliance of Possibilities.{"\n"}
              Your conversations are saved securely so you can return to them on your devices.
            </Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={{ padding: 18, gap: 15, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View style={{
              ...raised(p, 22),
              alignSelf: item.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '88%', padding: 15,
              borderTopWidth: 2,
              borderTopColor: item.role === 'user' ? p.blue : p.highlight,
            }}>
              <View style={{
                height: 3, width: 34, borderRadius: 3,
                backgroundColor: item.role === 'user' ? p.blue : p.red,
                opacity: 0.75, marginBottom: 8,
              }} />
              <Text style={{ color: p.text, lineHeight: 23 }}>
                {item.text}
              </Text>
            </View>
          )}
          ListFooterComponent={sending ? (
            <View style={{
              ...raised(p, 18), alignSelf: 'flex-start',
              paddingHorizontal: 17, paddingVertical: 12,
            }}>
              <Text style={{ color: p.muted }}>BRITUME is thinking…</Text>
            </View>
          ) : null}
        />
      )}

      {generatedImage && (
        <View style={{
          ...raised(p, 20), marginHorizontal: 16, padding: 12,
        }}>
          <Text style={{
            color: p.blue, fontWeight: '800', marginBottom: 8,
          }}>
            GENERATED IMAGE
          </Text>
          <Image
            source={{ uri: generatedImage }}
            resizeMode="contain"
            style={{ width: '100%', height: 250, borderRadius: 15 }}
          />
          <Pressable onPress={() => setGeneratedImage(null)}>
            <Text style={{ color: p.muted, marginTop: 8 }}>Close preview</Text>
          </Pressable>
        </View>
      )}

      <View style={{
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: Platform.OS === 'web' ? 14 : 24,
      }}>
        <View style={{ ...raised(p, 25), padding: 13 }}>
          <View style={{
            height: 2, backgroundColor: p.highlight,
            borderRadius: 2, marginHorizontal: 12,
            marginBottom: 10, opacity: 0.8,
          }} />

          {imageMode && (
            <View style={{ marginBottom: 10 }}>
              <Text style={{
                color: p.blue, fontWeight: '800', marginBottom: 7,
              }}>
                IMAGE GENERATOR
              </Text>
              <TextInput
                value={imagePrompt}
                onChangeText={setImagePrompt}
                placeholder="Describe the image you want…"
                placeholderTextColor={p.muted}
                multiline
                style={{
                  ...inset(p, 15), color: p.text,
                  minHeight: 54, maxHeight: 100, padding: 12,
                }}
              />
              <View style={{
                flexDirection: 'row', justifyContent: 'flex-end',
                gap: 10, marginTop: 9,
              }}>
                <Pressable onPress={() => setImageMode(false)} style={actionStyle}>
                  <Text style={actionText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={generateImage}
                  disabled={generatingImage || !imagePrompt.trim()}
                  style={{
                    ...actionStyle, backgroundColor: p.red,
                    opacity: generatingImage || !imagePrompt.trim() ? 0.45 : 1,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>
                    {generatingImage ? 'Creating…' : 'Generate'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={researchMode
              ? 'Research a topic or paste a webpage URL…'
              : 'Ask BRITUME anything…'}
            placeholderTextColor={p.muted}
            multiline
            style={{
              ...inset(p, 17), color: p.text,
              minHeight: 48, maxHeight: 120, fontSize: 16,
              paddingHorizontal: 13, paddingVertical: 11,
            }}
          />

          <View style={{
            flexDirection: 'row', justifyContent: 'space-between',
            alignItems: 'center', marginTop: 12, gap: 7,
          }}>
            <View style={{
              flexDirection: 'row', flexWrap: 'wrap', gap: 7, flex: 1,
            }}>
              <Pressable onPress={pickImage} style={actionStyle}>
                <Text style={actionText}>▧ Photo</Text>
              </Pressable>
              <Pressable onPress={pickDocument} style={actionStyle}>
                <Text style={actionText}>＋ File</Text>
              </Pressable>
              <Pressable
                onPress={toggleRecording}
                disabled={transcribing}
                style={actionStyle}
              >
                <Text style={{
                  ...actionText, color: recording ? p.red : p.text,
                }}>
                  {recording ? '■ Stop' : transcribing ? '…' : '◉ Voice'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setImageMode(value => !value)}
                style={actionStyle}
              >
                <Text style={{ ...actionText, color: p.blue }}>Image</Text>
              </Pressable>
              <Pressable
                onPress={() => setResearchMode(value => !value)}
                style={actionStyle}
              >
                <Text style={{
                  ...actionText, color: researchMode ? p.red : p.blue,
                }}>
                  Web
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={send}
              disabled={sending || !input.trim()}
              style={{
                ...raised(p, 16), backgroundColor: p.blue,
                borderColor: p.blue, paddingHorizontal: 17,
                paddingVertical: 13,
                opacity: sending || !input.trim() ? 0.45 : 1,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>
                {sending ? '…' : researchMode ? 'Research ↗' : 'Send ↑'}
              </Text>
            </Pressable>
          </View>
        </View>

        <Text style={{
          color: p.muted, opacity: 0.75, fontSize: 10,
          textAlign: 'center', marginTop: 10,
        }}>
          BRITUME can make mistakes. Check important information.
        </Text>
      </View>

      {showHistory && (
        <View style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
          backgroundColor: 'rgba(0,0,0,0.42)', zIndex: 20,
          flexDirection: 'row',
        }}>
          <Pressable onPress={closeHistory} style={{ flex: 1 }} />

          <Animated.View style={{
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: 310, maxWidth: '86%',
            backgroundColor: p.bg,
            paddingTop: Platform.OS === 'web' ? 22 : 55,
            paddingHorizontal: 17,
            borderRightWidth: 1,
            borderColor: p.border,
            transform: [{ translateX: drawerX }],
          }}>
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 20,
            }}>
              <Text style={{
                color: p.text, fontSize: 21, fontWeight: '900',
              }}>
                History
              </Text>
              <Pressable onPress={closeHistory} style={actionStyle}>
                <Text style={actionText}>✕</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={startNewConversation}
              style={{
                ...raised(p, 15), padding: 14,
                marginBottom: 18, alignItems: 'center',
              }}
            >
              <Text style={{ color: p.blue, fontWeight: '900' }}>
                ＋ New conversation
              </Text>
            </Pressable>

            {loadingHistory ? (
              <Text style={{ color: p.muted }}>Loading history…</Text>
            ) : conversations.length === 0 ? (
              <Text style={{ color: p.muted }}>
                Your saved conversations will appear here.
              </Text>
            ) : (
              <FlatList
                data={conversations}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <View style={{
                    ...raised(p, 15), padding: 13,
                    marginBottom: 11, flexDirection: 'row',
                    alignItems: 'center', gap: 8,
                  }}>
                    <Pressable
                      onPress={() => openConversation(item)}
                      style={{ flex: 1 }}
                    >
                      <Text
                        numberOfLines={2}
                        style={{
                          color: p.text, fontSize: 14, fontWeight: '700',
                        }}
                      >
                        {item.title}
                      </Text>
                      <Text style={{
                        color: p.muted, fontSize: 10, marginTop: 5,
                      }}>
                        {new Date(item.updated_at).toLocaleString()}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => deleteConversation(item)}>
                      <Text style={{ color: p.red, padding: 5 }}>Delete</Text>
                    </Pressable>
                  </View>
                )}
              />
            )}
          </Animated.View>
        </View>
      )}

      <Modal
        visible={showSettings}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
          justifyContent: 'center', alignItems: 'center', padding: 20,
        }}>
          <View style={{
            ...raised(p, 27), width: '100%', maxWidth: 390, padding: 21,
            maxHeight: '88%',
          }}>
            <View style={{
              flexDirection: 'row', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 20,
            }}>
              <Text style={{
                color: p.text, fontSize: 24, fontWeight: '900',
              }}>
                Settings
              </Text>
              <Pressable
                onPress={() => setShowSettings(false)}
                style={actionStyle}
              >
                <Text style={actionText}>✕</Text>
              </Pressable>
            </View>

            <Text style={{
              color: p.blue, fontSize: 12, fontWeight: '900',
              letterSpacing: 1.4, marginBottom: 10,
            }}>
              APPEARANCE
            </Text>

            <View style={{
              ...raised(p, 17), padding: 14, marginBottom: 15,
              flexDirection: 'row', alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{
                  color: p.text, fontSize: 15, fontWeight: '800',
                }}>
                  {darkMode ? 'Pure black mode' : 'Milk white mode'}
                </Text>
                <Text style={{
                  color: p.muted, fontSize: 12, marginTop: 4,
                }}>
                  {darkMode ? 'Dark neumorphism' : 'Light neumorphism'}
                </Text>
              </View>
              <Pressable
                onPress={() => setDarkMode(value => !value)}
                style={{
                  ...raised(p, 13), backgroundColor: p.blue,
                  borderColor: p.blue, paddingHorizontal: 14, paddingVertical: 10,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>
                  {darkMode ? '☀ Light' : '◐ Dark'}
                </Text>
              </Pressable>
            </View>

            <Text style={{
              color: p.blue, fontSize: 12, fontWeight: '900',
              letterSpacing: 1.4, marginBottom: 10,
            }}>
              MESSAGE EFFECTS
            </Text>

            <View style={{
              ...raised(p, 17), padding: 14, marginBottom: 18,
              flexDirection: 'row', alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <View style={{ flex: 1 }}>
                <Text style={{
                  color: p.text, fontSize: 15, fontWeight: '800',
                }}>
                  Red and blue flash
                </Text>
                <Text style={{
                  color: p.muted, fontSize: 12, marginTop: 4,
                }}>
                  Flash when messages are sent or received.
                </Text>
              </View>
              <Pressable
                onPress={() => setMessageEffectsEnabled(value => !value)}
                style={{
                  ...raised(p, 13),
                  backgroundColor: messageEffectsEnabled ? p.blue : p.surface,
                  borderColor: messageEffectsEnabled ? p.blue : p.border,
                  paddingHorizontal: 15, paddingVertical: 10,
                }}
              >
                <Text style={{
                  color: messageEffectsEnabled ? '#FFFFFF' : p.text,
                  fontWeight: '900',
                }}>
                  {messageEffectsEnabled ? 'ON' : 'OFF'}
                </Text>
              </Pressable>
            </View>

            <Text style={{
              color: p.blue, fontSize: 12, fontWeight: '900',
              letterSpacing: 1.4, marginBottom: 10,
            }}>
              CHAT
            </Text>

            <Pressable
              onPress={() => {
                setShowSettings(false);
                openHistory();
              }}
              style={{
                ...raised(p, 15), padding: 14, marginBottom: 11,
                flexDirection: 'row', alignItems: 'center',
              }}
            >
              <Text style={{
                color: p.text, fontWeight: '800', fontSize: 15,
              }}>
                ☷  Conversation history
              </Text>
            </Pressable>

            <Pressable
              onPress={startNewConversation}
              style={{
                ...raised(p, 15), padding: 14, marginBottom: 11,
                flexDirection: 'row', alignItems: 'center',
              }}
            >
              <Text style={{
                color: p.text, fontWeight: '800', fontSize: 15,
              }}>
                ＋  New chat
              </Text>
            </Pressable>

            <Pressable
              onPress={signOut}
              style={{
                ...raised(p, 15), padding: 14, marginBottom: 18,
                flexDirection: 'row', alignItems: 'center',
              }}
            >
              <Text style={{
                color: p.red, fontWeight: '800', fontSize: 15,
              }}>
                ⇥  Sign out
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setShowSettings(false)}
              style={{
                ...raised(p, 15), backgroundColor: p.blue,
                borderColor: p.blue, padding: 14, alignItems: 'center',
              }}
            >
              <Text style={{
                color: '#FFFFFF', fontWeight: '900', fontSize: 15,
              }}>
                Done
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, bottom: 0,
          left: 0, right: 0, opacity: pulse,
        }}
      >
        <View style={{
          position: 'absolute', top: 0, bottom: 0,
          left: 0, width: '22%', backgroundColor: p.red,
        }} />
        <View style={{
          position: 'absolute', top: 0, bottom: 0,
          right: 0, width: '22%', backgroundColor: p.blue,
        }} />
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
