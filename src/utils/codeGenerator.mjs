/**
 * Generate a unique student code in format: XX### (2 uppercase letters + 3 digits)
 * e.g., AB123, ZZ999
 */
export const generateStudentCode = () => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  // Random 2 uppercase letters
  code += letters.charAt(Math.floor(Math.random() * letters.length));
  code += letters.charAt(Math.floor(Math.random() * letters.length));
  // Random 3 digits
  code += String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return code;
};

/**
 * Generate a unique student code and ensure it doesn't already exist in the DB
 * @param {Function} checkExists - async function to check if code exists in DB (e.g., Student.findOne({studentCode: code}))
 * @param {number} maxRetries - max attempts to generate a unique code (default 10)
 */
export const generateUniqueStudentCode = async (checkExists, maxRetries = 10) => {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateStudentCode();
    const exists = await checkExists(code);
    if (!exists) {
      return code; // Found a unique code
    }
  }
  throw new Error('Failed to generate unique student code after max retries');
};
