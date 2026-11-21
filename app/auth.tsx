import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase, hasAuthConfig } from '../lib/supabase';

const bg = '#17191E', panel = '#242831', white = '#F4F5F7', muted = '#A5ABB6', red = '#E05252', blue = '#4D91E8';

export default function Auth() {
  const [mode, setMode] = useState<'signin'|'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || password.length < 8) {
      Alert.alert('Check your details', 'Enter your email and a password with at least 8 characters.');
      return;
    }
    if (!supabase) {
      Alert.alert('Setup needed', 'Add your Supabase URL and anon key to the .env file. See README.md.');
      return;
    }
    setBusy(true);
    const result = mode === 'signup'
      ? await supabase.auth.signUp({ email: email.trim(), password })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (result.error) Alert.alert('Could not continue', result.error.message);
    else if (mode === 'signup' && !result.data.session) Alert.alert('Check your email', 'Confirm your email address, then sign in.');
    else router.replace('/chat');
  }

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: bg, justifyContent: 'center', padding: 24 }}>
    <View style={{ maxWidth: 440, width: '100%', alignSelf: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 42 }}>
        <View style={{ width: 4, height: 34, backgroundColor: red, marginRight: 7, borderRadius: 4 }} />
        <View style={{ width: 4, height: 34, backgroundColor: blue, marginRight: 14, borderRadius: 4 }} />
        <Text style={{ color: white, fontSize: 27, fontWeight: '800', letterSpacing: 3 }}>BRITUME</Text>
      </View>
      <Text style={{ color: white, fontSize: 29, fontWeight: '700', marginBottom: 8 }}>{mode === 'signup' ? 'Create your account.' : 'Welcome back.'}</Text>
      <Text style={{ color: muted, fontSize: 15, lineHeight: 23, marginBottom: 30 }}>Brilliance of Possibilities. Your intelligent assistant starts here.</Text>
      <TextInput value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor="#777F8D" autoCapitalize="none" keyboardType="email-address" style={{ backgroundColor: panel, color: white, padding: 17, borderRadius: 13, marginBottom: 12, borderWidth: 1, borderColor: '#343A45' }} />
      <TextInput value={password} onChangeText={setPassword} placeholder="Password (8 characters minimum)" placeholderTextColor="#777F8D" secureTextEntry style={{ backgroundColor: panel, color: white, padding: 17, borderRadius: 13, marginBottom: 18, borderWidth: 1, borderColor: '#343A45' }} />
      <Pressable onPress={submit} disabled={busy} style={{ backgroundColor: red, padding: 17, borderRadius: 13, alignItems: 'center', opacity: busy ? .6 : 1 }}>
        <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</Text>
      </Pressable>
      <Pressable onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')} style={{ padding: 18, alignItems: 'center' }}>
        <Text style={{ color: muted }}>{mode === 'signup' ? 'Already have an account? ' : 'New to BRITUME? '}<Text style={{ color: '#75AFFF', fontWeight: '700' }}>{mode === 'signup' ? 'Sign in' : 'Create account'}</Text></Text>
      </Pressable>
      <Text style={{ color: '#68717E', fontSize: 11, textAlign: 'center', marginTop: 20 }}>Account required to use BRITUME AI. No guest mode.</Text>
    </View>
  </KeyboardAvoidingView>;
}
