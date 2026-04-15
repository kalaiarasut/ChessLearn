import { Chess, type Square } from "chess.js";

export type OpeningLevel = "beginner" | "intermediate" | "advanced";

type StepAnnotation = {
  explanation: string;
  idea?: string;
  plan?: string;
  warning?: string;
  trap?: string;
};

type RawLessonLine = {
  id: string;
  title: string;
  summary: string;
  pgn: string;
  annotations: StepAnnotation[];
};

type RawBranch = {
  id: string;
  parentPly: number;
  label: string;
  reason: string;
  line: RawLessonLine;
};

type RawLevelContent = {
  description: string;
  intro: string;
  mainLine: RawLessonLine;
  branches: RawBranch[];
};

type RawOpeningCourse = {
  slug: string;
  name: string;
  family: string;
  levels: Record<OpeningLevel, RawLevelContent>;
};

export type LessonStep = {
  ply: number;
  moveNumber: number;
  side: "white" | "black";
  san: string;
  from: Square;
  to: Square;
  beforeFen: string;
  afterFen: string;
  explanation: string;
  idea?: string;
  plan?: string;
  warning?: string;
  trap?: string;
};

export type LessonLine = {
  id: string;
  title: string;
  summary: string;
  steps: LessonStep[];
};

export type LessonBranch = {
  id: string;
  parentPly: number;
  label: string;
  reason: string;
  line: LessonLine;
};

export type OpeningLevelContent = {
  description: string;
  intro: string;
  linePreview: string;
  mainLine: LessonLine;
  branches: LessonBranch[];
};

export type OpeningCourse = {
  slug: string;
  name: string;
  family: string;
  levels: Record<OpeningLevel, OpeningLevelContent>;
};

const rawOpenings: RawOpeningCourse[] = [
  {
    slug: "italian-game",
    name: "Italian Game",
    family: "Open Game",
    levels: {
      beginner: {
        description: "Classical development with a clear c3 and d4 center break.",
        intro:
          "The Italian Game is one of the cleanest ways to learn development, king safety, and central timing.",
        mainLine: {
          id: "italian-beginner-main",
          title: "Classical Italian Setup",
          summary: "Develop quickly and prepare d4 with support.",
          pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4",
          annotations: [
            { explanation: "White claims the center and opens lines." },
            { explanation: "Black matches the center and keeps the game open." },
            { explanation: "Nf3 attacks e5 and develops a key piece." },
            { explanation: "Nc6 reinforces e5 and controls d4." },
            { explanation: "Bc4 pressures f7, the weakest point near Black's king." },
            { explanation: "Black copies the bishop and develops naturally." },
            { explanation: "c3 prepares the thematic d4 break.", plan: "Do not rush d4 before it is supported." },
            { explanation: "Black develops and watches the center." },
            { explanation: "d4 is the main idea: White now asks Black to resolve the center.", trap: "If Black reacts carelessly, White can gain tempi with pressure on f7." },
          ],
        },
        branches: [
          {
            id: "italian-beginner-two-knights",
            parentPly: 4,
            label: "Two Knights Defense",
            reason: "Black attacks e4 first instead of matching the bishop move.",
            line: {
              id: "italian-beginner-two-knights-line",
              title: "Facing the Two Knights",
              summary: "White stays solid with d3 before expanding.",
              pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. d3 Bc5 5. c3",
              annotations: [
                { explanation: "White grabs central space." },
                { explanation: "Black mirrors and keeps the game open." },
                { explanation: "Nf3 attacks e5 and accelerates development." },
                { explanation: "Nc6 defends e5 and keeps d4 covered." },
                { explanation: "Bc4 targets f7 again." },
                { explanation: "Black chooses the Two Knights move order and hits e4." },
                { explanation: "d3 keeps the structure stable before White expands." },
                { explanation: "Black develops the bishop and heads for castling." },
                { explanation: "c3 still points toward a later d4 break." },
              ],
            },
          },
        ],
      },
      intermediate: {
        description: "A slower Giuoco Piano structure with setup moves before the break.",
        intro:
          "At intermediate level the Italian becomes a structure lesson. White improves the pieces first and then decides whether the center should open.",
        mainLine: {
          id: "italian-intermediate-main",
          title: "Giuoco Piano Build-Up",
          summary: "Castle, support e4, and wait for the right d4 moment.",
          pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O 7. Re1 a6 8. Bb3",
          annotations: [
            { explanation: "White enters open-game territory." },
            { explanation: "Black stays symmetrical." },
            { explanation: "Nf3 pressures e5 and develops cleanly." },
            { explanation: "Nc6 is the principled defense." },
            { explanation: "Bc4 keeps the bishop active and points at f7." },
            { explanation: "Black develops and watches d4." },
            { explanation: "c3 builds the base for White's center." },
            { explanation: "Nf6 develops and challenges e4." },
            { explanation: "d3 keeps the center healthy and avoids early tactics." },
            { explanation: "d6 supports e5 and keeps Black compact." },
            { explanation: "White castles and finishes king safety." },
            { explanation: "Black also castles and waits for White's plan." },
            { explanation: "Re1 supports e4 and the future d4 break.", idea: "White can now choose between slow maneuvering and immediate central action." },
            { explanation: "a6 gains queenside space and asks the bishop to decide." },
            { explanation: "Bb3 preserves f7 pressure and the long diagonal." },
          ],
        },
        branches: [
          {
            id: "italian-intermediate-evans",
            parentPly: 6,
            label: "Evans Gambit",
            reason: "White offers a pawn to gain time and open lines.",
            line: {
              id: "italian-intermediate-evans-line",
              title: "Evans Gambit",
              summary: "Trade a pawn for tempi and initiative.",
              pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4",
              annotations: [
                { explanation: "White starts classically." },
                { explanation: "Black mirrors and keeps the center open." },
                { explanation: "Nf3 attacks e5 and speeds development." },
                { explanation: "Nc6 reinforces the center." },
                { explanation: "Bc4 creates early kingside pressure." },
                { explanation: "Black develops the bishop actively." },
                { explanation: "b4 is the pawn offer that defines the Evans Gambit." },
                { explanation: "Black accepts the pawn and must now prove it can consolidate." },
                { explanation: "c3 gains time on the bishop and prepares a big center." },
                { explanation: "Ba5 keeps the bishop active." },
                { explanation: "d4 opens the center before Black is ready." },
              ],
            },
          },
        ],
      },
      advanced: {
        description: "Modern Italian maneuvering with move-order nuance and slower plans.",
        intro:
          "Advanced Italian preparation is mostly about timing. White often delays d4 until the pieces are ideally placed and the branch is clearly defined.",
        mainLine: {
          id: "italian-advanced-main",
          title: "Modern Italian Maneuvering",
          summary: "Slowly improve the pieces before opening the center.",
          pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O 7. Re1 a6 8. Bb3 Ba7 9. h3 h6 10. Nbd2 Re8",
          annotations: [
            { explanation: "White claims the center and keeps the game flexible." },
            { explanation: "Black answers symmetrically." },
            { explanation: "Nf3 increases pressure on e5." },
            { explanation: "Nc6 keeps the center stable." },
            { explanation: "Bc4 aims at f7 and supports active kingside ideas." },
            { explanation: "Black develops and watches d4 carefully." },
            { explanation: "c3 prepares d4 without committing yet." },
            { explanation: "Black develops and hits e4." },
            { explanation: "d3 keeps White's center compact." },
            { explanation: "d6 reinforces e5 and keeps Black healthy." },
            { explanation: "White castles and completes king safety." },
            { explanation: "Black castles too." },
            { explanation: "Re1 supports e4 and future central play." },
            { explanation: "a6 gains space and prepares a bishop retreat." },
            { explanation: "Bb3 preserves White's bishop." },
            { explanation: "Ba7 keeps Black's bishop on the long diagonal." },
            { explanation: "h3 takes g4 away from Black's pieces.", plan: "Small moves matter here because both sides are maneuvering." },
            { explanation: "h6 mirrors the same idea." },
            { explanation: "Nbd2 improves White's coordination and supports a later d4." },
            { explanation: "Re8 reinforces e5 and prepares deeper maneuvering." },
          ],
        },
        branches: [
          {
            id: "italian-advanced-central-break",
            parentPly: 12,
            label: "Immediate d4 Break",
            reason: "White can switch from maneuvering to direct central action.",
            line: {
              id: "italian-advanced-central-break-line",
              title: "Central Break Timing",
              summary: "Use d4 at once when Black gives enough time.",
              pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O 7. Re1 a6 8. Bb3 Ba7 9. d4",
              annotations: [
                { explanation: "White starts classically." },
                { explanation: "Black matches and keeps the center open." },
                { explanation: "Nf3 attacks e5." },
                { explanation: "Nc6 supports e5 and d4 control." },
                { explanation: "Bc4 points at f7." },
                { explanation: "Black develops naturally." },
                { explanation: "c3 prepares d4." },
                { explanation: "Black develops and attacks e4." },
                { explanation: "d3 keeps White flexible." },
                { explanation: "d6 reinforces the center." },
                { explanation: "White castles." },
                { explanation: "Black castles." },
                { explanation: "Re1 supports the center break." },
                { explanation: "a6 gains space and asks the bishop to choose." },
                { explanation: "Bb3 keeps the bishop active." },
                { explanation: "Ba7 preserves the bishop for later kingside pressure." },
                { explanation: "d4 is the point: White opens the center before the maneuver phase goes too far.", warning: "The position becomes more concrete as soon as the center opens." },
              ],
            },
          },
        ],
      },
    },
  },
  {
    slug: "sicilian-defense",
    name: "Sicilian Defense",
    family: "Semi-Open Game",
    levels: {
      beginner: {
        description: "A clean Open Sicilian path plus one anti-Sicilian branch.",
        intro:
          "The Sicilian creates imbalance immediately. White should know the Open Sicilian structure and one practical branch that avoids it.",
        mainLine: {
          id: "sicilian-beginner-main",
          title: "Open Sicilian Setup",
          summary: "Develop smoothly before either side starts a wing attack.",
          pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3",
          annotations: [
            { explanation: "White claims the center right away." },
            { explanation: "Black fights for d4 from the side instead of mirroring." },
            { explanation: "Nf3 supports d4 and develops." },
            { explanation: "d6 supports Black's future ...Nf6 and keeps the center flexible." },
            { explanation: "White opens the center before Black settles." },
            { explanation: "Black accepts the Open Sicilian structure." },
            { explanation: "White recaptures actively with a knight." },
            { explanation: "Black attacks e4 and develops." },
            { explanation: "Nc3 protects e4 and keeps White's attacking plans flexible." },
          ],
        },
        branches: [
          {
            id: "sicilian-beginner-alapin",
            parentPly: 2,
            label: "Alapin Setup",
            reason: "White avoids the Open Sicilian and builds a broad center instead.",
            line: {
              id: "sicilian-beginner-alapin-line",
              title: "Alapin Sicilian",
              summary: "Use c3 and d4 to claim space without entering heavy theory.",
              pgn: "1. e4 c5 2. c3 d5 3. exd5 Qxd5 4. d4",
              annotations: [
                { explanation: "White starts with central space." },
                { explanation: "Black unbalances the game immediately." },
                { explanation: "c3 prepares d4 and sidesteps the sharp Open Sicilian." },
                { explanation: "Black hits the center before White settles." },
                { explanation: "White exchanges and opens the game a little." },
                { explanation: "Black recaptures with the queen and stays active." },
                { explanation: "d4 still builds a broad center for White." },
              ],
            },
          },
        ],
      },
      intermediate: {
        description: "A Najdorf-style shell with one sharp branch change in structure.",
        intro:
          "At this level the Sicilian is about recognizing which pawn structure you are entering and what that means for attack plans.",
        mainLine: {
          id: "sicilian-intermediate-main",
          title: "Najdorf Skeleton",
          summary: "Black expands on the queenside while White develops for the kingside.",
          pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 7. Nf3 Be7",
          annotations: [
            { explanation: "White enters the center quickly." },
            { explanation: "Black chooses asymmetry from move one." },
            { explanation: "Nf3 supports d4 and develops." },
            { explanation: "d6 backs up central pressure." },
            { explanation: "White opens the game before Black equalizes easily." },
            { explanation: "Black accepts the open structure." },
            { explanation: "White recaptures with activity." },
            { explanation: "Black attacks e4 and develops." },
            { explanation: "Nc3 protects e4 and supports future attacks." },
            { explanation: "a6 is the Najdorf signature move and keeps many setups available." },
            { explanation: "Be3 develops and prepares queenside castling ideas." },
            { explanation: "e5 grabs space but gives White outposts later." },
            { explanation: "Nf3 keeps the knight flexible." },
            { explanation: "Be7 completes Black's setup calmly." },
          ],
        },
        branches: [
          {
            id: "sicilian-intermediate-dragon",
            parentPly: 8,
            label: "Dragon Setup",
            reason: "Black fianchettos instead of taking central space with ...e5.",
            line: {
              id: "sicilian-intermediate-dragon-line",
              title: "Dragon Structure",
              summary: "The long diagonal changes both sides' attack map.",
              pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7",
              annotations: [
                { explanation: "White starts classically." },
                { explanation: "Black creates Sicilian imbalance." },
                { explanation: "Nf3 supports d4 and develops." },
                { explanation: "d6 prepares ...Nf6." },
                { explanation: "White opens the center." },
                { explanation: "Black accepts the Open Sicilian." },
                { explanation: "White recaptures with a knight." },
                { explanation: "Black attacks e4 and develops." },
                { explanation: "Nc3 supports the center." },
                { explanation: "g6 announces the Dragon and a strong diagonal." },
                { explanation: "Be3 develops toward attacking setups." },
                { explanation: "Bg7 activates Black's key bishop." },
              ],
            },
          },
        ],
      },
      advanced: {
        description: "An English Attack shell where the branch choice changes the whole middlegame.",
        intro:
          "Advanced Sicilian work is mostly structure recognition. The same first moves can lead to different races depending on whether Black chooses ...e6 or ...g6.",
        mainLine: {
          id: "sicilian-advanced-main",
          title: "English Attack Shell",
          summary: "White builds for a direct kingside race while Black expands on the queenside.",
          pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e6 7. f3 b5 8. Qd2 Nbd7 9. g4",
          annotations: [
            { explanation: "White claims central space." },
            { explanation: "Black chooses Sicilian imbalance." },
            { explanation: "Nf3 supports d4 and develops." },
            { explanation: "d6 prepares Black's setup." },
            { explanation: "White opens the center early." },
            { explanation: "Black accepts the structure." },
            { explanation: "White recaptures actively." },
            { explanation: "Black attacks e4 and develops." },
            { explanation: "Nc3 keeps White's central grip." },
            { explanation: "a6 prepares queenside expansion." },
            { explanation: "Be3 points toward long castling and kingside play." },
            { explanation: "e6 keeps the structure compact." },
            { explanation: "f3 supports e4 and prepares g4-g5." },
            { explanation: "b5 starts Black's queenside race." },
            { explanation: "Qd2 coordinates the attack." },
            { explanation: "Nbd7 keeps queenside pressure coming." },
            { explanation: "g4 is the signal that White is attacking on the kingside now.", warning: "If White is slow, Black's queenside play lands first." },
          ],
        },
        branches: [
          {
            id: "sicilian-advanced-dragon",
            parentPly: 8,
            label: "Dragon Setup",
            reason: "Black changes structure completely with ...g6 and long-diagonal pressure.",
            line: {
              id: "sicilian-advanced-dragon-line",
              title: "Yugoslav Attack Start",
              summary: "White keeps the same attacking intent against the Dragon structure.",
              pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 O-O 8. Qd2 Nc6 9. Bc4",
              annotations: [
                { explanation: "White takes the center." },
                { explanation: "Black chooses asymmetry." },
                { explanation: "Nf3 supports d4 and develops." },
                { explanation: "d6 prepares Black's usual setup." },
                { explanation: "White opens the position." },
                { explanation: "Black accepts the open structure." },
                { explanation: "White stays active with the knight recapture." },
                { explanation: "Black attacks e4 and develops." },
                { explanation: "Nc3 reinforces White's center." },
                { explanation: "g6 announces Dragon play." },
                { explanation: "Be3 develops toward a direct attack." },
                { explanation: "Bg7 activates the long diagonal." },
                { explanation: "f3 supports e4 and g4." },
                { explanation: "Black castles and accepts a race." },
                { explanation: "Qd2 prepares queenside castling and rook support." },
                { explanation: "Nc6 increases Black's pressure and development." },
                { explanation: "Bc4 points directly at f7 and fits the Yugoslav setup." },
              ],
            },
          },
        ],
      },
    },
  },
  {
    slug: "queens-gambit",
    name: "Queen's Gambit",
    family: "Closed Game",
    levels: {
      beginner: {
        description: "A clear introduction to central pressure and simple development.",
        intro:
          "The Queen's Gambit is about central control, not winning a pawn. White uses c4 to challenge d5 and develop smoothly.",
        mainLine: {
          id: "qg-beginner-main",
          title: "Queen's Gambit Declined Start",
          summary: "Pressure d5 while finishing development cleanly.",
          pgn: "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5",
          annotations: [
            { explanation: "White takes central space and opens the c1 bishop." },
            { explanation: "Black matches the center and aims for solidity." },
            { explanation: "c4 challenges d5 and asks Black to define the structure." },
            { explanation: "Black declines the gambit and keeps the center protected." },
            { explanation: "Nc3 adds pressure on d5 and develops naturally." },
            { explanation: "Black develops and prepares to castle." },
            { explanation: "Bg5 pins the knight and increases White's central pressure." },
          ],
        },
        branches: [
          {
            id: "qg-beginner-accepted",
            parentPly: 2,
            label: "Queen's Gambit Accepted",
            reason: "Black grabs the pawn, but White gains time and development.",
            line: {
              id: "qg-beginner-accepted-line",
              title: "Queen's Gambit Accepted",
              summary: "Recover the pawn with smooth development.",
              pgn: "1. d4 d5 2. c4 dxc4 3. Nf3 Nf6 4. e3",
              annotations: [
                { explanation: "White starts with central control." },
                { explanation: "Black matches the center." },
                { explanation: "c4 challenges d5 and offers the wing pawn." },
                { explanation: "Black accepts the pawn, but now development matters even more." },
                { explanation: "Nf3 develops and prepares to recover c4." },
                { explanation: "Black develops and protects key central squares." },
                { explanation: "e3 opens the bishop and prepares Bxc4." },
              ],
            },
          },
        ],
      },
      intermediate: {
        description: "A QGD structure lesson with one alternative branch in the Slav.",
        intro:
          "Intermediate Queen's Gambit study is about understanding why the pawn structure matters more than quick tactics.",
        mainLine: {
          id: "qg-intermediate-main",
          title: "Classical QGD",
          summary: "Develop naturally, keep pressure on d5, and prepare strategic play.",
          pgn: "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3",
          annotations: [
            { explanation: "White takes the center." },
            { explanation: "Black stays symmetrical and solid." },
            { explanation: "c4 pressures d5 immediately." },
            { explanation: "Black declines and keeps the center healthy." },
            { explanation: "Nc3 increases pressure on d5." },
            { explanation: "Black develops and prepares kingside safety." },
            { explanation: "Bg5 pins the knight and shapes the structure." },
            { explanation: "Be7 breaks the pin and keeps the setup classical." },
            { explanation: "e3 stabilizes White's center and opens the bishop." },
            { explanation: "Black castles and completes safety." },
            { explanation: "Nf3 keeps White fully developed and ready for strategic plans." },
          ],
        },
        branches: [
          {
            id: "qg-intermediate-slav",
            parentPly: 2,
            label: "Slav Defense",
            reason: "Black supports d5 with ...c6 and keeps the bishop freer than in the QGD.",
            line: {
              id: "qg-intermediate-slav-line",
              title: "Slav Structure",
              summary: "The bishop stays flexible, so White must respect Black's easy development.",
              pgn: "1. d4 d5 2. c4 c6 3. Nc3 Nf6 4. Nf3",
              annotations: [
                { explanation: "White claims central space." },
                { explanation: "Black mirrors the center." },
                { explanation: "c4 challenges d5 and asks for a structure choice." },
                { explanation: "c6 supports d5 without trapping the c8 bishop." },
                { explanation: "Nc3 adds more central pressure." },
                { explanation: "Black develops and keeps several Slav plans available." },
                { explanation: "Nf3 keeps White's setup compact and flexible." },
              ],
            },
          },
        ],
      },
      advanced: {
        description: "A structure-first QGD line with the Carlsbad-style center clarified.",
        intro:
          "Advanced Queen's Gambit work is about long strategic plans. The opening tells you where each side should play once the center resolves.",
        mainLine: {
          id: "qg-advanced-main",
          title: "Orthodox QGD",
          summary: "Clarify the center and enter a long strategic battle.",
          pgn: "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Be7 5. e3 O-O 6. Nf3 h6 7. Bh4 b6 8. cxd5 exd5",
          annotations: [
            { explanation: "White starts with central space." },
            { explanation: "Black mirrors and stays solid." },
            { explanation: "c4 challenges d5." },
            { explanation: "e6 supports d5 and creates the QGD shell." },
            { explanation: "Nc3 increases White's pressure." },
            { explanation: "Black develops and prepares castling." },
            { explanation: "Bg5 pins the knight and shapes Black's decisions." },
            { explanation: "Be7 breaks the pin and keeps the position classical." },
            { explanation: "e3 stabilizes the center and opens the bishop." },
            { explanation: "Black castles and waits for White's structure choice." },
            { explanation: "Nf3 completes White's clean development." },
            { explanation: "h6 gains luft and questions the bishop." },
            { explanation: "Bh4 keeps the bishop active." },
            { explanation: "b6 prepares queenside development and long-diagonal pressure." },
            { explanation: "cxd5 clarifies the center on White's terms." },
            { explanation: "exd5 creates the classic Carlsbad-style structure.", plan: "White often uses a minority attack while Black looks for central or kingside counterplay." },
          ],
        },
        branches: [
          {
            id: "qg-advanced-slav",
            parentPly: 2,
            label: "Slav Defense",
            reason: "Black keeps the c8 bishop free and changes the strategic balance early.",
            line: {
              id: "qg-advanced-slav-line",
              title: "Mainline Slav Start",
              summary: "White prevents ...b5 and prepares to recover the c4 pawn.",
              pgn: "1. d4 d5 2. c4 c6 3. Nc3 Nf6 4. Nf3 dxc4 5. a4",
              annotations: [
                { explanation: "White takes the center." },
                { explanation: "Black mirrors and invites a strategic game." },
                { explanation: "c4 challenges d5 and asks for a structure choice." },
                { explanation: "c6 supports d5 while keeping the bishop flexible." },
                { explanation: "Nc3 adds central pressure." },
                { explanation: "Black develops and keeps Slav options open." },
                { explanation: "Nf3 supports the center and prepares recovery of c4." },
                { explanation: "Black grabs the c4 pawn and asks White how it will react." },
                { explanation: "a4 stops ...b5 and makes winning the pawn back easier." },
              ],
            },
          },
        ],
      },
    },
  },
];

const buildLessonLine = (line: RawLessonLine): LessonLine => {
  const parser = new Chess();
  parser.loadPgn(line.pgn);
  const verboseMoves = parser.history({ verbose: true });
  const replay = new Chess();

  const steps = verboseMoves.map((move, index) => {
    const beforeFen = replay.fen();
    replay.move({ from: move.from, to: move.to, promotion: move.promotion });
    const side: LessonStep["side"] = index % 2 === 0 ? "white" : "black";
    const annotation = line.annotations[index] ?? {
      explanation: `${move.san} keeps the intended structure on the board.`,
    };

    return {
      ply: index + 1,
      moveNumber: Math.floor(index / 2) + 1,
      side,
      san: move.san,
      from: move.from,
      to: move.to,
      beforeFen,
      afterFen: replay.fen(),
      explanation: annotation.explanation,
      idea: annotation.idea,
      plan: annotation.plan,
      warning: annotation.warning,
      trap: annotation.trap,
    };
  });

  return { id: line.id, title: line.title, summary: line.summary, steps };
};

export const formatLinePreview = (steps: LessonStep[], maxPlies = 6) =>
  steps
    .slice(0, maxPlies)
    .map((step, index) => (index % 2 === 0 ? `${step.moveNumber}. ${step.san}` : step.san))
    .join(" ");

const buildOpeningCourse = (opening: RawOpeningCourse): OpeningCourse => {
  const levels = Object.fromEntries(
    (Object.entries(opening.levels) as [OpeningLevel, RawLevelContent][]).map(
      ([level, content]) => {
        const mainLine = buildLessonLine(content.mainLine);
        const branches = content.branches.map((branch) => ({
          id: branch.id,
          parentPly: branch.parentPly,
          label: branch.label,
          reason: branch.reason,
          line: buildLessonLine(branch.line),
        }));

        return [
          level,
          {
            description: content.description,
            intro: content.intro,
            linePreview: formatLinePreview(mainLine.steps),
            mainLine,
            branches,
          },
        ];
      },
    ),
  ) as Record<OpeningLevel, OpeningLevelContent>;

  return { slug: opening.slug, name: opening.name, family: opening.family, levels };
};

export const OPENING_LEVELS: OpeningLevel[] = ["beginner", "intermediate", "advanced"];

export const OPENING_LEVEL_LABELS: Record<OpeningLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced Prep",
};

export const openingCourses = rawOpenings.map(buildOpeningCourse);

export const getOpeningBySlug = (slug: string) =>
  openingCourses.find((opening) => opening.slug === slug);

export const isOpeningLevel = (value: string): value is OpeningLevel =>
  OPENING_LEVELS.includes(value as OpeningLevel);
