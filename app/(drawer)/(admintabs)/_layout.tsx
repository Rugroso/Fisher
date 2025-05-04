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
        name="index"
        options={{
          headerShown: false,
          headerTitle: "Inicio",
        }}
      />
    <Stack.Screen
        name="users"
        options={{
          headerShown: false,
          headerTitle: "Inicio",
        }}
      />
      <Stack.Screen
        name="posts"
        options={{
          headerShown: false,
          headerTitle: "Inicio",
        }}
      />
      <Stack.Screen
        name="fishtanks"
        options={{
          headerShown: false,
          headerTitle: "Inicio",
        }}
      />

    </Stack>
  );
}