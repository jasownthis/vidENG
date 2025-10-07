import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Book, BookProgress, User } from '../types';
import bookService from '../services/bookService';

const { width } = Dimensions.get('window');

interface BookListScreenProps {
  user: User;
  category: 'intensive' | 'extensive';
  onBookSelect: (book: Book) => void;
  onBack: () => void;
}

const BookListScreen: React.FC<BookListScreenProps> = ({
  user,
  category,
  onBookSelect,
  onBack,
}) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [userProgress, setUserProgress] = useState<BookProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBooks();
    loadUserProgress();
  }, [user.grade, category]);

  const loadBooks = async () => {
    try {
      const fetchedBooks = await bookService.getBooks(user.grade, category);
      setBooks(fetchedBooks);
    } catch (error) {
      console.error('Error loading books:', error);
      Alert.alert('Error', 'Failed to load books');
    } finally {
      setLoading(false);
    }
  };

  const loadUserProgress = async () => {
    try {
      const progress = await bookService.getUserBookProgress(user.id);
      setUserProgress(progress);
    } catch (error) {
      console.error('Error loading user progress:', error);
    }
  };

  const getBookProgress = (bookId: string): BookProgress | undefined => {
    return userProgress.find(p => p.bookId === bookId);
  };

  const getProgressText = (book: Book): string => {
    const progress = getBookProgress(book.id);
    
    if (!progress) {
      return 'Start Reading';
    }
    
    if (progress.isCompleted) {
      return 'Completed ✅';
    }
    
    if (progress.isSubmitted) {
      return 'Submitted 📤';
    }
    
    return `Continue (Page ${progress.currentPage}/${progress.totalPages})`;
  };

  const getProgressColor = (book: Book): string => {
    const progress = getBookProgress(book.id);
    
    if (!progress) return '#2E7D32';
    if (progress.isCompleted) return '#4CAF50';
    if (progress.isSubmitted) return '#FF9800';
    return '#2196F3';
  };

  const handleBookPress = async (book: Book) => {
    try {
      let progress = getBookProgress(book.id);
      
      if (!progress) {
        // Start reading for the first time using the loaded Book
        progress = await bookService.startReadingWithBook(user.id, book);
        setUserProgress(prev => [...prev, progress!]);
      }
      
      onBookSelect(book);
    } catch (error) {
      console.error('Error selecting book:', error);
      Alert.alert('Error', 'Failed to open book');
    }
  };

  const renderBookItem = ({ item: book }: { item: Book }) => (
    <TouchableOpacity
      style={styles.bookCard}
      onPress={() => handleBookPress(book)}
    >
      <View style={styles.bookCover}>
        {book.coverUrl ? (
          <Image source={{ uri: book.coverUrl }} style={styles.coverImage} />
        ) : (
          <View style={styles.placeholderCover}>
            <Text style={styles.placeholderText}>📖</Text>
            <Text style={styles.bookTitle}>{book.title}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.bookInfo}>
        <Text style={styles.bookTitleText} numberOfLines={2}>
          {book.title}
        </Text>
        
        <View style={styles.bookMeta}>
          <Text style={styles.gradeText}>Grade {book.gradeLevel}</Text>
          <Text style={styles.categoryText}>
            {book.category === 'intensive' ? '📚 Intensive' : '🚀 Extensive'}
          </Text>
        </View>
        
        <TouchableOpacity
          style={[styles.progressButton, { backgroundColor: getProgressColor(book) }]}
          onPress={() => handleBookPress(book)}
        >
          <Text style={styles.progressButtonText}>
            {getProgressText(book)}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const categoryTitle = category === 'intensive' ? 'Intensive Reading' : 'Extensive Reading';
  const categoryIcon = category === 'intensive' ? '📚' : '🚀';
  const categoryDescription = category === 'intensive' 
    ? 'Read carefully with audio recording. Take your time to understand every detail.'
    : 'Read faster with time challenges. Build reading fluency and speed. (Temporarily unlocked for testing)';

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Loading books...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{categoryIcon} {categoryTitle}</Text>
          <Text style={styles.headerSubtitle}>{categoryDescription}</Text>
        </View>
      </View>

      {books.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No books available for Grade {user.grade}</Text>
          <Text style={styles.emptySubtext}>Check back later for new books!</Text>
        </View>
      ) : (
        <FlatList
          data={books}
          renderItem={renderBookItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.booksList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    marginBottom: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#2E7D32',
    fontWeight: '500',
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
  },
  emptyText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  booksList: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  bookCard: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bookCover: {
    width: 80,
    height: 120,
    marginRight: 15,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  placeholderCover: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  placeholderText: {
    fontSize: 24,
    marginBottom: 8,
  },
  bookTitle: {
    fontSize: 10,
    color: '#2E7D32',
    textAlign: 'center',
    fontWeight: '600',
  },
  bookInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  bookTitleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  bookMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gradeText: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  categoryText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  progressButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  progressButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default BookListScreen;
