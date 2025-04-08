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
          headerTitle: "Inicio",
          headerShown: false,
        }}
      />

    </Stack>
  );
}