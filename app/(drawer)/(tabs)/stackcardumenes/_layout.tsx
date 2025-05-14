import { Stack } from "expo-router";
import {act, useEffect, useState} from "react";
import { TouchableOpacity, View, Text } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, DrawerActions } from "@react-navigation/native";
import * as Haptics from "expo-haptics";


export default function stackhome() {  
  return (
    <Stack>
    <Stack.Screen
        name="index"
        options={{
            headerShown: false,
            headerTitle: "Cardúmenes",
        }}
      />
          <Stack.Screen
        name="cardumen-detail"
        options={{
            headerShown: false,
            headerTitle: "Cardúmenes",
        }}
      />

    </Stack>
  );
}