#!/usr/bin/env node

/**
 * PDF to Images Converter Script
 * Converts PDF pages to PNG images for React Native display
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Configuration
const PDF_PATH = path.join(__dirname, '../assets/books/8.pdf');
const OUTPUT_DIR = path.join(__dirname, '../assets/books/pages');
const BOOK_ID = 'book_002';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function convertPdfToImages() {
  return new Promise((resolve, reject) => {
    // Check if PDF exists
    if (!fs.existsSync(PDF_PATH)) {
      reject(new Error(`PDF file not found: ${PDF_PATH}`));
      return;
    }

    console.log('🔄 Converting PDF to images...');
    console.log(`📖 PDF: ${PDF_PATH}`);
    console.log(`📁 Output: ${OUTPUT_DIR}`);

    // Use ImageMagick convert command to convert PDF to images
    const outputPattern = path.join(OUTPUT_DIR, `${BOOK_ID}_page_%03d.png`);
    const command = `convert -density 200 -quality 90 "${PDF_PATH}" "${outputPattern}"`;

    console.log(`🚀 Running: ${command}`);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Error converting PDF:', error.message);
        
        // Try alternative approach with poppler-utils (pdftoppm)
        console.log('🔄 Trying alternative method with pdftoppm...');
        const altCommand = `pdftoppm -png -r 200 "${PDF_PATH}" "${path.join(OUTPUT_DIR, BOOK_ID + '_page')}"`;
        
        exec(altCommand, (altError, altStdout, altStderr) => {
          if (altError) {
            console.error('❌ Alternative method also failed:', altError.message);
            console.log('\n📋 To fix this, install one of these tools:');
            console.log('   • ImageMagick: brew install imagemagick');
            console.log('   • Poppler: brew install poppler');
            reject(altError);
          } else {
            console.log('✅ PDF converted successfully using pdftoppm!');
            listGeneratedImages();
            resolve();
          }
        });
      } else {
        console.log('✅ PDF converted successfully using ImageMagick!');
        if (stderr) {
          console.log('⚠️  Warnings:', stderr);
        }
        listGeneratedImages();
        resolve();
      }
    });
  });
}

function listGeneratedImages() {
  try {
    const files = fs.readdirSync(OUTPUT_DIR)
      .filter(file => file.startsWith(BOOK_ID) && file.endsWith('.png'))
      .sort();
    
    console.log(`\n📸 Generated ${files.length} page images:`);
    files.forEach((file, index) => {
      const filePath = path.join(OUTPUT_DIR, file);
      const stats = fs.statSync(filePath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`   ${index + 1}. ${file} (${sizeMB} MB)`);
    });
    
    // Create a simple index file
    const indexData = {
      bookId: BOOK_ID,
      totalPages: files.length,
      pages: files.map((file, index) => ({
        pageNumber: index + 1,
        fileName: file,
        filePath: `./assets/books/pages/${file}`
      }))
    };
    
    const indexPath = path.join(OUTPUT_DIR, 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));
    console.log(`\n📋 Created index file: ${indexPath}`);
    
  } catch (error) {
    console.error('❌ Error listing images:', error.message);
  }
}

// Run the conversion
if (require.main === module) {
  convertPdfToImages()
    .then(() => {
      console.log('\n🎉 PDF conversion completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 PDF conversion failed:', error.message);
      process.exit(1);
    });
}

module.exports = { convertPdfToImages };
