const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

function generateAdmissionPDF(app, res) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 36
  });

  // Set response headers for Express PDF download/inline display
  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Kamalarani_Admission_${app.arn || app.id}.pdf"`);
  }

  doc.pipe(res);

  const leftMargin = 36;
  const contentWidth = 523; // A4 width 595.28 - 72

  // --- Top Header ---
  // Try loading foundation logo if exists
  const logoPath = path.join(__dirname, '../public/images/logo.png');
  let headerStartY = 36;
  if (fs.existsSync(logoPath)) {
    try {
      doc.image(logoPath, leftMargin, headerStartY, { width: 50 });
    } catch (_) {}
  }

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#2B2118').text('KAMALARANI FOUNDATION', leftMargin + 60, headerStartY, { width: contentWidth - 60, align: 'center' });
  doc.font('Helvetica').fontSize(10).fillColor('#B23A2F').text('Sanatan Culture & Social Welfare (Reg. No. AAETK689KE20221)', leftMargin + 60, headerStartY + 22, { width: contentWidth - 60, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#2B2118').text('ART CLASS ADMISSION FORM', leftMargin, headerStartY + 38, { width: contentWidth, align: 'center' });
  doc.font('Helvetica-Oblique').fontSize(9).fillColor('#5A4E40').text('Nursery to Class-VIII', leftMargin, headerStartY + 56, { width: contentWidth, align: 'center' });

  // Top Metadata (ARN & Date)
  const metaY = headerStartY + 74;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
  doc.text(`Admission No. (ARN): ${app.arn || ('KFA-' + new Date().getFullYear() + '-' + String(app.id).padStart(4, '0'))}`, leftMargin, metaY);
  
  const createdDateStr = app.created_at ? new Date(app.created_at).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');
  doc.text(`Admission Date: ${createdDateStr}`, leftMargin + 320, metaY);

  // Passport Photo Box (Top Right)
  const photoBoxX = leftMargin + 415;
  const photoBoxY = headerStartY + 15;
  const photoBoxW = 90;
  const photoBoxH = 105;

  doc.rect(photoBoxX, photoBoxY, photoBoxW, photoBoxH).strokeColor('#8A7F6E').lineWidth(1).stroke();
  
  let photoLoaded = false;
  if (app.passport_photo) {
    const fullPhotoPath = path.join(__dirname, '../public', app.passport_photo);
    if (fs.existsSync(fullPhotoPath)) {
      try {
        doc.image(fullPhotoPath, photoBoxX + 2, photoBoxY + 2, { width: photoBoxW - 4, height: photoBoxH - 4, fit: [photoBoxW - 4, photoBoxH - 4], align: 'center', valign: 'center' });
        photoLoaded = true;
      } catch (e) {
        console.error('Error embedding photo in PDF:', e);
      }
    }
  }

  if (!photoLoaded) {
    doc.font('Helvetica').fontSize(8).fillColor('#8A7F6E').text('Passport Size Photo', photoBoxX + 5, photoBoxY + 45, { width: photoBoxW - 10, align: 'center' });
  }

  // --- Horizontal Divider ---
  let curY = metaY + 22;
  doc.moveTo(leftMargin, curY).lineTo(leftMargin + contentWidth, curY).strokeColor('#CCCCCC').lineWidth(0.8).stroke();
  curY += 14;

  // Helper for key-value row with underline
  function renderField(label, value, x, y, width, labelWidth = 140) {
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#222222').text(label, x, y);
    const valText = value ? String(value) : '—';
    const valX = x + labelWidth;
    doc.font('Helvetica').fontSize(9.5).fillColor('#000000').text(valText, valX, y, { width: width - labelWidth });
    const lineY = y + 12;
    doc.moveTo(valX, lineY).lineTo(x + width, lineY).strokeColor('#B0A8A0').lineWidth(0.5).stroke();
  }

  // Calculate age from DOB
  let ageStr = '—';
  if (app.dob) {
    const dobDate = new Date(app.dob);
    const diffMs = Date.now() - dobDate.getTime();
    const ageDate = new Date(diffMs);
    ageStr = `${Math.abs(ageDate.getUTCFullYear() - 1970)} Years`;
  }

  // Fields Section
  renderField("1. Student's Name:", app.student_name, leftMargin, curY, contentWidth - 110, 110);
  curY += 22;

  renderField("2. Date of Birth (DD/MM/YYYY):", app.dob ? new Date(app.dob).toLocaleDateString('en-IN') : '—', leftMargin, curY, 270, 160);
  renderField("Age:", ageStr, leftMargin + 285, curY, 135, 35);
  curY += 22;

  renderField("3. Gender:", app.gender, leftMargin, curY, contentWidth - 110, 60);
  curY += 22;

  renderField("4. School Name (if any):", app.school_name, leftMargin, curY, 270, 130);
  renderField("Class:", app.class_applying_for, leftMargin + 285, curY, 235, 45);
  curY += 22;

  renderField("5. Father's Name:", app.father_name, leftMargin, curY, 270, 105);
  renderField("Mobile No.:", app.parent_mobile, leftMargin + 285, curY, 235, 75);
  curY += 22;

  renderField("6. Mother's Name:", app.mother_name, leftMargin, curY, 270, 105);
  renderField("Mobile No.:", app.mother_mobile || app.parent_mobile, leftMargin + 285, curY, 235, 75);
  curY += 22;

  renderField("7. Occupation:", app.occupation || '—', leftMargin, curY, 270, 95);
  renderField("Email ID:", app.email || '—', leftMargin + 285, curY, 235, 60);
  curY += 24;

  // Address Section
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#222222').text("8. Residential Address:", leftMargin, curY);
  curY += 16;

  renderField("Vill. / Locality:", app.village_locality || app.address || '—', leftMargin + 15, curY, contentWidth - 15, 90);
  curY += 22;

  renderField("P.O.:", app.po || '—', leftMargin + 15, curY, 240, 40);
  renderField("P.S.:", app.ps || '—', leftMargin + 270, curY, 250, 40);
  curY += 22;

  renderField("Dist.:", app.district || '—', leftMargin + 15, curY, 150, 40);
  renderField("State:", app.state || 'West Bengal', leftMargin + 175, curY, 170, 45);
  renderField("PIN:", app.pin_code || '—', leftMargin + 355, curY, 165, 35);
  curY += 24;

  renderField("9. Aadhaar No. of Student (if applicable):", app.aadhaar_no || '—', leftMargin, curY, contentWidth, 230);
  curY += 22;

  renderField("10. Blood Group:", app.blood_group || '—', leftMargin, curY, 240, 90);
  renderField("Height:", app.height || '—', leftMargin + 270, curY, 250, 50);
  curY += 22;

  renderField("11. Nationality:", app.nationality || 'Indian', leftMargin, curY, 240, 80);
  renderField("Religion:", app.religion || '—', leftMargin + 270, curY, 250, 55);
  curY += 22;

  renderField("12. Category (General/SC/ST/OBC/EWS/Others):", app.category || 'General', leftMargin, curY, contentWidth, 250);
  curY += 28;

  // Box on bottom right: Free Art Materials Checklist
  const boxW = 220;
  const boxH = 135;
  const boxX = leftMargin + contentWidth - boxW;
  const boxY = curY - 5;

  doc.rect(boxX, boxY, boxW, boxH).strokeColor('#666666').lineWidth(0.8).stroke();
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#B23A2F');
  doc.text('Donation from our foundation Art Materials for\nFree Child Development Art Classes:', boxX + 6, boxY + 6, { width: boxW - 12, align: 'center' });

  const items = [
    'Drawing book',
    'Pencil',
    'Eraser',
    'Sharpener',
    'Pencil box',
    'Colour Set Kit for Kids',
    'Plain drawing khata'
  ];

  let itemY = boxY + 32;
  doc.font('Helvetica').fontSize(8).fillColor('#333333');
  for (const item of items) {
    doc.rect(boxX + 12, itemY, 7, 7).strokeColor('#444444').lineWidth(0.6).stroke();
    doc.text(item, boxX + 24, itemY - 1);
    itemY += 14;
  }

  // Parent Signature block (Bottom Left)
  const sigY = curY;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#222222');
  doc.text("Parent's Signature: _______________________", leftMargin, sigY);
  doc.text("Date: ________________________", leftMargin, sigY + 22);
  doc.text("Place: ________________________", leftMargin, sigY + 44);

  // Footer Signatures Line
  const footerSigY = 770;
  doc.moveTo(leftMargin, footerSigY - 10).lineTo(leftMargin + contentWidth, footerSigY - 10).strokeColor('#D0C8C0').lineWidth(0.6).stroke();

  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#2B2118');
  doc.text('PRESIDENT', leftMargin + 30, footerSigY);
  doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#666666').text('Signature', leftMargin + 32, footerSigY + 10);

  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#2B2118').text('SECRETARY', leftMargin + 225, footerSigY);
  doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#666666').text('Signature', leftMargin + 228, footerSigY + 10);

  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#2B2118').text('TREASURER', leftMargin + 415, footerSigY);
  doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#666666').text('Signature', leftMargin + 418, footerSigY + 10);

  // Footer Address
  doc.font('Helvetica').fontSize(7.5).fillColor('#555555').text(
    'Head office: - Village: Panisala, P.O.- Chhat baro Chowki, P.S.- Tufanganj, Coochbehar - 736160, West Bengal, India',
    leftMargin,
    footerSigY + 26,
    { width: contentWidth, align: 'center' }
  );

  doc.end();
}

module.exports = { generateAdmissionPDF };
