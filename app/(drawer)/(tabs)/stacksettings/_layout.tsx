import { Stack } from "expo-router";
import { TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, DrawerActions } from "@react-navigation/native";
import * as Haptics from "expo-haptics";


export default function stackhome() {
  const navigation = useNavigation();

  const openDrawer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.dispatch(DrawerActions.openDrawer());
  };
  
  return (
    <Stack>
     <Stack.Screen 
  name="notifications" 
  options={{ 
    headerShown: false 
  }} 
/>
     <Stack.Screen 
  name="donate" 
  options={{ 
    headerShown: false 
  }} 
/>
    <Stack.Screen
        name="index"
        options={{
          headerShown: false,
          headerTitle: "Configuración",
        }}
      />
      <Stack.Screen
        name="account"
        options={{
          headerShown: false,
          headerTitle: "Configuración",
        }}
      />
      <Stack.Screen
        name="edit-profile"
        options={{
          headerShown: false,
          headerTitle: "Configuración",
        }}
      />

    </Stack>
  );
}