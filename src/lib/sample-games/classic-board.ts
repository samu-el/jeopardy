import type { ArchivedEpisodeInput } from "@/lib/data";

export const classicSampleEpisode: ArchivedEpisodeInput = {
  episodeNumber: "S-100",
  airDate: "2026-05-16",
  info: "Mixed categories",
  title: "Studio Showdown",
  jeopardy: [
    // Category 1: SCIENCE
    { x: 1, y: 1, cat: "Science", val: 200, q: "This planet has the largest volcano in the solar system, Olympus Mons.", a: "Mars" },
    { x: 1, y: 2, cat: "Science", val: 400, q: "This subatomic particle has no electric charge and resides in the nucleus.", a: "neutron" },
    { x: 1, y: 3, cat: "Science", val: 600, q: "Water boils at 100° on this temperature scale.", a: "Celsius" },
    { x: 1, y: 4, cat: "Science", val: 800, q: "DNA's double-helix structure was famously described in this year of the 20th century.", a: "1953" },
    { x: 1, y: 5, cat: "Science", val: 1000, q: "This is the chemical symbol for tungsten.", a: "W" },
    // Category 2: WORLD CAPITALS
    { x: 2, y: 1, cat: "World Capitals", val: 200, q: "The capital of France.", a: "Paris" },
    { x: 2, y: 2, cat: "World Capitals", val: 400, q: "Capital of Japan and the world's most populous metropolitan area.", a: "Tokyo" },
    { x: 2, y: 3, cat: "World Capitals", val: 600, q: "The capital of Canada (not Toronto).", a: "Ottawa" },
    { x: 2, y: 4, cat: "World Capitals", val: 800, q: "This South American capital sits at over 2,800 m of elevation in the Andes.", a: "Bogota" },
    { x: 2, y: 5, cat: "World Capitals", val: 1000, q: "The capital of Mongolia.", a: "Ulaanbaatar" },
    // Category 3: ALGORITHMS
    { x: 3, y: 1, cat: "Algorithms", val: 200, q: "This sort repeatedly swaps adjacent out-of-order pairs.", a: "bubble sort" },
    { x: 3, y: 2, cat: "Algorithms", val: 400, q: "Big-O notation for binary search on a sorted array.", a: "O(log n)" },
    { x: 3, y: 3, cat: "Algorithms", val: 600, q: "Greedy shortest-path algorithm credited to this Dutch computer scientist.", a: "Dijkstra" },
    { x: 3, y: 4, cat: "Algorithms", val: 800, q: "This divide-and-conquer sort is named for its key partition step.", a: "quicksort", dd: true },
    { x: 3, y: 5, cat: "Algorithms", val: 1000, q: "The classic technique for solving overlapping subproblems by caching results.", a: "dynamic programming" },
    // Category 4: SHAKESPEARE
    { x: 4, y: 1, cat: "Shakespeare", val: 200, q: "The Danish prince of Elsinore.", a: "Hamlet" },
    { x: 4, y: 2, cat: "Shakespeare", val: 400, q: "Star-crossed lovers from Verona.", a: "Romeo and Juliet" },
    { x: 4, y: 3, cat: "Shakespeare", val: 600, q: "He says 'Et tu, Brute?' before dying.", a: "Julius Caesar" },
    { x: 4, y: 4, cat: "Shakespeare", val: 800, q: "Magical isle setting of The Tempest's exiled duke.", a: "Prospero's island" },
    { x: 4, y: 5, cat: "Shakespeare", val: 1000, q: "Shakespeare's longest play.", a: "Hamlet" },
    // Category 5: MUSIC
    { x: 5, y: 1, cat: "Music", val: 200, q: "Number of strings on a standard guitar.", a: "six" },
    { x: 5, y: 2, cat: "Music", val: 400, q: "Composer of The Four Seasons.", a: "Vivaldi" },
    { x: 5, y: 3, cat: "Music", val: 600, q: "Genre that emerged in 1970s New York with DJs like Kool Herc.", a: "hip hop" },
    { x: 5, y: 4, cat: "Music", val: 800, q: "Italian word meaning 'gradually getting louder'.", a: "crescendo" },
    { x: 5, y: 5, cat: "Music", val: 1000, q: "This Norwegian composer wrote Peer Gynt.", a: "Edvard Grieg" },
    // Category 6: TECH HISTORY
    { x: 6, y: 1, cat: "Tech History", val: 200, q: "Two-letter abbreviation for the network of networks invented in the late 1960s.", a: "the Internet" },
    { x: 6, y: 2, cat: "Tech History", val: 400, q: "Steve and Steve who co-founded Apple in 1976.", a: "Jobs and Wozniak" },
    { x: 6, y: 3, cat: "Tech History", val: 600, q: "She wrote what is considered the first algorithm meant for a machine.", a: "Ada Lovelace" },
    { x: 6, y: 4, cat: "Tech History", val: 800, q: "Operating system kernel Linus Torvalds released in 1991.", a: "Linux" },
    { x: 6, y: 5, cat: "Tech History", val: 1000, q: "ARPANET's first message in 1969 was meant to read this 5-letter word.", a: "LOGIN" },
  ],
  double: [
    { x: 1, y: 1, cat: "Geography", val: 400, q: "World's longest river.", a: "the Nile" },
    { x: 1, y: 2, cat: "Geography", val: 800, q: "This sea separates Saudi Arabia from Egypt.", a: "the Red Sea" },
    { x: 1, y: 3, cat: "Geography", val: 1200, q: "Highest mountain entirely within Europe.", a: "Mont Blanc" },
    { x: 1, y: 4, cat: "Geography", val: 1600, q: "The only U.S. state that borders just one other state.", a: "Maine" },
    { x: 1, y: 5, cat: "Geography", val: 2000, q: "African country whose capital is Lilongwe.", a: "Malawi" },
    { x: 2, y: 1, cat: "Literature", val: 400, q: "Author of 1984.", a: "George Orwell" },
    { x: 2, y: 2, cat: "Literature", val: 800, q: "Tolkien language used by elves in Middle-earth.", a: "Quenya" },
    { x: 2, y: 3, cat: "Literature", val: 1200, q: "Russian author of Crime and Punishment.", a: "Dostoevsky", dd: true },
    { x: 2, y: 4, cat: "Literature", val: 1600, q: "Nigerian author of Things Fall Apart.", a: "Chinua Achebe" },
    { x: 2, y: 5, cat: "Literature", val: 2000, q: "Year Pride and Prejudice was first published.", a: "1813" },
    { x: 3, y: 1, cat: "Modern Web", val: 400, q: "JavaScript runtime built on Chrome's V8.", a: "Node.js" },
    { x: 3, y: 2, cat: "Modern Web", val: 800, q: "Vercel's React framework.", a: "Next.js" },
    { x: 3, y: 3, cat: "Modern Web", val: 1200, q: "CSS strategy that scopes styles by writing them as utility classes.", a: "Tailwind" },
    { x: 3, y: 4, cat: "Modern Web", val: 1600, q: "Protocol behind real-time bidirectional browser connections.", a: "WebSocket" },
    { x: 3, y: 5, cat: "Modern Web", val: 2000, q: "Browser API for offline-capable web apps via background scripts.", a: "Service Workers" },
    { x: 4, y: 1, cat: "Cinema", val: 400, q: "Director of Jurassic Park.", a: "Spielberg" },
    { x: 4, y: 2, cat: "Cinema", val: 800, q: "Pixar's debut feature film.", a: "Toy Story" },
    { x: 4, y: 3, cat: "Cinema", val: 1200, q: "Nolan film built around dream layers.", a: "Inception" },
    { x: 4, y: 4, cat: "Cinema", val: 1600, q: "Japanese director of Spirited Away.", a: "Miyazaki" },
    { x: 4, y: 5, cat: "Cinema", val: 2000, q: "She was the first woman to win Best Director at the Oscars.", a: "Kathryn Bigelow" },
    { x: 5, y: 1, cat: "Mathematics", val: 400, q: "Sum of angles in a triangle in degrees.", a: "180" },
    { x: 5, y: 2, cat: "Mathematics", val: 800, q: "Greek letter denoting the circumference-to-diameter ratio.", a: "pi" },
    { x: 5, y: 3, cat: "Mathematics", val: 1200, q: "Function that is its own derivative.", a: "e^x" },
    { x: 5, y: 4, cat: "Mathematics", val: 1600, q: "Branch of math that proves theorems about whole numbers.", a: "number theory" },
    { x: 5, y: 5, cat: "Mathematics", val: 2000, q: "Famous conjecture about primes p and p+2.", a: "twin prime conjecture" },
    { x: 6, y: 1, cat: "Sports", val: 400, q: "Number of players on a soccer team on the field.", a: "11" },
    { x: 6, y: 2, cat: "Sports", val: 800, q: "Country that hosts Wimbledon.", a: "England" },
    { x: 6, y: 3, cat: "Sports", val: 1200, q: "Boxer who said 'float like a butterfly'.", a: "Muhammad Ali" },
    { x: 6, y: 4, cat: "Sports", val: 1600, q: "F1 driver with seven World Championships and the most race wins.", a: "Hamilton" },
    { x: 6, y: 5, cat: "Sports", val: 2000, q: "Sport whose top trophy is the Stanley Cup.", a: "hockey" },
  ],
  final: [
    {
      cat: "20th Century History",
      q: "This event of 1989 came to symbolize the end of the Cold War in Europe.",
      a: "fall of the Berlin Wall",
    },
  ],
};

export type SampleTheme =
  | "standard"
  | "kids-week"
  | "teen-tournament"
  | "college-championship"
  | "tournament-of-champions";

export interface SampleEpisode {
  id: string;
  number: number;
  title: string;
  theme: SampleTheme;
  data: ArchivedEpisodeInput;
}

export const sampleEpisodes: SampleEpisode[] = [
  {
    id: "studio-showdown",
    number: 100,
    title: "Studio Showdown",
    theme: "standard",
    data: classicSampleEpisode,
  },
  {
    id: "code-night",
    number: 101,
    title: "Code Night",
    theme: "tournament-of-champions",
    data: {
      episodeNumber: "S-101",
      airDate: "2026-05-09",
      info: "Software & computing",
      title: "Code Night",
      jeopardy: [
        { x: 1, y: 1, cat: "Languages", val: 200, q: "Created by Guido van Rossum in 1991, this snake-named language is famously beginner-friendly.", a: "Python" },
        { x: 1, y: 2, cat: "Languages", val: 400, q: "JavaScript's static-typing sibling from Microsoft.", a: "TypeScript" },
        { x: 1, y: 3, cat: "Languages", val: 600, q: "This systems language was created at Mozilla and emphasizes memory safety without a garbage collector.", a: "Rust" },
        { x: 1, y: 4, cat: "Languages", val: 800, q: "Google's compiled language with goroutines.", a: "Go" },
        { x: 1, y: 5, cat: "Languages", val: 1000, q: "Lisp dialect that runs on the JVM, created by Rich Hickey.", a: "Clojure" },
        { x: 2, y: 1, cat: "Git", val: 200, q: "The command that records changes to the repository.", a: "commit" },
        { x: 2, y: 2, cat: "Git", val: 400, q: "Operation that integrates changes from another branch.", a: "merge" },
        { x: 2, y: 3, cat: "Git", val: 600, q: "Pointer to a series of snapshots that you switch between.", a: "branch" },
        { x: 2, y: 4, cat: "Git", val: 800, q: "Rewriting commit history by replaying on top of another base.", a: "rebase", dd: true },
        { x: 2, y: 5, cat: "Git", val: 1000, q: "The default name of a Git's first branch as of 2020 in most tools.", a: "main" },
        { x: 3, y: 1, cat: "Databases", val: 200, q: "SQL keyword to retrieve rows.", a: "SELECT" },
        { x: 3, y: 2, cat: "Databases", val: 400, q: "Document database with JSON-like documents.", a: "MongoDB" },
        { x: 3, y: 3, cat: "Databases", val: 600, q: "In-memory key-value store often used for caching.", a: "Redis" },
        { x: 3, y: 4, cat: "Databases", val: 800, q: "Property of a transaction that survives crashes.", a: "Durability" },
        { x: 3, y: 5, cat: "Databases", val: 1000, q: "B-tree variant Postgres uses for most of its indexes.", a: "B+ tree" },
        { x: 4, y: 1, cat: "Networking", val: 200, q: "Port number for HTTPS.", a: "443" },
        { x: 4, y: 2, cat: "Networking", val: 400, q: "Service that maps domain names to IP addresses.", a: "DNS" },
        { x: 4, y: 3, cat: "Networking", val: 600, q: "Layer-4 protocol that ensures reliable, ordered delivery.", a: "TCP" },
        { x: 4, y: 4, cat: "Networking", val: 800, q: "HTTP status code for 'Not Found'.", a: "404" },
        { x: 4, y: 5, cat: "Networking", val: 1000, q: "Protocol that signed certificates use to prove identity.", a: "TLS" },
        { x: 5, y: 1, cat: "Open Source", val: 200, q: "Foundation behind Apache.", a: "Apache Software Foundation" },
        { x: 5, y: 2, cat: "Open Source", val: 400, q: "Linux founder.", a: "Linus Torvalds" },
        { x: 5, y: 3, cat: "Open Source", val: 600, q: "MIT-licensed JavaScript library by Facebook, now Meta.", a: "React" },
        { x: 5, y: 4, cat: "Open Source", val: 800, q: "Container runtime that popularized OS-level virtualization in 2013.", a: "Docker" },
        { x: 5, y: 5, cat: "Open Source", val: 1000, q: "Distributed version control system Linus wrote in 2005.", a: "Git" },
        { x: 6, y: 1, cat: "Algorithms II", val: 200, q: "Data structure with LIFO order.", a: "stack" },
        { x: 6, y: 2, cat: "Algorithms II", val: 400, q: "Data structure with FIFO order.", a: "queue" },
        { x: 6, y: 3, cat: "Algorithms II", val: 600, q: "Self-balancing binary search tree named for its coloring.", a: "red-black tree" },
        { x: 6, y: 4, cat: "Algorithms II", val: 800, q: "Graph traversal that uses a queue.", a: "BFS" },
        { x: 6, y: 5, cat: "Algorithms II", val: 1000, q: "Hash table technique that handles collisions with linked lists.", a: "separate chaining" },
      ],
      double: [
        { x: 1, y: 1, cat: "Cloud", val: 400, q: "Amazon's elastic compute service.", a: "EC2" },
        { x: 1, y: 2, cat: "Cloud", val: 800, q: "Google's container orchestration system.", a: "Kubernetes" },
        { x: 1, y: 3, cat: "Cloud", val: 1200, q: "S3 stands for this.", a: "Simple Storage Service" },
        { x: 1, y: 4, cat: "Cloud", val: 1600, q: "Vercel CEO who founded the company.", a: "Guillermo Rauch" },
        { x: 1, y: 5, cat: "Cloud", val: 2000, q: "First-generation serverless platform launched by AWS in 2014.", a: "AWS Lambda" },
        { x: 2, y: 1, cat: "Security", val: 400, q: "Acronym for a Cross-Site Scripting attack.", a: "XSS" },
        { x: 2, y: 2, cat: "Security", val: 800, q: "Hash function family that succeeded SHA-1.", a: "SHA-2" },
        { x: 2, y: 3, cat: "Security", val: 1200, q: "Two-factor authentication via time-based one-time passwords uses this RFC.", a: "RFC 6238" },
        { x: 2, y: 4, cat: "Security", val: 1600, q: "Asymmetric cryptography algorithm named for three MIT cryptographers.", a: "RSA" },
        { x: 2, y: 5, cat: "Security", val: 2000, q: "Browser policy that restricts cross-origin requests by default.", a: "Same-Origin Policy" },
        { x: 3, y: 1, cat: "AI", val: 400, q: "Architecture behind GPT models.", a: "Transformer", dd: true },
        { x: 3, y: 2, cat: "AI", val: 800, q: "Hinton, Bengio, and LeCun shared this 2018 prize for deep learning.", a: "Turing Award" },
        { x: 3, y: 3, cat: "AI", val: 1200, q: "Anthropic's flagship assistant.", a: "Claude" },
        { x: 3, y: 4, cat: "AI", val: 1600, q: "Loss function used to train classifiers.", a: "cross-entropy" },
        { x: 3, y: 5, cat: "AI", val: 2000, q: "Activation function defined as max(0, x).", a: "ReLU" },
        { x: 4, y: 1, cat: "Standards", val: 400, q: "The W3C maintains this markup standard.", a: "HTML" },
        { x: 4, y: 2, cat: "Standards", val: 800, q: "JavaScript standardization body.", a: "ECMA" },
        { x: 4, y: 3, cat: "Standards", val: 1200, q: "JSON's acronym expansion.", a: "JavaScript Object Notation" },
        { x: 4, y: 4, cat: "Standards", val: 1600, q: "REST stands for this representational architecture style.", a: "Representational State Transfer" },
        { x: 4, y: 5, cat: "Standards", val: 2000, q: "Successor to HTTP/2 built on UDP.", a: "HTTP/3" },
        { x: 5, y: 1, cat: "Editors", val: 400, q: "Microsoft's free cross-platform editor.", a: "VS Code" },
        { x: 5, y: 2, cat: "Editors", val: 800, q: "Modal editor with hjkl movement.", a: "Vim" },
        { x: 5, y: 3, cat: "Editors", val: 1200, q: "Lisp-driven editor created by Stallman and Steele.", a: "Emacs" },
        { x: 5, y: 4, cat: "Editors", val: 1600, q: "AI coding assistant from Anthropic.", a: "Claude Code" },
        { x: 5, y: 5, cat: "Editors", val: 2000, q: "JetBrains editor written in Kotlin and used for IntelliJ.", a: "IntelliJ IDEA" },
        { x: 6, y: 1, cat: "Distributed Systems", val: 400, q: "Trade-off triangle of consistency, availability, partition tolerance.", a: "CAP theorem" },
        { x: 6, y: 2, cat: "Distributed Systems", val: 800, q: "Lamport's algorithm for distributed mutual exclusion.", a: "Lamport timestamps" },
        { x: 6, y: 3, cat: "Distributed Systems", val: 1200, q: "Leader-election protocol that succeeded Paxos in popularity.", a: "Raft" },
        { x: 6, y: 4, cat: "Distributed Systems", val: 1600, q: "Eventual-consistency model where reads return the latest writes you've made.", a: "read-your-writes" },
        { x: 6, y: 5, cat: "Distributed Systems", val: 2000, q: "Distributed log that powers Kafka.", a: "append-only log" },
      ],
      final: [
        {
          cat: "Open Source History",
          q: "This BSD operating system's first release came from Berkeley in 1977 as a UNIX variant.",
          a: "BSD UNIX",
        },
      ],
    },
  },
  {
    id: "kids-week",
    number: 200,
    title: "Kids Week",
    theme: "kids-week",
    data: {
      episodeNumber: "K-1",
      airDate: "2026-05-01",
      info: "Friendlier clues for the youngest contestants",
      title: "Kids Week",
      jeopardy: [
        { x: 1, y: 1, cat: "Animals", val: 100, q: "Black-and-white bear that eats bamboo.", a: "panda" },
        { x: 1, y: 2, cat: "Animals", val: 200, q: "Largest land mammal.", a: "elephant" },
        { x: 1, y: 3, cat: "Animals", val: 300, q: "Birds that cannot fly but swim well in the Antarctic.", a: "penguins" },
        { x: 1, y: 4, cat: "Animals", val: 400, q: "Sea creature with eight arms.", a: "octopus" },
        { x: 1, y: 5, cat: "Animals", val: 500, q: "Group name for a bunch of lions.", a: "pride" },
        { x: 2, y: 1, cat: "Colors", val: 100, q: "The color of the sun.", a: "yellow" },
        { x: 2, y: 2, cat: "Colors", val: 200, q: "Mix red and blue to get this.", a: "purple" },
        { x: 2, y: 3, cat: "Colors", val: 300, q: "Color of an emerald.", a: "green" },
        { x: 2, y: 4, cat: "Colors", val: 400, q: "Spectrum has seven of these.", a: "colors" },
        { x: 2, y: 5, cat: "Colors", val: 500, q: "Red and green make this Italian flag color combo plus white.", a: "Italy" },
        { x: 3, y: 1, cat: "Numbers", val: 100, q: "Number of legs on a spider.", a: "eight" },
        { x: 3, y: 2, cat: "Numbers", val: 200, q: "Sides of a triangle.", a: "three" },
        { x: 3, y: 3, cat: "Numbers", val: 300, q: "Days in a leap year.", a: "366" },
        { x: 3, y: 4, cat: "Numbers", val: 400, q: "It comes right after twelve.", a: "thirteen" },
        { x: 3, y: 5, cat: "Numbers", val: 500, q: "Roman numeral for 100.", a: "C" },
      ],
      final: [
        {
          cat: "School",
          q: "Subject where you learn about plants and animals.",
          a: "biology",
        },
      ],
    },
  },
  {
    id: "teen-tournament",
    number: 300,
    title: "Teen Tournament",
    theme: "teen-tournament",
    data: {
      episodeNumber: "T-1",
      airDate: "2026-04-15",
      info: "High-school favorites",
      title: "Teen Tournament",
      jeopardy: [
        { x: 1, y: 1, cat: "Pop Music", val: 200, q: "Genre dominating the late-2010s charts with artists like Drake.", a: "hip hop" },
        { x: 1, y: 2, cat: "Pop Music", val: 400, q: "British band of John, Paul, George, and Ringo.", a: "the Beatles" },
        { x: 1, y: 3, cat: "Pop Music", val: 600, q: "She released the album '1989' in 2014 and re-recorded it in 2023.", a: "Taylor Swift" },
        { x: 1, y: 4, cat: "Pop Music", val: 800, q: "Beyonce's group before her solo career.", a: "Destiny's Child" },
        { x: 1, y: 5, cat: "Pop Music", val: 1000, q: "Streaming service founded in Sweden in 2006.", a: "Spotify" },
        { x: 2, y: 1, cat: "Social Media", val: 200, q: "App that limited posts to 140 characters until 2017.", a: "Twitter" },
        { x: 2, y: 2, cat: "Social Media", val: 400, q: "Disappearing-message app with a ghost logo.", a: "Snapchat" },
        { x: 2, y: 3, cat: "Social Media", val: 600, q: "ByteDance-owned short video platform.", a: "TikTok" },
        { x: 2, y: 4, cat: "Social Media", val: 800, q: "Photo-sharing app Facebook bought in 2012.", a: "Instagram" },
        { x: 2, y: 5, cat: "Social Media", val: 1000, q: "Reddit's main moderator badge color.", a: "green" },
        { x: 3, y: 1, cat: "Movies", val: 200, q: "Wizarding school in the Harry Potter series.", a: "Hogwarts" },
        { x: 3, y: 2, cat: "Movies", val: 400, q: "Spider-Man actor in the 2002 original Sam Raimi film.", a: "Tobey Maguire" },
        { x: 3, y: 3, cat: "Movies", val: 600, q: "Marvel film where Thanos snaps his fingers.", a: "Infinity War" },
        { x: 3, y: 4, cat: "Movies", val: 800, q: "Pixar movie about emotions inside a kid's head.", a: "Inside Out" },
        { x: 3, y: 5, cat: "Movies", val: 1000, q: "Best Picture winner of 2020 from Bong Joon-ho.", a: "Parasite" },
      ],
      final: [
        {
          cat: "Internet",
          q: "Streaming site started in 2005 with the first uploaded video, 'Me at the zoo'.",
          a: "YouTube",
        },
      ],
    },
  },
  {
    id: "college-bowl",
    number: 400,
    title: "College Championship",
    theme: "college-championship",
    data: {
      episodeNumber: "C-1",
      airDate: "2026-03-20",
      info: "University-level academic clues",
      title: "College Championship",
      jeopardy: [
        { x: 1, y: 1, cat: "Philosophy", val: 200, q: "Greek philosopher who taught Aristotle.", a: "Plato" },
        { x: 1, y: 2, cat: "Philosophy", val: 400, q: "He wrote 'I think, therefore I am'.", a: "Descartes" },
        { x: 1, y: 3, cat: "Philosophy", val: 600, q: "Categorical imperative philosopher from Königsberg.", a: "Kant" },
        { x: 1, y: 4, cat: "Philosophy", val: 800, q: "Existentialist who wrote 'Being and Nothingness'.", a: "Sartre" },
        { x: 1, y: 5, cat: "Philosophy", val: 1000, q: "She wrote 'The Second Sex' in 1949.", a: "Simone de Beauvoir" },
        { x: 2, y: 1, cat: "Chemistry", val: 200, q: "Atomic number of carbon.", a: "6" },
        { x: 2, y: 2, cat: "Chemistry", val: 400, q: "Noble gas filling neon signs.", a: "neon" },
        { x: 2, y: 3, cat: "Chemistry", val: 600, q: "pH below 7 means this.", a: "acidic" },
        { x: 2, y: 4, cat: "Chemistry", val: 800, q: "Avogadro's number is roughly six times ten to this power.", a: "23" },
        { x: 2, y: 5, cat: "Chemistry", val: 1000, q: "Bond that shares electrons between atoms.", a: "covalent" },
        { x: 3, y: 1, cat: "World History", val: 200, q: "Year the Berlin Wall fell.", a: "1989" },
        { x: 3, y: 2, cat: "World History", val: 400, q: "Egyptian queen who allied with Caesar and Mark Antony.", a: "Cleopatra" },
        { x: 3, y: 3, cat: "World History", val: 600, q: "Treaty that ended World War I in 1919.", a: "Treaty of Versailles" },
        { x: 3, y: 4, cat: "World History", val: 800, q: "Mongol leader who founded the largest contiguous empire.", a: "Genghis Khan" },
        { x: 3, y: 5, cat: "World History", val: 1000, q: "Year Constantinople fell to the Ottomans.", a: "1453" },
      ],
      final: [
        {
          cat: "Economics",
          q: "Scottish author of 'The Wealth of Nations' in 1776.",
          a: "Adam Smith",
        },
      ],
    },
  },
];

export const themeLabels: Record<SampleTheme, string> = {
  standard: "Standard",
  "kids-week": "Kids Week",
  "teen-tournament": "Teen Tournament",
  "college-championship": "College Championship",
  "tournament-of-champions": "Tournament of Champions",
};

export function pickRandomEpisode(rng: () => number = Math.random): SampleEpisode {
  const index = Math.floor(rng() * sampleEpisodes.length);
  return sampleEpisodes[index];
}
