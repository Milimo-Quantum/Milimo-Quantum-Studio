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
const GATES = {
  h: [
    [new Complex(1 / Math.sqrt(2)), new Complex(1 / Math.sqrt(2))],
    [new Complex(1 / Math.sqrt(2)), new Complex(-1 / Math.sqrt(2))],
  ],
  x: [
    [new Complex(0), new Complex(1)],
    [new Complex(1), new Complex(0)],
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
        newStateVector = applySingleQubitGate(stateVector, gate.qubit, GATES[gate.gateId], numQubits);
        break;
      case 'cnot':
        if (gate.controlQubit !== undefined) {
          newStateVector = applyCNOT(stateVector, gate.controlQubit, gate.qubit, numQubits);
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
  for (let i = 0; i < (1 << numQubits); i++) {
    // Check if the control bit is 1
    if ((i >> (numQubits - 1 - controlQubit)) & 1) {
      // If control is 1, flip the target bit
      const targetBitMask = 1 << (numQubits - 1 - targetQubit);
      const flippedState = i ^ targetBitMask;
      // Swap amplitudes
      [newState[i], newState[flippedState]] = [currentState[flippedState], currentState[i]];
    }
  }
  // Because we swap pairs, we only need to iterate through half the states where control is 1.
  // This is a simplified way that works because we apply the swap twice.
  // Correcting it by only applying when iterating:
  const finalState = [...currentState];
  for (let i = 0; i < (1 << numQubits); i++) {
      if ((i >> (numQubits - 1 - controlQubit)) & 1) {
          const targetBitMask = 1 << (numQubits - 1 - targetQubit);
          const flippedState = i ^ targetBitMask;
          if (i < flippedState) { // Process each pair only once
              [finalState[i], finalState[flippedState]] = [currentState[flippedState], currentState[i]];
          }
      }
  }
  return finalState;
};
