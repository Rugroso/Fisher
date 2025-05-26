import React from "react"
import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { Feather } from "@expo/vector-icons"
import { Post } from "@/app/types/types"

interface PostCardProps {
  post: Post
}

const PostCard: React.FC<PostCardProps> = ({ post }) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.author}>Autor: {post.authorId}</Text>
        <Text style={styles.date}>{new Date(post.createdAt).toLocaleString()}</Text>
      </View>
      <Text style={styles.content}>{post.content}</Text>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.actionButton}>
          <Feather name="message-circle" size={20} color="#8E8E93" />
          <Text style={styles.actionText}>{post.commentCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Feather name="heart" size={20} color="#8E8E93" />
          <Text style={styles.actionText}>{post.reactionCounts.fish}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Feather name="repeat" size={20} color="#8E8E93" />
          <Text style={styles.actionText}>{post.reactionCounts.wave}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#3A4154",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  author: {
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  date: {
    color: "#8E8E93",
    fontSize: 12,
  },
  content: {
    color: "#FFFFFF",
    fontSize: 16,
    marginBottom: 12,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionText: {
    color: "#8E8E93",
    marginLeft: 4,
  },
})

export default PostCard 