// Set quiz questions for a book: grades/{grade}/books/{bookId}/quiz/default
// Usage: node scripts/setQuiz.js <grade> <bookId>

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

async function main() {
  const [gradeArg, bookId] = process.argv.slice(2);
  if (!gradeArg || !bookId) {
    console.error('Usage: node scripts/setQuiz.js <grade> <bookId>');
    process.exit(1);
  }
  const grade = String(gradeArg);

  const questions = [
    { id: 'q1', question: 'Where does the narrator go for the summer?', options: ['Carolina mountains','Florida beach','New York City','Texas ranch'], correctAnswer: 0 },
    { id: 'q2', question: 'Who becomes the narrator’s companion?', options: ['Jerry, a boy','Sarah, a girl','Tom, a neighbor','Miss Smith, teacher'], correctAnswer: 0 },
    { id: 'q3', question: "What is Jerry's pet dog’s name?", options: ['Pointer','Rex','Fido','Spot'], correctAnswer: 0 },
    { id: 'q4', question: 'What story does Jerry tell about his mother?', options: ['She lives in Mannville','She works in a factory','She is a schoolteacher','She lives in the city'], correctAnswer: 0 },
    { id: 'q5', question: 'How does the narrator describe Jerry?', options: ['Caring and honest','Shy and quiet','Loud and rude','Funny and playful'], correctAnswer: 0 },
    { id: 'q6', question: 'Why was Jerry sent to help the narrator?', options: ['For chores and wood chopping','To attend school','To cook meals','To clean the house'], correctAnswer: 0 },
    { id: 'q7', question: 'What does Jerry plan to buy for his mother?', options: ['Gloves','Flowers','A doll','Books'], correctAnswer: 0 },
    { id: 'q8', question: 'How does the narrator feel at the end of the story?', options: ['Sad but hopeful','Angry and confused','Indifferent and distant','Proud and joyful'], correctAnswer: 0 },
  ];

  const passingScore = questions.length;
  const ref = db.collection('grades').doc(grade).collection('books').doc(bookId).collection('quiz').doc('default');
  await ref.set({
    questions,
    passingScore,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`Quiz set for grades/${grade}/books/${bookId}/quiz/default with ${questions.length} questions`);
}

main().catch((e) => { console.error(e); process.exit(1); });


