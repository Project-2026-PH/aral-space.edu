import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'packages', 'core', 'package.json'));
const { neon } = require('@neondatabase/serverless');
const databaseUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!databaseUrl) {
  console.error('[Seed Error]: DATABASE_URL or NEON_DATABASE_URL is not defined.');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function seed() {
  console.log('[Neon Seed] Ensuring schema columns...');
  await sql`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS share_token TEXT`;
  await sql`ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS share_token TEXT`;
  await sql`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS allow_cloning BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS allow_public_answer_key BOOLEAN NOT NULL DEFAULT FALSE`;

  console.log('[Neon Seed] Purging legacy cognitive mastery sample...');
  await sql`DELETE FROM quizzes WHERE id = 'b0000000-0000-4000-8000-000000000001' OR share_token = 'cognitive-mastery-sample'`;
  await sql`DELETE FROM subjects WHERE id = 'a0000000-0000-4000-8000-000000000001' OR share_token = 'subject-cognitive-mastery'`;

  console.log('[Neon Seed] Seeding Filipino History subject and reviewer quiz (1-10)...');

  await sql`
    INSERT INTO subjects (id, name, color, share_token, is_public)
    VALUES (
      'a0000000-0000-4000-8000-000000000001',
      'Kasaysayan ng Pilipinas',
      '#1d4ed8',
      'kasaysayan-pilipinas',
      TRUE
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      color = EXCLUDED.color,
      share_token = EXCLUDED.share_token,
      is_public = EXCLUDED.is_public;
  `;

  await sql`
    INSERT INTO quizzes (
      id,
      title,
      description,
      question_count,
      handout_name,
      source_model,
      subject_id,
      share_token,
      is_public,
      allow_cloning
    )
    VALUES (
      'b0000000-0000-4000-8000-000000000001',
      'Pagsusulit sa Kasaysayan ng Pilipinas (1-10)',
      'Reviewer para sa mga pangunahing kaganapan, bayani, at labanan sa kasaysayan ng Pilipinas mula ika-16 na siglo hanggang sa kasalukuyan.',
      10,
      'Pangkalahatang Kasaysayan ng Pilipinas',
      'kasaysayan_reviewer',
      'a0000000-0000-4000-8000-000000000001',
      'kasaysayan-pilipinas-reviewer',
      TRUE,
      TRUE
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      question_count = EXCLUDED.question_count,
      handout_name = EXCLUDED.handout_name,
      source_model = EXCLUDED.source_model,
      subject_id = EXCLUDED.subject_id,
      share_token = EXCLUDED.share_token,
      is_public = EXCLUDED.is_public,
      allow_cloning = EXCLUDED.allow_cloning;
  `;

  const questions = [
    {
      id: 'c0000000-0000-4000-8000-000000000001',
      text: '1. Ano ang makasaysayang kaganapan noong Agosto 1896 kung saan pinunit ng mga Katipunero ang kanilang mga sedula bilang tanda ng paghihimagsik laban sa kolonyalismong Espanyol?',
      answer: 'Sigaw ng Pugad Lawin (o Balintawak)',
      options: ['Sigaw ng Pugad Lawin (o Balintawak)', 'Kasunduan sa Biak-na-Bato', 'Pagpapahayag ng Kasarinlan sa Kawit', 'Labanan sa Tirad Pass'],
      correct: 0,
      exp: 'Ang Sigaw ng Pugad Lawin / Balintawak ang naghudyat sa pagsisimula ng Himagsikang Pilipino laban sa pamamahala ng mga Espanyol noong Agosto 1896.',
      correctExp: 'Pinamunuan ni Andres Bonifacio ang pagpunit ng sedula bilang hayagang pagtanggi sa kapangyarihan at mapang-aping pagbubuwis ng Espanya.',
      distractorExp: {
        1: 'Ang Kasunduan sa Biak-na-Bato (1897) ay pansamantalang tigil-putukan sa pagitan ng mga Espanyol at rebolusyonaryo.',
        2: 'Ang deklarasyon sa Kawit ay naganap noong Hunyo 12, 1898 matapos ang unang yugto ng himagsikan.',
        3: 'Ang Labanan sa Tirad Pass ay naganap noong 1899 sa panahon ng Digmaang Pilipino-Amerikano.'
      },
      kw: ['pagpunit ng sedula', 'Sigaw ng Pugad Lawin', '1896', 'Andres Bonifacio', 'Katipunan'],
      order: 0
    },
    {
      id: 'c0000000-0000-4000-8000-000000000002',
      text: '2. Kailan at saan pormal na ipinahayag ni Heneral Emilio Aguinaldo ang Kasarinlan ng Pilipinas mula sa pananakop ng Espanya?',
      answer: 'Hunyo 12, 1898 sa Kawit, Cavite',
      options: ['Hunyo 12, 1898 sa Kawit, Cavite', 'Hulyo 4, 1946 sa Luneta, Maynila', 'Agosto 23, 1896 sa Balintawak', 'Enero 23, 1899 sa Malolos, Bulacan'],
      correct: 0,
      exp: 'Noong Hunyo 12, 1898 sa balkonahe ng tahanan ni Emilio Aguinaldo sa Kawit, Cavite unang iwinagayway ang bandila ng Pilipinas at pinatugtog ang Marcha Nacional Filipina.',
      correctExp: 'Ang Hunyo 12, 1898 ang opisyal na Araw ng Kalayaan ng Pilipinas kung saan ipinahayag ang paglaya sa mahigit 300 taong pananakop ng Espanya.',
      distractorExp: {
        1: 'Ang Hulyo 4, 1946 ay ang pagkilala ng Estados Unidos sa kalayaan ng Pilipinas matapos ang Ikalawang Digmaang Pandaigdig.',
        2: 'Ang Agosto 1896 ay ang pagsisimula ng rebolusyon ng Katipunan.',
        3: 'Ang Enero 23, 1899 ay ang pagpapasinaya ng Unang Republika ng Pilipinas sa Malolos.'
      },
      kw: ['Hunyo 12, 1898', 'Kawit, Cavite', 'Emilio Aguinaldo', 'Marcha Nacional Filipina'],
      order: 1
    },
    {
      id: 'c0000000-0000-4000-8000-000000000003',
      text: '3. Aling nobela ni Dr. Jose Rizal ang nalimbag sa Berlin noong 1887 na naglantad sa mga katiwalian at pang-aabuso ng mga prayle sa lipunang kolonyal?',
      answer: 'Noli Me Tangere',
      options: ['Noli Me Tangere', 'El Filibusterismo', 'Sucesos de las Islas Filipinas', 'A La Juventud Filipina'],
      correct: 0,
      exp: 'Ang Noli Me Tangere (\'Huwag Mo Akong Salingin\') ang unang nobelang panlipunan ni Rizal na inilimbag sa Berlin noong Marso 1887 sa tulong ni Dr. Maximo Viola.',
      correctExp: 'Inilarawan sa Noli Me Tangere ang kanser ng lipunan at panunupil ng pamahalaang kolonyal at mga prayle gamit ang mga karakter tulad nina Crisostomo Ibarra at Maria Clara.',
      distractorExp: {
        1: 'Ang El Filibusterismo ang ikalawang nobela na inilimbag sa Ghent, Belgium noong 1891 na may temang pulitikal at rebolusyonaryo.',
        2: 'Ang Sucesos de las Islas Filipinas ay aklat pangkasaysayan ni Antonio de Morga na nilagyan ni Rizal ng mga paliwanag.',
        3: 'Ang A La Juventud Filipina ay tulang isinulat ni Rizal noong siya ay kabataang mag-aaral.'
      },
      kw: ['Noli Me Tangere', 'Berlin 1887', 'kanser ng lipunan', 'Crisostomo Ibarra'],
      order: 2
    },
    {
      id: 'c0000000-0000-4000-8000-000000000004',
      text: '4. Sino ang magiting na pinunong Pilipino mula sa Mactan na tumangging pasakop sa mga dayuhan at tinalo ang ekspedisyon ni Ferdinand Magellan noong Abril 27, 1521?',
      answer: 'Lapu-Lapu',
      options: ['Lapu-Lapu', 'Rajah Humabon', 'Rajah Sulayman', 'Datu Zula'],
      correct: 0,
      exp: 'Si Lapu-Lapu ang datu ng Mactan na nagtanggol sa kanyang pulo laban sa mga Kastila at nagbunga sa pagkamatay ni Ferdinand Magellan sa Labanan sa Mactan.',
      correctExp: 'Itinuturing si Lapu-Lapu bilang pinakaunang pambansang bayaning Pilipino na lumaban at nagtagumpay laban sa kolonyalismong Kanluranin.',
      distractorExp: {
        1: 'Si Rajah Humabon ang pinuno ng Cebu na nakiisa at nagpabinyag sa mga Espanyol.',
        2: 'Si Rajah Sulayman ang magiting na pinuno ng Maynila na lumaban noong 1570-1571 laban kina Legazpi at Goiti.',
        3: 'Si Datu Zula ang karibal ni Lapu-Lapu sa Mactan na humingi ng saklolo kay Magellan.'
      },
      kw: ['Lapu-Lapu', 'Labanan sa Mactan', 'Abril 27, 1521', 'Ferdinand Magellan'],
      order: 3
    },
    {
      id: 'c0000000-0000-4000-8000-000000000005',
      text: '5. Ang pagbitay sa tatlong paring sekular (GOMBURZA) sa Bagumbayan noong Pebrero 17, 1872 ay gumising sa damdaming makabayan ng mga Pilipino. Sinu-sino sila?',
      answer: 'Mariano Gomez, Jose Burgos, at Jacinto Zamora',
      options: ['Mariano Gomez, Jose Burgos, at Jacinto Zamora', 'Pedro Pelaez, Jose Burgos, at Mariano Gomez', 'Mariano Gomez, Jacinto Zamora, at Emilio Jacinto', 'Jose Burgos, Antonio Luna, at Pedro Paterno'],
      correct: 0,
      exp: 'Sina Padres Mariano Gomez, Jose Burgos, at Jacinto Zamora ay binitay sa pamamagitan ng garote dahil sa maling paratang ng sedisyon kaugnay ng Pag-aalsa sa Cavite noong 1872.',
      correctExp: 'Ang martiryo ng Gomburza ang nagbigay-sigla sa Kilusang Propaganda at naging dahilan kung bakit inialay ni Jose Rizal ang kanyang nobelang El Filibusterismo sa kanila.',
      distractorExp: {
        1: 'Si Padre Pedro Pelaez ang unang tagapagtanggol ng sekularisasyon ng mga parokya bago siya nasawi noong 1863.',
        2: 'Si Emilio Jacinto ay heneral at manunulat ng Katipunan, hindi paring sekular.',
        3: 'Sina Antonio Luna at Pedro Paterno ay mga prominenteng lider sa panahon ng Digmaang Pilipino-Amerikano at Himagsikan.'
      },
      kw: ['GOMBURZA', 'Gomez', 'Burgos', 'Zamora', 'garote 1872', 'sekularisasyon'],
      order: 4
    },
    {
      id: 'c0000000-0000-4000-8000-000000000006',
      text: '6. Anong kasunduan ang nilagdaan noong Disyembre 10, 1898 kung saan isinuko ng Espanya ang pamamahala sa Pilipinas sa Estados Unidos sa halagang $20 milyon?',
      answer: 'Kasunduan sa Paris (Treaty of Paris)',
      options: ['Kasunduan sa Paris (Treaty of Paris)', 'Kasunduan sa Biak-na-Bato', 'Kasunduang Bates', 'Kasunduang Tordesillas'],
      correct: 0,
      exp: 'Sa Kasunduan sa Paris (1898), opisyal na ipinasa ng Espanya ang teritoryo ng Pilipinas, Guam, at Puerto Rico sa Estados Unidos kapalit ng $20,000,000.',
      correctExp: 'Ang pagwawalang-bahala ng Amerika sa sariling deklarasyon ng kalayaan ng mga Pilipino ang nagbunsod sa pagsiklab ng Digmaang Pilipino-Amerikano noong Pebrero 1899.',
      distractorExp: {
        1: 'Ang Kasunduan sa Biak-na-Bato (1897) ay paktong nilagdaan sa pagitan ng pamahalaang rebolusyonaryo at Espanya.',
        2: 'Ang Kasunduang Bates (1899) ay kasunduan ng Estados Unidos sa Sultan ng Sulu.',
        3: 'Ang Kasunduang Tordesillas (1494) ay paghahati ng mga bagong lupaing tutuklasin sa pagitan ng Espanya at Portugal.'
      },
      kw: ['Kasunduan sa Paris', 'Disyembre 10, 1898', '$20 milyon', 'Digmaang Espanyol-Amerikano'],
      order: 5
    },
    {
      id: 'c0000000-0000-4000-8000-000000000007',
      text: '7. Sino ang tinaguriang \'Bayani ng Pasong Tirad\' na nagbuwis ng buhay noong Disyembre 2, 1899 upang harangin ang mga sundalong Amerikano at makatakas si Pangulong Aguinaldo?',
      answer: 'Heneral Gregorio del Pilar',
      options: ['Heneral Gregorio del Pilar', 'Heneral Antonio Luna', 'Heneral Miguel Malvar', 'Heneral Artemio Ricarte'],
      correct: 0,
      exp: 'Si Heneral Gregorio del Pilar, sa gulang na 24, ang namuno sa 60 kawal na nagtanggol sa Tirad Pass laban sa 33rd Infantry Regiment ng Estados Unidos.',
      correctExp: 'Kinilala siya bilang pinakabatang heneral ng hukbong rebolusyonaryo na nagpakita ng sukdulang katapangan upang ipagtanggol ang liderato ng republika.',
      distractorExp: {
        1: 'Si Heneral Antonio Luna ang punong heneral ng sandatahang lakas na pinaslang sa Cabanatuan noong Hunyo 1899.',
        2: 'Si Heneral Miguel Malvar ang isa sa mga huling heneral na sumuko sa mga Amerikano sa Batangas noong 1902.',
        3: 'Si Heneral Artemio Ricarte (\'Vibora\') ay kilala sa hindi pagsuko o panunumpa sa bandila ng Amerika kailanman.'
      },
      kw: ['Gregorio del Pilar', 'Pasong Tirad', 'Tirad Pass', 'Disyembre 2, 1899'],
      order: 6
    },
    {
      id: 'c0000000-0000-4000-8000-000000000008',
      text: '8. Sino ang kinikilalang \'Utak ng Katipunan\' na sumulat ng Kartilya ng Katipunan at naging pinagkakatiwalaang tagapayo ni Andres Bonifacio?',
      answer: 'Emilio Jacinto',
      options: ['Emilio Jacinto', 'Apolinario Mabini', 'Marcelo H. del Pilar', 'Graciano Lopez Jaena'],
      correct: 0,
      exp: 'Si Emilio Jacinto ang tinawag na \'Utak ng Katipunan\' at may-akda ng Kartilya na naging gabay sa moralidad at tungkulin ng bawat kasapi ng KKK.',
      correctExp: 'Samantalang si Emilio Jacinto ang \'Utak ng Katipunan\', si Apolinario Mabini naman ang kinilalang \'Utak ng Himagsikan\' at \'Dakilang Lumpo\'.',
      distractorExp: {
        1: 'Si Apolinario Mabini ang \'Utak ng Himagsikan\' at naging unang Punong Ministro ng pamahalaang rebolusyonaryo.',
        2: 'Si Marcelo H. del Pilar (Plaridel) ang patnugot ng La Solidaridad sa Espanya.',
        3: 'Si Graciano Lopez Jaena ang tagapagtatag ng La Solidaridad at kilalang orador ng kilusang reporma.'
      },
      kw: ['Emilio Jacinto', 'Utak ng Katipunan', 'Kartilya', 'Andres Bonifacio'],
      order: 7
    },
    {
      id: 'c0000000-0000-4000-8000-000000000009',
      text: '9. Anong mapayapang rebolusyon noong Pebrero 22–25, 1986 ang nagwakas sa diktadurang rehimen at nagpanumbalik ng demokrasya sa Pilipinas?',
      answer: 'People Power Revolution (EDSA I)',
      options: ['People Power Revolution (EDSA I)', 'First Quarter Storm', 'EDSA Dos (People Power II)', 'Sigaw ng Pugad Lawin'],
      correct: 0,
      exp: 'Ang People Power Revolution sa EDSA noong Pebrero 1986 ay mapayapang demonstrasyon ng milyun-milyong Pilipino na nagpatalsik kay Ferdinand Marcos Sr. at nagluklok kay Corazon Aquino.',
      correctExp: 'Kinilala sa buong daigdig ang EDSA Revolution bilang inspirasyon ng mapayapang pagkilos gamit ang panalangin, bulaklak, at pagkakaisa laban sa awtoritaryanismo.',
      distractorExp: {
        1: 'Ang First Quarter Storm noong 1970 ay serye ng malalaking protesta ng mga estudyante bago ang Batas Militar.',
        2: 'Ang EDSA Dos noong Enero 2001 ang nagpatalsik kay Pangulong Joseph Estrada.',
        3: 'Ang Sigaw ng Pugad Lawin ay naganap noong 1896 laban sa mga Kastila.'
      },
      kw: ['People Power Revolution', 'EDSA 1986', 'Corazon Aquino', 'Pebrero 22-25'],
      order: 8
    },
    {
      id: 'c0000000-0000-4000-8000-000000000010',
      text: '10. Saang makasaysayang simbahan sa Bulacan pinagtibay ang Konstitusyon ng Malolos at pinasinayaan ang Unang Republika ng Pilipinas noong Enero 23, 1899?',
      answer: 'Simbahan ng Barasoain sa Malolos, Bulacan',
      options: ['Simbahan ng Barasoain sa Malolos, Bulacan', 'Katedral ng Maynila sa Intramuros', 'Simbahan ng San Agustin sa Intramuros', 'Simbahan ng Paoay sa Ilocos Norte'],
      correct: 0,
      exp: 'Ang Simbahan ng Barasoain sa Malolos, Bulacan ang naging luklukan ng Kongreso ng Malolos na bumalangkas sa kauna-unahang konstitusyong demokratiko sa buong Asya.',
      correctExp: 'Sa Simbahan ng Barasoain pormal na pinasinayaan ang Unang Republika ng Pilipinas kung saan nanumpa si Emilio Aguinaldo bilang unang Pangulo ng bansa.',
      distractorExp: {
        1: 'Ang Katedral ng Maynila ay ang sentro ng Arkidiyosesis ng Maynila ngunit hindi dito itinatag ang unang republika.',
        2: 'Ang Simbahan ng San Agustin ang pinakamatandang simbahang bato kung saan nilagdaan ang pagsuko ng Espanya sa Amerika noong 1898.',
        3: 'Ang Simbahan ng Paoay ay kilalang UNESCO World Heritage Baroque church sa Ilocos Norte.'
      },
      kw: ['Simbahan ng Barasoain', 'Malolos, Bulacan', 'Enero 23, 1899', 'Unang Republika ng Pilipinas'],
      order: 9
    }
  ];

  for (const q of questions) {
    await sql`
      INSERT INTO quiz_questions (
        id, quiz_id, question_text, answer_text, question_type, options, correct_answer,
        explanation, correct_explanation, distractor_explanations, discriminatory_keywords, order_index
      )
      VALUES (
        ${q.id},
        'b0000000-0000-4000-8000-000000000001',
        ${q.text},
        ${q.answer},
        'multiple_choice',
        ${JSON.stringify(q.options)}::jsonb,
        ${q.correct},
        ${q.exp},
        ${q.correctExp},
        ${JSON.stringify(q.distractorExp)}::jsonb,
        ${JSON.stringify(q.kw)}::jsonb,
        ${q.order}
      )
      ON CONFLICT (id) DO UPDATE SET
        question_text = EXCLUDED.question_text,
        answer_text = EXCLUDED.answer_text,
        options = EXCLUDED.options,
        correct_answer = EXCLUDED.correct_answer,
        explanation = EXCLUDED.explanation,
        correct_explanation = EXCLUDED.correct_explanation,
        distractor_explanations = EXCLUDED.distractor_explanations,
        discriminatory_keywords = EXCLUDED.discriminatory_keywords,
        order_index = EXCLUDED.order_index;
    `;
  }

  console.log('[Neon Seed] Filipino History Reviewer seeded successfully (1-10)!');
}

seed().catch((err) => {
  console.error('[Neon Seed Failed]:', err);
  process.exit(1);
});
