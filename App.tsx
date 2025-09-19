import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Alert,
} from 'react-native';

import SplashScreen from './src/components/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import GradeSelectionScreen from './src/screens/GradeSelectionScreen';
import HomeScreen from './src/screens/HomeScreen';
import BookListScreen from './src/screens/BookListScreen';
import BookDetailScreen from './src/screens/BookDetailScreen';
import ImageBookReaderScreen from './src/screens/ImageBookReaderScreen';
import QuizScreen from './src/screens/QuizScreen';
import authService from './src/services/authService';
import { User, Book, QuizResult } from './src/types';

const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showGradeSelection, setShowGradeSelection] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<'home' | 'bookList' | 'bookDetail' | 'bookReader' | 'quiz'>('home');
  const [selectedCategory, setSelectedCategory] = useState<'intensive' | 'extensive'>('intensive');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((user) => {
      setCurrentUser(user);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    // If user hasn't selected grade, show grade selection
    if (!user.grade) {
      setShowGradeSelection(true);
    }
  };

  const handleGradeSelect = async (grade: number) => {
    if (currentUser) {
      try {
        await authService.updateUser(currentUser.id, { grade });
        setCurrentUser({ ...currentUser, grade });
        setShowGradeSelection(false);
      } catch (error) {
        console.error('Grade update error:', error);
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await authService.signOut();
      setCurrentUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleNavigateToIntensive = () => {
    setSelectedCategory('intensive');
    setCurrentScreen('bookList');
  };

  const handleNavigateToExtensive = () => {
    setSelectedCategory('extensive');
    setCurrentScreen('bookList');
  };

  const handleNavigateToProfile = () => {
    // TODO: Navigate to profile screen
    console.log('Navigate to Profile');
  };

  const handleBookSelect = (book: Book) => {
    setSelectedBook(book);
    setCurrentScreen('bookDetail');
  };

  const handleStartReading = (book: Book) => {
    setSelectedBook(book);
    setCurrentScreen('bookReader');
  };

  const handleStartQuiz = (book: Book) => {
    setSelectedBook(book);
    setCurrentScreen('quiz');
  };

  const handleBackToHome = () => {
    setCurrentScreen('home');
    setSelectedBook(null);
  };

  const handleBackToBookList = () => {
    setCurrentScreen('bookList');
    setSelectedBook(null);
  };

  const handleBackToBookDetail = () => {
    setCurrentScreen('bookDetail');
  };

  const handleBookComplete = () => {
    // TODO: Navigate to quiz screen
    setCurrentScreen('home');
    setSelectedBook(null);
  };

  const handleQuizComplete = (result: QuizResult) => {
    // TODO: Save quiz result to Firebase
    console.log('Quiz completed:', result);
    Alert.alert(
      'Quiz Completed!',
      result.passed 
        ? `Congratulations! You earned a sticker! 🎉`
        : 'Keep practicing and try again! 💪',
      [
        {
          text: 'OK',
          onPress: () => {
            setCurrentScreen('bookDetail'); // Go back to book detail
          },
        },
      ]
    );
  };

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (isLoading) {
    return <SplashScreen onFinish={() => {}} />; // Show splash while loading
  }

  if (!currentUser) {
    return (
      <LoginScreen 
        onLogin={handleLogin}
        onNavigateToGradeSelection={() => setShowGradeSelection(true)}
      />
    );
  }

  if (showGradeSelection || !currentUser.grade) {
    return (
      <GradeSelectionScreen 
        onGradeSelect={handleGradeSelect}
        currentGrade={currentUser.grade}
      />
    );
  }

  // Main app content
  if (currentScreen === 'bookList') {
    return (
      <BookListScreen
        user={currentUser}
        category={selectedCategory}
        onBookSelect={handleBookSelect}
        onBack={handleBackToHome}
      />
    );
  }

  if (currentScreen === 'bookDetail' && selectedBook) {
    return (
      <BookDetailScreen
        user={currentUser}
        book={selectedBook}
        onBack={handleBackToBookList}
        onStartReading={handleStartReading}
        onStartQuiz={handleStartQuiz}
      />
    );
  }

  if (currentScreen === 'bookReader' && selectedBook) {
    return (
      <ImageBookReaderScreen
        user={currentUser}
        book={selectedBook}
        onBack={handleBackToBookDetail}
        onBookComplete={handleBookComplete}
      />
    );
  }

  if (currentScreen === 'quiz' && selectedBook) {
    return (
      <QuizScreen
        user={currentUser}
        book={selectedBook}
        onBack={handleBackToBookDetail}
        onQuizComplete={handleQuizComplete}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <HomeScreen
        user={currentUser}
        onNavigateToIntensive={handleNavigateToIntensive}
        onNavigateToExtensive={handleNavigateToExtensive}
        onNavigateToProfile={handleNavigateToProfile}
        onSignOut={handleSignOut}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
});

export default App;