-- =============================================================================
-- Neon Serverless Postgres Schema for Quiz Mastery Hub
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Subjects Table
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#86EFAC',
    user_id TEXT,
    share_token TEXT UNIQUE,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    share_expires_at TIMESTAMPTZ,
    share_revoked_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subjects_user_id ON subjects (user_id);
CREATE INDEX IF NOT EXISTS idx_subjects_name ON subjects (name);

-- 2. Quizzes Table
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    question_count INTEGER NOT NULL DEFAULT 0,
    handout_name TEXT,
    handout_path TEXT,
    source_model TEXT NOT NULL DEFAULT 'manual',
    description TEXT,
    term TEXT,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    user_id TEXT,
    share_token TEXT UNIQUE,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    allow_cloning BOOLEAN NOT NULL DEFAULT TRUE,
    allow_public_answer_key BOOLEAN NOT NULL DEFAULT FALSE,
    share_expires_at TIMESTAMPTZ,
    share_revoked_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    archived_by_subject BOOLEAN NOT NULL DEFAULT FALSE,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS term TEXT;

CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON quizzes (user_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_subject_id ON quizzes (subject_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_generated_at ON quizzes (generated_at DESC);

-- 3. Quiz Questions Table
CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    answer_text TEXT,
    question_type TEXT NOT NULL DEFAULT 'multiple_choice',
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    correct_answer INTEGER NOT NULL DEFAULT 0,
    explanation TEXT,
    source_pages JSONB,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_order ON quiz_questions (quiz_id, order_index);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_order ON quiz_questions (quiz_id, order_index ASC);

-- 4. Quiz Sessions Table
CREATE TABLE IF NOT EXISTS quiz_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    user_id TEXT,
    session_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_progress',
    available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quiz_sessions_lookup ON quiz_sessions (quiz_id, user_id, status);
    CREATE INDEX IF NOT EXISTS idx_quiz_sessions_active_lookup ON quiz_sessions (quiz_id, user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_quiz_id ON quiz_sessions (quiz_id);

-- 5. Quiz Question Progress Table
CREATE TABLE IF NOT EXISTS quiz_question_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES quiz_sessions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    streak_count INTEGER NOT NULL DEFAULT 0,
    has_missed BOOLEAN NOT NULL DEFAULT false,
    locked BOOLEAN NOT NULL DEFAULT false,
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_session_question UNIQUE (session_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_question_progress_session ON quiz_question_progress (session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_question_progress_question ON quiz_question_progress (question_id);

-- Safe additions for databases created from an earlier schema version.
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS share_token TEXT;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE subjects ALTER COLUMN is_public SET DEFAULT TRUE;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS share_revoked_at TIMESTAMPTZ;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS share_token TEXT;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE quizzes ALTER COLUMN is_public SET DEFAULT TRUE;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS allow_cloning BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS allow_public_answer_key BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS share_revoked_at TIMESTAMPTZ;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS archived_by_subject BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE subjects SET is_public = TRUE WHERE is_public IS NULL;
UPDATE quizzes SET is_public = TRUE WHERE is_public IS NULL;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS answer_text TEXT;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'multiple_choice';
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS correct_explanation TEXT;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS distractor_explanations JSONB;
ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS discriminatory_keywords JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_share_token_unique ON subjects (share_token) WHERE share_token IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_quizzes_share_token_unique ON quizzes (share_token) WHERE share_token IS NOT NULL;


-- Subject collaboration links are single-use invitations. Redemption is atomic on used_at.
CREATE TABLE IF NOT EXISTS subject_collaborator_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,
    used_by TEXT,
    max_uses INTEGER NOT NULL DEFAULT 1,
    uses_count INTEGER NOT NULL DEFAULT 0,
    redeemed_by TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subject_collaborators (
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (subject_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_subject_collaborator_links_subject ON subject_collaborator_links(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_collaborators_user ON subject_collaborators(user_id);

-- Unique subject viewers are keyed by the stable anonymous user/device identity.
CREATE TABLE IF NOT EXISTS subject_views (
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    viewer_id TEXT NOT NULL,
    first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (subject_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_subject_views_subject ON subject_views(subject_id);
CREATE INDEX IF NOT EXISTS idx_subject_views_viewer ON subject_views(viewer_id);
ALTER TABLE subject_collaborator_links ADD COLUMN IF NOT EXISTS used_by TEXT;
ALTER TABLE subject_collaborator_links ADD COLUMN IF NOT EXISTS max_uses INTEGER NOT NULL DEFAULT 1;
ALTER TABLE subject_collaborator_links ADD COLUMN IF NOT EXISTS uses_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE subject_collaborator_links ADD COLUMN IF NOT EXISTS redeemed_by TEXT[] NOT NULL DEFAULT '{}';


-- Distributed request throttling for serverless API instances.
CREATE TABLE IF NOT EXISTS security_rate_limits (
    bucket_key TEXT PRIMARY KEY,
    window_started_at TIMESTAMPTZ NOT NULL,
    request_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_security_rate_limits_updated_at ON security_rate_limits(updated_at);

-- Ephemeral device-to-device session pairing tickets.
CREATE TABLE IF NOT EXISTS anonymous_pairing_tickets (
    ticket_id TEXT PRIMARY KEY,
    anon_user_id TEXT NOT NULL,
    passcode_hash TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anon_pairing_user ON anonymous_pairing_tickets(anon_user_id);
CREATE INDEX IF NOT EXISTS idx_anon_pairing_expires ON anonymous_pairing_tickets(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_anon_pairing_active_user ON anonymous_pairing_tickets(anon_user_id) WHERE used_at IS NULL;

-- -----------------------------------------------------------------------------
-- Seed: Sample Filipino History Reviewer (Kasaysayan ng Pilipinas 1-10)
-- -----------------------------------------------------------------------------
DELETE FROM quizzes WHERE id = 'b0000000-0000-4000-8000-000000000001' OR share_token = 'cognitive-mastery-sample';
DELETE FROM subjects WHERE id = 'a0000000-0000-4000-8000-000000000001' OR share_token = 'subject-cognitive-mastery';

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
    allow_cloning,
    allow_public_answer_key
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
    allow_cloning = EXCLUDED.allow_cloning,
    allow_public_answer_key = EXCLUDED.allow_public_answer_key;

INSERT INTO quiz_questions (
    id, quiz_id, question_text, answer_text, question_type, options, correct_answer,
    explanation, correct_explanation, distractor_explanations, discriminatory_keywords, order_index
)
VALUES
(
    'c0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000001',
    '1. Ano ang makasaysayang kaganapan noong Agosto 1896 kung saan pinunit ng mga Katipunero ang kanilang mga sedula bilang tanda ng paghihimagsik laban sa kolonyalismong Espanyol?',
    'Sigaw ng Pugad Lawin (o Balintawak)',
    'multiple_choice',
    '["Sigaw ng Pugad Lawin (o Balintawak)", "Kasunduan sa Biak-na-Bato", "Pagpapahayag ng Kasarinlan sa Kawit", "Labanan sa Tirad Pass"]'::jsonb,
    0,
    'Ang Sigaw ng Pugad Lawin / Balintawak ang naghudyat sa pagsisimula ng Himagsikang Pilipino laban sa pamamahala ng mga Espanyol noong Agosto 1896.',
    'Pinamunuan ni Andres Bonifacio ang pagpunit ng sedula bilang hayagang pagtanggi sa kapangyarihan at mapang-aping pagbubuwis ng Espanya.',
    '{"1": "Ang Kasunduan sa Biak-na-Bato (1897) ay pansamantalang tigil-putukan sa pagitan ng mga Espanyol at rebolusyonaryo.", "2": "Ang deklarasyon sa Kawit ay naganap noong Hunyo 12, 1898 matapos ang unang yugto ng himagsikan.", "3": "Ang Labanan sa Tirad Pass ay naganap noong 1899 sa panahon ng Digmaang Pilipino-Amerikano."}'::jsonb,
    '["pagpunit ng sedula", "Sigaw ng Pugad Lawin", "1896", "Andres Bonifacio", "Katipunan"]'::jsonb,
    0
),
(
    'c0000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000001',
    '2. Kailan at saan pormal na ipinahayag ni Heneral Emilio Aguinaldo ang Kasarinlan ng Pilipinas mula sa pananakop ng Espanya?',
    'Hunyo 12, 1898 sa Kawit, Cavite',
    'multiple_choice',
    '["Hunyo 12, 1898 sa Kawit, Cavite", "Hulyo 4, 1946 sa Luneta, Maynila", "Agosto 23, 1896 sa Balintawak", "Enero 23, 1899 sa Malolos, Bulacan"]'::jsonb,
    0,
    'Noong Hunyo 12, 1898 sa balkonahe ng tahanan ni Emilio Aguinaldo sa Kawit, Cavite unang iwinagayway ang bandila ng Pilipinas at pinatugtog ang Marcha Nacional Filipina.',
    'Ang Hunyo 12, 1898 ang opisyal na Araw ng Kalayaan ng Pilipinas kung saan ipinahayag ang paglaya sa mahigit 300 taong pananakop ng Espanya.',
    '{"1": "Ang Hulyo 4, 1946 ay ang pagkilala ng Estados Unidos sa kalayaan ng Pilipinas matapos ang Ikalawang Digmaang Pandaigdig.", "2": "Ang Agosto 1896 ay ang pagsisimula ng rebolusyon ng Katipunan.", "3": "Ang Enero 23, 1899 ay ang pagpapasinaya ng Unang Republika ng Pilipinas sa Malolos."}'::jsonb,
    '["Hunyo 12, 1898", "Kawit, Cavite", "Emilio Aguinaldo", "Marcha Nacional Filipina"]'::jsonb,
    1
),
(
    'c0000000-0000-4000-8000-000000000003',
    'b0000000-0000-4000-8000-000000000001',
    '3. Aling nobela ni Dr. Jose Rizal ang nalimbag sa Berlin noong 1887 na naglantad sa mga katiwalian at pang-aabuso ng mga prayle sa lipunang kolonyal?',
    'Noli Me Tangere',
    'multiple_choice',
    '["Noli Me Tangere", "El Filibusterismo", "Sucesos de las Islas Filipinas", "A La Juventud Filipina"]'::jsonb,
    0,
    'Ang Noli Me Tangere (''Huwag Mo Akong Salingin'') ang unang nobelang panlipunan ni Rizal na inilimbag sa Berlin noong Marso 1887 sa tulong ni Dr. Maximo Viola.',
    'Inilarawan sa Noli Me Tangere ang kanser ng lipunan at panunupil ng pamahalaang kolonyal at mga prayle gamit ang mga karakter tulad nina Crisostomo Ibarra at Maria Clara.',
    '{"1": "Ang El Filibusterismo ang ikalawang nobela na inilimbag sa Ghent, Belgium noong 1891 na may temang pulitikal at rebolusyonaryo.", "2": "Ang Sucesos de las Islas Filipinas ay aklat pangkasaysayan ni Antonio de Morga na nilagyan ni Rizal ng mga paliwanag.", "3": "Ang A La Juventud Filipina ay tulang isinulat ni Rizal noong siya ay kabataang mag-aaral."}'::jsonb,
    '["Noli Me Tangere", "Berlin 1887", "kanser ng lipunan", "Crisostomo Ibarra"]'::jsonb,
    2
),
(
    'c0000000-0000-4000-8000-000000000004',
    'b0000000-0000-4000-8000-000000000001',
    '4. Sino ang magiting na pinunong Pilipino mula sa Mactan na tumangging pasakop sa mga dayuhan at tinalo ang ekspedisyon ni Ferdinand Magellan noong Abril 27, 1521?',
    'Lapu-Lapu',
    'multiple_choice',
    '["Lapu-Lapu", "Rajah Humabon", "Rajah Sulayman", "Datu Zula"]'::jsonb,
    0,
    'Si Lapu-Lapu ang datu ng Mactan na nagtanggol sa kanyang pulo laban sa mga Kastila at nagbunga sa pagkamatay ni Ferdinand Magellan sa Labanan sa Mactan.',
    'Itinuturing si Lapu-Lapu bilang pinakaunang pambansang bayaning Pilipino na lumaban at nagtagumpay laban sa kolonyalismong Kanluranin.',
    '{"1": "Si Rajah Humabon ang pinuno ng Cebu na nakiisa at nagpabinyag sa mga Espanyol.", "2": "Si Rajah Sulayman ang magiting na pinuno ng Maynila na lumaban noong 1570-1571 laban kina Legazpi at Goiti.", "3": "Si Datu Zula ang karibal ni Lapu-Lapu sa Mactan na humingi ng saklolo kay Magellan."}'::jsonb,
    '["Lapu-Lapu", "Labanan sa Mactan", "Abril 27, 1521", "Ferdinand Magellan"]'::jsonb,
    3
),
(
    'c0000000-0000-4000-8000-000000000005',
    'b0000000-0000-4000-8000-000000000001',
    '5. Ang pagbitay sa tatlong paring sekular (GOMBURZA) sa Bagumbayan noong Pebrero 17, 1872 ay gumising sa damdaming makabayan ng mga Pilipino. Sinu-sino sila?',
    'Mariano Gomez, Jose Burgos, at Jacinto Zamora',
    'multiple_choice',
    '["Mariano Gomez, Jose Burgos, at Jacinto Zamora", "Pedro Pelaez, Jose Burgos, at Mariano Gomez", "Mariano Gomez, Jacinto Zamora, at Emilio Jacinto", "Jose Burgos, Antonio Luna, at Pedro Paterno"]'::jsonb,
    0,
    'Sina Padres Mariano Gomez, Jose Burgos, at Jacinto Zamora ay binitay sa pamamagitan ng garote dahil sa maling paratang ng sedisyon kaugnay ng Pag-aalsa sa Cavite noong 1872.',
    'Ang martiryo ng Gomburza ang nagbigay-sigla sa Kilusang Propaganda at naging dahilan kung bakit inialay ni Jose Rizal ang kanyang nobelang El Filibusterismo sa kanila.',
    '{"1": "Si Padre Pedro Pelaez ang unang tagapagtanggol ng sekularisasyon ng mga parokya bago siya nasawi noong 1863.", "2": "Si Emilio Jacinto ay heneral at manunulat ng Katipunan, hindi paring sekular.", "3": "Sina Antonio Luna at Pedro Paterno ay mga prominenteng lider sa panahon ng Digmaang Pilipino-Amerikano at Himagsikan."}'::jsonb,
    '["GOMBURZA", "Gomez", "Burgos", "Zamora", "garote 1872", "sekularisasyon"]'::jsonb,
    4
),
(
    'c0000000-0000-4000-8000-000000000006',
    'b0000000-0000-4000-8000-000000000001',
    '6. Anong kasunduan ang nilagdaan noong Disyembre 10, 1898 kung saan isinuko ng Espanya ang pamamahala sa Pilipinas sa Estados Unidos sa halagang $20 milyon?',
    'Kasunduan sa Paris (Treaty of Paris)',
    'multiple_choice',
    '["Kasunduan sa Paris (Treaty of Paris)", "Kasunduan sa Biak-na-Bato", "Kasunduang Bates", "Kasunduang Tordesillas"]'::jsonb,
    0,
    'Sa Kasunduan sa Paris (1898), opisyal na ipinasa ng Espanya ang teritoryo ng Pilipinas, Guam, at Puerto Rico sa Estados Unidos kapalit ng $20,000,000.',
    'Ang pagwawalang-bahala ng Amerika sa sariling deklarasyon ng kalayaan ng mga Pilipino ang nagbunsod sa pagsiklab ng Digmaang Pilipino-Amerikano noong Pebrero 1899.',
    '{"1": "Ang Kasunduan sa Biak-na-Bato (1897) ay paktong nilagdaan sa pagitan ng pamahalaang rebolusyonaryo at Espanya.", "2": "Ang Kasunduang Bates (1899) ay kasunduan ng Estados Unidos sa Sultan ng Sulu.", "3": "Ang Kasunduang Tordesillas (1494) ay paghahati ng mga bagong lupaing tutuklasin sa pagitan ng Espanya at Portugal."}'::jsonb,
    '["Kasunduan sa Paris", "Disyembre 10, 1898", "$20 milyon", "Digmaang Espanyol-Amerikano"]'::jsonb,
    5
),
(
    'c0000000-0000-4000-8000-000000000007',
    'b0000000-0000-4000-8000-000000000001',
    '7. Sino ang tinaguriang ''Bayani ng Pasong Tirad'' na nagbuwis ng buhay noong Disyembre 2, 1899 upang harangin ang mga sundalong Amerikano at makatakas si Pangulong Aguinaldo?',
    'Heneral Gregorio del Pilar',
    'multiple_choice',
    '["Heneral Gregorio del Pilar", "Heneral Antonio Luna", "Heneral Miguel Malvar", "Heneral Artemio Ricarte"]'::jsonb,
    0,
    'Si Heneral Gregorio del Pilar, sa gulang na 24, ang namuno sa 60 kawal na nagtanggol sa Tirad Pass laban sa 33rd Infantry Regiment ng Estados Unidos.',
    'Kinilala siya bilang pinakabatang heneral ng hukbong rebolusyonaryo na nagpakita ng sukdulang katapangan upang ipagtanggol ang liderato ng republika.',
    '{"1": "Si Heneral Antonio Luna ang punong heneral ng sandatahang lakas na pinaslang sa Cabanatuan noong Hunyo 1899.", "2": "Si Heneral Miguel Malvar ang isa sa mga huling heneral na sumuko sa mga Amerikano sa Batangas noong 1902.", "3": "Si Heneral Artemio Ricarte (''Vibora'') ay kilala sa hindi pagsuko o panunumpa sa bandila ng Amerika kailanman."}'::jsonb,
    '["Gregorio del Pilar", "Pasong Tirad", "Tirad Pass", "Disyembre 2, 1899"]'::jsonb,
    6
),
(
    'c0000000-0000-4000-8000-000000000008',
    'b0000000-0000-4000-8000-000000000001',
    '8. Sino ang kinikilalang ''Utak ng Katipunan'' na sumulat ng Kartilya ng Katipunan at naging pinagkakatiwalaang tagapayo ni Andres Bonifacio?',
    'Emilio Jacinto',
    'multiple_choice',
    '["Emilio Jacinto", "Apolinario Mabini", "Marcelo H. del Pilar", "Graciano Lopez Jaena"]'::jsonb,
    0,
    'Si Emilio Jacinto ang tinawag na ''Utak ng Katipunan'' at may-akda ng Kartilya na naging gabay sa moralidad at tungkulin ng bawat kasapi ng KKK.',
    'Samantalang si Emilio Jacinto ang ''Utak ng Katipunan'', si Apolinario Mabini naman ang kinilalang ''Utak ng Himagsikan'' at ''Dakilang Lumpo''.',
    '{"1": "Si Apolinario Mabini ang ''Utak ng Himagsikan'' at naging unang Punong Ministro ng pamahalaang rebolusyonaryo.", "2": "Si Marcelo H. del Pilar (Plaridel) ang patnugot ng La Solidaridad sa Espanya.", "3": "Si Graciano Lopez Jaena ang tagapagtatag ng La Solidaridad at kilalang orador ng kilusang reporma."}'::jsonb,
    '["Emilio Jacinto", "Utak ng Katipunan", "Kartilya", "Andres Bonifacio"]'::jsonb,
    7
),
(
    'c0000000-0000-4000-8000-000000000009',
    'b0000000-0000-4000-8000-000000000001',
    '9. Anong mapayapang rebolusyon noong Pebrero 22–25, 1986 ang nagwakas sa diktadurang rehimen at nagpanumbalik ng demokrasya sa Pilipinas?',
    'People Power Revolution (EDSA I)',
    'multiple_choice',
    '["People Power Revolution (EDSA I)", "First Quarter Storm", "EDSA Dos (People Power II)", "Sigaw ng Pugad Lawin"]'::jsonb,
    0,
    'Ang People Power Revolution sa EDSA noong Pebrero 1986 ay mapayapang demonstrasyon ng milyun-milyong Pilipino na nagpatalsik kay Ferdinand Marcos Sr. at nagluklok kay Corazon Aquino.',
    'Kinilala sa buong daigdig ang EDSA Revolution bilang inspirasyon ng mapayapang pagkilos gamit ang panalangin, bulaklak, at pagkakaisa laban sa awtoritaryanismo.',
    '{"1": "Ang First Quarter Storm noong 1970 ay serye ng malalaking protesta ng mga estudyante bago ang Batas Militar.", "2": "Ang EDSA Dos noong Enero 2001 ang nagpatalsik kay Pangulong Joseph Estrada.", "3": "Ang Sigaw ng Pugad Lawin ay naganap noong 1896 laban sa mga Kastila."}'::jsonb,
    '["People Power Revolution", "EDSA 1986", "Corazon Aquino", "Pebrero 22-25"]'::jsonb,
    8
),
(
    'c0000000-0000-4000-8000-000000000010',
    'b0000000-0000-4000-8000-000000000001',
    '10. Saang makasaysayang simbahan sa Bulacan pinagtibay ang Konstitusyon ng Malolos at pinasinayaan ang Unang Republika ng Pilipinas noong Enero 23, 1899?',
    'Simbahan ng Barasoain sa Malolos, Bulacan',
    'multiple_choice',
    '["Simbahan ng Barasoain sa Malolos, Bulacan", "Katedral ng Maynila sa Intramuros", "Simbahan ng San Agustin sa Intramuros", "Simbahan ng Paoay sa Ilocos Norte"]'::jsonb,
    0,
    'Ang Simbahan ng Barasoain sa Malolos, Bulacan ang naging luklukan ng Kongreso ng Malolos na bumalangkas sa kauna-unahang konstitusyong demokratiko sa buong Asya.',
    'Sa Simbahan ng Barasoain pormal na pinasinayaan ang Unang Republika ng Pilipinas kung saan nanumpa si Emilio Aguinaldo bilang unang Pangulo ng bansa.',
    '{"1": "Ang Katedral ng Maynila ay ang sentro ng Arkidiyosesis ng Maynila ngunit hindi dito itinatag ang unang republika.", "2": "Ang Simbahan ng San Agustin ang pinakamatandang simbahang bato kung saan nilagdaan ang pagsuko ng Espanya sa Amerika noong 1898.", "3": "Ang Simbahan ng Paoay ay kilalang UNESCO World Heritage Baroque church sa Ilocos Norte."}'::jsonb,
    '["Simbahan ng Barasoain", "Malolos, Bulacan", "Enero 23, 1899", "Unang Republika ng Pilipinas"]'::jsonb,
    9
)
ON CONFLICT (id) DO UPDATE SET
    question_text = EXCLUDED.question_text,
    answer_text = EXCLUDED.answer_text,
    question_type = EXCLUDED.question_type,
    options = EXCLUDED.options,
    correct_answer = EXCLUDED.correct_answer,
    explanation = EXCLUDED.explanation,
    correct_explanation = EXCLUDED.correct_explanation,
    distractor_explanations = EXCLUDED.distractor_explanations,
    discriminatory_keywords = EXCLUDED.discriminatory_keywords,
    order_index = EXCLUDED.order_index;