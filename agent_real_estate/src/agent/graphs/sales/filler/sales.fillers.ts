/**
 * Real-estate filler phrases: short, pre-written lines spoken while a slow
 * turn (knowledge-base search, listing lookup) is still being prepared, so
 * the caller hears "let me check" instead of silence.
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
  | 'amenities'
  | 'nearby'
  | 'faq'
  /** Fallback when any other turn is taking long. */
  | 'generic'
  /** Second line, when the caller is still waiting after a filler. */
  | 'still_working';

export type FillerPhrases = Record<FillerKind, Record<FillerLanguage, string[]>>;

/** Nodes slow enough to deserve a filler as soon as the router picks them. */
export const SLOW_NODE_FILLERS: Record<string, FillerKind> = {
  Property_Listing_Node: 'listing',
  Presentation_Node: 'details',
  Amenities_Node: 'amenities',
  Nearby_Facilities_Node: 'nearby',
  FAQ_Node: 'faq',
};

export const FILLER_PHRASES: FillerPhrases = {
  listing: {
    en: [
      'Let me pull up the options that fit what you are looking for.',
      'Give me a second, I am checking the best matches for you.',
      'One moment, let me see which projects suit your budget.',
    ],
    hi: [
      'एक पल दीजिए, आपके बजट के हिसाब से विकल्प देख लेते हैं।',
      'बस एक सेकंड, आपके लिए सबसे अच्छे विकल्प निकालते हैं।',
    ],
    te: [
      'ఒక్క క్షణం, మీ బడ్జెట్‌కి సరిపోయే ఆప్షన్స్ చూస్తాను.',
      'కొంచెం ఆగండి, మీకు సరిపోయే ప్రాజెక్ట్స్ చెక్ చేస్తాను.',
    ],
    ta: [
      'ஒரு நிமிடம், உங்கள் பட்ஜெட்டுக்கு ஏற்ற விருப்பங்களைப் பார்க்கிறேன்.',
      'கொஞ்சம் பொறுங்கள், உங்களுக்குப் பொருத்தமான திட்டங்களைச் சரிபார்க்கிறேன்.',
    ],
    kn: [
      'ಒಂದು ಕ್ಷಣ, ನಿಮ್ಮ ಬಜೆಟ್‌ಗೆ ಹೊಂದುವ ಆಯ್ಕೆಗಳನ್ನು ನೋಡುತ್ತೇನೆ.',
      'ಸ್ವಲ್ಪ ಇರಿ, ನಿಮಗೆ ಸೂಕ್ತವಾದ ಪ್ರಾಜೆಕ್ಟ್‌ಗಳನ್ನು ಪರಿಶೀಲಿಸುತ್ತೇನೆ.',
    ],
  },
  details: {
    en: [
      'Sure, let me pull up the details for you.',
      'Good choice, give me a second to get the details.',
      'One moment, I am getting the project details.',
    ],
    hi: [
      'ज़रूर, एक पल में पूरी जानकारी देख लेते हैं।',
      'बढ़िया, बस एक सेकंड, डिटेल्स निकालते हैं।',
    ],
    te: [
      'తప్పకుండా, ఒక్క క్షణం, వివరాలు చూసి చెబుతాను.',
      'సరే, కొంచెం ఆగండి, ప్రాజెక్ట్ వివరాలు తీసుకొస్తాను.',
    ],
    ta: [
      'நிச்சயமாக, ஒரு நிமிடம், விவரங்களைப் பார்த்துச் சொல்கிறேன்.',
      'சரி, கொஞ்சம் பொறுங்கள், திட்ட விவரங்களை எடுக்கிறேன்.',
    ],
    kn: [
      'ಖಂಡಿತ, ಒಂದು ಕ್ಷಣ, ವಿವರಗಳನ್ನು ನೋಡಿ ಹೇಳುತ್ತೇನೆ.',
      'ಸರಿ, ಸ್ವಲ್ಪ ಇರಿ, ಪ್ರಾಜೆಕ್ಟ್ ವಿವರಗಳನ್ನು ತರುತ್ತೇನೆ.',
    ],
  },
  amenities: {
    en: [
      'Let me check the amenities for you.',
      'Good question, give me a second to check that.',
      'One moment, let me look at the amenities list.',
    ],
    hi: [
      'एक पल, सुविधाओं की जानकारी देख लेते हैं।',
      'अच्छा सवाल है, बस एक सेकंड, चेक कर लेते हैं।',
    ],
    te: [
      'ఒక్క క్షణం, ఆమెనిటీస్ వివరాలు చూస్తాను.',
      'మంచి ప్రశ్న, కొంచెం ఆగండి, చెక్ చేసి చెబుతాను.',
    ],
    ta: [
      'ஒரு நிமிடம், வசதிகளைப் பற்றிப் பார்க்கிறேன்.',
      'நல்ல கேள்வி, கொஞ்சம் பொறுங்கள், சரிபார்த்துச் சொல்கிறேன்.',
    ],
    kn: [
      'ಒಂದು ಕ್ಷಣ, ಸೌಲಭ್ಯಗಳ ವಿವರ ನೋಡುತ್ತೇನೆ.',
      'ಒಳ್ಳೆಯ ಪ್ರಶ್ನೆ, ಸ್ವಲ್ಪ ಇರಿ, ಪರಿಶೀಲಿಸಿ ಹೇಳುತ್ತೇನೆ.',
    ],
  },
  nearby: {
    en: [
      'Let me check what is nearby for you.',
      'One moment, I am checking the distances.',
      'Give me a second to look up the location details.',
    ],
    hi: [
      'एक पल, आस-पास की जगहें और दूरी देख लेते हैं।',
      'बस एक सेकंड, लोकेशन की जानकारी निकालते हैं।',
    ],
    te: [
      'ఒక్క క్షణం, దగ్గరలో ఉన్నవి, దూరాలు చూస్తాను.',
      'కొంచెం ఆగండి, లొకేషన్ వివరాలు చెక్ చేస్తాను.',
    ],
    ta: [
      'ஒரு நிமிடம், அருகில் உள்ளவற்றையும் தூரத்தையும் பார்க்கிறேன்.',
      'கொஞ்சம் பொறுங்கள், இருப்பிட விவரங்களைச் சரிபார்க்கிறேன்.',
    ],
    kn: [
      'ಒಂದು ಕ್ಷಣ, ಹತ್ತಿರದ ಸ್ಥಳಗಳು ಮತ್ತು ದೂರ ನೋಡುತ್ತೇನೆ.',
      'ಸ್ವಲ್ಪ ಇರಿ, ಲೊಕೇಶನ್ ವಿವರಗಳನ್ನು ಪರಿಶೀಲಿಸುತ್ತೇನೆ.',
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
