import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GRADE_LEVELS } from '../types';

const { width } = Dimensions.get('window');

interface GradeSelectionScreenProps {
  onGradeSelect: (grade: number) => void;
  currentGrade?: number;
}

const GradeSelectionScreen: React.FC<GradeSelectionScreenProps> = ({ 
  onGradeSelect, 
  currentGrade 
}) => {
  const renderGradeCard = ({ item: grade }: { item: number }) => (
    <TouchableOpacity
      style={[
        styles.gradeCard,
        currentGrade === grade && styles.selectedGradeCard
      ]}
      onPress={() => onGradeSelect(grade)}
    >
      <View style={styles.gradeIconContainer}>
        <Text style={styles.gradeIcon}>📚</Text>
      </View>
      <Text style={[
        styles.gradeText,
        currentGrade === grade && styles.selectedGradeText
      ]}>
        Grade {grade}
      </Text>
      <Text style={[
        styles.gradeDescription,
        currentGrade === grade && styles.selectedGradeDescription
      ]}>
        Age {grade + 5}-{grade + 6}
      </Text>
      {currentGrade === grade && (
        <View style={styles.selectedIndicator}>
          <Text style={styles.selectedIcon}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Image 
          source={require('../../assets/videng_logo_full.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.title}>🎓 Select Your Grade</Text>
        <Text style={styles.subtitle}>
          Choose your current grade level to get personalized books
        </Text>
      </View>

      <FlatList
        data={GRADE_LEVELS}
        renderItem={renderGradeCard}
        keyExtractor={(item) => item.toString()}
        numColumns={2}
        contentContainerStyle={styles.gradesList}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.footerContainer}>
        <Text style={styles.footerText}>
          💡 You can change your grade level anytime in settings
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
  headerContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  logoImage: {
    width: width * 0.6,
    height: 80,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  gradesList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  gradeCard: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    margin: 8,
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 140,
    justifyContent: 'center',
    position: 'relative',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectedGradeCard: {
    backgroundColor: '#E8F5E8',
    borderColor: '#4CAF50',
    elevation: 4,
    shadowOpacity: 0.2,
  },
  gradeIconContainer: {
    marginBottom: 10,
  },
  gradeIcon: {
    fontSize: 32,
  },
  gradeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  selectedGradeText: {
    color: '#2E7D32',
  },
  gradeDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  selectedGradeDescription: {
    color: '#4CAF50',
  },
  selectedIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedIcon: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  footerContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default GradeSelectionScreen;

