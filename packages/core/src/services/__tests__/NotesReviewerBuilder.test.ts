import { describe, expect, it } from 'vitest';
import { NotesReviewerBuilder } from '../NotesReviewerBuilder';

const notes = `IT Service Management (ITSM) - allows organizations to maximize business value using information
technology (IT).
ITSM - allows organizations to maximize business value using information technology (IT).

Intangibility - in that it is not a physical item. A service cannot be touched compared to a product that has a physical form.
Heterogeneity - in that it is difficult to standardize. It means that each time a service is delivered,
it will be different as the needs and behavior of customers can vary.

Benefits of ITSM:
Business Alignment: ITSM affords the IT team a more in-depth understanding of a business's requirements.

Service Desk:
Business-centric
Focuses on the business
Proactive Service
Allows to develop long-term solutions proactively
Complete Picture
Works to prevent incidents in the future
Process Oriented
Focuses on how the entire support process can be improved

Helpdesk:
User-centric
Focuses on the end-user
Reactive Service
Allows to respond to user issues reactively
Break-Fix Model
If something breaks, users contact the team to fix it
Task-Oriented
Focuses on providing the right solution to the user's need

ITSM History:
Mid-1980s:
ITIL was first created when the British government was not satisfied with the quality of IT services.
1989 – 1996:
The CCTA developed and published ITIL v1, containing more than 30 volumes.
2019:
ITIL v4 was released with more service management guidance and a focus on principles and concepts.`;

describe('NotesReviewerBuilder', () => {
  it('extracts wrapped definitions while ignoring headings and comparison labels as ordinary concepts', () => {
    const concepts = NotesReviewerBuilder.extractConcepts(notes);
    const terms = concepts.map((concept) => concept.term);

    expect(terms).toContain('IT Service Management (ITSM)');
    expect(terms).toContain('Intangibility');
    expect(terms).toContain('Heterogeneity');
    expect(terms).toContain('Business Alignment');
    expect(terms).not.toContain('Benefits of ITSM');
    expect(terms).not.toContain('Service Desk');
    expect(terms).not.toContain('Business-centric');
    expect(terms).not.toContain('Proactive Service');
    expect(concepts.find((concept) => concept.term === 'Heterogeneity')?.definition).toContain(
      'It means that each time a service is delivered, it will be different'
    );
  });

  it('deduplicates expanded terms and acronym-only terms', () => {
    const concepts = NotesReviewerBuilder.extractConcepts(notes);
    expect(concepts.filter((concept) => concept.term === 'IT Service Management (ITSM)')).toHaveLength(1);
    expect(concepts.some((concept) => concept.term === 'ITSM')).toBe(false);
  });

  it('keeps timeline entries separate from terminology concepts', () => {
    const timeline = NotesReviewerBuilder.extractTimelineEntries(notes);
    expect(timeline.map((entry) => entry.period)).toEqual(['Mid-1980s', '1989 – 1996', '2019']);
    expect(timeline[0].definition).toContain('British government');

    const questions = NotesReviewerBuilder.build({ text: notes });
    const timelineQuestions = questions.filter((question) => question.concept_tags?.includes('timeline'));
    expect(timelineQuestions).toHaveLength(3);
    expect(questions.find((question) => question.answer_text === 'Mid-1980s')).toBeUndefined();
  });

  it('keeps one identification plus at most one reinforcement question per concept', () => {
    const questions = NotesReviewerBuilder.build({ text: notes });
    const conceptQuestions = questions.filter((question) => question.concept_tags?.some((tag) => tag.startsWith('concept:')));
    const counts = new Map<string, number>();

    for (const question of conceptQuestions) {
      const tag = question.concept_tags?.find((value) => value.startsWith('concept:'));
      if (tag) counts.set(tag, (counts.get(tag) || 0) + 1);
    }

    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
    expect(conceptQuestions.some((question) => question.question_type === 'typed_answer')).toBe(true);
    expect(conceptQuestions.some((question) => question.question_type === 'multiple_choice')).toBe(true);
  });

  it('uses comparison labels without creating standalone label cards', () => {
    const questions = NotesReviewerBuilder.build({ text: notes });
    const comparisonQuestions = questions.filter((question) => question.concept_tags?.includes('comparison'));

    expect(comparisonQuestions.length).toBeGreaterThan(0);
    expect(comparisonQuestions.some((question) => question.options?.includes('Business-centric'))).toBe(true);
    expect(questions.filter((question) => !question.concept_tags?.includes('comparison') && question.answer_text === 'Business-centric')).toHaveLength(0);
  });

  it('preserves the source definition as the explanation', () => {
    const questions = NotesReviewerBuilder.build({ text: notes });
    const card = questions.find((question) => question.answer_text === 'Intangibility');

    expect(card?.explanation).toBe(card?.correct_explanation);
    expect(card?.explanation).toContain('A service cannot be touched compared to a product');
  });
});

const pastedItsmNotes = `IT Service Management (ITSM) - allows organizations to maximize business value using information
technology (IT).

Intangibility - in that it is not a physical item. A service cannot be touched compared to a product that has a physical form, such as a car, a dress, or food. In contrast, a service, such as a theater performance, a dental appointment, or financial advice, cannot be touched as such.

Heterogeneity - in that it is difficult to standardize. It means that each time a service is delivered,
it will be different as the needs and behavior of customers can vary. No matter how well the
service is designed and advertised, customers may still request a service beyond what is
presented.

Inseparability - in that the production and consumption of services are simultaneous. The service
provider is often physically present when a customer consumes it.

Perishable - in that that it cannot be stored. It means that services have a limited “shelf life.”

Information Technology Infrastructure Library (ITIL) - international standards for ITSM set up requirements and good practices for the management system.

Benefits of ITSM:

Business Alignment: ITSM affords the IT team a more in-depth and precise understanding of a business's requirements. This ensures everyone is on the same page and working toward the same goals.

Increased Productivity: Effective ITSM and accounted roles and associated responsibilities lead to increased productivity within the IT team.

Satisfied End-users: ITSM results in greater end-user satisfaction, contributing to the overall business success as it ensures end-users receive the best service with reasonable expectations.

Improved Problem-solving: ITSM lessens the time between incident identification and solution implementation as it gives access to detailed analytics.

Compliance: ITSM ensures that the organization is satisfying and meeting all the relevant regulatory requirements that an organization must possess.

ITSM History:

Mid-1980s:
ITIL was first created when the British government was not satisfied with the quality and strategic benefit of the IT services they provided.

1989 – 1996:
The CCTA developed and published ITIL v1, containing more than 30 volumes.

2000 – 2001:
ITIL v2 was released to make the framework more accessible and usable for IT professionals.

2006:
Additional glossary was published for ITIL v2.

2007:
ITIL v3 is released as the current version of the ITIL framework, widely known as ITIL 2007 Edition.

2011:
ITIL v3 was revised with ITIL 2011 to resolve errors and inconsistencies in the text and graphics.

2019:
ITIL v4 was released, which builds on the detailed process guidance offered in ITIL v3 and has less information about ITIL processes and offers more service management guidance with an additional focus on service management principles and concepts than processes.
It also highlights a comprehensive approach to ITSM through the seven (7) guiding principles.

ITSM Tools and Software

Service Desks - are communication centers that provide a single point of contact between a business/organization and its customers/employees.

Helpdesks - designed for companies to resolve customer issues through automated complaint resolution practices such as a business’ ticket management processes.

Service Desk:

Business-centric
Focuses on the business
Proactive Service
Allows to develop long-term solutions proactively
The Complete Picture
Works to prevent incidents in the future
Process Oriented
Focuses on how the entire support process can be improved

Helpdesk:

User-centric
Focuses on the end-user
Reactive Service
Allows to respond to user issues reactively
Break-Fix Model
If something breaks, users contact the team to fix it
Task-Oriented
Focuses on providing the right solution to the user’s need

Requirements for Choosing ITSM Tools

Understanding the Team’s Goals and Needs: This deals with answering the users' expectations, what support experiences to offer employees and customers, and what features the organization needs and can live without.

Testing the Interface: The tool must be simple and easy to use as the time it would take for the team to adjust to the tool can raise a new challenge.

Focusing on Scalability: Contact the tool vendor and ask if the tool can manage an increase in support cases over time.

Exploring the Reporting Features: Timely reports using report and analytics features can help measure employee performance, user satisfaction, and team productivity.

Checking the Vendor’s Reliability and Support: With the right vendor, the organization can stay assured that they are ready to resolve any issues that affect the users at the earliest.

ITSM Software

SolarWinds Service Desk - a cloud-based ITSM software with features including change management tracking to self-generating knowledge bases.

SolarWinds Web Help Desk - is slightly more minimalistic but gives access to powerful helpdesk ticketing functionalities.

Zabbix - a popular IT server monitoring tool, is open source and freely available, fitting it for configuration change management.

Jira Service Desk - a cloud-based ITSM solution by Atlassian best known for its efficient selfservice feature.

Zendesk Suite - has a cloud-based helpdesk management solution with customizable tools to build a customer service portal, a knowledge base, and online communities.`;

describe('NotesReviewerBuilder with pasted rich-text note paragraphs', () => {
  it('keeps each ITSM concept, section, comparison, and timeline entry bounded', () => {
    const concepts = NotesReviewerBuilder.extractConcepts(pastedItsmNotes);
    const terms = concepts.map((concept) => concept.term);

    expect(concepts).toHaveLength(23);
    expect(terms).toEqual(expect.arrayContaining([
      'IT Service Management (ITSM)',
      'Intangibility',
      'Heterogeneity',
      'Inseparability',
      'Perishable',
      'Information Technology Infrastructure Library (ITIL)',
      'Business Alignment',
      'Increased Productivity',
      'Satisfied End-users',
      'Improved Problem-solving',
      'Compliance',
      'Service Desks',
      'Helpdesks',
      'Understanding the Team’s Goals and Needs',
      'Testing the Interface',
      'Focusing on Scalability',
      'Exploring the Reporting Features',
      'Checking the Vendor’s Reliability and Support',
      'SolarWinds Service Desk',
      'SolarWinds Web Help Desk',
      'Zabbix',
      'Jira Service Desk',
      'Zendesk Suite'
    ]));
    expect(terms).not.toEqual(expect.arrayContaining([
      'Benefits of ITSM',
      'ITSM History',
      'ITSM Tools and Software',
      'Service Desk',
      'Helpdesk',
      'Business-centric',
      'User-centric'
    ]));

    const intangibility = concepts.find((concept) => concept.term === 'Intangibility');
    const heterogeneity = concepts.find((concept) => concept.term === 'Heterogeneity');
    expect(intangibility?.definition).toContain('A service cannot be touched');
    expect(intangibility?.definition).not.toContain('Heterogeneity');
    expect(heterogeneity?.definition).toContain('No matter how well the service is designed');
    expect(heterogeneity?.definition).not.toContain('Inseparability');
  });

  it('keeps all history markers as separate timeline cards', () => {
    const timeline = NotesReviewerBuilder.extractTimelineEntries(pastedItsmNotes);

    expect(timeline.map((entry) => entry.period)).toEqual([
      'Mid-1980s',
      '1989 – 1996',
      '2000 – 2001',
      '2006',
      '2007',
      '2011',
      '2019'
    ]);
    expect(timeline).toHaveLength(7);
    expect(timeline.find((entry) => entry.period === '1989 – 1996')?.definition).toContain('CCTA developed');
    expect(timeline.find((entry) => entry.period === '1989 – 1996')?.definition).not.toContain('2000');
    expect(timeline.find((entry) => entry.period === '2019')?.definition).toContain('seven (7) guiding principles');
  });

  it('creates the expected terminology, comparison, and timeline coverage', () => {
    const questions = NotesReviewerBuilder.build({ text: pastedItsmNotes });
    const comparisonQuestions = questions.filter((question) => question.concept_tags?.includes('comparison'));
    const timelineQuestions = questions.filter((question) => question.concept_tags?.includes('timeline'));

    expect(questions).toHaveLength(55);
    expect(comparisonQuestions).toHaveLength(2);
    expect(timelineQuestions).toHaveLength(7);
    expect(questions.filter((question) => question.answer_text === 'Service Desk')).toHaveLength(0);
    expect(questions.filter((question) => !question.concept_tags?.includes('comparison') && question.answer_text === 'Business-centric')).toHaveLength(0);
  });
});


describe('NotesReviewerBuilder term answers', () => {
  it('uses complete term labels instead of definition sentences in reinforcement choices', () => {
    const questions = NotesReviewerBuilder.build({ text: pastedItsmNotes });
    const reinforcementQuestions = questions.filter((question) => question.concept_tags?.includes('reinforcement'));

    expect(reinforcementQuestions.length).toBeGreaterThan(0);
    for (const question of reinforcementQuestions) {
      const correctIndex = question.correct_answer ?? -1;
      expect(question.answer_text).toBe(question.options?.[correctIndex]);
      expect(question.options?.every((option) => !/[.!?]/.test(option))).toBe(true);
      expect(question.options?.every((option) => option.length <= 100)).toBe(true);
    }

    const intangibility = reinforcementQuestions.find((question) => question.answer_text === 'Intangibility');
    expect(intangibility?.options).toContain('Intangibility');
    expect(intangibility?.options).not.toContain(expect.stringContaining('in that it is not a physical item'));
    expect(intangibility?.explanation).toContain('in that it is not a physical item');
  });

  it('rejects sentence-like labels while retaining complete multi-word terms', () => {
    const text = `This service is difficult to standardize - a definition that should not become an answer.
Understanding the Team’s Goals and Needs: This deals with answering the users' expectations and support needs.`;
    const concepts = NotesReviewerBuilder.extractConcepts(text);

    expect(concepts.map((concept) => concept.term)).toEqual(['Understanding the Team’s Goals and Needs']);
    expect(concepts[0].term).toBe('Understanding the Team’s Goals and Needs');
    expect(concepts[0].definition).toContain('answering the users');
  });
});
