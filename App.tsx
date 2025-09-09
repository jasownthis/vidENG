import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
} from 'react-native';

import SplashScreen from './src/components/SplashScreen';
import LoginScreen from './src/screens/LoginScreen';
import GradeSelectionScreen from './src/screens/GradeSelectionScreen';
import HomeScreen from './src/screens/HomeScreen';
import authService from './src/services/authService';
import { User } from './src/types';

const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showGradeSelection, setShowGradeSelection] = useState(false);

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
    // TODO: Navigate to intensive reading section
    console.log('Navigate to Intensive Reading');
  };

  const handleNavigateToExtensive = () => {
    // TODO: Navigate to extensive reading section
    console.log('Navigate to Extensive Reading');
  };

  const handleNavigateToProfile = () => {
    // TODO: Navigate to profile screen
    console.log('Navigate to Profile');
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