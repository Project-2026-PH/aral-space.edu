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
});
