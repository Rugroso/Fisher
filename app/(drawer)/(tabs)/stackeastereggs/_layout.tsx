import { Stack } from "expo-router";
import {act, useEffect, useState} from "react";
import { TouchableOpacity, View, Text } from "react-native";
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
          headerTitle: "Fish",
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="flappyFish"
        options={{
          headerTitle: "Flappy Fish",
          headerShown: false,
        }}
      />

    </Stack>
  );
}