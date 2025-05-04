import { Stack } from "expo-router";
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
        name="index"
        options={{
          headerShown: false,
          headerTitle: "Inicio",
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          headerShown: false,
          headerTitle: "Inicio",
        }}
      />
      
      <Stack.Screen
        name="profile"
        options={{
          headerShown: false,
          headerTitle: "Inicio",
        }}
      />

      <Stack.Screen
        name="followers"
        options={{
          headerShown: false,
          headerTitle: "Inicio",
        }}
      />

    </Stack>
  );
}