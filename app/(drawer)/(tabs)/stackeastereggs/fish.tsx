import React from 'react';
import { View, StyleSheet, Platform, KeyboardAvoidingView, SafeAreaView } from 'react-native';
import { WebView } from 'react-native-webview';

const FishWebView = () => {
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.bigcontainer}>
        <View style={styles.container}>
          <iframe
            src="https://rugroso.github.io/Fish/"
            style={{
              height: '100%',
              width: '100%',
              border: 'none',
            }}
            title="Fish Game"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.bigcontainer}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <WebView
          source={{ uri: 'https://rugroso.github.io/Fish/' }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  bigcontainer: {
    flex: 1,
    backgroundColor: '#2A3142',
  },
  container: {
    flex: 1,
    backgroundColor: Platform.OS === "web" ? "#3A4154" : "#2A3142",
    alignSelf: "center",
    width: Platform.OS === "web" ? "100%" : "100%",
    maxWidth: Platform.OS === "web" ? 800 : "100%",
  },
  webview: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});

export default FishWebView;
