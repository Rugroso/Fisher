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
          headerLeft: () => (
            <TouchableOpacity 
              style={{ padding: 6, backgroundColor: "#f5f5f5", borderRadius: 50, marginBottom: 10  }}
              onPress={openDrawer}
            >

              <MaterialCommunityIcons name="menu" size={24} color="#333" />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View>
            </View>
          ),
        }}
      />

    </Stack>
  );
}