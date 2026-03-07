// ── Level configuration: 20 levels across 4 tiers ──

import type { AlienPattern } from './entities/alien';
import type { PlatformConfig } from './entities/platform';

export type Tier = 'foundation' | 'structure' | 'behaviour' | 'mastery';

export interface SysMLMission {
  /** Brief shown to the player in the mission panel */
  brief: string;
  /** The SysML v2 concept being taught */
  concept: string;
  /** Tags for concept categorization */
  tags: string[];
  /** Starter code shown in the editor */
  starterCode: string;
  /** Expected code structure — used for validation */
  expectedPattern: RegExp;
  /** Hint shown if player is stuck */
  hint: string;
  /** Full expected answer (for validation) */
  solution: string;
}

export interface LevelConfig {
  id: number;
  name: string;
  tier: Tier;
  /** Colour theme for platforms (ZX Spectrum hex) */
  platformColour: string;
  /** Custom platform layout, or null for default Jetpac layout */
  platforms?: PlatformConfig[];
  /** Rocket position X coordinate */
  rocketX: number;
  /** Alien pattern for this level */
  alienPattern: AlienPattern;
  /** Number of aliens to spawn per wave */
  alienCount: number;
  /** Alien speed multiplier */
  alienSpeed: number;
  /** Number of fuel cells needed */
  fuelNeeded: number;
  /** SysML mission for this level */
  mission: SysMLMission;
  /** Whether this is a rocket-building level (first of each planet) */
  buildRocket: boolean;
}

// ── ZX Spectrum planet colours ──
const PLANET_COLOURS: Record<Tier, string> = {
  foundation: '#00c525', // green
  structure: '#00c7c9',  // cyan
  behaviour: '#d62816',  // red
  mastery: '#ccc82a',    // yellow
};

// ── Platform layout templates (excluding floor — that's always added) ──
// worldW=480, worldH=360, floorY=352, platH=6

const LAYOUT_A: PlatformConfig[] = [
  // Classic Jetpac — 5 scattered shelves
  { x: 15, y: 297, width: 100, height: 6 },
  { x: 365, y: 287, width: 100, height: 6 },
  { x: 50, y: 227, width: 85, height: 6 },
  { x: 335, y: 217, width: 95, height: 6 },
  { x: 175, y: 157, width: 130, height: 6 },
];

const LAYOUT_B: PlatformConfig[] = [
  // Zigzag ascent — left-right-left staircase
  { x: 10, y: 302, width: 90, height: 6 },
  { x: 180, y: 267, width: 110, height: 6 },
  { x: 370, y: 232, width: 100, height: 6 },
  { x: 160, y: 187, width: 120, height: 6 },
  { x: 20, y: 147, width: 105, height: 6 },
];

const LAYOUT_C: PlatformConfig[] = [
  // Twin towers — two columns of shelves with a gap
  { x: 20, y: 292, width: 80, height: 6 },
  { x: 20, y: 202, width: 80, height: 6 },
  { x: 380, y: 292, width: 80, height: 6 },
  { x: 380, y: 202, width: 80, height: 6 },
  { x: 175, y: 247, width: 130, height: 6 },
];

const LAYOUT_D: PlatformConfig[] = [
  // Wide shelves — fewer, broader platforms
  { x: 10, y: 282, width: 180, height: 6 },
  { x: 290, y: 282, width: 180, height: 6 },
  { x: 100, y: 207, width: 280, height: 6 },
  { x: 30, y: 147, width: 120, height: 6 },
  { x: 330, y: 147, width: 120, height: 6 },
];

const LAYOUT_E: PlatformConfig[] = [
  // Spiral — wrapping around toward centre
  { x: 10, y: 307, width: 140, height: 6 },
  { x: 350, y: 272, width: 120, height: 6 },
  { x: 40, y: 232, width: 130, height: 6 },
  { x: 310, y: 187, width: 130, height: 6 },
  { x: 150, y: 147, width: 170, height: 6 },
];

const LAYOUT_F: PlatformConfig[] = [
  // Diamond — converging shelves
  { x: 190, y: 302, width: 100, height: 6 },
  { x: 60, y: 257, width: 100, height: 6 },
  { x: 320, y: 257, width: 100, height: 6 },
  { x: 190, y: 197, width: 100, height: 6 },
  { x: 140, y: 142, width: 200, height: 6 },
];

const LAYOUT_G: PlatformConfig[] = [
  // Tight corridors — narrow platforms close together
  { x: 30, y: 307, width: 60, height: 6 },
  { x: 130, y: 277, width: 70, height: 6 },
  { x: 250, y: 247, width: 65, height: 6 },
  { x: 360, y: 217, width: 75, height: 6 },
  { x: 190, y: 167, width: 80, height: 6 },
  { x: 60, y: 152, width: 70, height: 6 },
];

const LAYOUT_H: PlatformConfig[] = [
  // Arena — open centre with perimeter shelves
  { x: 10, y: 297, width: 100, height: 6 },
  { x: 370, y: 297, width: 100, height: 6 },
  { x: 10, y: 187, width: 100, height: 6 },
  { x: 370, y: 187, width: 100, height: 6 },
  { x: 170, y: 142, width: 140, height: 6 },
];

/** Array of layouts cycled through by level */
const PLATFORM_LAYOUTS: PlatformConfig[][] = [
  LAYOUT_A, LAYOUT_B, LAYOUT_C, LAYOUT_D,
  LAYOUT_E, LAYOUT_F, LAYOUT_G, LAYOUT_H,
];

// ── All 20 levels ──

export const LEVELS: LevelConfig[] = [
  // ═══════════════════════════════════════════
  // TIER 1: FOUNDATION (Levels 1–5)
  // ═══════════════════════════════════════════
  {
    id: 1,
    name: 'Package Declaration',
    tier: 'foundation',
    platformColour: PLANET_COLOURS.foundation,
    platforms: LAYOUT_A,
    rocketX: 232,
    alienPattern: 'meteor',
    alienCount: 2,
    alienSpeed: 40,
    fuelNeeded: 3,
    buildRocket: true,
    mission: {
      brief: 'Declare a package to organise your spacecraft systems.',
      concept: 'package',
      tags: ['package'],
      starterCode: '// Declare a package called "Spacecraft"\n',
      expectedPattern: /package\s+Spacecraft\s*\{/,
      hint: 'Use: package Spacecraft { }',
      solution: 'package Spacecraft {\n  // Systems go here\n}',
    },
  },
  {
    id: 2,
    name: 'Part Definition',
    tier: 'foundation',
    platformColour: PLANET_COLOURS.foundation,
    platforms: LAYOUT_B,
    rocketX: 232,
    alienPattern: 'meteor',
    alienCount: 3,
    alienSpeed: 45,
    fuelNeeded: 4,
    buildRocket: false,
    mission: {
      brief: 'Declare the rocket engine as a part definition — the building block of every system.',
      concept: 'part def',
      tags: ['part def'],
      starterCode: '// Define a part called "RocketEngine"\n',
      expectedPattern: /part\s+def\s+RocketEngine\s*[{;]/,
      hint: 'Use: part def RocketEngine { }',
      solution: 'part def RocketEngine {\n}',
    },
  },
  {
    id: 3,
    name: 'Attribute Usage',
    tier: 'foundation',
    platformColour: PLANET_COLOURS.foundation,
    platforms: LAYOUT_C,
    rocketX: 232,
    alienPattern: 'jellyfish',
    alienCount: 3,
    alienSpeed: 45,
    fuelNeeded: 5,
    buildRocket: false,
    mission: {
      brief: 'Now add attributes to a part. Define the fuel tank with capacity and level properties typed as Real.',
      concept: 'attribute',
      tags: ['attribute'],
      starterCode: 'part def FuelTank {\n  // Add Real-valued attributes for capacity and level\n}\n',
      expectedPattern: /part\s+def\s+FuelTank\s*\{[\s\S]*?attribute\s+capacity\s*:\s*Real[\s\S]*?attribute\s+level\s*:\s*Real/,
      hint: 'Use: attribute capacity : Real; attribute level : Real;',
      solution: 'part def FuelTank {\n  attribute capacity : Real;\n  attribute level : Real;\n}',
    },
  },
  {
    id: 4,
    name: 'Part Usage',
    tier: 'foundation',
    platformColour: PLANET_COLOURS.foundation,
    platforms: LAYOUT_D,
    rocketX: 232,
    alienPattern: 'jellyfish',
    alienCount: 4,
    alienSpeed: 50,
    fuelNeeded: 5,
    buildRocket: false,
    mission: {
      brief: 'Compose the engine and fuel tank into the spacecraft hull.',
      concept: 'part usage',
      tags: ['part'],
      starterCode: 'part def Hull {\n  // Add engine and fuelTank part usages\n}\n',
      expectedPattern: /part\s+def\s+Hull\s*\{[\s\S]*?part\s+\w+\s*:\s*RocketEngine[\s\S]*?part\s+\w+\s*:\s*FuelTank/,
      hint: 'Use: part mainEngine : RocketEngine; and part fuelTank : FuelTank;',
      solution: 'part def Hull {\n  part mainEngine : RocketEngine;\n  part fuelTank : FuelTank;\n}',
    },
  },
  {
    id: 5,
    name: 'Comment & Documentation',
    tier: 'foundation',
    platformColour: PLANET_COLOURS.foundation,
    platforms: LAYOUT_E,
    rocketX: 232,
    alienPattern: 'drone',
    alienCount: 4,
    alienSpeed: 50,
    fuelNeeded: 6,
    buildRocket: true,
    mission: {
      brief: 'Document the life-support system with a SysML doc comment.',
      concept: 'comment',
      tags: ['comment', 'doc'],
      starterCode: 'part def LifeSupport {\n  // Add a doc comment\n}\n',
      expectedPattern: /part\s+def\s+LifeSupport\s*\{[\s\S]*?doc\s+\/\*[\s\S]*?\w[\s\S]*?\*\//,
      hint: 'Use: doc /* Manages crew oxygen and cabin pressure */',
      solution: 'part def LifeSupport {\n  doc /* Manages crew oxygen and cabin pressure */\n}',
    },
  },

  // ═══════════════════════════════════════════
  // TIER 2: STRUCTURE (Levels 6–10)
  // ═══════════════════════════════════════════
  {
    id: 6,
    name: 'Port Definition',
    tier: 'structure',
    platformColour: PLANET_COLOURS.structure,
    platforms: LAYOUT_F,
    rocketX: 232,
    alienPattern: 'drone',
    alienCount: 4,
    alienSpeed: 55,
    fuelNeeded: 5,
    buildRocket: true,
    mission: {
      brief: 'Define a port for the fuel interface.',
      concept: 'port def',
      tags: ['port', 'attribute'],
      starterCode: '// Define a port for fuel flow\n',
      expectedPattern: /port\s+def\s+\w+\s*\{/,
      hint: 'Use: port def FuelPort { }',
      solution: 'port def FuelPort {\n  attribute flowRate : Real;\n}',
    },
  },
  {
    id: 7,
    name: 'Connection Usage',
    tier: 'structure',
    platformColour: PLANET_COLOURS.structure,
    platforms: LAYOUT_G,
    rocketX: 232,
    alienPattern: 'asteroid',
    alienCount: 5,
    alienSpeed: 55,
    fuelNeeded: 5,
    buildRocket: false,
    mission: {
      brief: 'Connect the fuel tank to the engine inside the propulsion system.',
      concept: 'connect',
      tags: ['connect', 'part'],
      starterCode: 'part def Propulsion {\n  part tank : FuelTank;\n  part engine : RocketEngine;\n  // Connect them\n}\n',
      expectedPattern: /connect\s+\w+/,
      hint: 'Use: connect tank.fuelOut to engine.fuelIn;',
      solution: 'part def Propulsion {\n  part tank : FuelTank;\n  part engine : RocketEngine;\n  connect tank.fuelOut to engine.fuelIn;\n}',
    },
  },
  {
    id: 8,
    name: 'Import & Reuse',
    tier: 'structure',
    platformColour: PLANET_COLOURS.structure,
    platforms: LAYOUT_H,
    rocketX: 232,
    alienPattern: 'asteroid',
    alienCount: 5,
    alienSpeed: 60,
    fuelNeeded: 6,
    buildRocket: false,
    mission: {
      brief: 'Import definitions from one package into another so they can be reused across systems.',
      concept: 'import',
      tags: ['import', 'package'],
      starterCode: 'package Navigation {\n  // Import all definitions from Spacecraft\n}\n',
      expectedPattern: /package\s+Navigation\s*\{[\s\S]*?import\s+/,
      hint: 'Use: import Spacecraft::*;',
      solution: 'package Navigation {\n  import Spacecraft::*;\n  part navComputer : Hull;\n}',
    },
  },
  {
    id: 9,
    name: 'Enumeration',
    tier: 'structure',
    platformColour: PLANET_COLOURS.structure,
    platforms: LAYOUT_A,
    rocketX: 232,
    alienPattern: 'solar_flare',
    alienCount: 5,
    alienSpeed: 60,
    fuelNeeded: 6,
    buildRocket: false,
    mission: {
      brief: 'Create an enumeration for thrust modes.',
      concept: 'enum def',
      tags: ['enum'],
      starterCode: '// Define thrust modes\n',
      expectedPattern: /enum\s+def\s+ThrustMode\s*\{[\s\S]*?enum\s+idle[\s\S]*?enum\s+low[\s\S]*?enum\s+high/,
      hint: 'Use: enum def ThrustMode { enum idle; enum low; enum high; }',
      solution: 'enum def ThrustMode {\n  enum idle;\n  enum low;\n  enum high;\n}',
    },
  },
  {
    id: 10,
    name: 'Specialisation',
    tier: 'structure',
    platformColour: PLANET_COLOURS.structure,
    platforms: LAYOUT_B,
    rocketX: 232,
    alienPattern: 'solar_flare',
    alienCount: 6,
    alienSpeed: 65,
    fuelNeeded: 6,
    buildRocket: true,
    mission: {
      brief: 'Specialise Engine into IonEngine with inheritance.',
      concept: 'specialization',
      tags: ['part'],
      starterCode: '// Specialise RocketEngine into IonEngine\n',
      expectedPattern: /part\s+def\s+IonEngine\s+:>\s+RocketEngine/,
      hint: 'Use: part def IonEngine :> RocketEngine { }',
      solution: 'part def IonEngine :> RocketEngine {\n  attribute ionCharge : Real;\n}',
    },
  },

  // ═══════════════════════════════════════════
  // TIER 3: BEHAVIOUR (Levels 11–15)
  // ═══════════════════════════════════════════
  {
    id: 11,
    name: 'Action Definition',
    tier: 'behaviour',
    platformColour: PLANET_COLOURS.behaviour,
    platforms: LAYOUT_C,
    rocketX: 232,
    alienPattern: 'space_pirate',
    alienCount: 5,
    alienSpeed: 65,
    fuelNeeded: 5,
    buildRocket: true,
    mission: {
      brief: 'Define a launch action for the rocket.',
      concept: 'action def',
      tags: ['action def'],
      starterCode: '// Define a launch action\n',
      expectedPattern: /action\s+def\s+\w+/,
      hint: 'Use: action def Launch { }',
      solution: 'action def Launch {\n  in item fuel : RocketFuel;\n  out attribute thrustForce : Real;\n}',
    },
  },
  {
    id: 12,
    name: 'State Machine',
    tier: 'behaviour',
    platformColour: PLANET_COLOURS.behaviour,
    platforms: LAYOUT_D,
    rocketX: 232,
    alienPattern: 'space_pirate',
    alienCount: 6,
    alienSpeed: 70,
    fuelNeeded: 6,
    buildRocket: false,
    mission: {
      brief: 'Model flight phases with entry and exit actions — the heart of a state machine.',
      concept: 'state def',
      tags: ['state', 'entry', 'exit'],
      starterCode: '// Define flight phases with entry/exit actions\nstate def FlightPhase {\n  state idle;\n  // Add more states with entry/exit\n}\n',
      expectedPattern: /state\s+def\s+FlightPhase[\s\S]*?entry\s+/,
      hint: 'Use: state ignition { entry action startIgnition; } and state cruise { exit action cutoff; }',
      solution: 'state def FlightPhase {\n  state idle;\n  state ignition {\n    entry action startIgnition;\n  }\n  state cruise {\n    exit action cutoff;\n  }\n}',
    },
  },
  {
    id: 13,
    name: 'Transition',
    tier: 'behaviour',
    platformColour: PLANET_COLOURS.behaviour,
    platforms: LAYOUT_E,
    rocketX: 232,
    alienPattern: 'magnetic_mine',
    alienCount: 5,
    alienSpeed: 70,
    fuelNeeded: 6,
    buildRocket: false,
    mission: {
      brief: 'Add a transition from countdown to liftoff.',
      concept: 'transition',
      tags: ['transition', 'state'],
      starterCode: 'state def LaunchSequence {\n  state countdown;\n  state liftoff;\n  // Add transition\n}\n',
      expectedPattern: /state\s+def\s+LaunchSequence[\s\S]*?transition\s+\w+/,
      hint: 'Use: transition ignite first countdown then liftoff;',
      solution: 'state def LaunchSequence {\n  state countdown;\n  state liftoff;\n  transition ignite\n    first countdown\n    then liftoff;\n}',
    },
  },
  {
    id: 14,
    name: 'Constraint',
    tier: 'behaviour',
    platformColour: PLANET_COLOURS.behaviour,
    platforms: LAYOUT_F,
    rocketX: 232,
    alienPattern: 'magnetic_mine',
    alienCount: 6,
    alienSpeed: 75,
    fuelNeeded: 6,
    buildRocket: false,
    mission: {
      brief: 'Add a constraint: thrust must be > 0 for launch.',
      concept: 'constraint',
      tags: ['constraint'],
      starterCode: '// Add a launch constraint\n',
      expectedPattern: /constraint\s+def\s+PositiveThrust\s*\{[\s\S]*?constraint\s*\{[\s\S]*?thrust\s*>\s*0/,
      hint: 'Use: constraint def PositiveThrust { constraint { thrust > 0 } }',
      solution: 'constraint def PositiveThrust {\n  constraint { thrust > 0 }\n}',
    },
  },
  {
    id: 15,
    name: 'Requirement & Traceability',
    tier: 'behaviour',
    platformColour: PLANET_COLOURS.behaviour,
    platforms: LAYOUT_G,
    rocketX: 232,
    alienPattern: 'dust_devil',
    alienCount: 6,
    alienSpeed: 75,
    fuelNeeded: 6,
    buildRocket: true,
    mission: {
      brief: 'Define a requirement and bind it to a constraint — this is how SysML traces rules to their formal checks.',
      concept: 'requirement def',
      tags: ['requirement', 'constraint'],
      starterCode: '// Define a requirement that references the PositiveThrust constraint\n',
      expectedPattern: /requirement\s+def\s+MinFuel[\s\S]*?require\s+constraint/,
      hint: 'Use: requirement def MinFuel { require constraint PositiveThrust; }',
      solution: 'requirement def MinFuel {\n  doc /* The fuel level must exceed 50% before launch */\n  attribute minLevel : Real;\n  require constraint PositiveThrust;\n}',
    },
  },

  // ═══════════════════════════════════════════
  // TIER 4: MASTERY (Levels 16–20)
  // ═══════════════════════════════════════════
  {
    id: 16,
    name: 'Use Case',
    tier: 'mastery',
    platformColour: PLANET_COLOURS.mastery,
    platforms: LAYOUT_H,
    rocketX: 232,
    alienPattern: 'meteor',
    alienCount: 6,
    alienSpeed: 80,
    fuelNeeded: 6,
    buildRocket: true,
    mission: {
      brief: 'Model a use case for orbital insertion.',
      concept: 'use case def',
      tags: ['use case'],
      starterCode: '// Define an orbital insertion use case\n',
      expectedPattern: /use\s+case\s+def\s+OrbitalInsertion\s*\{[\s\S]*?subject\s+\w+[\s\S]*?actor\s+\w+/,
      hint: 'Use: use case def OrbitalInsertion { subject vehicle : Hull; actor ground : GroundControl; }',
      solution: 'use case def OrbitalInsertion {\n  subject vehicle : Hull;\n  actor ground : GroundControl;\n}',
    },
  },
  {
    id: 17,
    name: 'Allocation',
    tier: 'mastery',
    platformColour: PLANET_COLOURS.mastery,
    platforms: LAYOUT_E,
    rocketX: 232,
    alienPattern: 'jellyfish',
    alienCount: 7,
    alienSpeed: 80,
    fuelNeeded: 6,
    buildRocket: false,
    mission: {
      brief: 'Allocate the navigation function to the flight computer.',
      concept: 'allocation',
      tags: ['allocate', 'part'],
      starterCode: 'part def FlightSystem {\n  // Allocate navigation to computer\n}\n',
      expectedPattern: /allocate\s+\w+/,
      hint: 'Use: allocate navigate to flightComputer;',
      solution: 'part def FlightSystem {\n  part flightComputer : Computer;\n  action navigate;\n  allocate navigate to flightComputer;\n}',
    },
  },
  {
    id: 18,
    name: 'Interface Definition',
    tier: 'mastery',
    platformColour: PLANET_COLOURS.mastery,
    platforms: LAYOUT_B,
    rocketX: 232,
    alienPattern: 'drone',
    alienCount: 7,
    alienSpeed: 85,
    fuelNeeded: 6,
    buildRocket: false,
    mission: {
      brief: 'Define an interface with directional ports — the contract between subsystems.',
      concept: 'interface def',
      tags: ['interface', 'port'],
      starterCode: '// Define a data-link interface with in/out ports\n',
      expectedPattern: /interface\s+def\s+DataLink\s*\{/,
      hint: 'Use: interface def DataLink { in port command; out port telemetry; }',
      solution: 'interface def DataLink {\n  in port command;\n  out port telemetry;\n}',
    },
  },
  {
    id: 19,
    name: 'Satisfy & Assert',
    tier: 'mastery',
    platformColour: PLANET_COLOURS.mastery,
    platforms: LAYOUT_D,
    rocketX: 232,
    alienPattern: 'solar_flare',
    alienCount: 8,
    alienSpeed: 85,
    fuelNeeded: 6,
    buildRocket: false,
    mission: {
      brief: 'Close the loop: satisfy a requirement and assert a constraint to prove the design is sound.',
      concept: 'verification',
      tags: ['satisfy', 'assert', 'constraint'],
      starterCode: 'part def FuelManagement {\n  // Satisfy the requirement and assert the constraint\n}\n',
      expectedPattern: /part\s+def\s+FuelManagement[\s\S]*?satisfy\s+\w+[\s\S]*?assert\s+constraint/,
      hint: 'Use: satisfy MinFuel; and assert constraint PositiveThrust;',
      solution: 'part def FuelManagement {\n  satisfy MinFuel;\n  assert constraint PositiveThrust;\n}',
    },
  },
  {
    id: 20,
    name: 'Complete Model',
    tier: 'mastery',
    platformColour: PLANET_COLOURS.mastery,
    platforms: LAYOUT_G,
    rocketX: 232,
    alienPattern: 'dust_devil',
    alienCount: 8,
    alienSpeed: 90,
    fuelNeeded: 8,
    buildRocket: true,
    mission: {
      brief: 'Assemble the complete Jetpac spacecraft from all your defined systems for the final launch to Mars!',
      concept: 'integration',
      tags: ['part'],
      starterCode: '// Assemble the complete spacecraft\npart def JetpacSpacecraft {\n  // Compose parts from previous definitions\n}\n',
      expectedPattern: /part\s+def\s+JetpacSpacecraft\s*\{[\s\S]*?part\s+\w+\s*:\s*Propulsion[\s\S]*?part\s+\w+\s*:\s*FlightSystem[\s\S]*?part\s+\w+\s*:\s*LifeSupport/,
      hint: 'Compose your systems: part propulsion : Propulsion; part flight : FlightSystem; part life : LifeSupport;',
      solution: 'part def JetpacSpacecraft {\n  part propulsion : Propulsion;\n  part flight : FlightSystem;\n  part life : LifeSupport;\n}\npart missionVehicle : JetpacSpacecraft;',
    },
  },
];

/** Get levels for a specific tier */
export function getLevelsByTier(tier: Tier): LevelConfig[] {
  return LEVELS.filter((l) => l.tier === tier);
}

/** Get the tier display name and colour */
export function getTierInfo(tier: Tier): { name: string; colour: string; icon: string } {
  const info: Record<Tier, { name: string; colour: string; icon: string }> = {
    foundation: { name: 'Foundation', colour: '#00f92f', icon: '▣' },
    structure: { name: 'Structure', colour: '#00fbfe', icon: '◈' },
    behaviour: { name: 'Behaviour', colour: '#ff331c', icon: '◉' },
    mastery: { name: 'Mastery', colour: '#ffea00', icon: '★' },
  };
  return info[tier];
}
