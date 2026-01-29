import fs from 'fs';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const generateMockResponse = (query) => {
  const lowerQuery = (query || '').toLowerCase();
  if (lowerQuery.includes('timetable') || lowerQuery.includes('schedule')) {
    return 'Please visit the Timetable section in the main menu to view your class schedule.';
  }
  if (lowerQuery.includes('exam') || lowerQuery.includes('test')) {
    return 'Please check the Exams page to view your exam schedules and details.';
  }
  if (lowerQuery.includes('attendance')) {
    return 'Please visit your dashboard or the Attendance page to view your attendance records.';
  }
  if (lowerQuery.includes('grade') || lowerQuery.includes('marks') || lowerQuery.includes('result')) {
    return 'Please visit the Results page to view your grades and academic performance.';
  }
  if (lowerQuery.includes('fee') || lowerQuery.includes('payment')) {
    return 'Please visit the Fees page to view your fee status and payment information.';
  }
  if (lowerQuery.includes('help')) {
    return 'I can help you with information about:\n- Your timetable\n- Exam schedules\n- Attendance records\n- Grades and results\n- Fee status\n- Library resources\n- School announcements\n\nPlease visit the relevant section in the main menu for detailed information!';
  }
  return "I'm here to assist! Feel free to ask me about school-related information. For detailed data, please visit the relevant section in the main menu.";
};

export const chat = async (req, res) => {
  const { message, history } = req.body || {};
  if (!message) return res.status(400).json({ message: 'Message is required' });

  // If OpenAI API key provided, proxy the request
  const key = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  if (key) {
    try {
      const messages = [];
      // convert history to OpenAI chat messages if provided
      if (Array.isArray(history)) {
        history.forEach((m) => {
          if (m && m.sender && m.text) {
            messages.push({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text });
          }
        });
      }
      messages.push({ role: 'user', content: message });

      const resp = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ model: 'gpt-3.5-turbo', messages, max_tokens: 500 }),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        console.warn('OpenAI error:', resp.status, errText);
        // fall back to mock
        const fallback = generateMockResponse(message);
        return res.json({ reply: fallback });
      }
      const data = await resp.json();
      const reply = data?.choices?.[0]?.message?.content || generateMockResponse(message);
      return res.json({ reply });
    } catch (err) {
      console.error('OpenAI proxy error:', err);
      const fallback = generateMockResponse(message);
      return res.json({ reply: fallback });
    }
  }

  // No API key — return mock response
  const reply = generateMockResponse(message);
  return res.json({ reply });
};
