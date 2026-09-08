import { describe, it, expect } from 'vitest';
import { parseSmartClipboard } from '../clipboardParser';

describe('parseSmartClipboard', () => {
  describe('Single Pair Detection', () => {
    it('parses TSV (spreadsheet row) into single_pair', () => {
      const raw = 'RAM\tRandom Access Memory';
      const res = parseSmartClipboard(raw);
      expect(res).toEqual({
        type: 'single_pair',
        term: 'RAM',
        definition: 'Random Access Memory'
      });
    });

    it('parses colon separated key-value', () => {
      const raw = 'Mitochondria: The powerhouse of the cell.';
      const res = parseSmartClipboard(raw);
      expect(res).toEqual({
        type: 'single_pair',
        term: 'Mitochondria',
        definition: 'The powerhouse of the cell.'
      });
    });

    it('parses hyphen delimited pair with surrounding whitespace', () => {
      const raw = 'API - Application Programming Interface';
      const res = parseSmartClipboard(raw);
      expect(res).toEqual({
        type: 'single_pair',
        term: 'API',
        definition: 'Application Programming Interface'
      });
    });

    it('parses en-dash and em-dash delimiters', () => {
      const enDash = 'HTTP – Hypertext Transfer Protocol';
      expect(parseSmartClipboard(enDash)).toEqual({
        type: 'single_pair',
        term: 'HTTP',
        definition: 'Hypertext Transfer Protocol'
      });

      const emDash = 'DNS — Domain Name System';
      expect(parseSmartClipboard(emDash)).toEqual({
        type: 'single_pair',
        term: 'DNS',
        definition: 'Domain Name System'
      });
    });

    it('parses equals sign delimiter', () => {
      const raw = 'CPU = Central Processing Unit';
      const res = parseSmartClipboard(raw);
      expect(res).toEqual({
        type: 'single_pair',
        term: 'CPU',
        definition: 'Central Processing Unit'
      });
    });

    it('parses two-line break as term and definition', () => {
      const raw = 'Polymorphism\nThe ability of a message to be displayed in more than one form.';
      const res = parseSmartClipboard(raw);
      expect(res).toEqual({
        type: 'single_pair',
        term: 'Polymorphism',
        definition: 'The ability of a message to be displayed in more than one form.'
      });
    });
  });

  describe('Bulk Term / Definition List', () => {
    it('parses bulleted list preserving hyphenated terms and multi-sentence definitions', () => {
      const raw = `
• Rogue AP Attack: APs connect to client NICs by authenticating unauthorized beacons. This allows man-in-the-middle exploits.
• Client Mis-Association: Mis-association is a security flaw where clients accidentally connect to neighboring APs.
• Misconfigured AP Attack: Most organizations spend resources on perimeter firewalls but leave default credentials on access points.
      `;
      const res = parseSmartClipboard(raw);
      expect(res?.type).toBe('bulk_terms');
      if (res?.type === 'bulk_terms') {
        expect(res.items.length).toBe(3);
        expect(res.items[0].term).toBe('Rogue AP Attack');
        expect(res.items[0].definition).toContain('APs connect to client NICs');
        expect(res.items[1].term).toBe('Client Mis-Association');
        expect(res.items[1].definition).toContain('security flaw');
        expect(res.items[2].term).toBe('Misconfigured AP Attack');
      }
    });

    it('keeps multi-line wrapped definitions intact (PDF paste)', () => {
      const raw = `Invasion of Privacy: With technology as an enabler for easier data gathering, it can still   
be misused by third parties with malicious motives. Massive data storage capabilities in a   
cloud put the users' personal information at risk of being searched and exposed.   
It is best to use gathered user information based on the agreed terms and conditions and   
not sell the information to third parties that could access their financial transactions.  
• Data Security: An organization's responsible for taking the best care and having the best   
intention for their user's information.  
• Reliability: There are instances that information from users cannot be fully trusted as some   
do surveys and randomly click on any option available without any thought.  `;

      const res = parseSmartClipboard(raw);
      expect(res?.type).toBe('bulk_terms');
      if (res?.type === 'bulk_terms') {
        expect(res.items.map((i) => i.term)).toEqual([
          'Invasion of Privacy',
          'Data Security',
          'Reliability'
        ]);
        expect(res.items[0].definition).toContain('With technology as an enabler');
        expect(res.items[0].definition).toContain('It is best to use gathered user information');
        expect(res.items[0].definition).not.toContain('Data Security');
      }
    });

    it('splits en-dash delimited bulk lists instead of collapsing them into one pair', () => {
      const raw = `Strategy Management for IT Services – assesses the market and how the organization   

plans to service it.  

• Service Portfolio Management – the structured analysis of different services an organization wants to offer.
• Demand Management – it scales resources to demand.

• Business Relationship Management focuses on identifying customers and understanding their expectations.  `;

      const res = parseSmartClipboard(raw);
      expect(res?.type).toBe('bulk_terms');
      if (res?.type === 'bulk_terms') {
        expect(res.items.map((i) => i.term)).toEqual([
          'Strategy Management for IT Services',
          'Service Portfolio Management',
          'Demand Management',
          'Business Relationship Management'
        ]);
        expect(res.items[0].definition).toBe(
          'assesses the market and how the organization plans to service it.'
        );
      }
    });

    it('splits bullets that were collapsed onto a single line', () => {
      const raw =
        '• Alpha Term: the first definition here. • Beta Term: the second definition here.';
      const res = parseSmartClipboard(raw);
      expect(res?.type).toBe('bulk_terms');
      if (res?.type === 'bulk_terms') {
        expect(res.items.map((i) => i.term)).toEqual(['Alpha Term', 'Beta Term']);
      }
    });

    it('handles 50+ bulk items without truncation', () => {
      const items = Array.from({ length: 55 }, (_, i) => `• Term_${i}: This is the extensive definition text for item number ${i} which explains the concept in detail.`);
      const raw = items.join('\n');
      const res = parseSmartClipboard(raw);
      expect(res?.type).toBe('bulk_terms');
      if (res?.type === 'bulk_terms') {
        expect(res.items.length).toBe(55);
        expect(res.items[54].term).toBe('Term_54');
      }
    });
  });

  describe('Slide Enumeration Blocks', () => {
    it('parses category heading followed by bulleted items', () => {
      const raw = `
Best Practices for Configuration
  o Change the default SSID after WLAN configuration
  o Set the router access password and enable firewall protection
  o Disable SSID broadcasts

Best Practices for SSID Settings
  o Use SSID cloaking to keep default wireless messages hidden
  o Do not use the SSID, company name, or easy-to-guess string
      `;
      const res = parseSmartClipboard(raw);
      expect(res?.type).toBe('enumeration_blocks');
      if (res?.type === 'enumeration_blocks') {
        expect(res.blocks.length).toBe(2);
        expect(res.blocks[0].header).toBe('Best Practices for Configuration');
        expect(res.blocks[0].items).toEqual([
          'Change the default SSID after WLAN configuration',
          'Set the router access password and enable firewall protection',
          'Disable SSID broadcasts'
        ]);
        expect(res.blocks[1].header).toBe('Best Practices for SSID Settings');
        expect(res.blocks[1].items.length).toBe(2);
      }
    });

    it('supports numeric and dash bullets in enumeration blocks', () => {
      const raw = `
Steps in Mitosis
1. Prophase
2. Metaphase
3. Anaphase
4. Telophase
      `;
      const res = parseSmartClipboard(raw);
      expect(res?.type).toBe('enumeration_blocks');
      if (res?.type === 'enumeration_blocks') {
        expect(res.blocks[0].header).toBe('Steps in Mitosis');
        expect(res.blocks[0].items).toEqual(['Prophase', 'Metaphase', 'Anaphase', 'Telophase']);
      }
    });
  });

  describe('Inline Appositive Compound Definitions', () => {
    it('parses natural language comma-separated compound terms and definitions', () => {
      const raw =
        'the marketplace, the physical world for people and things, and the marketspace, a virtual world of information.';
      const res = parseSmartClipboard(raw);
      expect(res).toEqual({
        type: 'bulk_terms',
        items: [
          {
            term: 'marketplace',
            definition: 'the physical world for people and things'
          },
          {
            term: 'marketspace',
            definition: 'a virtual world of information'
          }
        ]
      });
    });

    it('parses appositive clauses across a soft line wrap and without a trailing period', () => {
      const raw = `the marketplace, the physical world for people and things, 
and the marketspace, a virtual world of information`;
      expect(parseSmartClipboard(raw)).toEqual({
        type: 'bulk_terms',
        items: [
          { term: 'marketplace', definition: 'the physical world for people and things' },
          { term: 'marketspace', definition: 'a virtual world of information' }
        ]
      });
    });

    it('parses appositive clauses with no joiner and with 3+ items', () => {
      const noJoiner =
        'the marketplace, the physical world for people and things, the marketspace, a virtual world of information.';
      expect(parseSmartClipboard(noJoiner)).toEqual({
        type: 'bulk_terms',
        items: [
          { term: 'marketplace', definition: 'the physical world for people and things' },
          { term: 'marketspace', definition: 'a virtual world of information' }
        ]
      });

      const threeItems =
        'the marketplace, the physical world for people and things, the marketspace, a virtual world of information, and the metaverse, an immersive shared simulation.';
      const res = parseSmartClipboard(threeItems);
      expect(res?.type).toBe('bulk_terms');
      if (res?.type === 'bulk_terms') {
        expect(res.items.map((i) => i.term)).toEqual(['marketplace', 'marketspace', 'metaverse']);
        expect(res.items[2].definition).toBe('an immersive shared simulation');
      }
    });

    it('does not shred ordinary comma-heavy prose into pairs', () => {
      expect(
        parseSmartClipboard(
          'Cloud computing is scalable, elastic, and cheap, which is why startups adopt it early, often before hiring staff.'
        )
      ).toBeNull();
    });

    it('parses semicolon delimited appositive clauses', () => {
      const raw =
        'Front-end, the client-facing presentation layer; Back-end, the server-side logic and database operations.';
      const res = parseSmartClipboard(raw);
      expect(res).toEqual({
        type: 'bulk_terms',
        items: [
          {
            term: 'Front-end',
            definition: 'the client-facing presentation layer'
          },
          {
            term: 'Back-end',
            definition: 'the server-side logic and database operations'
          }
        ]
      });
    });
  });

  describe('Fallbacks & Edge Cases', () => {
    it('returns null for empty or whitespace text', () => {
      expect(parseSmartClipboard('')).toBeNull();
      expect(parseSmartClipboard('   \n  ')).toBeNull();
    });

    it('returns null for arbitrary single-line unstructured sentences', () => {
      expect(parseSmartClipboard('Just a random paragraph with no structure and no delimiter.')).toBeNull();
    });
  });

  describe('Bold Text Term Separation & Heuristic Mitigations', () => {
    it('parses markdown bold single pair with delimiter and soft line break', () => {
      const raw =
        '**Modeling** – deals with the mathematical specification of shape and\nappearance properties in a way that can be stored on the computer';
      const res = parseSmartClipboard(raw);
      expect(res).toEqual({
        type: 'single_pair',
        term: 'Modeling',
        definition:
          'deals with the mathematical specification of shape and appearance properties in a way that can be stored on the computer'
      });
    });

    it('parses markdown bold single pair WITHOUT delimiter', () => {
      const raw =
        '**Polymorphism** allows objects of different types to be treated through a unified interface.';
      const res = parseSmartClipboard(raw);
      expect(res).toEqual({
        type: 'single_pair',
        term: 'Polymorphism',
        definition:
          'allows objects of different types to be treated through a unified interface.'
      });
    });

    it('parses multiple markdown bold terms into bulk_terms', () => {
      const raw = `
        • **Modeling** deals with 3D object geometry and representation
        • **Rendering** generates 2D images from 3D scene descriptions
        • **Animation** handles movement and time-dependent changes
      `;
      const res = parseSmartClipboard(raw);
      expect(res).toEqual({
        type: 'bulk_terms',
        items: [
          {
            term: 'Modeling',
            definition: 'deals with 3D object geometry and representation'
          },
          {
            term: 'Rendering',
            definition: 'generates 2D images from 3D scene descriptions'
          },
          {
            term: 'Animation',
            definition: 'handles movement and time-dependent changes'
          }
        ]
      });
    });

    it('parses HTML bold single pair without explicit delimiter', () => {
      const html =
        '<p><strong>Modeling</strong> deals with the mathematical specification of shape and appearance properties in a way that can be stored on the computer</p>';
      const raw =
        'Modeling deals with the mathematical specification of shape and appearance properties in a way that can be stored on the computer';
      const res = parseSmartClipboard(raw, html);
      expect(res).toEqual({
        type: 'single_pair',
        term: 'Modeling',
        definition:
          'deals with the mathematical specification of shape and appearance properties in a way that can be stored on the computer'
      });
    });

    it('parses HTML bold bullet list from web or LMS paste', () => {
      const html = `
        <ul>
          <li><b>RAM</b> Random Access Memory used for short-term data</li>
          <li><b>ROM</b> Read Only Memory containing permanent boot instructions</li>
        </ul>
      `;
      const res = parseSmartClipboard('', html);
      expect(res).toEqual({
        type: 'bulk_terms',
        items: [
          {
            term: 'RAM',
            definition: 'Random Access Memory used for short-term data'
          },
          {
            term: 'ROM',
            definition: 'Read Only Memory containing permanent boot instructions'
          }
        ]
      });
    });

    it('glues fragmented adjacent bold spans (Word/Docs clipboard format)', () => {
      const html =
        '<p><span style="font-weight:700">Mod</span><span style="font-weight:bold">eling</span> – deals with the mathematical specification of shape and appearance properties</p>';
      const res = parseSmartClipboard('', html);
      expect(res).toEqual({
        type: 'single_pair',
        term: 'Modeling',
        definition:
          'deals with the mathematical specification of shape and appearance properties'
      });
    });

    it('mitigation: rejects inline emphasis mid-sentence as terms', () => {
      const raw = 'The convergence guarantee is **strictly** dependent on the learning rate parameter.';
      expect(parseSmartClipboard(raw)).toBeNull();
    });

    it('mitigation: rejects editorial meta labels (Note:, Warning:, Chapter 1)', () => {
      const note = '**Note:** Please do not forget to bring a calculator to the exam room.';
      expect(parseSmartClipboard(note)).toBeNull();

      const warning = '**Warning:** High voltage equipment inside the server rack.';
      expect(parseSmartClipboard(warning)).toBeNull();

      const chapter = '**Chapter 1:** Introduction to Linear Transformations and Vectors.';
      expect(parseSmartClipboard(chapter)).toBeNull();
    });

    it('mitigation: rejects whole-sentence bold headings and announcements', () => {
      const sentence =
        '**All students must submit their laboratory reports through the portal before midnight.**';
      expect(parseSmartClipboard(sentence)).toBeNull();
    });

    it('parses user specific paste format with delimiter correctly', () => {
      const raw =
        'Modeling – deals with the mathematical specification of shape and\nappearance properties in a way that can be stored on the computer';
      const res = parseSmartClipboard(raw);
      expect(res).toEqual({
        type: 'single_pair',
        term: 'Modeling',
        definition:
          'deals with the mathematical specification of shape and appearance properties in a way that can be stored on the computer'
      });
    });
  });

  describe('Natural Definition Verb Splitting (Delimiter-Free PDF Text)', () => {
    it('parses unstyled PDF sentence using "describes" into term and definition', () => {
      const pdfText =
        'computer graphics describes the use of computers to create and manipulate images';
      const res = parseSmartClipboard(pdfText);
      expect(res).toEqual({
        type: 'single_pair',
        term: 'computer graphics',
        definition: 'Describes the use of computers to create and manipulate images'
      });
    });

    it('parses unstyled PDF text with "deals with" and soft line break', () => {
      const pdfText =
        'Modeling deals with the mathematical specification of shape and\nappearance properties in a way that can be stored on the computer';
      const res = parseSmartClipboard(pdfText);
      expect(res).toEqual({
        type: 'single_pair',
        term: 'Modeling',
        definition:
          'Deals with the mathematical specification of shape and appearance properties in a way that can be stored on the computer'
      });
    });

    it('strips leading article from term in definition verb sentences', () => {
      const pdfText =
        'The compiler refers to a specialized program that translates source code into machine language';
      const res = parseSmartClipboard(pdfText);
      expect(res).toEqual({
        type: 'single_pair',
        term: 'compiler',
        definition:
          'Refers to a specialized program that translates source code into machine language'
      });
    });

    it('parses bulleted list of definition verb items without colons or dashes', () => {
      const raw = `
        • computer graphics describes the use of computers to create and manipulate images
        • image processing involves algorithms for enhancing and analyzing digital images
      `;
      const res = parseSmartClipboard(raw);
      expect(res).toEqual({
        type: 'bulk_terms',
        items: [
          {
            term: 'computer graphics',
            definition: 'Describes the use of computers to create and manipulate images'
          },
          {
            term: 'image processing',
            definition: 'Involves algorithms for enhancing and analyzing digital images'
          }
        ]
      });
    });

    it('guardrail: rejects prose sentences starting with pronouns or question words', () => {
      expect(parseSmartClipboard('This describes the experimental findings from yesterday.')).toBeNull();
      expect(parseSmartClipboard('What describes the exact state of this system?')).toBeNull();
      expect(parseSmartClipboard('I think that this framework deals with latency issues.')).toBeNull();
    });
  });
});
