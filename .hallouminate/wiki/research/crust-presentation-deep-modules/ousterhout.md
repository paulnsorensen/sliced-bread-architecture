# APOSD — how a deep module's interface should be presented (cited notes)

Sources are secondary summaries (no access to the book PDF itself); quotes below are as
transcribed by the summarizers, verified via tavily_extract where marked [extracted].
Two primary-adjacent sources used: John Ousterhout's own talks (YouTube transcripts,
Talks at Google) and Derek Sivers' close-paraphrase notes (sive.rs), which read as
near-verbatim book excerpts. No source found addressing ORDERING/GROUPING of interface
elements within a module (see Open Questions).

## Ch.4 — Deep modules, interface cost/benefit

- "The best modules are deep: they have a lot of functionality hidden behind a simple
  interface... Cost is its interface. Interface = the complexity that the module
  imposes on the rest of the system." — sive.rs/book/PoSD [extracted]
- "The formal interface for a method includes the names and types of its parameters,
  the type of its return value, information about exceptions thrown by the method. The
  informal parts of an interface include its high-level behavior. If a developer needs
  to know it, then that information is part of the module's interface." —
  sive.rs/book/PoSD [extracted]
- "The interface consists of everything that a developer working in a different module
  must know in order to use the given module. A developer should not need to understand
  the implementations of other modules." — sive.rs/book/PoSD [extracted]
- Unix I/O (open/read/write/seek/close) is the canonical deep-module example: few
  system calls, huge hidden complexity (files, directories, permissions, concurrency).
  — mattduck.com/2021-04-a-philosophy-of-software-design [extracted]
- "It is more important for a module to have a simple interface than a simple
  implementation" / "developers should suffer so users don't" — sive.rs paraphrase.

## Red flags relevant to wide export surfaces

- Red Flag: Shallow Module — "interface is complicated relative to the functionality
  it provides." — sive.rs [extracted]
- Red Flag: Information Leakage — same design decision/knowledge used in multiple
  modules; implementation details leaking into other modules' dependencies; exposing
  internal data structures. — bagerbach.com/books/a-philosophy-of-software-design;
  binaryphile.com/2026/01/09/ousterhout-software-design-guide
- Red Flag: Conjoined Methods (book ch. 9.8 per one secondary source) — "can't
  understand one without understanding the other" / methods split too small lose
  independence and must be read together. — sportebois.medium.com; stefirosca.netlify.app
  ("If functions are made too small, they lose their independence, resulting in
  conjoined functions that must be read and understood together. First make functions
  deep, then try to make them short enough to be easily read. Don't sacrifice depth
  for length.")
- Red Flag: Temporal Decomposition — structuring by execution order rather than by
  information/knowledge, which causes information leakage (e.g., splitting
  read-file/modify/write-file into separate classes when read+write both need to know
  the file format). — bagerbach.com; lethain.com/notes-philosophy-software-design
- Red Flag: Overexposure — API design that forces callers to learn rarely-used
  features/parts of the interface just to use the common case. — binaryphile.com
  (secondary characterization; not independently verified against primary text)
- Red Flag: Pass-through methods — a method that does little but invoke another
  method with a similar signature; adds interface complexity without adding system
  functionality; often a symptom of unclear division of responsibility between
  classes/modules. Dispatcher methods are an explicit exception (useful
  pass-through). Decorators often reduce to shallow pass-through boilerplate. —
  mattduck.com [extracted]
- Pass-through variables — variables threaded through intermediate methods that don't
  use them, forcing those methods to be aware of state irrelevant to them; adds
  complexity. — mattduck.com [extracted]
- No source found stating "number of things a caller must read" as an explicit named
  red flag or metric; the closest formalization is the cost-of-interface framing above
  (formal + informal interface = everything a caller must learn) plus "Overexposure."

## Comments as interface (ch. 13, ch. 15) — presentation, not ordering

- Types of comments Ousterhout distinguishes: (1) Interface comments — attached to
  declaration of class/data-structure/function/method; describe overall behavior,
  args, return values, side effects, exceptions, caller obligations; also fill in
  missing details (units, null-handling, boundary inclusivity). (2) Data-structure
  member comments. (3) Implementation comments (how). (4) Cross-module comments
  (dependencies crossing module boundaries). — mattduck.com [extracted]
- From Talks-at-Google-style interview transcript: "I think where comments are most
  important is for interfaces... it is impossible in the functional signatures of a
  module to provide all the information people need to use that module. So that's
  where comments are most important." Second priority: documenting member variables
  of classes ("needs really extensive documentation"). Inside method bodies, comments
  are least necessary if the method's purpose is clear. — YouTube "The Philosophy of
  Software Design – with John Ousterhout," youtube.com/watch?v=lz451zUlF-k
- Ch. 15 "Write the comments first" — interface comments should be written before the
  implementation, as a design tool: writing the interface comment forces the author to
  think through the abstraction; "If the interface comment is hard to write, the
  interface is probably too complex" (paraphrase attributed to Ousterhout by
  binaryphile.com guide — not independently verified against primary text, treat as
  speculating).
- No claim found, in any source searched, about ordering interface members (e.g.
  "primary operations first"), grouping operations vs. supporting types, or a
  docstring/comment table-of-contents convention. This appears to be absent from
  APOSD's stated content, or at least not covered by any of the secondary sources,
  talk transcripts, or excerpts retrieved.

## General-purpose interfaces (ch. 6) and count-vs-depth

- "General-purpose modules tend to be deeper... The author suggests an excellent
  compromise: Make the interface 'somewhat general-purpose' and the implemented
  functionality special-purpose." — smallstepsystems.com book review, ch.6 summary
- "This doesn't mean 'generalised' implementations that support extra features you
  don't need — it means writing methods that are not overly specialised. The sweet
  spot is a somewhat general-purpose approach, which hopefully provides a simpler and
  deeper interface." — mattduck.com [extracted]
- Direct quote (per mattduck.com, presented as a book quote): "If you reduce the
  number of methods in an API without reducing its overall capabilities, then you are
  probably creating more general-purpose methods." — mattduck.com [extracted]
- Text-editor example: view class had three special-purpose delete methods; model
  class should expose one general-purpose `delete(start, end)`; the general interface
  "is deeper and will not change" as new callers appear. — smallstepsystems.com
- "In general, the lower layers of a system tend to be more general-purpose and the
  upper layers more special-purpose." — smallstepsystems.com, attributed to ch.6/7
- Depth is explicitly framed as functionality-hidden-per-unit-of-interface-cost, not
  raw member count — but fewer methods for the same capability is offered as one
  _symptom_ of increased generality/depth, not the definition of depth itself. Sivers'
  notes and mattduck's notes both keep the definition as the cost/benefit ratio
  (interface complexity vs. functionality), never as "count of exported names."
- Interview transcript, Ousterhout on SRP vs. depth: single-responsibility/"do one
  thing" is criticized as pushing in one direction "without any bounds," whereas the
  depth notion (bounded by "needs to have a relatively simple interface") keeps design
  from going too far in either direction (too many tiny shallow pieces, or one
  god-object). — youtube.com/watch?v=lz451zUlF-k

## Sources consulted (URLs)

- <https://sive.rs/book/PoSD> (Derek Sivers' close paraphrase/notes)
- <https://www.mattduck.com/2021-04-a-philosophy-of-software-design>
- <https://www.binaryphile.com/2026/01/09/ousterhout-software-design-guide.html> (secondary; unverified against primary text, several quotes may be guide-author paraphrase attributed to Ousterhout)
- <https://www.smallstepsystems.com/book-review-a-philosophy-of-software-design-by-john-ousterhout>
- <https://bagerbach.com/books/a-philosophy-of-software-design>
- <https://lethain.com/notes-philosophy-software-design>
- <https://sportebois.medium.com/software-design-red-flags-wisdom-nuggets-from-john-ousterhout-8a9b0045e2bb>
- <https://stefirosca.netlify.app/blog/a-philosophy-of-software-design>
- <https://www.youtube.com/watch?v=lz451zUlF-k> ("The Philosophy of Software Design – with John Ousterhout" interview)
- <https://lobehub.com/skills/rmarquis-claude-plugins-ousterhout-design-principles> (secondary/derived rules, lowest confidence)
