import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Alert,
  StatusBar,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Book, BookProgress, User } from '../types';
import bookService from '../services/bookService';

const { width, height } = Dimensions.get('window');

interface ImageBookReaderScreenProps {
  user: User;
  book: Book;
  onBack: () => void;
  onBookComplete: () => void;
}

const ImageBookReaderScreen: React.FC<ImageBookReaderScreenProps> = ({
  user,
  book,
  onBack,
  onBookComplete,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages] = useState(7); // From our converted PDF
  const [progress, setProgress] = useState<BookProgress | null>(null);
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [imageLoading, setImageLoading] = useState(true);

  // Page images mapping - using the converted PDF images
  // Using a more reliable approach to avoid caching issues
  const pageImages = {
    1: require('../../assets/books/pages/book_002_page-1.png'),
    2: require('../../assets/books/pages/book_002_page-2.png'),
    3: require('../../assets/books/pages/book_002_page-3.png'),
    4: require('../../assets/books/pages/book_002_page-4.png'),
    5: require('../../assets/books/pages/book_002_page-5.png'),
    6: require('../../assets/books/pages/book_002_page-6.png'),
    7: require('../../assets/books/pages/book_002_page-7.png'),
  };

  const getPageImageSource = (pageNumber: number) => {
    return pageImages[pageNumber as keyof typeof pageImages] || pageImages[1];
  };

  useEffect(() => {
    loadProgress();
    setStartTime(new Date());
  }, []);

  const loadProgress = async () => {
    try {
      const userProgress = await bookService.getBookProgress(user.id, book.id);
      if (userProgress) {
        setProgress(userProgress);
        setCurrentPage(userProgress.currentPage);
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  const updateProgress = async (page: number) => {
    try {
      const updatedProgress: BookProgress = {
        bookId: book.id,
        userId: user.id,
        currentPage: page,
        totalPages: totalPages,
        isCompleted: false,
        isSubmitted: false,
        startedAt: progress?.startedAt || new Date(),
        pageTimers: progress?.pageTimers || {},
        penaltyCount: progress?.penaltyCount || 0,
      };

      // Update page timer
      const pageKey = page.toString();
      const currentTime = new Date();
      const timeSpent = Math.floor((currentTime.getTime() - startTime.getTime()) / 1000);
      
      updatedProgress.pageTimers[pageKey] = {
        pageNumber: page,
        startTime: startTime,
        totalTime: (updatedProgress.pageTimers[pageKey]?.totalTime || 0) + timeSpent,
        exceedanceCount: 0,
        isCompleted: true,
      };

      await bookService.updateBookProgress(updatedProgress);
      setProgress(updatedProgress);
      setStartTime(new Date()); // Reset timer for next page
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setImageLoading(true); // Show loading immediately
      setCurrentPage(newPage);
      updateProgress(newPage);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setImageLoading(true); // Show loading immediately
      setCurrentPage(newPage);
      updateProgress(newPage);
    }
  };

  const handleSubmitBook = () => {
    Alert.alert(
      'Submit Book',
      'Are you sure you want to submit this book? You can take the quiz after submitting.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Submit',
          onPress: async () => {
            try {
              await bookService.submitBook(user.id, book.id);
              Alert.alert(
                'Book Submitted!',
                'Great job! You can now take the comprehension quiz.',
                [{ text: 'OK', onPress: onBookComplete }]
              );
            } catch (error) {
              console.error('Error submitting book:', error);
              Alert.alert('Error', 'Failed to submit book');
            }
          },
        },
      ]
    );
  };

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    Alert.alert('Error', 'Failed to load page image');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.bookTitle} numberOfLines={1}>{book.title}</Text>
          <Text style={styles.pageInfo}>
            Page {currentPage} of {totalPages}
          </Text>
        </View>
        
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmitBook}>
          <Text style={styles.submitButtonText}>Submit</Text>
        </TouchableOpacity>
      </View>

      {/* Book Page Image */}
      <View style={styles.contentContainer}>
        <View style={styles.pageContainer}>
          {imageLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2E7D32" />
              <Text style={styles.loadingText}>Loading page...</Text>
            </View>
          )}
          
          <Image
            key={`page_${currentPage}`} // Force re-render when page changes
            source={getPageImageSource(currentPage)}
            style={styles.pageImage}
            resizeMode="contain"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
          
          {/* Page number overlay */}
          <View style={styles.pageNumberOverlay}>
            <Text style={styles.pageNumberText}>
              {currentPage}
            </Text>
          </View>
        </View>
      </View>

      {/* Navigation Controls */}
      <View style={styles.navigationContainer}>
        <TouchableOpacity
          style={[styles.navButton, currentPage === 1 && styles.disabledButton]}
          onPress={handlePreviousPage}
          disabled={currentPage === 1}
        >
          <Text style={[styles.navButtonText, currentPage === 1 && styles.disabledText]}>
            ← Previous
          </Text>
        </TouchableOpacity>

        <View style={styles.pageIndicator}>
          <Text style={styles.pageText}>{currentPage} / {totalPages}</Text>
        </View>

        <TouchableOpacity
          style={[styles.navButton, currentPage === totalPages && styles.disabledButton]}
          onPress={handleNextPage}
          disabled={currentPage === totalPages}
        >
          <Text style={[styles.navButtonText, currentPage === totalPages && styles.disabledText]}>
            Next →
          </Text>
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(currentPage / totalPages) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {Math.round((currentPage / totalPages) * 100)}% Complete
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#ffffff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  pageInfo: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  submitButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 5,
  },
  pageContainer: {
    position: 'relative',
    width: width - 10, // Almost full width
    height: height * 0.75, // Fixed height - 75% of screen
    backgroundColor: '#ffffff',
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  pageImage: {
    width: '100%',
    height: '100%', // Fill the entire container
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    zIndex: 1,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  pageNumberOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pageNumberText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  navButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#2E7D32',
    borderRadius: 8,
  },
  disabledButton: {
    backgroundColor: '#E0E0E0',
  },
  navButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  disabledText: {
    color: '#999',
  },
  pageIndicator: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  pageText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#ffffff',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

export default ImageBookReaderScreen;
