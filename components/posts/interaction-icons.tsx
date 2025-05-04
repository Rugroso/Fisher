"use client"

import { View, ActivityIndicator, StyleSheet } from "react-native"
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons"

interface IconProps {
  active?: boolean
  isUpdating?: boolean
}

export const WaveIcon = () => (
  <View style={styles.iconContainer}>
    <MaterialCommunityIcons name="waves" size={20} color="#FFFFFF" />
  </View>
)

export const CommentIcon = () => (
  <View style={styles.iconContainer}>
    <Feather name="message-circle" size={20} color="#FFFFFF" />
  </View>
)

export const HookIcon = ({ active, isUpdating }: IconProps) => (
  <View style={styles.iconContainer}>
    {isUpdating ? (
      <ActivityIndicator size="small" color="#FFFFFF" />
    ) : (
      <Feather name="anchor" size={20} color={active ? "#4ECDC4" : "#FFFFFF"} />
    )}
  </View>
)

export const FishIcon = ({ active, isUpdating }: IconProps) => (
  <View style={styles.iconContainer}>
    {isUpdating ? (
      <ActivityIndicator size="small" color="#FFFFFF" />
    ) : (
      <MaterialCommunityIcons name="fish" size={20} color={active ? "#FF6B6B" : "#FFFFFF"} />
    )}
  </View>
)

const styles = StyleSheet.create({
  iconContainer: {
    marginRight: 5,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
})
