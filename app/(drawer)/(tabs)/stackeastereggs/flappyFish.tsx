import React from 'react';
import { View, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';
import { WebView } from 'react-native-webview';

const FishWebView = () => {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <iframe
          src="https://flappy-fish-phi.vercel.app"
          style={{
            height: '100%',
            width: '100%',
            border: 'none',
          }}
          title="Flappy Fish Game"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <WebView
        source={{ uri: 'https://flappy-fish-phi.vercel.app' }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scrollEnabled={false}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2A3142',
  },
  webview: {
    height: '20%',
    width: '100%',
  },
});

export default FishWebView;
