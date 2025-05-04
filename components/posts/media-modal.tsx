"use client"

import type React from "react"
import { useState } from "react"
import { View, Image, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Dimensions } from "react-native"
import { Feather } from "@expo/vector-icons"
import Swiper from "react-native-swiper"
import { Video, ResizeMode } from "expo-av"

interface MediaModalProps {
  visible: boolean
  onClose: () => void
  mediaArray: string[]
  initialIndex: number
}

const MediaModal: React.FC<MediaModalProps> = ({ visible, onClose, mediaArray, initialIndex }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [videoLoading, setVideoLoading] = useState<Record<string, boolean>>({})

  const isVideoUrl = (url: string) => {
    return url.includes(".mp4") || url.includes(".mov") || url.includes(".avi") || url.includes("video")
  }

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Feather name="x" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <Swiper
          index={initialIndex}
          loop={false}
          onIndexChanged={(index) => setCurrentIndex(index)}
          showsPagination={true}
          paginationStyle={styles.paginationContainer}
          dotStyle={styles.paginationDot}
          activeDotStyle={styles.paginationDotActive}
          containerStyle={styles.swiperContainer}
        >
          {mediaArray.map((mediaUrl, index) => (
            <View key={`media_${index}`} style={styles.modalMediaContainer}>
              {isVideoUrl(mediaUrl) ? (
                <View style={styles.videoContainer}>
                  {videoLoading[mediaUrl] && (
                    <View style={styles.videoLoadingContainer}>
                      <ActivityIndicator size="large" color="#FFFFFF" />
                    </View>
                  )}
                  <Video
                    source={{ uri: mediaUrl }}
                    style={styles.video}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={true}
                    isLooping
                    onLoadStart={() => {
                      setVideoLoading((prev) => ({ ...prev, [mediaUrl]: true }))
                    }}
                    onLoad={() => {
                      setVideoLoading((prev) => ({ ...prev, [mediaUrl]: false }))
                    }}
                    onError={(error) => {
                      console.error("Error loading video:", error)
                      setVideoLoading((prev) => ({ ...prev, [mediaUrl]: false }))
                    }}
                  />
                </View>
              ) : (
                <Image source={{ uri: mediaUrl }} style={styles.modalImage} resizeMode="contain" />
              )}
            </View>
          ))}
        </Swiper>
      </View>
    </Modal>
  )
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window")

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
  },
  closeButton: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 20,
    padding: 8,
  },
  swiperContainer: {
    width: "100%",
  },
  modalMediaContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    bottom: 30,
    width: "100%",
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    margin: 3,
  },
  paginationDotActive: {
    backgroundColor: "#FFFFFF",
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  videoContainer: {
    width: "100%",
    height: screenHeight * 0.8,
    justifyContent: "center",
    alignItems: "center",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  modalImage: {
    width: "100%",
    height: "100%",
  },
  videoLoadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
})

export default MediaModal
