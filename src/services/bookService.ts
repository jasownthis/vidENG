import { Book, BookProgress } from '../types';
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';

class BookService {
  // Mock books data (later will come from Firebase/Admin)
  private mockBooks: Book[] = [
    {
      id: 'book_002',
      title: 'A Mother in Mannville',
      description: 'A heartwarming story about Jerry, a young boy at an orphanage in the mountains, who befriends the narrator and helps him with daily chores. Through their friendship, we discover the power of imagination, loyalty, and the deep human need for connection and belonging.',
      coverUrl: '', // Will be generated from first page
      pages: [
        { pageNumber: 1, imageUrl: '../../assets/books/pages/book_002_page-1.png' },
        { pageNumber: 2, imageUrl: '../../assets/books/pages/book_002_page-2.png' },
        { pageNumber: 3, imageUrl: '../../assets/books/pages/book_002_page-3.png' },
        { pageNumber: 4, imageUrl: '../../assets/books/pages/book_002_page-4.png' },
        { pageNumber: 5, imageUrl: '../../assets/books/pages/book_002_page-5.png' },
        { pageNumber: 6, imageUrl: '../../assets/books/pages/book_002_page-6.png' },
        { pageNumber: 7, imageUrl: '../../assets/books/pages/book_002_page-7.png' },
      ], // PDF converted to 7 page images
      gradeLevel: 5,
      category: 'intensive',
      createdAt: new Date(),
      updatedAt: new Date(),
      qnaSet: {
        id: 'qna_002',
        bookId: 'book_002',
        questions: [
          {
            id: 'q1',
            question: 'What is the main character\'s name in the story?',
            options: ['Jerry', 'John', 'James', 'Jack'],
            correctAnswer: 0,
            explanation: 'The main character is Jerry, a young boy living at the orphanage.'
          },
          {
            id: 'q2',
            question: 'Where does the story take place?',
            options: ['A city', 'A farm', 'An orphanage in the mountains', 'A school'],
            correctAnswer: 2,
            explanation: 'The story takes place at an orphanage in the mountains.'
          },
          {
            id: 'q3',
            question: 'What does Jerry do to help the narrator?',
            options: ['Cooks meals', 'Chops wood and helps with chores', 'Teaches him to read', 'Shows him around town'],
            correctAnswer: 1,
            explanation: 'Jerry helps by chopping wood and doing various chores around the cabin.'
          }
        ],
        passingScore: 2,
        createdAt: new Date()
      }
    }
  ];

  // Get all books for a specific grade and category
  async getBooks(gradeLevel?: number, category?: 'intensive' | 'extensive'): Promise<Book[]> {
    try {
      // For now, return mock books filtered by criteria
      let filteredBooks = this.mockBooks;

      if (gradeLevel) {
        filteredBooks = filteredBooks.filter(book => book.gradeLevel === gradeLevel);
      }

      if (category) {
        filteredBooks = filteredBooks.filter(book => book.category === category);
      }

      return filteredBooks;
    } catch (error) {
      console.error('Error fetching books:', error);
      return [];
    }
  }

  // Get a specific book by ID
  async getBookById(bookId: string): Promise<Book | null> {
    try {
      const book = this.mockBooks.find(b => b.id === bookId);
      return book || null;
    } catch (error) {
      console.error('Error fetching book:', error);
      return null;
    }
  }

  // Get user's progress for a specific book
  async getBookProgress(userId: string, bookId: string): Promise<BookProgress | null> {
    try {
      const progressDoc = await getDoc(doc(db, 'bookProgress', `${userId}_${bookId}`));
      
      if (progressDoc.exists()) {
        return progressDoc.data() as BookProgress;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching book progress:', error);
      return null;
    }
  }

  // Create or update book progress
  async updateBookProgress(progress: BookProgress): Promise<void> {
    try {
      const progressId = `${progress.userId}_${progress.bookId}`;
      await setDoc(doc(db, 'bookProgress', progressId), {
        ...progress,
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error updating book progress:', error);
      throw error;
    }
  }

  // Get all user's book progress
  async getUserBookProgress(userId: string): Promise<BookProgress[]> {
    try {
      const progressQuery = query(
        collection(db, 'bookProgress'),
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(progressQuery);
      const progressList: BookProgress[] = [];
      
      querySnapshot.forEach((doc) => {
        progressList.push(doc.data() as BookProgress);
      });
      
      return progressList;
    } catch (error) {
      console.error('Error fetching user progress:', error);
      return [];
    }
  }

  // Start reading a book (create initial progress)
  async startReading(userId: string, bookId: string): Promise<BookProgress> {
    try {
      const book = await this.getBookById(bookId);
      if (!book) {
        throw new Error('Book not found');
      }

      const progress: BookProgress = {
        bookId,
        userId,
        currentPage: 1,
        totalPages: book.pages.length || 10, // Default to 10 for mock
        isCompleted: false,
        isSubmitted: false,
        startedAt: new Date(),
        pageTimers: {},
        penaltyCount: 0
      };

      await this.updateBookProgress(progress);
      return progress;
    } catch (error) {
      console.error('Error starting book reading:', error);
      throw error;
    }
  }

  // Complete a book (mark as finished)
  async completeBook(userId: string, bookId: string): Promise<void> {
    try {
      const progress = await this.getBookProgress(userId, bookId);
      if (!progress) {
        throw new Error('Book progress not found');
      }

      progress.isCompleted = true;
      progress.completedAt = new Date();

      await this.updateBookProgress(progress);
    } catch (error) {
      console.error('Error completing book:', error);
      throw error;
    }
  }

  // Submit a book (ready for Q&A)
  async submitBook(userId: string, bookId: string): Promise<void> {
    try {
      const progress = await this.getBookProgress(userId, bookId);
      if (!progress) {
        throw new Error('Book progress not found');
      }

      progress.isSubmitted = true;
      progress.completedAt = new Date();

      await this.updateBookProgress(progress);
    } catch (error) {
      console.error('Error submitting book:', error);
      throw error;
    }
  }

  // Get PDF file path for a book
  getBookPdfPath(bookId: string): string {
    // For now, return the mock PDF path
    if (bookId === 'book_001') {
      return 'assets/books/A Mother in mannville.pdf';
    }
    return '';
  }
}

export default new BookService();
