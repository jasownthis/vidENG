// ============================================================================
// OLD CODE (COMMENTED OUT - KEPT FOR REFERENCE)
// ============================================================================
// Minimal uploader for book_002 assets -> Firebase Storage + Firestore
// Usage: node scripts/uploadBookToCloud.js <bookId> <title> <grade> <category> [pdfPath]
// Requires GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account JSON

// const path = require('path');
// const fs = require('fs');
// const admin = require('firebase-admin');

// if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
//   console.error('GOOGLE_APPLICATION_CREDENTIALS not set. Please export path to service account JSON.');
//   process.exit(1);
// }

// if (!admin.apps.length) {
//   admin.initializeApp({
//     credential: admin.credential.applicationDefault(),
//     storageBucket: 'videng-reading-app.firebasestorage.app',
//   });
// }

// const db = admin.firestore();
// const bucket = admin.storage().bucket();

// async function uploadFile(localPath, destPath, contentType) {
//   await bucket.upload(localPath, {
//     destination: destPath,
//     gzip: false,
//     metadata: {
//       contentType,
//       cacheControl: 'public, max-age=31536000',
//     },
//   });
//   console.log('Uploaded:', destPath);
//   return `gs://${bucket.name}/${destPath}`;
// }

// async function main() {
//   const [bookIdArg, titleArg, gradeArg, categoryArg, pdfPathArg] = process.argv.slice(2);
//   const bookId = bookIdArg || 'book_002';
//   const title = titleArg || 'A Mother in Mannville';
//   const gradeLevel = parseInt(gradeArg || '5', 10);
//   const category = categoryArg || 'intensive';
//   const localPdfPath = pdfPathArg
//     ? path.resolve(process.cwd(), pdfPathArg)
//     : path.resolve(__dirname, '../assets/books/8.pdf');

//   const pagesIndexPath = path.resolve(__dirname, '../assets/books/pages/index.json');
//   const idx = JSON.parse(fs.readFileSync(pagesIndexPath, 'utf-8'));
//   const totalPages = idx.totalPages;

//   // Upload pages
//   const pagePaths = [];
//   for (const p of idx.pages) {
//     const local = path.resolve(__dirname, '..', p.filePath.replace('./', ''));
//     const dest = `books/grade_${gradeLevel}/${bookId}/pages/${p.fileName}`;
//     await uploadFile(local, dest, 'image/png');
//     pagePaths.push(dest);
//   }

//   // Use first page as cover
//   const coverPath = `books/grade_${gradeLevel}/${bookId}/cover.png`;
//   const firstLocal = path.resolve(__dirname, '..', idx.pages[0].filePath.replace('./', ''));
//   await uploadFile(firstLocal, coverPath, 'image/png');

//   // Upload original PDF as well
//   let pdfStoragePath = undefined;
//   if (fs.existsSync(localPdfPath)) {
//     pdfStoragePath = `books/grade_${gradeLevel}/${bookId}/book.pdf`;
//     await uploadFile(localPdfPath, pdfStoragePath, 'application/pdf');
//   } else {
//     console.warn('PDF not found at', localPdfPath, '- skipping PDF upload');
//   }

//   // Write Firestore document
//   const bookDoc = {
//     title,
//     description: 'Imported from local assets',
//     gradeLevel,
//     category,
//     pageCount: totalPages,
//     coverPath,
//     pagePaths,
//     pdfPath: pdfStoragePath,
//     createdAt: admin.firestore.FieldValue.serverTimestamp(),
//     updatedAt: admin.firestore.FieldValue.serverTimestamp(),
//   };
//   await db.collection('grades').doc(String(gradeLevel)).collection('books').doc(bookId).set(bookDoc, { merge: true });
//   console.log(`Firestore doc written at grades/${gradeLevel}/books/${bookId}`);
// }

// main().catch((e) => {
//   console.error(e);
//   process.exit(1);
// });

// ============================================================================
// NEW CODE: Update only PDF and pages (keeps existing metadata)
// ============================================================================
// Update only PDF and pages for an existing book (keeps existing metadata)
// Usage:
//   node scripts/uploadBookToCloud.js <bookId> <grade> <pdfPath>
// Requires GOOGLE_APPLICATION_CREDENTIALS set to a Firebase service account JSON

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const admin = require('firebase-admin');

function sh(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 20 }, (err, stdout, stderr) => {
      if (err) return reject(Object.assign(new Error(err.message), { stderr }));
      resolve({ stdout, stderr });
    });
  });
}

function sortByPageNumber(files) {
  return files
    .map(f => ({ f, n: parseInt((f.match(/(\d+)/g) || ['0']).pop(), 10) }))
    .sort((a, b) => a.n - b.n)
    .map(x => x.f);
}

async function ensureAdmin() {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS not set');
  }
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      storageBucket: 'videng-reading-app.firebasestorage.app',
    });
  }
  return { db: admin.firestore(), bucket: admin.storage().bucket() };
}

async function convertPdfToPngs(pdfPath, outDir, prefix) {
  fs.mkdirSync(outDir, { recursive: true });

  // Try ImageMagick
  const magickOutput = path.join(outDir, `${prefix}_page-%d.png`);
  const convertCmd = `convert -density 200 -quality 90 "${pdfPath}" "${magickOutput}"`;
  try {
    await sh(convertCmd);
  } catch (e) {
    // Fallback to pdftoppm
    const ppmPrefix = path.join(outDir, `${prefix}_page`);
    const ppmCmd = `pdftoppm -png -r 200 "${pdfPath}" "${ppmPrefix}"`;
    await sh(ppmCmd);
  }

  const files = fs
    .readdirSync(outDir)
    .filter(f => f.startsWith(prefix + '_page') && f.endsWith('.png'));
  if (files.length === 0) {
    throw new Error('No page images generated. Ensure ImageMagick or Poppler is installed.');
  }
  return sortByPageNumber(files).map(f => path.join(outDir, f));
}

async function uploadFile(bucket, localPath, destPath, contentType) {
  await bucket.upload(localPath, {
    destination: destPath,
    gzip: false,
    metadata: { contentType, cacheControl: 'public, max-age=31536000' },
  });
}

async function main() {
  const [bookId, gradeArg, pdfPath] = process.argv.slice(2);
  if (!bookId || !gradeArg || !pdfPath) {
    console.error('Usage: node scripts/uploadBookToCloud.js <bookId> <grade> <pdfPath>');
    process.exit(1);
  }
  const gradeLevel = parseInt(gradeArg, 10);
  if (!fs.existsSync(pdfPath)) {
    console.error('PDF not found at', pdfPath);
    process.exit(1);
  }

  const { db, bucket } = await ensureAdmin();

  // Convert PDF to images under a tmp directory
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'videng-'));
  const outDir = path.join(tmpRoot, bookId);
  const prefix = bookId;
  console.log('Converting PDF → images...');
  const pageFiles = await convertPdfToPngs(pdfPath, outDir, prefix);
  console.log(`Generated ${pageFiles.length} pages in ${outDir}`);

  const basePath = `books/grade_${gradeLevel}/${bookId}`;

  // Upload only pages (NOT cover - keep existing cover)
  const pagePaths = [];
  for (let i = 0; i < pageFiles.length; i++) {
    const dest = `${basePath}/pages/page_${i + 1}.png`;
    await uploadFile(bucket, pageFiles[i], dest, 'image/png');
    pagePaths.push(dest);
    console.log('Uploaded page:', dest);
  }

  // Upload PDF
  const pdfStoragePath = `${basePath}/book.pdf`;
  await uploadFile(bucket, pdfPath, pdfStoragePath, 'application/pdf');
  console.log('Uploaded PDF:', pdfStoragePath);

  // Update Firestore with ONLY: pageCount, pagePaths, pdfPath, updatedAt
  // Using merge: true to keep existing title, description, coverPath, etc.
  const docData = {
    pageCount: pageFiles.length,
    pagePaths,
    pdfPath: pdfStoragePath,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await db.collection('grades').doc(String(gradeLevel)).collection('books').doc(bookId).set(docData, { merge: true });
  console.log(`Firestore updated (pages/PDF only): grades/${gradeLevel}/books/${bookId}`);
  console.log('✅ Kept existing metadata: title, description, cover, quiz, sticker');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


