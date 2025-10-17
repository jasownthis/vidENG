// Convert a PDF into page images and upload to Firebase Storage + Firestore (grade-scoped)
// Usage:
//   node scripts/convertAndUploadBook.js <bookId> <title> <description> <grade> <category> <pdfPath> [coverPath]
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
  const [bookId, title, description, gradeArg, category, pdfPath, coverPathArg] = process.argv.slice(2);
  if (!bookId || !title || !description || !gradeArg || !category || !pdfPath) {
    console.error('Usage: node scripts/convertAndUploadBook.js <bookId> <title> <description> <grade> <category> <pdfPath> [coverPath]');
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

  // Upload cover (use provided coverPath if exists, otherwise first page), all pages, and the original PDF
  const basePath = `books/grade_${gradeLevel}/${bookId}`;
  const coverPath = `${basePath}/cover.png`;
  if (coverPathArg && fs.existsSync(coverPathArg)) {
    await uploadFile(bucket, coverPathArg, coverPath, 'image/png');
    console.log('Uploaded provided cover:', coverPath);
  } else {
    await uploadFile(bucket, pageFiles[0], coverPath, 'image/png');
    console.log('Uploaded cover from first page:', coverPath);
  }

  const pagePaths = [];
  for (let i = 0; i < pageFiles.length; i++) {
    const dest = `${basePath}/pages/page_${i + 1}.png`;
    await uploadFile(bucket, pageFiles[i], dest, 'image/png');
    pagePaths.push(dest);
    console.log('Uploaded page:', dest);
  }

  const pdfStoragePath = `${basePath}/book.pdf`;
  await uploadFile(bucket, pdfPath, pdfStoragePath, 'application/pdf');
  console.log('Uploaded PDF:', pdfStoragePath);

  // Write Firestore doc under grades/{grade}/books/{bookId}
  const docData = {
    title,
    description,
    gradeLevel,
    category,
    pageCount: pageFiles.length,
    coverPath,
    pagePaths,
    pdfPath: pdfStoragePath,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await db.collection('grades').doc(String(gradeLevel)).collection('books').doc(bookId).set(docData, { merge: true });
  console.log(`Firestore doc written: grades/${gradeLevel}/books/${bookId}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


