import { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

// กำหนดให้ Next.js ไม่ parse body เองเพราะเราจะใช้ formidable
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

interface SummaryData {
  title: string;
  duration: number;
  testsExecuted: number;
  testsPassed: number;
  testsFailed: number;
}

// ฟังก์ชันสำหรับแยกข้อมูลจากไฟล์ .htm
function extractSummaryData(htmlContent: string): SummaryData | null {
  try {
    // หา JavaScript object ที่เริ่มต้นด้วย "var data = {"
    const dataRegex = /var\s+data\s*=\s*({[\s\S]*?});/;
    const match = htmlContent.match(dataRegex);
    
    if (!match) {
      console.error('ไม่พบ data object ในไฟล์ HTML');
      return null;
    }

    // แปลง JavaScript object string เป็น JSON
    let jsonString = match[1];
    
    // แก้ไข format ให้เป็น valid JSON
    jsonString = jsonString
      .replace(/'/g, '"')  // เปลี่ยน single quote เป็น double quote
      .replace(/(\w+):/g, '"$1":')  // เพิ่ม quote รอบ property names
      .replace(/,\s*}/g, '}')  // ลบ trailing comma
      .replace(/,\s*]/g, ']'); // ลบ trailing comma ใน arrays

    const data = JSON.parse(jsonString);
    
    if (data && data.summary) {
      return {
        title: data.summary.title || '',
        duration: data.summary.duration || 0,
        testsExecuted: data.summary.testsExecuted || 0,
        testsPassed: data.summary.testsPassed || 0,
        testsFailed: data.summary.testsFailed || 0,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing summary data:', error);
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed. Only POST requests are accepted.' 
    });
  }

  try {
    // ตรวจสอบว่าโฟลเดอร์ uploads มีอยู่หรือไม่
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // สร้าง formidable instance สำหรับ parse multipart form data
    const form = formidable({
      uploadDir: uploadsDir,
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB limit
      maxFields: 10,
      maxFieldsSize: 2 * 1024 * 1024, // 2MB for fields
      allowEmptyFiles: false,
      minFileSize: 1, // อย่างน้อย 1 byte
    });

    // Parse incoming form data
    let fields: any;
    let files: any;
    
    try {
      [fields, files] = await form.parse(req);
    } catch (parseError) {
      console.error('Parse error:', parseError);
      return res.status(400).json({
        success: false,
        message: 'Error parsing form data',
        error: parseError instanceof Error ? parseError.message : 'Parse error'
      });
    }
    
    // ดึง parameters
    const mainproduct = Array.isArray(fields.mainproduct) 
      ? fields.mainproduct[0] 
      : fields.mainproduct;
    const subproduct = Array.isArray(fields.subproduct) 
      ? fields.subproduct[0] 
      : fields.subproduct;

    // ตรวจสอบ required parameters
    if (!mainproduct || !subproduct) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: mainproduct and subproduct are required.'
      });
    }

    // ดึงไฟล์ที่อัปโหลด
    const uploadedFiles = files.file;
    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please upload an .htm file.'
      });
    }

    const file = Array.isArray(uploadedFiles) ? uploadedFiles[0] : uploadedFiles;
    
    // ตรวจสอบนามสกุลไฟล์
    if (!file.originalFilename?.endsWith('.htm') && !file.originalFilename?.endsWith('.html')) {
      // ลบไฟล์ที่อัปโหลดแล้วถ้าไม่ใช่ .htm
      if (file.filepath) {
        fs.unlinkSync(file.filepath);
      }
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only .htm and .html files are allowed.'
      });
    }

    // อ่านเนื้อหาไฟล์
    const htmlContent = fs.readFileSync(file.filepath, 'utf-8');
    
    // แยกข้อมูลจากไฟล์
    const summaryData = extractSummaryData(htmlContent);
    
    if (!summaryData) {
      // ลบไฟล์ถ้าไม่สามารถแยกข้อมูลได้
      if (file.filepath) {
        fs.unlinkSync(file.filepath);
      }
      return res.status(400).json({
        success: false,
        message: 'Unable to extract summary data from the uploaded file.'
      });
    }

    // สร้างข้อมูลผลลัพธ์
    const result = {
      mainproduct,
      subproduct,
      file: {
        originalName: file.originalFilename,
        size: file.size,
        uploadPath: file.filepath,
      },
      extractedData: summaryData,
      uploadTime: new Date().toISOString(),
    };

    // ในกรณีจริงอาจจะบันทึกข้อมูลลงฐานข้อมูล
    // เช่น MongoDB, MySQL, etc.
    
    console.log('Processed TCP data:', result);

    // ส่งผลลัพธ์กลับ
    res.status(200).json({
      success: true,
      message: 'File processed successfully',
      data: result
    });

  } catch (error) {
    console.error('Error processing upload:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}