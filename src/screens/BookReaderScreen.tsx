import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Pdf from 'react-native-pdf';
import { Book, BookProgress, User } from '../types';
import bookService from '../services/bookService';

const { width, height } = Dimensions.get('window');

interface BookReaderScreenProps {
  user: User;
  book: Book;
  onBack: () => void;
  onBookComplete: () => void;
}

const BookReaderScreen: React.FC<BookReaderScreenProps> = ({
  user,
  book,
  onBack,
  onBookComplete,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [progress, setProgress] = useState<BookProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startTime, setStartTime] = useState<Date>(new Date());

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

  const handlePageChange = (page: number, numberOfPages: number) => {
    setCurrentPage(page);
    if (totalPages === 0) {
      setTotalPages(numberOfPages);
    }
    updateProgress(page);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      updateProgress(newPage);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
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

  const pdfSource = { uri: `bundle-assets://books/A Mother in mannville.pdf`, cache: true };

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
            Page {currentPage} of {totalPages || '...'}
          </Text>
        </View>
        
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmitBook}>
          <Text style={styles.submitButtonText}>Submit</Text>
        </TouchableOpacity>
      </View>

      {/* PDF Reader */}
      <View style={styles.pdfContainer}>
        <Pdf
          source={pdfSource}
          onLoadComplete={(numberOfPages) => {
            setTotalPages(numberOfPages);
            setIsLoading(false);
            console.log(`Number of pages: ${numberOfPages}`);
          }}
          onPageChanged={(page, numberOfPages) => {
            handlePageChange(page, numberOfPages);
          }}
          onError={(error) => {
            console.error('PDF Error:', error);
            Alert.alert('Error', 'Failed to load PDF');
          }}
          onPressLink={(uri) => {
            console.log(`Link pressed: ${uri}`);
          }}
          style={styles.pdf}
          page={currentPage}
          horizontal={false}
          spacing={0}
          enablePaging={true}
          enableRTL={false}
          enableAnnotationRendering={true}
          password=""
          scale={1.0}
          minScale={1.0}
          maxScale={3.0}
          renderActivityIndicator={() => (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading book...</Text>
            </View>
          )}
        />
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
              { width: `${totalPages > 0 ? (currentPage / totalPages) * 100 : 0}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0}% Complete
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
  pdfContainer: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  pdf: {
    flex: 1,
    width: width,
    height: height,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
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

export default BookReaderScreen;
