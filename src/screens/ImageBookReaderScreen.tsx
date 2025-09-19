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
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Book, BookProgress, User } from '../types';
import bookService from '../services/bookService';
import audioService, { RecordingSession } from '../services/audioService';
import UploadProgressModal from '../components/UploadProgressModal';

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
  
  // Audio recording states
  const [recordingSession, setRecordingSession] = useState<RecordingSession | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [localAudioPath, setLocalAudioPath] = useState<string | null>(null);
  const [recordingsByPage, setRecordingsByPage] = useState<{ [page: number]: string }>({});

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
    
    // Start recording when component mounts
    startRecordingForPage(currentPage);
    
    return () => {
      // Cleanup on unmount
      audioService.cleanup();
    };
  }, []);

  // Handle back button - prevent closing during upload
  useEffect(() => {
    const backAction = () => {
      if (isUploading) {
        Alert.alert(
          'Upload in Progress',
          'Your audio is being saved. Please wait before leaving.',
          [{ text: 'OK' }]
        );
        return true; // Prevent back action
      }
      return false; // Allow back action
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isUploading]);

  // Update recording session state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const session = audioService.getCurrentSession();
      setRecordingSession(session);
    }, 1000);

    return () => clearInterval(interval);
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

  // Audio recording functions
  const startRecordingForPage = async (pageNumber: number) => {
    try {
      const success = await audioService.startRecording(pageNumber);
      if (!success) {
        Alert.alert('Recording Error', 'Could not start recording for this page.');
      }
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopCurrentRecording = async (): Promise<string | null> => {
    try {
      const filePath = await audioService.stopRecording();
      setLocalAudioPath(filePath);
      if (filePath) {
        // Store the recording path for the current page
        setRecordingsByPage(prev => ({ ...prev, [currentPage]: filePath }));
      }
      return filePath;
    } catch (error) {
      console.error('Error stopping recording:', error);
      return null;
    }
  };

  const handlePreviousPage = async () => {
    if (currentPage > 1) {
      // Stop current recording and start new one for previous page
      await stopCurrentRecording();
      
      const newPage = currentPage - 1;
      setImageLoading(true);
      setCurrentPage(newPage);
      updateProgress(newPage);
      
      // Start recording for the new page
      await startRecordingForPage(newPage);
    }
  };

  const handleNextPage = async () => {
    if (currentPage < totalPages) {
      // Stop current recording and start new one for next page
      await stopCurrentRecording();
      
      const newPage = currentPage + 1;
      setImageLoading(true);
      setCurrentPage(newPage);
      updateProgress(newPage);
      
      // Start recording for the new page
      await startRecordingForPage(newPage);
    }
  };

  const handleSubmitBook = () => {
    Alert.alert(
      'Submit Book',
      'This will save your audio recording and submit the book. You can then take the quiz.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Submit & Save Audio',
          onPress: handleMandatoryUpload,
        },
      ]
    );
  };

  const handleMandatoryUpload = async () => {
    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Step 1: Stop current recording
      const currentFilePath = await stopCurrentRecording();

      // Build list of pages to upload (all recorded pages)
      const pagesToUpload = Object.keys(recordingsByPage)
        .map(p => parseInt(p, 10))
        .sort((a, b) => a - b);

      if (currentFilePath && !pagesToUpload.includes(currentPage)) {
        pagesToUpload.push(currentPage);
      }

      if (pagesToUpload.length === 0) {
        Alert.alert('Error', 'No audio recording found to save.');
        setIsUploading(false);
        return;
      }

      // Sequentially upload each page's audio, updating global progress
      const total = pagesToUpload.length;
      for (let index = 0; index < total; index++) {
        const pageNum = pagesToUpload[index];
        const filePathForPage =
          pageNum === currentPage && currentFilePath
            ? currentFilePath
            : recordingsByPage[pageNum];

        if (!filePathForPage) {
          continue;
        }

        const baseProgress = Math.floor((index / total) * 100);
        const perFileUpdater = (p: number) => {
          const weighted = baseProgress + Math.floor((p / 100) * (100 / total));
          setUploadProgress(Math.min(99, weighted));
        };

        const result = await audioService.uploadAudioWithMerge(
          filePathForPage,
          user.id,
          book.id,
          user.grade,
          pageNum,
          perFileUpdater
        );

        if (!result.success) {
          throw new Error(result.error || `Upload failed for page ${pageNum}`);
        }
      }
      setUploadProgress(100);

      // Step 3: Update book progress as submitted
      await bookService.submitBook(user.id, book.id);

      // Step 4: Success!
      setIsUploading(false);
      setRecordingsByPage({});
      Alert.alert(
        'Success! 🎉',
        'Your audio has been saved and book submitted! You can now take the quiz.',
        [{ text: 'Continue', onPress: onBookComplete }]
      );

    } catch (error) {
      console.error('Error in mandatory upload:', error);
      setIsUploading(false);
      
      Alert.alert(
        'Upload Failed',
        error instanceof Error ? error.message : 'Failed to save audio. Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
    }
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
        
        <View style={styles.headerRight}>
          {/* Recording Status Indicator */}
          {recordingSession?.isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>
                {Math.floor(recordingSession.duration / 60)}:{(recordingSession.duration % 60).toString().padStart(2, '0')}
              </Text>
            </View>
          )}
          
          <TouchableOpacity 
            style={[styles.submitButton, isUploading && styles.disabledButton]} 
            onPress={handleSubmitBook}
            disabled={isUploading}
          >
            <Text style={styles.submitButtonText}>Submit</Text>
          </TouchableOpacity>
        </View>
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

      {/* Upload Progress Modal */}
      <UploadProgressModal
        visible={isUploading}
        progress={uploadProgress}
        message="Saving your audio recording..."
        subMessage="Please don't close the app"
      />
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
  headerRight: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF3030',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    marginRight: 6,
  },
  recordingText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  disabledButton: {
    backgroundColor: '#E0E0E0',
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
