/** Public contracts for the action dispatcher and mechanism lifecycle. */
export type LockMode = 'pin' | 'disc' | 'code' | 'plate';

export type PuzzleMode = 'free' | 'classic' | 'sequence' | 'special' |
  'tension' | 'resonance' | 'pinflight' | 'springtumblers' | 'symbolpins';

export type CaseFinish = 'titanium' | 'graphite' | 'bronze' | 'navy';
export type SteelPaintVariant = 'steel' | 'graphite' | 'enamel';
export type BrassPaintVariant = 'brass' | 'copper';

export type GameCommand =
  | { type: 'world-start'; id: 'wharf' | 'keyprofile' | 'pairednodes' | 'museum'; level: 1 | 2 | 3 }
  | { type: 'world-choice'; index: number }
  | { type: 'world-confirm' | 'world-exit' | 'world-restart' }
  | { type: 'mode'; mode: LockMode }
  | { type: 'pin-count'; count: number }
  | { type: 'plate-select'; index: number }
  | { type: 'plate-count'; count: number }
  | { type: 'plate-tool'; index: number }
  | { type: 'plate-shift'; delta: -1 | 1 }
  | { type: 'puzzle-start'; puzzle: PuzzleMode; level: number }
  | { type: 'puzzle-select'; index: number; press?: boolean }
  | { type: 'puzzle-adjust'; delta: number }
  | { type: 'puzzle-value'; value: number }
  | { type: 'puzzle-action' }
  | { type: 'insert-toggle' }
  | { type: 'key-insert'; direction: number }
  | { type: 'turn-toggle' }
  | { type: 'open' }
  | { type: 'tool-toggle' }
  | { type: 'wrench'; index: number }
  | { type: 'pick' }
  | { type: 'pick-step'; delta: number }
  | { type: 'pick-down' }
  | { type: 'pick-wait' }
  | { type: 'wrong-key-toggle' }
  | { type: 'reset' }
  | { type: 'opacity'; value: number }
  | { type: 'explode'; value: number }
  | { type: 'explode-toggle' }
  | { type: 'auto-xray-toggle' }
  | { type: 'schematic-xray-toggle' }
  | { type: 'cartoon-toggle' }
  | { type: 'toon-toggle' }
  | { type: 'outline-toggle' }
  | { type: 'paper-toggle' }
  | { type: 'toon-strength'; value: number }
  | { type: 'toon-bands'; value: number }
  | { type: 'cartoon-outline'; value: number }
  | { type: 'outline-width'; value: number }
  | { type: 'paper-strength'; value: number }
  | { type: 'paper-scale'; value: number }
  | { type: 'painted-materials-toggle' }
  | { type: 'paint-strength'; value: number }
  | { type: 'paint-material'; value: number }
  | { type: 'paint-detail'; value: number }
  // Backwards compatibility for recorded actions; no visual effect remains.
  | { type: 'film-intensity'; value: number }
  | { type: 'paint-steel-variant'; variant: SteelPaintVariant }
  | { type: 'paint-brass-variant'; variant: BrassPaintVariant }
  | { type: 'case-finish'; color: CaseFinish }
  | { type: 'pin-finish'; index: number }
  | { type: 'oil-tool-toggle' };

export interface MechanismFrame {
  D(current: number, target: number, speed?: number): number;
  canRotate: boolean;
  fullTurn: number;
  pinXs: number[];
  pinPuzzle: object | null;
  selectedTension: number;
}

export interface MechanismHandle {
  name: LockMode;
  group: { visible: boolean };
  create(): unknown;
  update(frame: MechanismFrame): void;
  reset(): void;
  dispose(): void;
  readonly disposed: boolean;
}
