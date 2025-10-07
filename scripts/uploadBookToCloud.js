// Minimal uploader for book_002 assets -> Firebase Storage + Firestore
// Usage: node scripts/uploadBookToCloud.js <bookId> <title> <grade> <category> [pdfPath]
// Requires GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account JSON

const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS not set. Please export path to service account JSON.');
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

async function uploadFile(localPath, destPath, contentType) {
  await bucket.upload(localPath, {
    destination: destPath,
    gzip: false,
    metadata: {
      contentType,
      cacheControl: 'public, max-age=31536000',
    },
  });
  console.log('Uploaded:', destPath);
  return `gs://${bucket.name}/${destPath}`;
}

async function main() {
  const [bookIdArg, titleArg, gradeArg, categoryArg, pdfPathArg] = process.argv.slice(2);
  const bookId = bookIdArg || 'book_002';
  const title = titleArg || 'A Mother in Mannville';
  const gradeLevel = parseInt(gradeArg || '5', 10);
  const category = categoryArg || 'intensive';
  const localPdfPath = pdfPathArg
    ? path.resolve(process.cwd(), pdfPathArg)
    : path.resolve(__dirname, '../assets/books/8.pdf');

  const pagesIndexPath = path.resolve(__dirname, '../assets/books/pages/index.json');
  const idx = JSON.parse(fs.readFileSync(pagesIndexPath, 'utf-8'));
  const totalPages = idx.totalPages;

  // Upload pages
  const pagePaths = [];
  for (const p of idx.pages) {
    const local = path.resolve(__dirname, '..', p.filePath.replace('./', ''));
    const dest = `books/grade_${gradeLevel}/${bookId}/pages/${p.fileName}`;
    await uploadFile(local, dest, 'image/png');
    pagePaths.push(dest);
  }

  // Use first page as cover
  const coverPath = `books/grade_${gradeLevel}/${bookId}/cover.png`;
  const firstLocal = path.resolve(__dirname, '..', idx.pages[0].filePath.replace('./', ''));
  await uploadFile(firstLocal, coverPath, 'image/png');

  // Upload original PDF as well
  let pdfStoragePath = undefined;
  if (fs.existsSync(localPdfPath)) {
    pdfStoragePath = `books/grade_${gradeLevel}/${bookId}/book.pdf`;
    await uploadFile(localPdfPath, pdfStoragePath, 'application/pdf');
  } else {
    console.warn('PDF not found at', localPdfPath, '- skipping PDF upload');
  }

  // Write Firestore document
  const bookDoc = {
    title,
    description: 'Imported from local assets',
    gradeLevel,
    category,
    pageCount: totalPages,
    coverPath,
    pagePaths,
    pdfPath: pdfStoragePath,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await db.collection('grades').doc(String(gradeLevel)).collection('books').doc(bookId).set(bookDoc, { merge: true });
  console.log(`Firestore doc written at grades/${gradeLevel}/books/${bookId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


