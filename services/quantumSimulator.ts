import type { PlacedGate, SimulationResult } from '../types';

// --- Complex Number Math ---
class Complex {
  constructor(public re: number = 0, public im: number = 0) {}

  add(c: Complex): Complex {
    return new Complex(this.re + c.re, this.im + c.im);
  }

  multiply(c: Complex): Complex {
    const re = this.re * c.re - this.im * c.im;
    const im = this.re * c.im + this.im * c.re;
    return new Complex(re, im);
  }

  magnitudeSq(): number {
    return this.re * this.re + this.im * this.im;
  }
}

// --- Quantum Gate Definitions (Matrices) ---
const GATES: { [key: string]: Complex[][] } = {
  h: [
    [new Complex(1 / Math.sqrt(2)), new Complex(1 / Math.sqrt(2))],
    [new Complex(1 / Math.sqrt(2)), new Complex(-1 / Math.sqrt(2))],
  ],
  x: [
    [new Complex(0), new Complex(1)],
    [new Complex(1), new Complex(0)],
  ],
  y: [
    [new Complex(0), new Complex(0, -1)],
    [new Complex(0, 1), new Complex(0)],
  ],
  z: [
    [new Complex(1), new Complex(0)],
    [new Complex(0), new Complex(-1)],
  ],
  s: [
    [new Complex(1), new Complex(0)],
    [new Complex(0), new Complex(0, 1)], // e^(i*pi/2) = i
  ],
  sdg: [
    [new Complex(1), new Complex(0)],
    [new Complex(0), new Complex(0, -1)], // e^(-i*pi/2) = -i
  ],
  t: [
    [new Complex(1), new Complex(0)],
    [new Complex(0), new Complex(Math.cos(Math.PI / 4), Math.sin(Math.PI / 4))], // e^(i*pi/4)
  ],
  tdg: [
    [new Complex(1), new Complex(0)],
    [new Complex(0), new Complex(Math.cos(-Math.PI / 4), Math.sin(-Math.PI / 4))], // e^(-i*pi/4)
  ],
};

/**
 * Simulates a quantum circuit and returns the measurement probabilities.
 * @param placedGates The array of gates placed on the canvas.
 * @param numQubits The total number of qubits in the circuit.
 * @returns A SimulationResult object with probabilities.
 */
export const simulate = (placedGates: PlacedGate[], numQubits: number): SimulationResult => {
  const numStates = 1 << numQubits;
  let stateVector: Complex[] = Array(numStates).fill(new Complex(0));
  stateVector[0] = new Complex(1); // Initialize to |00...0>

  // Sort gates by their horizontal position to apply them in order
  const sortedGates = [...placedGates].sort((a, b) => a.left - b.left);

  for (const gate of sortedGates) {
    let newStateVector = [...stateVector];

    switch (gate.gateId) {
      case 'h':
      case 'x':
      case 'y':
      case 'z':
      case 's':
      case 'sdg':
      case 't':
      case 'tdg':
        newStateVector = applySingleQubitGate(stateVector, gate.qubit, GATES[gate.gateId], numQubits);
        break;
      case 'cnot':
        if (gate.controlQubit !== undefined) {
          newStateVector = applyCNOT(stateVector, gate.controlQubit, gate.qubit, numQubits);
        }
        break;
      case 'cz':
        if (gate.controlQubit !== undefined) {
          newStateVector = applyCZ(stateVector, gate.controlQubit, gate.qubit, numQubits);
        }
        break;
      case 'swap':
        if (gate.controlQubit !== undefined) {
          newStateVector = applySWAP(stateVector, gate.qubit, gate.controlQubit, numQubits);
        }
        break;
      // 'measure' gate doesn't change the state vector in this simulation model
      case 'measure':
        break;
    }
    stateVector = newStateVector;
  }

  // Calculate probabilities from the final state vector
  const probabilities = stateVector.map((amplitude, i) => {
    const binaryState = i.toString(2).padStart(numQubits, '0');
    return {
      state: `|${binaryState}⟩`,
      value: amplitude.magnitudeSq(),
    };
  }).filter(p => p.value > 1e-9); // Filter out negligible probabilities

  return { probabilities };
};

// --- Gate Application Logic ---
const applySingleQubitGate = (
  currentState: Complex[],
  qubit: number,
  matrix: Complex[][],
  numQubits: number
): Complex[] => {
  const newState = Array(1 << numQubits).fill(new Complex(0));
  for (let i = 0; i < (1 << numQubits); i++) {
    const bit = (i >> (numQubits - 1 - qubit)) & 1;
    const targetState = i ^ (bit << (numQubits - 1 - qubit));
    
    const offDiagonalBit = targetState | ((1-bit) << (numQubits - 1 - qubit));
    
    newState[i] = currentState[targetState].multiply(matrix[bit][0]).add(
                  currentState[offDiagonalBit].multiply(matrix[bit][1])
    );
  }
  return newState;
};

const applyCNOT = (
  currentState: Complex[],
  controlQubit: number,
  targetQubit: number,
  numQubits: number
): Complex[] => {
  const newState = [...currentState];
  const controlMask = 1 << (numQubits - 1 - controlQubit);
  const targetMask = 1 << (numQubits - 1 - targetQubit);

  for (let i = 0; i < (1 << numQubits); i++) {
    // If control bit is 1
    if ((i & controlMask) !== 0) {
      const flippedState = i ^ targetMask;
      // Process each pair only once to avoid swapping back
      if (i < flippedState) {
        [newState[i], newState[flippedState]] = [currentState[flippedState], currentState[i]];
      }
    }
  }
  return newState;
};

const applyCZ = (
  currentState: Complex[],
  controlQubit: number,
  targetQubit: number,
  numQubits: number
): Complex[] => {
  const newState = [...currentState];
  const controlMask = 1 << (numQubits - 1 - controlQubit);
  const targetMask = 1 << (numQubits - 1 - targetQubit);
  for (let i = 0; i < (1 << numQubits); i++) {
    // Apply phase flip if both control and target bits are 1
    if ((i & controlMask) && (i & targetMask)) {
      newState[i] = newState[i].multiply(new Complex(-1));
    }
  }
  return newState;
};

const applySWAP = (
  currentState: Complex[],
  qubit1: number,
  qubit2: number,
  numQubits: number
): Complex[] => {
  const newState = [...currentState];
  const mask1 = 1 << (numQubits - 1 - qubit1);
  const mask2 = 1 << (numQubits - 1 - qubit2);
  for (let i = 0; i < (1 << numQubits); i++) {
    const bit1 = (i & mask1) !== 0;
    const bit2 = (i & mask2) !== 0;
    // If bits are different, find the swapped state and swap amplitudes
    if (bit1 !== bit2) {
      const j = i ^ mask1 ^ mask2; // The state with the bits swapped
      // Process each pair only once to avoid swapping back
      if (i < j) {
        [newState[i], newState[j]] = [currentState[j], currentState[i]];
      }
    }
  }
  return newState;
};