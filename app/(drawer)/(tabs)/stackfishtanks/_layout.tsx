import { Stack } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation, DrawerActions } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

export default function FishtanksLayout() {
  const navigation = useNavigation();

  const openDrawer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.dispatch(DrawerActions.openDrawer());
  };
  
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: {
          backgroundColor: "#2A3142",
        },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: {
          fontWeight: "bold",
        },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Peceras",
          headerShown: false,
          headerLeft: () => (
            <TouchableOpacity 
              style={{ marginLeft: 10 }}
              onPress={openDrawer}
            >
              <Feather name="menu" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ),
        }}
      />
      
      <Stack.Screen
        name="[id]"
        options={{
          title: "Detalle de Pecera",
          headerShown: false,
        }}
        // Esto es importante: ayuda a crear una instancia nueva cada vez
        getId={({ params }) => `fishtank-${params?.id || 'unknown'}`}
      />
      
      <Stack.Screen
        name="create"
        options={{
          title: "Crear Pecera",
          headerShown: false,
        }}
      />
    </Stack>
  );
}