// api/analyze.js
const GROQ_API_KEY = "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";
const HF_API_TOKEN = "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";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const HF_BLIP_URL = "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large";

async function describeImage(base64Image) {
    try {
        const response = await fetch(HF_BLIP_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HF_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: base64Image })
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`BLIP error ${response.status}: ${error}`);
        }
        const data = await response.json();
        return data[0]?.generated_text || "لا يمكن وصف الصورة";
    } catch (err) {
        console.error(err);
        return null;
    }
}

async function askGroq(prompt) {
    try {
        const response = await fetch(GROQ_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
                max_tokens: 800
            })
        });
        if (!response.ok) throw new Error(`Groq error ${response.status}`);
        const data = await response.json();
        return data.choices[0].message.content;
    } catch (err) {
        console.error(err);
        return null;
    }
}

export default async function handler(req, res) {
    // السماح بـ CORS (لأغراض الاختبار، لكن الطلب من نفس النطاق لن يحتاجها)
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const { imageBase64, question } = req.body;
    try {
        let finalAnswer = "";
        if (imageBase64 && question) {
            // 1. وصف الصورة
            const description = await describeImage(imageBase64);
            if (!description) {
                return res.status(500).json({ error: "فشل تحليل الصورة" });
            }
            // 2. دمج الوصف مع السؤال وإرسال إلى Groq
            const prompt = `أنت مساعد ذكي جداً. الصورة تحتوي على: ${description}. المستخدم يسأل: "${question}". أجب بشكل مفيد ودقيق باللغة العربية. إذا كان السؤال يتطلب حل مسألة، قم بحلها بناءً على الوصف.`;
            const groqReply = await askGroq(prompt);
            finalAnswer = groqReply || "عذراً، لم أتمكن من الإجابة.";
        } else if (question) {
            // سؤال عادي
            const groqReply = await askGroq(question);
            finalAnswer = groqReply || "عذراً، لم أتمكن من الإجابة.";
        } else {
            return res.status(400).json({ error: "لا يوجد سؤال ولا صورة" });
        }
        res.status(200).json({ answer: finalAnswer });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
}
