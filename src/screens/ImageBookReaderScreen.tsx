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
import ConfirmSubmitModal from '../components/ConfirmSubmitModal';
import TimeLimitModal from '../components/TimeLimitModal';
import storageService from '../services/storageService';

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
  // Total pages derived from book.pages or saved progress; fallback to 7 for local mock
  const getTotalPages = (): number => {
    const fromBook = book.pages?.length;
    if (fromBook && fromBook > 0) return fromBook;
    const fromProgress = progress?.totalPages;
    if (fromProgress && fromProgress > 0) return fromProgress;
    return 7;
  };
  const [progress, setProgress] = useState<BookProgress | null>(null);
  const [startTime, setStartTime] = useState<Date>(new Date());
  const [imageLoading, setImageLoading] = useState(true);
  
  // Audio recording states
  const [recordingSession, setRecordingSession] = useState<RecordingSession | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [localAudioPath, setLocalAudioPath] = useState<string | null>(null);
  const [recordingsByPage, setRecordingsByPage] = useState<{ [page: number]: string[] }>({});
  const [pageTime, setPageTime] = useState(0); // UI display of current page time
  const [timersByPage, setTimersByPage] = useState<{ [page: number]: number }>({}); // session stopwatch per page
  const [overTimeCount, setOverTimeCount] = useState(0); // extensive only
  const [overtimeTriggered, setOvertimeTriggered] = useState(false);
  const [recordingStopped, setRecordingStopped] = useState(false); // intensive cap reached (immediate)
  const [recordedByPage, setRecordedByPage] = useState<{ [page: number]: number }>({}); // cumulative recorded seconds per page
  const [cappedByPage, setCappedByPage] = useState<{ [page: number]: boolean }>({}); // page permanently capped at 10m
  // Extensive-only state
  const [lifelineUsed, setLifelineUsed] = useState<boolean>(false);
  const [exceededPages, setExceededPages] = useState<{ [page: number]: boolean }>({});
  const [lifelineToast, setLifelineToast] = useState<string | null>(null);
  const [timeLimitVisible, setTimeLimitVisible] = useState<boolean>(false);
  const [timeLimitTitle, setTimeLimitTitle] = useState<string>('Time limit 7m reached');
  const [timeLimitMessage, setTimeLimitMessage] = useState<string>('Your session is restarted from the first page. Audio for this book was cleared.');

  // Prefer cloud URLs when available; fallback to bundled assets
  const localPageImages = {
    1: require('../../assets/books/pages/book_002_page-1.png'),
    2: require('../../assets/books/pages/book_002_page-2.png'),
    3: require('../../assets/books/pages/book_002_page-3.png'),
    4: require('../../assets/books/pages/book_002_page-4.png'),
    5: require('../../assets/books/pages/book_002_page-5.png'),
    6: require('../../assets/books/pages/book_002_page-6.png'),
    7: require('../../assets/books/pages/book_002_page-7.png'),
  } as const;

  const getPageImageSource = (pageNumber: number) => {
    const pg = book.pages?.find(p => p.pageNumber === pageNumber);
    const uri = pg?.imageUrl;
    if (uri && (uri.startsWith('http://') || uri.startsWith('https://'))) {
      return { uri } as any;
    }
    return (localPageImages as any)[pageNumber] || (localPageImages as any)[1];
  };

  useEffect(() => {
    (async () => {
      await loadProgress();
      setStartTime(new Date());
      // Start recording after progress is seeded (so caps are respected)
      // defer actual start to a separate effect that listens to progress/currentPage
    })();

    return () => {
      // Cleanup on unmount
      audioService.cleanup();
    };
  }, []);

  // Start recording when progress is available and we're on a page that allows recording
  useEffect(() => {
    if (!progress) return;
    (async () => {
      await startRecordingForPage(currentPage);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, currentPage]);

  const handleBackPress = async () => {
    try {
      await stopCurrentRecording();
    } catch {}
    try {
      await finalizePageTime(currentPage);
    } catch {}
    onBack();
  };

  // Back handling: finalize current page time before exiting (unless uploading)
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
      // Finalize time then exit
      (async () => {
        await handleBackPress();
      })();
      return true; // We handled it
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isUploading, currentPage, onBack]);

  // Update recording session state and per-page stopwatch periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const session = audioService.getCurrentSession();
      setRecordingSession(session);
      // tick the current page stopwatch and reflect in pageTime
      setTimersByPage(prev => {
        const current = prev[currentPage] ?? 0;
        const next = current + 1;
        const updated = { ...prev, [currentPage]: next };
        setPageTime(next);
        return updated;
      });
      // Intensive: stop/ignore recording after 10 min
      if (book.category === 'intensive') {
        const isCapped = cappedByPage[currentPage] === true;
        // If capped, ensure we are not recording
        if (isCapped && session?.isRecording) {
          audioService.stopRecording().catch(() => {});
        }
        if (!isCapped && session?.isRecording) {
          const currentRecorded = recordedByPage[currentPage] ?? 0;
          if (currentRecorded < 600) {
            const nextRecorded = Math.min(600, currentRecorded + 1);
            if (nextRecorded !== currentRecorded) {
              setRecordedByPage(prev => ({ ...prev, [currentPage]: nextRecorded }));
            }
            if (nextRecorded >= 600) {
              // Cap reached: stop recording, mark capped, persist
              audioService.stopRecording().catch(() => {});
              setCappedByPage(prev => ({ ...prev, [currentPage]: true }));
              setRecordingStopped(true);
              // Persist cap and recorded seconds
              (async () => {
                try {
                  await persistCapForPage(currentPage, nextRecorded);
                } catch {}
              })();
            }
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentPage, book.category, recordedByPage, cappedByPage]);

  // Handle extensive overtime off the per-page stopwatch
  useEffect(() => {
    if (book.category !== 'extensive') return;
    const total = getTotalPages();
    const current = timersByPage[currentPage] ?? 0;
    if (current < 420) return;

    // Prevent re-trigger for same page within this session
    if (exceededPages[currentPage]) return;

    if (total === 1) {
      setExceededPages(prev => ({ ...prev, [currentPage]: true }));
      (async () => {
        try { await stopCurrentRecording(); } catch {}
        await handleExtensiveReset('Time limit 7m reached', 'Your session is restarted from the first page. Audio for this book was cleared.');
      })();
      return;
    }

    if (total === 2) {
      const priorExceeds = (exceededPages[1] ? 1 : 0) + (exceededPages[2] ? 1 : 0);
      // Mark this page exceeded now
      setExceededPages(prev => ({ ...prev, [currentPage]: true }));

      if (priorExceeds >= 1) {
        // This is the second exceed -> reset immediately
        (async () => {
          try { await stopCurrentRecording(); } catch {}
          await handleExtensiveReset('7m reached for both pages', 'Both pages exceeded 7:00. Restarting from page 1; audio has been cleared.');
        })();
        return;
      }

      // First exceed -> consume lifeline
      if (!lifelineUsed) {
        // Consume lifeline: stop recording and cap this page; allow continuing on the other page
        setLifelineUsed(true);
        setLifelineToast('Lifeline used: recording stopped for this page');
        setTimeout(() => setLifelineToast(null), 2000);
        setCappedByPage(prev => ({ ...prev, [currentPage]: true }));
        (async () => {
          try { await stopCurrentRecording(); } catch {}
          try {
            const updated = await finalizePageTime(currentPage);
            (updated as any).lifelineUsed = true;
            await bookService.updateBookProgress(updated);
          } catch {}
        })();
      } else {
        // Lifeline already used but only one page exceeded: ensure cap, do nothing else
        setCappedByPage(prev => ({ ...prev, [currentPage]: true }));
        (async () => { try { await stopCurrentRecording(); } catch {} })();
      }
    }
  }, [timersByPage, currentPage, book.category, lifelineUsed, exceededPages]);

  const loadProgress = async () => {
    try {
      const userProgress = await bookService.getBookProgress(user.id, book.id);
      if (userProgress) {
        setProgress(userProgress);
        const cp = userProgress.currentPage;
        setCurrentPage(cp);
        // Seed timers and flags for all known pages
        const seededTimers: { [page: number]: number } = {};
        const seededRecorded: { [page: number]: number } = {};
        const seededCapped: { [page: number]: boolean } = {};
        const timersMap: any = (userProgress as any).pageTimers || {};
        Object.keys(timersMap).forEach((k: string) => {
          const p = parseInt(k, 10);
          const t = timersMap[k];
          if (!isNaN(p) && t) {
            seededTimers[p] = t.totalTime || 0;
            if (typeof t.recordedTotalSeconds === 'number') {
              seededRecorded[p] = t.recordedTotalSeconds;
            }
            const reachedCap = t.isCapped === true
              || (typeof t.recordedTotalSeconds === 'number' && t.recordedTotalSeconds >= 600)
              || ((t.totalTime || 0) >= 600);
            if (reachedCap) {
              seededCapped[p] = true;
            }
          }
        });
        const saved = seededTimers[cp] || 0;
        setTimersByPage(prev => ({ ...prev, ...seededTimers }));
        setRecordedByPage(prev => ({ ...prev, ...seededRecorded }));
        setCappedByPage(prev => ({ ...prev, ...seededCapped }));
        if ((userProgress as any).lifelineUsed) setLifelineUsed(true);
        // For extensive 2-page books: seed exceededPages and cap pages ≥ 420s
        if (book.category === 'extensive') {
          const totalPages = getTotalPages();
          if (totalPages === 2) {
            const seededExceeded: { [page: number]: boolean } = {};
            Object.keys(seededTimers).forEach((k: string) => {
              const p = parseInt(k, 10);
              if (seededTimers[p] >= 420) {
                seededExceeded[p] = true;
              }
            });
            if (Object.keys(seededExceeded).length > 0) {
              setExceededPages(prev => ({ ...prev, ...seededExceeded }));
              // Ensure recording is capped for exceeded pages
              setCappedByPage(prev => ({ ...prev, ...Object.keys(seededExceeded).reduce((acc: any, k: any) => { acc[parseInt(k,10)] = true; return acc; }, {}) }));
            }
          }
        }
        setPageTime(saved);
        setOvertimeTriggered(saved >= 420);
        setRecordingStopped(seededCapped[cp] === true);
      }
    } catch (error) {
      console.error('Error loading progress:', error);
    }
  };

  // Finalize time on a specific page by saving absolute stopwatch value
  const finalizePageTime = async (page: number): Promise<BookProgress> => {
    try {
      const updatedProgress: BookProgress = {
        bookId: book.id,
        userId: user.id,
        currentPage: page,
        totalPages: getTotalPages(),
        isCompleted: false,
        isSubmitted: false,
        startedAt: progress?.startedAt || new Date(),
        pageTimers: (progress?.pageTimers as any) || {},
        penaltyCount: progress?.penaltyCount || 0,
      };

      const pageKey = page.toString();
      const absolute = timersByPage[page] ?? 0;

      (updatedProgress.pageTimers as any)[pageKey] = {
        pageNumber: page,
        startTime: startTime,
        totalTime: absolute,
        exceedanceCount: ((progress?.pageTimers as any)?.[pageKey]?.exceedanceCount) || 0,
        isCompleted: true,
      };

      await bookService.updateBookProgress(updatedProgress);
      setProgress(updatedProgress);
      setStartTime(new Date());
      return updatedProgress;
    } catch (error) {
      console.error('Error updating progress:', error);
      return progress as BookProgress;
    }
  };

  // Extensive reset: close book, delete audio, restart from first page
  const handleExtensiveReset = async (title?: string, message?: string) => {
    try {
      await audioService.stopRecording();
      await storageService.deleteAllUserBookAudio(user.id, book.id, user.grade);
      // Reset timers entirely in Firestore and locally
      await bookService.resetBookProgress(user.id, book.id);
      setTimersByPage({});
      setRecordedByPage({});
      setExceededPages({});
      setCappedByPage({});
      setLifelineUsed(false);
      if (title) setTimeLimitTitle(title);
      if (message) setTimeLimitMessage(message);
      setTimeLimitVisible(true);
    } catch (e) {
      console.error('Error resetting extensive session:', e);
    }
  };

  // Audio recording functions
  const startRecordingForPage = async (pageNumber: number) => {
    try {
      // If this page is capped in intensive mode, do not record
      if (book.category === 'intensive') {
        const pageKey = pageNumber.toString();
        const pg: any = (progress?.pageTimers as any)?.[pageKey];
        const explicitCap = cappedByPage[pageNumber] === true || pg?.isCapped === true;
        const recSecs = typeof pg?.recordedTotalSeconds === 'number' ? pg.recordedTotalSeconds : undefined;
        const legacyOver = (pg?.totalTime || 0) >= 600;
        const effectiveCap = explicitCap || (typeof recSecs === 'number' && recSecs >= 600) || legacyOver;
        if (effectiveCap) {
          setRecordingStopped(true);
          setCappedByPage(prev => ({ ...prev, [pageNumber]: true }));
          if (!pg?.isCapped) {
            (async () => {
              try {
                await persistCapForPage(pageNumber, Math.max(recSecs ?? 0, 600));
              } catch {}
            })();
          }
          return;
        }
      }

      // For extensive: block recording on pages that already exceeded 7m (lifeline stop)
      if (book.category === 'extensive') {
        const pageKey = pageNumber.toString();
        const persistedTotal = (((progress?.pageTimers as any) || {})[pageKey]?.totalTime) || 0;
        const exceeded = exceededPages[pageNumber] === true || (timersByPage[pageNumber] ?? 0) >= 420 || persistedTotal >= 420;
        if (exceeded) {
          // Mark as capped locally to avoid future attempts
          setCappedByPage(prev => ({ ...prev, [pageNumber]: true }));
          // Do not start recorder
          return;
        }
      }

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
        setRecordingsByPage(prev => {
          const existing = prev[currentPage] || [];
          return { ...prev, [currentPage]: [...existing, filePath] };
        });
      }
      return filePath;
    } catch (error) {
      console.error('Error stopping recording:', error);
      return null;
    }
  };

  const handlePreviousPage = async () => {
    if (currentPage > 1) {
      await stopCurrentRecording();
      const newProgress = await finalizePageTime(currentPage);

      const newPage = currentPage - 1;
      setImageLoading(true);
      setCurrentPage(newPage);
      const saved = (newProgress?.pageTimers?.[newPage]?.totalTime) || (timersByPage[newPage] ?? 0);
      setTimersByPage(prev => ({ ...prev, [newPage]: saved }));
      setPageTime(saved);
      setOvertimeTriggered(saved >= 420);
      const recordedSaved = (newProgress?.pageTimers?.[newPage]?.recordedTotalSeconds)
        || (recordedByPage[newPage] ?? 0)
        || ((newProgress?.pageTimers?.[newPage]?.totalTime || 0) >= 600 ? 600 : 0);
      setRecordedByPage(prev => ({ ...prev, [newPage]: recordedSaved }));
      const isCapped = (newProgress?.pageTimers?.[newPage]?.isCapped === true)
        || (cappedByPage[newPage] === true)
        || ((newProgress?.pageTimers?.[newPage]?.recordedTotalSeconds || 0) >= 600)
        || ((newProgress?.pageTimers?.[newPage]?.totalTime || 0) >= 600);
      setCappedByPage(prev => ({ ...prev, [newPage]: isCapped }));
      setRecordingStopped(isCapped);

      await startRecordingForPage(newPage);
    }
  };

  const handleNextPage = async () => {
    const total = getTotalPages();
    const currentSeconds = timersByPage[currentPage] ?? 0;
    if (currentSeconds < 120) {
      Alert.alert('Please read a bit longer', 'Minimum 2 minutes per page before moving next.');
      return;
    }
    if (currentPage < total) {
      await stopCurrentRecording();
      const newProgress = await finalizePageTime(currentPage);

      const newPage = currentPage + 1;
      setImageLoading(true);
      setCurrentPage(newPage);
      const saved = (newProgress?.pageTimers?.[newPage]?.totalTime) || (timersByPage[newPage] ?? 0);
      setTimersByPage(prev => ({ ...prev, [newPage]: saved }));
      setPageTime(saved);
      setOvertimeTriggered(saved >= 420);
      const recordedSaved = (newProgress?.pageTimers?.[newPage]?.recordedTotalSeconds)
        || (recordedByPage[newPage] ?? 0)
        || ((newProgress?.pageTimers?.[newPage]?.totalTime || 0) >= 600 ? 600 : 0);
      setRecordedByPage(prev => ({ ...prev, [newPage]: recordedSaved }));
      const isCapped = (newProgress?.pageTimers?.[newPage]?.isCapped === true)
        || (cappedByPage[newPage] === true)
        || ((newProgress?.pageTimers?.[newPage]?.recordedTotalSeconds || 0) >= 600)
        || ((newProgress?.pageTimers?.[newPage]?.totalTime || 0) >= 600);
      setCappedByPage(prev => ({ ...prev, [newPage]: isCapped }));
      setRecordingStopped(isCapped);

      await startRecordingForPage(newPage);
    }
  };

  const handleSubmitBook = async () => {
    try { await finalizePageTime(currentPage); } catch {}
    setConfirmVisible(true);
  };

  // Submit in-progress: upload without asking, keep book open
  const handleSubmitInProgress = async () => {
    try { await finalizePageTime(currentPage); } catch {}
    await handleMandatoryUpload();
    await bookService.submitBook(user.id, book.id);
    Alert.alert('Saved', 'Your audio has been uploaded. You can continue reading.', [
      { text: 'OK', onPress: onBack }
    ]);
  };

  const handleMandatoryUpload = async (markSubmitted: boolean = false) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      const currentFilePath = await stopCurrentRecording();
      const localMap: { [page: number]: string[] } = { ...recordingsByPage };
      if (currentFilePath) {
        const existing = localMap[currentPage] || [];
        if (!existing.includes(currentFilePath)) {
          localMap[currentPage] = [...existing, currentFilePath];
        }
      }
      const pagesToUpload = Object.keys(localMap).map(p => parseInt(p, 10)).sort((a, b) => a - b);
      if (pagesToUpload.length === 0) {
        Alert.alert('Error', 'No audio recording found to save.');
        setIsUploading(false);
        return;
      }
      let totalSegments = 0;
      pagesToUpload.forEach(p => { totalSegments += (localMap[p] || []).length; });
      if (totalSegments === 0) totalSegments = 1;
      let uploadedSegments = 0;
      for (let i = 0; i < pagesToUpload.length; i++) {
        const pageNum = pagesToUpload[i];
        const segments = localMap[pageNum] || [];
        for (let s = 0; s < segments.length; s++) {
          const segmentPath = segments[s];
          const baseProgress = Math.floor((uploadedSegments / totalSegments) * 100);
          const perFileUpdater = (p: number) => {
            const weighted = baseProgress + Math.floor((p / 100) * (100 / totalSegments));
            setUploadProgress(Math.min(99, weighted));
          };
          const result = await audioService.uploadSegment(
            segmentPath,
            user.id,
            book.id,
            user.grade,
            pageNum,
            perFileUpdater
          );
          if (!result.success) {
            throw new Error(result.error || `Upload failed for page ${pageNum}`);
          }
          uploadedSegments += 1;
        }
      }
      setUploadProgress(100);
      setIsUploading(false);
      setRecordingsByPage({});
      // Caller decides what to show next (in-progress vs complete)
    } catch (error) {
      console.error('Error in mandatory upload:', error);
      setIsUploading(false);
      Alert.alert('Upload Failed', error instanceof Error ? error.message : 'Failed to save audio. Please check your internet connection and try again.', [{ text: 'OK' }]);
    }
  };

  const handleImageLoad = () => { setImageLoading(false); };
  const handleImageError = () => { setImageLoading(false); Alert.alert('Error', 'Failed to load page image'); };

  // Persist cap state and recorded seconds for a page to Firestore
  const persistCapForPage = async (page: number, recordedSeconds: number) => {
    try {
      const updatedProgress: BookProgress = {
        bookId: book.id,
        userId: user.id,
        currentPage: page,
        totalPages: getTotalPages(),
        isCompleted: progress?.isCompleted || false,
        isSubmitted: progress?.isSubmitted || false,
        startedAt: progress?.startedAt || new Date(),
        pageTimers: progress?.pageTimers || {},
        penaltyCount: progress?.penaltyCount || 0,
        exceedanceCount: (progress as any)?.exceedanceCount || 0,
      } as any;

      const pageKey = page.toString();
      const absolute = timersByPage[page] ?? ((progress?.pageTimers as any)?.[pageKey]?.totalTime) ?? 0;
      const prevTimer = (updatedProgress.pageTimers as any)[pageKey] as any;
      (updatedProgress.pageTimers as any)[pageKey] = {
        pageNumber: page,
        startTime: prevTimer?.startTime || startTime,
        totalTime: absolute,
        exceedanceCount: prevTimer?.exceedanceCount || 0,
        isCompleted: true,
        recordedTotalSeconds: Math.min(600, recordedSeconds),
        isCapped: true,
      } as any;

      await bookService.updateBookProgress(updatedProgress);
      setProgress(updatedProgress);
    } catch (error) {
      console.error('Error persisting cap state:', error);
    }
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
          <Text style={styles.pageInfo}>Page {currentPage} of {getTotalPages()}</Text>
        </View>
        <View style={styles.headerRight}>
          {recordingSession?.isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>
                {Math.floor((timersByPage[currentPage] ?? 0) / 60)}:{((timersByPage[currentPage] ?? 0) % 60).toString().padStart(2, '0')}
              </Text>
            </View>
          )}
          <TouchableOpacity style={[styles.submitButton, isUploading && styles.disabledButton]} onPress={handleSubmitInProgress} disabled={isUploading}>
            <Text style={styles.submitButtonText}>Submit</Text>
          </TouchableOpacity>
        </View>
      </View>
      {/* Recording stopped banner (intensive cap) */}
      {book.category === 'intensive' && (recordingStopped || cappedByPage[currentPage]) && (
        <View style={{ backgroundColor: '#FFF3CD', borderColor: '#FFEEBA', borderWidth: 1, marginHorizontal: 15, marginTop: 8, borderRadius: 8, padding: 10 }}>
          <Text style={{ color: '#856404', fontWeight: '600' }}>Time limit 10m reached, recording stopped.</Text>
          <Text style={{ color: '#856404' }}>You can continue reading, but no more audio will be saved on this page.</Text>
        </View>
      )}
      {/* Recording stopped banner (extensive lifeline per-page cap) */}
      {book.category === 'extensive' && (
        (() => {
          const persisted = ((progress?.pageTimers as any)?.[currentPage]?.totalTime ?? 0) as number;
          const exceeded = exceededPages[currentPage] || (timersByPage[currentPage] ?? 0) >= 420 || persisted >= 420;
          if (!exceeded) return null;
          return (
            <View style={{ backgroundColor: '#FFF3CD', borderColor: '#FFEEBA', borderWidth: 1, marginHorizontal: 15, marginTop: 8, borderRadius: 8, padding: 10 }}>
              <Text style={{ color: '#856404', fontWeight: '600' }}>Recording stopped at 7:00 for this page.</Text>
              <Text style={{ color: '#856404' }}>You can continue reading, but no more audio will be saved on this page.</Text>
            </View>
          );
        })()
      )}

      {/* Book Page Image */}
      <View style={styles.contentContainer}>
        <View style={styles.pageContainer}>
          {imageLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2E7D32" />
              <Text style={styles.loadingText}>Loading page...</Text>
            </View>
          )}
          <Image key={`page_${currentPage}`} source={getPageImageSource(currentPage)} style={styles.pageImage} resizeMode="contain" onLoad={handleImageLoad} onError={handleImageError} />
          <View style={styles.pageNumberOverlay}><Text style={styles.pageNumberText}>{currentPage}</Text></View>
        </View>
      </View>
      {/* Navigation Controls */}
      <View style={styles.navigationContainer}>
        <TouchableOpacity style={[styles.navButton, currentPage === 1 && styles.disabledButton]} onPress={handlePreviousPage} disabled={currentPage === 1}>
          <Text style={[{ color: '#ffffff', fontSize: 14, fontWeight: 'bold' } as any, currentPage === 1 && styles.disabledText]}>← Previous</Text>
        </TouchableOpacity>
        <View style={styles.pageIndicator}><Text style={styles.pageText}>{currentPage} / {getTotalPages()}</Text></View>
        {(() => {
          const total = getTotalPages();
          const currentSeconds = timersByPage[currentPage] ?? 0;
          const remaining = Math.max(0, 120 - currentSeconds);
          const isLastPage = currentPage === total;
          if (!isLastPage) {
            const nextDisabled = currentSeconds < 120;
            return (
              <View style={{ alignItems: 'flex-end' }}>
                <TouchableOpacity style={[styles.navButton, nextDisabled && styles.disabledButton]} onPress={handleNextPage} disabled={nextDisabled}>
                <Text style={[{ color: '#ffffff', fontSize: 14, fontWeight: 'bold' } as any, nextDisabled && styles.disabledText]}>Next →</Text>
                </TouchableOpacity>
                {currentSeconds < 120 && (<Text style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Need {remaining}s more</Text>)}
              </View>
            );
          }
          // Last page: show Complete instead of Next
          const completeDisabled = isUploading || currentSeconds < 120;
          return (
            <View style={{ alignItems: 'flex-end' }}>
              <TouchableOpacity style={[styles.navButton, completeDisabled && styles.disabledButton]} onPress={handleSubmitBook} disabled={completeDisabled}>
                <Text style={[{ color: '#ffffff', fontSize: 14, fontWeight: 'bold' } as any, completeDisabled && styles.disabledText]}>Complete</Text>
              </TouchableOpacity>
              {currentSeconds < 120 && (<Text style={{ fontSize: 12, color: '#999', marginTop: 4 }}>Need {remaining}s more</Text>)}
            </View>
          );
        })()}
      </View>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(currentPage / getTotalPages()) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{Math.round((currentPage / getTotalPages()) * 100)}% Complete</Text>
      </View>
      {/* Last-page Complete Button moved to navigation; removed duplicate here */}
      {/* Upload Progress Modal */}
      <UploadProgressModal visible={isUploading} progress={uploadProgress} message="Saving your audio recording..." subMessage="Please don't close the app" />
      {book.category === 'extensive' && lifelineToast && (
        <View style={{ position: 'absolute', bottom: 90, left: 20, right: 20, backgroundColor: '#FFF3CD', borderColor: '#FFEEBA', borderWidth: 1, borderRadius: 8, padding: 10 }}>
          <Text style={{ color: '#856404', textAlign: 'center', fontWeight: '600' }}>{lifelineToast}</Text>
        </View>
      )}
      <TimeLimitModal
        visible={book.category === 'extensive' && timeLimitVisible}
        title={timeLimitTitle}
        message={timeLimitMessage}
        onClose={() => {
          setTimeLimitVisible(false);
          // Exit to Book Detail after time-limit reset
          onBack();
        }}
      />
      <ConfirmSubmitModal
        visible={confirmVisible}
        onClose={() => setConfirmVisible(false)}
        onSubmitInProgress={async () => {
          setConfirmVisible(false);
          await handleSubmitInProgress();
        }}
        onCompleteBook={async () => {
          setConfirmVisible(false);
          await handleMandatoryUpload();
          await bookService.completeBook(user.id, book.id);
          Alert.alert('Completed 🎉','Your book is marked completed. You can take the quiz now.',[{ text:'OK', onPress: onBookComplete }]);
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E0E0E0', backgroundColor: '#ffffff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  backButton: { paddingVertical: 8, paddingHorizontal: 12 },
  backButtonText: { fontSize: 16, color: '#2E7D32', fontWeight: '500' },
  headerCenter: { flex: 1, alignItems: 'center', marginHorizontal: 10 },
  bookTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  pageInfo: { fontSize: 12, color: '#666', marginTop: 2 },
  headerRight: { alignItems: 'center', flexDirection: 'row' },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF3030', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginRight: 10 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ffffff', marginRight: 6 },
  recordingText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  submitButton: { backgroundColor: '#2E7D32', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  disabledButton: { backgroundColor: '#E0E0E0' },
  submitButtonText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
  contentContainer: { flex: 1, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center', padding: 5 },
  pageContainer: { position: 'relative', width: width - 10, height: height * 0.75, backgroundColor: '#ffffff', borderRadius: 8, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, overflow: 'hidden' },
  pageImage: { width: '100%', height: '100%' },
  loadingContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.9)', zIndex: 1 },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
  pageNumberOverlay: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0, 0, 0, 0.7)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  pageNumberText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  navigationContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#E0E0E0' },
  navButton: { paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#2E7D32', borderRadius: 8 },
  disabledText: { color: '#999' },
  pageIndicator: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#F5F5F5', borderRadius: 8 },
  pageText: { fontSize: 16, color: '#333', fontWeight: '500' },
  progressContainer: { paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#ffffff' },
  progressBar: { height: 4, backgroundColor: '#E0E0E0', borderRadius: 2, marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: '#4CAF50', borderRadius: 2 },
  progressText: { fontSize: 12, color: '#666', textAlign: 'center' },
});

export default ImageBookReaderScreen;
