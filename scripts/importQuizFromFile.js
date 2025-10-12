// Generic quiz importer for ANY book
// Usage: node scripts/importQuizFromFile.js <grade> <bookId> <quizJsonPath> [stickerPath]
// quizJson schema:
// {
//   "passingScore": 8, // optional (defaults to questions.length)
//   "questions": [
//     { "id": "q1", "question": "...", "options": ["A","B","C","D"], "correctAnswer": 0 }
//   ]
// }

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS not set. Export your service account JSON.');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket: 'videng-reading-app-firebasestorage.app' // fallback; we will use bucket() anyway
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket('videng-reading-app.firebasestorage.app');

async function main() {
  const [gradeArg, bookId, quizPathArg, stickerPathArg] = process.argv.slice(2);
  if (!gradeArg || !bookId || !quizPathArg) {
    console.error('Usage: node scripts/importQuizFromFile.js <grade> <bookId> <quizJsonPath> [stickerPath]');
    process.exit(1);
  }
  const grade = String(gradeArg);
  const quizJsonPath = path.resolve(process.cwd(), quizPathArg);
  if (!fs.existsSync(quizJsonPath)) {
    console.error('Quiz JSON not found at', quizJsonPath);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(quizJsonPath, 'utf8'));
  const questions = Array.isArray(raw.questions) ? raw.questions : [];
  if (questions.length === 0) {
    console.error('Quiz JSON has no questions');
    process.exit(1);
  }
  const passingScore = Number.isInteger(raw.passingScore) ? raw.passingScore : questions.length;

  const ref = db.collection('grades').doc(grade).collection('books').doc(bookId).collection('quiz').doc('default');
  await ref.set({ questions, passingScore, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  console.log(`Quiz imported for grades/${grade}/books/${bookId}/quiz/default with ${questions.length} questions`);

  if (stickerPathArg) {
    const abs = path.resolve(process.cwd(), stickerPathArg);
    if (fs.existsSync(abs)) {
      const dest = `books/grade_${grade}/${bookId}/sticker.png`;
      await bucket.upload(abs, { destination: dest, metadata: { contentType: 'image/png' } });
      console.log('Sticker uploaded to', dest);
    } else {
      console.warn('Sticker path not found, skipping:', abs);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });


