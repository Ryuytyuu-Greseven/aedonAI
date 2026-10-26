/**
 * Home-appliance filler phrases: short, pre-written lines spoken while a
 * slow turn (knowledge-base search, product lookup) is still being prepared,
 * so the caller hears "let me check" instead of silence.
 *
 * Data only — the logic that picks and sends a filler is shared across the
 * sales agents; only this file differs per vertical. Keep every phrase:
 * - one short sentence, ending in punctuation, that commits to nothing (no
 *   facts, no "yes"/"no") — the real answer follows right after;
 * - gender-neutral (agent voices can be male or female; Hindi uses the
 *   "we"/imperative forms for that reason);
 * - natural spoken language, not written/formal register.
 */

export type FillerLanguage = 'en' | 'hi' | 'te' | 'ta' | 'kn';

export type FillerKind =
  | 'listing'
  | 'details'
  | 'specs'
  | 'delivery_installation'
  | 'faq'
  /** Fallback when any other turn is taking long. */
  | 'generic'
  /** Second line, when the caller is still waiting after a filler. */
  | 'still_working';

export type FillerPhrases = Record<FillerKind, Record<FillerLanguage, string[]>>;

/** Nodes slow enough to deserve a filler as soon as the router picks them. */
export const SLOW_NODE_FILLERS: Record<string, FillerKind> = {
  Product_Listing_Node: 'listing',
  Product_Presentation_Node: 'details',
  Specs_Features_Node: 'specs',
  Delivery_Installation_Node: 'delivery_installation',
  FAQ_Node: 'faq',
};

export const FILLER_PHRASES: FillerPhrases = {
  listing: {
    en: [
      'Let me pull up the products that fit what you are looking for.',
      'Give me a second, I am checking the best models for you.',
      'One moment, let me see which options suit your budget.',
    ],
    hi: [
      'एक पल दीजिए, आपके बजट के हिसाब से प्रोडक्ट्स देख लेते हैं।',
      'बस एक सेकंड, आपके लिए सबसे अच्छे मॉडल निकालते हैं।',
    ],
    te: [
      'ఒక్క క్షణం, మీ బడ్జెట్‌కి సరిపోయే ప్రోడక్ట్స్ చూస్తాను.',
      'కొంచెం ఆగండి, మీకు సరిపోయే మోడల్స్ చెక్ చేస్తాను.',
    ],
    ta: [
      'ஒரு நிமிடம், உங்கள் பட்ஜெட்டுக்கு ஏற்ற பொருட்களைப் பார்க்கிறேன்.',
      'கொஞ்சம் பொறுங்கள், உங்களுக்குப் பொருத்தமான மாடல்களைச் சரிபார்க்கிறேன்.',
    ],
    kn: [
      'ಒಂದು ಕ್ಷಣ, ನಿಮ್ಮ ಬಜೆಟ್‌ಗೆ ಹೊಂದುವ ಪ್ರಾಡಕ್ಟ್‌ಗಳನ್ನು ನೋಡುತ್ತೇನೆ.',
      'ಸ್ವಲ್ಪ ಇರಿ, ನಿಮಗೆ ಸೂಕ್ತವಾದ ಮಾಡೆಲ್‌ಗಳನ್ನು ಪರಿಶೀಲಿಸುತ್ತೇನೆ.',
    ],
  },
  details: {
    en: [
      'Sure, let me pull up the details of that model.',
      'Good choice, give me a second to get the details.',
      'One moment, I am getting the product details.',
    ],
    hi: [
      'ज़रूर, एक पल में उस मॉडल की जानकारी देख लेते हैं।',
      'बढ़िया, बस एक सेकंड, डिटेल्स निकालते हैं।',
    ],
    te: [
      'తప్పకుండా, ఒక్క క్షణం, ఆ మోడల్ వివరాలు చూసి చెబుతాను.',
      'సరే, కొంచెం ఆగండి, ప్రోడక్ట్ వివరాలు తీసుకొస్తాను.',
    ],
    ta: [
      'நிச்சயமாக, ஒரு நிமிடம், அந்த மாடலின் விவரங்களைப் பார்த்துச் சொல்கிறேன்.',
      'சரி, கொஞ்சம் பொறுங்கள், பொருளின் விவரங்களை எடுக்கிறேன்.',
    ],
    kn: [
      'ಖಂಡಿತ, ಒಂದು ಕ್ಷಣ, ಆ ಮಾಡೆಲ್‌ನ ವಿವರಗಳನ್ನು ನೋಡಿ ಹೇಳುತ್ತೇನೆ.',
      'ಸರಿ, ಸ್ವಲ್ಪ ಇರಿ, ಪ್ರಾಡಕ್ಟ್ ವಿವರಗಳನ್ನು ತರುತ್ತೇನೆ.',
    ],
  },
  specs: {
    en: [
      'Let me check the specifications for you.',
      'Good question, give me a second to check that.',
      'One moment, let me look at the capacity and features.',
    ],
    hi: [
      'एक पल, स्पेसिफिकेशन देख लेते हैं।',
      'अच्छा सवाल है, बस एक सेकंड, कैपेसिटी और फीचर्स चेक कर लेते हैं।',
    ],
    te: [
      'ఒక్క క్షణం, స్పెసిఫికేషన్స్ చూస్తాను.',
      'మంచి ప్రశ్న, కొంచెం ఆగండి, కెపాసిటీ, ఫీచర్స్ చెక్ చేసి చెబుతాను.',
    ],
    ta: [
      'ஒரு நிமிடம், விவரக்குறிப்புகளைப் பார்க்கிறேன்.',
      'நல்ல கேள்வி, கொஞ்சம் பொறுங்கள், கொள்ளளவு மற்றும் அம்சங்களைச் சரிபார்க்கிறேன்.',
    ],
    kn: [
      'ಒಂದು ಕ್ಷಣ, ಸ್ಪೆಸಿಫಿಕೇಶನ್‌ಗಳನ್ನು ನೋಡುತ್ತೇನೆ.',
      'ಒಳ್ಳೆಯ ಪ್ರಶ್ನೆ, ಸ್ವಲ್ಪ ಇರಿ, ಕೆಪಾಸಿಟಿ ಮತ್ತು ಫೀಚರ್‌ಗಳನ್ನು ಪರಿಶೀಲಿಸುತ್ತೇನೆ.',
    ],
  },
  delivery_installation: {
    en: [
      'Let me check the delivery and installation details.',
      'One moment, I am checking delivery for your area.',
      'Give me a second to look up the installation details.',
    ],
    hi: [
      'एक पल, डिलीवरी और इंस्टॉलेशन की जानकारी देख लेते हैं।',
      'बस एक सेकंड, आपके एरिया की डिलीवरी चेक कर लेते हैं।',
    ],
    te: [
      'ఒక్క క్షణం, డెలివరీ, ఇన్‌స్టలేషన్ వివరాలు చూస్తాను.',
      'కొంచెం ఆగండి, మీ ఏరియాకి డెలివరీ చెక్ చేస్తాను.',
    ],
    ta: [
      'ஒரு நிமிடம், டெலிவரி மற்றும் இன்ஸ்டாலேஷன் விவரங்களைப் பார்க்கிறேன்.',
      'கொஞ்சம் பொறுங்கள், உங்கள் பகுதிக்கான டெலிவரியைச் சரிபார்க்கிறேன்.',
    ],
    kn: [
      'ಒಂದು ಕ್ಷಣ, ಡೆಲಿವರಿ ಮತ್ತು ಇನ್‌ಸ್ಟಾಲೇಶನ್ ವಿವರಗಳನ್ನು ನೋಡುತ್ತೇನೆ.',
      'ಸ್ವಲ್ಪ ಇರಿ, ನಿಮ್ಮ ಏರಿಯಾಗೆ ಡೆಲಿವರಿ ಪರಿಶೀಲಿಸುತ್ತೇನೆ.',
    ],
  },
  faq: {
    en: [
      'Let me find that for you.',
      'Good question, give me a second.',
      'One moment, let me check on that.',
    ],
    hi: [
      'एक पल, यह जानकारी देख लेते हैं।',
      'अच्छा सवाल है, बस एक सेकंड।',
    ],
    te: [
      'ఒక్క క్షణం, అది చూసి చెబుతాను.',
      'మంచి ప్రశ్న, కొంచెం ఆగండి.',
    ],
    ta: [
      'ஒரு நிமிடம், அதைப் பார்த்துச் சொல்கிறேன்.',
      'நல்ல கேள்வி, கொஞ்சம் பொறுங்கள்.',
    ],
    kn: [
      'ಒಂದು ಕ್ಷಣ, ಅದನ್ನು ನೋಡಿ ಹೇಳುತ್ತೇನೆ.',
      'ಒಳ್ಳೆಯ ಪ್ರಶ್ನೆ, ಸ್ವಲ್ಪ ಇರಿ.',
    ],
  },
  generic: {
    en: ['One moment, please.', 'Give me a second.', 'Just a moment.'],
    hi: ['एक पल रुकिए।', 'बस एक सेकंड।'],
    te: ['ఒక్క క్షణం ఆగండి.', 'కొంచెం ఆగండి.'],
    ta: ['ஒரு நிமிடம் பொறுங்கள்.', 'கொஞ்சம் பொறுங்கள்.'],
    kn: ['ಒಂದು ಕ್ಷಣ ಇರಿ.', 'ಸ್ವಲ್ಪ ಇರಿ.'],
  },
  still_working: {
    en: [
      'Thanks for waiting, I am almost there.',
      'Still with you, just a moment more.',
    ],
    hi: [
      'इंतज़ार के लिए धन्यवाद, बस हो गया।',
      'बस थोड़ा सा और, अभी बताते हैं।',
    ],
    te: [
      'వేచి ఉన్నందుకు ధన్యవాదాలు, ఇంకొక్క క్షణం.',
      'దాదాపు అయిపోయింది, కొంచెం ఆగండి.',
    ],
    ta: [
      'காத்திருந்ததற்கு நன்றி, இன்னும் ஒரு நிமிடம்.',
      'கிட்டத்தட்ட முடிந்தது, கொஞ்சம் பொறுங்கள்.',
    ],
    kn: [
      'ಕಾಯುತ್ತಿರುವುದಕ್ಕೆ ಧನ್ಯವಾದಗಳು, ಇನ್ನೊಂದು ಕ್ಷಣ.',
      'ಬಹುತೇಕ ಆಯಿತು, ಸ್ವಲ್ಪ ಇರಿ.',
    ],
  },
};
