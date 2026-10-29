// ==============================================================================
// CYBERCHASE — 40 BEGINNER-FRIENDLY QUESTIONS
// Categories: PYTHON (17 questions / 42.5%), HTML (13 questions / 32.5%), CSS (10 questions / 25%)
// Target Distribution: Python ~42%, HTML ~33%, CSS ~25%
// ==============================================================================

export const QUESTION_BANK_40 = [
  // ----------------------------------------------------------------------------
  // PYTHON — 17 QUESTIONS
  // ----------------------------------------------------------------------------
  {
    id: 'PY01',
    category: 'PYTHON',
    difficulty: 'easy',
    question: 'Which function displays output in Python?',
    code: null,
    options: ['show()', 'print()', 'display()', 'write()'],
    correct: 1, // B
    correctAnswerId: 'B',
    explanation: 'print() is the standard built-in function to display output to the console.'
  },
  {
    id: 'PY02',
    category: 'PYTHON',
    difficulty: 'easy',
    question: 'Which symbol is used for comments in Python?',
    code: null,
    options: ['//', '<!-- -->', '#', '**'],
    correct: 2, // C
    correctAnswerId: 'C',
    explanation: '# denotes a single-line comment in Python.'
  },
  {
    id: 'PY03',
    category: 'PYTHON',
    difficulty: 'easy',
    question: 'Which data type stores text?',
    code: null,
    options: ['int', 'str', 'bool', 'float'],
    correct: 1, // B
    correctAnswerId: 'B',
    explanation: 'str (string) is the data type used to represent text in Python.'
  },
  {
    id: 'PY04',
    category: 'PYTHON',
    difficulty: 'easy',
    question: 'What is the output of print(5 + 3)?',
    code: 'print(5 + 3)',
    options: ['2', '8', '15', '53'],
    correct: 1, // B
    correctAnswerId: 'B',
    explanation: '5 + 3 performs integer addition and yields 8.'
  },
  {
    id: 'PY05',
    category: 'PYTHON',
    difficulty: 'easy',
    question: 'Which keyword defines a function?',
    code: null,
    options: ['func', 'function', 'def', 'define'],
    correct: 2, // C
    correctAnswerId: 'C',
    explanation: 'def is used to define a function in Python.'
  },
  {
    id: 'PY06',
    category: 'PYTHON',
    difficulty: 'easy',
    question: 'Which data type stores True or False?',
    code: null,
    options: ['str', 'int', 'bool', 'list'],
    correct: 2, // C
    correctAnswerId: 'C',
    explanation: 'bool (boolean) can only have one of two values: True or False.'
  },
  {
    id: 'PY07',
    category: 'PYTHON',
    difficulty: 'easy',
    question: 'What is the output of print(10 % 3)?',
    code: 'print(10 % 3)',
    options: ['1', '3', '0', '3.33'],
    correct: 0, // A
    correctAnswerId: 'A',
    explanation: '10 divided by 3 is 3 with a remainder of 1.'
  },
  {
    id: 'PY08',
    category: 'PYTHON',
    difficulty: 'easy',
    question: 'Which operator is used for exponentiation in Python?',
    code: null,
    options: ['^', '**', '//', '%%'],
    correct: 1, // B
    correctAnswerId: 'B',
    explanation: '** is the exponentiation (power) operator in Python.'
  },
  {
    id: 'PY09',
    category: 'PYTHON',
    difficulty: 'easy',
    question: 'Which keyword is used to check a condition?',
    code: null,
    options: ['if', 'for', 'def', 'print'],
    correct: 0, // A
    correctAnswerId: 'A',
    explanation: 'if is the conditional keyword in Python.'
  },
  {
    id: 'PY10',
    category: 'PYTHON',
    difficulty: 'easy',
    question: 'What is the output of print("Hello" + " World")?',
    code: 'print("Hello" + " World")',
    options: ['HelloWorld', 'Hello World', 'Hello + World', 'Error'],
    correct: 1, // B
    correctAnswerId: 'B',
    explanation: 'String concatenation joins "Hello" and " World" into "Hello World".'
  },
  {
    id: 'PY11',
    category: 'PYTHON',
    difficulty: 'easy',
    question: 'Which collection uses square brackets []?',
    code: null,
    options: ['Tuple', 'Dictionary', 'List', 'Set'],
    correct: 2, // C
    correctAnswerId: 'C',
    explanation: 'Lists are written with square brackets [].'
  },
  {
    id: 'PY12',
    category: 'PYTHON',
    difficulty: 'easy',
    question: 'What is the output?',
    code: 'x = 10\nx = 20\nprint(x)',
    options: ['10', '20', '30', 'Error'],
    correct: 1, // B
    correctAnswerId: 'B',
    explanation: 'Variable x is reassigned from 10 to 20, so print(x) displays 20.'
  },
  {
    id: 'PY13',
    category: 'PYTHON',
    difficulty: 'easy',
    question: 'Which operator checks whether two values are equal?',
    code: null,
    options: ['=', '==', '!=', '>='],
    correct: 1, // B
    correctAnswerId: 'B',
    explanation: '== compares equality, while = is the assignment operator.'
  },
  {
    id: 'PY14',
    category: 'PYTHON',
    difficulty: 'easy',
    question: 'What does len("CSI") return?',
    code: 'len("CSI")',
    options: ['2', '3', '4', '5'],
    correct: 1, // B
    correctAnswerId: 'B',
    explanation: 'The string "CSI" has 3 characters, so len() returns 3.'
  },
  {
    id: 'PY15',
    category: 'PYTHON',
    difficulty: 'easy',
    question: 'Which loop is commonly used to iterate over a list?',
    code: null,
    options: ['repeat', 'foreach', 'for', 'loop'],
    correct: 2, // C
    correctAnswerId: 'C',
    explanation: 'Python uses "for item in list:" to iterate over a list.'
  },
  {
    id: 'PY16',
    category: 'PYTHON',
    difficulty: 'easy',
    question: 'What is the output of print(4 > 2)?',
    code: 'print(4 > 2)',
    options: ['True', 'False', '2', 'Error'],
    correct: 0, // A
    correctAnswerId: 'A',
    explanation: '4 is strictly greater than 2, so the boolean result is True.'
  },
  {
    id: 'PY17',
    category: 'PYTHON',
    difficulty: 'easy',
    question: 'Which function takes input from the user?',
    code: null,
    options: ['get()', 'scan()', 'input()', 'readline()'],
    correct: 2, // C
    correctAnswerId: 'C',
    explanation: 'input() prompts and accepts standard string input from the user.'
  },

  // ----------------------------------------------------------------------------
  // HTML — 13 QUESTIONS
  // ----------------------------------------------------------------------------
  {
    id: 'HT01',
    category: 'HTML',
    difficulty: 'easy',
    question: 'What is the full form of HTML?',
    code: null,
    options: [
      'Hyper Trainer Marking Language',
      'HyperText Markup Language',
      'HighText Machine Language',
      'HyperText Markdown Language'
    ],
    correct: 1, // B
    correctAnswerId: 'B',
    explanation: 'HTML stands for HyperText Markup Language.'
  },
  {
    id: 'HT02',
    category: 'HTML',
    difficulty: 'easy',
    question: 'Which tag creates the largest standard heading?',
    code: null,
    options: ['<h6>', '<head>', '<h1>', '<heading>'],
    correct: 2, // C
    correctAnswerId: 'C',
    explanation: '<h1> is the top-level and largest standard HTML heading tag.'
  },
  {
    id: 'HT03',
    category: 'HTML',
    difficulty: 'easy',
    question: 'Which tag creates a paragraph?',
    code: null,
    options: ['<para>', '<p>', '<text>', '<pg>'],
    correct: 1, // B
    correctAnswerId: 'B',
    explanation: '<p> is the standard HTML tag for defining paragraphs.'
  },
  {
    id: 'HT04',
    category: 'HTML',
    difficulty: 'easy',
    question: 'Which tag inserts an image?',
    code: null,
    options: ['<image>', '<picture>', '<img>', '<src>'],
    correct: 2, // C
    correctAnswerId: 'C',
    explanation: '<img> is the empty HTML tag used to embed images.'
  },
  {
    id: 'HT05',
    category: 'HTML',
    difficulty: 'easy',
    question: "Which attribute specifies an image's source?",
    code: null,
    options: ['href', 'src', 'alt', 'link'],
    correct: 1, // B
    correctAnswerId: 'B',
    explanation: 'The src (source) attribute provides the URL or path of an image file.'
  },
  {
    id: 'HT06',
    category: 'HTML',
    difficulty: 'easy',
    question: 'Which tag creates a hyperlink?',
    code: null,
    options: ['<a>', '<link>', '<href>', '<url>'],
    correct: 0, // A
    correctAnswerId: 'A',
    explanation: 'The anchor tag <a> is used to create clickable hyperlinks.'
  },
  {
    id: 'HT07',
    category: 'HTML',
    difficulty: 'easy',
    question: 'Which tag creates an unordered list?',
    code: null,
    options: ['<ol>', '<li>', '<ul>', '<list>'],
    correct: 2, // C
    correctAnswerId: 'C',
    explanation: '<ul> defines an unordered (bulleted) list.'
  },
  {
    id: 'HT08',
    category: 'HTML',
    difficulty: 'easy',
    question: 'Which tag creates a line break?',
    code: null,
    options: ['<break>', '<lb>', '<br>', '<newline>'],
    correct: 2, // C
    correctAnswerId: 'C',
    explanation: '<br> inserts a single line break in HTML.'
  },
  {
    id: 'HT09',
    category: 'HTML',
    difficulty: 'easy',
    question: 'Which tag creates a numbered list?',
    code: null,
    options: ['<ul>', '<ol>', '<li>', '<dl>'],
    correct: 1, // B
    correctAnswerId: 'B',
    explanation: '<ol> defines an ordered (numbered) list.'
  },
  {
    id: 'HT10',
    category: 'HTML',
    difficulty: 'easy',
    question: "Which tag contains the webpage's main visible content?",
    code: null,
    options: ['<body>', '<title>', '<head>', '<meta>'],
    correct: 0, // A
    correctAnswerId: 'A',
    explanation: 'The <body> element encapsulates all visible content rendered on a web page.'
  },
  {
    id: 'HT11',
    category: 'HTML',
    difficulty: 'easy',
    question: 'Which attribute provides alternative text for an image?',
    code: null,
    options: ['title', 'src', 'alt', 'name'],
    correct: 2, // C
    correctAnswerId: 'C',
    explanation: 'The alt attribute defines accessible alternative text for images.'
  },
  {
    id: 'HT12',
    category: 'HTML',
    difficulty: 'easy',
    question: 'Which tag creates a table row?',
    code: null,
    options: ['<td>', '<tr>', '<th>', '<table-row>'],
    correct: 1, // B
    correctAnswerId: 'B',
    explanation: '<tr> defines a table row in an HTML table.'
  },
  {
    id: 'HT13',
    category: 'HTML',
    difficulty: 'easy',
    question: 'Which declaration identifies an HTML5 document?',
    code: null,
    options: ['<html5>', '<html version="5">', '<!DOCTYPE html>', '<doctype>'],
    correct: 2, // C
    correctAnswerId: 'C',
    explanation: '<!DOCTYPE html> is the concise document type declaration for HTML5.'
  },

  // ----------------------------------------------------------------------------
  // CSS — 10 QUESTIONS
  // ----------------------------------------------------------------------------
  {
    id: 'CS01',
    category: 'CSS',
    difficulty: 'easy',
    question: 'What is the full form of CSS?',
    code: null,
    options: [
      'Computer Style Sheets',
      'Cascading Style Sheets',
      'Creative Styling System',
      'Colorful Style Syntax'
    ],
    correct: 1, // B
    correctAnswerId: 'B',
    explanation: 'CSS stands for Cascading Style Sheets.'
  },
  {
    id: 'CS02',
    category: 'CSS',
    difficulty: 'easy',
    question: 'Which property changes text color?',
    code: null,
    options: ['font-color', 'text-color', 'color', 'background'],
    correct: 2, // C
    correctAnswerId: 'C',
    explanation: 'The color property sets the foreground color of text in CSS.'
  },
  {
    id: 'CS03',
    category: 'CSS',
    difficulty: 'easy',
    question: 'Which symbol selects a class in CSS?',
    code: null,
    options: ['#', '.', '@', '*'],
    correct: 1, // B
    correctAnswerId: 'B',
    explanation: 'The period (.) is the class selector prefix in CSS.'
  },
  {
    id: 'CS04',
    category: 'CSS',
    difficulty: 'easy',
    question: 'Which symbol selects an ID in CSS?',
    code: null,
    options: ['.', '&', '#', '$'],
    correct: 2, // C
    correctAnswerId: 'C',
    explanation: 'The hash symbol (#) is used to select an element by its ID.'
  },
  {
    id: 'CS05',
    category: 'CSS',
    difficulty: 'easy',
    question: 'Which property changes background color?',
    code: null,
    options: ['color', 'background-color', 'font-color', 'bg'],
    correct: 1, // B
    correctAnswerId: 'B',
    explanation: 'background-color specifies the background fill color of an element.'
  },
  {
    id: 'CS06',
    category: 'CSS',
    difficulty: 'easy',
    question: 'Which property changes text size?',
    code: null,
    options: ['text-size', 'font-size', 'font-weight', 'size'],
    correct: 1, // B
    correctAnswerId: 'B',
    explanation: 'font-size controls the size of font text.'
  },
  {
    id: 'CS07',
    category: 'CSS',
    difficulty: 'easy',
    question: 'Which declaration makes text bold?',
    code: null,
    options: [
      'font-style: bold',
      'text-weight: bold',
      'font-weight: bold',
      'text-style: bold'
    ],
    correct: 2, // C
    correctAnswerId: 'C',
    explanation: 'font-weight: bold; sets the font boldness.'
  },
  {
    id: 'CS08',
    category: 'CSS',
    difficulty: 'easy',
    question: 'Which property adds space inside an element\'s border?',
    code: null,
    options: ['margin', 'padding', 'border', 'outline'],
    correct: 1, // B
    correctAnswerId: 'B',
    explanation: 'padding is the space between content and the border inside an element.'
  },
  {
    id: 'CS09',
    category: 'CSS',
    difficulty: 'easy',
    question: 'Which property adds space outside an element\'s border?',
    code: null,
    options: ['padding', 'spacing', 'margin', 'border-spacing'],
    correct: 2, // C
    correctAnswerId: 'C',
    explanation: 'margin provides spacing outside the element boundary.'
  },
  {
    id: 'CS10',
    category: 'CSS',
    difficulty: 'easy',
    question: 'Which declaration enables Flexbox?',
    code: null,
    options: ['position: flex;', 'display: flex;', 'flex: on;', 'layout: flex;'],
    correct: 1, // B
    correctAnswerId: 'B',
    explanation: 'display: flex; establishes a Flexbox formatting context on a container.'
  }
];

export const INITIAL_40_QUESTIONS = QUESTION_BANK_40;

// Returns all active questions (easily extensible with additional questions)
export function getActiveQuestionBank() {
  return [...QUESTION_BANK_40];
}

// Backward compatibility helper
export function generateFullQuestionBank() {
  return getActiveQuestionBank();
}

// Randomizes option order while strictly preserving correctness
export function shuffleQuestionOptions(question) {
  const correctText = question.options[question.correct];
  const shuffledOptions = [...question.options];

  for (let i = shuffledOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
  }

  const newCorrectIndex = shuffledOptions.indexOf(correctText);

  return {
    ...question,
    options: shuffledOptions,
    correct: newCorrectIndex,
    correctText: correctText
  };
}
