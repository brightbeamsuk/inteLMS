const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { ObjectStorageService } = require('./server/objectStorage.ts');

async function createTestCertificate() {
  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);
    
    // Embed a font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Add title
    page.drawText('Certificate of Completion', {
      x: 150,
      y: 300,
      size: 24,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    
    // Add placeholders that the system can replace
    page.drawText('This certifies that {{learner_name}}', {
      x: 50,
      y: 250,
      size: 16,
      font: font,
      color: rgb(0, 0, 0),
    });
    
    page.drawText('has successfully completed the course:', {
      x: 50,
      y: 220,
      size: 14,
      font: font,
      color: rgb(0, 0, 0),
    });
    
    page.drawText('{{course_name}}', {
      x: 50,
      y: 190,
      size: 18,
      font: boldFont,
      color: rgb(0, 0, 0.8),
    });
    
    page.drawText('Date of completion: {{completion_date}}', {
      x: 50,
      y: 150,
      size: 12,
      font: font,
      color: rgb(0, 0, 0),
    });
    
    // Add border
    page.drawRectangle({
      x: 20,
      y: 20,
      width: 560,
      height: 360,
      borderColor: rgb(0, 0, 0),
      borderWidth: 2,
    });
    
    // Serialize the PDF
    const pdfBytes = await pdfDoc.save();
    
    // Upload to object storage
    const objectStorage = new ObjectStorageService();
    const privateDir = process.env.PRIVATE_OBJECT_DIR;
    const filename = 'certificate-template-1758438567691.pdf';
    const destPath = `${privateDir}/certificate-templates/${filename}`;
    
    console.log('Uploading PDF to:', destPath);
    
    const result = await objectStorage.uploadObject(
      destPath,
      Buffer.from(pdfBytes),
      'application/pdf',
      { public: false }
    );
    
    console.log('Upload successful:', result);
    console.log('Certificate template created and uploaded successfully!');
    
  } catch (error) {
    console.error('Error creating certificate:', error);
  }
}

createTestCertificate();