import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Book, User, Question, QuizResult, UserAnswer, Sticker } from '../types';
import bookService from '../services/bookService';
import { Image } from 'react-native';
const congratsGif = require('../../assets/correct_answer_sticker.png');

const { width, height } = Dimensions.get('window');

interface QuizScreenProps {
  user: User;
  book: Book;
  onBack: () => void;
  onQuizComplete: (result: QuizResult) => void;
}

const QuizScreen: React.FC<QuizScreenProps> = ({
  user,
  book,
  onBack,
  onQuizComplete,
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, [book.id]);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      // Prefer Firestore quiz
      const cloud = await bookService.getQuizForBook(book.gradeLevel, book.id);
      if (cloud && cloud.questions?.length) {
        setQuestions(cloud.questions);
      } else if (book.qnaSet && book.qnaSet.questions) {
        setQuestions(book.qnaSet.questions);
      } else {
        Alert.alert('Error', 'No quiz available for this book');
        onBack();
      }
    } catch (error) {
      console.error('Error loading questions:', error);
      Alert.alert('Error', 'Failed to load quiz questions');
      onBack();
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    setSelectedAnswer(answerIndex);
    const currentQuestion = questions[currentQuestionIndex];
    const isCorrect = answerIndex === currentQuestion.correctAnswer;

    const newUserAnswers = [...userAnswers, {
      questionId: currentQuestion.id,
      selectedAnswer: answerIndex,
      isCorrect,
    }];
    setUserAnswers(newUserAnswers);

    if (isCorrect) {
      setShowCongrats(true);
      setTimeout(() => {
        setShowCongrats(false);
        if (currentQuestionIndex < questions.length - 1) {
          setCurrentQuestionIndex(currentQuestionIndex + 1);
          setSelectedAnswer(null);
        } else {
          completeQuiz(newUserAnswers);
        }
      }, 1200);
    } else {
      Alert.alert('Try again', 'That’s not correct. Give it another shot!');
      // Do not advance; allow user to pick again
      // Optionally clear selection after brief delay for visual feedback
      setTimeout(() => setSelectedAnswer(null), 500);
    }
  };

  // No explicit Next button; advancing is handled in handleAnswerSelect

  const completeQuiz = async (finalAnswers: UserAnswer[]) => {
    const correctAnswers = finalAnswers.filter(answer => answer.isCorrect).length;
    const totalQuestions = questions.length;
    const score = correctAnswers;
    const passingScore = Math.ceil(totalQuestions); // require all correct
    const passed = score >= passingScore;

    const quizResult: QuizResult = {
      userId: user.id,
      bookId: book.id,
      score,
      totalQuestions,
      passed,
      answers: finalAnswers,
      completedAt: new Date(),
      // TODO: Add sticker logic based on passing
    };
    setQuizCompleted(true);

    // Persist result
    await bookService.saveQuizResult(quizResult);

    // Award sticker if passed and for known book
    if (passed) {
      const sticker: Sticker = {
        id: `sticker_${book.id}`,
        name: `${book.title} Award`,
        imageUrl: 'books/grade_' + book.gradeLevel + '/' + book.id + '/sticker.png',
        description: 'Awarded for completing the quiz with all correct answers',
      };
      await bookService.awardSticker(user.id, sticker);
    }

    Alert.alert(
      passed ? 'Congratulations! 🎉' : 'Good Effort! 💪',
      passed 
        ? `You scored ${score}/${totalQuestions}! You've earned a sticker!`
        : `You scored ${score}/${totalQuestions}. Keep practicing and try again!`,
      [
        {
          text: 'Continue',
          onPress: () => onQuizComplete(quizResult),
        },
      ]
    );
  };

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>Loading quiz...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>No questions available</Text>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.bookTitle} numberOfLines={1} ellipsizeMode="tail">{book.title}</Text>
          <Text style={styles.questionCounter}>Question {currentQuestionIndex + 1} of {questions.length}</Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentCenter} showsVerticalScrollIndicator={false}>
        {/* Centered big question */}
        <View style={styles.questionContainer}>
          <Text style={styles.bigQuestionText}>{currentQuestion.question}</Text>
        </View>

        {/* 2x2 options grid */}
        <View style={styles.optionsGrid}>
          {currentQuestion.options.map((option, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.optionBox,
                selectedAnswer === index && styles.selectedOption,
              ]}
              onPress={() => handleAnswerSelect(index)}
              activeOpacity={0.85}
            >
              <Text style={styles.optionBoxText}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Optional explanation if provided */}
        {selectedAnswer !== null && currentQuestion.explanation && (
          <View style={styles.explanationContainer}>
            <Text style={styles.explanationTitle}>💡 Did you know?</Text>
            <Text style={styles.explanationText}>{currentQuestion.explanation}</Text>
          </View>
        )}
      </ScrollView>

      {/* Progress Bar moved to bottom */}
      <View style={styles.progressContainerBottom}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>{Math.round(progress)}% Complete</Text>
      </View>

      {/* No Next button; auto-advance on correct answer */}

      {/* Congrats GIF Overlay */}
      {showCongrats && (
        <View style={styles.overlayBackdrop} pointerEvents="none">
          <View style={styles.overlayGlass}>
            <View style={styles.overlayCenter}>
              <Image source={congratsGif} style={styles.overlayGif} resizeMode="contain" />
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
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
  errorText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
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
  questionCounter: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#F9F9F9',
  },
  progressContainerBottom: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#ffffff',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  contentCenter: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: height * 0.8,
    paddingTop: height * 0.08,
  },
  questionContainer: {
    paddingVertical: 24,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  bigQuestionText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2E7D32',
    lineHeight: 30,
    textAlign: 'center',
  },
  optionsContainer: {
    paddingVertical: 10,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 10,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 640,
  },
  optionBox: {
    width: '48%',
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  optionBoxText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    fontWeight: '600',
  },
  selectedOption: {
    backgroundColor: '#E8F5E8',
    borderColor: '#2E7D32',
  },
  optionButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  optionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  selectedCircle: {
    backgroundColor: '#2E7D32',
  },
  optionLetter: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  selectedLetter: {
    color: '#ffffff',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  selectedOptionText: {
    color: '#2E7D32',
    fontWeight: '500',
  },
  explanationContainer: {
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 20,
    marginVertical: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  explanationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F57F17',
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 14,
    color: '#5D4037',
    lineHeight: 20,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  nextButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  disabledButton: {
    backgroundColor: '#E0E0E0',
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disabledButtonText: {
    color: '#999',
  },
  overlayBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 9999,
    elevation: 10,
  },
  overlayGlass: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.12)'
  },
  overlayGif: {
    width: width * 1.15,
    height: 400,
  },
  overlayCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default QuizScreen;

