import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "../../lib/mongodb";

type Data = {
    [key: string]: any;
};

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<Data>
) {
    // รองรับเฉพาะ POST method
    if (req.method !== 'POST') {
        return res.status(405).json({ error: "Method not allowed. Use POST." });
    }

    try {
        // รับ parameters จาก request body
        const { mainproduct, subproduct, name, pass, fail, time } = req.body;

        // ตรวจสอบ required parameters
        if (!mainproduct || !subproduct || !name) {
            return res.status(400).json({ 
                error: "Missing required parameters: mainproduct, subproduct, name" 
            });
        }

        // ตรวจสอบ type ของ parameters
        if (typeof mainproduct !== 'string' || typeof subproduct !== 'string' || typeof name !== 'string') {
            return res.status(400).json({ 
                error: "mainproduct, subproduct, and name must be strings" 
            });
        }

        // ตรวจสอบ pass และ fail ให้เป็นตัวเลข (optional)
        if (pass !== undefined && (typeof pass !== 'number' && !Number.isInteger(Number(pass)))) {
            return res.status(400).json({ 
                error: "pass must be a number" 
            });
        }

        if (fail !== undefined && (typeof fail !== 'number' && !Number.isInteger(Number(fail)))) {
            return res.status(400).json({ 
                error: "fail must be a number" 
            });
        }

        // สร้าง data object ที่จะบันทึกลง database
        const testData = {
            mainproduct,
            subproduct,
            name,
            pass: pass !== undefined ? Number(pass) : 0,
            fail: fail !== undefined ? Number(fail) : 0,
            time: time || new Date().toISOString(),
            createdAt: new Date(),
            updatedAt: new Date()
        };

        // เชื่อมต่อ MongoDB
        const client = await clientPromise;
        const db = client.db("automedtest-dashboard");
        
        // บันทึกข้อมูลลง collection ตาม subproduct
        const collection = db.collection(subproduct);
        const result = await collection.insertOne(testData);

        return res.status(201).json({
            success: true,
            message: "Data added successfully",
            data: {
                _id: result.insertedId,
                ...testData
            }
        });

    } catch (error) {
        console.error("Error adding TCP text data:", error);
        return res.status(500).json({ 
            error: "Internal Server Error",
            message: error instanceof Error ? error.message : "Unknown error"
        });
    }
}