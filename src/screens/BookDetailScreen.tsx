import React, { useState, useEffect, useRef } from 'react';
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
import Sound from 'react-native-nitro-sound';

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
  const [pageAudios, setPageAudios] = useState<Array<{ pageNumber: number; urls: string[]; recordedAt: Date; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingPage, setPlayingPage] = useState<number | null>(null);
  const playbackQueueRef = useRef<string[]>([]);
  const playbackIndexRef = useRef<number>(0);

  useEffect(() => {
    loadBookData();
  }, [book.id, user.id]);

  useEffect(() => {
    // cleanup listeners on unmount
    return () => {
      try {
        Sound.stopPlayer();
        Sound.removePlayBackListener?.();
        Sound.removePlaybackEndListener?.();
      } catch {}
    };
  }, []);

  const loadBookData = async () => {
    try {
      setLoading(true);
      
      // Load user's progress for this book (no demo override)
      const userProgress = await bookService.getBookProgress(user.id, book.id);
      setProgress(userProgress);
      
      // Load user's audio recordings for this book from Firebase Storage
      const recordings = await storageService.listUserBookAudio(
        user.id, 
        book.id, 
        user.grade
      );
      setAudioRecordings(recordings);

      // Group by page into a single play item per page
      // Ensure segments are ordered oldest -> newest for natural playback
      const byPage: { [page: number]: AudioRecording[] } = {};
      for (const r of recordings) {
        if (!r.rawAudioUrl) continue;
        const page = r.pageNumber;
        if (!byPage[page]) byPage[page] = [];
        byPage[page].push(r);
      }
      const pageList = Object.keys(byPage)
        .map(k => parseInt(k, 10))
        .sort((a, b) => a - b)
        .map(page => {
          const segs = byPage[page]
            .slice()
            .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()); // ascending time
          return {
            pageNumber: page,
            urls: segs.map(s => s.rawAudioUrl!) as string[],
            recordedAt: segs[segs.length - 1]?.recordedAt || new Date(),
            count: segs.length,
          };
        });
      setPageAudios(pageList);
      
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

  const playAudio = async (entry: { pageNumber: number; urls: string[] }) => {
    try {
      const page = entry.pageNumber;
      const queue = entry.urls;
      if (queue.length === 0) {
        Alert.alert('Error', 'No audio segments found for this page');
        return;
      }

      // If already playing this page, toggle stop
      if (isPlaying && playingPage === page) {
        await Sound.stopPlayer();
        setIsPlaying(false);
        setPlayingPage(null);
        return;
      }

      // Reset previous listeners and playback
      try {
        await Sound.stopPlayer();
        Sound.removePlayBackListener?.();
        Sound.removePlaybackEndListener?.();
      } catch {}

      // Prime queue
      playbackQueueRef.current = queue;
      playbackIndexRef.current = 0;
      setPlayingPage(page);
      setIsPlaying(true);

      // Chain playback
      const startAtIndex = async (idx: number) => {
        if (idx >= playbackQueueRef.current.length) {
          setIsPlaying(false);
          setPlayingPage(null);
          return;
        }
        const url = playbackQueueRef.current[idx];
        await Sound.startPlayer(url);
      };

      Sound.addPlaybackEndListener?.(() => {
        playbackIndexRef.current += 1;
        startAtIndex(playbackIndexRef.current).catch(() => {
          setIsPlaying(false);
          setPlayingPage(null);
        });
      });

      // Start first
      await startAtIndex(0);
      
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', 'Failed to play audio');
    }
  };

  const renderPageAudioItem = ({ item }: { item: { pageNumber: number; urls: string[]; recordedAt: Date; count: number } }) => (
    <View style={styles.audioItem}>
      <View style={styles.audioInfo}>
        <View style={styles.audioHeader}>
          <Text style={styles.audioTitle}>Page {item.pageNumber}</Text>
          <Text style={styles.audioDuration}>{item.count} segment{item.count > 1 ? 's' : ''}</Text>
        </View>
        <Text style={styles.audioDate}>{formatDate(item.recordedAt)}</Text>
      </View>
      
      <TouchableOpacity 
        style={[
          styles.playButton,
          { opacity: 1 },
        ]}
        disabled={false}
        onPress={() => playAudio(item)}
      >
        <Text style={styles.playButtonText}>
          {isPlaying && playingPage === item.pageNumber ? '⏹' : '▶'}
        </Text>
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
          
          {pageAudios.length === 0 ? (
            <View style={styles.emptyAudioContainer}>
              <Text style={styles.emptyAudioIcon}>🎤</Text>
              <Text style={styles.emptyAudioText}>No audio recordings yet</Text>
              <Text style={styles.emptyAudioSubtext}>
                Start reading to create your first audio recording
              </Text>
            </View>
          ) : (
            <FlatList
              data={pageAudios}
              renderItem={renderPageAudioItem}
              keyExtractor={(item) => `page_${item.pageNumber}`}
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
