
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: '#F7F7F4',
        },
        animation: 'fade',
      }}
    />
  );
}
