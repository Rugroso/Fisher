import { Tabs } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRouter } from 'expo-router';

export default function TabLayout() {
  const router = useRouter();
  return (
    <Tabs
      initialRouteName="stackhome"
      screenOptions={{
        tabBarActiveTintColor: '#fff',
        tabBarStyle: { backgroundColor: '#3C4255' },
        headerShown: false,
        tabBarHideOnKeyboard: false,
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }}
    >
      <Tabs.Screen
        name="stackhome"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color}  />,
          tabBarIconStyle: { marginTop: 10 },
        }}
      />
      {/* <Tabs.Screen
        name="stackmessages"
        options={{
          title: 'Mensajes',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="paperplane.fill" color={color} />,
          tabBarIconStyle: { marginTop: 10 },
          
        }}
      /> */}
      <Tabs.Screen name="stackmessages" options={{ href: null }} />
      <Tabs.Screen name="stackeastereggs" options={{ href: null }} />


      <Tabs.Screen
        name="stackpost"
        options={{
          title: '',
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <TouchableOpacity style={styles.plusButtonContainer} onPress={() => {router.push('/(drawer)/(tabs)/stackpost')}}>
              <View style={styles.plusButton}>
                <IconSymbol name="plus" color="#fff" size={24} />
              </View>
             </TouchableOpacity>
          ),
        }}
      />

<Tabs.Screen
  name="stacksearch"
  options={{
    title: 'Buscar',
    tabBarIcon: ({ color }) => <IconSymbol size={28} name="magnifyingglass" color={color} />,
    tabBarIconStyle: { marginTop: 10 }, 
  }}
/>
      <Tabs.Screen
        name="stackprofile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.crop.circle" color={color} />,
        }}
      />

      <Tabs.Screen
        name="stacknotifications"
        options={{
          href:null,
          title: 'Fish',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="fish" color={color} />,
          tabBarIconStyle: { marginTop: 10 },
        }}
      />

      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  plusButtonContainer: {
    top: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusButton: {
    width: 45,
    height: 45,
    borderRadius: 30,
    backgroundColor: '#4F566B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 6,
  },
});