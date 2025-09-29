/**
 * Math Parser Utility
 * Detects and parses mathematical content in messages
 */

/**
 * Detects if a message contains mathematical expressions
 * @param {string} content - The message content to analyze
 * @returns {boolean} - True if math content is detected
 */
export const containsMathContent = (content) => {
  if (!content || typeof content !== 'string') {
    return false;
  }

  // Check for LaTeX delimiters
  const latexPatterns = [
    /\\\[[\s\S]*?\\\]/g,           // Display math: \[ ... \]
    /\\\([\s\S]*?\\\)/g,           // Inline math: \( ... \)
    /\$\$[\s\S]*?\$\$/g,           // Display math: $$ ... $$
    /\$[^$\n]+\$/g,                // Inline math: $ ... $ (not spanning lines)
  ];

  // Check for mathematical symbols and functions
  const mathSymbols = [
    /\\int/g,                      // Integrals
    /\\sum/g,                      // Summations
    /\\prod/g,                     // Products
    /\\lim/g,                      // Limits
    /\\frac/g,                     // Fractions
    /\\sqrt/g,                     // Square roots
    /\\partial/g,                  // Partial derivatives
    /\\mathcal/g,                  // Calligraphic letters
    /\\mathbb/g,                   // Blackboard bold
    /\\alpha|\\beta|\\gamma|\\delta|\\epsilon|\\theta|\\lambda|\\mu|\\pi|\\sigma|\\phi|\\psi|\\omega/g, // Greek letters
    /\\sin|\\cos|\\tan|\\log|\\ln|\\exp/g, // Mathematical functions
    /\\infty/g,                    // Infinity
    /\\pm|\\mp/g,                  // Plus-minus
    /\\leq|\\geq|\\neq/g,         // Inequalities
    /\\in|\\subset|\\supset/g,    // Set theory
    /\\cup|\\cap/g,                // Set operations
    /\\rightarrow|\\leftarrow|\\leftrightarrow/g, // Arrows
  ];

  // Check for HTML math content
  const htmlMathPatterns = [
    /<math[\s\S]*?<\/math>/gi,     // MathML
    /class\s*=\s*["']math["']/gi,  // Math class
    /katex/gi,                     // KaTeX references
  ];

  // Test LaTeX patterns
  for (const pattern of latexPatterns) {
    if (pattern.test(content)) {
      return true;
    }
  }

  // Test math symbols (require at least 2 different symbols for better accuracy)
  let symbolCount = 0;
  for (const pattern of mathSymbols) {
    if (pattern.test(content)) {
      symbolCount++;
      if (symbolCount >= 2) {
        return true;
      }
    }
  }

  // Test HTML math patterns
  for (const pattern of htmlMathPatterns) {
    if (pattern.test(content)) {
      return true;
    }
  }

  // Check for mathematical expressions in text
  const mathExpressionPatterns = [
    /\b\d+\s*[+\-*/^]\s*\d+/g,    // Basic arithmetic
    /\b[a-zA-Z]\s*[=]\s*[^=]/g,   // Variable assignments
    /\b(sin|cos|tan|log|ln|exp)\s*\(/gi, // Function calls
    /\b(integral|derivative|limit|summation|factorial)\b/gi, // Math terms
    /\b\d+!\b/g,                   // Factorials
    /\b[a-zA-Z]\^\d+/g,           // Exponents
    /\b\d+\/\d+/g,                // Fractions
  ];

  let expressionCount = 0;
  for (const pattern of mathExpressionPatterns) {
    if (pattern.test(content)) {
      expressionCount++;
      if (expressionCount >= 3) { // Require multiple expressions
        return true;
      }
    }
  }

  return false;
};

/**
 * Extracts mathematical content from a message
 * @param {string} content - The message content
 * @returns {object} - Object containing math content and metadata
 */
export const extractMathContent = (content) => {
  if (!content || typeof content !== 'string') {
    return {
      hasMath: false,
      content: content,
      mathBlocks: [],
      processedContent: content
    };
  }

  const hasMath = containsMathContent(content);
  
  if (!hasMath) {
    return {
      hasMath: false,
      content: content,
      mathBlocks: [],
      processedContent: content
    };
  }

  // Extract math blocks
  const mathBlocks = [];
  let processedContent = content;

  // Extract LaTeX display math blocks
  const displayMathRegex = /\\\[([\s\S]*?)\\\]/g;
  let match;
  while ((match = displayMathRegex.exec(content)) !== null) {
    mathBlocks.push({
      type: 'display',
      content: match[1],
      fullMatch: match[0],
      index: match.index
    });
  }

  // Extract LaTeX inline math blocks
  const inlineMathRegex = /\\\(([\s\S]*?)\\\)/g;
  while ((match = inlineMathRegex.exec(content)) !== null) {
    mathBlocks.push({
      type: 'inline',
      content: match[1],
      fullMatch: match[0],
      index: match.index
    });
  }

  // Extract $$ display math blocks
  const dollarDisplayRegex = /\$\$([\s\S]*?)\$\$/g;
  while ((match = dollarDisplayRegex.exec(content)) !== null) {
    mathBlocks.push({
      type: 'display',
      content: match[1],
      fullMatch: match[0],
      index: match.index
    });
  }

  // Extract $ inline math blocks (be careful not to match across lines)
  const dollarInlineRegex = /\$([^$\n]+)\$/g;
  while ((match = dollarInlineRegex.exec(content)) !== null) {
    mathBlocks.push({
      type: 'inline',
      content: match[1],
      fullMatch: match[0],
      index: match.index
    });
  }

  return {
    hasMath: true,
    content: content,
    mathBlocks: mathBlocks,
    processedContent: processedContent
  };
};

/**
 * Preprocesses content for better KaTeX rendering
 * @param {string} content - The content to preprocess
 * @returns {string} - Preprocessed content
 */
export const preprocessMathContent = (content) => {
  if (!content || typeof content !== 'string') {
    return content;
  }

  let processed = content;

  // Ensure proper spacing around math delimiters
  processed = processed.replace(/([^\\])\\\[/g, '$1 \\[');
  processed = processed.replace(/\\\]([^\\])/g, '\\] $1');
  processed = processed.replace(/([^\\])\\\(/g, '$1 \\(');
  processed = processed.replace(/\\\)([^\\])/g, '\\) $1');

  // Fix common LaTeX issues
  processed = processed.replace(/\\frac\s*{([^}]*)}\s*{([^}]*)}/g, '\\frac{$1}{$2}');
  processed = processed.replace(/\\sqrt\s*{([^}]*)}/g, '\\sqrt{$1}');

  // Ensure proper escaping for special characters
  processed = processed.replace(/&/g, '&amp;');
  processed = processed.replace(/</g, '&lt;');
  processed = processed.replace(/>/g, '&gt;');

  // But restore math delimiters
  processed = processed.replace(/&lt;math/g, '<math');
  processed = processed.replace(/&lt;\/math&gt;/g, '</math>');

  return processed;
};

/**
 * Validates if content is safe for rendering
 * @param {string} content - The content to validate
 * @returns {boolean} - True if content is safe
 */
export const isSafeMathContent = (content) => {
  if (!content || typeof content !== 'string') {
    return false;
  }

  // Check for potentially dangerous patterns
  const dangerousPatterns = [
    /<script/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /eval\s*\(/gi,
    /function\s*\(/gi,
    /setTimeout/gi,
    /setInterval/gi,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(content)) {
      return false;
    }
  }

  return true;
};

/**
 * Formats math content for display
 * @param {string} content - The content to format
 * @param {object} options - Formatting options
 * @returns {object} - Formatted content with metadata
 */
export const formatMathContent = (content, options = {}) => {
  const {
    displayMode = false,
    throwOnError = false,
    errorColor = '#cc0000',
    macros = {},
  } = options;

  if (!isSafeMathContent(content)) {
    return {
      success: false,
      error: 'Content contains potentially unsafe elements',
      content: null,
    };
  }

  try {
    const processedContent = preprocessMathContent(content);
    return {
      success: true,
      content: processedContent,
      options: {
        displayMode,
        throwOnError,
        errorColor,
        macros,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      content: null,
    };
  }
};

/**
 * Parses mixed content (text + math) and returns an array of parts
 * @param {string} content - The content to parse
 * @returns {Array} - Array of parts with type 'text' or 'math'
 */
export const parseMixedContent = (content) => {
  console.log('🔍 parseMixedContent called with:', content);
  
  if (!content || typeof content !== 'string') {
    console.log('❌ Invalid content, returning empty text');
    return [{ type: 'text', content: '' }];
  }

  const parts = [];
  let currentIndex = 0;

  // Define math delimiters in order of priority
  const mathDelimiters = [
    { start: '\\[', end: '\\]', type: 'display' },
    { start: '$$', end: '$$', type: 'display' },
    { start: '\\(', end: '\\)', type: 'inline' },
    { start: '$', end: '$', type: 'inline' },
  ];

  // Find all math expressions
  const mathExpressions = [];
  
  for (const delimiter of mathDelimiters) {
    const regex = new RegExp(
      delimiter.start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + 
      '([\\s\\S]*?)' + 
      delimiter.end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'g'
    );
    
    let match;
    while ((match = regex.exec(content)) !== null) {
      // Check if this position is already covered by a previous match
      const isOverlapping = mathExpressions.some(expr => 
        (match.index >= expr.start && match.index < expr.end) ||
        (match.index + match[0].length > expr.start && match.index + match[0].length <= expr.end)
      );
      
      if (!isOverlapping) {
        mathExpressions.push({
          start: match.index,
          end: match.index + match[0].length,
          content: match[1],
          fullMatch: match[0],
          type: delimiter.type,
          delimiter: delimiter
        });
      }
    }
  }

  // Sort by start position
  mathExpressions.sort((a, b) => a.start - b.start);
  
  console.log('📊 Found math expressions:', mathExpressions);

  // Build parts array
  mathExpressions.forEach((expr, index) => {
    // Add text before this math expression
    if (expr.start > currentIndex) {
      const textContent = content.substring(currentIndex, expr.start);
      if (textContent.trim()) {
        parts.push({
          type: 'text',
          content: textContent
        });
      }
    }

    // Add the math expression
    parts.push({
      type: 'math',
      content: expr.content,
      displayMode: expr.type === 'display',
      fullMatch: expr.fullMatch
    });

    currentIndex = expr.end;
  });

  // Add remaining text
  if (currentIndex < content.length) {
    const remainingText = content.substring(currentIndex);
    if (remainingText.trim()) {
      parts.push({
        type: 'text',
        content: remainingText
      });
    }
  }

  // If no math expressions found, return the entire content as text
  if (parts.length === 0) {
    parts.push({
      type: 'text',
      content: content
    });
  }

  console.log('✅ Generated parts:', parts);
  return parts;
};