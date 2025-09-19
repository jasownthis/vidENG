import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Book, BookProgress, User, AudioRecording } from '../types';
import bookService from '../services/bookService';
import storageService from '../services/storageService';

const { width } = Dimensions.get('window');

interface BookDetailScreenProps {
  user: User;
  book: Book;
  onBack: () => void;
  onStartReading: (book: Book) => void;
  onStartQuiz: (book: Book) => void;
}

const BookDetailScreen: React.FC<BookDetailScreenProps> = ({
  user,
  book,
  onBack,
  onStartReading,
  onStartQuiz,
}) => {
  const [progress, setProgress] = useState<BookProgress | null>(null);
  const [audioRecordings, setAudioRecordings] = useState<AudioRecording[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookData();
  }, [book.id, user.id]);

  const loadBookData = async () => {
    try {
      setLoading(true);
      
      // Load user's progress for this book
      const userProgress = await bookService.getBookProgress(user.id, book.id);
      
      // For demo purposes, simulate a completed book to show quiz functionality
      if (userProgress) {
        // If user has progress, mark it as submitted for demo
        const demoProgress = {
          ...userProgress,
          isSubmitted: true,
          currentPage: userProgress.totalPages, // Set to last page
        };
        setProgress(demoProgress);
      } else {
        setProgress(userProgress);
      }
      
      // Load user's audio recordings for this book from Firebase Storage
      const recordings = await storageService.listUserBookAudio(
        user.id, 
        book.id, 
        user.grade
      );
      setAudioRecordings(recordings);
      
    } catch (error) {
      console.error('Error loading book data:', error);
      Alert.alert('Error', 'Failed to load book details');
    } finally {
      setLoading(false);
    }
  };

  const handleStartReading = () => {
    onStartReading(book);
  };

  const handleStartQuiz = () => {
    onStartQuiz(book);
  };

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else {
      return `${diffDays} days ago`;
    }
  };

  const getProgressText = (): string => {
    if (!progress) {
      return 'Start Reading';
    }
    
    if (progress.isCompleted) {
      return 'Read Again';
    }
    
    if (progress.isSubmitted) {
      return 'Continue Reading';
    }
    
    return `Continue Reading (Page ${progress.currentPage}/${progress.totalPages})`;
  };

  const isQuizAvailable = (): boolean => {
    return progress?.isSubmitted === true || progress?.isCompleted === true;
  };

  const getQuizButtonText = (): string => {
    if (!progress) return 'Complete book first';
    
    // Check if user has already taken the quiz (this would come from a quiz results collection)
    // For now, we'll assume they haven't taken it yet
    return 'Take Quiz & Earn Stickers';
  };

  const playAudio = async (audioRecording: AudioRecording) => {
    try {
      if (!audioRecording.rawAudioUrl) {
        Alert.alert('Error', 'Audio file not available');
        return;
      }

      // For now, show a simple alert. In production, you'd use an audio player
      Alert.alert(
        `🎵 Playing Audio - Page ${audioRecording.pageNumber}`,
        `Duration: ${formatDuration(audioRecording.duration)}\nRecorded: ${formatDate(audioRecording.recordedAt)}`,
        [
          { text: 'Stop', style: 'cancel' },
          { 
            text: 'Open in Browser', 
            onPress: () => {
              // This would open the audio URL in browser for now
              console.log('Audio URL:', audioRecording.rawAudioUrl);
            }
          }
        ]
      );
      
      // TODO: Implement proper audio playback with react-native-sound or similar
      // const sound = new Sound(audioRecording.rawAudioUrl, '', (error) => {
      //   if (error) {
      //     Alert.alert('Error', 'Failed to load audio');
      //     return;
      //   }
      //   sound.play();
      // });
      
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', 'Failed to play audio');
    }
  };

  const renderAudioItem = ({ item }: { item: AudioRecording }) => (
    <View style={styles.audioItem}>
      <View style={styles.audioInfo}>
        <View style={styles.audioHeader}>
          <Text style={styles.audioTitle}>Page {item.pageNumber}</Text>
          <Text style={styles.audioDuration}>{formatDuration(item.duration)}</Text>
        </View>
        <Text style={styles.audioDate}>{formatDate(item.recordedAt)}</Text>
        <View style={styles.audioStatus}>
          <View style={[
            styles.statusDot,
            { backgroundColor: item.isProcessed ? '#4CAF50' : '#FF9800' }
          ]} />
          <Text style={styles.statusText}>
            {item.isProcessed ? 'Processed' : 'Processing...'}
          </Text>
        </View>
      </View>
      
      <TouchableOpacity 
        style={[
          styles.playButton,
          { opacity: item.isProcessed ? 1 : 0.5 }
        ]}
        disabled={!item.isProcessed}
        onPress={() => playAudio(item)}
      >
        <Text style={styles.playButtonText}>▶</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Loading book details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        </View>

        {/* Book Cover and Info */}
        <View style={styles.bookSection}>
          <View style={styles.bookCover}>
            {book.coverUrl ? (
              <Image source={{ uri: book.coverUrl }} style={styles.coverImage} />
            ) : (
              <View style={styles.placeholderCover}>
                <Text style={styles.placeholderIcon}>📖</Text>
                <Text style={styles.placeholderTitle}>{book.title}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.bookInfo}>
            <Text style={styles.bookTitle}>{book.title}</Text>
            
            {book.description && (
              <Text style={styles.bookDescription}>{book.description}</Text>
            )}
            
            <View style={styles.bookMeta}>
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Grade Level</Text>
                <Text style={styles.metaValue}>{book.gradeLevel}</Text>
              </View>
              
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Category</Text>
                <Text style={styles.metaValue}>
                  {book.category === 'intensive' ? '📚 Intensive' : '🚀 Extensive'}
                </Text>
              </View>
              
              <View style={styles.metaItem}>
                <Text style={styles.metaLabel}>Pages</Text>
                <Text style={styles.metaValue}>{book.pages.length}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Progress Section */}
        {progress && (
          <View style={styles.progressSection}>
            <Text style={styles.sectionTitle}>Your Progress</Text>
            <View style={styles.progressCard}>
              <View style={styles.progressInfo}>
                <Text style={styles.progressText}>
                  Page {progress.currentPage} of {progress.totalPages}
                </Text>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${(progress.currentPage / progress.totalPages) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressPercentage}>
                  {Math.round((progress.currentPage / progress.totalPages) * 100)}% Complete
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          {/* Start/Continue Reading Button */}
          <TouchableOpacity style={styles.startButton} onPress={handleStartReading}>
            <Text style={styles.startButtonText}>{getProgressText()}</Text>
            <Text style={styles.startButtonIcon}>📖</Text>
          </TouchableOpacity>
          
          {/* Quiz Button - Only show if book is completed/submitted */}
          {isQuizAvailable() && (
            <TouchableOpacity 
              style={[styles.startButton, styles.quizButton]} 
              onPress={handleStartQuiz}
            >
              <Text style={styles.startButtonText}>{getQuizButtonText()}</Text>
              <Text style={styles.startButtonIcon}>🧩</Text>
            </TouchableOpacity>
          )}
          
          {/* Quiz Coming Soon Message - Show if book not completed */}
          {!isQuizAvailable() && (
            <View style={styles.quizComingSoon}>
              <Text style={styles.quizComingSoonIcon}>🧩</Text>
              <Text style={styles.quizComingSoonText}>
                Complete all pages to unlock the quiz
              </Text>
              <Text style={styles.quizComingSoonSubtext}>
                Earn stickers by answering questions correctly!
              </Text>
            </View>
          )}
        </View>

        {/* Audio Recordings Section */}
        <View style={styles.audioSection}>
          <Text style={styles.sectionTitle}>Your Audio Recordings</Text>
          
          {audioRecordings.length === 0 ? (
            <View style={styles.emptyAudioContainer}>
              <Text style={styles.emptyAudioIcon}>🎤</Text>
              <Text style={styles.emptyAudioText}>No audio recordings yet</Text>
              <Text style={styles.emptyAudioSubtext}>
                Start reading to create your first audio recording
              </Text>
            </View>
          ) : (
            <FlatList
              data={audioRecordings}
              renderItem={renderAudioItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              style={styles.audioList}
            />
          )}
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
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '500',
  },
  bookSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  bookCover: {
    width: 160,
    height: 220,
    marginBottom: 20,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  placeholderCover: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  placeholderTitle: {
    fontSize: 14,
    color: '#2E7D32',
    textAlign: 'center',
    fontWeight: '600',
  },
  bookInfo: {
    alignItems: 'center',
    width: '100%',
  },
  bookTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  bookDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  bookMeta: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  metaItem: {
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  progressSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  progressCard: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 15,
  },
  progressInfo: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  progressPercentage: {
    fontSize: 14,
    color: '#666',
  },
  actionSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  startButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    marginBottom: 15,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  startButtonIcon: {
    fontSize: 20,
  },
  quizButton: {
    backgroundColor: '#FF6B35', // Orange color for quiz button
  },
  quizComingSoon: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  quizComingSoonIcon: {
    fontSize: 32,
    marginBottom: 10,
    opacity: 0.6,
  },
  quizComingSoonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 5,
  },
  quizComingSoonSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  audioSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  emptyAudioContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  emptyAudioIcon: {
    fontSize: 48,
    marginBottom: 15,
  },
  emptyAudioText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
    marginBottom: 5,
  },
  emptyAudioSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  audioList: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 10,
  },
  audioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  audioInfo: {
    flex: 1,
  },
  audioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  audioTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  audioDuration: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
  },
  audioDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  audioStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2E7D32',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 15,
  },
  playButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default BookDetailScreen;
