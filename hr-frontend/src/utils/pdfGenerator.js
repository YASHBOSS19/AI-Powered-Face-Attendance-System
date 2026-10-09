import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getProfileImageUrl } from '../api';

/**
 * Converts an image URL to Base64 data URL for jsPDF embedding
 */
export const loadImageAsBase64 = async (url) => {
  if (!url) return null;
  const resolvedUrl = getProfileImageUrl(url);
  if (!resolvedUrl) return null;

  try {
    const res = await fetch(resolvedUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn('Failed to convert image to Base64 for PDF:', err);
    return null;
  }
};

/**
 * Calculates working duration in hours and formatted string
 */
export const calculateDurationDetails = (checkin, checkout) => {
  if (!checkin || !checkout) return { formatted: '-', hours: 0 };
  try {
    const [h1, m1, s1 = 0] = checkin.split(':').map(Number);
    const [h2, m2, s2 = 0] = checkout.split(':').map(Number);
    let diffMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diffMinutes < 0) diffMinutes += 24 * 60; // Overnight
    const hrs = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    const decimalHours = +(diffMinutes / 60).toFixed(2);
    return { formatted: `${hrs}h ${mins}m`, hours: decimalHours };
  } catch {
    return { formatted: '-', hours: 0 };
  }
};

/**
 * Formats a Date to YYYY-MM-DD
 */
export const formatDateOnly = (dateObj) => {
  if (!dateObj) return '';
  const d = new Date(dateObj);
  if (isNaN(d.getTime())) return String(dateObj);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Generates an Advanced, Executive-Grade Granular PDF Report for an individual employee
 */
export const generateGranularEmployeePDF = async ({
  employee,
  attendanceRecords = [],
  companyName = 'Enterprise Attendance',
  logoUrl = null,
  dateFrom = '',
  dateTo = ''
}) => {
  if (!employee) return;

  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Fetch Profile Picture & Company Logo in Base64
  const [profileBase64, logoBase64] = await Promise.all([
    employee.profile_picture ? loadImageAsBase64(employee.profile_picture) : Promise.resolve(null),
    logoUrl ? loadImageAsBase64(logoUrl) : Promise.resolve(null)
  ]);

  // 2. Compute Granular Attendance Metrics
  const records = [...attendanceRecords].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const presentRecords = records.filter(r => r.status === 'present' || r.status === 'late');
  const onTimeCount = records.filter(r => r.status === 'present').length;
  const lateCount = records.filter(r => r.status === 'late').length;
  const absentCount = records.filter(r => r.status === 'absent').length;
  const totalLoggedDays = records.length;
  const presentDays = presentRecords.length;

  const attendanceRate = totalLoggedDays > 0 
    ? Math.round((presentDays / totalLoggedDays) * 100) 
    : 100;

  const punctualityRate = presentDays > 0 
    ? Math.round((onTimeCount / presentDays) * 100) 
    : 100;

  let totalLoggedHours = 0;
  let recordsWithHours = 0;
  records.forEach(r => {
    if (r.checkin && r.checkout) {
      const dur = calculateDurationDetails(r.checkin, r.checkout);
      if (dur.hours > 0) {
        totalLoggedHours += dur.hours;
        recordsWithHours += 1;
      }
    }
  });

  const avgDailyHours = recordsWithHours > 0 
    ? (totalLoggedHours / recordsWithHours).toFixed(1) 
    : '8.0';

  // --- HEADER SECTION ---
  // Brand Navy Top Bar
  doc.setFillColor(26, 71, 81); // #1a4751
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Brand Teal Accent Strip
  doc.setFillColor(33, 196, 201); // #21c4c9
  doc.rect(0, 28, pageWidth, 2, 'F');

  // Company Logo or Stylized Icon
  let titleX = 14;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', 14, 5, 18, 18, undefined, 'FAST');
      titleX = 36;
    } catch (e) {
      titleX = 14;
    }
  }

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text((companyName || 'Enterprise Attendance').toUpperCase(), titleX, 12);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text('EXECUTIVE ATTENDANCE DOSSIER & BIOMETRIC AUDIT REPORT', titleX, 18);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('CONFIDENTIAL • OFFICIAL HR WORKFORCE RECORDS', titleX, 23);

  // Metadata Box (Right Aligned)
  doc.setFontSize(7.5);
  doc.setTextColor(226, 232, 240);
  const nowStr = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const reportRef = `REP-${employee.employee_id || '000'}-${new Date().toISOString().slice(0,10).replace(/-/g, '')}`;

  let periodText = 'Complete Lifetime History (All Records)';
  if (dateFrom && dateTo) {
    if (dateFrom === dateTo) {
      try {
        const dObj = new Date(dateFrom);
        periodText = `Single Day: ${dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`;
      } catch {
        periodText = `Single Day: ${dateFrom}`;
      }
    } else {
      const [y1, m1, d1] = dateFrom.split('-').map(Number);
      const [y2, m2, d2] = dateTo.split('-').map(Number);
      if (y1 === y2 && m1 === m2 && d1 === 1 && d2 >= 28) {
        const mName = new Date(y1, m1 - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        periodText = `Month of ${mName}`;
      } else {
        periodText = `${dateFrom} to ${dateTo}`;
      }
    }
  } else if (dateFrom) {
    periodText = `From ${dateFrom} to Present`;
  } else if (dateTo) {
    periodText = `Up to ${dateTo}`;
  }

  doc.text(`Ref ID: ${reportRef}`, pageWidth - 14, 10, { align: 'right' });
  doc.text(`Generated: ${nowStr}`, pageWidth - 14, 16, { align: 'right' });
  doc.text(`Period: ${periodText}`, pageWidth - 14, 22, { align: 'right' });

  // --- EMPLOYEE PROFILE CARD WITH PHOTO ---
  const profileCardY = 34;
  const profileCardH = 34;
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(14, profileCardY, pageWidth - 28, profileCardH, 2.5, 2.5, 'FD');

  // Photo Frame (Passport Dimensions 24x26mm)
  const photoX = 18;
  const photoY = profileCardY + 4;
  const photoW = 26;
  const photoH = 26;

  if (profileBase64) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
      doc.rect(photoX, photoY, photoW, photoH, 'FD');
      doc.addImage(profileBase64, 'JPEG', photoX + 0.5, photoY + 0.5, photoW - 1, photoH - 1, undefined, 'FAST');
    } catch (e) {
      // Fallback placeholder
      doc.setFillColor(26, 71, 81);
      doc.roundedRect(photoX, photoY, photoW, photoH, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text((employee.name || 'E').charAt(0).toUpperCase(), photoX + photoW / 2, photoY + photoH / 2 + 5, { align: 'center' });
    }
  } else {
    // Elegant Initials Avatar
    doc.setFillColor(26, 71, 81);
    doc.roundedRect(photoX, photoY, photoW, photoH, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text((employee.name || 'E').charAt(0).toUpperCase(), photoX + photoW / 2, photoY + photoH / 2 + 5, { align: 'center' });
  }

  // Employee Profile Details (Right of Photo)
  const infoX = photoX + photoW + 6;

  // Name & ID Badge
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(employee.name || 'Employee Profile', infoX, profileCardY + 8);

  // ID Monospace Pill
  doc.setFillColor(224, 242, 254); // sky-100
  doc.setDrawColor(186, 230, 253); // sky-200
  const idText = `ID: ${employee.employee_id || 'N/A'}`;
  const idWidth = doc.getTextWidth(idText) + 6;
  doc.roundedRect(infoX + doc.getTextWidth(employee.name || 'Employee Profile') + 4, profileCardY + 3.5, idWidth, 5.5, 1, 1, 'FD');
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(3, 105, 161); // sky-700
  doc.text(idText, infoX + doc.getTextWidth(employee.name || 'Employee Profile') + 7, profileCardY + 7.5);

  // Meta Row 1: Department & Position
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105); // slate-600
  const deptText = employee.department || employee.domain || 'General Department';
  const posText = employee.position || 'Staff Member';
  doc.text(`Department: ${deptText}    |    Position: ${posText}`, infoX, profileCardY + 14);

  // Meta Row 2: Email & Phone
  const emailText = employee.email || 'N/A';
  const phoneText = employee.phone || 'N/A';
  doc.text(`Email: ${emailText}    |    Contact: ${phoneText}`, infoX, profileCardY + 20);

  // Meta Row 3: Biometric Status & Joining Date
  const joinDate = employee.registered_date ? formatDateOnly(employee.registered_date) : 'Active';
  const bioStatus = employee.embedding_name ? 'Face Biometric Enrolled' : 'Standard PIN/QR';
  doc.text(`Registered: ${joinDate}    |    Biometrics: ${bioStatus}`, infoX, profileCardY + 26);

  // Custom Fields (if available)
  if (employee.custom_fields && typeof employee.custom_fields === 'object' && Object.keys(employee.custom_fields).length > 0) {
    const customEntries = Object.entries(employee.custom_fields).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join('  •  ');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Custom Attributes: ${customEntries}`, infoX, profileCardY + 31);
  }

  // --- EXECUTIVE SCORECARD GRID (Row of 5 KPI Cards) ---
  const kpiY = profileCardY + profileCardH + 4;
  const kpiCardW = (pageWidth - 28 - 12) / 4;
  const kpiCardH = 14;

  const kpis = [
    { label: 'PRESENT (ON-TIME)', value: `${onTimeCount} Days`, color: [22, 163, 74], bg: [240, 253, 244] },
    { label: 'LATE ARRIVALS', value: `${lateCount} Days`, color: [217, 119, 6], bg: [254, 243, 199] },
    { label: 'ABSENCES', value: `${absentCount} Days`, color: [225, 29, 72], bg: [255, 241, 242] },
    { label: 'ATTENDANCE RATE', value: `${attendanceRate}%`, color: [13, 148, 136], bg: [240, 253, 250] },
  ];

  kpis.forEach((c, idx) => {
    const cx = 14 + idx * (kpiCardW + 4);
    doc.setFillColor(c.bg[0], c.bg[1], c.bg[2]);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cx, kpiY, kpiCardW, kpiCardH, 1.5, 1.5, 'FD');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(c.label, cx + kpiCardW / 2, kpiY + 4.5, { align: 'center' });

    doc.setFontSize(9.5);
    doc.setTextColor(c.color[0], c.color[1], c.color[2]);
    doc.text(c.value, cx + kpiCardW / 2, kpiY + 10.5, { align: 'center' });
  });

  // Secondary Summary Strip (Punctuality & Total Hours)
  const stripY = kpiY + kpiCardH + 3;
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, stripY, pageWidth - 28, 7.5, 1.5, 1.5, 'F');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Punctuality Score: ${punctualityRate}%    |    Total Hours Logged: ${totalLoggedHours.toFixed(1)} hrs    |    Average Shift: ${avgDailyHours} hrs/day    |    Total Audit Records: ${totalLoggedDays}`,
    pageWidth / 2,
    stripY + 5,
    { align: 'center' }
  );

  // --- DAY-BY-DAY GRANULAR AUDIT TABLE ---
  const tableHead = [["#", "Date", "Day", "Check-In", "Check-Out", "Duration", "Punctuality Status", "Remarks"]];
  
  const tableRows = records.map((r, i) => {
    let dayOfWeek = '-';
    if (r.date) {
      try {
        const dObj = new Date(r.date);
        dayOfWeek = dObj.toLocaleDateString('en-US', { weekday: 'short' });
      } catch {}
    }

    const dur = calculateDurationDetails(r.checkin, r.checkout);
    const statusText = (r.status || 'present').toUpperCase();
    const reasonText = r.reason || (r.status === 'late' ? 'Late Arrival' : r.status === 'absent' ? 'Unexcused Absence' : 'Biometric Scan');

    return [
      String(i + 1),
      r.date || '-',
      dayOfWeek,
      r.checkin || '--:--',
      r.checkout || (r.status === 'present' ? 'In Office' : '--:--'),
      dur.formatted,
      statusText,
      reasonText
    ];
  });

  const tableStartY = stripY + 11;

  autoTable(doc, {
    head: tableHead,
    body: tableRows,
    startY: tableStartY,
    margin: { left: 14, right: 14, bottom: 28 },
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [51, 65, 85],
      lineColor: [226, 232, 240],
      lineWidth: 0.15
    },
    headStyles: {
      fillColor: [26, 71, 81], // #1a4751 Brand Navy
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
      fontSize: 8
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] // slate-50
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { fontStyle: 'bold', cellWidth: 24 },
      2: { cellWidth: 16 },
      3: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
      4: { halign: 'center', cellWidth: 22 },
      5: { halign: 'center', cellWidth: 24 },
      6: { halign: 'center', fontStyle: 'bold', cellWidth: 28 },
      7: { cellWidth: 'auto', fontSize: 7.5 }
    },
    didParseCell: function (data) {
      if (data.section === 'body' && data.column.index === 6) {
        const raw = String(data.cell.raw).toUpperCase();
        if (raw === 'PRESENT') {
          data.cell.styles.textColor = [22, 163, 74]; // Emerald
        } else if (raw === 'LATE') {
          data.cell.styles.textColor = [217, 119, 6]; // Amber
        } else if (raw === 'ABSENT') {
          data.cell.styles.textColor = [225, 29, 72]; // Rose
        }
      }
    },
    didDrawPage: function (data) {
      // Top line on multi-page overflow
      if (data.pageNumber > 1) {
        doc.setFillColor(26, 71, 81);
        doc.rect(0, 0, pageWidth, 8, 'F');
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text(`${(companyName || 'Enterprise Attendance').toUpperCase()} — ${employee.name} (${employee.employee_id})`, 14, 5.5);
      }

      // Bottom Footer Bar
      doc.setDrawColor(226, 232, 240);
      doc.line(14, pageHeight - 14, pageWidth - 14, pageHeight - 14);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        `Confidential • System Generated Biometric Audit Report • ${companyName}`,
        14,
        pageHeight - 8
      );
      doc.text(
        `Page ${data.pageNumber}`,
        pageWidth - 14,
        pageHeight - 8,
        { align: 'right' }
      );
    }
  });

  // --- COMPLIANCE SIGNATURE BLOCK ---
  let finalY = doc.lastAutoTable.finalY + 10;
  
  // If not enough room on page for signatures, add a new page
  if (finalY > pageHeight - 35) {
    doc.addPage();
    finalY = 25;
  }

  const sigBoxW = 75;
  
  // Employee Signature Box
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text("EMPLOYEE ACKNOWLEDGMENT:", 14, finalY);
  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(14, finalY + 12, 14 + sigBoxW, finalY + 12);
  doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Signature & Date Verified", 14, finalY + 16);

  // HR Manager Signature Box
  const hrSigX = pageWidth - 14 - sigBoxW;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text("AUTHORIZED HR OFFICER / SIGNATORY:", hrSigX, finalY);
  doc.setDrawColor(148, 163, 184);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(hrSigX, finalY + 12, hrSigX + sigBoxW, finalY + 12);
  doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Official Stamp, Seal & Approval", hrSigX, finalY + 16);

  // Save the PDF with Period-Aware Descriptive Filename
  const cleanName = (employee.name || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
  const empIdClean = (employee.employee_id || 'ID').replace(/[^a-zA-Z0-9_-]/g, '_');
  let filePeriodTag = 'Lifetime';
  if (dateFrom && dateTo) {
    if (dateFrom === dateTo) {
      filePeriodTag = `Day_${dateFrom}`;
    } else {
      const [y1, m1, d1] = dateFrom.split('-').map(Number);
      const [y2, m2, d2] = dateTo.split('-').map(Number);
      if (y1 === y2 && m1 === m2 && d1 === 1 && d2 >= 28) {
        filePeriodTag = `Month_${y1}_${String(m1).padStart(2, '0')}`;
      } else {
        filePeriodTag = `${dateFrom}_to_${dateTo}`;
      }
    }
  } else if (dateFrom) {
    filePeriodTag = `From_${dateFrom}`;
  } else if (dateTo) {
    filePeriodTag = `To_${dateTo}`;
  }

  const filename = `${cleanName}_${empIdClean}_Attendance_${filePeriodTag}.pdf`;
  doc.save(filename);
};
