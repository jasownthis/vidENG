import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Book, BookProgress } from '../types';
import bookService from '../services/bookService';

const { width } = Dimensions.get('window');

interface HomeScreenProps {
  user: User;
  onNavigateToIntensive: () => void;
  onNavigateToExtensive: () => void;
  onNavigateToProfile: () => void;
  onSignOut: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({
  user,
  onNavigateToIntensive,
  onNavigateToExtensive,
  onNavigateToProfile,
  onSignOut,
}) => {
  // Live stats
  const [completedCount, setCompletedCount] = useState<number>(user.completedBooks?.length || 0);
  const [inProgressCount, setInProgressCount] = useState<number>(user.currentBooks?.length || 0);
  const [stickerCount, setStickerCount] = useState<number>(user.stickers?.length || 0);
  const [canAccessExtensive, setCanAccessExtensive] = useState<boolean>(Boolean(user.unlockedExtensive));

  useEffect(() => {
    (async () => {
      try {
        const progress = await bookService.getUserBookProgress(user.id);
        const completed = progress.filter(p => p.isCompleted).length;
        const inprog = progress.filter(p => !p.isCompleted).length;
        setCompletedCount(completed);
        setInProgressCount(inprog);
        setStickerCount(user.stickers?.length || 0);

        // Compute number of completed INTENSIVE books (cross-ref with grade books)
        const gradeBooks = await bookService.getBooks(user.grade);
        const byId: Record<string, Book> = {};
        gradeBooks.forEach(b => { byId[b.id] = b; });
        const completedIntensive = progress.filter(p => p.isCompleted && byId[p.bookId]?.category === 'intensive').length;
        if (!user.unlockedExtensive && completedIntensive >= 4) {
          setCanAccessExtensive(true);
          try { await bookService.updateUserUnlockExtensive?.(user.id, true); } catch {}
        }
      } catch {}
    })();
  }, [user.id]);
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <Image 
            source={require('../../assets/videng_logo_full.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.welcomeText}>Welcome back, {user.name}!</Text>
          <Text style={styles.gradeText}>Grade {user.grade} Student</Text>
        </View>

        {/* Reading Sections */}
        <View style={styles.sectionsContainer}>
          {/* Intensive Reading Section */}
          <TouchableOpacity
            style={styles.sectionCard}
            onPress={onNavigateToIntensive}
          >
            <View style={styles.sectionIconContainer}>
              <Text style={styles.sectionIcon}>📖</Text>
            </View>
            <Text style={styles.sectionTitle}>Intensive Reading</Text>
            <Text style={styles.sectionDescription}>
              Read carefully with audio recording. Take your time to understand every detail.
            </Text>
            <View style={styles.sectionFeatures}>
              <Text style={styles.featureText}>• 10 minutes max per page</Text>
              <Text style={styles.featureText}>• Audio recording enabled</Text>
              <Text style={styles.featureText}>• No time penalties</Text>
            </View>
            <View style={styles.sectionButton}>
              <Text style={styles.sectionButtonText}>Start Reading</Text>
            </View>
          </TouchableOpacity>

          {/* Extensive Reading Section */}
          <TouchableOpacity
            style={[
              styles.sectionCard,
              !canAccessExtensive && styles.disabledCard
            ]}
            onPress={canAccessExtensive ? onNavigateToExtensive : undefined}
            disabled={!canAccessExtensive}
          >
            <View style={styles.sectionIconContainer}>
              <Text style={styles.sectionIcon}>🚀</Text>
            </View>
            <Text style={[
              styles.sectionTitle,
              !canAccessExtensive && styles.disabledText
            ]}>
              Extensive Reading
            </Text>
            <Text style={[
              styles.sectionDescription,
              !canAccessExtensive && styles.disabledText
            ]}>
              {canAccessExtensive 
                ? "Read faster with time challenges. Build reading fluency and speed."
                : "Complete 4 Intensive books to unlock this section!"
              }
            </Text>
            <View style={styles.sectionFeatures}>
              <Text style={[
                styles.featureText,
                !canAccessExtensive && styles.disabledText
              ]}>
                • Timed reading challenges
              </Text>
              <Text style={[
                styles.featureText,
                !canAccessExtensive && styles.disabledText
              ]}>
                • Penalty system for motivation
              </Text>
              <Text style={[
                styles.featureText,
                !canAccessExtensive && styles.disabledText
              ]}>
                • Speed building exercises
              </Text>
            </View>
            <View style={[
              styles.sectionButton,
              !canAccessExtensive && styles.disabledButton
            ]}>
              <Text style={[
                styles.sectionButtonText,
                !canAccessExtensive && styles.disabledButtonText
              ]}>
                {canAccessExtensive ? 'Start Challenge' : '🔒 Locked'}
              </Text>
            </View>
            {!canAccessExtensive && (
              <View style={styles.unlockRequirement}>
                <Text style={styles.unlockText}>
                  Complete 4 Intensive books to unlock
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Progress Summary */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressTitle}>Your Progress</Text>
          <View style={styles.progressStats}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{completedCount}</Text>
              <Text style={styles.statLabel}>Books Completed</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stickerCount}</Text>
              <Text style={styles.statLabel}>Stickers Earned</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{inProgressCount}</Text>
              <Text style={styles.statLabel}>In Progress</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton} onPress={onNavigateToProfile}>
            <Text style={styles.actionButtonText}>👤 View Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.signOutButton} onPress={onSignOut}>
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 20,
  },
  logoImage: {
    width: width * 0.5,
    height: 60,
    marginBottom: 15,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 5,
  },
  gradeText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '500',
  },
  sectionsContainer: {
    marginBottom: 30,
  },
  sectionCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  disabledCard: {
    backgroundColor: '#F0F0F0',
    opacity: 0.7,
  },
  sectionIconContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionIcon: {
    fontSize: 48,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'center',
    marginBottom: 10,
  },
  sectionDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 15,
  },
  disabledText: {
    color: '#999',
  },
  sectionFeatures: {
    marginBottom: 20,
  },
  featureText: {
    fontSize: 14,
    color: '#4CAF50',
    marginBottom: 5,
    textAlign: 'center',
  },
  sectionButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  sectionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButtonText: {
    color: '#999',
  },
  unlockRequirement: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  unlockText: {
    fontSize: 14,
    color: '#FF9800',
    textAlign: 'center',
    fontWeight: '500',
  },
  progressContainer: {
    marginBottom: 30,
  },
  progressTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statCard: {
    backgroundColor: '#E8F5E8',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 80,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
  },
  statLabel: {
    fontSize: 12,
    color: '#4CAF50',
    textAlign: 'center',
    marginTop: 5,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 10,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  signOutButton: {
    backgroundColor: '#FF5722',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default HomeScreen;

