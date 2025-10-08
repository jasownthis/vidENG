// Write quiz for a book and optionally upload a sticker image
// Usage: node scripts/writeQuizForBook.js <grade> <bookId> [stickerLocalPath]

const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS not set. Export your service account JSON.');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket: 'videng-reading-app.firebasestorage.app',
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

async function uploadStickerIfProvided(grade, bookId, stickerLocalPath) {
  try {
    if (!stickerLocalPath) return null;
    const abs = path.resolve(stickerLocalPath);
    if (!fs.existsSync(abs)) {
      console.warn('Sticker file not found at', abs, '- skipping');
      return null;
    }
    const dest = `books/grade_${grade}/${bookId}/sticker.png`;
    await bucket.upload(abs, {
      destination: dest,
      gzip: false,
      metadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000' },
    });
    console.log('Uploaded sticker:', dest);
    return dest;
  } catch (e) {
    console.warn('Sticker upload failed:', e.message);
    return null;
  }
}

async function main() {
  const [gradeArg, bookId, stickerArg] = process.argv.slice(2);
  if (!gradeArg || !bookId) {
    console.error('Usage: node scripts/writeQuizForBook.js <grade> <bookId> [stickerLocalPath]');
    process.exit(1);
  }
  const grade = parseInt(gradeArg, 10);

  // Quiz from user specification
  const questions = [
    {
      id: 'q1',
      question: 'What is the little girl\'s name?',
      options: ['Daisy', 'Lily', 'Rose', 'Emma'],
      correctAnswer: 1,
    },
    {
      id: 'q2',
      question: 'What did Lily find in the forest?',
      options: ['A secret fountain', 'A hidden door', 'An old well', 'A big cave'],
      correctAnswer: 1,
    },
    {
      id: 'q3',
      question: 'Who is Elwin?',
      options: ['A forest elf', 'A talking squirrel', 'A wise owl', 'A tiny fairy'],
      correctAnswer: 0,
    },
    {
      id: 'q4',
      question: 'What creatures were in the magical garden?',
      options: ['Unicorns and fairies', 'Tigers and lions', 'Bears and wolves', 'Dragons and phoenix'],
      correctAnswer: 0,
    },
    {
      id: 'q5',
      question: 'What is the story\'s moral?',
      options: ['Friendship grows magically', 'Family gives strength', 'Curiosity brings trouble', 'Magic solves problems'],
      correctAnswer: 1,
    },
  ];

  const passingScore = questions.length; // require all correct

  // Write quiz doc: grades/{grade}/books/{bookId}/quiz/default
  const quizRef = db.collection('grades').doc(String(grade)).collection('books').doc(bookId).collection('quiz').doc('default');
  await quizRef.set(
    {
      questions,
      passingScore,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  console.log(`Quiz written at grades/${grade}/books/${bookId}/quiz/default`);

  // Sticker upload (optional)
  const stickerPath = await uploadStickerIfProvided(grade, bookId, stickerArg);
  if (stickerPath) {
    console.log('Sticker available at:', stickerPath);
  } else {
    console.log('No sticker uploaded in this run. You can upload later to books/grade_" + grade + "/" + bookId + "/sticker.png');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


