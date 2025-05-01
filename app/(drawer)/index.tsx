import { Redirect } from "expo-router";
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/context/AuthContext";

export default function Index() {

  const { user, loading } = useAuth();

useEffect(() => {

  if (!loading && user) {
    console.log("User is logged in");
  }
}, [loading]);


if (loading ) {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#2A3142" }}>
        <ActivityIndicator size="large" color="#fff" />
    </View>
  );
}

if (!user) {
  return <Redirect href="/login" />;
} else {
  return <Redirect href="/(drawer)/(tabs)/stackhome" />;
}

}