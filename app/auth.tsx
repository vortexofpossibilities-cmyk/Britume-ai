
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

const bg = '#17191E';
const panel = '#242831';
const white = '#F4F5F7';
const muted = '#A5ABB6';
const red = '#E05252';
const blue = '#4D91E8';

export default function Auth() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  async function submit() {
    if (busy) return;

    setMessage('');
    setSuccess(false);

    if (!email.trim() || password.length < 8) {
      setMessage('Enter a valid email and a password with at least 8 characters.');
      return;
    }

    if (!supabase) {
      setMessage('Supabase is not configured. Please check your GitHub secrets.');
      return;
    }

    setBusy(true);

    try {
      const result =
        mode === 'signup'
          ? await supabase.auth.signUp({
              email: email.trim(),
              password,
            })
          : await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });

      if (result.error) {
        setMessage(result.error.message);
      } else if (mode === 'signup' && !result.data.session) {
        setSuccess(true);
        setMessage('Account registered! Check your email to confirm your address, then sign in.');
      } else {
        router.replace('/chat');
      }
    } catch (error: any) {
      setMessage(error?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{
        flex: 1,
        backgroundColor: bg,
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <View style={{ maxWidth: 440, width: '100%', alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 42 }}>
          <View style={{ width: 4, height: 34, backgroundColor: red, marginRight: 7, borderRadius: 4 }} />
          <View style={{ width: 4, height: 34, backgroundColor: blue, marginRight: 14, borderRadius: 4 }} />
          <Text style={{ color: white, fontSize: 27, fontWeight: '800', letterSpacing: 3 }}>
            BRITUME
          </Text>
        </View>

        <Text style={{ color: white, fontSize: 29, fontWeight: '700', marginBottom: 8 }}>
          {mode === 'signup' ? 'Create your account.' : 'Welcome back.'}
        </Text>

        <Text style={{ color: muted, fontSize: 15, lineHeight: 23, marginBottom: 30 }}>
          Brilliance of Possibilities. Your intelligent assistant starts here.
        </Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email address"
          placeholderTextColor="#777F8D"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          editable={!busy}
          style={{
            backgroundColor: panel,
            color: white,
            padding: 17,
            borderRadius: 13,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: '#343A45',
          }}
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password (8 characters minimum)"
          placeholderTextColor="#777F8D"
          secureTextEntry
          editable={!busy}
          style={{
            backgroundColor: panel,
            color: white,
            padding: 17,
            borderRadius: 13,
            marginBottom: 18,
            borderWidth: 1,
            borderColor: '#343A45',
          }}
        />

        {message ? (
          <Text
            accessibilityRole="alert"
            style={{
              color: success ? '#75D69A' : '#FF8B8B',
              marginBottom: 16,
              lineHeight: 22,
            }}
          >
            {message}
          </Text>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={mode === 'signup' ? 'Create account' : 'Sign in'}
          style={({ pressed }) => ({
            backgroundColor: red,
            padding: 18,
            borderRadius: 13,
            alignItems: 'center',
            opacity: busy ? 0.6 : pressed ? 0.75 : 1,
            cursor: 'pointer',
          } as any)}
        >
          <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
            {busy ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            if (busy) return;
            setMode(mode === 'signup' ? 'signin' : 'signup');
            setMessage('');
            setSuccess(false);
          }}
          disabled={busy}
          style={{ padding: 20, alignItems: 'center' }}
        >
          <Text style={{ color: muted }}>
            {mode === 'signup' ? 'Already have an account? ' : 'New to BRITUME? '}
            <Text style={{ color: '#75AFFF', fontWeight: '700' }}>
              {mode === 'signup' ? 'Sign in' : 'Create account'}
            </Text>
          </Text>
        </Pressable>

        <Text style={{ color: '#68717E', fontSize: 11, textAlign: 'center', marginTop: 20 }}>
          Account required to use BRITUME AI. No guest mode.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
