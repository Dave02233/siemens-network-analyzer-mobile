import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarStyle: { backgroundColor: '#111', borderTopColor: '#222' },
      tabBarActiveTintColor: '#208AEF',
      tabBarInactiveTintColor: '#555',
      headerStyle: { backgroundColor: '#0a0a0a' },
      headerTintColor: '#fff',
    }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <Ionicons name="home" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="network"
        options={{ title: 'Network', tabBarIcon: ({ color }) => <Ionicons name="wifi" size={22} color={color} /> }}
      />
    </Tabs>
  );
}