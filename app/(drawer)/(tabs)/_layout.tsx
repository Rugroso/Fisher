import { Tabs } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import Entypo from '@expo/vector-icons/Entypo';

export default function TabLayout() {
  const router = useRouter();
  return (
    <View style={styles.container}>
    <Tabs
      initialRouteName="stackhome"
      screenOptions={{
        tabBarActiveTintColor: '#fff',
        tabBarStyle: {
            backgroundColor: '#3F4255',
            width: Platform.OS === 'web' ? "100%":"100%",
            maxWidth: Platform.OS === 'web' ? 800 : "100%",
            alignSelf: "center", 
            left: 2,
            borderTopLeftRadius: Platform.OS === 'web' ? 20 : 0, 
            borderTopRightRadius: Platform.OS === 'web' ? 20 : 20,
            paddingBottom: 5,
        },
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
            <Tabs.Screen
        name="stacksaved"
        options={{
          href: null,
        }}
      /> 
            <Tabs.Screen
        name="stacksettings"
        options={{
          href: null,
        }}
      />
            <Tabs.Screen
        name="stackfishtanks"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="stackcardumenes"
        options={{
          title: 'Cardumenes',
          headerShown: false,
          href: null,
          tabBarStyle: { display: 'none' }, // Oculta la tab bar
        }}
      />
      <Tabs.Screen name="stackeastereggs" options={{ href: null }} />


      <Tabs.Screen
        name="stackpost"
        options={{
          title: '',
          tabBarStyle: { display: 'none'},
          tabBarIcon: () => null,
          tabBarButton: (props) => (
            <TouchableOpacity style={styles.plusButtonContainer} onPress={() => {router.push('/(drawer)/(tabs)/stackpost')}}>
              <View style={styles.plusButton}>
                <Entypo name="plus" size={24} color="grey" />
              </View>
             </TouchableOpacity>
          ),
        }}
      />

    <Tabs.Screen
      name="stacksearch"
      options={{
        title: 'Buscar',
        tabBarIcon: ({ color }) => <FontAwesome6 size={22} name="magnifying-glass" color={color} />,
        tabBarIconStyle: { marginTop: 8 }, 
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
          href: null,
          title: 'Notifaciones',
          headerShown: false,
          tabBarIcon: ({ color }) => <IconSymbol size={28} name='bell' color={color} />,
          tabBarIconStyle: { marginTop: 10 },
        }}
      />

      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  plusButtonContainer: {
    top: Platform.OS === 'web' ? 5 : 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusButton: {
    width: 40,
    height: 40,
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
  container: {
    flex: 1,
    backgroundColor: "#2A3142",
  },
});