import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Sticker } from '../types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import storageService from '../services/storageService';

interface ProfileScreenProps {
  user: User;
  onBack: () => void;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ user, onBack }) => {
  const [stickers, setStickers] = useState<Sticker[]>(user.stickers || []);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.id));
        let list: Sticker[] = [];
        if (snap.exists()) {
          const data: any = snap.data();
          list = Array.isArray(data.stickers) ? data.stickers : [];
        }
        const resolved = await Promise.all(
          list.map(async (s) => {
            if (s.imageUrl && !s.imageUrl.startsWith('http')) {
              try {
                const url = await storageService.getDownloadUrlForPath(s.imageUrl);
                return { ...s, imageUrl: url } as Sticker;
              } catch {
                return s;
              }
            }
            return s;
          })
        );
        setStickers(resolved);
      } catch {}
    })();
  }, [user.id]);

  const avatarLetter = user.email?.[0]?.toUpperCase?.() || user.name?.[0]?.toUpperCase?.() || '?';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.backText} onPress={onBack}>← Back</Text>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* User card */}
        <View style={styles.userCard}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{avatarLetter}</Text></View>
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.userEmail}>{user.email}</Text>
            <Text style={styles.userGrade}>Grade {user.grade}</Text>
          </View>
        </View>

        {/* Stickers grid by book */}
        <Text style={styles.sectionTitle}>Stickers</Text>
        {stickers.length === 0 ? (
          <View style={styles.emptyBox}> 
            <Text style={styles.emptyText}>No stickers yet. Complete quizzes to earn rewards!</Text>
          </View>
        ) : (
          <View style={styles.stickerList}>
            {stickers.map((s, idx) => (
              <View key={idx} style={styles.stickerCard}>
                <Text style={styles.stickerTitle} numberOfLines={1}>{s.name}</Text>
                {s.imageUrl ? (
                  <Image source={{ uri: s.imageUrl }} style={styles.stickerImage} resizeMode="contain" />
                ) : (
                  <View style={[styles.stickerImage, styles.stickerPlaceholder]}>
                    <Text style={{ color: '#999' }}>No image</Text>
                  </View>
                )}
                {s.description ? <Text style={styles.stickerDesc} numberOfLines={2}>{s.description}</Text> : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  backText: { color: '#2E7D32', fontSize: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  content: { padding: 16 },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', padding: 16, borderRadius: 12, marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E8F5E8', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#2E7D32' },
  userEmail: { fontSize: 16, color: '#333', fontWeight: '600' },
  userGrade: { fontSize: 14, color: '#4CAF50', marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#333', marginTop: 8, marginBottom: 10 },
  emptyBox: { backgroundColor: '#F9F9F9', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#EEE' },
  emptyText: { color: '#777' },
  stickerList: { },
  stickerCard: { width: '100%', backgroundColor: '#F5F5F5', borderRadius: 8, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E0E0E0' },
  stickerTitle: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 8 },
  stickerImage: { width: '100%', height: 180, borderRadius: 6, backgroundColor: '#fff' },
  stickerPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  stickerDesc: { fontSize: 12, color: '#666', marginTop: 6 },
});

export default ProfileScreen;


