const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const apiKey = process.env.GEMINI_API_KEY || 'dummy_key';
const genAI = new GoogleGenerativeAI(apiKey);
// Use the recommended model for text generation
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

async function analyzeComplaint(title, description) {
    if (apiKey === 'dummy_key' || apiKey === 'your_gemini_api_key_here') {
        return applyHeuristics(title, description);
    }
    
    try {
        const prompt = `
        Analyze the following civic complaint:
        Title: ${title}
        Description: ${description}
        
        Categorize it into exactly one of these: Road, Garbage, Water, Electricity, Streetlight, Other.
        Assign a Priority Level: High, Medium, Low.
        
        Return ONLY valid JSON in this format: { "category": "...", "priority": "..." }
        Do not use markdown formatting like \`\`\`json. Just send the raw JSON string.
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text().trim();
        
        // Remove markdown formatting if present
        let cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return {
            category: parsed.category || 'Other',
            priority: parsed.priority || 'Medium'
        };
    } catch (err) {
        console.error("AI Error:", err);
        // Fallback to heuristics if the API call fails
        return applyHeuristics(title, description);
    }
}

// Fallback logic so the app works perfectly without an API Key
function applyHeuristics(title, description) {
    const text = (title + " " + description).toLowerCase();
    
    let category = 'Other';
    if (text.includes('pothole') || text.includes('road') || text.includes('street')) category = 'Road';
    else if (text.includes('garbage') || text.includes('trash') || text.includes('waste')) category = 'Garbage';
    else if (text.includes('water') || text.includes('leak') || text.includes('pipe')) category = 'Water';
    else if (text.includes('power') || text.includes('electricity') || text.includes('wire')) category = 'Electricity';
    else if (text.includes('light') || text.includes('lamp')) category = 'Streetlight';

    let priority = 'Low';
    if (text.includes('urgent') || text.includes('emergency') || text.includes('accident') || text.includes('hazard')) {
        priority = 'High';
    } else if (text.includes('annoying') || text.includes('block') || text.includes('leak') || text.includes('smell')) {
        priority = 'Medium';
    }

    // A little delay to simulate AI processing time
    return new Promise(resolve => setTimeout(() => resolve({ category, priority }), 800));
}

module.exports = { analyzeComplaint };
