import fs from 'fs';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const generateMockResponse = (query) => {
  const lowerQuery = (query || '').toLowerCase();
  if (lowerQuery.includes('timetable') || lowerQuery.includes('schedule')) {
    return 'Your timetable for today includes:\n- 9:00 AM - Mathematics\n- 10:30 AM - Physics\n- 12:00 PM - English\n- 2:00 PM - Chemistry';
  }
  if (lowerQuery.includes('exam') || lowerQuery.includes('test')) {
    return 'Your next exam is Mathematics on November 15, 2025. It will cover topics from chapters 1-5. The exam duration is 2 hours.';
  }
  if (lowerQuery.includes('attendance')) {
    return 'Your current attendance is 92%. You have attended 138 out of 150 classes. Keep up the good work!';
  }
  if (lowerQuery.includes('grade') || lowerQuery.includes('marks') || lowerQuery.includes('result')) {
    return 'Your recent grades:\n- Mathematics: A (85%)\n- Physics: B+ (78%)\n- Chemistry: A- (82%)\n- English: A (88%)\nOverall GPA: 3.6';
  }
  if (lowerQuery.includes('fee') || lowerQuery.includes('payment')) {
    return 'Your fee status: All dues are cleared. Next payment of ₵500 is due on December 1, 2025.';
  }
  if (lowerQuery.includes('help')) {
    return 'I can help you with:\n- View your timetable\n- Check exam schedules\n- Review attendance\n- Check grades and results\n- Fee payment status\n- Library books\n- Announcements\n\nJust ask me anything!';
  }
  return "I'm here to help! You can ask me about your timetable, exams, attendance, grades, fees, or any other school-related information.";
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
