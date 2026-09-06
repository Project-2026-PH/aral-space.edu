import { CreateQuestionDto, Quiz, QuizQuestion, Subject } from '@quiz-creator/types';

export const SAMPLE_SUBJECT_ID = 'a0000000-0000-4000-8000-000000000001';
export const SAMPLE_QUIZ_ID = 'b0000000-0000-4000-8000-000000000001';
export const SAMPLE_SHARE_TOKEN = 'kasaysayan-pilipinas-reviewer';

export const SAMPLE_SUBJECT: Subject = {
  id: SAMPLE_SUBJECT_ID,
  name: 'Kasaysayan ng Pilipinas',
  color: '#1d4ed8',
  share_token: 'kasaysayan-pilipinas',
  is_public: true,
  created_at: '2026-01-01T00:00:00.000Z'
};

export const SAMPLE_QUIZ: Quiz = {
  id: SAMPLE_QUIZ_ID,
  title: 'Pagsusulit sa Kasaysayan ng Pilipinas (1-10)',
  description: 'Reviewer para sa mga pangunahing kaganapan, bayani, at labanan sa kasaysayan ng Pilipinas mula ika-16 na siglo hanggang sa kasalukuyan.',
  question_count: 10,
  generated_at: '2026-01-01T00:00:00.000Z',
  handout_name: 'Pangkalahatang Kasaysayan ng Pilipinas',
  source_model: 'kasaysayan_reviewer',
  subject_id: SAMPLE_SUBJECT_ID,
  share_token: SAMPLE_SHARE_TOKEN,
  is_public: true,
  allow_cloning: true,
  created_at: '2026-01-01T00:00:00.000Z',
  subject: SAMPLE_SUBJECT
};

export const SAMPLE_QUESTIONS: CreateQuestionDto[] = [
  {
    question_text: "1. Ano ang makasaysayang kaganapan noong Agosto 1896 kung saan pinunit ng mga Katipunero ang kanilang mga sedula bilang tanda ng paghihimagsik laban sa kolonyalismong Espanyol?",
    options: [
      "Sigaw ng Pugad Lawin (o Balintawak)",
      "Kasunduan sa Biak-na-Bato",
      "Pagpapahayag ng Kasarinlan sa Kawit",
      "Labanan sa Tirad Pass"
    ],
    correct_answer: 0,
    explanation: "Ang Sigaw ng Pugad Lawin / Balintawak ang naghudyat sa pagsisimula ng Himagsikang Pilipino laban sa pamamahala ng mga Espanyol noong Agosto 1896.",
    correct_explanation: "Pinamunuan ni Andres Bonifacio ang pagpunit ng sedula bilang hayagang pagtanggi sa kapangyarihan at mapang-aping pagbubuwis ng Espanya.",
    distractor_explanations: {
      1: "Ang Kasunduan sa Biak-na-Bato (1897) ay pansamantalang tigil-putukan sa pagitan ng mga Espanyol at rebolusyonaryo.",
      2: "Ang deklarasyon sa Kawit ay naganap noong Hunyo 12, 1898 matapos ang unang yugto ng himagsikan.",
      3: "Ang Labanan sa Tirad Pass ay naganap noong 1899 sa panahon ng Digmaang Pilipino-Amerikano."
    },
    discriminatory_keywords: ["pagpunit ng sedula", "Sigaw ng Pugad Lawin", "1896", "Andres Bonifacio", "Katipunan"],
    concept_tags: ["himagsikan", "katipunan", "pugad-lawin"],
    source_pages: [1],
    order_index: 0
  },
  {
    question_text: "2. Kailan at saan pormal na ipinahayag ni Heneral Emilio Aguinaldo ang Kasarinlan ng Pilipinas mula sa pananakop ng Espanya?",
    options: [
      "Hunyo 12, 1898 sa Kawit, Cavite",
      "Hulyo 4, 1946 sa Luneta, Maynila",
      "Agosto 23, 1896 sa Balintawak",
      "Enero 23, 1899 sa Malolos, Bulacan"
    ],
    correct_answer: 0,
    explanation: "Noong Hunyo 12, 1898 sa balkonahe ng tahanan ni Emilio Aguinaldo sa Kawit, Cavite unang iwinagayway ang bandila ng Pilipinas at pinatugtog ang Marcha Nacional Filipina.",
    correct_explanation: "Ang Hunyo 12, 1898 ang opisyal na Araw ng Kalayaan ng Pilipinas kung saan ipinahayag ang paglaya sa mahigit 300 taong pananakop ng Espanya.",
    distractor_explanations: {
      1: "Ang Hulyo 4, 1946 ay ang pagkilala ng Estados Unidos sa kalayaan ng Pilipinas matapos ang Ikalawang Digmaang Pandaigdig.",
      2: "Ang Agosto 1896 ay ang pagsisimula ng rebolusyon ng Katipunan.",
      3: "Ang Enero 23, 1899 ay ang pagpapasinaya ng Unang Republika ng Pilipinas sa Malolos."
    },
    discriminatory_keywords: ["Hunyo 12, 1898", "Kawit, Cavite", "Emilio Aguinaldo", "Marcha Nacional Filipina"],
    concept_tags: ["kasarinlan", "kawit-cavite", "watawat"],
    source_pages: [1],
    order_index: 1
  },
  {
    question_text: "3. Aling nobela ni Dr. Jose Rizal ang nalimbag sa Berlin noong 1887 na naglantad sa mga katiwalian at pang-aabuso ng mga prayle sa lipunang kolonyal?",
    options: [
      "Noli Me Tangere",
      "El Filibusterismo",
      "Sucesos de las Islas Filipinas",
      "A La Juventud Filipina"
    ],
    correct_answer: 0,
    explanation: "Ang Noli Me Tangere ('Huwag Mo Akong Salingin') ang unang nobelang panlipunan ni Rizal na inilimbag sa Berlin noong Marso 1887 sa tulong ni Dr. Maximo Viola.",
    correct_explanation: "Inilarawan sa Noli Me Tangere ang kanser ng lipunan at panunupil ng pamahalaang kolonyal at mga prayle gamit ang mga karakter tulad nina Crisostomo Ibarra at Maria Clara.",
    distractor_explanations: {
      1: "Ang El Filibusterismo ang ikalawang nobela na inilimbag sa Ghent, Belgium noong 1891 na may temang pulitikal at rebolusyonaryo.",
      2: "Ang Sucesos de las Islas Filipinas ay aklat pangkasaysayan ni Antonio de Morga na nilagyan ni Rizal ng mga paliwanag.",
      3: "Ang A La Juventud Filipina ay tulang isinulat ni Rizal noong siya ay kabataang mag-aaral."
    },
    discriminatory_keywords: ["Noli Me Tangere", "Berlin 1887", "kanser ng lipunan", "Crisostomo Ibarra"],
    concept_tags: ["jose-rizal", "propaganda", "noli-me-tangere"],
    source_pages: [2],
    order_index: 2
  },
  {
    question_text: "4. Sino ang magiting na pinunong Pilipino mula sa Mactan na tumangging pasakop sa mga dayuhan at tinalo ang ekspedisyon ni Ferdinand Magellan noong Abril 27, 1521?",
    options: [
      "Lapu-Lapu",
      "Rajah Humabon",
      "Rajah Sulayman",
      "Datu Zula"
    ],
    correct_answer: 0,
    explanation: "Si Lapu-Lapu ang datu ng Mactan na nagtanggol sa kanyang pulo laban sa mga Kastila at nagbunga sa pagkamatay ni Ferdinand Magellan sa Labanan sa Mactan.",
    correct_explanation: "Itinuturing si Lapu-Lapu bilang pinakaunang pambansang bayaning Pilipino na lumaban at nagtagumpay laban sa kolonyalismong Kanluranin.",
    distractor_explanations: {
      1: "Si Rajah Humabon ang pinuno ng Cebu na nakiisa at nagpabinyag sa mga Espanyol.",
      2: "Si Rajah Sulayman ang magiting na pinuno ng Maynila na lumaban noong 1570-1571 laban kina Legazpi at Goiti.",
      3: "Si Datu Zula ang karibal ni Lapu-Lapu sa Mactan na humingi ng saklolo kay Magellan."
    },
    discriminatory_keywords: ["Lapu-Lapu", "Labanan sa Mactan", "Abril 27, 1521", "Ferdinand Magellan"],
    concept_tags: ["mactan", "lapu-lapu", "sinaunang-kasaysayan"],
    source_pages: [2],
    order_index: 3
  },
  {
    question_text: "5. Ang pagbitay sa tatlong paring sekular (GOMBURZA) sa Bagumbayan noong Pebrero 17, 1872 ay gumising sa damdaming makabayan ng mga Pilipino. Sinu-sino sila?",
    options: [
      "Mariano Gomez, Jose Burgos, at Jacinto Zamora",
      "Pedro Pelaez, Jose Burgos, at Mariano Gomez",
      "Mariano Gomez, Jacinto Zamora, at Emilio Jacinto",
      "Jose Burgos, Antonio Luna, at Pedro Paterno"
    ],
    correct_answer: 0,
    explanation: "Sina Padres Mariano Gomez, Jose Burgos, at Jacinto Zamora ay binitay sa pamamagitan ng garote dahil sa maling paratang ng sedisyon kaugnay ng Pag-aalsa sa Cavite noong 1872.",
    correct_explanation: "Ang martiryo ng Gomburza ang nagbigay-sigla sa Kilusang Propaganda at naging dahilan kung bakit inialay ni Jose Rizal ang kanyang nobelang El Filibusterismo sa kanila.",
    distractor_explanations: {
      1: "Si Padre Pedro Pelaez ang unang tagapagtanggol ng sekularisasyon ng mga parokya bago siya nasawi noong 1863.",
      2: "Si Emilio Jacinto ay heneral at manunulat ng Katipunan, hindi paring sekular.",
      3: "Sina Antonio Luna at Pedro Paterno ay mga prominenteng lider sa panahon ng Digmaang Pilipino-Amerikano at Himagsikan."
    },
    discriminatory_keywords: ["GOMBURZA", "Gomez", "Burgos", "Zamora", "garote 1872", "sekularisasyon"],
    concept_tags: ["gomburza", "nasyonalismo", "1872"],
    source_pages: [3],
    order_index: 4
  },
  {
    question_text: "6. Anong kasunduan ang nilagdaan noong Disyembre 10, 1898 kung saan isinuko ng Espanya ang pamamahala sa Pilipinas sa Estados Unidos sa halagang $20 milyon?",
    options: [
      "Kasunduan sa Paris (Treaty of Paris)",
      "Kasunduan sa Biak-na-Bato",
      "Kasunduang Bates",
      "Kasunduang Tordesillas"
    ],
    correct_answer: 0,
    explanation: "Sa Kasunduan sa Paris (1898), opisyal na ipinasa ng Espanya ang teritoryo ng Pilipinas, Guam, at Puerto Rico sa Estados Unidos kapalit ng $20,000,000.",
    correct_explanation: "Ang pagwawalang-bahala ng Amerika sa sariling deklarasyon ng kalayaan ng mga Pilipino ang nagbunsod sa pagsiklab ng Digmaang Pilipino-Amerikano noong Pebrero 1899.",
    distractor_explanations: {
      1: "Ang Kasunduan sa Biak-na-Bato (1897) ay paktong nilagdaan sa pagitan ng pamahalaang rebolusyonaryo at Espanya.",
      2: "Ang Kasunduang Bates (1899) ay kasunduan ng Estados Unidos sa Sultan ng Sulu.",
      3: "Ang Kasunduang Tordesillas (1494) ay paghahati ng mga bagong lupaing tutuklasin sa pagitan ng Espanya at Portugal."
    },
    discriminatory_keywords: ["Kasunduan sa Paris", "Disyembre 10, 1898", "$20 milyon", "Digmaang Espanyol-Amerikano"],
    concept_tags: ["treaty-of-paris", "digmaang-pilipino-amerikano", "kasaysayan"],
    source_pages: [3],
    order_index: 5
  },
  {
    question_text: "7. Sino ang tinaguriang 'Bayani ng Pasong Tirad' na nagbuwis ng buhay noong Disyembre 2, 1899 upang harangin ang mga sundalong Amerikano at makatakas si Pangulong Aguinaldo?",
    options: [
      "Heneral Gregorio del Pilar",
      "Heneral Antonio Luna",
      "Heneral Miguel Malvar",
      "Heneral Artemio Ricarte"
    ],
    correct_answer: 0,
    explanation: "Si Heneral Gregorio del Pilar, sa gulang na 24, ang namuno sa 60 kawal na nagtanggol sa Tirad Pass laban sa 33rd Infantry Regiment ng Estados Unidos.",
    correct_explanation: "Kinilala siya bilang pinakabatang heneral ng hukbong rebolusyonaryo na nagpakita ng sukdulang katapangan upang ipagtanggol ang liderato ng republika.",
    distractor_explanations: {
      1: "Si Heneral Antonio Luna ang punong heneral ng sandatahang lakas na pinaslang sa Cabanatuan noong Hunyo 1899.",
      2: "Si Heneral Miguel Malvar ang isa sa mga huling heneral na sumuko sa mga Amerikano sa Batangas noong 1902.",
      3: "Si Heneral Artemio Ricarte ('Vibora') ay kilala sa hindi pagsuko o panunumpa sa bandila ng Amerika kailanman."
    },
    discriminatory_keywords: ["Gregorio del Pilar", "Pasong Tirad", "Tirad Pass", "Disyembre 2, 1899"],
    concept_tags: ["tirad-pass", "gregorio-del-pilar", "mga-bayani"],
    source_pages: [4],
    order_index: 6
  },
  {
    question_text: "8. Sino ang kinikilalang 'Utak ng Katipunan' na sumulat ng Kartilya ng Katipunan at naging pinagkakatiwalaang tagapayo ni Andres Bonifacio?",
    options: [
      "Emilio Jacinto",
      "Apolinario Mabini",
      "Marcelo H. del Pilar",
      "Graciano Lopez Jaena"
    ],
    correct_answer: 0,
    explanation: "Si Emilio Jacinto ang tinawag na 'Utak ng Katipunan' at may-akda ng Kartilya na naging gabay sa moralidad at tungkulin ng bawat kasapi ng KKK.",
    correct_explanation: "Samantalang si Emilio Jacinto ang 'Utak ng Katipunan', si Apolinario Mabini naman ang kinilalang 'Utak ng Himagsikan' at 'Dakilang Lumpo'.",
    distractor_explanations: {
      1: "Si Apolinario Mabini ang 'Utak ng Himagsikan' at naging unang Punong Ministro ng pamahalaang rebolusyonaryo.",
      2: "Si Marcelo H. del Pilar (Plaridel) ang patnugot ng La Solidaridad sa Espanya.",
      3: "Si Graciano Lopez Jaena ang tagapagtatag ng La Solidaridad at kilalang orador ng kilusang reporma."
    },
    discriminatory_keywords: ["Emilio Jacinto", "Utak ng Katipunan", "Kartilya", "Andres Bonifacio"],
    concept_tags: ["emilio-jacinto", "kartilya", "katipunan"],
    source_pages: [4],
    order_index: 7
  },
  {
    question_text: "9. Anong mapayapang rebolusyon noong Pebrero 22–25, 1986 ang nagwakas sa diktadurang rehimen at nagpanumbalik ng demokrasya sa Pilipinas?",
    options: [
      "People Power Revolution (EDSA I)",
      "First Quarter Storm",
      "EDSA Dos (People Power II)",
      "Sigaw ng Pugad Lawin"
    ],
    correct_answer: 0,
    explanation: "Ang People Power Revolution sa EDSA noong Pebrero 1986 ay mapayapang demonstrasyon ng milyun-milyong Pilipino na nagpatalsik kay Ferdinand Marcos Sr. at nagluklok kay Corazon Aquino.",
    correct_explanation: "Kinilala sa buong daigdig ang EDSA Revolution bilang inspirasyon ng mapayapang pagkilos gamit ang panalangin, bulaklak, at pagkakaisa laban sa awtoritaryanismo.",
    distractor_explanations: {
      1: "Ang First Quarter Storm noong 1970 ay serye ng malalaking protesta ng mga estudyante bago ang Batas Militar.",
      2: "Ang EDSA Dos noong Enero 2001 ang nagpatalsik kay Pangulong Joseph Estrada.",
      3: "Ang Sigaw ng Pugad Lawin ay naganap noong 1896 laban sa mga Kastila."
    },
    discriminatory_keywords: ["People Power Revolution", "EDSA 1986", "Corazon Aquino", "Pebrero 22-25"],
    concept_tags: ["edsa", "people-power", "makabagong-kasaysayan"],
    source_pages: [5],
    order_index: 8
  },
  {
    question_text: "10. Saang makasaysayang simbahan sa Bulacan pinagtibay ang Konstitusyon ng Malolos at pinasinayaan ang Unang Republika ng Pilipinas noong Enero 23, 1899?",
    options: [
      "Simbahan ng Barasoain sa Malolos, Bulacan",
      "Katedral ng Maynila sa Intramuros",
      "Simbahan ng San Agustin sa Intramuros",
      "Simbahan ng Paoay sa Ilocos Norte"
    ],
    correct_answer: 0,
    explanation: "Ang Simbahan ng Barasoain sa Malolos, Bulacan ang naging luklukan ng Kongreso ng Malolos na bumalangkas sa kauna-unahang konstitusyong demokratiko sa buong Asya.",
    correct_explanation: "Sa Simbahan ng Barasoain pormal na pinasinayaan ang Unang Republika ng Pilipinas kung saan nanumpa si Emilio Aguinaldo bilang unang Pangulo ng bansa.",
    distractor_explanations: {
      1: "Ang Katedral ng Maynila ay ang sentro ng Arkidiyosesis ng Maynila ngunit hindi dito itinatag ang unang republika.",
      2: "Ang Simbahan ng San Agustin ang pinakamatandang simbahang bato kung saan nilagdaan ang pagsuko ng Espanya sa Amerika noong 1898.",
      3: "Ang Simbahan ng Paoay ay kilalang UNESCO World Heritage Baroque church sa Ilocos Norte."
    },
    discriminatory_keywords: ["Simbahan ng Barasoain", "Malolos, Bulacan", "Enero 23, 1899", "Unang Republika ng Pilipinas"],
    concept_tags: ["barasoain", "malolos-republic", "konstitusyon"],
    source_pages: [5],
    order_index: 9
  }
];

export const SAMPLE_QUIZ_QUESTIONS: QuizQuestion[] = SAMPLE_QUESTIONS.map((q, idx) => {
  const options = q.options || [];
  const correctAnswer = q.correct_answer ?? 0;
  const questionId = `c0000000-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`;
  return {
    id: questionId,
    quiz_id: SAMPLE_QUIZ_ID,
    question_text: q.question_text,
    answer_text: options[correctAnswer] || '',
    question_type: 'multiple_choice',
    options,
    correct_answer: correctAnswer,
    explanation: q.explanation || null,
    correct_explanation: q.correct_explanation || null,
    distractor_explanations: q.distractor_explanations || null,
    discriminatory_keywords: q.discriminatory_keywords || null,
    concept_tags: q.concept_tags || null,
    source_pages: q.source_pages || [],
    order_index: idx,
    created_at: '2026-01-01T00:00:00.000Z'
  };
});

export class SampleQuizService {
  static getSampleData() {
    return {
      subject: SAMPLE_SUBJECT,
      quiz: SAMPLE_QUIZ,
      questions: SAMPLE_QUESTIONS,
      quizQuestions: SAMPLE_QUIZ_QUESTIONS
    };
  }

  static getSampleQuiz(): Quiz {
    return { ...SAMPLE_QUIZ };
  }

  static getSampleSubject(): Subject {
    return { ...SAMPLE_SUBJECT };
  }

  static getSampleQuestions(): QuizQuestion[] {
    return [...SAMPLE_QUIZ_QUESTIONS];
  }
}
