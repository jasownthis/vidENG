import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Alert,
  StatusBar,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Book, BookProgress, User } from '../types';
import bookService from '../services/bookService';

const { width, height } = Dimensions.get('window');

interface SimpleBookReaderScreenProps {
  user: User;
  book: Book;
  onBack: () => void;
  onBookComplete: () => void;
}

const SimpleBookReaderScreen: React.FC<SimpleBookReaderScreenProps> = ({
  user,
  book,
  onBack,
  onBookComplete,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages] = useState(8); // Mock total pages for "A Mother in Mannville"
  const [progress, setProgress] = useState<BookProgress | null>(null);
  const [startTime, setStartTime] = useState<Date>(new Date());

  // Mock book content - in real app, this would come from converted PDF images
  const mockBookPages = [
    {
      pageNumber: 1,
      content: `A MOTHER IN MANNVILLE

By Marjorie Kinnan Rawlings

The orphanage is high in the Carolina mountains. Sometimes in winter the snowdrifts are so deep that the institution is cut off from the village below, from all the world. It was in the autumn that I came to the orphanage to finish a book. I needed the quiet and the peace of the mountains.

I was given a cabin to use as a study. The orphanage was self-supporting, and the boys and girls raised their own food and worked at various tasks. They were mostly between the ages of eight and sixteen. I was delighted to find that my cabin was to be cleaned by a boy named Jerry.`,
    },
    {
      pageNumber: 2,
      content: `Jerry was twelve years old. He had been at the orphanage since he was four. He was a quiet boy, but when he smiled, his whole face lighted up. He was eager to help and seemed to understand that I needed quiet for my work.

Every morning Jerry would come to clean the cabin. He would work silently, dusting and sweeping. Sometimes I would look up from my writing to find him standing quietly, waiting to see if I needed anything.

"Is there anything else I can do for you?" he would ask.

I grew fond of Jerry. He had a way of anticipating my needs. When the nights grew cold, he would bring wood for the fireplace without being asked.`,
    },
    {
      pageNumber: 3,
      content: `One day I was working on a particularly difficult chapter. I was frustrated and had crumpled up several sheets of paper. Jerry was cleaning quietly in the corner.

"Is your writing not going well today?" he asked softly.

I was surprised. Most children his age would not have noticed or cared about an adult's work troubles.

"No, Jerry, it's not going well at all," I admitted.

He nodded seriously. "Sometimes when I have trouble with my lessons, I take a walk in the woods. It helps me think better."

I looked at this wise twelve-year-old boy. "That's very good advice, Jerry. Would you like to take a walk with me?"`,
    },
    {
      pageNumber: 4,
      content: `We walked together through the mountain woods. Jerry knew every path, every tree. He showed me where the wild berries grew and where the deer came to drink from the stream.

"You know these mountains very well," I said.

"Yes, ma'am. I've lived here most of my life. The mountains are like my home."

"Tell me about your family, Jerry. Do you remember them?"

Jerry was quiet for a long time. Then he said, "I don't remember much about before I came here. But I have a mother."

"A mother?" I was surprised. I had assumed all the children at the orphanage were truly orphans.

"Yes, ma'am. She lives in Mannville. She's not able to take care of me right now, but someday she will."`,
    },
    {
      pageNumber: 5,
      content: `I was touched by Jerry's faith in his mother. Over the next few weeks, he often spoke of her. He told me she was beautiful and kind. He said she worked hard but couldn't afford to keep him with her.

"She sends me letters," Jerry said one day. "And sometimes she sends me things."

I never saw any letters, but I didn't question him. If it gave him comfort to believe his mother was thinking of him, who was I to doubt?

Jerry's devotion to his imaginary mother was complete. He saved his small allowance to buy her Christmas presents. He spoke of the day when she would come to take him home.

The other children at the orphanage seemed to accept Jerry's stories about his mother. Perhaps they envied him for having someone to dream about.`,
    },
    {
      pageNumber: 6,
      content: `As the weeks passed, Jerry and I became good friends. He would sit by the fire in the evenings and listen to me read from the stories I was writing. He was an intelligent boy with a good understanding of people and their feelings.

"Your stories are about real people, aren't they?" he asked one evening.

"What do you mean, Jerry?"

"I mean, even though you make up the names and the places, the feelings are real. The way people love each other and hurt each other - that's all real."

I was amazed by his insight. "Yes, Jerry. That's exactly right. How did you know that?"

He shrugged. "I guess when you don't have much, you learn to understand what's important."`,
    },
    {
      pageNumber: 7,
      content: `When it came time for me to leave the orphanage, I was sad to say goodbye to Jerry. He had become very dear to me. I wanted to do something special for him before I left.

"Jerry," I said, "I'd like to meet your mother. Could you arrange for me to visit her in Mannville?"

Jerry's face went pale. He looked down at his feet and was quiet for a long time.

"She... she's very busy," he said finally. "She works all the time. I don't think she could see you."

"I understand she's busy, but I'd really like to meet her. Just for a few minutes. I could tell her what a wonderful son she has."

Jerry looked up at me with tears in his eyes. "Please don't ask me that," he whispered.`,
    },
    {
      pageNumber: 8,
      content: `That evening, I spoke to the superintendent of the orphanage about Jerry's mother.

"Jerry's mother?" The superintendent looked puzzled. "Jerry doesn't have a mother. His parents died when he was very young. He's been here since he was four years old."

I was stunned. "But he talks about her all the time. He says she lives in Mannville."

The superintendent shook his head sadly. "Jerry has always told stories about having a mother. We've never discouraged him. Sometimes children need to believe in something, even if it isn't real."

I understood then why Jerry had looked so frightened when I asked to meet his mother. His love for her was real, even if she existed only in his heart.

When I said goodbye to Jerry the next morning, I hugged him tightly.

"Take care of yourself, Jerry," I said.

"I will," he promised. "And I'll take care of my mother too."

I never corrected him. Some truths are too precious to destroy.

THE END`,
    },
  ];

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

  const currentPageContent = mockBookPages.find(p => p.pageNumber === currentPage);

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

      {/* Book Content */}
      <ScrollView style={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.pageContainer}>
          <Text style={styles.pageContent}>
            {currentPageContent?.content || 'Loading page content...'}
          </Text>
        </View>
      </ScrollView>

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
    backgroundColor: '#ffffff',
  },
  pageContainer: {
    padding: 20,
    minHeight: height * 0.6,
  },
  pageContent: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    textAlign: 'justify',
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

export default SimpleBookReaderScreen;
