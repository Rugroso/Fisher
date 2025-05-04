import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

const FishWebView = () => {
  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: 'https://flappy-fish-phi.vercel.app' }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scrollEnabled={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    height: '20%',
    width: '100%',
  },
});

export default FishWebView;
