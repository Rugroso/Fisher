import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, Image, ScrollView } from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../../config/Firebase_Conf'; 

interface User {
  id: string;
  username: string;
  email: string;
  gender: string;
  userId: string;
  profilePicture: string;
  tags: string[];
  followersId: string[];
  friendsId: string[];
  preferences?: {
    isOceanMode?: boolean;
    isPrivate?: boolean;
  };
  [key: string]: any; 
}

const UsersScreen = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        const userList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as User[];

        setUsers(userList);
      } catch (error) {
        console.error('Error al cargar usuarios:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers().then(() => {
      console.log('Usuarios cargados:', users);
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f0c2e" />
      </View>
    );
  }

  const renderItem = ({ item }: { item: User }) => (
    <View style={styles.card}>
      {item.profilePicture ? (
        <Image source={{ uri: item.profilePicture }} style={styles.avatar} />
      ) : null}
      <Text style={styles.username}>{item.username}</Text>
      <Text>Email: {item.email}</Text>
      <Text>Género: {item.gender}</Text>
      <Text>User ID: {item.userId}</Text>
      <Text>Tags: {item.tags?.join(', ')}</Text>
      <Text>Seguidores: {item.followersId?.length}</Text>
      <Text>Amigos: {item.friendsId?.length}</Text>
      <Text>Modo Océano: {item.preferences?.isOceanMode ? 'Sí' : 'No'}</Text>
      <Text>Privado: {item.preferences?.isPrivate ? 'Sí' : 'No'}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Usuarios</Text>
      <FlatList
        data={users}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        scrollEnabled={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </ScrollView>
  );
};

export default UsersScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fffbfe',
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#f4ced4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 14,
  },
  username: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4f0c2e',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#4f0c2e',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 10,
    alignSelf: 'center',
  },
});