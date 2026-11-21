import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { supabase, hasAuthConfig } from '../lib/supabase';

export default function Index() {
  const [session, setSession] = useState<any>(undefined);
  useEffect(() => {
    if (!supabase) { setSession(null); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => listener.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#17191E' }}><ActivityIndicator color="#E05252" /></View>;
  return session ? <Redirect href="/chat" /> : <Redirect href="/auth" />;
}
